import fsOperation from "fileSystem";
import sidebarApps from "sidebarApps";
import collapsableList from "components/collapsableList";
import FileTree from "components/fileTree";
import Sidebar from "components/sidebar";
import tile from "components/tile";
import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import escapeStringRegexp from "escape-string-regexp";
import copyEntry from "utils/copyEntry";
import helpers from "utils/helpers";
import Path from "utils/Path";
import Uri from "utils/Uri";
import Url from "utils/Url";
import config from "./config";
import * as FileList from "./fileList";
import { loadFileBrowser } from "./lazyImports";
import openFile from "./openFile";
import recents from "./recents";
import appSettings from "./settings";

const isTermuxSafUri = (value = "") =>
	value.startsWith("content://com.termux.documents/tree/");
const isAcodeTerminalPublicSafUri = (value = "") =>
	value.startsWith("content://com.foxdebug.acode.documents/tree/");
const isTerminalSafUri = (value = "") =>
	isTermuxSafUri(value) || isAcodeTerminalPublicSafUri(value);
export const addedFolder = [];
const ACODE_PLUGIN_MANIFEST_FILE = "plugin.json";
function openFolder(_path, opts = {}) {
	if (addedFolder.find((folder) => folder.url === _path)) {
		return;
	}
	const saveState = opts.saveState ?? true;
	const listState = opts.listState || {};
	const title = opts.name;
	let listFiles = opts.listFiles;
	if (!title) {
		throw new Error("Folder name is required");
	}
	const $root = collapsableList(title, "folder", {
		allCaps: true,
		ontoggle: () => expandList($root),
	});
	const $text = $root.$title.get(":scope>span.text");
	$root.id = "r" + _path.hashCode();
	$text.style.overflow = "hidden";
	$text.style.whiteSpace = "nowrap";
	$text.style.textOverflow = "ellipsis";
	$root.$title.dataset.type = "root";
	$root.$title.dataset.url = _path;
	$root.$title.dataset.name = title;
	$root.$ul.onclick =
		$root.$ul.oncontextmenu =
		$root.$title.onclick =
		$root.$title.oncontextmenu =
			handleItems;
	recents.addFolder(_path, opts);
	sidebarApps.get("files").append($root);
	const event = {
		url: _path,
		name: title,
	};
	const folder = {
		title,
		remove,
		listFiles,
		saveState,
		listState,
		url: _path,
		$node: $root,
		id: opts.id,
		clipBoard: {},
		reload() {
			$root.collapse();
			$root.expand();
		},
	};
	if (typeof listFiles !== "boolean") {
		listFiles = appSettings.value.fileBrowser?.listFiles ?? true;
	}
	folder.listFiles = listFiles;
	addedFolder.push(folder);
	editorManager.emit("update", "add-folder");
	editorManager.onupdate("add-folder", event);
	editorManager.emit("add-folder", event);
	if (listFiles) {
		FileList.addRoot({
			url: _path,
			name: title,
		}).catch((err) => {
			console.error("Failed to add root to FileList:", err);
		});
	}
	if (listState[_path]) {
		$root.expand();
	}
	function remove(e) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
		if ($root.parentElement) {
			$root.remove();
		}
		FileList.remove(_path);
		const index = addedFolder.findIndex((folder) => folder.url === _path);
		if (index !== -1) addedFolder.splice(index, 1);
		editorManager.emit("update", "remove-folder");
		editorManager.onupdate("remove-folder", event);
		editorManager.emit("remove-folder", event);
	}
}
async function expandList($list) {
	const { $ul, $title } = $list;
	const { url } = $title.dataset;
	const { saveState, listState, $node } = openFolder.find(url);
	const startLoading = () => $node.$title.classList.add("loading");
	const stopLoading = () => $node.$title.classList.remove("loading");
	if (!$ul) return;
	if ($ul._fileTree) {
		$ul._fileTree.destroy();
		$ul._fileTree = null;
	}
	$ul.innerHTML = "";
	if (saveState) listState[url] = $list.unclasped;
	if (!$list.unclasped) return;
	try {
		startLoading();
		const fileTree = new FileTree($ul, {
			getEntries: (dirUrl) => fsOperation(dirUrl).lsDir(),
			expandedState: listState,
			onExpandedChange: (folderUrl, isExpanded) => {
				if (saveState) listState[folderUrl] = isExpanded;
			},
			onFileClick: (fileUrl) => {
				handleClick("file", fileUrl);
			},
			onContextMenu: (type, itemUrl, name, $target) => {
				handleContextmenu(type, itemUrl, name, $target);
			},
		});
		await fileTree.load(url);
		$ul._fileTree = fileTree;
	} catch (err) {
		$list.collapse();
		if (err?.includes?.("Invalid message length")) {
			console.error(err);
			toast("SFTP connection broken. Restart the app");
			return;
		}
		helpers.error(err);
	} finally {
		stopLoading();
	}
}
function handleItems(e) {
	const mode = e.type;
	const $target = e.target;
	if (!($target instanceof HTMLElement)) return;
	const type = $target.dataset.type;
	if (!type) return;
	const url = $target.dataset.url;
	const name = $target.dataset.name;
	if (mode === "click") {
		handleClick(type, url, name, $target);
	} else if (mode === "contextmenu") {
		handleContextmenu(type, url, name, $target);
	}
}
async function handleContextmenu(type, url, name, $target) {
	if (appSettings.value.vibrateOnTap) {
		navigator.vibrate(config.VIBRATION_TIME);
	}
	const { clipBoard, $node } = openFolder.find(url);
	const cancel = `${strings.cancel}${clipBoard ? ` (${strings[clipBoard.action]})` : ""}`;
	const COPY = ["copy", strings.copy, "copy"];
	const CUT = ["cut", strings.cut, "cut"];
	const COPY_RELATIVE_PATH = [
		"copy-relative-path",
		strings["copy relative path"],
		"attach_file",
	];
	const REMOVE = ["delete", strings.delete, "delete"];
	const RENAME = ["rename", strings.rename, "edit"];
	const PASTE = ["paste", strings.paste, "paste", !!clipBoard];
	const NEW_FILE = ["new file", strings["new file"], "document-add"];
	const NEW_FOLDER = ["new folder", strings["new folder"], "folder-add"];
	const CANCEL = ["cancel", cancel, "clearclose"];
	const OPEN_FOLDER = ["open-folder", strings["open folder"], "folder"];
	const INSERT_FILE = ["insert-file", strings["insert file"], "file_copy"];
	const CLOSE_FOLDER = ["close", strings["close"], "folder-remove"];
	const INSTALL_PLUGIN = [
		"install-plugin",
		strings["install as plugin"] || "Install as Plugin",
		"extension",
	];
	let options;
	if (helpers.isFile(type)) {
		options = [COPY, CUT, COPY_RELATIVE_PATH, RENAME, REMOVE];
		if (
			url.toLowerCase().endsWith(".zip") &&
			(await fsOperation(
				Url.dirname(url) + ACODE_PLUGIN_MANIFEST_FILE,
			).exists())
		) {
			options.push(INSTALL_PLUGIN);
		}
	} else if (helpers.isDir(type)) {
		options = [COPY, CUT, COPY_RELATIVE_PATH, REMOVE, RENAME];
		if (clipBoard.url != null) {
			options.push(PASTE);
		}
		options.push(NEW_FILE, NEW_FOLDER, OPEN_FOLDER, INSERT_FILE);
	} else if (type === "root") {
		options = [];
		if (clipBoard.url != null) {
			options.push(PASTE);
		}
		options.push(NEW_FILE, NEW_FOLDER, INSERT_FILE);
		options.push(CLOSE_FOLDER);
	}
	if (clipBoard.action) options.push(CANCEL);
	try {
		const option = await select(name, options);
		await execOperation(type, option, url, $target, name);
	} catch (error) {
		console.error(error);
		helpers.error(error);
	} finally {
		$node.$title.classList.remove("loading");
	}
}
function execOperation(type, action, url, $target, name) {
	const { clipBoard, $node, remove, url: rootUrl } = openFolder.find(url);
	const startLoading = () => $node.$title.classList.add("loading");
	const stopLoading = () => $node.$title.classList.remove("loading");
	switch (action) {
		case "copy":
		case "cut":
			return clipBoardAction();
		case "delete":
			return deleteFile();
		case "rename":
			return renameFile();
		case "paste":
			return paste();
		case "new file":
		case "new folder":
			return createNew();
		case "cancel":
			return cancelAction();
		case "open-folder":
			return open();
		case "insert-file":
			return insertFile();
		case "close":
			return remove();
		case "install-plugin":
			return installPlugin();
		case "copy-relative-path":
			return copyRelativePath();
	}
	async function installPlugin() {
		try {
			const manifest = JSON.parse(
				await fsOperation(
					Url.dirname(url) + ACODE_PLUGIN_MANIFEST_FILE,
				).readFile("utf8"),
			);
			const { default: installPlugin } = await import("lib/installPlugin");
			await installPlugin(url, manifest.name);
			toast(strings["success"], 3000);
		} catch (error) {
			helpers.error(error);
			console.error(error);
		}
	}
	async function copyRelativePath() {
		try {
			if (!url) {
				console.error("File path not available");
				return;
			}
			if (!rootUrl) {
				console.error("Root folder not found");
				return;
			}
			let relativePath;
			const rootPath = Url.pathname(rootUrl);
			const targetPath = Url.pathname(url);
			if (rootPath && targetPath) {
				relativePath = Path.convertToRelative(rootPath, targetPath);
			} else {
				const cleanRoot = rootUrl.endsWith("/")
					? rootUrl.slice(0, -1)
					: rootUrl;
				const cleanTarget = url.endsWith("/") ? url.slice(0, -1) : url;
				if (cleanTarget.startsWith(cleanRoot)) {
					relativePath = cleanTarget.slice(cleanRoot.length + 1);
				} else {
					relativePath = Url.basename(url);
				}
			}
			if (!relativePath) {
				console.error("Unable to calculate relative path");
				return;
			}
			if (cordova.plugins.clipboard) {
				cordova.plugins.clipboard.copy(relativePath);
			} else {
				console.error("Clipboard not available");
				toast("Clipboard not available");
			}
		} catch (error) {
			console.error("Failed to copy relative path:", error);
		}
	}
	async function deleteFile() {
		const msg = strings["delete entry"].replace("{name}", name);
		const confirmation = await confirm(strings.warning, msg);
		if (!confirmation) return;
		startLoading();
		if (!(await fsOperation(url).exists())) return;
		recents.removeFile(url);
		if (helpers.isFile(type)) {
			await fsOperation(url).delete();
			removeEntryFromOpenFolder(url);
			const file = editorManager.getFile(url, "uri");
			if (file) file.uri = null;
			editorManager.onupdate("delete-file");
			editorManager.emit("update", "delete-file");
		} else {
			if (isTerminalSafUri(url)) {
				const fs = fsOperation(url);
				const entries = await fs.lsDir();
				if (entries.length === 0) {
					await fs.delete();
				} else {
					const deleteRecursively = async (currentUrl) => {
						const currentFs = fsOperation(currentUrl);
						const currentEntries = await currentFs.lsDir();
						for (const entry of currentEntries) {
							if (entry.isDirectory) {
								await deleteRecursively(entry.url);
							} else {
								await fsOperation(entry.url).delete();
							}
						}
						await currentFs.delete();
					};
					await deleteRecursively(url);
				}
			} else {
				await fsOperation(url).delete();
			}
			recents.removeFolder(url);
			helpers.updateUriOfAllActiveFiles(url, null);
			removeEntryFromOpenFolder(url);
			editorManager.onupdate("delete-folder");
			editorManager.emit("update", "delete-folder");
		}
		toast(strings.success);
		FileList.remove(url);
	}
	async function renameFile() {
		if (isTermuxSafUri(url) && !helpers.isFile(type)) {
			alert(strings.warning, strings["rename not supported"]);
			return;
		}
		let newName = await prompt(strings.rename, name, "text", {
			match: config.FILE_NAME_REGEX,
			required: true,
		});
		newName = helpers.fixFilename(newName);
		if (!newName || newName === name) return;
		startLoading();
		const fs = fsOperation(url);
		let newUrl;
		if (isTermuxSafUri(url) && helpers.isFile(type)) {
			const newFilePath = Url.join(Url.dirname(url), newName);
			const content = await fs.readFile();
			await fsOperation(Url.dirname(url)).createFile(newName, content);
			await fs.delete();
			newUrl = newFilePath;
		} else {
			newUrl = await fs.renameTo(newName);
		}
		newName = Url.basename(newUrl);
		if (helpers.isFile(type)) {
			let file = editorManager.getFile(url, "uri");
			if (file) {
				file.uri = newUrl;
				file.filename = newName;
			}
		} else {
			helpers.updateUriOfAllActiveFiles(url, newUrl);
		}
		FileList.rename(url, newUrl);
		await refreshRenamedEntryInOpenFolders(url, newUrl);
		toast(strings.success);
	}
	async function createNew() {
		const msg =
			action === "new file"
				? strings["enter file name"]
				: strings["enter folder name"];
		let newName = await prompt(msg, "", "text", {
			match: config.FILE_NAME_REGEX,
			required: true,
		});
		newName = helpers.fixFilename(newName);
		if (!newName) return;
		startLoading();
		try {
			const isNestedPath = newName.split("/").filter(Boolean).length > 1;
			let newUrl;
			if (action === "new file") {
				newUrl = await helpers.createFileStructure(url, newName);
			} else {
				newUrl = await helpers.createFileStructure(url, newName, false);
			}
			if (!newUrl.created) return;
			if (isNestedPath) {
				await refreshOpenFolder(url);
				FileList.append(newUrl.parentUri, newUrl.uri);
				toast(strings.success);
				return;
			}
			newName = Url.basename(newUrl.uri);
			appendEntryToOpenFolder(url, newUrl.uri, newUrl.type);
			FileList.append(url, newUrl.uri);
			toast(strings.success);
		} catch (error) {
			helpers.error(error);
		} finally {
			stopLoading();
		}
	}
	async function paste() {
		if (clipBoard.url == null) {
			alert(strings.warning, "Nothing to paste");
			return;
		}
		if (helpers.isDir(clipBoard.$el.dataset.type)) {
			const sourceUrl = Url.parse(clipBoard.url).url;
			const targetUrl = Url.parse(url).url;
			if (sourceUrl === targetUrl) {
				alert(strings.warning, "Cannot paste a folder into itself");
				return;
			}
			if (
				targetUrl.startsWith(sourceUrl + "/") ||
				targetUrl.startsWith(sourceUrl + "\\")
			) {
				alert(strings.warning, "Cannot paste a folder into its subdirectory");
				return;
			}
		}
		const srcType = clipBoard.$el.dataset.type;
		const IS_FILE = helpers.isFile(srcType);
		const IS_DIR = helpers.isDir(srcType);
		startLoading();
		try {
			const fs = fsOperation(clipBoard.url);
			const itemName = Url.basename(clipBoard.url);
			const possibleConflictUrl = Url.join(url, itemName);
			const doesExist = await fsOperation(possibleConflictUrl).exists();
			if (doesExist) {
				let confirmation = await confirm(
					strings.warning,
					strings["already exists"]
						? strings["already exists"].replace("{name}", itemName)
						: `"${itemName}" already exists in this location.`,
				);
				if (!confirmation) return;
			}
			let newUrl;
			if (clipBoard.action === "cut") {
				if (isTerminalSafUri(clipBoard.url) && IS_DIR) {
					const moveRecursively = async (sourceUrl, targetParentUrl) => {
						const sourceFs = fsOperation(sourceUrl);
						const sourceName = Url.basename(sourceUrl);
						const targetUrl = Url.join(targetParentUrl, sourceName);
						await fsOperation(targetParentUrl).createDirectory(sourceName);
						const entries = await sourceFs.lsDir();
						for (const entry of entries) {
							if (entry.isDirectory) {
								await moveRecursively(entry.url, targetUrl);
							} else {
								const fileContent = await fsOperation(entry.url).readFile();
								const fileName = entry.name || Url.basename(entry.url);
								await fsOperation(targetUrl).createFile(fileName, fileContent);
								await fsOperation(entry.url).delete();
							}
						}
						await sourceFs.delete();
						return targetUrl;
					};
					newUrl = await moveRecursively(clipBoard.url, url);
				} else {
					newUrl = await fs.moveTo(url);
				}
			} else {
				if (appSettings.value.useFileOperationExclusions) {
					const result = await copyEntry(clipBoard.url, url, {
						excludePatterns: appSettings.value.excludeFolders,
					});
					newUrl = result.url;
					if (!newUrl) {
						toast(strings.skipped);
						clearClipboard();
						return;
					}
				} else {
					newUrl = await fs.copyTo(url);
				}
			}
			stopLoading();
			if (clipBoard.action === "cut") {
				if (IS_FILE) {
					const file = editorManager.getFile(clipBoard.url, "uri");
					if (file) file.uri = newUrl;
				} else if (IS_DIR) {
					helpers.updateUriOfAllActiveFiles(clipBoard.url, newUrl);
					migrateOpenFolderStateUrls(clipBoard.url, newUrl);
				}
				removeEntryFromOpenFolder(clipBoard.url);
				FileList.rename(clipBoard.url, newUrl);
			} else {
				FileList.append(url, newUrl);
			}
			appendEntryToOpenFolder(url, newUrl, IS_DIR ? "folder" : "file");
			toast(strings.success);
			clearClipboard();
		} catch (error) {
			console.error(error);
			helpers.error(error);
		} finally {
			stopLoading();
		}
	}
	async function insertFile() {
		startLoading();
		try {
			const FileBrowser = await loadFileBrowser();
			const file = await FileBrowser("file", strings["insert file"]);
			const sourceFs = fsOperation(file.url);
			const data = await sourceFs.readFile();
			const sourceStats = await sourceFs.stat();
			const insertedFile = await fsOperation(url).createFile(
				sourceStats.name,
				data,
			);
			appendTile($target, createFileTile(sourceStats.name, insertedFile));
			FileList.append(url, insertedFile);
		} catch (error) {
		} finally {
			stopLoading();
		}
	}
	async function clipBoardAction() {
		clipBoard.url = url;
		clipBoard.action = action;
		clipBoard.$el = $target;
		if (action === "cut") $target.classList.add("cut");
		else $target.classList.remove("cut");
	}
	async function open() {
		const FileBrowser = await loadFileBrowser();
		FileBrowser.openFolder({
			url,
			name,
		});
	}
	function cancelAction() {
		clipBoard.$el.classList.remove("cut");
		clearClipboard();
	}
	function clearClipboard() {
		clipBoard.$el = null;
		clipBoard.url = null;
		clipBoard.action = null;
	}
}
function handleClick(type, uri) {
	if (!helpers.isFile(type)) return;
	openFile(uri, {
		render: true,
	});
	Sidebar.hide();
}
function appendTile($target, $tile) {
	$target = $target.nextElementSibling;
	const $firstTile = $target.get(":scope>[type=file]");
	if ($firstTile) $target.insertBefore($tile, $firstTile);
	else $target.append($tile);
}
function appendList($target, $list) {
	$target = $target.nextElementSibling;
	const $firstList = $target.firstElementChild;
	if ($firstList) $target.insertBefore($list, $firstList);
	else $target.append($list);
}
function getLoadedFileTree($el) {
	return (
		$el?.$ul?._fileTree || $el?.fileTree || $el?.nextElementSibling?._fileTree
	);
}
function normalizeUrlPathKey(url) {
	if (!url) return url;
	const { url: parsedUrl } = Url.parse(url);
	if (Url.getProtocol(parsedUrl) === "content:") {
		try {
			const { rootUri, docId } = Uri.parse(parsedUrl);
			const normalizedDocId = docId.endsWith("/") ? docId.slice(0, -1) : docId;
			return `${rootUri}::${normalizedDocId}`;
		} catch (error) {
			return parsedUrl;
		}
	}
	if (parsedUrl.endsWith("/") && Url.pathname(parsedUrl) !== "/") {
		return parsedUrl.slice(0, -1);
	}
	return parsedUrl;
}
function areSameOpenFolderUrl(leftUrl, rightUrl) {
	return normalizeUrlPathKey(leftUrl) === normalizeUrlPathKey(rightUrl);
}
function isInsideOpenFolder(url, folderUrl) {
	const urlKey = normalizeUrlPathKey(url);
	const folderKey = normalizeUrlPathKey(folderUrl);
	if (!urlKey || !folderKey) return false;
	return urlKey === folderKey || urlKey.startsWith(`${folderKey}/`);
}
function appendUrlPathSuffix(url, suffix) {
	if (!suffix) return url;
	const { url: parsedUrl, query } = Url.parse(url);
	if (parsedUrl.endsWith("/") && suffix.startsWith("/")) {
		return parsedUrl.slice(0, -1) + suffix + query;
	}
	return parsedUrl + suffix + query;
}
function preserveTrailingSlashShape(url, sourceUrl) {
	const { url: sourcePath } = Url.parse(sourceUrl);
	if (!sourcePath.endsWith("/")) return url;
	const { url: targetPath, query } = Url.parse(url);
	if (targetPath.endsWith("/")) return url;
	return `${targetPath}/${query}`;
}
function getListStateEntries(listState) {
	if (!listState) return [];
	if (listState instanceof Map) return Array.from(listState.entries());
	return Object.entries(listState);
}
function setListStateEntry(listState, key, value) {
	if (listState instanceof Map) {
		listState.set(key, value);
		return;
	}
	listState[key] = value;
}
function deleteListStateEntry(listState, key) {
	if (listState instanceof Map) {
		listState.delete(key);
		return;
	}
	delete listState[key];
}
function migrateOpenFolderStateUrls(oldUrl, newUrl) {
	if (!oldUrl || !newUrl || areSameOpenFolderUrl(oldUrl, newUrl)) return;
	const oldKey = normalizeUrlPathKey(oldUrl);
	addedFolder.forEach(({ listState }) => {
		const matchingEntries = getListStateEntries(listState).filter(
			([folderUrl]) => {
				return isInsideOpenFolder(folderUrl, oldUrl);
			},
		);
		matchingEntries.forEach(([folderUrl, isExpanded]) => {
			const suffix = normalizeUrlPathKey(folderUrl).slice(oldKey.length);
			const migratedUrl = preserveTrailingSlashShape(
				appendUrlPathSuffix(newUrl, suffix),
				folderUrl,
			);
			deleteListStateEntry(listState, folderUrl);
			setListStateEntry(listState, migratedUrl, isExpanded);
		});
	});
}
function getParentUrl(url) {
	return Url.dirname(url);
}
function removeEntryFromOpenFolder(entryUrl) {
	const filesApp = sidebarApps.get("files");
	const $els = Array.from(
		filesApp.getAll(`[data-url="${CSS.escape(entryUrl)}"]`),
	);
	$els.forEach(($el) => {
		const ownerTree =
			$el?.parentElement?._fileTree ||
			$el?.parentElement?.parentElement?._fileTree;
		if (ownerTree) {
			ownerTree.removeEntry(entryUrl);
			return;
		}
		const type = $el.dataset.type;
		if (helpers.isFile(type)) {
			$el.remove();
		} else {
			$el.parentElement?.remove();
		}
	});
}
function appendEntryToOpenFolder(parentUrl, entryUrl, type) {
	const filesApp = sidebarApps.get("files");
	const $els = filesApp.getAll(`[data-url="${parentUrl}"]`);
	const isDirectory = type === "folder";
	const name = Url.basename(entryUrl);
	Array.from($els).forEach(($el) => {
		if (!(helpers.isDir($el.dataset.type) || $el.dataset.type === "root")) {
			return;
		}
		if (!$el.unclasped) return;
		const fileTree = getLoadedFileTree($el);
		if (fileTree) {
			fileTree.appendEntry(name, entryUrl, isDirectory);
			return;
		}
		if (isDirectory) {
			appendList($el, createFolderTile(name, entryUrl));
		} else {
			appendTile($el, createFileTile(name, entryUrl));
		}
	});
}
async function refreshOpenFolder(folderUrl) {
	const folder = openFolder.find(folderUrl);
	if (!folder) return;
	const fileTree = getLoadedFileTree(folder.$node.$title);
	if (!fileTree) return;
	await fileTree.refreshFolder(folderUrl, areSameOpenFolderUrl);
}
async function refreshRenamedEntryInOpenFolders(
	oldUrl,
	newUrl,
	oldParentUrl = getParentUrl(oldUrl),
	newParentUrl = getParentUrl(newUrl),
) {
	if (!oldUrl || !newUrl || areSameOpenFolderUrl(oldUrl, newUrl)) return;
	migrateOpenFolderStateUrls(oldUrl, newUrl);
	const parentUrls = [oldParentUrl, newParentUrl].filter(Boolean);
	const refreshUrls = parentUrls.filter((parentUrl, index) => {
		return !parentUrls.some((otherUrl, otherIndex) => {
			return otherIndex < index && areSameOpenFolderUrl(otherUrl, parentUrl);
		});
	});
	await Promise.all(refreshUrls.map(refreshOpenFolder));
}
function createFolderTile(name, url) {
	const $list = collapsableList(name, "folder", {
		ontoggle: () => expandList($list),
	});
	const { $title } = $list;
	$title.dataset.url = url;
	$title.dataset.name = name;
	$title.dataset.type = "dir";
	return $list;
}
function createFileTile(name, url) {
	const $tile = tile({
		lead: <span className={helpers.getIconForFile(name)}></span>,
		text: name,
	});
	$tile.dataset.url = url;
	$tile.dataset.name = name;
	$tile.dataset.type = "file";
	return $tile;
}
openFolder.add = async (url, type) => {
	const { url: parent } = await fsOperation(Url.dirname(url)).stat();
	FileList.append(parent, url);
	appendEntryToOpenFolder(parent, url, type);
};
openFolder.renameItem = (oldFile, newFile) => {
	FileList.rename(oldFile, newFile);
	helpers.updateUriOfAllActiveFiles(oldFile, newFile);
	refreshRenamedEntryInOpenFolders(oldFile, newFile).catch(helpers.error);
};
openFolder.removeItem = (url) => {
	FileList.remove(url);
	const folder = addedFolder.find(({ url: fUrl }) => url === fUrl);
	if (folder) {
		folder.remove();
		return;
	}
	removeEntryFromOpenFolder(url);
};
openFolder.removeFolders = (url) => {
	({ url } = Url.parse(url));
	const regex = new RegExp("^" + escapeStringRegexp(url));
	addedFolder.forEach((folder) => {
		if (regex.test(folder.url)) {
			folder.remove();
		}
	});
};
openFolder.find = (url) => {
	const found = addedFolder.find((folder) =>
		areSameOpenFolderUrl(folder.url, url),
	);
	if (found) return found;
	return addedFolder.find((folder) => isInsideOpenFolder(url, folder.url));
};
export default openFolder;
