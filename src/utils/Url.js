import URLParse from "url-parse";
import path from "./Path";
import Uri from "./Uri";
export default {
	basename(url) {
		url = this.parse(url).url;
		const protocol = this.getProtocol(url);
		if (protocol === "content:") {
			try {
				let { rootUri, docId, isFileUri } = Uri.parse(url);
				if (isFileUri) return this.basename(rootUri);
				if (docId.endsWith("/")) docId = docId.slice(0, -1);
				docId = docId.split(":").pop();
				return this.pathname(docId).split("/").pop();
			} catch (error) {
				return null;
			}
		} else {
			if (url.endsWith("/")) url = url.slice(0, -1);
			return this.pathname(url).split("/").pop();
		}
	},
	areSame(...urls) {
		let firstUrl = urls[0];
		if (firstUrl.endsWith("/")) firstUrl = firstUrl.slice(0, -1);
		return urls.every((url) => {
			if (url.endsWith("/")) url = url.slice(0, -1);
			return firstUrl === url;
		});
	},
	extname(url) {
		const name = this.basename(url);
		if (name) return path.extname(name);
		else return null;
	},
	join(...pathnames) {
		if (pathnames.length < 2)
			throw new Error("Join(), requires at least two parameters");
		let { url, query } = this.parse(pathnames[0]);
		const protocol = (this.PROTOCOL_PATTERN.exec(url) || [])[0] || "";
		if (protocol === "content://") {
			try {
				if (pathnames[1].startsWith("/")) pathnames[1] = pathnames[1].slice(1);
				const contentUri = Uri.parse(url);
				let [root, pathname] = contentUri.docId.split(":");
				let newDocId = path.join(pathname, ...pathnames.slice(1));
				if (/^content:\/\/com.termux/.test(url)) {
					const rootCondition = root.endsWith("/");
					const newDocIdCondition = newDocId.startsWith("/");
					if (rootCondition === newDocIdCondition) {
						root = root.slice(0, -1);
					} else if (!rootCondition === !newDocIdCondition) {
						root += "/";
					}
					return `${contentUri.rootUri}::${root}${newDocId}${query}`;
				}
				if (!pathname) {
					let separator = "";
					if (root.endsWith("/") && newDocId.startsWith("/")) {
						newDocId = newDocId.slice(1);
					} else if (!root.endsWith("/") && !newDocId.startsWith("/")) {
						separator = "/";
					}
					return `${contentUri.rootUri}::${root}${separator}${newDocId}${query}`;
				}
				return `${contentUri.rootUri}::${root}:${newDocId}${query}`;
			} catch (error) {
				return null;
			}
		} else if (protocol) {
			url = url.replace(new RegExp("^" + protocol), "");
			pathnames[0] = url;
			return protocol + path.join(...pathnames) + query;
		} else {
			return path.join(url, ...pathnames.slice(1)) + query;
		}
	},
	safe(url) {
		let { url: uri, query } = this.parse(url);
		url = uri;
		const protocol = (this.PROTOCOL_PATTERN.exec(url) || [])[0] || "";
		if (protocol) url = url.replace(new RegExp("^" + protocol), "");
		const parts = url.split("/").map((part, i) => {
			if (i === 0) return part;
			return fixedEncodeURIComponent(part);
		});
		return protocol + parts.join("/") + query;
		function fixedEncodeURIComponent(str) {
			return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
				return "%" + c.charCodeAt(0).toString(16);
			});
		}
	},
	pathname(url) {
		if (typeof url !== "string" || !this.PROTOCOL_PATTERN.test(url)) return url;
		url = url.split("?")[0];
		const protocol = (this.PROTOCOL_PATTERN.exec(url) || [])[0] || "";
		if (protocol === "content://") {
			try {
				const { rootUri, docId, isFileUri } = Uri.parse(url);
				if (isFileUri) return this.pathname(rootUri);
				else return "/" + (docId.split(":")[1] || docId);
			} catch (error) {
				return null;
			}
		} else {
			if (protocol) url = url.replace(new RegExp("^" + protocol), "");
			if (protocol !== "file:///")
				return "/" + url.split("/").slice(1).join("/");
			return "/" + url;
		}
	},
	dirname(url) {
		if (typeof url !== "string") throw new Error("URL must be string");
		const urlObj = this.parse(url);
		url = urlObj.url;
		const protocol = this.getProtocol(url);
		if (protocol === "content:") {
			try {
				let { rootUri, docId, isFileUri } = Uri.parse(url);
				if (isFileUri) return this.dirname(rootUri);
				else {
					if (docId.endsWith("/")) docId = docId.slice(0, -1);
					docId = [...docId.split("/").slice(0, -1), ""].join("/");
					return Uri.format(rootUri, docId);
				}
			} catch (error) {
				return null;
			}
		} else {
			if (url.endsWith("/")) url = url.slice(0, -1);
			return [...url.split("/").slice(0, -1), ""].join("/") + urlObj.query;
		}
	},
	parse(url) {
		const [uri, query = ""] = url.split(/(?=\?)/);
		return {
			url: uri,
			query,
		};
	},
	formate(urlObj) {
		let { protocol, hostname, username, password, path, port, query } = urlObj;
		const enc = (str) => encodeURIComponent(str);
		if (!protocol || !hostname)
			throw new Error("Cannot formate url. Missing 'protocol' and 'hostname'.");
		let string = `${protocol}//`;
		if (username && password) string += `${enc(username)}:${enc(password)}@`;
		else if (username) string += `${username}@`;
		string += hostname;
		if (port) string += `:${port}`;
		if (path) {
			if (!path.startsWith("/")) path = "/" + path;
			string += path;
		}
		if (query && typeof query === "object") {
			string += "?";
			for (let key in query) string += `${enc(key)}=${enc(query[key])}&`;
			string = string.slice(0, -1);
		}
		return string;
	},
	getProtocol(url) {
		return (/^([a-z]+:)\/\/\/?/i.exec(url) || [])[1] || "";
	},
	hidePassword(url) {
		const { protocol, username, hostname, pathname } = URLParse(url);
		if (protocol === "file:") {
			return url;
		} else {
			return `${protocol}//${username}@${hostname}${pathname}`;
		}
	},
	decodeUrl(url) {
		const uuid = "uuid" + Math.floor(Math.random() + Date.now() * 1000000);
		if (/#/.test(url)) {
			url = url.replace(/#/g, uuid);
		}
		let { username, password, hostname, pathname, port, query } = URLParse(
			url,
			true,
		);
		if (pathname) {
			pathname = decodeURIComponent(pathname);
			pathname = pathname.replace(new RegExp(uuid, "g"), "#");
		}
		if (username) {
			username = decodeURIComponent(username);
		}
		if (password) {
			password = decodeURIComponent(password);
		}
		if (port) {
			port = Number.parseInt(port);
		}
		let { keyFile, passPhrase } = query;
		if (keyFile) {
			query.keyFile = decodeURIComponent(keyFile);
		}
		if (passPhrase) {
			query.passPhrase = decodeURIComponent(passPhrase);
		}
		return {
			username,
			password,
			hostname,
			pathname,
			port,
			query,
		};
	},
	trimSlash(url) {
		const parsed = this.parse(url);
		if (parsed.url.endsWith("/")) {
			parsed.url = parsed.url.slice(0, -1);
		}
		return this.join(parsed.url, parsed.query);
	},
	PROTOCOL_PATTERN: /^[a-z]+:\/\/\/?/i,
};
