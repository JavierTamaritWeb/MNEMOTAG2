# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos.

![Version](https://img.shields.io/badge/version-3.3.5-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

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
