'use strict';

// ===== HISTORY MANAGER =====
// Gestión de historial para deshacer/rehacer en MnemoTag v3.0

/**
 * HistoryManager - Sistema de historial para deshacer/rehacer
 * 
 * Funcionalidades:
 * - Guardar estados del canvas y metadatos
 * - Deshacer y rehacer acciones
 * - Gestión inteligente de memoria (máximo 20 estados)
 * - Restauración completa de estado (imagen + metadatos + marcas de agua)
 * - Actualización automática de botones UI
 */

// Límite de memoria total para los snapshots base64 del historial.
// En imágenes 4K, cada canvas.toDataURL() puede ocupar 10-30 MB; con 20
// estados eso son 200-600 MB. Este tope evita OOM en sesiones largas.
const HISTORY_MAX_TOTAL_SIZE = (typeof AppConfig !== 'undefined' && AppConfig.historyMaxMemoryBytes) ||
  100 * 1024 * 1024; // 100 MB cumulativos, fallback para integraciones legacy

const HISTORY_OBJECT_IDS = new WeakMap();
let historyObjectIdSequence = 0;

function historyObjectId(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
  if (!HISTORY_OBJECT_IDS.has(value)) HISTORY_OBJECT_IDS.set(value, ++historyObjectIdSequence);
  return HISTORY_OBJECT_IDS.get(value);
}

function assignHistoryObjectId(value, id) {
  if (!value || !Number.isSafeInteger(id)) return;
  HISTORY_OBJECT_IDS.set(value, id);
  historyObjectIdSequence = Math.max(historyObjectIdSequence, id);
}

function historyStateSignature(state) {
  const watermark = Object.assign({}, state.watermarkConfig || {});
  const watermarkImageId = historyObjectId(watermark.imageElement);
  delete watermark.imageElement;
  return JSON.stringify({
    documentId: state.documentId,
    rasterStateId: state.rasterStateId,
    metadata: state.metadata,
    watermark,
    watermarkImageId,
    filterState: state.filterState,
    canvasFilter: state.canvasFilter,
    fileBaseName: state.fileBaseName,
    rotation: state.rotation,
    isFlippedHorizontally: state.isFlippedHorizontally,
    isFlippedVertically: state.isFlippedVertically,
    originalWidth: state.originalWidth,
    originalHeight: state.originalHeight,
    resetRasterId: state.resetRasterId,
    textLayers: state.textLayers
  });
}

