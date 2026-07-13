'use strict';

// ===== SECURITY MANAGER =====
// Módulo de seguridad y validación para MnemoTag v3.0

/**
 * SecurityManager - Gestión de validación y seguridad
 * 
 * Funcionalidades:
 * - Sanitización de texto (prevención XSS)
 * - Validación de archivos de imagen
 * - Validación de dimensiones
 * - Generación de previews seguros
 * - Validación de metadatos
 * - Validación de marcas de agua
 */
const SecurityManager = {
  // Sanitización de texto para prevenir XSS
  sanitizeText: function(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/[<>'"&]/g, function(match) {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match];
      })
      .trim();
  },

  // Validación de entrada de texto
  validateTextInput: function(text, maxLength = 500) {
    if (!text || typeof text !== 'string') return false;
    const sanitized = this.sanitizeText(text);
    return sanitized.length <= maxLength && sanitized.length > 0;
  },

  // Validación de archivos de imagen mejorada
  validateImageFile: function(file) {
    // Nota HEIC/HEIF: main.js convierte esos archivos a JPEG (con heic2any)
    // ANTES de llamar a validateImageFile, así que aquí nunca llega un MIME
    // de HEIC/HEIF. Aceptarlos era una rama muerta e inconsistente con
    // allowedExtensions (que nunca incluyó esas extensiones), así que se
    // eliminaron de la lista.
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    const maxSize = AppConfig.maxFileSize; // Usar AppConfig como fuente única
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: file?.name || 'Archivo desconocido',
        size: file?.size || 0,
        type: file?.type || 'Tipo desconocido',
        sizeFormatted: file ? this.formatFileSize(file.size) : '0 B'
      }
    };

    // Validación de existencia del archivo
    if (!file) {
      validation.isValid = false;
      validation.errors.push({
        type: 'MISSING_FILE',
        message: 'No se ha seleccionado ningún archivo',
        details: 'Por favor, selecciona una imagen para continuar.'
      });
      return validation;
    }

    // Validación de tipo MIME
    if (!allowedTypes.includes(file.type)) {
      validation.isValid = false;
      validation.errors.push({
        type: 'INVALID_FORMAT',
        message: 'Formato de archivo no válido',
        details: `Formato detectado: ${file.type}. Solo se permiten: JPG, JPEG, PNG, WEBP y AVIF.`,
        allowedFormats: ['JPG', 'JPEG', 'PNG', 'WEBP', 'AVIF']
      });
    }

    // Validación de tamaño de archivo
    if (file.size > maxSize) {
      validation.isValid = false;
      validation.errors.push({
        type: 'FILE_TOO_LARGE',
        message: 'El archivo es demasiado grande',
        details: `Tamaño actual: ${this.formatFileSize(file.size)}. Tamaño máximo permitido: ${this.formatFileSize(maxSize)}.`,
        currentSize: file.size,
        maxSize: maxSize
      });
    }

    // Validación del nombre del archivo
    const fileName = String(file.name || '');
    if (fileName.length > 255) {
      validation.isValid = false;
      validation.errors.push({
        type: 'FILENAME_TOO_LONG',
        message: 'El nombre del archivo es demasiado largo',
        details: `Longitud actual: ${fileName.length} caracteres. Máximo permitido: 255 caracteres.`
      });
    }

    // Rechazar controles ASCII/C1, separadores reservados y controles bidi.
    // Estos últimos pueden ocultar o invertir visualmente la extensión real.
    // La UI sigue usando textContent: esta validación es defensa en profundidad,
    // no el mecanismo primario contra XSS.
    const unsafeFileNameChars = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
    if (unsafeFileNameChars.test(fileName)) {
      validation.isValid = false;
      validation.errors.push({
        type: 'UNSAFE_FILENAME',
        message: 'El nombre del archivo contiene caracteres no permitidos',
        details: 'Renombra el archivo usando letras, números, espacios, guiones, guiones bajos y puntos.'
      });
    }

    // Verificar extensión del archivo
    const extension = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
    
    if (!extension || !allowedExtensions.includes(extension)) {
      validation.isValid = false;
      validation.errors.push({
        type: 'INVALID_EXTENSION',
        message: 'Extensión de archivo no válida',
        details: `Extensión detectada: .${extension || 'ninguna'}. Extensiones permitidas: ${allowedExtensions.join(', ')}.`
      });
    }

    // Verificación adicional: MIME vs extensión
    const mimeToExtensions = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'image/avif': ['avif']
    };

    const expectedExtensions = mimeToExtensions[file.type];
    if (expectedExtensions && extension && !expectedExtensions.includes(extension)) {
      validation.warnings.push({
        type: 'MIME_EXTENSION_MISMATCH',
        message: 'La extensión no coincide completamente con el tipo de archivo',
        details: `Tipo detectado: ${file.type}, extensión: .${extension}. Esto podría indicar un problema con el archivo.`
      });
    }

    // Validaciones adicionales para archivos pequeños (posibles archivos corruptos)
    if (file.size < 1024) { // Menos de 1KB
      validation.warnings.push({
        type: 'SUSPICIOUSLY_SMALL',
        message: 'El archivo es muy pequeño',
        details: 'Archivos de imagen muy pequeños podrían estar corruptos o vacíos.'
      });
    }

    return validation;
  },

  // Validación de dimensiones de imagen (se ejecuta después de cargar)
  validateImageDimensions: function(image, maxDimensions = { width: 8000, height: 8000 }) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      dimensions: {
        width: image.width || image.naturalWidth || 0,
        height: image.height || image.naturalHeight || 0
      }
    };

    const { width, height } = validation.dimensions;

    // Validar dimensiones máximas
    if (width > maxDimensions.width || height > maxDimensions.height) {
      validation.isValid = false;
      validation.errors.push({
        type: 'DIMENSIONS_TOO_LARGE',
        message: 'Las dimensiones de la imagen son demasiado grandes',
        details: `Dimensiones actuales: ${width}x${height}px. Máximo permitido: ${maxDimensions.width}x${maxDimensions.height}px.`,
        currentDimensions: { width, height },
        maxDimensions: maxDimensions
      });
    }

    // Validar dimensiones mínimas
    if (width < 1 || height < 1) {
      validation.isValid = false;
      validation.errors.push({
        type: 'INVALID_DIMENSIONS',
        message: 'Dimensiones de imagen inválidas',
        details: `Dimensiones detectadas: ${width}x${height}px. Las dimensiones deben ser mayores a 0.`
      });
    }

    // Advertencias para imágenes muy grandes
    if (width > 4000 || height > 4000) {
      validation.warnings.push({
        type: 'LARGE_DIMENSIONS',
        message: 'Imagen de dimensiones grandes detectada',
        details: `Dimensiones: ${width}x${height}px. El procesamiento podría ser más lento.`
      });
    }

    // Advertencias para imágenes muy pequeñas
    if (width < 100 || height < 100) {
      validation.warnings.push({
        type: 'SMALL_DIMENSIONS',
        message: 'Imagen de dimensiones pequeñas',
        details: `Dimensiones: ${width}x${height}px. La calidad podría verse afectada al redimensionar.`
      });
    }

    return validation;
  },

  // Generar preview del archivo antes de cargar
  generateFilePreview: function(file, callback) {
    if (!file || typeof callback !== 'function') {
      if (typeof callback === 'function') callback(null, 'Parámetros inválidos para generar preview');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const img = new Image();
        
        img.onload = function() {
          URL.revokeObjectURL(objectUrl);
          // Crear canvas para el preview
          const previewCanvas = document.createElement('canvas');
          const previewCtx = previewCanvas.getContext('2d');
          
          // Calcular dimensiones del preview (máximo 300px)
          const maxPreviewSize = 300;
          let previewWidth = img.width;
          let previewHeight = img.height;
          
          if (previewWidth > maxPreviewSize || previewHeight > maxPreviewSize) {
            const ratio = Math.min(maxPreviewSize / previewWidth, maxPreviewSize / previewHeight);
            previewWidth = previewWidth * ratio;
            previewHeight = previewHeight * ratio;
          }
          
          previewCanvas.width = previewWidth;
          previewCanvas.height = previewHeight;
          
          // Dibujar preview
          previewCtx.drawImage(img, 0, 0, previewWidth, previewHeight);
          
          const previewData = {
            dataUrl: previewCanvas.toDataURL('image/jpeg', 0.8),
            decodedImage: img,
            originalDimensions: { width: img.width, height: img.height },
            previewDimensions: { width: previewWidth, height: previewHeight },
            fileInfo: {
              name: file.name,
              size: SecurityManager.formatFileSize(file.size),
              type: file.type,
              lastModified: new Date(file.lastModified).toLocaleString()
            }
          };
          
          callback(previewData, null);
        };
        
        img.onerror = function() {
          URL.revokeObjectURL(objectUrl);
          callback(null, 'Error al cargar la imagen para preview');
        };
        
        img.src = objectUrl;
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        callback(null, 'Error al procesar el archivo: ' + error.message);
      }
  },

  // Formatear tamaño de archivo
  formatFileSize: function(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  },

  // Validación de metadatos
  validateMetadata: function(metadata) {
    const validation = {
      isValid: true,
      errors: {},
      sanitized: {}
    };

    const fields = {
      title: { maxLength: 100, required: false },
      author: { maxLength: 100, required: false },
      description: { maxLength: 500, required: false },
      keywords: { maxLength: 200, required: false },
      copyright: { maxLength: 200, required: false }
    };

    for (const [field, rules] of Object.entries(fields)) {
      const value = metadata[field] || '';
      // Validar longitud sobre el texto ORIGINAL (trimmed), no sobre el
      // sanitizado: las entidades expanden ('&' → '&amp;') y un texto
      // legítimo dentro del límite se rechazaba injustamente.
      const original = typeof value === 'string' ? value.trim() : '';

      if (rules.required && !original) {
        validation.isValid = false;
        validation.errors[field] = 'Este campo es obligatorio';
        continue;
      }

      if (original.length > rules.maxLength) {
        validation.isValid = false;
        validation.errors[field] = `Máximo ${rules.maxLength} caracteres permitidos`;
        continue;
      }

      // Sanitizar DESPUÉS de validar la longitud.
      validation.sanitized[field] = this.sanitizeText(value);
    }

    return validation;
  },

  // Validación de marca de agua de texto
  validateWatermarkText: function(text, size, opacity) {
    const validation = {
      isValid: true,
      errors: []
    };

    if (!text || typeof text !== 'string') {
      validation.errors.push(
        'La marca de agua de texto está habilitada pero el campo de texto está vacío. ' +
        'Escribe un texto en «Texto de la marca de agua», o desmarca la casilla ' +
        '«Habilitar marca de agua de texto» si solo quieres usar marca de agua de imagen.'
      );
      validation.isValid = false;
    } else {
      const sanitized = this.sanitizeText(text);
      if (sanitized.length > 100) {
        validation.errors.push('El texto de la marca de agua no puede exceder 100 caracteres');
        validation.isValid = false;
      }
    }

    const sizeNum = parseInt(size);
    if (isNaN(sizeNum) || sizeNum < 10 || sizeNum > 200) {
      validation.errors.push('El tamaño debe estar entre 10 y 200 píxeles');
      validation.isValid = false;
    }

    const opacityNum = parseInt(opacity);
    if (isNaN(opacityNum) || opacityNum < 0 || opacityNum > 100) {
      validation.errors.push('La opacidad debe estar entre 0 y 100');
      validation.isValid = false;
    }

    return validation;
  },

  /**
   * Valida el archivo usado como marca de agua antes de decodificarlo.
   * Tiene un límite propio, más estricto que el de la imagen principal,
   * porque permanece residente durante toda la sesión de edición.
   */
  validateWatermarkImageFile: function(file) {
    const validation = this.validateImageFile(file);
    if (!file || !validation.isValid) return validation;

    const maxSize = AppConfig.watermarkMaxFileSize;
    if (file.size > maxSize) {
      validation.isValid = false;
      validation.errors.push({
        type: 'WATERMARK_FILE_TOO_LARGE',
        message: 'La imagen de marca de agua es demasiado grande',
        details: `Tamaño actual: ${this.formatFileSize(file.size)}. Tamaño máximo permitido: ${this.formatFileSize(maxSize)}.`
      });
    }
    return validation;
  },

  /**
   * Valida el raster de una marca de agua una vez decodificado.
   */
  validateWatermarkImageDimensions: function(image) {
    const width = image?.naturalWidth || image?.width || 0;
    const height = image?.naturalHeight || image?.height || 0;
    const maxDimension = AppConfig.watermarkMaxDimension;
    const maxPixels = AppConfig.watermarkMaxPixels;
    const errors = [];

    if (width < 1 || height < 1) {
      errors.push('La imagen de marca de agua no tiene dimensiones válidas');
    } else if (width > maxDimension || height > maxDimension || width * height > maxPixels) {
      errors.push(
        `La marca de agua supera el límite de ${maxDimension}px por lado o ` +
        `${Math.round(maxPixels / 1000000)} megapíxeles`
      );
    }

    return { isValid: errors.length === 0, errors, width, height };
  },

  // ===== VALIDACIÓN DE NOMBRES DE ARCHIVO =====

  /**
   * Valida un nombre base de archivo (sin extensión)
   * @param {string} basename - Nombre base a validar
   * @returns {boolean} true si es válido
   */
  isValidFileBaseName: function(basename) {
    if (!basename || typeof basename !== 'string') return false;
    
    // Verificar longitud
    if (basename.length < 1 || basename.length > 60) return false;
    
    // No debe empezar o terminar con puntos
    if (/^\.+|\.+$/.test(basename)) return false;
    
    // Solo caracteres permitidos
    const validPattern = /^[A-Za-z0-9 _\-.áéíóúÁÉÍÓÚñÑüÜ]+$/;
    if (!validPattern.test(basename)) return false;
    
    // Verificar nombres reservados en Windows
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(basename.trim())) return false;
    
    return true;
  },

  /**
   * Obtiene mensaje de error específico para nombre de archivo inválido
   * @param {string} basename - Nombre base que falló la validación
   * @returns {string} Mensaje de error descriptivo
   */
  getFileBaseNameError: function(basename) {
    if (!basename) return "El nombre no puede estar vacío";
    
    if (basename.length > 60) return "El nombre es demasiado largo (máx. 60 caracteres)";
    
    if (/^\.+|\.+$/.test(basename)) return "El nombre no puede empezar o terminar con puntos";
    
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(basename.trim())) return "Nombre reservado del sistema no permitido";
    
    if (!/^[A-Za-z0-9 _\-.áéíóúÁÉÍÓÚñÑüÜ]+$/.test(basename)) {
      return "Solo se permiten letras, números, espacios, guiones y guiones bajos";
    }
    
    return "Nombre de archivo no válido";
  }
};

// NOTA: la antigua función global `sanitizeFilename` se eliminó en v3.3.3
// como código muerto. Era un duplicado peor que `sanitizeFileBaseName` de
// `js/utils/helpers.js` (que sí preserva tildes y eñes y se usa de verdad
// en `main.js`). Para sanitizar nombres de archivo, usar `sanitizeFileBaseName`
// y `SecurityManager.isValidFileBaseName`.

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecurityManager };
}
