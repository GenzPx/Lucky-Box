import escapeStringRegexp from "escape-string-regexp";
import path from "./Path";

function parseStorageList() {
	try {
		const storageList = JSON.parse(localStorage.storageList || "[]");
		return Array.isArray(storageList) ? storageList : [];
	} catch (_) {
		return [];
	}
}
export default {
	parse(contentUri) {
		let rootUri,
			docId = "";
		const DOC_PROVIDER =
			/^content:\/\/com\.((?![:<>"\/\\\|\?\*]).)*\.documents\//;
		const TREE_URI =
			/^content:\/\/com\.((?![:<>"\/\\\|\?\*]).)*\.documents\/tree\//;
		const SINGLE_URI =
			/^content:\/\/com\.(((?![:<>"\/\\\|\?\*]).)*)\.documents\/document/;
		if (DOC_PROVIDER.test(contentUri)) {
			if (TREE_URI.test(contentUri)) {
				if (/::/.test(contentUri)) {
					[rootUri, docId] = contentUri.split("::");
				} else {
					rootUri = contentUri;
					docId = decodeURIComponent(contentUri.split("/").slice(-1)[0]);
				}
			} else if (SINGLE_URI.test(contentUri)) {
				const [provider, providerId] = SINGLE_URI.exec(contentUri);
				docId = decodeURIComponent(contentUri);
				docId = docId.replace(provider, "");
				docId = path.normalize(docId);
				if (docId.startsWith("/")) docId = docId.slice(1);
				rootUri =
					`content://com.${providerId}.documents/tree/` +
					docId.split(":")[0] +
					"%3A";
			}
			return {
				rootUri,
				docId,
				isFileUri: /^file:\/\/\//.test(rootUri),
			};
		} else {
			throw new Error("Invalid uri format.");
		}
	},
	format(contentUriObject, docId) {
		let rootUri;
		if (typeof contentUriObject === "string") {
			rootUri = contentUriObject;
		} else {
			rootUri = contentUriObject.rootUri;
			docId = contentUriObject.docId;
		}
		if (docId) return [rootUri, docId].join("::");
		else return rootUri;
	},
	getDisplayPath(url, storages = parseStorageList()) {
		try {
			const { docId } = this.parse(url);
			const document = splitDocId(docId);
			let matchedStorage = null;
			for (const storage of storages) {
				const storageUrl = storage.uri ?? storage.url;
				if (!storageUrl) continue;
				const isStorageRoot = url === storageUrl;
				const isStorageDescendant = url.startsWith(`${storageUrl}::`);
				if (!isStorageRoot && !isStorageDescendant) continue;
				if (!matchedStorage || storageUrl.length > matchedStorage.url.length) {
					matchedStorage = {
						storage,
						url: storageUrl,
					};
				}
			}
			if (matchedStorage) {
				const root = splitDocId(this.parse(matchedStorage.url).docId);
				let relativePath = document.path;
				if (
					document.volume === root.volume &&
					document.absolute === root.absolute
				) {
					if (document.path === root.path) {
						relativePath = "";
					} else if (root.path && document.path.startsWith(`${root.path}/`)) {
						relativePath = document.path.slice(root.path.length + 1);
					}
				}
				return [matchedStorage.storage.name || document.volume, relativePath]
					.filter(Boolean)
					.join("/");
			}
			return formatDocumentPath(document) || url;
		} catch (_) {
			return url;
		}
		function splitDocId(docId) {
			if (docId.startsWith("/")) {
				return {
					absolute: true,
					volume: "",
					path: docId.replace(/^\/+/, ""),
				};
			}
			const colonIndex = docId.indexOf(":");
			if (colonIndex >= 0) {
				return {
					absolute: false,
					volume: docId.slice(0, colonIndex),
					path: docId.slice(colonIndex + 1).replace(/^\/+/, ""),
				};
			}
			const [volume = "", ...pathParts] = docId.split("/");
			return {
				absolute: false,
				volume,
				path: pathParts.join("/"),
			};
		}
		function formatDocumentPath(document) {
			if (document.absolute) return `/${document.path}`;
			return [document.volume, document.path].filter(Boolean).join("/");
		}
	},
	getVirtualAddress(url) {
		try {
			const storageList = parseStorageList();
			const matches = [];
			for (let storage of storageList) {
				const regex = new RegExp(
					"^" + escapeStringRegexp(storage.uri ?? storage.url),
				);
				matches.push({
					regex,
					charMatched: url.length - url.replace(regex, "").length,
					storage,
				});
			}
			const matched = matches.sort((a, b) => {
				return b.charMatched - a.charMatched;
			})[0];
			if (matched) {
				const { storage, regex } = matched;
				const { name } = storage;
				const [base, paths] = url.split("::");
				url = base + "/" + paths.split("/").slice(1).join("/");
				return url.replace(regex, name).replace(/\/+/g, "/");
			}
			return url;
		} catch (e) {
			return url;
		}
	},
	getPrimaryAddress(url) {
		const [, primary] = url.split("::primary:");
		return primary;
	},
};
