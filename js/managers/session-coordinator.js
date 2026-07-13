'use strict';

window.SessionCoordinator = (function () {
  const stateVersion = 2;
  let dependencies = {};
  let textLayerManager = null;
  let initialized = false;
  let restoreGeneration = 0;
  let collectSequence = 0;

  function configure(options) {
    dependencies = options || {};
    textLayerManager = dependencies.textLayerManager || textLayerManager;
  }

  function copyPosition(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: value.x, y: value.y }
      : null;
  }

  async function fileSnapshot(file) {
    if (!file) return null;
    return {
      bytes: await file.arrayBuffer(),
      name: file.name || 'imagen',
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified || Date.now()
    };
  }

  function cloneSerializable(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  async function collectWatermarkFile(preview) {
    if (!preview) return null;
    // La vista decodificada es el estado canónico. El FileList puede seguir
    // apuntando a una marca posterior después de undo/redo.
    const raster = await DocumentStateManager.serializeRaster(preview);
    return {
      bytes: raster.rasterBytes,
      name: 'marca-agua.png',
      type: raster.rasterType || 'image/png',
      lastModified: Date.now()
    };
  }

  function isCollectCurrent(sequence, documentId, documentRevision, source) {
    return sequence === collectSequence && documentId === AppState.documentId &&
      documentRevision === AppState.documentRevision && source === AppState.currentImage;
  }

  async function collectState() {
    const sequence = ++collectSequence;
    const file = AppState.currentFile;
    const source = AppState.currentImage;
    if (!file || !source || typeof DocumentStateManager === 'undefined') return null;
    const documentId = AppState.documentId;
    const documentRevision = AppState.documentRevision;
    const formState = {};
    document.querySelectorAll('#workspace-panel input[id], #workspace-panel select[id], #workspace-panel textarea[id]')
      .forEach(element => {
        const type = (element.type || '').toLowerCase();
        if (type === 'file') return;
        formState[element.id] = type === 'checkbox' || type === 'radio'
          ? { checked: element.checked }
          : { value: element.value };
      });

    // Capturar todo el estado síncrono antes de iniciar toBlob/arrayBuffer.
    // Leer parte después produciría una sesión híbrida entre dos instantes.
    const snapshot = {
      resetRasterSource: AppState.transformResetImage,
      watermarkPreview: AppState.watermarkImagePreview,
      filters: typeof FilterManager !== 'undefined' ? { ...FilterManager.filters } : null,
      textLayers: textLayerManager ? cloneSerializable(textLayerManager.exportConfig()) : null,
      transform: {
        rotation: AppState.currentRotation,
        isFlippedHorizontally: AppState.isFlippedHorizontally,
        isFlippedVertically: AppState.isFlippedVertically
      },
      positions: {
        image: copyPosition(AppState.customImagePosition),
        text: copyPosition(AppState.customTextPosition)
      },
      originalDimensions: {
        width: AppState.originalWidth,
        height: AppState.originalHeight
      }
    };

    // Serializar de forma secuencial: cada conversión puede necesitar un
    // canvas RGBA completo. Promise.all multiplicaba el pico nativo por tres.
    const originalFile = await fileSnapshot(file);
    if (!isCollectCurrent(sequence, documentId, documentRevision, source)) return null;
    const raster = await DocumentStateManager.serializeRaster(source);
    if (!isCollectCurrent(sequence, documentId, documentRevision, source)) return null;
    const resetRaster = snapshot.resetRasterSource && snapshot.resetRasterSource !== source
      ? await DocumentStateManager.serializeRaster(snapshot.resetRasterSource)
      : null;
    if (!isCollectCurrent(sequence, documentId, documentRevision, source)) return null;
    const watermarkFile = await collectWatermarkFile(snapshot.watermarkPreview);
    // Una mutación durante la serialización produciría una sesión híbrida.
    // Se rechaza para conservar el último registro coherente de IndexedDB.
    if (sequence !== collectSequence || documentId !== AppState.documentId ||
        documentRevision !== AppState.documentRevision || source !== AppState.currentImage) return null;
    return {
      version: stateVersion,
      savedAt: Date.now(),
      documentId,
      documentRevision,
      // Campos v1 conservados para migración inversa y diagnóstico.
      fileBytes: originalFile.bytes,
      fileName: originalFile.name,
      fileType: originalFile.type,
      fileLastModified: originalFile.lastModified,
      raster,
      resetRaster,
      formState,
      filters: snapshot.filters,
      textLayers: snapshot.textLayers,
      transform: snapshot.transform,
      positions: snapshot.positions,
      originalDimensions: snapshot.originalDimensions,
      watermarkFile
    };
  }

  function applyFormState(formState) {
    if (!formState) return;
    Object.entries(formState).forEach(([id, saved]) => {
      const element = document.getElementById(id);
      if (!element || !saved) return;
      try {
        if (typeof saved.checked === 'boolean' && element.checked !== saved.checked) {
          element.checked = saved.checked;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (typeof saved.value === 'string' && element.value !== saved.value) {
          element.value = saved.value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (error) {
        if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
          console.warn('SessionCoordinator: no se pudo restaurar ' + id, error);
        }
      }
    });
  }

  function applyFilters(filters) {
    if (!filters || typeof FilterManager === 'undefined') return;
    Object.keys(FilterManager.filters).forEach(key => {
      if (filters[key] === undefined) return;
      FilterManager.filters[key] = filters[key];
      FilterManager.updateFilterDisplay(key, filters[key]);
      const slider = document.getElementById(key);
      if (slider) slider.value = filters[key];
    });
    if (typeof FilterManager.applyFiltersImmediate === 'function') FilterManager.applyFiltersImmediate();
  }

  function sourceFileFrom(saved) {
    if (saved.file instanceof File) return saved.file;
    const bytes = saved.fileBytes || saved.file;
    if (!bytes) return null;
    return new File([bytes], saved.fileName || 'imagen', {
      type: saved.fileType || saved.file?.type || 'application/octet-stream',
      lastModified: saved.fileLastModified || saved.savedAt || Date.now()
    });
  }

  function assertRestoreCurrent(file, generation) {
    if (generation !== restoreGeneration || AppState.currentFile !== file) {
      throw new Error('La sesión ya no corresponde al documento activo');
    }
  }

  function assertRestoreContext(file, generation, context) {
    assertRestoreCurrent(file, generation);
    if (context && typeof DocumentStateManager.isContextCurrent === 'function' &&
        !DocumentStateManager.isContextCurrent(context)) {
      throw new Error('El documento cambió durante la restauración de sesión');
    }
  }

  function releaseTemporaryRaster(source) {
    if (!source) return;
    if (typeof source.close === 'function') {
      try { source.close(); } catch (error) { /* recurso ya liberado */ }
    } else if (typeof source.getContext === 'function') {
      source.width = 0;
      source.height = 0;
    }
  }

  async function restoreWatermark(savedFile, sourceFile, generation, context) {
    if (!savedFile?.bytes) return;
    const file = new File([savedFile.bytes], savedFile.name || 'marca.png', {
      type: savedFile.type || 'image/png',
      lastModified: savedFile.lastModified || Date.now()
    });
    let decoded = await DocumentStateManager.deserializeRaster({
      rasterBytes: savedFile.bytes,
      rasterType: savedFile.type || 'image/png'
    });
    if (typeof WatermarkManager !== 'undefined' && WatermarkManager.normalizeResidentImage) {
      const normalized = WatermarkManager.normalizeResidentImage(decoded);
      if (normalized !== decoded) releaseTemporaryRaster(decoded);
      decoded = normalized;
    }
    try {
      assertRestoreContext(sourceFile, generation, context);
      if (typeof WatermarkManager !== 'undefined' && WatermarkManager.clearCache) {
        WatermarkManager.clearCache();
      }
      assertRestoreContext(sourceFile, generation, context);
      AppState.watermarkImagePreview = decoded;
    } catch (error) {
      releaseTemporaryRaster(decoded);
      throw error;
    }
    const input = document.getElementById('watermark-image');
    if (input && typeof DataTransfer === 'function') {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    }
    const label = document.getElementById('watermark-file-label');
    if (label) label.textContent = file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name;
    document.getElementById('watermark-upload-label')?.classList.add('watermark-loaded');
  }

  async function restore(saved) {
    const sourceFile = sourceFileFrom(saved || {});
    if (!sourceFile) return false;
    const generation = ++restoreGeneration;
    try {
      SessionManager.setRestoring(true);
      await SessionManager.waitForIdle();
      const loadResult = await dependencies.loadImage(sourceFile, null, { sessionRestore: true });
      if (!loadResult?.committed) throw new Error('La imagen de la sesión no terminó de cargar');
      assertRestoreCurrent(sourceFile, generation);

      const restoredPhase = await DocumentStateManager.runExclusive(
        'session-restore',
        async function (context) {
          let restoredRaster = null;
          let restoredBaseline = null;
          try {
            // Decodificar todos los rasteres antes del primer commit para que
            // una entrada dañada no deje media sesión aplicada.
            if (saved.raster) {
              restoredRaster = await DocumentStateManager.deserializeRaster(saved.raster);
              assertRestoreContext(sourceFile, generation, context);
            }
            if (saved.resetRaster) {
              restoredBaseline = await DocumentStateManager.deserializeRaster(saved.resetRaster);
              assertRestoreContext(sourceFile, generation, context);
            }

            if (restoredRaster) {
              const restored = DocumentStateManager.commitRaster(restoredRaster, {
                reason: 'session',
                saveHistory: false,
                takeOwnership: true,
                expectedDocumentId: context.documentId || undefined,
                expectedRevision: context.documentRevision,
                expectedDocumentEpoch: context.documentEpoch,
                rotation: saved.transform?.rotation || 0,
                isFlippedHorizontally: Boolean(saved.transform?.isFlippedHorizontally),
                isFlippedVertically: Boolean(saved.transform?.isFlippedVertically),
                updateOriginalDimensions: false
              });
              if (!restored) throw new Error('El documento cambió mientras se restauraba el raster');
              restoredRaster = null;
            }
            assertRestoreContext(sourceFile, generation, context);

            AppState.transaction(function () {
              AppState.transformResetImage = restoredBaseline || AppState.currentImage;
              AppState.currentRotation = saved.transform?.rotation || 0;
              AppState.isFlippedHorizontally = Boolean(saved.transform?.isFlippedHorizontally);
              AppState.isFlippedVertically = Boolean(saved.transform?.isFlippedVertically);
              AppState.originalWidth = Number(saved.originalDimensions?.width) || AppState.currentImage.width;
              AppState.originalHeight = Number(saved.originalDimensions?.height) || AppState.currentImage.height;
              AppState.customImagePosition = copyPosition(saved.positions?.image);
              AppState.customTextPosition = copyPosition(saved.positions?.text);
            });
            restoredBaseline = null;

            try {
              await restoreWatermark(saved.watermarkFile, sourceFile, generation, context);
            } catch (watermarkError) {
              if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
                console.warn('SessionCoordinator: no se restauró la marca de agua', watermarkError);
              }
            }
            assertRestoreContext(sourceFile, generation, context);
            applyFormState(saved.formState);
            applyFilters(saved.filters);
            if (saved.textLayers && textLayerManager) {
              try {
                await textLayerManager.importConfig(saved.textLayers, {
                  isCurrent: function () {
                    try {
                      assertRestoreContext(sourceFile, generation, context);
                      return true;
                    } catch (error) {
                      return false;
                    }
                  }
                });
              } catch (layerError) {
                if (typeof MNEMOTAG_DEBUG !== 'undefined' && MNEMOTAG_DEBUG) {
                  console.warn('SessionCoordinator: no se restauraron las capas de texto', layerError);
                }
              }
            }
            assertRestoreContext(sourceFile, generation, context);
            dependencies.updatePreview();
            if (typeof historyManager !== 'undefined') {
              historyManager.clear();
              await historyManager.saveState();
              assertRestoreContext(sourceFile, generation, context);
            }
            return true;
          } finally {
            releaseTemporaryRaster(restoredRaster);
            releaseTemporaryRaster(restoredBaseline);
          }
        },
        { expectedDocumentId: AppState.documentId }
      );
      if (!restoredPhase) throw new Error('El documento cambió antes de restaurar la sesión');
      UIManager.showSuccess('Sesión anterior restaurada');
      return true;
    } catch (error) {
      if (generation === restoreGeneration) {
        console.error('No se pudo restaurar la sesión:', error);
        UIManager.showError('No se pudo restaurar la sesión anterior');
      }
      return false;
    } finally {
      if (generation === restoreGeneration) SessionManager.setRestoring(false);
    }
  }

  function cancelRestore() {
    restoreGeneration++;
    SessionManager.setRestoring(false);
  }

  function scheduleFromForm(event) {
    if (!AppState.currentImage || !event.target?.closest) return;
    if (event.target.closest('#workspace-panel')) SessionManager.scheduleAutoSave();
  }

  async function initialize() {
    if (initialized || !SessionManager.isSupported()) return;
    initialized = true;
    SessionManager.configureAutoSave(collectState);
    document.addEventListener('input', scheduleFromForm, true);
    document.addEventListener('change', scheduleFromForm, true);
    const saved = await SessionManager.load();
    if ((!saved?.fileBytes && !saved?.file) || AppState.currentImage) return;
    const savedDate = new Date(saved.savedAt);
    const time = String(savedDate.getHours()).padStart(2, '0') + ':' +
      String(savedDate.getMinutes()).padStart(2, '0');
    UIManager.showInfo('Hay una sesión guardada de "' + (saved.fileName || 'imagen') + '" (' + time + ').', {
      duration: 15000,
      action: { label: 'Restaurar', handler: () => restore(saved) }
    });
  }

  return {
    configure,
    collectState,
    applyFormState,
    restore,
    cancelRestore,
    initialize,
    stateVersion
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.SessionCoordinator;
