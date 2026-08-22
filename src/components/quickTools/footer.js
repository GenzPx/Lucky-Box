import { hideTooltip, showTooltip } from "components/tooltip";
import settings from "lib/settings";
import items, { description, ref } from "./items";
export const Row = ({ row }) => {
	const startIndex =
		(row - 1) * settings.QUICKTOOLS_GROUP_CAPACITY * settings.QUICKTOOLS_GROUPS;
	return (
		<div id={`row${row}`} className="button-container">
			{(() => {
				const sections = [];
				for (let i = 0; i < settings.QUICKTOOLS_GROUPS; ++i) {
					const section = [];
					for (let j = 0; j < settings.QUICKTOOLS_GROUP_CAPACITY; ++j) {
						const index =
							startIndex + (i * settings.QUICKTOOLS_GROUP_CAPACITY + j);
						const itemIndex = settings.value.quicktoolsItems[index];
						const item = items[itemIndex];
						section.push(<RowItem {...item} index={index} />);
					}
					sections.push(<div className="section">{section}</div>);
				}
				return sections;
			})()}
		</div>
	);
};
export const SearchRow1 = ({ inputRef }) => (
	<div className="button-container" id="search_row1">
		<input ref={inputRef} type="search" placeholder={strings.search} />
		<RowItem id="search-prev" icon="arrow_back" action="search-prev" />
		<RowItem id="search-next" icon="arrow_forward" action="search-next" />
		<RowItem id="search-settings" icon="settings" action="search-settings" />
		<RowItem id="close" icon="clearclose" action="toggle" />
	</div>
);
export const SearchRow2 = ({ inputRef, posRef, totalRef }) => (
	<div className="button-container" id="search_row2">
		<input ref={inputRef} type="text" placeholder={strings.replace} />
		<RowItem id="search-replace" icon="replace" action="search-replace" />
		<RowItem
			id="search-replace-all"
			icon="replace_all"
			action="search-replace-all"
		/>
		<div className="search-status">
			<span ref={posRef}>0</span>
			<span>of</span>
			<span ref={totalRef}>0</span>
		</div>
	</div>
);
export const $footer = <footer id="quick-tools" tabIndex={-1}></footer>;
export const $toggler = (
	<span
		className="floating icon keyboard_arrow_up hide"
		id="quicktools-toggler"
	></span>
);
export const $input = (
	<textarea
		autocapitalize="none"
		style={{
			opacity: 0,
			height: 0,
			width: 0,
			pointerEvent: "none",
			pointerEvents: "none",
			position: "fixed",
			top: 0,
			left: 0,
		}}
	></textarea>
);
export function RowItem({ id, icon, letters, action, value, ref, repeat }) {
	const $item = (
		<button
			ref={ref}
			className={`icon ${icon}`}
			data-id={id}
			data-letters={letters}
			data-action={action}
			data-repeat={repeat}
			vibrate="true"
			aria-label={id ? description(id) : ""}
		></button>
	);
	if (id) {
		$item.addEventListener("mouseenter", () => {
			showTooltip($item, description(id));
		});
		$item.addEventListener("mouseleave", () => {
			hideTooltip();
		});
	}
	if (typeof value === "function") {
		$item.value = value;
	} else if (value !== undefined) {
		$item.dataset.value = value;
	}
	return $item;
}
function Extras({ extras }) {
	const div = <div className="section"></div>;
	if (Array.isArray(extras)) {
		extras.forEach((i) => {
			if (i instanceof HTMLElement) {
				div.appendChild(i);
				return;
			}
			div.append(<RowItem {...i} />);
		});
	}
	return div;
}
