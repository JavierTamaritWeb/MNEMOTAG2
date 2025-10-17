# 🔧 Sistema Drag & Drop - Documentación Técnica

## 📋 Descripción

Sistema ultra intuitivo de arrastrar y soltar que permite reposicionar marcas de agua (texto e imagen) directamente sobre la imagen de vista previa mediante interacción con mouse o gestos táctiles. Incluye indicadores visuales con bordes de colores y mensajes claros optimizados para modo claro y oscuro.

> **Nota**: Para la guía de usuario, consulta [`GUIA_ARRASTRE.md`](./GUIA_ARRASTRE.md)

## ✨ Características Principales

### 1. **Arrastrar y Soltar Independiente**
- **Texto**: Haz clic y arrastra el texto de marca de agua a cualquier posición
- **Imagen**: Haz clic y arrastra la imagen de marca de agua a cualquier posición
- **Independencia Total**: Ambos elementos se pueden arrastrar sin interferir entre sí

### 2. **Indicadores Visuales de Colores** (Nuevo en v3.1.3)
- **Bordes Punteados**: 
  - Azul (`#3b82f6`) para texto
  - Naranja (`#f59e0b`) para imagen
- **Banners Informativos**:
  - Gradientes de color que coinciden con los bordes
  - Mensajes claros: "Modo Arrastre Activo: Haz clic y arrastra..."
- **Optimizado para Modo Oscuro**:
  - Gradientes semi-transparentes
  - Colores con alto contraste (azul claro, amarillo dorado)
  - Bordes con opacidad ajustada

### 3. **Detección Inteligente**
- El sistema detecta automáticamente sobre qué elemento (texto o imagen) haces clic
- **Prioridad**: Si texto e imagen se superponen, el texto tiene prioridad
- **Área sensible**: Solo funciona cuando el cursor está sobre el elemento
- **Inicialización automática**: Si no hay posición custom definida, usa la posición actual

### 4. **Feedback Visual Completo**
- **Cursor**: Cambia a `grab` (mano abierta) cuando está sobre un elemento arrastrable
- **Cursor**: Cambia a `grabbing` (mano cerrada) durante el arrastre
- **Bordes visibles**: Siempre visibles en modo personalizado
- **Mensajes en canvas**: Instrucciones flotantes según el modo activo
- **Notificaciones**: Mensajes de confirmación al finalizar el reposicionamiento

### 4. **Compatibilidad Multi-Dispositivo**
- **Mouse**: Eventos `mousedown`, `mousemove`, `mouseup`
- **Touch**: Eventos `touchstart`, `touchmove`, `touchend`
- **Móviles y Tablets**: Soporte completo para gestos táctiles

## 🎯 Modo de Uso

### Activación del Sistema

1. **Para Texto**:
   - Ve a la sección "Añadir marca de agua"
   - En el campo de texto, escribe tu marca de agua
   - En el selector "Posición", elige **"Posición personalizada (clic en imagen)"**
   - Haz clic en la imagen para posicionar inicialmente
   - Ahora puedes **arrastrar el texto** haciendo clic y manteniendo presionado sobre él

2. **Para Imagen**:
   - Carga una imagen de marca de agua
   - En el selector "Posición" (de la sección de imagen), elige **"Posición personalizada"**
   - Haz clic en la imagen para posicionar inicialmente
   - Ahora puedes **arrastrar la imagen** haciendo clic y manteniendo presionado sobre ella

### Workflow Completo

```
1. Cargar imagen principal
2. Configurar texto de marca de agua
3. Seleccionar "Posición personalizada" → Click para posicionar
4. Cargar imagen de marca de agua
5. Seleccionar "Posición personalizada" → Click para posicionar
6. ✨ NUEVO: Ahora puedes arrastrar ambos elementos libremente
```

## 🔧 Implementación Técnica

### Variables Globales

