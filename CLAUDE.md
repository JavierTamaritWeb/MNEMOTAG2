# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MnemoTag is a **client-side, single-page** image editor (vanilla JS, no framework, no build step). It applies filters, adds text/image watermarks, crops, and exports JPEG/PNG/WebP/AVIF — all in the browser. **EXIF metadata writing works for JPEG only** (via piexifjs CDN) — PNG/WebP/AVIF still come out without metadata. See "EXIF/metadata writing — JPEG only" below for details. Documentation is in Spanish; UI strings, comments, and commit messages are in Spanish too.

## Running and developing

There is no `package.json`, no bundler, no test framework. The app is a static site:

- **Run locally:** open `index.html` directly in a browser, or use the VS Code Live Server extension (configured to port 5505 in `.vscode/settings.json`).
- **No build, no lint.** Tests live in `tests/` and have **two runners** that share the same specs:
  - **Browser runner (authoritative).** `tests/index.html` + `tests/test-runner.js` (~250-line custom mini-framework, zero dependencies). Serve the project root with Live Server and open `http://localhost:5505/tests/index.html`. This is the source of truth — it executes against a real DOM, real Canvas, real `fetch()`. Use it before any release.
  - **Node runner (fast / CI / agent-friendly).** `tests/run-in-node.js` runs the same `tests/specs/*.spec.js` files inside a `vm.createContext` with minimal polyfills (`document`, `localStorage`, `performance`, and `fetch` aliased to `fs.readFileSync`). Command: `node tests/run-in-node.js`. Finishes in ~80 ms. No npm, no `package.json`, no `node_modules` — uses only Node's built-in `fs`/`path`/`vm`. Use it as a smoke check before committing, or from any agent that doesn't have a browser. **Caveat:** because the DOM is stubbed, any future test that touches a real `Canvas` 2D context, real layout, or live event dispatch will pass in Node but only the browser runner can truly verify it.
  - **Binary validation runner (low-level).** `tests/binary-validation.js` (added in v3.3.8) carga `helpers.js` y `metadata-manager.js` en un VM context con polyfills mínimos, sintetiza un PNG mínimo (1×1 rojo) y tres WebP (VP8 lossy, VP8L lossless, VP8X extended) **a mano byte por byte**, y verifica que `_buildPngExifChunk`, `_insertExifChunkInPng`, `_parseWebpDimensions`, `_buildVp8xChunk`, `_buildRiffExifChunk` y `_convertSimpleWebpToVp8xWithExif` producen output con la estructura binaria correcta — incluyendo el CRC32 del chunk eXIf comparado contra una computación independiente. Comando: `node tests/binary-validation.js`. 36 aserciones, ~100 ms. **No sustituye a la validación browser** (no decodifica imágenes reales), pero captura regresiones en bytes calculados, offsets, padding o magic bytes. Importante: el orden de carga importa — `helpers.js` debe ir antes que `metadata-manager.js` porque `_buildPngExifChunk` usa `crc32`, y si el orden se invierte el chunk se construye con CRC=0 (la función tiene un fallback defensivo).
- **CI/CD con GitHub Actions** (desde v3.3.9): hay dos workflows en `.github/workflows/`:
  - `test.yml`: corre los dos runners Node en cada `push` y `pull_request` a `main`. Sirve como "test gate" del proyecto. Si alguno de los 136 tests falla, el job queda rojo. Se puede usar como required check en branch protection.
  - `deploy.yml`: tras cada push a `main`, re-corre los tests como defensa en profundidad y despliega el repo entero a **GitHub Pages** (`https://javiertamaritweb.github.io/MNEMOTAG2/`). Sin build step. La primera ejecución **falla** hasta que se active Pages a mano en `Settings → Pages → Source = GitHub Actions`. Documentado en `.github/workflows/README.md`.
  - **NO se introdujo npm en el código de la app**. Los workflows usan Node solo para ejecutar los tests existentes, que son JavaScript puro sin dependencias.
  - Specs cover `AppConfig`, `helpers`, `SecurityManager`, `MetadataManager` (including the JPEG EXIF embedding methods), `historyManager`, plus regression tests for the XSS-in-batch / worker-path / falsy-metadata-toast bugs and for the EXIF integration. Current count: **67 tests**, all green.
