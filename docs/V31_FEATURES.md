# 📦 MNEMOTAG V3.1 - NUEVAS CARACTERÍSTICAS

**Versión:** 3.1.0  
**Fecha:** Octubre 2025  
**Autor:** Javier Tamarit

---

## 🎯 RESUMEN EJECUTIVO

La versión 3.1 de MnemoTag introduce 4 nuevas características principales que transforman la aplicación en una herramienta profesional completa:

1. **Sistema de Atajos de Teclado** - Navegación rápida optimizada para Mac
2. **Batch Processing** - Procesamiento por lotes de hasta 50 imágenes
3. **Capas de Texto Avanzadas** - Sistema completo de text layers
4. **Recorte Inteligente** - Crop tool con sugerencias automáticas

---

## ⌨️ SISTEMA DE ATAJOS DE TECLADO

### CARACTERÍSTICAS

- **Detección automática de plataforma** (Mac/Windows/Linux)
- **Símbolos nativos de Mac** (⌘, ⇧, ⌥)
- **No interfiere con atajos nativos** del sistema
- **Tooltips informativos** en todos los botones
- **Modal de ayuda** con lista completa de atajos

### ATAJOS IMPLEMENTADOS

#### EDICIÓN
- `⌘ + Z` - Deshacer última acción
- `⌘ + ⇧ + Z` - Rehacer acción
- `⌘ + D` - Duplicar capa
- `Delete` - Eliminar capa seleccionada
- `⌘ + ⇧ + R` - Restablecer filtros

#### ARCHIVO
- `⌘ + S` - Guardar imagen
- `⌘ + ⇧ + C` - Copiar imagen al portapapeles
- `⌘ + ⇧ + V` - Pegar imagen desde portapapeles
- `⌘ + ⇧ + X` - Exportar como...

#### HERRAMIENTAS
- `⌘ + B` - Abrir procesamiento por lotes
- `⌘ + T` - Abrir capas de texto
- `⌘ + R` - Activar modo recorte
- `⌘ + ⇧ + ?` - Mostrar modal de atajos

#### VISTA
- `Espacio` - Ver imagen original (mantener presionado)
- `+` - Zoom in
- `-` - Zoom out
- `0` - Zoom 100%
- `Esc` - Cancelar operación

### IMPLEMENTACIÓN TÉCNICA

**Archivo:** `js/utils/keyboard-shortcuts.js`

```javascript
class KeyboardShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.modifierSymbols = {
      command: this.isMac ? '⌘' : 'Ctrl',
      shift: '⇧',
      alt: '⌥',
      ctrl: 'Ctrl'
    };
  }
  
  register(combo, callback, options = {}) {
    // preventDefault: si debe bloquear comportamiento por defecto
    // ignoreTargets: array de elementos donde NO aplicar
  }
}
```

### DECISIONES DE DISEÑO

1. **Cmd+Shift para operaciones de imagen** - Evita conflictos con atajos nativos
2. **Cmd+C/V nativos funcionan** - Solo en campos de texto
3. **Backspace/Delete normales** - En inputs, eliminan texto
4. **Modal de ayuda accesible** - Con `⌘+⇧+?`

---

## 📦 BATCH PROCESSING

### CARACTERÍSTICAS

- **Hasta 50 imágenes** simultáneas (límite configurable)
- **Todos los filtros aplicables** a las imágenes
- **Marcas de agua globales** (texto e imagen)
- **Exportación en ZIP** automática con JSZip
- **Barra de progreso** detallada con estadísticas
- **Manejo de errores** individual por imagen

### FLUJO DE TRABAJO

1. Usuario hace clic en botón "LOTE" (`⌘+B`)
2. Modal muestra selector de archivos múltiples
3. Usuario configura filtros y marcas de agua
4. Hace clic en "PROCESAR"
5. Cada imagen se procesa individualmente
6. Progress bar muestra: X/Total (XX%)
7. Al finalizar, botón "DESCARGAR ZIP" aparece
8. ZIP contiene todas las imágenes procesadas

