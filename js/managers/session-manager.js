'use strict';

// ===== SESSION MANAGER (v3.7.0) =====
// Restauración de sesión con IndexedDB: guarda la imagen original (File),
// el estado del formulario del panel (metadatos, marca de agua, ajustes,
// exportación), los filtros de FilterManager y las capas de texto. Al abrir
// la app, si hay una sesión reciente guardada, main.js ofrece restaurarla.
//
// Diseño:
//   - Un único registro (KEY 'current') en un object store simple. Guardar
//     sobrescribe; no hay histórico (el histórico de edición ya lo cubre
//     HistoryManager en memoria).
//   - El File se guarda tal cual (IndexedDB soporta Blob/File via structured
//     clone). NO se guarda ningún canvas renderizado: al restaurar, la
//     imagen se recarga por el flujo normal y los ajustes se reaplican.
//   - Ultra-defensivo: cualquier error (IndexedDB no disponible, cuota,
//     modo privado…) degrada en silencio. La app funciona igual sin sesión.
//   - La marca de agua de IMAGEN no se restaura (contiene un Image del DOM);
//     se restaura su configuración de formulario, pero el usuario debe
//     volver a elegir el archivo de la marca.

const SessionManager = {
  DB_NAME: 'mnemotag-session',
  DB_VERSION: 1,
  STORE_NAME: 'session',
  KEY: 'current',
  // Sesiones más antiguas se descartan al cargar (evita restaurar trabajo
  // irrelevante de hace semanas).
  MAX_AGE_MS: 72 * 60 * 60 * 1000, // 72 horas
  AUTOSAVE_DEBOUNCE_MS: 2500,

  _autoSaveTimer: null,
  _collector: null,
  _restoring: false,

  /**
   * ¿Hay soporte de IndexedDB en este entorno?
   */
  isSupported: function () {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (err) {
      return false;
    }
  },

  /**
   * Abre (y crea si hace falta) la base de datos.
   * @returns {Promise<IDBDatabase>}
   */
  _open: function () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña'));
    });
  },

  /**
   * Ejecuta una operación sobre el store y cierra la conexión al terminar.
   * @param {'readonly'|'readwrite'} mode
   * @param {(store: IDBObjectStore) => IDBRequest} operation
   * @returns {Promise<any>} resultado del request
   */
  _withStore: async function (mode, operation) {
    const db = await this._open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, mode);
        const request = operation(tx.objectStore(this.STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Operación IndexedDB fallida'));
      });
    } finally {
      try { db.close(); } catch (closeErr) { /* conexión ya cerrada */ }
    }
  },

  /**
   * Guarda la sesión (sobrescribe la anterior). Nunca lanza.
   * @param {Object} data - estado serializable (File incluido)
   * @returns {Promise<boolean>} true si se guardó
   */
  save: async function (data) {
    if (!this.isSupported() || !data) return false;
    try {
      await this._withStore('readwrite', (store) => store.put(data, this.KEY));
      return true;
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('SessionManager.save: no se pudo guardar la sesión:', err);
      return false;
    }
  },

  /**
   * Carga la sesión guardada. Devuelve null si no hay, si está caducada
   * (se borra) o si algo falla. Nunca lanza.
   * @returns {Promise<Object|null>}
   */
  load: async function () {
    if (!this.isSupported()) return null;
    try {
      const data = await this._withStore('readonly', (store) => store.get(this.KEY));
      if (!data || typeof data !== 'object') return null;
      if (!data.savedAt || (Date.now() - data.savedAt) > this.MAX_AGE_MS) {
        await this.clear();
        return null;
      }
      return data;
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('SessionManager.load: no se pudo leer la sesión:', err);
      return null;
    }
  },

  /**
   * Borra la sesión guardada. Nunca lanza.
   */
  clear: async function () {
    if (!this.isSupported()) return;
    try {
      await this._withStore('readwrite', (store) => store.delete(this.KEY));
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('SessionManager.clear: no se pudo borrar la sesión:', err);
    }
  },

  /**
   * Registra la función que recolecta el estado a guardar (vive en main.js,
   * que es quien ve las variables de estado). Debe devolver el objeto a
   * persistir o null si no hay nada que guardar.
   */
  configureAutoSave: function (collectFn) {
    this._collector = (typeof collectFn === 'function') ? collectFn : null;
  },

  /**
   * Autosave debounced — seguro de llamar en cada re-render del preview.
   * No hace nada durante una restauración en curso (evita re-guardar el
   * estado a medio aplicar).
   */
  scheduleAutoSave: function () {
    if (!this._collector || this._restoring || !this.isSupported()) return;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      this._autoSaveTimer = null;
      try {
        const data = this._collector();
        if (data) this.save(data);
      } catch (err) {
        MNEMOTAG_DEBUG && console.warn('SessionManager: autosave falló:', err);
      }
    }, this.AUTOSAVE_DEBOUNCE_MS);
  },

  /**
   * Marca el inicio/fin de una restauración (pausa el autosave).
   */
  setRestoring: function (flag) {
    this._restoring = !!flag;
  }
};

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionManager;
}
