# 📝 CHANGELOG - MNEMOTAG v3.1

Todos los cambios notables en este proyecto serán documentados en este archivo.

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

**Última actualización:** 4 de octubre de 2025  
**Versión actual:** 3.1.0  
**Estado:** ✅ Estable y listo para producción
