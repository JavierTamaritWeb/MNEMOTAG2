# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project overview

MnemoTag is a **client-side, single-page** image editor (vanilla JS, no framework). It applies filters, adds text/image watermarks, crops, and exports JPEG/PNG/WebP/AVIF — all in the browser. **EXIF metadata writing works for JPEG, PNG, WebP and AVIF** (TIFF generado con piexifjs local; contenedores PNG/WebP/AVIF mediante manipulación binaria propia). See "EXIF/metadata writing" below for details. Documentation is in Spanish; UI strings, comments, and commit messages are in Spanish too. Since v3.5.0, the project uses **Gulp 5** as build tool (SCSS compilation + JS bundling + minification).

## Running and developing

The app is a static site with a Gulp-based build system:

- **Setup:** `npm install` (one-time, installs Gulp + SCSS compiler + browser-sync).
- **Build:** `npm run build` compiles SCSS → `dist/css/styles.css` and bundles 24 JS files → `dist/js/app.min.js`.
- **Dev:** `npm run dev` runs build + watch + browser-sync on port 5507 (no auto-reload).
- **Run locally:** open `index.html` in a browser, or use `npm run serve` (browser-sync on port 5507).
- Tests live in `tests/` and combine Node, binary, browser and Playwright runners:
  - **Browser runner (authoritative).** `tests/index.html` + `tests/test-runner.js` (~250-line custom mini-framework, zero dependencies). Serve the project root with Live Server and open `http://localhost:5505/tests/index.html`. This is the source of truth — it executes against a real DOM, real Canvas, real `fetch()`. Use it before any release.
  - **Node runner (fast / CI / agent-friendly).** `tests/run-in-node.js` runs the same `tests/specs/*.spec.js` files inside a `vm.createContext` with minimal polyfills (`document`, `localStorage`, `performance`, and `fetch` aliased to `fs.readFileSync`). Command: `node tests/run-in-node.js`. Finishes in ~80 ms. No npm, no `package.json`, no `node_modules` — uses only Node's built-in `fs`/`path`/`vm`. Use it as a smoke check before committing, or from any agent that doesn't have a browser. **Caveat:** because the DOM is stubbed, any future test that touches a real `Canvas` 2D context, real layout, or live event dispatch will pass in Node but only the browser runner can truly verify it.
  - **Binary validation runner (low-level).** `tests/binary-validation.js` carga `helpers.js` y `metadata-manager.js` en un VM context con polyfills mínimos, sintetiza un PNG mínimo (1×1 rojo), tres WebP (VP8 lossy, VP8L lossless, VP8X extended) y un AVIF sintético (164 bytes con meta+mdat) **a mano byte por byte**, y verifica que las funciones de manipulación binaria producen output correcto. Comando: `node tests/binary-validation.js`. **86 aserciones**, ~100 ms. Importante: el orden de carga importa — `helpers.js` debe ir antes que `metadata-manager.js` porque `_buildPngExifChunk` usa `crc32`.
- **Playwright E2E:** `npm run test:e2e` prueba desarrollo y `npm run test:e2e:dist` sirve exclusivamente `dist/`. Ambos deben pasar antes de release.
- **Linting:** `npm run lint:js` and `npm run lint:css`. ESLint 9 y Stylelint estan fijados en `devDependencies`.
- **CI/deploy:** los workflows separados de test/lint se eliminaron en v3.5.7; `.github/workflows/deploy.yml` ejecuta checkout limpio, build, tests, lint y publica `dist/` en GitHub Pages.
- **External deps:** Tailwind, Font Awesome, JSZip, heic2any y Google Fonts se cargan externamente. `piexifjs 1.0.6` se sirve localmente desde `js/vendor/` porque el minificado dinamico de jsDelivr no admite SRI estable.

## Architecture

