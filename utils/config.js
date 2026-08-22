const fs = require("node:fs");
const path = require("node:path");

const APPLICATION_ID = "id.luckybox.server";
const DISPLAY_NAME = "LuckyBox";

function configureProject({
	mode = "d",
	rootDir = path.resolve(__dirname, ".."),
} = {}) {
	const configPath = path.join(rootDir, "config.xml");
	const babelPath = path.join(rootDir, ".babelrc");
	const colorPath = path.join(
		rootDir,
		"res/android/values/ic_launcher_background.xml",
	);

	let config = fs.readFileSync(configPath, "utf8");
	config = config.replace(
		/(<widget[^>]*?\sid=["'])[^"']+(["'])/,
		`$1${APPLICATION_ID}$2`,
	);
	config = config.replace(
		/<name>[\s\S]*?<\/name>/,
		`<name>${DISPLAY_NAME}</name>`,
	);
	fs.writeFileSync(configPath, config, "utf8");

	const babel = JSON.parse(fs.readFileSync(babelPath, "utf8"));
	babel.compact = mode === "p" || mode === "prod";
	fs.writeFileSync(
		babelPath,
		`${JSON.stringify(babel, undefined, 2)}\n`,
		"utf8",
	);

	fs.mkdirSync(path.dirname(colorPath), { recursive: true });
	fs.writeFileSync(
		colorPath,
		'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0B0B</color>\n    <color name="ic_splash_background">#0B0B0B</color>\n</resources>\n',
		"utf8",
	);

	return { applicationId: APPLICATION_ID, displayName: DISPLAY_NAME };
}

if (require.main === module) {
	configureProject({ mode: process.argv[2] || "d" });
}

module.exports = { APPLICATION_ID, DISPLAY_NAME, configureProject };
