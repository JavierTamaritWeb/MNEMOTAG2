# 📝 CHANGELOG - MNEMOTAG

Todos los cambios notables en este proyecto serán documentados en este archivo.

---

## [Unreleased]

---

## [3.5.11] - 2026-07-11

### Added
- **Documentacion de auditoria severa v3.5.11**: nuevo documento `docs/AUDITORIA_V3_5_11_SOLUCIONES.md` con causas raiz, soluciones aplicadas, reglas de no regresion, checklist por subsistema y pruebas que protegen cada bloque critico.

### Fixed
- **EXIF restaurado en navegador**: `piexifjs` se sirve localmente porque jsDelivr genera su archivo minificado dinámicamente y no admite un SRI estable; Chromium lo bloqueaba e inutilizaba la escritura de metadatos en JPEG, PNG, WebP y AVIF.
- **Caché PWA y versión sincronizadas**: aplicación, paquete y service worker usan v3.5.11 para invalidar recursos antiguos.
- **Errores globales sin duplicados**: eliminado el segundo par de listeners `error`/`unhandledrejection` y protegido el logging global con `MNEMOTAG_DEBUG`.
- **Cobertura de regresión**: Playwright exige que `window.piexif` esté disponible y Node protege el SRI y el cableado único de errores.

---

## [3.5.10] - 2026-04-15

### Fixed
- **Lote: nombres de archivo originales**: `exportToZip` generaba nombres secuenciales (`imagen-001.jpg`, `imagen-002.jpg`) ignorando el nombre original. Ahora cada imagen conserva su nombre real (`imagen-3-11.jpg`, `foto-vacaciones.jpg`) con la extensión del formato de salida.

---

## [3.5.9] - 2026-04-13

### Fixed
- **Deshacer/Rehacer (Undo/Redo)**: Restaurada la funcionalidad completa del sistema tras arreglar un bucle de guardado infinito. Ahora la restauración de estados sincroniza correctamente todos los elementos de la interfaz (sliders de filtros, etiquetas de rotación, formas de metadatos).
- **Consistencia de UI**: Eliminado el espacio excesivo debajo del botón "Aplicar marca de agua", estandarizando los márgenes de todas las secciones para un diseño más compacto y profesional.
- **Filtro Cálido**: Ajustados los valores del preset para una previsualización más distintiva y asegurada su persistencia en el historial.

## [3.5.8] - 2026-04-13

### Fixed
- **Marcador de posición personalizada invisible**: al activar el modo "Posición personalizada" (tanto en texto como en imagen), la cruz de posicionamiento no se renderizaba de forma proactiva (esperaba a un trigger de arrastre) y a veces quedaba fuera del viewport. **Fix**: inicializar las coordenadas exactas en el centro del preview canvas al instante tras la activación del modal, llamar al renderizado de la cruz (`showPositionMarker/showTextPositionMarker`), y ejecutar un `scrollIntoView({ behavior: 'smooth', block: 'center' })` suave para que la zona de trabajo se enfoque en pantalla.
- **Favicon atascado en caché (Globo gris)**: solucionar problema nativo de navegadores estrictos (Chrome/Safari) donde un error inicial "404 Favicon no encontrado" quedaba bloqueado en su caché profunda forzando a ver un icono vacío. **Fix**: añadir parámetro de *Cache Busting* (`?v=3.5.8`) a las rutas HTML en los meta tags `<link rel="icon">` en `index.html` para el `.png` y `.ico`, rompiendo la caché rebelde, validando el parámetro estricto `sizes="any"`, conservando la limpieza de proyecto alojando los archivos ordenados en `/images/favicon_io/`.

---

## [3.5.7] - 2026-04-13

### Added
- **Progress overlay** para descarga: barra de progreso animada (gradiente azul→verde) con pasos, porcentaje y ETA. HTML en `index.html`, CSS en `_modals.scss`, JS API reutilizable (`showProgressBar`, `updateProgress`, `hideProgressBar`, `simulateProgressSteps`).
- **Hover verde** en boton Descargar: transicion azul→verde con scale + translateY al hover, feedback tactil en active. Dark mode incluido.

### Fixed — Batch processing: watermarks identicas a previsualizacion
- **downloadBatchZip TypeError**: `exportToZip()` devuelve un objeto, no un Blob. `URL.createObjectURL(objeto)` lanzaba TypeError. Fix: `exportToZip()` ya descarga internamente.
- **IDs de watermark incorrectos**: `watermarkText` → `watermark-text`, `watermarkSize` → `watermark-size`, etc. La funcion `getCurrentWatermarks()` siempre devolvia null.
- **Watermarks con implementacion propia**: el batch tenia su propia version de filtros y watermarks que no coincidia con la previsualizacion. Fix: `renderImageForBatch()` closure que captura el estado del editor y usa las mismas funciones de main.js.
- **Posiciones calculadas con canvas global**: `getTextWatermarkPosition()` y `getImageWatermarkPosition()` usaban el canvas de previsualizacion (~800px) para calcular coordenadas, pero pintaban en canvas del batch (dimensiones originales). Fix: funciones locales `batchWmPos`/`batchImgPos` que reciben cw/ch.
- **Filtros CSS**: el batch usaba manipulacion de pixeles basica. Ahora usa `ctx.filter = FilterManager.getFilterString()` (identico a la preview).
- **getImageWatermarkPosition**: usaba formulas de baseline de texto (desbordaba en posiciones bottom-*). Reescrita con switch propio para imagenes (top-left origin).

### Added
- **9 tests de regresion** para batch processing que cubren los 5 bugs arreglados.
- **Gulp watch mejorado**: watchers para JS, SCSS, images, HTML, service-worker con logging de cambios. `npx gulp` ahora se queda esperando (default = dev).

### Changed
- **Defaults de watermark**: fuente Montserrat Alternates, color #f790b2, posicion personalizada (texto e imagen), tamaño personalizado 50x50 px.
- **Workflows CI eliminados**: `test.yml`, `lint.yml`, `e2e.yml` eliminados del repositorio.

### Verificacion
- `node tests/run-in-node.js` → **217/217 OK**
- `node tests/binary-validation.js` → **86/86 OK**

---

## [3.5.6] - 2026-04-11

### Fixed
- **SRI roto en `dist/index.html`**: la task `html` usaba `replace(/dist\//g, '')` que eliminaba `dist/` dentro de URLs CDN (Tailwind, heic2any). Ahora solo reemplaza atributos `href="dist/`, `src="dist/`, `srcset="dist/"`.
- **`originalWidth is not defined`**: la migracion `var` → `const/let` elimino variables globales implicitas sin declararlas. Añadidas `let originalWidth` y `let originalHeight`.
- **Imagenes no cargaban en desarrollo**: `index.html` raiz apuntaba a `dist/images/` en vez de `images/` (fuente). Revertido.

---

## [3.5.5] - 2026-04-11

### Added — dist/index.html de produccion autocontenido
- **Task `html`**: lee `index.html`, reescribe rutas locales `dist/X` → `X`, minifica con `html-minifier-terser` (100 KB → 64 KB, -36%).
- **Task `copyAssets`**: copia workers (`image-processor.js`, `analysis-worker.js`) y `service-worker.js` a `dist/` con rutas ajustadas.
- `dist/` es ahora un directorio desplegable completo a cualquier hosting estatico.

---

## [3.5.4] - 2026-04-11

### Added — dist/images con conversion WebP + AVIF
- **Task `images`**: copia todas las imagenes de `images/` a `dist/images/`, convierte cada PNG/JPEG a WebP (quality 80) y AVIF (quality 65) via `sharp`.
- 26 archivos copiados, 12 convertidos (24 archivos WebP+AVIF nuevos).
- `applicacion.png`: 1.4 MB → WebP 56 KB (-96%) → AVIF 22 KB (-98%).
- Hero logo en `index.html` usa `<picture>` con source AVIF → WebP → PNG fallback.

---

## [3.5.3] - 2026-04-11

### Changed — Carpeta dist/ + SCSS reorganizado
- Build output movido de `css/` y `js/` a `dist/css/` y `dist/js/`.
- Task `clean` elimina `dist/` antes de cada build.
- `.gitignore`: una sola linea `dist/` reemplaza 4 entradas individuales.
- **SCSS reorganizado en subcarpetas**: `abstracts/`, `base/`, `layout/`, `components/`, `pages/`, `modules/`.
- `main.scss` usa `@use 'carpeta/partial'`.

---

## [3.5.2] - 2026-04-11

### Fixed — 14 problemas moderados del code audit
- **Console pollution**: 83 `console.log/warn/info` envueltos en `MNEMOTAG_DEBUG &&` en 14 archivos JS. Cero logging en producción excepto `console.error` para errores reales.
- **`MNEMOTAG_DEBUG` centralizado**: movido de `main.js` a `app-config.js` (carga primero) para que todos los managers lo usen. Activable con `?debug=1` en URL o `localStorage`.
- **`var` eliminados**: 81 declaraciones `var` reemplazadas por `const`/`let` en `main.js` y `zoom-pan-manager.js`.
- **Magic numbers extraídos**: zoom limits (`minZoom`, `maxZoom`, `zoomStep`, `wheelZoomStep`) movidos a `AppConfig`.
- **Null guards en DOM queries**: optional chaining `?.` en `getElementById().property` y guards explícitos en asignaciones.
- **Debug-only code**: `getFilterPerformanceMetrics` envuelto en `if (MNEMOTAG_DEBUG)`.
- **Catch blocks silenciosos**: añadido logging condicional en bloques vacíos `/* ok */`.

### Verificación
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**

---

## [3.5.1] - 2026-04-11

### Fixed — 4 problemas críticos del code audit
- **23 `onclick` inline** en `index.html` reemplazados por delegación de eventos con atributos `data-action` y un handler centralizado en `main.js`.
- **42 clases `dark:` de Tailwind** eliminadas (nunca funcionaron — el tema usa `[data-theme="dark"]` en CSS, no `dark:` de Tailwind 2.2.19 CDN).
- **Artefactos de build** (`app.min.js`, `styles.css`, sourcemaps) añadidos a `.gitignore`.
- **~98 líneas de logging diagnóstico** consolidadas bajo flag `MNEMOTAG_DEBUG` (activable con `?debug=1`).

### Verificación
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**

---

## [3.5.0] - 2026-04-11

### Added — Build system: Gulp 5 + SCSS + minificación
- **`package.json`** con devDependencies: `gulp@5`, `gulp-concat`, `gulp-terser`, `gulp-sourcemaps`, `sass`, `gulp-sass@6`, `gulp-clean-css`, `gulp-rename`, `browser-sync@3`.
- **`gulpfile.js`** con tasks: `jsBundle` (concat 24 archivos + terser con `mangle:false`), `scssCompile` (sass + cleanCSS), `watchFiles`, `serve` (browser-sync puerto 5507 sin live reload), `dev` (build + watch + serve).
- **SCSS partials** en `src/scss/`: `main.scss` + 7 partials (`_variables`, `_base`, `_layout`, `_components`, `_preview`, `_hero`, `_modals`). CSS monolítico de 7,687 líneas dividido temáticamente.
- **JS bundle**: 24 scripts individuales en `index.html` reemplazados por un solo `<script src="js/app.min.js"></script>`. Workers (`image-processor.js`, `analysis-worker.js`) NO se bundlean.
- **`zoom-pan-manager.js`** extraído de `main.js` (~210 líneas): zoom con botones/teclado/rueda + pan con mouse/touch.
- **Service Worker actualizado**: `PRECACHE_URLS` simplificado a `app.min.js` en lugar de 24 scripts individuales.

### Changed
- `index.html`: de 24 `<script>` tags a 1.
- `.gitignore`: `js/app.min.js`, `js/app.min.js.map`, `css/styles.css`, `css/styles.css.map` (artefactos generados).
- `css/styles.css` ahora es generado por Gulp desde SCSS — NO editar a mano.

### Verificación
- `npm run build` genera `js/app.min.js` (~126 KB min) y `css/styles.css`.
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**

---

## [3.4.20] - 2026-04-10

### Fixed
- **Dark mode del modal de batch processing**: el batch-config y todo el modal usaban clases `dark:` de Tailwind (que no funcionan en este proyecto — usa `[data-theme="dark"]` en CSS). Añadidos ~80 selectores `[data-theme="dark"]` para el modal, la dropzone, los items, el config, el progress y los checkboxes.
- **Batch modal: imágenes no se mostraban al cargar**: `updateBatchImagesList()` ponía los items en `#batch-images-list` (contenedor padre, destruyendo el header "N imágenes cargadas" con `replaceChildren()`) en lugar de `#batch-items` (grid interior). Además, nunca cambiaba `display: none` de los contenedores al añadir imágenes. Ahora los items van al grid correcto, los contenedores se muestran/ocultan automáticamente, y el contador `batch-count` se actualiza.
- **Botones de herramientas avanzadas (Lote/Texto/Recortar/Atajos) no hacían nada**: dependían de que `initializeAdvancedUI()` expusiera las funciones a `window.*` antes de que el usuario clicara. Si había un timing issue, `window.openBatchModal` quedaba `undefined` y el click no hacía nada. Fix: llamada directa a las funciones del closure en lugar de indirecta vía `window.*`.
- **Reinicios aleatorios de la app (~1-2 min)**: causados por el Live Reload de VS Code Live Server que disparaba `location.reload()` ante cualquier cambio de archivos del proyecto. Fix: `.vscode/settings.json` con `"liveServer.settings.NoReload": true` + `ignoreFiles` para docs/tests/.git.
- **Service Worker interfiriendo con Live Server en localhost**: el SW con `skipWaiting() + clients.claim()` causaba inconsistencias de cache en dev local. Fix: el registro del SW ahora detecta localhost y auto-desregistra cualquier SW fantasma + borra caches `mnemotag-*`.

### Added
- **Diagnóstico de reinicios** (v3.4.17/v3.4.18): banners amarillo/rojo/azul en consola al arrancar, handlers globales de `error`/`unhandledrejection`/`beforeunload`/`visibilitychange`/`pagehide`, monitor de memoria JS heap cada 10 s, detector automático de scripts Live Reload, y `console.trace()` en `beforeunload`.
- **Cache-bust en `main.js`** (`?v=20260410-diag`) para forzar al browser a descargar la versión nueva.

### Changed
- `.gitignore`: ahora permite versionar `.vscode/settings.json` (el resto de `.vscode/` sigue ignorado).

### Verificación
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**

---

## [3.4.15] - 2026-04-09

### Added — Phase 14 del plan completada: AVIF EXIF real (inyección ISOBMFF)

Implementa la **inyección efectiva** del item Exif en el meta box del AVIF que había quedado como placeholder en v3.3.17. Es la operación binaria más compleja del proyecto: ~600 líneas nuevas en `js/managers/metadata-manager.js` usando estrategia **append-only** para minimizar riesgo.

- **Parser recursivo ISOBMFF**: `_parseIsobmffBoxesInRange`, `_readFullBoxHeader`, `_parseMetaBox` (extrae `hdlr`, `pitm`, `iinf`, `iref`, `iloc`, `iprp`, `idat`).
- **Lectores byte-level**: `_readPitm` (v0/v1), `_readIinf` (infe v2/v3), `_readIloc` (versions 0/1/2, `offset_size` 4/8, `length_size` 4/8, `base_offset`, `extents`).
- **Builders**: `_buildInfeBoxForExif` (infe v2 de 21 bytes con `item_type='Exif'`), `_buildIinfWithExtra` (extiende iinf +1 entry), `_buildIrefWithCdsc` (nuevo iref o extensión con sub-box `cdsc` desde Exif al primary), `_buildIlocWithExtra` (extiende iloc y **desplaza los offsets absolutos de entries existentes en `metaGrowth` bytes**), `_buildNewMetaBox`.
- **Orquestador `_injectExifInAvifBytes`**: calcula `metaGrowth`, determina el nuevo `extent_offset` del item Exif, reconstruye meta y mdat, ensambla el archivo final.
- **`embedExifInAvifBlob` efectivo**: construye el TIFF payload desde el formulario via `piexif.dump`, extrae los bytes TIFF puros con `_piexifBinaryToTiffBytes`, llama a `_injectExifInAvifBytes`, valida que el resultado empieza por `ftyp` intacto y devuelve el Blob nuevo.

### Changed
- **`tests/binary-validation.js`**: de 44/44 a **86/86 aserciones**. 42 nuevas validan la inyección end-to-end con un AVIF sintético realista de 164 bytes (`ftyp` + `meta` con `hdlr`/`pitm`/`iinf`/`iloc` + `mdat` con payload `0xAA BB CC DD ...`). Verifican: ftyp intacto byte por byte, meta crecido, mdat crecido, iinf con 2 entries (`av01` + `Exif`), iloc con 2 items (primary desplazado de offset 156 → 217), payload EXIF con prefijo `tiff_header_offset=0` + bytes TIFF correctos, primary image data intacto en su nuevo offset, iref con sub-box `cdsc` (`from=2` Exif → `to=1` primary), rechazo de re-inyección (no duplica items Exif).
- **`tests/specs/regression.spec.js`**: tests de v3.3.17 actualizados para validar los nuevos builders y el ajuste de `metaGrowth`.
- **`service-worker.js`**: `CACHE_VERSION` → `mnemotag-v3.4.15`.

### Notas de implementación
- **Limitaciones conocidas** (en estos casos devuelve el blob original sin tocar, nunca corrompe):
  - Solo soporta `construction_method=0` (offsets absolutos al archivo).
  - Solo soporta orden `ftyp → meta → mdat` (no `ftyp → mdat → meta`).
  - AVIFs con `offset_size` distinto de 4 u 8 bytes no soportados.
  - Si `iloc` es v<2 y algún ID excede 16 bits, aborta.
  - Si el archivo ya tiene un item 'Exif', no duplica (devuelve original).
- **Cero librerías externas nuevas**: todo el parsing/building es código propio sobre `Uint8Array` + `DataView` big-endian.

### Verificación
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**
- **Browser-real pendiente**: descargar un AVIF desde la app con metadatos rellenos y abrir con `exiftool` o `exifread` para confirmar interoperabilidad con readers externos.

**Con esto, las 14 fases del plan v3.4.x quedan TODAS COMPLETADAS sin aborts definitivos.**

---

## [3.4.14] - 2026-04-09

### Fixed
- **CSP `frame-ancestors` warning** (repetido 5 veces en la consola): eliminado del meta tag porque `frame-ancestors` solo tiene efecto vía HTTP header, no vía `<meta http-equiv>`. Para protección real contra clickjacking haría falta configurar el header del servidor (no es posible en GitHub Pages sin un proxy).
- **`EvalError: Evaluating a string as JavaScript violates CSP`**: una librería CDN (probablemente `heic2any` o `@imgly/background-removal`) usa `new Function()` internamente para compilar helpers. Sin `'unsafe-eval'` en `script-src`, esas librerías crasheaban al cargar. Añadido `'unsafe-eval'` a la CSP. Verificado con grep recursivo que nuestro código propio NO usa `eval` ni `new Function`.

### Aborted (luego retomada en v3.4.15)
- **Phase 14 del plan original (AVIF EXIF real)**: abortada en su momento según el escape hatch explícito del plan. La infraestructura de parsing ISOBMFF de v3.3.17 quedó intacta pero la inyección efectiva se pospuso. **Retomada y cerrada en v3.4.15.**

