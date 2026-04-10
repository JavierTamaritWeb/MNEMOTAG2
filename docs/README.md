# 📚 IMGCRAFT - DOCUMENTACIÓN TÉCNICA

**Versión:** 3.4.20  
**Última actualización:** 10 de abril de 2026

> **⚠️ Aviso sobre las guías feature-by-feature**: los documentos `GUIA_ARRASTRE.md`, `DRAG_DROP_SYSTEM.md`, `V31_FEATURES.md`, `ZOOM_OPTIMIZADO.md`, etc., describen características de la serie v3.1 que **siguen existiendo y funcionando** en v3.4.20 — su contenido técnico es vigente. Las features nuevas de v3.3.11–v3.4.15 (paste portapapeles, histograma, paleta, curvas, historial visual, HEIC, PWA, AVIF EXIF real, eliminar fondo con IA, filter presets, ImageBitmap undo/redo, modularización en managers, Web Workers, Playwright E2E, etc.) viven principalmente en el [CHANGELOG.md](../CHANGELOG.md) y en el [README.md](../README.md) del proyecto. Consulta esos dos para el detalle de lo más reciente.

---

## 🔍 NAVEGACIÓN RÁPIDA

> 📖 **¿Buscas algo específico?** Consulta el [**INDICE_DOCUMENTACION.md**](INDICE_DOCUMENTACION.md) - Índice maestro con navegación por usuario, característica, nivel de detalle y versión.

---

## 📋 ÍNDICE DE DOCUMENTACIÓN

### 🎯 CARACTERÍSTICAS PRINCIPALES

- **[GUIA_ARRASTRE.md](GUIA_ARRASTRE.md)** - ⭐ **NUEVO v3.1.3** Guía completa del sistema de arrastre
  - Sistema drag & drop ultra intuitivo
  - Bordes visuales de colores (azul/naranja)
  - Modo claro y oscuro optimizado
  - Uso en desktop y móvil

- **[DRAG_DROP_SYSTEM.md](DRAG_DROP_SYSTEM.md)** - Documentación técnica del sistema drag & drop
  - Implementación detallada
  - Variables y funciones clave
  - Eventos mouse y touch
  - Gestión de conflictos

- **[V31_FEATURES.md](V31_FEATURES.md)** - Características v3.1 completas
  - Sistema de atajos de teclado (Mac optimizado)
  - Batch processing (procesamiento por lotes)
  - Capas de texto avanzadas
  - Recorte inteligente
  - Feedback visual de estado
  - Secciones colapsables
  - Geolocalización mejorada

### 🏗️ ARQUITECTURA Y ESTRUCTURA

- **[MODULAR_ARCHITECTURE.md](MODULAR_ARCHITECTURE.md)** - Arquitectura modular del proyecto
  - Estructura de carpetas
  - Sistema de managers
  - Patrón de diseño utilizado
  - Flujo de datos

### ⚡ OPTIMIZACIÓN Y RENDIMIENTO

- **[FILTER_OPTIMIZATION.md](FILTER_OPTIMIZATION.md)** - Sistema de optimización de filtros
  - Smart debouncing
  - Cache de filtros
  - Mejoras de rendimiento

- **[WORKER_INTEGRATION.md](WORKER_INTEGRATION.md)** - Integración de Web Workers (futuro)
  - Procesamiento asíncrono
  - Arquitectura de workers
  - Plan de implementación

### ✅ VALIDACIÓN Y SEGURIDAD

- **[ENHANCED_VALIDATION.md](ENHANCED_VALIDATION.md)** - Sistema de validación mejorado
  - Validación de metadatos EXIF
  - Sanitización de inputs
  - Manejo de errores
  - Seguridad de archivos

---

## ⭐ NOVEDADES v3.1.3 (15 Octubre 2025)

### 🎯 Sistema Drag & Drop Ultra Intuitivo

**Sistema completamente rediseñado** para máxima claridad y facilidad de uso:

#### Indicadores Visuales de Colores
- 🔵 **Texto**: Borde azul punteado cuando está en modo arrastre
- 🟠 **Imagen**: Borde naranja punteado cuando está en modo arrastre
- 💡 **Banners informativos**: Gradientes de color con mensajes claros
- 🌙 **Modo oscuro optimizado**: Colores de alto contraste

#### Funcionamiento Simplificado
1. Selecciona "🎯 Posición personalizada (arrastra para mover)"
2. **Simplemente arrastra** el elemento (sin pasos adicionales)
3. Arrastra cuantas veces quieras sin reconfigurar

#### Mejoras Técnicas
- ✅ Eliminado el sistema confuso de "click inicial"
- ✅ Bordes visuales siempre visibles en modo personalizado
- ✅ Mensajes claros: "ARRASTRA" en lugar de "Haz clic"
- ✅ Inicialización automática de posiciones
- ✅ Soporte completo para modo oscuro

**Documentación**: Ver [`GUIA_ARRASTRE.md`](GUIA_ARRASTRE.md) para guía completa

---

### 📐 Sistema de Reglas Métricas y Coordenadas

**Nueva herramienta profesional** para medición y posicionamiento preciso:

