'use strict';

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

// ===== MANEJO DE NOMBRES DE ARCHIVO =====

/**
 * Sanitiza el nombre base del archivo (sin extensión)
 * @param {string} name - Nombre a sanitizar
 * @returns {string} Nombre sanitizado
 */
function sanitizeFileBaseName(name) {
  if (!name || typeof name !== 'string') return "imagen";
  
  // Normalizar Unicode para consistencia
  let s = name.normalize("NFC");
  
  // Quitar extensión si la trae
  s = s.replace(/\.[A-Za-z0-9]+$/i, "");
  
  // Colapsar espacios múltiples
  s = s.replace(/\s+/g, " ");
  
  // Quitar puntos al inicio y fin
  s = s.trim().replace(/^\.+|\.+$/g, "");
  
  // Permitir solo caracteres válidos: letras, números, espacio, _, -, . y tildes/ñ
  const allowed = /[^A-Za-z0-9 _\-.áéíóúÁÉÍÓÚñÑüÜ]/g;
  s = s.replace(allowed, "");
  
  // Si queda vacío tras sanitizar, usar fallback
  if (!s) s = "imagen";
  
  // Limitar longitud máxima
  return s.slice(0, 60);
}

/**
 * Extrae el nombre base de un archivo (sin extensión)
 * @param {string} filename - Nombre del archivo completo
 * @returns {string} Nombre base sin extensión
 */
