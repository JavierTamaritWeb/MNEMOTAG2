'use strict';

window.ComparisonManager = (function () {
  let active = false;
  let sliderPosition = 50;
  let originalCanvas = null;
  let needsUpdate = true;
  let dragging = false;
  let initialized = false;

  function initialize() {
    if (initialized) return;
    const toggleButton = document.getElementById('compare-toggle-btn');
    const overlay = document.getElementById('comparison-overlay');
    const slider = document.getElementById('comparison-slider');
    if (!toggleButton || !overlay || !slider) return;
    initialized = true;
    toggleButton.addEventListener('click', toggle);
    slider.addEventListener('mousedown', startDrag);
    slider.addEventListener('touchstart', startDrag, { passive: false });
    overlay.addEventListener('click', event => {
      if (event.target !== slider && !slider.contains(event.target)) moveTo(event);
    });
    slider.querySelector('.comparison-slider-handle')?.addEventListener('dblclick', event => {
      event.stopPropagation();
      sliderPosition = 50;
      updateSlider();
    });
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
  }

  function handleKeydown(event) {
    if (!active) return;
    if (event.key === 'Escape') return toggle();
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    sliderPosition = Math.max(0, Math.min(100, sliderPosition + (event.key === 'ArrowLeft' ? -5 : 5)));
    updateSlider();
  }

  function setButtonState(button) {
    button.classList.toggle('active', active);
    button.replaceChildren();
    const icon = document.createElement('i');
    icon.className = active ? 'fas fa-times' : 'fas fa-sliders-h';
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon, document.createTextNode(active ? ' Cerrar' : ' Comparar'));
  }

  function toggle() {
    if (!AppState.currentImage) {
      UIManager.showError('CARGA UNA IMAGEN PRIMERO');
      return;
    }
    active = !active;
    const overlay = document.getElementById('comparison-overlay');
    const button = document.getElementById('compare-toggle-btn');
    const original = document.getElementById('comparison-canvas-original');
    const edited = document.getElementById('comparison-canvas-edited');
    if (!overlay || !button) return;

    if (active) {
      saveOriginal();
      overlay.style.display = 'block';
      requestAnimationFrame(render);
      UIManager.showInfo('Arrastra el slider o usa las flechas para comparar');
    } else {
      overlay.style.display = 'none';
      if (original) { original.width = 0; original.height = 0; }
      if (edited) { edited.width = 0; edited.height = 0; }
      if (originalCanvas && originalCanvas.width * originalCanvas.height > 4000000) {
        originalCanvas.width = 0;
        originalCanvas.height = 0;
        originalCanvas = null;
        needsUpdate = true;
      }
      sliderPosition = 50;
    }
    setButtonState(button);
  }

  function saveOriginal() {
    const image = AppState.currentImage;
    if ((originalCanvas && !needsUpdate) || !image) return;
    if (!originalCanvas) originalCanvas = document.createElement('canvas');
    originalCanvas.width = image.width;
    originalCanvas.height = image.height;
    originalCanvas.getContext('2d').drawImage(image, 0, 0);
    needsUpdate = false;
  }

  function render() {
    const original = document.getElementById('comparison-canvas-original');
    const edited = document.getElementById('comparison-canvas-edited');
    const main = AppState.canvas;
    if (!original || !edited || !main || !originalCanvas) return;
    original.width = originalCanvas.width;
    original.height = originalCanvas.height;
    original.getContext('2d').drawImage(originalCanvas, 0, 0);
    edited.width = main.width;
    edited.height = main.height;
    edited.getContext('2d').drawImage(main, 0, 0);
    updateSlider();
  }

  function updateSlider() {
    const slider = document.getElementById('comparison-slider');
    const edited = document.getElementById('comparison-canvas-edited');
    const overlay = document.getElementById('comparison-overlay');
    if (!slider || !edited || !overlay) return;
    slider.style.left = sliderPosition + '%';
    const clipWidth = sliderPosition / 100 * overlay.offsetWidth;
    edited.style.clipPath = 'inset(0 ' + (overlay.offsetWidth - clipWidth) + 'px 0 0)';
  }

  function startDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    document.body.style.cursor = 'ew-resize';
  }

  function stopDrag() {
    dragging = false;
    document.body.style.cursor = '';
  }

  function moveTo(event) {
    const overlay = document.getElementById('comparison-overlay');
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    sliderPosition = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
    updateSlider();
  }

  function drag(event) {
    if (!dragging || !active) return;
    event.preventDefault();
    moveTo(event);
  }

  function invalidate() { needsUpdate = true; }

  return { initialize, toggle, render, invalidate, isActive: () => active };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.ComparisonManager;
