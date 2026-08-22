# LuckyBox Changelog

## 1.13.1-luckybox.1

### Foundation

- Rebranded the application as LuckyBox with package ID `id.luckybox.server`.
- Removed Google Play Billing, advertising SDK source, and Google-dependent purchase startup.
- Removed the bundled Alpine terminal, proot payloads, native terminal service, and terminal launcher UI.
- Removed upstream sponsor, ad rewards, rate-app, advertising privacy, and promotional pages.
- Rebuilt Settings around LuckyBox features.
- Replaced the About page with LuckyBox product, privacy, diagnostics, credits, and license information.
- Kept visible upstream credit for the MIT-licensed Acode v1.13.1 foundation.

### Web DevTools foundation

- Added rendered DOM source capture.
- Added page snapshot and Resource Timing capture.
- Added a session-only NetworkSession model.
- Added request filtering and interception-rule models.
- Added HAR 1.2 export support.

### Plugin policy

- Retained compatibility with free plugins.
- Removed Google Billing integration.
- Paid plugin dependencies are rejected instead of bypassed.

### Verification

- Production frontend build passes.
- Biome formatting/checks pass for modified modules.
