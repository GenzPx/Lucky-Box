import fsOperation from "fileSystem";
import toast from "components/toast";
import picomatch from "picomatch/posix";
import Url from "utils/Url";
import fileIndex from "./fileIndex";
import { addedFolder } from "./openFolder";
import settings from "./settings";

const filesTree = {};
const pendingScans = new Set();
const events = {
	"add-file": [],
	"push-file": [],
	"remove-file": [],
	"add-folder": [],
	"remove-folder": [],
	refresh: [],
};
export function initFileList() {
	if (editorManager?.activeFile?.loading) {
		editorManager.activeFile.on("loadend", initFileList);
		return;
	}
	editorManager.on("remove-folder", onRemoveFolder);
	settings.on("update:excludeFolders:after", refresh);
}
export async function append(parent, child) {
	const nativeRoot = findNativeRoot(parent);
	if (nativeRoot) {
		fileIndex
			.update(nativeRoot, {
				added: [
					{
						url: child,
						parentUrl: parent,
					},
				],
			})
			.catch(logNativeIndexError);
		return;
	}
	const tree = getTree(Object.values(filesTree), parent);
	if (!tree || !tree.children) return;
	const childTree = await Tree.create(child);
	tree.children.push(childTree);
	trackScan(getAllFiles(childTree));
	emit("add-file", childTree);
}
export function remove(item) {
	const nativeRoot = findNativeRoot(item);
	if (nativeRoot) {
		if (nativeRoot.url === item) {
			fileIndex.clear([item]).then(
				() =>
					emit("remove-folder", {
						url: item,
						native: true,
					}),
				(error) => {
					logNativeIndexError(error);
					emit("remove-folder", {
						url: item,
						native: true,
					});
				},
			);
		} else {
			fileIndex
				.update(nativeRoot, {
					removed: [item],
				})
				.catch(logNativeIndexError);
		}
		return;
	}
	if (filesTree[item]) {
		removeRootTree(item);
		emit("remove-file", item);
		return;
	}
	const tree = getTree(Object.values(filesTree), item);
	if (!tree) return;
	const { parent } = tree;
	const index = parent.children.indexOf(tree);
	parent.children.splice(index, 1);
	emit("remove-file", tree);
}
function removeRootTree(url) {
	const rootUrl = url.endsWith("/") ? url : `${url}/`;
	Object.keys(filesTree).forEach((key) => {
		if (key === url || key.startsWith(rootUrl)) {
			delete filesTree[key];
		}
	});
}
export async function refresh() {
	Object.keys(filesTree).forEach((key) => {
		delete filesTree[key];
	});
	await Promise.all(
		addedFolder
			.filter(({ listFiles }) => listFiles)
			.map(async ({ url, title }) => {
				if (fileIndex.supports(url)) {
					await fileIndex.scan({
						url,
						name: title,
					});
					return;
				}
				const tree = await Tree.createRoot(url, title);
				filesTree[url] = tree;
				trackScan(getAllFiles(tree));
			}),
	);
	emit("refresh", filesTree);
}
export async function whenReady() {
	await Promise.allSettled([...pendingScans, fileIndex.whenReady()]);
}
export function rename(oldUrl, newUrl) {
	const nativeRoot = findNativeRoot(oldUrl) || findNativeRoot(newUrl);
	if (nativeRoot) {
		fileIndex
			.update(nativeRoot, {
				removed: [oldUrl],
				added: [
					{
						url: newUrl,
						parentUrl: Url.dirname(newUrl),
					},
				],
			})
			.catch(logNativeIndexError);
		return;
	}
	const tree = getTree(Object.values(filesTree), oldUrl);
	if (!tree) return;
	tree.update(newUrl);
}
export default function files(dir) {
	const listedDirs = [];
	let transform = (item) => item;
	if (typeof dir === "string") {
		for (const item of Object.values(filesTree)) {
			const found = getFile(dir, item);
			if (found) return found;
		}
		return null;
	} else if (typeof dir === "function") {
		transform = dir;
	}
	const allFiles = [];
	Object.values(filesTree).forEach((item) => {
		allFiles.push(...flattenTree(item, transform, listedDirs));
	});
	return allFiles;
}
files.on = function (event, callback) {
	if (!events[event]) events[event] = [];
	events[event].push(callback);
};
files.off = function (event, callback) {
	if (!events[event]) return;
	events[event] = events[event].filter((cb) => cb !== callback);
};
function getTree(treeList, dir) {
	if (!treeList) return;
	let tree = treeList.find(({ url }) => url === dir);
	if (tree) return tree;
	for (const item of treeList) {
		tree = getTree(item.children, dir);
		if (tree) return tree;
	}
	return null;
}
function getFile(path, tree) {
	const { children } = tree;
	let { url } = tree;
	if (url === path) return tree;
	if (!children) return null;
	const len = children.length;
	for (let i = 0; i < len; i++) {
		const item = children[i];
		const result = getFile(path, item);
		if (result) return result;
	}
	return null;
}
function flattenTree(tree, transform, listedDirs) {
	const list = [];
	const { children } = tree;
	if (!children) {
		return [transform(tree)];
	}
	if (listedDirs.includes(tree.url)) return list;
	listedDirs.push(tree.url);
	children.forEach((item) => {
		if (item.children) list.push(...flattenTree(item, transform, listedDirs));
		else list.push(transform(item));
	});
	return list;
}
export async function addRoot({ url, name }) {
	try {
		const TERMUX_STORAGE =
			"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome::/data/data/com.termux/files/home/storage";
		const TERMUX_SHARED =
			"content://com.termux.documents/tree/%2Fdata%2Fdata%2Fcom.termux%2Ffiles%2Fhome::/data/data/com.termux/files/home/storage/shared";
		if (url === TERMUX_STORAGE) return;
		if (url === TERMUX_SHARED) return;
		if (fileIndex.supports(url)) {
			await fileIndex.scan({
				url,
				name,
			});
			emit("add-folder", {
				url,
				name,
				native: true,
			});
			return;
		}
		const tree = await Tree.createRoot(url, name);
		filesTree[url] = tree;
		trackScan(
			getAllFiles(tree, null, {
				indexContent: false,
			}),
		);
		emit("add-folder", tree);
	} catch (error) {
		window.log("error", error);
	}
}
function onRemoveFolder({ url }) {
	const tree = filesTree[url];
	if (!tree) return;
	removeRootTree(url);
	emit("remove-folder", tree);
}
async function getAllFiles(parent, root, options = {}) {
	root = root || parent.root;
	if (!parent.children || !root.isConnected) return;
	try {
		const entries = await fsOperation(parent.url).lsDir();
		const promises = [];
		for (const item of entries) {
			promises.push(createChildTree(parent, item, root));
		}
		await Promise.all(promises);
	} catch (error) {
		parent.retriedCount += 1;
		if (parent.retriedCount > settings.value.maxRetryCount) return;
		if (settings.value.showRetryToast) {
			toast(`retrying: ${parent.path}`);
		}
		setTimeout(() => {
			if (!root.isConnected) return;
			parent.children.length = 0;
			getAllFiles(parent, root, options);
		}, 3000);
	}
}
function emit(event, ...args) {
	const list = events[event];
	if (!list) return;
	list.forEach((fn) => fn(...args));
}
function trackScan(scan) {
	pendingScans.add(scan);
	const cleanup = () => pendingScans.delete(scan);
	scan.then(cleanup, cleanup);
	return scan;
}
async function createChildTree(parent, item, root) {
	if (!root.isConnected) return;
	const { name, url, isDirectory, mime, type, size, modifiedDate } = item;
	const exists = parent.children.findIndex((child) => child.url === url);
	if (exists > -1) {
		return;
	}
	const file = await Tree.create(
		url,
		name,
		isDirectory,
		mime || type,
		size,
		modifiedDate,
	);
	if (!root.isConnected) return;
	const existingTree = getTree(Object.values(filesTree), file.url);
	if (existingTree) {
		file.children = existingTree.children;
		parent.children.push(file);
		return;
	}
	parent.children.push(file);
	if (isDirectory) {
		const ignore = picomatch.isMatch(
			Url.join(file.path, ""),
			settings.value.excludeFolders,
			{
				matchBase: true,
			},
		);
		if (ignore) return;
		await getAllFiles(file, root);
		return;
	}
	emit("push-file", file);
	emit("add-file", file);
}
export class Tree {
	#name;
	#url;
	#path;
	#children;
	#parent;
	retriedCount = 0;
	constructor(name, url, isDirectory, mime, size, modifiedDate) {
		this.#name = name;
		this.#url = url;
		this.mime = mime || null;
		this.size = size || 0;
		this.modifiedDate = normalizeModifiedDate(modifiedDate);
		this.#children = isDirectory ? this.#childrenArray() : null;
		this.#parent = null;
	}
	#childrenArray() {
		const ar = [];
		const oldPush = ar.push;
		ar.push = (...args) => {
			args.forEach((item) => {
				if (!(item instanceof Tree)) throw new Error("Invalid tree");
				item.parent = this;
				oldPush.call(ar, item);
			});
		};
		return ar;
	}
	static async create(url, name, isDirectory, mime, size, modifiedDate) {
		if (!name && !isDirectory) {
			const stat = await fsOperation(url).stat();
			name = stat.name;
			isDirectory = stat.isDirectory;
			mime = stat.mime || stat.type;
			size = stat.size;
			modifiedDate = stat.modifiedDate;
		}
		return new Tree(name, url, isDirectory, mime, size, modifiedDate);
	}
	static async createRoot(url, name) {
		const tree = await Tree.create(url, name, true);
		tree.#path = name;
		return tree;
	}
	get name() {
		return this.#name;
	}
	get url() {
		return this.#url;
	}
	get path() {
		return this.#path;
	}
	get children() {
		return this.#children;
	}
	set children(value) {
		if (!Array.isArray(value)) throw new Error("Invalid children");
		this.#children = value;
	}
	get parent() {
		return this.#parent;
	}
	set parent(value) {
		if (!(value instanceof Tree)) throw new Error("Invalid parent");
		this.#parent = value;
		if (this.#parent) {
			this.#path = Url.join(this.#parent.path, this.#name);
		}
	}
	get isConnected() {
		const root = this.root;
		return !!addedFolder.find(({ url }) => url === root.url);
	}
	get root() {
		let root = this;
		while (root.parent) {
			root = root.parent;
		}
		return root;
	}
	update(url, name) {
		if (!name) name = Url.basename(url);
		this.#url = url;
		this.#name = name;
		this.#path = Url.join(this.#parent.path, name);
		trackScan(getAllFiles(this));
	}
	toJSON() {
		return {
			name: this.#name,
			url: this.#url,
			path: this.#path,
			parent: this.#parent?.url,
			mime: this.mime,
			size: this.size,
			modifiedDate: this.modifiedDate,
			isDirectory: !!this.#children,
		};
	}
	static fromJSON(json) {
		const { name, url, path, parent, mime, size, modifiedDate, isDirectory } =
			json;
		const tree = new Tree(name, url, isDirectory, mime, size, modifiedDate);
		tree.#parent = getTree(Object.values(filesTree), parent);
		tree.#path = path;
		return tree;
	}
}
function normalizeModifiedDate(value) {
	if (!value) return 0;
	if (typeof value === "number") return value;
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? 0 : time;
}
function findNativeRoot(url) {
	if (!url) return null;
	return addedFolder.find(({ url: rootUrl, listFiles }) => {
		if (!listFiles) return false;
		if (!fileIndex.supports(rootUrl)) return false;
		const prefix = rootUrl.endsWith("/") ? rootUrl : `${rootUrl}/`;
		return (
			url === rootUrl ||
			url.startsWith(prefix) ||
			url.startsWith(`${rootUrl}::`)
		);
	});
}
function logNativeIndexError(error) {
	console.error("Native workspace index update failed:", error);
}
