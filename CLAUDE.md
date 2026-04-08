# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MnemoTag is a **client-side, single-page** image editor (vanilla JS, no framework, no build step). It applies filters, adds text/image watermarks, crops, and exports JPEG/PNG/WebP/AVIF — all in the browser. The UI also exposes an "EXIF metadata" form, but **that part is a stub** — see "EXIF/metadata writing is a stub" below before assuming it works. Documentation is in Spanish; UI strings, comments, and commit messages are in Spanish too.

## Running and developing

There is no `package.json`, no bundler, no test framework. The app is a static site:

- **Run locally:** open `index.html` directly in a browser, or use the VS Code Live Server extension (configured to port 5505 in `.vscode/settings.json`).
- **No build, no lint.** Tests live in `tests/` and run as a static HTML page: serve the project root with Live Server and open `http://localhost:5505/tests/index.html`. The runner is a ~250-line custom mini-framework (`tests/test-runner.js`) with no dependencies. Specs cover `AppConfig`, `helpers`, `SecurityManager`, `MetadataManager`, `historyManager`, plus regression tests for the XSS-in-batch / worker-path / falsy-metadata-toast bugs that were fixed in this codebase. The regression tests use `fetch()` to read source files, so they only work when served via HTTP (not `file://`).
- **External deps are CDN-loaded** in `index.html` (Tailwind 2.2.19, Font Awesome 6.4.0, JSZip 3.10.1, Google Fonts). There is nothing to `npm install`.
- **Cache busting:** only one `<script>` currently uses a cache-busting query string — `metadata-manager.js?v=1760378841` in `index.html:1488`. Bump it (or add the same trick to other files) when a hard refresh isn't picking up changes during development.

## Architecture

The app is partway through a long-running modularization effort: logic is being extracted from a single monolithic `js/main.js` (~7k lines) into focused manager modules. **`main.js` is still the orchestrator** — it owns the global mutable state (current image, canvas, zoom/pan, rotation, drag state, ruler state, etc.) and wires everything together. New managers are added by sourcing them in `index.html` *before* `main.js`.

### Load order matters

Scripts are loaded as plain `<script>` tags (no ES modules, no `import`/`export`). Each file attaches a global object (e.g. `AppConfig`, `SecurityManager`, `WorkerManager`). The order in `index.html` is the dependency order — utils first, then managers, then `main.js` last. When adding a new module, place it after its dependencies and before any consumer.

### Module layout

```
js/
├── main.js                 # Orchestrator + global state + most event wiring
├── image-processor.js      # Web Worker script (OffscreenCanvas-based filters)
├── utils/
│   ├── app-config.js       # AppConfig: file size limits, canvas dims, debounce delays
│   ├── helpers.js          # debounce/throttle, formatFileSize, canvasToBlob
│   ├── smart-debounce.js   # Adaptive debouncing for filter previews
│   ├── filter-cache.js     # LRU cache for processed filter results
│   ├── fallback-processor.js  # Main-thread fallback when workers unavailable
│   └── keyboard-shortcuts.js  # ⌘-key bindings (Mac-optimized)
└── managers/
    ├── security-manager.js     # XSS sanitization, file/dimension validation
    ├── worker-manager.js       # Web Worker pool (transferable objects, job queue) — script path lives at js/image-processor.js
    ├── history-manager.js      # Undo/redo stack
    ├── metadata-manager.js     # Form values + localStorage persistence (NOT real EXIF — see stub note below)
    ├── filter-loading-manager.js  # Lazy filter module loading
    ├── filter-manager.js       # Filter pipeline + presets
    ├── ui-manager.js           # Toasts, modals, collapsible sections, hero
    ├── batch-manager.js        # Multi-image processing → ZIP export (JSZip)
    ├── text-layer-manager.js   # Multi-layer text rendering with Google Fonts
    └── crop-manager.js         # Aspect-ratio cropping with presets
```

### Key cross-cutting state (in `main.js`)

These globals are referenced throughout `main.js` and read by some managers — be careful when refactoring:

- `currentImage`, `currentFile`, `canvas`, `ctx`, `originalExtension`, `fileBaseName`
- `currentRotation`, `isFlippedHorizontally`, `isFlippedVertically`
- `currentZoom`, `panX`, `panY`, `isPanning` — zoom/pan system
- `customImagePosition`, `customTextPosition`, `isPositioningMode`, `isDragging`, `dragTarget` — watermark drag-and-drop
- `isRulerMode`, `rulerElements` — metric ruler overlay
- `cache` — local LRU cache for processed image data (separate from `filter-cache.js`)

