# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos.

![Version](https://img.shields.io/badge/version-3.3.17-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)
[![Tests](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml)

---

## ⭐ NOVEDADES v3.3.17

> **Infrastructure release — Parser ISOBMFF defensivo para AVIF EXIF.** Esta versión añade la infraestructura de parseo de cajas ISOBMFF (el contenedor que usa AVIF, HEIC y MP4) y el cableado completo de las funciones `embedExifInAvif*` en el flujo de descarga, con degradación elegante total. **La inyección efectiva de EXIF en AVIF no está activada todavía** — requiere una reescritura completa del meta box que se deja para una versión futura. La buena noticia: ningún AVIF se corrompe nunca, y la infraestructura está lista.

### 🧱 Parser ISOBMFF (Box parser)

- **`_parseIsobmffBoxes(bytes)`** — recorre los boxes top-level del archivo. Maneja correctamente los 3 formatos de cabecera de ISOBMFF:
  - **Cabecera compacta** (8 bytes): `[size:4][type:4]` con `size` ≥ 8.
  - **Large size** (16 bytes): `[size=1:4][type:4][largesize:8]` para boxes mayores que 4 GB.
  - **Size 0** (8 bytes): el box ocupa hasta el final del archivo.
- Devuelve un array con `{type, start, end, headerSize, bodyStart}` para cada box, suficiente para que las funciones de inyección sepan dónde empieza y acaba cada zona.
- **`_isAvifFile(bytes)`** — verifica que el archivo es realmente AVIF leyendo el primer box `ftyp` y comprobando el major brand (`avif`/`avis`) o cualquiera de los compatible brands (`avif`, `avis`, `mif1`, `miaf`).

### 🛡️ Inyección defensiva (degradación elegante)

- **`MetadataManager.embedExifInAvifBlob(blob)`** y **`embedExifInAvifDataUrl(dataUrl)`** — públicas, async, integradas en los 4 puntos del flujo de descarga existente (igual que JPEG/PNG/WebP).
- **NUNCA producen AVIF corruptos**. En esta primera versión:
  1. Si el blob no es AVIF → devuelven el blob original con warning.
  2. Si el parseo ISOBMFF lanza → devuelven el blob original con warning.
  3. Si el archivo no tiene caja `meta` → devuelven el blob original con warning.
  4. Si el archivo tiene caja `meta` válida → **devuelven el blob original sin tocar** + warning explicando que la inyección completa de Exif requiere reescritura del meta box (no implementada en v3.3.17).
- Esto cumple el contrato público: la función existe, está cableada, y nunca rompe nada.
- Cualquier futura versión puede sustituir el "return blob" del paso 4 por la lógica real de añadir un item `Exif` a `iinf` + referencia `cdsc` en `iref` + entrada en `iloc` + datos en `mdat` + actualización de cabeceras.

### 🧪 8 aserciones binarias nuevas

- `tests/binary-validation.js` ahora sintetiza un AVIF mínimo a mano (ftyp + meta vacía + mdat vacía) y valida que `_parseIsobmffBoxes` devuelve los 3 boxes correctos con sus posiciones, que `_isAvifFile` lo detecta como AVIF, y que rechaza correctamente bytes random y la signature PNG.

### Verificación

- `node tests/run-in-node.js` → **137/137 OK** (132 anteriores + 5 nuevos para v3.3.17)
- `node tests/binary-validation.js` → **44/44 OK** (36 anteriores + 8 nuevos del parser ISOBMFF)

Cero regresiones. Los formatos JPEG, PNG y WebP siguen escribiendo EXIF al 100% como antes. AVIF queda como infraestructura lista para una versión futura.

---

## ⭐ NOVEDADES v3.3.16

> **Feature release — PWA real con Service Worker.** La app ahora funciona offline tras la primera visita, se puede instalar como aplicación standalone (escritorio o móvil) y carga instantáneamente en visitas posteriores.

### 📲 Service Worker con cache híbrido

- **Nuevo archivo `service-worker.js`** en la raíz del proyecto con dos estrategias de cache configurables por tipo de recurso:
  - **Cache-first** para assets propios (`index.html`, `css/styles.css`, todos los `js/utils/*` y `js/managers/*`, `js/main.js`, manifest, favicon). Una vez descargados, se sirven desde cache y la red solo se usa como fallback. Esto hace que la app cargue prácticamente al instante en visitas repetidas.
  - **Network-first** para CDNs externas conocidas (jsdelivr, cdnjs, cdn.tailwindcss.com, fonts.google). Se intenta primero la red para captar actualizaciones de Tailwind, FontAwesome, JSZip, piexifjs, heic2any, etc., y si falla se sirve la versión cacheada.
- **Versión del cache codificada** como `mnemotag-v3.3.16-app` y `mnemotag-v3.3.16-cdn`. Cuando se publique una versión nueva, el listener `activate` borra automáticamente cualquier cache que no coincida con el `CACHE_VERSION` actual.
- **Precache de assets críticos en `install`**: lista explícita de los 22 archivos mínimos necesarios para que la app arranque offline. La descarga es tolerante a errores: si algún recurso falla, se loggea un warning y se continúa con el resto.
- **`skipWaiting()` + `clients.claim()`**: el SW nuevo toma control inmediatamente de las pestañas abiertas tras la activación, sin requerir un refresh manual.
- **Ignora peticiones no-GET y esquemas distintos de http(s)**: POST/PUT/DELETE pasan directos al network sin tocar el cache. URLs `data:`, `blob:`, `chrome-extension:`, etc., también se respetan.

### 📱 Meta tags PWA para iOS

- Añadidos `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` y `mobile-web-app-capable` en `<head>` para que iOS Safari permita "Añadir a pantalla de inicio" como app standalone con icono y splash propio.
- `site.webmanifest` actualizado: `start_url` y `scope` ahora son relativos (`../../`) para que la app instalada funcione tanto en `localhost`, en `file://`, como bajo GitHub Pages en `/MNEMOTAG2/`.

### 🚀 Registro del Service Worker

- El registro se hace desde `js/main.js` en el evento `window.load` (no en `DOMContentLoaded`) para no competir con la carga inicial de assets críticos.
- Si el navegador no soporta Service Workers, el código se omite silenciosamente. La app sigue funcionando exactamente igual.
- Errores de registro se loggean con `console.warn` (sin romper nada).

### Verificación

- `node tests/run-in-node.js` → **132/132 OK** (127 anteriores + 5 nuevos para v3.3.16)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. La app sigue funcionando exactamente igual sin Service Worker (degradación elegante total).

---

## ⭐ NOVEDADES v3.3.15

> **Feature release — Soporte HEIC/HEIF (formatos del iPhone).** Ahora puedes arrastrar (o pegar, o seleccionar) directamente las fotos `.heic` que tu iPhone genera por defecto: la app las convierte a JPEG en cliente y todo el flujo (filtros, marcas de agua, EXIF, descarga) sigue funcionando sin tocar nada más.

### 📱 Conversión HEIC/HEIF transparente

- **Detección automática** en `handleFile`: si el archivo tiene MIME `image/heic` o `image/heif`, o el nombre acaba en `.heic` o `.heif`, se dispara la conversión ANTES de validar.
- **Conversión vía librería [heic2any](https://github.com/alexcorvi/heic2any) cargada desde CDN** (no se añade dependencia npm — sigue siendo un proyecto static-only). La librería usa la API `Web Workers` internamente, así que la conversión no bloquea el hilo principal.
- **Calidad de salida 0.92** para mantener fidelidad sin inflar el tamaño. El archivo resultante se envuelve en un `File` con la extensión cambiada a `.jpg` y se pasa al flujo de carga normal.
- **Toasts informativos** durante la conversión: `🔄 Convirtiendo HEIC/HEIF a JPEG...` y al éxito `✅ HEIC convertido a JPEG correctamente`.
- **Degradación elegante** si la librería no se ha cargado (offline, bloqueo CDN, etc.): mensaje claro al usuario en lugar de un error genérico.
- **`SecurityManager.validateImageFile`** añade `image/heic` e `image/heif` a la lista de tipos permitidos SOLO si `typeof heic2any !== 'undefined'`, así nunca se permite un HEIC sin la librería que sabe leerlo.
- **Atributo `accept` del input de archivo** actualizado a `.jpg,.jpeg,.png,.webp,.avif,.heic,.heif` para que el picker nativo del sistema operativo muestre los HEIC seleccionables.
- **Texto informativo** del área de drop actualizado: *"Formatos: JPG, JPEG, PNG, WEBP, AVIF, HEIC, HEIF · Pega con Cmd+V / Ctrl+V"*.

### Verificación

- `node tests/run-in-node.js` → **127/127 OK** (123 anteriores + 4 nuevos para v3.3.15)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones en los formatos existentes. JPEG, PNG, WebP y AVIF siguen funcionando exactamente igual.

---

## ⭐ NOVEDADES v3.3.14

> **Feature release — Histórico visual con thumbnails.** Ya no necesitas deshacer/rehacer paso a paso: pulsa "Historial" y salta a cualquier estado anterior con un click sobre su miniatura.

### 📜 Panel de historial visual

- **Botón "Historial"** (icono `history`) junto a Deshacer y Rehacer en la sección del canvas. Click → abre/cierra un panel desplegable debajo del canvas.
- **Mini-cards** con los snapshots del historial: cada card muestra la imagen completa con `object-fit: contain` (sin recortar — verás un reflejo real del estado), el número de snapshot y el timestamp HH:MM:SS.
- **Click sobre cualquier thumbnail** restaura ese estado del historial directamente, sin tener que pulsar Deshacer N veces. Funciona con cualquier estado, hacia atrás o hacia adelante.
- **El estado actual se resalta** con un borde azul de 2px y un halo difuso, así sabes en qué punto estás.
- **El panel se re-renderiza automáticamente** cada vez que el historial cambia (al aplicar un filtro, curvas, auto-balance, recorte, etc.). No tienes que cerrarlo y abrirlo. La sincronización se hace mediante un hook ligero (`window.renderHistoryPanel`) que `historyManager` invoca al actualizar los botones de Deshacer/Rehacer.
- **Si el panel está cerrado**, el render es no-op (no consume CPU al modificar el historial mientras no lo estés viendo).
- **Estado vacío amistoso**: si aún no has hecho ningún cambio, el panel muestra "Aún no hay estados en el historial. Aplica un filtro o cambio para empezar a guardarlo".

### Verificación

- `node tests/run-in-node.js` → **123/123 OK** (117 anteriores + 6 nuevos para v3.3.14)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. El sistema de historial existente (`historyManager.states`) se reusa entero — esta versión solo añade `getStatesSummary()` y `jumpToState(index)` como nuevos métodos públicos.

---

## ⭐ NOVEDADES v3.3.13

> **Feature release — Curvas y niveles estilo Photoshop.** Editor interactivo de curvas tonales por canal con LUT pixel-level.

### 📈 Editor de curvas y niveles

- Botón **"Curvas y niveles"** en la sección de filtros, justo debajo de "Auto-mejorar imagen". Abre un modal con un editor interactivo 280×280.
- **4 canales editables** mediante tabs en la cabecera del modal: **RGB combinado**, **Rojo**, **Verde** y **Azul**. Cada canal mantiene su propia curva (su propio array de puntos de control) y se preserva al cambiar de tab.
- **Interacción tipo Photoshop**:
  - **Click** sobre la cuadrícula → añade un punto de control nuevo en esa posición.
  - **Click + arrastre** sobre un punto existente → mueve el punto. Los puntos interiores no pueden cruzar a sus vecinos en el eje X (se mantienen ordenados).
  - **Doble-click** sobre un punto → lo elimina (excepto los extremos en x=0 y x=255, que son permanentes).
- **Curva renderizada en tiempo real** con interpolación lineal segmentada entre los puntos de control, cuadrícula 4×4 sutil de fondo y línea diagonal punteada como referencia (curva identidad).
- Cada canal se pinta con su color característico (rojo, verde, azul, gris oscuro para RGB combinado).
- **Aplicación con composición Photoshop-style**: al pulsar "Aplicar a la imagen", se construyen 4 LUTs `Uint8ClampedArray(256)` (una por canal) y se aplican en cadena: primero la LUT individual del canal R/G/B y, sobre el resultado, la LUT del canal RGB combinado. Esto reproduce el comportamiento del editor de curvas de Photoshop.
- **Píxeles totalmente transparentes preservados** sin tocar.
- **El cambio se persiste en `historyManager.saveState()`**, por lo que el botón Deshacer revierte la curva.
- Botón "Resetear curva" reinicia el canal activo a la línea identidad sin cerrar el modal.

### Verificación

- `node tests/run-in-node.js` → **117/117 OK** (111 anteriores + 6 nuevos para v3.3.13)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. El editor de curvas opera sobre `ctx.getImageData()` directo, sin tocar el sistema de filtros CSS existente.

---

## ⭐ NOVEDADES v3.3.12

> **Feature release — Análisis visual.** Tres herramientas profesionales para entender y mejorar la imagen sin salir de la app: histograma RGB, paleta de colores dominantes y auto-mejora con un click.

### 📊 Histograma RGB + luminosidad

- Botón **chart-bar** en la barra de zoom del canvas. Abre un modal con un canvas de 512×220 que pinta los 4 histogramas superpuestos (R en rojo, G en verde, B en azul, luminosidad en gris) con opacidad 0.55 para que se vean las mezclas.
- La luminosidad se calcula con los coeficientes ITU-R BT.601 (0.299·R + 0.587·G + 0.114·B), no es una media ingenua.
- Píxeles con `alpha === 0` se ignoran en el cómputo (las zonas transparentes no contaminan el histograma de la imagen visible).
- Cuadrícula sutil cada cuarto y leyenda con swatches debajo del canvas. Compatible con tema oscuro.

### 🎨 Paleta de colores dominantes

- Botón **palette** en la misma barra. Extrae los 12 colores más frecuentes de la imagen mediante cuantización por buckets 8×8×8 (3 bits por canal, ~512 colores cuantizados totales) y los muestra como swatches en un grid responsive.
- Cada swatch muestra el color y su código hex en mayúsculas. **Click para copiar el hex al portapapeles** (`navigator.clipboard.writeText`) con toast de confirmación.
- Sampleo cada 4 píxeles para no congelar el navegador en imágenes grandes — el resultado visual es indistinguible.

### ✨ Auto-mejorar imagen (auto-balance)

- Botón **Auto-mejorar imagen** (icono `magic`) en la sección de filtros, encima de "Resetear filtros".
- Calcula los **percentiles 1% y 99% de la luminosidad** sobre todos los píxeles visibles, construye una LUT (Look-Up Table) que mapea linealmente `[lo, hi] → [0, 255]` y la aplica a los 3 canales por separado para preservar la dominante de color.
- Si la imagen ya tiene buen rango dinámico (`hi <= lo`), muestra un info-toast en lugar de aplicar la transformación.
- **El cambio se guarda en el historial** (`historyManager.saveState()`), por lo que el botón Deshacer revierte el auto-balance.
- Toast de éxito reporta los valores `lo` y `hi` calculados para que sepas qué rango se ha estirado.

### Verificación

- `node tests/run-in-node.js` → **111/111 OK** (105 anteriores + 6 nuevos para v3.3.12)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. Las tres herramientas operan sobre `ctx.getImageData()` directo, sin tocar el flujo de filtros existente.

---

## ⭐ NOVEDADES v3.3.11

> **Feature release — Quick wins UX.** Pegar imágenes desde el portapapeles con `Cmd+V` / `Ctrl+V` y exportar la imagen a varios tamaños en un solo ZIP.

### 📋 Pegar desde el portapapeles

- **Listener global de `paste`** en `document`: si copias una imagen en cualquier sitio (captura de pantalla, navegador, otro programa) y vuelves a la app, basta con `Cmd+V` / `Ctrl+V` y la imagen se carga directamente en el editor. El listener ignora pastes en `<input>`, `<textarea>` y campos editables para no robar el comportamiento normal del navegador.
- **Botón visible "Pegar imagen"** junto a "Seleccionar archivo" en el área de drop. Usa `navigator.clipboard.read()` (la API moderna que pide permiso explícito) para leer el portapapeles bajo demanda. Toast de confirmación y degradación elegante si el navegador no soporta la API.
- El texto de ayuda del área de drop ahora indica explícitamente: *"Formatos: JPG, JPEG, PNG, WEBP, AVIF · Pega con Cmd+V / Ctrl+V"*.

### 📦 Exportar varios tamaños a la vez (ZIP)

- Nueva sección **"Exportar varios tamaños"** en la configuración de salida (sección 5). Cuatro checkboxes (256, 512, 1024, 2048 px) — por defecto vienen marcados 1024 y 512.
- Botón **"Descargar varios tamaños (ZIP)"** que genera un canvas temporal redimensionado para cada ancho marcado (manteniendo proporción), aplica el formato/calidad/aplanado/EXIF habituales a cada salida y empaqueta todo en un único `*-multisize.zip` usando JSZip (que ya estaba cargado para batch).
- Cada archivo del ZIP se nombra `<basename>-<ancho>px.<extensión>` para que sean fáciles de identificar.
- Cada salida lleva los **metadatos EXIF embebidos correctamente** según el formato (JPEG via piexifjs, PNG via chunks `eXIf` con CRC32 propio, WebP via manipulación RIFF/VP8X). Los tamaños mayores que el original se truncan a la anchura real para no upscalear.

### Verificación

- `node tests/run-in-node.js` → **105/105 OK** (100 originales + 5 nuevos de regresión para v3.3.11)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. Todo el flujo de descarga existente se reusa sin tocar.

---

## ⭐ NOVEDADES v3.3.10

> **Patch release.** Limpieza completa de `console.log` ruidosos del runtime. La consola del navegador ya no se llena de mensajes informativos en cada acción del usuario.

### 🧹 Consola limpia

- **Eliminados 168 `console.log`** de los 13 archivos de `js/main.js`, `js/managers/` y `js/utils/`. Ya no aparecen mensajes de inicialización (`✅ Worker pool inicializado`, `🎨 Sistema de filtros optimizado inicializado`, etc.), de cambios de estado (`Format changed to: jpeg`, `Quality changed to: 80%`), ni de operaciones internas (`📐 Canvas configurado`, `📥 Descargando con nombre`, etc.).
- **49 bloques `if (this.config.enableLogging) { }`** que quedaban vacíos tras eliminar los logs también se han eliminado, junto con un caso `if (X) { } else { }` con ambas ramas vacías en `filter-manager.js`.
- **Total: -292 líneas** netas eliminadas del código JavaScript.

### Lo que NO se ha tocado (deliberadamente)

- **`console.error`**: legítimo para reportar errores reales que deben verse en producción (errores de carga, fallos del worker, validaciones críticas, etc.).
- **`console.warn`**: legítimo para advertencias de degradación elegante (formato no soportado, fallback a JPEG, fuente Google Fonts no cargada, etc.).
- **`console.log` dentro de `tests/`**: los runners de tests son intencionalmente verbose para reportar progreso. Esos no se tocan.
- **Comentarios que mencionan `console.log`** (un caso en `smart-debounce.js:256`): no es código, es documentación histórica de por qué se eliminó `pauseAll/resumeAll`.

### Verificación

- `node tests/run-in-node.js` → 100/100 OK (sin cambios)
- `node tests/binary-validation.js` → 36/36 OK (sin cambios)

Cero regresiones. La app se comporta exactamente igual; solo deja de imprimir basura en la consola del navegador.

---

## ⭐ NOVEDADES v3.3.9

> **Patch release.** CI/CD + deploy automático a GitHub Pages. Sin tocar el código de la app.

### 🚀 CI/CD y deploy automático

Dos workflows nuevos en `.github/workflows/`, sin npm, sin secrets, sin tocar la naturaleza static-only del proyecto:

- **`test.yml`** — Test gate. En cada `push` y `pull_request` a `main`, GitHub Actions ejecuta los **dos runners Node** del proyecto (`tests/run-in-node.js` con 100 aserciones y `tests/binary-validation.js` con 36 aserciones binarias). Si alguno falla, el build queda rojo. Tiempo típico: ~30-60 s.
- **`deploy.yml`** — Deploy continuo. Tras cada push a `main`, re-ejecuta los tests como defensa adicional y, si pasan, **despliega la app a GitHub Pages**. URL pública: `https://javiertamaritweb.github.io/MNEMOTAG2/`. HTTPS, CDN global, gratis.
- **`README.md`** — Documentación corta de los dos workflows + las acciones manuales necesarias en la UI de GitHub la primera vez.

**Lo que esto NO toca**:
- El código de la app es **idéntico funcionalmente** a v3.3.8.
- **No se introduce npm**. El `node` que usan los runners es solo para ejecutar los tests existentes, que son JavaScript puro sin dependencias.
- **Sin secrets**. Todo lo necesario está en el repo público.
- **Sin build step**. El proyecto es static, se despliega directamente.

### ⚠️ Acción manual necesaria la primera vez

La primera ejecución de `deploy.yml` **fallará** porque GitHub Pages no está activado. Es esperado. Para activarlo:

1. `Repository → Settings → Pages → Source = "GitHub Actions"`.
2. Volver a `Actions → Deploy to GitHub Pages → último run` y `Re-run all jobs`.
3. Esperar ~2-3 minutos. La URL pública aparecerá en el resumen del workflow.

Documentado paso a paso en [`.github/workflows/README.md`](.github/workflows/README.md).

---

## ⭐ NOVEDADES v3.3.8

> **Patch release.** Nuevo runner de validación binaria a bajo nivel para PNG y WebP.

### 🧪 Validación binaria sin browser

`tests/binary-validation.js` es un script Node nuevo (sin dependencias) que:

- Carga las funciones reales de manipulación binaria de `metadata-manager.js` en un VM context con polyfills mínimos.
- Sintetiza un **PNG mínimo válido** (1×1 píxel rojo) byte por byte.
- Sintetiza **tres WebP fake**: uno VP8 lossy, uno VP8L lossless y uno VP8X extended.
- Pasa esos archivos por las funciones `_buildPngExifChunk`, `_insertExifChunkInPng`, `_parseWebpDimensions`, `_buildVp8xChunk`, `_buildRiffExifChunk`, `_convertSimpleWebpToVp8xWithExif` y **verifica byte por byte** que el output tiene la estructura correcta.
- Incluye una verificación crítica: el **CRC32** del chunk `eXIf` que produce `_buildPngExifChunk` se compara con una computación **independiente** sobre los mismos bytes. Si coincidieran por casualidad sería sospechoso; si coinciden tras un cálculo determinístico, es prueba sólida de corrección.

**36 aserciones, ~100 ms.** Comando: `node tests/binary-validation.js`.

**Lo que demuestra**: los bytes producidos por el código de PNG/WebP son estructuralmente correctos según los specs (signature PNG, chunks `eXIf`/`IDAT`/`IEND` en orden, CRC32 válido, RIFF size recalculado, VP8X flags, etc.).

**Lo que NO demuestra**: que un navegador real decodifique los archivos resultantes ni que un visor EXIF de terceros lea los tags. Eso sigue siendo validación browser.

Ahora hay **tres formas de verificar** el código de la app sin abrir el navegador:

| Runner | Qué verifica | Tiempo | Comando |
|---|---|---|---|
| `tests/index.html` (browser) | Todo, autoritativo | Manual | Live Server |
| `tests/run-in-node.js` | API de managers + regresiones grep | ~100 ms | `node tests/run-in-node.js` |
| `tests/binary-validation.js` | Manipulación binaria PNG/WebP | ~100 ms | `node tests/binary-validation.js` |

---

## ⭐ NOVEDADES v3.3.7

> **Patch release.** EXIF real para WebP (sin librerías externas, sin npm).

### 🏷️ Metadatos reales también en WebP

Con esta versión, **JPEG, PNG y WebP** escriben metadatos EXIF reales en el archivo descargado. Los campos del formulario (título, autor, copyright, fecha, GPS, software) se incrustan al exportar.

**Cómo se hace por dentro** (manipulación binaria a mano del contenedor RIFF):
- WebP usa el formato RIFF con chunks. Para tener metadatos EXIF necesita el header `VP8X` (extended). Si el WebP es "simple" (solo `VP8` lossy o `VP8L` lossless), MnemoTag lo **convierte a VP8X** sobre la marcha:
  1. Parsea el bitstream para extraer las dimensiones reales (`_parseWebpDimensions` maneja los 3 tipos: VP8, VP8L y VP8X).
  2. Construye un chunk `VP8X` (18 bytes: FourCC + size + flags + dimensiones).
  3. Construye un chunk `EXIF` con el bloque TIFF que reutiliza `piexif.dump()`.
  4. Re-empaqueta: `RIFF + size + WEBP + VP8X + bitstream original + EXIF`, recalculando el size del RIFF principal.
- Si el WebP ya tenía formato VP8X, solo se añade el chunk `EXIF` al final y se setea el bit 3 (EXIF flag) del header.
- Las funciones son **ultra-defensivas**: ante cualquier error de parsing, validación post-generación fallida, o caso edge, devuelven el blob original sin tocar. **Nunca producen un WebP corrupto.**

⚠️ **Atención — validación browser indispensable**: el runner de tests Node verifica que el código está donde tiene que estar (~6 tests fetch+grep), pero **NO puede verificar visualmente** que los WebP generados sean legibles y muestren los EXIF correctamente. Antes de confiar en WebP en producción, **abre un WebP descargado por la app con un visor EXIF** (Apple Preview Info, exiftool, exif.tools online) y comprueba que los tags aparecen y que el visor lo abre sin error.

### Estado de soporte EXIF por formato

| Formato | EXIF | Cómo |
|---|---|---|
| **JPEG** | ✅ Real desde v3.2.15 | piexifjs (CDN) |
| **PNG** | ✅ Real desde v3.3.6 | Chunks `eXIf` (manipulación binaria + crc32) |
| **WebP** | ✅ Real desde v3.3.7 | RIFF + conversión a VP8X (manipulación binaria) |
| **AVIF** | ❌ Pendiente | Necesitaría manipulación de ISOBMFF boxes |

---

## ⭐ NOVEDADES v3.3.6

> **Patch release.** EXIF real para PNG (sin librerías externas, sin npm).

### 🏷️ Metadatos reales también en PNG

Hasta ahora MnemoTag solo escribía EXIF al exportar como JPEG (vía piexifjs). Desde **v3.3.6**, los campos del formulario (título, autor, copyright, fecha, GPS, software) se incrustan **realmente** también en los PNG descargados, usando el chunk estándar `eXIf` definido en PNG spec 1.5.

**Cómo se hace por dentro** (sin librerías externas, sin npm):
- `helpers.js` añade una utilidad `crc32` con tabla de lookup precomputada (CRC-32/ISO-HDLC, polinomio `0xEDB88320`).
- `MetadataManager` añade los métodos `embedExifInPngBlob` y `embedExifInPngDataUrl`. La estrategia es:
  1. Generar el bloque TIFF reutilizando `piexif.dump(exifObj)` (ya cargado para JPEG).
  2. Strippear la cabecera APP1 + `Exif\0\0` que añade piexif para JPEG, dejando el TIFF crudo apto para un chunk PNG.
  3. Construir un chunk `eXIf` válido: `[length:4][type='eXIf'][data][crc32]`.
  4. Parsear los chunks del PNG existente, reemplazar cualquier `eXIf` previo, e insertar el nuevo justo antes del primer `IDAT` (convención del spec).
  5. Re-empaquetar los bytes y devolver un Blob nuevo.
- Si algo falla en cualquier punto (PNG corrupto, piexif ausente, error al parsear), las funciones devuelven el blob original sin tocar — degradación elegante. **Nunca producen un PNG corrupto.**
- 4 puntos de integración en `main.js` (los mismos que JPEG): `downloadImage` y `downloadImageWithProgress`, cada uno con su rama `showSaveFilePicker` y su rama fallback `<a download>`.

**Cómo verificarlo**: descarga un PNG con campos rellenados y ábrelo con un visor EXIF (Apple Preview Info, exiftool, exif.tools online). Deberías ver `ImageDescription`, `Artist`, `Copyright`, `DateTime` y los tags GPS.

**Lo que sigue sin escribir metadatos**: WebP y AVIF. WebP necesitaría manipulación de chunks RIFF + conversión a VP8X (más complejo que PNG); AVIF necesitaría ISOBMFF boxes (mucho más complejo). En el roadmap.

---

## ⭐ NOVEDADES v3.3.5

> **Patch release.** 5 mejoras de UX para el editor de marcas de agua y la conversión de formato.

### 🎯 Marcas de agua más coherentes y agradables

- **Auto-escala del texto según tamaño de imagen**: nuevo checkbox "Auto-escalar al tamaño de la imagen" en la sección del watermark de texto. Cuando está activo, el `size` del slider se multiplica por `canvas.width / 1000`. Resultado: un watermark con `size=24` se ve consistentemente igual de grande en una imagen 800×600 y en una 4000×3000. Antes era inconsistente.
- **Hover state del borde guía**: cuando arrastras el ratón sobre un watermark en modo "posición personalizada", el borde guía punteado (azul para texto, naranja para imagen) se intensifica (color más saturado, grosor +1px). Antes el borde era estático y no había feedback visual de que estabas sobre un elemento arrastrable.

### 🖼️ Conversión de formato más informativa y configurable

- **Color de aplanado JPEG configurable**: nuevo input de color en la sección "5. Configuración de salida" → "Formato de salida". Cuando exportas un PNG con transparencia a JPEG, el color de fondo del aplanado ya no es solo blanco; puedes elegir el que quieras (negro, color de marca, etc.). Default sigue siendo blanco.
- **Toast informativo al aplanar**: cuando descargas un PNG transparente como JPEG, ahora aparece un toast que explica explícitamente "Aplanando transparencia contra <color> para exportar a JPEG". Antes la decisión era silenciosa.

### 💾 Formulario que se acuerda de ti

- **Auto-guardado del formulario en localStorage**: hasta ahora solo se persistía el campo "Autor" entre sesiones. Si refrescabas accidentalmente, perdías Título, Descripción, Keywords y Copyright. Desde 3.3.5, **todos los campos textuales** se guardan automáticamente con cada cambio (debounced 500 ms) y se restauran al cargar la app. **NO se persisten** GPS (privacidad), licencia (intencionalidad) ni fecha de creación (debe coincidir con la imagen real).

---

## ⭐ NOVEDADES v3.3.4

> **Patch release.** Bugs latentes y limpieza: límite de memoria en el historial undo/redo, timeout en la carga de Google Fonts, eliminación del test prematuro de soporte de formato, borrado de código muerto en SmartDebounce.

### 🛡️ Robustez

- **`historyManager` con límite real de memoria**: hasta ahora solo limitaba por número de estados (máximo 20). En imágenes 4K cada snapshot del canvas puede ocupar 10–30 MB → con 20 estados llegabas a 200–600 MB de memoria del navegador, posible OOM en sesiones largas. Ahora hay un tope de **100 MB cumulativos**: cuando un nuevo snapshot no entra, se liberan los más viejos hasta que entre.
- **`text-layer-manager.loadFont` con timeout de 5 s**: si Google Fonts está caído o lento, la UI ya no se cuelga indefinidamente esperando `document.fonts.load(...)`. Tras 5 segundos lanza un error que se captura en el catch externo y la fuente se omite (sin romper la capa de texto).
- **`canvasToBlob` sin test prematuro**: el bloque que testaba el formato con un canvas 1×1 vacío y `toDataURL` podía dar falsos negativos en algunos navegadores con WebP/AVIF y forzar JPEG cuando ese formato sí estaba soportado. Eliminado: ahora se confía en que `canvas.toBlob` reportará el error si el formato no está soportado, y el catch externo cae a `canvasToBlob_fallback`.
- **`smart-debounce` sin código muerto**: borradas las funciones `pauseAll` y `resumeAll` que nadie llamaba. Además `resumeAll` era un stub que ni siquiera ejecutaba los callbacks pausados.

---

## ⭐ NOVEDADES v3.3.3

> **Patch release.** Tanda de seguridad: fix XSS latente en los toasts de UIManager y eliminación de código muerto duplicado.

### 🛡️ Seguridad reforzada

- **Fix XSS latente en `UIManager.showError`/`showWarning`/`showSuccess`**: las tres funciones interpolaban `${config.action.handler}` dentro de `onclick="..."` en el HTML del toast. No estaba activo (ninguna llamada actual del proyecto pasaba un `action.handler`), pero el código vulnerable era exactamente el mismo patrón que el del batch que arreglamos en 3.2.12. Ahora el botón de acción se construye con `createElement` + `addEventListener` + `textContent`. Si alguien pasa un `handler` como string (estilo viejo), se ignora con un `console.warn` — nunca se ejecuta.
- **Borrada `sanitizeFilename`** (función global de `security-manager.js`): era código muerto duplicado, peor que `sanitizeFileBaseName` de `helpers.js` que sí preserva tildes y se usa en producción.
- **Borradas `exportToJSON` e `importFromJSON`** de `metadata-manager.js`: código muerto. `importFromJSON` además asignaba elementos del DOM dinámicamente sin validación, un patrón frágil.

---

## ⭐ NOVEDADES v3.3.2

> **Patch release.** Fix de la conversión de formato: PNG con transparencia → JPEG ahora respeta la elección del usuario y aplana contra blanco.

### 🐛 Conversión de formato JPEG arreglada

- **Antes**: cargabas un PNG con transparencia, elegías JPEG en el desplegable de salida, descargabas… y el archivo salía como **PNG**, sin avisar. La sustitución era completamente silenciosa (solo un `console.info` invisible).
- **Ahora**: el código respeta tu elección de formato. Si pides JPEG sobre un PNG con transparencia, **te da JPEG**, aplanando las áreas transparentes contra blanco (igual que Photoshop, GIMP, Squoosh).
- **Por dentro**: nuevo helper `flattenCanvasForJpeg(canvas)` en `js/utils/helpers.js` que devuelve un canvas nuevo con fondo blanco más el contenido original encima. Se invoca desde los 4 puntos del flujo de descarga (`downloadImage` y `downloadImageWithProgress`, cada uno con la rama `showSaveFilePicker` y la rama fallback `<a download>`) **solo cuando el formato elegido es JPEG**. PNG/WebP/AVIF siguen preservando alpha sin tocar.

---

## ⭐ NOVEDADES v3.3.1

> **Patch release.** Mejoras de fluidez en la previsualización de marcas de agua durante el arrastre.

### 🎯 Previsualización del watermark más fluida

- **RAF coalescing real durante el drag**: cada `mousemove` ya no encola un `requestAnimationFrame` independiente. Ahora hay un solo render en vuelo a la vez. Antes, los renders se acumulaban en imágenes grandes y se procesaban tras soltar el ratón → lag visible. Ahora el movimiento es notablemente más fluido.
- **Filtros y `saveState` se pausan durante el drag**: las operaciones costosas (`applyCanvasFilters`, `canvas.toDataURL` para historial undo/redo) se saltan mientras el usuario está arrastrando un watermark. Al soltar, se ejecuta un render completo final con todo. Esto recorta drásticamente el coste por frame en imágenes ≥2400px.
- **Bordes guía DOM sincronizados con cambios de input**: el overlay del borde guía ahora se actualiza cuando cambias `size`, `opacity`, etc. (no solo durante el drag). Antes el borde quedaba desfasado del watermark dibujado.
- **Manejo de errores al cargar imagen del watermark**: el `FileReader` y la decodificación de `Image` ya tienen `onerror` con toast informativo. Antes una imagen corrupta fallaba en silencio.
- **Logs de consola limpios**: eliminados los `console.log` ruidosos que se disparaban en cada frame durante el drag.

### Tras el bump

Esta versión es la línea base para los próximos fixes (v3.3.x). Las características anteriores siguen documentadas en el bloque histórico de abajo (CARACTERÍSTICAS ANTERIORES).

---

## ⭐ NOVEDADES v3.3.0 (consolidación previa)

> **Release minor estable.** v3.3.0 consolidaba los cambios significativos acumulados en la línea 3.2.12–3.2.17: EXIF real en JPEG, suite de tests automatizados, fixes de seguridad críticos (XSS, worker pool), runner Node, limpieza HTML Tier 1 y `'use strict';` en todos los managers.

### ✅ EXIF JPEG: ahora funciona de verdad

Hasta esta versión, MnemoTag mostraba un formulario de "metadatos EXIF" y un toast de éxito tras la descarga, pero **el archivo descargado no contenía ningún metadato**. `MetadataManager.applyMetadataToImage()` era un stub que solo guardaba en `localStorage`.

A partir de **v3.2.15**, los campos del formulario se incrustan **realmente** en el archivo descargado cuando el formato es **JPEG**, gracias a la integración con [`piexifjs@1.0.6`](https://github.com/hMatoba/piexifjs) (cargada desde jsdelivr CDN, sin npm):

| Campo del formulario | Tag EXIF |
|---|---|
| Título | `ImageDescription` |
| Autor | `Artist` |
| Copyright (incluye licencia) | `Copyright` |
| Fecha de creación | `DateTimeOriginal` + `DateTime` |
| Latitud / Longitud / Altitud | `GPS IFD` (con refs N/S/E/W y rationals DMS) |
| Software | `Software` |

**Cómo verificarlo:** descarga una imagen JPEG con campos rellenados y ábrela con cualquier visor EXIF — Apple Preview Info (⌘+I → "Más info"), `exiftool`, o servicios online como `exif.tools`.

**Lo que NO hace** (intencionalmente):
- **PNG, WebP y AVIF** siguen exportándose sin metadatos. Cada formato necesita su propia librería (PNG `tEXt`/`iTXt` chunks, WebP RIFF chunks, AVIF ISOBMFF boxes) y aún no están implementados.
- `description` y `keywords` no se incrustan: EXIF no tiene tags estándar limpios para ellos.

### 🔒 Seguridad reforzada

- **Fix XSS crítico** en el listado del procesamiento por lotes: nombres de archivo maliciosos ya no pueden ejecutar JavaScript al renderizar (`v3.2.12`).
- **Worker pool resucitado**: una ruta de script rota desde versiones anteriores hacía que los Web Workers nunca se iniciaran. Corregida — ahora el procesamiento de filtros pesados puede usar el pool de workers de verdad (`v3.2.12`).
- **Strict mode** activado en los 16 archivos de `js/managers/` y `js/utils/`, más el worker (`v3.2.13`).

### 🧪 Suite de tests automatizados

- **67 tests** cubriendo `AppConfig`, `helpers`, `SecurityManager`, `MetadataManager` (incluyendo los nuevos métodos de embedding EXIF), `historyManager`, y los 4 fixes de regresión más importantes.
- **Dos formas de ejecutarlos**:
  - **Navegador (autoritativo)**: abre `http://localhost:5505/tests/index.html` con Live Server.
  - **Línea de comandos**: `node tests/run-in-node.js`. Sin npm, sin dependencias, ~80 ms.
- Ambos runners reusan los mismos `tests/specs/*.spec.js`.

---

## 🚀 CARACTERÍSTICAS ANTERIORES

### v3.1.4 — Bugs corregidos

#### ✅ Descarga WebP Corregida
- **Problema resuelto:** Descargas fallaban silenciosamente después de eliminar el archivo
- Ahora puedes descargar múltiples veces sin problemas
- Sistema de fallback automático WebP → PNG/JPEG
- Tests automatizados (10/10 ✅)

#### ✅ Botones Sin Solapamiento
- **Interfaz mejorada:** Botones de acción ahora se distribuyen correctamente
- Responsive optimizado para pantallas medianas
- Sin solapamientos visuales

#### ✅ Modo Oscuro Perfecto
- **Preview visible:** Elemento "ARCHIVO FINAL" ahora legible en tema oscuro
- Alto contraste garantizado
- Colores vibrantes y profesionales

### v3.1.3 — Drag & Drop ultra intuitivo, reglas métricas y zoom optimizado

#### 🎯 SISTEMA DRAG & DROP ULTRA INTUITIVO
**Sistema completamente rediseñado** para posicionar marcas de agua:

- 🔵 **Bordes Visuales**: Azul para texto, naranja para imagen
- ✋ **Arrastre Directo**: Sin pasos confusos, simplemente arrastra
- 💡 **Mensajes Claros**: Instrucciones específicas con gradientes de color
- 🌙 **Modo Oscuro**: Optimizado con colores de alto contraste
- 📱 **Multi-Dispositivo**: Funciona perfectamente en desktop y móvil
- 🖼️ **Descarga Limpia**: Los bordes de guía NO aparecen en la imagen descargada

**Cómo usar:**
1. Selecciona "🎯 Posición personalizada (arrastra para mover)"
2. Verás un borde punteado de color (azul o naranja)
3. Haz clic y arrastra el elemento
4. ¡Listo! Arrastra cuantas veces quieras
5. Al descargar, la imagen estará limpia sin bordes

#### 📐 SISTEMA DE REGLAS MÉTRICAS Y COORDENADAS
**Nueva herramienta profesional** para medición precisa:

- 📏 **Reglas Métricas**: Horizontal (X) y vertical (Y) con marcas cada 50px
- 📍 **Coordenadas en Tiempo Real**: Muestra posición exacta del cursor
- 🎨 **Líneas Guía Adaptativas**: Cambian de color según el fondo (blanco/negro)
- 🎯 **Origen (0,0)**: Esquina superior izquierda del canvas
- 🔘 **Toggle ON/OFF**: Botón junto a controles de zoom

**Cómo usar:**
1. Carga una imagen
2. Haz clic en el botón 📐 (Escala) junto a los controles de zoom
3. Mueve el cursor sobre la imagen para ver coordenadas
4. Las líneas guía siguen al cursor automáticamente

#### 🖱️ ZOOM OPTIMIZADO
**Control preciso sin accidentes**:

- ✅ **Desktop**: Zoom solo con botones (+, -, 🔍)
- ❌ **Rueda del mouse desactivada** en desktop (>767px)
- ✅ **Móvil**: Mantiene gestos táctiles y scroll wheel
- 💡 **Motivo**: Evitar cambios accidentales con Magic Mouse/trackpad

### v3.1.2 — Feedback visual, geolocalización y secciones colapsables

#### 🎨 FEEDBACK VISUAL DE ESTADO
- 🔴🟢 Botones con indicadores de color dinámicos
- Vista previa de imágenes cargadas en miniatura
- Confirmación visual inmediata de acciones

#### 📍 GEOLOCALIZACIÓN MEJORADA
- Obtención automática de coordenadas GPS
- Mensajes de estado contextuales (no intrusivos)
- Indicadores de éxito/error debajo de los campos

#### 🎯 SECCIONES COLAPSABLES
- Todas las secciones principales son colapsables/expandibles
- Soporte para navegación por teclado (Enter/Space)
- Minimización automática del marco del card

### v3.1 — Atajos de teclado, batch, capas de texto y recorte

#### ⌨️ ATAJOS DE TECLADO (MAC)
- ⌘+Z / ⌘+⇧+Z: Deshacer/Rehacer
- ⌘+S: Guardar
- ⌘+⇧+C: Copiar al portapapeles
- ⌘+B: Procesamiento por lotes
- ⌘+T: Capas de texto
- ⌘+R: Recorte

#### 📦 PROCESAMIENTO POR LOTES
- Hasta 50 imágenes simultáneas
- Exportación automática en ZIP
- Barra de progreso en tiempo real

#### 🎨 CAPAS DE TEXTO
- Hasta 10 capas independientes
- 20+ Google Fonts
- Efectos avanzados

#### ✂️ RECORTE INTELIGENTE
- 7 proporciones predefinidas
- Modo personalizado
- Sugerencias automáticas

#### 📂 SECCIONES COLAPSABLES
- 4 secciones principales: Metadatos, Marca de agua, Filtros, Configuración de salida
- Minimización completa del marco del card
- Delegación de eventos para máxima compatibilidad
- Soporte para teclado (Enter/Space)

#### 📍 GEOLOCALIZACIÓN MEJORADA
- Obtención automática de coordenadas GPS
- Feedback contextual en 3 estados (loading, success, error)
- Mensajes no intrusivos debajo de los campos
- Soporte para modo oscuro

---

## 📚 DOCUMENTACIÓN

### 📖 Índice Maestro
- **[docs/INDICE_DOCUMENTACION.md](docs/INDICE_DOCUMENTACION.md)** - 🔍 **EMPEZAR AQUÍ** - Índice completo de toda la documentación

### Guías de Usuario
- **[docs/GUIA_ARRASTRE.md](docs/GUIA_ARRASTRE.md)** - Sistema Drag & Drop para marcas de agua
- **[docs/GUIA_REGLAS_METRICAS.md](docs/GUIA_REGLAS_METRICAS.md)** - Reglas métricas y coordenadas

### Documentación Técnica
- **[docs/DRAG_DROP_SYSTEM.md](docs/DRAG_DROP_SYSTEM.md)** - Implementación técnica del sistema de arrastre
- **[docs/ZOOM_OPTIMIZADO.md](docs/ZOOM_OPTIMIZADO.md)** - Sistema de zoom por dispositivo
- **[docs/MODULAR_ARCHITECTURE.md](docs/MODULAR_ARCHITECTURE.md)** - Arquitectura modular completa
- **[docs/V31_FEATURES.md](docs/V31_FEATURES.md)** - Características completas v3.1
- **[docs/README.md](docs/README.md)** - Documentación técnica principal
- **[CHANGELOG.md](CHANGELOG.md)** - Historial detallado de cambios

---

## 🔧 INSTALACIÓN

```bash
git clone https://github.com/JavierTamaritWeb/MNEMOTAG2.git
cd MNEMOTAG2
open index.html
```

---

## 📄 LICENCIA

MIT License - Javier Tamarit © 2025
