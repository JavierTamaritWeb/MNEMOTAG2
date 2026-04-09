'use strict';

// ===== ANALYSIS WORKER (v3.4.12) =====
// Web Worker para operaciones pixel-level pesadas que antes bloqueaban
// el thread principal. Recibe ImageData vía transferable objects para
// evitar copia innecesaria, hace el cómputo, y devuelve el resultado
// también como transferable.
//
// Operaciones soportadas:
//   - buildHistogram: 4 Uint32Array(256) con R, G, B, luminosidad
//   - extractPalette: array de {r,g,b,hex,freq} con los top N colores
//   - autoBalance:    nueva imageData + {lo, hi} calculados
//
// Protocolo:
//   Main thread envía:
//     postMessage({ id, op: 'buildHistogram', imageData }, [imageData.data.buffer])
//   Worker responde:
//     postMessage({ id, ok: true, result }, [transferable...])
//   O ante error:
//     postMessage({ id, ok: false, error: 'mensaje' })

self.addEventListener('message', function (e) {
  const msg = e.data;
  if (!msg || typeof msg !== 'object') return;
  const id = msg.id;

  try {
    let result;
    switch (msg.op) {
      case 'buildHistogram':
        result = _buildHistogram(msg.imageData);
        self.postMessage({ id: id, ok: true, result: result });
        break;
      case 'extractPalette':
        result = _extractPalette(msg.imageData, msg.count || 12);
        self.postMessage({ id: id, ok: true, result: result });
        break;
      case 'autoBalance':
        result = _autoBalance(msg.imageData);
        // Transferir el buffer de vuelta para no copiar
        self.postMessage(
          { id: id, ok: true, result: result },
          result && result.imageData ? [result.imageData.data.buffer] : []
        );
        break;
      default:
        self.postMessage({ id: id, ok: false, error: 'Operación desconocida: ' + msg.op });
    }
  } catch (err) {
    self.postMessage({ id: id, ok: false, error: String(err && err.message || err) });
  }
});

function _buildHistogram(imageData) {
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
    if (A === 0) continue;
    r[R]++;
    g[G]++;
    b[B]++;
    const L = (0.299 * R + 0.587 * G + 0.114 * B) | 0;
    lum[L < 0 ? 0 : L > 255 ? 255 : L]++;
  }

  return { r: r, g: g, b: b, lum: lum };
}

function _extractPalette(imageData, count) {
  const data = imageData.data;
  const buckets = new Map();
  const stride = 16;
  for (let i = 0; i < data.length; i += stride) {
    if (data[i + 3] === 0) continue;
    const r = data[i] >> 5;
    const g = data[i + 1] >> 5;
    const b = data[i + 2] >> 5;
    const key = (r << 6) | (g << 3) | b;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const sorted = Array.from(buckets.entries())
    .sort(function (a, b) { return b[1] - a[1]; })
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

function _autoBalance(imageData) {
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
    return { empty: true };
  }

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
    return { noRange: true, lo: lo, hi: hi };
  }

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

  return { imageData: imageData, lo: lo, hi: hi };
}
