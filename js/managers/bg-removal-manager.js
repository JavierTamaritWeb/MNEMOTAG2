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
    if (typeof canvas === 'undefined' || !canvas || !currentImage) {
      UIManager.showError('Carga una imagen primero para eliminar el fondo.');
      return;
    }

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
    const removeFn = (mod && (mod.removeBackground || mod.default)) || null;
    if (typeof removeFn !== 'function') {
      UIManager.showError('La librería de IA cargada no expone la función esperada. Versión incompatible.');
      return;
    }

    try {
      UIManager.showInfo('🤖 Procesando imagen con IA. Esto puede tardar unos segundos…');

      // Convertimos el canvas actual (con todos los filtros y marcas
      // aplicados) a un blob PNG para preservar la transparencia.
      const inputBlob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { return b ? resolve(b) : reject(new Error('toBlob falló')); }, 'image/png');
      });

      // Llamada a la librería. Devuelve un Blob con fondo transparente.
      const resultBlob = await removeFn(inputBlob);

      // Cargar el resultado de vuelta al canvas.
      const url = URL.createObjectURL(resultBlob);
      const img = new Image();
      img.onload = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        if (typeof historyManager !== 'undefined' && historyManager.saveState) {
          historyManager.saveState();
        }
        UIManager.showSuccess('🪄 Fondo eliminado correctamente');
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        UIManager.showError('No se pudo cargar el resultado del modelo de IA.');
      };
      img.src = url;
    } catch (err) {
      console.error('BgRemovalManager: error procesando con IA:', err);
      UIManager.showError('Error al procesar la imagen: ' + (err.message || err));
    }
  }

  return {
    removeBackground: removeBackground
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.BgRemovalManager;
}
