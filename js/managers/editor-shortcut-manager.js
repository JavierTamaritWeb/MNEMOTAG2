'use strict';

window.EditorShortcutManager = (function () {
  const categories = ['Edición', 'Archivo', 'Herramientas', 'Vista', 'Otros'];
  let shortcuts = null;
  let dependencies = {};
  let spaceHeld = false;

  function configure(options) {
    dependencies = options || {};
    shortcuts = dependencies.keyboardShortcuts || shortcuts;
  }

  function call(name, ...args) {
    if (typeof dependencies[name] === 'function') return dependencies[name](...args);
  }

  async function copyCanvasToClipboard() {
    const canvas = AppState.canvas;
    if (!canvas || !navigator.clipboard?.write) throw new Error('API de portapapeles no disponible');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo codificar el canvas');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  function showOriginalImage() {
    const canvas = AppState.canvas;
    const context = AppState.ctx;
    const image = AppState.currentImage;
    if (!canvas || !context || !image) return;
    canvas.style.transition = 'none';
    canvas.style.filter = '';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  function registerCoreShortcuts() {
    shortcuts.register('z', ['ctrl'], () => {
      if (historyManager?.canUndo()) {
        historyManager.undo();
        UIManager.showSuccess('Deshecho');
      }
    }, { description: 'Deshacer última acción', category: 'Edición' });
    shortcuts.register('z', ['ctrl', 'shift'], () => {
      if (historyManager?.canRedo()) {
        historyManager.redo();
        UIManager.showSuccess('Rehecho');
      }
    }, { description: 'Rehacer acción', category: 'Edición' });
    shortcuts.register('s', ['ctrl'], () => {
      if (AppState.currentImage) return ExportManager.downloadImageWithProgress();
    }, { description: 'Guardar imagen', category: 'Archivo' });
    shortcuts.register('x', ['ctrl', 'shift'], () => {
      if (AppState.currentImage) return ExportManager.downloadImageWithProgress();
      UIManager.showInfo('Carga una imagen primero');
    }, { description: 'Exportar imagen con ajustes', category: 'Archivo' });
    shortcuts.register('c', ['ctrl', 'shift'], async () => {
      if (!AppState.currentImage) return UIManager.showInfo('Carga una imagen primero');
      try {
        await copyCanvasToClipboard();
        UIManager.showSuccess('Imagen copiada al portapapeles');
      } catch (error) {
        UIManager.showError('Error al copiar imagen');
      }
    }, { description: 'Copiar imagen al portapapeles', category: 'Archivo' });
    shortcuts.register('v', ['ctrl', 'shift'], pasteImage, {
      description: 'Pegar imagen desde portapapeles', category: 'Archivo'
    });
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue;
          const blob = await item.getType(type);
          await call('handleFile', new File([blob], 'pasted-image.png', { type }));
          UIManager.showSuccess('Imagen pegada desde portapapeles');
          return;
        }
      }
      UIManager.showInfo('No hay imagen en el portapapeles');
    } catch (error) {
      UIManager.showError('Error al pegar imagen. Usa Cmd+V nativo en un campo de carga.');
    }
  }

  function registerEditingShortcuts() {
    shortcuts.register('escape', [], () => {
      const crop = call('getCropManager');
      if (crop?.isActive) {
        call('closeCropPanel');
        call('updatePreview');
        UIManager.showInfo('Modo recorte cancelado');
      }
    }, { description: 'Cancelar operación actual', category: 'Herramientas', preventDefault: false });
    shortcuts.register('backspace', [], () => TextLayerUIManager.removeActive({ confirm: true }), {
      description: 'Eliminar capa seleccionada', category: 'Edición', preventDefault: false
    });
    shortcuts.register('d', ['ctrl'], async () => {
      const duplicate = await TextLayerUIManager.duplicateActive();
      if (duplicate) UIManager.showSuccess('Capa duplicada: ' + duplicate.text);
      else UIManager.showInfo('Selecciona una capa de texto primero');
    }, { description: 'Duplicar capa de texto actual', category: 'Edición' });
    shortcuts.register('r', ['ctrl', 'shift'], () => {
      if (window.confirm('¿Reiniciar todos los filtros y ajustes?')) {
        call('resetFilters');
        UIManager.showSuccess('Ajustes reiniciados');
      }
    }, { description: 'Reiniciar filtros y ajustes', category: 'Edición' });
    shortcuts.register('r', ['ctrl'], () => {
      if (AppState.currentImage) call('resetChanges');
    }, { description: 'Descartar cambios de la imagen', category: 'Edición' });
  }

  function registerToolShortcuts() {
    shortcuts.register('b', ['ctrl'], () => window.openBatchModal?.(), {
      description: 'Abrir procesamiento por lotes', category: 'Herramientas'
    });
    shortcuts.register('t', ['ctrl', 'shift'], () => window.openTextLayersPanel?.(), {
      description: 'Abrir panel de capas de texto', category: 'Herramientas'
    });
    shortcuts.register('c', ['alt'], () => window.openCropPanel?.(), {
      description: 'Abrir modo recorte', category: 'Herramientas'
    });
    shortcuts.register('a', ['ctrl', 'shift'], openModal, {
      description: 'Ver atajos de teclado', category: 'Vista'
    });
    shortcuts.register('e', ['ctrl'], () => call('toggleComparisonMode'), {
      description: 'Activar/desactivar modo comparación', category: 'Vista'
    });
    shortcuts.register(' ', [], () => {
      if (!AppState.currentImage || spaceHeld) return;
      spaceHeld = true;
      showOriginalImage();
      UIManager.showInfo('Mostrando imagen original');
    }, { description: 'Ver imagen original (mantener presionado)', category: 'Vista', preventDefault: false });
    document.addEventListener('keyup', event => {
      if (event.key !== ' ' || !spaceHeld) return;
      spaceHeld = false;
      FilterCache.markDirty();
      call('updatePreview');
    });
  }

  function setup() {
    if (!shortcuts) return;
    try {
      registerCoreShortcuts();
      registerEditingShortcuts();
      registerToolShortcuts();
    } catch (error) {
      console.error('Error configurando atajos de teclado:', error);
    }
  }

  function renderGrid() {
    const grid = document.getElementById('shortcuts-grid');
    if (!grid || !shortcuts) return;
    const entries = shortcuts.getAllShortcuts();
    ZoomPanManager.getKeyboardShortcuts?.().forEach(item => entries.push({
      combo: shortcuts.getDisplayCombo(item.key, item.modifiers),
      description: item.description,
      category: item.category
    }));
    grid.replaceChildren();
    categories.forEach(category => {
      const items = entries.filter(item => item.category === category && item.description);
      if (!items.length) return;
      const section = document.createElement('div');
      section.className = 'shortcut-section';
      const title = document.createElement('h3');
      title.className = 'shortcut-section-title';
      title.textContent = category;
      section.appendChild(title);
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'shortcut-item';
        const key = document.createElement('kbd');
        key.className = 'shortcut-keys';
        key.textContent = item.combo;
        const description = document.createElement('span');
        description.className = 'shortcut-desc';
        description.textContent = item.description;
        row.append(key, description);
        section.appendChild(row);
      });
      grid.appendChild(section);
    });
  }

  function openModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) return;
    renderGrid();
    call('openModal', modal, null, 'display');
  }

  function closeModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) call('closeModal', modal);
  }

  return { configure, setup, renderGrid, openModal, closeModal, copyCanvasToClipboard, showOriginalImage };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.EditorShortcutManager;