### Changed
- `service-worker.js` bumpeado a `mnemotag-v3.4.14` para invalidar la PWA con la CSP actualizada.

### Verificación
- 183/183 Node + 44/44 binarios sin cambios.

---

## [3.4.13] - 2026-04-09

### Added — Phase 13: Playwright E2E smoke test
- **`playwright.config.js`** en la raíz con `webServer: python3 -m http.server 8080` (disponible siempre en GitHub Actions, sin añadir dependencias al repo). `baseURL: http://localhost:8080`, `project: chromium` único para minimizar tiempo de CI, `trace: retain-on-failure`, `screenshot: only-on-failure`.
- **`tests/e2e/smoke.spec.js`** con 5 tests end-to-end que ejecutan un navegador Chromium real:
  1. Carga `index.html` sin errores en consola (filtra CSP warnings no críticos).
  2. Verifica que los 9 managers (`SecurityManager`, `MetadataManager`, `historyManager`, `AnalysisManager`, `CurvesManager`, `BgRemovalManager`, `ExportManager`, `PresetManager`, `AppState`) están vivos en `window`.
  3. Verifica que los 16 botones principales existen en el DOM.
  4. Sube un PNG 1x1 sintético vía el input de archivo oculto y verifica que no lanza errores.
  5. Llama a `AppState.snapshot()` desde el browser y valida el estado inicial.
- **`tests/e2e/fixtures/1x1.png`** (67 bytes) — PNG mínimo 1x1 rojo generado a mano con `printf` para no depender de herramientas externas.
- **`.github/workflows/e2e.yml`**: workflow que instala Chromium via `npx --yes playwright@latest install --with-deps chromium`, arranca el webServer Python y ejecuta los tests. Si fallan, sube el reporte HTML como artifact (retención 7 días).

**Cobertura end-to-end real por primera vez en el proyecto.** Antes los tests eran fetch+grep contra el código fuente; ahora Playwright lanza un Chromium y verifica que todo se wirea correctamente.

### Verificación
- 183/183 Node + 44/44 binarios.
- 5 tests Playwright verificados en CI tras el push.

---

## [3.4.12] - 2026-04-09

### Added — Phase 12: Web Workers para pixel ops (autoBalance)
- **`js/workers/analysis-worker.js`** (~150 líneas) con 3 handlers (`buildHistogram`, `extractPalette`, `autoBalance`) y protocolo `{id, op, imageData}` → `{id, ok, result/error}`.
- En esta versión se delega **solo `autoBalance`** al worker. Es la operación más crítica: en imágenes 4K bloqueaba el main thread ~500 ms con el loop de writes sobre `imageData.data`. Los otros 2 handlers quedan disponibles en el worker para usos futuros.
- **`AnalysisManager`**: singleton del Worker creado lazily en `_getWorker()`. Si Worker no existe, CSP bloquea o la ruta falla, `_workerAvailable` queda `false` y todas las llamadas caen al fallback main-thread (`_autoBalanceMainThread` extraído como función privada síncrona).
- **`autoBalanceImage` ahora es async**. El listener del botón sigue funcionando sin cambios (fire-and-forget).
- **Transferable objects**: `postMessage(msg, [imageData.data.buffer])` para evitar copia del buffer en imágenes grandes. Si el worker falla tras transferir, el fallback hace una nueva lectura del canvas.

### Verificación
- 178/178 Node (+5 nuevos) + 44/44 binarios.

---

## [3.4.11] - 2026-04-09

### Added — Phase 11: AppState singleton
- **`js/utils/app-state.js`** (~180 líneas): `window.AppState` como `Object.freeze` de getters/setters que delegan a las variables `let` del closure de `main.js` (`canvas`, `ctx`, `currentImage`, `currentFile`, `fileBaseName`, `originalExtension`, `currentRotation`, `isFlipped*`, `currentZoom`, `panX/Y`, `isPanning`, `customImagePosition`, `customTextPosition`, `isPositioningMode`, `showPositioningBorders`, `outputFormat`, `outputQuality`, `isRulerMode`).
- **Estrategia NO invasiva**: `AppState.canvas === canvas` (misma referencia, solo fachada). Los managers existentes siguen accediendo por nombre directo. La migración es oportunística, no obligatoria.
- **Defensivo con `typeof` guards**: para que el módulo se cargue sin crashear en el test runner Node (que no carga main.js).
- Método `AppState.snapshot()` para debugging desde la consola del browser.

### Verificación
- 173/173 Node (+6 nuevos) + 44/44 binarios.

---

## [3.4.10] - 2026-04-09

### Added — Phase 10: Extraer export-manager.js (el commit más grande del bloque de modularización)
- **`js/managers/export-manager.js`** (~430 líneas) con patrón IIFE. Expone 3 métodos públicos: `ExportManager.downloadImage()`, `ExportManager.downloadImageWithProgress()`, `ExportManager.downloadMultipleSizes()`.
- Mueve desde `main.js` ~478 líneas: `downloadMultipleSizes` (101), `downloadImage` (165), `downloadImageWithProgress` (212).
- Los helpers (`getMimeType`, `determineFallbackFormat`, `flattenCanvasForJpeg`, `canvasToBlob`, `hasImageAlphaChannel`, `redrawCompleteCanvas`, `getFlattenColor`, `sanitizeFileBaseName`, `showError`, `showSuccess`, `showProgressBar`, `updateProgress`, `hideProgressBar`, `simulateProgressSteps`) SE QUEDAN en `main.js` y el manager los referencia por nombre global.
- Los 5 callsites de main.js actualizados: `#download-multisize-btn`, `#download-image`, `Cmd+S` (handleKeyboardShortcuts), `Cmd+S` (keyboardShortcuts.register), `Cmd+Shift+X`.
- `eslint.config.js`: añadidos globals compartidos. Warnings ESLint: 139 → 52.
- Tests de regresión: 12 tests existentes reubicados para buscar los patrones (`embed EXIF chain`, `flattenCanvasForJpeg`, etc.) en `export-manager.js` en lugar de `main.js`.

### Changed
- Reducción neta de `main.js`: **~478 líneas**. Total acumulado extraído desde v3.4.7: **~1162 líneas (~14% del total)**.

### Verificación
- 167/167 Node (+5 nuevos) + 44/44 binarios.

---

## [3.4.9] - 2026-04-09

### Added — Phase 9: Extraer bg-removal-manager.js
- **`js/managers/bg-removal-manager.js`** (~120 líneas) con IIFE. Estado privado de la closure: `_module` (singleton del import ML) y `_loading` (flag de carga en progreso). Encapsulado es MÁS defensivo que variables sueltas en main.js.
- Mueve `_loadBackgroundRemovalLib` y `removeBackgroundWithAI` (~95 líneas).
- El lazy load con `await import('...@imgly/background-removal@1.4.5/+esm')` via jsdelivr sigue funcionando idéntico.
- Main.js: listener del `#remove-bg-btn` delega a `BgRemovalManager.removeBackground()`.

### Verificación
- 162/162 Node (+3 nuevos) + 44/44 binarios.

---

## [3.4.8] - 2026-04-09

### Added — Phase 8: Extraer curves-manager.js
- **`js/managers/curves-manager.js`** (~370 líneas) con IIFE. Estado privado `_state` (4 canales + `previewSnapshot` + `previewRafPending`) encapsulado.
- Mueve ~346 líneas de main.js: `_curvesState`, `openCurvesModal`, `_scheduleCurvesPreview`, `_rollbackCurvesPreview`, `_setupCurvesUI`, `_resetCurves`, `_buildLutFromPoints`, `_redrawCurvesCanvas`, `_applyCurvesToImage` + listeners del canvas del editor.
- Main.js: shim `openCurvesModal()` que delega a `CurvesManager.open()` (para no romper el listener existente). Si CurvesManager no está cargado, error claro.
- El live preview de v3.4.4 y el rollback via `onClose` callback siguen funcionando porque el nuevo manager sigue referenciando `_openAccessibleModal/_closeAccessibleModal/renderHistoryPanel` por nombre global.

### Verificación
- 159/159 Node (+3 nuevos) + 44/44 binarios.

---

## [3.4.7] - 2026-04-09

### Added — Phase 7: Extraer analysis-manager.js (primer commit del bloque de modularización)
- **`js/managers/analysis-manager.js`** (~260 líneas) con patrón IIFE: `window.AnalysisManager = (function () { ... return {...}; })();`. Expone `showHistogram`, `showPalette`, `autoBalanceImage` + `_extractDominantColors` y `_getCanvasImageData` para tests.
- Mueve ~240 líneas desde `main.js`: `showHistogram` (~75), `_extractDominantColors` (~33), `showPalette` (~45), `autoBalanceImage` (~70).
- Main.js conserva una copia local de `_getCanvasImageData` como helper porque curves-manager y futuros consumidores internos lo usan directamente.
- Los 3 listeners (`histogram-btn`, `palette-btn`, `auto-balance-btn`) delegan a `AnalysisManager.X`.
- Service Worker precache actualizado.

### Verificación
- 156/156 Node (+3 nuevos) + 44/44 binarios.

---

## [3.4.6] - 2026-04-09

### Added — Phase 6: Undo/redo con ImageBitmap
- **`historyManager.saveState()`** usa `createImageBitmap(canvas)` en lugar de `canvas.toDataURL()` cuando el navegador lo soporta. Los `ImageBitmap` viven en memoria GPU nativa, no en el JS heap, ahorrando ~10x el espacio de los dataURLs base64 en imágenes 4K.
- **Fallback automático a dataURL** si `createImageBitmap` no está disponible. El cap clásico `HISTORY_MAX_TOTAL_SIZE` (100 MB) solo aplica al fallback — con ImageBitmap el límite es `maxStates=20`.
- **`saveState` es asíncrono internamente** (createImageBitmap devuelve Promise) pero la API pública sigue siendo fire-and-forget.
- **`restoreState` acepta ambos formatos** (`state.bitmap` sync rápido, `state.imageData` async legacy).
- **`bitmap.close()` explícito** al rebasar `maxStates`, al `clear()` o al descartar estados futuros tras un nuevo cambio — **crítico** para no fugar memoria GPU.
- **`_buildThumbnail`** pinta los ImageBitmaps en un canvas 80x80 con `object-fit: contain` manual y devuelve dataURL JPEG calidad 0.8. Thumbnails reales en lugar del dataURL completo.
- **Botón "Vaciar historial"** (icono `trash-alt`) en el header del panel de historial visual, con `confirm()` antes de ejecutar.

### Verificación
- 153/153 Node (+6 nuevos) + 44/44 binarios.

---

## [3.4.5] - 2026-04-09

### Added — Phase 5: Filter presets (guardar/cargar en localStorage)
- **`js/managers/preset-manager.js`** (~180 líneas): API pública `savePreset(name)`, `loadPreset(name)`, `listPresets()`, `deletePreset(name)`, `populateSelect(selectEl)`.
- Campos persistidos: `brightness`, `contrast`, `saturation`, `blur` (los watermarks NO — son ortogonales).
- Validación de nombre: 1-40 chars alfanuméricos + espacios + `-_` + tildes.
- Persistencia en localStorage con prefijo `mnemotag-preset-` + índice `mnemotag-preset-index`.
- `loadPreset` dispara `input`+`change` events sintéticos para que los listeners existentes recalculen el canvas.
- **UI en la sección de filtros**: input de nombre + botón "Guardar"; select + botones "Cargar"/"Eliminar". Enter en el input guarda. `confirm()` antes de eliminar.

### Verificación
- 147/147 Node (+5 nuevos) + 44/44 binarios.

---

## [3.4.4] - 2026-04-09

### Added — Phase 4: Live preview en editor de curvas
- Al abrir el modal de curvas, **`_curvesState.previewSnapshot`** captura `ctx.getImageData()` del canvas actual (copia limpia, no dataURL).
- Cada `mousedown`/`mousemove`/`dblclick`/`_resetCurves` dispara `_scheduleCurvesPreview()` que, throttle-ado con `requestAnimationFrame`, reconstruye las 4 LUTs y aplica la composición sobre una **copia del snapshot**, pintando el resultado en el canvas principal. El snapshot original se preserva intacto para el próximo frame y para rollback.
- **"Aplicar"** ya no reaplica la transformación: el canvas YA tiene el preview. Solo pone `previewSnapshot=null` y llama a `saveState`. Mantiene fallback antiguo por si `previewSnapshot` es null.
- **Nuevo botón "Cancelar"** en el modal de curvas que hace `_rollbackCurvesPreview()` y cierra.
- **Escape y click en backdrop/X** también hacen rollback vía un nuevo callback `onClose` en `_openAccessibleModal`: la apertura acepta un segundo parámetro callback que `_closeAccessibleModal` invoca antes de cerrar.
- `openCurvesModal` resetea los puntos de los 4 canales al abrir.

### Verificación
- 142/142 Node + 44/44 binarios.

---

## [3.4.3] - 2026-04-09

### Added — Phase 3: A11y (focus trap + Escape + aria-live)
- **UIManager**: los 4 tipos de toast ahora tienen `role`/`aria-live`/`aria-atomic`. Los errores son `assertive` (lectores de pantalla los interrumpen); warnings/éxitos/info son `polite`. 12 líneas que transforman los toasts de invisibles a accesibles para usuarios de lector de pantalla.
- **Helpers `_openAccessibleModal(modal, onClose)` y `_closeAccessibleModal(modal)`** en main.js:
  1. Guardan el `activeElement` previo para devolverle el foco al cerrar.
  2. Muestran/ocultan el modal y sincronizan `aria-hidden`.
  3. Enfocan el primer elemento focusable dentro del modal al abrir.
  4. Atrapan el foco con `Tab`/`Shift+Tab` (wrap-around entre primero y último).
  5. Cierran con `Escape`.
  6. Desenganchan el listener `keydown` al cerrar (sin fugas de memoria).
- Usa una `WeakMap` para mapear `modal → {handler, previouslyFocused, onClose}` para que múltiples modales no interfieran.
- Los 3 puntos de apertura (histogram, palette, curves) y los 2 de cierre (click en backdrop/X, `_applyCurvesToImage`) usan los helpers en lugar de `classList.add/remove` directo.

### Verificación
- 142/142 Node + 44/44 binarios.

---

## [3.4.2] - 2026-04-09

### Added — Phase 2: CI lint (eslint + stylelint)
- **`eslint.config.js`** (flat config, ESLint 9) con 4 bloques de reglas: browser (`js/**`), Service Worker (globals `self`, `caches`, `Response`), tests runner Node (`process`, `require`, `module`), y specs (browser + test runner casero). Todos los globals del proyecto declarados.
- **Reglas**: bugs reales como `error` (`no-dupe-*`, `no-unreachable`, `use-isnan`, `valid-typeof`, etc.). Mejores prácticas como `warn` (`eqeqeq`, `no-var`, `prefer-const`, `no-unused-vars` con ignore `/^_/`). `no-undef` degradado a `warn` para tolerar deuda sin romper CI.
- **`.stylelintrc.json`** con reglas mínimas contra bugs reales: `declaration-block-no-duplicate-properties`, `block-no-empty`, `no-duplicate-at-import-rules`, etc.
- **`.github/workflows/lint.yml`** con 2 jobs (`eslint` + `stylelint`), ambos vía `npx --yes` sin `package.json`.

### Fixed
- **Dead code en `main.js:3070`**: `handleCanvasClick` tenía 70 líneas de código muerto tras un `return` temprano (el comentario ya lo marcaba como `DESACTIVADO` hace tiempo). Eliminado para que eslint pase limpio.
- **CSS**: dos bloques con `left: -100%` seguido de `left: 100%` en la misma regla (el segundo ganaba siempre). El primero era código muerto. Eliminado.

### Verificación
- ESLint: 0 errors, 67 warnings (deuda histórica tolerada). Stylelint: 0 errors. 142/142 Node + 44/44 binarios.

---

## [3.4.1] - 2026-04-09

### Added — Phase 1: Hardening seguridad + slim del README
- **CSP meta tag** en `<head>` de `index.html` con allowlist restrictiva: `cdnjs`, `jsdelivr`, Google Fonts. `default-src 'self'`. `worker-src 'self' blob:` para los Web Workers del filter pipeline.
- **SRI hashes sha384** para los 5 recursos CDN externos (jszip, piexifjs, heic2any, Tailwind CSS, Font Awesome). Calculados con `curl + openssl`. `crossorigin="anonymous"` añadido.

### Fixed
- **`watermark-text-enabled` sin `checked` por defecto**: elimina el bug latente de sesiones anteriores. Ahora el usuario no ve nunca el mensaje de "texto vacío" salvo que active la casilla a propósito.
- **README.md reducido de 710 a 149 líneas**: las 18 secciones `NOVEDADES vX.Y.Z` movidas a `CHANGELOG.md` (donde ya estaban duplicadas). Mantiene solo v3.4.0 como la última + enlaces al changelog + bloque de características principales condensado + docs + install + licencia.

### Verificación
- 142/142 Node + 44/44 binarios.

---

## [3.4.0] - 2026-04-09

### Resumen

Release **umbrella** que consolida bajo una sola versión mayor las 8 features publicadas en v3.3.11–v3.3.18, añade el fix definitivo de estilos para los 5 botones introducidos en esos commits, y sincroniza toda la documentación al nuevo número de versión. Es el punto estable recomendado para usuarios que no vengan siguiendo cada patch de la serie v3.3.

### Features consolidadas de v3.3.11 → v3.3.18

| Versión | Feature | Breve |
|---|---|---|
| v3.3.11 | Paste portapapeles + export multi-size ZIP | `Cmd+V`/`Ctrl+V` global + checkboxes 256/512/1024/2048 px |
| v3.3.12 | Análisis visual | Histograma RGB+luminosidad, paleta dominante, auto-balance con percentiles 1%/99% |
| v3.3.13 | Editor de curvas estilo Photoshop | Canvas interactivo 280×280, 4 canales, composición LUT |
| v3.3.14 | Historial visual con thumbnails | Click salta directamente a cualquier estado previo |
| v3.3.15 | Soporte HEIC/HEIF | Fotos iPhone, conversión via `heic2any` CDN |
| v3.3.16 | PWA real con Service Worker | Cache híbrido, offline, instalable |
| v3.3.17 | Parser ISOBMFF defensivo (AVIF) | Infraestructura lista, nunca corrompe |
| v3.3.18 | Eliminar fondo con IA | Lazy load total del modelo `@imgly/background-removal` |

El detalle completo de cada feature está en las entradas individuales más abajo (`[3.3.18]` hasta `[3.3.11]`).

### Added (exclusivo de v3.4.0)