- **External deps are CDN-loaded** in `index.html` (Tailwind 2.2.19, Font Awesome 6.4.0, JSZip 3.10.1, piexifjs 1.0.6, Google Fonts). There is nothing to `npm install`.
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
    ├── metadata-manager.js     # Form values + localStorage + JPEG EXIF writing via piexifjs
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
5. Export goes through `helpers.canvasToBlob` (`js/utils/helpers.js:170`), which probes WebP/AVIF support; if `canvas.toBlob` with the requested type fails, it emits a `console.warn` and falls back via `canvasToBlob_fallback`. **The fallback only produces PNG/JPEG** — WebP/AVIF only work via the native `canvas.toBlob` path. Don't assume a `.webp` request will yield WebP on every browser. **JPEG export with alpha**: when the user picks JPEG and the source canvas has transparency, `main.js` first calls `flattenCanvasForJpeg(canvas)` (in `helpers.js`) which returns a new canvas with a white background and the original drawn on top. This avoids the JPEG codec rendering transparent areas as black (its default). PNG/WebP/AVIF do **not** flatten — they preserve alpha. Before v3.3.2, `determineFallbackFormat` silently substituted PNG for JPEG when alpha was present; that bug was fixed.
6. Saving uses the **File System Access API** (`showSaveFilePicker`, gated by `if ('showSaveFilePicker' in window)` at `main.js:3981`) when available, otherwise an `<a download>` link. **Do not** pass the result of `queryPermission()` as `startIn` — that bug (caught in 3.1.4) caused silent download failures.

### Watermark drag-and-drop system

Watermarks (text and image) can be free-positioned by dragging. `main.js` maintains `textWatermarkBounds` and `imageWatermarkBounds` (`{x, y, width, height}` rectangles in canvas coordinates) and dotted guide borders rendered in distinctive colors (blue for text, orange for image). The flag `showPositioningBorders` is toggled to `false` immediately before exporting so guides don't appear in the downloaded image — if you add new render passes, respect this flag.

### Metric ruler overlay

When `isRulerMode` is true, `main.js` injects DOM-level ruler/guide elements (tracked in `rulerElements`) on top of the canvas. They're plain DOM (not drawn to canvas), so they never end up in exports. Guide-line color is chosen by sampling background brightness via `getImageData()` — keep that in mind if you change canvas pixel formats.

### EXIF/metadata writing — JPEG, PNG and WebP

EXIF writing is implemented para **JPEG** (via `piexifjs@1.0.6` cargado por CDN), **PNG** (manipulación binaria del chunk `eXIf`) y **WebP** (manipulación RIFF + conversión a VP8X). Sin librerías externas más allá de piexifjs. **AVIF** sigue sin metadatos: necesitaría ISOBMFF boxes, mucho más complejo.

**PNG implementation (v3.3.6)**: el chunk `eXIf` (PNG spec 1.5) recibe el bloque TIFF que genera `piexif.dump()` después de strippearle la cabecera APP1 + `Exif\0\0`. La manipulación está en `MetadataManager._buildPngExifChunk` + `_insertExifChunkInPng`, usando la utilidad `crc32` de `helpers.js`. El chunk se inserta antes del primer `IDAT`. Si ya hay un `eXIf` previo se reemplaza. Defensiva: ante error devuelve el blob original.

**WebP implementation (v3.3.7)**: WebP usa el contenedor RIFF con chunks. Para tener metadatos EXIF necesita el header VP8X (extended). Si el WebP es "simple" (solo `VP8 ` lossy o `VP8L` lossless), `MetadataManager.embedExifInWebpBlob` lo **convierte a VP8X** insertando un chunk `VP8X` con las dimensiones reales (parseadas del bitstream) y los flags apropiados, luego añade el chunk `EXIF` al final. Si ya es VP8X, solo añade el `EXIF` y setea el bit 3 del header. Métodos relevantes: `_parseWebpDimensions`, `_buildVp8xChunk`, `_buildRiffExifChunk`, `_addExifToVp8xWebp`, `_convertSimpleWebpToVp8xWithExif`. **Ultra-defensiva**: ante cualquier error o validación post-generación fallida (`RIFF`/`WEBP` magic bytes), devuelve el blob original. Nunca produce un WebP corrupto. **Atención**: la validación visual con un browser real es indispensable para confirmar que los WebP generados por el flujo son leíbles y muestran EXIF en visores externos. El runner Node no puede verificarlo.

