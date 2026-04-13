'use strict';

// ===== EXPORT MANAGER (v3.4.10) =====
// Lógica de descarga/exportación de la imagen final. Las 3 funciones
// públicas son las que antes vivían en main.js:
//
//   - ExportManager.downloadImage()            — descarga single-file
//   - ExportManager.downloadImageWithProgress() — igual pero con progress bar
//   - ExportManager.downloadMultipleSizes()    — ZIP con varios tamaños
//
// Todas estas funciones referencian helpers y estado que siguen
// viviendo en main.js por nombre global (mismo patrón que los otros
// managers extraídos en v3.4.7-v3.4.9):
//
//   Variables let de main.js:
//     canvas, ctx, currentImage, currentFile, fileBaseName,
//     outputFormat, outputQuality, showPositioningBorders,
//     lastDownloadDirectory
//
//   Helpers de main.js / helpers.js:
//     showError, showSuccess, showProgressBar, updateProgress,
//     hideProgressBar, simulateProgressSteps, getMimeType,
//     determineFallbackFormat, getFileExtension, getFlattenColor,
//     flattenCanvasForJpeg, canvasToBlob, hasImageAlphaChannel,
//     redrawCompleteCanvas, sanitizeFileBaseName
//
//   Managers globales:
//     MetadataManager, SecurityManager, UIManager
//
//   Librerías CDN:
//     JSZip (global)

