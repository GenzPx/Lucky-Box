import DOMPurify from "dompurify";
import Ref from "html-tag-js/ref";
import actionStack from "lib/actionStack";
import restoreTheme from "lib/restoreTheme";
import tailSpinSvg from "res/tail-spin.svg?raw";

let loaderIsImmortal = false;
let onCancelCallback = null;
let $currentDialog = null;
let $currentMask = null;
const titleLoaderId = "__title-loader";
const tailSpinGradientId = "tail-spin-gradient";
let tailSpinSvgId = 0;
function createTailSpinSvg() {
	const gradientId = `${tailSpinGradientId}-${tailSpinSvgId++}`;
	return tailSpinSvg.split(tailSpinGradientId).join(gradientId);
}
function create(titleText, message = "", options = {}) {
	if (!message && titleText) {
		message = titleText;
		titleText = "";
	}
	const $oldLoader = tag.get("#__loader");
	const $oldMask = tag.get("#__loader-mask");
	if ($oldLoader) $oldLoader.remove();
	const $message = Ref();
	const $titleSpan = Ref();
	const $mask = $oldMask || <span className="mask" id="__loader-mask"></span>;
	const $dialog = $oldLoader || (
		<div className="prompt alert" id="__loader">
			<strong ref={$titleSpan} className="title">
				{titleText}
			</strong>
			<span className="message loader">
				<span className="loader" innerHTML={createTailSpinSvg()}></span>
				<div
					ref={$message}
					className="message"
					innerHTML={DOMPurify.sanitize(message)}
					style={{
						whiteSpace: "pre-wrap",
					}}
				></div>
			</span>
		</div>
	);
	const { timeout, oncancel } = options;
	if (typeof oncancel === "function") {
		onCancelCallback = oncancel;
	}
	if (typeof timeout === "number") {
		setTimeout(() => {
			$dialog.append(
				<div className="button-container">
					<button onclick={destroy}>{strings.cancel}</button>
				</div>,
			);
		}, timeout);
	}
	if (!$oldLoader) {
		actionStack.freeze();
		document.body.append($dialog, $mask);
		restoreTheme(true);
	}
	return {
		setTitle(title) {
			$titleSpan.textContent = title;
		},
		setMessage(message) {
			$message.innerHTML = DOMPurify.sanitize(message);
		},
		hide,
		show,
		destroy,
	};
}
function createTitleLoader() {
	const $titleLoader = tag.get(`#${titleLoaderId}`) || (
		<span id={titleLoaderId} innerHTML={createTailSpinSvg()}></span>
	);
	if (!$titleLoader.isConnected) {
		app.append($titleLoader);
	}
	return $titleLoader;
}
function destroy() {
	const loaderDiv = tag.get("#__loader");
	const mask = tag.get("#__loader-mask");
	restoreTheme();
	if (!loaderDiv && !mask) {
		actionStack.unfreeze();
		return;
	}
	loaderDiv?.classList.add("hide");
	setTimeout(() => {
		actionStack.unfreeze();
		if (loaderDiv?.isConnected) loaderDiv.remove();
		if (mask?.isConnected) mask.remove();
		onCancelCallback?.();
	}, 300);
}
function hide() {
	const loaderDiv = tag.get("#__loader");
	const mask = tag.get("#__loader-mask");
	if (loaderDiv) {
		$currentDialog = loaderDiv;
		loaderDiv.remove();
	}
	if (mask) {
		$currentMask = mask;
		mask.remove();
	}
}
function show() {
	if ($currentDialog) {
		app.append($currentDialog);
		$currentDialog = null;
	}
	if ($currentMask) {
		app.append($currentMask);
		$currentMask = null;
	}
}
function showTitleLoader(immortal = false) {
	if (typeof immortal === "boolean") {
		loaderIsImmortal = immortal;
	}
	setTimeout(() => {
		createTitleLoader();
		app.classList.remove("title-loading-hide");
		app.classList.add("title-loading");
	}, 0);
}
function removeTitleLoader(immortal = undefined) {
	if (typeof immortal === "boolean") {
		loaderIsImmortal = immortal;
	}
	if (loaderIsImmortal) return;
	setTimeout(() => {
		app.classList.add("title-loading-hide");
	}, 0);
}
export default {
	create,
	destroy,
	hide,
	show,
	showTitleLoader,
	removeTitleLoader,
};
