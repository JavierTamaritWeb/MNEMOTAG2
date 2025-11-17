# 🖼️ MNEMOTAG

**EDITOR PROFESIONAL DE METADATOS E IMÁGENES**

Aplicación web completa para editar metadatos EXIF, aplicar filtros fotográficos, marcas de agua personalizadas y optimizar imágenes con soporte universal de formatos.

![Version](https://img.shields.io/badge/version-3.1.4-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-success.svg)

---

## ⭐ NOVEDADES v3.1.4

### 🐛 BUGS CRÍTICOS SOLUCIONADOS

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

---

## ⭐ CARACTERÍSTICAS v3.1.3

### 🎯 SISTEMA DRAG & DROP ULTRA INTUITIVO
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

### 📐 SISTEMA DE REGLAS MÉTRICAS Y COORDENADAS
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

### 🖱️ ZOOM OPTIMIZADO
**Control preciso sin accidentes**:

- ✅ **Desktop**: Zoom solo con botones (+, -, 🔍)
- ❌ **Rueda del mouse desactivada** en desktop (>767px)
- ✅ **Móvil**: Mantiene gestos táctiles y scroll wheel
- 💡 **Motivo**: Evitar cambios accidentales con Magic Mouse/trackpad

---

## 🚀 CARACTERÍSTICAS ANTERIORES

### v3.1.2

### 🎨 FEEDBACK VISUAL DE ESTADO
- 🔴🟢 Botones con indicadores de color dinámicos
- Vista previa de imágenes cargadas en miniatura
- Confirmación visual inmediata de acciones

### 📍 GEOLOCALIZACIÓN MEJORADA
- Obtención automática de coordenadas GPS
- Mensajes de estado contextuales (no intrusivos)
- Indicadores de éxito/error debajo de los campos

### 🎯 SECCIONES COLAPSABLES
- Todas las secciones principales son colapsables/expandibles
- Soporte para navegación por teclado (Enter/Space)
- Minimización automática del marco del card

## 🚀 CARACTERÍSTICAS v3.1

### ⌨️ ATAJOS DE TECLADO (MAC)
- ⌘+Z / ⌘+⇧+Z: Deshacer/Rehacer
- ⌘+S: Guardar
- ⌘+⇧+C: Copiar al portapapeles
- ⌘+B: Procesamiento por lotes
- ⌘+T: Capas de texto
- ⌘+R: Recorte

### 📦 PROCESAMIENTO POR LOTES
- Hasta 50 imágenes simultáneas
- Exportación automática en ZIP
- Barra de progreso en tiempo real

### 🎨 CAPAS DE TEXTO
- Hasta 10 capas independientes
- 20+ Google Fonts
- Efectos avanzados

### ✂️ RECORTE INTELIGENTE
- 7 proporciones predefinidas
- Modo personalizado
- Sugerencias automáticas

### 📂 SECCIONES COLAPSABLES
- 4 secciones principales: Metadatos, Marca de agua, Filtros, Configuración de salida
- Minimización completa del marco del card
- Delegación de eventos para máxima compatibilidad
- Soporte para teclado (Enter/Space)

### 📍 GEOLOCALIZACIÓN MEJORADA
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
