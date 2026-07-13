# MNEMOTAG - DOCUMENTACION TECNICA

**Version:** 3.7.1
**Ultima actualizacion:** 13 de julio de 2026

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

- [**AUDITORIA_V3_5_11_SOLUCIONES.md**](AUDITORIA_V3_5_11_SOLUCIONES.md) — Postmortem completo de auditoria y reauditoria, con barreras de no regresion
- [**REGISTRO_ERRORES_V3_5_13.md**](REGISTRO_ERRORES_V3_5_13.md) — Errores de integracion de quick wins y barreras para que no se repitan
- [**ARQUITECTURA_V3_7_1.md**](ARQUITECTURA_V3_7_1.md) — Estado observable, compositor unico y propietarios de subsistema
- [**POSTMORTEM_V3_7_1.md**](POSTMORTEM_V3_7_1.md) — Fallos encontrados, causas raiz, metricas y checklist de release
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
│   ├── js/app.min.js           # Bundle 36 archivos + terser
│   ├── js/image-processor.js   # Worker copiado
│   ├── js/workers/             # analysis-worker.js copiado
│   └── images/                 # Originales + WebP + AVIF
├── js/                         # Fuentes JS (editables)
│   ├── main.js                 # Orquestador (menos de 5000 lineas)
│   ├── utils/                  # Utilidades y AppState observable
│   └── managers/               # 27 managers (IIFE)
├── images/                     # Imagenes fuente
├── tests/                      # 283 Node + 92 binarias + Playwright en 3 motores
└── docs/                       # Esta documentacion
```

---

## Estadisticas

- **Version:** 3.7.1
- **Archivos JS:** 36 (bundled en app.min.js)
- **Managers:** 27 modulos especializados
- **Tests:** 283 Node + 92 binarias + 99 casos E2E (81 ejecutados, 18 omisiones deliberadas)
- **Build:** Gulp 5 (SCSS + JS concat + terser)

---

**Autor:** Javier Tamarit
**Ultima actualizacion:** 13 de julio de 2026
