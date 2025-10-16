# 📐 Guía Completa: Sistema de Reglas Métricas y Coordenadas

## 📋 Descripción

Sistema profesional de medición y coordenadas para posicionamiento preciso de elementos en MNEMOTAG. Permite visualizar coordenadas exactas, medidas y guías visuales sobre la imagen de vista previa.

---

## ✨ Características Principales

### 📏 **Reglas Métricas**
- **Regla Horizontal (Superior)**: Muestra eje X (abscisas) de 0 a canvas.width
- **Regla Vertical (Izquierda)**: Muestra eje Y (ordenadas) de 0 a canvas.height
- **Marcas Numéricas**: Cada 50 píxeles con valores exactos
- **Fondo Semi-transparente**: Negro con opacidad 80% para no obstruir

### 📍 **Display de Coordenadas**
- Muestra posición exacta: `X: 245px, Y: 387px`
- Sigue al cursor en tiempo real
- Se ajusta automáticamente para no salirse del canvas
- Fondo negro con texto blanco en fuente monospace

### 🎨 **Líneas Guía Adaptativas**
- **Línea Horizontal**: Sigue al cursor en el eje Y
- **Línea Vertical**: Sigue al cursor en el eje X
- **Color Inteligente**: 
  - Blanco cuando el fondo es oscuro
  - Negro cuando el fondo es claro
- **Opacidad 70%**: Visibles pero no invasivas

### 🎯 **Sistema de Coordenadas**
- **Origen**: Esquina superior izquierda (0, 0)
- **Unidad**: Píxeles
- **Escala**: Coordenadas reales del canvas (no dimensiones visuales)

---

## 🎯 Cómo Usar el Sistema

### Paso 1: Activar el Sistema

```
1. Carga una imagen en MNEMOTAG
2. Ve a la Sección 6: "Vista Previa"
3. Busca los controles de zoom (esquina inferior derecha)
4. Haz clic en el botón 📐 (icono de regla)
```

### Paso 2: Ver Coordenadas

```
1. Mueve el cursor sobre la imagen
2. Observa:
   - Reglas horizontales y verticales con marcas
   - Líneas guía siguiendo el cursor
   - Display flotante con coordenadas exactas
3. Las líneas cambian de color automáticamente según el fondo
```

### Paso 3: Desactivar

```
1. Haz clic nuevamente en el botón 📐
2. Todas las reglas, líneas y coordenadas desaparecen
3. Vista limpia de la imagen sin elementos adicionales
```

---

## 🎨 Elementos Visuales

### Estructura Visual

```
┌─────────────────────────────────────────────────┐
│ 0    50   100  150  200  250  300  350  400   │ ← Regla horizontal
├─────────────────────────────────────────────────┤
│0 │                 ┃                            │
│  │                 ┃      ┌──────────────────┐  │
│50│                 ┃      │ X: 245px Y: 150px│  │
│  │                 ┃      └──────────────────┘  │
│100│──────────────────────────────               │
│  │                 ┃                            │
│150│                 ┃                            │
│  │                 ┃                            │
│200│                 ┃                            │
└─────────────────────────────────────────────────┘
 ↑                    ↑                    ↑
Regla            Línea guía          Display
vertical         vertical           coordenadas
```

### Colores de Líneas Guía

| Brillo del Fondo | Color de Líneas | Contraste |
|------------------|-----------------|-----------|
| Oscuro (<128) | Blanco `#FFFFFF` | Alto ✅ |
| Claro (>128) | Negro `#000000` | Alto ✅ |

---

## 💡 Casos de Uso

### 1. **Posicionar Marca de Agua con Precisión**

```
Objetivo: Colocar logo a 50px del borde derecho y 50px del borde inferior

Pasos:
1. Activar reglas métricas (📐)
2. Identificar ancho del canvas (ej: 1024px)
3. Calcular posición X = 1024 - 50 = 974px
4. Activar posición personalizada del logo
5. Arrastrar hasta ver coordenadas X: 974px, Y: deseada
6. Desactivar reglas para vista final
```

### 2. **Verificar Dimensiones de un Elemento**

```
Objetivo: Medir el ancho de un texto de marca de agua

Pasos:
1. Activar reglas métricas
2. Posicionar cursor en el inicio del texto (ej: X: 100px)
3. Mover cursor al final del texto (ej: X: 350px)
4. Cálculo mental: Ancho = 350 - 100 = 250px
```

### 3. **Alinear Múltiples Elementos**

```
Objetivo: Alinear texto e imagen en la misma coordenada Y

Pasos:
1. Activar reglas métricas
2. Posicionar primer elemento (ej: Y: 200px)
3. Recordar coordenada Y
4. Posicionar segundo elemento arrastrándolo hasta Y: 200px
5. Ambos elementos perfectamente alineados horizontalmente
```

### 4. **Centrar un Elemento**

```
Objetivo: Centrar logo exactamente en el canvas

Pasos:
1. Activar reglas métricas
2. Leer dimensiones del canvas (ej: 800x600)
3. Calcular centro: X = 400px, Y = 300px
4. Arrastrar logo hasta esas coordenadas
5. Logo perfectamente centrado
```

---

## 🔧 Implementación Técnica

### Variables Globales

```javascript
isRulerMode = false              // Estado ON/OFF del sistema
currentMouseX = 0                // Coordenada X del cursor (canvas real)
currentMouseY = 0                // Coordenada Y del cursor (canvas real)
rulerElements = {                // Referencias DOM
  horizontalRuler: null,
  verticalRuler: null,
  horizontalLine: null,
  verticalLine: null,
  coordinateDisplay: null,
  container: null
}
```

### Funciones Principales