### IMPLEMENTACIÓN TÉCNICA

**Modal HTML:** `index.html` líneas 1080-1180

```html
<div id="batch-modal" class="modal-overlay">
  <div class="modal-container">
    <!-- Selector de archivos múltiples -->
    <input type="file" multiple accept="image/*" max="50">
    
    <!-- Configuración de filtros globales -->
    <div class="batch-filters">...</div>
    
    <!-- Barra de progreso -->
    <div class="progress-bar">
      <div class="progress-fill"></div>
      <span class="progress-text">0/0 (0%)</span>
    </div>
    
    <!-- Botones de acción -->
    <button class="btn-process">PROCESAR</button>
    <button class="btn-download-zip">DESCARGAR ZIP</button>
  </div>
</div>
```

**Lógica JavaScript:** `js/main.js`

```javascript
async function processBatchImages(files, config) {
  const zip = new JSZip();
  const total = files.length;
  let processed = 0;
  
  for (const file of files) {
    try {
      // Cargar imagen
      const img = await loadImage(file);
      
      // Aplicar filtros y marcas de agua
      const canvas = applyBatchConfig(img, config);
      
      // Exportar a blob
      const blob = await canvas.toBlob('image/png');
      
      // Agregar al ZIP
      zip.file(`processed_${file.name}`, blob);
      
      // Actualizar progreso
      processed++;
      updateProgress(processed, total);
    } catch (error) {
      console.error(`Error procesando ${file.name}:`, error);
    }
  }
  
  // Generar ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadZip(zipBlob, 'mnemotag_batch.zip');
}
```

### OPTIMIZACIONES

- **Procesamiento secuencial** - Evita saturar memoria
- **Manejo de errores granular** - Una imagen fallida no detiene el lote
- **Nombres de archivo preservados** - Con prefijo `processed_`
- **Preview opcional** - Grid de thumbnails antes de procesar

---

## 🎨 CAPAS DE TEXTO AVANZADAS

### CARACTERÍSTICAS

- **Hasta 10 capas** independientes
- **20+ Google Fonts** (incluyendo Montserrat Alternates)
- **Efectos avanzados:**
  - Sombra (offset X/Y, blur, color)
  - Borde (grosor, color)
  - Degradado de color
  - Rotación (-180° a +180°)
- **10 plantillas prediseñadas**
- **Drag & drop** para reposicionamiento
- **Preview en tiempo real**

### GOOGLE FONTS INTEGRADAS

```javascript
const GOOGLE_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Montserrat Alternates', 'Oswald', 'Raleway',
  'Poppins', 'Ubuntu', 'Playfair Display',
  'Bebas Neue', 'Dancing Script', 'Pacifico',
  'Lobster', 'Indie Flower', 'Shadows Into Light',
  'Permanent Marker', 'Righteous', 'Anton', 'Caveat'
];
```

### PLANTILLAS PREDISEÑADAS

1. **Título Principal** - Grande, centrado, bold
2. **Subtítulo Elegante** - Mediano, serif, con sombra
3. **Marca de Agua Discreta** - Pequeño, esquina, transparente
4. **Texto Impactante** - XXL, gradiente, centrado
5. **Cita Inspiracional** - Cursiva, centrada, con borde
6. **Título de Evento** - Bold, color vivo, sombra
7. **Copyright Simple** - Pequeño, esquina inferior
8. **Texto Artístico** - Handwriting, rotado, decorativo
9. **Etiqueta de Producto** - Rectangular, fondo, esquina
10. **Firma Personal** - Script, transparente, pequeña

### IMPLEMENTACIÓN TÉCNICA

**Modal HTML:** `index.html` líneas 1180-1320

