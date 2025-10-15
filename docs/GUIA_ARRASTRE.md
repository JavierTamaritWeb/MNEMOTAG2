# 🎯 Guía Completa: Sistema de Arrastre de Marcas de Agua

## 📌 Descripción General

MNEMOTAG incluye un sistema **ultra intuitivo** para posicionar marcas de agua (texto e imagen) mediante **arrastre directo** con el mouse o gestos táctiles.

---

## ✨ Características Principales

### 🎨 **Indicadores Visuales Claros**
| Elemento | Borde | Color |
|----------|-------|-------|
| **Texto** | Punteado azul | 🔵 `#3b82f6` |
| **Imagen** | Punteado naranja | 🟠 `#f59e0b` |

### 💡 **Mensajes Informativos**
- **Panel de control**: Banner con gradiente de color indicando modo activo
- **Canvas superior**: Mensaje flotante "ARRASTRA texto/imagen..."
- **Modo oscuro**: Colores optimizados para máximo contraste

### ⚡ **Funcionamiento Simple**
1. Selecciona "🎯 Posición personalizada (arrastra para mover)"
2. Verás el borde punteado de color
3. Haz clic y arrastra el elemento
4. Suelta para dejar en su lugar
5. Arrastra cuantas veces quieras (sin reconfigurar)

---

## 📖 Guía de Uso Paso a Paso

### Para Texto de Marca de Agua

```
1. En "Añadir marca de agua", escribe tu texto
2. En el dropdown "Posición", selecciona:
   "🎯 Posición personalizada (arrastra para mover)"
3. Verás:
   - Banner azul: "Modo Arrastre Activo..."
   - Borde azul punteado alrededor del texto en la imagen
4. Haz clic sobre el texto y arrastra
5. Suelta donde quieras posicionarlo
```

### Para Imagen de Marca de Agua

```
1. Carga una imagen de marca de agua
2. En el dropdown "Posición", selecciona:
   "🎯 Posición personalizada (arrastra para mover)"
3. Verás:
   - Banner naranja: "Modo Arrastre Activo..."
   - Borde naranja punteado alrededor de la imagen
4. Haz clic sobre la imagen y arrastra
5. Suelta donde quieras posicionarla
```

### Usando Ambos Simultáneamente

```
1. Configura texto en "Posición personalizada"
2. Configura imagen en "Posición personalizada"
3. Verás ambos bordes:
   - Azul para el texto
   - Naranja para la imagen
4. Arrastra cada uno independientemente
5. Mensaje en canvas: "✋ ARRASTRA texto (azul) o imagen (naranja)..."
```

---

## 🎨 Indicadores Visuales Detallados

### 📱 Banners Informativos

#### Modo Claro:
- **Texto**: Gradiente azul brillante con borde azul
- **Imagen**: Gradiente naranja brillante con borde naranja

#### Modo Oscuro:
- **Texto**: Gradiente azul semi-transparente, texto azul claro
- **Imagen**: Gradiente naranja semi-transparente, texto amarillo dorado

### 🖼️ Bordes en Canvas