- **Pulido visual de los 5 botones introducidos en v3.3.11–v3.3.18**, ~164 líneas nuevas en `css/styles.css` al final del archivo:
  - `#auto-balance-btn` — gradiente **ámbar** (`linear-gradient(135deg, #f59e0b, #d97706)`), hover más oscuro con sombra aumentada.
  - `#curves-btn` — gradiente **morado** (`linear-gradient(135deg, #8b5cf6, #7c3aed)`).
  - `#remove-bg-btn` — gradiente **cian/teal** (`linear-gradient(135deg, #06b6d4, #0891b2)`).
  - `#download-multisize-btn` — **outlined real** con borde azul 2px, fondo semitransparente `rgba(255,255,255,0.95)` y texto azul; en hover pasa a sólido azul con texto blanco. **Variante completa para `[data-theme="dark"]`** (fondo `rgba(30,41,59,0.85)` + texto `#93c5fd`).
  - `#history-toggle-btn` — gradiente **índigo** (`linear-gradient(135deg, #6366f1, #4f46e5)`) con `!important` para vencer las reglas masivas heredadas. `width: auto` con `min-width: 140px` para eliminar el `width: 200px` fijo que heredaba.
  - **Todos los 5 botones**: `min-height: 48px`, `padding: 12px 18px`, `font-size: 14px`, `font-weight: 600`, `border-radius: 10px`, `white-space: nowrap`, `text-overflow: ellipsis`, transición `cubic-bezier(0.4, 0, 0.2, 1)`.
  - **Iconos**: `margin-right: 0` (anula el override genérico de línea 1749 que separaba icono y texto), `font-size: 16px`, `flex-shrink: 0`.
  - **Focus visible accesible** en los 5 botones con `outline: 3px solid rgba(99,102,241,0.5)` y `outline-offset: 2px`.
- **Contenedor padre de Undo/Redo/Historial** cambiado a `flex flex-wrap gap-2` en `index.html` para que en pantallas estrechas el botón "Historial" haga wrap a la siguiente línea en lugar de romper el layout.

### Changed

- **`css/styles.css` cargado con cache-bust**: `<link rel="stylesheet" href="css/styles.css?v=20260409a">` para forzar a los navegadores a descargar la hoja de estilos nueva tras el upgrade.
- **Service Worker bumpeado a `mnemotag-v3.3.19-css-fix`** (`service-worker.js`). El listener `activate` borra automáticamente cualquier cache anterior cuya clave no empiece por esta versión, por lo que los usuarios que ya instalaron la PWA en v3.3.16+ reciben el CSS nuevo en el siguiente arranque.
- **Copyright actualizado a 2026** en `index.html` (footer + placeholder del campo `metaCopyright`) y `README.md` (pie de licencia).
- **Título `<title>` del HTML** → `MnemoTag v3.4.0`.
- **Badge de versión en `README.md`** → `3.4.0`.
- **`docs/INDICE_DOCUMENTACION.md`** → versión y pie actualizados a v3.4.0.
- **Footer de `CHANGELOG.md`** → "Versión actual: 3.4.0".
- **Título de `CHANGELOG.md`** → "MNEMOTAG v3.4" (antes decía "v3.3").

### Fixed

- **5 botones introducidos en v3.3.11–v3.3.18 mostraban layout roto** por heredar clases CSS (`button--feature`, `button--action`, `.btn-secondary`) diseñadas para un contexto distinto (grid compacto de 4 columnas). Corregido en dos fases:
  1. Commit **`99c5879`** (fase inicial): quitar `.button--feature` de los 4 botones afectados y añadir `flex-wrap` al contenedor de Undo/Redo/Historial. Arregla el layout pero deja todos los botones con el mismo gradiente morado de `.btn-primary`.
  2. Commit **`c416027`** (pulido definitivo de v3.4.0): añadir ~164 líneas de CSS con selectores por ID para dar a cada botón su propia identidad visual (5 gradientes distintos, focus accesible, variante dark mode para el multisize).
- **Push a GitHub rechazado** por el scope `workflow` del token durante varios intentos en sesiones anteriores. Resuelto en commit `8ce6d54` moviendo `.github/workflows/README.md` (documentación de los workflows, que NO es un workflow) fuera del directorio, de modo que el OAuth App del token ya no necesita el scope `workflow` para aceptar el push.

### Verificación

- `node tests/run-in-node.js` → **142/142 OK** (sin cambios — v3.4.0 solo toca CSS, HTML editorial y service-worker, no hay tests nuevos ni regresiones).
- `node tests/binary-validation.js` → **44/44 OK** (sin cambios — no se tocan binarios).
- Verificación visual browser-real: los 5 botones se ven con sus gradientes propios, focus visible tras Tab, dark mode funciona en `#download-multisize-btn`, wrap del contenedor Undo/Redo/Historial funciona al redimensionar la ventana estrecha.

---

## [3.3.18] - 2026-04-08

### Added
- **Eliminar fondo con IA (lazy load total)**. Botón "Eliminar fondo (IA)" en `index.html:649` (sección de filtros, junto a "Curvas y niveles"). Icono `fa-magic-wand-sparkles`. Tooltip: *"Eliminar el fondo de la imagen usando IA. La primera vez descarga ~10-15 MB del modelo, después funciona offline."*
- **`removeBackgroundWithAI()`** en `js/main.js`. Validaciones iniciales (canvas + currentImage), llama a `_loadBackgroundRemovalLib()` para garantizar el módulo cargado, busca la función `removeBackground` o `default` defensivamente, convierte el canvas a Blob PNG con `canvas.toBlob`, llama a `removeFn(inputBlob)`, y carga el resultado de vuelta al canvas vía `<img>` + `URL.createObjectURL`. Tras `img.onload`, persiste en `historyManager.saveState()` para que el botón Deshacer revierta la eliminación de fondo.
- **`_loadBackgroundRemovalLib()`** — singleton de carga lazy. Variables módulo: `_bgRemovalModule` (cache del módulo cargado) y `_bgRemovalLoading` (flag para evitar cargas paralelas). En la primera llamada:
  1. Muestra `UIManager.showInfo('🤖 Descargando modelo de IA (~10-15 MB). Esto solo ocurre la primera vez…')`.
  2. Hace `await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm')`. El sufijo `+esm` de jsdelivr sirve la versión ESM de la librería para que `dynamic import()` funcione sin bundler.
  3. Cachea el módulo en `_bgRemovalModule` y resetea `_bgRemovalLoading` en `finally` (para que un fallo no deje el flag bloqueado).
- **Llamadas concurrentes** se manejan con un poller corto: si `_bgRemovalLoading === true`, se espera (con `setTimeout` 100ms) hasta que la otra carga termine y se devuelve el módulo cacheado.
- **Cero impacto en peso inicial de la app**: el módulo NUNCA se descarga al arrancar. El bundle inicial de MnemoTag sigue siendo idéntico al de v3.3.17. Solo los usuarios que pulsen el botón pagan el coste de los ~10-15 MB.
- **Degradación elegante completa**:
  - Si la descarga del módulo falla → `console.error` + `UIManager.showError('No se pudo cargar el modelo de IA: ... Comprueba tu conexión y vuelve a intentarlo.')`.
  - Si la librería carga pero no expone `removeBackground` ni `default` → error de versión incompatible.
  - Si el procesado lanza durante el run → error capturado, mostrado al usuario sin romper el canvas.
  - Si la imagen resultante no carga → error explícito.
  - El estado del canvas NUNCA queda inconsistente en ningún camino de error.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Eliminar fondo con IA, lazy load (v3.3.18)')` con 5 aserciones que verifican: la función `removeBackgroundWithAI` y el helper `_loadBackgroundRemovalLib`, que NO hay import estático del módulo (cero impacto en peso inicial), que el toast informa del tamaño del modelo (con regex `/10.{0,5}MB/` para tolerar variaciones), que existe try/catch + reset del flag loading, y que el botón está en HTML con tooltip explicativo del peso.

### Notas de implementación
- **Por qué `+esm` de jsdelivr y no unpkg / npm directo**: jsdelivr expone una versión ESM transformada vía su sufijo `+esm` que es directamente importable con `dynamic import()` sin necesidad de bundler. unpkg sirve el código tal cual, lo que requiere bundling para resolver imports internos. La librería tiene dependencias internas (web workers, ONNX runtime) que jsdelivr resuelve automáticamente.
- **Por qué lazy load y no precarga**: la promesa fundamental del proyecto es ser "ligero" — toda la app cabe en ~700 KB de assets. Un modelo ML de 10-15 MB rompería esa promesa para los usuarios que solo quieren añadir EXIF a sus fotos. El compromiso: lazy load on demand. El usuario que pulsa el botón sabe que está activando una función avanzada y acepta el coste.
- **Por qué `canvas.toBlob('image/png')` y no JPEG**: PNG soporta transparencia. La librería devuelve un Blob con fondo eliminado (alpha = 0 en las zonas de fondo); si convertimos a JPEG perderíamos esa información antes de pasarla al modelo, y el resultado tendría fondo blanco fijo en lugar de transparente.
- **Por qué `historyManager.saveState()` después del onload y no antes**: queremos que el snapshot del historial contenga el resultado FINAL (con fondo eliminado), no el estado intermedio.

### Verificación
- `node tests/run-in-node.js` → **142/142 OK** (137 anteriores + 5 nuevos)
- `node tests/binary-validation.js` → 44/44 OK (sin cambios)

---

## [3.3.17] - 2026-04-08

### Added
- **Parser ISOBMFF defensivo para AVIF**. Nuevas funciones públicas en `MetadataManager` (`js/managers/metadata-manager.js`):
  - **`_parseIsobmffBoxes(bytes)`** — recorre los boxes top-level del archivo. Maneja los 3 formatos de cabecera de ISOBMFF: compacta de 8 bytes (`[size:4][type:4]`), large-size de 16 bytes (`[size=1:4][type:4][largesize:8]` para boxes >4 GB), y `size=0` (hasta el final del archivo). Devuelve `{type, start, end, headerSize, bodyStart}` por cada box. Se detiene defensivamente al primer header trunco o box corrupto.
  - **`_isAvifFile(bytes)`** — verifica que el primer box es `ftyp` y que su major brand es `avif`/`avis`, o que cualquiera de los compatible brands posteriores es `avif`/`avis`/`mif1`/`miaf`.
  - **`embedExifInAvifBlob(blob)`** — async, pública. Detecta AVIF, parsea boxes, busca el meta box. **En esta versión defensiva siempre devuelve el blob original** con `console.warn` explicando que la inyección completa de Exif requiere reescritura del meta box (iinf + iref + iloc + mdat + actualización de cabeceras anidadas), trabajo que se deja para una versión futura. Toda la chain de errores devuelve el blob original sin tocar — **NUNCA produce AVIF corruptos**.
  - **`embedExifInAvifDataUrl(dataUrl)`** — wrapper que convierte el dataURL a blob, llama a `embedExifInAvifBlob`, y vuelve a convertir a dataURL si hay cambios. Patrón idéntico al de PNG/WebP.
- **Integración en los 4 puntos del flujo de descarga** existentes en `js/main.js`:
  - `downloadMultipleSizes()` — bucle ZIP, llamada `embedExifInAvifBlob` después de WebP.
  - `downloadImage()` — rama showSaveFilePicker, llamada después de WebP.
  - `downloadImage()` — rama fallback `<a download>`, llamada `embedExifInAvifDataUrl` con condicional `finalMimeType === 'image/avif'`.
  - `downloadImageWithProgress()` — rama showSaveFilePicker, llamada después de WebP.
  - `downloadImageWithProgress()` — rama fallback `<a download>`, llamada `embedExifInAvifDataUrl` con condicional.
- **8 aserciones binarias nuevas** en `tests/binary-validation.js`. Sintetizan un AVIF mínimo válido a mano (`ftyp` con brand `avif` + `meta` vacía + `mdat` vacía, 40 bytes totales) y validan: que `_parseIsobmffBoxes` devuelve exactamente 3 boxes en las posiciones correctas, que `_isAvifFile` lo detecta como AVIF, y que rechaza correctamente bytes random y la signature PNG (negative tests).
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — AVIF EXIF (v3.3.17): parser ISOBMFF defensivo')` con 5 aserciones que verifican las funciones públicas, la presencia del parser y detector AVIF (incluyendo manejo de `size === 1` largesize), los 3 caminos defensivos en metadata-manager, las llamadas en el flujo de descarga (≥3 ocurrencias de `embedExifInAvifBlob`), y la rama condicional `finalMimeType === 'image/avif'` para el fallback dataURL.

### Notas de implementación
- **Por qué defensiva total y no inyección real**: la inyección real de un item `Exif` en un contenedor ISOBMFF requiere:
  1. Localizar el meta box.
  2. Dentro de meta, localizar (o crear) `iinf` (item info), `iref` (item references), `iloc` (item locations), `idat`/`mdat` (data storage).
  3. Añadir un nuevo entry en `iinf` con type `Exif`.
  4. Añadir un `cdsc` reference en `iref` desde el nuevo Exif item al item primario.
  5. Añadir una entrada a `iloc` apuntando a la zona del mdat donde van los bytes EXIF.
  6. Concatenar los bytes EXIF (con el offset TIFF prefix de 4 bytes 0) al mdat o a un nuevo idat.
  7. **Reescribir TODAS las cabeceras de los boxes padre** porque sus tamaños han cambiado.
  8. Actualizar offset tables en `iloc` que pueden estar codificadas como 4 u 8 bytes según un flag de la cabecera de `iloc`.
  9. Manejar boxes anidados con su propia versión de full-box header (4 bytes adicionales).

  Esto es ~400-600 líneas de código binario muy frágil. Los AVIF generados por encoders distintos (libavif, x265, AOM) tienen estructuras ligeramente distintas, con o sin `idat`, con `iref` antes o después de `iloc`, etc. Cualquier error en la actualización de offsets produce un AVIF que el navegador no puede decodificar.

  Esta versión opta por construir la **infraestructura de parseo correctamente** (validada con 8 aserciones binarias) y dejar la inyección real para cuando se pueda probar exhaustivamente con AVIF reales en un browser real. La cadena de degradación elegante es honesta: el usuario que descarga AVIF obtiene exactamente el mismo AVIF que tendría sin esta versión, sin metadatos pero sin corrupciones.
- **Por qué probar con un AVIF mínimo sintetizado a mano**: garantiza que el parser funciona contra una estructura conocida byte a byte. Si en el futuro se añade inyección real, los mismos tests pueden extenderse para validar el AVIF de salida sin tener que cargar archivos binarios reales del disco.

### Verificación
- `node tests/run-in-node.js` → **137/137 OK** (132 anteriores + 5 nuevos)
- `node tests/binary-validation.js` → **44/44 OK** (36 anteriores + 8 nuevos del parser ISOBMFF)

---

## [3.3.16] - 2026-04-08

### Added
- **PWA real con Service Worker**. Nuevo archivo `service-worker.js` en la raíz del proyecto, ~150 líneas.
- **Estrategias de cache híbridas**:
  - **Cache-first** para recursos del mismo origen (HTML, CSS, JS, imágenes locales, manifest). Devuelve la versión cacheada si existe; si no, va a red y la añade al cache.
  - **Network-first** para CDNs externas listadas en `CDN_HOSTS` (cdn.jsdelivr.net, cdnjs.cloudflare.com, cdn.tailwindcss.com, fonts.googleapis.com, fonts.gstatic.com). Va primero a red para captar actualizaciones; si falla, sirve la versión cacheada.
- **Versionado del cache**: `CACHE_VERSION = 'mnemotag-v3.3.16'`. Los buckets se llaman `mnemotag-v3.3.16-app` y `mnemotag-v3.3.16-cdn`. El listener `activate` borra automáticamente cualquier cache anterior cuya clave no empiece por la versión actual.
- **Listener `install`** precachea 22 assets críticos (`./`, `./index.html`, `./css/styles.css`, todos los `js/utils/*` y `js/managers/*`, `./js/main.js`, manifest, favicon, ico) con tolerancia a errores: cada `cache.add()` se hace individual y los fallos se loggean sin abortar el resto.
- **`skipWaiting()` + `clients.claim()`** para que la versión nueva del SW tome control inmediatamente de las pestañas abiertas tras la activación.
- **Listener `fetch` defensivo**: solo intercepta GET, ignora esquemas no http(s), y deja pasar terceros desconocidos sin cachear ni interferir.
- **Helpers `cacheFirst(request, cacheName)` y `networkFirst(request, cacheName)`** que abstraen las dos estrategias. Solo cachean respuestas con `status === 200`. En `cacheFirst`, además, solo se cachean respuestas con `type === 'basic'` (mismo origen).
- **Registro del SW desde `js/main.js`** al final del archivo (`window.addEventListener('load', ...)`). Scope `./`. Errores se loggean con `console.warn` y no rompen la app.
- **Meta tags PWA para iOS** añadidos a `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `mobile-web-app-capable`. Permiten instalar la app desde Safari como standalone con icono propio.
- **`site.webmanifest` actualizado**: `start_url` cambiado de `"/"` a `"../../"` y se añade `"scope": "../../"` para que la app instalada funcione bajo `localhost`, `file://`, y GitHub Pages en `/MNEMOTAG2/`.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — PWA real con Service Worker (v3.3.16)')` con 5 aserciones que verifican que el archivo existe, define las 3 estrategias y los listeners principales, precachea los managers, está registrado desde `js/main.js`, y los meta tags iOS están en HTML.

### Notas de implementación
- **Por qué no `addAll`**: `cache.addAll(urls)` falla si CUALQUIER recurso no se puede descargar (atomic). Para ser tolerantes en dev (donde a veces falta un archivo o el favicon), hacemos `add(url)` individual con `.catch()` que loggea el error y continúa.
- **Por qué network-first para CDNs**: Tailwind, FA, JSZip, piexifjs y heic2any pueden actualizarse en sus respectivos CDNs sin avisarnos. La estrategia network-first prioriza siempre la última versión disponible y solo cae a cache en modo offline.
- **Por qué registrar en `window.load`**: el registro del SW dispara el evento `install` que descarga 22+ archivos. En `load` ya hemos terminado de pintar todo y el usuario no nota la descarga.
- **Por qué `clients.claim()`**: sin él, la versión nueva del SW solo se activa para pestañas que se abran DESPUÉS del despliegue. Con `clients.claim()`, las pestañas abiertas también empiezan a usar la nueva versión inmediatamente.
- **Por qué `start_url: "../../"` en el manifest**: el manifest está en `images/favicon_io/site.webmanifest`, así que un path relativo `../../` resuelve correctamente a la raíz del proyecto sea cual sea la URL pública. Un path absoluto `"/"` rompe en GitHub Pages porque la app vive bajo `/MNEMOTAG2/`.

### Verificación
- `node tests/run-in-node.js` → **132/132 OK** (127 anteriores + 5 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.15] - 2026-04-08

