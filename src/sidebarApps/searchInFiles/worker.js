import "core-js/stable";
import picomatch from "picomatch/posix";
import { isBinaryFile } from "utils/binaryExtensions";

const resolvers = {};
const MAX_CONCURRENT_FILE_READS = 2;
self.onmessage = (ev) => {
	const { action, data, error, id } = ev.data;
	switch (action) {
		case "search-files":
			processFiles(data, "search");
			break;
		case "replace-files":
			processFiles(data, "replace");
			break;
		case "get-file": {
			if (!resolvers[id]) return;
			const cb = resolvers[id];
			cb(data, error);
			delete resolvers[id];
			break;
		}
		default:
			return false;
	}
};
function processFiles(data, mode = "search") {
	const process = mode === "search" ? searchInFile : replaceInFile;
	const { files, search, replace, options } = data;
	const { test: skip } = Skip(options);
	const total = files.length;
	let count = 0;
	let cursor = 0;
	let active = 0;
	let pumpScheduled = false;
	if (!total) {
		done(1, mode);
		return;
	}
	pump();
	function pump() {
		pumpScheduled = false;
		while (active < MAX_CONCURRENT_FILE_READS && cursor < total) {
			const file = files[cursor++];
			active += 1;
			processFile(file);
		}
	}
	function schedulePump() {
		if (pumpScheduled) return;
		pumpScheduled = true;
		Promise.resolve().then(pump);
	}
	function finishOne() {
		active -= 1;
		done(++count / total, mode);
		schedulePump();
	}
	function processFile(file) {
		if (skip(file)) {
			finishOne();
			return;
		}
		getFile(file.url, (res, err) => {
			if (err) {
				finishOne();
				return;
			}
			process({
				file,
				content: res,
				search,
				replace,
				options,
			});
			finishOne();
		});
	}
}
function searchInFile({ file, content, search }) {
	const matches = [];
	let text = `${file.name}`;
	let match;
	if (text.length > 30) {
		text = `...${text.slice(-30)}`;
	}
	while ((match = search.exec(content))) {
		const [word] = match;
		const start = match.index;
		const end = start + word.length;
		const position = {
			start: getLineColumn(content, start),
			end: getLineColumn(content, end),
		};
		const [line, renderText] = getSurrounding(content, word, start, end);
		text += `\n\t${line.trim()}`;
		matches.push({
			match: word,
			position,
			renderText,
			line: line.trim(),
		});
	}
	self.postMessage({
		action: "search-result",
		data: {
			file,
			matches,
			text,
		},
	});
}
function replaceInFile({ file, content, search, replace }) {
	const text = content.replace(search, replace);
	self.postMessage({
		action: "replace-result",
		data: {
			file,
			text,
		},
	});
}
function getSurrounding(content, word, start, end) {
	const max = 160;
	let lineStart = start;
	while (lineStart > 0) {
		const previous = content[lineStart - 1];
		if (previous === "\n" || previous === "\r") break;
		lineStart--;
	}
	let lineEnd = end;
	while (lineEnd < content.length) {
		const current = content[lineEnd];
		if (current === "\n" || current === "\r") break;
		lineEnd++;
	}
	let snippetStart = lineStart;
	let snippetEnd = lineEnd;
	if (lineEnd - lineStart > max) {
		const matchLength = Math.max(1, end - start);
		const remaining = Math.max(0, max - matchLength);
		const left = Math.floor(remaining / 2);
		const right = remaining - left;
		snippetStart = Math.max(lineStart, start - left);
		snippetEnd = Math.min(lineEnd, end + right);
	}
	let line = content.substring(snippetStart, snippetEnd).trim();
	if (snippetStart > lineStart) line = `...${line}`;
	if (snippetEnd < lineEnd) line = `${line}...`;
	return [line, word].map((text) => text.replace(/[\r\n]+/g, " ⏎ "));
}
function getLineColumn(file, position) {
	const lines = file.substring(0, position).split("\n");
	const lineNumber = lines.length - 1;
	const columnNumber = lines[lineNumber].length;
	return {
		row: lineNumber,
		column: columnNumber,
	};
}
function getFile(url, cb) {
	const id = Number.parseInt(Date.now() + Math.random() * 1000000);
	resolvers[id] = cb;
	self.postMessage({
		action: "get-file",
		data: url,
		id,
	});
}
function done(ratio, mode) {
	if (ratio === 1) {
		self.postMessage({
			action: "progress",
			data: 100,
		});
		self.postMessage({
			action: `done-${mode === "search" ? "searching" : "replacing"}`,
		});
	} else {
		self.postMessage({
			action: "progress",
			data: Math.floor(ratio * 100),
		});
	}
}
function Skip({ exclude, include }) {
	const userExcludes = (exclude ? exclude.split(",") : [])
		.map((p) => p.trim())
		.filter(Boolean);
	const excludeFiles = userExcludes;
	const includeFiles = (include ? include.split(",") : ["**"]).map((p) =>
		p.trim(),
	);
	function test(file) {
		if (!file.path) return false;
		if (isBinaryFile(file)) return true;
		const match = (pattern) =>
			picomatch.isMatch(file.path, pattern, {
				matchBase: true,
			});
		return excludeFiles.some(match) || !includeFiles.some(match);
	}
	return {
		test,
	};
}
