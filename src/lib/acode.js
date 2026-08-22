import fsOperation from "fileSystem";
import sidebarApps from "sidebarApps";
import * as cmAutocomplete from "@codemirror/autocomplete";
import * as cmCommands from "@codemirror/commands";
import * as cmLanguage from "@codemirror/language";
import * as cmLint from "@codemirror/lint";
import * as cmSearch from "@codemirror/search";
import * as cmState from "@codemirror/state";
import * as cmView from "@codemirror/view";
import * as lezerCommon from "@lezer/common";
import * as lezerHighlight from "@lezer/highlight";
import * as lezerLR from "@lezer/lr";
import {
	getRegisteredCommands as listRegisteredCommands,
	refreshCommandKeymap,
	registerExternalCommand,
	removeExternalCommand,
	executeCommand as runCommand,
} from "cm/commandRegistry";
import { default as lspApi } from "cm/lsp/api";
import lspClientManager from "cm/lsp/clientManager";
import { registerLspFormatter } from "cm/lsp/formatter";
import {
	addMode,
	getModeForPath,
	getModes,
	getModesByName,
	removeMode,
} from "cm/modelist";
import cmThemeRegistry from "cm/themes";
import Contextmenu from "components/contextmenu";
import inputhints from "components/inputhints";
import Page from "components/page";
import palette from "components/palette";
import settingsPage from "components/settingsPage";
import SideButton from "components/sideButton";
import { TerminalManager, TerminalThemeManager } from "components/terminal";
import toast from "components/toast";
import tutorial from "components/tutorial";
import alert from "dialogs/alert";
import colorPicker from "dialogs/color";
import confirm from "dialogs/confirm";
import dialog from "dialogs/dialog";
import loader from "dialogs/loader";
import multiPrompt from "dialogs/multiPrompt";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import { addIntentHandler, removeIntentHandler } from "handlers/intent";
import keyboardHandler from "handlers/keyboard";
import windowResize from "handlers/windowResize";
import actionStack from "lib/actionStack";
import commands from "lib/commands";
import EditorFile from "lib/editorFile";
import fileIndex from "lib/fileIndex";
import files from "lib/fileList";
import fileTypeHandler from "lib/fileTypeHandler";
import fonts from "lib/fonts";
import {
	BROKEN_PLUGINS,
	LOADED_PLUGINS,
	onPluginLoadCallback,
	onPluginsLoadCompleteCallback,
} from "lib/loadPlugins";
import notificationManager from "lib/notificationManager";
import openFolder, { addedFolder } from "lib/openFolder";
import projects from "lib/projects";
import selectionMenu from "lib/selectionMenu";
import appSettings from "lib/settings";
import FileBrowser from "pages/fileBrowser";
import ThemeBuilder from "theme/builder";
import themes from "theme/list";
import Color from "utils/color";
import encodings, { decode, encode } from "utils/encodings";
import helpers from "utils/helpers";
import KeyboardEvent from "utils/keyboardEvent";
import Url from "utils/Url";
import config from "./config";
import webview from "./webview";

