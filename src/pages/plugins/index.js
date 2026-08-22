function plugins(updates) {
	import("./plugins").then((res) => {
		const Plugins = res.default;
		Plugins(updates);
	});
}
export default plugins;