function extractFileBaseName(filename) {
  if (!filename) return "imagen";
  
  // Obtener solo el nombre del archivo (sin path)
  const baseName = filename.split('/').pop().split('\\').pop();
  
  // Quitar extensión
  const nameWithoutExt = baseName.replace(/\.[^.]*$/, '');
  
  return sanitizeFileBaseName(nameWithoutExt);
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
  // Antes (v3.3.3 y anteriores) había aquí un test prematuro que creaba un
  // canvas 1×1 vacío y testaba toDataURL(mimeType) para decidir si forzar
  // JPEG. Ese test podía dar falsos negativos en navegadores con WebP/AVIF
  // soportados. Eliminado en v3.3.4: confiamos en que canvas.toBlob() devuelva
  // null al callback si el formato no está soportado, y caemos al fallback.
  try {
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`canvas.toBlob devolvió null para ${mimeType}`));
        }
      }, mimeType, quality);
    });
  } catch (error) {
    console.warn(`canvasToBlob falló para ${mimeType}, cayendo a JPEG:`, error.message || error);
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

// ===== DETECCIÓN DE SOPORTE DE FORMATOS =====

/**
 * Cache para resultados de detección de soporte
 */
const formatSupportCache = new Map();

/**
 * Detectar soporte de decodificación de formato de imagen
 * @param {string} mimeType - Tipo MIME a verificar
 * @returns {Promise<boolean>} True si el formato es soportado para decodificación
 */
async function supportsDecode(mimeType) {
  const cacheKey = `decode_${mimeType}`;
  if (formatSupportCache.has(cacheKey)) {
    return formatSupportCache.get(cacheKey);
  }

  try {
    // Crear una imagen test muy pequeña
    const testDataUrls = {
      'image/avif': 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=',
      'image/webp': 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==',
      'image/jpeg': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8='
    };

    const testDataUrl = testDataUrls[mimeType];
    if (!testDataUrl) {
      formatSupportCache.set(cacheKey, false);
      return false;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        img.onload = img.onerror = null;
        formatSupportCache.set(cacheKey, false);
        resolve(false);
      }, 2000);

      img.onload = () => {
        clearTimeout(timeout);
        const supported = img.width > 0 && img.height > 0;
        formatSupportCache.set(cacheKey, supported);
        resolve(supported);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        formatSupportCache.set(cacheKey, false);
        resolve(false);
      };

      img.src = testDataUrl;
    });
  } catch (error) {
    formatSupportCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Detectar soporte de codificación de formato de imagen
 * @param {string} mimeType - Tipo MIME a verificar
 * @returns {Promise<boolean>} True si el formato es soportado para codificación
 */
async function supportsEncode(mimeType) {
  const cacheKey = `encode_${mimeType}`;
  if (formatSupportCache.has(cacheKey)) {
    return formatSupportCache.get(cacheKey);
  }

  try {
    // Crear un canvas pequeño para test
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);

    // Test toDataURL
    const dataUrl = testCanvas.toDataURL(mimeType);
    const supported = dataUrl.startsWith(`data:${mimeType}`);
    
    formatSupportCache.set(cacheKey, supported);
    return supported;
  } catch (error) {
    formatSupportCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Determinar formato de fallback basado en soporte DE EXPORTACIÓN del navegador.
 *
 * Nota importante (cambio en v3.3.2): la lógica anterior forzaba PNG cuando
 * el formato preferido era JPEG y la imagen tenía canal alpha. Eso rompía la
 * conversión de formato (PNG transparente → JPG quedaba como PNG, sin avisar).
 * Ahora se RESPETA la elección del usuario; el aplanado contra blanco para
 * JPEG se hace en main.js antes de invocar canvas.toBlob/toDataURL, vía
 * `flattenCanvasForJpeg(canvas)`.
 *
 * @param {boolean} hasAlpha - Si la imagen tiene canal alpha (se mantiene en
 *                             la firma por compatibilidad y para los fallbacks
 *                             de AVIF/WebP no soportados, donde sí se elige
 *                             PNG vs JPEG según transparencia).
 * @param {string} preferredFormat - Formato preferido
 * @returns {Promise<string>} Formato final a usar
 */
async function determineFallbackFormat(hasAlpha, preferredFormat = 'image/jpeg') {
  // Primero verificar si el formato preferido soporta EXPORTACIÓN
  const supportsExport = await supportsEncode(preferredFormat);

  // Si el formato preferido NO se puede exportar, buscar alternativas
  if (!supportsExport) {
    console.info(`Formato ${preferredFormat} no soporta exportación, buscando alternativa...`);

    // Cadena de fallback para exportación
    if (preferredFormat === 'image/avif') {
      // AVIF → WebP → PNG/JPEG
      if (await supportsEncode('image/webp')) {
        console.info('AVIF no soportado, usando WebP como fallback');
        return 'image/webp';
      } else {
        console.info('AVIF y WebP no soportados, usando PNG/JPEG según transparencia');
        return hasAlpha ? 'image/png' : 'image/jpeg';
      }
    } else if (preferredFormat === 'image/webp') {
      // WebP → PNG/JPEG
      console.info('WebP no soportado, usando PNG/JPEG según transparencia');
      return hasAlpha ? 'image/png' : 'image/jpeg';
    }
  }

  // Respetar la elección del usuario. Si pidió JPEG con alpha, el aplanado
  // ocurre en main.js justo antes del export, no aquí.
  return preferredFormat;
}

/**
 * Aplana un canvas con transparencia contra un fondo blanco, devolviendo un
 * canvas nuevo apto para exportar como JPEG sin que las áreas transparentes
 * salgan en negro (default del codec JPEG).
 *
 * Este helper se usa en el flujo de descarga de main.js cuando el formato
 * elegido es JPEG. No se aplica a PNG/WebP/AVIF, que sí preservan alpha.
 *
 * @param {HTMLCanvasElement} canvas - Canvas original (con o sin transparencia)
 * @returns {HTMLCanvasElement} Canvas nuevo con fondo blanco + contenido encima
 */
function flattenCanvasForJpeg(canvas, backgroundColor) {
  if (!canvas) return canvas;
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const flatCtx = flat.getContext('2d');
  // Defensivo: en entornos donde getContext devuelve null (tests con stubs,
  // browsers obsoletos sin Canvas2D), degradamos elegantemente devolviendo
  // el canvas original sin tocar. En producción esto no debería ocurrir.
  if (!flatCtx) return canvas;
  // Color de aplanado (default blanco, coherente con Photoshop/GIMP).
  // Desde v3.3.5 el usuario puede elegirlo desde la UI; pasar el valor
  // hex aquí. Si no llega, usar blanco.
  flatCtx.fillStyle = (typeof backgroundColor === 'string' && backgroundColor.startsWith('#'))
    ? backgroundColor
    : '#ffffff';
  flatCtx.fillRect(0, 0, flat.width, flat.height);
  // Imagen original encima, preservando alpha original (que se aplanará al
  // exportar como JPEG porque el codec descarta el canal alpha).
  flatCtx.drawImage(canvas, 0, 0);
  return flat;
}

/**
 * Verificar si la imagen tiene canal alpha
 * @param {HTMLCanvasElement} canvas - Canvas con la imagen
 * @returns {boolean} True si tiene transparencia
 */
function hasImageAlphaChannel(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Verificar canal alpha en una muestra de píxeles
  const sampleSize = Math.min(1000, data.length / 4);
  const step = Math.floor((data.length / 4) / sampleSize);

  for (let i = 0; i < sampleSize; i++) {
    const alphaIndex = (i * step * 4) + 3;
    if (alphaIndex < data.length && data[alphaIndex] < 255) {
      return true; // Encontró transparencia
    }
  }

  return false; // No hay transparencia
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
    canvasToBlob_fallback,
    supportsDecode,
    supportsEncode,
    determineFallbackFormat,
    hasImageAlphaChannel,
    flattenCanvasForJpeg
  };
}