class Acode {
	#modules = {};
	#pluginsInit = {};
	#pluginUnmount = {};
	#formatter = [];
	#pluginWatchers = {};
	clearBrokenPluginMark(pluginId) {
		try {
			if (BROKEN_PLUGINS.has(pluginId)) {
				BROKEN_PLUGINS.delete(pluginId);
			}
		} catch (e) {
			console.warn("Failed to clear broken plugin mark:", e);
		}
	}
	constructor() {
		const encodingsModule = {
			get encodings() {
				return encodings;
			},
			encode,
			decode,
		};
		const themesModule = {
			add: themes.add,
			get: themes.get,
			list: themes.list,
			update: themes.update,
			apply: () => {},
		};
		const normalizeThemeSpec = (spec) => {
			if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
				console.warn(
					"[editorThemes] register(spec) expects an object: { id, caption?, dark?, getExtension|extensions|extension|theme, config? }",
				);
				return null;
			}
			const id = spec.id || spec.name;
			if (!id) {
				console.warn("[editorThemes] register(spec) requires a valid `id`.");
				return null;
			}
			const extensionSource =
				spec.getExtension || spec.extensions || spec.extension || spec.theme;
			if (extensionSource === undefined || extensionSource === null) {
				console.warn(
					`[editorThemes] register('${id}') requires extensions via getExtension/extensions/extension/theme.`,
				);
				return null;
			}
			return {
				id,
				caption: spec.caption || spec.label || id,
				isDark: spec.isDark ?? spec.dark ?? false,
				getExtension:
					typeof extensionSource === "function"
						? extensionSource
						: () => extensionSource,
				config: spec.config ?? null,
			};
		};
		const createHighlightStyle = (spec) => {
			if (!spec) return null;
			if (Array.isArray(spec)) return cmLanguage.HighlightStyle.define(spec);
			return spec;
		};
		const createTheme = ({
			styles,
			dark = false,
			highlightStyle,
			extensions = [],
		} = {}) => {
			const ext = [];
			if (styles && typeof styles === "object") {
				ext.push(
					cmView.EditorView.theme(styles, {
						dark: !!dark,
					}),
				);
			}
			const resolvedHighlight = createHighlightStyle(highlightStyle);
			if (resolvedHighlight) {
				ext.push(cmLanguage.syntaxHighlighting(resolvedHighlight));
			}
			if (Array.isArray(extensions)) {
				ext.push(...extensions);
			} else if (extensions) {
				ext.push(extensions);
			}
			return ext;
		};
		const editorThemesModule = {
			register: (spec) => {
				const resolved = normalizeThemeSpec(spec);
				if (!resolved) return false;
				return cmThemeRegistry.addTheme(
					resolved.id,
					resolved.caption,
					resolved.isDark,
					resolved.getExtension,
					resolved.config,
				);
			},
			unregister: (id) => cmThemeRegistry.removeTheme(id),
			list: () => cmThemeRegistry.getThemes(),
			apply: (id) => editorManager?.editor?.setTheme?.(id),
			get: (id) => cmThemeRegistry.getThemeById(id),
			getConfig: (id) => cmThemeRegistry.getThemeConfig(id),
			createTheme,
			createHighlightStyle,
			cm: {
				EditorView: cmView.EditorView,
				HighlightStyle: cmLanguage.HighlightStyle,
				syntaxHighlighting: cmLanguage.syntaxHighlighting,
				tags: lezerHighlight.tags,
			},
		};
		const sidebarAppsModule = {
			add: sidebarApps.add,
			get: sidebarApps.get,
			remove: sidebarApps.remove,
		};
		const lspModule = {
			...lspApi,
			clientManager: {
				setOptions: (options) => lspClientManager.setOptions(options),
				getActiveClients: () => lspClientManager.getActiveClients(),
			},
		};
		const getModeByName = (name) => {
			const normalized = String(name || "")
				.trim()
				.toLowerCase();
			if (!normalized) return null;
			return getModesByName()[normalized] || null;
		};
		const listModes = () => [...getModes()];
		const listModesByName = () => ({
			...getModesByName(),
		});
		const aceModes = {
			addMode,
			removeMode,
			getModeForPath: (path) => getModeForPath(String(path || "")),
			getModes: () => listModes(),
			getModesByName: () => listModesByName(),
			getMode: (name) => getModeByName(name),
		};
		const editorLanguages = {
			register: (name, extensions, caption, loader) =>
				addMode(name, extensions, caption, loader),
			unregister: (name) => removeMode(name),
			add: (name, extensions, caption, loader) =>
				addMode(name, extensions, caption, loader),
			remove: (name) => removeMode(name),
			list: () => listModes(),
			listByName: () => listModesByName(),
			get: (name) => getModeByName(name),
			getForPath: (path) => getModeForPath(String(path || "")),
		};
		const intent = {
			addHandler: addIntentHandler,
			removeHandler: removeIntentHandler,
		};
		const terminalTouchSelectionMoreOptions = {
			add: (option) => TerminalManager.addTouchSelectionMoreOption(option),
			remove: (id) => TerminalManager.removeTouchSelectionMoreOption(id),
			list: () => TerminalManager.getTouchSelectionMoreOptions(),
		};
		const terminalModule = {
			create: (options) => TerminalManager.createTerminal(options),
			createLocal: (options) => TerminalManager.createLocalTerminal(options),
			createServer: (options) => TerminalManager.createServerTerminal(options),
			get: (id) => TerminalManager.getTerminal(id),
			getAll: () => TerminalManager.getAllTerminals(),
			write: (id, data) => this.#secureTerminalWrite(id, data),
			clear: (id) => TerminalManager.clearTerminal(id),
			close: (id) => TerminalManager.closeTerminal(id),
			moreOptions: terminalTouchSelectionMoreOptions,
			touchSelection: {
				moreOptions: terminalTouchSelectionMoreOptions,
			},
			themes: {
				register: (name, theme, pluginId) =>
					TerminalThemeManager.registerTheme(name, theme, pluginId),
				unregister: (name, pluginId) =>
					TerminalThemeManager.unregisterTheme(name, pluginId),
				get: (name) => TerminalThemeManager.getTheme(name),
				getAll: () => TerminalThemeManager.getAllThemes(),
				getNames: () => TerminalThemeManager.getThemeNames(),
				createVariant: (baseName, overrides) =>
					TerminalThemeManager.createVariant(baseName, overrides),
			},
		};
		const codemirrorModule = Object.freeze({
			autocomplete: cmAutocomplete,
			commands: cmCommands,
			language: cmLanguage,
			lezer: Object.freeze({
				...lezerHighlight,
				common: lezerCommon,
				highlight: lezerHighlight,
				lr: lezerLR,
			}),
			lint: cmLint,
			search: cmSearch,
			state: cmState,
			view: cmView,
		});
		const configProxy = new Proxy(config, {
			set(target, prop, value, receiver) {
				console.warn(
					`[Security Alert] Attempt to modify read-only config property '${String(prop)}' blocked.`,
				);
				return true;
			},
			defineProperty(target, prop, descriptor) {
				console.warn(
					`[Security Alert] Attempt to define property '${String(prop)}' on read-only config blocked.`,
				);
				return true;
			},
			deleteProperty(target, prop) {
				console.warn(
					`[Security Alert] Attempt to delete property '${String(prop)}' on read-only config blocked.`,
				);
				return true;
			},
			setPrototypeOf(target, prototype) {
				console.warn(
					`[Security Alert] Attempt to change prototype of read-only config blocked.`,
				);
				return true;
			},
		});
		this.define("config", configProxy);
		this.define("Url", Url);
		this.define("page", Page);
		this.define("Color", Color);
		this.define("fonts", fonts);
		this.define("toast", toast);
		this.define("alert", alert);
		this.define("select", select);
		this.define("loader", loader);
		this.define("dialogBox", dialog);
		this.define("prompt", prompt);
		this.define("intent", intent);
		let didWarnAboutFileList = false;
		const deprecatedFileList = (...args) => {
			if (!didWarnAboutFileList) {
				didWarnAboutFileList = true;
				console.warn(
					'acode.require("fileList") is deprecated. Use the asynchronous "fileIndex" API. fileList now contains only non-native storage providers.',
				);
			}
			return files(...args);
		};
		Object.assign(deprecatedFileList, files);
		deprecatedFileList.deprecated = true;
		deprecatedFileList.replacement = "fileIndex";
		this.define("fileList", deprecatedFileList);
		this.define("fileIndex", fileIndex);
		this.define("fs", fsOperation);
		this.define("confirm", confirm);
		this.define("helpers", helpers);
		this.define("palette", palette);
		this.define("projects", projects);
		this.define("tutorial", tutorial);
		this.define("aceModes", aceModes);
		this.define("themes", themesModule);
		this.define("editorLanguages", editorLanguages);
		this.define("editorThemes", editorThemesModule);
		this.define("lsp", lspModule);
		this.define("settings", appSettings);
		this.define("sideButton", SideButton);
		this.define("EditorFile", EditorFile);
		this.define("inputhints", inputhints);
		this.define("openfolder", openFolder);
		this.define("colorPicker", colorPicker);
		this.define("actionStack", actionStack);
		this.define("multiPrompt", multiPrompt);
		this.define("addedfolder", addedFolder);
		this.define("contextMenu", Contextmenu);
		this.define("fileBrowser", FileBrowser);
		this.define("fsOperation", fsOperation);
		this.define("keyboard", keyboardHandler);
		this.define("windowResize", windowResize);
		this.define("encodings", encodingsModule);
		this.define("themeBuilder", ThemeBuilder);
		this.define("selectionMenu", selectionMenu);
		this.define("sidebarApps", sidebarAppsModule);
		this.define("terminal", terminalModule);
		this.define("webview", webview);
		this.define("codemirror", codemirrorModule);
		this.define("@codemirror/autocomplete", cmAutocomplete);
		this.define("@codemirror/commands", cmCommands);
		this.define("@codemirror/language", cmLanguage);
		this.define("@codemirror/lint", cmLint);
		this.define("@codemirror/search", cmSearch);
		this.define("@codemirror/state", cmState);
		this.define("@codemirror/view", cmView);
		this.define("@lezer/common", lezerCommon);
		this.define("@lezer/highlight", lezerHighlight);
		this.define("@lezer/lr", lezerLR);
		this.define("createKeyboardEvent", KeyboardEvent);
		this.define("toInternalUrl", helpers.toInternalUri);
		this.define("commands", this.#createCommandApi());
		registerLspFormatter(this);
	}
	#secureTerminalWrite(id, data) {
		if (typeof data !== "string") {
			console.warn("Terminal write data must be a string");
			return;
		}
		const dangerousPatterns = [
			/^\s*rm\s+-rf?\s+\/[^\r\n]*[\r\n]?$/m,
			/^\s*rm\s+-rf?\s+\*[^\r\n]*[\r\n]?$/m,
			/^\s*rm\s+-rf?\s+~[^\r\n]*[\r\n]?$/m,
			/^\s*mkfs\.[^\r\n]*[\r\n]?$/m,
			/^\s*dd\s+if=\/[^\r\n]*[\r\n]?$/m,
			/^\s*:(){ :|:& };:[^\r\n]*[\r\n]?$/m,
			/^\s*sudo\s+dd\s+if=\/[^\r\n]*[\r\n]?$/m,
			/^\s*sudo\s+rm\s+-rf?\s+\/[^\r\n]*[\r\n]?$/m,
			/^\s*curl\s+[^\r\n]*\|\s*sh[^\r\n]*[\r\n]?$/m,
			/^\s*wget\s+[^\r\n]*\|\s*sh[^\r\n]*[\r\n]?$/m,
			/^\s*bash\s+<\s*\([^\r\n]*[\r\n]?$/m,
			/^\s*sh\s+<\s*\([^\r\n]*[\r\n]?$/m,
			/^\s*nc\s+-l\s+-p\s+\d+[^\r\n]*[\r\n]?$/m,
			/^\s*ncat\s+-l\s+-p\s+\d+[^\r\n]*[\r\n]?$/m,
			/^\s*python\s+.*SimpleHTTPServer[^\r\n]*[\r\n]?$/m,
			/^\s*python\s+.*http\.server[^\r\n]*[\r\n]?$/m,
			/^\s*kill\s+-9\s+1\s*[\r\n]?$/m,
			/^\s*killall\s+-9\s+\*[^\r\n]*[\r\n]?$/m,
			/^\s*chmod\s+777\s+\/[^\r\n]*[\r\n]?$/m,
			/^\s*chown\s+[^\s]+\s+\/[^\r\n]*[\r\n]?$/m,
			/^\s*cat\s+\/etc\/passwd[^\r\n]*[\r\n]?$/m,
			/^\s*cat\s+\/etc\/shadow[^\r\n]*[\r\n]?$/m,
			/^\s*cat\s+\/root\/[^\r\n]*[\r\n]?$/m,
			/\x00/g,
		];
		for (const pattern of dangerousPatterns) {
			if (pattern.test(data)) {
				console.warn(
					`Blocked potentially dangerous terminal command: ${data.substring(0, 50)}...`,
				);
				toast("Potentially dangerous command blocked for security", 3000);
				return;
			}
		}
		if (data.includes("$(") && data.includes(")")) {
			const commandSubstitution = /\$\([^)]*\)/g;
			const matches = data.match(commandSubstitution);
			if (matches) {
				for (const match of matches) {
					for (const pattern of dangerousPatterns) {
						if (pattern.test(match)) {
							console.warn(
								`Blocked command substitution with dangerous content: ${match}`,
							);
							toast("Command substitution blocked for security", 3000);
							return;
						}
					}
				}
			}
		}
		const maxLength = 64 * 1024;
		if (data.length > maxLength) {
			console.warn(
				`Terminal write data truncated - exceeded ${maxLength} characters`,
			);
			data = data.substring(0, maxLength) + "\n[Data truncated for security]\n";
		}
		return TerminalManager.writeToTerminal(id, data);
	}
	define(name, module) {
		this.#modules[name.toLowerCase()] = module;
	}
	require(module) {
		return this.#modules[module.toLowerCase()];
	}
	exec(key, val) {
		if (key in commands) {
			return commands[key](val);
		}
		return false;
	}
	installPlugin(pluginId, installerPluginName) {
		return new Promise((resolve, reject) => {
			fsOperation(Url.join(PLUGIN_DIR, pluginId))
				.exists()
				.then((isPluginExists) => {
					if (isPluginExists) {
						reject(new Error("Plugin already installed"));
						return;
					}
					confirm(
						strings.install,
						`Do you want to install plugin '${pluginId}'${installerPluginName ? ` requested by ${installerPluginName}` : ""}?`,
					).then((confirmation) => {
						if (!confirmation) {
							reject(new Error("User cancelled installation"));
							return;
						}
						let purchaseToken;
						let product;
						const pluginUrl = Url.join(config.API_BASE, `plugin/${pluginId}`);
						fsOperation(pluginUrl)
							.readFile("json")
							.catch(() => {
								reject(new Error("Failed to fetch plugin details"));
								return null;
							})
							.then((remotePlugin) => {
								if (remotePlugin) {
									const isPaid = remotePlugin.price > 0;
									helpers
										.promisify(iap.getProducts, [remotePlugin.sku])
										.then((products) => {
											[product] = products;
											if (product) {
												return getPurchase(product.productId);
											}
											return null;
										})
										.then((purchase) => {
											purchaseToken = purchase?.purchaseToken;
											if (isPaid && !purchaseToken) {
												if (!product) throw new Error("Product not found");
												return helpers
													.checkAPIStatus()
													.then(async (apiStatus) => {
														if (!apiStatus) {
															alert(strings.error, strings.api_error);
															return;
														}
														const { default: purchaseListener } = await import(
															"handlers/purchase"
														);
														iap.setPurchaseUpdatedListener(
															...purchaseListener(onpurchase, onerror),
														);
														return helpers.promisify(
															iap.purchase,
															product.productId,
														);
													});
											}
										})
										.then(() => {
											import("lib/installPlugin").then(
												({ default: installPlugin }) => {
													installPlugin(
														pluginId,
														remotePlugin.name,
														purchaseToken,
													).then(() => {
														resolve();
													});
												},
											);
										});
									async function onpurchase(e) {
										const purchase = await getPurchase(product.productId);
										await fetch(Url.join(config.API_BASE, "plugin/order"), {
											method: "POST",
											body: JSON.stringify({
												id: remotePlugin.id,
												token: purchase?.purchaseToken,
												package: BuildInfo.packageName,
											}),
										});
										purchaseToken = purchase?.purchaseToken;
									}
									async function onerror(error) {
										throw error;
									}
								}
							});
						async function getPurchase(sku) {
							const purchases = await helpers.promisify(iap.getPurchases);
							const purchase = purchases.find((p) =>
								p.productIds.includes(sku),
							);
							return purchase;
						}
					});
				})
				.catch((error) => {
					reject(error);
				});
		});
	}
	[onPluginLoadCallback](pluginId) {
		if (this.#pluginWatchers[pluginId]) {
			this.#pluginWatchers[pluginId].resolve();
			delete this.#pluginWatchers[pluginId];
		}
	}
	[onPluginsLoadCompleteCallback]() {
		for (const pluginId in this.#pluginWatchers) {
			this.#pluginWatchers[pluginId].reject(
				new Error(`Plugin '${pluginId}' failed to load.`),
			);
		}
		this.#pluginWatchers = {};
	}
	waitForPlugin(pluginId) {
		return new Promise((resolve, reject) => {
			if (LOADED_PLUGINS.has(pluginId)) {
				return resolve(true);
			}
			this.#pluginWatchers[pluginId] = {
				resolve,
				reject,
			};
		});
	}
	get exitAppMessage() {
		const numFiles = editorManager.hasUnsavedFiles();
		if (numFiles) {
			return strings["unsaved files close app"];
		}
		return null;
	}
	setLoadingMessage(message) {
		document.body.setAttribute("data-small-msg", message);
	}
	setPluginInit(id, initFunction, settings) {
		this.#pluginsInit[id] = initFunction;
		if (!settings) return;
		appSettings.uiSettings[`plugin-${id}`] = settingsPage(
			id,
			settings.list,
			settings.cb,
			undefined,
			{
				preserveOrder: true,
				pageClassName: "detail-settings-page",
				listClassName: "detail-settings-list",
				valueInTail: true,
				groupByDefault: true,
			},
		);
	}
	setPluginUnmount(id, unmountFunction) {
		this.#pluginUnmount[id] = unmountFunction;
	}
	async initPlugin(id, baseUrl, $page, options) {
		if (id in this.#pluginsInit) {
			await this.#pluginsInit[id](baseUrl, $page, options);
		}
	}
	unmountPlugin(id) {
		if (id in this.#pluginUnmount) {
			try {
				this.#pluginUnmount[id]();
			} catch (err) {
				console.group(
					`Error while calling unmount callback for plugin "${id}"`,
				);
				console.error(err);
				console.groupEnd();
			}
			fsOperation(Url.join(CACHE_STORAGE, id)).delete();
		}
		delete appSettings.uiSettings[`plugin-${id}`];
	}
	registerFormatter(id, extensions, format, displayName) {
		let exts;
		if (Array.isArray(extensions)) {
			exts = extensions.filter(Boolean);
			if (!exts.length) exts = ["*"];
		} else if (typeof extensions === "string" && extensions) {
			exts = [extensions];
		} else {
			exts = ["*"];
		}
		this.#formatter.unshift({
			id,
			name: displayName,
			exts: exts,
			format,
		});
	}
	unregisterFormatter(id) {
		this.#formatter = this.#formatter.filter(
			(formatter) => formatter.id !== id,
		);
		const { formatter } = appSettings.value;
		for (const mode of Object.keys(formatter)) {
			if (formatter[mode] === id) {
				delete formatter[mode];
			}
		}
		appSettings.update(false);
	}
	async format(selectIfNull = true) {
		const file = editorManager.activeFile;
		if (!file || file.type !== "editor") return false;
		let resolvedMode = file.currentMode;
		if (!resolvedMode) {
			try {
				resolvedMode = getModeForPath(file.filename)?.name;
			} catch (_) {
				resolvedMode = null;
			}
		}
		const modeName = resolvedMode || "text";
		const formatterMap = appSettings.value.formatter || {};
		const formatterId = formatterMap[modeName];
		const formatter = this.#formatter.find(({ id }) => id === formatterId);
		if (!formatter) {
			if (formatterId) {
				delete formatterMap[modeName];
				await appSettings.update(false);
			}
			if (selectIfNull) {
				const { default: formatterSettings } = await import(
					"settings/formatterSettings"
				);
				formatterSettings(modeName);
				this.#afterSelectFormatter(modeName);
			} else {
				toast(strings["please select a formatter"]);
			}
			return false;
		}
		try {
			await formatter.format();
			return true;
		} catch (error) {
			helpers.error(error);
			return false;
		}
	}
	#afterSelectFormatter(name) {
		appSettings.on("update:formatter", format);
		function format() {
			appSettings.off("update:formatter", format);
			const id = appSettings.value.formatter[name];
			const formatter = this.#formatter.find(({ id: _id }) => _id === id);
			formatter?.format();
		}
	}
	fsOperation(file) {
		return fsOperation(file);
	}
	newEditorFile(filename, options) {
		new EditorFile(filename, options);
	}
	get formatters() {
		return this.#formatter.map(({ id, name, exts }) => ({
			id,
			name: name || id,
			exts,
		}));
	}
	getFormatterFor(extensions) {
		const options = [[null, strings.none]];
		for (const { id, name, exts } of this.formatters) {
			const supports = exts.some((ext) => extensions.includes(ext));
			if (supports || exts.includes("*")) {
				options.push([id, name]);
			}
		}
		return options;
	}
	alert(title, message, onhide) {
		alert(title, message, onhide);
	}
	loader(title, message, cancel) {
		return loader.create(title, message, cancel);
	}
	joinUrl(...args) {
		return Url.join(...args);
	}
	addIcon(className, src, options = {}) {
		let style = document.head.get(`style[icon="${className}"]`);
		if (!style) {
			let css;
			if (options.monochrome) {
				css = `.icon.${className}::before {
					content: '';
					display: inline-block;
					width: 24px;
					height: 24px;
					vertical-align: middle;
					-webkit-mask: url(${src}) no-repeat center / contain;
					mask: url(${src}) no-repeat center / contain;
					background-color: currentColor;
				}`;
			} else {
				css = `.icon.${className}{
					background: url(${src}) no-repeat center / 24px;
				}`;
			}
			style = <style icon={className}>{css}</style>;
			document.head.appendChild(style);
		}
	}
	async prompt(message, defaultValue, type, options) {
		const response = await prompt(message, defaultValue, type, options);
		return response;
	}
	async confirm(title, message) {
		const confirmation = await confirm(title, message);
		return confirmation;
	}
	async select(title, options, config) {
		const response = await select(title, options, config);
		return response;
	}
	async multiPrompt(title, inputs, help) {
		const values = await multiPrompt(title, inputs, help);
		return values;
	}
	async fileBrowser(mode, info, openLast) {
		const res = await FileBrowser(mode, info, openLast);
		return res;
	}
	async toInternalUrl(url) {
		const internalUrl = await helpers.toInternalUri(url);
		return internalUrl;
	}
	pushNotification(
		title,
		message,
		{ icon, action = null, type = "info" } = {},
	) {
		notificationManager.pushNotification({
			title,
			message,
			icon,
			action,
			type,
		});
	}
	registerFileHandler(id, options) {
		fileTypeHandler.registerFileHandler(id, options);
	}
	unregisterFileHandler(id) {
		fileTypeHandler.unregisterFileHandler(id);
	}
	addCommand(descriptor) {
		const command = registerExternalCommand(descriptor);
		this.#refreshCommandBindings();
		return command;
	}
	removeCommand(name) {
		if (!name) return;
		removeExternalCommand(name);
		this.#refreshCommandBindings();
	}
	execCommand(name, view, args) {
		if (!name) return false;
		const targetView = view || window.editorManager?.editor;
		return runCommand(name, targetView, args);
	}
	listCommands() {
		return listRegisteredCommands();
	}
	#refreshCommandBindings() {
		const view = window.editorManager?.editor;
		if (view) refreshCommandKeymap(view);
	}
	#createCommandApi() {
		const commandRegistry = {
			add: this.addCommand,
			execute: this.execCommand,
			remove: this.removeCommand,
			list: this.listCommands,
		};
		const addCommand = (descriptor) => {
			try {
				return this.addCommand(descriptor);
			} catch (error) {
				console.error("Failed to add command", descriptor?.name);
				throw error;
			}
		};
		const removeCommand = (name) => {
			if (!name) return;
			this.removeCommand(name);
		};
		return {
			addCommand,
			removeCommand,
			get registry() {
				return commandRegistry;
			},
		};
	}
}
const acode = new Acode();
export default acode;
