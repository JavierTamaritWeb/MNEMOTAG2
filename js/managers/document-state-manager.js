'use strict';

// Propietario de las transiciones del raster canónico. Las herramientas
// destructivas producen un nuevo CanvasImageSource y este manager lo confirma
// de forma atómica en AppState. Preview/export/lote pueden seguir tratando el
// canvas visible como una proyección descartable del documento.
window.DocumentStateManager = (function () {
  let dependencies = {};
  let loadSequence = 0;
  let documentSequence = 0;
  let documentEpoch = 0;
  let activeLoadToken = null;
  let mutationQueue = Promise.resolve();

  function configure(options) {
    dependencies = Object.assign({}, dependencies, options || {});
  }

  function setDocumentBusy(busy, reason) {
    AppState.transaction(function () {
      AppState.documentBusy = Boolean(busy);
      if (reason) AppState.mutationReason = reason;
    });
    const editor = typeof document !== 'undefined' ? document.getElementById('editor-container') : null;
    if (!editor) return;
    editor.inert = Boolean(busy);
    if (busy) editor.setAttribute('aria-busy', 'true');
    else editor.removeAttribute('aria-busy');
  }

  function createId(prefix, sequence) {
    return prefix + '-' + Date.now().toString(36) + '-' + sequence.toString(36);
  }

  function beginLoad() {
    loadSequence++;
    activeLoadToken = Object.freeze({
      id: createId('load', loadSequence),
      sequence: loadSequence
    });
    return activeLoadToken;
  }

  function isCurrentLoad(token) {
    return Boolean(token && activeLoadToken && token.id === activeLoadToken.id);
  }

  function cancelLoad(token) {
    if (!isCurrentLoad(token)) return false;
    loadSequence++;
    activeLoadToken = null;
    return true;
  }

  function clearDocument(options) {
    loadSequence++;
    documentEpoch++;
    activeLoadToken = null;
    AppState.transaction(function () {
      AppState.currentImage = null;
      AppState.currentFile = null;
      AppState.originalExtension = 'jpg';
      AppState.fileBaseName = 'imagen';
      AppState.originalWidth = 0;
      AppState.originalHeight = 0;
      AppState.transformResetImage = null;
      AppState.currentRotation = 0;
      AppState.isFlippedHorizontally = false;
      AppState.isFlippedVertically = false;
      AppState.documentId = null;
      AppState.documentRevision = 0;
      AppState.mutationReason = 'clear';
    });
    setDocumentBusy(false, 'clear');
    const target = options?.targetCanvas || AppState.canvas;
    const targetCtx = target && typeof target.getContext === 'function' ? target.getContext('2d') : null;
    if (targetCtx) targetCtx.clearRect(0, 0, target.width, target.height);
    if (options?.resetCanvasSize && target) {
      target.width = 0;
      target.height = 0;
    }
    return true;
  }

  function rasterSource(value) {
    if (!value) return null;
    return value.canvas || value.sourceImage || value.image || value;
  }

  function dimensionsOf(source, payload) {
    return {
      width: Number(payload?.width || source?.naturalWidth || source?.videoWidth || source?.width || 0),
      height: Number(payload?.height || source?.naturalHeight || source?.videoHeight || source?.height || 0)
    };
  }

  function assertRaster(source, payload) {
    const dimensions = dimensionsOf(source, payload);
    if (!source || !Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) ||
        dimensions.width <= 0 || dimensions.height <= 0) {
      throw new TypeError('DocumentStateManager: raster inválido o sin dimensiones');
    }
    return dimensions;
  }

  function boundedEditorDimensions(dimensions, payload) {
    const configuredMaxWidth = Number(payload?.maxWidth ||
      (typeof AppConfig !== 'undefined' && AppConfig.maxCanvasWidth) || dimensions.width);
    const configuredMaxHeight = Number(payload?.maxHeight ||
      (typeof AppConfig !== 'undefined' && AppConfig.maxCanvasHeight) || dimensions.height);
    if (dimensions.width <= configuredMaxWidth && dimensions.height <= configuredMaxHeight) {
      return dimensions;
    }
    const ratio = Math.min(configuredMaxWidth / dimensions.width, configuredMaxHeight / dimensions.height);
    return {
      width: Math.max(1, Math.round(dimensions.width * ratio)),
      height: Math.max(1, Math.round(dimensions.height * ratio))
    };
  }

  function ownRaster(source, dimensions, options) {
    if (options?.takeOwnership === true) return source;
    const owned = typeof dependencies.createCanvas === 'function'
      ? dependencies.createCanvas(dimensions.width, dimensions.height)
      : document.createElement('canvas');
    owned.width = dimensions.width;
    owned.height = dimensions.height;
    const ownedCtx = owned.getContext && owned.getContext('2d');
    if (!ownedCtx) throw new Error('DocumentStateManager: no se pudo crear el raster canónico');
    ownedCtx.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    if (options?.disposeSource && source && typeof source.close === 'function') {
      try { source.close(); } catch (error) { /* recurso ya liberado */ }
    }
    return owned;
  }

  function syncCanvas(source, dimensions, options) {
    if (options?.syncCanvas === false) return;
    const target = options?.targetCanvas || AppState.canvas;
    if (!target || typeof target.getContext !== 'function') return;
    if (target.width !== dimensions.width) target.width = dimensions.width;
    if (target.height !== dimensions.height) target.height = dimensions.height;
    const drawRasterOnly = function () {
      const targetCtx = target.getContext('2d');
      if (targetCtx) {
        targetCtx.clearRect(0, 0, target.width, target.height);
        targetCtx.drawImage(source, 0, 0, target.width, target.height);
      }
    };
    const render = options?.render || dependencies.render;
    try {
      if (typeof render === 'function') {
        render(source, target, options || {});
      } else if (typeof DocumentRenderer !== 'undefined' && DocumentRenderer.renderDocument) {
        const result = DocumentRenderer.renderDocument({ sourceImage: source }, target);
        if (result && result.rendered === false) throw new Error('Composición no renderizada');
      } else {
        drawRasterOnly();
      }
    } catch (error) {
      // El commit canónico ya es válido. Un fallo de una capa opcional no debe
      // dejar AppState confirmado y el canvas visible sin actualizar.
      if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
        console.warn('DocumentStateManager: fallback a raster sin composición', error);
      }
      drawRasterOnly();
    }
  }

  function currentSnapshot(extra) {
    return Object.assign({
      documentId: AppState.documentId,
      documentRevision: AppState.documentRevision,
      documentEpoch,
      sourceImage: AppState.currentImage,
      currentFile: AppState.currentFile,
      originalExtension: AppState.originalExtension,
      width: AppState.currentImage?.naturalWidth || AppState.currentImage?.width || AppState.originalWidth,
      height: AppState.currentImage?.naturalHeight || AppState.currentImage?.height || AppState.originalHeight
    }, extra || {});
  }

  function commitNewDocument(payload, token) {
    const inputSource = rasterSource(payload?.sourceImage || payload?.currentImage || payload?.image || payload?.canvas);
    const inputDimensions = assertRaster(inputSource, payload);
    // El documento de trabajo respeta el presupuesto configurado desde el
    // primer commit. Limitar solo el canvas visible dejaba un raster 8K de
    // hasta 256 MB retenido por historial, sesión y herramientas destructivas.
    const dimensions = boundedEditorDimensions(inputDimensions, payload);
    if (token && !isCurrentLoad(token)) return null;
    if (!token && activeLoadToken) token = activeLoadToken;
    const source = ownRaster(inputSource, dimensions, payload);

    documentSequence++;
    documentEpoch++;
    const documentId = payload?.documentId || createId('document', documentSequence);
    AppState.transaction(function () {
      AppState.currentImage = source;
      AppState.currentFile = payload?.file || payload?.currentFile || null;
      AppState.originalExtension = payload?.extension || payload?.originalExtension || 'jpg';
      if (payload?.fileBaseName) AppState.fileBaseName = payload.fileBaseName;
      AppState.originalWidth = dimensions.width;
      AppState.originalHeight = dimensions.height;
      AppState.transformResetImage = payload?.resetImage || source;
      AppState.currentRotation = Number.isFinite(payload?.rotation) ? payload.rotation : 0;
      AppState.isFlippedHorizontally = Boolean(payload?.isFlippedHorizontally);
      AppState.isFlippedVertically = Boolean(payload?.isFlippedVertically);
      AppState.documentId = documentId;
      AppState.documentRevision = Number.isSafeInteger(payload?.revision) ? payload.revision : 0;
      AppState.mutationReason = 'load';
    });
    setDocumentBusy(false, 'load');
    activeLoadToken = null;
    syncCanvas(source, dimensions, payload);
    const snapshot = currentSnapshot({ reason: 'load' });
    if (payload?.saveHistory !== false && typeof dependencies.onCommit === 'function') {
      dependencies.onCommit(snapshot);
    }
    return snapshot;
  }

  function matchesExpected(options) {
    if (Number.isSafeInteger(options?.expectedDocumentEpoch) &&
        options.expectedDocumentEpoch !== documentEpoch) return false;
    if (options?.expectedDocumentId && options.expectedDocumentId !== AppState.documentId) return false;
    if (Number.isSafeInteger(options?.expectedRevision) && options.expectedRevision !== AppState.documentRevision) {
      return false;
    }
    return true;
  }

  function commitRaster(value, options) {
    const inputSource = rasterSource(value);
    if (!matchesExpected(options)) {
      if (options?.takeOwnership && inputSource && typeof inputSource.getContext === 'function') {
        // El productor creó este canvas exclusivamente para el commit. Si la
        // revisión quedó obsoleta, liberar de inmediato su backing store evita
        // esperar al GC con varios megapíxeles nativos retenidos.
        inputSource.width = 0;
        inputSource.height = 0;
      } else if (options?.disposeSource && inputSource && typeof inputSource.close === 'function') {
        try { inputSource.close(); } catch (error) { /* recurso ya liberado */ }
      }
      return null;
    }
    const dimensions = assertRaster(inputSource, options || value);
    const source = ownRaster(inputSource, dimensions, options);
    const previousRevision = AppState.documentRevision;
    AppState.transaction(function () {
      AppState.currentImage = source;
      if (options?.file !== undefined) AppState.currentFile = options.file;
      if (options?.extension) AppState.originalExtension = options.extension;
      if (options?.updateOriginalDimensions !== false) {
        AppState.originalWidth = dimensions.width;
        AppState.originalHeight = dimensions.height;
      }
      if (options?.updateResetImage) AppState.transformResetImage = source;
      if (Number.isFinite(options?.rotation)) AppState.currentRotation = options.rotation;
      if (typeof options?.isFlippedHorizontally === 'boolean') {
        AppState.isFlippedHorizontally = options.isFlippedHorizontally;
      }
      if (typeof options?.isFlippedVertically === 'boolean') {
        AppState.isFlippedVertically = options.isFlippedVertically;
      }
      AppState.documentRevision = previousRevision + 1;
      AppState.mutationReason = options?.reason || 'raster';
    });
    syncCanvas(source, dimensions, options);
    const snapshot = currentSnapshot({
      reason: options?.reason || 'raster',
      restoredFromRevision: options?.restoredFromRevision
    });
    if (options?.saveHistory !== false && typeof dependencies.onCommit === 'function') {
      dependencies.onCommit(snapshot);
    }
    return snapshot;
  }

  function blobFromBytes(bytes, type) {
    if (bytes instanceof Blob) return bytes;
    return new Blob([bytes], { type: type || 'image/png' });
  }

  function loadBlobAsImage(blob) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo decodificar el raster guardado'));
      };
      image.src = url;
    });
  }

  async function sourceFromSnapshot(snapshot) {
    if (!snapshot) throw new TypeError('DocumentStateManager: snapshot vacío');
    if (snapshot.rasterBytes || snapshot.bytes || snapshot.blob) {
      return loadBlobAsImage(blobFromBytes(
        snapshot.rasterBytes || snapshot.bytes || snapshot.blob,
        snapshot.rasterType || snapshot.type
      ));
    }
    if (snapshot.bitmap && typeof createImageBitmap === 'function') {
      return createImageBitmap(snapshot.bitmap);
    }
    if (snapshot.imageData) {
      const response = await fetch(snapshot.imageData);
      return loadBlobAsImage(await response.blob());
    }
    const source = rasterSource(snapshot.sourceImage || snapshot.canvas || snapshot.image);
    if (!source) throw new TypeError('DocumentStateManager: snapshot sin raster');
    if (typeof createImageBitmap === 'function') return createImageBitmap(source);
    return source;
  }

  async function deserializeRaster(snapshot) {
    const decoded = await sourceFromSnapshot(snapshot);
    const dimensions = assertRaster(decoded, snapshot);
    return ownRaster(decoded, dimensions, { disposeSource: true });
  }

  async function restoreRaster(snapshot, options) {
    const source = await sourceFromSnapshot(snapshot);
    const commitOptions = Object.assign({}, options, {
      reason: options?.reason || 'restore',
      restoredFromRevision: snapshot?.documentRevision,
      width: snapshot?.canvasWidth || snapshot?.width,
      height: snapshot?.canvasHeight || snapshot?.height,
      rotation: snapshot?.rotation,
      isFlippedHorizontally: snapshot?.isFlippedHorizontally,
      isFlippedVertically: snapshot?.isFlippedVertically
    });
    return commitRaster(source, commitOptions);
  }

  function canvasFor(source) {
    const dimensions = assertRaster(source);
    if (typeof OffscreenCanvas === 'function') {
      return new OffscreenCanvas(dimensions.width, dimensions.height);
    }
    const result = document.createElement('canvas');
    result.width = dimensions.width;
    result.height = dimensions.height;
    return result;
  }

  async function serializeRaster(value) {
    const source = rasterSource(value || AppState.currentImage);
    const dimensions = assertRaster(source);
    let rasterCanvas = source;
    let ownsRasterCanvas = false;
    const isCanvas = typeof source.getContext === 'function' &&
      (typeof HTMLCanvasElement === 'undefined' || source instanceof HTMLCanvasElement ||
       (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas));
    if (!isCanvas) {
      rasterCanvas = canvasFor(source);
      ownsRasterCanvas = true;
      const rasterCtx = rasterCanvas.getContext('2d');
      rasterCtx.drawImage(source, 0, 0, dimensions.width, dimensions.height);
    }
    try {
      let blob;
      if (typeof rasterCanvas.convertToBlob === 'function') {
        blob = await rasterCanvas.convertToBlob({ type: 'image/png' });
      } else {
        blob = await new Promise((resolve, reject) => {
          rasterCanvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo serializar el raster')), 'image/png');
        });
      }
      return {
        rasterBytes: await blob.arrayBuffer(),
        rasterType: 'image/png',
        width: dimensions.width,
        height: dimensions.height,
        estimatedBytes: dimensions.width * dimensions.height * 4
      };
    } finally {
      if (ownsRasterCanvas) {
        rasterCanvas.width = 0;
        rasterCanvas.height = 0;
      }
    }
  }

  function enqueueRasterMutation(reason, producer, options) {
    if (typeof producer !== 'function') return Promise.reject(new TypeError('La mutación necesita un productor'));
    const requestedDocumentId = options?.expectedDocumentId || AppState.documentId;
    const requestedDocumentEpoch = documentEpoch;
    const job = mutationQueue.catch(function () {}).then(async function () {
      if (!requestedDocumentId || requestedDocumentId !== AppState.documentId ||
          requestedDocumentEpoch !== documentEpoch) return null;
      const baseRevision = AppState.documentRevision;
      const source = AppState.currentImage;
      if (!source) throw new Error('No hay un raster cargado');
      setDocumentBusy(true, reason || 'raster');
      try {
        const produced = await producer(source, {
          documentId: requestedDocumentId,
          documentRevision: baseRevision
        });
        return commitRaster(produced, Object.assign({}, options, {
          reason: reason || options?.reason || 'raster',
          expectedDocumentId: requestedDocumentId,
          expectedRevision: baseRevision,
          expectedDocumentEpoch: requestedDocumentEpoch
        }));
      } finally {
        if (requestedDocumentId === AppState.documentId && requestedDocumentEpoch === documentEpoch) {
          setDocumentBusy(false, reason || 'raster');
        }
      }
    });
    mutationQueue = job;
    return job;
  }

  function runExclusive(reason, operation, options) {
    if (typeof operation !== 'function') return Promise.reject(new TypeError('La operación exclusiva necesita un callback'));
    const requestedDocumentId = options?.expectedDocumentId || AppState.documentId;
    const requestedDocumentEpoch = documentEpoch;
    const job = mutationQueue.catch(function () {}).then(async function () {
      if (requestedDocumentEpoch !== documentEpoch ||
          (requestedDocumentId && requestedDocumentId !== AppState.documentId)) return null;
      const context = {
        documentId: AppState.documentId,
        documentRevision: AppState.documentRevision,
        documentEpoch: requestedDocumentEpoch
      };
      setDocumentBusy(true, reason || 'exclusive');
      try {
        return await operation(context);
      } finally {
        if (isContextCurrent(context)) setDocumentBusy(false, reason || 'exclusive');
      }
    });
    mutationQueue = job;
    return job;
  }

  function waitForIdle() {
    return mutationQueue.catch(function () {});
  }

  function isContextCurrent(context) {
    return Boolean(context && context.documentEpoch === documentEpoch &&
      context.documentId === AppState.documentId);
  }

  return {
    configure,
    beginLoad,
    commitNewDocument,
    enqueueRasterMutation,
    runExclusive,
    commitRaster,
    restoreRaster,
    serializeRaster,
    deserializeRaster,
    waitForIdle,
    isContextCurrent,
    isCurrentLoad,
    cancelLoad,
    clearDocument,
    snapshot: currentSnapshot
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.DocumentStateManager;
}
