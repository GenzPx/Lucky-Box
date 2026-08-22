# Inspeksi Acode v1.13.1 APK

APK sumber: `Downloads/Acode-v1.13.1.apk`
Folder hasil bongkar: `Acode-v1.13.1-unpacked/`
Metode: Apktool 3.0.3, resources dan aset dibongkar; DEX dipertahankan mentah untuk tahap awal.

## Ringkasan

- Package: `com.foxdebug.acode`
- Version: `1.13.1` (`versionCode 1007`)
- Minimum Android: API 26 / Android 8
- Target & compile SDK: API 36
- Arsitektur aplikasi: **hybrid Cordova + Android native**
- Frontend utama: HTML/CSS/JavaScript di `assets/www/`
- Editor: bundle memuat banyak referensi **Ace**, plus CodeMirror/LSP tooling
- Terminal lokal: Alpine rootfs + proot + native libraries
- Jumlah file hasil ekstraksi: sekitar 1.214
- Ukuran folder hasil bongkar: sekitar 71 MB

## Peta komponen

### 1. Frontend/UI — target modifikasi tampilan paling mudah

Lokasi: `assets/www/`

File penting:

- `index.html` — entry point dan splash screen
- `logo.svg` — logo splash
- `build/main.css` — stylesheet utama (~246 KB)
- `build/main.js` — bundle aplikasi utama (~3,2 MB; sudah diminify)
- `build/boot.js` — bootstrap aplikasi
- `build/*.chunk.js` — fitur yang di-load terpisah
- `build/about.css`, `fileBrowser.css`, `plugins.css`, `problems.css`, `mainSettings.css`, `changeTheme.css`, `customTheme.css`, `fontManager.css`, dll.
- Font: Fira Code, Roboto Mono, Meslo, KaTeX, dan file-icons

Bundle/worker besar:

- `typescriptLspWorker.js` ~6,7 MB
- `main.js` ~3,2 MB
- `5675.chunk.js` ~2,3 MB
- `htmlLspWorker.js` ~1,6 MB
- `cssLspWorker.js` ~1,0 MB
- `main.css` ~246 KB

UI ini berjalan di Android WebView melalui Cordova. Branding, splash, warna, CSS, icon, layout tertentu, dan beberapa perilaku JS dapat diubah langsung dari area ini. Namun bundle JS sudah diminify; untuk perubahan fitur besar lebih aman memakai source code resmi tag `v1.13.1` daripada mengedit bundle secara manual.

### 2. Android native shell

Manifest: `AndroidManifest.xml`

Activity:

- `com.foxdebug.acode.MainActivity` — activity utama, launcher, open/edit file, dan deep link `acode://`
- `com.foxdebug.browser.BrowserActivity`
- `com.foxdebug.webview.WebViewActivity`
- `com.foxdebug.crashhandler.CrashActivity`
- Billing/Google support activities

Service:

- `com.foxdebug.acode.rk.exec.terminal.TerminalService` — terminal sebagai foreground service
- Google DataTransport services

Provider:

- Dua AndroidX `FileProvider`
- `AlpineDocumentProvider` — membuka filesystem terminal lewat Storage Access Framework
- AndroidX Startup provider

Receiver:

- AndroidX profile installer
- DataTransport scheduler receiver

Kode compiled native Android saat ini ada di:

- `classes.dex` ~8,0 MB
- `classes2.dex` ~9,9 MB
- `classes3.dex` ~1,65 MB

DEX belum didekompilasi menjadi Java/Kotlin pada tahap ini. Apktool sengaja dijalankan dengan `--no-src` agar inspeksi pertama tetap ringkas dan struktur UI cepat terlihat.

### 3. Terminal dan native libraries

Lokasi:

- `assets/alpine_assets/{arm32,arm64,x64}/alpine.rootfs`
- `assets/init-alpine.sh`
- `assets/init-sandbox.sh`
- `assets/rm-wrapper.sh`
- `lib/{arm64-v8a,armeabi-v7a,x86_64}/`

Native libraries:

- `libaxs.so`
- `libproot.so`
- `libproot32.so` (arsitektur tertentu)
- `libproot-xed.so`
- `libtalloc.so`

APK mendukung ARM 32-bit, ARM64, dan x86_64.

### 4. Cordova bridge/plugins

Daftar plugin berasal dari `assets/www/cordova_plugins.js`:

- Clipboard
- Device info
- File API
- Local HTTP server
- FTP dan SFTP
- SD card access
- WebSocket
- Build info
- Browser
- Terminal/executor
- Plugin context
- Auth
- proot
- In-app purchase
- Custom tabs
- System integration
- Crash handler
- Advanced HTTP
- Custom Acode WebView

Plugin native buatan Acode memakai namespace `com.foxdebug.acode.rk.*`.

## Permissions

- Internet dan network state
- Read/write external storage (legacy compatibility)
- Vibrate dan wake lock
- Foreground service + special-use foreground service
- Notifications
- Google Play Billing

Catatan konfigurasi:

- `usesCleartextTraffic="true"`
- `requestLegacyExternalStorage="true"`
- `largeHeap="true"`
- App dapat membuka semua MIME type dari `file://` dan `content://`

Pengaturan cleartext dan legacy storage mungkin dibutuhkan oleh fitur server/file Acode, tetapi perlu ditinjau jika membuat build yang lebih ketat dari sisi keamanan.

## Bagian yang paling realistis untuk ditingkatkan

1. **Visual refresh** — warna, spacing, radius, typography, sidebar, dialogs, file browser, settings, plugin page.
2. **Splash dan branding** — `index.html`, `logo.svg`, serta launcher resources di `res/mipmap-*`.
3. **Editor UX** — toolbar, tabs, quick tools, command palette, split panes; idealnya lewat source code, bukan bundle hasil minify.
4. **Performance** — lazy loading bundle/worker, font loading, startup flow, serta audit ukuran worker LSP.
5. **Terminal UX** — setup Alpine, terminal service UI, font/keyboard controls.
6. **Security hardening** — cleartext traffic, exported components, deep links, provider paths, dan legacy storage.
7. **APK size** — kemungkinan split per ABI dan meninjau Alpine rootfs/font/worker yang dibundel.

## Catatan rebuild

Folder ini dapat dijadikan basis patch resource, lalu dibuild kembali dengan Apktool. APK hasil rebuild wajib ditandatangani dengan signing key baru dan biasanya tidak bisa dipasang sebagai update di atas APK resmi karena signature berbeda. Untuk pengembangan berkelanjutan, jalur terbaik adalah checkout source resmi tag `v1.13.1`, ubah kode sumber, lalu build dengan toolchain proyek.
