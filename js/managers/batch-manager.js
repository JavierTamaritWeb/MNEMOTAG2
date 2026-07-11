'use strict';

/**
 * BatchManager - Sistema de procesamiento por lotes de imágenes
 * Permite cargar múltiples imágenes y aplicarles la misma configuración
 * @version 1.0.0
 */

class BatchManager {
  constructor() {
    this.imageQueue = [];
    this.processedImages = [];
    this.currentConfig = null;
    this.isProcessing = false;
    this.maxImages = 50;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB por imagen
    
    // Formatos soportados
    this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
  }

  /**
   * Agregar imágenes a la cola
   * @param {FileList} files - Archivos de imagen
   * @returns {Promise<Object>} Resultado de la validación
   */
  async addImages(files) {
    const results = {
      added: [],
      rejected: [],
      total: files.length
    };

    // Verificar límite total
    if (this.imageQueue.length + files.length > this.maxImages) {
      return {
        success: false,
        error: `Máximo ${this.maxImages} imágenes permitidas. Tienes ${this.imageQueue.length} en cola.`
      };
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = await this.validateImage(file);

      if (validation.valid) {
        const imageData = await this.loadImageFromFile(file);
        
        this.imageQueue.push({
          id: this.generateId(),
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          imageData: imageData,
          thumbnail: await this.createThumbnail(imageData.img),
          processed: false,
          error: null
        });
        
        results.added.push(file.name);
      } else {
        results.rejected.push({
          name: file.name,
          reason: validation.error
        });
      }
    }

    
    return {
      success: true,
      ...results
    };
  }

