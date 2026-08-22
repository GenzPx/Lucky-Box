import JSZip from "jszip";
export async function createZip(entries, options = {}) {
	const zip = new JSZip();
	for (const entry of entries || []) {
		const path = normalizePath(entry.path || entry.name);
		if (!path) continue;
		if (entry.directory) {
			zip.folder(path);
			continue;
		}
		zip.file(path, entry.data ?? "", {
			binary: entry.binary,
			date: entry.date,
			comment: entry.comment,
			unixPermissions: entry.unixPermissions,
		});
	}
	return await zip.generateAsync(
		{
			type: options.type || "blob",
			compression: options.compression || "DEFLATE",
			compressionOptions: {
				level: clampLevel(options.level ?? 6),
			},
			comment: options.comment || "Created by LuckyBox",
			platform: options.platform || "UNIX",
		},
		options.onProgress,
	);
}
export async function openZip(input, options = {}) {
	const zip = await JSZip.loadAsync(input, {
		checkCRC32: options.checkCRC32 === true,
		createFolders: true,
	});
	return new ZipArchive(zip);
}
export class ZipArchive {
	constructor(zip) {
		this.zip = zip;
	}
	list({ includeDirectories = true } = {}) {
		return Object.values(this.zip.files)
			.filter((entry) => includeDirectories || !entry.dir)
			.map((entry) => ({
				path: entry.name,
				directory: entry.dir,
				date: entry.date,
				comment: entry.comment || "",
				unixPermissions: entry.unixPermissions ?? null,
				dosPermissions: entry.dosPermissions ?? null,
			}));
	}
	has(path) {
		return Boolean(this.zip.file(normalizePath(path)));
	}
	async read(path, type = "uint8array") {
		const normalized = normalizePath(path);
		const entry = this.zip.file(normalized);
		if (!entry || entry.dir)
			throw new Error(`ZIP entry not found: ${normalized}`);
		return await entry.async(type);
	}
	async extractAll(writer, options = {}) {
		if (typeof writer !== "function") {
			throw new TypeError("ZIP extraction requires an async writer callback");
		}
		const entries = this.list({
			includeDirectories: true,
		});
		let completed = 0;
		for (const entry of entries) {
			if (options.signal?.aborted) {
				throw new DOMException("Extraction cancelled", "AbortError");
			}
			const safePath = safeExtractionPath(entry.path);
			const data = entry.directory
				? null
				: await this.read(entry.path, "uint8array");
			await writer({
				...entry,
				path: safePath,
				data,
			});
			completed += 1;
			options.onProgress?.({
				completed,
				total: entries.length,
				progress: entries.length ? completed / entries.length : 1,
				path: safePath,
			});
		}
	}
}
export function safeExtractionPath(path) {
	const normalized = normalizePath(path);
	if (!normalized) throw new Error("Archive entry has an empty path");
	const segments = normalized.split("/");
	if (segments.some((segment) => segment === "..")) {
		throw new Error(`Unsafe archive entry path: ${path}`);
	}
	return segments.filter((segment) => segment && segment !== ".").join("/");
}
function normalizePath(path) {
	return String(path || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/");
}
function clampLevel(value) {
	return Math.min(9, Math.max(1, Number(value) || 6));
}
