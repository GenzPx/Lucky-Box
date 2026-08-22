import settings from "lib/settings";
import mimeType from "mime-types";
import { decode, encode } from "utils/encodings";
import helpers from "utils/helpers";
import Path from "utils/Path";
import Url from "utils/Url";
import internalFs from "./internalFs";

class SftpClient {
	#MAX_TRY = 3;
	#hostname;
	#port;
	#username;
	#authenticationType;
	#password;
	#keyFile;
	#passPhrase;
	#base;
	#connectionID;
	#path;
	#stat;
	#retry = 0;
	constructor(hostname, port = 22, username, authentication) {
		this.#hostname = hostname;
		this.#port = port;
		this.#username = username;
		this.#authenticationType = !!authentication.keyFile ? "key" : "password";
		this.#keyFile = authentication.keyFile;
		this.#passPhrase = authentication.passPhrase;
		this.#password = authentication.password;
		this.#base = Url.formate({
			protocol: "sftp:",
			hostname: this.#hostname,
			port: this.#port,
			username: this.#username,
			password: this.#password,
			query: {
				passPhrase: this.#passPhrase,
				keyFile: this.#keyFile,
			},
		});
		this.#connectionID = `${this.#username}@${this.#hostname}`;
	}
	setPath(path) {
		this.#path = path;
	}
	lsDir(filename = this.#path) {
		return new Promise((resolve, reject) => {
			sftp.isConnected(async (connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					const path = this.#safeName(filename);
					sftp.lsDir(
						path,
						(res) => {
							res.forEach((file) => {
								file.url = Url.join(this.#base, file.url);
								file.type = mimeType.lookup(filename);
								if (file.isLink) {
									file.linkTarget = Url.join(this.#base, file.linkTarget);
								}
							});
							resolve(res);
						},
						(err) => {
							reject(err);
						},
					);
				})();
			}, reject);
		});
	}
	createFile(filename, content) {
		filename = Path.join(this.#path, filename);
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					sftp.createFile(
						filename,
						content ? content : "",
						async (_res) => {
							resolve(Url.join(this.#base, filename));
						},
						(err) => {
							reject(err);
						},
					);
				})();
			});
		});
	}
	createDir(dirname) {
		dirname = Path.join(this.#path, dirname);
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					sftp.mkdir(
						this.#safeName(dirname),
						async (_res) => {
							resolve(Url.join(this.#base, this.#safeName(dirname)));
						},
						(err) => {
							reject(err);
						},
					);
				})();
			});
		});
	}
	writeFile(content, remotefile) {
		const filename = remotefile || this.#path;
		const localFilename = this.#getLocalname(filename);
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					try {
						if (this.#notConnected(connectionID)) {
							await this.connect();
						}
						await internalFs.writeFile(localFilename, content, true, false);
						const remoteFile = this.#safeName(filename);
						sftp.putFile(remoteFile, localFilename, resolve, reject);
					} catch (err) {
						reject(err);
					}
				})();
			}, reject);
		});
	}
	readFile() {
		const filename = this.#path;
		const localFilename = this.#getLocalname(filename);
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					sftp.getFile(
						this.#safeName(filename),
						localFilename,
						async () => {
							try {
								const data = await internalFs.readFile(localFilename);
								resolve(data);
							} catch (error) {
								reject(error);
							}
						},
						(err) => {
							reject(err);
						},
					);
				})();
			});
		});
	}
	async copyTo(dest) {
		const src = this.#path;
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					try {
						if (this.#notConnected(connectionID)) {
							await this.connect();
						}
						const srcStat = await this.stat();
						if (srcStat.isDirectory) {
							await this.#copyDirectory(src, dest);
						} else {
							await this.#copyFile(src, dest);
						}
						const finalPath = Path.join(dest, Path.basename(src));
						resolve(Url.join(this.#base, finalPath));
					} catch (error) {
						reject(error);
					}
				})();
			}, reject);
		});
	}
	async #copyFile(src, dest) {
		const destPath = Path.join(dest, Path.basename(src));
		const tempFile = this.#getLocalname(src);
		await new Promise((resolve, reject) => {
			sftp.getFile(this.#safeName(src), tempFile, resolve, reject);
		});
		await new Promise((resolve, reject) => {
			sftp.putFile(this.#safeName(destPath), tempFile, resolve, reject);
		});
		try {
			await internalFs.delete(tempFile);
		} catch (error) {
			console.warn("Failed to cleanup temp file:", error);
		}
	}
	async #copyDirectory(src, dest) {
		const destDir = Path.join(dest, Path.basename(src));
		await new Promise((resolve, reject) => {
			sftp.mkdir(this.#safeName(destDir), resolve, reject);
		});
		const contents = await this.lsDir(src);
		for (const item of contents) {
			const itemSrc = Path.join(src, item.name);
			if (item.isDirectory) {
				await this.#copyDirectory(itemSrc, destDir);
			} else {
				await this.#copyFile(itemSrc, destDir);
			}
		}
	}
	moveTo(dest) {
		return this.rename(dest, true);
	}
	rename(newname, move) {
		const src = this.#path;
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					newname = move ? newname : Path.join(Path.dirname(src), newname);
					sftp.rename(
						this.#safeName(src),
						this.#safeName(newname),
						async (_res) => {
							const url = move ? Url.join(newname, Url.basename(src)) : newname;
							resolve(Url.join(this.#base, url));
						},
						(err) => {
							reject(err);
						},
					);
				})();
			}, reject);
		});
	}
	delete() {
		const filename = this.#path;
		const fullFilename = Url.join(this.#base, filename);
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					await this.#setStat();
					sftp.rm(
						this.#safeName(filename),
						this.#stat.isDirectory ? true : false,
						this.#stat.isDirectory ? true : false,
						(_res) => {
							resolve(fullFilename);
						},
						(err) => {
							reject(err);
						},
					);
				})();
			}, reject);
		});
	}
	pwd() {
		return new Promise((resolve, reject) => {
			sftp.isConnected((connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					sftp.pwd(
						(res) => {
							resolve(res);
						},
						(err) => {
							reject(err);
						},
					);
				})();
			}, reject);
		});
	}
	async connect() {
		await new Promise((resolve, reject) => {
			const retry = (err) => {
				if (settings.value.retryRemoteFsAfterFail) {
					if (++this.#retry > this.#MAX_TRY) {
						this.#retry = 0;
						reject(err);
					} else {
						this.connect().then(resolve).catch(reject);
					}
				} else {
					reject(err);
				}
			};
			if (this.#authenticationType === "key") {
				sftp.connectUsingKeyFile(
					this.#hostname,
					this.#port,
					this.#username,
					this.#keyFile,
					this.#passPhrase,
					resolve,
					retry,
				);
				return;
			}
			sftp.connectUsingPassword(
				this.#hostname,
				this.#port,
				this.#username,
				this.#password,
				resolve,
				retry,
			);
		});
	}
	async exists() {
		return (await this.stat()).exists;
	}
	async stat() {
		if (this.#stat) return this.#stat;
		return new Promise((resolve, reject) => {
			sftp.isConnected(async (connectionID) => {
				(async () => {
					if (this.#notConnected(connectionID)) {
						try {
							await this.connect();
						} catch (error) {
							reject(error);
							return;
						}
					}
					const path = this.#safeName(this.#path);
					sftp.stat(
						path,
						(res) => {
							res.url = Url.join(this.#base, res.url);
							res.type = mimeType.lookup(path);
							if (res.isLink) {
								res.linkTarget = Url.join(this.#base, res.linkTarget);
							}
							helpers.defineDeprecatedProperty(
								res,
								"uri",
								function () {
									return this.url;
								},
								function (val) {
									this.url = val;
								},
							);
							resolve(res);
						},
						(err) => {
							reject(err);
						},
					);
				})();
			}, reject);
		});
	}
	get localName() {
		return this.#getLocalname(this.#path);
	}
	#safeName(name) {
		const escapeCh = (str) => str.replace(/\\([^])|([`"])/g, "\\$1$2");
		const ar = name.split("/");
		return ar.map((dirname) => escapeCh(dirname)).join("/");
	}
	#notConnected(connectionID) {
		return !connectionID || connectionID !== this.#connectionID;
	}
	#getLocalname(filename) {
		return Url.join(
			CACHE_STORAGE,
			"sftp" + Url.join(this.#base, filename).hashCode(),
		);
	}
	async #setStat() {
		if (!this.#stat) {
			this.#stat = await this.stat();
		}
	}
}
function Sftp(host, port, username, authentication) {
	return new SftpClient(host, port, username, authentication);
}
Sftp.fromUrl = (url) => {
	const { username, password, hostname, pathname, port, query } =
		Url.decodeUrl(url);
	const { keyFile, passPhrase } = query;
	const sftp = new SftpClient(hostname, port || 22, username, {
		password,
		keyFile,
		passPhrase,
	});
	sftp.setPath(pathname);
	return createFs(sftp);
};
Sftp.test = (url) => /^sftp:/.test(url);
function createFs(sftp) {
	return {
		lsDir() {
			return sftp.lsDir();
		},
		async readFile(encoding) {
			const { data } = await sftp.readFile();
			if (encoding) {
				return decode(data, encoding);
			}
			return data;
		},
		async writeFile(content, encoding) {
			if (typeof content === "string" && encoding) {
				content = await encode(content, encoding);
			}
			return sftp.writeFile(content, null);
		},
		createFile(name, data) {
			return sftp.createFile(name, data);
		},
		createDirectory(name) {
			return sftp.createDir(name);
		},
		delete() {
			return sftp.delete();
		},
		copyTo(dest) {
			dest = Url.pathname(dest);
			return sftp.copyTo(dest);
		},
		moveTo(dest) {
			dest = Url.pathname(dest);
			return sftp.moveTo(dest);
		},
		renameTo(newname) {
			return sftp.rename(newname);
		},
		exists() {
			return sftp.exists();
		},
		stat() {
			return sftp.stat();
		},
		get localName() {
			return sftp.localName;
		},
	};
}
export default Sftp;