The app is partway through a long-running modularization effort: logic is being extracted from a single monolithic `js/main.js` (~7k lines) into focused manager modules. **`main.js` is still the orchestrator** — it owns the global mutable state (current image, canvas, rotation, drag state, ruler state, etc.) and wires everything together. New managers are added to the `JS_FILES` array in `gulpfile.js` in dependency order.

### Build system (v3.5.0+)

- **Gulp 5** compiles SCSS → `dist/css/styles.css` and bundles 24 JS files → `dist/js/app.min.js`.
- **`src/scss/`** organized in subfolders: `abstracts/_variables`, `base/_base`, `layout/_layout`, `components/_components`, `pages/_preview`, `pages/_hero`, `modules/_modals`. Edit these, NOT `dist/css/styles.css`.
- **`gulpfile.js`** tasks: `jsBundle`, `scssCompile`, `images` (copy + WebP/AVIF via sharp), `html` (minify for production), `copyAssets` (workers + service-worker), `clean`.
- **`dist/`** is the self-contained production directory: `npm run build` generates it. Deploy `dist/` to any static host.
- **`dist/index.html`** is a minified copy with `dist/` prefixes removed from local paths. CDN URLs are preserved.
- **`dist/images/`** contains originals + WebP + AVIF variants of every PNG/JPEG.
- Workers (`image-processor.js`, `analysis-worker.js`) are NOT bundled — copied to `dist/js/` separately.
- **`js/app.min.js`** is generated with `mangle: false` (critical — globals must keep their names).

### Debug flag

`MNEMOTAG_DEBUG` is defined in `app-config.js` (loads first). Activate with `?debug=1` in URL or `localStorage.setItem('mnemotag-debug', '1')`. All `console.log/warn` calls are behind this flag — zero logging in production.

### Module layout

```
js/
├── app.min.js              # GENERATED: bundle of all files below (do not edit)
├── main.js                 # Orchestrator + global state + most event wiring
├── image-processor.js      # Web Worker script (OffscreenCanvas-based filters)
├── utils/
│   ├── app-config.js       # AppConfig + MNEMOTAG_DEBUG flag
│   ├── helpers.js          # debounce/throttle, formatFileSize, canvasToBlob, crc32
│   ├── app-state.js        # AppState singleton (getters/setters to main.js vars)
│   ├── smart-debounce.js   # Adaptive debouncing for filter previews
│   ├── filter-cache.js     # LRU cache for processed filter results
│   ├── fallback-processor.js  # Main-thread fallback when workers unavailable
│   └── keyboard-shortcuts.js  # ⌘-key bindings (Mac-optimized)
├── workers/
│   └── analysis-worker.js  # Web Worker for histogram/palette/autoBalance
└── managers/
    ├── security-manager.js     # XSS sanitization, file/dimension validation
    ├── worker-manager.js       # Web Worker pool (transferable objects, job queue)
    ├── history-manager.js      # Undo/redo stack with ImageBitmap
    ├── metadata-manager.js     # Form values + localStorage + EXIF writing (JPEG/PNG/WebP/AVIF)
    ├── filter-loading-manager.js  # Lazy filter module loading
    ├── filter-manager.js       # Filter pipeline + presets
    ├── ui-manager.js           # Toasts, modals, collapsible sections, hero
    ├── batch-manager.js        # Multi-image processing → ZIP export (JSZip)
    ├── text-layer-manager.js   # Multi-layer text rendering with Google Fonts
    ├── crop-manager.js         # Aspect-ratio cropping with presets
    ├── preset-manager.js       # Filter presets in localStorage
    ├── analysis-manager.js     # Histogram, palette, auto-balance (delegates to Worker)
    ├── curves-manager.js       # Curves/levels editor with live preview
    ├── bg-removal-manager.js   # AI background removal (lazy model load)
    ├── export-manager.js       # Download with EXIF embed chain
    └── zoom-pan-manager.js     # Zoom buttons/keyboard/wheel + pan navigation
```

### Key cross-cutting state (in `main.js`)

These globals are referenced throughout `main.js` and read by some managers — be careful when refactoring:

