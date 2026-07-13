'use strict';

// ===== APP CONFIG =====
// Configuración global para MnemoTag v3.0

/**
 * AppConfig - Configuración centralizada de la aplicación
 * 
 * Contiene todas las configuraciones globales:
 * - Límites de archivos y validación
 * - Configuración del canvas
 * - Límites de texto por campo
 * - Configuraciones de rendimiento
 * - Configuraciones de UI/UX
 */
const AppConfig = {
  // File validation settings
  maxFileSize: 25 * 1024 * 1024, // 25MB

  // ÚNICA fuente de verdad del límite de imágenes por lote (v3.5.14).
  // La UI del modal batch y BatchManager leen este valor — no dupliques
  // el número en ningún otro sitio.
  batchMaxImages: 20,
  // Límites de memoria del lote. Se expresan en píxeles porque el coste
  // dominante al decodificar es width * height * 4 bytes (RGBA), no el peso
  // comprimido del archivo en disco.
  batchMaxPixelsPerImage: 36 * 1000 * 1000,
  batchMaxTotalPixels: 80 * 1000 * 1000,
  // Presupuesto de trabajo, distinto al límite agregado: durante el proceso
  // conviven el raster decodificado y el canvas RGBA (≈8 bytes/píxel).
  batchWorkingBytesPerPixel: 8,
  batchWorkingMemoryBudgetBytes: 320 * 1024 * 1024,
  // v3.7.0: imágenes del lote procesadas EN PARALELO. Acotado a 1-2 por
  // BatchManager: la cola decodifica bajo demanda y más de 2 canvas grandes
  // simultáneos disparan el pico de memoria sin apenas mejorar el tiempo.
  batchConcurrency: 2,
  // Una marca de agua se mantiene decodificada durante toda la edición.
  // Estos límites evitan retener accidentalmente rasters desproporcionados.
  watermarkMaxFileSize: 10 * 1024 * 1024,
  watermarkMaxDimension: 4096,
  watermarkMaxPixels: 16 * 1000 * 1000,
  historyMaxMemoryBytes: 100 * 1024 * 1024,
  // GIF eliminado: el pipeline nunca lo soportó (SecurityManager y el
  // resto del código no lo aceptan), tenerlo aquí inducía a error.
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  
  // Canvas settings - Aumentado para mantener calidad original
  maxCanvasWidth: 2400,  // Aumentado de 800 a 2400 para alta resolución
  maxCanvasHeight: 2400, // Aumentado de 600 a 2400 para mantener calidad
  
  // Validation limits
  maxTextLength: {
    title: 100,
    author: 100,
    description: 500,
    keywords: 200,
    copyright: 200,
    watermarkText: 100
  },
  
  // Performance settings
  debounceDelay: 300,
  throttleDelay: 100,
  previewDebounceDelay: 150,

  // Zoom settings
  minZoom: 0.1,
  maxZoom: 5.0,
  zoomStep: 0.1,
  wheelZoomStep: 0.05,

  // UI settings
  animationDuration: 300,
  toastDuration: 3000,
  errorDuration: 5000,
  modalZIndex: 10000,
  overlayZIndex: 9999
};

// Flag de debug global: activar con ?debug=1 en la URL o localStorage.
// Definida aquí (app-config carga primero) para que TODOS los módulos la usen.
const MNEMOTAG_DEBUG = (typeof location !== 'undefined' && location.search.indexOf('debug=1') !== -1) ||
                       (typeof localStorage !== 'undefined' && localStorage.getItem('mnemotag-debug') === '1');

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppConfig, MNEMOTAG_DEBUG };
}
