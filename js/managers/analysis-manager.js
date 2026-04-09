'use strict';

// ===== ANALYSIS MANAGER (v3.4.7) =====
// Histograma RGB + luminosidad, paleta de colores dominantes y
// auto-balance automático por percentiles 1% y 99% de luminosidad.
// Todas las operaciones trabajan sobre ctx.getImageData() del canvas
// actual. Las variables `canvas` y `ctx` provienen del global lexical
// environment compartido con main.js (mismo patrón que historyManager).
//
// API pública:
//   - AnalysisManager.showHistogram()
//   - AnalysisManager.showPalette()
//   - AnalysisManager.autoBalanceImage()
//   - AnalysisManager._extractDominantColors(imageData, count) — expuesto para tests

window.AnalysisManager = (function () {

  function _getCanvasImageData() {
    if (typeof canvas === 'undefined' || typeof currentImage === 'undefined') return null;
    if (!canvas || !currentImage) return null;
    try {
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
      console.error('AnalysisManager: no se pudo leer imageData del canvas:', err);
      return null;
    }
  }

  function showHistogram() {
    const imageData = _getCanvasImageData();
    if (!imageData) {
      UIManager.showError('Carga una imagen primero para ver su histograma.');
      return;
    }

    const data = imageData.data;
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    const lum = new Uint32Array(256);

    for (let i = 0; i < data.length; i += 4) {
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      const A = data[i + 3];
      if (A === 0) continue; // Ignorar píxeles totalmente transparentes
      r[R]++;
      g[G]++;
      b[B]++;
      const L = (0.299 * R + 0.587 * G + 0.114 * B) | 0;
      lum[L < 0 ? 0 : L > 255 ? 255 : L]++;
    }

    const histCanvas = document.getElementById('histogram-canvas');
    if (!histCanvas) return;
    const hctx = histCanvas.getContext('2d');
    const W = histCanvas.width;
    const H = histCanvas.height;

    // Fondo
    hctx.clearRect(0, 0, W, H);
    hctx.fillStyle = '#f9fafb';
    hctx.fillRect(0, 0, W, H);

    // Cuadrícula sutil
    hctx.strokeStyle = 'rgba(107,114,128,0.18)';
    hctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (H * i) / 4;
      hctx.beginPath();
      hctx.moveTo(0, y);
      hctx.lineTo(W, y);
      hctx.stroke();
    }

    // Normalización: máximo común a los 4 canales.
    let max = 0;
    for (let i = 0; i < 256; i++) {
      if (r[i] > max) max = r[i];
      if (g[i] > max) max = g[i];
      if (b[i] > max) max = b[i];
      if (lum[i] > max) max = lum[i];
    }
    if (max === 0) max = 1;

    const drawChannel = function (arr, color) {
      hctx.fillStyle = color;
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * W;
        const barH = (arr[i] / max) * (H - 4);
        hctx.fillRect(x, H - barH, W / 256 + 0.5, barH);
      }
    };

    drawChannel(r, 'rgba(239, 68, 68, 0.55)');
    drawChannel(g, 'rgba(16, 185, 129, 0.55)');
    drawChannel(b, 'rgba(59, 130, 246, 0.55)');
    drawChannel(lum, 'rgba(107, 114, 128, 0.55)');

    // v3.4.3: apertura accesible con focus trap + Escape.
    // _openAccessibleModal está en main.js — accesible por nombre global.
    if (typeof _openAccessibleModal === 'function') {
      _openAccessibleModal(document.getElementById('histogram-modal'));
    } else {
      const modal = document.getElementById('histogram-modal');
      if (modal) modal.classList.remove('hidden');
    }
  }

  function _extractDominantColors(imageData, count) {
    // Cuantización en buckets de 8×8×8 = 512 colores (3 bits por canal).
    const data = imageData.data;
    const buckets = new Map();
    const stride = 16; // Sample 1 de cada 4 píxeles
    for (let i = 0; i < data.length; i += stride) {
      if (data[i + 3] === 0) continue;
      const r = data[i] >> 5;
      const g = data[i + 1] >> 5;
      const b = data[i + 2] >> 5;
      const key = (r << 6) | (g << 3) | b;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    const sorted = Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count);

    return sorted.map(function (entry) {
      const key = entry[0];
      const freq = entry[1];
      const r = ((key >> 6) & 0x07) << 5;
      const g = ((key >> 3) & 0x07) << 5;
      const b = (key & 0x07) << 5;
      const R = Math.min(255, r + 16);
      const G = Math.min(255, g + 16);
      const B = Math.min(255, b + 16);
      const hex = '#' + [R, G, B].map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
      return { r: R, g: G, b: B, hex: hex, freq: freq };
    });
  }

  function showPalette() {
    const imageData = _getCanvasImageData();
    if (!imageData) {
      UIManager.showError('Carga una imagen primero para extraer su paleta.');
      return;
    }

    const colors = _extractDominantColors(imageData, 12);
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    // Construcción segura con DOM API (sin innerHTML interpolado).
    grid.replaceChildren();
    colors.forEach(function (c) {
      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.title = 'Click para copiar ' + c.hex.toUpperCase();

      const colorEl = document.createElement('div');
      colorEl.className = 'palette-swatch__color';
      colorEl.style.backgroundColor = c.hex;

      const info = document.createElement('div');
      info.className = 'palette-swatch__info';
      info.textContent = c.hex.toUpperCase();

      swatch.appendChild(colorEl);
      swatch.appendChild(info);
      swatch.addEventListener('click', async function () {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(c.hex.toUpperCase());
            UIManager.showSuccess('🎨 Copiado: ' + c.hex.toUpperCase());
          }
        } catch (err) {
          UIManager.showError('No se pudo copiar al portapapeles');
        }
      });
      grid.appendChild(swatch);
    });

    if (typeof _openAccessibleModal === 'function') {
      _openAccessibleModal(document.getElementById('palette-modal'));
    } else {
      const modal = document.getElementById('palette-modal');
      if (modal) modal.classList.remove('hidden');
    }
  }

  function autoBalanceImage() {
    const imageData = _getCanvasImageData();
    if (!imageData) {
      UIManager.showError('Carga una imagen primero para auto-mejorarla.');
      return;
    }

    const data = imageData.data;
    const lumHist = new Uint32Array(256);
    let totalPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const L = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
      lumHist[L < 0 ? 0 : L > 255 ? 255 : L]++;
      totalPixels++;
    }

    if (totalPixels === 0) {
      UIManager.showError('La imagen no tiene píxeles visibles para analizar.');
      return;
    }

    // Percentiles 1% y 99% de luminosidad.
    const lowCut = totalPixels * 0.01;
    const highCut = totalPixels * 0.99;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let i = 0; i < 256; i++) {
      acc += lumHist[i];
      if (acc >= lowCut) { lo = i; break; }
    }
    acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += lumHist[i];
      if (acc >= highCut) { hi = i; break; }
    }

    if (hi <= lo) {
      UIManager.showInfo('La imagen no tiene rango dinámico suficiente para auto-mejorar.');
      return;
    }

    // LUT linear mapping [lo, hi] -> [0, 255].
    const lut = new Uint8ClampedArray(256);
    const range = hi - lo;
    for (let i = 0; i < 256; i++) {
      if (i <= lo) lut[i] = 0;
      else if (i >= hi) lut[i] = 255;
      else lut[i] = ((i - lo) * 255 / range) | 0;
    }

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      data[i]     = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }

    ctx.putImageData(imageData, 0, 0);

    if (typeof historyManager !== 'undefined' && historyManager.saveState) {
      historyManager.saveState();
    }

    UIManager.showSuccess('✨ Imagen auto-mejorada (rango lo=' + lo + ', hi=' + hi + ')');
  }

  return {
    showHistogram: showHistogram,
    showPalette: showPalette,
    autoBalanceImage: autoBalanceImage,
    _extractDominantColors: _extractDominantColors,
    _getCanvasImageData: _getCanvasImageData
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.AnalysisManager;
}
