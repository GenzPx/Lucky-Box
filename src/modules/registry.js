export const MODULE_STATUS = Object.freeze({
	ACTIVE: "active",
	FOUNDATION: "foundation",
	PLANNED: "planned",
});
const modules = Object.freeze([
	module("editor", "Code Editor", "ACTIVE", "text_format"),
	module("workspace", "Smart Workspace", "PLANNED", "dashboard"),
	module("files", "Project Explorer", "ACTIVE", "folder_open"),
	module("archive", "Archive Manager", "FOUNDATION", "zip"),
	module("devtools", "Browser DevTools", "FOUNDATION", "public"),
	module("elements", "Elements & Live Edit", "PLANNED", "code"),
	module("network", "Network Inspector", "FOUNDATION", "swap_horiz"),
	module("api-client", "API Client", "PLANNED", "send"),
	module("device-lab", "Device Lab", "PLANNED", "devices"),
	module("performance", "Performance Analyzer", "PLANNED", "speed"),
	module(
		"accessibility",
		"Accessibility Inspector",
		"PLANNED",
		"accessibility",
	),
	module("time-machine", "Time Machine", "PLANNED", "historyrestore"),
	module("git", "Git Commit", "ACTIVE", "git"),
	module("plugins", "Plugins & Permissions", "ACTIVE", "extension"),
	module("viewers", "Built-in Viewers", "PLANNED", "visibility"),
	module("operations", "Operation Queue", "ACTIVE", "cached"),
	module("toolbar", "Custom Mobile Toolbar", "ACTIVE", "build"),
	module("checksum", "Checksums & Metadata", "FOUNDATION", "verified"),
	module(
		"project-insights",
		"Project Insights",
		"FOUNDATION",
		"insert_chartpollassessment",
	),
]);
export function listModules({ status } = {}) {
	return modules.filter((entry) => !status || entry.status === status);
}
export function getModule(id) {
	return modules.find((entry) => entry.id === id) || null;
}
export async function loadModule(id) {
	switch (id) {
		case "archive":
			return await import("./archive/zipArchive");
		case "operations":
			return await import("./operationQueue/OperationQueue");
		case "checksum":
			return await import("./checksum/checksum");
		case "network":
			return await import("../devtools/network/NetworkSession");
		case "git":
			return await import("./gitCommit");
		case "project-insights":
			return await import("./projectInsights");
		default:
			throw new Error(`Module '${id}' does not expose a lazy entry point yet`);
	}
}
function module(id, name, status, icon) {
	return Object.freeze({
		id,
		name,
		status: MODULE_STATUS[status],
		icon,
	});
}
