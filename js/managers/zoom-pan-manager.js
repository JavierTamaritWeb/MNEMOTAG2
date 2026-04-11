'use strict';

// ===== ZOOM & PAN MANAGER (v3.5.0 Fase 3) =====
// Zoom con botones/teclado/rueda + pan con mouse/touch.
// Accede a las variables globales de main.js por nombre:
//   canvas, currentZoom, minZoom, maxZoom, zoomStep, isZoomed,
//   panX, panY, isPanning, startPanX, startPanY, startOffsetX, startOffsetY,
//   currentImage, UIManager

window.ZoomPanManager = (function () {

  function zoomIn() {
    if (currentZoom < maxZoom) {
      currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
      applyZoom();
      updateZoomLevel();
      UIManager.showSuccess('Zoom: ' + Math.round(currentZoom * 100) + '%');
    }
  }

  function zoomOut() {
    if (currentZoom > minZoom) {
      currentZoom = Math.max(currentZoom - zoomStep, minZoom);
      applyZoom();
      updateZoomLevel();
      UIManager.showSuccess('Zoom: ' + Math.round(currentZoom * 100) + '%');
    }
  }

  function zoomInWheel() {
    if (currentZoom < maxZoom) {
      var wheelStep = 0.05;
      currentZoom = Math.min(currentZoom + wheelStep, maxZoom);
      applyZoom();
      updateZoomLevel();
    }
  }

  function zoomOutWheel() {
    if (currentZoom > minZoom) {
      var wheelStep = 0.05;
      currentZoom = Math.max(currentZoom - wheelStep, minZoom);
      applyZoom();
      updateZoomLevel();
    }
  }

  function resetZoom() {
    currentZoom = 1.0;
    isZoomed = false;
    resetPan();
    applyZoom();
    updateZoomLevel();
    UIManager.showSuccess('Zoom reseteado');
  }

  function applyZoom() {
    if (!canvas) return;
    if (currentZoom !== 1.0) {
      isZoomed = true;
      canvas.classList.add('zoomed');
      canvas.style.transform = 'scale(' + currentZoom + ') translate(' + panX + 'px, ' + panY + 'px)';
      canvas.style.transformOrigin = 'center center';
      canvas.style.cursor = 'grab';
    } else {
      isZoomed = false;
      canvas.classList.remove('zoomed');
      canvas.style.transform = 'scale(1)';
      canvas.style.cursor = 'default';
      panX = 0;
      panY = 0;
    }
    var previewContainer = document.querySelector('.preview__container');
    if (previewContainer) {
      previewContainer.style.overflow = 'hidden';
    }
  }

  function updateZoomLevel() {
    var zoomLevelElement = document.getElementById('zoom-level');
    if (zoomLevelElement) {
      zoomLevelElement.textContent = Math.round(currentZoom * 100) + '%';
    }
    var zoomInBtn = document.getElementById('zoom-in-btn');
    var zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn) {
      zoomInBtn.disabled = currentZoom >= maxZoom;
      zoomInBtn.style.opacity = currentZoom >= maxZoom ? '0.5' : '1';
    }
    if (zoomOutBtn) {
      zoomOutBtn.disabled = currentZoom <= minZoom;
      zoomOutBtn.style.opacity = currentZoom <= minZoom ? '0.5' : '1';
    }
  }

  function initZoomKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '+': case '=':
            e.preventDefault(); zoomIn(); break;
          case '-':
            e.preventDefault(); zoomOut(); break;
          case '0':
            e.preventDefault(); resetZoom(); break;
        }
      }
    });
  }

  function initMouseWheelZoom() {
    var previewContainer = document.querySelector('.preview__container');
    var cv = document.getElementById('preview-canvas');
    if (!previewContainer) return;

    var handleWheelZoom = function (e) {
      if (!currentImage || !cv) return;
      if (window.innerWidth >= 768) return; // Solo móvil
      e.preventDefault();
      if (e.deltaY < 0) zoomInWheel();
      else if (e.deltaY > 0) zoomOutWheel();
    };

    previewContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
    if (cv) cv.addEventListener('wheel', handleWheelZoom, { passive: false });
  }

  function initPanNavigation() {
    var cv = document.getElementById('preview-canvas');
    if (!cv) return;

    cv.addEventListener('mousedown', function (e) {
      if (!isZoomed || !currentImage) return;
      isPanning = true;
      startPanX = e.clientX;
      startPanY = e.clientY;
      startOffsetX = panX;
      startOffsetY = panY;
      cv.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!isPanning || !isZoomed) return;
      var maxPX = (cv.offsetWidth * (currentZoom - 1)) / 2;
      var maxPY = (cv.offsetHeight * (currentZoom - 1)) / 2;
      panX = Math.max(-maxPX, Math.min(maxPX, startOffsetX + (e.clientX - startPanX) / currentZoom));
      panY = Math.max(-maxPY, Math.min(maxPY, startOffsetY + (e.clientY - startPanY) / currentZoom));
      applyZoom();
      e.preventDefault();
    });

    document.addEventListener('mouseup', function () {
      if (isPanning) {
        isPanning = false;
        if (cv && isZoomed) cv.style.cursor = 'grab';
      }
    });

    document.addEventListener('mouseleave', function () {
      if (isPanning) {
        isPanning = false;
        if (cv && isZoomed) cv.style.cursor = 'grab';
      }
    });

    // Touch
    cv.addEventListener('touchstart', function (e) {
      if (!isZoomed || !currentImage) return;
      var touch = e.touches[0];
      isPanning = true;
      startPanX = touch.clientX;
      startPanY = touch.clientY;
      startOffsetX = panX;
      startOffsetY = panY;
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
      if (!isPanning || !isZoomed) return;
      var touch = e.touches[0];
      var maxPX = (cv.offsetWidth * (currentZoom - 1)) / 2;
      var maxPY = (cv.offsetHeight * (currentZoom - 1)) / 2;
      panX = Math.max(-maxPX, Math.min(maxPX, startOffsetX + (touch.clientX - startPanX) / currentZoom));
      panY = Math.max(-maxPY, Math.min(maxPY, startOffsetY + (touch.clientY - startPanY) / currentZoom));
      applyZoom();
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', function () {
      if (isPanning) isPanning = false;
    });
  }

  function resetPan() {
    panX = 0;
    panY = 0;
    isPanning = false;
    if (canvas) {
      canvas.style.cursor = isZoomed ? 'grab' : 'default';
    }
  }

  return {
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    zoomInWheel: zoomInWheel,
    zoomOutWheel: zoomOutWheel,
    resetZoom: resetZoom,
    applyZoom: applyZoom,
    updateZoomLevel: updateZoomLevel,
    initZoomKeyboardShortcuts: initZoomKeyboardShortcuts,
    initMouseWheelZoom: initMouseWheelZoom,
    initPanNavigation: initPanNavigation,
    resetPan: resetPan
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ZoomPanManager;
}
