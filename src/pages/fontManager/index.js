export default function fontManager(...args) {
	import("./fontManager").then((module) => {
		module.default(...args);
	});
}
