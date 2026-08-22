import ajax from "lib/ajax";
import { decode } from "utils/encodings";
import Url from "utils/Url";
import externalFs from "./externalFs";
import Ftp from "./ftp";
import internalFs from "./internalFs";
import Sftp from "./sftp";

const fsList = [];
export default function fsOperation(...url) {
	if (url.length > 1) {
		url = Url.join(...url);
	} else {
		url = url[0];
	}
	return fsList.find((fs) => fs.test(url))?.fs(url);
}
fsOperation.extend = (test, fs) => {
	fsList.push({
		test,
		fs,
	});
};
fsOperation.remove = (test) => {
	const index = fsList.findIndex((fs) => fs.test === test);
	if (index !== -1) {
		fsList.splice(index, 1);
	}
};
fsOperation.extend(Sftp.test, Sftp.fromUrl);
fsOperation.extend(Ftp.test, Ftp.fromUrl);
fsOperation.extend(internalFs.test, (url) => internalFs.createFs(url));
fsOperation.extend(externalFs.test, (url) => externalFs.createFs(url));
fsOperation.extend(
	(url) => /^https?:/.test(url),
	(url) => {
		return {
			async readFile(encoding, progress) {
				const data = await ajax.get(url, {
					responseType: "arraybuffer",
					contentType: "application/x-www-form-urlencoded",
					onprogress: progress,
				});
				if (encoding) {
					return await decode(data, encoding);
				}
				return data;
			},
			async writeFile(content, progress) {
				return ajax.post(url, {
					data: content,
					contentType: "application/x-www-form-urlencoded",
					onprogress: progress,
				});
			},
		};
	},
);
