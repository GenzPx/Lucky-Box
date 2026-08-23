const plugins = Object.freeze([
	{
		id: "luckybox.git-commit",
		name: "Git Commit",
		description:
			"Initialize repositories, review status, stage files, and create local commits.",
		icon: "git",
		load: () => import("modules/gitCommit"),
	},
	{
		id: "luckybox.archive-tools",
		name: "Archive Tools",
		description: "Create, inspect, verify, and safely extract ZIP archives.",
		icon: "zip",
		load: () => import("modules/archive/zipArchive"),
	},
	{
		id: "luckybox.checksum-tools",
		name: "Checksum Tools",
		description:
			"Generate and verify SHA-1, SHA-256, SHA-384, and SHA-512 checksums.",
		icon: "verified",
		load: () => import("modules/checksum/checksum"),
	},
	{
		id: "luckybox.project-insights",
		name: "Project Insights",
		description:
			"Summarize project files, sizes, extensions, and TODO markers.",
		icon: "insert_chartpollassessment",
		load: () => import("modules/projectInsights"),
	},
]);
export function listBuiltinPlugins() {
	return plugins.map(({ load, ...plugin }) => ({ ...plugin, builtIn: true }));
}
export async function loadBuiltinPlugin(id) {
	const plugin = plugins.find((entry) => entry.id === id);
	if (!plugin) throw new Error(`Built-in plugin not found: ${id}`);
	return plugin.load();
}
