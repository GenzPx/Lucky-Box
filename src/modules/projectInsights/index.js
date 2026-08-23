import fsOperation from "fileSystem";
import Url from "utils/Url";

const sourcePattern =
	/\.(?:js|mjs|ts|tsx|jsx|java|kt|py|php|html|css|scss|json|xml|md)$/i;
const todoPattern = /\b(?:TODO|FIXME|HACK|NOTE)\b[:\s-]*(.*)/gi;
export async function inspectProject(rootUri, options = {}) {
	const maxFiles = Math.max(10, Number(options.maxFiles) || 2000);
	const maxTextSize = Math.max(1024, Number(options.maxTextSize) || 512 * 1024);
	const result = {
		files: 0,
		folders: 0,
		bytes: 0,
		extensions: {},
		todos: [],
		truncated: false,
	};
	const visit = async (uri) => {
		if (result.files >= maxFiles) {
			result.truncated = true;
			return;
		}
		for (const entry of await fsOperation(uri).lsDir()) {
			if (entry.name === ".git" || entry.name === "node_modules") continue;
			if (entry.isDirectory) {
				result.folders += 1;
				await visit(entry.url);
				continue;
			}
			result.files += 1;
			const extension =
				Url.extname(entry.name || entry.url).toLowerCase() || "[none]";
			result.extensions[extension] = (result.extensions[extension] || 0) + 1;
			let stats;
			try {
				stats = await fsOperation(entry.url).stat();
				result.bytes += Number(stats.size) || 0;
			} catch {}
			if (
				!sourcePattern.test(entry.name || entry.url) ||
				Number(stats?.size) > maxTextSize
			)
				continue;
			try {
				const text = await fsOperation(entry.url).readFile("utf-8");
				for (const match of text.matchAll(todoPattern)) {
					const before = text.slice(0, match.index);
					result.todos.push({
						file: entry.url,
						line: before.split("\n").length,
						type: match[0].match(/TODO|FIXME|HACK|NOTE/i)?.[0].toUpperCase(),
						text: match[1]?.trim() || "",
					});
				}
			} catch {}
		}
	};
	await visit(rootUri);
	return result;
}
