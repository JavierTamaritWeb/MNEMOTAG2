'use strict';

// ===== HISTORY MANAGER =====
// Gestión de historial para deshacer/rehacer en ImgCraft v3.0

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
  saveState: function() {
    if (!canvas || !currentImage) return;

    // Remover estados futuros si estamos en medio del historial.
    // Liberar ImageBitmaps descartados para no fugar memoria GPU.
    const discarded = this.states.slice(this.currentIndex + 1);
    discarded.forEach(s => { if (s && s.bitmap && s.bitmap.close) s.bitmap.close(); });
    this.states = this.states.slice(0, this.currentIndex + 1);

    // Metadata base común para cualquier estrategia de snapshot.
    const baseState = {
      metadata: this.getCurrentMetadata(),
      watermarkConfig: this.getCurrentWatermarkConfig(),
      fileBaseName: fileBaseName || 'imagen',
      timestamp: Date.now()
    };

    const self = this;
    const commitState = function (state) {
      self.states.push(state);
      self.currentIndex++;
      // Limitar número de estados (techo absoluto).
      while (self.states.length > self.maxStates) {
        const removed = self.states.shift();
        if (removed && removed.bitmap && removed.bitmap.close) removed.bitmap.close();
        self.currentIndex--;
      }
      self.updateUndoRedoButtons();
    };

    // Estrategia 1: ImageBitmap (preferida).
    if (typeof createImageBitmap === 'function') {
      try {
        createImageBitmap(canvas).then(function (bitmap) {
          commitState(Object.assign({}, baseState, { bitmap: bitmap }));
        }).catch(function (err) {
          console.warn('historyManager: createImageBitmap falló, fallback a dataURL:', err);
          commitState(Object.assign({}, baseState, { imageData: canvas.toDataURL() }));
        });
        return;
      } catch (err) {
        console.warn('historyManager: createImageBitmap lanzó, fallback a dataURL:', err);
      }
    }

    // Estrategia 2 (fallback legacy): dataURL con el cap de memoria clásico.
    const dataURL = canvas.toDataURL();
    const newSize = dataURL.length;
    if (newSize > HISTORY_MAX_TOTAL_SIZE) {
      console.warn(
        `historyManager: snapshot demasiado grande (${(newSize / 1024 / 1024).toFixed(1)} MB), ` +
        `excede el tope de ${(HISTORY_MAX_TOTAL_SIZE / 1024 / 1024)} MB. No se guarda al historial.`
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
      this.restoreState(this.states[this.currentIndex]);
      this.updateUndoRedoButtons();
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('Acción deshecha');
      }
    }
  },
  
  /**
   * Rehacer la acción deshecha
   */
  redo: function() {
    if (this.currentIndex < this.states.length - 1) {
      this.currentIndex++;
      this.restoreState(this.states[this.currentIndex]);
      this.updateUndoRedoButtons();
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('Acción rehecha');
      }
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
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = !this.canUndo();
      undoBtn.style.opacity = this.canUndo() ? '1' : '0.5';
    }

    if (redoBtn) {
      redoBtn.disabled = !this.canRedo();
      redoBtn.style.opacity = this.canRedo() ? '1' : '0.5';
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

    // v3.4.6: función auxiliar que restaura los campos del formulario
    // después de que el canvas ya ha sido repintado.
    const applyFormState = function () {
      // Restaurar metadatos
      if (state.metadata) {
        const form = document.getElementById('metadata-form');
        if (form) {
          Object.entries(state.metadata).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) field.value = value;
          });
        }
      }

      // Restaurar configuración de marca de agua
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

      if (typeof toggleWatermarkType === 'function') {
        toggleWatermarkType();
      }
    };

    // v3.4.6: dos estrategias — ImageBitmap (sync, rápido) o dataURL
    // (async, legacy fallback). Detectamos por la presencia del campo.
    if (state.bitmap) {
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(state.bitmap, 0, 0);
        applyFormState();
        return;
      } catch (err) {
        console.warn('historyManager.restoreState: error dibujando bitmap, intentando dataURL:', err);
        // Cae al fallback de dataURL si existe.
      }
    }

    if (state.imageData) {
      const img = new Image();
      img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        applyFormState();
      };
      img.src = state.imageData;
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
    this.restoreState(this.states[index]);
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
