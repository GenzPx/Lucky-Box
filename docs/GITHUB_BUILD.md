# Building LuckyBox releases with GitHub Actions

Workflow: `.github/workflows/build-android.yml`

## Output policy

The workflow builds only signed release APKs. It does not build or upload debug APKs.

Each successful run uploads:

- `LuckyBox-release-<commit>.apk` for branch/manual builds, or `LuckyBox-<tag>.apk` for tags
- `SHA256SUMS.txt`

A pushed `v*` tag also publishes the APK and checksum on the repository's GitHub Releases page.

## Toolchain

- Ubuntu GitHub-hosted runner
- Node.js 22.18
- Temurin JDK 17
- Android SDK 36
- Android Build Tools 36.0.0
- Cordova Android 15.1.0

## Quality and security gates

The workflow requires:

- source comment policy pass
- Biome pass
- TypeScript pass
- all tests pass
- production dependency audit pass
- production web bundle pass
- no Billing permission
- no Google Play Services, Firebase, or DataTransport manifest components
- no TerminalService or AlpineDocumentProvider
- no Alpine, proot, or AXS payload
- valid APK signature
- no debug APK in build output

## Signing secrets

The repository uses these encrypted GitHub Actions Secrets:

- `LUCKYBOX_KEYSTORE_BASE64`
- `LUCKYBOX_KEYSTORE_PASSWORD`
- `LUCKYBOX_KEY_ALIAS`
- `LUCKYBOX_KEY_PASSWORD`

The permanent signing key must be backed up securely. Losing it prevents future APKs from updating existing LuckyBox installations.
