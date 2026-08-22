interface FtpOptions {
  connectionMode: 'passive' | 'active';
  securityType: 'ftp' | 'ftps';
  encoding: 'utf8' | 'binary';
}
type SuccessCallback = (res: any) => void;
type ErrorCallback = (err: any) => void;
interface Ftp {
  connect(host: string, port: number, username: string, password: string, options: FtpOptions, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  listDirectory(id: string, path: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  execCommand(id: string, command: string, onSuccess: SuccessCallback, onError: ErrorCallback, ...args: string[]): void;
  isConnected(id: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  disconnect(id: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  downloadFile(id: string, remotePath: string, localPath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  uploadFile(id: string, localPath: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  deleteFile(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  deleteDirectory(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  createDirectory(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  createFile(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  getStat(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  exists(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  changeDirectory(id: string, remotePath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  changeToParentDirectory(id: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  getWorkingDirectory(id: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  rename(id: string, oldPath: string, newPath: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
  sendNoOp(id: string, onSuccess: SuccessCallback, onError: ErrorCallback): void;
}
declare var ftp: Ftp;