### Image processing pipeline

1. User drops/selects file → `SecurityManager.validateImageFile` checks MIME, size, extension.
2. Image is loaded into a hidden `<canvas>` (max 2400×2400 per `AppConfig`).
3. Heavy filters go through `WorkerManager` (`js/managers/worker-manager.js`), which spins up a pool of `Worker` instances pointing at `js/image-processor.js`. If workers or `OffscreenCanvas` aren't supported, or initialization fails, the code falls back to `js/utils/fallback-processor.js` on the main thread. Note: the worker path was historically wrong (`'workers/image-processor.js'` — file was never there); it was corrected to `'js/image-processor.js'`. This means the worker pool was effectively dead until that fix, so any "worker performance" baseline before that change is meaningless.
4. Watermarks (text and/or image), text layers, crop, and rotation are composited in `main.js`. The export itself uses the native canvas (no workers) regardless of the above.
5. Export goes through `helpers.canvasToBlob` (`js/utils/helpers.js:170`), which probes WebP/AVIF support; if `canvas.toBlob` with the requested type fails, it emits a `console.warn` and falls back via `canvasToBlob_fallback`. **The fallback only produces PNG/JPEG** — WebP/AVIF only work via the native `canvas.toBlob` path. Don't assume a `.webp` request will yield WebP on every browser.
6. Saving uses the **File System Access API** (`showSaveFilePicker`, gated by `if ('showSaveFilePicker' in window)` at `main.js:3981`) when available, otherwise an `<a download>` link. **Do not** pass the result of `queryPermission()` as `startIn` — that bug (caught in 3.1.4) caused silent download failures.

### Watermark drag-and-drop system

Watermarks (text and image) can be free-positioned by dragging. `main.js` maintains `textWatermarkBounds` and `imageWatermarkBounds` (`{x, y, width, height}` rectangles in canvas coordinates) and dotted guide borders rendered in distinctive colors (blue for text, orange for image). The flag `showPositioningBorders` is toggled to `false` immediately before exporting so guides don't appear in the downloaded image — if you add new render passes, respect this flag.

### Metric ruler overlay

When `isRulerMode` is true, `main.js` injects DOM-level ruler/guide elements (tracked in `rulerElements`) on top of the canvas. They're plain DOM (not drawn to canvas), so they never end up in exports. Guide-line color is chosen by sampling background brightness via `getImageData()` — keep that in mind if you change canvas pixel formats.

### EXIF/metadata writing is a stub

Despite the project marketing itself as an "EXIF metadata editor", **no metadata is ever written into the exported file**. `MetadataManager.applyMetadataToImage()` (`js/managers/metadata-manager.js:249-272`) only stores the form values in `localStorage` — its own comment admits this: *"Crear metadatos EXIF simulados (en un proyecto real usarías una librería como piexifjs)"*. The downloaded JPEG/PNG/WebP comes out clean. The form values are kept across sessions (so the `Author` field is remembered) and used as the filename basename, but that's the extent of it. If you implement real EXIF writing, JPEG would need `piexifjs` (or similar), PNG needs `tEXt`/`iTXt` chunk manipulation, and WebP needs RIFF `EXIF`/`XMP ` chunk manipulation — three different code paths.

### Theming

Theme is controlled via `[data-theme="dark"]` on the root, **not** Tailwind's `dark:` variants. Tailwind dark utilities will not work — write theme overrides as `[data-theme="dark"] .selector { ... }` in `css/styles.css`. This caused a real bug fixed in 3.1.4.

### Zoom by device

Mouse-wheel/trackpad zoom is **intentionally disabled on desktop (>767px)** to avoid accidental zoom from Magic Mouse / trackpads. Desktop users zoom only via the on-screen +/-/100% buttons. Mobile keeps pinch and wheel zoom. Don't "fix" this by re-enabling wheel zoom on desktop.

## Versioning and commits

**The version number is partially desynchronized.** `index.html:6` `<title>` was synced to `MnemoTag v3.2.12` (matching the current commit) during the Tier 1 cleanup, but `README.md` and `CHANGELOG.md` still say `3.1.4`. `git log` is the most up-to-date source. If you cut a real release, sync `README.md`, `CHANGELOG.md`, and `docs/INDICE_DOCUMENTACION.md` to match.

Commit messages follow `Versión X.Y.Z - <descripción>` in Spanish — match this style. `CHANGELOG.md` and the docs under `docs/` are kept hand-updated per release.
