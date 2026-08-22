const keys = {
	37: "ArrowLeft",
	38: "ArrowUp",
	39: "ArrowRight",
	40: "ArrowDown",
	8: "Backspace",
	9: "Tab",
	13: "Enter",
	16: "ShiftLeft",
	17: "ControlLeft",
	18: "AltLeft",
	19: "Pause",
	20: "CapsLock",
	27: "Escape",
	32: " ",
	33: "PageUp",
	34: "PageDown",
	35: "End",
	36: "Home",
	45: "Insert",
	46: "Delete",
};
const initKeyboardEventType = (function (event) {
	try {
		event.initKeyboardEvent(
			"keyup",
			false,
			false,
			window,
			"+",
			3,
			true,
			false,
			true,
			false,
			false,
		);
		return (
			((((event["keyIdentifier"] || event["key"]) === "+" &&
				event["location"]) ||
				event["keyLocation"] === 3) &&
				(event.ctrlKey ? (event.altKey ? 1 : 3) : event.shiftKey ? 2 : 4)) ||
			9
		);
	} catch (error) {
		initKeyboardEventType = 0;
	}
})(document.createEvent("KeyboardEvent"));
const keyboardEventPropertiesDictionary = {
	char: "",
	key: "",
	location: 0,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	metaKey: false,
	repeat: false,
	locale: "",
	detail: 0,
	bubbles: false,
	cancelable: false,
	keyCode: 0,
	charCode: 0,
	which: 0,
};
const own = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const ObjectDefineProperty =
	Object.defineProperty ||
	function (obj, prop, val) {
		if ("value" in val) {
			obj[prop] = val["value"];
		}
	};
export default function KeyboardEvent(type, dict) {
	let event;
	if (initKeyboardEventType) {
		event = document.createEvent("KeyboardEvent");
	} else {
		event = document.createEvent("Event");
	}
	let propName;
	let localDict = {};
	if (!dict.key && (dict.keyCode || dict.which)) {
		let key = keys[dict.keyCode || dict.which];
		if (!key) key = String.fromCharCode(dict.keyCode || dict.which);
		dict.key = key;
	} else if (dict.key && !dict.which && !dict.keyCode) {
		let keyCode = Object.keys(keys).find((key) => keys[key] === dict.key);
		if (!keyCode) keyCode = dict.key.charCodeAt(0);
		dict.keyCode = keyCode;
		dict.which = keyCode;
	}
	for (propName in keyboardEventPropertiesDictionary)
		if (own(keyboardEventPropertiesDictionary, propName)) {
			localDict[propName] = ((own(dict, propName) && dict) ||
				keyboardEventPropertiesDictionary)[propName];
		}
	const ctrlKey = localDict["ctrlKey"];
	const shiftKey = localDict["shiftKey"];
	const altKey = localDict["altKey"];
	const metaKey = localDict["metaKey"];
	const altGraphKey = localDict["altGraphKey"];
	const modifiersListArg =
		initKeyboardEventType > 3
			? (
					(ctrlKey ? "Control" : "") +
					(shiftKey ? " Shift" : "") +
					(altKey ? " Alt" : "") +
					(metaKey ? " Meta" : "") +
					(altGraphKey ? " AltGraph" : "")
				).trim()
			: null;
	const key = localDict["key"] + "";
	const char = localDict["char"] + "";
	const location = localDict["location"];
	const keyCode =
		localDict["keyCode"] ||
		(localDict["keyCode"] = (key && key.charCodeAt(0)) || 0);
	const charCode =
		localDict["charCode"] ||
		(localDict["charCode"] = (char && char.charCodeAt(0)) || 0);
	const bubbles = localDict["bubbles"];
	const cancelable = localDict["cancelable"];
	const repeat = localDict["repeat"];
	const locale = localDict["locale"];
	const view = window;
	localDict["which"] || (localDict["which"] = localDict["keyCode"]);
	if ("initKeyEvent" in event) {
		event.initKeyEvent(
			type,
			bubbles,
			cancelable,
			view,
			ctrlKey,
			altKey,
			shiftKey,
			metaKey,
			keyCode,
			charCode,
		);
	} else if (initKeyboardEventType && "initKeyboardEvent" in event) {
		if (initKeyboardEventType === 1) {
			event.initKeyboardEvent(
				type,
				bubbles,
				cancelable,
				view,
				key,
				location,
				ctrlKey,
				shiftKey,
				altKey,
				metaKey,
				altGraphKey,
			);
		} else if (initKeyboardEventType === 2) {
			event.initKeyboardEvent(
				type,
				bubbles,
				cancelable,
				view,
				ctrlKey,
				altKey,
				shiftKey,
				metaKey,
				keyCode,
				charCode,
			);
		} else if (initKeyboardEventType === 3) {
			event.initKeyboardEvent(
				type,
				bubbles,
				cancelable,
				view,
				key,
				location,
				ctrlKey,
				altKey,
				shiftKey,
				metaKey,
				altGraphKey,
			);
		} else if (initKeyboardEventType === 4) {
			event.initKeyboardEvent(
				type,
				bubbles,
				cancelable,
				view,
				key,
				location,
				modifiersListArg,
				repeat,
				locale,
			);
		} else {
			event.initKeyboardEvent(
				type,
				bubbles,
				cancelable,
				view,
				char,
				key,
				location,
				modifiersListArg,
				repeat,
				locale,
			);
		}
	} else {
		event.initEvent(type, bubbles, cancelable);
	}
	for (propName in keyboardEventPropertiesDictionary)
		if (own(keyboardEventPropertiesDictionary, propName)) {
			if (event[propName] !== localDict[propName]) {
				try {
					delete event[propName];
					ObjectDefineProperty(event, propName, {
						writable: true,
						value: localDict[propName],
					});
				} catch (error) {}
			}
		}
	return event;
}
