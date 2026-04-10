# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos. 100% cliente, sin backend, sin build step, sin npm.

![Version](https://img.shields.io/badge/version-3.4.20-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)
[![Tests](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml)

**🌐 Demo en vivo:** [javiertamaritweb.github.io/MNEMOTAG2](https://javiertamaritweb.github.io/MNEMOTAG2/)

---

## ⭐ NOVEDADES v3.4.20

> **Release final del bloque v3.4.x — 15 versiones en 2 sesiones.** Tras v3.4.0 (umbrella de 8 features de v3.3.x + pulido visual), la segunda sesión ha añadido 15 mejoras más: hardening de seguridad, CI lint, accesibilidad real, features nuevas, modularización arquitectónica, performance con Web Workers, testing end-to-end con Playwright y, por fin, la inyección real de EXIF en AVIF.

### 🛡️ Seguridad (v3.4.1 + v3.4.14)

- **CSP meta tag** con allowlist restrictiva (solo cdnjs, jsdelivr, Google Fonts) + `default-src 'self'`.
- **SRI hashes sha384** en los 5 recursos CDN externos (jszip, piexifjs, heic2any, Tailwind, Font Awesome). Si jsdelivr se compromete, los recursos se rechazan.
- `watermark-text-enabled` sin `checked` por defecto (bug latente cerrado).
- Fixes de 2 errores de consola reportados: `frame-ancestors` (solo funciona como HTTP header) y `'unsafe-eval'` añadido para tolerar `new Function()` de librerías CDN.

### ⚙️ CI y linting (v3.4.2)

- **ESLint 9** con flat config por tipo de archivo (browser/SW/tests). 0 errors.
- **Stylelint 16** con reglas mínimas.
- **`.github/workflows/lint.yml`** corre ambos via `npx --yes` sin `package.json`.

### ♿ Accesibilidad real (v3.4.3)

- **Focus trap** en los modales (histogram, palette, curves, history) con `Tab`/`Shift+Tab` wrap-around.
- **Cierre con `Escape`** y devolución del foco al elemento que lo tenía antes de abrir.
- **`role`/`aria-live`/`aria-atomic`** en los 4 tipos de toast: errores `assertive`, warnings/éxitos/info `polite`.

### ✨ Features nuevas (v3.4.4 – v3.4.6)

- **Live preview en el editor de curvas**: el canvas principal se actualiza en tiempo real mientras arrastras los puntos de control. Botón "Cancelar" para rollback. Escape/backdrop también restauran.
- **Filter presets**: nuevo `preset-manager.js` con `savePreset/loadPreset/deletePreset/listPresets` en `localStorage`. UI completa en la sección de filtros (input de nombre + select + 3 botones).
- **Undo/redo con `ImageBitmap`**: memoria GPU nativa (~10x menos que dataURL en imágenes 4K). `saveState` es async interno con fallback a dataURL. Botón "Vaciar historial" para liberar memoria on-demand.

### 🏗️ Modularización arquitectónica (v3.4.7 – v3.4.11)

**~1162 líneas extraídas de `main.js`** a 4 managers nuevos + 1 utils + 1 worker, usando el patrón **IIFE-con-estado-privado**:

- **`js/managers/analysis-manager.js`** — histograma, paleta, auto-balance.
- **`js/managers/curves-manager.js`** — editor de curvas + LUT + live preview.
- **`js/managers/bg-removal-manager.js`** — lazy load del modelo IA + procesado.
- **`js/managers/export-manager.js`** — `downloadImage`, `downloadImageWithProgress`, `downloadMultipleSizes`. El más grande (~430 líneas).
- **`js/utils/app-state.js`** — `AppState` singleton con getters/setters a las variables `let` de main.js. Estrategia NO invasiva.

### 🚀 Performance (v3.4.12)

- **`js/workers/analysis-worker.js`** — Web Worker con handlers para `buildHistogram`, `extractPalette`, `autoBalance`.
- En esta versión se delega **autoBalance** al worker (la operación más crítica: 500 ms → no bloquea UI). Fallback a main-thread si Worker falla.
- Protocolo con **transferable objects** para evitar copia del buffer.

### 🧪 Testing end-to-end (v3.4.13)

- **Playwright smoke test** con 5 tests que ejecutan un **Chromium real**: carga página, verifica que los 9 managers están vivos, que los 16 botones existen, que subir un PNG sintético no lanza errores, y que `AppState.snapshot()` devuelve estado válido.
- **`.github/workflows/e2e.yml`** corre Playwright vía `npx --yes` sin `package.json`. Cobertura end-to-end **real por primera vez en el proyecto** (antes todos los tests eran fetch+grep contra el código fuente).

### 📷 AVIF EXIF real (v3.4.15)

**Phase 14 del plan original, retomada y cerrada.** La parte más compleja: inyección efectiva del item `Exif` en el meta box del contenedor ISOBMFF del AVIF.

- **Parser recursivo** del meta box: localiza `hdlr`/`pitm`/`iinf`/`iref`/`iloc`/`iprp`/`idat`.
- **Lectores byte-level**: `_readPitm`, `_readIinf` (infe v2/v3), `_readIloc` (versions 0/1/2, `offset_size` 4/8, `length_size` 4/8, con y sin `base_offset`).
- **Builders**: `_buildInfeBoxForExif`, `_buildIinfWithExtra`, `_buildIrefWithCdsc` (sub-box `cdsc` desde Exif al primary), `_buildIlocWithExtra` (**desplaza los offsets absolutos en `metaGrowth` bytes** para compensar el crecimiento del meta box).
- **Append-only al mdat** con prefijo `exif_tiff_header_offset=0` + bytes TIFF del `piexif.dump`. Reconstruye el archivo: ftyp intacto + meta nuevo + mdat extendido.
- **42 aserciones binarias nuevas** validan end-to-end con un AVIF sintético realista de 164 bytes. Verifican que primary image data queda intacto en su nuevo offset, payload EXIF correcto, cdsc apunta bien, re-inyección rechazada.

### 🎯 Verificación

- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK** (44 antiguas + 42 nuevas de AVIF EXIF)
- **Playwright E2E** ejecutado en CI tras cada push
- ESLint: 0 errors, ~70 warnings (deuda histórica tolerada)

**Con v3.4.15 las 14 fases del plan original v3.4.x quedan TODAS COMPLETADAS sin aborts definitivos.**

> 📜 **Historial completo**: para el detalle de todas las versiones anteriores (v3.4.0, v3.3.11–v3.3.18, v3.3.0–v3.3.10, v3.1.0–v3.1.4, etc.), consulta [CHANGELOG.md](CHANGELOG.md).

---

## 🚀 CARACTERÍSTICAS PRINCIPALES

### 📷 Metadatos EXIF reales
- **JPEG**: escritura completa vía `piexifjs` (título, autor, copyright, software, fecha, GPS).
- **PNG**: chunks `eXIf` con CRC32 propio (sin librerías externas).
- **WebP**: manipulación RIFF/VP8X con conversión automática de WebPs simples a extended.
- **AVIF**: parser ISOBMFF defensivo (infraestructura lista, inyección efectiva en roadmap).

### 🎨 Edición fotográfica
- **Filtros básicos**: brillo, contraste, saturación, desenfoque (vía CSS filters + Web Workers).
- **Filtros preestablecidos**: sepia, blanco y negro, vintage, frío, cálido.
- **Editor de curvas y niveles** estilo Photoshop (LUT pixel-level, 4 canales).
- **Histograma RGB + luminosidad** en modal.
- **Paleta de colores dominantes** con click-para-copiar-hex.
- **Auto-mejorar imagen** (auto-balance por percentiles 1%/99%).
- **Eliminar fondo con IA** (lazy load del modelo de ~10-15 MB).

### 💧 Marcas de agua
- **Texto personalizable**: fuente (Google Fonts), color, tamaño, opacidad, posición libre.
- **Imagen**: PNG/WebP con transparencia, tamaño, opacidad, posición libre.
- **Drag & Drop** con bordes visuales de colores (azul/naranja) y hover inteligente.
- **Reglas métricas** adaptativas con coordenadas en tiempo real.

### 📥 Entrada / 📤 Salida
- **Entrada**: JPEG, JPG, PNG, WebP, AVIF, **HEIC, HEIF** (con conversión automática), **pegar desde portapapeles** con `Cmd+V` / `Ctrl+V`.
- **Salida**: JPEG, PNG, WebP, AVIF con calidad configurable.
- **Export multi-size a ZIP** (256/512/1024/2048 px simultáneos).
- **File System Access API** cuando está disponible, con fallback a `<a download>`.

### 🛠️ Herramientas
- **Recorte** con ratios preestablecidos y libre.
- **Rotación** y **flip** horizontal/vertical.
- **Zoom optimizado** por dispositivo (buttons en desktop, pinch+wheel en móvil).
- **Undo/redo** con historial visual de thumbnails clicables.
- **Batch processing** con JSZip para procesar múltiples imágenes.

### ⚙️ Infraestructura
- **PWA real** con Service Worker (offline tras primera visita, instalable).
- **Tests**: 142 aserciones Node + 44 binarias para manipulación byte-level de PNG/WebP.
- **CI/CD**: GitHub Actions con deploy automático a GitHub Pages.
- **Seguridad**: CSP, SRI en todos los CDNs, sanitización XSS en toasts y batch processor.

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
- **[docs/V31_FEATURES.md](docs/V31_FEATURES.md)** - Características v3.1 (histórico)
- **[docs/RESUMEN_VERSIONES.md](docs/RESUMEN_VERSIONES.md)** - Evolución del proyecto versión a versión
- **[docs/README.md](docs/README.md)** - Documentación técnica principal
- **[CHANGELOG.md](CHANGELOG.md)** - Historial detallado de cambios (todas las versiones)

---

## 🔧 INSTALACIÓN

```bash
git clone https://github.com/JavierTamaritWeb/MNEMOTAG2.git
cd MNEMOTAG2
open index.html
```

O sirve el directorio con cualquier servidor estático (por ejemplo, VS Code Live Server en el puerto 5505).

### Tests

```bash
node tests/run-in-node.js        # 142/142 aserciones de regresión
node tests/binary-validation.js  # 44/44 aserciones binarias PNG/WebP/AVIF
```

Los runners Node no requieren `npm install`: son JavaScript puro con polyfills mínimos.

---

## 📄 LICENCIA

MIT License - Javier Tamarit © 2026
