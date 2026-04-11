# MNEMOTAG - DOCUMENTACION TECNICA

**Version:** 3.5.2
**Ultima actualizacion:** 11 de abril de 2026

---

## Navegacion rapida

| Documento | Descripcion |
|-----------|-------------|
| [**README.md**](../README.md) | Vision general del proyecto, instalacion, caracteristicas |
| [**CHANGELOG.md**](../CHANGELOG.md) | Historial detallado de cambios por version |
| [**CLAUDE.md**](../CLAUDE.md) | Arquitectura tecnica, pipelines, reglas de desarrollo |
| [**RESUMEN_VERSIONES.md**](RESUMEN_VERSIONES.md) | Tabla comparativa de versiones |

---

## Guias de usuario

- [**GUIA_ARRASTRE.md**](GUIA_ARRASTRE.md) — Sistema Drag & Drop para marcas de agua
- [**GUIA_REGLAS_METRICAS.md**](GUIA_REGLAS_METRICAS.md) — Reglas metricas y coordenadas

## Documentacion tecnica

- [**DRAG_DROP_SYSTEM.md**](DRAG_DROP_SYSTEM.md) — Implementacion tecnica del sistema de arrastre
- [**ZOOM_OPTIMIZADO.md**](ZOOM_OPTIMIZADO.md) — Sistema de zoom diferenciado por dispositivo

---

## Estructura del proyecto

```
MNEMOTAG2/
├── index.html                  # Aplicacion principal (1 script: app.min.js)
├── package.json                # Gulp 5 + devDependencies
├── gulpfile.js                 # Tasks: jsBundle, scssCompile, watch, serve
├── service-worker.js           # PWA con cache hibrido
├── src/scss/                   # Fuentes SCSS (7 partials)
│   ├── main.scss               # Punto de entrada (@use)
│   ├── _variables.scss         # CSS custom properties (light + dark)
│   ├── _base.scss              # Resets, tipografia, accesibilidad
│   ├── _layout.scss            # Upload zone, forms, cards
│   ├── _components.scss        # Botones, filtros, progress, validacion
│   ├── _preview.scss           # Canvas, zoom, ruler, comparacion
│   ├── _hero.scss              # Hero section, features
│   └── _modals.scss            # Paneles laterales, modales, batch
├── css/styles.css              # GENERADO por Gulp (no editar)
├── js/
│   ├── app.min.js              # GENERADO: bundle de 24 archivos
│   ├── main.js                 # Orquestador (~7000 lineas)
│   ├── image-processor.js      # Web Worker (filtros con OffscreenCanvas)
│   ├── utils/                  # 7 utilidades (app-config, helpers, etc.)
│   └── managers/               # 14 managers (IIFE con estado privado)
├── tests/
│   ├── run-in-node.js          # 186 aserciones sin dependencias
│   ├── binary-validation.js    # 86 aserciones binarias PNG/WebP/AVIF
│   └── e2e/                    # Playwright smoke tests
└── docs/                       # Esta documentacion
```

---

## Estadisticas

- **Version:** 3.5.2
- **Archivos JS:** 24 (bundled en app.min.js)
- **Managers:** 14 modulos especializados
- **Tests:** 186 + 86 + 5 E2E = 277 aserciones totales
- **Build:** Gulp 5 (SCSS + JS concat + terser)

---

**Autor:** Javier Tamarit
**Ultima actualizacion:** 11 de abril de 2026
