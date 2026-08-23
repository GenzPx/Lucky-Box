interface Info {
  versionName: string;
  packageName: string;
  versionCode: number;
}
interface AppInfo extends Info {
  label: string;
  firstInstallTime: number;
  lastUpdateTime: number;
}
interface ShortCut {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: string;
  data: string;
}
interface FileShortcut {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  uri: string;
}
interface Intent {
  action: string;
  data: string;
  type: string;
  package: string;
  extras: {
    [key: string]: any;
  };
}
type FileAction = 'VIEW' | 'EDIT' | 'SEND' | 'RUN';
type OnFail = (err: string) => void;
type OnSuccessBool = (res: boolean) => void;
interface System {
  getWebviewInfo(onSuccess: (res: Info) => void, onFail: OnFail): void;
  isPowerSaveMode(onSuccess: OnSuccessBool, onFail: OnFail): void;
  fileAction(fileUri: string, filename: string, action: FileAction, mimeType: string, onFail: OnFail): void;
  fileAction(fileUri: string, filename: string, action: FileAction, mimeType: string): void;
  fileAction(fileUri: string, action: FileAction, mimeType: string, onFail: OnFail): void;
  fileAction(fileUri: string, action: FileAction, mimeType: string): void;
  fileAction(fileUri: string, action: FileAction, onFail: OnFail): void;
  fileAction(fileUri: string, action: FileAction): void;
  getAppInfo(onSuccess: (info: AppInfo) => void, onFail: OnFail): void;
  addShortcut(shortCut: ShortCut, onSuccess: OnSuccessBool, onFail: OnFail): void;
  removeShortcut(id: string, onSuccess: OnSuccessBool, onFail: OnFail): void;
  pinShortcut(id: string, onSuccess: OnSuccessBool, onFail: OnFail): void;
  pinFileShortcut(shortcut: FileShortcut, onSuccess: OnSuccessBool, onFail: OnFail): void;
  getAndroidVersion(onSuccess: (res: Number) => void, onFail: OnFail): void;
  manageAllFiles(onSuccess: OnSuccessBool, onFail: OnFail): void;
  isExternalStorageManager(onSuccess: OnSuccessBool, onFail: OnFail): void;
  requestPermissions(permissions: string[], onSuccess: OnSuccessBool, onFail: OnFail): void;
  requestPermission(permission: string, onSuccess: OnSuccessBool, onFail: OnFail): void;
  hasPermission(permission: string, onSuccess: OnSuccessBool, onFail: OnFail): void;
  openInBrowser(src: string): void;
  launchApp(app: string, className: string, extras?: Record<string, string | number | boolean>, onSuccess?: OnSuccessBool, onFail?: OnFail): void;
  inAppBrowser(url: string, title: string, showButtons: boolean): void;
  setUiTheme(systemBarColor: string, theme: object, onSuccess: OnSuccessBool, onFail: OnFail): void;
  setIntentHandler(onSuccess: (intent: Intent) => void, onFail: OnFail): void;
  getCordovaIntent(onSuccess: (intent: Intent) => void, onFail: OnFail): void;
  setNativeContextMenuDisabled(disabled: boolean, onSuccess?: () => void, onFail?: OnFail): void;
}
interface Window {
  system: System;
}
