'use strict';

// ===== CURVES MANAGER (v3.4.8) =====
// Editor de curvas y niveles estilo Photoshop con canvas interactivo
// 280×280, 4 canales (RGB combinado + R/G/B individuales), composición
// LUT y live preview en tiempo real en el canvas principal (v3.4.4).
//
// Dependencias globales (por nombre, patrón del proyecto):
//   - canvas, ctx, currentImage (variables let de main.js)
//   - historyManager (para saveState tras aplicar)
//   - UIManager (toasts)
//   - _openAccessibleModal, _closeAccessibleModal (helpers de a11y de main.js)
//   - renderHistoryPanel (hook visual del panel de historial)
//
// API pública:
//   - CurvesManager.open() — abre el modal del editor

window.CurvesManager = (function () {

  // Estado privado del editor. Cada canal mantiene su propio array de
  // puntos de control en coordenadas {x, y} ∈ [0, 255]. Los extremos
  // (x=0 y x=255) son permanentes y no se pueden eliminar.
  const _state = {
    activeChannel: 'rgb',
    points: {
      rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      r:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      g:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      b:   [{ x: 0, y: 0 }, { x: 255, y: 255 }]
    },
    dragIndex: -1,
    // v3.4.4: snapshot "antes de abrir el modal" para live preview.
    previewSnapshot: null,
    previewRafPending: false
  };

  function open() {
    if (typeof canvas === 'undefined' || !canvas || !currentImage) {
      UIManager.showError('Carga una imagen primero para editar curvas.');
      return;
    }
    const modal = document.getElementById('curves-modal');
    if (!modal) return;

    // Resetear puntos al abrir.
    _state.points.rgb = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    _state.points.r   = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    _state.points.g   = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    _state.points.b   = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    _state.activeChannel = 'rgb';

    try {
      _state.previewSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('CurvesManager.open: no se pudo capturar snapshot para live preview:', err);
      _state.previewSnapshot = null;
    }

    if (typeof _openAccessibleModal === 'function') {
      _openAccessibleModal(modal, _rollbackPreview);
    } else {
      modal.classList.remove('hidden');
    }

    // Reset visual del tab activo.
    modal.querySelectorAll('.curves-channel-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-channel') === 'rgb');
    });

    _setupUI();
    _redrawCanvas();
  }

  function _schedulePreview() {
    if (_state.previewRafPending) return;
    if (!_state.previewSnapshot || typeof canvas === 'undefined' || !canvas || !ctx) return;
    _state.previewRafPending = true;
    requestAnimationFrame(function () {
      _state.previewRafPending = false;
      const snap = _state.previewSnapshot;
      if (!snap) return;
      const lutR = _buildLutFromPoints(_state.points.r);
      const lutG = _buildLutFromPoints(_state.points.g);
      const lutB = _buildLutFromPoints(_state.points.b);
      const lutRGB = _buildLutFromPoints(_state.points.rgb);
      const out = ctx.createImageData(snap.width, snap.height);
      const src = snap.data;
      const dst = out.data;
      for (let i = 0; i < src.length; i += 4) {
        if (src[i + 3] === 0) {
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
          dst[i + 3] = 0;
          continue;
        }
        dst[i]     = lutRGB[lutR[src[i]]];
        dst[i + 1] = lutRGB[lutG[src[i + 1]]];
        dst[i + 2] = lutRGB[lutB[src[i + 2]]];
        dst[i + 3] = src[i + 3];
      }
      ctx.putImageData(out, 0, 0);
    });
  }

  function _rollbackPreview() {
    if (_state.previewSnapshot && typeof canvas !== 'undefined' && canvas && ctx) {
      ctx.putImageData(_state.previewSnapshot, 0, 0);
    }
    _state.previewSnapshot = null;
    _state.previewRafPending = false;
  }

  function _setupUI() {
    const modal = document.getElementById('curves-modal');
    if (!modal || modal.dataset.curvesInitialized === '1') return;
    modal.dataset.curvesInitialized = '1';

    // Tabs de canal
    modal.querySelectorAll('.curves-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.curves-channel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _state.activeChannel = btn.getAttribute('data-channel');
        _redrawCanvas();
      });
    });

    // Botones acción
    const applyBtn = document.getElementById('curves-apply-btn');
    const resetBtn = document.getElementById('curves-reset-btn');
    if (applyBtn) applyBtn.addEventListener('click', _applyToImage);
    if (resetBtn) resetBtn.addEventListener('click', _resetActive);

    const cv = document.getElementById('curves-canvas');
    if (!cv) return;

    const getCanvasCoords = function (evt) {
      const rect = cv.getBoundingClientRect();
      const x = ((evt.clientX - rect.left) / rect.width) * 255;
      const y = 255 - ((evt.clientY - rect.top) / rect.height) * 255;
      return {
        x: Math.max(0, Math.min(255, x)),
        y: Math.max(0, Math.min(255, y))
      };
    };

    cv.addEventListener('mousedown', function (e) {
      const coords = getCanvasCoords(e);
      const points = _state.points[_state.activeChannel];
      const idx = points.findIndex(p => Math.abs(p.x - coords.x) < 8 && Math.abs(p.y - coords.y) < 8);
      if (idx !== -1) {
        _state.dragIndex = idx;
      } else {
        points.push({ x: coords.x, y: coords.y });
        points.sort((a, b) => a.x - b.x);
        _state.dragIndex = points.findIndex(p => p.x === coords.x && p.y === coords.y);
      }
      _redrawCanvas();
      _schedulePreview();
    });

    cv.addEventListener('mousemove', function (e) {
      if (_state.dragIndex === -1) return;
      const coords = getCanvasCoords(e);
      const points = _state.points[_state.activeChannel];
      const i = _state.dragIndex;
      if (i === 0) {
        points[i] = { x: 0, y: coords.y };
      } else if (i === points.length - 1) {
        points[i] = { x: 255, y: coords.y };
      } else {
        const minX = points[i - 1].x + 1;
        const maxX = points[i + 1].x - 1;
        points[i] = {
          x: Math.max(minX, Math.min(maxX, coords.x)),
          y: coords.y
        };
      }
      _redrawCanvas();
      _schedulePreview();
    });

    const stopDrag = function () { _state.dragIndex = -1; };
    cv.addEventListener('mouseup', stopDrag);
    cv.addEventListener('mouseleave', stopDrag);

    cv.addEventListener('dblclick', function (e) {
      const coords = getCanvasCoords(e);
      const points = _state.points[_state.activeChannel];
      const idx = points.findIndex(p => Math.abs(p.x - coords.x) < 8 && Math.abs(p.y - coords.y) < 8);
      if (idx > 0 && idx < points.length - 1) {
        points.splice(idx, 1);
        _redrawCanvas();
        _schedulePreview();
      }
    });

    // Botón Cancelar — rollback del preview y cerrar sin aplicar.
    const cancelBtn = document.getElementById('curves-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        _rollbackPreview();
        if (typeof _closeAccessibleModal === 'function') {
          _closeAccessibleModal(document.getElementById('curves-modal'));
        } else {
          const m = document.getElementById('curves-modal');
          if (m) m.classList.add('hidden');
        }
      });
    }
  }

  function _resetActive() {
    _state.points[_state.activeChannel] = [
      { x: 0, y: 0 },
      { x: 255, y: 255 }
    ];
    _redrawCanvas();
    _schedulePreview();
  }

  // Interpolación lineal segmentada entre puntos de control.
  function _buildLutFromPoints(points) {
    const lut = new Uint8ClampedArray(256);
    const pts = points.slice().sort((a, b) => a.x - b.x);
    let segIdx = 0;
    for (let i = 0; i < 256; i++) {
      while (segIdx < pts.length - 2 && pts[segIdx + 1].x < i) {
        segIdx++;
      }
      const p0 = pts[segIdx];
      const p1 = pts[segIdx + 1];
      if (!p1) {
        lut[i] = p0.y;
        continue;
      }
      if (i <= p0.x) {
        lut[i] = p0.y;
      } else if (i >= p1.x) {
        lut[i] = p1.y;
      } else {
        const t = (i - p0.x) / (p1.x - p0.x);
        lut[i] = p0.y + t * (p1.y - p0.y);
      }
    }
    return lut;
  }

  function _redrawCanvas() {
    const cv = document.getElementById('curves-canvas');
    if (!cv) return;
    const cctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;

    cctx.clearRect(0, 0, W, H);

    // Cuadrícula 4×4
    cctx.strokeStyle = 'rgba(107,114,128,0.25)';
    cctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = (W * i) / 4;
      const y = (H * i) / 4;
      cctx.beginPath();
      cctx.moveTo(x, 0); cctx.lineTo(x, H);
      cctx.moveTo(0, y); cctx.lineTo(W, y);
      cctx.stroke();
    }

    // Línea diagonal de referencia
    cctx.strokeStyle = 'rgba(107,114,128,0.4)';
    cctx.setLineDash([4, 4]);
    cctx.beginPath();
    cctx.moveTo(0, H);
    cctx.lineTo(W, 0);
    cctx.stroke();
    cctx.setLineDash([]);

    const ch = _state.activeChannel;
    const points = _state.points[ch];
    const colorMap = {
      rgb: '#111827',
      r: '#ef4444',
      g: '#10b981',
      b: '#3b82f6'
    };
    const curveColor = colorMap[ch] || '#111827';

    const lut = _buildLutFromPoints(points);

    cctx.strokeStyle = curveColor;
    cctx.lineWidth = 2;
    cctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W;
      const y = H - (lut[i] / 255) * H;
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    }
    cctx.stroke();

    // Puntos de control
    cctx.fillStyle = curveColor;
    cctx.strokeStyle = '#ffffff';
    cctx.lineWidth = 2;
    points.forEach(function (p) {
      const x = (p.x / 255) * W;
      const y = H - (p.y / 255) * H;
      cctx.beginPath();
      cctx.arc(x, y, 5, 0, Math.PI * 2);
      cctx.fill();
      cctx.stroke();
    });
  }

  function _applyToImage() {
    if (typeof canvas === 'undefined' || !canvas || !currentImage) {
      UIManager.showError('No hay imagen sobre la que aplicar las curvas.');
      return;
    }

    // Gracias al live preview el canvas YA tiene la transformación.
    // Fallback: si no hay snapshot (error en apertura), reaplica.
    if (!_state.previewSnapshot) {
      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (err) {
        UIManager.showError('No se pudo leer el canvas para aplicar curvas.');
        return;
      }
      const lutR = _buildLutFromPoints(_state.points.r);
      const lutG = _buildLutFromPoints(_state.points.g);
      const lutB = _buildLutFromPoints(_state.points.b);
      const lutRGB = _buildLutFromPoints(_state.points.rgb);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        data[i]     = lutRGB[lutR[data[i]]];
        data[i + 1] = lutRGB[lutG[data[i + 1]]];
        data[i + 2] = lutRGB[lutB[data[i + 2]]];
      }
      ctx.putImageData(imageData, 0, 0);
    }
    // Descartar snapshot para que el cierre NO haga rollback.
    _state.previewSnapshot = null;
    _state.previewRafPending = false;

    if (typeof historyManager !== 'undefined' && historyManager.saveState) {
      historyManager.saveState();
    }

    UIManager.showSuccess('📈 Curvas aplicadas a la imagen');
    if (typeof _closeAccessibleModal === 'function') {
      _closeAccessibleModal(document.getElementById('curves-modal'));
    } else {
      const m = document.getElementById('curves-modal');
      if (m) m.classList.add('hidden');
    }
    if (typeof renderHistoryPanel === 'function') {
      renderHistoryPanel();
    }
  }

  return {
    open: open,
    _buildLutFromPoints: _buildLutFromPoints
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.CurvesManager;
}
