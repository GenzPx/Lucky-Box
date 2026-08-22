export default function themeSetting(...args) {
	import("./themeSetting").then((module) => {
		module.default(...args);
	});
}
