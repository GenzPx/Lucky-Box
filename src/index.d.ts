declare const ASSETS_DIRECTORY: string;
declare const DATA_STORAGE: string;
declare const CACHE_STORAGE: string;
declare const PLUGIN_DIR: string;
declare const KEYBINDING_FILE: string;
declare const ANDROID_SDK_INT: number;
declare const DOES_SUPPORT_THEME: boolean;
declare const acode: {
  webview: AcodeWebViewAPI;
  [key: string]: unknown;
};
interface Window {
  ASSETS_DIRECTORY: string;
  DATA_STORAGE: string;
  CACHE_STORAGE: string;
  PLUGIN_DIR: string;
  KEYBINDING_FILE: string;
  ANDROID_SDK_INT: number;
  DOES_SUPPORT_THEME: boolean;
  acode: object;
}
interface String {
  capitalize(): string;
  hashCode(): string;
}
type ExecutorCallback = (type: "stdout" | "stderr" | "exit", data: string) => void;
interface Executor {
  execute: (command: string, alpine: boolean) => Promise<string>;
  start: (command: string, callback: ExecutorCallback, alpine: boolean) => Promise<string>;
  write: (uuid: string, input: string) => Promise<void>;
  stop: (uuid: string) => Promise<void>;
  isRunning: (uuid: string) => Promise<boolean>;
  listProcesses: () => Promise<ExecutorProcess[]>;
  moveToForeground: () => Promise<void>;
  moveToBackground: () => Promise<void>;
  stopService: () => Promise<void>;
  BackgroundExecutor: Executor;
}
interface ExecutorProcess {
  id: string;
  pid: number;
  command: string;
  alpine: boolean;
  startedAt: number;
  background: boolean;
}
declare const Executor: Executor | undefined;
interface Window {
  Executor?: Executor;
  editorManager?: EditorManager;
}
interface EditorManager {
  editor?: import("@codemirror/view").EditorView;
  isCodeMirror?: boolean;
  activeFile?: AcodeFile;
  getLspMetadata?: (file: AcodeFile) => LspFileMetadata | null;
}
interface LspFileMetadata {
  uri: string;
  languageId?: string;
  languageName?: string;
  view?: import("@codemirror/view").EditorView;
  file?: AcodeFile;
  rootUri?: string;
}
interface AcodeFile {
  uri?: string;
  name?: string;
  session?: unknown;
  cacheFile?: string;
  [key: string]: unknown;
}
declare global {
  var Executor: Executor | undefined;
}
interface WebViewOptions {
  title?: string;
  mode?: "fullscreen" | "hidden";
  allowNavigation?: boolean;
  allowDownloads?: boolean;
  visible?: boolean;
}
interface AcodeWebView {
  readonly id: string;
  readonly options: WebViewOptions;
  loadURL(url: string): Promise<void>;
  loadHTML(html: string): Promise<void>;
  evaluate(js: string): Promise<string>;
  onMessage(callback: (message: unknown) => void): void;
  offMessage(callback: (message: unknown) => void): void;
  on(event: string, callback: (event: string, data?: unknown) => void): void;
  off(event: string, callback: (event: string, data?: unknown) => void): void;
  postMessage(message: unknown): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  reload(): Promise<void>;
  destroy(): Promise<void>;
}
interface AcodeWebViewAPI {
  create(options?: WebViewOptions): Promise<AcodeWebView>;
}