```javascript
let isDragging = false;              // Estado de arrastre activo
let dragTarget = null;               // 'text' o 'image'
let dragOffsetX = 0;                 // Offset X del punto de agarre
let dragOffsetY = 0;                 // Offset Y del punto de agarre
let textWatermarkBounds = null;      // { x, y, width, height }
let imageWatermarkBounds = null;     // { x, y, width, height }
let showPositioningBorders = true;   // Controla si se muestran bordes de guía
```

> **Nota**: `showPositioningBorders` se establece en `false` temporalmente al descargar la imagen para que los bordes de guía no aparezcan en el archivo final.

### Funciones Principales

#### Detección de Elementos

```javascript
isPointInText(x, y)     // Verifica si el punto está sobre el texto
isPointInImage(x, y)    // Verifica si el punto está sobre la imagen
```

#### Eventos de Mouse

```javascript
handleDragStart(event)  // mousedown - Inicia arrastre
handleDragMove(event)   // mousemove - Actualiza posición
handleDragEnd(event)    // mouseup - Finaliza arrastre
```

#### Eventos Táctiles

```javascript
handleTouchStart(event) // touchstart - Inicia arrastre táctil
handleTouchMove(event)  // touchmove - Actualiza posición táctil
handleTouchEnd(event)   // touchend - Finaliza arrastre táctil
```

### Guardado de Bounds

Los límites de los elementos se guardan automáticamente al dibujarlos:

- **Texto**: En `applyTextWatermarkOptimized()` → `textWatermarkBounds`
- **Imagen**: En `drawCachedWatermark()` → `imageWatermarkBounds`

### Event Listeners

```javascript
canvas.addEventListener('mousedown', handleDragStart);
canvas.addEventListener('mousemove', handleDragMove);
canvas.addEventListener('mouseup', handleDragEnd);
canvas.addEventListener('mouseleave', handleDragEnd);

canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd);
canvas.addEventListener('touchcancel', handleTouchEnd);
```

## 🎨 Estilos CSS

Los estilos de cursor ya están implementados en `styles.css`:

```css
cursor: grab;      /* Sobre elemento arrastrable */
cursor: grabbing;  /* Durante el arrastre */
cursor: default;   /* Estado normal */
```

## 🚀 Ventajas del Sistema

### Antes
❌ Tenías que:
1. Deseleccionar "Posición personalizada"
2. Volver a seleccionar "Posición personalizada"
3. Click en la imagen para reposicionar
4. Repetir para el otro elemento

### Ahora
✅ Simplemente:
1. Selecciona "Posición personalizada" una vez
2. **Arrastra directamente** cualquier elemento cuando quieras
3. Cambia entre texto e imagen sin pasos adicionales

## 🔍 Detalles Técnicos

### Prioridad de Detección

Cuando ambos elementos están en modo personalizado y se superponen:

1. **Primero verifica texto**: Si el click está sobre el texto, arrastra el texto
2. **Luego verifica imagen**: Si no está sobre texto, verifica imagen

Esto permite arrastrar el texto incluso si está sobre la imagen.

### Cálculo de Coordenadas

```javascript
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

const x = (event.clientX - rect.left) * scaleX;
const y = (event.clientY - rect.top) * scaleY;
```

Esto asegura que las coordenadas sean correctas independientemente del tamaño de visualización del canvas.

### Offset de Arrastre

Se calcula el offset entre el punto de click y el centro/origen del elemento:

```javascript
// Para texto
dragOffsetX = x - customTextPosition.x;
dragOffsetY = y - customTextPosition.y;

// Para imagen
dragOffsetX = x - customImagePosition.x;
dragOffsetY = y - customImagePosition.y;
```

Esto mantiene la posición relativa del elemento respecto al cursor durante el arrastre.

## 🐛 Gestión de Conflictos

### Zoom y Pan

El sistema verifica si el canvas está en modo zoom antes de iniciar el arrastre:

```javascript
if (isZoomed && isPanning) return;
```

Esto evita conflictos con la funcionalidad de pan al navegar una imagen ampliada.

### Propagación de Eventos

Se utiliza `event.stopPropagation()` para evitar que otros handlers interfieran:

```javascript
event.preventDefault();
event.stopPropagation();
```