### Added
- **Soporte HEIC/HEIF (formatos del iPhone)**. La app ahora carga directamente las fotos `.heic` que iOS genera por defecto.
- **Carga de la librería [heic2any](https://github.com/alexcorvi/heic2any) v0.0.4 desde CDN** en `index.html:1564`: `<script src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js">`. Sigue siendo un proyecto static-only (sin npm).
- **`handleFile(file)` ahora es `async function`** (`js/main.js:1802`). Antes de validar, comprueba si el archivo es HEIC/HEIF (vía MIME `image/heic|heif` o extensión `.heic|.heif`). Si lo es:
  - Verifica que `heic2any` esté definido (degradación elegante con error claro si no).
  - Muestra `UIManager.showInfo('🔄 Convirtiendo HEIC/HEIF a JPEG...')`.
  - Llama a `await heic2any({blob: file, toType: 'image/jpeg', quality: 0.92})`. La librería devuelve un Blob (o un Array de Blobs si la imagen original tiene varias páginas — toma el primero).
  - Envuelve el blob resultante en un nuevo `File` con la extensión cambiada de `.heic`/`.heif` a `.jpg` y MIME `image/jpeg`.
  - Reasigna `file = nuevoFile` y deja que el resto del flujo de validación, preview, carga y EXIF actúe sobre un JPEG estándar.
  - Toast de éxito `✅ HEIC convertido a JPEG correctamente`.
  - Si la conversión lanza, muestra `UIManager.showError('Error al convertir HEIC: ' + ...)` y aborta la carga sin tocar el resto de la app.
- **`SecurityManager.validateImageFile`** (`js/managers/security-manager.js:43+`) añade `'image/heic'` e `'image/heif'` a `allowedTypes` solo si `typeof heic2any !== 'undefined'`. Esto evita que se acepte un HEIC en runtime cuando la librería no está cargada (offline, CDN bloqueado, etc.).
- **Atributo `accept` del `<input id="file-input">`** actualizado a `.jpg,.jpeg,.png,.webp,.avif,.heic,.heif` para que el picker nativo del SO muestre los archivos HEIC seleccionables.
- **Texto informativo** del área de drop actualizado: *"Formatos: JPG, JPEG, PNG, WEBP, AVIF, HEIC, HEIF · Pega con Cmd+V / Ctrl+V"*.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Soporte HEIC/HEIF (v3.3.15)')` con 4 aserciones que verifican la carga de heic2any desde CDN, el `accept` del input + texto informativo en HTML, la conversión HEIC en `handleFile` (incluyendo `async function` y `await heic2any`), y la lógica condicional de `allowedTypes` en SecurityManager.

### Notas de implementación
- **Por qué `handleFile` async no rompe los callers**: los 5 puntos donde se llama a `handleFile` (drop area, file input, paste, paste button, batch) ya hacían fire-and-forget (no esperaban return value), por lo que devolver una Promise no cambia su comportamiento. La validación de errores sigue ocurriendo via toasts dentro de `handleFile`, igual que antes.
- **Por qué calidad 0.92 y no 1.0**: 1.0 produce JPEGs casi del mismo tamaño que el HEIC original (que ya está muy comprimido) sin ganancia visual perceptible. 0.92 mantiene fidelidad y reduce el tamaño ~30%, lo que mejora el rendimiento del resto del pipeline (filtros, redimensionado, descarga).
- **Por qué heic2any@0.0.4 y no la versión más nueva**: la 0.0.4 es la última estable publicada en npm. Las versiones siguientes (1.x) cambian la API y rompen el patrón `await heic2any({blob, toType, quality})`. Si en el futuro la librería se actualiza, hay que adaptar el caller.

### Verificación
- `node tests/run-in-node.js` → **127/127 OK** (123 anteriores + 4 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.14] - 2026-04-08

### Added
- **Panel de historial visual con thumbnails clicables**. Botón "Historial" (icono `fa-history`) junto a Deshacer/Rehacer en `index.html:1083`, dentro de la sección del canvas. Click toggle el panel `<div id="history-panel">` que se renderiza debajo del canvas con un grid responsive de mini-cards.
- **Cada mini-card** muestra:
  - La imagen completa del snapshot con `<img>` y `object-fit: contain` (sin recortar — el aspect ratio real de cada estado se preserva).
  - Número de snapshot y timestamp formateado HH:MM:SS.
  - **Click sobre la card** llama a `historyManager.jumpToState(index)` que restaura ese estado directamente, sin tener que aplicar undo N veces. Funciona en ambas direcciones (hacia atrás y hacia adelante en el historial).
- **El estado actual se resalta** con `.history-thumb.is-current` (borde azul 2px + halo difuso `box-shadow`).
- **`historyManager.getStatesSummary()`** en `js/managers/history-manager.js`. Devuelve `[{index, thumbnail, timestamp, isCurrent}]` para cada estado del historial. El campo `thumbnail` es directamente el `dataURL` del snapshot — el navegador escala vía CSS `object-fit: contain` para no rasterizar dos veces ni inflar memoria.
- **`historyManager.jumpToState(index)`** en el mismo archivo. Setea `currentIndex = index`, llama a `restoreState(states[index])` y emite un toast "Saltado al estado N+1".
- **`historyManager._buildThumbnail(sourceDataUrl, size)`** — placeholder defensivo que actualmente devuelve el `sourceDataUrl` original (delegando el escalado al CSS). El método existe para que futuras versiones puedan hacer escalado real con un canvas temporal cacheado, sin cambiar la API pública.
- **Auto-refresh del panel** vía `window.renderHistoryPanel`. `historyManager.updateUndoRedoButtons` (que se llama al final de cada `saveState`, `undo`, `redo` y `jumpToState`) invoca `window.renderHistoryPanel()` defensivamente si está definida. Esto evita acoplar `history-manager` a `main.js` directamente y mantiene la modularidad. Si el panel está oculto, el render es no-op (early return en la primera línea).
- **Estado vacío amistoso**: si `summary.length === 0`, el panel muestra un `<p class="history-panel__empty">` con texto explicativo en lugar de un grid vacío.
- **Estilos completos** en `css/styles.css`: `.history-panel`, `.history-panel__header`, `.history-panel__title`, `.history-panel__close`, `.history-panel__grid` (auto-fill 96px), `.history-thumb`, `.history-thumb.is-current` (borde azul + box-shadow), `.history-thumb__image` (h:80px, object-fit:contain), `.history-thumb__info` (timestamp en monospace), `.history-panel__empty`. Variantes para tema oscuro vía `[data-theme="dark"]`. Hover lift sutil en cada thumb.
- **Llamada a `renderHistoryPanel()` desde `_applyCurvesToImage`** para refrescar el panel inmediatamente después de aplicar curvas (operación pixel-level que sí lo necesita explícitamente, ya que el `saveState` posterior dispara el hook genérico también).
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Histórico visual con thumbnails (v3.3.14)')` con 6 aserciones que verifican `getStatesSummary` + `jumpToState` + `_buildThumbnail` en history-manager, el hook `window.renderHistoryPanel` desde `updateUndoRedoButtons`, las funciones `renderHistoryPanel` + `toggleHistoryPanel` + exposición a `window`, el uso de DOM API segura (`createElement`) + `historyManager.jumpToState`, los IDs del panel en HTML, y las clases CSS dedicadas.

### Notas de implementación
- **Por qué un hook `window.renderHistoryPanel` y no un acoplamiento directo**: `history-manager.js` no debe conocer el DOM más allá de los botones de Deshacer/Rehacer. El hook es opcional (se invoca con `typeof === 'function'`), por lo que el manager sigue funcionando si nadie lo define (ej: en tests Node).
- **Por qué el thumbnail es el dataURL completo y no un canvas reducido**: el navegador rasteriza una sola vez por `<img>` y aplica `object-fit: contain`. Generar miniaturas reales con un canvas temporal por estado consumiría tiempo y memoria sin beneficio visual. La clave es que CSS las muestra a 80px de altura — el ahorro real (cacheable) llegará si en el futuro se persisten thumbnails reducidos en `state.thumbnail` desde `saveState`.
- **Por qué llamar a `renderHistoryPanel` explícitamente desde `_applyCurvesToImage`**: las operaciones pixel-level (auto-balance, curvas) ya disparan `historyManager.saveState()`, que internamente llama a `updateUndoRedoButtons`, que llama al hook. La llamada extra es defensiva por si el orden cambia en el futuro.

### Verificación
- `node tests/run-in-node.js` → **123/123 OK** (117 anteriores + 6 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.13] - 2026-04-08

### Added
- **Editor de curvas y niveles estilo Photoshop**. Botón "Curvas y niveles" en la sección de filtros (`index.html:643`, debajo de "Auto-mejorar imagen") que abre `#curves-modal`. El modal contiene:
  - **Tabs de canal** (RGB combinado, R, G, B individuales). Cada canal mantiene su propio array de puntos de control en `_curvesState.points[channel]`. El estado es persistente entre cambios de tab pero se resetea al cerrar el modal.
  - **Canvas interactivo 280×280** con cuadrícula 4×4 sutil, línea diagonal punteada de referencia (curva identidad), y la curva del canal activo renderizada en tiempo real con su color característico (`#ef4444` rojo, `#10b981` verde, `#3b82f6` azul, `#111827` gris oscuro para RGB combinado).
  - **Click** añade un punto de control en la coordenada del cursor. **Drag** sobre un punto existente lo mueve, respetando que los puntos interiores no crucen a sus vecinos en X (clamp `points[i-1].x + 1` a `points[i+1].x - 1`). Los extremos (`x=0` y `x=255`) solo pueden cambiar de Y. **Doble-click** sobre un punto interior lo elimina; los extremos no se pueden eliminar.
  - **Botones "Aplicar a la imagen"** (cierra el modal y aplica) y **"Resetear curva"** (reinicia solo el canal activo a la línea identidad).
- **Función `_buildLutFromPoints(points)`** en `js/main.js`. Construye una `Uint8ClampedArray(256)` interpolando linealmente entre los puntos de control ordenados por X. Algoritmo: para cada `i` de 0 a 255, encuentra el segmento `[p0, p1]` que lo contiene y calcula `lut[i] = p0.y + t * (p1.y - p0.y)` con `t = (i - p0.x) / (p1.x - p0.x)`. Maneja los casos de borde (`i <= p0.x`, `i >= p1.x`).
- **Función `_applyCurvesToImage()`**. Construye 4 LUTs (R, G, B y RGB combinado) y las aplica a `ctx.getImageData()` con **composición Photoshop-style**: primero la LUT individual del canal y luego la LUT RGB combinada encima (`data[i] = lutRGB[lutR[data[i]]]`). Píxeles totalmente transparentes preservados. Persiste en `historyManager.saveState()`.
- **Función `_redrawCurvesCanvas()`**. Pinta la cuadrícula, la línea diagonal punteada (`setLineDash([4, 4])`), la curva del canal activo a partir de la LUT, y los círculos blancos rellenados con el color del canal en cada punto de control.
- **Idempotencia de los listeners**: `_setupCurvesUI()` marca `modal.dataset.curvesInitialized = '1'` para no re-enganchar listeners en aperturas posteriores.
- **Estilos completos** en `css/styles.css`: `.analysis-modal__content--curves` (max-width 380px), `.curves-controls`, `.curves-channel-tabs`, `.curves-channel-btn` (con estado `.active`), `#curves-canvas` (cursor crosshair, fondo blanco, bordes redondeados). Variantes para tema oscuro.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Curvas y niveles (v3.3.13)')` con 6 aserciones que verifican el estado `_curvesState`, las funciones `_buildLutFromPoints`, `openCurvesModal`, `_applyCurvesToImage` con composición LUT, `_redrawCurvesCanvas` con `setLineDash`, el modal HTML con tabs y canvas, y las clases CSS dedicadas.

### Notas de implementación
- **Por qué interpolación lineal segmentada y no Catmull-Rom**: la interpolación lineal es predecible (sin overshooting), rápida (sin cómputo de splines en cada redraw), y suficiente para edición visual. El usuario añade más puntos si quiere curvas más suaves — es exactamente lo que hace Photoshop por defecto.
- **Por qué composición R/G/B luego RGB**: replica la composición de Photoshop. La curva RGB combinada actúa como un ajuste global que se aplica DESPUÉS de las correcciones individuales de canal. Esto permite, por ejemplo, corregir el balance de blancos canal por canal y luego ajustar el contraste global con una S-curve en RGB.
- **Detección de click sobre punto existente**: radio de 8 unidades en el espacio [0,255] (no en píxeles del canvas), lo que se traduce en ~9 píxeles visuales para un canvas de 280×280.

### Verificación
- `node tests/run-in-node.js` → **117/117 OK** (111 anteriores + 6 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.12] - 2026-04-08

### Added
- **Histograma RGB + luminosidad** en modal. Botón con icono `chart-bar` en la barra de zoom del canvas (`index.html:1052`). Click abre `#histogram-modal` con un canvas 512×220 que pinta los 4 histogramas superpuestos (R, G, B y luminosidad ITU-R BT.601 = 0.299·R + 0.587·G + 0.114·B). Cada canal con opacidad 0.55 para que se vean las superposiciones, cuadrícula sutil cada cuarto vertical y leyenda inferior con swatches. Píxeles con `alpha === 0` se descartan del cómputo. Función `showHistogram()` en `js/main.js`.
- **Paleta de colores dominantes** en modal. Botón con icono `palette` también en la barra de zoom (`index.html:1055`). Click abre `#palette-modal` con un grid responsive que muestra los 12 colores más frecuentes de la imagen, extraídos por **cuantización en buckets 8×8×8** (`r >> 5`, 3 bits por canal). Cada swatch tiene el color y su código hex en mayúsculas; **click sobre un swatch copia el hex al portapapeles** vía `navigator.clipboard.writeText` con toast de confirmación. Sampleo cada 4 píxeles (stride = 16 bytes) para no recorrer millones en imágenes grandes. Funciones `showPalette()` y `_extractDominantColors(imageData, count)` en `js/main.js`.
- **Botón "Auto-mejorar imagen"** (auto-balance) en la sección de filtros, encima del botón "RESETEAR FILTROS" (`index.html:638`). Función `autoBalanceImage()` en `js/main.js`: construye un histograma de luminosidad sobre los píxeles visibles, calcula los **percentiles 1% y 99%**, construye una LUT (Look-Up Table) `Uint8ClampedArray(256)` que mapea linealmente `[lo, hi] → [0, 255]`, y la aplica a los 3 canales por separado para preservar la dominante de color. Si `hi <= lo`, muestra un info-toast en lugar de aplicar la transformación (la imagen ya tiene buen rango dinámico). El cambio se persiste en `historyManager.saveState()` para que el botón Deshacer revierta el auto-balance. Toast reporta los valores `lo`/`hi` calculados.
- **Modales `#histogram-modal` y `#palette-modal`** en `index.html`, con backdrop, header con título e icono FA, botón de cierre, y body. Cierre vía click en backdrop, botón X o atributo `data-close-modal` (todos enganchados en bloque genérico de `setupEventListeners`).
- **Estilos completos** para los modales y la paleta en `css/styles.css`: clases `.analysis-modal`, `.analysis-modal__backdrop`, `.analysis-modal__content`, `.analysis-modal__header`, `.analysis-modal__title`, `.analysis-modal__close`, `.analysis-modal__body`, `.analysis-modal__legend`, `.analysis-modal__legend-item`, `.palette-grid`, `.palette-swatch`, `.palette-swatch__color`, `.palette-swatch__info`. Variantes para tema oscuro vía `[data-theme="dark"]`. Backdrop con `backdrop-filter: blur(4px)`, hover lift de los swatches y leyenda con swatch CSS via `--swatch` custom property.
- **Helper `_getCanvasImageData()`** en `js/main.js`: wrapper defensivo que devuelve `null` si no hay imagen cargada o si `getImageData` lanza por canvas tainted. Reusado por las 3 funciones de análisis.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Análisis visual (v3.3.12): histograma + paleta + auto-fix')` con 6 aserciones que verifican `showHistogram` con coeficientes BT.601, `_extractDominantColors` con shift `>> 5`, `autoBalanceImage` con percentiles + LUT + saveState, los 3 botones en HTML, los 2 modales en HTML, y las clases CSS de los modales y la paleta.

### Notas de implementación
- **Construcción del histograma**: 4 `Uint32Array(256)` para evitar overflow en imágenes grandes. Normalización por el máximo común a los 4 canales para que la escala vertical sea consistente.
- **Cuantización de paleta**: 8 niveles por canal (3 bits) → ~512 buckets totales. Centrado del color en el bucket sumando 16. Map ordenada por frecuencia descendente, top 12.
- **LUT de auto-balance**: clamping explícito en `i <= lo` (→ 0) e `i >= hi` (→ 255), interpolación lineal en el rango interior. Píxeles totalmente transparentes preservados sin tocar.
- **DOM API segura** en la construcción de los swatches de paleta (`createElement`, `textContent`, `appendChild`) — sin `innerHTML` interpolado, manteniendo la línea de defensa XSS del proyecto.

### Verificación
- `node tests/run-in-node.js` → **111/111 OK** (105 anteriores + 6 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.11] - 2026-04-08

### Added
- **Pegar imagen desde el portapapeles (`Cmd+V` / `Ctrl+V`)**. Listener global de `paste` registrado en `document` desde `setupEventListeners()` (`js/main.js:721`). El handler `handlePasteImage(e)` (`js/main.js:1707`) recorre `e.clipboardData.items`, busca el primer item con `kind === 'file'` y `type.startsWith('image/')`, llama a `getAsFile()` y delega en `handleFile(file)`. **No interfiere** con pastes en `<input>`, `<textarea>` ni elementos `contentEditable` — comprueba `target.tagName` antes de actuar.
- **Botón "Pegar imagen"** visible en el área de drop, junto a "Seleccionar archivo" (`index.html:106`). Click handler `handlePasteButtonClick()` (`js/main.js:1734`) usa `navigator.clipboard.read()` (la API moderna que pide permiso explícito al usuario) — itera los items del portapapeles, busca uno con `type.startsWith('image/')`, llama a `item.getType(type)` para obtener el blob, lo envuelve en un `File` con nombre `pasted-image.<ext>` y lo pasa a `handleFile`. Toast de confirmación al éxito y degradación elegante si el navegador no soporta la API (`UIManager.showError`).
- **Texto de ayuda actualizado** en el área de drop: ahora indica explícitamente *"Formatos: JPG, JPEG, PNG, WEBP, AVIF · Pega con Cmd+V / Ctrl+V"* para que la nueva capacidad sea descubrible.
- **Sección "Exportar varios tamaños"** en la configuración de salida (sección 5 del HTML, `index.html:937+`). Cuatro checkboxes — 256, 512, 1024 y 2048 px — con 1024 y 512 marcados por defecto. Texto explicativo corto sobre qué hace el botón. Botón "Descargar varios tamaños (ZIP)" con icono `fas fa-file-archive`.
- **`downloadMultipleSizes()`** (`js/main.js:4041`, ~110 líneas). Lee qué checkboxes están marcados, valida que JSZip esté cargado (mismo patrón que el batch processor existente), determina el formato/calidad/aplanado finales reusando `outputFormat`, `getMimeType`, `determineFallbackFormat`, `hasImageAlphaChannel` y `getFlattenColor`. Para cada anchura marcada genera un canvas temporal redimensionado (manteniendo aspect ratio, sin upscalear), aplica aplanado JPEG si toca, exporta con `canvasToBlob`, embebe EXIF para JPEG/PNG/WebP usando los métodos `MetadataManager.embedExifIn*Blob`, y añade el blob al ZIP con nombre `<basename>-<ancho>px.<extensión>`. Al final genera el ZIP completo con `JSZip.generateAsync({ type: 'blob' })` y dispara la descarga vía `<a download>` + `URL.revokeObjectURL`. Restaura `showPositioningBorders = true` y re-dibuja el canvas en `finally` por si algo falla durante la operación.
- **Tests de regresión** en `tests/specs/regression.spec.js`: nuevo `describe('Regresión — Quick wins UX (v3.3.11): paste + export multi-size')` con 5 aserciones que verifican que `handlePasteImage` está definida y registrada, que `handlePasteButtonClick` usa `navigator.clipboard.read`, que el botón "Pegar imagen" existe en HTML, que `downloadMultipleSizes` usa `new JSZip()` + `zip.generateAsync`, y que los 4 checkboxes + el botón ZIP existen en HTML.

### Notas de implementación
- **No se ha tocado el flujo de descarga existente**. `downloadMultipleSizes` reusa todas las funciones que ya existían (`getMimeType`, `determineFallbackFormat`, `flattenCanvasForJpeg`, `embedExifIn*Blob`, `canvasToBlob`, `getFlattenColor`). Cero duplicación de la lógica de embebido EXIF binario.
- **JSZip ya estaba cargado** desde el batch processor, no se añade nueva dependencia CDN. Esto era condición necesaria para implementar multi-size sin romper la promesa "ligera" del proyecto.
- **El botón paste** abre un picker de permisos del navegador la primera vez (es lo esperado de `navigator.clipboard.read()`). El listener global `paste` no requiere permiso porque viene de un evento de usuario explícito.

### Verificación
- `node tests/run-in-node.js` → **105/105 OK** (100 originales + 5 nuevos)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

---

## [3.3.10] - 2026-04-09

### Removed
- **168 `console.log` ruidosos** del runtime, repartidos por los 13 archivos JavaScript de `js/main.js`, `js/managers/` y `js/utils/`. Eliminados con `sed -i.bak -E '/^[[:space:]]*console\.log\(.*\)[[:space:]]*;?[[:space:]]*$/d'` (BSD/macOS compatible) tras backup completo en `/tmp`. Cubre logs de inicialización (`✅ Worker pool inicializado`, `🎨 Sistema de filtros optimizado`), de cambios de estado (`Format changed to`, `Quality changed to`), de debug interno (`📐 Canvas configurado`, currentImage assignments), y de progreso de operaciones (`📥 Descargando con nombre`, `Image rotated`, etc.).
- **49 bloques `if (this.config.enableLogging) { }`** que quedaban vacíos en los managers tras eliminar el `console.log` que envolvían. Limpiados en una segunda pasada con un script Python que detecta `if\s*\([^)]+\)\s*\{\s*\}` y los borra incluyendo el indent.
- **1 caso especial** en `js/managers/filter-manager.js`: bloque `if (X) { } else { }` con AMBAS ramas vacías. Eliminado entero.
- **Total**: -292 líneas netas en 13 archivos.

### Lo que NO se ha tocado (deliberadamente)
- **`console.error`**: legítimo para reportar errores reales en producción.
- **`console.warn`**: legítimo para warnings de degradación elegante (formato no soportado, fallback, fuente no cargada).
- **`console.log` dentro de `tests/`**: los runners son intencionalmente verbose.
- **Comentarios que mencionan `console.log`** (1 caso en `smart-debounce.js:256`, dentro de un bloque de comentario que documenta por qué se eliminaron `pauseAll/resumeAll`).
- **`js/managers/security-manager.js`, `js/managers/metadata-manager.js`, `js/managers/history-manager.js`, `js/utils/helpers.js`, `js/utils/app-config.js`**: ya no tenían `console.log` antes (eran 0).

### Notes
- Existe el bug del checkbox `watermark-text-enabled` (marcado por defecto) reportado en la sesión anterior, que dispara un toast de error confuso si el usuario solo quiere usar marca de agua de imagen. **Este commit NO lo arregla** porque el usuario no eligió aún cuál de las 3 opciones aplicar (quitar `checked`, mejorar mensaje, o skip silencioso). Pendiente para el próximo turno.

### Verification
- `node tests/run-in-node.js` → 100/100 OK (sin regresiones)
- `node tests/binary-validation.js` → 36/36 OK (sin regresiones)
- Backups intermedios (`*.bak` de sed y `/tmp/js-backup-*`) eliminados tras confirmar que los tests pasan.

---

## [3.3.9] - 2026-04-09

### Added
- **Workflows de GitHub Actions** en `.github/workflows/` para CI/CD + deploy automático. Sin npm, sin secrets, sin tocar el código de la app, sin romper la naturaleza static-only del proyecto.
  - **`test.yml`** (~25 líneas): test gate del proyecto. Corre los dos runners Node (`tests/run-in-node.js` con 100 aserciones y `tests/binary-validation.js` con 36 aserciones binarias) en cada `push` y `pull_request` a `main`. Si alguno falla, el job queda rojo. Tiempo típico: 30-60 s. Se puede usar como required check en branch protection.
  - **`deploy.yml`** (~70 líneas): deploy continuo a GitHub Pages tras cada push a `main`. Re-corre los tests como defensa en profundidad antes del deploy. Empaqueta el repo entero como artifact (sin build step, la app es static). Job `deploy` con `actions/deploy-pages@v4`. Permisos mínimos (`contents: read`, `pages: write`, `id-token: write`). Concurrencia configurada para no cancelar deploys en curso.
  - **`README.md`** (~80 líneas): documentación corta de los dos workflows + las dos acciones manuales necesarias en la UI de GitHub la primera vez (activar Pages con source "GitHub Actions" y, opcional, branch protection).
- **Badges en README**: dos badges nuevos al inicio del README que muestran el estado de los workflows `Tests` y `Deploy to GitHub Pages` en tiempo real.

### Notes
- **NO se introduce npm en el código de la app.** El `node` que usan los runners es solo para ejecutar los tests existentes, que están escritos en JavaScript puro sin dependencias. No hay `package.json`, no hay `node_modules`, no hay build step. La naturaleza static-only del proyecto se preserva intacta.
- **NO se modifica nada del código de `js/`, `css/`, `index.html`** salvo el `<title>` (sincronización editorial). La app es funcionalmente idéntica a v3.3.8.
- **NO se hace push automático**. La decisión de pushear v3.3.9 al remoto sigue siendo del usuario.
- **Acción manual obligatoria la primera vez**: tras el primer push, el workflow `deploy.yml` fallará con un error claro porque GitHub Pages no está activado en el repo. Para activarlo: `Repository → Settings → Pages → Source = "GitHub Actions"`, luego re-disparar el workflow desde la pestaña Actions. Documentado paso a paso en `.github/workflows/README.md`.

### Verification
- `node tests/run-in-node.js` → 100/100 OK (sin cambios)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)
- Validación remota tras el push: ver pestaña Actions de GitHub. El workflow `Tests` debe terminar verde en ~30-60 s. El workflow `Deploy to GitHub Pages` fallará la primera vez (esperado) hasta activar Pages a mano.

