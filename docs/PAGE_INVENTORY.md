# LuckyBox Page Inventory

Source baseline: Acode v1.13.1 / LuckyBox fork

## Summary

- 16 feature-page directories under `src/pages/`
- 14 settings/helper modules under `src/settings/` (including the settings hub)
- 6 palette/quick-selection screens
- 4 sidebar applications
- 9 reusable dialog modules
- Additional core screens are assembled from `src/main.js`, `src/lib/`, and `src/components/` rather than living under `src/pages/`

Not every directory is a full standalone route. Some are modal pages, editor tabs, lazy-loaded panels, or detail views.

## Core application screens

1. **Main Editor Workspace** — tabs, CodeMirror editor, quick tools, status UI, and split panes.
2. **File Browser** — folder/file navigation and file operations.
3. **Settings Hub** — entry point for all settings modules.
4. **Welcome / Get Started** — initial editor tab.
5. **Problems** — diagnostics and LSP errors.
6. **Running Processes** — active server/process management.
7. **Quick Tools** — quick-key/tool configuration.

## `src/pages/` inventory

| Source directory | Current purpose | LuckyBox direction |
|---|---|---|
| `about` | App version, WebView details, upstream/company/social links | Replace with About & Credits |
| `adRewards` | Watch ads for ad-free time | Remove completely |
| `changelog` | Release history | Keep; convert to LuckyBox changelog |
| `customTheme` | Create/edit custom UI theme | Keep and redesign |
| `fileBrowser` | File and folder browser | Keep; major redesign |
| `fontManager` | Install/manage editor and terminal fonts | Keep editor-font portion; remove terminal portion |
| `markdownPreview` | Render Markdown inside the app | Keep |
| `plugin` | Single plugin detail | Keep; add permission/security report |
| `plugins` | Plugin marketplace/list | Keep; remove billing and add permission controls |
| `problems` | Errors, warnings, diagnostics | Keep |
| `quickTools` | Configure mobile quick tools | Keep |
| `runningProcesses` | View/manage active local processes | Review after terminal removal; retain preview/server processes |
| `sponsor` | Purchase/create Acode sponsorship | Remove |
| `sponsors` | Fetch and display Acode sponsors | Remove |
| `themeSetting` | App/editor/terminal theme settings | Keep app/editor themes; remove terminal portion |
| `welcome` | Welcome and shortcuts | Keep; redesign for LuckyBox |

## Settings screens

| Module | Purpose | Direction |
|---|---|---|
| `mainSettings.js` | Settings home/categories | Keep and redesign |
| `appSettings.js` | General app behavior | Keep |
| `editorSettings.js` | Editor configuration | Keep |
| `filesSettings.js` | File behavior | Keep |
| `previewSettings.js` | Preview server/host/mode | Keep; expand into Web DevTools settings |
| `lspSettings.js` | Language servers | Keep |
| `lspServerDetail.js` | Per-language-server details | Keep |
| `lspConfigUtils.js` | LSP configuration support | Keep |
| `formatterSettings.js` | Formatter selection | Keep |
| `searchSettings.js` | Search configuration | Keep |
| `scrollSettings.js` | Editor scrolling behavior | Keep |
| `backupRestore.js` | Backup/restore | Keep; integrate Time Machine |
| `helpSettings.js` | Help/settings information | Keep and rewrite |
| `terminalSettings.js` | Terminal configuration | Remove |

There are 14 files in this list when counting helper/detail modules. Some are support modules rather than separately navigable screens.

## Palette screens

1. Command Palette
2. Find File
3. Change Language Mode
4. Change Encoding
5. Change App Theme
6. Change Editor Theme

All six should remain. Command Palette will become a major LuckyBox navigation surface.

## Sidebar applications

1. Files
2. Search in Files
3. Extensions/Plugins
4. Notifications

Planned additions:

- Git
- DevTools
- API Client
- Workspace/Project dashboard
- Time Machine

## Dialogs

- Alert
- Confirm
- Prompt
- Multi-prompt
- Select
- Color picker
- Loader/progress
- Generic dialog
- Rate box

`Rate box` is upstream/store-oriented and should be removed or repurposed. The remaining dialogs should be rebuilt on the LuckyBox monochrome component system.

## Native/browser screens not represented under `src/pages/`

- `BrowserActivity` — legacy in-app browser activity
- `WebViewActivity` — isolated custom WebView host
- Crash screen/activity
- Android file/document pickers

The new Browser DevTools UI will use the custom WebView host and add its own LuckyBox frontend page/panels.

## Planned new feature pages (approved scope 1–10)

1. Browser DevTools
2. Elements Inspector
3. Live Edit / Changes
4. Network Inspector
5. API Client
6. Responsive Device Lab
7. Performance Analyzer
8. Accessibility Inspector
9. Project Time Machine
10. Git
11. Smart Workspace dashboard
12. Plugin Permissions dashboard

Several approved features share one DevTools shell, so they do not need to become twelve unrelated top-level menu items.

## Recommended removals

- Ad Rewards
- Sponsor purchase page
- Sponsors listing page
- Terminal settings and terminal UI
- Rate Acode/store flow
- Advertising privacy choices
- Billing purchase dialogs and paid-plugin purchase flow
- Old Acode/Foxbiz promotional links

Upstream Acode attribution and required open-source notices remain available in About & Credits and Licenses.
