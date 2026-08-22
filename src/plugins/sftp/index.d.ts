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
interface ExecResult {
  code: Number;
  result: String;
}
interface Sftp {
  exec(command: String, onSucess: (res: ExecResult) => void, onFail: (err: any) => void): void;
  connectUsingPassoword(host: String, port: Number, username: String, password: String, onSuccess: () => void, onFail: (err: any) => void): void;
  connectUsingKeyFile(host: String, port: Number, username: String, keyFile: String, passphrase: String, onSuccess: () => void, onFail: (err: any) => void): void;
  getFile(filename: String, localFilename: String, onSuccess: (url: String) => void, onFail: (err: any) => void): void;
  putFile(filename: String, localFilename: String, onSuccess: (url: String) => void, onFail: (err: any) => void): void;
  close(onSuccess: () => void, onFail: (err: any) => void): void;
  isConnected(onSuccess: (connectionId: String) => void, onFail: (err: any) => void): void;
}
declare var sftp: Sftp;