- `currentImage`, `currentFile`, `canvas`, `ctx`, `originalExtension`, `fileBaseName`
- `currentRotation`, `isFlippedHorizontally`, `isFlippedVertically`
- `currentZoom`, `panX`, `panY`, `isPanning` — zoom/pan system (limits in `AppConfig`)
- `originalWidth`, `originalHeight` — original image dimensions for resize
- `customImagePosition`, `customTextPosition`, `isPositioningMode`, `isDragging`, `dragTarget` — watermark drag-and-drop
- `isRulerMode`, `rulerElements` — metric ruler overlay
- `cache` — local LRU cache for processed image data (separate from `filter-cache.js`)

### Image processing pipeline

1. User drops/selects file → `SecurityManager.validateImageFile` checks MIME, size, extension.
2. Image is loaded into a hidden `<canvas>` (max 2400×2400 per `AppConfig`).
3. Heavy filters go through `WorkerManager` (`js/managers/worker-manager.js`), which spins up a pool of `Worker` instances pointing at `js/image-processor.js`. If workers or `OffscreenCanvas` aren't supported, or initialization fails, the code falls back to `js/utils/fallback-processor.js` on the main thread. Note: the worker path was historically wrong (`'workers/image-processor.js'` — file was never there); it was corrected to `'js/image-processor.js'`. This means the worker pool was effectively dead until that fix, so any "worker performance" baseline before that change is meaningless.
4. Watermarks (text and/or image), text layers, crop, and rotation are composited in `main.js`. The export itself uses the native canvas (no workers) regardless of the above.
5. Export goes through `helpers.canvasToBlob` (`js/utils/helpers.js:170`), which probes WebP/AVIF support; if `canvas.toBlob` with the requested type fails, it emits a `console.warn` and falls back via `canvasToBlob_fallback`. **The fallback only produces PNG/JPEG** — WebP/AVIF only work via the native `canvas.toBlob` path. Don't assume a `.webp` request will yield WebP on every browser. **JPEG export with alpha**: when the user picks JPEG and the source canvas has transparency, `main.js` first calls `flattenCanvasForJpeg(canvas)` (in `helpers.js`) which returns a new canvas with a white background and the original drawn on top. This avoids the JPEG codec rendering transparent areas as black (its default). PNG/WebP/AVIF do **not** flatten — they preserve alpha. Before v3.3.2, `determineFallbackFormat` silently substituted PNG for JPEG when alpha was present; that bug was fixed.
6. Saving uses the **File System Access API** (`showSaveFilePicker`, gated by `if ('showSaveFilePicker' in window)`) when available, otherwise an `<a download>` link. **Do not** pass the result of `queryPermission()` as `startIn` — that bug (caught in 3.1.4) caused silent download failures.

### Progress overlay system

Reusable progress bar for long operations. To add a new progress bar to any feature, follow this pattern:

**HTML** (already in `index.html`):
```html
<div id="progress-overlay" class="progress-overlay">
  <div class="progress-card">
    <p id="progress-title" class="progress-card__title">Procesando...</p>
    <div class="progress-card__track">
      <div id="progress-bar" class="progress-card__bar"></div>
    </div>
    <p id="progress-text" class="progress-card__text">0%</p>
    <p id="progress-eta" class="progress-card__eta"></p>
  </div>
</div>
```

**JS API** (defined in `main.js`, available to all managers via closure):
- `showProgressBar(title)` — shows the overlay with the given title, resets bar to 0%.
- `updateProgress(percentage, message, eta)` — sets bar width, text, and optionally updates title and ETA.
- `hideProgressBar()` — hides the overlay.
- `simulateProgressSteps(steps, totalDuration)` — animates through an array of `{message, duration}` steps. Returns a Promise that resolves when all steps complete.