const historyManager = {
  states: [],
  currentIndex: -1,
  maxStates: 20,
  isRestoring: false,
  _saveQueue: Promise.resolve(),
  _navigationQueue: Promise.resolve(),
  _epoch: 0,

  _enqueueNavigation: function (operation) {
    const job = this._navigationQueue.catch(function () {}).then(operation);
    this._navigationQueue = job;
    return job;
  },

  _runDocumentExclusive: function (operation) {
    if (typeof DocumentStateManager !== 'undefined' &&
        typeof DocumentStateManager.runExclusive === 'function') {
      return DocumentStateManager.runExclusive('history-navigation', operation);
    }
    return operation({
      documentId: AppState.documentId,
      documentRevision: AppState.documentRevision
    });
  },

  _navigationIsCurrent: function (epoch, context) {
    if (epoch !== this._epoch || !AppState.documentId || !AppState.currentImage) return false;
    if (context && typeof DocumentStateManager !== 'undefined' &&
        typeof DocumentStateManager.isContextCurrent === 'function') {
      return DocumentStateManager.isContextCurrent(context);
    }
    return !context || context.documentId === AppState.documentId;
  },

  _releaseState: function (state) {
    if (state && state.bitmap && typeof state.bitmap.close === 'function') {
      try { state.bitmap.close(); } catch (error) { /* recurso ya liberado */ }
    }
    if (state) state.resetRasterSource = null;
  },

  _memoryUsage: function (extraState) {
    const allStates = extraState ? this.states.concat([extraState]) : this.states;
    const baselines = new Set();
    const watermarkRasters = new Set();
    let total = 0;
    allStates.forEach(state => {
      total += state.estimatedBytes || 0;
      if (state.resetRasterSource && !baselines.has(state.resetRasterSource)) {
        baselines.add(state.resetRasterSource);
        total += state.resetRasterEstimatedBytes || 0;
      }
      const watermarkRaster = state.watermarkConfig?.imageElement;
      if (watermarkRaster && !watermarkRasters.has(watermarkRaster)) {
        watermarkRasters.add(watermarkRaster);
        total += state.watermarkEstimatedBytes || 0;
      }
    });
    return total;
  },

  _evictFor: function (state) {
    while (this.states.length && this._memoryUsage(state) > HISTORY_MAX_TOTAL_SIZE) {
      const removed = this.states.shift();
      this._releaseState(removed);
      this.currentIndex--;
    }
    if (this.currentIndex < -1) this.currentIndex = -1;
  },

  /**
   * Guardar el estado actual del canvas y configuración.
   *
   * v3.4.6: Si el navegador soporta `createImageBitmap`, el canvas se
   * guarda como ImageBitmap (memoria nativa, ~2-4 bytes por píxel en
   * GPU, sin stringificación base64). Esto ahorra ~10x memoria respecto
   * al dataURL: en una imagen 4K (24 MP), un bitmap ocupa ~100 MB nativos
   * vs un dataURL de ~30 MB de string + otros ~60 MB de heap mientras
   * se decodifica. El bitmap va directo al GPU y el garbage collector
   * JS no lo ve.
   *
   * Fallback a canvas.toDataURL() si createImageBitmap no está disponible
   * (navegadores muy viejos) o si falla por canvas tainted.
   */
  saveState: async function() {
    if (this.isRestoring) {
      if (MNEMOTAG_DEBUG) console.warn('historyManager: saveState bloqueado por isRestoring (evitando bucles)');
      return;
    }
    // El raster canónico es la fuente del snapshot. El canvas visible puede
    // contener filtros, marcas o una previsualización transitoria.
    const visibleCanvas = AppState.canvas;
    const currentImage = AppState.currentImage;
    if (!currentImage) {
      if (MNEMOTAG_DEBUG) console.warn('historyManager: No se guarda estado (canvas o imagen no cargada)');
      return;
    }
    const canvas = currentImage;
    const width = currentImage.naturalWidth || currentImage.width || visibleCanvas?.width || 0;
    const height = currentImage.naturalHeight || currentImage.height || visibleCanvas?.height || 0;
    const estimatedBytes = width * height * 4;
    if (!width || !height || estimatedBytes > HISTORY_MAX_TOTAL_SIZE) {
      MNEMOTAG_DEBUG && console.warn('historyManager: el raster excede el presupuesto del historial');
      return;
    }
    const epoch = this._epoch;
    const documentId = AppState.documentId;
    const documentRevision = AppState.documentRevision;
    const resetRasterSource = AppState.transformResetImage;
    const resetUsesRaster = resetRasterSource === currentImage;
    const resetWidth = resetRasterSource?.naturalWidth || resetRasterSource?.width || 0;
    const resetHeight = resetRasterSource?.naturalHeight || resetRasterSource?.height || 0;
    const previousCommit = this._saveQueue.catch(function () {});
    let releaseCommit;
    this._saveQueue = new Promise(resolve => { releaseCommit = resolve; });
    // Serializar también la CAPTURA, no solo el push final. createImageBitmap
    // reserva memoria nativa inmediatamente; veinte saveState simultáneos
    // podían crear veinte rasteres antes de que actuase el presupuesto.
    await previousCommit;
    if (epoch !== this._epoch || documentId !== AppState.documentId ||
        documentRevision !== AppState.documentRevision || currentImage !== AppState.currentImage) {
      releaseCommit();
      return false;
    }

    // Metadata base común para cualquier estrategia de snapshot.
    const watermarkConfig = this.getCurrentWatermarkConfig();
    const watermarkRaster = watermarkConfig.imageElement;
    const watermarkWidth = watermarkRaster?.naturalWidth || watermarkRaster?.width || 0;
    const watermarkHeight = watermarkRaster?.naturalHeight || watermarkRaster?.height || 0;
    const baseState = {
      // Dimensiones internas del canvas en el momento del snapshot.
      // Sin ellas, un undo tras un crop dibujaba el bitmap grande sobre
      // el canvas pequeño (solo se veía una esquina).
      canvasWidth: width,
      canvasHeight: height,
      documentId,
      documentRevision,
      rasterStateId: historyObjectId(currentImage),
      estimatedBytes,
      metadata: this.getCurrentMetadata(),
      watermarkConfig,
      watermarkEstimatedBytes: watermarkWidth * watermarkHeight * 4,
      filterState: this.getCurrentFilterState(),
      canvasFilter: visibleCanvas?.style?.filter || '',
      fileBaseName: AppState.fileBaseName || 'imagen',
      rotation: AppState.currentRotation,
      isFlippedHorizontally: AppState.isFlippedHorizontally,
      isFlippedVertically: AppState.isFlippedVertically,
      originalWidth: AppState.originalWidth,
      originalHeight: AppState.originalHeight,
      resetUsesRaster,
      resetRasterSource: resetUsesRaster ? null : resetRasterSource,
      resetRasterId: resetUsesRaster ? historyObjectId(currentImage) : historyObjectId(resetRasterSource),
      resetRasterEstimatedBytes: resetUsesRaster ? 0 : resetWidth * resetHeight * 4,
      textLayers: (typeof window !== 'undefined' && window.textLayerManager &&
        typeof window.textLayerManager.exportConfig === 'function')
        ? window.textLayerManager.exportConfig()
        : null,
      timestamp: Date.now()
    };
    baseState.signature = historyStateSignature(baseState);
    const queuedCurrentState = this.states[this.currentIndex];
    if (queuedCurrentState && queuedCurrentState.signature === baseState.signature) {
      releaseCommit();
      return false;
    }

    const self = this;
    const commitState = async function (state) {
      try {
        if (epoch !== self._epoch || documentId !== AppState.documentId) {
          self._releaseState(state);
          return false;
        }
        const currentState = self.states[self.currentIndex];
        if (currentState && currentState.signature === state.signature) {
          self._releaseState(state);
          return false;
        }
        const discarded = self.states.slice(self.currentIndex + 1);
        discarded.forEach(item => self._releaseState(item));
        self.states = self.states.slice(0, self.currentIndex + 1);
        self._evictFor(state);
        if (self._memoryUsage(state) > HISTORY_MAX_TOTAL_SIZE) {
          self._releaseState(state);
          return false;
        }
        self.states.push(state);
        self.currentIndex++;
        while (self.states.length > self.maxStates) {
          const removed = self.states.shift();
          self._releaseState(removed);
          self.currentIndex--;
        }
        self.updateUndoRedoButtons();
        if (MNEMOTAG_DEBUG) console.log(`historyManager: Estado guardado. Historial: ${self.currentIndex + 1}/${self.states.length}`);
        return true;
      } finally {
        releaseCommit();
      }
    };

    // Estrategia 1: ImageBitmap (preferida). Ahora con await.
    let bitmap = null;
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(canvas);
      } catch (err) {
        MNEMOTAG_DEBUG && console.warn('historyManager: createImageBitmap falló, fallback a dataURL:', err);
      }
    }
    if (bitmap) return await commitState(Object.assign({}, baseState, { bitmap: bitmap }));

    // Estrategia 2 (fallback legacy): dataURL.
    let dataURL;
    try {
      let snapshotCanvas = canvas;
      if (typeof canvas.toDataURL !== 'function') {
        snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = width;
        snapshotCanvas.height = height;
        snapshotCanvas.getContext('2d').drawImage(canvas, 0, 0, width, height);
      }
      dataURL = snapshotCanvas.toDataURL();
    } catch (error) {
      releaseCommit();
      throw error;
    }
    // Mantener la llamada legacy documentada para la barrera de regresión:
    // canvas.toDataURL() es la ruta directa cuando el raster ya es canvas.
    const newSize = Math.max(dataURL.length * 2, estimatedBytes);
    if (newSize > HISTORY_MAX_TOTAL_SIZE) {
      MNEMOTAG_DEBUG && console.warn(
        `historyManager: snapshot demasiado grande (${(newSize / 1024 / 1024).toFixed(1)} MB). No se guarda.`
      );
      releaseCommit();
      return false;
    }
    return await commitState(Object.assign({}, baseState, {
      imageData: dataURL,
      estimatedBytes: newSize
    }));
  },
  
  /**
   * Deshacer la última acción
   */
  undo: function() {
    const self = this;
    return this._enqueueNavigation(async function () {
      const navigationEpoch = self._epoch;
      return self._runDocumentExclusive(async function (expectedState) {
        await self._saveQueue.catch(function () {});
        if (!self._navigationIsCurrent(navigationEpoch, expectedState)) return false;
        if (self.currentIndex > 0) {
          const targetIndex = self.currentIndex - 1;
          const restored = await self.restoreState(self.states[targetIndex], expectedState, navigationEpoch);
          if (!restored || !self._navigationIsCurrent(navigationEpoch, expectedState)) return false;
          self.currentIndex = targetIndex;
          self.updateUndoRedoButtons();
          if (typeof UIManager !== 'undefined') {
            UIManager.showSuccess('Acción deshecha');
          }
          if (MNEMOTAG_DEBUG) console.log('historyManager: Undo ejecutado. Índice:', self.currentIndex);
          return true;
        }
        if (MNEMOTAG_DEBUG) console.warn('historyManager: No hay más estados para deshacer');
        return false;
      });
    });
  },
  
  /**
   * Rehacer la acción deshecha
   */
  redo: function() {
    const self = this;
    return this._enqueueNavigation(async function () {
      const navigationEpoch = self._epoch;
      return self._runDocumentExclusive(async function (expectedState) {
        await self._saveQueue.catch(function () {});
        if (!self._navigationIsCurrent(navigationEpoch, expectedState)) return false;
        if (self.currentIndex < self.states.length - 1) {
          const targetIndex = self.currentIndex + 1;
          const restored = await self.restoreState(self.states[targetIndex], expectedState, navigationEpoch);
          if (!restored || !self._navigationIsCurrent(navigationEpoch, expectedState)) return false;
          self.currentIndex = targetIndex;
          self.updateUndoRedoButtons();
          if (typeof UIManager !== 'undefined') {
            UIManager.showSuccess('Acción rehecha');
          }
          if (MNEMOTAG_DEBUG) console.log('historyManager: Redo ejecutado. Índice:', self.currentIndex);
          return true;
        }
        if (MNEMOTAG_DEBUG) console.warn('historyManager: No hay más estados para rehacer');
        return false;
      });
    });
  },
  
  /**
   * Verificar si se puede deshacer
   * @returns {boolean}
   */
  canUndo: function() {
    return this.currentIndex > 0;
  },
  
  /**
   * Verificar si se puede rehacer
   * @returns {boolean}
   */
  canRedo: function() {
    return this.currentIndex < this.states.length - 1;
  },
  
  /**
   * Actualizar el estado visual de los botones deshacer/rehacer
   */
  updateUndoRedoButtons: function() {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = !canUndo;
      undoBtn.style.opacity = canUndo ? '1' : '0.5';
    }

    if (redoBtn) {
      redoBtn.disabled = !canRedo;
      redoBtn.style.opacity = canRedo ? '1' : '0.5';
    }

    // Botones de navegación del panel de historial
    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');
    if (prevBtn) {
      prevBtn.disabled = !canUndo;
      prevBtn.style.opacity = canUndo ? '1' : '0.4';
    }
    if (nextBtn) {
      nextBtn.disabled = !canRedo;
      nextBtn.style.opacity = canRedo ? '1' : '0.4';
    }

    // Indicador de posición
    const posEl = document.getElementById('history-position');
    if (posEl) {
      if (this.states.length > 0) {
        posEl.textContent = (this.currentIndex + 1) + ' / ' + this.states.length;
      } else {
        posEl.textContent = '';
      }
    }

    // v3.3.14: refresca el panel de historial visual si el caller lo
    // ha definido. El render es no-op cuando el panel está oculto.
    if (typeof window !== 'undefined' && typeof window.renderHistoryPanel === 'function') {
      try { window.renderHistoryPanel(); } catch (e) { /* defensive */ }
    }
  },
  
  /**
   * Obtener metadatos actuales del formulario
   * @returns {Object} Metadatos del formulario
   */
  getCurrentMetadata: function() {
    const form = document.getElementById('metadata-form');
    if (!form) return {};
    
    const formData = new FormData(form);
    return Object.fromEntries(formData);
  },
  
  /**
   * Obtener estado actual de los filtros (brillo, contraste, etc.)
   */
  getCurrentFilterState: function() {
    if (typeof FilterManager === 'undefined') return null;
    return Object.assign({}, FilterManager.filters);
  },

  /**
   * Obtener configuración actual de marcas de agua
   * @returns {Object} Configuración de marcas de agua
   */
  getCurrentWatermarkConfig: function() {
    return {
      textEnabled: document.getElementById('watermark-text-enabled')?.checked || false,
      imageEnabled: document.getElementById('watermark-image-enabled')?.checked || false,
      text: document.getElementById('watermark-text')?.value || '',
      font: document.getElementById('watermark-font')?.value || 'Arial',
      color: document.getElementById('watermark-color')?.value || '#000000',
      size: document.getElementById('watermark-size')?.value || '24',
      opacity: document.getElementById('watermark-opacity')?.value || '50',
      position: document.getElementById('watermark-position')?.value || 'bottom-right',
      imageOpacity: document.getElementById('watermark-image-opacity')?.value || '50',
      imageSize: document.getElementById('watermark-image-size')?.value || 'medium',
      imagePosition: document.getElementById('watermark-image-position')?.value || 'bottom-right',
      // v3.7.0: COPIAS de las posiciones custom, no referencias vivas — los
      // drags mutan el objeto en sitio y corrompían los estados guardados.
      // Antes solo se capturaba la de imagen; la de texto no se restauraba
      // nunca (undo tras mover el texto dejaba la posición movida).
      // v3.7.1: leídas vía AppState (fachada observable del estado global).
      customPosition: (typeof AppState !== 'undefined' && AppState.customImagePosition)
        ? { x: AppState.customImagePosition.x, y: AppState.customImagePosition.y }
        : null,
      customTextPosition: (typeof AppState !== 'undefined' && AppState.customTextPosition)
        ? { x: AppState.customTextPosition.x, y: AppState.customTextPosition.y }
        : null,
      imageElement: (typeof AppState !== 'undefined') ? AppState.watermarkImagePreview : null
    };
  },
  
  /**
   * Restaurar un estado guardado
   * @param {Object} state - Estado a restaurar
   */
  restoreState: async function(state, expectedState, navigationEpoch) {
    const canvas = AppState.canvas;
    const ctx = AppState.ctx;
    const expectedEpoch = Number.isSafeInteger(navigationEpoch) ? navigationEpoch : this._epoch;
    if (!state || !canvas || !this._navigationIsCurrent(expectedEpoch, expectedState)) return false;
    const expectedDocumentId = expectedState?.documentId || AppState.documentId;
    const expectedRevision = Number.isSafeInteger(expectedState?.documentRevision)
      ? expectedState.documentRevision
      : AppState.documentRevision;
    if (state.documentId && expectedDocumentId && state.documentId !== expectedDocumentId) return false;

    if (typeof SmartDebounce !== 'undefined' && typeof SmartDebounce.cancel === 'function') {
      SmartDebounce.cancel('save-history');
    }
    this.isRestoring = true;
    if (MNEMOTAG_DEBUG) console.log('historyManager: Iniciando restauración del estado...');

    try {
      // v3.4.6: función auxiliar que restaura los campos del formulario
      const applyFormState = async () => {
        // 1. Restaurar metadatos
        if (state.metadata) {
          const form = document.getElementById('metadata-form');
          if (form) {
            Object.entries(state.metadata).forEach(([key, value]) => {
              const field = form.querySelector(`[name="${key}"]`);
              if (field) field.value = value;
            });
          }
        }

        // 2. Restaurar configuración de marca de agua
        if (state.watermarkConfig) {
          const config = state.watermarkConfig;
          Object.entries(config).forEach(([key, value]) => {
            const element = document.getElementById(`watermark-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
            if (element) {
              if (element.type === 'checkbox') {
                element.checked = value;
              } else {
                element.value = value;
              }
            }
          });

          const sliderConfigs = [
            { sliderId: 'watermark-size', numberId: 'watermark-size-num' },
            { sliderId: 'watermark-opacity', numberId: 'watermark-opacity-num' },
            { sliderId: 'watermark-image-opacity', numberId: 'watermark-image-opacity-num' }
          ];
          sliderConfigs.forEach(({ sliderId, numberId }) => {
            const slider = document.getElementById(sliderId);
            const numberInput = document.getElementById(numberId);
            if (slider && numberInput) {
              numberInput.value = slider.value;
            }
          });

          // v3.7.0: restaurar AMBAS posiciones custom como copias. Los
          // estados antiguos no traían customTextPosition (undefined):
          // en ese caso se deja la actual (retrocompatibilidad).
          // v3.7.1: escritas vía AppState — los setters notifican a los
          // suscriptores (autosave de sesión, estimación de export...).
          if (config.customPosition !== undefined && typeof AppState !== 'undefined') {
            AppState.customImagePosition = config.customPosition
              ? { x: config.customPosition.x, y: config.customPosition.y }
              : null;
          }
          if (config.customTextPosition !== undefined && typeof AppState !== 'undefined') {
            AppState.customTextPosition = config.customTextPosition
              ? { x: config.customTextPosition.x, y: config.customTextPosition.y }
              : null;
          }
          if (Object.prototype.hasOwnProperty.call(config, 'imageElement') &&
              typeof AppState !== 'undefined') {
            AppState.watermarkImagePreview = config.imageElement || null;
          }
        }

        // 3. Restaurar nombre de archivo
        if (state.fileBaseName) {
          AppState.fileBaseName = state.fileBaseName;
          const basenameInput = document.getElementById('file-basename');
          if (basenameInput) {
            basenameInput.value = state.fileBaseName;
          }
          if (typeof updateFilenamePreview === 'function') {
            updateFilenamePreview();
          }
        }

        // 4. Restaurar filtros (v3.5.9)
        if (state.filterState && typeof FilterManager !== 'undefined') {
          Object.entries(state.filterState).forEach(([key, value]) => {
            FilterManager.filters[key] = value;
            FilterManager.updateFilterDisplay(key, value);
            const slider = document.getElementById(key);
            if (slider) slider.value = value;
          });
          
          if (typeof FilterManager.highlightActivePreset === 'function') {
            FilterManager.highlightActivePreset('none');
          }
          
          if (typeof FilterCache !== 'undefined') {
            FilterCache.markDirty();
          }
        }

        // 5. Restaurar rotación (v3.5.9)
        if (typeof state.rotation !== 'undefined') {
          AppState.currentRotation = state.rotation;
          AppState.isFlippedHorizontally = state.isFlippedHorizontally || false;
          AppState.isFlippedVertically = state.isFlippedVertically || false;
          
          if (typeof updateRotationDisplay === 'function') {
            updateRotationDisplay();
          }
        }

        // 6. Restaurar el CSS filter del canvas
        if (state.canvasFilter !== undefined && canvas) {
          canvas.style.filter = state.canvasFilter;
        }

        if (typeof toggleWatermarkType === 'function') {
          toggleWatermarkType();
        }

          if (!this._navigationIsCurrent(expectedEpoch, expectedState)) return false;
          if (state.textLayers && typeof window !== 'undefined' && window.textLayerManager &&
            typeof window.textLayerManager.importConfig === 'function') {
          const imported = await window.textLayerManager.importConfig(state.textLayers, {
            isCurrent: () => this._navigationIsCurrent(expectedEpoch, expectedState)
          });
          if (imported === false || !this._navigationIsCurrent(expectedEpoch, expectedState)) return false;
        }

        // El primer render de restoreRaster ocurre antes de restaurar filtros,
        // marcas y capas. Reconstruir de nuevo evita mostrar una composición
        // híbrida aunque el raster canónico ya sea correcto.
        if (typeof DocumentRenderer !== 'undefined' && DocumentRenderer.renderDocument) {
          const renderResult = DocumentRenderer.renderDocument({}, canvas);
          if (renderResult?.rendered) {
            AppState.transaction(function () {
              AppState.textWatermarkBounds = renderResult.watermarkBounds?.text || null;
              AppState.imageWatermarkBounds = renderResult.watermarkBounds?.image || null;
              AppState.textLayerBounds = renderResult.textLayerBounds || [];
            });
          }
        }
        
        if (MNEMOTAG_DEBUG) console.log('historyManager: UI Restaurada.');
      };

      // Restaura las dimensiones internas del canvas guardadas en el
      // estado (p. ej. tras un crop). El ajuste CSS lo hace main.js.
      const applyCanvasSize = (fallbackW, fallbackH) => {
        const w = state.canvasWidth || fallbackW;
        const h = state.canvasHeight || fallbackH;
        if (w && h && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }
      };

      if (typeof DocumentStateManager !== 'undefined') {
        let restoredSource = null;
        let restoredBaseline = null;
        const releaseTemporary = function (source) {
          if (!source) return;
          if (typeof source.close === 'function') {
            try { source.close(); } catch (error) { /* recurso ya liberado */ }
          } else if (typeof source.getContext === 'function') {
            source.width = 0;
            source.height = 0;
          }
        };
        try {
          // Decodificar todos los recursos antes de modificar AppState. Así el
          // undo es todo-o-nada aunque una transformación entre mientras se
          // clona la baseline.
          restoredSource = await DocumentStateManager.deserializeRaster(state);
          if (!this._navigationIsCurrent(expectedEpoch, expectedState)) {
            releaseTemporary(restoredSource);
            restoredSource = null;
            return false;
          }
          if (!state.resetUsesRaster && state.resetRasterSource) {
            restoredBaseline = await DocumentStateManager.deserializeRaster({
              sourceImage: state.resetRasterSource
            });
            if (!this._navigationIsCurrent(expectedEpoch, expectedState)) {
              releaseTemporary(restoredSource);
              releaseTemporary(restoredBaseline);
              restoredSource = null;
              restoredBaseline = null;
              return false;
            }
          }
        } catch (error) {
          releaseTemporary(restoredSource);
          releaseTemporary(restoredBaseline);
          throw error;
        }
        const restored = DocumentStateManager.commitRaster(restoredSource, {
          reason: 'history',
          saveHistory: false,
          takeOwnership: true,
          updateOriginalDimensions: false,
          expectedDocumentId,
          expectedRevision,
          expectedDocumentEpoch: expectedState?.documentEpoch,
          rotation: state.rotation,
          isFlippedHorizontally: state.isFlippedHorizontally,
          isFlippedVertically: state.isFlippedVertically
        });
        if (!restored) {
          releaseTemporary(restoredBaseline);
          return false;
        }
        restoredBaseline = state.resetUsesRaster ? AppState.currentImage : restoredBaseline;
        assignHistoryObjectId(AppState.currentImage, state.rasterStateId);
        assignHistoryObjectId(restoredBaseline, state.resetRasterId);
        AppState.transaction(function () {
          AppState.transformResetImage = restoredBaseline;
          AppState.originalWidth = Number.isFinite(state.originalWidth)
            ? state.originalWidth
            : state.canvasWidth;
          AppState.originalHeight = Number.isFinite(state.originalHeight)
            ? state.originalHeight
            : state.canvasHeight;
        });
        if (!this._navigationIsCurrent(expectedEpoch, expectedState)) return false;
        try {
          await applyFormState();
        } catch (uiError) {
          if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
            console.warn('historyManager: estado visual opcional no restaurado por completo', uiError);
          }
          if (this._navigationIsCurrent(expectedEpoch, expectedState) &&
              typeof DocumentRenderer !== 'undefined' && DocumentRenderer.renderDocument) {
            try {
              const renderResult = DocumentRenderer.renderDocument({}, canvas);
              if (renderResult?.rendered) {
                AppState.transaction(function () {
                  AppState.textWatermarkBounds = renderResult.watermarkBounds?.text || null;
                  AppState.imageWatermarkBounds = renderResult.watermarkBounds?.image || null;
                  AppState.textLayerBounds = renderResult.textLayerBounds || [];
                });
              }
            } catch (renderError) { /* raster ya confirmado */ }
          }
        }
        return this._navigationIsCurrent(expectedEpoch, expectedState);
      }

      // Fallback defensivo para integraciones que carguen este manager sin el
      // propietario del documento. La aplicación normal nunca usa esta rama.
      if (state.bitmap) {
        applyCanvasSize(state.bitmap.width, state.bitmap.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(state.bitmap, 0, 0);
        await applyFormState();
        return true;
      }
      if (state.imageData) {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = function() {
            applyCanvasSize(img.width, img.height);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
          img.src = state.imageData;
        });
        await applyFormState();
        return true;
      }
      return false;
    } finally {
      historyManager.isRestoring = false;
      if (MNEMOTAG_DEBUG) console.log('historyManager: isRestoring desactivado (restauración finalizada).');
    }
  },
  
  /**
   * Limpiar todo el historial.
   * v3.4.6: cierra los ImageBitmaps para liberar memoria GPU.
   */
  clear: function() {
    this._epoch++;
    // clear() invalida una navegación en curso. La nueva carga debe poder
    // guardar inmediatamente su estado inicial aunque el restore antiguo aún
    // esté terminando una fuente asíncrona.
    this.isRestoring = false;
    const statesToRelease = this.states.slice();
    this.states = [];
    this.currentIndex = -1;
    // Una navegación puede estar clonando un ImageBitmap. Posponer close()
    // hasta que termine evita invalidar el recurso a mitad de restore; el
    // expectedDocumentId impedirá que ese resultado sustituya otra imagen.
    this._navigationQueue = this._navigationQueue.catch(function () {}).then(() => {
      statesToRelease.forEach(state => this._releaseState(state));
    });
    this.updateUndoRedoButtons();
    if (typeof UIManager !== 'undefined' && UIManager.showSuccess) {
      UIManager.showSuccess('🗑️ Historial vaciado');
    }
  },
  
  /**
   * Obtener información del historial
   * @returns {Object} Información del historial
   */
  getInfo: function() {
    return {
      totalStates: this.states.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      maxStates: this.maxStates,
      memoryBytes: this._memoryUsage()
    };
  },

  /**
   * v3.3.14 — Devuelve un resumen de los estados con thumbnails 80×80
   * para mostrar en el panel de historial visual.
   * v3.4.6: genera thumbnails reales (80×80) a partir de bitmap o
   * dataURL en lugar de devolver el dataURL completo, ahorrando ancho
   * en el DOM cuando hay muchos estados.
   * @returns {Array<{index, thumbnail, timestamp, isCurrent}>}
   */
  getStatesSummary: function() {
    const out = [];
    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];
      out.push({
        index: i,
        thumbnail: this._buildThumbnail(state, 80),
        timestamp: state.timestamp || 0,
        isCurrent: i === this.currentIndex
      });
    }
    return out;
  },

  /**
   * v3.4.6 — Genera un thumbnail 80×80 sintético desde un state.
   * Si el state tiene `bitmap` (ImageBitmap), lo pinta directamente en
   * un canvas temporal 80×80 con object-fit: contain. Si tiene
   * `imageData` (dataURL legacy), devuelve el dataURL original y
   * delega el escalado al CSS del <img> que lo consumirá.
   * @param {Object} state
   * @param {number} size
   * @returns {string} dataURL del thumbnail
   */
  _buildThumbnail: function(state, size) {
    if (!state) return '';
    try {
      if (state.bitmap) {
        if (!this._thumbCanvas) {
          this._thumbCanvas = document.createElement('canvas');
        }
        const tmp = this._thumbCanvas;
        tmp.width = size;
        tmp.height = size;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#1f2937';
        tctx.fillRect(0, 0, size, size);
        // contain: encajar manteniendo aspect ratio, centrado.
        const bw = state.bitmap.width;
        const bh = state.bitmap.height;
        const scale = Math.min(size / bw, size / bh);
        const dw = bw * scale;
        const dh = bh * scale;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        tctx.drawImage(state.bitmap, dx, dy, dw, dh);
        return tmp.toDataURL('image/jpeg', 0.8);
      }
      // Legacy: dataURL completo, el CSS hace el escalado.
      if (state.imageData) return state.imageData;
      return '';
    } catch (err) {
      console.error('Error generando thumbnail del historial:', err);
      return state.imageData || '';
    }
  },

  /**
   * v3.3.14 — Restaurar un estado por índice (para los thumbnails).
   * @param {number} index
   */
  jumpToState: function(index) {
    if (index < 0 || index >= this.states.length) return Promise.resolve(false);
    const self = this;
    return this._enqueueNavigation(async function () {
      const navigationEpoch = self._epoch;
      return self._runDocumentExclusive(async function (expectedState) {
        await self._saveQueue.catch(function () {});
        if (!self._navigationIsCurrent(navigationEpoch, expectedState) ||
            index < 0 || index >= self.states.length) return false;
        const restored = await self.restoreState(self.states[index], expectedState, navigationEpoch);
        if (!restored || !self._navigationIsCurrent(navigationEpoch, expectedState)) return false;
        self.currentIndex = index;
        self.updateUndoRedoButtons();
        if (typeof UIManager !== 'undefined') {
          UIManager.showSuccess('Saltado al estado ' + (index + 1));
        }
        return true;
      });
    });
  }
};

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = historyManager;
}
