import confirm from "dialogs/confirm";
import appSettings from "lib/settings";

const stack = [];
let mark = null;
let onCloseAppCallback;
let freeze = false;
export default {
	get length() {
		return stack.length;
	},
	get onCloseApp() {
		return onCloseAppCallback;
	},
	set onCloseApp(cb) {
		onCloseAppCallback = cb;
	},
	windowCopy() {
		const copyStack = {
			...this,
		};
		delete copyStack.windowCopy;
		copyStack.pop = (repeat) => {
			window.log(
				"error",
				"Deprecated: `window.actionStack` is deprecated, import `actionStack` instead",
			);
			this.pop(repeat);
		};
		return copyStack;
	},
	push(fun) {
		stack.push(fun);
	},
	async pop(repeat) {
		if (freeze) return;
		let confirmation = true;
		if (typeof repeat === "number" && repeat > 1) {
			for (let i = 0; i < repeat; ++i) {
				this.pop();
			}
			return;
		}
		const fun = stack.pop();
		if (fun) {
			fun.action();
			return;
		}
		if (appSettings.value.confirmOnExit) {
			let closeMessage =
				acode.exitAppMessage || strings["close app"].capitalize(0);
			confirmation = await confirm(strings.warning.toUpperCase(), closeMessage);
		}
		if (confirmation) {
			const { exitApp } = navigator.app;
			if (typeof onCloseAppCallback === "function") {
				const res = onCloseAppCallback();
				if (res instanceof Promise) {
					res.finally(exitApp);
					return;
				}
			}
			exitApp();
		}
	},
	get(id) {
		return stack.find((act) => act.id === id);
	},
	remove(id) {
		for (let i = 0; i < stack.length; ++i) {
			let action = stack[i];
			if (action.id === id) {
				stack.splice(i, 1);
				return true;
			}
		}
		return false;
	},
	has(id) {
		for (let act of stack) if (act.id === id) return true;
		return false;
	},
	setMark() {
		mark = stack.length;
	},
	clearFromMark() {
		if (mark === null) return;
		stack.splice(mark);
		mark = null;
	},
	freeze() {
		freeze = true;
	},
	unfreeze() {
		freeze = false;
	},
};
