'use strict';

// ===== APP STATE SINGLETON (v3.4.11) =====
//
// Capa de indirección NO INVASIVA sobre las variables globales let de
// main.js. El objetivo es tener una API clara para que los managers
// (nuevos y existentes) consulten y modifiquen el estado global sin
// acceder directamente a variables sueltas por nombre.
//
// Diseño:
//   - Getters/setters que delegan a las variables let del closure de
//     main.js (`canvas`, `ctx`, `currentImage`, etc.).
//   - `typeof X !== 'undefined'` en cada acceso para no crashear cuando
//     el módulo se carga sin main.js (test runner Node, primeras líneas
//     del HTML antes de cargar main.js).
//   - NO es una reescritura: las variables siguen existiendo como let
//     en main.js. AppState solo es una fachada. Los managers pueden
//     migrar oportunísticamente a usar AppState.X en lugar del nombre
//     directo, pero no es obligatorio.
//
// Uso:
//   if (AppState.canvas && AppState.currentImage) { ... }
//   AppState.fileBaseName = 'nuevo-nombre';
//   const currentZoom = AppState.currentZoom;

window.AppState = Object.freeze({
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
  get fileBaseName() {
    return typeof fileBaseName !== 'undefined' ? fileBaseName : '';
  },
  set fileBaseName(v) {
    if (typeof fileBaseName !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      fileBaseName = v;
    }
  },
  get originalExtension() {
    return typeof originalExtension !== 'undefined' ? originalExtension : 'jpg';
  },

  // --- Transformaciones ---
  get currentRotation() {
    return typeof currentRotation !== 'undefined' ? currentRotation : 0;
  },
  set currentRotation(v) {
    if (typeof currentRotation !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      currentRotation = v;
    }
  },
  get isFlippedHorizontally() {
    return typeof isFlippedHorizontally !== 'undefined' ? isFlippedHorizontally : false;
  },
  get isFlippedVertically() {
    return typeof isFlippedVertically !== 'undefined' ? isFlippedVertically : false;
  },

  // --- Zoom y pan ---
  get currentZoom() {
    return typeof currentZoom !== 'undefined' ? currentZoom : 1.0;
  },
  get panX() {
    return typeof panX !== 'undefined' ? panX : 0;
  },
  get panY() {
    return typeof panY !== 'undefined' ? panY : 0;
  },
  get isPanning() {
    return typeof isPanning !== 'undefined' ? isPanning : false;
  },

  // --- Posicionamiento de marcas de agua ---
  get customImagePosition() {
    return typeof customImagePosition !== 'undefined' ? customImagePosition : null;
  },
  set customImagePosition(v) {
    if (typeof customImagePosition !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      customImagePosition = v;
    }
  },
  get customTextPosition() {
    return typeof customTextPosition !== 'undefined' ? customTextPosition : null;
  },
  set customTextPosition(v) {
    if (typeof customTextPosition !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      customTextPosition = v;
    }
  },
  get isPositioningMode() {
    return typeof isPositioningMode !== 'undefined' ? isPositioningMode : false;
  },
  get showPositioningBorders() {
    return typeof showPositioningBorders !== 'undefined' ? showPositioningBorders : true;
  },
  set showPositioningBorders(v) {
    if (typeof showPositioningBorders !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      showPositioningBorders = v;
    }
  },

  // --- Configuración de salida ---
  get outputFormat() {
    return typeof outputFormat !== 'undefined' ? outputFormat : 'jpeg';
  },
  set outputFormat(v) {
    if (typeof outputFormat !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      outputFormat = v;
    }
  },
  get outputQuality() {
    return typeof outputQuality !== 'undefined' ? outputQuality : 0.8;
  },
  set outputQuality(v) {
    if (typeof outputQuality !== 'undefined') {
      // eslint-disable-next-line no-global-assign
      outputQuality = v;
    }
  },

  // --- Reglas / coordenadas ---
  get isRulerMode() {
    return typeof isRulerMode !== 'undefined' ? isRulerMode : false;
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
      isRulerMode: this.isRulerMode
    };
  }
});

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.AppState;
}
