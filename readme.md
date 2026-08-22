# LuckyBox

<p align="center">
  <img src="res/logo_1.png" width="220" alt="LuckyBox">
</p>

LuckyBox is a mobile code editor and Web DevTools workspace for Android. It combines project editing, local preview, source inspection, network tooling, archive utilities, checksums, and modular development tools in one application.

## Status

LuckyBox is under active development. The current source includes the editor foundation, WebView bridge, module registry, NetworkSession model, operation queue, ZIP tools, checksum tools, and Android build automation.

## Core modules

- Code Editor
- Smart Workspace
- Project Explorer
- Archive Manager
- Browser DevTools
- Elements and Live Edit
- Network Inspector
- API Client
- Device Lab
- Performance Analyzer
- Accessibility Inspector
- Time Machine
- Git
- Plugins and Permissions
- Built-in Viewers
- Operation Queue
- Custom Mobile Toolbar
- Checksums and Metadata

## Development

Requirements:

- Node.js 22.18 or newer
- JDK 17
- Android SDK 36
- Android Build Tools 36.0.0

Install dependencies:

```shell
npm ci
```

Run quality checks:

```shell
npx biome check src utils
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npx rspack --mode production
```

## Android build

The repository includes `.github/workflows/build-android.yml`. Run the workflow manually from GitHub Actions to generate an installable APK and SHA-256 checksum.

Detailed instructions are available in `docs/GITHUB_BUILD.md`.

## Privacy direction

LuckyBox does not include advertising, Google Play Billing, or application telemetry. DevTools captures remain local to the device and are cleared with the session unless explicitly exported.

## Credit

LuckyBox is created by [GenzPx](https://github.com/GenzPx).

LuckyBox is based on the MIT-licensed Acode v1.13.1 project by Foxdebug and Acode Foundation contributors. Required upstream and third-party license notices remain included.

## License

See `license.txt` and the bundled third-party notices.
