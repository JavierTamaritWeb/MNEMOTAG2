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
const HISTORY_MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB cumulativos

const historyManager = {
  states: [],
  currentIndex: -1,
  maxStates: 20,
  isRestoring: false,

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
    if (!canvas || !currentImage) {
      if (MNEMOTAG_DEBUG) console.warn('historyManager: No se guarda estado (canvas o imagen no cargada)');
      return;
    }

    // Remover estados futuros si estamos en medio del historial.
    // Liberar ImageBitmaps descartados para no fugar memoria GPU.
    const discarded = this.states.slice(this.currentIndex + 1);
    discarded.forEach(s => { if (s && s.bitmap && s.bitmap.close) s.bitmap.close(); });
    this.states = this.states.slice(0, this.currentIndex + 1);

    // Metadata base común para cualquier estrategia de snapshot.
    const baseState = {
      metadata: this.getCurrentMetadata(),
      watermarkConfig: this.getCurrentWatermarkConfig(),
      filterState: this.getCurrentFilterState(),
      canvasFilter: canvas.style.filter || '',
      fileBaseName: fileBaseName || 'imagen',
      rotation: typeof currentRotation !== 'undefined' ? currentRotation : 0,
      isFlippedHorizontally: typeof isFlippedHorizontally !== 'undefined' ? isFlippedHorizontally : false,
      isFlippedVertically: typeof isFlippedVertically !== 'undefined' ? isFlippedVertically : false,
      timestamp: Date.now()
    };

    const self = this;
    const commitState = function (state) {
      self.states.push(state);
      self.currentIndex++;
      while (self.states.length > self.maxStates) {
        const removed = self.states.shift();
        if (removed && removed.bitmap && removed.bitmap.close) removed.bitmap.close();
        self.currentIndex--;
      }
      self.updateUndoRedoButtons();
      if (MNEMOTAG_DEBUG) console.log(`historyManager: Estado guardado. Historial: ${self.currentIndex + 1}/${self.states.length}`);
    };

    // Estrategia 1: ImageBitmap (preferida). Ahora con await.
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(canvas);
        commitState(Object.assign({}, baseState, { bitmap: bitmap }));
        return;
      } catch (err) {
        MNEMOTAG_DEBUG && console.warn('historyManager: createImageBitmap falló, fallback a dataURL:', err);
      }
    }

    // Estrategia 2 (fallback legacy): dataURL.
    const dataURL = canvas.toDataURL();
    const newSize = dataURL.length;
    if (newSize > HISTORY_MAX_TOTAL_SIZE) {
      MNEMOTAG_DEBUG && console.warn(
        `historyManager: snapshot demasiado grande (${(newSize / 1024 / 1024).toFixed(1)} MB). No se guarda.`
      );
      return;
    }
    let totalSize = this.states.reduce((acc, s) => acc + (s.imageData ? s.imageData.length : 0), 0);
    while (this.states.length > 0 && (totalSize + newSize) > HISTORY_MAX_TOTAL_SIZE) {
      const removed = this.states.shift();
      totalSize -= (removed && removed.imageData ? removed.imageData.length : 0);
      if (this.currentIndex > 0) this.currentIndex--;
    }
    commitState(Object.assign({}, baseState, { imageData: dataURL }));
  },
  
  /**
   * Deshacer la última acción
   */
  undo: function() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      historyManager.restoreState(this.states[this.currentIndex]);
      this.updateUndoRedoButtons();
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('Acción deshecha');
      }
      if (MNEMOTAG_DEBUG) console.log('historyManager: Undo ejecutado. Índice:', this.currentIndex);
    } else {
      if (MNEMOTAG_DEBUG) console.warn('historyManager: No hay más estados para deshacer');
    }
  },
  
  /**
   * Rehacer la acción deshecha
   */
  redo: function() {
    if (this.currentIndex < this.states.length - 1) {
      this.currentIndex++;
      historyManager.restoreState(this.states[this.currentIndex]);
      this.updateUndoRedoButtons();
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('Acción rehecha');
      }
      if (MNEMOTAG_DEBUG) console.log('historyManager: Redo ejecutado. Índice:', this.currentIndex);
    } else {
      if (MNEMOTAG_DEBUG) console.warn('historyManager: No hay más estados para rehacer');
    }
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
      customPosition: typeof customImagePosition !== 'undefined' ? customImagePosition : null
    };
  },
  
  /**
   * Restaurar un estado guardado
   * @param {Object} state - Estado a restaurar
   */
  restoreState: function(state) {
    if (!state || !canvas) return;

    this.isRestoring = true;
    if (MNEMOTAG_DEBUG) console.log('historyManager: Iniciando restauración del estado...');

    try {
      // v3.4.6: función auxiliar que restaura los campos del formulario
      const applyFormState = () => {
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

          if (config.customPosition && typeof customImagePosition !== 'undefined') {
            customImagePosition = config.customPosition;
          }
        }

        // 3. Restaurar nombre de archivo
        if (state.fileBaseName) {
          if (typeof fileBaseName !== 'undefined') {
            fileBaseName = state.fileBaseName;
          }
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
          if (typeof currentRotation !== 'undefined') currentRotation = state.rotation;
          if (typeof isFlippedHorizontally !== 'undefined') isFlippedHorizontally = state.isFlippedHorizontally || false;
          if (typeof isFlippedVertically !== 'undefined') isFlippedVertically = state.isFlippedVertically || false;
          
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
        
        if (MNEMOTAG_DEBUG) console.log('historyManager: UI Restaurada.');
      };

      // Restaurar canvas (ImageBitmap preferido, dataURL fallback)
      if (state.bitmap) {
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(state.bitmap, 0, 0);
          applyFormState();
        } catch (err) {
          MNEMOTAG_DEBUG && console.warn('historyManager.restoreState: error dibujando bitmap, intentando dataURL:', err);
        }
      } else if (state.imageData) {
        const img = new Image();
        img.onload = function() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          applyFormState();
        };
        img.src = state.imageData;
      }
    } finally {
      // v3.5.9: Desbloquear saveState tras breve delay para asegurar que 
      // todos los eventos disparados por la restauración hayan terminado.
      setTimeout(() => {
        historyManager.isRestoring = false;
        if (MNEMOTAG_DEBUG) console.log('historyManager: isRestoring desactivado (restauración finalizada).');
      }, 150);
    }
  },
  
  /**
   * Limpiar todo el historial.
   * v3.4.6: cierra los ImageBitmaps para liberar memoria GPU.
   */
  clear: function() {
    this.states.forEach(s => {
      if (s && s.bitmap && typeof s.bitmap.close === 'function') {
        try { s.bitmap.close(); } catch (e) { /* defensive */ }
      }
    });
    this.states = [];
    this.currentIndex = -1;
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
      maxStates: this.maxStates
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
    if (index < 0 || index >= this.states.length) return;
    this.currentIndex = index;
    historyManager.restoreState(this.states[index]);
    this.updateUndoRedoButtons();
    if (typeof UIManager !== 'undefined') {
      UIManager.showSuccess('Saltado al estado ' + (index + 1));
    }
  }
};

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = historyManager;
}
