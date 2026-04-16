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
    this.currentConfig = {
      filterString: filterString || '',
      watermarks: watermarks || null,
      textLayers: textLayers || null,
      metadata: metadata ? { ...metadata } : null,
      renderFn: renderFn || null,
      outputFormat: 'jpeg',
      outputQuality: 0.9,
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
    
    const total = this.imageQueue.length;
    let processed = 0;

    for (const imageItem of this.imageQueue) {
      try {
        const result = await this.processImage(imageItem);
        this.processedImages.push(result);
        imageItem.processed = true;
        
        processed++;
        
        if (progressCallback) {
          progressCallback({
            current: processed,
            total: total,
            percentage: Math.round((processed / total) * 100),
            currentImage: imageItem.name
          });
        }
        
      } catch (error) {
        console.error(`Error procesando ${imageItem.name}:`, error);
        imageItem.error = error.message;
        
        this.processedImages.push({
          success: false,
          name: imageItem.name,
          error: error.message
        });
      }
    }

    this.isProcessing = false;
    
    
    return {
      success: true,
      processed: this.processedImages.length,
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

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Error al generar blob'));
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
        }, 'image/' + this.currentConfig.outputFormat, this.currentConfig.outputQuality);

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

    // Agregar imágenes al ZIP conservando el nombre original
    for (const image of this.processedImages) {
      if (image.success && image.blob) {
        const ext = this.currentConfig.outputFormat || 'jpg';
        // Usar el nombre original sin extensión + la extensión del formato de salida
        const baseName = (image.name || 'imagen').replace(/\.[^/.]+$/, '');
        const fileName = baseName + '.' + ext;
        folder.file(fileName, image.blob);
      }
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
      imageCount: this.processedImages.length,
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
