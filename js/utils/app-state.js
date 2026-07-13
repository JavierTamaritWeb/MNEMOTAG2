'use strict';

// ===== APP STATE SINGLETON (v3.4.11, observable desde v3.7.1) =====
//
// Capa de indirección NO INVASIVA sobre las variables globales let de
// main.js. El objetivo es tener una API clara para que los managers
// (nuevos y existentes) consulten y modifiquen el estado global sin
// acceder directamente a variables sueltas por nombre.
//
// Diseño:
//   - Getters/setters que delegan a las variables let del ámbito de script
//     de main.js (`canvas`, `ctx`, `currentImage`, etc.).
//   - `typeof X !== 'undefined'` en cada acceso para no crashear cuando
//     el módulo se carga sin main.js (test runner Node, primeras líneas
//     del HTML antes de cargar main.js).
//   - NO es una reescritura: las variables siguen existiendo como let
//     en main.js. AppState solo es una fachada.
//
// Observabilidad (v3.7.1):
//   - `AppState.subscribe(key, fn)` registra un listener para una clave
//     ('*' escucha todas). Devuelve una función de desuscripción.
//   - Cada SETTER de AppState notifica a los listeners con
//     `fn(value, prevValue, key)`. Solo notifica si el valor cambió
//     (comparación estricta; los objetos nuevos siempre notifican).
//   - IMPORTANTE: solo las mutaciones que pasan por AppState notifican.
//     Las asignaciones directas a la variable let en main.js NO se
//     detectan — por eso los puntos de mutación compartidos de main.js
//     migran a `AppState.clave = valor`.
//   - Los listeners se ejecutan bajo try/catch: un listener roto nunca
//     tumba la mutación de estado.
//
// Uso:
//   if (AppState.canvas && AppState.currentImage) { ... }
//   AppState.outputQuality = 0.9;                     // notifica
//   const off = AppState.subscribe('outputQuality', (v, prev) => { ... });
//   off();                                            // desuscribe

