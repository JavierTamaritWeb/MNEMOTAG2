'use strict';

window.RulerManager = (function () {
  let mouseX = 0;
  let mouseY = 0;
  const elements = {
    horizontalRuler: null,
    verticalRuler: null,
    horizontalLine: null,
    verticalLine: null,
    coordinateDisplay: null,
    container: null
  };

  function contentRect() {
    const canvas = AppState.canvas;
    const rect = canvas.getBoundingClientRect();
    const canvasAR = canvas.width / canvas.height;
    const boxAR = rect.width / rect.height;
    if (Math.abs(canvasAR - boxAR) < 0.01) return rect;
    if (canvasAR > boxAR) {
      const height = rect.width / canvasAR;
      return { left: rect.left, top: rect.top + (rect.height - height) / 2, width: rect.width, height };
    }
    const width = rect.height * canvasAR;
    return { left: rect.left + (rect.width - width) / 2, top: rect.top, width, height: rect.height };
  }

  function toggle() {
    AppState.isRulerMode = !AppState.isRulerMode;
    if (AppState.isRulerMode) {
      create();
      UIManager.showSuccess('Reglas métricas activadas');
    } else {
      remove();
      UIManager.showSuccess('Reglas métricas desactivadas');
    }
    document.getElementById('ruler-toggle-btn')?.classList.toggle('active', AppState.isRulerMode);
  }

  function createElement(id, cssText) {
    const element = document.createElement('div');
    element.id = id;
    element.style.cssText = cssText;
    return element;
  }

  function create() {
    const canvas = AppState.canvas;
    if (!canvas || elements.container) return;
    const previewContainer = canvas.parentElement;
    if (!previewContainer) return;
    previewContainer.style.position = 'relative';

    elements.container = createElement('ruler-system-container', 'position:absolute;inset:0;pointer-events:none;z-index:100');
    elements.horizontalRuler = createElement('ruler-horizontal', 'position:absolute;top:0;left:30px;right:0;height:30px;background:rgba(0,0,0,.8);color:#fff;font:10px monospace;box-shadow:0 2px 5px rgba(0,0,0,.3)');
    elements.verticalRuler = createElement('ruler-vertical', 'position:absolute;top:30px;left:0;bottom:0;width:30px;background:rgba(0,0,0,.8);color:#fff;font:10px monospace;box-shadow:2px 0 5px rgba(0,0,0,.3)');
    elements.horizontalLine = createElement('ruler-line-horizontal', 'position:absolute;left:30px;right:0;height:1px;background:#fff;opacity:.7;display:none');
    elements.verticalLine = createElement('ruler-line-vertical', 'position:absolute;top:30px;bottom:0;width:1px;background:#fff;opacity:.7;display:none');
    elements.coordinateDisplay = createElement('ruler-coordinates', 'position:absolute;background:rgba(0,0,0,.9);color:#fff;padding:5px 10px;border-radius:5px;font:bold 12px monospace;display:none;box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap');

    elements.container.append(
      elements.horizontalRuler,
      elements.verticalRuler,
      elements.horizontalLine,
      elements.verticalLine,
      elements.coordinateDisplay
    );
    previewContainer.appendChild(elements.container);
    drawMarks();
    canvas.addEventListener('mousemove', handleRulerMouseMove);
    canvas.addEventListener('mouseenter', showGuides);
    canvas.addEventListener('mouseleave', hideGuides);
  }

  function drawMarks() {
    const canvas = AppState.canvas;
    if (!canvas || !elements.horizontalRuler || !elements.verticalRuler) return;
    const rect = contentRect();
    const horizontal = [];
    const vertical = [];
    for (let x = 0; x <= canvas.width; x += 50) {
      const label = document.createElement('span');
      label.style.cssText = 'position:absolute;left:' + (x * rect.width / canvas.width) + 'px;bottom:2px';
      label.textContent = x;
      horizontal.push(label);
    }
    for (let y = 0; y <= canvas.height; y += 50) {
      const label = document.createElement('span');
      label.style.cssText = 'position:absolute;left:2px;top:' + (y * rect.height / canvas.height) + 'px';
      label.textContent = y;
      vertical.push(label);
    }
    elements.horizontalRuler.replaceChildren(...horizontal);
    elements.verticalRuler.replaceChildren(...vertical);
  }

  function handleRulerMouseMove(event) {
    const canvas = AppState.canvas;
    if (!AppState.isRulerMode || !canvas) return;
    const rect = contentRect();
    mouseX = Math.max(0, Math.min(Math.round((event.clientX - rect.left) * canvas.width / rect.width), canvas.width));
    mouseY = Math.max(0, Math.min(Math.round((event.clientY - rect.top) * canvas.height / rect.height), canvas.height));
    updateCrosshair(rect);
    updateCoordinates(rect);
  }

  function backgroundColor() {
    const canvas = AppState.canvas;
    const ctx = AppState.ctx;
    if (!ctx || !AppState.currentImage || !canvas) return '#fff';
    try {
      const data = ctx.getImageData(
        Math.max(0, Math.min(mouseX, canvas.width - 1)),
        Math.max(0, Math.min(mouseY, canvas.height - 1)),
        1,
        1
      ).data;
      return (data[0] + data[1] + data[2]) / 3 > 128 ? '#000' : '#fff';
    } catch (error) {
      return '#fff';
    }
  }

  function updateCrosshair(rect) {
    const canvas = AppState.canvas;
    if (!elements.horizontalLine || !elements.verticalLine || !canvas) return;
    const color = backgroundColor();
    elements.horizontalLine.style.top = ((mouseY / canvas.height) * rect.height + 30) + 'px';
    elements.horizontalLine.style.background = color;
    elements.verticalLine.style.left = ((mouseX / canvas.width) * rect.width + 30) + 'px';
    elements.verticalLine.style.background = color;
  }

  function updateCoordinates(rect) {
    const canvas = AppState.canvas;
    if (!elements.coordinateDisplay || !canvas) return;
    const x = (mouseX / canvas.width) * rect.width;
    const y = (mouseY / canvas.height) * rect.height;
    elements.coordinateDisplay.textContent = 'X: ' + mouseX + 'px, Y: ' + mouseY + 'px';
    elements.coordinateDisplay.style.left = ((x + 195 > rect.width ? x - 130 : x + 45)) + 'px';
    elements.coordinateDisplay.style.top = ((y < 5 ? y + 45 : y)) + 'px';
  }

  function showGuides() {
    if (!AppState.isRulerMode) return;
    [elements.horizontalLine, elements.verticalLine, elements.coordinateDisplay]
      .filter(Boolean).forEach(element => { element.style.display = 'block'; });
  }

  function hideGuides() {
    [elements.horizontalLine, elements.verticalLine, elements.coordinateDisplay]
      .filter(Boolean).forEach(element => { element.style.display = 'none'; });
  }

  function remove() {
    const canvas = AppState.canvas;
    if (canvas) {
      canvas.removeEventListener('mousemove', handleRulerMouseMove);
      canvas.removeEventListener('mouseenter', showGuides);
      canvas.removeEventListener('mouseleave', hideGuides);
    }
    elements.container?.remove();
    Object.keys(elements).forEach(key => { elements[key] = null; });
  }

  return { toggle, create, remove, drawMarks, handleRulerMouseMove };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.RulerManager;