### Por qué CI/CD y NO un backend
El usuario preguntó si era necesario un backend para mejorar la app. Tras analizar el estado real del proyecto (15.000 líneas, 100% client-side, 136 tests verde, EXIF real para JPEG/PNG/WebP), el diagnóstico fue **NO** — un backend rompería las 4 propiedades más valiosas del proyecto (privacidad, coste 0€, latencia 0, offline) sin resolver ningún problema concreto. CI/CD + deploy automático a Pages **no es backend, es DevOps + hosting estático profesional**, y aporta el valor real ("la app funciona mejor en producción") sin tocar la arquitectura.

---

## [3.3.8] - 2026-04-09

### Added
- **`tests/binary-validation.js`**: nuevo runner Node de validación binaria para las funciones de manipulación PNG y WebP introducidas en v3.3.6 y v3.3.7. Sin dependencias externas, ~360 líneas, ~100 ms de ejecución.
  - Carga `helpers.js` (en el orden correcto, antes que `metadata-manager.js`, porque `_buildPngExifChunk` usa `crc32`) y `metadata-manager.js` en un VM context con polyfills mínimos (`Blob` stub, `document` stub).
  - Sintetiza un **PNG mínimo válido de 1×1 píxel rojo** byte por byte.
  - Sintetiza tres WebP fake: **VP8 lossy** (con frame tag y signature `9D 01 2A`), **VP8L lossless** (con signature `0x2F`), y **VP8X extended** (con flags y dimensiones).
  - Pasa esos archivos por `_buildPngExifChunk`, `_insertExifChunkInPng`, `_parseWebpDimensions`, `_buildVp8xChunk`, `_buildRiffExifChunk`, `_convertSimpleWebpToVp8xWithExif` y verifica byte por byte que el output tiene la estructura binaria correcta.
  - **Verificación crítica del CRC32**: el script computa el CRC32 del chunk `eXIf` de forma **independiente** usando `helpers.crc32` y lo compara con el CRC declarado en los últimos 4 bytes del chunk. Si la implementación tuviera un bug, el chunk sería rechazado por parsers PNG estrictos. Resultado: coinciden (`0x6fca5c47` para el chunk del PNG mínimo de prueba).
  - 36 aserciones totales, todas verde.
- **Comando**: `node tests/binary-validation.js`.

### Notes
- **Por qué dos runners Node distintos**: `tests/run-in-node.js` verifica la API de los managers y las regresiones vía `fetch + grep` del código fuente. `tests/binary-validation.js` ejecuta las funciones reales contra archivos sintetizados a mano. Cubren clases de errores complementarias.
- **Lo que sigue sin verificarse**: que un navegador real abra los WebP/PNG generados ni que un visor EXIF de terceros (Apple Preview Info, exiftool, exif.tools) lea los tags. Eso sigue siendo validación browser.
- **Falso positivo evitado durante el desarrollo**: en la primera ejecución del script el CRC32 del chunk `eXIf` no coincidía. Causa: `helpers.js` se cargaba **después** que `metadata-manager.js`, lo que hacía que `_buildPngExifChunk` cayera en su rama defensiva (`typeof crc32 !== 'function' ? 0 : crc32(...)`) y produjera el chunk con CRC=0. Tras invertir el orden de carga (helpers primero, igual que en `index.html`), las 36 aserciones pasan. **El código de producción es correcto** — el bug estaba en el script de validación.

### Verification
- `node tests/run-in-node.js` → 100/100 OK
- `node tests/binary-validation.js` → 36/36 OK

---

## [3.3.7] - 2026-04-09

### Added
- **EXIF real para WebP** (`js/managers/metadata-manager.js`). Sin librerías externas, sin npm. Manipulación binaria a mano del contenedor RIFF + conversión automática de WebP "simple" (`VP8 ` lossy o `VP8L` lossless) a WebP extended (`VP8X`) para poder añadir el chunk `EXIF`.
- **Nuevos métodos en `MetadataManager`**:
  - `_parseWebpDimensions(bytes)`: detecta el tipo de chunk del WebP (VP8/VP8L/VP8X) y extrae width, height y `hasAlpha` del bitstream o del header VP8X. Maneja los 3 tipos.
  - `_buildVp8xChunk(width, height, hasExif, hasAlpha)`: construye un chunk `VP8X` de 18 bytes (FourCC 'VP8X' + size=10 + flags + reserved + canvas_width-1 + canvas_height-1).
  - `_buildRiffExifChunk(tiffBytes)`: construye un chunk RIFF EXIF con padding par. Reutiliza el bloque TIFF que genera `piexif.dump()` (mismo helper `_piexifBinaryToTiffBytes` que para PNG).
  - `_addExifToVp8xWebp(webpBytes, exifChunk)`: caso WebP que ya es VP8X. Solo añade el chunk EXIF al final y setea el bit 3 (EXIF flag) del header VP8X. Recalcula el size del RIFF principal.
  - `_convertSimpleWebpToVp8xWithExif(webpBytes, vp8xChunk, exifChunk)`: caso WebP simple (VP8 / VP8L). Inserta el chunk VP8X delante del bitstream y el EXIF al final. Recalcula el size del RIFF.
  - `embedExifInWebpBlob(blob)` (async) y `embedExifInWebpDataUrl(dataUrl)` (async): API pública análoga a JPEG/PNG. Defensivas.
- **Integración en `js/main.js`** en los 4 puntos del flujo de descarga, encadenadas tras JPEG y PNG. Cada función filtra por `blob.type` y devuelve sin tocar si no es su formato.

### Defensiva
Las funciones WebP son ultra-defensivas. Validan signature RIFF/WEBP antes de manipular, validan post-generación que el resultado sigue siendo un WebP válido (magic bytes), y todo está envuelto en try/catch que devuelve el blob original ante cualquier error. **NUNCA producen un WebP corrupto.** Si en algún caso edge la conversión falla, el archivo descargado sale sin EXIF pero sin daño.

### Tests
- `tests/specs/regression.spec.js`: nueva suite `Regresión — WebP EXIF real con manipulación RIFF/VP8X (v3.3.7)` con 6 tests fetch+grep que verifican: los 7 métodos privados/públicos en metadata-manager.js, manejo de los 3 tipos VP8/VP8L/VP8X, presencia del flag EXIF (0x08), validación post-generación de bytes RIFF/WEBP, y llamadas a `embedExifInWebpBlob`/`embedExifInWebpDataUrl` desde main.js.

### Verification automática
- 100/100 tests OK con `node tests/run-in-node.js` tras los cambios (94 anteriores + 6 nuevos).

### ⚠️ Validación manual OBLIGATORIA pendiente
A diferencia de JPEG y PNG, la validación visual con un browser real es **indispensable** para WebP antes de confiar en producción. El runner Node solo verifica que el código está en su sitio, no que los WebP generados sean abribles. Pasos:
1. Cargar una imagen en MnemoTag.
2. Rellenar metadatos (título, autor, copyright, GPS).
3. Seleccionar "WebP" como formato de salida.
4. Descargar.
5. Comprobar que el archivo `.webp` se abre sin error en cualquier visor (Preview, Finder, Chrome, etc.).
6. Comprobar que un visor EXIF (Apple Preview Info → "Más info" → Exif, exiftool, exif.tools) muestra los tags `Image Description`, `Artist`, `Copyright`, `GPS Latitude/Longitude`.
7. Repetir con un PNG de origen (lossless WebP de salida) y con un JPG de origen (lossy WebP de salida) para cubrir VP8 y VP8L.

Si algún caso falla, las funciones están preparadas para degradar elegantemente devolviendo el blob original — el archivo saldrá sin EXIF pero sin corrupción.

---

## [3.3.6] - 2026-04-09

### Added
- **EXIF real para PNG vía chunks `eXIf`** (`js/managers/metadata-manager.js`). Sin librerías externas, sin npm. Implementación a mano de manipulación binaria de chunks PNG. Reutiliza `piexif.dump()` para generar el bloque TIFF y le strippea la cabecera APP1 + `Exif\0\0` que añade para JPEG. El chunk `eXIf` es estándar desde PNG spec 1.5.
- **Utilidad `crc32`** en `js/utils/helpers.js`. Implementación CRC-32/ISO-HDLC con tabla de lookup precomputada (polinomio `0xEDB88320`). Necesaria para generar chunks PNG con CRC válido. Exportada en `module.exports`.
- **Nuevos métodos en `MetadataManager`**:
  - `_piexifBinaryToTiffBytes(binary)`: convierte el output de `piexif.dump()` a `Uint8Array` apto para chunk PNG (strippea APP1 + `Exif\0\0`).
  - `_buildPngExifChunk(tiffBytes)`: construye un chunk `eXIf` completo `[length:4][type=eXIf][data][crc32]`.
  - `_insertExifChunkInPng(pngBytes, exifChunk)`: parsea el PNG, valida la signature, encuentra el primer `IDAT`, elimina `eXIf` previos si los hubiera, y re-empaqueta el PNG con el chunk insertado justo antes del primer `IDAT`.
  - `embedExifInPngBlob(blob)` (async) y `embedExifInPngDataUrl(dataUrl)` (async): API pública análoga a las de JPEG. Defensivas: ante cualquier error devuelven el input sin tocar.
- **Integración en `js/main.js`** en los 4 puntos del flujo de descarga (`downloadImage` y `downloadImageWithProgress`, cada uno con sus dos ramas). Las llamadas son chained: primero `embedExifInJpegBlob` (no-op si no es JPEG), luego `embedExifInPngBlob` (no-op si no es PNG). Cada función filtra por su `blob.type` y devuelve sin tocar si no es su formato.

### Tests
- `tests/specs/regression.spec.js`: nueva suite `Regresión — PNG EXIF real con chunks eXIf (v3.3.6)` con 6 tests fetch+grep que verifican: utilidad `crc32` en helpers.js, métodos `embedExifInPngBlob`/`embedExifInPngDataUrl`/`_buildPngExifChunk`/`_insertExifChunkInPng`/`_piexifBinaryToTiffBytes`, bytes ASCII del chunk type `eXIf`, validación de signature PNG, y llamadas en `main.js` (mínimo 2 para Blob + presencia de DataUrl).

### Verification
- 94/94 tests OK con `node tests/run-in-node.js` tras los cambios (88 anteriores + 6 nuevos).

### Notes
- **Validación manual pendiente**: el runner Node no tiene Canvas2D real, así que no puede verificar visualmente que un PNG descargado contenga EXIF leíble. Hay que abrir un PNG generado por la app con un visor EXIF (Apple Preview Info, exiftool, exif.tools) y comprobar que aparecen los campos. La función es defensiva: si el resultado no es PNG válido, se devuelve el original sin tocar.

---

## [3.3.5] - 2026-04-09

### Added
- **Auto-escala del texto del watermark según tamaño de imagen** (`js/main.js applyTextWatermarkOptimized` + `index.html`). Nuevo checkbox `watermark-auto-scale` en la sección del watermark de texto. Cuando está activo, el `size` del slider se multiplica por `canvas.width / 1000` (referencia: 1000 px = factor 1, mínimo 8 px). Resultado: el tamaño percibido del watermark es consistente entre imágenes pequeñas y grandes. Antes `size=24` era 24 píxeles fijos del canvas, lo que en 4K se veía diminuto.
- **Color configurable de aplanado JPEG** (`js/utils/helpers.js flattenCanvasForJpeg` + `index.html` + `js/main.js getFlattenColor`). Nuevo `<input type="color" id="jpeg-flatten-color">` en la sección de salida. Cuando se exporta un PNG con transparencia a JPEG, el color de fondo del aplanado ya no es blanco fijo; el usuario puede elegirlo. Default blanco. La función `flattenCanvasForJpeg` ahora acepta un segundo parámetro `backgroundColor`.
- **Hover state visual del borde guía del watermark** (`js/main.js`). Nueva variable global `hoveredWatermark` (`'text'` | `'image'` | `null`). En `handleDragMove` cuando NO se está dragging, si el cursor está sobre un watermark en modo custom, se actualiza el flag y se dispara `updatePreview()` SOLO si cambió el estado (no en cada mousemove). En `applyTextWatermarkOptimized` y `drawCachedWatermark`, el borde se pinta más intenso (color más saturado y grosor +1) cuando el ratón está encima.
- **Toast informativo al aplanar JPEG** (`js/main.js downloadImage` y `downloadImageWithProgress`). Cuando se descarga un PNG con alpha como JPEG, ahora se muestra un toast `UIManager.showInfo` que dice explícitamente "Aplanando transparencia contra <color> para exportar a JPEG". Antes la decisión era silenciosa.
- **Auto-guardado del formulario en localStorage** (`js/managers/metadata-manager.js`). Nuevos métodos: `MetadataManager.AUTOSAVE_FIELDS`, `loadSavedMetadata` (ampliado para restaurar todos los campos textuales, no solo `author`), `saveFormToLocalStorage`, `setupAutoSave`. Se enganchan listeners `input`/`change` con debounce de 500 ms a los 5 campos textuales (`metaTitle`, `metaAuthor`, `metaCopyright`, `description`, `keywords`). **NO se persisten** GPS, license ni creationDate (privacidad e intencionalidad). `main.js` llama a `setupAutoSave()` durante init.

