const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const configPath = path.join(root, "config.xml");
const menuPath = path.join(root, "platforms/android/app/src/main/java/com/foxdebug/browser/Menu.java");
if (!fs.existsSync(configPath) || !fs.existsSync(menuPath)) {
  process.exit(0);
}
const config = fs.readFileSync(configPath, "utf8");
const applicationId = /<widget[^>]*\sid=["']([^"']+)["']/.exec(config)?.[1];
if (!applicationId) throw new Error("Unable to read LuckyBox application ID");
const source = fs.readFileSync(menuPath, "utf8");
const updated = source.replace(/import\s+[A-Za-z0-9_.]+\.R;/, `import ${applicationId}.R;`);
fs.writeFileSync(menuPath, updated, "utf8");
console.log(`[LuckyBox] Browser resources linked to ${applicationId}.R`);