**Usage example** (from `export-manager.js` `downloadImageWithProgress`):
```js
showProgressBar('Iniciando descarga...');
const steps = [
  { message: 'Obteniendo metadatos...', duration: 300 },
  { message: 'Procesando imagen...', duration: 600 },
  { message: 'Generando archivo...', duration: 500 }
];
await simulateProgressSteps(steps, 2000);
hideProgressBar();  // BEFORE opening save dialog
const handle = await window.showSaveFilePicker(options);
```

**Critical rule**: always call `hideProgressBar()` BEFORE any blocking browser dialog (`showSaveFilePicker`, `confirm`, etc.), not after. The dialog blocks JS execution, so the bar would stay visible behind it.

**CSS** (in `src/scss/modules/_modals.scss`): `.progress-overlay`, `.progress-card`, `.progress-card__track`, `.progress-card__bar`, `.progress-card__title`, `.progress-card__text`, `.progress-card__eta`. Supports dark mode via `[data-theme="dark"]`.

### Watermark drag-and-drop system

Watermarks (text and image) can be free-positioned by dragging. `main.js` maintains `textWatermarkBounds` and `imageWatermarkBounds` (`{x, y, width, height}` rectangles in canvas coordinates) and dotted guide borders rendered in distinctive colors (blue for text, orange for image). The flag `showPositioningBorders` is toggled to `false` immediately before exporting so guides don't appear in the downloaded image — if you add new render passes, respect this flag.

### Metric ruler overlay

When `isRulerMode` is true, `main.js` injects DOM-level ruler/guide elements (tracked in `rulerElements`) on top of the canvas. They're plain DOM (not drawn to canvas), so they never end up in exports. Guide-line color is chosen by sampling background brightness via `getImageData()` — keep that in mind if you change canvas pixel formats.

### EXIF/metadata writing — JPEG, PNG, WebP and AVIF

EXIF writing is implemented para **JPEG** (via `piexifjs@1.0.6` servido desde `js/vendor/`), **PNG** (manipulación binaria del chunk `eXIf`), **WebP** (manipulación RIFF + conversión a VP8X) y **AVIF** (inyección ISOBMFF real desde v3.4.15). Sin librerías externas más allá de piexifjs.

**PNG implementation (v3.3.6)**: el chunk `eXIf` (PNG spec 1.5) recibe el bloque TIFF que genera `piexif.dump()` después de strippearle la cabecera APP1 + `Exif\0\0`. La manipulación está en `MetadataManager._buildPngExifChunk` + `_insertExifChunkInPng`, usando la utilidad `crc32` de `helpers.js`. El chunk se inserta antes del primer `IDAT`. Si ya hay un `eXIf` previo se reemplaza. Defensiva: ante error devuelve el blob original.

**WebP implementation (v3.3.7)**: WebP usa el contenedor RIFF con chunks. Para tener metadatos EXIF necesita el header VP8X (extended). Si el WebP es "simple" (solo `VP8 ` lossy o `VP8L` lossless), `MetadataManager.embedExifInWebpBlob` lo **convierte a VP8X** insertando un chunk `VP8X` con las dimensiones reales (parseadas del bitstream) y los flags apropiados, luego añade el chunk `EXIF` al final. Si ya es VP8X, solo añade el `EXIF` y setea el bit 3 del header. Métodos relevantes: `_parseWebpDimensions`, `_buildVp8xChunk`, `_buildRiffExifChunk`, `_addExifToVp8xWebp`, `_convertSimpleWebpToVp8xWithExif`. **Ultra-defensiva**: ante cualquier error o validación post-generación fallida (`RIFF`/`WEBP` magic bytes), devuelve el blob original. Nunca produce un WebP corrupto. **Atención**: la validación visual con un browser real es indispensable para confirmar que los WebP generados por el flujo son leíbles y muestran EXIF en visores externos. El runner Node no puede verificarlo.