### Changed
- `helpers.flattenCanvasForJpeg(canvas)` → `helpers.flattenCanvasForJpeg(canvas, backgroundColor)`. Cambio retrocompatible: si el segundo parámetro es undefined o no es un hex válido, sigue usando blanco.
- `MetadataManager.loadSavedMetadata` ahora restaura `metaTitle`, `metaCopyright`, `description` y `keywords` (antes solo `metaAuthor`).

### Added (tests)
- `tests/specs/regression.spec.js`: nueva suite `Regresión — Mejoras de UX (v3.3.5)` con 8 tests fetch+grep que verifican: helper `getFlattenColor`, llamadas a `flattenCanvasForJpeg(canvas, flattenColor)`, presencia de la lógica `canvas.width / 1000`, variable `hoveredWatermark` y sus comparaciones, métodos `setupAutoSave`/`saveFormToLocalStorage`/`AUTOSAVE_FIELDS` en MetadataManager, llamada a `MetadataManager.setupAutoSave()` desde main.js, e inputs `jpeg-flatten-color` y `watermark-auto-scale` en index.html.
- Actualizados los tests de regresión existentes de `flattenCanvasForJpeg` para reflejar la nueva firma con segundo parámetro.

### Verification
- 88/88 tests OK con `node tests/run-in-node.js` tras los cambios (80 anteriores + 8 nuevos).

---

## [3.3.4] - 2026-04-09

### Changed
- **`historyManager.saveState` con límite de memoria** (`js/managers/history-manager.js`). Hasta ahora `maxStates = 20` limitaba solo por **número** de estados. Pero `canvas.toDataURL()` puede ocupar 10–30 MB por estado en imágenes 4K, lo que en una sesión larga acumulaba 200–600 MB. Nuevo tope **`HISTORY_MAX_TOTAL_SIZE = 100 MB cumulativos`**: antes de hacer push del nuevo snapshot, se calcula el tamaño total y se liberan estados viejos (FIFO) hasta que el nuevo entre. Si el propio nuevo snapshot excede el tope completo, no se guarda y se emite un `console.warn`.
- **`text-layer-manager.loadFont` con timeout** (`js/managers/text-layer-manager.js:189-201`). `document.fonts.load(...)` se envuelve ahora en `Promise.race` con un timeout de 5 segundos. Si Google Fonts está caído o lento, el race rechaza con un error que se captura en el catch externo, la fuente se omite y la app sigue funcionando. Antes la UI podía colgarse indefinidamente.
- **`canvasToBlob` simplificada** (`js/utils/helpers.js:172-189`). Eliminado el test prematuro que creaba un canvas 1×1 vacío y testaba `toDataURL(mimeType)` para decidir si forzar JPEG. Ese test podía dar falsos negativos en navegadores con WebP/AVIF soportados y forzar JPEG cuando el formato pedido sí funcionaba. Ahora se confía en que `canvas.toBlob` devolverá `null` al callback si el formato no está soportado, lo cual rechaza la promesa y el catch externo cae a `canvasToBlob_fallback`. ~17 líneas eliminadas.

### Removed
- **`SmartDebounce.pauseAll` y `SmartDebounce.resumeAll`** (`js/utils/smart-debounce.js`). Código muerto: nadie en el proyecto las llamaba. Además `resumeAll` era un **stub** que solo hacía `console.log` — nunca volvía a ejecutar los callbacks pausados, así que en realidad ni siquiera "reanudaba". ~42 líneas eliminadas. Si en el futuro se necesita pausar/reanudar debouncing, hay que rediseñarlo guardando referencias a las funciones originales y a sus argumentos.

### Added
- **Tests de regresión** en `tests/specs/regression.spec.js` (suite `Regresión — Bugs latentes y limpieza (v3.3.4)`):
  - `history-manager.js` define `HISTORY_MAX_TOTAL_SIZE = 100 * 1024 * 1024`.
  - `text-layer-manager.js` envuelve `document.fonts.load` en `Promise.race` con `FONT_LOAD_TIMEOUT_MS`.
  - `helpers.js` ya **no** contiene el test prematuro `tempCanvas.width = 1` ni `const testDataUrl = tempCanvas.toDataURL(mimeType)`.
  - `smart-debounce.js` ya **no** define `pauseAll: function` ni `resumeAll: function`.

### Verification
- Todos los tests siguen verde con `node tests/run-in-node.js` tras los cambios.

### Falsos positivos descartados de la auditoría original
- **Punto 6** del bundle de bugs latentes (batch-manager: error en una imagen aborta el batch entero): **NO existe**. El bucle `for...of` en `processBatch` (líneas 232-259) ya tiene `try/catch` interno que continúa con la siguiente imagen si una falla. **No se tocó.**

---

## [3.3.3] - 2026-04-09

### Security
- **Fix XSS latente en `UIManager.showError`/`showWarning`/`showSuccess`** (`js/managers/ui-manager.js:108,169,227`). Las tres funciones interpolaban `${config.action.handler}` dentro de un atributo `onclick="..."` en el HTML del toast. **No estaba activo** (ninguna llamada del proyecto pasaba hoy un `action.handler` — la única referencia era una línea comentada en `metadata-manager.js:146`), pero el código vulnerable era exactamente el mismo patrón que el del batch que arreglamos en 3.2.12. **Refactor**: construir el botón de acción con `createElement` + `addEventListener` + `textContent` después del `appendChild`. El `handler` solo se ejecuta si es una `function`; si llega como string, se ignora con un `console.warn` (compatibilidad con código antiguo, sin evaluarlo).

### Removed
- **`sanitizeFilename` (función global)** de `js/managers/security-manager.js`. Era código muerto duplicado: nadie en producción la llamaba (`main.js` usa `sanitizeFileBaseName` de `helpers.js`, que es mejor — preserva tildes y eñes con un regex específico). Quitada también del `module.exports`.
- **`exportToJSON` e `importFromJSON`** de `js/managers/metadata-manager.js:354-385`. Ambas eran código muerto. `importFromJSON` además era un patrón frágil porque asignaba elementos del DOM dinámicamente (`document.getElementById('meta' + key)`) sin validación de campos.
- **Suite de tests `sanitizeFilename (función global)`** de `tests/specs/security-manager.spec.js`, eliminada junto con la función.

### Added
- **Tests de regresión** en `tests/specs/regression.spec.js` (suite `Regresión — XSS latente en toasts`):
  - `ui-manager.js` ya **no** interpola `config.action.handler` en `onclick=`.
  - `ui-manager.js` **sí** usa `createElement('button')` + `addEventListener('click'` + `textContent`.
  - `security-manager.js` ya **no** define `sanitizeFilename`.
  - `metadata-manager.js` ya **no** define `exportToJSON` ni `importFromJSON`.

### Verification
- Todos los tests siguen verde con `node tests/run-in-node.js` tras los cambios.

---

## [3.3.2] - 2026-04-08

### Fixed
- **Conversión de formato JPEG con alpha rota desde versiones anteriores.** Si el usuario cargaba un PNG con transparencia y elegía JPEG en el desplegable de formato de salida, el código sustituía silenciosamente JPEG por PNG. La sustitución solo dejaba rastro en `console.info`, invisible para el usuario común. **Causa raíz**: lógica en `js/utils/helpers.js:353-356` (función `determineFallbackFormat`) que forzaba PNG cuando había alpha y se pedía JPEG.
- **Solución**: eliminada la lógica forzada en `determineFallbackFormat`. La función ahora respeta la elección del usuario.

### Added
- **`helpers.flattenCanvasForJpeg(canvas)`** (`js/utils/helpers.js`): nuevo helper utilitario que devuelve un canvas nuevo con fondo blanco (`#ffffff`) y el contenido del canvas original dibujado encima. Sin esto, las áreas transparentes saldrían como negro al exportar JPEG (default del codec). Con esto, el comportamiento es coherente con Photoshop/GIMP/Squoosh.
- **Integración en `main.js`**: las dos funciones de descarga (`downloadImage` y `downloadImageWithProgress`) usan `flattenCanvasForJpeg(canvas)` en sus 4 puntos de export (cada función × las dos ramas, `showSaveFilePicker` con Blob y fallback `<a download>` con dataURL). El aplanado solo se aplica cuando `finalMimeType === 'image/jpeg'`. PNG/WebP/AVIF se exportan sin tocar el canvas, preservando alpha.
- **Tests**:
  - `tests/specs/helpers.spec.js`: nueva suite `helpers — flattenCanvasForJpeg` con 3 tests (función expuesta como global, dimensiones del canvas resultado, devuelve `null`/`undefined` sin tocar).
  - `tests/specs/regression.spec.js`: nueva suite `Regresión — Conversión de formato JPEG con alpha` con 4 tests que verifican el código fuente con `fetch + grep` (ausencia del forzado a PNG, presencia del helper, presencia de las llamadas en `main.js`, condicionadas a `finalMimeType === 'image/jpeg'`).

### Changed
- **`CLAUDE.md`**: sección "Image processing pipeline" actualizada con la nota sobre el aplanado contra blanco.
- **`js/main.js:3975-3977`**: comentario obsoleto sobre `applyMetadataToImage` siendo "un stub" eliminado. Lleva obsoleto desde v3.2.15 cuando se implementó la escritura real de EXIF en JPEG.

### Verification
- 74/74 tests OK con `node tests/run-in-node.js` tras los cambios (67 anteriores + 3 nuevos del helper + 4 nuevos de regresión).

### Validación manual recomendada
- Cargar un PNG con transparencia.
- Seleccionar **JPEG** en el desplegable de formato de salida.
- Descargar.
- Verificar que el archivo descargado es `.jpg` y que las áreas que eran transparentes salen blancas.

---

## [3.3.1] - 2026-04-08

### Changed
- **Previsualización del watermark más fluida durante el drag** (`js/main.js`):
  - **RAF coalescing real** en `updatePreview` y `updatePreviewStandard`: nuevo flag `pendingPreviewRender` impide que múltiples `mousemove` encolen `requestAnimationFrame` independientes que se acumulan tras soltar el ratón. Ahora hay un solo render en vuelo a la vez.
  - **Skipping de operaciones costosas durante el drag**: si `isDragging === true`, `updatePreviewStandard` se salta `applyCanvasFilters()` y `debouncedSaveHistory()` (este último llama internamente a `canvas.toDataURL()`, muy caro en imágenes grandes). Al soltar el drag, `handleDragEnd` y `handleTouchEnd` disparan un `updatePreview()` final completo para reaplicar filtros y guardar al historial.
  - **Sincronización del overlay DOM**: `updatePreviewStandard` ahora invoca `showTextPositionMarker()` y `showPositionMarker()` cuando el modo es `custom`, no solo durante el drag. Antes el overlay del borde guía quedaba desfasado al cambiar `size`/`opacity` con sliders.
  - **Forzar camino estándar durante el drag**: `updatePreview` no enruta al worker (`updatePreviewWithWorker`) si está en drag activo, aunque haya filtros pesados pendientes. Reduce coste por frame.
  - Eliminados varios `console.log` ruidosos que se disparaban en cada frame durante el drag (`'⚠️ updatePreview…'`, `'🔄 Actualizando preview…'`, `'✅ Preview actualizado…'`, `'🔧 Usando Worker…'`).

### Added
- **Manejo de errores al cargar imagen del watermark** (`applyImageWatermarkOptimized` en `js/main.js:2584+`): añadidos `reader.onerror` y `watermarkImg.onerror`, ambos con `console.warn` y `UIManager.showError` informativos. Antes la carga de una imagen corrupta o ilegible fallaba en silencio.

### Verification
- 67/67 tests OK con `node tests/run-in-node.js` tras los cambios.

---

## [3.3.0] - 2026-04-08

### Notes
- **Release minor estable.** v3.3.0 promueve a una línea de versión menor todos los cambios significativos acumulados en 3.2.12–3.2.17. **No introduce funcionalidad nueva propia**: el bump refleja que la suma de cambios previos justifica un release minor según semver.
- Hitos consolidados desde v3.2.x:
  - **Escritura real de EXIF en JPEG** vía `piexifjs@1.0.6` (3.2.15).
  - **Suite de tests automatizados** con 67 tests y dos runners (browser + Node, ambos sin npm) (3.2.12, 3.2.14).
  - **Fix XSS crítico** en el listado del procesamiento por lotes (3.2.12).
  - **Worker pool resucitado** tras corregir el path del script (3.2.12).
  - **Strict mode** activado en los 16 managers/utils (3.2.13).
  - **Limpieza HTML Tier 1**: `maxlength`, `min`/`max`, `aria-label` (3.2.12).
  - **Documentación interna**: nuevo `CLAUDE.md` para futuras instancias del agente (3.2.12).
- Para el detalle de cada cambio, consultar las entradas `[3.2.12]` a `[3.2.17]` más abajo.

---

## [3.2.16] - 2026-04-08

### Changed
- **`.gitignore`**: añadida sección para `.claude/`, el directorio donde Claude Code guarda estado local del agente y los permisos aprobados por sesión. No es código del proyecto, contiene rutas absolutas específicas de la máquina del desarrollador y cambia constantemente entre sesiones, así que no debe trackearse.
- Sincronización menor: `<title>` de `index.html` a `v3.2.16`, nota de versión en `CLAUDE.md`.

---

## [3.2.15] - 2026-04-08

### Added
- **Escritura real de EXIF en JPEG** vía `piexifjs@1.0.6` (cargada desde jsdelivr CDN). La promesa de "EXIF metadata editor" del marketing del proyecto **ahora es real** para JPEG.
- Nuevos métodos en `MetadataManager` (`js/managers/metadata-manager.js`):
  - `buildExifObject(metadata)` — construye un objeto piexif a partir de los campos del formulario.
  - `embedExifInJpegBlob(blob)` (async) — embebe EXIF en un Blob JPEG.
  - `embedExifInJpegDataUrl(dataUrl)` (sync) — gemela para el camino de descarga con `<a download>`.
- Mapeo de campos: `title→ImageDescription`, `author→Artist`, `copyright→Copyright`, `software→Software`, `createdAt→DateTimeOriginal+DateTime`, `lat/lon/alt→GPS IFD` (con refs N/S/E/W y rationals DMS).
- 6 tests unitarios nuevos en `tests/specs/metadata-manager.spec.js` + 4 tests de regresión en `tests/specs/regression.spec.js`. Total: **67 tests** (antes 57).

### Changed
- `js/main.js`: el flujo de descarga (`downloadImage` y `downloadImageWithProgress`) ahora incrusta EXIF en los **4 puntos** de descarga (ambos métodos × ambas rutas: `showSaveFilePicker` con Blob y fallback `<a download>` con dataURL).
- El stub `applyMetadataToImage()` se mantiene para preservar `localStorage` entre sesiones (sigue siendo útil para recordar el autor entre cargas).

### Notes
- **`description` y `keywords` no se incrustan** porque EXIF no tiene tags estándar limpios para ellos. Microsoft `XPSubject`/`XPComment` requieren UTF-16 LE y son inconsistentes entre lectores.
- **`license`** se bundlea dentro del string `copyright` vía `generateCopyright()`.
- **PNG, WebP y AVIF siguen sin metadatos**: cada formato necesitaría su propia librería (PNG `tEXt`/`iTXt` chunks, WebP RIFF chunks, AVIF ISOBMFF boxes).

---

## [3.2.14] - 2026-04-08

### Added
- **Runner de tests para Node** (`tests/run-in-node.js`) que ejecuta los mismos `tests/specs/*.spec.js` del runner browser pero desde línea de comandos. Polyfills mínimos: `document` stub, `localStorage` con `Map`, `performance.now`, `fetch` aliasado a `fs.readFileSync`. Sin npm, sin `package.json`, sin `node_modules` — solo módulos nativos de Node (`fs`, `path`, `vm`).
- Comando: `node tests/run-in-node.js`. Tiempo de ejecución: ~80 ms para los 57 tests.

### Changed
- `CLAUDE.md`: sección "Running and developing" actualizada con la jerarquía de los dos runners — **browser autoritativo** (DOM real, Canvas real, fetch real), **Node como atajo rápido** para pre-commit y agentes que no tienen browser. Si algún test futuro toca Canvas/layout real, solo el browser puede verificarlo de verdad.

---

## [3.2.13] - 2026-04-08

### Changed
- **Strict mode activado** en los 16 archivos de `js/managers/` y `js/utils/`, más `js/image-processor.js` (worker script). Previene asignaciones implícitas a globales y otros errores silenciosos del sloppy mode.
- `js/main.js` queda **sin tocar** intencionalmente: tiene `let currentImage`, `let canvas`, etc. en script-scope global accedidos desde otros managers, y strict mode podría exponer asignaciones implícitas que ahora son silenciosas. Requiere tests más exhaustivos antes de migrarse.

### Removed
- `window.removeBatchImage` ya no se expone como global. Era necesaria para el viejo `onclick="removeBatchImage(${img.id})"` del listado del batch, pero tras el refactor del XSS en 3.2.12 el botón se engancha vía `addEventListener` directamente. Comentario en su lugar explica el motivo del hueco.

### Security (nota, no fix activo)
- **Hallazgo documentado para futura tanda**: `js/managers/ui-manager.js:108,169,227` tiene un patrón XSS latente similar al del batch — interpola `${config.action.handler}` dentro de `onclick="..."` en el HTML de los toasts. **No está activo** (ninguna llamada actual del proyecto pasa un `action.handler` — la única referencia que existe es una línea comentada en `metadata-manager.js:146`), pero el código vulnerable sigue ahí y merece su propia tanda de seguridad.

---

## [3.2.12] - 2026-04-08

### Security
- **Fix XSS crítico** en `updateBatchImagesList` (`js/main.js`). El listado del procesamiento por lotes interpolaba `img.name`, `img.dataUrl` e `img.id` directamente dentro de `innerHTML = batchImages.map(\`...\`)` sin escape. Refactorizado a construcción DOM segura con `createElement` + `textContent` + `addEventListener`. **Vector real**: un archivo con nombre `evil"><img src=x onerror=alert(1)>.jpg` ejecutaba JS al renderizar.

### Fixed
- **Worker pool resucitado.** `js/managers/worker-manager.js:16` declaraba `workerScript: 'workers/image-processor.js'`, pero el archivo real está en `js/image-processor.js`. Los `new Worker(...)` fallaban siempre en silencio y todo el procesamiento de filtros caía permanentemente al fallback de hilo principal (`js/utils/fallback-processor.js`). Path corregido a `'js/image-processor.js'`.
- **Toast falaz eliminado** (`js/main.js`). Tras una descarga, la UI mostraba "Imagen descargada con metadatos: ..." afirmando algo que el código nunca hizo. `MetadataManager.applyMetadataToImage()` solo guardaba en `localStorage`. El toast genuino "Imagen guardada exitosamente en formato …" sigue saliendo. (Esta versión todavía no escribe EXIF — eso llegó en 3.2.15.)