```
TEXTO:
┌ ─ ─ ─ ─ ─ ─ ─ ┐  ← Borde azul punteado
│  Mi Texto     │
└ ─ ─ ─ ─ ─ ─ ─ ┘

IMAGEN:
┌ ─ ─ ─ ─ ─ ─ ─ ┐  ← Borde naranja punteado
│   🖼️ Logo     │
└ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 🖱️ Cursor

| Estado | Cursor | Descripción |
|--------|--------|-------------|
| **Por defecto** | `→` | Cursor normal |
| **Sobre elemento** | `👋` | Mano abierta (grab) |
| **Arrastrando** | `✊` | Mano cerrada (grabbing) |

---

## 💻 Soporte Multi-Dispositivo

### 🖥️ Desktop (Mouse/Trackpad)
- ✅ Click y arrastra
- ✅ Cursor cambia a mano
- ✅ Feedback visual inmediato

### 📱 Móvil/Tablet (Touch)
- ✅ Toca y arrastra
- ✅ Gestos táctiles nativos
- ✅ Funciona con un dedo

### 🌐 Navegadores
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ iOS Safari
- ✅ Chrome Mobile

---

## 🔧 Compatibilidad con Otras Funciones

### ✅ Compatible con:
- 🔍 Zoom del canvas (no interfiere)
- 🖼️ Rotación de imagen
- 📏 Redimensionado
- 🎨 Filtros
- 📝 Otros ajustes de marca de agua

### 🎯 Prioridad de Elementos
Si texto e imagen se superponen:
- El **texto tiene prioridad** al hacer clic
- Arrastra el texto primero si quieres mover la imagen debajo

---

## ❓ Preguntas Frecuentes

### ¿Por qué no veo el borde punteado?
**Respuesta**: Verifica que hayas seleccionado "🎯 Posición personalizada (arrastra para mover)" en el dropdown de posición.

### ¿Puedo mover ambos elementos?
**Respuesta**: Sí, cada elemento se mueve de forma independiente. Simplemente arrastra uno u otro cuando quieras.

### ¿Necesito hacer algo antes de arrastrar?
**Respuesta**: No. Solo selecciona "Posición personalizada" y ya puedes arrastrar directamente.

### ¿Cuántas veces puedo arrastrar?
**Respuesta**: Ilimitadas. No necesitas reseleccionar nada, arrastra cuantas veces quieras.

### ¿Funciona en modo zoom?
**Respuesta**: El arrastre está desactivado en modo zoom para no interferir con el pan. Haz zoom out primero.

### ¿El cursor no cambia a mano?
**Respuesta**: Asegúrate de que estás posicionando el cursor **directamente sobre** el texto o imagen (dentro del borde punteado).

---

## 🛠️ Detalles Técnicos

### Implementación
- **Detección de colisión**: Sistema de bounds rectangulares
- **Eventos**: Mouse (mousedown/move/up) y Touch (touchstart/move/end)
- **Performance**: Actualización en tiempo real sin lag
- **Canvas**: Redibujo optimizado durante arrastre

### Archivos Principales
- `js/main.js`: Funciones `handleDragStart`, `handleDragMove`, `handleDragEnd`
- `css/styles.css`: Estilos para bordes, cursores y mensajes
- `index.html`: Banners informativos y opciones de select

### Variables Clave
```javascript
isDragging          // Estado de arrastre activo
dragTarget          // 'text' o 'image'
textWatermarkBounds // Posición y tamaño del texto
imageWatermarkBounds // Posición y tamaño de la imagen
customTextPosition  // Posición personalizada del texto
customImagePosition // Posición personalizada de la imagen
```

---

## 📊 Comparativa: Antes vs Ahora

### ❌ Sistema Antiguo
```
1. Seleccionar "Posición personalizada"
2. Hacer click en la imagen
3. Deseleccionar "Posición personalizada"
4. Volver a seleccionar "Posición personalizada"
5. Hacer click de nuevo
6. Repetir pasos 3-5 para cada cambio
```
**Resultado**: 6 pasos para cada reposicionamiento ❌

### ✅ Sistema Actual
```
1. Seleccionar "🎯 Posición personalizada (arrastra para mover)"
2. Arrastrar el elemento
3. Arrastrar de nuevo si quieres
4. Arrastrar cuantas veces quieras
```
**Resultado**: 1 configuración, infinitos arrastres ✅

**Ahorro de tiempo**: 80% más rápido 🚀

---

## 🎉 Consejos y Trucos

### 💡 Para Ajustes Precisos
- Arrastra con movimientos pequeños
- Usa el zoom del canvas para ver detalles (luego zoom out para arrastrar)
- Los bordes punteados tienen padding, así que puedes hacer click cerca del elemento

### 🎨 Para Composiciones Visuales
- Prueba múltiples posiciones rápidamente
- Arrastra para comparar diferentes ubicaciones
- Los bordes de colores te ayudan a identificar qué estás moviendo

### ⚡ Para Máxima Velocidad
- No necesitas precisión perfecta en el primer arrastre
- Arrastra aproximadamente y luego ajusta
- El sistema es instantáneo, experimenta libremente

---

## 📚 Documentación Relacionada

- **`DRAG_DROP_SYSTEM.md`**: Documentación técnica completa del sistema
- **`CHANGELOG.md`**: Historial de cambios (ver v3.1.3)
- **`README.md`**: Información general del proyecto

---

## 🆘 Soporte

Si encuentras algún problema o tienes sugerencias:
1. Verifica que estás usando la última versión
2. Prueba en modo incógnito (para descartar extensiones)
3. Revisa la consola del navegador (F12) para errores
4. Documenta los pasos para reproducir el problema

---

**Versión**: 3.1.3  
**Última actualización**: 2025-10-15  
**Sistema**: Drag & Drop Ultra Intuitivo  

✨ ¡Disfruta del sistema de arrastre más simple y claro! ✨

