'use strict';

// ===== PRESET MANAGER (v3.4.5) =====
// Guarda/carga/lista/borra presets de filtros en localStorage.
// Un preset captura los valores de todos los sliders de filtros y los
// aplica de vuelta al DOM (los listeners existentes de main.js se
// encargan de recalcular el canvas con los nuevos valores).

const PresetManager = {
  STORAGE_PREFIX: 'mnemotag-preset-',
  INDEX_KEY: 'mnemotag-preset-index',

  // IDs de los inputs cuyos valores forman parte de un preset.
  // Son los sliders + selects de la sección de filtros. Los watermarks
  // NO se incluyen (son ortogonales y el usuario suele quererlos por
  // separado por cada imagen).
  PRESET_FIELDS: [
    'brightness',
    'contrast',
    'saturation',
    'blur'
  ],

  /**
   * Devuelve la lista de nombres de presets guardados.
   */
  listPresets: function () {
    try {
      const raw = localStorage.getItem(this.INDEX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('PresetManager.listPresets: error leyendo índice', err);
      return [];
    }
  },

  /**
   * Lee los valores actuales del DOM y los devuelve como objeto.
   */
  captureCurrentState: function () {
    const state = {};
    this.PRESET_FIELDS.forEach(field => {
      const el = document.getElementById(field);
      if (el) {
        state[field] = el.value;
      }
    });
    state._version = 1;
    state._createdAt = Date.now();
    return state;
  },

  /**
   * Guarda un preset con el nombre dado. Sobrescribe si ya existía.
   * @returns {boolean} true si se guardó.
   */
  savePreset: function (name) {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    // Validar caracteres permitidos — letras, números, espacios, guiones.
    if (!/^[a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]{1,40}$/.test(trimmed)) {
      if (typeof UIManager !== 'undefined') {
        UIManager.showError('Nombre de preset no válido. Usa letras, números, espacios, guiones o guiones bajos (máx. 40 caracteres).');
      }
      return false;
    }

    const state = this.captureCurrentState();
    try {
      localStorage.setItem(this.STORAGE_PREFIX + trimmed, JSON.stringify(state));
      // Actualizar el índice de presets.
      const index = this.listPresets();
      if (!index.includes(trimmed)) {
        index.push(trimmed);
        index.sort();
        localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      }
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('💾 Preset "' + trimmed + '" guardado');
      }
      return true;
    } catch (err) {
      console.error('PresetManager.savePreset: error guardando', err);
      if (typeof UIManager !== 'undefined') {
        UIManager.showError('No se pudo guardar el preset: ' + (err.message || err));
      }
      return false;
    }
  },

  /**
   * Carga un preset y aplica sus valores a los inputs del DOM.
   * Dispara `input` + `change` events para que los listeners existentes
   * recalculen el canvas automáticamente.
   * @returns {boolean} true si se cargó correctamente.
   */
  loadPreset: function (name) {
    if (!name) return false;
    try {
      const raw = localStorage.getItem(this.STORAGE_PREFIX + name);
      if (!raw) {
        if (typeof UIManager !== 'undefined') {
          UIManager.showError('Preset "' + name + '" no encontrado');
        }
        return false;
      }
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') {
        if (typeof UIManager !== 'undefined') {
          UIManager.showError('Preset "' + name + '" está corrupto');
        }
        return false;
      }

      this.PRESET_FIELDS.forEach(field => {
        if (state[field] !== undefined) {
          const el = document.getElementById(field);
          if (el) {
            el.value = state[field];
            // Disparar los eventos para que main.js recalcule el canvas.
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });

      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('📂 Preset "' + name + '" cargado');
      }
      return true;
    } catch (err) {
      console.error('PresetManager.loadPreset: error cargando', err);
      if (typeof UIManager !== 'undefined') {
        UIManager.showError('No se pudo cargar el preset: ' + (err.message || err));
      }
      return false;
    }
  },

  /**
   * Elimina un preset por nombre.
   * @returns {boolean} true si se eliminó.
   */
  deletePreset: function (name) {
    if (!name) return false;
    try {
      localStorage.removeItem(this.STORAGE_PREFIX + name);
      const index = this.listPresets().filter(n => n !== name);
      localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
      if (typeof UIManager !== 'undefined') {
        UIManager.showSuccess('🗑️ Preset "' + name + '" eliminado');
      }
      return true;
    } catch (err) {
      console.error('PresetManager.deletePreset: error eliminando', err);
      return false;
    }
  },

  /**
   * Rellena un <select> con los presets disponibles.
   */
  populateSelect: function (selectEl) {
    if (!selectEl) return;
    const presets = this.listPresets();
    // Preservar la selección actual si sigue existiendo.
    const currentValue = selectEl.value;
    // Opción por defecto.
    selectEl.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = presets.length === 0
      ? '— No hay presets guardados —'
      : '— Elige un preset —';
    selectEl.appendChild(defaultOpt);
    presets.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
    if (currentValue && presets.includes(currentValue)) {
      selectEl.value = currentValue;
    }
  }
};

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PresetManager;
}
