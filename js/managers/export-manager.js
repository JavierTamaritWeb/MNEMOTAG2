'use strict';

// ===== EXPORT MANAGER (v3.4.10) =====
// Lógica de descarga/exportación de la imagen final. Las 3 funciones
// públicas son las que antes vivían en main.js:
//
//   - ExportManager.downloadImage()            — descarga single-file
//   - ExportManager.downloadImageWithProgress() — igual pero con progress bar
//   - ExportManager.downloadMultipleSizes()    — ZIP con varios tamaños
//
// Desde v3.7.1 el estado compartido se captura exclusivamente mediante
// AppState. Cada operación usa un snapshot coherente para no mezclar cambios
// de formato, calidad o nombre mientras el navegador codifica el archivo.
//
//   Helpers de main.js / helpers.js:
//     showError, showSuccess, showProgressBar, updateProgress,
//     hideProgressBar, simulateProgressSteps, getMimeType,
//     determineFallbackFormat, getFileExtension, getFlattenColor,
//     flattenCanvasForJpeg, canvasToBlob, hasImageAlphaChannel,
//     sanitizeFileBaseName
//
//   Managers globales:
//     MetadataManager, SecurityManager, UIManager
//
//   Librerías CDN:
//     JSZip (global)

window.ExportManager = (function () {

  // ── Helpers internos ──────────────────────────────────────────────────

  function readExportState() {
    return {
      canvas: AppState.canvas,
      currentImage: AppState.currentImage,
      currentFile: AppState.currentFile,
      fileBaseName: AppState.fileBaseName,
      outputFormat: AppState.outputFormat,
      outputQuality: AppState.outputQuality,
      lastDownloadDirectory: AppState.lastDownloadDirectory
    };
  }

  function renderExportDocument() {
    const canvas = AppState.canvas;
    if (!canvas) return false;
    return DocumentRenderer.renderDocument(
      DocumentRenderer.snapshot({ showPositioningBorders: AppState.showPositioningBorders }),
      canvas
    ).rendered;
  }

  /**
   * Avisa al usuario de que el navegador no pudo codificar el formato
   * solicitado y el archivo se ha exportado en otro formato (fallback).
   */
  function notifyFormatFallback(requestedMimeType, actualMimeType) {
    const requested = ((requestedMimeType || '').split('/')[1] || '').toUpperCase();
    const actual = ((actualMimeType || '').split('/')[1] || '').toUpperCase();
    MNEMOTAG_DEBUG && console.warn('Formato no soportado por el navegador: ' + requested + ' → ' + actual);
    UIManager.showWarning('El navegador no soporta ' + requested + '; se ha exportado como ' + actual);
  }

  /**
   * Mapea err.name a un mensaje accionable en español para los errores
   * de descarga. AbortError NO pasa por aquí (se silencia antes).
   */
  function downloadErrorMessage(error) {
    switch (error && error.name) {
      case 'NotAllowedError':
        return 'Permiso denegado para guardar el archivo. Revisa los permisos del navegador e inténtalo de nuevo.';
      case 'SecurityError':
        return 'El contexto no es seguro: la descarga requiere HTTPS o localhost.';
      case 'QuotaExceededError':
        return 'Espacio insuficiente para guardar la imagen. Libera espacio en disco e inténtalo de nuevo.';
      default:
        return 'Error al descargar la imagen.';
    }
  }

  /**
   * Muestra el error de descarga con botón "Reintentar" que relanza la
   * función de descarga correspondiente.
   */
  function showDownloadError(error, retryFn) {
    UIManager.showError(downloadErrorMessage(error), {
      category: 'download',
      action: { label: 'Reintentar', handler: () => retryFn() }
    });
  }

  /**
   * Extrae el MIME real de un dataURL ('data:image/png;base64,…' → 'image/png').
   * Devuelve null si no es un dataURL reconocible.
   */
  function dataUrlMimeType(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const end = dataUrl.indexOf(';');
    return end > 5 ? dataUrl.slice(5, end) : null;
  }

  /**
   * Recuerda el handle del último guardado exitoso para que startIn reabra
   * el diálogo en la misma ubicación (un FileSystemFileHandle es válido como
   * startIn). NUNCA pasar el resultado de queryPermission() como startIn
   * (regla del proyecto, bug 3.1.4).
   */
  function rememberDownloadLocation(handle) {
    try {
      AppState.lastDownloadDirectory = handle;
    } catch (err) {
      // La variable vive en main.js; en entornos de test puede no existir.
      MNEMOTAG_DEBUG && console.warn('No se pudo recordar la ubicación de descarga:', err);
    }
  }

  async function downloadMultipleSizes() {
    const { canvas, currentImage, fileBaseName, outputFormat, outputQuality } = readExportState();
    if (!canvas || !currentImage) {
      showError('No hay imagen para exportar.');
      return;
    }
    // Carga bajo demanda de JSZip (helpers.js): el <script> de CDN ya no
    // está en index.html. Si falla, el check siguiente informa al usuario.
    if (typeof ensureJSZip === 'function') {
      try { await ensureJSZip(); } catch (e) { /* el check siguiente informa */ }
    }
    if (typeof JSZip === 'undefined') {
      showError('JSZip no está cargado. No se puede generar el ZIP.');
      return;
    }

    // Recoger los anchos seleccionados
    const widths = ['multisize-2048', 'multisize-1024', 'multisize-512', 'multisize-256']
      .map(id => {
        const el = document.getElementById(id);
        return el && el.checked ? parseInt(el.value, 10) : null;
      })
      .filter(w => w !== null && !isNaN(w));

    if (widths.length === 0) {
      UIManager.showInfo('Marca al menos un tamaño para exportar.');
      return;
    }

    try {
      AppState.showPositioningBorders = false;
      renderExportDocument();

      const hasAlpha = hasImageAlphaChannel(canvas);
      const requestedMimeType = getMimeType(outputFormat);
      const finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      const finalFormat = finalMimeType.split('/')[1];
      const extension = getFileExtension(finalFormat);
      const flattenColor = getFlattenColor();

      MetadataManager.applyMetadataToImage(canvas);

      const basenameInput = document.getElementById('file-basename');
      const customBaseName = basenameInput ? basenameInput.value.trim() : '';
      let baseName = customBaseName || fileBaseName || 'imagen';
      if (!SecurityManager.isValidFileBaseName(baseName)) baseName = 'imagen';

      const zip = new JSZip();
      const sourceWidth = canvas.width;
      const sourceHeight = canvas.height;
      const aspectRatio = sourceHeight / sourceWidth;

      // Deduplicar los anchos EFECTIVOS: varios anchos seleccionados pueden
      // colapsar al mismo valor si superan el ancho de origen (Math.min),
      // lo que generaría nombres duplicados que JSZip sobrescribiría.
      const effectiveWidths = Array.from(new Set(widths.map(tw => Math.min(tw, sourceWidth))));
      if (effectiveWidths.length < widths.length) {
        MNEMOTAG_DEBUG && console.info('Anchos colapsados al ajustar al origen: ' + widths.length + ' → ' + effectiveWidths.length);
      }

      UIManager.showInfo('📦 Generando ZIP con ' + effectiveWidths.length + ' tamaños…');

      let formatFallbackWarned = false;

      for (const w of effectiveWidths) {
        const h = Math.round(w * aspectRatio);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(canvas, 0, 0, w, h);

        const sourceForExport = (finalMimeType === 'image/jpeg')
          ? flattenCanvasForJpeg(tempCanvas, flattenColor)
          : tempCanvas;

        let blob = await canvasToBlob(sourceForExport, finalMimeType, outputQuality);

        // Mismatch extensión/contenido: si canvasToBlob cayó al fallback,
        // blob.type refleja el formato REAL — usarlo para la extensión.
        let fileExtension = extension;
        if (blob && blob.type && blob.type !== finalMimeType) {
          fileExtension = getFileExtension(blob.type.split('/')[1]);
          if (!formatFallbackWarned) {
            notifyFormatFallback(finalMimeType, blob.type);
            formatFallbackWarned = true;
          }
        }

        blob = await MetadataManager.embedExifInJpegBlob(blob);
        blob = await MetadataManager.embedExifInPngBlob(blob);
        blob = await MetadataManager.embedExifInWebpBlob(blob);
        blob = await MetadataManager.embedExifInAvifBlob(blob); // v3.3.17

        zip.file(baseName + '-' + w + 'px.' + fileExtension, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = baseName + '-multisize.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('📦 ZIP con ' + effectiveWidths.length + ' tamaños descargado: ' + baseName + '-multisize.zip');
    } catch (err) {
      console.error('Error en downloadMultipleSizes:', err);
      showError('Error al generar el ZIP de varios tamaños: ' + (err.message || err));
    } finally {
      AppState.showPositioningBorders = true;
      renderExportDocument();
    }
  }

  async function downloadImage() {
    const {
      canvas,
      currentFile,
      fileBaseName,
      outputFormat,
      outputQuality,
      lastDownloadDirectory
    } = readExportState();
    if (!canvas) {
      showError('No hay imagen para descargar.');
      return;
    }

    if (!currentFile) {
      showError('Por favor, selecciona una imagen primero.');
      return;
    }

    try {
      AppState.showPositioningBorders = false;
      renderExportDocument();

      const hasAlpha = hasImageAlphaChannel(canvas);
      const requestedMimeType = getMimeType(outputFormat);
      // let (no const): si canvasToBlob/toDataURL caen a otro formato, se
      // reasignan con el MIME real para que extensión y contenido coincidan.
      let finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      let finalFormat = finalMimeType.split('/')[1];

      if (finalMimeType !== requestedMimeType) {
        const requestedFormat = outputFormat.toUpperCase();
        const actualFormat = finalFormat.toUpperCase();
        MNEMOTAG_DEBUG && console.info('Usando fallback: ' + requestedFormat + ' → ' + actualFormat + ' (mejor compatibilidad)');
        UIManager.showInfo('📄 Exportando en ' + actualFormat + ' para máxima compatibilidad (solicitado: ' + requestedFormat + ')');
      }

      const metadata = MetadataManager.getMetadata();
      MetadataManager.applyMetadataToImage(canvas);

      const basenameInput = document.getElementById('file-basename');
      const customBaseName = basenameInput ? basenameInput.value.trim() : '';
      const titleInput = document.getElementById('metaTitle');

      let filename = customBaseName || fileBaseName;

      if (!filename || filename === 'imagen') {
        filename = metadata.title || (titleInput ? titleInput.value.trim() : '') || 'imagen';
        filename = sanitizeFileBaseName(filename);
      }

      if (!SecurityManager.isValidFileBaseName(filename)) {
        MNEMOTAG_DEBUG && console.warn('⚠️ Nombre inválido, usando fallback:', filename);
        filename = 'imagen';
      }

      let extension = getFileExtension(finalFormat);

      // File System Access API cuando está disponible
      if ('showSaveFilePicker' in window) {
        try {
          // Generar el blob ANTES de abrir el diálogo: si el navegador no
          // codifica el formato pedido, canvasToBlob cae a JPEG y el nombre
          // sugerido y el tipo aceptado deben reflejar el contenido real.
          const flattenColor = getFlattenColor();
          if (finalMimeType === 'image/jpeg' && hasAlpha) {
            UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColor.toLowerCase() + ' para exportar a JPEG');
          }
          const sourceCanvas = (finalMimeType === 'image/jpeg')
            ? flattenCanvasForJpeg(canvas, flattenColor)
            : canvas;
          let blob = await canvasToBlob(sourceCanvas, finalMimeType, outputQuality);

          // Mismatch extensión/contenido: usar el tipo REAL del blob
          if (blob && blob.type && blob.type !== finalMimeType) {
            notifyFormatFallback(finalMimeType, blob.type);
            finalMimeType = blob.type;
            finalFormat = finalMimeType.split('/')[1];
            extension = getFileExtension(finalFormat);
          }

          blob = await MetadataManager.embedExifInJpegBlob(blob);
          blob = await MetadataManager.embedExifInPngBlob(blob);
          blob = await MetadataManager.embedExifInWebpBlob(blob);
          blob = await MetadataManager.embedExifInAvifBlob(blob);

          const options = {
            suggestedName: filename + '.' + extension,
            types: [{
              description: 'Imágenes',
              accept: {
                [finalMimeType]: ['.' + extension]
              }
            }],
            startIn: (typeof lastDownloadDirectory !== 'undefined' && lastDownloadDirectory) || 'desktop'
          };

          const handle = await window.showSaveFilePicker(options);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();

          // Recordar la ubicación para el próximo startIn
          rememberDownloadLocation(handle);

          const qualityText = finalFormat === 'png' ? '' : ' (calidad: ' + Math.round(outputQuality * 100) + '%)';
          showSuccess('Imagen guardada exitosamente en formato ' + finalFormat.toUpperCase() + qualityText + '!');
          return;
        } catch (saveError) {
          if (saveError.name === 'AbortError') {
            return;
          }
          MNEMOTAG_DEBUG && console.warn('Error con File System Access API, usando fallback:', saveError);
        }
      }

      // Fallback <a download>
      const link = document.createElement('a');
      const flattenColorFallback = getFlattenColor();
      if (finalMimeType === 'image/jpeg' && hasAlpha) {
        UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColorFallback.toLowerCase() + ' para exportar a JPEG');
      }
      const fallbackCanvas = (finalMimeType === 'image/jpeg')
        ? flattenCanvasForJpeg(canvas, flattenColorFallback)
        : canvas;
      const rawDataUrl = fallbackCanvas.toDataURL(finalMimeType, outputQuality);

      // toDataURL devuelve PNG silenciosamente si el formato no está
      // soportado: comprobar el MIME real y recalcular la extensión.
      const actualMime = dataUrlMimeType(rawDataUrl);
      if (actualMime && actualMime !== finalMimeType) {
        notifyFormatFallback(finalMimeType, actualMime);
        finalMimeType = actualMime;
        finalFormat = finalMimeType.split('/')[1];
        extension = getFileExtension(finalFormat);
      }
      link.download = filename + '.' + extension;

      let fallbackHref = MetadataManager.embedExifInJpegDataUrl(rawDataUrl);
      if (finalMimeType === 'image/png') {
        fallbackHref = await MetadataManager.embedExifInPngDataUrl(fallbackHref);
      } else if (finalMimeType === 'image/webp') {
        fallbackHref = await MetadataManager.embedExifInWebpDataUrl(fallbackHref);
      } else if (finalMimeType === 'image/avif') {
        fallbackHref = await MetadataManager.embedExifInAvifDataUrl(fallbackHref);
      }
      link.href = fallbackHref;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const qualityText = finalFormat === 'png' ? '' : ' (calidad: ' + Math.round(outputQuality * 100) + '%)';
      showSuccess('Imagen descargada en formato ' + finalFormat.toUpperCase() + qualityText + '!');

    } catch (error) {
      console.error('Error al descargar:', error);
      // AbortError = cancelación del usuario — se mantiene silencioso.
      if (error && error.name === 'AbortError') return;
      showDownloadError(error, downloadImage);
    } finally {
      AppState.showPositioningBorders = true;
      renderExportDocument();
    }
  }

  async function downloadImageWithProgress() {
    const {
      canvas,
      currentFile,
      fileBaseName,
      outputFormat,
      outputQuality,
      lastDownloadDirectory
    } = readExportState();
    if (!canvas) {
      showError('No hay imagen para descargar.');
      return;
    }

    if (!currentFile) {
      showError('Por favor, selecciona una imagen primero.');
      return;
    }

    try {
      AppState.showPositioningBorders = false;
      renderExportDocument();

      showProgressBar('Iniciando descarga...');

      const downloadSteps = [
        { message: 'Obteniendo metadatos...', duration: 400 },
        { message: 'Aplicando metadatos...', duration: 500 },
        { message: 'Generando nombre de archivo...', duration: 300 },
        { message: 'Configurando formato de salida...', duration: 400 },
        { message: 'Procesando imagen...', duration: 700 },
        { message: 'Generando archivo...', duration: 600 },
        { message: 'Iniciando descarga...', duration: 600 }
      ];

      const progressPromise = simulateProgressSteps(downloadSteps, 3500);

      const hasAlpha = hasImageAlphaChannel(canvas);
      const requestedMimeType = getMimeType(outputFormat);
      // let (no const): si canvasToBlob/toDataURL caen a otro formato, se
      // reasignan con el MIME real para que extensión y contenido coincidan.
      let finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      let finalFormat = finalMimeType.split('/')[1];

      if (finalMimeType !== requestedMimeType) {
        const requestedFormat = outputFormat.toUpperCase();
        const actualFormat = finalFormat.toUpperCase();
        MNEMOTAG_DEBUG && console.info('Usando fallback: ' + requestedFormat + ' → ' + actualFormat + ' (mejor compatibilidad)');
        UIManager.showInfo('📄 Exportando en ' + actualFormat + ' para máxima compatibilidad (solicitado: ' + requestedFormat + ')');
      }

      const metadata = MetadataManager.getMetadata();
      MetadataManager.applyMetadataToImage(canvas);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Resumen de metadatos (side-effect solo visual/log).
      if (metadata.title || metadata.author || metadata.copyright || metadata.latitude) {
        // Metadata presentes — no emitimos nada específico aquí, solo avanza.
      }

      await new Promise(resolve => setTimeout(resolve, 800));

      const basenameInput = document.getElementById('file-basename');
      const customBaseName = basenameInput ? basenameInput.value.trim() : '';

      let filename = customBaseName || fileBaseName;

      if (!filename || filename === 'imagen') {
        if (metadata.title && metadata.title.trim()) {
          filename = metadata.title.trim();
          filename = sanitizeFileBaseName(filename);
        } else if (currentFile && currentFile.name) {
          filename = currentFile.name.replace(/\.[^/.]+$/, '');
          filename = sanitizeFileBaseName(filename);
        } else {
          filename = 'imagen-editada';
        }
      }

      if (!SecurityManager.isValidFileBaseName(filename)) {
        MNEMOTAG_DEBUG && console.warn('⚠️ Nombre inválido en descarga con progreso, usando fallback');
        filename = 'imagen-editada';
      }

      let extension = getFileExtension(finalFormat);

      await new Promise(resolve => setTimeout(resolve, 900));
      await progressPromise;

      // Ocultar progress ANTES de abrir el diálogo de guardar
      hideProgressBar();

      if ('showSaveFilePicker' in window) {
        try {
          // Generar el blob ANTES de abrir el diálogo: si el navegador no
          // codifica el formato pedido, canvasToBlob cae a JPEG y el nombre
          // sugerido y el tipo aceptado deben reflejar el contenido real.
          const flattenColor = getFlattenColor();
          if (finalMimeType === 'image/jpeg' && hasAlpha) {
            UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColor.toLowerCase() + ' para exportar a JPEG');
          }
          const sourceCanvas = (finalMimeType === 'image/jpeg')
            ? flattenCanvasForJpeg(canvas, flattenColor)
            : canvas;
          let blob = await canvasToBlob(sourceCanvas, finalMimeType, outputQuality);

          // Mismatch extensión/contenido: usar el tipo REAL del blob
          if (blob && blob.type && blob.type !== finalMimeType) {
            notifyFormatFallback(finalMimeType, blob.type);
            finalMimeType = blob.type;
            finalFormat = finalMimeType.split('/')[1];
            extension = getFileExtension(finalFormat);
          }

          blob = await MetadataManager.embedExifInJpegBlob(blob);
          blob = await MetadataManager.embedExifInPngBlob(blob);
          blob = await MetadataManager.embedExifInWebpBlob(blob);
          blob = await MetadataManager.embedExifInAvifBlob(blob);

          const options = {
            suggestedName: filename + '.' + extension,
            types: [{
              description: 'Imágenes',
              accept: {
                [finalMimeType]: ['.' + extension]
              }
            }],
            startIn: (typeof lastDownloadDirectory !== 'undefined' && lastDownloadDirectory) || 'desktop'
          };

          const handle = await window.showSaveFilePicker(options);
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();

          // Recordar la ubicación para el próximo startIn
          rememberDownloadLocation(handle);

          hideProgressBar();

          const qualityText = finalFormat === 'png' ? '' : ' (calidad: ' + Math.round(outputQuality * 100) + '%)';
          showSuccess('Imagen guardada exitosamente en formato ' + finalFormat.toUpperCase() + qualityText + '!');
          return;
        } catch (saveError) {
          if (saveError.name === 'AbortError') {
            hideProgressBar();
            return;
          }
          MNEMOTAG_DEBUG && console.warn('Error con File System Access API, usando fallback:', saveError);
        }
      }

      const link = document.createElement('a');
      const flattenColorFallback = getFlattenColor();
      if (finalMimeType === 'image/jpeg' && hasAlpha) {
        UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColorFallback.toLowerCase() + ' para exportar a JPEG');
      }
      const fallbackCanvas = (finalMimeType === 'image/jpeg')
        ? flattenCanvasForJpeg(canvas, flattenColorFallback)
        : canvas;
      const rawDataUrlP = fallbackCanvas.toDataURL(finalMimeType, outputQuality);

      // toDataURL devuelve PNG silenciosamente si el formato no está
      // soportado: comprobar el MIME real y recalcular la extensión.
      const actualMimeP = dataUrlMimeType(rawDataUrlP);
      if (actualMimeP && actualMimeP !== finalMimeType) {
        notifyFormatFallback(finalMimeType, actualMimeP);
        finalMimeType = actualMimeP;
        finalFormat = finalMimeType.split('/')[1];
        extension = getFileExtension(finalFormat);
      }
      link.download = filename + '.' + extension;

      let fallbackHrefP = MetadataManager.embedExifInJpegDataUrl(rawDataUrlP);
      if (finalMimeType === 'image/png') {
        fallbackHrefP = await MetadataManager.embedExifInPngDataUrl(fallbackHrefP);
      } else if (finalMimeType === 'image/webp') {
        fallbackHrefP = await MetadataManager.embedExifInWebpDataUrl(fallbackHrefP);
      } else if (finalMimeType === 'image/avif') {
        fallbackHrefP = await MetadataManager.embedExifInAvifDataUrl(fallbackHrefP);
      }
      link.href = fallbackHrefP;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      hideProgressBar();

      const qualityText = finalFormat === 'png' ? '' : ' (calidad: ' + Math.round(outputQuality * 100) + '%)';
      showSuccess('Imagen descargada en formato ' + finalFormat.toUpperCase() + qualityText + '!');

    } catch (error) {
      console.error('Error al descargar:', error);
      hideProgressBar();
      // AbortError = cancelación del usuario — se mantiene silencioso.
      if (error && error.name === 'AbortError') return;
      showDownloadError(error, downloadImageWithProgress);
    } finally {
      AppState.showPositioningBorders = true;
      renderExportDocument();
    }
  }

  // ── Estimación en vivo del archivo final (v3.7.0) ────────────────────
  //
  // Codifica una sonda reducida del canvas (lado máx. 480px) con el formato
  // y calidad configurados y extrapola el peso por ratio de píxeles. Es una
  // estimación (se muestra con "≈"): la compresión no escala linealmente,
  // pero el orden de magnitud y el formato REAL (tras fallback) sí son
  // fiables. Debounced + token de secuencia para descartar sondas obsoletas.

  const ESTIMATE_PROBE_MAX_SIDE = 480;
  const ESTIMATE_DEBOUNCE_MS = 600;
  let estimateSeq = 0;
  let estimateTimer = null;

  function formatEstimateSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async function updateExportEstimate() {
    const { canvas, currentImage, outputFormat, outputQuality } = readExportState();
    const container = document.getElementById('export-estimate');
    const textEl = document.getElementById('export-estimate-text');
    if (!container || !textEl) return;

    if (!canvas || !currentImage ||
        canvas.width === 0 || canvas.height === 0) {
      container.hidden = true;
      return;
    }

    const seq = ++estimateSeq;
    try {
      // Sonda reducida: dibuja el canvas actual a escala.
      const scale = Math.min(1, ESTIMATE_PROBE_MAX_SIDE / Math.max(canvas.width, canvas.height));
      const probe = document.createElement('canvas');
      probe.width = Math.max(1, Math.round(canvas.width * scale));
      probe.height = Math.max(1, Math.round(canvas.height * scale));
      const probeCtx = probe.getContext('2d');
      if (!probeCtx) { container.hidden = true; return; }
      probeCtx.imageSmoothingEnabled = true;
      probeCtx.imageSmoothingQuality = 'high';
      probeCtx.drawImage(canvas, 0, 0, probe.width, probe.height);

      // Alpha y formato real (misma cadena de fallback que la descarga).
      const hasAlpha = hasImageAlphaChannel(probe);
      const requestedMime = getMimeType(outputFormat);
      const finalMime = await determineFallbackFormat(hasAlpha, requestedMime);
      if (seq !== estimateSeq) return; // sonda obsoleta

      const sourceForProbe = (finalMime === 'image/jpeg')
        ? flattenCanvasForJpeg(probe, getFlattenColor())
        : probe;
      const blob = await canvasToBlob(sourceForProbe, finalMime, outputQuality);
      if (seq !== estimateSeq) return;

      // El blob puede haber caído a otro formato (blob.type es la verdad).
      const realMime = (blob && blob.type) || finalMime;
      const realFormat = (realMime.split('/')[1] || '').toUpperCase();

      // Extrapolación por píxeles. PNG comprime sub-linealmente, así que el
      // valor es orientativo; para JPEG/WebP el ratio es razonablemente fiel.
      const ratio = (canvas.width * canvas.height) / (probe.width * probe.height);
      const estimatedBytes = blob.size * ratio;

      let text = '≈ ' + formatEstimateSize(estimatedBytes) + ' · ' +
                 canvas.width + '×' + canvas.height + ' px · ' + realFormat;
      if (realMime !== requestedMime) {
        text += ' (fallback de ' + (requestedMime.split('/')[1] || '').toUpperCase() + ')';
      }
      textEl.textContent = text;
      container.hidden = false;

      // Liberar backing stores de las sondas.
      probe.width = 0; probe.height = 0;
      if (sourceForProbe !== probe) { sourceForProbe.width = 0; sourceForProbe.height = 0; }
    } catch (err) {
      MNEMOTAG_DEBUG && console.warn('updateExportEstimate falló (se oculta la estimación):', err);
      if (seq === estimateSeq) container.hidden = true;
    }
  }

  /**
   * Versión debounced de updateExportEstimate — segura de llamar en cada
   * re-render del preview (solo codifica tras 600ms de calma).
   */
  function scheduleEstimateUpdate() {
    if (typeof document === 'undefined') return;
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
      estimateTimer = null;
      updateExportEstimate();
    }, ESTIMATE_DEBOUNCE_MS);
  }

  // ── Web Share API (v3.7.0) ────────────────────────────────────────────
  //
  // Comparte la imagen final (mismo pipeline que la descarga: bordes de
  // posicionamiento fuera, aplanado JPEG, EXIF embebido) mediante el share
  // sheet nativo. Pensado para móvil; el botón solo es visible si
  // Capabilities detectó navigator.canShare({files}). Si el share falla por
  // falta de soporte real, cae a la descarga normal.

  async function shareImage() {
    const { canvas, currentFile, fileBaseName, outputFormat, outputQuality } = readExportState();
    if (!canvas || !currentFile) {
      showError('No hay imagen para compartir.');
      return;
    }

    try {
      AppState.showPositioningBorders = false;
      renderExportDocument();

      const hasAlpha = hasImageAlphaChannel(canvas);
      const requestedMimeType = getMimeType(outputFormat);
      let finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      let finalFormat = finalMimeType.split('/')[1];

      const sourceCanvas = (finalMimeType === 'image/jpeg')
        ? flattenCanvasForJpeg(canvas, getFlattenColor())
        : canvas;
      let blob = await canvasToBlob(sourceCanvas, finalMimeType, outputQuality);
      if (blob && blob.type && blob.type !== finalMimeType) {
        finalMimeType = blob.type;
        finalFormat = finalMimeType.split('/')[1];
      }

      MetadataManager.applyMetadataToImage(canvas);
      blob = await MetadataManager.embedExifInJpegBlob(blob);
      blob = await MetadataManager.embedExifInPngBlob(blob);
      blob = await MetadataManager.embedExifInWebpBlob(blob);
      blob = await MetadataManager.embedExifInAvifBlob(blob);

      const basenameInput = document.getElementById('file-basename');
      const customBaseName = basenameInput ? basenameInput.value.trim() : '';
      let filename = customBaseName || fileBaseName || 'imagen';
      if (!SecurityManager.isValidFileBaseName(filename)) filename = 'imagen';
      const extension = getFileExtension(finalFormat);

      const shareFile = new File([blob], filename + '.' + extension, { type: finalMimeType });

      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: filename
        });
        showSuccess('Imagen compartida correctamente');
        return;
      }

      // Sin soporte real de share con archivos: fallback a descarga.
      UIManager.showInfo('Este navegador no permite compartir archivos; descargando en su lugar');
      await downloadImage();
    } catch (error) {
      // AbortError = el usuario cerró el share sheet — silencioso.
      if (error && error.name === 'AbortError') return;
      MNEMOTAG_DEBUG && console.warn('Web Share falló, cayendo a descarga:', error);
      try {
        await downloadImage();
      } catch (downloadError) {
        showError('No se pudo compartir ni descargar la imagen.');
      }
    } finally {
      AppState.showPositioningBorders = true;
      renderExportDocument();
    }
  }

  // v3.7.1: ExportManager consume el AppState observable — cualquier cambio
  // de formato/calidad de salida (venga del DOM, de resetOutputControls o de
  // una restauración de sesión) reprograma la estimación en vivo sin depender
  // de listeners DOM duplicados.
  if (typeof AppState !== 'undefined' && AppState && typeof AppState.subscribe === 'function') {
    AppState.subscribe('outputFormat', function () { scheduleEstimateUpdate(); });
    AppState.subscribe('outputQuality', function () { scheduleEstimateUpdate(); });
  }

  return {
    downloadImage: downloadImage,
    downloadImageWithProgress: downloadImageWithProgress,
    downloadMultipleSizes: downloadMultipleSizes,
    updateExportEstimate: updateExportEstimate,
    scheduleEstimateUpdate: scheduleEstimateUpdate,
    shareImage: shareImage
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ExportManager;
}