## 📊 Compatibilidad

- ✅ Chrome/Edge (Desktop y Mobile)
- ✅ Firefox (Desktop y Mobile)
- ✅ Safari (Desktop y Mobile)
- ✅ Dispositivos iOS
- ✅ Dispositivos Android

## 🎯 Casos de Uso

### 1. Ajuste Fino de Posición
Coloca inicialmente con click, luego ajusta arrastrando hasta la posición perfecta.

### 2. Cambios Rápidos
Mueve rápidamente entre diferentes posiciones sin reconfigurar.

### 3. Diseño Iterativo
Prueba múltiples posiciones hasta encontrar la composición ideal.

### 4. Móviles
Usa gestos táctiles para posicionar con precisión en dispositivos móviles.

## 📝 Notas

- El sistema solo funciona cuando el elemento está en modo **"Posición personalizada"**
- Los marcadores visuales (círculos de colores) se actualizan automáticamente durante el arrastre
- La vista previa se actualiza en tiempo real mientras arrastras
- Las posiciones se guardan en `customTextPosition` y `customImagePosition`

## 🖼️ Descarga Limpia de Imágenes

### Problema Identificado y Solucionado

**Problema Original**: Los bordes de guía (azul/naranja) aparecían en la imagen descargada porque `applyWatermarkOptimized()` solo dibujaba las marcas de agua ENCIMA del canvas existente sin limpiar los bordes previos.

**Solución Implementada**: Sistema de redibujado completo del canvas antes de la descarga.

### Función `redrawCompleteCanvas()`

Nueva función auxiliar que redibuja TODO el canvas desde cero:

```javascript
function redrawCompleteCanvas() {
  if (!canvas || !ctx || !currentImage) {
    console.warn('⚠️ No se puede redibujar');
    return;
  }
  
  // 1. Limpiar canvas completamente
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2. Redibujar imagen base con alta calidad
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  
  // 3. Aplicar marcas de agua (respeta showPositioningBorders)
  applyWatermarkOptimized();
  
  // 4. Aplicar filtros CSS
  applyCanvasFilters();
}
```

### Secuencia de Descarga

Todas las funciones de descarga (`downloadImage`, `downloadImageWithProgress`, `downloadImageEnhanced`) ahora siguen esta secuencia:

```javascript
try {
  // 1. Desactivar bordes de guía
  showPositioningBorders = false;
  
  // 2. Redibujar canvas completo SIN bordes
  redrawCompleteCanvas();
  
  // 3. Generar imagen limpia
  const blob = await canvas.toBlob(...);
  
  // 4. Descargar imagen
  // ...
  
} catch (error) {
  // Manejo de errores
} finally {
  // 5. Reactivar bordes para vista previa
  showPositioningBorders = true;
  
  // 6. Redibujar canvas completo CON bordes
  redrawCompleteCanvas();
}
```

### Resultado

| Situación | Estado de Bordes |
|-----------|------------------|
| **Vista Previa** | ✅ Visibles (guía visual) |
| **Imagen Descargada** | ✅ **Eliminados** (imagen limpia) |
| **Después de Descargar** | ✅ Visibles (restaurados automáticamente) |

### Ventajas

- ✅ **Limpieza total**: Canvas se limpia completamente antes de redibujar
- ✅ **Automático**: El usuario no necesita hacer nada especial
- ✅ **Reversible**: Vista previa se restaura automáticamente después de descargar
- ✅ **Consistente**: Funciona en las 3 funciones de descarga diferentes

---

## 🔮 Futuras Mejoras Posibles

- [ ] Snap to grid (alineación a cuadrícula)
- [ ] Guías de alineación visual
- [ ] Restricciones de área (mantener dentro de límites)
- [ ] Rotación de elementos con gestos
- [ ] Historial de posiciones (undo/redo específico)
- [ ] Zoom durante arrastre para ajuste preciso

---

**Versión**: 1.1  
**Fecha**: 2025-10-16  
**Autor**: Sistema de IA Claude Sonnet 4.5