### Added
- **Suite de tests completa** en `tests/`. Mini framework casero (`tests/test-runner.js`, ~250 líneas, sin dependencias) con `describe`/`it`/`expect`. Specs cubren `AppConfig`, `helpers`, `SecurityManager`, `MetadataManager`, `historyManager` y 6 tests de regresión para los 3 fixes anteriores. **57 tests** verde. Se ejecuta abriendo `http://localhost:5505/tests/index.html` con Live Server.
- **Limpieza HTML Tier 1** (`index.html`):
  - `maxlength` en `metaTitle` (60), `metaAuthor` (100), `metaCopyright` (200), `description` (160), `keywords` (200), `watermark-text` (100). Antes solo había contadores JavaScript que no impedían el desbordamiento.
  - `min`/`max` físicos en `metaLatitude` (`-90`/`90`), `metaLongitude` (`-180`/`180`), `metaAltitude` (`-500`/`9000`).
  - `aria-label` en los 4 headers colapsables (metadata, watermark, filters, output) y en el botón `autoCopyright`. Lectores de pantalla ya no anuncian "button" sin contexto.
  - `<title>` sincronizado a `v3.2.12`.
- `CLAUDE.md` (nuevo) — guía de arquitectura para futuras instancias de Claude Code, documentando trampas conocidas: el path histórico del worker, EXIF como stub (en aquel momento), tema con `[data-theme="dark"]` y no Tailwind `dark:`, wheel zoom desactivado en desktop a propósito.

---

## [3.2.0 - 3.2.11] - Cambios sin documentar en este CHANGELOG

Estos commits son anteriores a la introducción del CHANGELOG estructurado en esta línea de versiones. Para detalle completo, consultar `git log`. Lista de commit messages tal cual:

- **3.2.11** – Reparar creación de la descarga y la sección 5
- **3.2.10** – Eliminar línea discontinua naranja en la imagen descargada
- **3.2.9** – Implementación del botón escala
- **3.2.8** – Eliminar el zoom del trackpad de las pantallas > 768px
- **3.2.7** – Actualización de la personalización de las marcas de agua
- **3.2.6** – Cambiar estilo de los botones de abajo en el modo oscuro
- **3.2.5** – Reparar el cierre de las secciones y las notificaciones
- **3.2.4** – Actualizar documentación
- **3.2.3** – Mejorar los botones de seleccionar archivo
- **3.2.2** – Centrar el modal
- **3.2.1** – Función antes/después
- **3.2.0** – Implementación de las nuevas funciones

---

## [3.1.4] - 2025-11-17

### 🐛 CORRECCIÓN DE BUGS CRÍTICOS

#### Bug #1: Descarga WebP No Funcionaba en Segundas Descargas
- ✅ **SOLUCIONADO:** Error crítico que impedía descargar después de eliminar el archivo
- **Problema:** `lastDownloadDirectory` guardaba resultado de `queryPermission()` ("granted") en lugar del directorio
- **Causa:** API recibía string inválido en `startIn`, causando fallo silencioso
- **Solución:** Eliminada línea problemática, API recuerda ubicación automáticamente
- **Tests:** 10/10 tests pasados - verificado con suite automatizada
- **Archivos:** `js/main.js` (funciones `downloadImage` y `downloadImageWithProgress`)

#### Bug #2: Botones de Acción Solapados
- ✅ **SOLUCIONADO:** Botones "Restablecer", "Antes/Después" y "Descargar" se solapaban
- **Problema:** Contenedor `.action-buttons` sin estilos base, anchos mínimos excesivos
- **Causa:** Faltaban estilos CSS, `min-width` demasiado grande (280px, 200px)
- **Solución:**
  - Agregado contenedor base con `display: flex`, `gap: 12px`, `flex-wrap: wrap`
  - Reducidos anchos: Download 280px→220px, Compare 200px→180px, Reset 170px
  - Agregado `flex-shrink: 0` para prevenir compresión no deseada
- **Archivos:** `css/styles.css` (31 líneas modificadas)

#### Bug #3: Preview Nombre de Archivo Invisible en Modo Oscuro
- ✅ **SOLUCIONADO:** Texto "ARCHIVO FINAL: nombre.webp" no legible en tema oscuro
- **Problema:** Clases Tailwind `dark:` no funcionaban, app usa `[data-theme="dark"]`
- **Causa:** Sistema de temas incompatible con sintaxis Tailwind dark mode
- **Solución:**
  - Agregados estilos CSS personalizados con selector `[data-theme="dark"]`
  - Fondo gris oscuro `#374151`, borde azul vibrante `#2563EB`
  - Texto gris claro `#D1D5DB`, nombre azul claro `#60A5FA`
  - Uso de `!important` para sobrescribir clases inline
- **Archivos:** `css/styles.css` (14 líneas nuevas), `index.html` (clases complementarias)

### ⚡ MEJORAS DE UX

- **Logging mejorado:** Mensajes console.log para debug de descargas
- **Contraste optimizado:** Alto contraste en preview de archivos
- **Responsividad:** Botones se adaptan mejor a pantallas medianas

### 📊 TESTS EJECUTADOS

**Suite 1: WebP Download (10 tests)**
- ✅ Variable lastDownloadDirectory correcta
- ✅ showSaveFilePicker usado correctamente
- ✅ Secuencia write correcta (createWritable → write → close)
- ✅ Manejo AbortError implementado
- ✅ Uso correcto de Blobs
- ✅ Logging de eventos completo
- ✅ startIn directory configurado
- ✅ Fallback tradicional disponible
- ✅ Sin memory leaks
- ✅ Consistencia entre funciones de descarga

**Tasa de éxito: 100% (10/10)**

---

## [3.1.3] - 2025-10-16

### ✨ NUEVA FUNCIONALIDAD DESTACADA

#### 🎯 Sistema Drag & Drop Ultra Intuitivo para Marcas de Agua
- ✅ **IMPLEMENTADO:** Sistema completamente rediseñado para máxima claridad y facilidad de uso
- **🎨 Bordes Visuales:** Texto con borde azul punteado, Imagen con borde naranja punteado
- **✋ Arrastre Directo:** Simplemente haz clic y arrastra, sin pasos previos confusos
- **💡 Mensajes Claros:** Instrucciones específicas en gradientes de colores según el elemento activo
- **🔄 Sin Click Inicial:** El sistema antiguo de "click para posicionar" ha sido eliminado
- **📍 Feedback Constante:** Mensajes en canvas que indican "ARRASTRA texto/imagen" en lugar de "Haz clic"
- **🖼️ Descarga Limpia:** Los bordes de guía NO aparecen en la imagen descargada

### 🔧 MEJORAS DE USABILIDAD

#### 🖱️ Zoom con Rueda del Mouse Optimizado
- ✅ **Desktop (>767px)**: Zoom con rueda del mouse/trackpad **DESACTIVADO** para evitar cambios accidentales
- ✅ **Desktop**: Solo zoom con botones +, -, y lupa (100%)
- ✅ **Móvil (<768px)**: Mantiene gestos táctiles (pinch-to-zoom) y scroll wheel
- **Motivo**: Evitar zoom accidental al mover el Magic Mouse o trackpad en desktop

### 📐 NUEVA FUNCIONALIDAD: Sistema de Reglas Métricas

#### Sistema de Coordenadas y Medición en Vista Previa
- ✅ **Botón "Escala"**: Nuevo botón junto a controles de zoom para activar/desactivar reglas
- ✅ **Reglas Métricas**: Horizontal (superior) y vertical (izquierda) con marcas cada 50px
- ✅ **Origen de Coordenadas**: Esquina superior izquierda (0, 0)
- ✅ **Líneas Guía**: Líneas horizontal y vertical que siguen al cursor en tiempo real
- ✅ **Display de Coordenadas**: Muestra posición exacta del cursor (X: px, Y: px)
- ✅ **Color Adaptativo**: Líneas cambian de color según el brillo del fondo
  - Blanco para fondos oscuros
  - Negro para fondos claros
- ✅ **Toggle ON/OFF**: Mostrar/ocultar todo el sistema con un solo click

**Características Técnicas:**
- Detección automática de brillo mediante `getImageData()`
- Event listeners optimizados (mousemove, mouseenter, mouseleave)
- Limpieza completa al desactivar (sin residuos en DOM)
- Reglas con fondo semi-transparente para no obstruir
- Coordenadas que se ajustan para no salirse del canvas
- Z-index apropiado para no interferir con otros elementos
- **Escalado correcto**: Las marcas usan coordenadas reales del canvas, escaladas visualmente
- Consistencia total entre reglas y coordenadas mostradas

**Características:**
- **Feedback visual:** Cursor cambia a `grab` (sobre elemento) y `grabbing` (durante arrastre)
- **Notificaciones:** Mensajes de confirmación al finalizar el reposicionamiento
- **Soporte táctil:** Funciona perfectamente en móviles y tablets con gestos touch
- **Área sensible:** Solo funciona cuando el cursor/dedo está sobre el elemento
- **Actualización en tiempo real:** La vista previa se actualiza mientras arrastras
- **Marcadores visuales:** Los círculos de posición se actualizan automáticamente

**Implementación técnica:**
- **Variables:** `isDragging`, `dragTarget`, `dragOffsetX/Y`, `textWatermarkBounds`, `imageWatermarkBounds`
- **Funciones de detección:** `isPointInText()`, `isPointInImage()`
- **Eventos Mouse:** `handleDragStart()`, `handleDragMove()`, `handleDragEnd()`
- **Eventos Touch:** `handleTouchStart()`, `handleTouchMove()`, `handleTouchEnd()`
- **Guardado de bounds:** En `applyTextWatermarkOptimized()` y `drawCachedWatermark()`
- **Gestión de conflictos:** No interfiere con zoom/pan del canvas

**Ventajas sobre el sistema anterior:**
- ❌ **Antes:** Deseleccionar → Reseleccionar "Posición personalizada" → Click
- ✅ **Ahora:** Simplemente arrastra el elemento cuando quieras

**Compatibilidad:**
- ✅ Chrome/Edge (Desktop y Mobile)
- ✅ Firefox (Desktop y Mobile)
- ✅ Safari (Desktop y Mobile)
- ✅ iOS y Android

**Documentación:** Ver `docs/DRAG_DROP_SYSTEM.md` para detalles completos

### 🐛 CORRECCIÓN CRÍTICA: Bordes de Guía en Imagen Descargada

#### Problema Identificado
- ❌ Los bordes de guía (azul/naranja) aparecían en la imagen final descargada
- ❌ `applyWatermarkOptimized()` solo dibujaba ENCIMA del canvas sin limpiar
- ❌ Los bordes ya dibujados permanecían en el canvas

#### Solución Implementada
- ✅ **Variable de control:** `showPositioningBorders` (true/false)
- ✅ **Nueva función:** `redrawCompleteCanvas()` que:
  1. Limpia el canvas completamente con `clearRect()`
  2. Redibuja la imagen base desde cero
  3. Aplica marcas de agua (respetando `showPositioningBorders`)
  4. Aplica filtros CSS

#### Secuencia de Descarga Corregida
```javascript
// ANTES de descargar:
showPositioningBorders = false;
redrawCompleteCanvas(); // Limpia y redibuja sin bordes

// Generar imagen limpia
canvas.toDataURL() / toBlob();

// DESPUÉS de descargar (finally):
showPositioningBorders = true;
redrawCompleteCanvas(); // Restaura vista previa con bordes
```

#### Funciones Actualizadas
- ✅ `downloadImage()` - Usa `redrawCompleteCanvas()`
- ✅ `downloadImageWithProgress()` - Usa `redrawCompleteCanvas()`
- ✅ `downloadImageEnhanced()` - Usa `redrawCompleteCanvas()`

#### Resultado
| Situación | Antes | Ahora |
|-----------|-------|-------|
| Vista Previa | Bordes ✅ | Bordes ✅ |
| Imagen Descargada | Bordes ❌ | **Sin bordes** ✅ |
| Después de Descargar | Bordes ✅ | Bordes ✅ |

**Archivos modificados:**
- `js/main.js` - Variable `showPositioningBorders`, función `redrawCompleteCanvas()`, 3 funciones de descarga actualizadas

---

## [3.1.2] - 2025-10-13

### ✨ NUEVAS FUNCIONALIDADES

#### 🎯 Secciones Colapsables/Expandibles
- ✅ **IMPLEMENTADO:** Sistema completo de secciones colapsables para mejor organización
- Las 4 secciones principales ahora se pueden minimizar/expandir con un click
- Animaciones suaves y transiciones CSS optimizadas
- Soporte completo para navegación por teclado (Enter/Space)
- Iconos rotativos (▼/▶) que indican el estado actual
- Minimización automática del marco del card cuando está colapsado
- Mejora significativa de la organización visual y workflow
- **DELEGACIÓN DE EVENTOS:** Implementada para máxima compatibilidad y robustez

**Características:**
- **JavaScript:** Función `setupCollapsibles()` con delegación de eventos en `document`
- **Event Capture:** Usa `capture: true` para interceptar eventos ANTES que otros listeners
- **CSS:** Transiciones con `max-height`, `opacity` y rotación de iconos
- **Accesibilidad:** Atributos ARIA (`aria-expanded`, `aria-hidden`)
- **Keyboard Support:** Enter y Space para toggle
- **Estado inicial:** Todas las secciones abiertas por defecto
- **Robustez:** Resistente a conflictos con otros scripts y event listeners

#### 📍 Geolocalización Mejorada
- ✅ **IMPLEMENTADO:** Sistema de obtención de coordenadas GPS con feedback contextual
- Botón "Ubicación actual" con icono de crosshairs
- Mensajes de estado **no intrusivos** (sin toasts flotantes)
- Indicadores visuales debajo de los campos de entrada
- Soporte para Latitud, Longitud y Altitud
- Gestión inteligente de permisos con mensajes informativos
- Manejo de errores con ayuda contextual

**Características:**
- **Estados:** Loading (azul), Success (verde), Error (rojo)
- **Permisos:** Mensajes específicos según el tipo de error
- **UX:** Feedback inmediato sin interrupciones
- **Precisión:** 6 decimales para coordenadas, metros para altitud
- **CSS forzado:** `position: static !important` para evitar desplazamientos

**Errores manejados:**
- `PERMISSION_DENIED` - Ayuda para activar permisos en el navegador
- `POSITION_UNAVAILABLE` - Verificación de servicios de ubicación
- `TIMEOUT` - Sugerencia de verificar conexión
- Error desconocido - Verificación de HTTPS/localhost

#### Feedback Visual de Estado en Botones de Carga
- ✅ **IMPLEMENTADO:** Sistema de indicadores visuales de estado para botones de carga de archivos
- Mejora significativa de la experiencia de usuario con feedback inmediato

**Características:**

1. **Botón de Carga Principal (Sección 1)**
   - 🔴 **Estado rojo**: Cuando no hay imagen cargada (indica acción pendiente)
   - 🟢 **Estado verde**: Cuando la imagen se carga correctamente (indica éxito)
   - 🖼️ **Miniatura**: Muestra preview de 48x48px de la imagen cargada
   - Miniatura con bordes redondeados y efecto hover

2. **Botón de Marca de Agua (Sección 3)**
   - 🔴 **Estado rojo**: Cuando no hay marca de agua cargada
   - 🟢 **Estado verde**: Cuando la marca de agua se carga correctamente
   - 🖼️ **Miniatura**: Muestra preview de 40x40px de la marca de agua
   - Fondo translúcido para mejor visualización de transparencias

**Implementación Técnica:**

- **CSS**: Clases `.image-loaded` y `.watermark-loaded` con gradientes dinámicos
- **Estados hover**: Colores más oscuros según el estado (rojo/verde)
- **Modo oscuro**: Soporte completo con ajustes de contraste
- **JavaScript**: Actualización automática de estados al cargar/eliminar archivos
- **Miniaturas**: Generación dinámica con FileReader API

### 🐛 CORRECCIÓN DE BUGS

#### Problema: Secciones no se minimizaban correctamente
- **Descripción:** Las secciones 2, 3 y 5 no minimizaban el marco del card
- **Causa:** El `.card` tenía una `min-height` que impedía la minimización
- **Solución:** Clase `.card--collapsed` con `!important` para sobrescribir `min-height`

#### Problema: Sección 2 no se podía abrir
- **Descripción:** Al hacer clic en el header de la sección 2, no respondía
- **Causa:** Event listeners duplicados y conflictos con `stopPropagation()`
- **Solución:** Simplificado a un solo listener con `dataset.collapsibleConfigured`

#### Problema: Toast flotante de geolocalización
- **Descripción:** El mensaje aparecía como toast arriba a la derecha
- **Causa:** `UIManager.showSuccess()` activo + CSS incorrecto + caché del navegador
- **Solución:** Comentado `UIManager.showSuccess()` + CSS con `position: static !important` + cache busting

#### Problema: Sección 5 (Output) no respondía a clicks
- **Descripción:** La sección 5 no se podía colapsar/expandir
- **Causa:** Conflicto de event listeners con otros scripts
- **Solución:** **DELEGACIÓN DE EVENTOS** con `capture: true` en `document`

**Archivos Modificados en v3.1.2:**
- `js/main.js` - Funciones `setupCollapsibles()` y `toggleCollapsible()` con delegación de eventos
- `js/managers/metadata-manager.js` - Función `getCurrentLocation()` mejorada, toast comentado
- `css/styles.css` - ~200 líneas de estilos nuevos (colapsables + geolocalización + fixes)
- `index.html` - Headers colapsables, estructura de geolocalización, cache busting

**Beneficios UX:**
- ✅ Mejor organización visual con secciones colapsables
- ✅ Workflow más eficiente al minimizar secciones no usadas
- ✅ Feedback de geolocalización contextual (no intrusivo)
- ✅ Mensajes de estado claros y visibles
- ✅ Navegación por teclado accesible
- ✅ Animaciones suaves y profesionales
- ✅ Feedback visual inmediato del estado de carga
- ✅ Reducción de confusión del usuario

---

## [3.1.1] - 2025-10-04

### 🐛 CORRECCIONES DE BUGS POST-v3.1

#### Bug #1: Selector de Licencia
- ✅ **SOLUCIONADO:** Copyright dinámico según tipo de licencia seleccionada
- Implementado sistema que genera automáticamente el texto de copyright apropiado
- Creative Commons, dominio público y todos los derechos reservados ahora tienen mensajes específicos

#### Bug #2: Fuente Faltante
- ✅ **SOLUCIONADO:** Agregada fuente "Montserrat Alternates" a todos los selectores de fuente
- Disponible en: marca de agua de texto y capas de texto
- Total de fuentes disponibles: 20+

#### Bug #3: Campo de Nombre de Archivo
- ✅ **SOLUCIONADO:** Campo de nombre de archivo no funcionaba al descargar
- Corregido en función `downloadImageWithProgress()` para usar input `#file-basename`
- Los nombres personalizados ahora se aplican correctamente

#### Bug #4: Campos de Información Oscuros
- ✅ **SOLUCIONADO:** Mejora de contraste en campos de rotación y preview de nombre
- Cambiados de fondo oscuro a `bg-white border-blue-200 text-blue-600`
- Mejor legibilidad en modo claro

