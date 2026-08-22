import type { LSPClient, LSPClientConfig, LSPClientExtension, Transport, Workspace, WorkspaceFile } from "@codemirror/lsp-client";
import type { Language } from "@codemirror/language";
import type { ChangeSet, Extension, MapMode, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Diagnostic as LSPDiagnostic, FormattingOptions as LSPFormattingOptions, Position, Range, TextEdit } from "vscode-languageserver-types";
export type { LSPClient, LSPClientConfig, LSPClientExtension, LSPDiagnostic, LSPFormattingOptions, Position, Range, TextEdit, Transport, Workspace, WorkspaceFile };
export interface WorkspaceFileUpdate {
  file: WorkspaceFile;
  prevDoc: Text;
  changes: ChangeSet;
}
export type TransportKind = "websocket" | "stdio" | "external";
type MaybePromise<T> = T | Promise<T>;
export interface WebSocketTransportOptions {
  binary?: boolean;
  timeout?: number;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}
export interface TransportDescriptor {
  kind: TransportKind;
  url?: string;
  command?: string;
  args?: string[];
  options?: WebSocketTransportOptions;
  protocols?: string[];
  create?: (server: LspServerDefinition, context: TransportContext) => TransportHandle;
}
export interface TransportHandle {
  transport: Transport;
  dispose: () => Promise<void> | void;
  ready: Promise<void>;
}
export interface TransportContext {
  uri?: string;
  file?: AcodeFile;
  view?: EditorView;
  languageId?: string;
  rootUri?: string | null;
  originalRootUri?: string | null;
  debugWebSocket?: boolean;
  dynamicPort?: number;
}
export type WorkspaceKind = "app-private" | "builtin-alpine" | "termux-saf" | "saf" | "remote" | "proot-distro" | "virtual" | "unknown";
export interface LspRuntimeContext extends TransportContext {
  documentUri?: string | null;
  originalDocumentUri?: string;
  serverId?: string;
  workspaceKind?: WorkspaceKind;
  allowNonTerminalWorkspace?: boolean;
  runtimeAction?: "checkInstallation" | "install" | "uninstall" | "command";
}
export type LspClientScope = "workspace" | "document";
export interface LspRuntimeUriResolutionContext extends LspRuntimeContext {
  originalDocumentUri: string;
  originalRootUri: string | null;
  normalizedDocumentUri: string | null;
  normalizedRootUri: string | null;
}
export interface LspRuntimeUriResolution {
  documentUri?: string | null;
  rootUri?: string | null;
  scope?: LspClientScope;
}
export type LspRuntimeConnection = {
  kind: "transport";
  providerId: string;
  transport: TransportHandle;
  dispose?: () => Promise<void> | void;
} | {
  kind: "websocket";
  providerId: string;
  url: string;
  protocols?: string[];
  dispose?: () => Promise<void> | void;
};
export interface LspRuntimeProvider {
  id: string;
  label: string;
  priority?: number;
  canHandle: (server: LspServerDefinition, context: LspRuntimeContext) => boolean | Promise<boolean>;
  resolveUris?: (server: LspServerDefinition, context: LspRuntimeUriResolutionContext) => MaybePromise<LspRuntimeUriResolution | null | undefined>;
  checkInstallation?: (server: LspServerDefinition, context: LspRuntimeContext) => Promise<InstallCheckResult>;
  install?: (server: LspServerDefinition, context: LspRuntimeContext, mode: "install" | "update" | "reinstall", options?: {
    promptConfirm?: boolean;
  }) => Promise<boolean>;
  uninstall?: (server: LspServerDefinition, context: LspRuntimeContext, options?: {
    promptConfirm?: boolean;
  }) => Promise<boolean>;
  getInstallCommand?: (server: LspServerDefinition, context: LspRuntimeContext, mode?: "install" | "update") => string | null;
  getUninstallCommand?: (server: LspServerDefinition, context: LspRuntimeContext) => string | null;
  start: (server: LspServerDefinition, context: LspRuntimeContext) => Promise<LspRuntimeConnection>;
  stop?: (connection: LspRuntimeConnection) => Promise<void> | void;
}
export interface BridgeConfig {
  kind: "axs";
  port?: number;
  command: string;
  args?: string[];
  session?: string;
}
export type InstallerKind = "apk" | "npm" | "pip" | "cargo" | "github-release" | "manual" | "shell";
export interface LauncherInstallConfig {
  kind?: InstallerKind;
  command?: string;
  updateCommand?: string;
  uninstallCommand?: string;
  label?: string;
  source?: string;
  executable?: string;
  packages?: string[];
  pipCommand?: string;
  npmCommand?: string;
  pythonCommand?: string;
  global?: boolean;
  breakSystemPackages?: boolean;
  repo?: string;
  assetNames?: Record<string, string>;
  archiveType?: "zip" | "binary";
  extractFile?: string;
  binaryPath?: string;
}
export interface LauncherConfig {
  command?: string;
  args?: string[];
  startCommand?: string | string[];
  logOutput?: "all" | "warnings-and-errors";
  checkCommand?: string;
  versionCommand?: string;
  updateCommand?: string;
  uninstallCommand?: string;
  install?: LauncherInstallConfig;
  bridge?: BridgeConfig;
}
export interface BuiltinExtensionsConfig {
  hover?: boolean;
  completion?: boolean;
  signature?: boolean;
  keymaps?: boolean;
  diagnostics?: boolean;
  inlayHints?: boolean;
  formatting?: boolean;
  documentColors?: boolean;
}
export interface AcodeClientConfig {
  useDefaultExtensions?: boolean;
  builtinExtensions?: BuiltinExtensionsConfig;
  extensions?: (Extension | LSPClientExtension)[];
  notificationHandlers?: Record<string, (client: LSPClient, params: unknown) => boolean>;
  workspace?: (client: LSPClient) => Workspace;
  rootUri?: string;
  timeout?: number;
  highlightLanguage?: (name: string) => Language | null;
}
export interface LanguageResolverContext {
  languageId: string;
  languageName?: string;
  uri?: string;
  file?: AcodeFile;
}
export interface DocumentUriContext extends RootUriContext {
  normalizedUri?: string | null;
}
export interface LspServerManifest {
  id?: string;
  label?: string;
  enabled?: boolean;
  priority?: number;
  languages?: string[];
  transport?: TransportDescriptor;
  initializationOptions?: Record<string, unknown>;
  workspaceConfiguration?: Record<string, unknown>;
  clientConfig?: Record<string, unknown> | AcodeClientConfig;
  startupTimeout?: number;
  capabilityOverrides?: Record<string, unknown>;
  rootUri?: ((uri: string, context: unknown) => MaybePromise<string | null>) | ((uri: string, context: RootUriContext) => MaybePromise<string | null>) | null;
  documentUri?: ((uri: string, context: DocumentUriContext) => MaybePromise<string | null | undefined>) | null;
  resolveLanguageId?: ((context: LanguageResolverContext) => string | null) | null;
  launcher?: LauncherConfig;
  runtimes?: string[];
  useWorkspaceFolders?: boolean;
}
export interface LspServerBundle {
  id: string;
  label?: string;
  getServers: () => LspServerManifest[];
  getExecutable?: (serverId: string, manifest: LspServerManifest) => string | null | undefined;
  checkInstallation?: (serverId: string, manifest: LspServerManifest) => Promise<InstallCheckResult | null | undefined>;
  installServer?: (serverId: string, manifest: LspServerManifest, mode: "install" | "update" | "reinstall", options?: {
    promptConfirm?: boolean;
  }) => Promise<boolean>;
  uninstallServer?: (serverId: string, manifest: LspServerManifest, options?: {
    promptConfirm?: boolean;
  }) => Promise<boolean>;
}
export type LspServerProvider = LspServerBundle;
export interface LspServerDefinition {
  id: string;
  label: string;
  enabled: boolean;
  priority: number;
  languages: string[];
  transport: TransportDescriptor;
  initializationOptions?: Record<string, unknown>;
  workspaceConfiguration?: Record<string, unknown>;
  clientConfig?: AcodeClientConfig;
  startupTimeout?: number;
  capabilityOverrides?: Record<string, unknown>;
  rootUri?: ((uri: string, context: RootUriContext) => MaybePromise<string | null>) | null;
  documentUri?: ((uri: string, context: DocumentUriContext) => MaybePromise<string | null | undefined>) | null;
  resolveLanguageId?: ((context: LanguageResolverContext) => string | null) | null;
  launcher?: LauncherConfig;
  runtimes?: string[];
  useWorkspaceFolders?: boolean;
}
export interface RootUriContext {
  uri?: string;
  file?: AcodeFile;
  view?: EditorView;
  languageId?: string;
  rootUri?: string;
}
export type RegistryEventType = "register" | "unregister" | "update";
export type RegistryEventListener = (event: RegistryEventType, server: LspServerDefinition) => void;
export interface FileMetadata {
  uri: string;
  languageId?: string;
  languageName?: string;
  view?: EditorView;
  file?: AcodeFile;
  rootUri?: string;
}
export interface FormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
  [key: string]: unknown;
}
export interface ClientManagerOptions {
  diagnosticsUiExtension?: Extension | Extension[];
  clientExtensions?: Extension | Extension[];
  resolveRoot?: (context: RootUriContext) => Promise<string | null>;
  displayFile?: (uri: string) => Promise<EditorView | null>;
  openFile?: (uri: string) => Promise<EditorView | null>;
  resolveLanguageId?: (uri: string) => string | null;
  onClientIdle?: (info: ClientIdleInfo) => void;
  allowNonTerminalWorkspace?: boolean;
}
export interface ClientIdleInfo {
  server: LspServerDefinition;
  client: LSPClient;
  rootUri: string | null;
  dispose: () => Promise<void>;
}
export interface ClientState {
  server: LspServerDefinition;
  client: LSPClient;
  transport: TransportHandle;
  rootUri: string | null;
  attach: (uri: string, view: EditorView, aliases?: string[]) => void;
  detach: (uri: string, view?: EditorView) => void;
  dispose: () => Promise<void>;
}
export interface NormalizedRootUri {
  normalizedRootUri: string | null;
  originalRootUri: string | null;
}
export interface ManagedServerEntry {
  uuid: string;
  command: string;
  startedAt: number;
  port?: number;
}
export type InstallStatus = "present" | "declined" | "failed";
export interface InstallCheckResult {
  status: "present" | "missing" | "failed" | "unknown";
  version?: string | null;
  canInstall: boolean;
  canUpdate: boolean;
  message?: string;
}
export interface PortInfo {
  port: number;
  filePath: string;
  session: string;
}
export interface WaitOptions {
  attempts?: number;
  delay?: number;
  probeTimeout?: number;
}
export interface EnsureServerResult {
  uuid: string | null;
  discoveredPort?: number;
}
export interface LspServerStats {
  program: string;
  processes: Array<{
    pid: number;
    uptime_secs: number;
    memory_bytes: number;
  }>;
}
export interface LspServerStatsFormatted {
  memoryBytes: number;
  memoryFormatted: string;
  uptimeSeconds: number;
  uptimeFormatted: string;
  pid: number | null;
  processCount: number;
}
export interface WorkspaceOptions {
  displayFile?: (uri: string) => Promise<EditorView | null>;
  openFile?: (uri: string) => Promise<EditorView | null>;
  resolveLanguageId?: (uri: string) => string | null;
}
export interface LspDiagnostic {
  from: number;
  to: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
  relatedInformation?: DiagnosticRelatedInformation[];
}
export interface DiagnosticRelatedInformation {
  uri: string;
  from: number;
  to: number;
  message: string;
}
export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: RawDiagnostic[];
}
export interface DocumentDiagnosticParams {
  textDocument: {
    uri: string;
  };
  identifier?: string;
  previousResultId?: string;
}
export interface FullDocumentDiagnosticReport {
  kind: "full";
  resultId?: string;
  items: RawDiagnostic[];
}
export interface UnchangedDocumentDiagnosticReport {
  kind: "unchanged";
  resultId: string;
}
export type DocumentDiagnosticReport = FullDocumentDiagnosticReport | UnchangedDocumentDiagnosticReport;
export interface RawDiagnostic {
  range: Range;
  severity?: number;
  code?: number | string;
  source?: string;
  message: string;
  relatedInformation?: RawDiagnosticRelatedInformation[];
}
export interface RawDiagnosticRelatedInformation {
  location: {
    uri: string;
    range: Range;
  };
  message: string;
}
export interface AcodeApi {
  registerFormatter: (id: string, extensions: string[], formatter: () => Promise<boolean>, label: string) => void;
}
export interface ParsedUri {
  docId?: string;
  rootUri?: string;
  isFileUri?: boolean;
}
export interface LSPPluginAPI {
  uri: string;
  client: LSPClient & {
    sync: () => void;
    connected?: boolean;
  };
  toPosition: (offset: number) => {
    line: number;
    character: number;
  };
  fromPosition: (pos: {
    line: number;
    character: number;
  }, doc?: unknown) => number;
  syncedDoc: {
    length: number;
  };
  unsyncedChanges: {
    mapPos: (pos: number, assoc?: number, mode?: MapMode) => number | null;
    empty: boolean;
    newLength: number;
  };
  clear: () => void;
}
export interface WorkspaceFileWithView {
  version: number;
  getView: () => EditorView | null;
}
export interface WorkspaceWithFileAccess {
  getFile: (uri: string) => WorkspaceFileWithView | null;
}
export interface LSPClientWithWorkspace {
  workspace: WorkspaceWithFileAccess;
}
declare module "@codemirror/lsp-client" {
  interface LSPClient {
    __acodeLoggedInfo?: boolean;
  }
}
