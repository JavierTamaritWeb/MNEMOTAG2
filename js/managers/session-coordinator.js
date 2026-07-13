'use strict';

window.SessionCoordinator = (function () {
  const stateVersion = 1;
  let dependencies = {};
  let textLayerManager = null;
  let initialized = false;

  function configure(options) {
    dependencies = options || {};
    textLayerManager = dependencies.textLayerManager || textLayerManager;
  }

  async function collectState() {
    const file = AppState.currentFile;
    if (!file || !AppState.currentImage) return null;
    const fileBytes = await file.arrayBuffer();
    const formState = {};
    document.querySelectorAll('#workspace-panel input[id], #workspace-panel select[id], #workspace-panel textarea[id]')
      .forEach(element => {
        const type = (element.type || '').toLowerCase();
        if (type === 'file') return;
        formState[element.id] = type === 'checkbox' || type === 'radio'
          ? { checked: element.checked }
          : { value: element.value };
      });
    return {
      version: stateVersion,
      savedAt: Date.now(),
      // WebKit puede rechazar File y Blob con UnknownError al persistirlos.
      // ArrayBuffer usa el algoritmo de clonación estructurada común a los
      // tres motores; el File se reconstruye al restaurar.
      fileBytes,
      fileName: file.name || 'imagen',
      fileType: file.type || 'application/octet-stream',
      fileLastModified: file.lastModified || Date.now(),
      formState,
      filters: typeof FilterManager !== 'undefined' ? { ...FilterManager.filters } : null,
      textLayers: textLayerManager ? textLayerManager.exportConfig() : null
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
    FilterManager.applyFiltersImmediate();
  }

  async function waitForImage(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (!AppState.currentImage && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!AppState.currentImage) throw new Error('La imagen de la sesión no terminó de cargar');
  }

  async function restore(saved) {
    if (!saved?.fileBytes && !saved?.file) return;
    try {
      SessionManager.setRestoring(true);
      const sourceFile = saved.file instanceof File
        ? saved.file
        : new File([saved.fileBytes || saved.file], saved.fileName || 'imagen', {
          type: saved.fileType || saved.file?.type || 'application/octet-stream',
          lastModified: saved.fileLastModified || saved.savedAt || Date.now()
        });
      dependencies.loadImage(sourceFile);
      await waitForImage(10000);
      await new Promise(resolve => setTimeout(resolve, 300));
      applyFormState(saved.formState);
      applyFilters(saved.filters);
      if (saved.textLayers && textLayerManager) await textLayerManager.importConfig(saved.textLayers);
      dependencies.updatePreview();
      UIManager.showSuccess('Sesión anterior restaurada');
    } catch (error) {
      console.error('No se pudo restaurar la sesión:', error);
      UIManager.showError('No se pudo restaurar la sesión anterior');
    } finally {
      SessionManager.setRestoring(false);
    }
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

  return { configure, collectState, applyFormState, restore, initialize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.SessionCoordinator;
