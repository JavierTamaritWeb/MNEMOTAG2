# MNEMOTAG - DOCUMENTACION TECNICA

**Version:** 3.5.7
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
├── index.html                  # Desarrollo (rutas a images/ y dist/css,js)
├── package.json                # Gulp 5 + devDependencies
├── gulpfile.js                 # Tasks: js, scss, images, html, copyAssets, clean
├── service-worker.js           # PWA con cache hibrido
├── src/scss/                   # Fuentes SCSS (7 partials en subcarpetas)
│   ├── main.scss               # Entry point (@use 'carpeta/partial')
│   ├── abstracts/_variables    # CSS custom properties (light + dark)
│   ├── base/_base              # Resets, tipografia, accesibilidad
│   ├── layout/_layout          # Upload zone, forms, cards
│   ├── components/_components  # Botones, filtros, progress
│   ├── pages/_preview, _hero   # Canvas, zoom, hero section
│   └── modules/_modals         # Paneles laterales, modales, batch
├── dist/                       # GENERADO — directorio de produccion
│   ├── index.html              # Minificado (-36%), rutas relativas
│   ├── service-worker.js       # Rutas ajustadas a dist/
│   ├── css/styles.css          # SCSS compilado + minificado
│   ├── js/app.min.js           # Bundle 24 archivos + terser
│   ├── js/image-processor.js   # Worker copiado
│   ├── js/workers/             # analysis-worker.js copiado
│   └── images/                 # Originales + WebP + AVIF
├── js/                         # Fuentes JS (editables)
│   ├── main.js                 # Orquestador (~7000 lineas)
│   ├── utils/                  # 7 utilidades
│   └── managers/               # 14 managers (IIFE)
├── images/                     # Imagenes fuente
├── tests/                      # 209 + 86 aserciones + Playwright E2E
└── docs/                       # Esta documentacion
```

---

## Estadisticas

- **Version:** 3.5.7
- **Archivos JS:** 24 (bundled en app.min.js)
- **Managers:** 14 modulos especializados
- **Tests:** 217 + 86 = 303 aserciones totales
- **Build:** Gulp 5 (SCSS + JS concat + terser)

---

**Autor:** Javier Tamarit
**Ultima actualizacion:** 11 de abril de 2026
