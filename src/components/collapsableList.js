import tag from "html-tag-js";
import tile from "./tile";
export default function collapsableList(
	titleText,
	type = "indicator",
	options = {},
) {
	let onscroll = null;
	const $ul = tag("ul", {
		className: "scroll",
		onscroll: onUlScroll,
	});
	const $collapseIndicator = tag("span", {
		className: `icon ${type}`,
	});
	const $title = tile({
		lead: $collapseIndicator,
		type: "div",
		text: options.allCaps ? titleText.toUpperCase() : titleText,
		tail: options.tail,
	});
	const $mainWrapper = tag(options.type || "div", {
		className: "list collapsible hidden",
		children: [$title, $ul],
	});
	let collapse = () => {
		$mainWrapper.classList.add("hidden");
		if ($mainWrapper.ontoggle) $mainWrapper.ontoggle.call($mainWrapper);
		delete $ul.dataset.scrollTop;
	};
	let expand = () => {
		$mainWrapper.classList.remove("hidden");
		if ($mainWrapper.ontoggle) $mainWrapper.ontoggle.call($mainWrapper);
	};
	$title.classList.add("light");
	$title.addEventListener("click", toggle);
	[$title, $mainWrapper].forEach(defineProperties);
	$mainWrapper.dataset.id = `${Math.random().toString(36).substring(2, 15)}`;
	return $mainWrapper;
	function onUlScroll() {
		if (onscroll) onscroll.call($ul);
		$ul.dataset.scrollTop = $ul.scrollTop;
	}
	function toggle() {
		if ($title.collapsed) {
			expand();
		} else {
			collapse();
		}
	}
	function defineProperties($el) {
		Object.defineProperties($el, {
			$title: {
				get() {
					return $title;
				},
			},
			$ul: {
				get() {
					return $ul;
				},
			},
			ontoggle: {
				get() {
					return options.ontoggle;
				},
				set(fun) {
					if (typeof fun === "function") options.ontoggle = fun;
				},
			},
			collapse: {
				get() {
					return collapse || (() => {});
				},
				set(fun) {
					if (typeof fun === "function") collapse = fun;
				},
			},
			expand: {
				get() {
					return expand || (() => {});
				},
				set(fun) {
					if (typeof fun === "function") expand = fun;
				},
			},
			collapsed: {
				get() {
					return $mainWrapper.classList.contains("hidden");
				},
			},
			unclasped: {
				get() {
					return !this.collapsed;
				},
			},
			onscroll: {
				get() {
					return onscroll;
				},
				set(fun) {
					if (typeof fun === "function") {
						onscroll = fun;
					}
				},
			},
			scrollTop: {
				get() {
					return $ul.dataset.scrollTop || 0;
				},
				set(val) {
					$ul.dataset.scrollTop = val;
					$ul.scrollTop = val;
				},
			},
		});
	}
}
