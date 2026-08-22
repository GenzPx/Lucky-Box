import fsOperation from "fileSystem";
import { EditorState } from "@codemirror/state";
import {
	focusEditorIfEditable,
	reconfigureEditorReadOnly,
} from "cm/editorReadOnly";
import {
	clearSelection,
	getDocText,
	restoreFolds,
	restoreSelection,
	setScrollPosition,
} from "cm/editorUtils";
import { getMode, getModeForPath } from "cm/modelist";
import quickTools from "components/quickTools";
import Sidebar from "components/sidebar";
import tile from "components/tile";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import DOMPurify from "dompurify";
import startDrag from "handlers/editorFileTab";
import actions from "handlers/quickTools";
import tag from "html-tag-js";
import mimeTypes from "mime-types";
import helpers from "utils/helpers";
import Path from "utils/Path";
import { readRemoteFilePreview } from "utils/remoteFilePreview";
import Url from "utils/Url";
import config from "./config";
import { isInitialPluginLoadComplete } from "./loadPlugins";
import openFolder from "./openFolder";
import run from "./run";
import saveFile from "./saveFile";
import appSettings from "./settings";

let mainCSSStyleSheet = null;
function getMainCSSStyleSheet() {
	if (mainCSSStyleSheet) return mainCSSStyleSheet;
	for (const sheet of document.styleSheets) {
		if (sheet.href && sheet.href.endsWith("main.css")) {
			return sheet;
		}
	}
	return null;
}
function syncQuickToolsVisibility(file) {
	const { $toggler } = quickTools;
	const hideForFile = !!file?.hideQuickTools;
	clearTimeout($toggler._hideTimeout);
	if (hideForFile || !appSettings.value.floatingButton) {
		$toggler.classList.add("hide");
		$toggler._hideTimeout = setTimeout(() => {
			$toggler.remove();
			$toggler._hideTimeout = null;
		}, 300);
	} else {
		$toggler._hideTimeout = null;
		$toggler.classList.remove("hide");
		if (!$toggler.isConnected) {
			root.appendOuter($toggler);
		}
	}
	if (hideForFile) {
		actions("set-height", {
			height: 0,
			save: false,
		});
		return;
	}
	const quickToolsHeight =
		appSettings.value.quickTools !== undefined
			? appSettings.value.quickTools
			: 1;
	actions("set-height", {
		height: quickToolsHeight,
		save: false,
	});
}
function isTouchDevice() {
	return (
		typeof navigator !== "undefined" &&
		Number(navigator.maxTouchPoints || 0) > 0
	);
}
function createSessionProxy(state, file) {
	if (!state) return null;
	function positionToOffset(pos, doc) {
		if (!pos || !doc) return 0;
		try {
			const lineNum = Math.max(1, Math.min((pos.row ?? 0) + 1, doc.lines));
			const line = doc.line(lineNum);
			const col = Math.max(0, Math.min(pos.column ?? 0, line.length));
			return line.from + col;
		} catch (_) {
			return 0;
		}
	}
	function offsetToPosition(offset, doc) {
		if (!doc)
			return {
				row: 0,
				column: 0,
			};
		try {
			const line = doc.lineAt(offset);
			return {
				row: line.number - 1,
				column: offset - line.from,
			};
		} catch (_) {
			return {
				row: 0,
				column: 0,
			};
		}
	}
	function recordInactiveEdit() {
		if (file.markChanged === false) return;
		file.markEdited();
		file.scheduleCacheWrite();
		editorManager.emit("file-content-changed", file);
		editorManager.onupdate("file-changed");
		editorManager.emit("update", "file-changed");
	}
	return new Proxy(state, {
		get(target, prop) {
			if (prop === "__rawState") {
				return target;
			}
			if (prop === "getValue") {
				return () => getDocText(target.doc);
			}
			if (prop === "setValue") {
				return (text) => {
					const newText = String(text ?? "");
					const { activeFile, editor } = editorManager;
					if (activeFile?.id === file.id && editor) {
						editor.dispatch({
							changes: {
								from: 0,
								to: editor.state.doc.length,
								insert: newText,
							},
						});
					} else {
						file._setRawSession(
							target.update({
								changes: {
									from: 0,
									to: target.doc.length,
									insert: newText,
								},
							}).state,
						);
						recordInactiveEdit();
					}
				};
			}
			if (prop === "getLine") {
				return (row) => {
					try {
						return target.doc.line(row + 1).text;
					} catch (_) {
						return "";
					}
				};
			}
			if (prop === "getLength") {
				return () => target.doc.lines;
			}
			if (prop === "getTextRange") {
				return (range) => {
					if (!range) return "";
					try {
						const from = positionToOffset(range.start, target.doc);
						const to = positionToOffset(range.end, target.doc);
						return target.doc.sliceString(from, to);
					} catch (_) {
						return "";
					}
				};
			}
			if (prop === "insert") {
				return (position, text) => {
					const { activeFile, editor } = editorManager;
					const offset = positionToOffset(position, target.doc);
					if (activeFile?.id === file.id && editor) {
						editor.dispatch({
							changes: {
								from: offset,
								insert: String(text ?? ""),
							},
						});
					} else {
						file._setRawSession(
							target.update({
								changes: {
									from: offset,
									insert: String(text ?? ""),
								},
							}).state,
						);
						recordInactiveEdit();
					}
				};
			}
			if (prop === "remove") {
				return (range) => {
					if (!range) return "";
					const from = positionToOffset(range.start, target.doc);
					const to = positionToOffset(range.end, target.doc);
					const removed = target.doc.sliceString(from, to);
					const { activeFile, editor } = editorManager;
					if (activeFile?.id === file.id && editor) {
						editor.dispatch({
							changes: {
								from,
								to,
								insert: "",
							},
						});
					} else {
						file._setRawSession(
							target.update({
								changes: {
									from,
									to,
									insert: "",
								},
							}).state,
						);
						recordInactiveEdit();
					}
					return removed;
				};
			}
			if (prop === "replace") {
				return (range, text) => {
					if (!range) return;
					const from = positionToOffset(range.start, target.doc);
					const to = positionToOffset(range.end, target.doc);
					const { activeFile, editor } = editorManager;
					if (activeFile?.id === file.id && editor) {
						editor.dispatch({
							changes: {
								from,
								to,
								insert: String(text ?? ""),
							},
						});
					} else {
						file._setRawSession(
							target.update({
								changes: {
									from,
									to,
									insert: String(text ?? ""),
								},
							}).state,
						);
						recordInactiveEdit();
					}
				};
			}
			if (prop === "getWordRange") {
				return (row, column) => {
					const offset = positionToOffset(
						{
							row,
							column,
						},
						target.doc,
					);
					const word = target.wordAt(offset);
					if (word) {
						return {
							start: offsetToPosition(word.from, target.doc),
							end: offsetToPosition(word.to, target.doc),
						};
					}
					return {
						start: {
							row,
							column,
						},
						end: {
							row,
							column,
						},
					};
				};
			}
			const value = target[prop];
			if (typeof value === "function") {
				return value.bind(target);
			}
			return value;
		},
	});
}
function maybeRecommendLanguageModeExtension(file, modeInfo) {
	if (appSettings.value.recommendExtensions === false) return;
	if (!isInitialPluginLoadComplete()) return;
	if (modeInfo?.name !== "text" || modeInfo.supportsFile(file.filename)) return;
	if (helpers.isBinary(file.filename || file.uri)) return;
	void import("./languageModeRecommendations").then(
		({ default: recommend }) => {
			recommend(file, modeInfo);
		},
		(error) => {
			console.warn("Failed to load language mode recommendations.", error);
		},
	);
}
export default class EditorFile {
	#type = "editor";
	#tabIcon = "file file_type_default";
	#content = null;
	hideQuickTools = false;
	stylesheets;
	#customTitleFn = null;
	focusedBefore = false;
	focused = false;
	loaded = true;
	loading = false;
	deletedFile = false;
	#rawSession = null;
	encoding = appSettings.value.defaultFileEncoding;
	readOnly = false;
	markChanged = true;
	#SAFMode = null;
	#name = config.DEFAULT_FILE_NAME;
	#uri;
	#id = config.DEFAULT_FILE_SESSION;
	#tab;
	#editable = true;
	#pinned = false;
	#loadOptions;
	#isUnsaved = false;
	#hasVersionMetadata = false;
	#cacheWriteTimer = null;
	#cacheWritePromise = null;
	#savedDoc = null;
	#canRun = Promise.resolve(false);
	#onFilePosChange;
	#events = {
		save: [],
		change: [],
		focus: [],
		blur: [],
		close: [],
		rename: [],
		load: [],
		loaderror: [],
		loadstart: [],
		loadend: [],
		changemode: [],
		run: [],
		canrun: [],
	};
	onsave;
	onchange;
	onfocus;
	onblur;
	onclose;
	onrename;
	onload;
	onloaderror;
	onloadstart;
	onloadend;
	onchangemode;
	onrun;
	oncanrun;
	onpinstatechange;
	docVersion = 0;
	savedVersion = 0;
	cacheVersion = 0;
	savedMtime = null;
	diskMtime = null;
	hasDiskConflict = false;
	isPanePlaceholder = false;
	constructor(filename, options) {
		const { addFile, getFile } = editorManager;
		let doesExists = null;
		this.hideQuickTools = options?.hideQuickTools || false;
		this.paneId = options?.paneId || options?.pane?.id || null;
		this.isPanePlaceholder = !!options?.isPanePlaceholder;
		if (options) {
			if (!options.id) {
				if (options.uri) this.#id = options.uri.hashCode();
				else this.#id = helpers.uuid();
			} else this.#id = options.id;
		} else if (!options) {
			this.#id = config.DEFAULT_FILE_SESSION;
		}
		if (options?.type) {
			this.#type = options.type;
			if (this.#type !== "editor") {
				let container;
				let shadow;
				if (this.#type === "terminal") {
					container = tag("div", {
						className: "tab-page-container",
					});
					const content = tag("div", {
						className: "tab-page-content",
					});
					content.appendChild(options?.content);
					container.appendChild(content);
					this.#content = container;
				} else {
					container = <div className="tab-page-container" />;
					shadow = container.attachShadow({
						mode: "open",
					});
					const sharedSheet = getMainCSSStyleSheet();
					let adopted = false;
					if (sharedSheet) {
						try {
							shadow.adoptedStyleSheets = [sharedSheet];
							adopted = true;
						} catch (e) {
							console.warn(
								"Failed to adopt document stylesheet, attempting constructed fallback",
								e,
							);
							if (
								typeof CSSStyleSheet !== "undefined" &&
								CSSStyleSheet.prototype.replaceSync
							) {
								try {
									const cssText = Array.from(sharedSheet.cssRules)
										.map((rule) => rule.cssText)
										.join("\n");
									const constructedSheet = new CSSStyleSheet();
									constructedSheet.replaceSync(cssText);
									shadow.adoptedStyleSheets = [constructedSheet];
									adopted = true;
									mainCSSStyleSheet = constructedSheet;
								} catch (innerError) {
									console.warn(
										"Failed constructed stylesheet fallback",
										innerError,
									);
								}
							}
						}
					}
					if (!adopted) {
						shadow.appendChild(<link rel="stylesheet" href="build/main.css" />);
					}
					if (options.stylesheets) {
						this.#addCustomStyles(options.stylesheets, shadow);
					}
					const content = <div className="tab-page-content" />;
					if (typeof options.content === "string") {
						content.innerHTML = DOMPurify.sanitize(options.content);
					} else {
						content.appendChild(options.content);
					}
					shadow.appendChild(content);
					this.#content = container;
				}
			} else {
				this.#content = options.content;
			}
			if (options.tabIcon) {
				this.#tabIcon = options.tabIcon;
			}
		}
		this.#uri = options?.uri;
		if (this.#id) doesExists = getFile(this.#id, "id");
		else if (this.#uri) doesExists = getFile(this.#uri, "uri");
		if (doesExists) {
			doesExists.makeActive();
			return;
		}
		if (filename) this.#name = filename;
		this.#tab = tile({
			text: this.#name,
			...(this.#type !== "editor" && {
				lead: (
					<span
						className={this.icon}
						style={{
							paddingRight: "5px",
						}}
					></span>
				),
			}),
			tail: tag("span", {
				className: "icon cancel",
				dataset: {
					action: "close-file",
				},
			}),
		});
		const editable =
			options?.editable !== undefined ? !!options.editable : !options?.readOnly;
		this.#SAFMode = options?.SAFMode;
		this.docVersion = Number.isFinite(options?.docVersion)
			? options.docVersion
			: options?.isUnsaved
				? 1
				: 0;
		this.savedVersion = Number.isFinite(options?.savedVersion)
			? options.savedVersion
			: options?.isUnsaved
				? 0
				: this.docVersion;
		this.cacheVersion = Number.isFinite(options?.cacheVersion)
			? options.cacheVersion
			: options?.isUnsaved
				? this.docVersion
				: this.savedVersion;
		this.savedMtime = helpers.normalizeMtime(options?.savedMtime);
		this.diskMtime = helpers.normalizeMtime(
			options?.diskMtime ?? options?.savedMtime,
		);
		this.hasDiskConflict = !!options?.hasDiskConflict;
		this.#hasVersionMetadata =
			options?.docVersion !== undefined ||
			options?.savedVersion !== undefined ||
			options?.text !== undefined ||
			options?.isUnsaved !== undefined ||
			this.#id === config.DEFAULT_FILE_SESSION;
		this.isUnsaved = options?.isUnsaved ?? this.hasUnsavedChanges();
		if (options?.encoding) {
			this.encoding = options.encoding;
		}
		if (this.#id !== config.DEFAULT_FILE_SESSION) {
			this.loaded = options?.text !== undefined;
		}
		this.readOnly = !editable;
		this.#editable = editable;
		if (!this.loaded) {
			this.#loadOptions = {
				cursorPos: options?.cursorPos,
				scrollLeft: options?.scrollLeft,
				scrollTop: options?.scrollTop,
				folds: options?.folds,
				editable,
			};
		}
		this.#onFilePosChange = () => {
			const { openFileListPos } = appSettings.value;
			if (
				openFileListPos === appSettings.OPEN_FILE_LIST_POS_HEADER ||
				openFileListPos === appSettings.OPEN_FILE_LIST_POS_BOTTOM
			) {
				this.#tab.oncontextmenu = startDrag;
			} else {
				this.#tab.oncontextmenu = null;
			}
		};
		this.#onFilePosChange();
		this.#tab.addEventListener("click", tabOnclick.bind(this));
		appSettings.on("update:openFileListPos", this.#onFilePosChange);
		this.pinned = !!options?.pinned;
		addFile(this);
		editorManager.emit("new-file", this);
		if (this.#type === "editor") {
			this.#rawSession = EditorState.create({
				doc: options?.text || "",
			});
			if (!this.#isUnsaved) {
				this.#savedDoc = this.#rawSession.doc;
			}
			this.setMode();
			this.#setupSession();
		}
		if (options?.render ?? true) this.render();
	}
	get type() {
		return this.#type;
	}
	get tabIcon() {
		return this.#tabIcon;
	}
	get content() {
		return this.#content;
	}
	get session() {
		return createSessionProxy(this.#rawSession, this);
	}
	set session(value) {
		this.#rawSession = value;
	}
	_setRawSession(state) {
		this.#rawSession = state;
	}
	get id() {
		return this.#id;
	}
	set id(value) {
		this.#renameCacheFile(value);
		this.#id = value;
	}
	get filename() {
		return this.#name;
	}
	set filename(value) {
		if (!value || this.#SAFMode === "single") return;
		if (this.#name === value) return;
		const event = createFileEvent(this);
		this.#emit("rename", event);
		if (event.defaultPrevented) return;
		(async () => {
			if (this.id === config.DEFAULT_FILE_SESSION) {
				this.id = helpers.uuid();
			}
			if (editorManager.activeFile.id === this.id) {
				editorManager.header.text = value;
			}
			const oldExt = Url.extname(this.#name);
			const newExt = Url.extname(value);
			this.#tab.text = value;
			this.#name = value;
			if (oldExt !== newExt) this.setMode();
			editorManager.onupdate("rename-file");
			editorManager.emit("rename-file", this);
		})();
	}
	get location() {
		if (this.#SAFMode === "single") return null;
		if (this.#uri) {
			try {
				return Url.dirname(this.#uri);
			} catch (error) {
				return null;
			}
		}
		return null;
	}
	set location(value) {
		if (!value) return;
		if (this.#SAFMode === "single") return;
		if (this.location === value) return;
		const event = createFileEvent(this);
		this.#emit("rename", event);
		if (event.defaultPrevented) return;
		this.uri = Url.join(value, this.filename);
		this.readOnly = false;
	}
	get uri() {
		return this.#uri;
	}
	set uri(value) {
		if (this.#uri === value) return;
		if (!value) {
			this.deletedFile = true;
			this.isUnsaved = true;
			this.#uri = null;
			this.id = helpers.uuid();
		} else {
			this.#uri = value;
			this.deletedFile = false;
			this.readOnly = false;
			this.id = value.hashCode();
		}
		editorManager.onupdate("rename-file");
		editorManager.emit("rename-file", this);
		if (editorManager.activeFile.id === this.id) {
			editorManager.header.subText = this.#getTitle();
		}
	}
	get eol() {
		const { doc } = this.session;
		for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
			if (doc.line(lineNumber).text.includes("\r")) return "windows";
		}
		return "unix";
	}
	set eol(value) {
		if (this.type !== "editor") return;
		if (this.eol === value) return;
		let text = getDocText(this.session.doc);
		if (value === "windows") {
			text = text.replace(/\n(?<!\r\n)/g, "\r\n");
		} else {
			text = text.replace(/\r/g, "");
		}
		this.session.setValue(text);
	}
	get editable() {
		return this.#editable;
	}
	set editable(value) {
		if (this.#editable === value) return;
		this.setReadOnly(!value);
		editorManager.onupdate("read-only");
		editorManager.emit("update", "read-only");
		this.#editable = value;
	}
	get isUnsaved() {
		return this.#isUnsaved;
	}
	set isUnsaved(value) {
		value = !!value;
		if (this.#isUnsaved === value) return;
		if (!value && this.#hasVersionMetadata) {
			this.savedVersion = this.docVersion;
			this.hasDiskConflict = false;
			this.#savedDoc = this.#rawSession?.doc || this.#savedDoc;
		}
		this.#isUnsaved = value;
		this.#updateTab();
	}
	get pinned() {
		return this.#pinned;
	}
	set pinned(value) {
		this.setPinnedState(value);
	}
	setPinnedState(value, options = {}) {
		const { reorder = false, emit = true } = options;
		value = !!value;
		if (this.#pinned === value) return value;
		this.#pinned = value;
		this.#updateTab();
		this.onpinstatechange?.(value);
		if (editorManager.files.includes(this) && reorder) {
			editorManager.moveFileByPinnedState?.(this);
		}
		if (emit) {
			editorManager.onupdate("pin-tab");
			editorManager.emit("update", "pin-tab", this);
		}
		return value;
	}
	togglePinned() {
		return this.setPinnedState(!this.pinned);
	}
	get name() {
		return this.#name;
	}
	get cacheFile() {
		return Url.join(CACHE_STORAGE, this.#id);
	}
	get icon() {
		if (this.#type !== "editor") {
			return this.#tabIcon;
		}
		return helpers.getIconForFile(this.filename);
	}
	get tab() {
		return this.#tab;
	}
	get SAFMode() {
		return this.#SAFMode;
	}
	get hasVersionMetadata() {
		return this.#hasVersionMetadata;
	}
	hasUnsavedChanges() {
		if (this.type !== "editor") return false;
		const currentDoc = this.#rawSession?.doc;
		if (currentDoc && this.#savedDoc) {
			return (
				this.hasDiskConflict ||
				this.deletedFile ||
				!currentDoc.eq(this.#savedDoc)
			);
		}
		return (
			this.hasDiskConflict ||
			this.deletedFile ||
			this.docVersion !== this.savedVersion
		);
	}
	refreshUnsavedState() {
		this.isUnsaved = this.hasUnsavedChanges();
		return this.#isUnsaved;
	}
	markLoaded({ mtime, isUnsaved = false, savedDoc = null } = {}) {
		const normalizedMtime = helpers.normalizeMtime(mtime);
		this.docVersion = isUnsaved ? 1 : 0;
		this.savedVersion = isUnsaved ? 0 : this.docVersion;
		this.cacheVersion = isUnsaved ? this.docVersion : this.savedVersion;
		this.savedMtime = normalizedMtime;
		this.diskMtime = normalizedMtime;
		this.hasDiskConflict = false;
		this.#hasVersionMetadata = true;
		this.#savedDoc =
			savedDoc ?? (isUnsaved ? null : this.#rawSession?.doc || null);
		this.isUnsaved = isUnsaved || this.hasUnsavedChanges();
	}
	markEdited({ exact = false } = {}) {
		if (this.type !== "editor") return;
		this.isPanePlaceholder = false;
		if (this.id === config.DEFAULT_FILE_SESSION) {
			this.id = helpers.uuid();
		}
		this.docVersion += 1;
		this.#hasVersionMetadata = true;
		if (exact) {
			this.refreshUnsavedState();
			return;
		}
		if (!this.#isUnsaved) this.isUnsaved = true;
	}
	markSaved({ mtime, savedDoc, savedVersion } = {}) {
		const normalizedMtime = helpers.normalizeMtime(mtime);
		this.savedVersion = Number.isFinite(savedVersion)
			? savedVersion
			: this.docVersion;
		this.savedMtime = normalizedMtime;
		this.diskMtime = normalizedMtime;
		this.hasDiskConflict = false;
		this.#hasVersionMetadata = true;
		this.#savedDoc = savedDoc || this.#rawSession?.doc || null;
		this.isUnsaved = this.hasUnsavedChanges();
	}
	markDiskChanged({ mtime, deleted = false } = {}) {
		this.diskMtime = helpers.normalizeMtime(mtime);
		this.#hasVersionMetadata = true;
		if (deleted) {
			this.deletedFile = true;
			this.isUnsaved = true;
			return;
		}
		this.hasDiskConflict =
			this.docVersion !== this.savedVersion &&
			this.diskMtime !== this.savedMtime;
		this.isUnsaved = this.hasUnsavedChanges();
	}
	scheduleCacheWrite(delay = 1500) {
		if (this.type !== "editor") return Promise.resolve();
		if (this.cacheVersion === this.docVersion && this.#hasVersionMetadata) {
			return this.#cacheWritePromise || Promise.resolve();
		}
		if (this.#cacheWriteTimer) clearTimeout(this.#cacheWriteTimer);
		if (delay <= 0) {
			this.#cacheWriteTimer = null;
			this.#cacheWritePromise = this.writeToCache().finally(() => {
				this.#cacheWritePromise = null;
			});
			return this.#cacheWritePromise;
		}
		this.#cacheWriteTimer = setTimeout(() => {
			this.#cacheWriteTimer = null;
			this.#cacheWritePromise = this.writeToCache().finally(() => {
				this.#cacheWritePromise = null;
			});
		}, delay);
		return Promise.resolve();
	}
	async flushCacheWrite() {
		if (this.#cacheWriteTimer) {
			clearTimeout(this.#cacheWriteTimer);
			this.#cacheWriteTimer = null;
			if (!this.#cacheWritePromise) {
				this.#cacheWritePromise = this.writeToCache().finally(() => {
					this.#cacheWritePromise = null;
				});
			}
		}
		if (this.#cacheWritePromise) await this.#cacheWritePromise;
		if (this.cacheVersion !== this.docVersion) {
			if (this.#cacheWriteTimer) {
				clearTimeout(this.#cacheWriteTimer);
				this.#cacheWriteTimer = null;
			}
			this.#cacheWritePromise = this.writeToCache().finally(() => {
				this.#cacheWritePromise = null;
			});
			await this.#cacheWritePromise;
		}
	}
	async writeToCache() {
		const writeVersion = this.docVersion;
		const text = getDocText(this.session.doc);
		const fs = fsOperation(this.cacheFile);
		try {
			if (!(await fs.exists())) {
				await fsOperation(CACHE_STORAGE).createFile(this.id, text);
				this.cacheVersion = writeVersion;
				this.#hasVersionMetadata = true;
				if (this.docVersion !== writeVersion) this.scheduleCacheWrite();
				return;
			}
			await fs.writeFile(text);
			this.cacheVersion = writeVersion;
			this.#hasVersionMetadata = true;
			if (this.docVersion !== writeVersion) this.scheduleCacheWrite();
		} catch (error) {
			window.log("error", "Writing to cache failed:");
			window.log("error", error);
		}
	}
	async isChanged() {
		if (this.type !== "editor") return false;
		if (!this.loaded || this.loading) {
			return false;
		}
		if (this.#hasVersionMetadata) {
			return this.hasUnsavedChanges();
		}
		if (!this.uri || this.readOnly) {
			if (this.id === config.DEFAULT_FILE_SESSION) {
				this.id = helpers.uuid();
			}
			return true;
		}
		const protocol = Url.getProtocol(this.#uri);
		const text = getDocText(this.session.doc);
		const jsCompare = async (fileUri) => {
			const fs = fsOperation(fileUri);
			const oldText = await fs.readFile(this.encoding);
			return await system.compareTexts(oldText, text);
		};
		if (/s?ftp:/.test(protocol)) {
			const cacheFilename = protocol.slice(0, -1) + this.id;
			const cacheFileUri = Url.join(CACHE_STORAGE, cacheFilename);
			try {
				return await system.compareFileText(cacheFileUri, this.encoding, text);
			} catch (error) {
				console.error(
					"Native compareFileText failed, using JS fallback:",
					error,
				);
				try {
					return await jsCompare(cacheFileUri);
				} catch (fallbackError) {
					console.error(fallbackError);
					return false;
				}
			}
		}
		if (/^(file|content):/.test(protocol)) {
			try {
				return await system.compareFileText(this.uri, this.encoding, text);
			} catch (error) {
				console.error(
					"Native compareFileText failed, using JS fallback:",
					error,
				);
				try {
					return await jsCompare(this.uri);
				} catch (fallbackError) {
					console.error(fallbackError);
					return false;
				}
			}
		}
		try {
			return await jsCompare(this.uri);
		} catch (error) {
			console.error(error);
			return false;
		}
	}
	async canRun() {
		if (!this.loaded || this.loading) return false;
		await this.readCanRun();
		return this.#canRun;
	}
	async readCanRun() {
		try {
			const event = createFileEvent(this);
			this.#emit("canrun", event);
			if (event.defaultPrevented) return;
			const folder = openFolder.find(this.uri);
			if (folder) {
				const url = Url.join(folder.url, "index.html");
				const fs = fsOperation(url);
				if (await fs.exists()) {
					this.#canRun = Promise.resolve(true);
					return;
				}
			}
			const runnableFile = /\.((html?)|(md)|(js)|(svg))$/;
			if (runnableFile.test(this.filename)) {
				this.#canRun = Promise.resolve(true);
				return;
			}
			this.#canRun = Promise.resolve(false);
		} catch (error) {
			if (err instanceof Error) throw err;
			else throw new Error(err);
		}
	}
	async writeCanRun(cb) {
		if (!cb || typeof cb !== "function") return;
		const res = cb();
		if (res instanceof Promise) {
			this.#canRun = res;
			return;
		}
		this.#canRun = Promise.resolve(res);
	}
	async remove(force = false, options = {}) {
		const {
			ignorePinned = false,
			silentPinned = false,
			suppressPanePlaceholder = false,
		} = options || {};
		const isUnsaved = this.refreshUnsavedState();
		const suppressFallback =
			suppressPanePlaceholder && this.isPanePlaceholder && !isUnsaved;
		if (this.id === config.DEFAULT_FILE_SESSION && !editorManager.files.length)
			return false;
		if (this.pinned && !ignorePinned) {
			if (!silentPinned) {
				toast(
					strings["unpin tab before closing"] ||
						"Unpin the tab before closing it.",
				);
			}
			return false;
		}
		if (!force && isUnsaved) {
			const confirmation = await confirm(
				strings.warning.toUpperCase(),
				strings["unsaved file"],
			);
			if (!confirmation) return false;
		}
		this.#destroy();
		const removal = editorManager.removeFileFromPane?.(this);
		if (!removal) {
			editorManager.files = editorManager.files.filter(
				(file) => file.id !== this.id,
			);
		}
		const { activeFile } = editorManager;
		const wasActive = activeFile?.id === this.id;
		if (wasActive) {
			editorManager.activeFile = null;
		}
		const paneClosed =
			!suppressFallback &&
			this.isPanePlaceholder &&
			!isUnsaved &&
			removal?.pane &&
			!removal.nextFile &&
			editorManager.closeEmptyPane?.(removal.pane);
		const { files } = editorManager;
		if (!files.length) {
			Sidebar.hide();
			editorManager.activeFile = null;
			if (!suppressFallback) new EditorFile();
		} else if (
			removal?.wasPaneActive &&
			removal.nextFile &&
			!suppressFallback
		) {
			removal.nextFile.makeActive();
		} else if (
			removal?.wasPaneActive &&
			removal.pane &&
			!removal.nextFile &&
			!paneClosed &&
			!suppressFallback
		) {
			new EditorFile(config.DEFAULT_FILE_NAME, {
				paneId: removal.pane.id,
				text: "",
				isUnsaved: false,
				isPanePlaceholder: true,
			});
		} else if (wasActive && !suppressFallback) {
			(
				editorManager.activePane?.activeFile || files[files.length - 1]
			).makeActive();
		}
		editorManager.onupdate("remove-file");
		editorManager.emit("remove-file", this);
		return true;
	}
	save() {
		if (this.type !== "editor") return Promise.resolve(false);
		return this.#save(false);
	}
	saveAs() {
		if (this.type !== "editor") return Promise.resolve(false);
		return this.#save(true);
	}
	setReadOnly(value) {
		const readOnly = !!value;
		this.readOnly = readOnly;
		this.#editable = !readOnly;
		try {
			const { readOnlyCompartment } = editorManager;
			if (readOnlyCompartment) {
				const pane = editorManager.getFilePane?.(this);
				const targetEditor =
					pane?.activeFile?.id === this.id
						? pane.editor
						: editorManager.activeFile?.id === this.id
							? editorManager.editor
							: null;
				if (targetEditor) {
					reconfigureEditorReadOnly(
						targetEditor,
						readOnlyCompartment,
						readOnly,
					);
				}
			}
		} catch (error) {
			console.warn(
				`Failed to update read-only state for ${this.filename || this.uri}`,
				error,
			);
		}
		if (editorManager.activeFile?.id === this.id) {
			editorManager.header.subText = this.#getTitle();
		}
	}
	setMode(mode, options = {}) {
		if (this.type !== "editor") return;
		const event = createFileEvent(this);
		this.#emit("changemode", event);
		if (event.defaultPrevented) return;
		if (!mode) {
			const ext = Path.extname(this.filename);
			const modes = helpers.parseJSON(localStorage.modeassoc);
			if (modes?.[ext]) {
				mode = modes[ext];
			}
		}
		let modeInfo = mode ? getMode(mode) : null;
		if (!modeInfo) {
			modeInfo = getModeForPath(this.filename);
		}
		mode = modeInfo?.name || String(mode || "text").toLowerCase();
		this.currentMode = mode;
		this.currentLanguageExtension = modeInfo?.getExtension() || null;
		this.__cmCachedLanguageExtension = null;
		this.__cmCachedLanguageSignature = null;
		if (options.recommend !== false) {
			maybeRecommendLanguageModeExtension(this, modeInfo);
		}
		this.#tab.lead(
			<span
				className={this.icon}
				style={{
					paddingRight: "5px",
				}}
			></span>,
		);
	}
	makeActive() {
		const pane = editorManager.getFilePane?.(this) || editorManager.activePane;
		const wasActivePane = editorManager.activePane?.id === pane?.id;
		const { activeFile, switchFile } = editorManager;
		const paneActiveFile = pane?.activeFile;
		const activeEditor = editorManager.editor;
		const editorHadDomFocus =
			activeEditor?.contentDOM === document.activeElement ||
			activeEditor?.contentDOM?.contains(document.activeElement);
		const inactiveFiles = [paneActiveFile, !wasActivePane ? activeFile : null];
		const blurredFileIds = new Set();
		for (const file of inactiveFiles) {
			if (!file || file.id === this.id || blurredFileIds.has(file.id)) continue;
			file.focusedBefore = file.focused;
			file.removeActive();
			blurredFileIds.add(file.id);
		}
		if (activeFile?.id === this.id && wasActivePane) {
			syncQuickToolsVisibility(this);
			return;
		}
		switchFile(this.id, pane);
		const { editor } = editorManager;
		if (this.type === "editor") {
			editorManager.container.style.display = "block";
			if (this.focused && editorHadDomFocus && !isTouchDevice()) {
				focusEditorIfEditable(editor);
			} else {
				editor.contentDOM.blur();
				try {
					document.getSelection()?.removeAllRanges();
				} catch (error) {
					console.warn("Failed to clear native text selection.", error);
				}
			}
		} else {
			editorManager.container.style.display = "none";
			if (this.content) {
				this.content.style.display = "block";
				if (
					this.content.parentElement !== editorManager.container.parentElement
				) {
					editorManager.container.parentElement.appendChild(this.content);
				}
			}
			if (activeFile && activeFile.type === "editor") {
				clearSelection(editorManager.editor);
			}
		}
		this.#tab.classList.add("active");
		this.#tab.scrollIntoView();
		if (this.type === "editor" && !this.loaded && !this.loading) {
			this.#loadText();
		}
		syncQuickToolsVisibility(this);
		editorManager.header.subText = this.#getTitle();
		this.#emit("focus", createFileEvent(this));
	}
	removeActive() {
		this.#emit("blur", createFileEvent(this));
	}
	openWith() {
		this.#fileAction("VIEW");
	}
	editWith() {
		this.#fileAction("EDIT", "text/plain");
	}
	share() {
		this.#fileAction("SEND");
	}
	runAction() {
		this.#fileAction("RUN");
	}
	run() {
		this.#run(false);
	}
	runFile() {
		this.#run(true);
	}
	render() {
		this.makeActive();
		if (this.id !== config.DEFAULT_FILE_SESSION) {
			const pane = editorManager.getFilePane?.(this);
			const defaultFile = editorManager.getFile(
				config.DEFAULT_FILE_SESSION,
				"id",
			);
			if (defaultFile && editorManager.getFilePane?.(defaultFile) === pane) {
				defaultFile.remove();
			}
			editorManager
				.getPaneFiles?.(this)
				?.filter(
					(file) =>
						file !== this &&
						file.isPanePlaceholder &&
						!file.isUnsaved &&
						editorManager.getFilePane?.(file) === pane,
				)
				.forEach((file) => {
					file.remove(true, {
						ignorePinned: true,
					});
				});
		}
		if (this.#type === "editor") {
			editorManager.container.style.display = "block";
			if (this.#content) this.#content.style.display = "none";
		} else {
			editorManager.container.style.display = "none";
			if (this.#content) {
				this.#content.style.display = "block";
				if (
					this.#content.parentElement !== editorManager.container.parentElement
				) {
					editorManager.container.parentElement.appendChild(this.#content);
				}
			}
		}
	}
	on(event, callback) {
		this.#events[event.toLowerCase()]?.push(callback);
	}
	off(event, callback) {
		const events = this.#events[event.toLowerCase()];
		if (!events) return;
		const index = events.indexOf(callback);
		if (index > -1) events.splice(index, 1);
	}
	#addCustomStyles(styles, shadow) {
		if (typeof styles === "string") {
			styles = [styles];
		}
		styles.forEach((style) => {
			if (style.startsWith("http") || style.startsWith("/")) {
				const link = tag("link", {
					rel: "stylesheet",
					href: style,
				});
				shadow.appendChild(link);
			} else {
				const styleElement = tag("style", {
					textContent: style,
				});
				shadow.appendChild(styleElement);
			}
		});
	}
	addStyle(style) {
		if (this.#type === "editor" || !this.#content) return;
		const shadow = this.#content.shadowRoot;
		this.#addCustomStyles(style, shadow);
	}
	setCustomTitle(titleFn) {
		this.#customTitleFn = titleFn;
		if (editorManager.activeFile && editorManager.activeFile.id === this.id) {
			editorManager.header.subText = this.#getTitle();
		}
	}
	get headerSubtitle() {
		return this.#getTitle();
	}
	async #fileAction(action, mimeType) {
		try {
			const uri = await this.#getShareableUri();
			if (!mimeType) mimeType = mimeTypes.lookup(this.name) || "text/plain";
			system.fileAction(
				uri,
				this.filename,
				action,
				mimeType,
				this.#showNoAppError,
			);
		} catch (error) {
			toast(strings.error);
		}
	}
	async #getShareableUri() {
		if (!this.uri) return null;
		const fs = fsOperation(this.uri);
		if (/^s?ftp:/.test(this.uri)) return fs.localName;
		const { url } = await fs.stat();
		return url;
	}
	async #renameCacheFile(newId) {
		try {
			const fs = fsOperation(this.cacheFile);
			if (!(await fs.exists())) return;
			fs.renameTo(newId);
		} catch (error) {
			window.log("error", "renameCacheFile");
			window.log("error", error);
		}
	}
	async #removeCache() {
		try {
			const fs = fsOperation(this.cacheFile);
			if (!(await fs.exists())) return;
			await fs.delete();
		} catch (error) {
			window.log("error", error);
		}
	}
	async #loadText() {
		if (this.#type !== "editor") return;
		let value = "";
		const protocol = this.uri ? Url.getProtocol(this.uri) : "";
		const isRemoteFile = protocol === "ftp:" || protocol === "sftp:";
		const { cursorPos, scrollLeft, scrollTop, folds, editable } =
			this.#loadOptions;
		const { editor } = editorManager;
		this.#loadOptions = null;
		if (!editable) {
			this.setReadOnly(true);
		}
		this.loading = true;
		this.markChanged = false;
		if (isRemoteFile) this.#setRemoteLoading(true);
		this.#emit("loadstart", createFileEvent(this));
		try {
			const cacheFs = fsOperation(this.cacheFile);
			let file = null;
			let cacheExists;
			let loadedMtime = this.savedMtime;
			let savedDoc = null;
			if (isRemoteFile) {
				file = fsOperation(this.uri);
				let transportCache = null;
				try {
					const localName = file?.localName;
					if (localName) {
						transportCache = fsOperation(localName);
					}
				} catch (_error) {}
				const preview = await readRemoteFilePreview({
					editorCache: cacheFs,
					transportCache,
					encoding: this.encoding,
				});
				cacheExists = preview.editorCacheExists;
				if (cacheExists) value = preview.text;
				if (preview.text !== null) {
					this.session = EditorState.create({
						doc: preview.text,
					});
					editorManager.emit("file-loading-preview", this, preview.text);
				}
			} else {
				cacheExists = await cacheFs.exists();
				if (cacheExists) {
					value = await cacheFs.readFile(this.encoding);
				}
			}
			if (this.uri) {
				file ||= fsOperation(this.uri);
				const fileExists = await file.exists();
				if (!fileExists && cacheExists) {
					this.deletedFile = true;
					this.isUnsaved = true;
				} else if (fileExists) {
					const stat = await file.stat().catch(() => null);
					loadedMtime = helpers.getStatMtime(stat);
					const diskValue = await file.readFile(this.encoding);
					savedDoc = EditorState.create({
						doc: diskValue,
					}).doc;
					if (!cacheExists) {
						value = diskValue;
					}
				} else if (!cacheExists && !fileExists) {
					window.log("error", "unable to load file");
					throw new Error("Unable to load file");
				}
			}
			const isUnsaved = this.isUnsaved;
			this.markChanged = false;
			this.session = EditorState.create({
				doc: value,
			});
			this.__cmSessionReady = false;
			this.__cmLanguageReady = false;
			this.__cmLanguageSignature = null;
			this.markLoaded({
				mtime: loadedMtime,
				isUnsaved,
				savedDoc,
			});
			this.markChanged = true;
			this.loaded = true;
			this.loading = false;
			const { activeFile, emit } = editorManager;
			const pane = editorManager.getFilePane?.(this);
			const isActiveInPane = pane?.activeFile?.id === this.id;
			if (isActiveInPane || activeFile?.id === this.id) {
				this.setReadOnly(editable === false);
				emit("file-loaded", this);
			}
			setTimeout(() => {
				this.#emit("load", createFileEvent(this));
				if (cursorPos) {
					restoreSelection(editor, cursorPos);
				}
				if (scrollTop || scrollLeft) {
					setScrollPosition(editor, scrollTop, scrollLeft);
				}
				restoreFolds(editor, folds);
			}, 0);
		} catch (error) {
			this.#emit("loaderror", createFileEvent(this));
			this.remove(false, {
				ignorePinned: true,
			});
			toast(`Unable to load: ${this.filename}`);
			window.log("error", "Unable to load: " + this.filename);
			window.log("error", error);
		} finally {
			if (isRemoteFile) this.#setRemoteLoading(false);
			this.#emit("loadend", createFileEvent(this));
		}
	}
	#setRemoteLoading(loading) {
		if (!this.#tab) return;
		this.#tab.classList.toggle("loading", loading);
		if (loading) {
			this.#tab.setAttribute("aria-busy", "true");
		} else {
			this.#tab.removeAttribute("aria-busy");
		}
	}
	#save(as) {
		const event = createFileEvent(this);
		this.#emit("save", event);
		if (event.defaultPrevented) return Promise.resolve(false);
		return Promise.all([this.flushCacheWrite(), saveFile(this, as)]);
	}
	#run(file) {
		const event = createFileEvent(this);
		this.#emit("run", event);
		if (event.defaultPrevented) return;
		run(false, appSettings.value.previewMode, file);
	}
	#updateTab() {
		if (!this.#tab) return;
		if (this.#isUnsaved) {
			this.tab.classList.add("notice");
		} else {
			this.tab.classList.remove("notice");
		}
		this.tab.classList.toggle("pinned", this.#pinned);
		this.#tab.tail(this.#createTabTail());
	}
	#setupSession() {
		if (this.type !== "editor") return;
		this.editorSettings = {
			tabSize: appSettings.value.tabSize,
			softTab: appSettings.value.softTab,
			textWrap: appSettings.value.textWrap,
		};
	}
	#destroy() {
		this.#emit("close", createFileEvent(this));
		appSettings.off("update:openFileListPos", this.#onFilePosChange);
		if (this.#cacheWriteTimer) {
			clearTimeout(this.#cacheWriteTimer);
			this.#cacheWriteTimer = null;
		}
		this.#cacheWritePromise = null;
		this.#savedDoc = null;
		if (this.type === "editor") {
			this.#removeCache();
			this.session = null;
		} else if (this.content) {
			this.content.remove();
		}
		this.#tab.remove();
		this.#tab = null;
	}
	#showNoAppError() {
		toast(strings["no app found to handle this file"]);
	}
	#createTabTail() {
		if (!this.#pinned) {
			return tag("span", {
				className: "icon cancel",
				dataset: {
					action: "close-file",
				},
			});
		}
		return tag("span", {
			className: "icon pin",
			title: strings["unpin tab"] || "Unpin tab",
			dataset: {
				action: "toggle-pin",
			},
		});
	}
	#getTitle() {
		if (this.#customTitleFn) {
			return this.#customTitleFn();
		}
		let text = this.location || this.uri;
		if (text && !this.readOnly) {
			text = helpers.getVirtualPath(text);
			if (text.length > 30) text = "..." + text.slice(text.length - 27);
		} else if (this.readOnly) {
			text = strings["read only"];
		} else if (this.deletedFile) {
			text = strings["deleted file"];
		} else {
			text = strings["new file"];
		}
		return text;
	}
	#emit(eventName, event) {
		this[`on${eventName}`]?.(event);
		if (!event.BUBBLING_PHASE) return;
		this.#events[eventName]?.some((fn) => {
			fn(event);
			return !event.BUBBLING_PHASE;
		});
	}
}
function tabOnclick(e) {
	e.preventDefault();
	const { action } = e.target.dataset;
	if (action === "close-file") {
		this.remove();
		return;
	}
	if (action === "toggle-pin") {
		this.togglePinned();
		return;
	}
	this.makeActive();
}
function createFileEvent(file) {
	return new FileEvent(file);
}
class FileEvent {
	#bubblingPhase = true;
	#defaultPrevented = false;
	target;
	constructor(file) {
		this.target = file;
	}
	stopPropagation() {
		this.#bubblingPhase = false;
	}
	preventDefault() {
		this.#defaultPrevented = true;
	}
	get BUBBLING_PHASE() {
		return this.#bubblingPhase;
	}
	get defaultPrevented() {
		return this.#defaultPrevented;
	}
}
