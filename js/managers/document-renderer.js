'use strict';

// Compositor canónico de MnemoTag. Preview, export y batch proporcionan un
// snapshot de estado y comparten exactamente este orden de pintado:
// imagen filtrada -> marcas de agua -> capas de texto.
window.DocumentRenderer = (function () {
  function currentTextLayers() {
    const manager = typeof window !== 'undefined' ? window.textLayerManager : null;
    return manager && typeof manager.getAllLayers === 'function'
      ? manager.getAllLayers()
      : [];
  }

  function snapshot(overrides = {}) {
    const canvas = AppState.canvas;
    return Object.assign({
      sourceImage: AppState.currentImage,
      referenceWidth: canvas ? canvas.width : 0,
      referenceHeight: canvas ? canvas.height : 0,
      filterString: typeof FilterManager !== 'undefined' ? (FilterManager.getFilterString() || '') : '',
      watermarks: typeof WatermarkManager !== 'undefined' ? WatermarkManager.captureConfig() : null,
      textLayers: currentTextLayers(),
      watermarkMode: 'full',
      textLayerMode: 'full',
      showPositioningBorders: AppState.showPositioningBorders
    }, overrides);
  }

  function renderLightLayers(ctx, layers) {
    for (const layer of layers || []) {
      if (!layer || !layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
      const family = (layer.font && layer.font.family) || 'Roboto';
      const size = (layer.font && layer.font.size) || 40;
      const weight = (layer.font && layer.font.weight) || 'normal';
      ctx.font = weight + ' ' + size + 'px "' + family + '", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = layer.color || '#ffffff';
      ctx.fillText(layer.text || '', layer.position?.x || 0, layer.position?.y || 0);
      ctx.restore();
    }
  }

  function textBounds(ctx, layers, scaleX, scaleY) {
    const result = [];
    for (const layer of layers || []) {
      if (!layer || !layer.visible) continue;
      const family = (layer.font && layer.font.family) || 'Roboto';
      const size = (layer.font && layer.font.size) || 40;
      const weight = (layer.font && layer.font.weight) || 'normal';
      ctx.save();
      ctx.font = weight + ' ' + size + 'px "' + family + '", sans-serif';
      const metrics = ctx.measureText(layer.text || '');
      ctx.restore();
      result.push({
        layerId: layer.id,
        x: ((layer.position && layer.position.x) || 0) * scaleX,
        y: ((layer.position && layer.position.y) || 0) * scaleY,
        width: metrics.width * scaleX,
        height: size * 1.2 * scaleY
      });
    }
    return result;
  }

  function renderDocument(state = {}, targetCanvas = AppState.canvas) {
    const documentState = snapshot(state);
    const sourceImage = documentState.sourceImage;
    if (!sourceImage || !targetCanvas) return { rendered: false, watermarkBounds: null, textLayerBounds: [] };
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return { rendered: false, watermarkBounds: null, textLayerBounds: [] };

    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.filter = documentState.filterString || 'none';
    ctx.drawImage(sourceImage, 0, 0, targetCanvas.width, targetCanvas.height);
    ctx.restore();

    let watermarkBounds = { text: null, image: null };
    if (documentState.watermarkMode !== 'none' && documentState.watermarks) {
      watermarkBounds = WatermarkManager.renderConfig(
        ctx,
        targetCanvas,
        documentState.watermarks,
        { showPositioningBorders: Boolean(documentState.showPositioningBorders) }
      );
    }

    const layers = documentState.textLayers || [];
    const referenceWidth = documentState.referenceWidth || targetCanvas.width;
    const referenceHeight = documentState.referenceHeight || targetCanvas.height;
    const scaleX = targetCanvas.width / referenceWidth;
    const scaleY = targetCanvas.height / referenceHeight;
    if (documentState.textLayerMode !== 'none' && layers.length) {
      ctx.save();
      ctx.scale(scaleX, scaleY);
      const referenceCanvas = { width: referenceWidth, height: referenceHeight };
      if (documentState.textLayerMode === 'light') {
        renderLightLayers(ctx, layers);
      } else {
        TextLayerManager.renderLayerCollection(ctx, referenceCanvas, layers);
      }
      ctx.restore();
    }

    return {
      rendered: true,
      watermarkBounds,
      textLayerBounds: textBounds(ctx, layers, scaleX, scaleY)
    };
  }

  return { snapshot, renderDocument };
})();

// Contrato público pedido para integraciones y tests, sin duplicar lógica.
window.renderDocument = window.DocumentRenderer.renderDocument;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.DocumentRenderer;
}
