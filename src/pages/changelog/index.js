function plugin({ id, installed }, onInstall, onUninstall) {
	import("./changelog").then((res) => {
		const Changelog = res.default;
		Changelog();
	});
}
export default plugin;
