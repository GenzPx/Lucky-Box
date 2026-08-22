# LuckyBox — Project Status

Updated: 2026-08-22

## Product decisions

- App name: **LuckyBox**
- Android application ID: `id.luckybox.server`
- Deep-link scheme: `luckybox://`
- Design direction: minimal premium, monochrome
- Priority: startup performance, memory, and APK size
- Distribution: personal sideload
- Minimum Android: API 26 / Android 8
- Upstream: Acode v1.13.1 (MIT)

## Completed foundation work

### Source-based fork

The project now uses the official Acode v1.13.1 source instead of editing minified APK bundles. Upstream attribution and the MIT license are retained.

### Identity

Updated the primary identity in:

- `package.json`
- `config.xml`
- `utils/config.js`
- `utils/setup.js`
- `hooks/post-process.js`
- Web title, startup messages, About heading, Welcome heading, log filename

The original `acode://` deep link is now `luckybox://`.

### Google/Billing removal — native dependency layer

Removed declarations and vendored native source for:

- `cordova-plugin-iap`
- AdMob plugin source
- Google Play Billing bridge source

The startup billing connection and purchase lookup were removed from `src/main.js`. LuckyBox personal builds set the local feature flag directly and no longer require Google Billing to start.

A final generated-APK manifest/dependency audit is still required after the Android toolchain is available.

### Terminal removal — native payload layer

Removed:

- `src/plugins/proot/`
- `src/plugins/terminal/`
- Alpine rootfs for ARM32, ARM64, and x86_64
- proot/AXS native libraries
- Cordova declarations for terminal and proot

This removed roughly **21 MB** from the source tree before packaging. The original source tree was about 35 MB and the initial LuckyBox source tree became about 14 MB, excluding generated dependencies/build output.

Terminal frontend references and menus still exist in some web source files. They are scheduled for removal in the next cleanup pass so no dead terminal chunk or menu entry remains.

### Visual foundation

- Native splash/launcher background switched to `#0B0B0B`
- Cordova background switched to `#0B0B0B`
- Visible shell branding changed to LuckyBox
- Minimal monochrome design system is planned, but full component redesign has not yet been applied

## Verification

Production frontend compilation succeeds with Rspack.

Current warnings are performance warnings rather than build failures:

- `main.js`: ~3.06 MiB
- TypeScript LSP worker: ~6.41 MiB
- HTML LSP worker: ~1.51 MiB
- CSS LSP worker: ~1.01 MiB
- Meslo font: ~1.22 MiB

These establish the optimization baseline.

An APK has not yet been generated because this workspace currently has Java 11 but no configured Android SDK/Gradle toolchain. Source-level web compilation has passed.

## Upstream branding/content cleanup

Completed the first user-facing cleanup pass:

- Removed Ad Rewards, Sponsor, Sponsors, Rate App, ad privacy, and remove-ads pages/actions.
- Removed the terminal entry from Settings, Welcome, main menu, command registry, default keybindings, and startup restoration.
- Rebuilt Settings with LuckyBox categories and labels.
- Rebuilt About as LuckyBox About & Credits.
- Replaced the remote upstream changelog with a local LuckyBox changelog.
- Removed upstream promotional/social links and sponsor sidebar behavior.
- Changed runtime deep-link handling from `acode://` to `luckybox://`.
- Limited the visible marketplace to free plugins and rejects paid plugin dependencies without bypassing payment.
- Kept the Acode/Foxdebug attribution visible only in About & Credits and required license notices.

Internal compatibility names used by the plugin API and some native Java package namespaces are being migrated separately; they are not product branding shown in the UI.

## Web DevTools feature foundation

Requirements and architecture are documented in `docs/WEB_DEVTOOLS_SPEC.md`.

Implemented initial reusable pieces:

- `src/devtools/network/NetworkSession.js` — session-only request model, filters, interception-rule model, cleanup, and HAR 1.2 export.
- `WebView.getRenderedSource()` — retrieves the live DOM after JavaScript execution.
- `WebView.getPageSnapshot()` — retrieves URL, title, content metadata, rendered source, and Resource Timing records.

The production web build and formatter checks pass after these additions. Native request interception, the adaptive DevTools UI, raw-response capture, asset ZIP export, and the optional proxy/CA service are the next implementation layers.

## Build automation

Added `.github/workflows/build-android.yml` for GitHub-hosted Android builds. It prepares Node 22, JDK 17, Android SDK 36, Cordova Android 15.1, audits removed native components, builds an installable APK, and uploads the APK plus SHA-256 checksum. Usage is documented in `docs/GITHUB_BUILD.md`.

## Competitive feature research

A static feature study of TrebEdit 3.6.7 and ZArchiver 1.0.9 is stored in `Research/FEATURE_RESEARCH.md` at workspace level. It expands the LuckyBox roadmap with an operation queue, archive manager, richer file-manager modes, customizable mobile toolbar, recovery, source-to-project workflows, built-in viewers, checksums, and optional advanced storage connectors.

## Module implementation batch 1

Implemented reusable foundations under `src/modules/`:

- **Operation Queue** — concurrent task scheduling, lifecycle states, progress/byte reporting, cooperative pause/resume, cancellation, filtering, bounded history, and teardown.
- **ZIP Archive Manager** — create/open/list/read/extract ZIPs, CRC checking option, compression levels, progress callback, and ZIP Slip path protection.
- **Checksums** — SHA-1, SHA-256, SHA-384, SHA-512 generation/verification and algorithm detection using Web Crypto.
- **Module Registry** — tracks all 18 approved LuckyBox modules and lazy-loads foundation modules so they do not enter the startup bundle.

Verification: six focused module tests pass and the production Rspack build succeeds.

## Next implementation passes

1. **Dead-feature cleanup**
   - Remove terminal UI, settings, commands, keybindings, xterm dependencies, and terminal fonts.
   - Replace paid-plugin billing paths with a clear free/external-plugin policy.
   - Remove ad/reward pages and no-longer-used frontend modules.

2. **Performance architecture**
   - Stop loading heavy modules at startup.
   - Lazy-load language workers only when their language is used.
   - Review TypeScript worker bundling and duplicate TypeScript payloads.
   - Subset/remove fonts and load optional fonts on demand.
   - Add bundle-size budgets.

3. **Minimal monochrome UI system**
   - Define color, spacing, radius, elevation, and typography tokens.
   - Redesign app shell, editor tabs, sidebar, file browser, dialogs, settings, plugin pages, and welcome view.
   - Replace logo and launcher icon with LuckyBox artwork.

4. **Android build and audit**
   - Configure JDK/Android SDK compatible with Cordova Android 15.
   - Generate release APK.
   - Verify manifest has no Billing, Google Play Services, DataTransport, terminal service, Alpine provider, or terminal native libraries.
   - Sign with a new LuckyBox personal key.
   - Test cold start, memory, open/save, SAF, WebView preview, FTP/SFTP, LSP, and plugins on Android 8+.

## Important compatibility note

Because the package ID and signing key differ from Acode, LuckyBox installs as a separate app. It does not overwrite the official Acode installation, and existing Acode app-private data will not automatically migrate.
