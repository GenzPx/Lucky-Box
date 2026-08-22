function plugin({ id, installed }, onInstall, onUninstall) {
	import("./problems").then((res) => {
		const Problems = res.default;
		Problems();
	});
}
export default plugin;
