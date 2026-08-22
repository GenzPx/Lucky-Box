interface Storage {
  name: string;
  uuid: string;
}
interface DirListItem {
  name: string;
  mime: string;
  isDirectory: Boolean;
  isFile: Boolean;
  uri: string;
}
interface Stats {
  canRead: boolean;
  canWrite: boolean;
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
  isVirtual: boolean;
  lastModified: number;
  length: number;
  name: string;
  type: string;
  uri: string;
}
interface DocumentFile {
  canWrite: boolean;
  filename: string;
  length: number;
  type: string;
  uri: string;
}
interface WorkspaceFileEntry {
  rootUrl: string;
  parent: string;
  parentUrl: string;
  name: string;
  path: string;
  url: string;
  uri: string;
  mime?: string;
  type?: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modifiedDate: number;
}
type WorkspaceEvent = {
  id: string;
  type: 'status';
  action: 'status';
  state: string;
  message: string;
  progress: number;
} | {
  id: string;
  type: 'batch';
  action: 'batch';
  entries: WorkspaceFileEntry[];
} | {
  id: string;
  type: 'search-result';
  action: 'search-result';
  data: any;
} | {
  id: string;
  type: 'search-results';
  action: 'search-results';
  data: any[];
} | {
  id: string;
  type: 'replace-result';
  action: 'replace-result';
  file: WorkspaceFileEntry;
  text: string;
} | {
  id: string;
  type: 'progress';
  action: 'progress';
  data: number;
} | {
  id: string;
  type: 'done' | 'done-searching' | 'done-replacing' | 'error';
  action: string;
  [key: string]: any;
};
interface SDcard {
  copy(src: string, dest: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  createDir(src: string, dirName: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  createFile(src: string, fileName: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  delete(src: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  exists(src: string, onSuccess: (exists: 'TRUE' | 'FALSE') => void, onFail: (err: any) => void): void;
  formatUri(src: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  getPath(src: string, path: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  getStorageAccessPermission(uuid: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  listStorages(onSuccess: (storages: Array<Storage>) => void, onFail: (err: any) => void): void;
  listDir(src: string, onSuccess: (list: Array<DirListItem>) => void, onFail: (err: any) => void): void;
  move(src: string, dest: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  openDocumentFile(onSuccess: (url: DocumentFile) => void, onFail: (err: any) => void, mimeType: string): void;
  getImage(onSuccess: (url: string) => void, onFail: (err: any) => void, mimeType: string): void;
  rename(src: string, newname: string, onSuccess: (url: string) => void, onFail: (err: any) => void): void;
  write(src: string, content: string, onSuccess: (res: 'OK') => void, onFail: (err: any) => void): void;
  write(src: string, content: string, isBinary: Boolean, onSuccess: (res: 'OK') => void, onFail: (err: any) => void): void;
  stats(src: string, onSuccess: (stats: Stats) => void, onFail: (err: any) => void): void;
  watchFile(src: string, listener: () => void): {
    unwatch: () => void;
  };
  workspaceScan(options: any, onEvent: (event: WorkspaceEvent) => void, onFail: (err: any) => void): void;
  workspaceUpdate(options: any, onSuccess: (result: {
    added: number;
    removed: number;
  }) => void, onFail: (err: any) => void): void;
  workspaceSearch(options: any, onEvent: (event: WorkspaceEvent) => void, onFail: (err: any) => void): void;
  workspaceQuery(options: any, onSuccess: (result: {
    entries: any[];
    cursor: number | null;
    hasMore: boolean;
  }) => void, onFail: (err: any) => void): void;
  workspaceCancel(id: string, onSuccess?: (res: 'OK') => void, onFail?: (err: any) => void): void;
  workspaceMarkDirty(urls: string[], onSuccess?: (res: 'OK') => void, onFail?: (err: any) => void): void;
  workspaceClear(roots: string[], onSuccess?: (res: 'OK') => void, onFail?: (err: any) => void): void;
}
declare var sdcard: SDcard;
