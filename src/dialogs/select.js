import Checkbox from "components/checkbox";
import tile from "components/tile";
import DOMPurify from "dompurify";
import actionStack from "lib/actionStack";
import restoreTheme from "lib/restoreTheme";

function select(title, items, options = {}) {
	let rejectOnCancel = false;
	if (typeof options === "boolean") {
		rejectOnCancel = options;
		options = {};
	}
	return new Promise((res, rej) => {
		const { textTransform = false, hideOnSelect = true } = options;
		let $defaultVal;
		const $mask = <span className="mask" onclick={cancel}></span>;
		const $list = tag("ul", {
			className: `scroll${!textTransform ? " no-text-transform" : ""}`,
		});
		const $titleSpan = title ? (
			<strong className="title">{title}</strong>
		) : null;
		const $select = (
			<div className={`prompt select ${options.className || ""}`}>
				{$titleSpan ? [$titleSpan, $list] : $list}
			</div>
		);
		const tailClickHandlers = new Map();
		items.map((item) => {
			let lead,
				tail = null,
				itemOptions = {
					value: null,
					text: null,
					icon: null,
					disabled: false,
					letters: "",
					checkbox: null,
					tailElement: null,
					ontailclick: null,
					subText: null,
					className: null,
					title: null,
				};
			if (typeof item === "object") {
				if (Array.isArray(item)) {
					Object.keys(itemOptions).forEach(
						(key, i) => (itemOptions[key] = item[i]),
					);
					item.map((o, i) => {
						if (typeof o === "boolean" && i > 1) itemOptions.disabled = !o;
					});
				} else {
					itemOptions = Object.assign({}, itemOptions, item);
				}
			} else {
				itemOptions.value = item;
				itemOptions.text = item;
			}
			if (itemOptions.icon) {
				if (itemOptions.icon === "letters" && !!itemOptions.letters) {
					lead = (
						<i className="icon letters" data-letters={itemOptions.letters}></i>
					);
				} else {
					lead = <i className={`icon ${itemOptions.icon}`}></i>;
				}
			}
			if (itemOptions.tailElement) {
				tail = itemOptions.tailElement;
			} else if (itemOptions.checkbox != null) {
				tail = Checkbox({
					checked: itemOptions.checkbox,
				});
			}
			const $text = (
				<span
					className="text"
					innerHTML={DOMPurify.sanitize(itemOptions.text)}
				></span>
			);
			if (itemOptions.subText) {
				$text.classList.add("has-sub-text");
				$text.append(
					<span className="select-sub-text">
						<span className="select-sub-text-content">
							{itemOptions.subText}
						</span>
					</span>,
				);
			}
			const $item = tile({
				lead,
				tail,
				text: $text,
			});
			$item.tabIndex = "0";
			if (itemOptions.className) $item.classList.add(itemOptions.className);
			if (itemOptions.title) {
				$item.title = itemOptions.title;
				$item.setAttribute("aria-label", itemOptions.title);
			}
			if (itemOptions.disabled) $item.classList.add("disabled");
			if (options.default === itemOptions.value) {
				$item.classList.add("selected");
				$defaultVal = $item;
			}
			$item.onclick = function (e) {
				let target = e.target;
				while (target && target !== $item) {
					if (target.hasAttribute("data-action")) {
						e.stopPropagation();
						e.preventDefault();
						return false;
					}
					target = target.parentElement;
				}
				if (itemOptions.value === undefined) return;
				if (hideOnSelect) hide();
				res(itemOptions.value);
			};
			if (itemOptions.tailElement && itemOptions.ontailclick && tail) {
				tail.style.pointerEvents = "all";
				const tailClickHandler = function (e) {
					e.stopPropagation();
					e.preventDefault();
					itemOptions.ontailclick.call($item, e);
				};
				tail.addEventListener("click", tailClickHandler);
				tailClickHandlers.set(tail, tailClickHandler);
			}
			$list.append($item);
		});
		actionStack.push({
			id: "select",
			action: cancel,
		});
		app.append($select, $mask);
		if ($defaultVal) $defaultVal.scrollIntoView();
		const $firstChild = $defaultVal || $list.firstChild;
		if ($firstChild && $firstChild.focus) $firstChild.focus();
		restoreTheme(true);
		function cancel() {
			hide();
			if (typeof options.onCancel === "function") options.onCancel();
			if (rejectOnCancel) rej();
		}
		function hideSelect() {
			$select.classList.add("hide");
			restoreTheme();
			setTimeout(() => {
				$select.remove();
				$mask.remove();
			}, 300);
		}
		function hide() {
			if (typeof options.onHide === "function") options.onHide();
			actionStack.remove("select");
			hideSelect();
			let listItems = [...$list.children];
			listItems.map((item) => (item.onclick = null));
			tailClickHandlers.forEach((handler, element) => {
				element.removeEventListener("click", handler);
			});
			tailClickHandlers.clear();
		}
	});
}
export default select;
