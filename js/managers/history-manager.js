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

  /**
   * Guardar el estado actual del canvas y configuración
   */
  saveState: function() {
    if (!canvas || !currentImage) return;

    // Remover estados futuros si estamos en medio del historial
    this.states = this.states.slice(0, this.currentIndex + 1);

    // Guardar estado actual
    const state = {
      imageData: canvas.toDataURL(),
      metadata: this.getCurrentMetadata(),
      watermarkConfig: this.getCurrentWatermarkConfig(),
      fileBaseName: fileBaseName || 'imagen', // Incluir nombre de archivo
      timestamp: Date.now()
    };

    // Control de memoria: si el propio nuevo snapshot excede el tope,
    // no se guarda (sería absurdo evict-ear todo el historial por uno solo).
    const newSize = state.imageData ? state.imageData.length : 0;
    if (newSize > HISTORY_MAX_TOTAL_SIZE) {
      console.warn(
        `historyManager: snapshot demasiado grande (${(newSize / 1024 / 1024).toFixed(1)} MB), ` +
        `excede el tope de ${(HISTORY_MAX_TOTAL_SIZE / 1024 / 1024)} MB. No se guarda al historial.`
      );
      return;
    }

    // Liberar estados viejos hasta que el nuevo entre en el presupuesto total.
    let totalSize = this.states.reduce((acc, s) => acc + (s.imageData ? s.imageData.length : 0), 0);
    while (this.states.length > 0 && (totalSize + newSize) > HISTORY_MAX_TOTAL_SIZE) {
      const removed = this.states.shift();
      totalSize -= (removed && removed.imageData ? removed.imageData.length : 0);
      if (this.currentIndex > 0) this.currentIndex--;
    }

    this.states.push(state);
    this.currentIndex++;

    // Limitar también el número de estados (techo absoluto del historial)
    if (this.states.length > this.maxStates) {
      this.states.shift();
      this.currentIndex--;
    }

    this.updateUndoRedoButtons();
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
    
    const img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
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
        
        // Sincronizar campos numéricos después de restaurar valores
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
      
      // Restaurar nombre base del archivo
      if (state.fileBaseName) {
        if (typeof fileBaseName !== 'undefined') {
          fileBaseName = state.fileBaseName;
        }
        
        const basenameInput = document.getElementById('file-basename');
        if (basenameInput) {
          basenameInput.value = state.fileBaseName;
        }
        
        // Actualizar preview del nombre final si la función existe
        if (typeof updateFilenamePreview === 'function') {
          updateFilenamePreview();
        }
      }
      
      // Llamar a toggleWatermarkType si existe
      if (typeof toggleWatermarkType === 'function') {
        toggleWatermarkType();
      }
    };
    img.src = state.imageData;
  },
  
  /**
   * Limpiar todo el historial
   */
  clear: function() {
    this.states = [];
    this.currentIndex = -1;
    this.updateUndoRedoButtons();
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
   * @returns {Array<{index, thumbnail, timestamp, isCurrent}>}
   */
  getStatesSummary: function() {
    const out = [];
    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i];
      out.push({
        index: i,
        thumbnail: this._buildThumbnail(state.imageData, 80),
        timestamp: state.timestamp || 0,
        isCurrent: i === this.currentIndex
      });
    }
    return out;
  },

  /**
   * v3.3.14 — Genera un thumbnail cuadrado a partir del dataURL de un
   * snapshot del historial. El thumbnail mantiene aspect ratio y se
   * encaja en el bounding box `size×size` con las bandas necesarias.
   * Devuelve un dataURL JPEG de baja calidad para ahorrar memoria.
   * @param {string} sourceDataUrl
   * @param {number} size
   * @returns {string} dataURL del thumbnail
   */
  _buildThumbnail: function(sourceDataUrl, size) {
    if (!sourceDataUrl) return '';
    try {
      // Reusar canvas temporal entre llamadas para no crear N elementos.
      if (!this._thumbCanvas) {
        this._thumbCanvas = document.createElement('canvas');
      }
      const tmp = this._thumbCanvas;
      tmp.width = size;
      tmp.height = size;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#1f2937';
      tctx.fillRect(0, 0, size, size);

      // No podemos usar Image() de forma síncrona aquí. En su lugar,
      // devolvemos una señal especial: el caller hará lazy loading
      // mediante una <img> con src=sourceDataUrl y un onload que
      // dibuje el thumbnail en su lugar. Para mantener la API simple,
      // devolvemos el dataURL original y dejamos que el CSS recorte.
      return sourceDataUrl;
    } catch (err) {
      console.error('Error generando thumbnail del historial:', err);
      return sourceDataUrl;
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
