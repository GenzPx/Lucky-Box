import type { Extension } from "@codemirror/state";
import { EditorView, type EditorView as CodeMirrorEditorView } from "@codemirror/view";
import { blurEditorIfReadOnly, focusEditorIfEditable } from "cm/editorReadOnly";
export interface QuickToolsModifierInputContext {
  from: number;
  to: number;
  text: string;
}
type QuickToolsModifierInputHandler = (view: CodeMirrorEditorView, input: QuickToolsModifierInputContext) => boolean | void;
let handleTextInput: QuickToolsModifierInputHandler = () => false;
export function setQuickToolsModifierInputHandler(handler: QuickToolsModifierInputHandler): void {
  handleTextInput = typeof handler === "function" ? handler : () => false;
}
export function isSelectedRangeDeletion(view: CodeMirrorEditorView, input: QuickToolsModifierInputContext): boolean {
  const selection = view?.state?.selection?.main;
  if (!selection || selection.empty || input.text !== "") return false;
  return input.from <= selection.from && input.to >= selection.to;
}
export function canQuickToolsEdit(view: CodeMirrorEditorView): boolean {
  return !view.state.readOnly;
}
export function focusQuickToolsModifierInput(view: CodeMirrorEditorView, captureInput: HTMLElement): boolean {
  if (!view.state.readOnly) {
    focusEditorIfEditable(view);
    return false;
  }
  blurEditorIfReadOnly(view, true);
  captureInput.focus();
  return true;
}
export function finishQuickToolsModifierInput(view: CodeMirrorEditorView, captureInput: HTMLElement): boolean {
  if (!view.state.readOnly) return false;
  captureInput.blur();
  blurEditorIfReadOnly(view, true);
  return true;
}
export default function quickToolsModifierInput(): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    const handled = !!handleTextInput(view, {
      from,
      to,
      text
    });
    return view.state.readOnly || handled;
  });
}
