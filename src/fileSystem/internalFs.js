import fsOperation from "fileSystem";
import ajax from "lib/ajax";
import { decode, encode } from "utils/encodings";
import helpers from "utils/helpers";
import Url from "utils/Url";

const internalFs = {
	listDir(url) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(url, success, reject);
			function success(fs) {
				const reader = fs.createReader();
				reader.readEntries(resolve, reject);
			}
		});
	},
	writeFile(filename, data, create = false, exclusive = true) {
		exclusive = create ? exclusive : false;
		const name = filename.split("/").pop();
		const dirname = Url.dirname(filename);
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				dirname,
				(entry) => {
					entry.getFile(
						name,
						{
							create,
							exclusive,
						},
						(fileEntry) => {
							fileEntry.createWriter((file) => {
								file.onwriteend = (res) => resolve(filename);
								file.onerror = (err) => reject(err.target.error);
								file.write(data);
							});
						},
						reject,
					);
				},
				reject,
			);
		});
	},
	delete(filename) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				filename,
				(entry) => {
					if (entry.isFile) {
						entry.remove(resolve, reject);
					} else {
						entry.removeRecursively(resolve, reject);
					}
				},
				reject,
			);
		});
	},
	readFile(filename) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				filename,
				(fileEntry) => {
					(async () => {
						const url = fileEntry.toInternalURL();
						try {
							const data = await ajax({
								url: url,
								responseType: "arraybuffer",
							});
							resolve({
								data,
							});
						} catch (error) {
							fileEntry.file((file) => {
								const fileReader = new FileReader();
								fileReader.onerror = reject;
								fileReader.readAsArrayBuffer(file);
								fileReader.onloadend = () => {
									resolve({
										data: fileReader.result,
									});
								};
							}, reject);
						}
					})();
				},
				reject,
			);
		});
	},
	renameFile(url, newname) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				url,
				(fs) => {
					fs.getParent((parent) => {
						fs.moveTo(
							parent,
							newname,
							async (entry) => {
								const newUrl = Url.join(Url.dirname(url), entry.name);
								resolve(newUrl);
							},
							reject,
						);
					}, reject);
				},
				reject,
			);
		});
	},
	createDir(path, dirname) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				path,
				(fs) => {
					fs.getDirectory(
						dirname,
						{
							create: true,
						},
						async () => {
							const stats = await this.stats(Url.join(path, dirname));
							resolve(stats.url);
						},
						reject,
					);
				},
				reject,
			);
		});
	},
	copy(src, dest) {
		return moveOrCopy("copyTo", src, dest);
	},
	move(src, dest) {
		return moveOrCopy("moveTo", src, dest);
	},
	moveOrCopy(action, src, dest) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			this.verify(src, dest)
				.then((res) => {
					const { src, dest } = res;
					src[action](
						dest,
						undefined,
						(entry) => resolve(decodeURIComponent(entry.nativeURL)),
						reject,
					);
				})
				.catch(reject);
		});
	},
	stats(filename) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				filename,
				(entry) => {
					sdcard.stats(
						entry.nativeURL,
						(stats) => {
							helpers.defineDeprecatedProperty(
								stats,
								"uri",
								function () {
									return this.url;
								},
								function (val) {
									this.url = val;
								},
							);
							stats.url = filename;
							resolve(stats);
						},
						reject,
					);
				},
				reject,
			);
		});
	},
	verify(src, dest) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				src,
				(srcEntry) => {
					window.resolveLocalFileSystemURL(
						dest,
						(destEntry) => {
							window.resolveLocalFileSystemURL(
								Url.join(destEntry.nativeURL, srcEntry.name),
								(res) => {
									reject({
										code: 12,
									});
								},
								(err) => {
									if (err.code === 1) {
										resolve({
											src: srcEntry,
											dest: destEntry,
										});
									} else {
										reject(err);
									}
								},
							);
						},
						reject,
					);
				},
				reject,
			);
		});
	},
	exists(url) {
		return new Promise((resolve, reject) => {
			reject = setMessage(reject);
			window.resolveLocalFileSystemURL(
				url,
				(entry) => {
					resolve(true);
				},
				(err) => {
					if (err.code === 1) resolve(false);
					reject(err);
				},
			);
		});
	},
	test(url) {
		return /^file:/.test(url);
	},
	createFs,
	getErrorMessage,
};
function setMessage(reject) {
	return function (err) {
		if (err.code) {
			const message = getErrorMessage(err.code);
			err.message = message;
			return reject(err);
		}
		reject(err);
	};
}
function getErrorMessage(code) {
	switch (code) {
		case 1:
			return "Path not found";
		case 2:
			return "Security error";
		case 3:
			return "Action aborted";
		case 4:
			return "File not readable";
		case 5:
			return "File encoding error";
		case 6:
			return "Modification not allowed";
		case 7:
			return "Invalid state";
		case 8:
			return "Syntax error";
		case 9:
			return "Invalid modification";
		case 10:
			return "Quota exceeded";
		case 11:
			return "Type mismatch";
		case 12:
			return "Path already exists";
		default:
			return "Uncaught error";
	}
}
function createFs(url) {
	return {
		async lsDir() {
			const files = [];
			const entries = await internalFs.listDir(url);
			entries.map((entry) => {
				const url = decodeURIComponent(entry.nativeURL);
				const name = Url.basename(url);
				files.push({
					name,
					url,
					isDirectory: entry.isDirectory,
					isFile: entry.isFile,
				});
			});
			return files;
		},
		async readFile(encoding) {
			let { data } = await internalFs.readFile(url, encoding);
			if (encoding) {
				data = await decode(data, encoding);
			}
			return data;
		},
		async writeFile(content, encoding) {
			if (typeof content === "string" && encoding) {
				content = await encode(content, encoding);
			}
			return internalFs.writeFile(url, content, false, false);
		},
		createFile(name, data) {
			return internalFs.writeFile(Url.join(url, name), data || "", true, true);
		},
		createDirectory(name) {
			return internalFs.createDir(url, name);
		},
		delete() {
			return internalFs.delete(url);
		},
		copyTo(dest) {
			return internalFs.moveOrCopy("copyTo", url, dest);
		},
		moveTo(dest) {
			return internalFs.moveOrCopy("moveTo", url, dest);
		},
		async renameTo(newname) {
			const name = Url.basename(url).toLowerCase();
			if (name === newname.toLowerCase()) {
				const uuid = helpers.uuid();
				let newUrl = await this.renameTo(uuid);
				newUrl = await fsOperation(newUrl).renameTo(newname);
				return newUrl;
			}
			return internalFs.renameFile(url, newname);
		},
		exists() {
			return internalFs.exists(url);
		},
		stat() {
			return internalFs.stats(url);
		},
	};
}
export default internalFs;
