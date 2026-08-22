import "./style.scss";
import { focusEditorIfEditable } from "cm/editorReadOnly";
import inputhints from "components/inputhints";
import keyboardHandler from "handlers/keyboard";
import actionStack from "lib/actionStack";
import restoreTheme from "lib/restoreTheme";

let activePalette = null;
export default function palette(
	getList,
	onsSelectCb,
	placeholder,
	onremove,
	options = {},
) {
	const previousPalette = activePalette;
	const isChained = !!previousPalette;
	const $input = (
		<input
			onkeydown={onkeydown}
			type="search"
			placeholder={placeholder}
			enterKeyHint="go"
		/>
	);
	const $mask = <div className="mask" onclick={remove} />;
	const $palette = <div id="palette">{$input}</div>;
	inputhints($input, generateHints, onSelect, options);
	if (!isChained) {
		restoreTheme(true);
	}
	$input.addEventListener("blur", remove);
	keyboardHandler.on("keyboardHideStart", remove);
	app.append($palette, $mask);
	if (isChained) {
		setTimeout(() => {
			$input.focus();
		}, 0);
	}
	$input.focus();
	$input.dispatchEvent(new Event("input"));
	actionStack.push({
		id: "palette",
		action: remove,
	});
	activePalette = {
		remove,
	};
	function onSelect(value) {
		const currentPalette = {
			remove,
		};
		activePalette = currentPalette;
		onsSelectCb(value);
		if (activePalette === currentPalette) {
			remove();
		}
	}
	function onkeydown(e) {
		if (e.key !== "Escape") return;
		remove();
	}
	async function generateHints(setHints, hintModification, query) {
		const list = getList(hintModification, query);
		const data = list instanceof Promise ? await list : list;
		setHints(data);
	}
	function remove() {
		actionStack.remove("palette");
		keyboardHandler.off("keyboardHideStart", remove);
		$input.removeEventListener("blur", remove);
		$palette.remove();
		$mask.remove();
		if (isChained && previousPalette) {
			activePalette = previousPalette;
		} else {
			activePalette = null;
			restoreTheme();
		}
		if (typeof onremove === "function") {
			onremove();
			return;
		}
		if (!isChained) {
			const { activeFile, editor } = editorManager;
			if (activeFile.wasFocused) {
				focusEditorIfEditable(editor);
			}
		}
		remove = () => {
			window.log("warn", "Palette already removed.");
		};
	}
}