```html
<div id="text-layers-modal" class="modal-overlay">
  <div class="modal-container">
    <!-- Lista de capas -->
    <div class="layers-list">
      <div class="layer-item" data-layer-id="1">
        <input type="text" placeholder="Texto de capa">
        <select class="font-selector">
          <option>Roboto</option>
          <option>Montserrat Alternates</option>
          ...
        </select>
        <input type="color" value="#ffffff">
        <input type="range" min="10" max="200" value="48">
        <!-- Más controles... -->
      </div>
    </div>
    
    <!-- Botón agregar capa -->
    <button class="btn-add-layer">+ AGREGAR CAPA</button>
    
    <!-- Plantillas -->
    <select class="template-selector">
      <option value="title">Título Principal</option>
      <option value="subtitle">Subtítulo Elegante</option>
      ...
    </select>
  </div>
</div>
```

**Renderizado en Canvas:**

```javascript
function renderTextLayer(ctx, layer) {
  ctx.save();
  
  // Posición y rotación
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  
  // Fuente
  ctx.font = `${layer.fontSize}px "${layer.fontFamily}"`;
  ctx.fillStyle = layer.color;
  ctx.globalAlpha = layer.opacity / 100;
  
  // Sombra
  if (layer.shadow.enabled) {
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowColor = layer.shadow.color;
  }
  
  // Borde
  if (layer.stroke.enabled) {
    ctx.strokeStyle = layer.stroke.color;
    ctx.lineWidth = layer.stroke.width;
    ctx.strokeText(layer.text, 0, 0);
  }
  
  // Texto
  ctx.fillText(layer.text, 0, 0);
  
  ctx.restore();
}
```

### CARGA DINÁMICA DE FUENTES

```javascript
async function loadGoogleFont(fontFamily) {
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}`;
  
  const link = document.createElement('link');
  link.href = fontUrl;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
  
  // Esperar a que la fuente se cargue
  await document.fonts.ready;
}
```

---

## ✂️ RECORTE INTELIGENTE

### CARACTERÍSTICAS

- **7 proporciones predefinidas:**
  - 1:1 (Instagram Cuadrado)
  - 4:5 (Instagram Vertical)
  - 9:16 (Instagram Story)
  - 16:9 (YouTube, Facebook, Twitter)
  - Libre (personalizada)
- **8 handles interactivos** (esquinas + lados)
- **Grid de regla de tercios**
- **3 sugerencias automáticas** (centro, golden ratio, face detection simulado)
- **Drag & drop** para mover área de recorte
- **Preview en tiempo real**

### PROPORCIONES PREDEFINIDAS

```javascript
const ASPECT_RATIOS = {
  'free': { label: 'LIBRE', ratio: null },
  '1:1': { label: 'INSTAGRAM CUADRADO', ratio: 1 },
  '4:5': { label: 'INSTAGRAM VERTICAL', ratio: 0.8 },
  '9:16': { label: 'INSTAGRAM STORY', ratio: 0.5625 },
  '16:9': { label: 'YOUTUBE / FACEBOOK', ratio: 1.7778 },
};
```

### INTERFAZ DE RECORTE

**Elementos HTML:**

```html
<div class="crop-overlay">
  <!-- Área oscurecida -->
  <div class="crop-dim"></div>
  
  <!-- Rectángulo de recorte -->
  <div class="crop-box">
    <!-- Grid de tercios -->
    <div class="crop-grid">
      <div class="grid-line grid-h"></div>
      <div class="grid-line grid-h"></div>
      <div class="grid-line grid-v"></div>
      <div class="grid-line grid-v"></div>
    </div>
    
    <!-- 8 handles de resize -->
    <div class="handle handle-nw"></div>
    <div class="handle handle-n"></div>
    <div class="handle handle-ne"></div>
    <div class="handle handle-e"></div>
    <div class="handle handle-se"></div>
    <div class="handle handle-s"></div>
    <div class="handle handle-sw"></div>
    <div class="handle handle-w"></div>
  </div>
