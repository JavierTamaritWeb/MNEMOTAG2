'use strict';

// ===== CAPABILITIES (v3.7.0) =====
// Detección explícita de capacidades del navegador ANTES de mostrar acciones
// que dependen de ellas. Centraliza lo que antes se comprobaba ad-hoc en cada
// flujo (o directamente no se comprobaba hasta que la acción fallaba):
//
//   - Codificación WebP/AVIF con canvas (reusa supportsEncode de helpers.js,
//     que ya cachea el resultado en formatSupportCache).
//   - Clipboard: escritura (ClipboardItem + clipboard.write) y lectura
//     (clipboard.read) — gatean copiar/pegar imagen.
//   - Web Share API con archivos (navigator.canShare({ files })) — gatea el
//     botón Compartir del flujo móvil.
//   - File System Access API (showSaveFilePicker).
//
// El resultado se cachea en Capabilities.snapshot tras detect(). applyToUI()
// marca en el DOM lo no soportado: anota las opciones WebP/AVIF del select de
// formato con su fallback real y muestra/oculta los botones de compartir.
// Todo es defensivo: sin DOM (runner Node) cada método degrada sin lanzar.

const Capabilities = {
  // Resultado de la última detección; null hasta que detect() termina.
  snapshot: null,

  /**
   * Detección síncrona de las APIs que no requieren probe asíncrono.
   * Cada propiedad es un boolean.
   */
  detectSync: function () {
    const nav = (typeof navigator !== 'undefined') ? navigator : {};
    const win = (typeof window !== 'undefined') ? window : {};

    let shareFiles = false;
    try {
      if (typeof nav.share === 'function' && typeof nav.canShare === 'function' &&
          typeof File !== 'undefined') {
        // Probe con un File mínimo: canShare({files}) es la única forma
        // fiable de saber si el share sheet acepta archivos de imagen.
        const probe = new File(['x'], 'probe.png', { type: 'image/png' });
        shareFiles = nav.canShare({ files: [probe] }) === true;
      }
    } catch (err) {
      shareFiles = false;
    }

    return {
      clipboardWrite: !!(nav.clipboard && typeof nav.clipboard.write === 'function' &&
                         typeof ClipboardItem !== 'undefined'),
      clipboardRead: !!(nav.clipboard && typeof nav.clipboard.read === 'function'),
      shareFiles: shareFiles,
      fileSystemAccess: (typeof win === 'object') && ('showSaveFilePicker' in win)
    };
  },

  /**
   * Detección completa (incluye probes async de codificación de formatos).
   * Cachea el resultado en this.snapshot; llamadas posteriores lo reusan.
   * @returns {Promise<Object>} snapshot de capacidades
   */
  detect: async function () {
    if (this.snapshot) return this.snapshot;

    const base = this.detectSync();
    let webpEncode = false;
    let avifEncode = false;

    // supportsEncode vive en helpers.js y cachea por MIME. Guard typeof
    // para entornos aislados (runner Node sin helpers cargados).
    if (typeof supportsEncode === 'function' && typeof document !== 'undefined') {
      try { webpEncode = await supportsEncode('image/webp'); } catch (err) { webpEncode = false; }
      try { avifEncode = await supportsEncode('image/avif'); } catch (err) { avifEncode = false; }
    }

    this.snapshot = {
      ...base,
      webpEncode: webpEncode,
      avifEncode: avifEncode
    };
    return this.snapshot;
  },

  /**
   * Fallback de exportación previsto para un formato solicitado, según las
   * capacidades detectadas. Refleja la cadena real de determineFallbackFormat
   * (AVIF → WebP → PNG/JPEG; WebP → PNG/JPEG) sin ejecutar probes de nuevo.
   * @param {string} format - 'jpeg' | 'png' | 'webp' | 'avif'
   * @param {Object} caps - snapshot de detect()
   * @returns {string|null} formato de fallback previsto, o null si no hay fallback
   */
  expectedFallback: function (format, caps) {
    if (!caps) return null;
    if (format === 'avif' && !caps.avifEncode) {
      return caps.webpEncode ? 'webp' : 'jpeg/png';
    }
    if (format === 'webp' && !caps.webpEncode) {
      return 'jpeg/png';
    }
    return null;
  },

  /**
   * Refleja las capacidades en la UI. Idempotente; no-op sin DOM.
   * - Anota las <option> WebP/AVIF no codificables del select #output-format.
   * - Muestra los botones [data-requires-capability="shareFiles"] solo si hay
   *   Web Share con archivos (patrón general: cualquier elemento con ese
   *   data-attribute se gatea por la capacidad que declare).
   */
  applyToUI: async function () {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
      return;
    }
    const caps = await this.detect();

    try {
      const formatSelect = document.getElementById('output-format');
      if (formatSelect && formatSelect.options) {
        for (const option of Array.from(formatSelect.options)) {
          const fallback = this.expectedFallback(option.value, caps);
          if (fallback && option.textContent.indexOf('→') === -1) {
            option.textContent = option.textContent + ' — no soportado aquí, exportará → ' + fallback.toUpperCase();
          }
        }
      }

      // Elementos gateados por capacidad: visibles solo si la capacidad existe.
      const gated = document.querySelectorAll('[data-requires-capability]');
      gated.forEach((el) => {
        const cap = el.getAttribute('data-requires-capability');
        const supported = !!caps[cap];
        el.hidden = !supported;
        // hidden no basta si el CSS del elemento fija display:flex (gana al
        // UA stylesheet): forzar también display inline.
        el.style.display = supported ? '' : 'none';
        el.setAttribute('aria-hidden', supported ? 'false' : 'true');
      });
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('Capabilities.applyToUI: error aplicando al DOM:', err);
    }
  }
};

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Capabilities;
}
