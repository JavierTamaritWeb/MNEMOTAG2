# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos. 100% cliente, sin backend.

![Version](https://img.shields.io/badge/version-3.5.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)
[![Tests](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml)

**Demo en vivo:** [javiertamaritweb.github.io/MNEMOTAG2](https://javiertamaritweb.github.io/MNEMOTAG2/)

---

## NOVEDADES v3.5

### Build system: Gulp 5 + SCSS + minificacion (v3.5.0)

- **Gulp 5** con `gulp-concat` + `gulp-terser` para JS y `sass` + `gulp-clean-css` para CSS.
- **24 scripts** en `index.html` reemplazados por un solo `<script src="js/app.min.js"></script>`.
- **SCSS partials** en `src/scss/`: CSS monolitico de 7,687 lineas dividido en 7 partials tematicos (`_variables`, `_base`, `_layout`, `_components`, `_preview`, `_hero`, `_modals`).
- **`browser-sync`** en puerto 5507 sin live reload automatico (reemplaza Live Server).
- **`zoom-pan-manager.js`** extraido de `main.js` (~210 lineas).

### Code audit: 4 criticos + 14 moderados (v3.5.1 + v3.5.2)

- **23 `onclick` inline** reemplazados por delegacion de eventos con `data-action`.
- **42 clases `dark:` de Tailwind** muertas eliminadas.
- **83 `console.log/warn`** envueltos en `MNEMOTAG_DEBUG` (cero logging en produccion).
- **81 `var`** reemplazados por `const`/`let`.
- **Magic numbers** extraidos a `AppConfig` (zoom limits, debounce delays).
- **Null guards** con optional chaining en DOM queries.
- **Artefactos de build** en `.gitignore`.

### Verificacion

- `npm run build` genera `js/app.min.js` + `css/styles.css`
- `node tests/run-in-node.js` → **186/186 OK**
- `node tests/binary-validation.js` → **86/86 OK**
- Playwright E2E en CI

> Historial completo de versiones anteriores (v3.4.x, v3.3.x, v3.1.x): [CHANGELOG.md](CHANGELOG.md)

---

## 🚀 CARACTERÍSTICAS PRINCIPALES

### 📷 Metadatos EXIF reales
- **JPEG**: escritura completa vía `piexifjs` (título, autor, copyright, software, fecha, GPS).
- **PNG**: chunks `eXIf` con CRC32 propio (sin librerías externas).
- **WebP**: manipulación RIFF/VP8X con conversión automática de WebPs simples a extended.
- **AVIF**: inyeccion ISOBMFF real con parser recursivo, builders de iinf/iloc/iref y estrategia append-only.

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
- **Tests**: 186 aserciones Node + 86 binarias (PNG/WebP/AVIF) + Playwright E2E.
- **CI/CD**: GitHub Actions con deploy automático a GitHub Pages.
- **Seguridad**: CSP, SRI en todos los CDNs, sanitización XSS en toasts y batch processor.

---

## 📚 DOCUMENTACIÓN

### 📖 Índice Maestro
- **[docs/INDICE_DOCUMENTACION.md](docs/INDICE_DOCUMENTACION.md)** - 🔍 **EMPEZAR AQUÍ** - Índice completo de toda la documentación

### Guías de Usuario
- **[docs/GUIA_ARRASTRE.md](docs/GUIA_ARRASTRE.md)** - Sistema Drag & Drop para marcas de agua
- **[docs/GUIA_REGLAS_METRICAS.md](docs/GUIA_REGLAS_METRICAS.md)** - Reglas métricas y coordenadas

### Documentacion Tecnica
- **[docs/DRAG_DROP_SYSTEM.md](docs/DRAG_DROP_SYSTEM.md)** - Implementacion del sistema de arrastre
- **[docs/ZOOM_OPTIMIZADO.md](docs/ZOOM_OPTIMIZADO.md)** - Sistema de zoom por dispositivo
- **[docs/RESUMEN_VERSIONES.md](docs/RESUMEN_VERSIONES.md)** - Evolucion del proyecto version a version
- **[docs/README.md](docs/README.md)** - Documentacion tecnica principal
- **[CHANGELOG.md](CHANGELOG.md)** - Historial detallado de cambios
- **[CLAUDE.md](CLAUDE.md)** - Arquitectura, pipelines, reglas de desarrollo

---

## INSTALACION

```bash
git clone https://github.com/JavierTamaritWeb/MNEMOTAG2.git
cd MNEMOTAG2
npm install
npm run build
```

### Desarrollo

```bash
npm run dev     # build + watch + browser-sync (puerto 5507)
npm run build   # compilar SCSS + bundle JS (una vez)
npm run serve   # solo servidor (sin watch)
```

### Tests

```bash
npm test                         # ejecuta ambos runners
node tests/run-in-node.js        # 186/186 aserciones de regresion
node tests/binary-validation.js  # 86/86 aserciones binarias PNG/WebP/AVIF
```

Los runners Node no requieren dependencias externas: son JavaScript puro con polyfills minimos.

---

## 📄 LICENCIA

MIT License - Javier Tamarit © 2026
