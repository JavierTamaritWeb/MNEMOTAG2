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
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    const maxSize = 25 * 1024 * 1024; // 25MB
    
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
    const fileName = file.name;
    if (fileName.length > 255) {
      validation.isValid = false;
      validation.errors.push({
        type: 'FILENAME_TOO_LONG',
        message: 'El nombre del archivo es demasiado largo',
        details: `Longitud actual: ${fileName.length} caracteres. Máximo permitido: 255 caracteres.`
      });
    }

    // Validación de caracteres especiales en el nombre
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
    if (invalidChars.test(fileName)) {
      validation.warnings.push({
        type: 'INVALID_FILENAME_CHARS',
        message: 'El nombre contiene caracteres no recomendados',
        details: 'Se recomienda usar solo letras, números, guiones y puntos.'
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
      callback(null, 'Parámetros inválidos para generar preview');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const img = new Image();
        
        img.onload = function() {
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
          callback(null, 'Error al cargar la imagen para preview');
        };
        
        img.src = e.target.result;
      } catch (error) {
        callback(null, 'Error al procesar el archivo: ' + error.message);
      }
    };
    
    reader.onerror = function() {
      callback(null, 'Error al leer el archivo');
    };
    
    reader.readAsDataURL(file);
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
      const sanitized = this.sanitizeText(value);
      
      if (rules.required && !sanitized) {
        validation.isValid = false;
        validation.errors[field] = 'Este campo es obligatorio';
        continue;
      }

      if (sanitized.length > rules.maxLength) {
        validation.isValid = false;
        validation.errors[field] = `Máximo ${rules.maxLength} caracteres permitidos`;
        continue;
      }

      validation.sanitized[field] = sanitized;
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
      validation.errors.push('El texto de la marca de agua es requerido');
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
  }
};

// Función utilitaria para sanitizar nombres de archivo
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'imagen_editada';
  
  return filename
    .toLowerCase()
    .replace(/[^\w\s.-]/g, '') // Solo permitir letras, números, espacios, puntos y guiones
    .replace(/\s+/g, '-')      // Reemplazar espacios con guiones
    .replace(/-+/g, '-')       // Eliminar guiones múltiples
    .replace(/^-+|-+$/g, '')   // Eliminar guiones al inicio y final
    .substring(0, 100)         // Limitar longitud
    .trim() || 'imagen_editada'; // Fallback si queda vacío
}

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecurityManager, sanitizeFilename };
}
