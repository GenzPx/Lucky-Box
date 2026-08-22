import fsOperation from "fileSystem";
import { Text } from "@codemirror/state";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import helpers from "utils/helpers";

let checkFileEnabled = true;
Object.defineProperty(checkFiles, "check", {
	set(value) {
		checkFileEnabled = value;
	},
	get() {
		return checkFileEnabled;
	},
});
export default async function checkFiles() {
	if (!editorManager) return;
	if (checkFileEnabled === false) {
		checkFileEnabled = true;
		return;
	}
	const files = editorManager.files;
	const { editor } = editorManager;
	recursiveFileCheck([...files]);
	async function recursiveFileCheck(files) {
		const file = files.pop();
		await checkFile(file);
		if (files.length) {
			recursiveFileCheck(files);
		}
		return;
	}
	async function checkFile(file) {
		if (file === undefined || !file.loaded || file.loading) return;
		if (file.uri) {
			const fs = fsOperation(file.uri);
			const exists = await fs.exists();
			if (!exists && !file.readOnly) {
				file.isUnsaved = true;
				file.uri = null;
				editorManager.onupdate("file-changed");
				editorManager.emit("update", "file-changed");
				await new Promise((resolve) => {
					alert(
						strings.info,
						strings["file has been deleted"].replace("{file}", file.filename),
						resolve,
					);
				});
				return;
			}
			let mtime = null;
			if (file.hasVersionMetadata && file.savedMtime != null) {
				const stat = await fs.stat().catch(() => null);
				mtime = helpers.getStatMtime(stat);
				if (mtime != null) {
					if (mtime === file.savedMtime) return;
					const alreadyWarnedConflict =
						file.hasDiskConflict && file.diskMtime === mtime;
					file.markDiskChanged({
						mtime,
					});
					if (file.hasDiskConflict) {
						editorManager.onupdate("file-changed");
						editorManager.emit("update", "file-changed");
						console.warn(
							`File changed on disk while unsaved: ${file.filename}`,
						);
						if (!alreadyWarnedConflict) {
							await new Promise((resolve) => {
								alert(
									strings.warning.toUpperCase(),
									`${file.filename} changed on disk while you have unsaved edits. Saving now may overwrite the external changes.`,
									resolve,
								);
							});
						}
						return;
					}
				}
			}
			if (file.isUnsaved) return;
			const text = await fs.readFile(file.encoding);
			const diskDoc = Text.of(String(text ?? "").split("\n"));
			const currentDoc = file.session?.doc;
			if (!currentDoc?.eq?.(diskDoc)) {
				try {
					const confirmation = await confirm(
						strings.warning.toUpperCase(),
						file.filename + strings["file changed"],
					);
					if (!confirmation) return;
					const cursorPos = editor.getCursorPosition();
					editorManager.getFile(file.id, "id")?.makeActive();
					file.markChanged = false;
					try {
						file.session.setValue(text);
						file.markLoaded({
							mtime,
						});
					} finally {
						file.markChanged = true;
					}
					await file.writeToCache();
					editor.gotoLine(cursorPos.row, cursorPos.column);
				} catch (error) {}
			} else if (mtime != null && file.hasVersionMetadata) {
				file.markLoaded({
					mtime,
				});
			}
		}
	}
	if (!editorManager.activeFile) {
		app.focus();
	}
}
