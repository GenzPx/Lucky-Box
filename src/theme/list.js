import fonts from "lib/fonts";
import settings from "lib/settings";
import { isDeviceDarkTheme } from "lib/systemConfiguration";
import { updateActiveTerminals } from "settings/terminalSettings";
import color from "utils/color";
import ThemeBuilder from "./builder";
import themes, { updateSystemTheme } from "./preInstalled";

const appThemes = new Map();
let themeApplied = false;
let firstTime = true;
const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
let systemThemeWatcherActive = false;
function init() {
	themes.forEach((theme) => add(theme));
	updateSystemThemeWatcher(settings.value.appTheme);
	settings.on("update:appTheme", updateSystemThemeWatcher);
}
function list() {
	return Array.from(appThemes.keys()).map((name) => {
		const { id, type, primaryColor, version } = appThemes.get(name);
		return {
			id,
			type,
			version,
			primaryColor,
			name: name.capitalize(),
		};
	});
}
function get(name) {
	return appThemes.get(name.toLowerCase());
}
function add(theme) {
	if (!(theme instanceof ThemeBuilder)) return;
	if (appThemes.has(theme.id)) return;
	appThemes.set(theme.id, theme);
	const { appTheme } = settings.value;
	if (theme.matches(appTheme)) {
		if (appTheme !== "system") {
			apply(appTheme);
		} else {
			updateSystemTheme(isDeviceDarkTheme());
			themeApplied = true;
		}
	}
}
export async function apply(id, init) {
	if (!DOES_SUPPORT_THEME) {
		id = "default";
	}
	themeApplied = true;
	const theme = get(id);
	const $style = document.head.get("style#app-theme") ?? (
		<style id="app-theme"></style>
	);
	const update = {
		appTheme: id,
	};
	if (id === "custom") {
		update.customTheme = theme.toJSON();
	}
	if (init && theme.preferredEditorTheme) {
		update.editorTheme = theme.preferredEditorTheme;
		if (editorManager != null && editorManager.editor != null) {
			editorManager.editor.setTheme(theme.preferredEditorTheme);
		}
	}
	if (init && theme.preferredFont) {
		update.editorFont = theme.preferredFont;
		fonts.setFont(theme.preferredFont);
	}
	if (init && firstTime && theme.preferredTerminalTheme) {
		update.terminalSettings = {
			...(settings.value.terminalSettings || {}),
			theme: theme.preferredTerminalTheme,
		};
	}
	settings.update(update, false);
	if (init && firstTime && theme.preferredTerminalTheme) {
		if (editorManager != null) {
			updateActiveTerminals("theme", theme.preferredTerminalTheme);
		}
	}
	localStorage.__primary_color = theme.primaryColor;
	document.body.setAttribute("theme-type", theme.type);
	$style.textContent = theme.css;
	document.head.append($style);
	const primaryColor = color(theme.primaryColor).hex.toString();
	const scheme = theme.toJSON("hex");
	system.setUiTheme(primaryColor, scheme);
	if (firstTime) {
		setTimeout(() => {
			system.setUiTheme(primaryColor, scheme);
		}, 1000);
		firstTime = false;
	}
}
export function update(theme) {
	if (!(theme instanceof ThemeBuilder)) return;
	const oldTheme = get(theme.id);
	if (!oldTheme) {
		add(theme);
		return;
	}
	const json = theme.toJSON();
	Object.keys(json).forEach((key) => {
		oldTheme[key] = json[key];
	});
}
function syncSystemTheme(event) {
	if (settings.value.appTheme.toLowerCase() !== "system") return;
	const isDark = event ? event.matches : darkModeMediaQuery.matches;
	updateSystemTheme(isDark);
}
function startSystemThemeWatcher() {
	if (systemThemeWatcherActive) return;
	systemThemeWatcherActive = true;
	if (typeof darkModeMediaQuery.addEventListener === "function") {
		darkModeMediaQuery.addEventListener("change", syncSystemTheme);
	} else {
		darkModeMediaQuery.addListener(syncSystemTheme);
	}
}
function stopSystemThemeWatcher() {
	if (!systemThemeWatcherActive) return;
	systemThemeWatcherActive = false;
	if (typeof darkModeMediaQuery.removeEventListener === "function") {
		darkModeMediaQuery.removeEventListener("change", syncSystemTheme);
	} else {
		darkModeMediaQuery.removeListener(syncSystemTheme);
	}
}
export function updateSystemThemeWatcher(theme) {
	if (String(theme).toLowerCase() === "system") {
		startSystemThemeWatcher();
		syncSystemTheme();
		return;
	}
	stopSystemThemeWatcher();
}
export default {
	get applied() {
		return themeApplied;
	},
	init,
	list,
	get,
	add,
	apply,
	update,
	updateSystemThemeWatcher,
};
