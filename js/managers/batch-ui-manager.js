'use strict';

window.BatchUIManager = (function () {
  let images = [];
  let processing = false;
  let batchManager = null;
  let textLayerManager = null;
  let dependencies = {};

  function configure(options) {
    dependencies = options || {};
    batchManager = dependencies.batchManager || batchManager;
    textLayerManager = dependencies.textLayerManager || textLayerManager;
  }

  function open() {
    const modal = document.getElementById('batch-modal');
    if (!modal) return;
    const limitInfo = document.getElementById('batch-limit-info');
    if (limitInfo) {
      limitInfo.textContent = 'Hasta ' + AppConfig.batchMaxImages + ' imágenes · Máx ' +
        Math.round(AppConfig.maxFileSize / 1048576) + ' MB cada una';
    }
    dependencies.openModal(modal, clear, 'display');
    setupDropzone();
  }

  function close() {
    const modal = document.getElementById('batch-modal');
    if (modal) dependencies.closeModal(modal);
  }

  function clear() {
    images.forEach(releasePreview);
    images = [];
    if (batchManager) batchManager.clearQueue();
    const downloadButton = document.getElementById('batch-download-btn');
    if (downloadButton) downloadButton.style.display = 'none';
    updateList();
  }

  function setupDropzone() {
    const dropzone = document.getElementById('batch-dropzone');
    const input = document.getElementById('batch-file-input');
    if (!dropzone || !input) return;
    if (dropzone.dataset.initialized === 'true') return;
    dropzone.dataset.initialized = 'true';
    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', event => {
      addImages(Array.from(event.target.files));
      input.value = '';
    });
    dropzone.addEventListener('dragover', event => {
      event.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', event => {
      event.preventDefault();
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', event => {
      event.preventDefault();
      dropzone.classList.remove('drag-over');
      addImages(Array.from(event.dataTransfer.files).filter(file => file.type.startsWith('image/')));
    });
  }

  async function addImages(files) {
    if (!batchManager) {
      UIManager.showError('El procesador de lotes no está inicializado');
      return;
    }
    const result = await batchManager.addImages(files);
    if (!result.success) {
      UIManager.showError(result.error);
      return;
    }
    result.rejected.forEach(rejected => {
      UIManager.showError((rejected.name || 'Archivo') + ': ' + rejected.reason);
    });
    for (const added of result.addedItems) {
      const queueItem = added.item;
      let previewUrl = null;
      if (added.previewBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(added.previewBlob);
      }
      images.push({
        id: queueItem.id,
        file: queueItem.file,
        name: queueItem.name,
        size: queueItem.size,
        width: queueItem.width,
        height: queueItem.height,
        previewUrl: previewUrl
      });
    }
    const downloadButton = document.getElementById('batch-download-btn');
    if (downloadButton) downloadButton.style.display = 'none';
    updateList();
  }

  function remove(imageId) {
    if (processing) {
      UIManager.showInfo('Cancela el procesamiento antes de quitar imágenes');
      return;
    }
    if (batchManager && !batchManager.removeImage(imageId)) return;
    const image = images.find(item => item.id === imageId);
    if (image) releasePreview(image);
    images = images.filter(image => image.id !== imageId);
    const downloadButton = document.getElementById('batch-download-btn');
    if (downloadButton) downloadButton.style.display = 'none';
    updateList();
  }

  function releasePreview(image) {
    if (!image || !image.previewUrl) return;
    URL.revokeObjectURL(image.previewUrl);
    image.previewUrl = null;
  }

  function appendStatus(info, image) {
    if (!image.status) return;
    const status = document.createElement('div');
    status.className = 'batch-item-status batch-item-status--' + image.status;
    status.textContent = {
      pendiente: 'Pendiente',
      procesando: 'Procesando…',
      ok: 'Procesada',
      error: 'Error',
      cancelada: 'Cancelada'
    }[image.status] || image.status;
    if (image.errorMsg) status.title = image.errorMsg;
    info.appendChild(status);
  }

  function actionButton(label, className, ariaLabel, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', handler);
    return button;
  }

  function createFallbackIcon() {
    const wrapper = document.createElement('div');
    wrapper.className = 'batch-item-icon';
    const icon = document.createElement('i');
    icon.className = 'fas fa-file-image';
    icon.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(icon);
    return wrapper;
  }

  function createPreview(image) {
    if (!image.previewUrl) return createFallbackIcon();
    const preview = document.createElement('img');
    preview.className = 'batch-item-thumbnail';
    preview.src = image.previewUrl;
    preview.alt = 'Miniatura de ' + image.name;
    preview.loading = 'lazy';
    preview.decoding = 'async';
    preview.draggable = false;
    preview.addEventListener('error', () => {
      releasePreview(image);
      preview.replaceWith(createFallbackIcon());
    }, { once: true });
    return preview;
  }

  function createItem(image) {
    const item = document.createElement('div');
    item.className = 'batch-item';
    item.appendChild(createPreview(image));

    const info = document.createElement('div');
    info.className = 'batch-item-info';
    const name = document.createElement('div');
    name.className = 'batch-item-name';
    name.textContent = image.name;
    const size = document.createElement('div');
    size.className = 'batch-item-size';
    size.textContent = (image.width && image.height ? image.width + '×' + image.height + ' · ' : '') + formatFileSize(image.size);
    info.append(name, size);
    appendStatus(info, image);
    item.appendChild(info);

    if (image.status === 'error' || image.status === 'cancelada') {
      item.appendChild(actionButton(
        image.status === 'cancelada' ? 'Procesar' : 'Reintentar',
        'batch-item-retry',
        'Reintentar ' + image.name,
        () => retry(image.id)
      ));
    }
    if (image.status === 'pendiente' && processing) {
      item.appendChild(actionButton('Cancelar', 'batch-item-retry batch-item-cancel', 'Cancelar ' + image.name, () => cancel(image.id)));
    }

    const removeButton = actionButton('', 'batch-item-remove', 'Quitar ' + image.name + ' del lote', () => remove(image.id));
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeIcon.setAttribute('aria-hidden', 'true');
    removeButton.appendChild(closeIcon);
    item.appendChild(removeButton);
    return item;
  }

  function updateList() {
    const list = document.getElementById('batch-images-list');
    const grid = document.getElementById('batch-items');
    if (!list || !grid) return;
    const config = document.getElementById('batch-config');
    const count = document.getElementById('batch-count');
    const processButton = document.getElementById('batch-process-btn');
    grid.replaceChildren(...images.map(createItem));
    if (processButton) processButton.disabled = images.length === 0;
    list.style.display = images.length ? 'block' : 'none';
    if (config) config.style.display = images.length ? 'block' : 'none';
    if (count) count.textContent = String(images.length);
    updateSummary();
  }

  function updateSummary() {
    const container = document.getElementById('batch-summary');
    const text = document.getElementById('batch-summary-text');
    if (!container || !text) return;
    if (!images.length || !batchManager) {
      container.style.display = 'none';
      return;
    }
    const summary = batchManager.summarizeItems(images);
    text.textContent = summary.count + (summary.count === 1 ? ' archivo' : ' archivos') +
      ' · ' + summary.megapixels.toFixed(1) + ' MP totales · ~' +
      formatFileSize(summary.estimatedDecodedBytes) + ' de memoria al decodificar · se procesarán de ' +
      (AppConfig.batchConcurrency || 2) + ' en ' + (AppConfig.batchConcurrency || 2);
    container.style.display = 'flex';
  }

  function cancel(imageId) {
    if (!batchManager || !batchManager.cancelImage(imageId)) return;
    const image = images.find(item => item.id === imageId);
    if (image?.status === 'pendiente') image.status = 'cancelada';
    updateList();
  }

  async function retry(imageId) {
    const image = images.find(item => item.id === imageId);
    if (!image || !batchManager) return;
    image.status = 'procesando';
    updateList();
    try {
      await batchManager.retryImage(imageId);
      image.status = 'ok';
      image.errorMsg = null;
      UIManager.showSuccess(image.name + ' procesada correctamente');
    } catch (error) {
      image.status = 'error';
      image.errorMsg = error.message;
      UIManager.showError('No se pudo procesar ' + image.name + ': ' + error.message, {
        action: { label: 'Reintentar', handler: () => retry(imageId) }
      });
    }
    updateList();
  }

  async function process() {
    if (!images.length) return UIManager.showError('Agrega imágenes al lote primero');
    const processButton = document.getElementById('batch-process-btn');
    const downloadButton = document.getElementById('batch-download-btn');
    if (processButton) processButton.disabled = true;
    if (downloadButton) downloadButton.style.display = 'none';
    images.forEach(image => { image.status = 'pendiente'; image.errorMsg = null; });
    processing = true;
    updateList();
    dependencies.showProgress('Procesando lote (' + images.length + ' imágenes)...', {
      onCancel: () => batchManager.requestCancel()
    });
    try {
      const applyOptions = {
        filters: document.getElementById('batch-apply-filters')?.checked !== false,
        watermarks: document.getElementById('batch-apply-watermarks')?.checked !== false,
        textLayers: document.getElementById('batch-apply-text-layers')?.checked !== false,
        metadata: document.getElementById('batch-apply-metadata')?.checked === true
      };
      if (applyOptions.watermarks) await WatermarkManager.ensureImageReady();
      batchManager.captureCurrentConfig(
        applyOptions.filters ? (FilterManager.getFilterString() || '') : '',
        applyOptions.watermarks ? WatermarkManager.captureConfig() : null,
        applyOptions.textLayers && textLayerManager ? textLayerManager.getAllLayers() : [],
        applyOptions.metadata ? MetadataManager.getMetadata() : null,
        applyOptions
      );
      const result = await batchManager.processQueue(progress => {
        dependencies.updateProgress(progress.percentage, 'Procesando imagen ' + progress.current + ' de ' + progress.total + '...');
        const image = images.find(item => item.id === progress.id);
        if (image) {
          image.status = progress.lastSuccess ? 'ok' : (progress.lastCancelled ? 'cancelada' : 'error');
          image.errorMsg = progress.lastSuccess || progress.lastCancelled ? null : progress.lastError;
        }
        updateList();
      });
      dependencies.hideProgress();
      if (result.cancelled) UIManager.showInfo('Lote cancelado: ' + result.processed + ' de ' + result.total + ' imágenes procesadas');
      else if (!result.failed) UIManager.showSuccess(result.processed + ' imágenes procesadas correctamente');
      if (downloadButton && result.processed > 0 && images.length > 0) {
        downloadButton.style.display = 'flex';
      }
    } catch (error) {
      dependencies.hideProgress();
      UIManager.showError('Error al procesar el lote: ' + error.message);
    } finally {
      processing = false;
      if (processButton) processButton.disabled = false;
      updateList();
    }
  }

  async function downloadZip() {
    try {
      dependencies.showProgress('Generando ZIP...');
      const steps = [
        { message: 'Recopilando imágenes procesadas...', duration: 600 },
        { message: 'Comprimiendo imágenes...', duration: 900 },
        { message: 'Generando archivo ZIP...', duration: 900 }
      ];
      const [, result] = await Promise.all([
        dependencies.simulateProgress(steps, 2400),
        batchManager.exportToZip(null, { skipDownload: true })
      ]);
      dependencies.hideProgress();
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: result.fileName,
            startIn: 'desktop',
            types: [{ description: 'Archivo ZIP', accept: { 'application/zip': ['.zip'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(result.blob);
          await writable.close();
        } catch (error) {
          if (error.name !== 'AbortError') throw error;
          return;
        }
      } else {
        batchManager.downloadBlob(result.blob, result.fileName);
      }
      UIManager.showSuccess('ZIP guardado correctamente (' + result.imageCount + ' imágenes)');
    } catch (error) {
      dependencies.hideProgress();
      UIManager.showError('Error al descargar el archivo ZIP');
    }
  }

  return { configure, open, close, clear, addImages, remove, updateList, process, downloadZip, retry, cancel };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.BatchUIManager;
