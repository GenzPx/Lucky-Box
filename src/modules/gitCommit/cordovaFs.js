import fsOperation from "fileSystem";
import Url from "utils/Url";
export default function createCordovaGitFs(rootUri) {
	const virtualRoot = "/repo";
	const toUrl = (filePath) => {
		const value = String(filePath || virtualRoot).replace(/\\/g, "/");
		const relative = value.startsWith(virtualRoot)
			? value.slice(virtualRoot.length)
			: value;
		return Url.join(rootUri, relative.replace(/^\/+/, ""));
	};
	const error = (code, message) => Object.assign(new Error(message), { code });
	const ensureDirectory = async (filePath) => {
		const normalized = String(filePath).replace(/\\/g, "/");
		const relative = normalized.startsWith(virtualRoot)
			? normalized.slice(virtualRoot.length)
			: normalized;
		let current = rootUri;
		for (const segment of relative.split("/").filter(Boolean)) {
			const next = Url.join(current, segment);
			if (!(await fsOperation(next).exists()))
				await fsOperation(current).createDirectory(segment);
			current = next;
		}
	};
	const stat = async (filePath) => {
		const operation = fsOperation(toUrl(filePath));
		if (!(await operation.exists()))
			throw error("ENOENT", `Path not found: ${filePath}`);
		const value = await operation.stat();
		const directory = Boolean(value.isDirectory || value.type === "dir");
		const modified = value.modifiedDate || value.mtime || Date.now();
		return {
			size: Number(value.size) || 0,
			mode: directory ? 0o40755 : 0o100644,
			mtimeMs: new Date(modified).getTime(),
			ctimeMs: new Date(modified).getTime(),
			uid: 0,
			gid: 0,
			isFile: () => !directory,
			isDirectory: () => directory,
			isSymbolicLink: () => false,
		};
	};
	const promises = {
		async readFile(filePath, options) {
			const operation = fsOperation(toUrl(filePath));
			if (!(await operation.exists()))
				throw error("ENOENT", `Path not found: ${filePath}`);
			const encoding =
				typeof options === "string" ? options : options?.encoding;
			if (encoding)
				return operation.readFile(encoding === "utf8" ? "utf-8" : encoding);
			const value = await operation.readFile();
			if (value instanceof Uint8Array) return value;
			if (value instanceof ArrayBuffer) return new Uint8Array(value);
			return new TextEncoder().encode(String(value));
		},
		async writeFile(filePath, data, options) {
			const normalized = String(filePath).replace(/\\/g, "/");
			const parent =
				normalized.slice(0, normalized.lastIndexOf("/")) || virtualRoot;
			const name = normalized.slice(normalized.lastIndexOf("/") + 1);
			await ensureDirectory(parent);
			const target = fsOperation(toUrl(normalized));
			const encoding =
				typeof options === "string" ? options : options?.encoding;
			const value =
				encoding && data instanceof Uint8Array
					? new TextDecoder().decode(data)
					: data;
			if (await target.exists()) return target.writeFile(value, encoding);
			return fsOperation(toUrl(parent)).createFile(name, value);
		},
		async unlink(filePath) {
			const target = fsOperation(toUrl(filePath));
			if (!(await target.exists()))
				throw error("ENOENT", `Path not found: ${filePath}`);
			await target.delete();
		},
		async readdir(filePath) {
			const target = fsOperation(toUrl(filePath));
			if (!(await target.exists()))
				throw error("ENOENT", `Path not found: ${filePath}`);
			return (await target.lsDir()).map(
				(entry) => entry.name || Url.basename(entry.url),
			);
		},
		async mkdir(filePath) {
			if (await fsOperation(toUrl(filePath)).exists())
				throw error("EEXIST", `Path exists: ${filePath}`);
			await ensureDirectory(filePath);
		},
		async rmdir(filePath) {
			await promises.unlink(filePath);
		},
		stat,
		lstat: stat,
		async chmod() {},
		async readlink() {
			throw error(
				"EINVAL",
				"Symbolic links are not supported by this storage provider",
			);
		},
		async symlink() {
			throw error(
				"ENOSYS",
				"Symbolic links are not supported by this storage provider",
			);
		},
	};
	return { promises };
}
