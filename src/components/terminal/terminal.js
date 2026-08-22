import { AttachAddon } from "@xterm/addon-attach";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as Xterm } from "@xterm/xterm";
import {
	executeCommand,
	getEffectiveKeyBindings,
	getResolvedKeyBindingsVersion,
} from "cm/commandRegistry";
import confirm from "dialogs/confirm";
import fonts from "lib/fonts";
import appSettings from "lib/settings";
import LigaturesAddon from "./ligatures";
import {
	DEFAULT_TERMINAL_SETTINGS,
	getTerminalSettings,
} from "./terminalDefaults";
import TerminalThemeManager from "./terminalThemeManager";
import TerminalTouchScrolling from "./terminalTouchScrolling";
import TerminalTouchSelection from "./terminalTouchSelection";
export default class TerminalComponent {
	constructor(options = {}) {
		const terminalSettings = getTerminalSettings();
		this.options = {
			allowProposedApi: true,
			scrollOnUserInput: true,
			rows: options.rows || 24,
			cols: options.cols || 80,
			port: options.port || 8767,
			renderer: options.renderer || "auto",
			fontSize: terminalSettings.fontSize,
			fontFamily: terminalSettings.fontFamily,
			fontWeight: terminalSettings.fontWeight,
			theme: TerminalThemeManager.getTheme(terminalSettings.theme),
			cursorBlink: terminalSettings.cursorBlink,
			cursorStyle: terminalSettings.cursorStyle,
			cursorInactiveStyle: terminalSettings.cursorInactiveStyle,
			scrollback: terminalSettings.scrollback,
			tabStopWidth: terminalSettings.tabStopWidth,
			convertEol: terminalSettings.convertEol,
			letterSpacing: terminalSettings.letterSpacing,
			...options,
		};
		this.terminal = null;
		this.fitAddon = null;
		this.attachAddon = null;
		this.unicode11Addon = null;
		this.searchAddon = null;
		this.webLinksAddon = null;
		this.imageAddon = null;
		this.ligaturesAddon = null;
		this.container = null;
		this.websocket = null;
		this.pid = null;
		this.isConnected = false;
		this.serverMode = options.serverMode !== false;
		this.touchSelection = null;
		this.touchScrolling = null;
		this.parsedAppKeybindings = [];
		this.parsedAppKeybindingsVersion = -1;
		this.boundNativeSelectionMenuHandler = null;
		this.visibleScrollbarWidth = undefined;
		this.lastRequestedServerSize = null;
		this.intentionalClose = false;
		this.processExited = false;
		this.init();
	}
	init() {
		this.terminal = new Xterm(this.options);
		this.fitAddon = new FitAddon();
		this.unicode11Addon = new Unicode11Addon();
		this.searchAddon = new SearchAddon();
		this.webLinksAddon = new WebLinksAddon(async (event, uri) => {
			const linkOpenConfirm = await confirm(
				"Terminal",
				`Do you want to open ${uri} in browser?`,
			);
			if (linkOpenConfirm) {
				system.openInBrowser(uri);
			}
		});
		this.webglAddon = null;
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.unicode11Addon);
		this.terminal.loadAddon(this.searchAddon);
		this.terminal.loadAddon(this.webLinksAddon);
		const terminalSettings = getTerminalSettings();
		if (terminalSettings.imageSupport) {
			this.loadImageAddon();
		}
		this._fontReady = this.loadTerminalFont().then(() => {
			if (this.terminal) {
				this.terminal.options.fontFamily = this.options.fontFamily;
				this.terminal.refresh(0, this.terminal.rows - 1);
			}
		});
		this.setupEventHandlers();
	}
	setupEventHandlers() {
		this.setupResizeHandling();
		this.terminal.onTitleChange((title) => {
			this.onTitleChange?.(title);
		});
		this.terminal.onBell(() => {
			this.onBell?.();
		});
		this.setupCopyPasteHandlers();
		this.setupOscHandler();
	}
	setupOscHandler() {
		this.terminal.parser.registerOscHandler(7777, (data) => {
			const firstSemi = data.indexOf(";");
			if (firstSemi === -1) {
				console.warn("Invalid OSC 7777 format:", data);
				return true;
			}
			const command = data.substring(0, firstSemi);
			const rest = data.substring(firstSemi + 1);
			switch (command) {
				case "open": {
					const secondSemi = rest.indexOf(";");
					if (secondSemi === -1) {
						console.warn("Invalid OSC 7777 open format:", data);
						return true;
					}
					const type = rest.substring(0, secondSemi);
					const path = rest.substring(secondSemi + 1);
					this.handleOscOpen(type, path);
					break;
				}
				default:
					console.warn("Unknown OSC 7777 command:", command);
			}
			return true;
		});
	}
	handleOscOpen(type, path) {
		if (!path) return;
		this.onOscOpen?.(type, path);
	}
	setupResizeHandling() {
		let resizeTimeout = null;
		let lastKnownScrollPosition = 0;
		let isResizing = false;
		let resizeCount = 0;
		const RESIZE_DEBOUNCE = 100;
		const MAX_RAPID_RESIZES = 3;
		let originalRows = this.terminal.rows;
		let originalCols = this.terminal.cols;
		this.terminal.onResize((size) => {
			resizeCount++;
			isResizing = true;
			if (this.terminal.buffer && this.terminal.buffer.active) {
				lastKnownScrollPosition = this.terminal.buffer.active.viewportY;
			}
			if (resizeTimeout) {
				clearTimeout(resizeTimeout);
			}
			resizeTimeout = setTimeout(async () => {
				try {
					const rowDiff = Math.abs(size.rows - originalRows);
					const colDiff = Math.abs(size.cols - originalCols);
					if (rowDiff < 2 && colDiff < 2 && resizeCount > 1) {
						console.log("Skipping minor resize to prevent instability");
						isResizing = false;
						resizeCount = 0;
						return;
					}
					if (this.serverMode) {
						await this.resizeTerminal(size.cols, size.rows);
					}
					const heightRatio = size.rows / originalRows;
					if (
						heightRatio < 0.75 &&
						this.terminal.buffer &&
						this.terminal.buffer.active
					) {
						const buffer = this.terminal.buffer.active;
						const cursorY = buffer.cursorY;
						const cursorViewportPos = buffer.baseY + cursorY;
						const viewportTop = buffer.viewportY;
						const viewportBottom = viewportTop + this.terminal.rows - 1;
						if (
							cursorViewportPos <= viewportTop + 1 ||
							cursorViewportPos >= viewportBottom - 1
						) {
							const targetScroll = Math.max(
								0,
								Math.min(
									buffer.length - this.terminal.rows,
									cursorViewportPos - Math.floor(this.terminal.rows * 0.25),
								),
							);
							this.terminal.scrollToLine(targetScroll);
						}
					} else {
						this.preserveViewportPosition(lastKnownScrollPosition);
					}
					originalRows = size.rows;
					originalCols = size.cols;
					isResizing = false;
					resizeCount = 0;
					if (this.touchSelection) {
						this.touchSelection.onTerminalResize(size);
					}
				} catch (error) {
					console.error("Resize handling failed:", error);
					isResizing = false;
					resizeCount = 0;
				}
			}, RESIZE_DEBOUNCE);
		});
		this.terminal.onData(() => {
			if (!isResizing && this.terminal.buffer && this.terminal.buffer.active) {
				lastKnownScrollPosition = this.terminal.buffer.active.viewportY;
			}
		});
	}
	preserveViewportPosition(targetScrollPosition) {
		if (!this.terminal.buffer || !this.terminal.buffer.active) return;
		const buffer = this.terminal.buffer.active;
		const maxScroll = Math.max(0, buffer.length - this.terminal.rows);
		const safeScrollPosition = Math.min(targetScrollPosition, maxScroll);
		if (
			buffer.length > this.terminal.rows &&
			buffer.viewportY !== safeScrollPosition
		) {
			this.terminal.scrollToLine(safeScrollPosition);
		}
	}
	setupTouchSelection() {
		if (window.cordova && this.container) {
			const terminalSettings = getTerminalSettings();
			this.touchSelection = new TerminalTouchSelection(
				this.terminal,
				this.container,
				{
					tapHoldDuration:
						terminalSettings.touchSelectionTapHoldDuration || 400,
					moveThreshold: terminalSettings.touchSelectionMoveThreshold || 8,
					handleSize: terminalSettings.touchSelectionHandleSize || 24,
					hapticFeedback:
						terminalSettings.touchSelectionHapticFeedback !== false,
					showContextMenu:
						terminalSettings.touchSelectionShowContextMenu !== false,
					onFontSizeChange: (fontSize) => this.updateFontSize(fontSize),
				},
			);
		}
		if (this.touchScrolling) {
			this.touchScrolling.touchSelection = this.touchSelection;
		}
	}
	setupTouchScrolling() {
		if (!this.terminal?.element || this.touchScrolling) return;
		this.touchScrolling = new TerminalTouchScrolling(
			this.terminal,
			this.touchSelection,
		);
	}
	parseAppKeybindings() {
		const version = getResolvedKeyBindingsVersion();
		if (this.parsedAppKeybindingsVersion === version) {
			return this.parsedAppKeybindings;
		}
		const parsedBindings = [];
		Object.entries(getEffectiveKeyBindings()).forEach(([name, binding]) => {
			if (!binding.key) return;
			if (binding.editorOnly) return;
			const keys = binding.key.split("|");
			keys.forEach((keyCombo) => {
				if (/\s/.test(keyCombo.trim())) return;
				const parts = keyCombo.endsWith("-")
					? [...keyCombo.slice(0, -1).split("-").filter(Boolean), "-"]
					: keyCombo.split("-");
				const parsed = {
					name,
					ctrl: false,
					shift: false,
					alt: false,
					meta: false,
					key: "",
				};
				parts.forEach((part) => {
					const lowerPart = part.toLowerCase();
					if (lowerPart === "ctrl") {
						parsed.ctrl = true;
					} else if (lowerPart === "shift") {
						parsed.shift = true;
					} else if (lowerPart === "alt") {
						parsed.alt = true;
					} else if (lowerPart === "meta" || lowerPart === "cmd") {
						parsed.meta = true;
					} else {
						parsed.key = part.toLowerCase();
					}
				});
				if (parsed.key) {
					parsedBindings.push(parsed);
				}
			});
		});
		this.parsedAppKeybindings = parsedBindings;
		this.parsedAppKeybindingsVersion = version;
		return this.parsedAppKeybindings;
	}
	setupCopyPasteHandlers() {
		this.terminal.attachCustomKeyEventHandler((event) => {
			const isKeyDown = event.type === "keydown";
			if (event.ctrlKey && event.shiftKey && event.key === "C") {
				event.preventDefault();
				if (isKeyDown) this.copySelection();
				return false;
			}
			if (event.ctrlKey && event.shiftKey && event.key === "V") {
				event.preventDefault();
				if (isKeyDown) this.pasteFromClipboard();
				return false;
			}
			if (
				event.ctrlKey &&
				!event.shiftKey &&
				!event.altKey &&
				!event.metaKey &&
				(event.key === "+" || event.key === "=")
			) {
				event.preventDefault();
				if (isKeyDown) this.increaseFontSize();
				return false;
			}
			if (
				event.ctrlKey &&
				!event.shiftKey &&
				!event.altKey &&
				!event.metaKey &&
				event.key === "-"
			) {
				event.preventDefault();
				if (isKeyDown) this.decreaseFontSize();
				return false;
			}
			if (event.ctrlKey || event.altKey || event.metaKey) {
				if (["Control", "Alt", "Meta", "Shift"].includes(event.key)) {
					return true;
				}
				const appKeybindings = this.parseAppKeybindings();
				const eventKey = event.key === "_" ? "-" : event.key.toLowerCase();
				const binding = appKeybindings.find(
					(binding) =>
						binding.ctrl === event.ctrlKey &&
						binding.shift === event.shiftKey &&
						binding.alt === event.altKey &&
						binding.meta === event.metaKey &&
						binding.key === eventKey,
				);
				if (binding) {
					if (isKeyDown) {
						this._lastAppKeybindingHandled = executeCommand(binding.name);
					}
					if (this._lastAppKeybindingHandled) {
						return false;
					}
				}
			}
			if (event.ctrlKey || event.altKey || event.metaKey) return true;
			return true;
		});
	}
	copySelection() {
		if (!this.terminal?.hasSelection()) return;
		const selectedStr = this.terminal?.getSelection();
		if (selectedStr && cordova?.plugins?.clipboard) {
			cordova.plugins.clipboard.copy(selectedStr);
		}
	}
	pasteFromClipboard() {
		if (cordova?.plugins?.clipboard) {
			cordova.plugins.clipboard.paste((text) => {
				this.terminal?.paste(text);
			});
		}
	}
	createContainer() {
		this.container = document.createElement("div");
		this.container.className = "terminal-container";
		this.container.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      background: ${this.options.theme.background};
      overflow: hidden;
      box-sizing: border-box;
    `;
		this.disableNativeSelectionMenu(this.container);
		return this.container;
	}
	mount(container) {
		if (!container) {
			container = this.createContainer();
		}
		this.container = container;
		this.container.style.background = this.options.theme.background;
		this.disableNativeSelectionMenu(this.container);
		try {
			this.terminal.open(container);
			this.updateBackgroundColor();
			this.updateScrollbarVisibility(
				getTerminalSettings().showScrollbar !== false,
			);
			if (
				this.options.renderer === "webgl" ||
				this.options.renderer === "auto"
			) {
				try {
					const addon = new WebglAddon();
					this.terminal.loadAddon(addon);
					if (typeof addon.onContextLoss === "function") {
						addon.onContextLoss(() => this._handleWebglContextLoss());
					}
					this.webglAddon = addon;
				} catch (error) {
					console.error("Failed to enable WebGL renderer:", error);
					try {
						this.webglAddon?.dispose?.();
					} catch {}
					this.webglAddon = null;
				}
			}
			const terminalSettings = getTerminalSettings();
			if (terminalSettings.fontLigatures) {
				this.loadLigaturesAddon();
			}
			this.setupTouchScrolling();
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(() => {
					if (!this.terminal) return;
					this.fitAddon.fit();
					this.terminal.focus();
					this.setupTouchSelection();
				});
			} else {
				setTimeout(() => {
					if (!this.terminal) return;
					this.fitAddon.fit();
					this.terminal.focus();
					this.setupTouchSelection();
				}, 0);
			}
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(() => {
					if (this.terminal) {
						this.terminal.options.fontFamily = this.options.fontFamily;
						this.terminal.refresh(0, this.terminal.rows - 1);
					}
				});
			} else {
				setTimeout(() => {
					if (this.terminal) {
						this.terminal.options.fontFamily = this.options.fontFamily;
						this.terminal.refresh(0, this.terminal.rows - 1);
					}
				}, 16);
			}
		} catch (error) {
			console.error("Failed to mount terminal:", error);
		}
		return container;
	}
	disableNativeSelectionMenu(container) {
		if (!container) return;
		container.classList.add("terminal-native-selection-disabled");
		if (this.boundNativeSelectionMenuHandler) {
			container.removeEventListener(
				"contextmenu",
				this.boundNativeSelectionMenuHandler,
				true,
			);
		}
		this.boundNativeSelectionMenuHandler = (event) => {
			if (event.target?.closest?.(".terminal-context-menu")) return;
			event.preventDefault();
			event.stopPropagation();
		};
		container.addEventListener(
			"contextmenu",
			this.boundNativeSelectionMenuHandler,
			true,
		);
	}
	async createSession() {
		if (!this.serverMode) {
			throw new Error(
				"Terminal is in local mode, cannot create server session",
			);
		}
		try {
			if (!(await Terminal.isInstalled())) {
				throw new Error(
					"Terminal not installed. Please install terminal first.",
				);
			}
			if (!(await Terminal.isAxsRunning())) {
				const values = appSettings.value;
				if (!values.terminalSettings) {
					values.terminalSettings = {
						...DEFAULT_TERMINAL_SETTINGS,
						fontFamily:
							DEFAULT_TERMINAL_SETTINGS.fontFamily ||
							appSettings.value.fontFamily,
					};
				}
				const terminalValues = values.terminalSettings;
				Executor.setProotDebug(terminalValues.prootDebug);
				Executor.BackgroundExecutor.setProotDebug(terminalValues.prootDebug);
				await Terminal.startAxs(
					false,
					() => {},
					console.error,
					terminalValues.failsafeMode,
				);
			}
			await this.waitForServerReady();
			const requestBody = {
				cols: this.terminal.cols,
				rows: this.terminal.rows,
			};
			const response = await new Promise((resolve, reject) => {
				cordova.plugin.http.sendRequest(
					`http://127.0.0.1:${this.options.port}/terminals`,
					{
						method: "POST",
						responseType: "text",
						serializer: "json",
						data: requestBody,
					},
					(res) => resolve(res),
					(err) => reject(new Error(err.error || `HTTP error!`)),
				);
			});
			if (response.status < 200 || response.status >= 300) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			this.pid = response.data.trim();
			return this.pid;
		} catch (error) {
			console.error("Failed to create terminal session:", error);
			throw error;
		}
	}
	async waitForServerReady(maxAttempts = 20, retryDelay = 500) {
		const statusUrl = `http://127.0.0.1:${this.options.port}/status`;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const response = await new Promise((resolve, reject) => {
					cordova.plugin.http.sendRequest(
						statusUrl,
						{
							method: "GET",
							responseType: "text",
						},
						resolve,
						reject,
					);
				});
				if (
					response.status >= 200 &&
					response.status < 300 &&
					response.data?.trim() === "OK"
				) {
					return;
				}
			} catch {}
			if (attempt < maxAttempts - 1) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			}
		}
		throw new Error(
			`AXS terminal server did not become ready on port ${this.options.port}`,
		);
	}
	async connectToSession(pid) {
		if (!this.serverMode) {
			throw new Error(
				"Terminal is in local mode, cannot connect to server session",
			);
		}
		if (!pid) {
			pid = await this.createSession();
		}
		this.pid = pid;
		const wsUrl = `ws://127.0.0.1:${this.options.port}/terminals/${pid}`;
		await new Promise((resolve, reject) => {
			const websocket = new WebSocket(wsUrl);
			const CONNECT_TIMEOUT = 5000;
			let settled = false;
			let hasOpened = false;
			this.websocket = websocket;
			const rejectInitialConnect = (message, error) => {
				if (settled || hasOpened) return;
				settled = true;
				this.isConnected = false;
				try {
					websocket.close();
				} catch {}
				reject(error || new Error(message));
			};
			const connectionTimeout = setTimeout(() => {
				rejectInitialConnect(
					`Timed out while connecting to terminal session ${pid}`,
				);
			}, CONNECT_TIMEOUT);
			websocket.onopen = () => {
				clearTimeout(connectionTimeout);
				hasOpened = true;
				this.isConnected = true;
				this.onConnect?.();
				this.attachAddon = new AttachAddon(websocket);
				this.terminal.loadAddon(this.attachAddon);
				this.terminal.unicode.activeVersion = "11";
				this.terminal.focus();
				void this.fitAndResizeTerminal(true);
				if (!settled) {
					settled = true;
					resolve();
				}
			};
			websocket.onmessage = (event) => {
				if (typeof event.data !== "string") return;
				if (event.binary === true) return;
				try {
					const message = JSON.parse(event.data);
					if (message?.type === "exit") {
						this.processExited = true;
						this.onProcessExit?.(message.data);
					}
				} catch {}
			};
			websocket.onclose = (event) => {
				clearTimeout(connectionTimeout);
				this.isConnected = false;
				if (!hasOpened) {
					const code = event?.code ? ` (code ${event.code})` : "";
					const reason = event?.reason ? `: ${event.reason}` : "";
					rejectInitialConnect(
						`Terminal session ${pid} is unavailable${code}${reason}`,
					);
					return;
				}
				this.onDisconnect?.({
					intentional: this.intentionalClose,
					processExited: this.processExited,
					code: event?.code,
					reason: event?.reason,
				});
			};
			websocket.onerror = (error) => {
				if (!hasOpened) {
					clearTimeout(connectionTimeout);
					rejectInitialConnect(
						`Failed to connect to terminal session ${pid}`,
						new Error(`Failed to connect to terminal session ${pid}`),
					);
					return;
				}
				if (this.intentionalClose || this.processExited) return;
				console.error("WebSocket error:", error);
				this.onError?.(error);
			};
		});
	}
	async resizeTerminal(cols, rows, force = false) {
		if (!this.pid || !this.serverMode) return;
		const resizeKey = `${cols}x${rows}`;
		if (!force && this.lastRequestedServerSize === resizeKey) return;
		this.lastRequestedServerSize = resizeKey;
		try {
			await new Promise((resolve, reject) => {
				cordova.plugin.http.sendRequest(
					`http://127.0.0.1:${this.options.port}/terminals/${this.pid}/resize`,
					{
						method: "POST",
						serializer: "json",
						data: {
							cols,
							rows,
						},
					},
					(res) => resolve(res),
					(err) => reject(err),
				);
			});
		} catch (error) {
			if (this.lastRequestedServerSize === resizeKey) {
				this.lastRequestedServerSize = null;
			}
			console.error("Failed to resize terminal:", error);
		}
	}
	fit() {
		if (this.fitAddon) {
			this.fitAddon.fit();
		}
	}
	async fitAndResizeTerminal(forceServerSync = false) {
		if (!this.terminal || !this.fitAddon) return;
		const previousCols = this.terminal.cols;
		const previousRows = this.terminal.rows;
		this.fit();
		if (
			this.serverMode &&
			(forceServerSync ||
				this.terminal.cols !== previousCols ||
				this.terminal.rows !== previousRows)
		) {
			await this.resizeTerminal(
				this.terminal.cols,
				this.terminal.rows,
				forceServerSync,
			);
		}
	}
	write(data) {
		if (
			this.serverMode &&
			this.isConnected &&
			this.websocket &&
			this.websocket.readyState === WebSocket.OPEN
		) {
			this.websocket.send(data);
		} else {
			this.terminal.write(data);
		}
	}
	writeln(data) {
		this.terminal.writeln(data);
	}
	clear() {
		this.terminal.clear();
	}
	focus() {
		this.terminal.focus();
	}
	blur() {
		this.terminal.blur();
	}
	search(term, skip, backward) {
		if (this.searchAddon) {
			const searchOptions = {
				regex: appSettings.value.search.regExp || false,
				wholeWord: appSettings.value.search.wholeWord || false,
				caseSensitive: appSettings.value.search.caseSensitive || false,
				decorations: {
					matchBorder: "#FFA500",
					activeMatchBorder: "#FFFF00",
				},
			};
			if (!term) {
				return false;
			}
			if (backward) {
				return this.searchAddon.findPrevious(term, searchOptions);
			} else {
				return this.searchAddon.findNext(term, searchOptions);
			}
		}
		return false;
	}
	updateTheme(theme) {
		if (typeof theme === "string") {
			theme = TerminalThemeManager.getTheme(theme);
		}
		this.options.theme = {
			...this.options.theme,
			...theme,
		};
		this.terminal.options.theme = this.options.theme;
		this.updateBackgroundColor();
	}
	updateBackgroundColor() {
		const background = this.terminal?.options.theme?.background;
		if (!background) return;
		if (this.container) this.container.style.background = background;
		if (this.terminal?.element) {
			this.terminal.element.style.backgroundColor = background;
		}
	}
	updateScrollbarVisibility(visible) {
		if (!this.terminal) return;
		const overviewRuler = {
			...(this.terminal.options.overviewRuler ?? {}),
		};
		if (visible === false) {
			if (
				!this.terminal.element?.classList.contains("terminal-scrollbar-hidden")
			) {
				this.visibleScrollbarWidth = overviewRuler.width;
			}
			overviewRuler.width = 0.001;
		} else if (this.visibleScrollbarWidth === undefined) {
			delete overviewRuler.width;
		} else {
			overviewRuler.width = this.visibleScrollbarWidth;
		}
		this.terminal.options.overviewRuler = overviewRuler;
		this.terminal.element?.classList.toggle(
			"terminal-scrollbar-hidden",
			visible === false,
		);
		requestAnimationFrame(() => {
			if (!this.terminal) return;
			void this.fitAndResizeTerminal();
		});
	}
	updateOptions(options) {
		Object.keys(options).forEach((key) => {
			if (key === "theme") {
				this.updateTheme(options.theme);
			} else {
				this.terminal.options[key] = options[key];
				this.options[key] = options[key];
			}
		});
	}
	loadImageAddon() {
		if (!this.imageAddon) {
			try {
				this.imageAddon = new ImageAddon();
				this.terminal.loadAddon(this.imageAddon);
			} catch (error) {
				console.error("Failed to load ImageAddon:", error);
			}
		}
	}
	disposeImageAddon() {
		if (this.imageAddon) {
			try {
				this.imageAddon.dispose();
				this.imageAddon = null;
			} catch (error) {
				console.error("Failed to dispose ImageAddon:", error);
			}
		}
	}
	updateImageSupport(enabled) {
		if (enabled) {
			this.loadImageAddon();
		} else {
			this.disposeImageAddon();
		}
	}
	loadLigaturesAddon() {
		if (!this.ligaturesAddon) {
			try {
				this.ligaturesAddon = new LigaturesAddon();
				this.terminal.loadAddon(this.ligaturesAddon);
			} catch (error) {
				console.error("Failed to load LigaturesAddon:", error);
			}
		}
	}
	disposeLigaturesAddon() {
		if (this.ligaturesAddon) {
			try {
				this.ligaturesAddon.dispose();
				this.ligaturesAddon = null;
			} catch (error) {
				console.error("Failed to dispose LigaturesAddon:", error);
			}
		}
	}
	updateFontLigatures(enabled) {
		if (enabled) {
			this.loadLigaturesAddon();
		} else {
			this.disposeLigaturesAddon();
		}
	}
	async loadTerminalFont() {
		const fontFamily = this.options.fontFamily;
		if (fontFamily && fonts.get(fontFamily)) {
			try {
				fonts.injectFontFace(fontFamily);
				await fonts.loadFont(fontFamily);
			} catch (error) {
				console.warn(`Failed to load terminal font ${fontFamily}:`, error);
			}
		}
	}
	increaseFontSize() {
		const currentSize = this.terminal.options.fontSize;
		const newSize = Math.min(currentSize + 1, 24);
		this.updateFontSize(newSize);
	}
	decreaseFontSize() {
		const currentSize = this.terminal.options.fontSize;
		const newSize = Math.max(currentSize - 1, 8);
		this.updateFontSize(newSize);
	}
	updateFontSize(fontSize) {
		if (fontSize === this.terminal.options.fontSize) return;
		this.terminal.options.fontSize = fontSize;
		this.options.fontSize = fontSize;
		const currentSettings = appSettings.value.terminalSettings || {};
		const updatedSettings = {
			...currentSettings,
			fontSize,
		};
		appSettings.update(
			{
				terminalSettings: updatedSettings,
			},
			false,
		);
		this.terminal.refresh(0, this.terminal.rows - 1);
		setTimeout(() => {
			if (this.fitAddon) {
				this.fitAddon.fit();
			}
		}, 50);
		if (this.touchSelection) {
			setTimeout(() => {
				this.touchSelection.updateCellDimensions();
			}, 100);
		}
	}
	async terminate() {
		this.intentionalClose = true;
		if (this.websocket) {
			try {
				this.websocket.close();
			} catch {}
			this.websocket = null;
		}
		if (this.pid && this.serverMode) {
			try {
				await new Promise((resolve, reject) => {
					cordova.plugin.http.sendRequest(
						`http://127.0.0.1:${this.options.port}/terminals/${this.pid}/terminate`,
						{
							method: "POST",
							data: {},
						},
						(res) => resolve(res),
						(err) => reject(err),
					);
				});
			} catch (error) {
				console.error("Failed to terminate terminal:", error);
			}
		}
	}
	dispose() {
		this.intentionalClose = true;
		this.terminate();
		if (this.touchSelection) {
			this.touchSelection.destroy();
			this.touchSelection = null;
		}
		if (this.touchScrolling) {
			this.touchScrolling.destroy();
			this.touchScrolling = null;
		}
		this.disposeImageAddon();
		this.disposeLigaturesAddon();
		if (this.terminal) {
			this.terminal.dispose();
		}
		if (this.container && this.boundNativeSelectionMenuHandler) {
			this.container.removeEventListener(
				"contextmenu",
				this.boundNativeSelectionMenuHandler,
				true,
			);
			this.boundNativeSelectionMenuHandler = null;
		}
		if (this.container) {
			this.container.remove();
		}
	}
	onConnect() {}
	onDisconnect(_info) {}
	onError(error) {}
	onTitleChange(title) {}
	onBell() {}
	onProcessExit(exitData) {}
}
TerminalComponent.prototype._handleWebglContextLoss = function () {
	try {
		console.warn("WebGL context lost; terminal rendering will be degraded");
		try {
			this.webglAddon?.dispose?.();
		} catch {}
		this.webglAddon = null;
	} catch (e) {
		console.error("Error handling WebGL context loss:", e);
	}
};
