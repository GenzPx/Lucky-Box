interface CordovaBridge {
  exec(
    success: (value: unknown) => void,
    failure: (error: unknown) => void,
    service: string,
    action: string,
    args: unknown[]
  ): void;
}

export default function customTab(url: string, options?: {
  showTitle?: boolean;
  toolbarColor?: string;
}) {
  if (!options) {
    options = {};
  }
  options.showTitle ??= true;
  const bridge = (globalThis as unknown as { cordova: CordovaBridge }).cordova;
  return new Promise((resolve, reject) => {
    bridge.exec(resolve, reject, "CustomTabs", "open", [url, options]);
  });
}
