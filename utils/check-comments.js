const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");

const root = path.resolve(__dirname, "..");
const roots = ["src", "hooks", "utils", "tests", ".github"];
const rootFiles = ["config.xml", "build-extras.gradle"];
const exclusions = [
	"src/plugins/cordova-plugin-advanced-http/",
	"node_modules/",
	"platforms/",
	"plugins/",
	"www/build/",
];
const failures = [];

for (const file of [
	...roots.flatMap((value) => walk(path.join(root, value))),
	...rootFiles.map((value) => path.join(root, value)).filter(fs.existsSync),
]) {
	const relative = path.relative(root, file).replaceAll("\\", "/");
	if (exclusions.some((value) => relative.startsWith(value))) continue;
	const extension = path.extname(file).toLowerCase();
	const source = fs.readFileSync(file, "utf8");
	if ([".js", ".mjs", ".ts", ".tsx"].includes(extension)) {
		const ast = parser.parse(source, {
			sourceType: "unambiguous",
			allowReturnOutsideFunction: true,
			plugins: [
				...([".ts", ".tsx"].includes(extension) ? ["typescript"] : []),
				"jsx",
				"decorators-legacy",
				"classProperties",
				"classPrivateProperties",
				"classPrivateMethods",
				"dynamicImport",
				"importAssertions",
				"topLevelAwait",
			],
		});
		if (ast.comments?.length) failures.push(relative);
		continue;
	}
	if ([".java", ".gradle", ".scss"].includes(extension)) {
		if (hasCLikeComment(source, true)) failures.push(relative);
		continue;
	}
	if (extension === ".css") {
		if (hasCLikeComment(source, false)) failures.push(relative);
		continue;
	}
	if ([".xml", ".html", ".hbs", ".svg"].includes(extension)) {
		if (source.includes("<!--")) failures.push(relative);
		continue;
	}
	if ([".sh", ".yml", ".yaml", ".grammar"].includes(extension)) {
		const lines = source.split(/\r?\n/);
		const found = lines.some((line, index) => {
			const value = line.trimStart();
			if (extension === ".sh" && index === 0 && value.startsWith("#!"))
				return false;
			return (
				value.startsWith("#") ||
				(extension === ".grammar" && value.startsWith("//"))
			);
		});
		if (found) failures.push(relative);
	}
}

if (failures.length) {
	console.error(`Source comments found:\n${failures.join("\n")}`);
	process.exit(1);
}
console.log("First-party source comment check passed");

function walk(target, output = []) {
	if (!fs.existsSync(target)) return output;
	const stat = fs.statSync(target);
	if (stat.isFile()) {
		output.push(target);
		return output;
	}
	for (const entry of fs.readdirSync(target))
		walk(path.join(target, entry), output);
	return output;
}

function hasCLikeComment(source, lineComments) {
	let state = "code";
	for (let index = 0; index < source.length; index += 1) {
		const value = source[index];
		const next = source[index + 1] || "";
		if (state === "code") {
			if (value === '"') state = "double";
			else if (value === "'") state = "single";
			else if (value === "/" && next === "*") return true;
			else if (lineComments && value === "/" && next === "/") return true;
		} else if (state === "double") {
			if (value === "\\") index += 1;
			else if (value === '"') state = "code";
		} else if (state === "single") {
			if (value === "\\") index += 1;
			else if (value === "'") state = "code";
		}
	}
	return false;
}