```javascript
toggleRulerMode()                    // Activar/desactivar sistema
createRulers()                       // Crear todos los elementos visuales
removeRulers()                       // Eliminar y limpiar todo
drawRulerMarks()                     // Dibujar marcas numéricas escaladas
handleRulerMouseMove(event)          // Actualizar posición del cursor
updateCrosshair()                    // Actualizar líneas guía
updateCoordinates()                  // Actualizar display de coordenadas
detectBackgroundBrightness(x, y)    // Detectar color de fondo
showRulerGuides()                    // Mostrar guías al entrar
hideRulerGuides()                    // Ocultar guías al salir
```

### Cálculo de Coordenadas

```javascript
// Convertir coordenadas de pantalla a canvas real
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

currentMouseX = (event.clientX - rect.left) * scaleX;
currentMouseY = (event.clientY - rect.top) * scaleY;
```

### Escalado de Marcas

```javascript
// Las marcas se escalan visualmente pero muestran valores reales
const canvasWidth = canvas.width;      // Ej: 1024px (real)
const displayWidth = rect.width;       // Ej: 512px (visual)
const scaleX = displayWidth / canvasWidth;  // 0.5

for (let x = 0; x <= canvasWidth; x += 50) {
  const visualX = x * scaleX;         // Posición visual escalada
  // Muestra número real (x), posicionado en visualX
}
```

### Detección de Brillo

```javascript
const imageData = ctx.getImageData(x, y, 1, 1).data;
const brightness = (imageData[0] + imageData[1] + imageData[2]) / 3;

// Si brightness > 128 → fondo claro → líneas negras
// Si brightness ≤ 128 → fondo oscuro → líneas blancas
return brightness > 128 ? '#000000' : '#FFFFFF';
```

---

## 🎨 Estilos CSS

### Reglas Métricas

```css
#ruler-horizontal {
  position: absolute;
  top: 0;
  left: 30px;
  right: 0;
  height: 30px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 10px;
  font-family: monospace;
}

#ruler-vertical {
  position: absolute;
  top: 30px;
  left: 0;
  bottom: 0;
  width: 30px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 10px;
  font-family: monospace;
}
```

### Líneas Guía

```css
.ruler-line {
  position: absolute;
  opacity: 0.7;
  pointer-events: none;
}

.ruler-line-horizontal {
  height: 1px;
  width: 100%;
}

.ruler-line-vertical {
  width: 1px;
  height: 100%;
}
```

### Display de Coordenadas

```css
#ruler-coordinates {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
```

---

## 📱 Compatibilidad

### Desktop
- ✅ Tracking preciso del mouse
- ✅ Reglas completas siempre visibles
- ✅ Coordenadas fluidas en tiempo real

### Móvil/Tablet
- ✅ Touch tracking funcional
- ✅ Reglas adaptadas al tamaño
- ✅ Coordenadas al tocar (sin hover)

### Navegadores
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari (Desktop y Mobile)
- ✅ Opera

---

## ❓ Preguntas Frecuentes

### ¿Por qué las reglas no aparecen?
**R:** Las reglas solo se muestran cuando:
1. Has cargado una imagen
2. Los controles de zoom están visibles
3. Has activado el botón 📐

### ¿Las coordenadas son exactas?
**R:** Sí, las coordenadas son las **dimensiones reales del canvas** en píxeles, no las dimensiones visuales de pantalla.

### ¿Puedo usar las reglas con zoom activo?
**R:** Sí, las reglas funcionan perfectamente con zoom. Las coordenadas siempre muestran las posiciones reales del canvas.

### ¿Las líneas guía obstruyen la imagen?
**R:** No, las líneas tienen opacidad del 70% y cambian de color según el fondo para máxima visibilidad sin obstruir.

### ¿Cómo desactivo las reglas rápidamente?
**R:** Un solo clic en el botón 📐 desactiva todo el sistema inmediatamente.

---

## 🎯 Tips y Trucos

### 💡 **Para Diseñadores**
- Usa las reglas para alinear elementos con precisión de píxel
- Verifica medidas antes de exportar
- Combina con el sistema de arrastre para posicionamiento exacto

### 💡 **Para Workflows Rápidos**
- Activa reglas solo cuando necesites medidas
- Desactiva para tener vista limpia al finalizar
- Las coordenadas se actualizan instantáneamente

### 💡 **Para Precisión Máxima**
- Usa las marcas numéricas como referencia visual
- Lee las coordenadas del display flotante para valores exactos
- Las líneas guía te ayudan a seguir ejes perfectos

---

## 🔄 Integración con Otras Funciones

### Con Sistema Drag & Drop
```
1. Activa reglas métricas
2. Activa posición personalizada en marca de agua
3. Arrastra viendo coordenadas en tiempo real
4. Posicionamiento con precisión de píxel
```

### Con Zoom
```
1. Haz zoom en área específica
2. Activa reglas métricas
3. Las coordenadas siguen siendo precisas
4. Ideal para ajustes finos
```

### Con Múltiples Capas
```
1. Posiciona texto con reglas activas
2. Posiciona imagen verificando coordenadas
3. Alinea elementos usando valores exactos
4. Diseño profesional garantizado
```

---

## 🚀 Mejoras Futuras (Posibles)

- [ ] Snap to grid (alineación a cuadrícula)
- [ ] Guías personalizadas (líneas fijas en coordenadas elegidas)
- [ ] Medición de distancias entre dos puntos
- [ ] Exportar coordenadas a portapapeles
- [ ] Historial de posiciones visitadas
- [ ] Marcadores de posición guardados

---

**Versión**: 1.0  
**Fecha**: 2025-10-15  
**Incluido en**: MNEMOTAG v3.1.3

✨ **Sistema profesional para medición y posicionamiento preciso** ✨

