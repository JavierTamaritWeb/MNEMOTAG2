# 📝 CHANGELOG - MNEMOTAG v3.3

Todos los cambios notables en este proyecto serán documentados en este archivo.

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

**Última actualización:** 9 de abril de 2026  
**Versión actual:** 3.3.9  
**Estado:** ✅ Estable y listo para producción