**AVIF implementation (v3.4.15)**: AVIF es ISOBMFF (mismo contenedor que MP4/HEIC). La inyección EXIF reconstruye las cajas `meta` (hdlr/pitm/iinf/iref/iloc) y añade el blob EXIF al final del `mdat` con estrategia append-only. Pasos: (1) `_isAvifFile` valida el `ftyp` (brands `avif`/`avis`/`mif1`/`miaf`), (2) `_parseIsobmffBoxes` / `_parseIsobmffBoxesInRange` recorre la estructura recursivamente con soporte `largesize` de 64-bit, (3) `_injectExifInAvifBytes` añade un nuevo item `Exif` en `iinf` (box `infe`), una entrada `cdsc` en `iref` apuntando al primary item, y una entrada `iloc` con el offset dentro del `mdat` extendido, desplazando los offsets antiguos en consecuencia. Métodos públicos: `embedExifInAvifBlob` (async, blob→blob) y `embedExifInAvifDataUrl` (async, dataURL→dataURL). **Ultra-defensiva**: si la estructura no es soportada (p. ej. AVIF sin `iinf`/`iloc` accesibles), o si el resultado no empieza por `ftyp`, devuelve el blob original. Nunca corrompe un AVIF. **La cobertura binaria de AVIF está en `tests/binary-validation.js`** — sintetiza un AVIF de 164 bytes a mano y verifica los builders/parsers, pero validación visual en visor externo sigue siendo recomendada antes de release.

**Implementation:**
- `MetadataManager.buildExifObject(metadata)` builds a piexif-compatible object from the form fields. Maps `title → ImageDescription`, `author → Artist`, `copyright → Copyright`, `software → Software`, `createdAt → DateTimeOriginal + DateTime`, and `latitude/longitude/altitude → GPS IFD` (with N/S/E/W refs and DMS rationals via `piexif.GPSHelper.degToDmsRational`). Returns `null` if there is nothing to write or if `piexif` isn't loaded.
- `MetadataManager.embedExifInJpegBlob(blob)` (async) takes a JPEG `Blob`, converts it to a dataURL via `FileReader`, calls `piexif.dump()` + `piexif.insert()`, and rebuilds a new `Blob` from the resulting base64. Returns the **original** blob if it isn't JPEG, if `piexif` is missing, or if the form has no data — graceful degradation, never throws.
- `MetadataManager.embedExifInJpegDataUrl(dataUrl)` (sync) is the dataURL-only twin used in the `<a download>` fallback path.
- `MetadataManager.embedExifInPngBlob` / `embedExifInWebpBlob` / `embedExifInAvifBlob` are the async PNG/WebP/AVIF siblings (plus matching `*DataUrl` variants for the `<a download>` path). Each returns the **original** blob/dataURL on unsupported input or any error — never throws.
- `main.js` calls these in the download flow from `downloadImage` and `downloadImageWithProgress`, each with both the `showSaveFilePicker` path (Blob) and the `<a download>` fallback (dataURL). The format-specific dispatch happens inside `export-manager.js` before the save dialog opens.

**Form fields that are NOT written to EXIF:**
- `description` and `keywords`: EXIF has no clean native tag for them. Microsoft's `XPSubject`/`XPComment` exist but require UTF-16 LE encoding and are flaky across readers; they're skipped.
- `license`: bundled into the `copyright` string by `generateCopyright()` instead.

`MetadataManager.applyMetadataToImage()` (`metadata-manager.js:249-272`) **still exists** and still only writes to `localStorage` — that part is unchanged. It's now a complement to `embedExifInJpegBlob`, not a replacement: localStorage preserves form values across sessions, while `embedExifInJpegBlob` actually writes them into the file.

### Theming

Theme is controlled via `[data-theme="dark"]` on the root, **not** Tailwind's `dark:` variants. Tailwind dark utilities will not work — write theme overrides as `[data-theme="dark"] .selector { ... }` in `css/styles.css`. This caused a real bug fixed in 3.1.4.

### Creating new buttons — CRITICAL RULES (updated v3.6.0)