#### Características Principales
- 📏 **Reglas con Marcas**: Horizontal (eje X) y vertical (eje Y) cada 50px
- 📍 **Coordenadas en Tiempo Real**: Muestra `X: px, Y: px` del cursor
- 🎨 **Color Adaptativo**: Líneas blancas en fondo oscuro, negras en fondo claro
- 🎯 **Sistema de Coordenadas**: Origen (0,0) en esquina superior izquierda
- 🔘 **Toggle Simple**: Botón junto a controles de zoom para activar/desactivar

#### Implementación
- Detección automática de brillo con `getImageData()`
- Escalado correcto entre coordenadas reales y visuales
- Event listeners optimizados (mousemove, mouseenter, mouseleave)
- Limpieza completa al desactivar (sin residuos en DOM)
- Líneas guía con opacidad 70% para no obstruir

#### Casos de Uso
- Posicionamiento preciso de marcas de agua
- Verificación de dimensiones y medidas
- Alineación exacta de elementos
- Diseño profesional con coordenadas exactas

---

### 🖱️ Zoom Optimizado para Desktop

**Control preciso sin cambios accidentales**:

#### Desktop (>767px)
- ✅ Zoom **solo con botones**: +, -, 🔍 (100%)
- ❌ **Rueda del mouse/trackpad DESACTIVADA**
- 💡 Motivo: Evitar zoom accidental con Magic Mouse o trackpad

#### Móvil (<768px)
- ✅ Mantiene **gestos táctiles** (pinch-to-zoom)
- ✅ Mantiene **scroll wheel** para zoom
- ✅ Funcionalidad completa en dispositivos táctiles

---

## 📝 Historial de Versiones

### v3.1.2 (Octubre 2025)
- 🎨 Feedback Visual de Estado (botones con indicadores de color)
- 📂 Secciones Colapsables con delegación de eventos
- 📍 Geolocalización Mejorada con feedback contextual

### v3.1.1 y anteriores
**Ver [CHANGELOG.md](../CHANGELOG.md) para historial completo**

---

## 🚀 INICIO RÁPIDO PARA DESARROLLADORES

### REQUISITOS PREVIOS

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conocimientos de JavaScript ES6+
- Familiaridad con HTML5 Canvas API
- Editor de código (VS Code recomendado)

### ESTRUCTURA DEL PROYECTO

```
IMGCRAFT2/
├── index.html                 # Aplicación principal
├── README.md                  # Documentación de usuario
├── css/
│   └── styles.css            # Estilos personalizados
├── js/
│   ├── main.js               # Lógica principal
│   ├── image-processor.js    # Procesamiento de imágenes
│   ├── managers/             # Gestores modulares
│   └── utils/                # Utilidades
├── images/                   # Assets visuales
└── docs/                     # Esta documentación
```

---

## 📊 ESTADÍSTICAS DEL PROYECTO

- **Versión:** 3.1.3
- **Líneas de código:** ~21,800
- **Archivos de código:** 20 (HTML, JS, CSS)
- **Managers:** 10 módulos especializados
- **Utilidades:** 6 archivos auxiliares
- **Documentación:** 9 archivos técnicos
- **Estado:** Producción, estable

---

## 🔗 ENLACES ÚTILES

- **Repositorio:** [GitHub - IMGCRAFT2](https://github.com/JavierTamaritWeb/IMGCRAFT2)
- **Demo en vivo:** [ImgCraft App](https://javierTamaritWeb.github.io/IMGCRAFT2)
- **CHANGELOG:** [Ver historial de cambios](../CHANGELOG.md)

---

---

## 📚 GUÍAS Y DOCUMENTACIÓN TÉCNICA

### Guías de Usuario
- 📖 [**GUIA_ARRASTRE.md**](GUIA_ARRASTRE.md) - Sistema Drag & Drop para posicionamiento de marcas de agua
- 📐 [**GUIA_REGLAS_METRICAS.md**](GUIA_REGLAS_METRICAS.md) - Sistema de coordenadas y medición precisa

### Documentación Técnica
- 🎯 [**DRAG_DROP_SYSTEM.md**](DRAG_DROP_SYSTEM.md) - Implementación técnica del sistema de arrastre
- 🖱️ [**ZOOM_OPTIMIZADO.md**](ZOOM_OPTIMIZADO.md) - Sistema de zoom diferenciado por dispositivo
- 🏗️ [**MODULAR_ARCHITECTURE.md**](MODULAR_ARCHITECTURE.md) - Arquitectura modular del proyecto
- 🔍 [**FILTER_OPTIMIZATION.md**](FILTER_OPTIMIZATION.md) - Optimización de filtros con Web Workers
- 🛡️ [**ENHANCED_VALIDATION.md**](ENHANCED_VALIDATION.md) - Sistema de validación y seguridad
- 👷 [**WORKER_INTEGRATION.md**](WORKER_INTEGRATION.md) - Integración de Web Workers
- ✨ [**V31_FEATURES.md**](V31_FEATURES.md) - Características principales v3.1

---

**Autor:** Javier Tamarit  
**Última actualización:** 16 de octubre de 2025
