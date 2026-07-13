'use strict';

/**
 * BatchManager - Sistema de procesamiento por lotes de imágenes
 * Permite cargar múltiples imágenes y aplicarles la misma configuración
 *
 * v3.7.0: la cola mantiene UNA única representación por imagen — el File
 * original más sus dimensiones (medidas al validar). Nada de previews base64
 * ni elementos Image retenidos: la decodificación ocurre bajo demanda en
 * processImage y el canvas/imagen se liberan inmediatamente al terminar.
 * v3.7.3: la validación genera además un JPEG reducido para la UI. Ese Blob
 * nunca entra en imageQueue y su ObjectURL pertenece a BatchUIManager.
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
    this.runSequence = 0;
    this.activeRun = null;
    this.clearAfterRun = false;
    // Límite de imágenes desde AppConfig — única fuente de verdad (v3.5.14)
    this.maxImages = AppConfig.batchMaxImages;
    this.maxFileSize = AppConfig.maxFileSize;
    this.maxPixelsPerImage = AppConfig.batchMaxPixelsPerImage;
    this.maxTotalPixels = AppConfig.batchMaxTotalPixels;
    this.workingBytesPerPixel = AppConfig.batchWorkingBytesPerPixel || 8;
    this.workingMemoryBudgetBytes = AppConfig.batchWorkingMemoryBudgetBytes || 320 * 1024 * 1024;
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
    if (this.isProcessing) {
      return {
        success: false,
        error: 'Espera a que termine o cancela el lote antes de añadir imágenes'
      };
    }
    const results = {
      added: [],
      addedItems: [],
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
            reason: 'El lote supera el límite seguro de ' +
              Math.round(this.maxTotalPixels / 1000000) + ' megapíxeles decodificados'
          });
          continue;
        }
        // v3.7.0: única representación por imagen — File + dimensiones.
        // La imagen decodificada durante la validación se descarta; la
        // decodificación real ocurre bajo demanda en processImage.
        const queueItem = {
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
        };
        this.imageQueue.push(queueItem);

        results.added.push(file.name);
        // previewBlob pertenece a la UI y nunca se conserva en la cola.
        results.addedItems.push({ item: queueItem, previewBlob: validation.previewBlob || null });
      } else {
        results.rejected.push({
          name: file.name,
          reason: validation.error
        });
      }
    }

    if (results.added.length > 0) {
      this.processedImages = [];
      this.currentConfig = null;
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
      try {
        const width = img.width;
        const height = img.height;

        if (width < 1 || height < 1) {
          return {
            valid: false,
            error: 'Dimensiones inválidas'
          };
        }

        if (width * height > this.maxPixelsPerImage) {
          return {
            valid: false,
            error: `Imagen demasiado grande: ${width}x${height} (máx: ${Math.round(this.maxPixelsPerImage / 1000000)} megapíxeles)`
          };
        }

        const previewBlob = await this.createPreviewBlob(img, width, height);
        return { valid: true, width: width, height: height, previewBlob: previewBlob };
      } finally {
        // La UI recibe solo un Blob reducido; nunca conserva el Image original.
        img.src = '';
      }

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
   * Genera una vista previa pequeña sin base64 y sin conservar el bitmap
   * original. El límite fijo evita que 20 tarjetas reintroduzcan el pico de
   * memoria que se eliminó en v3.7.0.
   * @returns {Promise<Blob|null>}
   */
  createPreviewBlob(img, width, height) {
    if (typeof document === 'undefined') return Promise.resolve(null);
    const maxWidth = 320;
    const maxHeight = 180;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') {
      canvas.width = 0;
      canvas.height = 0;
      return Promise.resolve(null);
    }

    try {
      context.fillStyle = '#f3f4f6';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch (error) {
      canvas.width = 0;
      canvas.height = 0;
      return Promise.resolve(null);
    }

    return new Promise(resolve => {
      try {
        canvas.toBlob(blob => {
          canvas.width = 0;
          canvas.height = 0;
          resolve(blob || null);
        }, 'image/jpeg', 0.72);
      } catch (error) {
        canvas.width = 0;
        canvas.height = 0;
        resolve(null);
      }
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

    const queue = this.imageQueue.slice();
    const configSnapshot = {
      ...this.currentConfig,
      metadata: this.currentConfig.metadata ? { ...this.currentConfig.metadata } : null
    };
    const run = {
      id: ++this.runSequence,
      queue,
      config: configSnapshot,
      results: [],
      errors: [],
      cancelRequested: false,
      controller: typeof window !== 'undefined' && typeof window.AbortController === 'function'
        ? new window.AbortController()
        : null
    };

    this.activeRun = run;
    this.isProcessing = true;
    this.processedImages = run.results;
    this.cancelRequested = false;
    this.clearAfterRun = false;
    this._setupProgressA11y();

    let result;
    try {
      // Resolver el MIME una vez y guardarlo exclusivamente en el snapshot
      // de esta ejecución. currentConfig puede ser sustituido después sin
      // alterar las tareas que ya están en curso.
      let outputMime = (typeof getMimeType === 'function')
        ? getMimeType(configSnapshot.outputFormat)
        : 'image/' + configSnapshot.outputFormat;
      if (typeof determineFallbackFormat === 'function') {
        try {
          outputMime = await determineFallbackFormat(true, outputMime);
        } catch (fallbackError) {
          MNEMOTAG_DEBUG && console.warn('determineFallbackFormat falló, se mantiene el MIME original:', fallbackError);
        }
      }
      configSnapshot.outputMime = outputMime;
      configSnapshot.outputFormat = outputMime.split('/')[1];
      // Mantener la extensión del ZIP sincronizada con el formato realmente
      // codificado, sin cambiar el objeto que consumen los workers.
      if (this.activeRun === run) this.currentConfig = configSnapshot;

      const total = queue.length;
      let done = 0;
      let nextIndex = 0;

      const notifyProgress = (imageItem, itemResult) => {
        const percentage = Math.round((done / total) * 100);
        this._updateProgressA11y(percentage);
        if (progressCallback) {
          try {
            progressCallback({
              current: done,
              total,
              percentage,
              currentImage: imageItem.name,
              id: imageItem.id,
              lastSuccess: itemResult.success,
              lastError: itemResult.success ? null : itemResult.error,
              lastCancelled: !!itemResult.cancelledItem
            });
          } catch (cbError) {
            MNEMOTAG_DEBUG && console.warn('progressCallback lanzó un error (ignorado):', cbError);
          }
        }
      };

      const runWorker = async () => {
        while (true) {
          if (run.cancelRequested) return;
          const index = nextIndex++;
          if (index >= queue.length) return;
          const imageItem = queue[index];

          if (imageItem.cancelled) {
            const skippedResult = {
              success: false,
              name: imageItem.name,
              error: 'Cancelada por el usuario',
              cancelledItem: true,
              id: imageItem.id
            };
            run.results.push(skippedResult);
            done++;
            notifyProgress(imageItem, skippedResult);
            continue;
          }

          let itemResult;
          try {
            imageItem.processing = true;
            itemResult = await this.processImage(imageItem, configSnapshot, run);
            if (imageItem.cancelled) {
              itemResult = {
                success: false,
                name: imageItem.name,
                error: 'Cancelada por el usuario',
                cancelledItem: true
              };
            } else {
              imageItem.processed = true;
            }
          } catch (error) {
            if (imageItem.cancelled) {
              itemResult = {
                success: false,
                name: imageItem.name,
                error: 'Cancelada por el usuario',
                cancelledItem: true
              };
            } else {
              MNEMOTAG_DEBUG && console.error(`Error procesando ${imageItem.name}:`, error);
              imageItem.error = error.message;
              run.errors.push({ name: imageItem.name, error: error.message });
              itemResult = {
                success: false,
                name: imageItem.name,
                error: error.message
              };
            }
          } finally {
            imageItem.processing = false;
          }
          itemResult.id = imageItem.id;
          run.results.push(itemResult);
          done++;
          notifyProgress(imageItem, itemResult);
        }
      };

      const largestImagePixels = queue.reduce(
        (largest, item) => Math.max(largest, (item.width || 0) * (item.height || 0)),
        1
      );
      const memoryBoundConcurrency = Math.max(1, Math.floor(
        this.workingMemoryBudgetBytes / (largestImagePixels * this.workingBytesPerPixel)
      ));
      const workerCount = Math.max(1, Math.min(
        this.concurrency,
        memoryBoundConcurrency,
        queue.length
      ));
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

      const failed = run.errors.length;
      const succeeded = run.results.filter(image => image.success).length;
      if (failed > 0 && !run.cancelRequested &&
          typeof UIManager !== 'undefined' && typeof UIManager.showWarning === 'function') {
        UIManager.showWarning(failed + ' de ' + total + ' imágenes no se pudieron procesar');
      }

      result = {
        success: true,
        processed: succeeded,
        failed,
        errors: run.errors,
        total,
        cancelled: run.cancelRequested,
        images: run.results
      };
    } finally {
      const mustClear = this.clearAfterRun;
      if (this.activeRun === run) {
        this.activeRun = null;
        this.isProcessing = false;
      }
      this.cancelRequested = false;
      this.clearAfterRun = false;
      if (mustClear) this._resetQueue();
    }

    return result;
  }

  /**
   * Solicitar la cancelación del lote en curso (v3.5.14).
   * Cooperativa: la imagen en proceso termina y el resto no se procesa.
   */
  requestCancel() {
    if (this.isProcessing) {
      this.cancelRequested = true;
      if (this.activeRun) {
        this.activeRun.cancelRequested = true;
        this.activeRun.controller?.abort();
      }
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
  async processImage(imageItem, config = this.currentConfig) {
    if (!config) throw new Error('No hay configuración de lote disponible');
    // Decodificar bajo demanda desde el File original
    const img = await this.loadImageElement(imageItem.file);
    const canvas = document.createElement('canvas');
    const exportCanvas = canvas;

    try {
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      canvas.width = imageItem.width || img.width;
      canvas.height = imageItem.height || img.height;

      DocumentRenderer.renderDocument(
        Object.assign({}, config.documentState, {
          sourceImage: img,
          showPositioningBorders: false
        }),
        canvas
      );

      const mime = config.outputMime
        || ('image/' + (config.outputFormat || 'jpeg'));

      // JPEG no tiene canal alpha: aplanar contra el color configurado
      // para que las zonas transparentes (p. ej. PNG de origen) no salgan
      // en negro (comportamiento por defecto del codec JPEG).
      if (mime === 'image/jpeg') {
        const flattenColor = (typeof getFlattenColor === 'function')
          ? getFlattenColor()
          : '#ffffff';
        // Pintar el fondo detrás de los píxeles existentes evita un segundo
        // canvas RGBA completo (otros 144 MB para una imagen de 36 MP).
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = flattenColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      const outWidth = canvas.width;
      const outHeight = canvas.height;

      let blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob((result) => {
          if (!result) {
            reject(new Error('Error al generar blob (' + mime + ')'));
            return;
          }
          resolve(result);
        }, mime, config.outputQuality);
      });

      blob = await this.embedMetadata(blob, config);

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
   * Inserta el snapshot EXIF capturado al iniciar el lote. Si el usuario
   * pidió metadatos, una degradación silenciosa se considera un error de esa
   * imagen: nunca se marca como correcta una salida que perdió sus EXIF.
   */
  async embedMetadata(blob, config) {
    if (!config?.metadata) return blob;
    if (typeof MetadataManager === 'undefined' ||
        typeof MetadataManager.embedExifInBlob !== 'function') {
      throw new Error('El escritor de metadatos no está disponible');
    }

    const enrichedBlob = await MetadataManager.embedExifInBlob(blob, config.metadata);
    if (!enrichedBlob || enrichedBlob === blob) {
      throw new Error('No se pudieron insertar los metadatos en el archivo generado');
    }
    return enrichedBlob;
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
    if (this.isProcessing) return false;
    const index = this.imageQueue.findIndex(img => img.id === id);
    if (index !== -1) {
      this.imageQueue.splice(index, 1);
      this.processedImages = [];
      this.currentConfig = null;
      return true;
    }
    return false;
  }

  /**
   * Limpiar cola completa
   */
  clearQueue() {
    if (this.isProcessing) {
      this.clearAfterRun = true;
      this.requestCancel();
      return false;
    }
    this._resetQueue();
    return true;
  }

  _resetQueue() {
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
