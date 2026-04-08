'use strict';

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
   * Generar copyright automático según la licencia seleccionada
   * @param {string} author - Nombre del autor
   * @param {string} license - Tipo de licencia seleccionada
   * @returns {string} Copyright generado
   */
  generateCopyright: function(author = '', license = '') {
    const year = new Date().getFullYear();
    const authorName = author || document.getElementById('metaAuthor')?.value || 'Autor';
    const selectedLicense = license || document.getElementById('metaLicense')?.value || '';
    
    // Generar copyright según el tipo de licencia
    switch(selectedLicense) {
      case 'all-rights-reserved':
        return `© ${year} ${authorName}. Todos los derechos reservados.`;
        
      case 'cc-by':
        return `© ${year} ${authorName}. Licencia Creative Commons Atribución 4.0 Internacional (CC BY 4.0)`;
        
      case 'cc-by-sa':
        return `© ${year} ${authorName}. Licencia Creative Commons Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0)`;
        
      case 'cc-by-nc':
        return `© ${year} ${authorName}. Licencia Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)`;
        
      case 'cc0':
        return `Dominio Público - ${authorName} renuncia a todos los derechos (CC0 1.0 Universal)`;
        
      case 'royalty-free':
        return `© ${year} ${authorName}. Imagen libre de regalías.`;
        
      default:
        // Si no hay licencia seleccionada, usar plantilla por defecto
        return `© ${year} ${authorName}. Todos los derechos reservados.`;
    }
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
          locationStatus.textContent = `✅ Ubicación obtenida: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          locationStatus.className = 'location-status success';
        }
        
        // No mostrar toast flotante, solo el mensaje estático debajo de los campos
        // if (typeof UIManager !== 'undefined') {
        //   UIManager.showSuccess('Ubicación GPS obtenida correctamente');
        // }
      },
      (error) => {
        let errorMessage = '';
        let helpMessage = '';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permiso denegado por el usuario';
            helpMessage = '🔒 Haz clic en el icono de candado en la barra de direcciones y permite el acceso a la ubicación. Luego recarga la página.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Información de ubicación no disponible';
            helpMessage = '📡 Asegúrate de tener activados los servicios de ubicación en tu sistema y tener una conexión a internet.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            helpMessage = '⏱️ La ubicación está tardando demasiado. Verifica tu conexión a internet e intenta de nuevo.';
            break;
          default:
            errorMessage = 'Error desconocido al obtener ubicación';
            helpMessage = '❓ Verifica que estés usando HTTPS o localhost, y que tu navegador soporte geolocalización.';
            break;
        }
        
        if (locationStatus) {
          locationStatus.innerHTML = `
            <div class="text-red-600 font-medium">❌ ${errorMessage}</div>
            <div class="text-gray-600 text-xs mt-1">${helpMessage}</div>
          `;
          locationStatus.className = 'location-status error mt-2';
        }
        
        // No mostrar toast flotante, solo el mensaje estático debajo de los campos
        // if (typeof UIManager !== 'undefined') {
        //   UIManager.showError(errorMessage, {
        //     duration: 8000,
        //     action: error.code === error.PERMISSION_DENIED ? {
        //       label: 'Ver ayuda',
        //       handler: 'window.open("https://support.google.com/chrome/answer/142065", "_blank")'
        //     } : null
        //   });
        // }
        
        console.error('Error de geolocalización:', {
          code: error.code,
          message: error.message,
          isHTTPS: window.location.protocol === 'https:',
          isLocalhost: window.location.hostname === 'localhost',
          userAgent: navigator.userAgent
        });
      },
      options
    );
  },
  
  /**
   * Configurar fecha de creación desde archivo
   * @param {File} file - Archivo de imagen
   */
  setupCreationDate: function(file) {
    const dateInput = document.getElementById('creationDate');
    if (!dateInput) return;
    
    // Establecer fecha máxima como hoy
    const today = new Date().toISOString().split('T')[0];
    dateInput.max = today;
    
    // Intentar extraer fecha de EXIF (simulado - en una implementación real se usaría una librería EXIF)
    let creationDate = null;
    
    // Si no hay EXIF, usar lastModified del archivo
    if (!creationDate && file.lastModified) {
      creationDate = new Date(file.lastModified);
    }
    
    // Si no hay lastModified, usar fecha actual
    if (!creationDate) {
      creationDate = new Date();
    }
    
    // Formatear como YYYY-MM-DD
    const formattedDate = creationDate.toISOString().split('T')[0];
    
    // Establecer valor solo si el campo está vacío
    if (!dateInput.value) {
      dateInput.value = formattedDate;
    }
    
    // Configurar validación en tiempo real
    dateInput.addEventListener('input', this.validateCreationDate.bind(this));
    dateInput.addEventListener('change', this.validateCreationDate.bind(this));
  },
  
  /**
   * Validar fecha de creación (no puede ser futura)
   * @param {Event} event - Evento del input
   */
  validateCreationDate: function(event) {
    const dateInput = event.target;
    const selectedDate = new Date(dateInput.value);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Fin del día actual
    
    if (selectedDate > today) {
      const todayFormatted = today.toISOString().split('T')[0];
      dateInput.value = todayFormatted;
      
      if (typeof UIManager !== 'undefined') {
        UIManager.showWarning('La fecha de creación no puede ser futura. Se ha ajustado a hoy.');
      }
    }
  },
  
  /**
   * Obtener todos los metadatos para exportar
   * @returns {Object} Objeto con todos los metadatos
   */
  getMetadata: function() {
    const creationDateInput = document.getElementById('creationDate');
    const createdAt = creationDateInput?.value 
      ? new Date(creationDateInput.value).toISOString()
      : new Date().toISOString();
    
    return {
      title: document.getElementById('metaTitle')?.value || '',
      author: document.getElementById('metaAuthor')?.value || '',
      copyright: document.getElementById('metaCopyright')?.value || '',
      license: document.getElementById('metaLicense')?.value || '',
      latitude: parseFloat(document.getElementById('metaLatitude')?.value) || null,
      longitude: parseFloat(document.getElementById('metaLongitude')?.value) || null,
      altitude: parseFloat(document.getElementById('metaAltitude')?.value) || null,
      createdAt: createdAt,
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
  
  // Lista de IDs de campos del formulario de metadatos que se persisten
  // automáticamente en localStorage. NO incluye GPS (privacidad), license
  // (intencionalidad), ni creationDate (debe coincidir con la imagen real).
  AUTOSAVE_FIELDS: ['metaTitle', 'metaAuthor', 'metaCopyright', 'description', 'keywords'],

  /**
   * Cargar metadatos guardados del localStorage en los campos del formulario.
   * Desde v3.3.5 restaura todos los campos textuales (no solo el autor).
   */
  loadSavedMetadata: function() {
    try {
      const saved = localStorage.getItem('imageMetadata');
      if (!saved) return;

      const metadata = JSON.parse(saved);
      if (!metadata || typeof metadata !== 'object') return;

      // Map de id de campo -> property en el blob persistido. Algunos
      // campos del DOM se llaman distinto a las keys del objeto.
      const fieldMap = {
        metaTitle: 'title',
        metaAuthor: 'author',
        metaCopyright: 'copyright',
        description: 'description',
        keywords: 'keywords'
      };

      for (const fieldId of this.AUTOSAVE_FIELDS) {
        const propKey = fieldMap[fieldId];
        if (!propKey) continue;
        const value = metadata[propKey];
        if (typeof value !== 'string') continue;
        const el = document.getElementById(fieldId);
        if (el) el.value = value;
      }

      // NO restaurar GPS (lat/lon/alt): privacidad. Cada sesión empieza vacía.
      // NO restaurar license: el usuario debe elegirla intencionalmente cada vez.
      // NO restaurar creationDate: debe coincidir con la fecha real de la foto.
    } catch (error) {
      console.warn('No se pudieron cargar metadatos guardados:', error);
    }
  },

  /**
   * Persistir el formulario completo en localStorage de forma debounced.
   * Se llama desde setupAutoSave en cada evento input/change.
   * Solo guarda los campos textuales, NO GPS ni license (ver loadSavedMetadata).
   */
  saveFormToLocalStorage: function() {
    try {
      const fieldMap = {
        metaTitle: 'title',
        metaAuthor: 'author',
        metaCopyright: 'copyright',
        description: 'description',
        keywords: 'keywords'
      };

      // Cargar lo existente para no pisar campos que esta función no toca
      // (por ejemplo si applyMetadataToImage guardó GPS antes).
      let existing = {};
      try {
        const saved = localStorage.getItem('imageMetadata');
        if (saved) existing = JSON.parse(saved) || {};
      } catch (e) { /* ignorar */ }

      for (const fieldId of this.AUTOSAVE_FIELDS) {
        const el = document.getElementById(fieldId);
        if (!el) continue;
        existing[fieldMap[fieldId]] = el.value || '';
      }

      localStorage.setItem('imageMetadata', JSON.stringify(existing));
    } catch (error) {
      console.warn('No se pudo guardar el formulario en localStorage:', error);
    }
  },

  /**
   * Engancha listeners 'input' a los campos textuales del formulario para
   * persistirlos automáticamente en localStorage. Se llama una vez en init.
   * El guardado está debounced a 500 ms para no saturar localStorage.
   */
  setupAutoSave: function() {
    let saveTimer = null;
    const debounceMs = 500;

    const handler = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        this.saveFormToLocalStorage();
        saveTimer = null;
      }, debounceMs);
    };

    for (const fieldId of this.AUTOSAVE_FIELDS) {
      const el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
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
  
  // NOTA: las funciones `exportToJSON` e `importFromJSON` se eliminaron en
  // v3.3.3 como código muerto. Nadie las llamaba en producción, e
  // `importFromJSON` además asignaba elementos del DOM dinámicamente
  // (`document.getElementById('meta' + ...)`) sin validación, lo cual era
  // un patrón frágil. Si en el futuro se necesita import/export JSON,
  // habrá que rediseñarlo con validación de campos y un esquema fijo.

  // ===== ESCRITURA REAL DE EXIF EN JPEG =====
  // Estas funciones requieren `piexif` (cargado por CDN en index.html).
  // Si la librería no está disponible o el formato no es JPEG, devuelven el
  // input sin tocar — degradación elegante. Solo soportan JPEG; PNG/WebP/AVIF
  // no llevan EXIF aquí (el blob/dataURL sale tal cual del canvas).

  /**
   * Construye el objeto EXIF a partir de los metadatos del formulario.
   * @param {Object} metadata - Resultado de getMetadata()
   * @returns {Object|null} Objeto compatible con piexif.dump(), o null si no
   *                        hay nada que escribir.
   */
  buildExifObject: function(metadata) {
    if (typeof piexif === 'undefined') return null;

    const zeroth = {};
    const exif = {};
    const gps = {};
    let hasAnyField = false;

    if (metadata.title) {
      zeroth[piexif.ImageIFD.ImageDescription] = String(metadata.title);
      hasAnyField = true;
    }
    if (metadata.author) {
      zeroth[piexif.ImageIFD.Artist] = String(metadata.author);
      hasAnyField = true;
    }
    if (metadata.copyright) {
      zeroth[piexif.ImageIFD.Copyright] = String(metadata.copyright);
      hasAnyField = true;
    }
    if (metadata.software) {
      zeroth[piexif.ImageIFD.Software] = String(metadata.software);
      hasAnyField = true;
    }

    // Fecha de creación → DateTimeOriginal en formato "YYYY:MM:DD HH:MM:SS"
    if (metadata.createdAt) {
      try {
        const d = new Date(metadata.createdAt);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          const exifDate = `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ` +
                           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          exif[piexif.ExifIFD.DateTimeOriginal] = exifDate;
          zeroth[piexif.ImageIFD.DateTime] = exifDate;
          hasAnyField = true;
        }
      } catch (e) {
        // Fecha inválida — la ignoramos en silencio
      }
    }

    // GPS: solo si lat y lon son números válidos
    const lat = typeof metadata.latitude === 'number' ? metadata.latitude : null;
    const lon = typeof metadata.longitude === 'number' ? metadata.longitude : null;
    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      gps[piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
      gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat));
      gps[piexif.GPSIFD.GPSLongitudeRef] = lon < 0 ? 'W' : 'E';
      gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lon));

      const alt = typeof metadata.altitude === 'number' ? metadata.altitude : null;
      if (alt !== null && !isNaN(alt)) {
        gps[piexif.GPSIFD.GPSAltitudeRef] = alt < 0 ? 1 : 0;
        // GPSAltitude es un rational [num, den]; multiplicamos x100 para conservar cm
        gps[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(alt) * 100), 100];
      }

      hasAnyField = true;
    }

    if (!hasAnyField) return null;

    return { '0th': zeroth, 'Exif': exif, 'GPS': gps };
  },

  /**
   * Inserta EXIF en un dataURL JPEG. Sincrónico.
   * @param {string} dataUrl - dataURL `data:image/jpeg;base64,...`
   * @returns {string} dataURL con EXIF incrustado, o el original si no aplica.
   */
  embedExifInJpegDataUrl: function(dataUrl) {
    if (typeof piexif === 'undefined') return dataUrl;
    if (typeof dataUrl !== 'string') return dataUrl;
    if (!dataUrl.startsWith('data:image/jpeg')) return dataUrl;

    try {
      const metadata = this.getMetadata();
      const exifObj = this.buildExifObject(metadata);
      if (!exifObj) return dataUrl;

      const exifBytes = piexif.dump(exifObj);
      return piexif.insert(exifBytes, dataUrl);
    } catch (err) {
      console.warn('No se pudo insertar EXIF en JPEG (dataURL):', err);
      return dataUrl;
    }
  },

  /**
   * Inserta EXIF en un Blob JPEG. Asíncrono.
   * @param {Blob} blob - Blob JPEG generado por canvas.toBlob()
   * @returns {Promise<Blob>} Blob nuevo con EXIF incrustado, o el original si
   *                          no aplica (no es JPEG, sin metadatos, sin librería).
   */
  embedExifInJpegBlob: async function(blob) {
    if (typeof piexif === 'undefined') return blob;
    if (!blob || blob.type !== 'image/jpeg') return blob;

    try {
      const metadata = this.getMetadata();
      const exifObj = this.buildExifObject(metadata);
      if (!exifObj) return blob;

      // Blob → dataURL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });

      const exifBytes = piexif.dump(exifObj);
      const newDataUrl = piexif.insert(exifBytes, dataUrl);

      // dataURL → Blob (sin pasar por fetch para no depender de él)
      const base64 = newDataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'image/jpeg' });
    } catch (err) {
      console.warn('No se pudo insertar EXIF en JPEG (blob):', err);
      return blob;
    }
  },

  // ===== ESCRITURA REAL DE EXIF EN PNG (v3.3.6) =====
  // PNG no usa el mismo contenedor que JPEG. El spec PNG 1.5+ define un chunk
  // estándar `eXIf` cuyo payload es exactamente el bloque TIFF (header + IFDs)
  // que ya genera piexif, sin la cabecera APP1 ni el marcador "Exif\0\0".
  // Implementamos manipulación binaria de chunks PNG a mano (sin librería
  // externa) para insertar el chunk eXIf justo antes del primer IDAT.

  /**
   * Strippea la cabecera APP1 + "Exif\0\0" del binary string que devuelve
   * piexif.dump(), dejando solo el bloque TIFF crudo apto para un chunk PNG eXIf.
   *
   * Estructura típica del output de piexif.dump():
   *   FF E1 ll ll 45 78 69 66 00 00 [ TIFF header + IFDs ]
   *   marker  size  E  x  i  f \0 \0
   * @param {string} piexifBinary - binary string crudo de piexif.dump()
   * @returns {Uint8Array} TIFF data lista para chunk eXIf
   */
  _piexifBinaryToTiffBytes: function(piexifBinary) {
    // Convertir binary string a Uint8Array
    const len = piexifBinary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = piexifBinary.charCodeAt(i) & 0xff;

    // Si arranca con FF E1 (APP1 marker JPEG) saltamos APP1+size+"Exif\0\0"
    if (u8.length > 10 && u8[0] === 0xFF && u8[1] === 0xE1) {
      // FF E1 (2) + size (2) + "Exif" (4) + \0\0 (2) = 10 bytes
      return u8.subarray(10);
    }
    // Si arranca directamente con "Exif\0\0" saltamos 6 bytes
    if (u8.length > 6 && u8[0] === 0x45 && u8[1] === 0x78 && u8[2] === 0x69 && u8[3] === 0x66) {
      return u8.subarray(6);
    }
    // Si arranca directamente con TIFF header (II*\0 o MM\0*) lo devolvemos tal cual
    return u8;
  },

  /**
   * Construye un chunk PNG eXIf con CRC32 válido.
   * Estructura del chunk: [length:4][type:4][data][crc:4]
   * @param {Uint8Array} tiffBytes - bloque TIFF crudo (sin APP1 ni "Exif\0\0")
   * @returns {Uint8Array} chunk completo listo para insertar en el PNG
   */
  _buildPngExifChunk: function(tiffBytes) {
    const length = tiffBytes.length;
    const chunk = new Uint8Array(4 + 4 + length + 4);
    const dv = new DataView(chunk.buffer);

    // length (big-endian)
    dv.setUint32(0, length, false);
    // type "eXIf"
    chunk[4] = 0x65; // 'e'
    chunk[5] = 0x58; // 'X'
    chunk[6] = 0x49; // 'I'
    chunk[7] = 0x66; // 'f'
    // data
    chunk.set(tiffBytes, 8);
    // crc32 sobre [type + data]
    const crcInput = chunk.subarray(4, 8 + length);
    const crc = (typeof crc32 === 'function') ? crc32(crcInput) : 0;
    dv.setUint32(8 + length, crc, false);

    return chunk;
  },

  /**
   * Inserta un chunk eXIf en un PNG (Uint8Array) justo antes del primer IDAT.
   * Si el PNG ya tiene un chunk eXIf, lo reemplaza.
   * @param {Uint8Array} pngBytes - PNG completo (incluye signature)
   * @param {Uint8Array} exifChunk - chunk eXIf completo (length+type+data+crc)
   * @returns {Uint8Array} PNG nuevo con el chunk insertado
   */
  _insertExifChunkInPng: function(pngBytes, exifChunk) {
    // Validar signature PNG
    const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (pngBytes[i] !== PNG_SIG[i]) {
        throw new Error('No es un PNG válido (signature inválida)');
      }
    }

    // Recorrer chunks para encontrar el primer IDAT y posibles eXIf existentes.
    const chunks = []; // Lista de { start, length, type }
    let pos = 8;
    while (pos < pngBytes.length) {
      if (pos + 8 > pngBytes.length) break;
      const dv = new DataView(pngBytes.buffer, pngBytes.byteOffset + pos, 8);
      const dataLen = dv.getUint32(0, false);
      const type = String.fromCharCode(pngBytes[pos + 4], pngBytes[pos + 5], pngBytes[pos + 6], pngBytes[pos + 7]);
      const totalLen = 4 + 4 + dataLen + 4;
      chunks.push({ start: pos, length: totalLen, type: type });
      pos += totalLen;
      if (type === 'IEND') break;
    }

    // Construir el PNG nuevo: signature + chunks pre-IDAT + exifChunk + chunks restantes
    let firstIdatIdx = chunks.findIndex(c => c.type === 'IDAT');
    if (firstIdatIdx === -1) {
      throw new Error('PNG sin chunks IDAT (corrupto)');
    }

    // Filtrar chunks eXIf existentes (los reemplazamos con el nuevo)
    const filtered = chunks.filter(c => c.type !== 'eXIf');
    // Recalcular el índice del primer IDAT en la lista filtrada
    firstIdatIdx = filtered.findIndex(c => c.type === 'IDAT');

    // Calcular tamaño del PNG resultante
    let totalSize = 8; // signature
    for (const c of filtered) totalSize += c.length;
    totalSize += exifChunk.length;

    const out = new Uint8Array(totalSize);
    out.set(pngBytes.subarray(0, 8), 0); // signature
    let writePos = 8;

    for (let i = 0; i < filtered.length; i++) {
      if (i === firstIdatIdx) {
        // Insertar exifChunk justo antes del primer IDAT
        out.set(exifChunk, writePos);
        writePos += exifChunk.length;
      }
      const c = filtered[i];
      out.set(pngBytes.subarray(c.start, c.start + c.length), writePos);
      writePos += c.length;
    }

    return out;
  },

  /**
   * Inserta EXIF en un Blob PNG. Asíncrono.
   * Defensiva: si piexif no está, si no es PNG, si no hay metadatos, o si
   * la manipulación falla por cualquier motivo, devuelve el blob original
   * sin tocar. NUNCA produce un PNG corrupto.
   * @param {Blob} blob - Blob PNG generado por canvas.toBlob()
   * @returns {Promise<Blob>} Blob nuevo con eXIf incrustado, o el original
   */
  embedExifInPngBlob: async function(blob) {
    if (typeof piexif === 'undefined') return blob;
    if (!blob || blob.type !== 'image/png') return blob;

    try {
      const metadata = this.getMetadata();
      const exifObj = this.buildExifObject(metadata);
      if (!exifObj) return blob;

      // Generar bloque TIFF desde piexif
      const piexifBinary = piexif.dump(exifObj);
      const tiffBytes = this._piexifBinaryToTiffBytes(piexifBinary);
      if (!tiffBytes || tiffBytes.length === 0) return blob;

      // Leer el blob como ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const pngBytes = new Uint8Array(arrayBuffer);

      // Construir chunk eXIf y reinjertar
      const exifChunk = this._buildPngExifChunk(tiffBytes);
      const newPng = this._insertExifChunkInPng(pngBytes, exifChunk);

      // Validar que el resultado sigue empezando por la signature PNG
      if (newPng[0] !== 0x89 || newPng[1] !== 0x50) {
        console.warn('embedExifInPngBlob: resultado no parece PNG válido, devolviendo original');
        return blob;
      }

      return new Blob([newPng], { type: 'image/png' });
    } catch (err) {
      console.warn('No se pudo insertar EXIF en PNG (blob):', err);
      return blob;
    }
  },

  /**
   * Inserta EXIF en un dataURL PNG. Wrapper sobre embedExifInPngBlob para
   * el camino de descarga con `<a download>`.
   * @param {string} dataUrl - dataURL `data:image/png;base64,...`
   * @returns {Promise<string>} dataURL con EXIF, o el original
   */
  embedExifInPngDataUrl: async function(dataUrl) {
    if (typeof piexif === 'undefined') return dataUrl;
    if (typeof dataUrl !== 'string') return dataUrl;
    if (!dataUrl.startsWith('data:image/png')) return dataUrl;

    try {
      // dataURL → Blob (sin pasar por fetch)
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });

      const newBlob = await this.embedExifInPngBlob(blob);
      if (newBlob === blob) return dataUrl; // Sin cambios

      // Blob → dataURL
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(newBlob);
      });
    } catch (err) {
      console.warn('No se pudo insertar EXIF en PNG (dataURL):', err);
      return dataUrl;
    }
  },

  // ===== ESCRITURA REAL DE EXIF EN WebP (v3.3.7) =====
  // WebP usa contenedor RIFF con chunks. Para tener metadatos EXIF necesita
  // el header VP8X (extended). Si el WebP es "simple" (solo VP8 lossy o
  // VP8L lossless), hay que CONVERTIRLO añadiendo un chunk VP8X delante con
  // las dimensiones reales de la imagen y los flags apropiados.
  //
  // Layout objetivo (extended WebP con EXIF):
  //   RIFF [size:4] WEBP
  //     VP8X chunk (header con flags, dimensiones)
  //     [VP8 | VP8L]  ← bitstream original
  //     EXIF chunk    ← chunks de metadatos al final
  //
  // ATENCIÓN: la manipulación binaria de WebP es delicada. Toda la lógica
  // está envuelta en try/catch defensivo: ante cualquier error o validación
  // fallida, las funciones devuelven el blob original sin tocar. NUNCA
  // producen un WebP corrupto. Aún así, **la validación visual en browser
  // real es OBLIGATORIA** antes de confiar en estos métodos en producción.

  /**
   * Lee dimensiones y tipo de un WebP a partir de sus bytes crudos.
   * @param {Uint8Array} bytes - WebP completo (incluye RIFF header)
   * @returns {Object|null} { width, height, type: 'VP8'|'VP8L'|'VP8X', hasAlpha }
   */
  _parseWebpDimensions: function(bytes) {
    if (bytes.length < 30) return null;
    // RIFF (52 49 46 46) ... WEBP (57 45 42 50)
    if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;
    if (bytes[8] !== 0x57 || bytes[9] !== 0x45 || bytes[10] !== 0x42 || bytes[11] !== 0x50) return null;

    // Primer chunk del WebP
    const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

    if (type === 'VP8X') {
      // Layout VP8X data (offset 20):
      //   flags (1) + reserved (3) + canvas_width-1 (3 LE) + canvas_height-1 (3 LE)
      const flags = bytes[20];
      const width = ((bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) & 0xFFFFFF) + 1;
      const height = ((bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) & 0xFFFFFF) + 1;
      const hasAlpha = (flags & 0x10) !== 0;
      return { width, height, type: 'VP8X', hasAlpha };
    } else if (type === 'VP8 ') {
      // VP8 lossy. El bitstream empieza en byte 20.
      // Bytes 20-22: frame tag (3 bytes)
      // Bytes 23-25: signature 0x9D 0x01 0x2A
      // Bytes 26-27: width raw (low 14 bits = width)
      // Bytes 28-29: height raw (low 14 bits = height)
      if (bytes.length < 30) return null;
      if (bytes[23] !== 0x9D || bytes[24] !== 0x01 || bytes[25] !== 0x2A) return null;
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3FFF;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3FFF;
      return { width, height, type: 'VP8', hasAlpha: false };
    } else if (type === 'VP8L') {
      // VP8L lossless. Byte 20 = signature 0x2F. Bytes 21-24 contienen
      // width-1 (14 bits) | height-1 (14 bits) | alpha_used (1 bit) | version (3 bits)
      // bit-packed little-endian.
      if (bytes.length < 25) return null;
      if (bytes[20] !== 0x2F) return null;
      const b1 = bytes[21], b2 = bytes[22], b3 = bytes[23], b4 = bytes[24];
      // width-1 = bits 0-13 = b1 (8 bits) | (b2 & 0x3F) << 8 (6 bits)
      const width = (b1 | ((b2 & 0x3F) << 8)) + 1;
      // height-1 = bits 14-27 = (b2 >> 6) (2 bits) | b3 << 2 (8 bits) | (b4 & 0x0F) << 10 (4 bits)
      const height = ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0F) << 10)) + 1;
      const hasAlpha = (b4 & 0x10) !== 0;
      return { width, height, type: 'VP8L', hasAlpha };
    }

    return null;
  },

  /**
   * Construye un chunk VP8X (header extended WebP) de 18 bytes:
   *   FourCC 'VP8X' (4) + size=10 (4) + flags+reserved+w+h (10)
   */
  _buildVp8xChunk: function(width, height, hasExif, hasAlpha) {
    const chunk = new Uint8Array(18);
    // FourCC 'VP8X'
    chunk[0] = 0x56; chunk[1] = 0x50; chunk[2] = 0x38; chunk[3] = 0x58;
    // size = 10 (LE)
    chunk[4] = 10; chunk[5] = 0; chunk[6] = 0; chunk[7] = 0;
    // flags
    let flags = 0;
    if (hasExif) flags |= 0x08;
    if (hasAlpha) flags |= 0x10;
    chunk[8] = flags;
    // reserved (3 bytes)
    chunk[9] = 0; chunk[10] = 0; chunk[11] = 0;
    // canvas_width - 1 (3 bytes LE)
    const w = (width - 1) & 0xFFFFFF;
    chunk[12] = w & 0xFF;
    chunk[13] = (w >> 8) & 0xFF;
    chunk[14] = (w >> 16) & 0xFF;
    // canvas_height - 1 (3 bytes LE)
    const h = (height - 1) & 0xFFFFFF;
    chunk[15] = h & 0xFF;
    chunk[16] = (h >> 8) & 0xFF;
    chunk[17] = (h >> 16) & 0xFF;
    return chunk;
  },

  /**
   * Construye un chunk RIFF EXIF con padding par.
   * Estructura: [FourCC 'EXIF':4][size:4 LE][data:padded a even]
   */
  _buildRiffExifChunk: function(tiffBytes) {
    const dataLen = tiffBytes.length;
    const padded = (dataLen % 2 === 0) ? dataLen : dataLen + 1;
    const chunk = new Uint8Array(8 + padded);
    // FourCC 'EXIF'
    chunk[0] = 0x45; chunk[1] = 0x58; chunk[2] = 0x49; chunk[3] = 0x46;
    // size declarado (sin padding) en LE
    const dv = new DataView(chunk.buffer);
    dv.setUint32(4, dataLen, true);
    chunk.set(tiffBytes, 8);
    // El byte de padding (si lo hay) ya es 0 por default
    return chunk;
  },

  /**
   * Caso A: WebP ya extended (VP8X). Añadir el chunk EXIF al final y
   * setear el bit EXIF en el VP8X header.
   */
  _addExifToVp8xWebp: function(webpBytes, exifChunk) {
    const out = new Uint8Array(webpBytes.length + exifChunk.length);
    out.set(webpBytes, 0);
    // Setear bit 3 (EXIF) en flags del VP8X (byte 20)
    out[20] = out[20] | 0x08;
    // Añadir el chunk EXIF al final
    out.set(exifChunk, webpBytes.length);
    // Recalcular el size del RIFF (bytes 4-7 LE) = total - 8
    const dv = new DataView(out.buffer);
    dv.setUint32(4, out.length - 8, true);
    return out;
  },

  /**
   * Caso B: WebP simple (VP8 / VP8L). Convertir a VP8X insertando un
   * VP8X chunk al principio y un EXIF chunk al final.
   */
  _convertSimpleWebpToVp8xWithExif: function(webpBytes, vp8xChunk, exifChunk) {
    const headerLen = 12; // RIFF[4] + size[4] + WEBP[4]
    const bitstreamPart = webpBytes.subarray(headerLen);
    const newTotal = headerLen + vp8xChunk.length + bitstreamPart.length + exifChunk.length;
    const out = new Uint8Array(newTotal);

    // Header RIFF + size placeholder + WEBP
    out.set(webpBytes.subarray(0, headerLen), 0);
    // Recalcular size del RIFF
    const dv = new DataView(out.buffer);
    dv.setUint32(4, newTotal - 8, true);

    // VP8X chunk
    out.set(vp8xChunk, headerLen);
    // Bitstream original (VP8 o VP8L)
    out.set(bitstreamPart, headerLen + vp8xChunk.length);
    // EXIF chunk al final
    out.set(exifChunk, headerLen + vp8xChunk.length + bitstreamPart.length);

    return out;
  },

  /**
   * Inserta EXIF en un Blob WebP. Asíncrono.
   * Defensiva: si algo falla, devuelve el blob original sin tocar.
   * NUNCA produce un WebP corrupto.
   */
  embedExifInWebpBlob: async function(blob) {
    if (typeof piexif === 'undefined') return blob;
    if (!blob || blob.type !== 'image/webp') return blob;

    try {
      const metadata = this.getMetadata();
      const exifObj = this.buildExifObject(metadata);
      if (!exifObj) return blob;

      const piexifBinary = piexif.dump(exifObj);
      const tiffBytes = this._piexifBinaryToTiffBytes(piexifBinary);
      if (!tiffBytes || tiffBytes.length === 0) return blob;

      const arrayBuffer = await blob.arrayBuffer();
      const webpBytes = new Uint8Array(arrayBuffer);

      // Parsear el WebP existente
      const dim = this._parseWebpDimensions(webpBytes);
      if (!dim) {
        console.warn('embedExifInWebpBlob: no se pudo parsear el WebP, devolviendo original');
        return blob;
      }

      const exifChunk = this._buildRiffExifChunk(tiffBytes);

      let newBytes;
      if (dim.type === 'VP8X') {
        // Ya es extended: solo añadimos EXIF y seteamos el flag
        newBytes = this._addExifToVp8xWebp(webpBytes, exifChunk);
      } else {
        // VP8 o VP8L simple: convertir a VP8X con EXIF
        const vp8xChunk = this._buildVp8xChunk(dim.width, dim.height, true, dim.hasAlpha);
        newBytes = this._convertSimpleWebpToVp8xWithExif(webpBytes, vp8xChunk, exifChunk);
      }

      // Validación post: el resultado DEBE seguir siendo un WebP válido
      if (newBytes[0] !== 0x52 || newBytes[1] !== 0x49 || newBytes[2] !== 0x46 || newBytes[3] !== 0x46 ||
          newBytes[8] !== 0x57 || newBytes[9] !== 0x45 || newBytes[10] !== 0x42 || newBytes[11] !== 0x50) {
        console.warn('embedExifInWebpBlob: resultado no parece WebP válido, devolviendo original');
        return blob;
      }

      return new Blob([newBytes], { type: 'image/webp' });
    } catch (err) {
      console.warn('No se pudo insertar EXIF en WebP (blob):', err);
      return blob;
    }
  },

  /**
   * Wrapper dataURL para el camino de descarga con `<a download>`.
   */
  embedExifInWebpDataUrl: async function(dataUrl) {
    if (typeof piexif === 'undefined') return dataUrl;
    if (typeof dataUrl !== 'string') return dataUrl;
    if (!dataUrl.startsWith('data:image/webp')) return dataUrl;

    try {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/webp' });

      const newBlob = await this.embedExifInWebpBlob(blob);
      if (newBlob === blob) return dataUrl;

      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(newBlob);
      });
    } catch (err) {
      console.warn('No se pudo insertar EXIF en WebP (dataURL):', err);
      return dataUrl;
    }
  }
};

/**
 * Función utilitaria para generar copyright automático
 * Se mantiene como función global para compatibilidad
 */
function generateAutoCopyright() {
  const authorInput = document.getElementById('metaAuthor');
  const licenseSelect = document.getElementById('metaLicense');
  const copyrightInput = document.getElementById('metaCopyright');
  
  // Si no hay autor, pedirlo
  if (!authorInput || !authorInput.value.trim()) {
    if (typeof UIManager !== 'undefined') {
      UIManager.showError('Por favor, ingresa el nombre del autor primero');
    }
    if (authorInput) authorInput.focus();
    return;
  }
  
  const selectedLicense = licenseSelect ? licenseSelect.value : '';
  const autoCopyright = MetadataManager.generateCopyright(authorInput.value, selectedLicense);
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
