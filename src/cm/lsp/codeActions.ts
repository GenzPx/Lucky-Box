import { LSPPlugin } from "@codemirror/lsp-client";
import { EditorView } from "@codemirror/view";
import { focusEditorIfEditable } from "cm/editorReadOnly";
import toast from "components/toast";
import select from "dialogs/select";
import type { CodeAction, CodeActionContext, CodeActionKind, Command, Diagnostic, Range as LspRange, WorkspaceEdit } from "vscode-languageserver-types";
import type { Position, Range } from "./types";
import { addLspLogFor } from "./logs";
import type AcodeWorkspace from "./workspace";
type CodeActionResponse = (CodeAction | Command)[] | null;
const CODE_ACTION_KINDS = {
  QUICK_FIX: "quickfix",
  REFACTOR: "refactor",
  REFACTOR_EXTRACT: "refactor.extract",
  REFACTOR_INLINE: "refactor.inline",
  REFACTOR_REWRITE: "refactor.rewrite",
  SOURCE: "source",
  SOURCE_ORGANIZE_IMPORTS: "source.organizeImports",
  SOURCE_FIX_ALL: "source.fixAll"
} as const;
const CODE_ACTION_ICONS: Record<string, string> = {
  quickfix: "build",
  refactor: "code",
  "refactor.extract": "call_split",
  "refactor.inline": "call_merge",
  "refactor.rewrite": "edit",
  source: "settings",
  "source.organizeImports": "sort",
  "source.fixAll": "done_all"
};
function getCodeActionIcon(kind?: CodeActionKind): string {
  if (!kind) return "icon zap";
  for (const [prefix, icon] of Object.entries(CODE_ACTION_ICONS)) {
    if (kind.startsWith(prefix)) return icon;
  }
  return "icon zap";
}
function formatCodeActionKind(kind?: CodeActionKind): string {
  if (!kind) return "";
  return kind.split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" › ");
}
function isCommand(item: CodeAction | Command): item is Command {
  return "command" in item && typeof item.command === "string" && !("edit" in item);
}
function lspPositionToOffset(doc: {
  line: (n: number) => {
    from: number;
  };
}, pos: Position): number {
  return doc.line(pos.line + 1).from + pos.character;
}
async function requestCodeActions(plugin: LSPPlugin, range: LspRange, diagnostics: Diagnostic[] = []): Promise<CodeActionResponse> {
  const context: CodeActionContext = {
    diagnostics,
    triggerKind: 1
  };
  return plugin.client.request<{
    textDocument: {
      uri: string;
    };
    range: LspRange;
    context: CodeActionContext;
  }, CodeActionResponse>("textDocument/codeAction", {
    textDocument: {
      uri: plugin.uri
    },
    range,
    context
  });
}
async function resolveCodeAction(plugin: LSPPlugin, action: CodeAction): Promise<CodeAction> {
  if (action.edit) return action;
  const capabilities = plugin.client.serverCapabilities;
  const provider = capabilities?.codeActionProvider;
  const supportsResolve = typeof provider === "object" && provider !== null && "resolveProvider" in provider && provider.resolveProvider === true;
  if (!supportsResolve) return action;
  try {
    const resolved = await plugin.client.request<CodeAction, CodeAction>("codeAction/resolve", action);
    return resolved ?? action;
  } catch (error) {
    addLspLogFor(plugin, "warn", "Code action resolve failed", error);
    console.warn("[LSP:CodeAction] Failed to resolve:", error);
    return action;
  }
}
async function executeCommand(plugin: LSPPlugin, command: Command): Promise<boolean> {
  try {
    await plugin.client.request<{
      command: string;
      arguments?: unknown[];
    }, unknown>("workspace/executeCommand", {
      command: command.command,
      arguments: command.arguments
    });
    return true;
  } catch (error) {
    const lspError = error as {
      code?: number;
    };
    if (lspError?.code !== -32601) {
      addLspLogFor(plugin, "warn", "Code action command execution failed", error);
      console.warn("[LSP:CodeAction] Command execution failed:", error);
    }
    return false;
  }
}
interface LspChange {
  range: Range;
  newText: string;
}
async function applyChangesToFile(workspace: AcodeWorkspace, uri: string, changes: LspChange[], mapping: {
  mapPosition: (uri: string, pos: Position) => number;
}): Promise<boolean> {
  const file = workspace.getFile(uri);
  if (file) {
    const view = file.getView();
    if (view) {
      view.dispatch({
        changes: changes.map(c => ({
          from: mapping.mapPosition(uri, c.range.start),
          to: mapping.mapPosition(uri, c.range.end),
          insert: c.newText
        })),
        userEvent: "codeAction"
      });
      return true;
    }
  }
  const displayedView = await workspace.displayFile(uri);
  if (!displayedView?.state?.doc) {
    addLspLogFor(workspace.client, "warn", `Code action could not open file: ${uri}`);
    console.warn(`[LSP:CodeAction] Could not open file: ${uri}`);
    return false;
  }
  displayedView.dispatch({
    changes: changes.map(c => ({
      from: lspPositionToOffset(displayedView.state.doc, c.range.start),
      to: lspPositionToOffset(displayedView.state.doc, c.range.end),
      insert: c.newText
    })),
    userEvent: "codeAction"
  });
  return true;
}
async function applyWorkspaceEdit(plugin: LSPPlugin, edit: WorkspaceEdit): Promise<boolean> {
  const workspace = plugin.client.workspace as AcodeWorkspace;
  if (!workspace) return false;
  let filesChanged = 0;
  const result = await plugin.client.withMapping(async mapping => {
    if (edit.changes) {
      for (const uri in edit.changes) {
        const changes = edit.changes[uri] as LspChange[];
        if (changes.length && (await applyChangesToFile(workspace, uri, changes, mapping))) {
          filesChanged++;
        }
      }
    }
    if (edit.documentChanges) {
      for (const docChange of edit.documentChanges) {
        if ("textDocument" in docChange && "edits" in docChange) {
          const uri = docChange.textDocument.uri;
          const edits = docChange.edits as LspChange[];
          if (edits.length && (await applyChangesToFile(workspace, uri, edits, mapping))) {
            filesChanged++;
          }
        }
      }
    }
    return filesChanged;
  });
  return (result ?? 0) > 0;
}
async function applyCodeAction(plugin: LSPPlugin, action: CodeAction): Promise<boolean> {
  plugin.client.sync();
  const resolved = await resolveCodeAction(plugin, action);
  let success = false;
  if (resolved.edit) {
    success = await applyWorkspaceEdit(plugin, resolved.edit);
  }
  if (resolved.command) {
    const commandSuccess = await executeCommand(plugin, resolved.command);
    success = success || commandSuccess;
  }
  plugin.client.sync();
  return success;
}
export interface CodeActionItem {
  title: string;
  kind?: CodeActionKind;
  icon: string;
  isPreferred?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  action: CodeAction | Command;
  plugin: LSPPlugin;
}
export async function fetchCodeActions(view: EditorView): Promise<CodeActionItem[]> {
  const plugins = LSPPlugin.getAll(view, "codeAction").filter(plugin => !!plugin.client.serverCapabilities?.codeActionProvider);
  if (!plugins.length) return [];
  const {
    from,
    to
  } = view.state.selection.main;
  const settled = await Promise.allSettled(plugins.map(async (plugin): Promise<CodeActionItem[]> => {
    const range: LspRange = {
      start: plugin.toPosition(from),
      end: plugin.toPosition(to)
    };
    plugin.client.sync();
    const response = await requestCodeActions(plugin, range);
    if (!response?.length) return [];
    return response.map(item => {
      if (isCommand(item)) {
        return {
          title: item.title,
          icon: "terminal",
          action: item,
          plugin
        };
      }
      return {
        title: item.title,
        kind: item.kind,
        icon: getCodeActionIcon(item.kind),
        isPreferred: item.isPreferred,
        disabled: !!item.disabled,
        disabledReason: item.disabled?.reason,
        action: item,
        plugin
      };
    });
  }));
  const items: CodeActionItem[] = [];
  for (let index = 0; index < settled.length; index++) {
    const result = settled[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      addLspLogFor(plugins[index], "error", "Code action fetch failed", result.reason);
      console.error("[LSP:CodeAction] Provider failed:", result.reason);
    }
  }
  items.sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    if (a.kind?.startsWith("quickfix") && !b.kind?.startsWith("quickfix")) return -1;
    if (!a.kind?.startsWith("quickfix") && b.kind?.startsWith("quickfix")) return 1;
    return a.title.localeCompare(b.title);
  });
  return items;
}
export async function executeCodeAction(view: EditorView, item: CodeActionItem): Promise<boolean> {
  const plugin = LSPPlugin.get(view, item.plugin.client);
  if (!plugin) return false;
  try {
    plugin.client.sync();
    if (isCommand(item.action)) {
      return executeCommand(plugin, item.action);
    }
    return applyCodeAction(plugin, item.action);
  } catch (error) {
    addLspLogFor(plugin, "error", "Code action execution failed", error);
    console.error("[LSP:CodeAction] Failed to execute:", error);
    return false;
  }
}
export function supportsCodeActions(view: EditorView): boolean {
  return LSPPlugin.getAll(view, "codeAction").some(plugin => !!plugin.client.serverCapabilities?.codeActionProvider);
}
export async function showCodeActionsMenu(view: EditorView): Promise<boolean> {
  if (!supportsCodeActions(view)) return false;
  const items = await fetchCodeActions(view);
  if (!items.length) {
    toast("No code actions available");
    return false;
  }
  const selectItems = items.map((item, i) => ({
    value: String(i),
    text: item.title,
    icon: item.icon,
    disabled: item.disabled
  }));
  try {
    const result = await select(strings["code actions"] || "Code Actions", selectItems as unknown as string[], {
      hideOnSelect: true
    });
    if (result !== null && result !== undefined) {
      const index = Number.parseInt(String(result), 10);
      if (!Number.isNaN(index) && index >= 0 && index < items.length) {
        await executeCodeAction(view, items[index]);
        focusEditorIfEditable(view);
        return true;
      }
    }
  } catch {}
  focusEditorIfEditable(view);
  return false;
}
export async function performQuickFix(view: EditorView): Promise<boolean> {
  const items = await fetchCodeActions(view);
  if (!items.length) return false;
  const quickFix = items.find(i => i.isPreferred) ?? items.find(i => i.kind?.startsWith("quickfix"));
  if (quickFix) {
    return executeCodeAction(view, quickFix);
  }
  return showCodeActionsMenu(view);
}
export { CODE_ACTION_KINDS, formatCodeActionKind, getCodeActionIcon };