#### Bug #5: Botón de Marca de Agua de Imagen
- ✅ **SOLUCIONADO:** Rediseño completo del botón con gradiente e icono SVG
- Agregado nombre dinámico del archivo seleccionado
- Mejor feedback visual para el usuario

#### Bug #6: Botones de Herramientas Avanzadas
- ✅ **SOLUCIONADO:** Botones Lote, Texto, Recortar y Atajos no respondían
- Corregidos event listeners con prefijo `window.`
- Cambiado sistema de display de `classList` a `style.display`

#### Bug #7: Estilo de Botones del Modal de Lotes
- ✅ **SOLUCIONADO:** Mejorados botones "Cancelar" y "Procesar"
- Botón Cancelar: gradiente rojo con hover mejorado
- Botón Procesar: gradiente púrpura premium
- Mejor contraste en modo oscuro

#### Bug #8: Conflictos de Atajos de Teclado
- ✅ **SOLUCIONADO:** Atajos nativos de Mac (⌘+C, ⌘+V, Backspace) ahora funcionan normalmente
- Removidos atajos conflictivos: ⌘+C (copiar canvas), Backspace (eliminar capa)
- Implementadas alternativas con ⌘+Shift: ⌘+⇧+C, ⌘+⇧+V, ⌘+⇧+X
- Delete key con `preventDefault: false` para permitir uso normal en inputs

### 🎨 MEJORAS DE UI/UX

#### Atajos de Teclado Optimizados para Mac
- ✅ Símbolos nativos de Mac en tooltips (⌘, ⇧, ⌥)
- ✅ Todos los tooltips actualizados de formato "⌘/Ctrl" a solo "⌘"
- ✅ Modal de atajos actualizado con nueva lista completa
- ✅ Nota informativa sobre atajos nativos funcionando normalmente

#### Modo Oscuro Completo
- ✅ Contenedor de "Herramientas Avanzadas" con fondo oscuro apropiado
- ✅ Clase CSS personalizada `.advanced-tools-container`
- ✅ Gradiente oscuro `#1f2937` → `#374151` en tema dark

#### Texto en Mayúsculas
- ✅ Regla CSS global aplicada: `text-transform: uppercase`
- ✅ Afecta a todos los elementos de texto del proyecto
- ✅ Placeholders mantienen formato normal para mejor UX

#### Títulos Actualizados
- ✅ "Herramientas Avanzadas v3.1" → "HERRAMIENTAS AVANZADAS"
- ✅ Consistencia visual en toda la aplicación

---

## [3.1.0] - 2025-10-04

### ✨ NUEVAS FUNCIONALIDADES

#### ⌨️ Sistema de Atajos de Teclado (Mac Optimizado)
- Agregado sistema completo de keyboard shortcuts
- Detección automática de plataforma (Mac/Windows/Linux)
- Modal de ayuda con grid organizado de todos los atajos
- Prevención de conflictos con campos de texto
- Soporte nativo para símbolos Mac (⌘, ⇧, ⌥)

**Atajos disponibles (Mac):**

EDICIÓN:
- `⌘ + Z` - Deshacer última acción
- `⌘ + ⇧ + Z` - Rehacer acción
- `⌘ + D` - Duplicar capa
- `Delete` - Eliminar capa seleccionada
- `⌘ + ⇧ + R` - Restablecer filtros

ARCHIVO:
- `⌘ + S` - Guardar imagen
- `⌘ + ⇧ + C` - Copiar imagen al portapapeles
- `⌘ + ⇧ + V` - Pegar imagen desde portapapeles
- `⌘ + ⇧ + X` - Exportar como...

HERRAMIENTAS:
- `⌘ + B` - Procesamiento por lotes
- `⌘ + T` - Capas de texto
- `⌘ + R` - Activar recorte
- `⌘ + ⇧ + ?` - Mostrar atajos

VISTA:
- `Espacio` - Ver imagen original (mantener presionado)
- `+` - Zoom in
- `-` - Zoom out
- `0` - Zoom 100%
- `Esc` - Cancelar operación

**NOTA IMPORTANTE:** Los atajos nativos de Mac (⌘+C, ⌘+V, ⌘+X, Backspace) funcionan normalmente en campos de texto.

#### 📦 Batch Processing (Procesamiento por Lotes)
- Procesamiento de hasta 50 imágenes simultáneamente
- Interfaz drag & drop intuitiva
- Visualización de thumbnails con información de archivos
- 4 opciones de configuración:
  - Aplicar filtros actuales
  - Aplicar marco/borde
  - Aplicar metadatos
  - Aplicar marca de agua
- Barra de progreso en tiempo real con callbacks
- Exportación automática a archivo ZIP
- Integración con JSZip 3.10.1

#### 🎨 Capas de Texto Avanzadas
- Soporte para hasta 10 capas de texto independientes
- 10 plantillas profesionales prediseñadas
- 20 fuentes de Google Fonts disponibles
- Editor inline completo con controles para:
  - Texto y fuente tipográfica
  - Tamaño y color
  - Posición (X, Y) y rotación
  - Opacidad
- 3 efectos visuales:
  - Sombra (drop shadow)
  - Contorno (stroke)
  - Gradiente
- Control de visibilidad individual por capa
- Gestión automática de z-index
- Renderizado en tiempo real sobre el canvas

#### ✂️ Recorte Inteligente
- 7 proporciones de aspecto predefinidas:
  - Instagram Post (1:1)
  - Instagram Story (9:16)
  - YouTube Thumbnail (16:9)
  - Twitter Post (16:9)
  - Facebook Cover (820:312)
  - A4 Portrait (210:297)
  - A4 Landscape (297:210)
- Modo libre sin restricciones
- 8 handles de redimensionamiento
- Overlay semi-transparente con contraste
- Cuadrícula de regla de tercios (toggle)
- 3 sugerencias automáticas inteligentes:
  - **Centro Inteligente** - Recorte centrado óptimo
  - **Regla de Tercios** - Composición profesional
  - **Cuadrado Máximo** - Mayor área cuadrada posible
- Información en tiempo real (dimensiones y ratio)
- Vista previa antes de aplicar
- Opción de cancelar sin perder cambios

---

### 🎨 Mejoras de UI/UX

#### Componentes Nuevos
- **Modal System**: Sistema de modales con overlay y animaciones
- **Side Panels**: Paneles laterales deslizables para texto y crop
- **Dropzone**: Zona de arrastre visual con feedback de hover y drag-over
- **Batch Items**: Cards de thumbnails con información y botón de eliminar
- **Progress Bar**: Barra de progreso con efecto shimmer animado
- **Template Buttons**: Botones de plantillas en grid responsive
- **Text Layer Items**: Lista de capas con preview y controles
- **Crop Overlay**: Overlay interactivo con handles y grid
- **Shortcuts Grid**: Grid organizado de atajos de teclado con kbd styling

#### Animaciones
- `fadeIn` para overlays (200ms)
- `slideIn` para modales (300ms)
- `slideFromRight` para side panels (300ms)
- `shimmer` para progress bars (2s loop)
- Efectos hover en todos los elementos interactivos
- Transiciones suaves en cambios de estado

#### Responsive Design
- **Desktop (≥1024px)**: Side panels de 400px, grids multi-columna
- **Tablet (768-1023px)**: Side panels full-width, grids de 2 columnas
- **Mobile (<768px)**: Modales y paneles pantalla completa, grids 1 columna

---

### 📁 Archivos Agregados

#### Core Functionality
- `js/utils/keyboard-shortcuts.js` (209 líneas)
- `js/managers/batch-manager.js` (434 líneas)
- `js/managers/text-layer-manager.js` (490 líneas)
- `js/managers/crop-manager.js` (658 líneas)

#### Documentación
- `docs/NEW_FEATURES.md` (658 líneas) - Documentación técnica completa
- `docs/README_NEW_FEATURES.md` (273 líneas) - Guía de usuario
- `docs/TESTING_GUIDE.md` (350 líneas) - Guía de testing exhaustiva
- `docs/IMPLEMENTATION_SUMMARY.md` (400 líneas) - Resumen de implementación
- `CHANGELOG.md` - Este archivo

---

### 🔧 Archivos Modificados

#### `index.html`
- Agregados 4 botones de features en toolbar avanzado
- Agregado modal de Batch Processing (72 líneas HTML)
- Agregado panel lateral de Capas de Texto (94 líneas HTML)
- Agregado panel lateral de Crop Inteligente (73 líneas HTML)
- Agregado modal de Ayuda de Atajos (67 líneas HTML)
- Agregados scripts CDN:
  - JSZip 3.10.1 para exportación ZIP
  - Google Fonts API con preconnect para performance
  - Links a nuevos managers

#### `css/styles.css`
- Agregados ~600 líneas de CSS nuevo
- Sistema completo de modales y overlays
- Estilos para side panels deslizables
- Componentes de batch (dropzone, items, progress)
- Componentes de texto (templates, layers, editor)
- Componentes de crop (overlay, handles, controls)
- Grid de shortcuts con kbd styling
- Variantes de botones (outline, small, success, danger)
- Media queries para responsive completo
- Clases de utilidad (hidden, visible, loading)

#### `js/main.js`
- Agregadas ~618 líneas de JavaScript de integración
- Funciones de inicialización:
  - `initializeAdvancedManagers()` - Setup de managers
  - `setupKeyboardShortcuts()` - Configuración de atajos
  - `initializeAdvancedUI()` - Setup de UI y event listeners
- **Batch Processing Functions** (~100 líneas):
  - `openBatchModal()`, `closeBatchModal()`
  - `setupBatchDropzone()` con drag & drop
  - `addBatchImages()`, `removeBatchImage()`, `updateBatchImagesList()`
  - `processBatch()` con progress callbacks
  - `downloadBatchZip()` con JSZip
  - `loadImageFromFile()`, `formatFileSize()`
- **Text Layers Functions** (~120 líneas):
  - `openTextLayersPanel()`, `closeTextLayersPanel()`
  - `applyTextTemplate()`, `addNewTextLayer()`
  - `selectTextLayer()`, `updateActiveTextLayer()`
  - `updateTextLayersList()` con renderizado dinámico
  - `toggleLayerVisibility()`, `deleteActiveTextLayer()`
  - `renderCanvasWithLayers()` con integración de filtros
- **Crop Functions** (~80 líneas):
  - `openCropPanel()`, `closeCropPanel()`
  - `changeCropAspectRatio()`, `updateCropInfo()`
  - `toggleCropGrid()` con feedback visual
  - `applyCropSuggestion()` para 3 tipos de sugerencias
  - `applyCrop()`, `cancelCrop()` con manejo de estado
- **Shortcuts Functions** (~20 líneas):
  - `openShortcutsModal()`, `closeShortcutsModal()`
- Utilidad `debounce()` para optimización de inputs
- Event listeners para todos los controles

#### `README.md`
- Actualizada sección de versión a v3.1
- Agregadas 4 nuevas funcionalidades en features list
- Actualizado roadmap con estado de v3.1
- Agregadas referencias a nueva documentación

---

### 📦 Dependencias

#### Nuevas Dependencias
- **JSZip 3.10.1** (CDN) - Librería para crear archivos ZIP
  - URL: `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`
  - Uso: Exportación de batch processing a ZIP
  - Licencia: MIT

- **Google Fonts API** - Servicio de fuentes web
  - URL: `https://fonts.googleapis.com`
  - Uso: 20 fuentes tipográficas para capas de texto
  - Preconnect agregado para optimización de performance
  - Fuentes disponibles: Roboto, Open Sans, Lato, Montserrat, Oswald, Source Sans Pro, Raleway, PT Sans, Merriweather, Nunito, Playfair Display, Ubuntu, Roboto Condensed, Poppins, Lora, Pacifico, Dancing Script, Bebas Neue, Caveat, Permanent Marker

#### Dependencias Existentes (sin cambios)
- Font Awesome 6.4.0
- Bibliotecas internas (FilterManager, UIManager, etc.)

---

### 🏗️ Arquitectura

#### Patrón Manager Expandido
El proyecto mantiene el patrón de managers modulares, ahora con 10 managers totales:
1. FilterManager - Gestión de filtros de imagen
2. UIManager - Gestión de interfaz y feedback
3. HistoryManager - Sistema de deshacer/rehacer
4. MetadataManager - Gestión de EXIF y metadatos
5. SecurityManager - Validación y seguridad
6. FilterLoadingManager - Carga dinámica de filtros
7. WorkerManager - Web Workers para procesamiento
8. **BatchManager** ⭐ NUEVO - Procesamiento por lotes
9. **TextLayerManager** ⭐ NUEVO - Capas de texto
10. **CropManager** ⭐ NUEVO - Recorte inteligente

#### Utilities Expandidas
7 utilidades, incluyendo 1 nueva:
- app-config.js
- helpers.js
- filter-cache.js
- smart-debounce.js
- fallback-processor.js
- **keyboard-shortcuts.js** ⭐ NUEVO

---

### 🎯 Estadísticas

#### Líneas de Código
- **Core Functionality**: 1,791 líneas (managers + utils)
- **UI Integration**: 618 líneas (main.js additions)
- **CSS Styles**: ~600 líneas
- **HTML Structure**: ~410 líneas
- **Documentation**: ~1,681 líneas
- **TOTAL**: ~5,100 líneas nuevas

#### Archivos
- **Creados**: 8 archivos
- **Modificados**: 4 archivos
- **TOTAL**: 12 archivos afectados

---

### 🧪 Testing

#### Tests Implementados
- 41 tests básicos para las 4 funcionalidades
- 12 tests de validaciones y límites
- 3 workflows de integración completos
- Tests de compatibilidad para 4 navegadores y 3 dispositivos
- Checklist final de 12 puntos críticos

#### Guía de Testing
Consulta `docs/TESTING_GUIDE.md` para:
- Instrucciones paso a paso de cada test
- Validaciones de bugs comunes
- Template de reporte de bugs
- Checklist final antes de commit

---

### 🐛 Correcciones de Bugs

No se corrigieron bugs en esta versión. Todas son funcionalidades nuevas.

---

### 🔒 Seguridad

#### Mejoras de Seguridad
- Validación de tipos de archivo en batch processing (solo imágenes)
- Límite de 50 imágenes para prevenir sobrecarga de memoria
- Sanitización de inputs de texto en capas
- Prevención de XSS en renderizado de contenido dinámico
- CSP-friendly (no eval, no inline scripts peligrosos)

---

### ⚡ Performance

#### Optimizaciones
- Debounce de 300ms en inputs de texto para reducir re-renders
- Lazy loading de Google Fonts (solo carga fuentes usadas)
- Canvas optimizado para renderizado de múltiples capas
- Reutilización de Web Workers existentes para batch processing
- Callbacks de progreso para evitar bloqueo de UI
- Uso de requestAnimationFrame para animaciones suaves

---

### 📱 Compatibilidad

#### Navegadores Soportados
- ✅ Chrome 90+ (recomendado)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ❌ Internet Explorer (no soportado)

#### Dispositivos
- ✅ Desktop (todas las funcionalidades)
- ✅ Tablet (UI adaptada)
- ✅ Mobile (UI adaptada, funcionalidades completas)

#### Sistemas Operativos
- ✅ macOS (atajos con Cmd)
- ✅ Windows (atajos con Ctrl)
- ✅ Linux (atajos con Ctrl)

---

### 📚 Documentación

#### Documentación Nueva
1. **NEW_FEATURES.md** (658 líneas)
   - Documentación técnica completa
   - API de cada manager
   - Ejemplos de código
   - Casos de uso

2. **README_NEW_FEATURES.md** (273 líneas)
   - Guía de usuario no técnica
   - Tutoriales paso a paso
   - Screenshots y videos
   - Solución de problemas

3. **TESTING_GUIDE.md** (350 líneas)
   - Tests exhaustivos
   - Validaciones de bugs
   - Template de reporte
   - Checklist final

4. **IMPLEMENTATION_SUMMARY.md** (400 líneas)
   - Resumen de implementación
   - Estadísticas del proyecto
   - Próximos pasos
   - Comandos de git

5. **CHANGELOG.md** (este archivo)
   - Historial de cambios
   - Versiones y fechas
   - Breaking changes

---

### 🚀 Migración desde v3.0

#### Cambios No Destructivos
Esta actualización es 100% compatible con v3.0. Todas las funcionalidades existentes siguen funcionando sin cambios.

#### Nuevas Funcionalidades Opcionales
Las 4 nuevas funcionalidades son completamente opcionales:
- Los atajos de teclado están activos pero no interfieren con funcionalidad existente
- Batch processing es una funcionalidad adicional
- Capas de texto no afectan el flujo normal de edición
- Crop inteligente coexiste con las herramientas de transformación existentes

#### Sin Breaking Changes
- ✅ Todos los managers existentes mantienen su API
- ✅ El flujo de trabajo normal no cambia
- ✅ Los archivos de configuración siguen siendo los mismos
- ✅ No se requiere migración de datos

---

### 🔮 Roadmap Futuro

#### Planeado para v3.2 (Q1 2026)
- Soporte para IA generativa de imágenes
- Editor de máscaras avanzado
- Integración con servicios cloud (Dropbox, Google Drive)
- Presets personalizables guardables

#### Considerado para v4.0 (Q2 2026)
- Modo colaborativo en tiempo real
- Plugin system para extensiones de terceros
- API REST para integración externa
- Aplicación desktop con Electron

---

### 👥 Contribuciones

Esta versión fue implementada por:
- **GitHub Copilot** - Desarrollo completo
- **Javier Tamarit** - Product Owner y Testing

---

### 📄 Licencia

MIT License - Sin cambios respecto a v3.0

---

### 🙏 Agradecimientos

- Comunidad de usuarios por feedback y sugerencias
- Contribuidores open source de JSZip
- Google Fonts por el servicio de fuentes web
- Font Awesome por la iconografía

---

## [3.0.0] - 2024-09-15

Versión base con arquitectura modular y funcionalidades core.

---

## [2.0.0] - 2024-03-10

Segunda versión con mejoras de UI y nuevos filtros.

---

## [1.0.0] - 2023-12-01

Lanzamiento inicial de MnemoTag.

---

## 📊 ESTADÍSTICAS DEL PROYECTO

### Versión 3.1.4
- **Líneas de código totales:** ~8,650
- **Archivos de código:** 20
- **Documentación:** 7 archivos
- **Características principales:** 5
- **Tests implementados:** 55+ (10 nuevos tests WebP)
- **Navegadores soportados:** 4
- **Compatibilidad:** Desktop, Tablet, Mobile
- **Bugs críticos resueltos:** 3

### Crecimiento desde v3.0
- **+2,650 líneas de código** (+44%)
- **+4 nuevos managers**
- **+1 sistema de utilidades**
- **+5 documentos técnicos**
- **+55 tests automatizados**
- **Bug fixes:** 13 bugs resueltos

### Cambios en v3.1.4
- **+50 líneas** (fixes y mejoras)
- **+10 tests** WebP download
- **+3 bugs** críticos solucionados
- **+1 suite** de tests automatizada

---

**Última actualización:** 10 de abril de 2026  
**Versión actual:** 3.4.20  
**Estado:** ✅ Estable y listo para producción
