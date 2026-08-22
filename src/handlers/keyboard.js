import { setBannerKeyboardVisible } from "lib/startAd";
import {
	getSystemConfiguration,
	HARDKEYBOARDHIDDEN_NO,
} from "lib/systemConfiguration";
import KeyboardEvent from "utils/keyboardEvent";
import windowResize from "./windowResize";

let MIN_KEYBOARD_HEIGHT = 100;
const event = {
	key: [],
	keyboardShow: [],
	keyboardHide: [],
	keyboardShowStart: [],
	keyboardHideStart: [],
};
let escKey = false;
let escResetTimeout = null;
let softKeyboardHeight = 0;
let windowHeight = window.innerHeight;
let currentWindowHeight = windowHeight;
export const keydownState = {
	get esc() {
		return escKey;
	},
	set esc(val) {
		escKey = val;
		if (!val) return;
		clearTimeout(escResetTimeout);
		escResetTimeout = setTimeout(() => {
			escKey = false;
		}, 500);
	},
};
export default function keyboardHandler(e) {
	const $target = e.target;
	const { key, ctrlKey, shiftKey, altKey, metaKey } = e;
	if (shouldIgnoreEditorShortcutTarget($target)) {
		keydownState.esc = key === "Escape";
		return;
	}
	if (!ctrlKey && !shiftKey && !altKey && !metaKey) return;
	if (["Control", "Alt", "Meta", "Shift"].includes(key)) return;
	const target = editorManager?.editor?.contentDOM;
	if (!target) return;
	if ($target === target || (target.contains?.($target) ?? false)) return;
	const event = KeyboardEvent("keydown", {
		key,
		ctrlKey,
		shiftKey,
		altKey,
		metaKey,
	});
	target?.dispatchEvent?.(event);
}
function shouldIgnoreEditorShortcutTarget(target) {
	if (!(target instanceof Element)) return false;
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		target.isContentEditable ||
		!!target.closest(".prompt, #palette")
	);
}
document.addEventListener("deviceready", () => {
	document.addEventListener("admob.banner.size", async (event) => {
		const { height } = event.size;
		MIN_KEYBOARD_HEIGHT = height + 10;
	});
	windowResize.on("resizeStart", async () => {
		const { keyboardHeight, hardKeyboardHidden } =
			await getSystemConfiguration();
		const externalKeyboard = hardKeyboardHidden === HARDKEYBOARDHIDDEN_NO;
		if (currentWindowHeight > window.innerHeight) {
			softKeyboardHeight =
				keyboardHeight > MIN_KEYBOARD_HEIGHT ? keyboardHeight : 0;
			if (!externalKeyboard && softKeyboardHeight) {
				toggleBannerAd(false);
				emit("keyboardShowStart");
			}
		} else if (currentWindowHeight < window.innerHeight) {
			if (!externalKeyboard && softKeyboardHeight) {
				toggleBannerAd(true);
				emit("keyboardHideStart");
			}
		}
		currentWindowHeight = window.innerHeight;
	});
	windowResize.on("resize", async () => {
		currentWindowHeight = window.innerHeight;
		if (currentWindowHeight > windowHeight) {
			windowHeight = currentWindowHeight;
		}
		const { hardKeyboardHidden } = await getSystemConfiguration();
		const externalKeyboard = hardKeyboardHidden === HARDKEYBOARDHIDDEN_NO;
		if (externalKeyboard || !softKeyboardHeight) return;
		const keyboardHiddenYes = windowHeight <= window.innerHeight;
		if (keyboardHiddenYes) {
			emit("keyboardHide");
		} else {
			emit("keyboardShow");
		}
		focusBlurEditor(keyboardHiddenYes);
	});
});
keyboardHandler.on = (eventName, callback) => {
	if (!event[eventName]) return;
	event[eventName].push(callback);
};
keyboardHandler.off = (eventName, callback) => {
	if (!event[eventName]) return;
	event[eventName] = event[eventName].filter((cb) => cb !== callback);
};
function emit(eventName) {
	if (!event[eventName]) return;
	event[eventName].forEach((cb) => cb());
}
function focusBlurEditor(keyboardHidden) {
	if (!keyboardHidden) return;
	const activeElement = document.activeElement;
	const editorContent = window.editorManager?.editor?.contentDOM;
	if (
		editorContent &&
		(activeElement === editorContent || editorContent.contains(activeElement))
	) {
		return;
	}
	activeElement?.blur();
}
function toggleBannerAd(keyboardHidden) {
	setBannerKeyboardVisible(!keyboardHidden);
}
