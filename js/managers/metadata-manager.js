// ===== METADATA MANAGER =====
// Gestión de metadatos EXIF y geolocalización para MnemoTag v3.0

/**
 * MetadataManager - Sistema de gestión de metadatos EXIF
 * 
 * Funcionalidades:
 * - Generación automática de copyright
 * - Obtención de ubicación GPS
 * - Gestión de metadatos EXIF
 * - Persistencia de metadatos en localStorage
 * - Aplicación de metadatos a imágenes exportadas
 */

const MetadataManager = {
  // Configuración de copyright
  copyrightTemplates: [
    '© {year} {author}. Todos los derechos reservados.',
    '© {year} {author}',
    'Copyright {year} by {author}',
    '{author} © {year}'
  ],
  
  /**
   * Generar copyright automático
   * @param {string} author - Nombre del autor
   * @returns {string} Copyright generado
   */
  generateCopyright: function(author = '') {
    const year = new Date().getFullYear();
    const authorName = author || document.getElementById('metaAuthor')?.value || 'Autor';
    const template = this.copyrightTemplates[0]; // Usar plantilla por defecto
    
    return template
      .replace('{year}', year)
      .replace('{author}', authorName);
  },
  
  /**
   * Obtener ubicación actual del usuario usando GPS
   */
  getCurrentLocation: function() {
    const locationStatus = document.getElementById('locationStatus');
    const latInput = document.getElementById('metaLatitude');
    const lonInput = document.getElementById('metaLongitude');
    const altInput = document.getElementById('metaAltitude');
    
    if (!navigator.geolocation) {
      if (locationStatus) {
        locationStatus.textContent = 'Geolocalización no soportada en este navegador';
        locationStatus.className = 'text-red-500 text-xs mt-1 block';
      }
      return;
    }
    
    if (locationStatus) {
      locationStatus.textContent = 'Obteniendo ubicación...';
      locationStatus.className = 'location-status loading';
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude } = position.coords;
        
        if (latInput) latInput.value = latitude.toFixed(6);
        if (lonInput) lonInput.value = longitude.toFixed(6);
        if (altitude !== null && altInput) {
          altInput.value = Math.round(altitude);
        }
        
        if (locationStatus) {
          locationStatus.textContent = `Ubicación obtenida: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          locationStatus.className = 'location-status success';
        }
        
        if (typeof UIManager !== 'undefined') {
          UIManager.showSuccess('Ubicación GPS obtenida correctamente');
        }
      },
      (error) => {
        let errorMessage = 'Error al obtener ubicación: ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Permiso denegado por el usuario';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Información de ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMessage += 'Tiempo de espera agotado';
            break;
          default:
            errorMessage += 'Error desconocido';
            break;
        }
        
        if (locationStatus) {
          locationStatus.textContent = errorMessage;
          locationStatus.className = 'location-status error';
        }
        
        if (typeof UIManager !== 'undefined') {
          UIManager.showError('No se pudo obtener la ubicación GPS');
        }
      },
      options
    );
  },
  
  /**
   * Obtener todos los metadatos para exportar
   * @returns {Object} Objeto con todos los metadatos
   */
  getMetadata: function() {
    return {
      title: document.getElementById('metaTitle')?.value || '',
      author: document.getElementById('metaAuthor')?.value || '',
      copyright: document.getElementById('metaCopyright')?.value || '',
      license: document.getElementById('metaLicense')?.value || '',
      latitude: parseFloat(document.getElementById('metaLatitude')?.value) || null,
      longitude: parseFloat(document.getElementById('metaLongitude')?.value) || null,
      altitude: parseFloat(document.getElementById('metaAltitude')?.value) || null,
      createdAt: new Date().toISOString(),
      software: 'MnemoTag v3.0'
    };
  },
  
  /**
   * Aplicar metadatos a la imagen
   * @param {HTMLCanvasElement} canvas - Canvas con la imagen
   * @returns {Object} Datos EXIF simulados
   */
  applyMetadataToImage: function(canvas) {
    const metadata = this.getMetadata();
    
    // Crear metadatos EXIF simulados (en un proyecto real usarías una librería como piexifjs)
    const exifData = {
      'Image Description': metadata.title,
      'Artist': metadata.author,
      'Copyright': metadata.copyright,
      'Software': metadata.software,
      'DateTime': new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
      'GPS Latitude': metadata.latitude,
      'GPS Longitude': metadata.longitude,
      'GPS Altitude': metadata.altitude
    };
    
    // Guardar metadatos en el localStorage para persistencia
    try {
      localStorage.setItem('imageMetadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('No se pudieron guardar metadatos:', error);
    }
    
    return exifData;
  },
  
  /**
   * Cargar metadatos guardados del localStorage
   */
  loadSavedMetadata: function() {
    try {
      const saved = localStorage.getItem('imageMetadata');
      if (saved) {
        const metadata = JSON.parse(saved);
        
        // Restaurar valores en los campos
        if (metadata.author) {
          const authorField = document.getElementById('metaAuthor');
          if (authorField) authorField.value = metadata.author;
        }
        if (metadata.license) {
          const licenseField = document.getElementById('metaLicense');
          if (licenseField) licenseField.value = metadata.license;
        }
        
        // No restaurar ubicación automáticamente por privacidad
      }
    } catch (error) {
      console.warn('No se pudieron cargar metadatos guardados:', error);
    }
  },
  
  /**
   * Limpiar metadatos guardados
   */
  clearSavedMetadata: function() {
    try {
      localStorage.removeItem('imageMetadata');
    } catch (error) {
      console.warn('No se pudieron limpiar metadatos:', error);
    }
  },
  
  /**
   * Validar metadatos antes de aplicar
   * @param {Object} metadata - Metadatos a validar
   * @returns {Object} Resultado de la validación
   */
  validateMetadata: function(metadata) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Validar coordenadas GPS
    if (metadata.latitude !== null) {
      if (metadata.latitude < -90 || metadata.latitude > 90) {
        validation.isValid = false;
        validation.errors.push('Latitud debe estar entre -90 y 90 grados');
      }
    }
    
    if (metadata.longitude !== null) {
      if (metadata.longitude < -180 || metadata.longitude > 180) {
        validation.isValid = false;
        validation.errors.push('Longitud debe estar entre -180 y 180 grados');
      }
    }
    
    // Validar campos de texto usando SecurityManager si está disponible
    if (typeof SecurityManager !== 'undefined') {
      const textFields = ['title', 'author', 'copyright', 'license'];
      textFields.forEach(field => {
        if (metadata[field] && !SecurityManager.validateTextInput(metadata[field], 200)) {
          validation.warnings.push(`Campo ${field} contiene caracteres no válidos o es demasiado largo`);
        }
      });
    }
    
    return validation;
  },
  
  /**
   * Exportar metadatos a formato JSON
   * @returns {string} Metadatos en formato JSON
   */
  exportToJSON: function() {
    const metadata = this.getMetadata();
    return JSON.stringify(metadata, null, 2);
  },
  
  /**
   * Importar metadatos desde formato JSON
   * @param {string} jsonString - String JSON con metadatos
   * @returns {boolean} True si se importó correctamente
   */
  importFromJSON: function(jsonString) {
    try {
      const metadata = JSON.parse(jsonString);
      
      // Aplicar metadatos a los campos del formulario
      Object.entries(metadata).forEach(([key, value]) => {
        const element = document.getElementById(`meta${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (element && typeof value === 'string') {
          element.value = value;
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error al importar metadatos:', error);
      return false;
    }
  }
};

/**
 * Función utilitaria para generar copyright automático
 * Se mantiene como función global para compatibilidad
 */
function generateAutoCopyright() {
  const authorInput = document.getElementById('metaAuthor');
  const copyrightInput = document.getElementById('metaCopyright');
  
  // Si no hay autor, pedirlo
  if (!authorInput || !authorInput.value.trim()) {
    if (typeof UIManager !== 'undefined') {
      UIManager.showError('Por favor, ingresa el nombre del autor primero');
    }
    if (authorInput) authorInput.focus();
    return;
  }
  
  const autoCopyright = MetadataManager.generateCopyright(authorInput.value);
  if (copyrightInput) {
    copyrightInput.value = autoCopyright;
  }
  
  if (typeof UIManager !== 'undefined') {
    UIManager.showSuccess('Copyright generado automáticamente');
  }
}

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MetadataManager, generateAutoCopyright };
}
