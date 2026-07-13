'use strict';

// ===== BG REMOVAL MANAGER (v3.4.9) =====
// Eliminar fondo con IA usando lazy load total del modelo
// @imgly/background-removal (~10-15 MB) la PRIMERA vez que el usuario
// pulsa el botón. Las llamadas posteriores reutilizan el módulo
// cacheado en la closure privada.
//
// Cero impacto en el peso inicial de la app: si el usuario nunca pulsa
// el botón, la librería NUNCA se descarga.
//
// Dependencias globales:
//   - canvas, ctx, currentImage (variables let de main.js)
//   - UIManager (toasts)
//   - historyManager (para saveState tras procesar)
//
// API pública:
//   - BgRemovalManager.removeBackground() — entry point del botón

window.BgRemovalManager = (function () {

  // Cache privado del módulo importado (singleton).
  let _module = null;
  let _loading = false;
  let _removeBackgroundOverride = null;
  // Guard de reentrada: evita que un doble click lance dos procesados
  // concurrentes sobre el mismo canvas.
  let _processing = false;

  function configure(options) {
    _removeBackgroundOverride = options && typeof options.removeBackground === 'function'
      ? options.removeBackground
      : null;
  }

  async function _loadLib() {
    if (_module) return _module;
    if (_loading) {
      // Ya hay otra llamada en curso — esperar a que termine.
      return new Promise(function (resolve, reject) {
        const check = function () {
          if (_module) return resolve(_module);
          if (!_loading) return reject(new Error('Carga abortada'));
          setTimeout(check, 100);
        };
        check();
      });
    }
    _loading = true;
    try {
      UIManager.showInfo('🤖 Descargando modelo de IA (~10-15 MB). Esto solo ocurre la primera vez…');
      // jsdelivr +esm sirve la versión ESM de la librería para que
      // dynamic import() funcione sin bundler.
      _module = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm');
      return _module;
    } finally {
      _loading = false;
    }
  }

  async function removeBackground() {
    // Guard de reentrada: si ya hay un procesado en curso, ignorar.
    if (_processing) {
      MNEMOTAG_DEBUG && console.warn('BgRemovalManager: procesado ya en curso, se ignora la llamada.');
      return;
    }

    if (typeof canvas === 'undefined' || !canvas || !currentImage) {
      UIManager.showError('Carga una imagen primero para eliminar el fondo.');
      return;
    }

    const requestedDocumentId = AppState.documentId;
    _processing = true;
    try {
      let removeFn = _removeBackgroundOverride;
      if (!removeFn) {
        let mod;
        try {
          mod = await _loadLib();
        } catch (err) {
          console.error('BgRemovalManager: error cargando el modelo de IA:', err);
          UIManager.showError('No se pudo cargar el modelo de IA: ' + (err.message || err) + '. Comprueba tu conexión y vuelve a intentarlo.');
          return;
        }
        // La librería expone su función principal como `removeBackground`
        // o como default export según la versión. Defensivo.
        removeFn = (mod && (mod.removeBackground || mod.default)) || null;
      }
      if (typeof removeFn !== 'function') {
        UIManager.showError('La librería de IA cargada no expone la función esperada. Versión incompatible.');
        return;
      }

      try {
        UIManager.showInfo('🤖 Procesando imagen con IA. Esto puede tardar unos segundos…');

        const committed = await DocumentStateManager.enqueueRasterMutation(
          'background-removal',
          async function (source) {
            // Convertir exclusivamente el raster canónico. Filtros, marcas y
            // capas son composición no destructiva y no deben hornearse.
            const sourceWidth = source.naturalWidth || source.width;
            const sourceHeight = source.naturalHeight || source.height;
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = sourceWidth;
            sourceCanvas.height = sourceHeight;
            sourceCanvas.getContext('2d').drawImage(source, 0, 0, sourceWidth, sourceHeight);
            const inputBlob = await new Promise(function (resolve, reject) {
              sourceCanvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error('toBlob falló'));
              }, 'image/png');
            });
            sourceCanvas.width = 0;
            sourceCanvas.height = 0;

            const resultBlob = await removeFn(inputBlob);
            const url = URL.createObjectURL(resultBlob);
            return new Promise(function (resolve, reject) {
              const img = new Image();
              img.onload = function () {
                const output = document.createElement('canvas');
                output.width = img.naturalWidth || img.width;
                output.height = img.naturalHeight || img.height;
                output.getContext('2d').drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve(output);
              };
              img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo cargar el resultado del modelo de IA.'));
              };
              img.src = url;
            });
          },
          {
            expectedDocumentId: requestedDocumentId,
            takeOwnership: true,
            updateOriginalDimensions: false,
            updateResetImage: true,
            rotation: 0,
            isFlippedHorizontally: false,
            isFlippedVertically: false,
            saveHistory: true
          }
        );
        if (!committed) return;
        UIManager.showSuccess('🪄 Fondo eliminado correctamente');
      } catch (err) {
        console.error('BgRemovalManager: error procesando con IA:', err);
        UIManager.showError('Error al procesar la imagen: ' + (err.message || err));
      }
    } finally {
      // Liberar SIEMPRE el guard, pase lo que pase.
      _processing = false;
    }
  }

  return {
    configure: configure,
    removeBackground: removeBackground
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.BgRemovalManager;
}
