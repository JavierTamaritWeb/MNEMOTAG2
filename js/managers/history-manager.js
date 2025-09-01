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
      timestamp: Date.now()
    };
    
    this.states.push(state);
    this.currentIndex++;
    
    // Limitar el número de estados
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
        
        if (config.customPosition && typeof customImagePosition !== 'undefined') {
          customImagePosition = config.customPosition;
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
  }
};

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = historyManager;
}