window.ExportManager = (function () {

  async function downloadMultipleSizes() {
    if (typeof canvas === 'undefined' || !canvas || !currentImage) {
      showError('No hay imagen para exportar.');
      return;
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
      UIManager.showInfo('📦 Generando ZIP con ' + widths.length + ' tamaños…');
      showPositioningBorders = false;
      redrawCompleteCanvas();

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

      for (const targetWidth of widths) {
        const w = Math.min(targetWidth, sourceWidth);
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
        blob = await MetadataManager.embedExifInJpegBlob(blob);
        blob = await MetadataManager.embedExifInPngBlob(blob);
        blob = await MetadataManager.embedExifInWebpBlob(blob);
        blob = await MetadataManager.embedExifInAvifBlob(blob); // v3.3.17

        zip.file(baseName + '-' + w + 'px.' + extension, blob);
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

      showSuccess('📦 ZIP con ' + widths.length + ' tamaños descargado: ' + baseName + '-multisize.zip');
    } catch (err) {
      console.error('Error en downloadMultipleSizes:', err);
      showError('Error al generar el ZIP de varios tamaños: ' + (err.message || err));
    } finally {
      showPositioningBorders = true;
      redrawCompleteCanvas();
    }
  }

  async function downloadImage() {
    if (typeof canvas === 'undefined' || !canvas) {
      showError('No hay imagen para descargar.');
      return;
    }

    if (!currentFile) {
      showError('Por favor, selecciona una imagen primero.');
      return;
    }

    try {
      showPositioningBorders = false;
      redrawCompleteCanvas();

      const hasAlpha = hasImageAlphaChannel(canvas);
      const requestedMimeType = getMimeType(outputFormat);
      const finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      const finalFormat = finalMimeType.split('/')[1];

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

      const extension = getFileExtension(finalFormat);
      const fullFilename = filename + '.' + extension;

      // File System Access API cuando está disponible
      if ('showSaveFilePicker' in window) {
        const options = {
          suggestedName: fullFilename,
          types: [{
            description: 'Imágenes',
            accept: {
              [finalMimeType]: ['.' + extension]
            }
          }],
          startIn: (typeof lastDownloadDirectory !== 'undefined' && lastDownloadDirectory) || 'desktop'
        };

        try {
          const handle = await window.showSaveFilePicker(options);
          const writable = await handle.createWritable();

          const flattenColor = getFlattenColor();
          if (finalMimeType === 'image/jpeg' && hasAlpha) {
            UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColor.toLowerCase() + ' para exportar a JPEG');
          }
          const sourceCanvas = (finalMimeType === 'image/jpeg')
            ? flattenCanvasForJpeg(canvas, flattenColor)
            : canvas;
          let blob = await canvasToBlob(sourceCanvas, finalMimeType, outputQuality);
          blob = await MetadataManager.embedExifInJpegBlob(blob);
          blob = await MetadataManager.embedExifInPngBlob(blob);
          blob = await MetadataManager.embedExifInWebpBlob(blob);
          blob = await MetadataManager.embedExifInAvifBlob(blob);
          await writable.write(blob);
          await writable.close();

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
      link.download = fullFilename;
      const flattenColorFallback = getFlattenColor();
      if (finalMimeType === 'image/jpeg' && hasAlpha) {
        UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColorFallback.toLowerCase() + ' para exportar a JPEG');
      }
      const fallbackCanvas = (finalMimeType === 'image/jpeg')
        ? flattenCanvasForJpeg(canvas, flattenColorFallback)
        : canvas;
      let fallbackHref = MetadataManager.embedExifInJpegDataUrl(
        fallbackCanvas.toDataURL(finalMimeType, outputQuality)
      );
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
      showError('Error al descargar la imagen.');
    } finally {
      showPositioningBorders = true;
      redrawCompleteCanvas();
    }
  }

  async function downloadImageWithProgress() {
    if (typeof canvas === 'undefined' || !canvas) {
      showError('No hay imagen para descargar.');
      return;
    }

    if (!currentFile) {
      showError('Por favor, selecciona una imagen primero.');
      return;
    }

    try {
      showPositioningBorders = false;
      redrawCompleteCanvas();

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
      const finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
      const finalFormat = finalMimeType.split('/')[1];

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

      const extension = getFileExtension(finalFormat);
      const fullFilename = filename + '.' + extension;

      await new Promise(resolve => setTimeout(resolve, 900));
      await progressPromise;

      // Ocultar progress ANTES de abrir el diálogo de guardar
      hideProgressBar();

      if ('showSaveFilePicker' in window) {
        const options = {
          suggestedName: fullFilename,
          types: [{
            description: 'Imágenes',
            accept: {
              [finalMimeType]: ['.' + extension]
            }
          }],
          startIn: (typeof lastDownloadDirectory !== 'undefined' && lastDownloadDirectory) || 'desktop'
        };

        try {
          const handle = await window.showSaveFilePicker(options);
          const writable = await handle.createWritable();
          const flattenColor = getFlattenColor();
          if (finalMimeType === 'image/jpeg' && hasAlpha) {
            UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColor.toLowerCase() + ' para exportar a JPEG');
          }
          const sourceCanvas = (finalMimeType === 'image/jpeg')
            ? flattenCanvasForJpeg(canvas, flattenColor)
            : canvas;
          let blob = await canvasToBlob(sourceCanvas, finalMimeType, outputQuality);
          blob = await MetadataManager.embedExifInJpegBlob(blob);
          blob = await MetadataManager.embedExifInPngBlob(blob);
          blob = await MetadataManager.embedExifInWebpBlob(blob);
          blob = await MetadataManager.embedExifInAvifBlob(blob);
          await writable.write(blob);
          await writable.close();

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
      link.download = fullFilename;
      const flattenColorFallback = getFlattenColor();
      if (finalMimeType === 'image/jpeg' && hasAlpha) {
        UIManager.showInfo('🎨 Aplanando transparencia contra ' + flattenColorFallback.toLowerCase() + ' para exportar a JPEG');
      }
      const fallbackCanvas = (finalMimeType === 'image/jpeg')
        ? flattenCanvasForJpeg(canvas, flattenColorFallback)
        : canvas;
      let fallbackHrefP = MetadataManager.embedExifInJpegDataUrl(
        fallbackCanvas.toDataURL(finalMimeType, outputQuality)
      );
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
      showError('Error al descargar la imagen.');
    } finally {
      showPositioningBorders = true;
      redrawCompleteCanvas();
    }
  }

  return {
    downloadImage: downloadImage,
    downloadImageWithProgress: downloadImageWithProgress,
    downloadMultipleSizes: downloadMultipleSizes
  };
})();

// Export para uso modular (test runner Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.ExportManager;
}
