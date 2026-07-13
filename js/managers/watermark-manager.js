'use strict';

// ===== WATERMARK MANAGER (v3.7.1) =====
// Todo el sistema de marcas de agua extraído de main.js:
//
//   - Persistencia del formulario de watermark en localStorage
//   - Sincronización slider ↔ input numérico
//   - Cálculo de posiciones (texto e imagen, incluidas posiciones custom)
//   - Render optimizado sobre el canvas (texto + imagen con caché por archivo)
//   - Modos de posicionamiento personalizado y marcadores DOM
//   - Drag & drop (ratón y táctil) con hit-testing
//   - Submit del formulario de watermark
//
// Igual que el resto de managers extraídos, las funciones referencian el
// estado y los helpers que siguen viviendo en main.js por nombre global
// (ámbito de script compartido). Las MUTACIONES de estado compartido pasan
// por AppState (fachada observable, v3.7.1): así los suscriptores (autosave
// de sesión, etc.) se enteran de los cambios sin acoplarse a este manager.
//
//   Variables let de main.js (lectura por nombre; escritura vía AppState):
//     canvas, ctx, currentImage, isZoomed, isPanning,
//     customImagePosition, customTextPosition, isPositioningMode,
//     isTextPositioningMode, lastPositioningModeActivated,
//     isDragging, dragTarget, dragOffsetX, dragOffsetY,
//     textWatermarkBounds, imageWatermarkBounds, hoveredWatermark,
//     watermarkImagePreview, showPositioningBorders, textLayerBounds,
//     textLayerManager
//
//   Funciones de main.js (llamadas de forma diferida):
//     updatePreview, debouncedUpdatePreview, getCanvasContentRect,
//     updatePreview, debouncedUpdatePreview, getCanvasContentRect, showError
//
//   Managers/utilidades globales:
//     AppState, UIManager, SecurityManager, FormValidator, SmartDebounce,
//     historyManager, MNEMOTAG_DEBUG

