'use strict';

window.MobileManager = (function () {
  let initialized = false;
  let setupCanvas = function () {};
  let updatePreview = function () {};

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function distance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  }

  function resetCanvasView() {
    AppState.currentZoom = 1;
    AppState.isZoomed = false;
    ZoomPanManager.resetPan();
    ZoomPanManager.applyZoom();
    ZoomPanManager.updateZoomLevel();
  }

  function initDoubleTap() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    let lastTap = 0;
    canvas.addEventListener('touchend', function (event) {
      const now = Date.now();
      if (now - lastTap < 500 && now - lastTap > 0) {
        resetCanvasView();
        event.preventDefault();
      }
      lastTap = now;
    });
  }

  function initNavigation() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('touchend', function () {
        setTimeout(() => {
          if (!header.closest('.collapsible')?.classList.contains('collapsed')) {
            header.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          }
        }, 100);
      });
    });

    const actionButtons = document.querySelector('.action-buttons');
    const lastSection = document.querySelector('section:last-of-type');
    if (actionButtons && lastSection && window.innerWidth <= 767 && typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => actionButtons.classList.toggle('fixed-bottom', !entry.isIntersecting));
      });
      observer.observe(lastSection);
    }
  }

  function initPinchZoom() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    let initialDistance = 0;
    canvas.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 2) return;
      initialDistance = distance(event.touches[0], event.touches[1]);
      event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (event) {
      if (event.touches.length !== 2 || !initialDistance) return;
      const currentDistance = distance(event.touches[0], event.touches[1]);
      AppState.currentZoom = Math.min(
        Math.max(AppConfig.minZoom, AppState.currentZoom * currentDistance / initialDistance),
        AppConfig.maxZoom
      );
      ZoomPanManager.applyZoom();
      ZoomPanManager.updateZoomLevel();
      initialDistance = currentDistance;
      event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function (event) {
      if (event.touches.length === 0 && AppState.currentZoom < 1.05 && AppState.currentZoom !== 1) {
        resetCanvasView();
      }
    });
  }

  function initKeyboardHandling() {
    const initialHeight = window.innerHeight;
    window.addEventListener('resize', function () {
      const keyboardOpen = initialHeight - window.innerHeight > 150;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
      if (keyboardOpen && document.activeElement && document.activeElement.tagName !== 'BODY') {
        setTimeout(() => document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    });
    document.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('focus', function () { this.style.fontSize = '16px'; });
    });
  }

  function updateLayout() {
    if (!isMobileDevice()) return;
    document.querySelectorAll('.grid').forEach(grid => {
      if (window.innerWidth <= 480) grid.style.gridTemplateColumns = '1fr';
      else if (grid.classList.contains('grid-cols-2')) grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    });
    document.querySelectorAll('.button-group').forEach(group => {
      group.style.flexDirection = window.innerWidth <= 480 ? 'column' : 'row';
    });
    if (AppState.currentImage && AppState.canvas) {
      setupCanvas();
      updatePreview();
    }
  }

  function initialize(dependencies = {}) {
    if (initialized) return;
    initialized = true;
    setupCanvas = dependencies.setupCanvas || setupCanvas;
    updatePreview = dependencies.updatePreview || updatePreview;
    if (isMobileDevice()) {
      document.body.classList.add('mobile-device');
      initDoubleTap();
      initNavigation();
      initPinchZoom();
      initKeyboardHandling();
    }
    window.addEventListener('orientationchange', function () {
      setTimeout(() => {
        if (AppState.currentImage) updatePreview();
        resetCanvasView();
        updateLayout();
      }, 100);
    });
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updateLayout();
        if (AppState.currentImage) {
          setupCanvas();
          updatePreview();
        }
      }, 250);
    });
    window.addEventListener('load', updateLayout);
  }

  return { initialize, isMobileDevice, updateLayout, resetCanvasView };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.MobileManager;
