# 📚 MNEMOTAG - DOCUMENTACIÓN TÉCNICA

**Versión:** 3.1.2  
**Última actualización:** Octubre 2025

---

## 📋 ÍNDICE DE DOCUMENTACIÓN

### 🎯 CARACTERÍSTICAS PRINCIPALES

- **[V31_FEATURES.md](V31_FEATURES.md)** - Documentación completa de características v3.1.2
  - Sistema de atajos de teclado (Mac optimizado)
  - Batch processing (procesamiento por lotes)
  - Capas de texto avanzadas
  - Recorte inteligente
  - **Feedback visual de estado** ⭐ v3.1.2
  - **Secciones colapsables** ⭐ v3.1.2
  - **Geolocalización mejorada** ⭐ v3.1.2

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

## ⭐ NOVEDADES v3.1.2 (Octubre 2025)

### 1. 🎨 Feedback Visual de Estado
- Botones con indicadores de color (rojo sin carga → verde cargado)
- Miniaturas de preview (48x48px imagen principal, 40x40px marca de agua)
- Transiciones suaves y efectos hover
- Soporte completo para modo oscuro

### 2. 📂 Secciones Colapsables
- 4 secciones minimizables (Metadatos, Marca de agua, Filtros, Salida)
- **Delegación de eventos** con `capture: true` para máxima robustez
- Minimización completa del marco del card
- Soporte para teclado (Enter/Space)
- Animaciones CSS optimizadas

### 3. 📍 Geolocalización Mejorada
- Obtención automática de coordenadas GPS
- 3 estados visuales (loading azul, success verde, error rojo)
- Feedback contextual debajo de campos (sin toasts flotantes)
- Manejo específico de errores (permisos, timeout, disponibilidad)
- Precisión de 6 decimales

### 🐛 Bugs Solucionados
- ✅ Secciones no minimizaban marco del card
- ✅ Sección 2 no se podía abrir
- ✅ Toast flotante de geolocalización
- ✅ Sección 5 no respondía a clicks (solucionado con delegación de eventos)

**Ver [CHANGELOG.md](../CHANGELOG.md) para detalles completos**

---

## 🚀 INICIO RÁPIDO PARA DESARROLLADORES

### REQUISITOS PREVIOS

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conocimientos de JavaScript ES6+
- Familiaridad con HTML5 Canvas API
- Editor de código (VS Code recomendado)

### ESTRUCTURA DEL PROYECTO

```
MNEMOTAG2/
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

- **Versión:** 3.1.2
- **Líneas de código:** ~20,500
- **Archivos de código:** 20 (HTML, JS, CSS)
- **Managers:** 10 módulos especializados
- **Utilidades:** 6 archivos auxiliares
- **Documentación:** 6 archivos técnicos
- **Estado:** Producción, estable

---

## 🔗 ENLACES ÚTILES

- **Repositorio:** [GitHub - MNEMOTAG2](https://github.com/JavierTamaritWeb/MNEMOTAG2)
- **Demo en vivo:** [MnemoTag App](https://javierTamaritWeb.github.io/MNEMOTAG2)
- **CHANGELOG:** [Ver historial de cambios](../CHANGELOG.md)

---

**Autor:** Javier Tamarit  
**Última actualización:** 13 de octubre de 2025
