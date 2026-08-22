import settings from "./settings";

const pendingScans = new Map();
const scanIdsByRoot = new Map();
const listeners = new Set();
export function supports(url = "") {
	return (
		typeof sdcard !== "undefined" &&
		typeof sdcard.workspaceScan === "function" &&
		(/^file:/.test(url) || /^content:/.test(url))
	);
}
export function scan(root, options = {}) {
	const rootUrl = typeof root === "string" ? root : root?.url;
	const title =
		typeof root === "string"
			? options.title || options.name
			: root?.name || root?.title;
	if (!supports(rootUrl)) {
		return Promise.reject(
			new Error(`Native file index does not support: ${rootUrl}`),
		);
	}
	cancelRootScan(rootUrl);
	const id = `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	scanIdsByRoot.set(rootUrl, id);
	const promise = new Promise((resolve, reject) => {
		sdcard.workspaceScan(
			{
				id,
				rootUrl,
				title,
				excludeFolders: options.excludeFolders || settings.value.excludeFolders,
				showHiddenFiles:
					options.showHiddenFiles ??
					!!settings.value.fileBrowser?.showHiddenFiles,
				defaultEncoding:
					options.defaultEncoding || settings.value.defaultFileEncoding,
				indexContent: !!options.indexContent,
				emitEntries: false,
			},
			(event) => {
				emit(event);
				switch (event?.type || event?.action) {
					case "done":
						clearScanId(rootUrl, id);
						resolve(event);
						break;
					case "cancelled":
						clearScanId(rootUrl, id);
						resolve(event);
						break;
					case "error":
						clearScanId(rootUrl, id);
						reject(new Error(event.error || "Native scan failed"));
						break;
				}
			},
			(error) => {
				clearScanId(rootUrl, id);
				reject(normalizeError(error));
			},
		);
	});
	pendingScans.set(rootUrl, promise);
	const cleanup = () => {
		if (pendingScans.get(rootUrl) === promise) pendingScans.delete(rootUrl);
	};
	promise.then(cleanup, cleanup);
	promise.id = id;
	promise.cancel = () => cancel(id);
	return promise;
}
export function update(root, changes = {}) {
	const rootUrl = typeof root === "string" ? root : root?.url;
	const title =
		typeof root === "string" ? changes.title || changes.name : root?.title;
	if (!supports(rootUrl)) {
		return Promise.reject(
			new Error(`Native file index does not support: ${rootUrl}`),
		);
	}
	return callNative("workspaceUpdate", [
		{
			rootUrl,
			title,
			added: changes.added || [],
			removed: changes.removed || [],
			excludeFolders: changes.excludeFolders || settings.value.excludeFolders,
			showHiddenFiles:
				changes.showHiddenFiles ??
				!!settings.value.fileBrowser?.showHiddenFiles,
			defaultEncoding:
				changes.defaultEncoding || settings.value.defaultFileEncoding,
		},
	]);
}
export function query(options = {}) {
	if (
		typeof sdcard === "undefined" ||
		typeof sdcard.workspaceQuery !== "function"
	) {
		return Promise.reject(new Error("Native file index is unavailable"));
	}
	return new Promise((resolve, reject) => {
		sdcard.workspaceQuery(
			{
				roots: options.roots || [],
				text: options.text || "",
				url: options.url || "",
				includeDirectories: !!options.includeDirectories,
				limit: options.limit || 200,
				cursor: options.cursor || 0,
			},
			resolve,
			(error) => reject(normalizeError(error)),
		);
	});
}
export function search(options, onEvent = () => {}) {
	if (
		typeof sdcard === "undefined" ||
		typeof sdcard.workspaceSearch !== "function"
	) {
		const error = Promise.reject(new Error("Native file index is unavailable"));
		return {
			id: "",
			result: error,
			cancel: () => Promise.resolve(),
		};
	}
	const id =
		options?.id ||
		`search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const result = new Promise((resolve, reject) => {
		sdcard.workspaceSearch(
			{
				...options,
				id,
				roots: options?.roots || [],
				files: options?.files || [],
				overlays: options?.overlays || {},
				batchResults: options?.batchResults ?? true,
				defaultEncoding:
					options?.defaultEncoding || settings.value.defaultFileEncoding,
			},
			(event) => {
				onEvent(event);
				switch (event?.type || event?.action) {
					case "done-searching":
					case "done-replacing":
						resolve(event);
						break;
					case "error":
						reject(new Error(event.error || "Native search failed"));
						break;
				}
			},
			(error) => reject(normalizeError(error)),
		);
	});
	return {
		id,
		result,
		cancel: () => cancel(id),
	};
}
export async function get(url) {
	const { entries } = await query({
		url,
		includeDirectories: true,
		limit: 1,
	});
	return entries?.[0] || null;
}
export function markDirty(urls) {
	return callNative("workspaceMarkDirty", [urls || []]);
}
export function clear(roots = []) {
	roots.forEach(cancelRootScan);
	return callNative("workspaceClear", [roots]);
}
export function whenReady(roots) {
	const scans = roots?.length
		? roots.map((root) => pendingScans.get(root)).filter(Boolean)
		: [...pendingScans.values()];
	return Promise.allSettled(scans);
}
export function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
export function cancel(id) {
	if (!id) return Promise.resolve();
	return callNative("workspaceCancel", [id]);
}
function cancelRootScan(rootUrl) {
	const id = scanIdsByRoot.get(rootUrl);
	if (!id) return;
	clearScanId(rootUrl, id);
	try {
		sdcard.workspaceCancel(id);
	} catch (_) {}
}
function clearScanId(rootUrl, id) {
	if (scanIdsByRoot.get(rootUrl) === id) {
		scanIdsByRoot.delete(rootUrl);
	}
}
function emit(event) {
	listeners.forEach((listener) => listener(event));
}
function callNative(method, args) {
	if (typeof sdcard === "undefined" || typeof sdcard[method] !== "function") {
		return Promise.reject(new Error("Native file index is unavailable"));
	}
	return new Promise((resolve, reject) => {
		sdcard[method](...args, resolve, (error) => reject(normalizeError(error)));
	});
}
function normalizeError(error) {
	if (error instanceof Error) return error;
	return new Error(error?.message || String(error));
}
const fileIndex = {
	supports,
	scan,
	update,
	query,
	search,
	get,
	markDirty,
	clear,
	whenReady,
	subscribe,
	cancel,
};
export default fileIndex;
