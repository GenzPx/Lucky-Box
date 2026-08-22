import "@xterm/xterm/css/xterm.css";
import quickTools from "components/quickTools";
import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import EditorFile from "lib/editorFile";
import openFile from "lib/openFile";
import openFolder from "lib/openFolder";
import appSettings from "lib/settings";
import helpers from "utils/helpers";
import TerminalComponent from "./terminal";
import TerminalTouchSelection from "./terminalTouchSelection";

const TERMINAL_SESSION_STORAGE_KEY = "acodeTerminalSessions";
class TerminalManager {
	constructor() {
		this.terminals = new Map();
		this.terminalCounter = 0;
	}
	extractTerminalNumber(name) {
		if (!name) return null;
		const match = String(name).match(/^Terminal\s+(\d+)(?:\b| - )/i);
		if (!match) return null;
		const number = Number.parseInt(match[1], 10);
		return Number.isInteger(number) && number > 0 ? number : null;
	}
	getNextAvailableTerminalNumber() {
		const usedNumbers = new Set();
		for (const terminal of this.terminals.values()) {
			const number = terminal?.terminalNumber;
			if (Number.isInteger(number) && number > 0) {
				usedNumbers.add(number);
			}
		}
		let nextNumber = 1;
		while (usedNumbers.has(nextNumber)) {
			nextNumber++;
		}
		return nextNumber;
	}
	normalizePersistedSessions(stored) {
		if (!Array.isArray(stored)) {
			return {
				sessions: [],
				changed: stored != null,
			};
		}
		const sessions = [];
		const uniqueSessions = [];
		const seenPids = new Set();
		let changed = false;
		for (const entry of stored) {
			if (!entry) {
				changed = true;
				continue;
			}
			if (typeof entry === "string") {
				sessions.push({
					pid: entry,
					name: `Terminal ${entry}`,
					pinned: false,
				});
				changed = true;
				continue;
			}
			if (typeof entry !== "object" || !entry.pid) {
				changed = true;
				continue;
			}
			const pid = String(entry.pid);
			const name =
				typeof entry.name === "string" && entry.name.trim()
					? entry.name.trim()
					: `Terminal ${pid}`;
			const pinned = entry.pinned === true;
			if (entry.pid !== pid || entry.name !== name || entry.pinned !== pinned) {
				changed = true;
			}
			sessions.push({
				pid,
				name,
				pinned,
			});
		}
		for (const session of sessions) {
			const pid = String(session.pid);
			if (seenPids.has(pid)) {
				changed = true;
				continue;
			}
			seenPids.add(pid);
			uniqueSessions.push({
				pid,
				name:
					typeof session.name === "string" && session.name.trim()
						? session.name.trim()
						: `Terminal ${pid}`,
				pinned: session.pinned === true,
			});
		}
		if (uniqueSessions.length !== stored.length) {
			changed = true;
		}
		return {
			sessions: uniqueSessions,
			changed,
		};
	}
	readPersistedSessions() {
		try {
			return this.normalizePersistedSessions(
				helpers.parseJSON(localStorage.getItem(TERMINAL_SESSION_STORAGE_KEY)),
			);
		} catch (error) {
			console.error("Failed to read persisted terminal sessions:", error);
			return {
				sessions: [],
				changed: false,
			};
		}
	}
	async getPersistedSessions() {
		try {
			const { sessions, changed } = this.readPersistedSessions();
			if (!sessions.length) {
				if (changed) {
					this.savePersistedSessions([]);
				}
				return [];
			}
			if (!(await Terminal.isAxsRunning())) {
				this.savePersistedSessions([]);
				return [];
			}
			if (changed) {
				this.savePersistedSessions(sessions);
			}
			return sessions;
		} catch (error) {
			console.error("Failed to read persisted terminal sessions:", error);
			return [];
		}
	}
	savePersistedSessions(sessions) {
		try {
			localStorage.setItem(
				TERMINAL_SESSION_STORAGE_KEY,
				JSON.stringify(sessions),
			);
		} catch (error) {
			console.error("Failed to persist terminal sessions:", error);
		}
	}
	async persistTerminalSession(pid, name, pinned = false) {
		if (!pid) return;
		const pidStr = String(pid);
		const { sessions } = this.readPersistedSessions();
		const existingIndex = sessions.findIndex(
			(session) => session.pid === pidStr,
		);
		const sessionData = {
			pid: pidStr,
			name: name || `Terminal ${pidStr}`,
			pinned: pinned === true,
		};
		if (existingIndex >= 0) {
			sessions[existingIndex] = {
				...sessions[existingIndex],
				...sessionData,
			};
		} else {
			sessions.push(sessionData);
		}
		this.savePersistedSessions(sessions);
	}
	async removePersistedSession(pid) {
		if (!pid) return;
		const pidStr = String(pid);
		const { sessions } = this.readPersistedSessions();
		const nextSessions = sessions.filter((session) => session.pid !== pidStr);
		if (nextSessions.length !== sessions.length) {
			this.savePersistedSessions(nextSessions);
		}
	}
	async restorePersistedSessions() {
		const sessions = await this.getPersistedSessions();
		if (!sessions.length) return;
		const manager = window.editorManager;
		const activeFileId = manager?.activeFile?.id;
		const restoredTerminals = [];
		const failedSessions = [];
		for (const session of sessions) {
			if (!session?.pid) continue;
			if (this.terminals.has(session.pid)) continue;
			try {
				const instance = await this.createServerTerminal({
					pid: session.pid,
					name: session.name,
					pinned: session.pinned === true,
					reconnecting: true,
					render: false,
				});
				if (instance) restoredTerminals.push(instance);
			} catch (error) {
				console.error(
					`Failed to restore terminal session ${session.pid}:`,
					error,
				);
				failedSessions.push(session.name || session.pid);
				await this.removePersistedSession(session.pid);
			}
		}
		if (failedSessions.length > 0) {
			const message =
				failedSessions.length === 1
					? `Skipped unavailable terminal: ${failedSessions[0]}`
					: `Skipped ${failedSessions.length} unavailable terminals`;
			toast(message);
		}
		if (activeFileId && manager?.getFile) {
			const fileToRestore = manager.getFile(activeFileId, "id");
			fileToRestore?.makeActive();
		} else if (!manager?.activeFile && restoredTerminals.length) {
			restoredTerminals[0]?.file?.makeActive();
		}
	}
	async createTerminal(options = {}) {
		try {
			const { render, serverMode, reconnecting, pinned, ...terminalOptions } =
				options;
			const shouldRender = render !== false;
			const isServerMode = serverMode !== false;
			const isReconnecting = reconnecting === true;
			const terminalId = `terminal_${++this.terminalCounter}`;
			const providedName =
				typeof options.name === "string" ? options.name.trim() : "";
			const terminalNumber = providedName
				? this.extractTerminalNumber(providedName)
				: this.getNextAvailableTerminalNumber();
			const terminalName = providedName || `Terminal ${terminalNumber}`;
			const titlePrefix = terminalNumber
				? `Terminal ${terminalNumber}`
				: terminalName;
			if (isServerMode) {
				const installationResult = await this.checkAndInstallTerminal();
				if (!installationResult.success) {
					throw new Error(installationResult.error);
				}
			}
			const terminalComponent = new TerminalComponent({
				serverMode: isServerMode,
				...terminalOptions,
			});
			const terminalContainer = tag("div", {
				className: "terminal-content",
				id: `terminal-${terminalId}`,
			});
			const terminalStyles = this.getTerminalStyles();
			let terminalStyle = document.getElementById("acode-terminal-styles");
			if (!terminalStyle) {
				terminalStyle = tag("style", {
					id: "acode-terminal-styles",
					textContent: terminalStyles,
				});
				document.body.appendChild(terminalStyle);
			} else {
				terminalStyle.textContent = terminalStyles;
			}
			const terminalFile = new EditorFile(terminalName, {
				type: "terminal",
				content: terminalContainer,
				tabIcon: "icon square-terminal",
				pinned,
				render: shouldRender,
			});
			return await new Promise((resolve, reject) => {
				setTimeout(async () => {
					try {
						terminalComponent.mount(terminalContainer);
						if (terminalComponent.serverMode) {
							await terminalComponent.connectToSession(terminalOptions.pid);
						} else {
							terminalComponent.write(
								"Local terminal mode - ready for output\r\n",
							);
						}
						const uniqueId = terminalComponent.pid || terminalId;
						this.setupTerminalHandlers(
							terminalFile,
							terminalComponent,
							uniqueId,
							titlePrefix,
						);
						const instance = {
							id: uniqueId,
							name: terminalName,
							terminalNumber,
							component: terminalComponent,
							file: terminalFile,
							container: terminalContainer,
						};
						this.terminals.set(uniqueId, instance);
						if (terminalComponent.serverMode && terminalComponent.pid) {
							await this.persistTerminalSession(
								terminalComponent.pid,
								terminalName,
								terminalFile.pinned,
							);
						}
						resolve(instance);
					} catch (error) {
						console.error("Failed to initialize terminal:", error);
						try {
							terminalComponent.dispose();
						} catch (disposeError) {
							console.error(
								"Error disposing terminal component:",
								disposeError,
							);
						}
						try {
							terminalFile._skipTerminalCloseConfirm = true;
							terminalFile.remove(true, {
								ignorePinned: true,
							});
						} catch (removeError) {
							console.error("Error removing terminal tab:", removeError);
						}
						if (!isReconnecting) {
							const errorMessage = error?.message || "Unknown error";
							alert(
								strings["error"],
								`Failed to create terminal: ${errorMessage}`,
							);
						}
						reject(error);
					}
				}, 100);
			});
		} catch (error) {
			console.error("Failed to create terminal:", error);
			throw error;
		}
	}
	async checkAndInstallTerminal() {
		try {
			const isInstalled = await Terminal.isInstalled();
			if (isInstalled) {
				return {
					success: true,
				};
			}
			const isSupported = await Terminal.isSupported();
			if (!isSupported) {
				return {
					success: false,
					error: "Terminal is not supported on this device architecture",
				};
			}
			const installTerminal = await this.createInstallationTerminal();
			const installResult = await Terminal.install(
				(message) => {
					const cleanMessage = this.formatInstallLog(message);
					installTerminal.component.write(`${cleanMessage}\r\n`);
				},
				(...errorParts) => {
					const cleanError = this.formatInstallLog(errorParts);
					installTerminal.component.write(
						`\x1b[31mError: ${cleanError}\x1b[0m\r\n`,
					);
				},
			);
			if (installResult === true) {
				return {
					success: true,
				};
			} else {
				const error =
					Terminal.lastInstallError ||
					"Terminal installation failed - process did not exit with code 0";
				return {
					success: false,
					error,
				};
			}
		} catch (error) {
			console.error("Terminal installation failed:", error);
			return {
				success: false,
				error: `Terminal installation failed: ${this.formatInstallLog(error)}`,
			};
		}
	}
	formatInstallLog(value) {
		const values = Array.isArray(value) ? value : [value];
		const message = values
			.filter((entry) => entry != null)
			.map((entry) => Terminal.formatError(entry))
			.filter(Boolean)
			.join(" ");
		return message.replace(/^(stdout|stderr)\s+/, "") || "Unknown error";
	}
	async createInstallationTerminal() {
		const terminalId = `install_terminal_${++this.terminalCounter}`;
		const terminalName = "Terminal Installation";
		const terminalComponent = new TerminalComponent({
			serverMode: false,
		});
		const terminalContainer = tag("div", {
			className: "terminal-content",
			id: `terminal-${terminalId}`,
		});
		const terminalStyles = this.getTerminalStyles();
		let terminalStyle = document.getElementById("acode-terminal-styles");
		if (!terminalStyle) {
			terminalStyle = tag("style", {
				id: "acode-terminal-styles",
				textContent: terminalStyles,
			});
			document.body.appendChild(terminalStyle);
		} else {
			terminalStyle.textContent = terminalStyles;
		}
		const terminalFile = new EditorFile(terminalName, {
			type: "terminal",
			content: terminalContainer,
			tabIcon: "icon save_alt",
			render: true,
		});
		return await new Promise((resolve, reject) => {
			setTimeout(async () => {
				try {
					terminalComponent.mount(terminalContainer);
					terminalComponent.write("🚀 Installing Terminal Environment...\r\n");
					terminalComponent.write(
						"This may take a few minutes depending on your connection.\r\n\r\n",
					);
					this.setupTerminalHandlers(
						terminalFile,
						terminalComponent,
						terminalId,
					);
					terminalFile.setCustomTitle(
						() => "Installing Terminal Environment...",
					);
					const instance = {
						id: terminalId,
						name: terminalName,
						component: terminalComponent,
						file: terminalFile,
						container: terminalContainer,
					};
					this.terminals.set(terminalId, instance);
					resolve(instance);
				} catch (error) {
					console.error("Failed to create installation terminal:", error);
					reject(error);
				}
			}, 100);
		});
	}
	async setupTerminalHandlers(
		terminalFile,
		terminalComponent,
		terminalId,
		titlePrefix = terminalId,
	) {
		const textarea = terminalComponent.terminal?.textarea;
		if (textarea) {
			const onFocus = () => {
				clearTimeout(this.onBlurTimeout);
				this.onFocusTimeout = setTimeout(() => {
					const { $toggler } = quickTools;
					$toggler.classList.add("hide");
					clearTimeout(this.quickToolsTogglerTimeout);
					this.quickToolsTogglerTimeout = setTimeout(() => {
						$toggler.style.display = "none";
					}, 300);
				}, 100);
			};
			const onBlur = () => {
				clearTimeout(this.onFocusTimeout);
				this.onBlurTimeout = setTimeout(() => {
					const { $toggler } = quickTools;
					$toggler.style.display = "";
					clearTimeout(this.quickToolsTogglerTimeout);
					requestAnimationFrame(() => $toggler.classList.remove("hide"));
				}, 100);
			};
			textarea.addEventListener("focus", onFocus);
			textarea.addEventListener("blur", onBlur);
			if (textarea === document.activeElement) {
				onFocus();
			}
			terminalComponent.cleanupFocusHandlers = () => {
				textarea.removeEventListener("focus", onFocus);
				textarea.removeEventListener("blur", onBlur);
			};
		}
		terminalFile.onfocus = () => {
			const run = () => {
				try {
					const pd = terminalComponent.fitAddon?.proposeDimensions?.();
					if (
						pd &&
						(pd.cols !== terminalComponent.terminal.cols ||
							pd.rows !== terminalComponent.terminal.rows)
					) {
						terminalComponent.fitAddon.fit();
					}
				} catch {}
				terminalComponent.focus();
			};
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(run);
			} else {
				setTimeout(run, 0);
			}
		};
		terminalFile.onclose = () => {
			this.closeTerminal(terminalId);
		};
		terminalFile.onpinstatechange = (pinned) => {
			if (!terminalComponent.serverMode || !terminalComponent.pid) return;
			void this.persistTerminalSession(
				terminalComponent.pid,
				terminalFile.filename,
				pinned,
			);
		};
		terminalFile._skipTerminalCloseConfirm = false;
		const originalRemove = terminalFile.remove.bind(terminalFile);
		terminalFile.remove = async (force = false, options = {}) => {
			if (terminalFile.pinned && !options?.ignorePinned) {
				return originalRemove(force, options);
			}
			if (
				!terminalFile._skipTerminalCloseConfirm &&
				this.shouldConfirmTerminalClose()
			) {
				const message = `${strings["close"]} ${strings["terminal"]}?`;
				const shouldClose = await confirm(strings["confirm"], message);
				if (!shouldClose) return;
			}
			terminalFile._skipTerminalCloseConfirm = false;
			return originalRemove(force, options);
		};
		let resizeTimeout = null;
		const RESIZE_DEBOUNCE = 200;
		let lastResizeTime = 0;
		let lastWidth = null;
		let lastHeight = null;
		const handleResize = (entries) => {
			const now = Date.now();
			const entry = entries && entries[0];
			const cr = entry?.contentRect;
			const width = cr?.width ?? terminalFile.content?.clientWidth ?? 0;
			const height = cr?.height ?? terminalFile.content?.clientHeight ?? 0;
			const isHidden =
				getComputedStyle(terminalFile.content).display === "none" ||
				terminalFile.content?.offsetHeight === 0;
			if (isHidden) {
				return;
			}
			if (lastWidth === null || lastHeight === null) {
				lastWidth = width;
				lastHeight = height;
				return;
			}
			if (resizeTimeout) {
				clearTimeout(resizeTimeout);
			}
			resizeTimeout = setTimeout(() => {
				try {
					if (!terminalComponent.terminal || !terminalComponent.container) {
						return;
					}
					if (
						Math.abs(width - lastWidth) > 0.5 ||
						Math.abs(height - lastHeight) > 0.5
					) {
						terminalComponent.fit();
						lastWidth = width;
						lastHeight = height;
					}
					lastResizeTime = now;
				} catch (error) {
					console.error(`Resize error for terminal ${terminalId}:`, error);
				}
			}, RESIZE_DEBOUNCE);
		};
		const resizeObserver =
			typeof ResizeObserver === "function"
				? new ResizeObserver(handleResize)
				: null;
		let resizeFallbackInterval = null;
		setTimeout(() => {
			const containerElement = terminalFile.content;
			if (containerElement && containerElement instanceof Element) {
				if (resizeObserver) {
					resizeObserver.observe(containerElement);
					terminalFile._resizeObserver = resizeObserver;
				} else {
					resizeFallbackInterval = setInterval(() => handleResize(), 500);
					terminalFile._resizeObserver = {
						disconnect() {
							clearInterval(resizeFallbackInterval);
						},
					};
				}
			} else {
				console.warn("Terminal container not available for ResizeObserver");
			}
		}, 200);
		let sessionFinished = false;
		const finishTerminalSession = async ({
			message = null,
			showToast = true,
			errorAlert = null,
		} = {}) => {
			if (sessionFinished) return;
			sessionFinished = true;
			try {
				terminalComponent.intentionalClose = true;
				await this.closeTerminal(terminalId, true);
			} catch (error) {
				console.error(
					`Failed to finish terminal session ${terminalId}:`,
					error,
				);
			}
			if (showToast && message) {
				toast(message);
			}
			if (errorAlert) {
				alert(strings["error"], errorAlert);
			}
		};
		terminalComponent.onConnect = () => {
			console.log(`Terminal ${terminalId} connected`);
		};
		terminalComponent.onDisconnect = (info = {}) => {
			console.log(`Terminal ${terminalId} disconnected`, info);
			if (info.intentional) return;
			const message = info.processExited ? null : "Terminal session ended";
			void finishTerminalSession({
				message,
				showToast: !info.processExited,
			});
		};
		terminalComponent.onError = (error) => {
			console.error(`Terminal ${terminalId} error:`, error);
			const errorMessage = error?.message || "Connection lost";
			void finishTerminalSession({
				showToast: false,
				errorAlert: `Terminal connection error: ${errorMessage}`,
			});
		};
		terminalComponent.onTitleChange = async (title) => {
			if (title) {
				const formattedTitle = `${titlePrefix} - ${title}`;
				terminalFile.filename = formattedTitle;
				if (terminalComponent.serverMode && terminalComponent.pid) {
					await this.persistTerminalSession(
						terminalComponent.pid,
						formattedTitle,
						terminalFile.pinned,
					);
				}
				if (
					editorManager.activeFile &&
					editorManager.activeFile.id === terminalFile.id
				) {
					terminalFile.setCustomTitle(getTerminalTitle);
				}
			}
		};
		terminalComponent.onProcessExit = (exitData) => {
			const data = exitData && typeof exitData === "object" ? exitData : {};
			let message;
			if (data.signal) {
				message = `Process terminated by signal ${data.signal}`;
			} else if (data.exit_code === 0 || data.exit_code === "0") {
				message = `Process exited successfully (code ${data.exit_code})`;
			} else if (data.exit_code !== undefined && data.exit_code !== null) {
				message = `Process exited with code ${data.exit_code}`;
			} else if (typeof exitData === "string" || typeof exitData === "number") {
				message = `Process exited with code ${exitData}`;
			} else {
				message = "Process exited";
			}
			void finishTerminalSession({
				message,
			});
		};
		terminalComponent.onOscOpen = async (type, path) => {
			if (!path) return;
			const fileUri = this.convertProotPath(path);
			const name = this.getPathDisplayName(path);
			try {
				if (type === "folder") {
					await openFolder(fileUri, {
						name,
						saveState: true,
						listFiles: true,
					});
					toast(`Opened folder: ${name}`);
				} else {
					await openFile(fileUri, {
						render: true,
					});
				}
			} catch (error) {
				console.error("Failed to open from terminal:", error);
				toast(`Failed to open: ${path}`);
			}
		};
		terminalFile._terminalId = terminalId;
		terminalFile.terminalComponent = terminalComponent;
		terminalFile._resizeObserver = resizeObserver;
		const getTerminalTitle = () => {
			if (terminalComponent.pid) {
				return `PID: ${terminalComponent.pid}`;
			}
			return `${terminalId}`;
		};
		terminalFile.setCustomTitle(getTerminalTitle);
	}
	async closeTerminal(terminalId, removeTab = false) {
		const terminal = this.terminals.get(terminalId);
		if (!terminal) return;
		try {
			if (terminal.component) {
				terminal.component.intentionalClose = true;
			}
			if (terminal.component.serverMode && terminal.component.pid) {
				this.removePersistedSession(terminal.component.pid);
			}
			if (terminal.file?._resizeObserver) {
				terminal.file._resizeObserver.disconnect();
				terminal.file._resizeObserver = null;
			}
			if (terminal.component.cleanupFocusHandlers) {
				terminal.component.cleanupFocusHandlers();
			}
			terminal.component.dispose();
			this.terminals.delete(terminalId);
			if (removeTab && terminal.file) {
				try {
					terminal.file._skipTerminalCloseConfirm = true;
					await terminal.file.remove(true, {
						ignorePinned: true,
					});
				} catch (removeError) {
					console.error("Error removing terminal tab:", removeError);
				}
			}
			if (this.getAllTerminals().size <= 0) {
				Executor.stopService();
			}
			console.log(`Terminal ${terminalId} closed`);
		} catch (error) {
			console.error(`Error closing terminal ${terminalId}:`, error);
		}
	}
	getTerminal(terminalId) {
		return this.terminals.get(terminalId) || null;
	}
	getAllTerminals() {
		return this.terminals;
	}
	addTouchSelectionMoreOption(option) {
		return TerminalTouchSelection.addMoreOption(option);
	}
	removeTouchSelectionMoreOption(id) {
		return TerminalTouchSelection.removeMoreOption(id);
	}
	getTouchSelectionMoreOptions() {
		return TerminalTouchSelection.getMoreOptions();
	}
	writeToTerminal(terminalId, data) {
		const terminal = this.getTerminal(terminalId);
		if (terminal) {
			terminal.component.write(data);
		}
	}
	clearTerminal(terminalId) {
		const terminal = this.getTerminal(terminalId);
		if (terminal) {
			terminal.component.clear();
		}
	}
	getTerminalStyles() {
		return `
			.terminal-content {
				width: 100%;
				height: 100%;
				box-sizing: border-box;
				background: #1e1e1e;
				overflow: hidden;
				position: relative;
			}

			.terminal-content .xterm {
				padding: 0.25rem;
				box-sizing: border-box;
				touch-action: none;
			}

			.terminal-content .xterm-viewport,
			.terminal-content .xterm-scrollable-element {
				background-color: transparent !important;
				overscroll-behavior: none;
			}

			.terminal-content
				.terminal-scrollbar-hidden
				.xterm-scrollable-element
				> .scrollbar.vertical {
				display: none !important;
			}
		`;
	}
	async createLocalTerminal(options = {}) {
		return this.createTerminal({
			...options,
			serverMode: false,
		});
	}
	async createServerTerminal(options = {}) {
		return this.createTerminal({
			...options,
			serverMode: true,
		});
	}
	handleKeyboardResize() {
		setTimeout(() => {
			this.terminals.forEach((terminal) => {
				try {
					if (terminal.component && terminal.component.terminal) {
						terminal.component.fit();
						const buffer = terminal.component.terminal.buffer?.active;
						if (
							buffer &&
							buffer.length > terminal.component.terminal.rows * 2
						) {
							const wasNearBottom =
								buffer.viewportY >=
								buffer.length - terminal.component.terminal.rows - 5;
							if (wasNearBottom) {
								setTimeout(() => {
									terminal.component.terminal.scrollToBottom();
								}, 100);
							}
						}
					}
				} catch (error) {
					console.error(
						`Error handling keyboard resize for terminal ${terminal.id}:`,
						error,
					);
				}
			});
		}, 150);
	}
	stabilizeTerminals() {
		this.terminals.forEach((terminal) => {
			try {
				if (terminal.component && terminal.component.terminal) {
					if (
						terminal.component.touchSelection &&
						terminal.component.touchSelection.isSelecting
					) {
						terminal.component.touchSelection.clearSelection();
					}
					terminal.component.fit();
					if (terminal.file && terminal.file.isOpen) {
						setTimeout(() => {
							terminal.component.focus();
						}, 50);
					}
				}
			} catch (error) {
				console.error(`Error stabilizing terminal ${terminal.id}:`, error);
			}
		});
	}
	convertProotPath(prootPath) {
		if (!prootPath) return prootPath;
		const packageName = window.BuildInfo?.packageName || "com.foxdebug.acode";
		const dataDir = `/data/user/0/${packageName}`;
		const alpineRoot = `${dataDir}/files/alpine`;
		let convertedPath;
		if (prootPath.startsWith("/public")) {
			convertedPath = `file://${dataDir}/files${prootPath}`;
		} else if (
			prootPath.startsWith("/sdcard") ||
			prootPath.startsWith("/storage") ||
			prootPath.startsWith("/data")
		) {
			convertedPath = `file://${prootPath}`;
		} else if (prootPath.startsWith("/")) {
			convertedPath = `file://${alpineRoot}${prootPath}`;
		} else {
			convertedPath = prootPath;
		}
		return convertedPath;
	}
	getPathDisplayName(path) {
		if (!path) return "folder";
		const normalized = [];
		for (const segment of String(path).split("/")) {
			if (!segment || segment === ".") continue;
			if (segment === "..") {
				if (normalized.length) normalized.pop();
				continue;
			}
			normalized.push(segment);
		}
		return normalized.pop() || "folder";
	}
	shouldConfirmTerminalClose() {
		const settings = appSettings?.value?.terminalSettings;
		if (settings && settings.confirmTabClose === false) {
			return false;
		}
		return true;
	}
}
const terminalManager = new TerminalManager();
export default terminalManager;
