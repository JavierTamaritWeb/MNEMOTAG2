'use strict';

// ===== PRESET MANAGER (v3.4.5, ampliado en v3.7.0) =====
// Guarda/carga/lista/borra presets de filtros en localStorage.
//
// v3.7.0 (_version: 2): un preset captura el estado COMPLETO de filtros de
// FilterManager (brightness, contrast, saturation, blur, sepia, hueRotate —
// incluye lo que aplican los filtros preestablecidos tipo Sepia/Vintage,
// que no tienen slider propio), no solo los 4 sliders manuales. Los presets
// v1 antiguos (campos sueltos en el nivel superior) se siguen cargando:
// sus 4 valores se aplican y el resto se restablece a 0.
// Los watermarks NO se incluyen (son ortogonales y el usuario suele
// quererlos por separado por cada imagen).

const PresetManager = {
  STORAGE_PREFIX: 'mnemotag-preset-',
  INDEX_KEY: 'mnemotag-preset-index',

  // IDs de los inputs con slider propio (subset de FILTER_KEYS). Se usan
  // como fallback de captura/aplicación cuando FilterManager no está
  // disponible (runner Node, uso aislado).
  PRESET_FIELDS: [
    'brightness',
    'contrast',
    'saturation',
    'blur'
  ],

  // Conjunto COMPLETO de filtros que forman un preset v2. Debe mantenerse
  // alineado con FilterManager.filters.
  FILTER_KEYS: [
    'brightness',
    'contrast',
    'saturation',
    'blur',
    'sepia',
    'hueRotate'
  ],

  /**
   * Comprueba si un nombre de preset está reservado. "index" (en cualquier
   * combinación de mayúsculas) se rechaza porque STORAGE_PREFIX + 'index'
   * colisiona con INDEX_KEY y destruiría el índice de presets.
   */
  isReservedName: function (name) {
    return typeof name === 'string' && name.trim().toLowerCase() === 'index';
  },

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
   * Captura el estado COMPLETO de filtros (v3.7.0).
   * Fuente primaria: FilterManager.filters (incluye sepia/hueRotate de los
   * filtros preestablecidos). Fallback sin FilterManager: los 4 sliders.
   */
  captureCurrentState: function () {
    const state = { _version: 2, _createdAt: Date.now(), filters: {} };

    if (typeof FilterManager !== 'undefined' && FilterManager.filters) {
      this.FILTER_KEYS.forEach(key => {
        const value = Number(FilterManager.filters[key]);
        state.filters[key] = Number.isFinite(value) ? value : 0;
      });
    } else {
      this.PRESET_FIELDS.forEach(field => {
        const el = document.getElementById(field);
        if (el) {
          const value = Number(el.value);
          state.filters[field] = Number.isFinite(value) ? value : 0;
        }
      });
    }
    return state;
  },

  /**
   * Aplica un conjunto de valores de filtros al editor (v3.7.0).
   * Los filtros no presentes en `filters` se restablecen a 0 para que
   * cargar un preset sea determinista (no hereda restos del estado previo).
   * Con FilterManager: asigna el estado completo, sincroniza sliders y
   * displays, y re-renderiza. Sin él (tests aislados): sliders + eventos.
   */
  _applyFilterValues: function (filters) {
    const target = {};
    this.FILTER_KEYS.forEach(key => {
      const value = Number(filters && filters[key]);
      target[key] = Number.isFinite(value) ? value : 0;
    });

    if (typeof FilterManager !== 'undefined' && FilterManager.filters) {
      this.FILTER_KEYS.forEach(key => {
        FilterManager.filters[key] = target[key];
        if (typeof FilterManager.updateFilterDisplay === 'function') {
          FilterManager.updateFilterDisplay(key, target[key]);
        }
        const slider = (typeof document !== 'undefined') ? document.getElementById(key) : null;
        if (slider) slider.value = target[key];
      });
      if (typeof FilterManager.applyFiltersImmediate === 'function') {
        FilterManager.applyFiltersImmediate();
      }
      return;
    }

    // Fallback sin FilterManager: solo los sliders con input propio; los
    // listeners de main.js recalculan el canvas al recibir los eventos.
    this.PRESET_FIELDS.forEach(field => {
      const el = (typeof document !== 'undefined') ? document.getElementById(field) : null;
      if (!el) return;
      el.value = target[field];
      if (typeof el.dispatchEvent === 'function' && typeof Event !== 'undefined') {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
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
    // Rechazar el nombre reservado "index": sobrescribiría la clave del
    // índice de presets en localStorage y destruiría la lista completa.
    if (this.isReservedName(trimmed)) {
      if (typeof UIManager !== 'undefined') {
        UIManager.showError('El nombre "index" está reservado para uso interno. Elige otro nombre para el preset.');
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
    // "index" (exacto) nunca es un preset válido: es la clave del índice interno.
    if (name === 'index') return false;
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

      // v3.7.0: presets v2 llevan el estado completo en state.filters.
      // Los v1 antiguos tienen los 4 campos sueltos en el nivel superior:
      // se aplican esos y el resto se restablece a 0 (retrocompatibilidad).
      if (state._version >= 2 && state.filters && typeof state.filters === 'object') {
        this._applyFilterValues(state.filters);
      } else {
        const legacy = {};
        this.PRESET_FIELDS.forEach(field => {
          if (state[field] !== undefined) legacy[field] = state[field];
        });
        this._applyFilterValues(legacy);
      }

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
    // Evitar que un borrado de "index" (exacto) elimine la clave del índice interno.
    if (name === 'index') return false;
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

    const emptyState = document.getElementById('preset-empty-state');
    if (emptyState) emptyState.hidden = presets.length !== 0;
  }
};

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PresetManager;
}
