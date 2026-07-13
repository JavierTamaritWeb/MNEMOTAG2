'use strict';

// ===== SESSION MANAGER =====
// Persistencia de sesión v2: archivo original más raster canónico, baseline
// de transformaciones, configuración y recurso de marca de agua.
//
// Diseño:
//   - Un único registro (KEY 'current') en un object store simple. Guardar
//     sobrescribe; no hay histórico (el histórico de edición ya lo cubre
//     HistoryManager en memoria).
//   - La serialización binaria usa ArrayBuffer para funcionar también en
//     WebKit y para no inflar memoria con base64.
//   - Ultra-defensivo: cualquier error (IndexedDB no disponible, cuota,
//     modo privado…) degrada en silencio. La app funciona igual sin sesión.

const SessionManager = {
  DB_NAME: 'mnemotag-session',
  DB_VERSION: 2,
  STORE_NAME: 'session',
  KEY: 'current',
  // Sesiones más antiguas se descartan al cargar (evita restaurar trabajo
  // irrelevante de hace semanas).
  MAX_AGE_MS: 72 * 60 * 60 * 1000, // 72 horas
  AUTOSAVE_DEBOUNCE_MS: 2500,

  _autoSaveTimer: null,
  _pendingSave: null,
  _lastError: null,
  _collector: null,
  _restoring: false,
  _generation: 0,
  _saveQueue: Promise.resolve(),
  _collectionQueue: Promise.resolve(),
  _collectionSequence: 0,

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
        let result;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('Operación IndexedDB fallida'));
        // WebKit puede disparar request.onsuccess antes de haber confirmado
        // la transacción. Cerrar o recargar en esa ventana perdía la sesión.
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Transacción IndexedDB fallida'));
        tx.onabort = () => reject(tx.error || new Error('Transacción IndexedDB abortada'));
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
  save: function (data, requestedGeneration = this._generation) {
    if (!this.isSupported() || !data) return Promise.resolve(false);
    const job = this._saveQueue.catch(function () {}).then(async () => {
      if (requestedGeneration !== this._generation) return false;
      try {
        this._lastError = null;
        await this._withStore('readwrite', (store) => store.put(data, this.KEY));
        return true;
      } catch (err) {
        this._lastError = (err && (err.name || err.message)) || String(err);
        MNEMOTAG_DEBUG && console.warn('SessionManager.save: no se pudo guardar la sesión:', err);
        return false;
      }
    });
    this._saveQueue = job.then(function () {}, function () {});
    return job;
  },

  /**
   * Carga la sesión guardada. Devuelve null si no hay, si está caducada
   * (se borra) o si algo falla. Nunca lanza.
   * @returns {Promise<Object|null>}
   */
  load: async function () {
    if (!this.isSupported()) return null;
    try {
      await this.waitForIdle();
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
  clear: function () {
    if (!this.isSupported()) return Promise.resolve(false);
    this.invalidatePendingSave();
    const generation = this._generation;
    const job = this._saveQueue.catch(function () {}).then(async () => {
      if (generation !== this._generation) return false;
      try {
        await this._withStore('readwrite', (store) => store.delete(this.KEY));
        return true;
      } catch (err) {
        MNEMOTAG_DEBUG && console.warn('SessionManager.clear: no se pudo borrar la sesión:', err);
        return false;
      }
    });
    this._saveQueue = job.then(function () {}, function () {});
    return job;
  },

  /**
   * Registra la función que recolecta el estado a guardar (vive en main.js,
   * que es quien ve las variables de estado). Debe devolver el objeto a
   * persistir o null si no hay nada que guardar.
   */
  configureAutoSave: function (collectFn) {
    this._collector = (typeof collectFn === 'function') ? collectFn : null;
  },

  _enqueueCollection: function (generation) {
    const requestSequence = ++this._collectionSequence;
    const job = this._collectionQueue.catch(function () {}).then(async () => {
      // Coalescer solicitudes que aún no han empezado. La que ya estaba
      // serializando termina y se descarta, pero nunca convive otro PNG en
      // memoria al mismo tiempo.
      if (requestSequence !== this._collectionSequence ||
          generation !== this._generation || this._restoring || !this._collector) return false;
      const data = await this._collector();
      if (!data || requestSequence !== this._collectionSequence ||
          generation !== this._generation || this._restoring) return false;
      return this.save(data, generation);
    }).catch((err) => {
      this._lastError = (err && (err.name || err.message)) || String(err);
      MNEMOTAG_DEBUG && console.warn('SessionManager: autosave falló:', err);
      return false;
    });
    const tracked = job.finally(() => {
      if (this._pendingSave === tracked) this._pendingSave = null;
    });
    this._collectionQueue = tracked.then(function () {}, function () {});
    this._pendingSave = tracked;
    return tracked;
  },

  /**
   * Autosave debounced — seguro de llamar en cada re-render del preview.
   * No hace nada durante una restauración en curso (evita re-guardar el
   * estado a medio aplicar).
   */
  scheduleAutoSave: function () {
    if (!this._collector || this._restoring || !this.isSupported()) return;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    const generation = this._generation;
    this._autoSaveTimer = setTimeout(() => {
      this._autoSaveTimer = null;
      this._enqueueCollection(generation);
    }, this.AUTOSAVE_DEBOUNCE_MS);
  },

  /**
   * Ejecuta inmediatamente el autosave pendiente y espera al commit real de
   * IndexedDB. Útil antes de una recarga controlada o al cerrar una tarea.
   * @returns {Promise<boolean>}
   */
  flushAutoSave: async function () {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
      if (!this._collector || this._restoring) return false;
      return this._enqueueCollection(this._generation);
    }
    await this.waitForIdle();
    return true;
  },

  /**
   * Marca el inicio/fin de una restauración (pausa el autosave).
   */
  setRestoring: function (flag) {
    const restoring = !!flag;
    if (restoring && !this._restoring) {
      this._generation++;
      this._collectionSequence++;
      if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    this._restoring = restoring;
  },

  /** Cancela un autosave recolectado para un documento ya obsoleto. */
  invalidatePendingSave: function () {
    this._generation++;
    this._collectionSequence++;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = null;
  },

  waitForIdle: async function () {
    // La cola incluye la recolección/serialización previa al put(). Esperar
    // una sola referencia `_pendingSave` no cubría recolectores antiguos.
    await this._collectionQueue.catch(function () {});
    await this._saveQueue.catch(function () {});
  },

  getLastError: function () {
    return this._lastError;
  }
};

// v3.7.1: SessionManager consume el AppState observable — cualquier mutación
// de estado compartido que pase por AppState (posiciones de watermark,
// formato/calidad, rotación...) reprograma el autosave debounced. Es un
// complemento de los listeners DOM del panel: cubre las mutaciones
// programáticas que no disparan eventos input/change.
if (typeof AppState !== 'undefined' && AppState && typeof AppState.subscribe === 'function') {
  AppState.subscribe('*', function () { SessionManager.scheduleAutoSave(); });
}

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionManager;
}
