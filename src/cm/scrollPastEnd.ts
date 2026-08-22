import { type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
export function horizontalScrollPastEnd(distance: number): Extension {
  const width = Number.isFinite(distance) ? Math.max(0, Math.round(distance)) : 0;
  if (width === 0) return [];
  return EditorView.theme({
    ".cm-content:not(.cm-lineWrapping) .cm-line": {
      boxSizing: "border-box",
      minWidth: "100%",
      paddingRight: `${width + 2}px`,
      width: "fit-content"
    }
  });
}
export function scrollPastEndCustom(factor: number): Extension {
  if (factor <= 0) {
    return [];
  }
  const plugin = ViewPlugin.fromClass(class {
    height = 0;
    attrs = {
      style: ""
    };
    update(update: ViewUpdate) {
      const {
        view
      } = update;
      const anyView = view as any;
      const maxScrollHeight = (anyView.viewState?.editorHeight ?? 0) - view.defaultLineHeight - (anyView.documentPadding?.top ?? 0) - 0.5;
      const height = Math.max(0, Math.round(maxScrollHeight * factor));
      if (height !== this.height) {
        this.height = height;
        this.attrs = {
          style: `padding-bottom: ${height}px`
        };
      }
    }
  });
  return [plugin, EditorView.contentAttributes.of(view => view.plugin(plugin)?.attrs || null)];
}
export default scrollPastEndCustom;