</div>
```

**Lógica de Drag & Drop:**

```javascript
class CropTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
    this.isDragging = false;
    this.dragHandle = null;
  }
  
  onMouseDown(e) {
    const handle = e.target.dataset.handle;
    if (handle) {
      this.dragHandle = handle;
      this.isDragging = true;
    } else if (this.isInsideCropBox(e.x, e.y)) {
      this.isDragging = true;
      this.dragHandle = 'move';
    }
  }
  
  onMouseMove(e) {
    if (!this.isDragging) return;
    
    if (this.dragHandle === 'move') {
      this.moveCropBox(e.movementX, e.movementY);
    } else {
      this.resizeCropBox(this.dragHandle, e.x, e.y);
    }
    
    this.updatePreview();
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.dragHandle = null;
  }
  
  applyCrop() {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = this.cropBox.width;
    croppedCanvas.height = this.cropBox.height;
    
    const ctx = croppedCanvas.getContext('2d');
    ctx.drawImage(
      this.canvas,
      this.cropBox.x, this.cropBox.y,
      this.cropBox.width, this.cropBox.height,
      0, 0,
      this.cropBox.width, this.cropBox.height
    );
    
    return croppedCanvas;
  }
}
```

### SUGERENCIAS AUTOMÁTICAS

```javascript
function getSmartCropSuggestions(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  
  return [
    {
      name: 'CENTRADO',
      crop: {
        x: width * 0.1,
        y: height * 0.1,
        width: width * 0.8,
        height: height * 0.8
      }
    },
    {
      name: 'GOLDEN RATIO',
      crop: {
        x: width * 0.15,
        y: height * 0.15,
        width: width * 0.618,
        height: height * 0.618
      }
    },
    {
      name: 'FOCO SUPERIOR',
      crop: {
        x: width * 0.1,
        y: height * 0.05,
        width: width * 0.8,
        height: height * 0.7
      }
    }
  ];
}
```

---

## 🎨 MEJORAS DE UI/UX

### MODO OSCURO COMPLETO

Todos los nuevos modales y componentes incluyen soporte completo para modo oscuro:

```css
[data-theme="dark"] .modal-container {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e2e8f0;
}

[data-theme="dark"] .btn-secondary {
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
}

[data-theme="dark"] .advanced-tools-container {
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
}
```

### BOTONES CON GRADIENTES

```css
.btn-process {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.btn-cancel {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
}
```

### TOOLTIPS INFORMATIVOS

Todos los botones incluyen tooltips con información y atajos:

```html
<button title="📦 PROCESAR MÚLTIPLES IMÁGENES&#10;ATAJO: ⌘B">
  LOTE
</button>
```

---

## 📊 ESTADÍSTICAS DE v3.1

- **Líneas de código agregadas:** ~2,500
- **Nuevos archivos:** 1 (`keyboard-shortcuts.js`)
- **Funciones agregadas:** ~40
- **Archivos modificados:** 3 (`main.js`, `index.html`, `styles.css`)
- **Tiempo de desarrollo:** 40 horas
- **Bugs reportados:** 8 (todos solucionados)
- **Mejoras post-lanzamiento:** 15

---

## 🐛 BUGS CONOCIDOS SOLUCIONADOS

1. ✅ **Selector de licencia** - Copyright dinámico implementado
2. ✅ **Fuente Montserrat Alternates** - Agregada a todos los selectores
3. ✅ **Campo de nombre de archivo** - Fix en `downloadImageWithProgress`
4. ✅ **Botones de herramientas** - Event listeners corregidos
5. ✅ **Atajos nativos de Mac** - Conflictos resueltos con Cmd+Shift
6. ✅ **Fondo oscuro de herramientas** - CSS corregido con clase personalizada
7. ✅ **Tooltips multiplataforma** - Convertidos a formato Mac (⌘)
8. ✅ **Modal de atajos desactualizado** - Actualizado con todos los nuevos atajos

---

## 🚀 PRÓXIMOS PASOS (v3.2)

- [ ] Integración de Web Workers para batch processing
- [ ] Sistema de historial avanzado (más de 10 estados)
- [ ] Más plantillas de texto (20 totales)
- [ ] Detección de rostros real para crop inteligente
- [ ] Exportación con metadatos preservados
- [ ] Soporte para GIF animados
- [ ] Filtros con IA (style transfer)

---

**Documentación actualizada:** Octubre 2025  
**Versión del documento:** 1.0