window.WatermarkManager = (function () {
  const cache = {
    watermarkImage: null,
    lastWatermarkConfig: null,
    lastWatermarkFileKey: null
  };

  function clearCache() {
    cache.watermarkImage = null;
    cache.lastWatermarkConfig = null;
    cache.lastWatermarkFileKey = null;
    AppState.watermarkImagePreview = null;
  }

  // ================================================================
  // Persistencia del formulario de watermark en localStorage.
  // Los datos se mantienen entre reloads y sesiones hasta que el
  // usuario pulse el botón "Limpiar" explícitamente.
  // ================================================================

  const WATERMARK_STORAGE_KEY = 'mnemotag-watermark-state';
  const WATERMARK_PERSIST_FIELDS = [
    'watermark-text-enabled',
    'watermark-image-enabled',
    'watermark-auto-scale',
    'watermark-text',
    'watermark-font',
    'watermark-color',
    'watermark-position',
    'watermark-size',
    'watermark-opacity',
    'watermark-image-size',
    'watermark-image-opacity',
    'watermark-image-position',
    'watermark-image-width',
    'watermark-image-height'
  ];

  function setupWatermarkPersistence() {
    let saveTimer = null;
    const handler = function () {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveTimer = null;
        const state = {};
        WATERMARK_PERSIST_FIELDS.forEach(function (id) {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.type === 'checkbox') {
            state[id] = el.checked;
          } else {
            state[id] = el.value;
          }
        });
        try {
          localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* localStorage lleno o no disponible */ }
      }, 500);
    };

    WATERMARK_PERSIST_FIELDS.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });
  }

  function restoreWatermarkState() {
    try {
      const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') return;

      WATERMARK_PERSIST_FIELDS.forEach(function (id) {
        if (state[id] === undefined) return;
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
          el.checked = !!state[id];
        } else {
          el.value = state[id];
        }
      });

      // Sincronizar los campos numéricos espejo (range ↔ number).
      const syncPairs = [
        ['watermark-size', 'watermark-size-num'],
        ['watermark-opacity', 'watermark-opacity-num'],
        ['watermark-image-opacity', 'watermark-image-opacity-num']
      ];
      syncPairs.forEach(function (pair) {
        const slider = document.getElementById(pair[0]);
        const num = document.getElementById(pair[1]);
        if (slider && num) num.value = slider.value;
      });

      // Disparar los toggles de visibilidad del form para que la UI
      // refleje el estado restaurado (ej: mostrar/ocultar los campos
      // de texto o imagen según los checkboxes).
      toggleWatermarkType();
    } catch (e) {
      MNEMOTAG_DEBUG && console.warn('restoreWatermarkState: error restaurando:', e);
    }
  }

  function clearWatermarkState() {
    try { localStorage.removeItem(WATERMARK_STORAGE_KEY); } catch (e) { MNEMOTAG_DEBUG && console.warn('localStorage op failed:', e); }
    const form = document.getElementById('watermark-form');
    if (form) form.reset();
    const syncPairs = [
      ['watermark-size', 'watermark-size-num'],
      ['watermark-opacity', 'watermark-opacity-num'],
      ['watermark-image-opacity', 'watermark-image-opacity-num']
    ];
    syncPairs.forEach(function (pair) {
      const slider = document.getElementById(pair[0]);
      const num = document.getElementById(pair[1]);
      if (slider && num) num.value = slider.value;
    });
    toggleWatermarkType();
  }

  // ================================================================
  // Sincronización slider ↔ input numérico del formulario
  // ================================================================

  function setupWatermarkSliderSync() {

    // Definir los sliders que necesitan sincronización
    const sliderConfigs = [
      { sliderId: 'watermark-size', numberId: 'watermark-size-num' },
      { sliderId: 'watermark-opacity', numberId: 'watermark-opacity-num' },
      { sliderId: 'watermark-image-opacity', numberId: 'watermark-image-opacity-num' }
    ];

    sliderConfigs.forEach(({ sliderId, numberId }) => {
      const slider = document.getElementById(sliderId);
      const numberInput = document.getElementById(numberId);

      if (slider && numberInput) {

        // Copiar atributos del slider al input numérico
        numberInput.min = slider.min;
        numberInput.max = slider.max;
        numberInput.step = slider.step || 1;

        // Sincronizar valores iniciales
        numberInput.value = slider.value;

        // Función para validar y clamp valores
        const validateAndClamp = (value, min, max, step = 1) => {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return null;

          // Clamp al rango
          const clampedValue = Math.max(min, Math.min(max, numValue));

          // Redondear al step más cercano
          const stepValue = Math.round(clampedValue / step) * step;

          return Math.max(min, Math.min(max, stepValue));
        };

        // Crear debounced update function para el input numérico
        const debouncedNumberUpdate = SmartDebounce.intelligent(`${sliderId}-number-update`, () => {
          updatePreview();
        }, 150);

        // Slider → Number input
        slider.addEventListener('input', (e) => {
          numberInput.value = e.target.value;
        });

        // Number input → Slider
        numberInput.addEventListener('input', (e) => {
          const value = e.target.value;

          // Si el campo está vacío, no hacer nada hasta que sea válido
          if (value === '') return;

          const validatedValue = validateAndClamp(
            value,
            parseFloat(slider.min),
            parseFloat(slider.max),
            parseFloat(slider.step || 1)
          );

          if (validatedValue !== null) {
            slider.value = validatedValue;
            e.target.value = validatedValue;

            // Aplicar cambios con debounce
            debouncedNumberUpdate();
          }
        });

        // Validación en blur para corregir valores inválidos
        numberInput.addEventListener('blur', (e) => {
          const value = e.target.value;

          if (value === '' || isNaN(parseFloat(value))) {
            // Si está vacío o inválido, restaurar al valor del slider
            e.target.value = slider.value;
            return;
          }

          const validatedValue = validateAndClamp(
            value,
            parseFloat(slider.min),
            parseFloat(slider.max),
            parseFloat(slider.step || 1)
          );

          if (validatedValue !== null && validatedValue != value) {
            e.target.value = validatedValue;
            slider.value = validatedValue;
            updatePreview();
          }
        });

        // Manejar Enter key
        numberInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.target.blur();
          }
        });

      } else {
        MNEMOTAG_DEBUG && console.warn(`❌ No se pudo configurar sincronización para ${sliderId}:`, {
          slider: !!slider,
          numberInput: !!numberInput
        });
      }
    });
  }

  // ================================================================
  // Cambio de archivo de imagen de watermark
  // ================================================================

  function handleWatermarkImageChange() {
    // Clear cache when new image is selected
    clearCache();

    // Update button label with filename
    const watermarkInput = document.getElementById('watermark-image');
    const labelSpan = document.getElementById('watermark-file-label');
    const uploadLabel = document.getElementById('watermark-upload-label');
    const thumbnailElement = document.getElementById('watermark-preview-thumb');

    if (watermarkInput && labelSpan) {
      if (watermarkInput.files && watermarkInput.files[0]) {
        const fileName = watermarkInput.files[0].name;
        const shortName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
        labelSpan.textContent = shortName;

        // Cambiar botón a verde
        if (uploadLabel) {
          uploadLabel.classList.add('watermark-loaded');
        }

        // Mostrar miniatura
        if (thumbnailElement) {
          const reader = new FileReader();
          reader.onload = function(e) {
            thumbnailElement.src = e.target.result;
            thumbnailElement.style.display = 'block';
          };
          reader.readAsDataURL(watermarkInput.files[0]);
        }
      } else {
        labelSpan.textContent = 'Seleccionar archivo';

        // Restaurar botón a rojo
        if (uploadLabel) {
          uploadLabel.classList.remove('watermark-loaded');
        }

        // Ocultar miniatura
        if (thumbnailElement) {
          thumbnailElement.style.display = 'none';
          thumbnailElement.src = '';
        }
      }
    }

    debouncedUpdatePreview();
  }

  // ================================================================
  // Cálculo de posiciones
  // ================================================================

  function getImageWatermarkPosition(position, width, height) {
    // Si es posición personalizada, usar las coordenadas del clic
    if (position === 'custom' && customImagePosition) {
      return {
        x: customImagePosition.x - width / 2,
        y: customImagePosition.y - height / 2
      };
    }

    // Posicionamiento propio para imágenes (top-left origin, no baseline).
    // getWatermarkPosition usa fórmulas de baseline de texto (y = margin + height)
    // que hacen que las imágenes se desborden del canvas en posiciones bottom-*.
    const cw = canvas.width;
    const ch = canvas.height;
    const m = 20;
    switch (position) {
      case 'top-left':      return { x: m, y: m };
      case 'top-center':    return { x: (cw - width) / 2, y: m };
      case 'top-right':     return { x: cw - width - m, y: m };
      case 'center-left':   return { x: m, y: (ch - height) / 2 };
      case 'center':        return { x: (cw - width) / 2, y: (ch - height) / 2 };
      case 'center-right':  return { x: cw - width - m, y: (ch - height) / 2 };
      case 'bottom-left':   return { x: m, y: ch - height - m };
      case 'bottom-center': return { x: (cw - width) / 2, y: ch - height - m };
      case 'bottom-right':  return { x: cw - width - m, y: ch - height - m };
      default:              return { x: (cw - width) / 2, y: (ch - height) / 2 };
    }
  }

  function getTextWatermarkPosition(position, width, height) {
    // Si es posición personalizada, usar las coordenadas del clic
    if (position === 'custom' && customTextPosition) {
      return {
        x: customTextPosition.x - width / 2,
        y: customTextPosition.y
      };
    }

    // Si no, usar la función estándar
    return getWatermarkPosition(position, width, height);
  }

  function getWatermarkPosition(position, width, height) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const margin = 20;

    let x, y;

    switch (position) {
      case 'top-left':
        x = margin;
        y = margin + height;
        break;
      case 'top-center':
        x = (canvasWidth - width) / 2;
        y = margin + height;
        break;
      case 'top-right':
        x = canvasWidth - width - margin;
        y = margin + height;
        break;
      case 'center-left':
        x = margin;
        y = (canvasHeight + height) / 2;
        break;
      case 'center':
        x = (canvasWidth - width) / 2;
        y = (canvasHeight + height) / 2;
        break;
      case 'center-right':
        x = canvasWidth - width - margin;
        y = (canvasHeight + height) / 2;
        break;
      case 'bottom-left':
        x = margin;
        y = canvasHeight - margin;
        break;
      case 'bottom-center':
        x = (canvasWidth - width) / 2;
        y = canvasHeight - margin;
        break;
      case 'bottom-right':
        x = canvasWidth - width - margin;
        y = canvasHeight - margin;
        break;
      default:
        x = margin;
        y = margin + height;
    }

    return { x, y };
  }

  function calculateWatermarkImageSize(img, sizeOption) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    let width, height;

    switch (sizeOption) {
      case 'small':
        width = Math.min(img.width, canvasWidth * 0.15);
        height = (width / img.width) * img.height;
        break;
      case 'medium':
        width = Math.min(img.width, canvasWidth * 0.25);
        height = (width / img.width) * img.height;
        break;
      case 'large':
        width = Math.min(img.width, canvasWidth * 0.4);
        height = (width / img.width) * img.height;
        break;
      case 'custom':
        width = parseInt(document.getElementById('watermark-image-width')?.value) || 100;
        height = parseInt(document.getElementById('watermark-image-height')?.value) || 100;
        break;
      default:
        width = img.width;
        height = img.height;
    }

    return { width, height };
  }

  // ================================================================
  // Render sobre el canvas
  // ================================================================

  function captureConfig() {
    const sourceCanvas = AppState.canvas;
    const textEnabled = document.getElementById('watermark-text-enabled')?.checked || false;
    const imageEnabled = document.getElementById('watermark-image-enabled')?.checked || false;
    return {
      referenceWidth: sourceCanvas ? sourceCanvas.width : 0,
      referenceHeight: sourceCanvas ? sourceCanvas.height : 0,
      showPositioningBorders: AppState.showPositioningBorders,
      text: {
        enabled: textEnabled,
        value: document.getElementById('watermark-text')?.value.trim() || '',
        font: document.getElementById('watermark-font')?.value || 'Arial',
        color: document.getElementById('watermark-color')?.value || '#000000',
        size: parseInt(document.getElementById('watermark-size')?.value, 10) || 30,
        opacity: (parseInt(document.getElementById('watermark-opacity')?.value, 10) || 0) / 100,
        position: document.getElementById('watermark-position')?.value || 'center',
        autoScale: document.getElementById('watermark-auto-scale')?.checked || false,
        customPosition: AppState.customTextPosition ? { ...AppState.customTextPosition } : null
      },
      image: {
        enabled: imageEnabled,
        element: AppState.watermarkImagePreview,
        opacity: (parseInt(document.getElementById('watermark-image-opacity')?.value, 10) || 0) / 100,
        size: document.getElementById('watermark-image-size')?.value || 'medium',
        position: document.getElementById('watermark-image-position')?.value || 'center',
        customWidth: parseInt(document.getElementById('watermark-image-width')?.value, 10) || 100,
        customHeight: parseInt(document.getElementById('watermark-image-height')?.value, 10) || 100,
        customPosition: AppState.customImagePosition ? { ...AppState.customImagePosition } : null
      }
    };
  }

  function scaledCustomPosition(position, config, targetCanvas) {
    if (!position) return null;
    const sx = config.referenceWidth > 0 ? targetCanvas.width / config.referenceWidth : 1;
    const sy = config.referenceHeight > 0 ? targetCanvas.height / config.referenceHeight : 1;
    return { x: position.x * sx, y: position.y * sy };
  }

  function textPosition(config, textConfig, targetCanvas, width, height) {
    if (textConfig.position === 'custom') {
      const custom = scaledCustomPosition(textConfig.customPosition, config, targetCanvas);
      if (custom) return { x: custom.x - width / 2, y: custom.y };
    }
    const margin = 20;
    switch (textConfig.position) {
      case 'top-left': return { x: margin, y: margin + height };
      case 'top-center': return { x: (targetCanvas.width - width) / 2, y: margin + height };
      case 'top-right': return { x: targetCanvas.width - width - margin, y: margin + height };
      case 'center-left': return { x: margin, y: (targetCanvas.height + height) / 2 };
      case 'center': return { x: (targetCanvas.width - width) / 2, y: (targetCanvas.height + height) / 2 };
      case 'center-right': return { x: targetCanvas.width - width - margin, y: (targetCanvas.height + height) / 2 };
      case 'bottom-left': return { x: margin, y: targetCanvas.height - margin };
      case 'bottom-center': return { x: (targetCanvas.width - width) / 2, y: targetCanvas.height - margin };
      case 'bottom-right': return { x: targetCanvas.width - width - margin, y: targetCanvas.height - margin };
      default: return { x: (targetCanvas.width - width) / 2, y: (targetCanvas.height + height) / 2 };
    }
  }

  function imagePosition(config, imageConfig, targetCanvas, width, height) {
    if (imageConfig.position === 'custom') {
      const custom = scaledCustomPosition(imageConfig.customPosition, config, targetCanvas);
      if (custom) return { x: custom.x - width / 2, y: custom.y - height / 2 };
    }
    const margin = 20;
    switch (imageConfig.position) {
      case 'top-left': return { x: margin, y: margin };
      case 'top-center': return { x: (targetCanvas.width - width) / 2, y: margin };
      case 'top-right': return { x: targetCanvas.width - width - margin, y: margin };
      case 'center-left': return { x: margin, y: (targetCanvas.height - height) / 2 };
      case 'center': return { x: (targetCanvas.width - width) / 2, y: (targetCanvas.height - height) / 2 };
      case 'center-right': return { x: targetCanvas.width - width - margin, y: (targetCanvas.height - height) / 2 };
      case 'bottom-left': return { x: margin, y: targetCanvas.height - height - margin };
      case 'bottom-center': return { x: (targetCanvas.width - width) / 2, y: targetCanvas.height - height - margin };
      case 'bottom-right': return { x: targetCanvas.width - width - margin, y: targetCanvas.height - height - margin };
      default: return { x: (targetCanvas.width - width) / 2, y: (targetCanvas.height - height) / 2 };
    }
  }

  function renderConfig(targetCtx, targetCanvas, config, options = {}) {
    if (!targetCtx || !targetCanvas || !config) return { text: null, image: null };
    const bounds = { text: null, image: null };
    const drawBorders = options.showPositioningBorders !== undefined
      ? options.showPositioningBorders
      : config.showPositioningBorders;

    const textConfig = config.text || {};
    if (textConfig.enabled && textConfig.value) {
      let size = textConfig.size || 30;
      if (textConfig.autoScale && targetCanvas.width > 0) {
        size = Math.max(8, Math.round(size * (targetCanvas.width / 1000)));
      }
      targetCtx.save();
      targetCtx.font = size + 'px ' + (textConfig.font || 'Arial');
      targetCtx.fillStyle = textConfig.color || '#000000';
      targetCtx.globalAlpha = Number.isFinite(textConfig.opacity) ? textConfig.opacity : 0.5;
      targetCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      targetCtx.shadowBlur = 2;
      targetCtx.shadowOffsetX = 1;
      targetCtx.shadowOffsetY = 1;
      const width = targetCtx.measureText(textConfig.value).width;
      const position = textPosition(config, textConfig, targetCanvas, width, size);
      bounds.text = { x: position.x, y: position.y - size, width, height: size };
      targetCtx.fillText(textConfig.value, position.x, position.y);
      if (textConfig.position === 'custom' && drawBorders) {
        const hover = AppState.hoveredWatermark === 'text';
        targetCtx.globalAlpha = 1;
        targetCtx.strokeStyle = hover ? 'rgba(59, 130, 246, 0.95)' : 'rgba(59, 130, 246, 0.5)';
        targetCtx.lineWidth = hover ? 3 : 2;
        targetCtx.setLineDash([5, 5]);
        targetCtx.strokeRect(bounds.text.x - 5, bounds.text.y - 5, bounds.text.width + 10, bounds.text.height + 10);
      }
      targetCtx.restore();
    }

    const imageConfig = config.image || {};
    const image = imageConfig.element;
    if (imageConfig.enabled && image) {
      let width;
      let height;
      switch (imageConfig.size) {
        case 'small': width = Math.min(image.width, targetCanvas.width * 0.15); break;
        case 'medium': width = Math.min(image.width, targetCanvas.width * 0.25); break;
        case 'large': width = Math.min(image.width, targetCanvas.width * 0.4); break;
        case 'custom': width = imageConfig.customWidth; height = imageConfig.customHeight; break;
        default: width = image.width;
      }
      if (!height) height = (width / image.width) * image.height;
      const position = imagePosition(config, imageConfig, targetCanvas, width, height);
      bounds.image = { x: position.x, y: position.y, width, height };
      targetCtx.save();
      targetCtx.globalAlpha = Number.isFinite(imageConfig.opacity) ? imageConfig.opacity : 0.5;
      targetCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      targetCtx.shadowBlur = 4;
      targetCtx.shadowOffsetX = 2;
      targetCtx.shadowOffsetY = 2;
      targetCtx.drawImage(image, position.x, position.y, width, height);
      if (imageConfig.position === 'custom' && drawBorders) {
        const hover = AppState.hoveredWatermark === 'image';
        targetCtx.globalAlpha = 1;
        targetCtx.strokeStyle = hover ? 'rgba(245, 158, 11, 1)' : 'rgba(245, 158, 11, 0.7)';
        targetCtx.lineWidth = hover ? 4 : 3;
        targetCtx.setLineDash([8, 4]);
        targetCtx.strokeRect(bounds.image.x - 5, bounds.image.y - 5, bounds.image.width + 10, bounds.image.height + 10);
      }
      targetCtx.restore();
    }
    return bounds;
  }

  function measureCurrentTextBounds() {
    const targetCanvas = AppState.canvas;
    const targetCtx = AppState.ctx;
    const config = captureConfig();
    const textConfig = config.text;
    if (!targetCanvas || !targetCtx || !textConfig.enabled || !textConfig.value) return null;
    let size = textConfig.size || 30;
    if (textConfig.autoScale && targetCanvas.width > 0) {
      size = Math.max(8, Math.round(size * (targetCanvas.width / 1000)));
    }
    targetCtx.save();
    targetCtx.font = size + 'px ' + (textConfig.font || 'Arial');
    const width = targetCtx.measureText(textConfig.value).width;
    targetCtx.restore();
    const position = textPosition(config, textConfig, targetCanvas, width, size);
    return { x: position.x, y: position.y - size, width, height: size };
  }

  function applyWatermarkOptimized() {
    const canvas = AppState.canvas;
    const ctx = AppState.ctx;
    if (!canvas || !ctx) return;
    const config = captureConfig();
    if (config.image.enabled && !config.image.element) applyImageWatermarkOptimized();
    const bounds = renderConfig(ctx, canvas, config);
    AppState.textWatermarkBounds = bounds.text;
    AppState.imageWatermarkBounds = bounds.image;
  }

  function applyTextWatermarkOptimized() {
    const config = captureConfig();
    config.image.enabled = false;
    const bounds = renderConfig(AppState.ctx, AppState.canvas, config);
    AppState.textWatermarkBounds = bounds.text;
  }

  function applyImageWatermarkOptimized() {
    const input = document.getElementById('watermark-image');
    const file = input && input.files && input.files[0];
    if (!file) return;
    const fileKey = file.name + '|' + file.size + '|' + file.lastModified;
    if (cache.watermarkImage && cache.lastWatermarkFileKey === fileKey) {
      AppState.watermarkImagePreview = cache.watermarkImage;
      const config = captureConfig();
      config.text.enabled = false;
      const bounds = renderConfig(AppState.ctx, AppState.canvas, config);
      AppState.imageWatermarkBounds = bounds.image;
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const watermarkImg = new Image();
    watermarkImg.onload = function () {
      URL.revokeObjectURL(objectUrl);
      AppState.watermarkImagePreview = watermarkImg;
      cache.watermarkImage = watermarkImg;
      cache.lastWatermarkFileKey = fileKey;
      cache.lastWatermarkConfig = captureConfig();
      updatePreview();
    };
    watermarkImg.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      UIManager.showError('No se pudo cargar la imagen de la marca de agua. Comprueba que el archivo no esté corrupto.');
    };
    watermarkImg.src = objectUrl;
  }

  function drawCachedWatermark(watermarkImg, legacyConfig) {
    AppState.watermarkImagePreview = watermarkImg;
    const config = captureConfig();
    config.text.enabled = false;
    config.image.element = watermarkImg;
    if (legacyConfig) {
      config.image.opacity = parseInt(legacyConfig.opacity, 10) / 100;
      config.image.size = legacyConfig.size;
      config.image.position = legacyConfig.position;
    }
    const bounds = renderConfig(AppState.ctx, AppState.canvas, config);
    AppState.imageWatermarkBounds = bounds.image;
  }

  // ================================================================
  // Toggles de UI del formulario
  // ================================================================

  function toggleWatermarkType() {
    const textOptions = document.getElementById('text-watermark-options');
    const imageOptions = document.getElementById('image-watermark-options');
    const textEnabled = document.getElementById('watermark-text-enabled')?.checked;
    const imageEnabled = document.getElementById('watermark-image-enabled')?.checked;

    // Mostrar/ocultar opciones de texto
    if (textEnabled) {
      textOptions.classList.remove('watermark-options__text--hidden');
      textOptions.classList.add('watermark-options__text');
    } else {
      textOptions.classList.remove('watermark-options__text');
      textOptions.classList.add('watermark-options__text--hidden');
    }

    // Mostrar/ocultar opciones de imagen
    if (imageEnabled) {
      imageOptions.classList.remove('watermark-options__image');
      imageOptions.classList.add('watermark-options__image--visible');
    } else {
      imageOptions.classList.remove('watermark-options__image--visible');
      imageOptions.classList.add('watermark-options__image');
    }

    updatePreview();
  }

  function toggleCustomImageSize() {
    const sizeSelect = document.getElementById('watermark-image-size');
    const customSizeDiv = document.getElementById('watermark-image-custom-size');

    if (sizeSelect.value === 'custom') {
      customSizeDiv.classList.add('watermark-options__custom-size--visible');
      customSizeDiv.classList.remove('watermark-options__custom-size');
    } else {
      customSizeDiv.classList.remove('watermark-options__custom-size--visible');
      customSizeDiv.classList.add('watermark-options__custom-size');
    }

    updatePreview();
  }

  // ================================================================
  // Modos de posicionamiento personalizado
  // ================================================================

  // Funciones para posicionamiento personalizado de imagen
  function togglePositioningMode() {
    const positionSelect = document.getElementById('watermark-image-position');
    const customInfo = document.getElementById('custom-position-info');

    if (positionSelect.value === 'custom') {
      AppState.isPositioningMode = true;
      AppState.lastPositioningModeActivated = 'image'; // Registrar que imagen fue la última activada
      customInfo.style.display = 'block';

      // Agregar clase al canvas para el cursor
      if (canvas) {
        canvas.classList.add('positioning-mode');
        canvas.style.cursor = 'crosshair';

        // Actualizar clases según qué modos están activos
        updatePositioningClasses();
      }

      // Si no hay posición inicial, calcular el centro del canvas para empezar
      if (!customImagePosition && imageWatermarkBounds) {
        AppState.customImagePosition = {
          x: imageWatermarkBounds.x + imageWatermarkBounds.width / 2,
          y: imageWatermarkBounds.y + imageWatermarkBounds.height / 2
        };
      } else if (!customImagePosition && canvas) {
        AppState.customImagePosition = {
          x: canvas.width / 2,
          y: canvas.height / 2
        };
      }

      // Mostrar el marcador
      if (customImagePosition) {
        showPositionMarker();
      }

      // Hacer scroll suave hacia el canvas para que el usuario vea el área de trabajo
      setTimeout(() => {
        const previewContainer = document.querySelector('.preview-container');
        if (previewContainer) {
          previewContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      AppState.isPositioningMode = false;
      // Si este era el modo activo, limpiarlo
      if (lastPositioningModeActivated === 'image') {
        AppState.lastPositioningModeActivated = isTextPositioningMode ? 'text' : null;
      }
      customInfo.style.display = 'none';
      AppState.customImagePosition = null;

      // Quitar clase del canvas si no hay modo de texto activo
      if (canvas && !isTextPositioningMode) {
        canvas.classList.remove('positioning-mode', 'positioning-image', 'positioning-text', 'positioning-both');
        canvas.style.cursor = 'default';
      } else if (canvas) {
        updatePositioningClasses();
      }

      // Quitar marcador si existe
      removePositionMarker();
    }

    debouncedUpdatePreview();
  }

  // Función para posicionamiento personalizado de texto
  function toggleTextPositioningMode() {
    const positionSelect = document.getElementById('watermark-position');
    const customInfo = document.getElementById('custom-text-position-info');

    if (positionSelect.value === 'custom') {
      AppState.isTextPositioningMode = true;
      AppState.lastPositioningModeActivated = 'text'; // Registrar que texto fue el último activado
      customInfo.style.display = 'block';

      // Agregar clase al canvas para el cursor
      if (canvas) {
        canvas.classList.add('positioning-mode');
        canvas.style.cursor = 'crosshair';

        // Actualizar clases según qué modos están activos
        updatePositioningClasses();
      }

      // Si no hay posición inicial, calcular el centro del canvas para empezar
      if (!customTextPosition && textWatermarkBounds) {
        AppState.customTextPosition = {
          x: textWatermarkBounds.x + textWatermarkBounds.width / 2,
          y: textWatermarkBounds.y + textWatermarkBounds.height / 2
        };
      } else if (!customTextPosition && canvas) {
        AppState.customTextPosition = {
          x: canvas.width / 2,
          y: canvas.height / 2
        };
      }

      // Mostrar el marcador
      if (customTextPosition) {
        showTextPositionMarker();
      }

      // Hacer scroll suave hacia el canvas para que el usuario vea el área de trabajo
      setTimeout(() => {
        const previewContainer = document.querySelector('.preview-container');
        if (previewContainer) {
          previewContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      AppState.isTextPositioningMode = false;
      // Si este era el modo activo, limpiarlo
      if (lastPositioningModeActivated === 'text') {
        AppState.lastPositioningModeActivated = isPositioningMode ? 'image' : null;
      }
      customInfo.style.display = 'none';
      AppState.customTextPosition = null;

      // Quitar clase del canvas si no hay modo de imagen activo
      if (canvas && !isPositioningMode) {
        canvas.classList.remove('positioning-mode', 'positioning-image', 'positioning-text', 'positioning-both');
        canvas.style.cursor = 'default';
      } else if (canvas) {
        updatePositioningClasses();
      }

      // Quitar marcador si existe
      removeTextPositionMarker();
    }

    debouncedUpdatePreview();
  }

  // Función auxiliar para actualizar las clases del canvas según los modos activos
  function updatePositioningClasses() {
    if (!canvas) return;

    // Limpiar clases previas
    canvas.classList.remove('positioning-image', 'positioning-text', 'positioning-both');

    // Añadir clase según el estado actual
    if (isPositioningMode && isTextPositioningMode) {
      canvas.classList.add('positioning-both');
    } else if (isPositioningMode) {
      canvas.classList.add('positioning-image');
    } else if (isTextPositioningMode) {
      canvas.classList.add('positioning-text');
    }
  }

  // ================================================================
  // Marcadores DOM de posición personalizada
  // ================================================================

  function showPositionMarker() {
    if (!customImagePosition || !canvas) return;

    // Quitar marcador anterior si existe
    removePositionMarker();

    const contentRect = getCanvasContentRect();
    const container = canvas.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = contentRect.left - containerRect.left;
    const offsetTop = contentRect.top - containerRect.top;
    const scaleX = contentRect.width / canvas.width;
    const scaleY = contentRect.height / canvas.height;

    const marker = document.createElement('div');
    marker.className = 'custom-position-marker';
    marker.id = 'position-marker';

    const displayX = offsetLeft + customImagePosition.x * scaleX;
    const displayY = offsetTop + customImagePosition.y * scaleY;

    marker.style.left = displayX + 'px';
    marker.style.top = displayY + 'px';

    // Agregar al contenedor del canvas
    container.style.position = 'relative';
    container.appendChild(marker);
  }

  function removePositionMarker() {
    const marker = document.getElementById('position-marker');
    if (marker) {
      marker.remove();
    }
  }

  // Funciones para marcadores de posición de texto
  function showTextPositionMarker() {
    if (!customTextPosition || !canvas) return;

    // Quitar marcador anterior si existe
    removeTextPositionMarker();

    const contentRect = getCanvasContentRect();
    const container = canvas.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = contentRect.left - containerRect.left;
    const offsetTop = contentRect.top - containerRect.top;
    const scaleX = contentRect.width / canvas.width;
    const scaleY = contentRect.height / canvas.height;

    const marker = document.createElement('div');
    marker.className = 'custom-position-marker text-marker';
    marker.id = 'text-position-marker';
    marker.style.borderColor = '#3b82f6'; // Color azul para diferenciar del marcador de imagen

    const displayX = offsetLeft + customTextPosition.x * scaleX;
    const displayY = offsetTop + customTextPosition.y * scaleY;

    marker.style.left = displayX + 'px';
    marker.style.top = displayY + 'px';

    // Agregar al contenedor del canvas
    container.style.position = 'relative';
    container.appendChild(marker);
  }

  function removeTextPositionMarker() {
    const marker = document.getElementById('text-position-marker');
    if (marker) {
      marker.remove();
    }
  }

  // ========================================================================
  // SISTEMA DRAG & DROP para marcas de agua
  // ========================================================================

  /**
   * Detecta si un punto está dentro del texto de marca de agua
   */
  function isPointInText(x, y) {
    const bounds = textWatermarkBounds || measureCurrentTextBounds();
    if (!bounds) return false;
    if (!textWatermarkBounds) AppState.textWatermarkBounds = bounds;
    // El borde visible se dibuja 5 px por fuera del texto. Ese mismo borde
    // debe ser interactivo; además mantiene un objetivo usable cuando el
    // autoescalado reduce la tipografía a su mínimo de 8 px.
    const padding = Math.max(5, Math.min(12, bounds.height / 2));
    return x >= bounds.x - padding && x <= bounds.x + bounds.width + padding &&
           y >= bounds.y - padding && y <= bounds.y + bounds.height + padding;
  }

  /**
   * Detecta si un punto está dentro de la imagen de marca de agua
   */
  function isPointInImage(x, y) {
    if (!imageWatermarkBounds) return false;
    const bounds = imageWatermarkBounds;
    const padding = 5;
    return x >= bounds.x - padding && x <= bounds.x + bounds.width + padding &&
           y >= bounds.y - padding && y <= bounds.y + bounds.height + padding;
  }

  /**
   * Detecta si un punto está dentro de alguna capa de texto visible.
   * Recorre textLayerBounds en orden inverso (la capa pintada encima
   * tiene prioridad). Devuelve {layerId, bounds} o null.
   */
  function isPointInTextLayer(x, y) {
    for (let i = textLayerBounds.length - 1; i >= 0; i--) {
      const b = textLayerBounds[i];
      if (x >= b.x && x <= b.x + b.width &&
          y >= b.y && y <= b.y + b.height) {
        return b;
      }
    }
    return null;
  }

  /**
   * Maneja el inicio del arrastre (mousedown)
   */
  function handleDragStart(event) {
    // No interferir con el pan del zoom
    if (isZoomed) return;

    const rect = getCanvasContentRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // 1) Prioridad máxima: capas de texto (siempre arrastrables)
    const hitLayer = isPointInTextLayer(x, y);
    if (hitLayer) {
      AppState.isDragging = true;
      AppState.dragTarget = hitLayer; // { layerId, x, y, width, height }
      dragOffsetX = x - hitLayer.x;
      dragOffsetY = y - hitLayer.y;
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // 2) Watermarks en modo custom (lógica original)
    const textPosition = document.getElementById('watermark-position')?.value;
    const imagePosition = document.getElementById('watermark-image-position')?.value;
    const textInCustomMode = textPosition === 'custom';
    const imageInCustomMode = imagePosition === 'custom';

    if (!textInCustomMode && !imageInCustomMode) return;

    if (textInCustomMode && !customTextPosition && textWatermarkBounds) {
      AppState.customTextPosition = {
        x: textWatermarkBounds.x + textWatermarkBounds.width / 2,
        y: textWatermarkBounds.y + textWatermarkBounds.height
      };
    }
    if (imageInCustomMode && !customImagePosition && imageWatermarkBounds) {
      AppState.customImagePosition = {
        x: imageWatermarkBounds.x + imageWatermarkBounds.width / 2,
        y: imageWatermarkBounds.y + imageWatermarkBounds.height / 2
      };
    }

    if (textInCustomMode && isPointInText(x, y)) {
      AppState.isDragging = true;
      AppState.dragTarget = 'text';
      dragOffsetX = x - customTextPosition.x;
      dragOffsetY = y - customTextPosition.y;
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    } else if (imageInCustomMode && isPointInImage(x, y)) {
      AppState.isDragging = true;
      AppState.dragTarget = 'image';
      dragOffsetX = x - customImagePosition.x;
      dragOffsetY = y - customImagePosition.y;
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Maneja el movimiento del arrastre (mousemove)
   */
  function handleDragMove(event) {
    const rect = getCanvasContentRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    if (!isDragging) {
      // Hover cursor: capas de texto o watermarks
      let cursorSet = false;
      if (isPointInTextLayer(x, y)) {
        canvas.style.cursor = 'grab';
        cursorSet = true;
      }
      if (!cursorSet) {
        const textPosition = document.getElementById('watermark-position')?.value;
        const imagePosition = document.getElementById('watermark-image-position')?.value;
        let newHover = null;
        if (textPosition === 'custom' && isPointInText(x, y)) {
          newHover = 'text';
          canvas.style.cursor = 'grab';
        } else if (imagePosition === 'custom' && isPointInImage(x, y)) {
          newHover = 'image';
          canvas.style.cursor = 'grab';
        } else if (!cursorSet) {
          canvas.style.cursor = 'default';
        }
        if (newHover !== hoveredWatermark) {
          AppState.hoveredWatermark = newHover;
          updatePreview();
        }
      }
      return;
    }

    // Drag activo
    if (dragTarget && dragTarget.layerId) {
      // Arrastrando una capa de texto — render ligero (sin watermarks
      // ni filters) para evitar interferencias async y mantener 60 fps.
      const newX = x - dragOffsetX;
      const newY = y - dragOffsetY;
      const layer = textLayerManager.getLayer(dragTarget.layerId);
      if (layer) {
        layer.position.x = Math.round(newX);
        layer.position.y = Math.round(newY);
        TextLayerUIManager.renderLightweight();
      }
    } else if (dragTarget === 'text') {
      AppState.customTextPosition = { x: x - dragOffsetX, y: y - dragOffsetY };
      showTextPositionMarker();
      updatePreview();
    } else if (dragTarget === 'image') {
      AppState.customImagePosition = { x: x - dragOffsetX, y: y - dragOffsetY };
      showPositionMarker();
      updatePreview();
    }

    event.preventDefault();
  }

  /**
   * Maneja el fin del arrastre (mouseup)
   */
  function handleDragEnd(event) {
    if (isDragging) {
      AppState.isDragging = false;
      if (dragTarget && dragTarget.layerId) {
        // Era una capa de texto — render completo CON capas al soltar.
        // NO llamar a updatePreview() después porque sobreescribiría
        // el canvas sin las capas de texto (updatePreview no las pinta).
        TextLayerUIManager.render();
        UIManager.showSuccess('📝 Capa de texto reposicionada');
        if (AppState.activeLayerId === dragTarget.layerId) {
          TextLayerUIManager.select(dragTarget.layerId);
        }
        TextLayerUIManager.updateList();
      } else {
        // Era un watermark — updatePreview incluye watermarks pero no capas.
        const elementType = dragTarget === 'text' ? 'TEXTO' : 'IMAGEN';
        const emoji = dragTarget === 'text' ? '📝' : '🖼️';
        UIManager.showSuccess(emoji + ' ' + elementType + ' reposicionado correctamente');
        updatePreview();
      }
      AppState.dragTarget = null;
      canvas.style.cursor = 'default';
    }
  }

  /**
   * Maneja el inicio del arrastre táctil (touchstart)
   */
  function handleTouchStart(event) {
    // No interferir con el pan del zoom
    if (isZoomed && isPanning) return;

    // Solo si está en modo personalizado
    const textPosition = document.getElementById('watermark-position')?.value;
    const imagePosition = document.getElementById('watermark-image-position')?.value;

    const textInCustomMode = textPosition === 'custom';
    const imageInCustomMode = imagePosition === 'custom';

    if (!textInCustomMode && !imageInCustomMode) return;

    const touch = event.touches[0];
    const rect = getCanvasContentRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    // Prioridad: primero verificar texto, luego imagen
    if (textInCustomMode && isPointInText(x, y)) {
      AppState.isDragging = true;
      AppState.dragTarget = 'text';
      dragOffsetX = x - (customTextPosition?.x || textWatermarkBounds.x + textWatermarkBounds.width / 2);
      dragOffsetY = y - (customTextPosition?.y || textWatermarkBounds.y + textWatermarkBounds.height);
      event.preventDefault();
      event.stopPropagation();
    } else if (imageInCustomMode && isPointInImage(x, y)) {
      AppState.isDragging = true;
      AppState.dragTarget = 'image';
      dragOffsetX = x - (customImagePosition?.x || imageWatermarkBounds.x + imageWatermarkBounds.width / 2);
      dragOffsetY = y - (customImagePosition?.y || imageWatermarkBounds.y + imageWatermarkBounds.height / 2);
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Maneja el movimiento del arrastre táctil (touchmove)
   */
  function handleTouchMove(event) {
    if (!isDragging) return;

    const touch = event.touches[0];
    const rect = getCanvasContentRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    if (dragTarget === 'text') {
      AppState.customTextPosition = {
        x: x - dragOffsetX,
        y: y - dragOffsetY
      };
      showTextPositionMarker();
      updatePreview();
    } else if (dragTarget === 'image') {
      AppState.customImagePosition = {
        x: x - dragOffsetX,
        y: y - dragOffsetY
      };
      showPositionMarker();
      updatePreview();
    }

    event.preventDefault();
  }

  /**
   * Maneja el fin del arrastre táctil (touchend)
   */
  function handleTouchEnd(event) {
    if (isDragging) {
      AppState.isDragging = false;
      const elementType = dragTarget === 'text' ? 'TEXTO' : 'IMAGEN';
      const emoji = dragTarget === 'text' ? '📝' : '🖼️';
      UIManager.showSuccess(`${emoji} ${elementType} reposicionado correctamente`);
      AppState.dragTarget = null;

      // Render completo final tras el drag táctil (P2): aplica filtros y
      // saveState que se saltaron durante el arrastre.
      updatePreview();
    }
  }

  // ================================================================
  // Submit del formulario de watermark
  // ================================================================

  function handleWatermarkSubmit(e) {
    e.preventDefault();

    if (!currentImage) {
      showError('Por favor, selecciona una imagen primero.');
      return;
    }

    const form = e.target;
    const textEnabled = document.getElementById('watermark-text-enabled')?.checked;
    const imageEnabled = document.getElementById('watermark-image-enabled')?.checked;

    // Verificar que al menos una opción esté habilitada
    if (!textEnabled && !imageEnabled) {
      UIManager.showError('Debe habilitar al menos un tipo de marca de agua');
      return;
    }

    // Limpiar errores anteriores
    FormValidator.clearFormErrors('watermark-form');
    form.classList.add('form-loading');

    try {
      // Validar marca de agua de texto si está habilitada
      if (textEnabled) {
        const text = document.getElementById('watermark-text')?.value;
        const size = document.getElementById('watermark-size')?.value;
        const opacity = document.getElementById('watermark-opacity')?.value;

        // Validar marca de agua de texto
        const validation = SecurityManager.validateWatermarkText(text, size, opacity);

        if (!validation.isValid) {
          validation.errors.forEach(error => UIManager.showError(error));
          form.classList.remove('form-loading');
          return;
        }
      }

      // Validar marca de agua de imagen si está habilitada
      if (imageEnabled) {
        const watermarkImageInput = document.getElementById('watermark-image');
        if (!watermarkImageInput || !watermarkImageInput.files[0]) {
          UIManager.showWarning('No hay imagen de marca de agua seleccionada. Se aplicará solo el texto.');
        }
      }

      // Aplicar marca de agua
      updatePreview();

      setTimeout(() => {
        form.classList.remove('form-loading');
        UIManager.showSuccess('Marca de agua aplicada correctamente.');

        // v3.5.9: Guardar estado en el historial tras aplicar marca de agua
        if (typeof historyManager !== 'undefined') {
          historyManager.saveState();
        }
      }, 300);
    } catch (error) {
      form.classList.remove('form-loading');
      console.error('Error al aplicar marca de agua:', error);
      showError('Error al aplicar la marca de agua. Por favor, inténtalo de nuevo.');
    }
  }

  // ================================================================
  // API pública (mismos nombres que las funciones originales de main.js)
  // ================================================================

  return {
    setupWatermarkPersistence,
    restoreWatermarkState,
    clearWatermarkState,
    setupWatermarkSliderSync,
    handleWatermarkImageChange,
    getImageWatermarkPosition,
    getTextWatermarkPosition,
    getWatermarkPosition,
    calculateWatermarkImageSize,
    captureConfig,
    renderConfig,
    applyWatermarkOptimized,
    applyTextWatermarkOptimized,
    applyImageWatermarkOptimized,
    drawCachedWatermark,
    toggleWatermarkType,
    toggleCustomImageSize,
    togglePositioningMode,
    toggleTextPositioningMode,
    updatePositioningClasses,
    showPositionMarker,
    removePositionMarker,
    showTextPositionMarker,
    removeTextPositionMarker,
    isPointInText,
    isPointInImage,
    isPointInTextLayer,
    measureCurrentTextBounds,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWatermarkSubmit,
    clearCache
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.WatermarkManager;
}