**Implementation:**
- `MetadataManager.buildExifObject(metadata)` builds a piexif-compatible object from the form fields. Maps `title → ImageDescription`, `author → Artist`, `copyright → Copyright`, `software → Software`, `createdAt → DateTimeOriginal + DateTime`, and `latitude/longitude/altitude → GPS IFD` (with N/S/E/W refs and DMS rationals via `piexif.GPSHelper.degToDmsRational`). Returns `null` if there is nothing to write or if `piexif` isn't loaded.
- `MetadataManager.embedExifInJpegBlob(blob)` (async) takes a JPEG `Blob`, converts it to a dataURL via `FileReader`, calls `piexif.dump()` + `piexif.insert()`, and rebuilds a new `Blob` from the resulting base64. Returns the **original** blob if it isn't JPEG, if `piexif` is missing, or if the form has no data — graceful degradation, never throws.
- `MetadataManager.embedExifInJpegDataUrl(dataUrl)` (sync) is the dataURL-only twin used in the `<a download>` fallback path.
- `main.js` calls these in **four places** in the download flow: `downloadImage` and `downloadImageWithProgress`, each with both the `showSaveFilePicker` path (Blob) and the `<a download>` fallback (dataURL).

**Form fields that are NOT written to EXIF:**
- `description` and `keywords`: EXIF has no clean native tag for them. Microsoft's `XPSubject`/`XPComment` exist but require UTF-16 LE encoding and are flaky across readers; they're skipped.
- `license`: bundled into the `copyright` string by `generateCopyright()` instead.

`MetadataManager.applyMetadataToImage()` (`metadata-manager.js:249-272`) **still exists** and still only writes to `localStorage` — that part is unchanged. It's now a complement to `embedExifInJpegBlob`, not a replacement: localStorage preserves form values across sessions, while `embedExifInJpegBlob` actually writes them into the file.

### Theming

Theme is controlled via `[data-theme="dark"]` on the root, **not** Tailwind's `dark:` variants. Tailwind dark utilities will not work — write theme overrides as `[data-theme="dark"] .selector { ... }` in `css/styles.css`. This caused a real bug fixed in 3.1.4.

### Zoom by device

Mouse-wheel/trackpad zoom is **intentionally disabled on desktop (>767px)** to avoid accidental zoom from Magic Mouse / trackpads. Desktop users zoom only via the on-screen +/-/100% buttons. Mobile keeps pinch and wheel zoom. Don't "fix" this by re-enabling wheel zoom on desktop.

## Versioning and commits

**Current version: v3.3.16** (feature release: PWA real con Service Worker. Nuevo archivo `service-worker.js` en la raíz del proyecto que precachea los assets críticos (index.html, CSS, todos los JS de utils/managers, manifest, favicon) y aplica dos estrategias híbridas: cache-first para recursos del mismo origen y network-first para CDNs externas conocidas (jsdelivr, cdnjs, fonts.google). El cache se versiona con `mnemotag-v3.3.16` y el listener `activate` borra cualquier cache anterior. Registro desde `js/main.js` en `window.load` con scope `./`. Meta tags PWA iOS añadidos a `index.html`. `start_url` del manifest cambiado a `../../` (relativo desde `images/favicon_io/`) para compatibilidad con GitHub Pages bajo `/MNEMOTAG2/`). Sources kept in sync: `index.html` `<title>`, `README.md` badge + NOVEDADES heading, `CHANGELOG.md` header + footer + topmost entry, and `docs/INDICE_DOCUMENTACION.md`. Note: `docs/RESUMEN_VERSIONES.md` is a hand-curated historical table that still marks `v3.1.4` as "Actual" — it has not been updated in the bump and would need a dedicated entry with narrative. `git log` remains the authoritative source for the actual commit version.

Commit messages follow `Versión X.Y.Z - <descripción>` in Spanish — match this style. `CHANGELOG.md` and the docs under `docs/` are kept hand-updated per release.