(function () {
  /** Map<clave, Set<fn>> — listeners por clave ('*' = comodín). */
  const listeners = new Map();

  function notify(key, value, prev) {
    if (value === prev) return;
    const run = (fn) => {
      try {
        fn(value, prev, key);
      } catch (e) {
        if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
          console.warn('[AppState] listener de "' + key + '" lanzó:', e);
        }
      }
    };
    const exact = listeners.get(key);
    if (exact) exact.forEach(run);
    const wildcard = listeners.get('*');
    if (wildcard) wildcard.forEach(run);
  }

  window.AppState = Object.freeze({
    /**
     * Suscribirse a cambios de una clave de estado ('*' para todas).
     * @param {string} key - Nombre de la clave (p.ej. 'outputQuality').
     * @param {Function} fn - Callback (value, prevValue, key).
     * @returns {Function} Función de desuscripción.
     */
    subscribe(key, fn) {
      if (typeof key !== 'string' || typeof fn !== 'function') {
        return function () {};
      }
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return function unsubscribe() {
        const set = listeners.get(key);
        if (set) {
          set.delete(fn);
          if (set.size === 0) listeners.delete(key);
        }
      };
    },

    /**
     * Número de listeners activos (para tests/debug).
     * @param {string} [key] - Clave concreta; sin argumento cuenta todas.
     */
    listenerCount(key) {
      if (typeof key === 'string') {
        const set = listeners.get(key);
        return set ? set.size : 0;
      }
      let total = 0;
      listeners.forEach((set) => { total += set.size; });
      return total;
    },

    // --- Imagen y archivo actuales ---
    get canvas() {
      return typeof canvas !== 'undefined' ? canvas : null;
    },
    get ctx() {
      return typeof ctx !== 'undefined' ? ctx : null;
    },
    get currentImage() {
      return typeof currentImage !== 'undefined' ? currentImage : null;
    },
    get currentFile() {
      return typeof currentFile !== 'undefined' ? currentFile : null;
    },
    get lastDownloadDirectory() {
      return typeof lastDownloadDirectory !== 'undefined' ? lastDownloadDirectory : null;
    },
    set lastDownloadDirectory(v) {
      if (typeof lastDownloadDirectory !== 'undefined') {
        const prev = lastDownloadDirectory;
        lastDownloadDirectory = v;
        notify('lastDownloadDirectory', v, prev);
      }
    },
    get fileBaseName() {
      return typeof fileBaseName !== 'undefined' ? fileBaseName : '';
    },
    set fileBaseName(v) {
      if (typeof fileBaseName !== 'undefined') {
        const prev = fileBaseName;
        // eslint-disable-next-line no-global-assign
        fileBaseName = v;
        notify('fileBaseName', v, prev);
      }
    },
    get originalExtension() {
      return typeof originalExtension !== 'undefined' ? originalExtension : 'jpg';
    },
    get originalWidth() {
      return typeof originalWidth !== 'undefined' ? originalWidth : 0;
    },
    get originalHeight() {
      return typeof originalHeight !== 'undefined' ? originalHeight : 0;
    },

    // --- Transformaciones ---
    get currentRotation() {
      return typeof currentRotation !== 'undefined' ? currentRotation : 0;
    },
    set currentRotation(v) {
      if (typeof currentRotation !== 'undefined') {
        const prev = currentRotation;
        // eslint-disable-next-line no-global-assign
        currentRotation = v;
        notify('currentRotation', v, prev);
      }
    },
    get isFlippedHorizontally() {
      return typeof isFlippedHorizontally !== 'undefined' ? isFlippedHorizontally : false;
    },
    set isFlippedHorizontally(v) {
      if (typeof isFlippedHorizontally !== 'undefined') {
        const prev = isFlippedHorizontally;
        isFlippedHorizontally = Boolean(v);
        notify('isFlippedHorizontally', isFlippedHorizontally, prev);
      }
    },
    get isFlippedVertically() {
      return typeof isFlippedVertically !== 'undefined' ? isFlippedVertically : false;
    },
    set isFlippedVertically(v) {
      if (typeof isFlippedVertically !== 'undefined') {
        const prev = isFlippedVertically;
        isFlippedVertically = Boolean(v);
        notify('isFlippedVertically', isFlippedVertically, prev);
      }
    },

    // --- Zoom y pan ---
    get currentZoom() {
      return typeof currentZoom !== 'undefined' ? currentZoom : 1.0;
    },
    set currentZoom(v) {
      if (typeof currentZoom !== 'undefined') {
        const prev = currentZoom;
        currentZoom = Number.isFinite(v) ? v : 1;
        notify('currentZoom', currentZoom, prev);
      }
    },
    get panX() {
      return typeof panX !== 'undefined' ? panX : 0;
    },
    set panX(v) {
      if (typeof panX !== 'undefined') {
        const prev = panX;
        panX = Number.isFinite(v) ? v : 0;
        notify('panX', panX, prev);
      }
    },
    get panY() {
      return typeof panY !== 'undefined' ? panY : 0;
    },
    set panY(v) {
      if (typeof panY !== 'undefined') {
        const prev = panY;
        panY = Number.isFinite(v) ? v : 0;
        notify('panY', panY, prev);
      }
    },
    get isPanning() {
      return typeof isPanning !== 'undefined' ? isPanning : false;
    },
    set isPanning(v) {
      if (typeof isPanning !== 'undefined') {
        const prev = isPanning;
        isPanning = Boolean(v);
        notify('isPanning', isPanning, prev);
      }
    },
    get isZoomed() {
      return typeof isZoomed !== 'undefined' ? isZoomed : this.currentZoom !== 1;
    },
    set isZoomed(v) {
      if (typeof isZoomed !== 'undefined') {
        const prev = isZoomed;
        isZoomed = Boolean(v);
        notify('isZoomed', isZoomed, prev);
      }
    },

    // --- Posicionamiento de marcas de agua ---
    get customImagePosition() {
      return typeof customImagePosition !== 'undefined' ? customImagePosition : null;
    },
    set customImagePosition(v) {
      if (typeof customImagePosition !== 'undefined') {
        const prev = customImagePosition;
        // eslint-disable-next-line no-global-assign
        customImagePosition = v;
        notify('customImagePosition', v, prev);
      }
    },
    get customTextPosition() {
      return typeof customTextPosition !== 'undefined' ? customTextPosition : null;
    },
    set customTextPosition(v) {
      if (typeof customTextPosition !== 'undefined') {
        const prev = customTextPosition;
        // eslint-disable-next-line no-global-assign
        customTextPosition = v;
        notify('customTextPosition', v, prev);
      }
    },
    get isPositioningMode() {
      return typeof isPositioningMode !== 'undefined' ? isPositioningMode : false;
    },
    set isPositioningMode(v) {
      if (typeof isPositioningMode !== 'undefined') {
        const prev = isPositioningMode;
        // eslint-disable-next-line no-global-assign
        isPositioningMode = v;
        notify('isPositioningMode', v, prev);
      }
    },
    get isTextPositioningMode() {
      return typeof isTextPositioningMode !== 'undefined' ? isTextPositioningMode : false;
    },
    set isTextPositioningMode(v) {
      if (typeof isTextPositioningMode !== 'undefined') {
        const prev = isTextPositioningMode;
        // eslint-disable-next-line no-global-assign
        isTextPositioningMode = v;
        notify('isTextPositioningMode', v, prev);
      }
    },
    get lastPositioningModeActivated() {
      return typeof lastPositioningModeActivated !== 'undefined' ? lastPositioningModeActivated : null;
    },
    set lastPositioningModeActivated(v) {
      if (typeof lastPositioningModeActivated !== 'undefined') {
        const prev = lastPositioningModeActivated;
        // eslint-disable-next-line no-global-assign
        lastPositioningModeActivated = v;
        notify('lastPositioningModeActivated', v, prev);
      }
    },
    get showPositioningBorders() {
      return typeof showPositioningBorders !== 'undefined' ? showPositioningBorders : true;
    },
    set showPositioningBorders(v) {
      if (typeof showPositioningBorders !== 'undefined') {
        const prev = showPositioningBorders;
        // eslint-disable-next-line no-global-assign
        showPositioningBorders = v;
        notify('showPositioningBorders', v, prev);
      }
    },

    // --- Drag & drop de marcas de agua ---
    get isDragging() {
      return typeof isDragging !== 'undefined' ? isDragging : false;
    },
    set isDragging(v) {
      if (typeof isDragging !== 'undefined') {
        const prev = isDragging;
        // eslint-disable-next-line no-global-assign
        isDragging = v;
        notify('isDragging', v, prev);
      }
    },
    get dragTarget() {
      return typeof dragTarget !== 'undefined' ? dragTarget : null;
    },
    set dragTarget(v) {
      if (typeof dragTarget !== 'undefined') {
        const prev = dragTarget;
        // eslint-disable-next-line no-global-assign
        dragTarget = v;
        notify('dragTarget', v, prev);
      }
    },
    get textWatermarkBounds() {
      return typeof textWatermarkBounds !== 'undefined' ? textWatermarkBounds : null;
    },
    set textWatermarkBounds(v) {
      if (typeof textWatermarkBounds !== 'undefined') {
        const prev = textWatermarkBounds;
        // eslint-disable-next-line no-global-assign
        textWatermarkBounds = v;
        notify('textWatermarkBounds', v, prev);
      }
    },
    get imageWatermarkBounds() {
      return typeof imageWatermarkBounds !== 'undefined' ? imageWatermarkBounds : null;
    },
    set imageWatermarkBounds(v) {
      if (typeof imageWatermarkBounds !== 'undefined') {
        const prev = imageWatermarkBounds;
        // eslint-disable-next-line no-global-assign
        imageWatermarkBounds = v;
        notify('imageWatermarkBounds', v, prev);
      }
    },
    get hoveredWatermark() {
      return typeof hoveredWatermark !== 'undefined' ? hoveredWatermark : null;
    },
    set hoveredWatermark(v) {
      if (typeof hoveredWatermark !== 'undefined') {
        const prev = hoveredWatermark;
        // eslint-disable-next-line no-global-assign
        hoveredWatermark = v;
        notify('hoveredWatermark', v, prev);
      }
    },
    get watermarkImagePreview() {
      return typeof watermarkImagePreview !== 'undefined' ? watermarkImagePreview : null;
    },
    set watermarkImagePreview(v) {
      if (typeof watermarkImagePreview !== 'undefined') {
        const prev = watermarkImagePreview;
        // eslint-disable-next-line no-global-assign
        watermarkImagePreview = v;
        notify('watermarkImagePreview', v, prev);
      }
    },
    get textLayerBounds() {
      return typeof textLayerBounds !== 'undefined' ? textLayerBounds : [];
    },
    set textLayerBounds(v) {
      if (typeof textLayerBounds !== 'undefined') {
        const prev = textLayerBounds;
        // eslint-disable-next-line no-global-assign
        textLayerBounds = v;
        notify('textLayerBounds', v, prev);
      }
    },
    get activeLayerId() {
      return typeof activeLayerId !== 'undefined' ? activeLayerId : null;
    },
    set activeLayerId(v) {
      if (typeof activeLayerId !== 'undefined') {
        const prev = activeLayerId;
        activeLayerId = v;
        notify('activeLayerId', v, prev);
      }
    },

    // --- Configuración de salida ---
    get outputFormat() {
      return typeof outputFormat !== 'undefined' ? outputFormat : 'jpeg';
    },
    set outputFormat(v) {
      if (typeof outputFormat !== 'undefined') {
        const prev = outputFormat;
        // eslint-disable-next-line no-global-assign
        outputFormat = v;
        notify('outputFormat', v, prev);
      }
    },
    get outputQuality() {
      return typeof outputQuality !== 'undefined' ? outputQuality : 0.8;
    },
    set outputQuality(v) {
      if (typeof outputQuality !== 'undefined') {
        const prev = outputQuality;
        // eslint-disable-next-line no-global-assign
        outputQuality = v;
        notify('outputQuality', v, prev);
      }
    },

    // --- Reglas / coordenadas ---
    get isRulerMode() {
      return typeof isRulerMode !== 'undefined' ? isRulerMode : false;
    },
    set isRulerMode(v) {
      if (typeof isRulerMode !== 'undefined') {
        const prev = isRulerMode;
        isRulerMode = Boolean(v);
        notify('isRulerMode', isRulerMode, prev);
      }
    },

    // --- Utilidad ---
    /**
     * Snapshot del estado actual en un objeto plano.
     * Útil para debugging desde la consola del navegador: `AppState.snapshot()`
     */
    snapshot() {
      return {
        hasImage: !!this.currentImage,
        canvasSize: this.canvas ? { w: this.canvas.width, h: this.canvas.height } : null,
        fileBaseName: this.fileBaseName,
        originalExtension: this.originalExtension,
        currentRotation: this.currentRotation,
        flipH: this.isFlippedHorizontally,
        flipV: this.isFlippedVertically,
        zoom: this.currentZoom,
        pan: { x: this.panX, y: this.panY },
        outputFormat: this.outputFormat,
        outputQuality: this.outputQuality,
        customImagePosition: this.customImagePosition,
        customTextPosition: this.customTextPosition,
        isPositioningMode: this.isPositioningMode,
        isTextPositioningMode: this.isTextPositioningMode,
        isDragging: this.isDragging,
        activeLayerId: this.activeLayerId,
        isRulerMode: this.isRulerMode
      };
    }
  });
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.AppState;
}