  /**
   * Validar imagen individual
   */
  async validateImage(file) {
    // Verificar tipo
    if (!this.supportedFormats.includes(file.type)) {
      return {
        valid: false,
        error: `Formato no soportado: ${file.type}`
      };
    }

    // Verificar tamaño
    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máx: 50MB)`
      };
    }

    // Intentar cargar imagen para validar dimensiones
    try {
      const img = await this.loadImageElement(file);
      
      if (img.width < 1 || img.height < 1) {
        return {
          valid: false,
          error: 'Dimensiones inválidas'
        };
      }

      if (img.width > 8192 || img.height > 8192) {
        return {
          valid: false,
          error: `Dimensiones demasiado grandes: ${img.width}x${img.height} (máx: 8192x8192)`
        };
      }

      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: 'No se pudo cargar la imagen'
      };
    }
  }

  /**
   * Cargar elemento Image desde File
   */
  loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Error al cargar imagen'));
      };
      
      img.src = url;
    });
  }

  /**
   * Cargar datos completos de imagen
   */
  async loadImageFromFile(file) {
    const img = await this.loadImageElement(file);
    
    return {
      img: img,
      width: img.width,
      height: img.height,
      aspectRatio: img.width / img.height
    };
  }

  /**
   * Crear thumbnail de imagen
   */
  async createThumbnail(img, size = 100) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const aspectRatio = img.width / img.height;
    let width, height;
    
    if (aspectRatio > 1) {
      width = size;
      height = size / aspectRatio;
    } else {
      height = size;
      width = size * aspectRatio;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Capturar configuración actual de la aplicación
   */
  /**
   * Capturar el estado completo del editor para aplicar al lote.
   * @param {string} filterString - CSS filter string del FilterManager
   * @param {Object} watermarks - Config de watermarks (text + image)
   * @param {Array} textLayers - Capas de texto
   * @param {Object} metadata - Metadatos
   * @param {Function} renderFn - Función que renderiza una imagen en un canvas
   *   con todas las capas (watermarks, filtros, text layers). Recibe (ctx, canvas, img).
   */
  captureCurrentConfig(filterString, watermarks, textLayers, metadata, renderFn) {
    // Formato/calidad de salida: respetar la configuración global del editor
    // (select #output-format y slider de calidad, variables de main.js
    // accesibles por scope de script). Si no son accesibles (tests, uso
    // aislado), mantener JPEG 0.9 como default documentado.
    const globalFormat = (typeof outputFormat !== 'undefined' && outputFormat)
      ? outputFormat
      : 'jpeg';
    const globalQuality = (typeof outputQuality === 'number')
      ? outputQuality
      : 0.9;

    this.currentConfig = {
      filterString: filterString || '',
      watermarks: watermarks || null,
      textLayers: textLayers || null,
      metadata: metadata ? { ...metadata } : null,
      renderFn: renderFn || null,
      outputFormat: globalFormat,
      outputQuality: globalQuality,
      timestamp: Date.now()
    };

    return this.currentConfig;
  }

  /**
   * Procesar cola de imágenes
   */
  async processQueue(progressCallback) {
    if (this.isProcessing) {
      throw new Error('Ya hay un procesamiento en curso');
    }

    if (this.imageQueue.length === 0) {
      throw new Error('No hay imágenes en la cola');
    }

    if (!this.currentConfig) {
      throw new Error('No se ha capturado la configuración');
    }

    this.isProcessing = true;
    this.processedImages = [];

    // Resolver el MIME de salida UNA vez para todo el lote: si el navegador
    // no puede codificar el formato configurado (p. ej. AVIF en Firefox),
    // usar la cadena de fallback estándar del proyecto. Se pasa hasAlpha=true
    // para que el fallback de WebP/AVIF elija PNG (preserva transparencia).
    let outputMime = (typeof getMimeType === 'function')
      ? getMimeType(this.currentConfig.outputFormat)
      : 'image/' + this.currentConfig.outputFormat;
    if (typeof determineFallbackFormat === 'function') {
      try {
        outputMime = await determineFallbackFormat(true, outputMime);
      } catch (fallbackError) {
        MNEMOTAG_DEBUG && console.warn('determineFallbackFormat falló, se mantiene el MIME original:', fallbackError);
      }
    }
    this.currentConfig.outputMime = outputMime;
    this.currentConfig.outputFormat = outputMime.split('/')[1];

    const total = this.imageQueue.length;
    let done = 0;
    const errors = [];

    for (const imageItem of this.imageQueue) {
      let itemResult;
      try {
        itemResult = await this.processImage(imageItem);
        imageItem.processed = true;
      } catch (error) {
        console.error(`Error procesando ${imageItem.name}:`, error);
        imageItem.error = error.message;
        errors.push({ name: imageItem.name, error: error.message });
        itemResult = {
          success: false,
          name: imageItem.name,
          error: error.message
        };
      }
      this.processedImages.push(itemResult);
      done++;

      // El callback de progreso va FUERA del try de procesamiento y en su
      // propio try silencioso: si el callback lanza, no debe duplicar la
      // imagen en processedImages ni abortar el lote. Se invoca también
      // cuando la imagen falla, para que la barra llegue siempre a n/n.
      if (progressCallback) {
        try {
          progressCallback({
            current: done,
            total: total,
            percentage: Math.round((done / total) * 100),
            currentImage: imageItem.name
          });
        } catch (cbError) {
          MNEMOTAG_DEBUG && console.warn('progressCallback lanzó un error (ignorado):', cbError);
        }
      }
    }

    this.isProcessing = false;

    const failed = errors.length;
    const succeeded = this.processedImages.filter(img => img.success).length;

    // main.js solo muestra un toast de éxito global tras processQueue, así
    // que los fallos parciales se avisan desde aquí para que no queden mudos.
    if (failed > 0 && typeof UIManager !== 'undefined' && typeof UIManager.showWarning === 'function') {
      UIManager.showWarning(failed + ' de ' + total + ' imágenes no se pudieron procesar');
    }

    return {
      success: true,
      // processed = SOLO las exitosas (antes contaba también las fallidas)
      processed: succeeded,
      failed: failed,
      errors: errors,
      total: total,
      images: this.processedImages
    };
  }

  /**
   * Procesar imagen individual con configuración
   */
  async processImage(imageItem) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        canvas.width = imageItem.imageData.width;
        canvas.height = imageItem.imageData.height;

        // Usar la función de render de main.js que aplica EXACTAMENTE
        // lo mismo que la previsualización: filtros, watermarks, text layers.
        if (this.currentConfig.renderFn) {
          this.currentConfig.renderFn(ctx, canvas, imageItem.imageData.img);
        } else {
          // Fallback: render básico sin efectos
          ctx.drawImage(imageItem.imageData.img, 0, 0);
        }

        const mime = this.currentConfig.outputMime
          || ('image/' + (this.currentConfig.outputFormat || 'jpeg'));

        // JPEG no tiene canal alpha: aplanar contra el color configurado
        // para que las zonas transparentes (p. ej. PNG de origen) no salgan
        // en negro (comportamiento por defecto del codec JPEG).
        let exportCanvas = canvas;
        if (mime === 'image/jpeg' && typeof flattenCanvasForJpeg === 'function') {
          const flattenColor = (typeof getFlattenColor === 'function')
            ? getFlattenColor()
            : undefined;
          exportCanvas = flattenCanvasForJpeg(canvas, flattenColor);
        }

        exportCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Error al generar blob (' + mime + ')'));
            return;
          }
          resolve({
            success: true,
            name: imageItem.name,
            blob: blob,
            size: blob.size,
            width: canvas.width,
            height: canvas.height
          });
        }, mime, this.currentConfig.outputQuality);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Exportar imágenes procesadas como ZIP
   */
  async exportToZip(zipName = null, options = {}) {
    if (this.processedImages.length === 0) {
      throw new Error('No hay imágenes procesadas para exportar');
    }

    // Verificar que JSZip esté disponible
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip no está cargado. Agrega la librería al HTML.');
    }

    const zip = new JSZip();
    const folder = zip.folder('mnemotag-batch');

    // Extensión según el formato de salida real ('jpeg' → 'jpg', etc.)
    const format = (this.currentConfig && this.currentConfig.outputFormat) || 'jpeg';
    const ext = (typeof getFileExtension === 'function')
      ? getFileExtension(format)
      : format;

    // Agregar imágenes al ZIP conservando el nombre original, DEDUPLICANDO:
    // dos orígenes distintos (foto.png y foto.jpg) colapsan al mismo nombre
    // de salida y JSZip sobrescribiría el primero sin avisar. Si el nombre
    // ya existe, se añade sufijo -2, -3, …
    const usedNames = new Set();
    let addedCount = 0;

    for (const image of this.processedImages) {
      if (image.success && image.blob) {
        const baseName = (image.name || 'imagen').replace(/\.[^/.]+$/, '');
        let fileName = baseName + '.' + ext;
        let suffix = 2;
        while (usedNames.has(fileName)) {
          fileName = baseName + '-' + suffix + '.' + ext;
          suffix++;
        }
        usedNames.add(fileName);
        folder.file(fileName, image.blob);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      throw new Error('Ninguna imagen se procesó correctamente; no hay nada que exportar');
    }

    // Generar ZIP
    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const defaultName = zipName || `mnemotag-batch-${this.formatDate()}.zip`;

    // Si skipDownload, devolver blob sin descargar (el caller maneja el guardado)
    if (!options.skipDownload) {
      this.downloadBlob(content, defaultName);
    }

    return {
      success: true,
      fileName: defaultName,
      size: content.size,
      // Solo las imágenes realmente añadidas al ZIP (las fallidas no cuentan)
      imageCount: addedCount,
      blob: content
    };
  }

  /**
   * Descargar blob como archivo
   */
  downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Formatear fecha para nombre de archivo
   */
  formatDate() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Generar ID único
   */
  generateId() {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Eliminar imagen de la cola
   */
  removeImage(id) {
    const index = this.imageQueue.findIndex(img => img.id === id);
    if (index !== -1) {
      this.imageQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Limpiar cola completa
   */
  clearQueue() {
    this.imageQueue = [];
    this.processedImages = [];
    this.currentConfig = null;
  }

  /**
   * Obtener estado actual
   */
  getStatus() {
    return {
      queueLength: this.imageQueue.length,
      processedCount: this.processedImages.length,
      isProcessing: this.isProcessing,
      hasConfig: !!this.currentConfig,
      maxImages: this.maxImages
    };
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.BatchManager = BatchManager;
}
