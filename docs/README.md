# 📚 MNEMOTAG - DOCUMENTACIÓN TÉCNICA

**Versión:** 3.1.3  
**Última actualización:** 15 Octubre 2025

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
