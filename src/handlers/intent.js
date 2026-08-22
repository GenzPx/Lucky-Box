import fsOperation from "fileSystem";
import openFile from "lib/openFile";
import helpers from "utils/helpers";

const handlers = [];
const pendingIntents = [];
export default async function HandleIntent(intent = {}) {
	const type = intent.action.split(".").slice(-1)[0];
	if (["SEND", "VIEW", "EDIT"].includes(type)) {
		const url = intent.fileUri || intent.data;
		if (!url) return;
		if (url.startsWith("luckybox://")) {
			const path = url.replace("luckybox://", "");
			const [module, action, value] = path.split("/");
			if (module === "auth" && action === "callback") {
				return;
			}
			let defaultPrevented = false;
			const event = new IntentEvent(module, action, value);
			for (const handler of handlers) {
				handler(event);
				if (event.defaultPrevented) defaultPrevented = true;
				if (event.propagationStopped) break;
			}
			if (defaultPrevented) return;
			if (module === "plugin" && action === "install") {
				const { default: Plugin } = await import("pages/plugin");
				if (!value || !/^([a-z0-9\.]+)$/.test(value)) {
					return;
				}
				const installed = await fsOperation(PLUGIN_DIR, value).exists();
				Plugin({
					id: value,
					installed,
					install: action === "install",
				});
			}
			return;
		}
		if (sessionStorage.getItem("isfilesRestored") === "true") {
			await openFile(url, {
				mode: "single",
				render: true,
			});
		} else {
			pendingIntents.push({
				url,
				options: {
					mode: "single",
					render: true,
				},
			});
		}
	}
}
HandleIntent.onError = (error) => {
	helpers.error(error);
};
export function addIntentHandler(handler) {
	handlers.push(handler);
}
export function removeIntentHandler(handler) {
	const index = handlers.indexOf(handler);
	if (index > -1) handlers.splice(index, 1);
}
export async function processPendingIntents() {
	if (sessionStorage.getItem("isfilesRestored") !== "true") return;
	while (pendingIntents.length > 0) {
		const pendingIntent = pendingIntents.shift();
		try {
			await openFile(pendingIntent.url, pendingIntent.options);
		} catch (error) {
			helpers.error(error);
		}
	}
}
class IntentEvent {
	module;
	action;
	value;
	#defaultPrevented = false;
	#propagationStopped = false;
	constructor(module, action, value) {
		this.module = module;
		this.action = action;
		this.value = value;
	}
	preventDefault() {
		this.#defaultPrevented = true;
	}
	stopPropagation() {
		this.#propagationStopped = true;
	}
	get defaultPrevented() {
		return this.#defaultPrevented;
	}
	get propagationStopped() {
		return this.#propagationStopped;
	}
}
