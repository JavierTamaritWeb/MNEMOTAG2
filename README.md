# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos. 100% cliente, sin backend, sin build step, sin npm.

![Version](https://img.shields.io/badge/version-3.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)
[![Tests](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml/badge.svg)](https://github.com/JavierTamaritWeb/MNEMOTAG2/actions/workflows/deploy.yml)

**🌐 Demo en vivo:** [javiertamaritweb.github.io/MNEMOTAG2](https://javiertamaritweb.github.io/MNEMOTAG2/)

---

## ⭐ NOVEDADES v3.4.0

> **Umbrella release — 8 features nuevas consolidadas + pulido visual de botones.** v3.4.0 empaqueta bajo una sola versión mayor todo el trabajo hecho en v3.3.11 hasta v3.3.18, añade el fix definitivo de estilos para los 5 botones nuevos (con gradientes propios por botón, focus accesible y dark mode) y deja la documentación alineada al nuevo número de versión.

### 🎁 Qué incluye v3.4.0

Las 8 features publicadas en los commits v3.3.11 → v3.3.18 ahora viven bajo la bandera v3.4.0:

1. **📋 Pegar portapapeles** (`Cmd+V` / `Ctrl+V` global) + **export multi-size a ZIP** (checkboxes 256/512/1024/2048 px).
2. **📊 Análisis visual**: histograma RGB + luminosidad, paleta de colores dominantes con cuantización, y **✨ Auto-mejorar imagen** (percentiles 1%/99% + LUT).
3. **📈 Editor de curvas y niveles** estilo Photoshop (canvas interactivo 280×280, 4 canales, composición LUT).
4. **📜 Historial visual con thumbnails** clicables que saltan directamente a cualquier estado previo.
5. **📱 Soporte HEIC/HEIF** nativo (las fotos del iPhone ya cargan directamente, conversión via `heic2any` CDN).
6. **⚙️ PWA real con Service Worker** (cache híbrido, offline tras primera visita, instalable en móvil/escritorio).
7. **🧱 Parser ISOBMFF defensivo** para AVIF (infraestructura lista, nunca corrompe archivos).
8. **🪄 Eliminar fondo con IA** (lazy load total del modelo `@imgly/background-removal`, cero impacto en peso inicial).

### 🎨 Pulido visual de 5 botones nuevos (exclusivo de v3.4.0)

Los botones introducidos en v3.3.11–v3.3.18 arrastraban clases CSS incompatibles con el layout donde se insertaban. v3.4.0 los rediseña con selectores por ID que vencen a los selectores masivos heredados, sin afectar al resto de la UI:

- **`#auto-balance-btn`** — gradiente **ámbar**.
- **`#curves-btn`** — gradiente **morado**.
- **`#remove-bg-btn`** — gradiente **cian/teal**.
- **`#download-multisize-btn`** — estilo **outlined real** con variante completa para dark mode.
- **`#history-toggle-btn`** — gradiente **índigo**, ancho flexible.
- **Focus ring accesible** + contenedor `flex-wrap` para pantallas estrechas.

### 🔧 Otros cambios de v3.4.0

- **Cache-bust de `styles.css`** (`?v=20260409a`) y **Service Worker bumpeado** a `mnemotag-v3.3.19-css-fix` para invalidar caches anteriores en PWAs ya instaladas.
- **Copyright actualizado a 2026**.
- **Push a GitHub desbloqueado** tras el incidente del scope `workflow` del token.

### 🎯 Verificación

- `node tests/run-in-node.js` → **142/142 OK**
- `node tests/binary-validation.js` → **44/44 OK**

Cero regresiones. v3.4.0 es el punto estable recomendado para usuarios que no vengan siguiendo cada patch de la serie v3.3.

> 📜 **Historial completo**: para el detalle de v3.3.11 – v3.3.18, v3.3.0 – v3.3.10, v3.1.0 – v3.1.4 y todas las versiones anteriores, consulta [CHANGELOG.md](CHANGELOG.md).

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
