# LuckyBox Web DevTools — Technical Specification

## Confirmed requirements

- Local project preview and general-purpose DevTools browser
- Raw response source and live/rendered DOM
- Save main HTML, save selected responses, save complete page, and export ZIP
- Network list with method, URL, status, type, size, timing, initiator, headers, request body, and response body
- Search/filter, copy, copy as cURL, replay, block, redirect, and edit request
- Export HAR
- Default lightweight WebView-hook mode
- Optional local proxy + user-installed LuckyBox CA mode
- Credentials/cookies/authorization may be shown unredacted locally
- Capture is session-only unless the user manually exports
- Inspector panel is below the page in portrait and side-by-side in landscape/tablet

## Existing foundation

LuckyBox already has:

1. A local preview server (`CreateServer`) using configurable server and preview ports.
2. An isolated custom Android WebView plugin.
3. Hidden and fullscreen WebView modes.
4. Page navigation/title events.
5. JavaScript evaluation and a two-way message bridge.
6. Download support and browser activity.

The new tools will extend the custom WebView plugin rather than build a second browser engine.

## Architecture

### UI layer

`src/devtools/`

- `browser/` — address bar, tabs, navigation, viewport controls
- `source/` — raw source, rendered DOM, formatting, search, save/export
- `network/` — request table, detail tabs, filters, HAR/cURL/replay
- `console/` — console messages and evaluated expressions
- `storage/` — cookies/localStorage/sessionStorage viewer
- `elements/` — DOM tree and selected-element bridge (later phase)

The DevTools panel lives in LuckyBox's Cordova UI. The inspected page remains in an isolated native WebView.

### Capture mode A: WebView Hook

Enabled by default, no certificate installation.

Sources:

- `WebViewClient.shouldInterceptRequest`
- navigation callbacks
- injected wrappers for `fetch` and `XMLHttpRequest`
- Resource Timing API
- console bridge

Advantages:

- Immediate and safe default
- No device CA configuration
- Excellent for local projects and normal debugging

Limitations:

- Android WebView does not expose every request body/response body natively
- Service workers, streaming responses, WebSockets, cached responses, redirects, and opaque/CORS responses may be incomplete
- Hooking page JavaScript can be bypassed by code that runs before injection

The UI must visibly mark incomplete fields instead of inventing data.

### Capture mode B: Local Proxy + CA

Explicit advanced mode.

- Local loopback proxy bound only to `127.0.0.1`
- Per-install LuckyBox CA generated on device
- User explicitly installs/trusts the CA
- WebView traffic is routed through the local proxy
- TLS interception is enabled only for the current DevTools session
- Certificate private key remains in Android Keystore/app-private storage
- Proxy and capture state are destroyed when the session ends

Advantages:

- Request and response headers/bodies
- Request pause/edit/block/redirect/replay
- More accurate timing and HAR

Limitations:

- Certificate-pinned websites will fail or bypass interception
- QUIC/HTTP3 should be disabled for proxied WebView sessions or will not be captured
- WebSockets require explicit proxy support
- Android/user CA trust behavior differs by OS version
- This mode must never silently affect traffic outside LuckyBox

## Privacy and security rules

The selected policy is local-full visibility. Therefore:

- Full cookies, Authorization headers, tokens, and form bodies may be displayed locally
- Export actions show a warning because HAR/ZIP/cURL can contain credentials
- Captures are not uploaded
- No analytics or telemetry
- Capture storage is memory/session-based
- Closing a tab/session clears bodies, rules, cookies copied into the proxy jar, and temporary files
- Proxy listens on loopback only
- CA private key is non-exportable where Android Keystore permits
- Incognito DevTools sessions use an isolated WebView data directory when supported

## Network data model

Implemented initial model: `src/devtools/network/NetworkSession.js`

Features already represented:

- In-memory request lifecycle
- Request/response metadata and bodies
- Filtering
- Session entry limit
- Interception rules for block/redirect/edit
- HAR 1.2 export
- Explicit destruction/cleanup

## Source APIs

Initial live-DOM APIs added to `src/lib/webview.js`:

- `webviewInstance.getRenderedSource()`
- `webviewInstance.getPageSnapshot()`

`getPageSnapshot()` returns:

- URL and title
- content type and character set
- ready state
- rendered DOM source
- Resource Timing entries

Raw response source will come from the main-document network record. In default hook mode, a separate authenticated fetch may be required when WebView does not expose the body. In proxy mode, the exact captured response body is used.

## Complete-page download

The downloader will:

1. Capture raw main HTML.
2. Collect network resources and DOM-discovered URLs.
3. Respect the current page's cookies and headers inside the isolated session.
4. Save resources using collision-safe paths.
5. Rewrite eligible HTML/CSS references to local paths.
6. Produce a folder or ZIP with a manifest.
7. Mark resources that failed, were blocked, streamed, or were cross-origin opaque.

This is a debugging snapshot, not a promise that every modern web app works offline. Server APIs, authentication, service workers, dynamic chunks, DRM, and certificate-pinned resources may remain online-only.

## Implementation phases

### Phase 1 — Browser shell and source tools

- Browser tabs, address bar, back/forward/reload/stop
- Local preview integration
- Raw Source and Rendered DOM tabs
- Syntax highlighting, format, search, copy, save
- Download main HTML

### Phase 2 — Hook-mode Network panel

- Navigation and resource records
- Injected fetch/XHR capture
- Console capture
- Headers/bodies where available
- Filters, details, copy URL/cURL
- HAR export

### Phase 3 — Download complete page

- Asset collector
- Response export
- ZIP writer
- Rewrite engine and failure manifest

### Phase 4 — Proxy/interception engine

- Loopback proxy service
- CA generation/install instructions
- TLS MITM for LuckyBox WebViews only
- Pause/edit/block/redirect/replay
- WebSocket capture
- Session teardown and certificate diagnostics

### Phase 5 — Advanced DevTools

- Elements/DOM inspector and element picker
- Styles/computed styles
- Storage/cookies
- Mobile viewport/device emulation
- Performance timeline

## Practical warning

“Inspect everything” cannot be guaranteed for every external site. Certificate pinning, DRM, native networking inside WebAssembly, service workers, QUIC, and anti-debugging controls can limit capture. LuckyBox will report these limitations clearly and will not attempt to bypass certificate pinning or security controls belonging to third-party applications.