Since v3.6.0 the old mass selector `button[type="button"]` is **opt-in**: the big blue "action button" styles (`min-width: 160px`, `padding: 16px 36px`, `min-height: 56px`, gradient) only apply to buttons carrying the class **`c-btn`** (selector `button.c-btn` in `src/scss/components/_components.scss`, same specificity as the old attribute selector so legacy cascade is intact). All pre-3.6.0 buttons with `type="button"` carry `c-btn` to preserve their exact appearance; their legacy ID overrides (`#auto-balance-btn`, `#curves-btn`, etc.) still apply on top and must NOT be removed while the button keeps `c-btn`.

When creating a new button:

1. **Do NOT add `c-btn`** unless you explicitly want the big blue action look. A new button without it inherits nothing global and needs **no ID escape rules** (that was the whole point of the change).
2. Prefer the **closed component family** in `src/scss/components/_closed.scss`: `.c-icon-btn` (icon-only), `.c-toolbar`, `.c-tabs`, `.c-field`, `.c-dialog`, `.c-status`. They consume only the design tokens from `_variables.scss` (`--space-*`, `--control-*`, `--radius-*`, `--focus-ring`…). Never add new size/spacing literals inside them.
3. **Dark mode**: use `[data-theme="dark"] .selector { ... }`. **Never** Tailwind `dark:` classes (Tailwind 2.2.19 has no dark mode; besides, since v3.6.0 Tailwind is a purged local build — a class not present in `index.html`/`js/**` at build time doesn't exist in the CSS; run `npm run build` after adding new Tailwind utility classes).
4. **The `.button--feature` class** applies `flex-direction: column` (icon above text) + reduced padding. Only use it for compact grid buttons (batch/text-layers/crop/shortcuts), NOT for full-width action buttons.
5. **Test the button** in both light and dark mode, on both desktop and mobile widths, before committing.

### CSS pipeline (v3.6.0)

There is **no external render-blocking CSS**. Three local files, all generated by `npm run build`:
- `dist/css/tailwind.min.css` — Tailwind 2.2.19 purged with PurgeCSS against `index.html` + `js/**/*.js` (gulp task `tailwind`; safelist in `gulpfile.js`). ~17 KB vs 2.93 MB of the old CDN.
- `dist/css/fontawesome.min.css` + `dist/webfonts/fa-solid-900.woff2` — Font Awesome subset built by gulp task `fontawesome`: it scans `fa-*` classes in `index.html` + `js/**`, resolves aliases via the FA metadata and emits only the used glyphs. Adding a new icon = just use it and rebuild; a Pro-only icon will be reported as a warning at build time.
- `dist/css/styles.css` — project SCSS.
Visual regression: `tests/e2e/capture-baseline.spec.js` captures 8 combos (1440×900, 1024×768, 390×844, 320×568 × light/dark) to `CAPTURE_DIR`; diff before/after any CSS refactor.

### Zoom by device

Mouse-wheel/trackpad zoom is **intentionally disabled on desktop (>767px)** to avoid accidental zoom from Magic Mouse / trackpads. Desktop users zoom only via the on-screen +/-/100% buttons. Mobile keeps pinch and wheel zoom. Don't "fix" this by re-enabling wheel zoom on desktop.

## Versioning and commits

**Current version: v3.6.2**.
- **v3.5.0**: Gulp 5 build system (SCSS + JS bundle + minification + browser-sync), zoom-pan-manager extracted.
- **v3.5.1–v3.5.2**: Code audit — 4 critical + 14 moderate fixes (onclick→data-action, console guards, var→const/let, null guards).
- **v3.5.3**: Output movido a `dist/`, SCSS reorganizado en subcarpetas (`abstracts/`, `base/`, `layout/`, `components/`, `pages/`, `modules/`).
- **v3.5.4**: `dist/images/` con conversion WebP + AVIF via sharp (PNG 1.4 MB → AVIF 22 KB).
- **v3.5.5**: `dist/index.html` de produccion (minificado -36%, workers + SW copiados).
- **v3.5.6**: Fixes — SRI roto en dist, heic2any 404, originalWidth no declarado.
- **v3.5.7**: Batch processing arreglado (5 bugs: ZIP download, IDs watermark, posiciones con canvas global, filtros CSS, renderFn). 9 tests de regresion. Gulp watch mejorado. Defaults de watermark personalizados. CI workflows eliminados.
- **v3.5.8**: Fix UI marcador invisible en posición personalizada y cache-busting persistente de favicon.
- **v3.5.11**: Auditoria/reauditoria severa, EXIF local, crop y capas sincronizados, limites batch, E2E de `dist` y despliegue GitHub Pages restaurado. Ver `docs/AUDITORIA_V3_5_11_SOLUCIONES.md`.
- **v3.5.12**: Flecos finales de la auditoria — estado de archivo solo tras validacion, Escape del modal de preview, pinch/orientacion via sistema global de zoom, token de secuencia en preview con worker, cache de watermark por identidad de archivo, timeout en AnalysisManager, clamp de area de recorte, stats reales del cache LRU.
- **v3.5.13**: Quick wins del roadmap, loaders diferidos, drag and drop global, accesibilidad, batch validado, fixtures E2E y registro de errores con barreras de no regresion. El boton de lote conserva las dimensiones de `.upload__button` mediante un override especifico por ID.
- **v3.5.14**: Fase "confianza y coherencia" del roadmap — modal de atajos generado del registro real (con categorias), region persistente aria-live de toasts con apilado, ModalController unico (batch/atajos via _openAccessibleModal con modo display), limite de lote unificado en AppConfig.batchMaxImages, estados por archivo en batch con cancelacion y reintento, y auditoria axe automatizada (tests/e2e/a11y.spec.js, cero incidencias serias).
- **v3.6.0**: Fase "base visual y rendimiento" — Tailwind purgado y self-hosted (2.93 MB CDN → 17 KB), subset de Font Awesome (58 iconos, 4.9 KB woff2), selector masivo de botones eliminado (opt-in via c-btn con especificidad identica), componentes cerrados c-* con tokens de diseño consolidados, CSP sin CDNs de estilo/fuentes, capturas de regresion visual en 8 combos (0,00% diff), CSS inicial total 27 KB gzip sin nada externo bloqueante.
- **v3.6.1**: Fase "area de trabajo" — layout de dos columnas tras cargar (panel 380px con pestañas Metadatos/Marca/Ajustes/Exportar + canvas sticky con toolbar), indicadores de seccion modificada con restauracion por seccion (workspace-manager.js), bottom-sheet movil con barra fija Controles/Descargar, hero compacto, herramientas avanzadas en details, y criterios de aceptacion automatizados en tests/e2e/workspace.spec.js.
- **v3.6.2**: Fix de contenido entrecortado en el panel de pestañas — las rejillas legadas (config-grid/metadata-grid/geo-grid y Tailwind md:/sm:) usan breakpoints de viewport y forzaban multicolumna dentro del panel de 380px; colapsadas a una columna, compactacion del panel/toolbar con !important para ganar a los overrides legacy por ID, fix del selector .btn:has(i:only-child) que aplastaba botones icono+texto a 48px (icon-only reales marcados con .btn-icon), presets de tamaño en columna, y barrera de regresion anti-desborde en workspace.spec.js.
- **v3.4.x** (15 releases): CSP/SRI, ESLint/Stylelint CI, accessibility, curves live preview, filter presets, ImageBitmap undo/redo, 5 managers extracted, Web Worker for autoBalance, Playwright E2E, AVIF EXIF injection.

**Tests**: 248/248 Node + 92/92 binarios + 22/22 E2E en desarrollo + 22/22 E2E en `dist` (smoke + axe + capturas de regresión visual). Quick smoke check: `npm test`; release check: build + lint + ambos E2E. `git log` remains the authoritative source for the actual commit version.

Commit messages follow `Versión X.Y.Z - <descripción>` in Spanish — match this style. `CHANGELOG.md` and the docs under `docs/` are kept hand-updated per release.
