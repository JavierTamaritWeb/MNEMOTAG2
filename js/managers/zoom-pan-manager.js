'use strict';

// ZoomPanManager v3.7.1: todo el estado compartido se lee y muta mediante
// AppState. Las coordenadas transitorias del gesto son privadas del manager.
window.ZoomPanManager = (function () {
  const gesture = {
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  };

  function limits() {
    return {
      min: AppConfig.minZoom,
      max: AppConfig.maxZoom,
      step: AppConfig.zoomStep,
      wheelStep: AppConfig.wheelZoomStep || 0.1
    };
  }

  function zoomIn() {
    const cfg = limits();
    if (AppState.currentZoom >= cfg.max) return;
    AppState.currentZoom = Math.min(AppState.currentZoom + cfg.step, cfg.max);
    applyZoom();
    updateZoomLevel();
    UIManager.showSuccess('Zoom: ' + Math.round(AppState.currentZoom * 100) + '%');
  }

  function zoomOut() {
    const cfg = limits();
    if (AppState.currentZoom <= cfg.min) return;
    AppState.currentZoom = Math.max(AppState.currentZoom - cfg.step, cfg.min);
    applyZoom();
    updateZoomLevel();
    UIManager.showSuccess('Zoom: ' + Math.round(AppState.currentZoom * 100) + '%');
  }

  function zoomInWheel() {
    const cfg = limits();
    if (AppState.currentZoom >= cfg.max) return;
    AppState.currentZoom = Math.min(AppState.currentZoom + cfg.wheelStep, cfg.max);
    applyZoom();
    updateZoomLevel();
  }

  function zoomOutWheel() {
    const cfg = limits();
    if (AppState.currentZoom <= cfg.min) return;
    AppState.currentZoom = Math.max(AppState.currentZoom - cfg.wheelStep, cfg.min);
    applyZoom();
    updateZoomLevel();
  }

  function resetZoom() {
    AppState.currentZoom = 1;
    AppState.isZoomed = false;
    resetPan();
    applyZoom();
    updateZoomLevel();
    UIManager.showSuccess('Zoom reseteado');
  }

  function clampPan() {
    const canvas = AppState.canvas;
    const zoom = AppState.currentZoom;
    if (!canvas || zoom <= 1) {
      AppState.panX = 0;
      AppState.panY = 0;
      return;
    }
    const maxPX = (canvas.offsetWidth * (zoom - 1)) / 2;
    const maxPY = (canvas.offsetHeight * (zoom - 1)) / 2;
    AppState.panX = Math.max(-maxPX, Math.min(maxPX, AppState.panX));
    AppState.panY = Math.max(-maxPY, Math.min(maxPY, AppState.panY));
  }

  function applyZoom() {
    const canvas = AppState.canvas;
    if (!canvas) return;

    const zoom = AppState.currentZoom;
    if (zoom !== 1) {
      AppState.isZoomed = true;
      clampPan();
      canvas.classList.add('zoomed');
      canvas.style.transform = 'scale(' + zoom + ') translate(' + AppState.panX + 'px, ' + AppState.panY + 'px)';
      canvas.style.transformOrigin = 'center center';
      canvas.style.cursor = 'grab';
    } else {
      AppState.isZoomed = false;
      canvas.classList.remove('zoomed');
      canvas.style.transform = 'scale(1)';
      canvas.style.cursor = 'default';
      AppState.panX = 0;
      AppState.panY = 0;
    }

    const previewContainer = document.querySelector('.preview__container');
    if (previewContainer) previewContainer.style.overflow = 'hidden';
  }

  function updateZoomLevel() {
    const zoom = AppState.currentZoom;
    const cfg = limits();
    const zoomLevelElement = document.getElementById('zoom-level');
    if (zoomLevelElement) zoomLevelElement.textContent = Math.round(zoom * 100) + '%';

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) {
      zoomInBtn.disabled = zoom >= cfg.max;
      zoomInBtn.style.opacity = zoom >= cfg.max ? '0.5' : '1';
    }
    if (zoomOutBtn) {
      zoomOutBtn.disabled = zoom <= cfg.min;
      zoomOutBtn.style.opacity = zoom <= cfg.min ? '0.5' : '1';
    }
  }

  function getKeyboardShortcuts() {
    return [
      { key: '+', modifiers: ['ctrl'], description: 'Aumentar zoom', category: 'Vista' },
      { key: '-', modifiers: ['ctrl'], description: 'Reducir zoom', category: 'Vista' },
      { key: '0', modifiers: ['ctrl'], description: 'Restablecer zoom al 100%', category: 'Vista' }
    ];
  }

  function initZoomKeyboardShortcuts() {
    document.addEventListener('keydown', function (event) {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!event.ctrlKey && !event.metaKey) return;
      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          zoomIn();
          break;
        case '-':
          event.preventDefault();
          zoomOut();
          break;
        case '0':
          event.preventDefault();
          resetZoom();
          break;
      }
    });
  }

  function initMouseWheelZoom() {
    const previewContainer = document.querySelector('.preview__container');
    const canvas = document.getElementById('preview-canvas');
    if (!previewContainer) return;

    const handleWheelZoom = function (event) {
      if (!AppState.currentImage || !canvas) return;
      if (window.innerWidth >= 768) return;
      event.preventDefault();
      if (event.deltaY < 0) zoomInWheel();
      else if (event.deltaY > 0) zoomOutWheel();
    };

    previewContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
    if (canvas) canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
  }

  function beginPan(clientX, clientY) {
    AppState.isPanning = true;
    gesture.startX = clientX;
    gesture.startY = clientY;
    gesture.startOffsetX = AppState.panX;
    gesture.startOffsetY = AppState.panY;
  }

  function movePan(clientX, clientY, canvas) {
    const zoom = AppState.currentZoom;
    const maxPX = (canvas.offsetWidth * (zoom - 1)) / 2;
    const maxPY = (canvas.offsetHeight * (zoom - 1)) / 2;
    AppState.panX = Math.max(-maxPX, Math.min(maxPX, gesture.startOffsetX + (clientX - gesture.startX) / zoom));
    AppState.panY = Math.max(-maxPY, Math.min(maxPY, gesture.startOffsetY + (clientY - gesture.startY) / zoom));
    applyZoom();
  }

  function endPan(canvas) {
    if (!AppState.isPanning) return;
    AppState.isPanning = false;
    if (canvas && AppState.isZoomed) canvas.style.cursor = 'grab';
  }

  function initPanNavigation() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', function (event) {
      if (!AppState.isZoomed || !AppState.currentImage) return;
      beginPan(event.clientX, event.clientY);
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
    });

    document.addEventListener('mousemove', function (event) {
      if (!AppState.isPanning || !AppState.isZoomed) return;
      movePan(event.clientX, event.clientY, canvas);
      event.preventDefault();
    });
    document.addEventListener('mouseup', function () { endPan(canvas); });
    document.addEventListener('mouseleave', function () { endPan(canvas); });

    canvas.addEventListener('touchstart', function (event) {
      if (!AppState.isZoomed || !AppState.currentImage || !event.touches[0]) return;
      beginPan(event.touches[0].clientX, event.touches[0].clientY);
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (event) {
      if (!AppState.isPanning || !AppState.isZoomed || !event.touches[0]) return;
      movePan(event.touches[0].clientX, event.touches[0].clientY, canvas);
      event.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', function () { endPan(canvas); });
  }

  function resetPan() {
    AppState.panX = 0;
    AppState.panY = 0;
    AppState.isPanning = false;
    const canvas = AppState.canvas;
    if (canvas) canvas.style.cursor = AppState.isZoomed ? 'grab' : 'default';
  }

  return {
    zoomIn,
    zoomOut,
    zoomInWheel,
    zoomOutWheel,
    resetZoom,
    applyZoom,
    updateZoomLevel,
    initZoomKeyboardShortcuts,
    getKeyboardShortcuts,
    initMouseWheelZoom,
    initPanNavigation,
    resetPan
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ZoomPanManager;
}
