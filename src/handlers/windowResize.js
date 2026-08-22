let resizeTimeout;
const event = {
	resize: [],
	resizeStart: [],
};
export default function windowResize() {
	if (!resizeTimeout) {
		emit("resizeStart");
	}
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(onResize, 100);
}
windowResize.on = (eventName, callback) => {
	if (!event[eventName]) return;
	event[eventName].push(callback);
};
windowResize.off = (eventName, callback) => {
	if (!event[eventName]) return;
	event[eventName] = event[eventName].filter((cb) => cb !== callback);
};
function onResize() {
	resizeTimeout = null;
	emit("resize");
}
function emit(eventName) {
	if (!event[eventName]) return;
	event[eventName].forEach((cb) => cb());
}
