# Building LuckyBox with GitHub Actions

Workflow: `.github/workflows/build-android.yml`

## Automatic builds

The workflow runs when:

- manually started from **Actions → Build LuckyBox Android → Run workflow**;
- code is pushed to `main` in relevant project paths;
- a pull request targets `main`.

## Output

The workflow builds an installable debug-signed APK and uploads:

- `LuckyBox-debug.apk`
- `SHA256SUMS.txt`

Open the completed workflow run and download the `LuckyBox-Android-<commit>` artifact.

## Toolchain

- Ubuntu GitHub-hosted runner
- Node.js 22.18
- Temurin JDK 17
- Android SDK 36 / Build Tools 36.0.0
- Cordova Android 15.1.0

## Safety checks

Before compiling, the workflow fails if the generated Android project contains:

- Google Play Billing permission;
- TerminalService;
- AlpineDocumentProvider;
- Alpine rootfs;
- proot/AXS native libraries.

## Release signing

The current workflow intentionally emits a debug-signed personal APK so no signing secret is required. A stable release channel should use one persistent private keystore stored as encrypted GitHub Actions secrets. Do not commit a release keystore or passwords to the repository.
