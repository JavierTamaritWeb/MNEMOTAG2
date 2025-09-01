// ===== HELPERS =====
// Funciones utilitarias para MnemoTag v3.0

/**
 * Helpers - Funciones utilitarias y de apoyo
 * 
 * Contiene:
 * - Funciones de control de flujo (debounce, throttle)
 * - Funciones de formato (archivos, números)
 * - Funciones de conversión de canvas
 * - Utilidades para manejo de archivos
 */

// ===== CONTROL DE FLUJO =====

/**
 * Debounce function para optimizar eventos
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce aplicado
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function para eventos de alta frecuencia
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función con throttle aplicado
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ===== FUNCIONES DE FORMATO =====

/**
 * Formatear tamaño de archivo en formato legible
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado (ej: "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Formatear número con separador de miles
 * @param {number} num - Número a formatear
 * @returns {string} Número formateado con "px" (ej: "1.024 px")
 */
function formatNumber(num) {
  return num.toLocaleString('es-ES') + ' px';
}

// ===== MANEJO DE FORMATOS =====

/**
 * Obtener extensión de archivo según formato
 * @param {string} format - Formato de imagen ('jpeg', 'png', 'webp', 'avif')
 * @returns {string} Extensión correspondiente
 */
function getFileExtension(format) {
  const extensions = {
    'jpeg': 'jpg',
    'png': 'png',
    'webp': 'webp',
    'avif': 'avif'
  };
  return extensions[format] || 'jpg';
}

/**
 * Obtener tipo MIME según formato
 * @param {string} format - Formato de imagen
 * @returns {string} Tipo MIME correspondiente
 */
function getMimeType(format) {
  const mimeTypes = {
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'avif': 'image/avif'
  };
  return mimeTypes[format] || 'image/jpeg';
}

// ===== CONVERSIÓN DE CANVAS =====

/**
 * Convertir canvas a blob con soporte mejorado y fallbacks
 * @param {HTMLCanvasElement} canvas - Canvas a convertir
 * @param {string} mimeType - Tipo MIME de salida
 * @param {number} quality - Calidad de compresión (0-1)
 * @returns {Promise<Blob>} Promise que resuelve con el blob
 */
async function canvasToBlob(canvas, mimeType, quality = 0.9) {
  try {
    // Use native canvas.toBlob method with fallback support
    return await new Promise((resolve, reject) => {
      // Check if browser supports the requested format
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      
      // Test format support
      const testDataUrl = tempCanvas.toDataURL(mimeType);
      if (!testDataUrl.startsWith(`data:${mimeType}`)) {
        // Format not supported, fallback to JPEG
        console.warn(`Format ${mimeType} not supported, falling back to JPEG`);
        mimeType = 'image/jpeg';
      }
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, mimeType, quality);
    });
    
  } catch (error) {
    console.error('Error with canvas conversion:', error);
    // Final fallback to JPEG
    return canvasToBlob_fallback(canvas, 'image/jpeg', quality);
  }
}

/**
 * Función de fallback para conversión de canvas
 * @param {HTMLCanvasElement} canvas - Canvas a convertir
 * @param {string} mimeType - Tipo MIME de salida
 * @param {number} quality - Calidad de compresión (0-1)
 * @returns {Promise<Blob>} Promise que resuelve con el blob
 */
function canvasToBlob_fallback(canvas, mimeType, quality = 0.9) {
  return new Promise((resolve, reject) => {
    try {
      // For formats that don't support quality, ignore the quality parameter
      if (mimeType === 'image/png') {
        canvas.toBlob(resolve, mimeType);
      } else {
        canvas.toBlob(resolve, mimeType, quality);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debounce,
    throttle,
    formatFileSize,
    formatNumber,
    getFileExtension,
    getMimeType,
    canvasToBlob,
    canvasToBlob_fallback
  };
}
