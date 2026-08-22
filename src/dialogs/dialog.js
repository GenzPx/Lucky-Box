import "./style.scss";
import actionStack from "lib/actionStack";
import restoreTheme from "lib/restoreTheme";

function dialog(titleText, html, hideButtonText, cancelButtonText) {
	let waitFor = 0,
		strOK = hideButtonText || strings.ok,
		_onclick = () => {},
		_onhide = () => {},
		_then = () => {},
		_onOk = _hide,
		_onCancel = () => {};
	const promiseLike = {
		hide,
		wait,
		onclick,
		onhide,
		then,
		ok,
		cancel,
	};
	let cancelBtn;
	let hideButton = typeof hideButtonText === "boolean" ? hideButtonText : false;
	if (cancelButtonText) {
		cancelBtn = tag("button", {
			className: "disabled",
			textContent: cancelButtonText,
			onclick: () => {
				_onCancel();
			},
		});
	}
	const okBtn = tag("button", {
		className: "disabled",
		textContent: strOK,
		onclick: () => {
			_onOk();
		},
	});
	const body = tag("div", {
		className: "message",
		innerHTML: html,
		onclick: __onclick,
	});
	const box = tag("div", {
		className: "prompt box",
		children: [
			tag("strong", {
				className: "title",
				textContent: titleText,
			}),
			body,
		],
	});
	const mask = tag("span", {
		className: "mask",
		onclick: _hide,
	});
	if (!hideButton) {
		box.append(
			tag("div", {
				className: "button-container",
				children: cancelBtn ? [cancelBtn, okBtn] : [okBtn],
			}),
		);
	}
	setTimeout(() => {
		decTime();
		actionStack.push({
			id: "box",
			action: hideBox,
		});
		document.body.append(box, mask);
		__then();
		restoreTheme(true);
	}, 0);
	function decTime() {
		if (waitFor >= 1000) {
			okBtn.textContent = `${strOK} (${Number.parseInt(waitFor / 1000)}sec)`;
			waitFor -= 1000;
			setTimeout(decTime, 1000);
		} else {
			okBtn.textContent = strOK;
			okBtn.classList.remove("disabled");
			cancelBtn?.classList.remove("disabled");
		}
	}
	function hideBox() {
		box.classList.add("hide");
		restoreTheme();
		setTimeout(() => {
			document.body.removeChild(box);
			document.body.removeChild(mask);
		}, 300);
	}
	function hide() {
		if (waitFor) return;
		const imgs = box.getAll("img");
		if (imgs) {
			for (let img of imgs) {
				URL.revokeObjectURL(img.src);
			}
		}
		actionStack.remove("box");
		hideBox();
	}
	function _hide() {
		hide();
		if (_onhide) _onhide.call(promiseLike);
	}
	function wait(time) {
		time -= time % 1000;
		waitFor = time;
		return promiseLike;
	}
	function __onclick(e) {
		if (_onclick) _onclick.call(this, e);
	}
	function __then() {
		if (_then) _then(body.children);
	}
	function then(callback) {
		_then = callback;
		return promiseLike;
	}
	function onclick(onclick) {
		_onclick = onclick;
		return promiseLike;
	}
	function onhide(onhide) {
		_onhide = onhide;
		return promiseLike;
	}
	function ok(onOk) {
		_onOk = onOk;
		return promiseLike;
	}
	function cancel(onCancel) {
		_onCancel = onCancel;
		return promiseLike;
	}
	return promiseLike;
}
export default dialog;
