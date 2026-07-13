'use strict';

/**
 * BatchManager - Sistema de procesamiento por lotes de imágenes
 * Permite cargar múltiples imágenes y aplicarles la misma configuración
 *
 * v3.7.0: la cola mantiene UNA única representación por imagen — el File
 * original más sus dimensiones (medidas al validar). Nada de previews base64
 * ni elementos Image retenidos: la decodificación ocurre bajo demanda en
 * processImage y el canvas/imagen se liberan inmediatamente al terminar.
 * El procesamiento corre con concurrencia acotada (AppConfig.batchConcurrency,
 * máx. 2) y soporta cancelación del lote y por imagen individual.
 * @version 2.0.0
 */

class BatchManager {
  constructor() {
    this.imageQueue = [];
    this.processedImages = [];
    this.currentConfig = null;
    this.isProcessing = false;
    // v3.5.14: cancelación cooperativa — se comprueba entre imagen e imagen
    this.cancelRequested = false;
    // Límite de imágenes desde AppConfig — única fuente de verdad (v3.5.14)
    this.maxImages = AppConfig.batchMaxImages;
    this.maxFileSize = AppConfig.maxFileSize;
    this.maxPixelsPerImage = 36 * 1000 * 1000;
    this.maxTotalPixels = 80 * 1000 * 1000;
    // v3.7.0: imágenes procesándose a la vez. Acotado a [1, 2]: más de 2
    // canvas grandes simultáneos dispara el pico de memoria sin mejorar
    // apenas el tiempo total (la codificación toBlob es el cuello).
    this.concurrency = Math.max(1, Math.min(2, (typeof AppConfig !== 'undefined' && AppConfig.batchConcurrency) || 2));
    
    // Formatos soportados — SOLO se usa en el fallback de validateImage
    // cuando SecurityManager no está disponible (runner Node, uso aislado).
    // Debe mantenerse alineado con SecurityManager.validateImageFile:
    // sin GIF (la app no lo soporta) y con AVIF (sí lo soporta).
    this.supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];

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
        const queuedPixels = this.imageQueue.reduce(
          (total, item) => total + item.width * item.height,
          0
        );
        const filePixels = validation.width * validation.height;
        if (queuedPixels + filePixels > this.maxTotalPixels) {
          results.rejected.push({
            name: file.name,
            reason: 'El lote supera el límite seguro de 80 megapíxeles decodificados'
          });
          continue;
        }
        // v3.7.0: única representación por imagen — File + dimensiones.
        // La imagen decodificada durante la validación se descarta; la
        // decodificación real ocurre bajo demanda en processImage.
        this.imageQueue.push({
          id: this.generateId(),
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          width: validation.width,
          height: validation.height,
          processed: false,
          error: null,
          cancelled: false
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
   *
   * La validación de tipo/tamaño/nombre/extensión se delega en
   * SecurityManager.validateImageFile (fuente única de verdad de los
   * formatos soportados por la app). Si SecurityManager no está disponible
   * (runner Node, uso aislado del manager), se usa un fallback local
   * equivalente y alineado: sin GIF, con AVIF.
   *
   * Checks propios del batch que SecurityManager NO cubre y se conservan
   * aquí: decodificación real de la imagen, dimensiones mínimas y límite
   * de 36 megapíxeles por imagen. (El límite AGREGADO de 80 megapíxeles
   * del lote completo se comprueba en addImages, no aquí.)
   */
  async validateImage(file) {
    if (typeof SecurityManager !== 'undefined' &&
        typeof SecurityManager.validateImageFile === 'function') {
      const secResult = SecurityManager.validateImageFile(file);
      if (!secResult.isValid) {
        const firstError = (secResult.errors && secResult.errors[0]) || null;
        return {
          valid: false,
          error: firstError
            ? firstError.message + (firstError.details ? ' — ' + firstError.details : '')
            : 'Archivo no válido'
        };
      }
    } else {
      // Fallback local (sin SecurityManager): tipo y tamaño básicos
      if (!file || !this.supportedFormats.includes(file.type)) {
        return {
          valid: false,
          error: `Formato no soportado: ${file ? file.type : 'archivo ausente'}`
        };
      }

      if (file.size > this.maxFileSize) {
        return {
          valid: false,
          error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máx: ${Math.round(this.maxFileSize / 1024 / 1024)}MB)`
        };
      }
    }

    // Intentar cargar imagen para validar dimensiones (check propio del batch)
    try {
      const img = await this.loadImageElement(file);
      const width = img.width;
      const height = img.height;
      // v3.7.0: soltar la referencia decodificada YA — la cola solo guarda
      // File + dimensiones; la decodificación real es bajo demanda.
      img.src = '';

      if (width < 1 || height < 1) {
        return {
          valid: false,
          error: 'Dimensiones inválidas'
        };
      }

      if (width * height > this.maxPixelsPerImage) {
        return {
          valid: false,
          error: `Imagen demasiado grande: ${width}x${height} (máx: 36 megapíxeles)`
        };
      }

      return { valid: true, width: width, height: height };

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
   * Medir dimensiones de un File de imagen sin retener la decodificación.
   * (v3.7.0 — sustituye a los antiguos loadImageFromFile y generador de
   * miniaturas base64, que retenían el Image decodificado por cada item.)
   * @returns {Promise<{width: number, height: number}>}
   */
  async measureImageFile(file) {
    const img = await this.loadImageElement(file);
    const dims = { width: img.width, height: img.height };
    img.src = '';
    return dims;
  }

  /**
   * Resumen de un conjunto de items {width, height, size} (v3.7.0).
   * Se usa para el bloque "resumen previo al lote" de la UI: número de
   * archivos, megapíxeles totales y memoria decodificada estimada
   * (ancho × alto × 4 bytes RGBA por imagen).
   * @param {Array<{width: number, height: number, size: number}>} items
   * @returns {{count: number, totalPixels: number, megapixels: number,
   *            totalFileBytes: number, estimatedDecodedBytes: number}}
   */
  summarizeItems(items) {
    const list = Array.isArray(items) ? items : [];
    let totalPixels = 0;
    let totalFileBytes = 0;
    for (const item of list) {
      const w = Number(item && item.width) || 0;
      const h = Number(item && item.height) || 0;
      totalPixels += w * h;
      totalFileBytes += Number(item && item.size) || 0;
    }
    return {
      count: list.length,
      totalPixels: totalPixels,
      megapixels: totalPixels / 1e6,
      totalFileBytes: totalFileBytes,
      estimatedDecodedBytes: totalPixels * 4
    };
  }

  /**
   * Resumen de la cola actual (v3.7.0).
   */
  getQueueSummary() {
    return this.summarizeItems(this.imageQueue);
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
   * @param {Object} applyOptions - Qué grupos aplicar al lote.
   */
  captureCurrentConfig(filterString, watermarks, textLayers, metadata, applyOptions = {}) {
    const apply = Object.assign({
      filters: true,
      watermarks: true,
      textLayers: true,
      metadata: true
    }, applyOptions || {});
    const sourceCanvas = AppState.canvas;
    const layerManager = typeof window !== 'undefined' ? window.textLayerManager : null;
    const capturedLayers = textLayers || (
      layerManager && typeof layerManager.getAllLayers === 'function'
        ? layerManager.getAllLayers()
        : []
    );
    const documentState = DocumentRenderer.snapshot({
      sourceImage: null,
      referenceWidth: sourceCanvas ? sourceCanvas.width : 0,
      referenceHeight: sourceCanvas ? sourceCanvas.height : 0,
      filterString: apply.filters ? (filterString || '') : '',
      watermarks: apply.watermarks
        ? (watermarks || WatermarkManager.captureConfig())
        : null,
      watermarkMode: apply.watermarks ? 'full' : 'none',
      textLayers: (apply.textLayers ? capturedLayers : []).map(layer => ({
        ...layer,
        font: { ...layer.font },
        position: { ...layer.position },
        effects: {
          shadow: layer.effects?.shadow ? { ...layer.effects.shadow } : null,
          stroke: layer.effects?.stroke ? { ...layer.effects.stroke } : null,
          gradient: layer.effects?.gradient
            ? { ...layer.effects.gradient, colors: [...(layer.effects.gradient.colors || [])] }
            : null
        }
      })),
      showPositioningBorders: false
    });

    this.currentConfig = {
      documentState,
      metadata: apply.metadata && metadata ? { ...metadata } : null,
      outputFormat: AppState.outputFormat || 'jpeg',
      outputQuality: typeof AppState.outputQuality === 'number' ? AppState.outputQuality : 0.9,
      timestamp: Date.now()
    };

    return this.currentConfig;
  }

  /**
   * Anotar accesibilidad ARIA en los elementos de progreso del batch.
   *
   * El markup vive en index.html (overlay global #progress-bar/#progress-text
   * que actualiza main.js durante el lote, y el bloque del modal batch
   * #batch-progress-bar/#batch-progress-text), así que los atributos se
   * añaden vía setAttribute al iniciar el procesamiento — sin editar HTML.
   * No-op silencioso si no hay DOM (runner Node) o faltan los elementos.
   */
  _setupProgressA11y() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
      return;
    }
    try {
      for (const id of ['progress-track']) {
        const bar = document.getElementById(id);
        if (!bar || typeof bar.setAttribute !== 'function') continue;
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', '0');
      }
      const batchBar = document.querySelector('#batch-progress .progress-bar-container');
      if (batchBar) batchBar.setAttribute('aria-valuenow', '0');
      for (const id of ['progress-text', 'batch-progress-text']) {
        const text = document.getElementById(id);
        if (!text || typeof text.setAttribute !== 'function') continue;
        // El texto de estado se anuncia a lectores de pantalla sin robar foco
        text.setAttribute('aria-live', 'polite');
      }
    } catch (a11yError) {
      MNEMOTAG_DEBUG && console.warn('No se pudieron anotar atributos ARIA de progreso:', a11yError);
    }
  }

  /**
   * Actualizar aria-valuenow de las barras de progreso del batch.
   * @param {number} percentage - Porcentaje 0-100
   */
  _updateProgressA11y(percentage) {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
      return;
    }
    try {
      for (const id of ['progress-track']) {
        const bar = document.getElementById(id);
        if (bar && typeof bar.setAttribute === 'function') {
          bar.setAttribute('aria-valuenow', String(percentage));
        }
      }
      const batchBar = document.querySelector('#batch-progress .progress-bar-container');
      if (batchBar) batchBar.setAttribute('aria-valuenow', String(percentage));
    } catch (a11yError) {
      MNEMOTAG_DEBUG && console.warn('No se pudo actualizar aria-valuenow:', a11yError);
    }
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

    // Accesibilidad: anotar role/aria-* en los elementos de progreso al
    // iniciar el procesamiento (el markup vive en index.html).
    this._setupProgressA11y();

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
    this.cancelRequested = false;

    // v3.7.0: procesamiento con concurrencia acotada (1-2 workers). Cada
    // worker toma el siguiente índice libre de la cola; la cancelación del
    // lote se comprueba antes de reclamar cada imagen (las en curso terminan)
    // y la cancelación individual (item.cancelled) salta esa imagen.
    const queue = this.imageQueue.slice();
    let nextIndex = 0;

    const notifyProgress = (imageItem, itemResult) => {
      const percentage = Math.round((done / total) * 100);

      // Accesibilidad: reflejar el avance en aria-valuenow de las barras.
      this._updateProgressA11y(percentage);

      // El callback de progreso va FUERA del try de procesamiento y en su
      // propio try silencioso: si el callback lanza, no debe duplicar la
      // imagen en processedImages ni abortar el lote. Se invoca también
      // cuando la imagen falla, para que la barra llegue siempre a n/n.
      if (progressCallback) {
        try {
          progressCallback({
            current: done,
            total: total,
            percentage: percentage,
            currentImage: imageItem.name,
            // v3.5.14: info por archivo para que la UI marque estados
            id: imageItem.id,
            lastSuccess: itemResult.success,
            lastError: itemResult.success ? null : itemResult.error,
            // v3.7.0: distinguir "cancelada individualmente" de "error"
            lastCancelled: !!itemResult.cancelledItem
          });
        } catch (cbError) {
          MNEMOTAG_DEBUG && console.warn('progressCallback lanzó un error (ignorado):', cbError);
        }
      }
    };

    const runWorker = async () => {
      while (true) {
        // v3.5.14: cancelación cooperativa — la imagen en curso termina,
        // las restantes quedan sin procesar (no aparecen en processedImages)
        if (this.cancelRequested) return;
        const index = nextIndex++;
        if (index >= queue.length) return;
        const imageItem = queue[index];

        // v3.7.0: cancelación individual — la imagen se salta y queda
        // marcada como cancelada (ni procesada ni fallida).
        if (imageItem.cancelled) {
          const skippedResult = {
            success: false,
            name: imageItem.name,
            error: 'Cancelada por el usuario',
            cancelledItem: true,
            id: imageItem.id
          };
          this.processedImages.push(skippedResult);
          done++;
          notifyProgress(imageItem, skippedResult);
          continue;
        }

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
        // id de la cola para que la UI pueda mapear estados por archivo
        itemResult.id = imageItem.id;
        this.processedImages.push(itemResult);
        done++;
        notifyProgress(imageItem, itemResult);
      }
    };

    const workerCount = Math.max(1, Math.min(this.concurrency, queue.length));
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    this.isProcessing = false;
    const cancelled = this.cancelRequested;
    this.cancelRequested = false;

    const failed = errors.length;
    const succeeded = this.processedImages.filter(img => img.success).length;

    // main.js muestra el resumen (éxito / parcial / cancelado); aquí solo
    // avisamos de fallos parciales cuando NO hubo cancelación para que no
    // queden mudos si el caller ignora el detalle.
    if (failed > 0 && !cancelled && typeof UIManager !== 'undefined' && typeof UIManager.showWarning === 'function') {
      UIManager.showWarning(failed + ' de ' + total + ' imágenes no se pudieron procesar');
    }

    return {
      success: true,
      // processed = SOLO las exitosas (antes contaba también las fallidas)
      processed: succeeded,
      failed: failed,
      errors: errors,
      total: total,
      cancelled: cancelled,
      images: this.processedImages
    };
  }

  /**
   * Solicitar la cancelación del lote en curso (v3.5.14).
   * Cooperativa: la imagen en proceso termina y el resto no se procesa.
   */
  requestCancel() {
    if (this.isProcessing) {
      this.cancelRequested = true;
    }
  }

  /**
   * Cancelar UNA imagen individual del lote en curso (v3.7.0).
   * Si aún no ha empezado a procesarse, se salta y queda marcada como
   * cancelada. Devuelve true si la cancelación se registró.
   * @param {string|number} id - id del item en la cola
   */
  cancelImage(id) {
    const item = this.imageQueue.find(i => i.id === id);
    if (item && !item.processed) {
      item.cancelled = true;
      return true;
    }
    return false;
  }

  /**
   * Reintentar UNA imagen fallida del último lote (v3.5.14).
   * Usa la configuración ya capturada; si tiene éxito, reemplaza la entrada
   * fallida en processedImages para que el ZIP la incluya.
   * @param {string|number} id - id del item en la cola
   * @returns {Promise<Object>} resultado del procesamiento
   */
  async retryImage(id) {
    if (this.isProcessing) {
      throw new Error('Espera a que termine el procesamiento en curso');
    }
    if (!this.currentConfig) {
      throw new Error('No hay configuración de lote capturada');
    }
    const item = this.imageQueue.find(i => i.id === id);
    if (!item) {
      throw new Error('La imagen ya no está en la cola');
    }

    const result = await this.processImage(item); // lanza si vuelve a fallar
    result.id = item.id;
    item.processed = true;
    item.error = null;
    item.cancelled = false; // un reintento explícito anula la cancelación individual

    const idx = this.processedImages.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.processedImages[idx] = result;
    } else {
      // La imagen quedó sin procesar (lote cancelado): añadirla
      this.processedImages.push(result);
    }
    return result;
  }

  /**
   * Procesar imagen individual con configuración.
   *
   * v3.7.0: decodificación BAJO DEMANDA — la cola no retiene imágenes
   * decodificadas, así que aquí se decodifica el File, se renderiza, se
   * codifica el blob de salida y se libera TODO (canvas de trabajo, canvas
   * de aplanado e imagen decodificada) antes de devolver el resultado.
   */
  async processImage(imageItem) {
    // Decodificar bajo demanda desde el File original
    const img = await this.loadImageElement(imageItem.file);
    const canvas = document.createElement('canvas');
    let exportCanvas = canvas;

    try {
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      canvas.width = imageItem.width || img.width;
      canvas.height = imageItem.height || img.height;

      DocumentRenderer.renderDocument(
        Object.assign({}, this.currentConfig.documentState, {
          sourceImage: img,
          showPositioningBorders: false
        }),
        canvas
      );

      const mime = this.currentConfig.outputMime
        || ('image/' + (this.currentConfig.outputFormat || 'jpeg'));

      // JPEG no tiene canal alpha: aplanar contra el color configurado
      // para que las zonas transparentes (p. ej. PNG de origen) no salgan
      // en negro (comportamiento por defecto del codec JPEG).
      if (mime === 'image/jpeg' && typeof flattenCanvasForJpeg === 'function') {
        const flattenColor = (typeof getFlattenColor === 'function')
          ? getFlattenColor()
          : undefined;
        exportCanvas = flattenCanvasForJpeg(canvas, flattenColor);
      }

      const outWidth = canvas.width;
      const outHeight = canvas.height;

      const blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob((result) => {
          if (!result) {
            reject(new Error('Error al generar blob (' + mime + ')'));
            return;
          }
          resolve(result);
        }, mime, this.currentConfig.outputQuality);
      });

      return {
        success: true,
        name: imageItem.name,
        blob: blob,
        size: blob.size,
        width: outWidth,
        height: outHeight
      };
    } finally {
      // v3.7.0: liberación inmediata — vaciar los backing stores de los
      // canvas de trabajo y soltar la decodificación del Image.
      if (exportCanvas !== canvas) {
        exportCanvas.width = 0;
        exportCanvas.height = 0;
      }
      canvas.width = 0;
      canvas.height = 0;
      img.src = '';
    }
  }

  /**
   * Exportar imágenes procesadas como ZIP
   */
  async exportToZip(zipName = null, options = {}) {
    if (this.processedImages.length === 0) {
      throw new Error('No hay imágenes procesadas para exportar');
    }

    // Carga diferida de JSZip si el helper existe (helpers.js). El guard
    // typeof hace el cambio seguro aunque el helper aún no esté definido.
    if (typeof ensureJSZip === 'function') {
      await ensureJSZip();
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
