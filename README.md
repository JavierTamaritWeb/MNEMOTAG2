# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos. 100% cliente, sin backend.

![Version](https://img.shields.io/badge/version-3.5.10-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)
[![Tests](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml)

**Demo en vivo:** [javiertamaritweb.github.io/MNEMOTAG2](https://javiertamaritweb.github.io/MNEMOTAG2/)

---

## NOVEDADES v3.5

### Estabilidad y Deshacer/Rehacer (v3.5.9)
- **Restauración de Undo/Redo**: Corrección de bucles infinitos y sincronización total de UI (filtros, rotación, metadatos) tras restaurar estados.
- **UI Spacing Fix**: Eliminación de huecos excesivos entre secciones para una interfaz más compacta.
- **Filtro Cálido mejorado**: Boost en previsualización y persistencia en historial.

### Build system (v3.5.0)
- **Gulp 5** con JS bundle (concat + terser), SCSS (sass + cleanCSS), imagenes (sharp → WebP + AVIF), HTML minificado.
- **24 scripts** → 1 `<script src="dist/js/app.min.js">`.
- **SCSS** en subcarpetas: `abstracts/`, `base/`, `layout/`, `components/`, `pages/`, `modules/`.

### Carpeta dist/ de produccion (v3.5.3 – v3.5.5)
- **`dist/`** es un directorio autocontenido y desplegable: HTML minificado (-36%), CSS, JS, workers, service-worker, imagenes con WebP + AVIF.
- **Imagenes optimizadas**: cada PNG/JPEG tiene variante WebP y AVIF (applicacion.png: 1.4 MB → AVIF 22 KB, -98%).
- **`<picture>`** con carga progresiva AVIF → WebP → PNG fallback.

### Code audit (v3.5.1 – v3.5.2)
- 23 `onclick` inline → delegacion de eventos con `data-action`.
- 83 `console.log/warn` → `MNEMOTAG_DEBUG` guard.
- 81 `var` → `const`/`let`. Magic numbers → `AppConfig`. Null guards.

### Verificacion
- `npm run build` genera `dist/` completo
- `node tests/run-in-node.js` → **217/217 OK**
- `node tests/binary-validation.js` → **86/86 OK**

> Versiones anteriores: [CHANGELOG.md](CHANGELOG.md)

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
node tests/run-in-node.js        # 217/217 aserciones de regresion
node tests/binary-validation.js  # 86/86 aserciones binarias PNG/WebP/AVIF
```

Los runners Node no requieren dependencias externas: son JavaScript puro con polyfills minimos.

---

## 📄 LICENCIA

MIT License - Javier Tamarit © 2026
