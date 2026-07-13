'use strict';

window.TextLayerUIManager = (function () {
  let manager = null;
  let dependencies = {};

  function configure(options) {
    dependencies = options || {};
    manager = dependencies.textLayerManager || manager;
  }

  function render() {
    if (typeof dependencies.render === 'function') dependencies.render();
  }

  function renderLightweight() {
    if (typeof dependencies.renderLightweight === 'function') dependencies.renderLightweight();
  }

  function open() {
    const panel = document.getElementById('text-layers-panel');
    if (!panel) return;
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('active'), 10);
    updateList();
  }

  function close() {
    const panel = document.getElementById('text-layers-panel');
    if (!panel) return;
    panel.classList.remove('active');
    setTimeout(() => {
      if (!panel.classList.contains('active')) panel.style.display = 'none';
    }, 300);
    AppState.activeLayerId = null;
    if (manager) manager.clearActiveLayer();
  }

  async function applyTemplate(templateName) {
    if (!AppState.currentImage) return UIManager.showError('Carga una imagen primero');
    try {
      await manager.applyTemplate(templateName, AppState.canvas.width, AppState.canvas.height);
      updateList();
      render();
      UIManager.showSuccess('Plantilla "' + templateName + '" aplicada');
    } catch (error) {
      UIManager.showError('Error al aplicar la plantilla');
    }
  }

  async function add() {
    if (!AppState.currentImage) return UIManager.showError('Carga una imagen primero');
    const canvas = AppState.canvas;
    const layer = await manager.addLayer({
      text: 'Nuevo texto',
      position: { x: Math.round(canvas.width / 2), y: Math.round(canvas.height / 2) }
    });
    updateList();
    select(layer.id);
    render();
    return layer;
  }

  function commitInlineEdit(layer, element) {
    element.contentEditable = 'true';
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const onKey = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        element.blur();
      } else if (event.key === 'Escape') {
        element.textContent = layer.text || '';
        element.blur();
      }
    };
    const save = () => {
      element.contentEditable = 'false';
      const value = element.textContent.trim();
      if (value && value !== layer.text) {
        layer.text = value;
        render();
        const input = document.getElementById('text-layer-text');
        if (input && AppState.activeLayerId === layer.id) input.value = value;
      }
      element.removeEventListener('blur', save);
      element.removeEventListener('keydown', onKey);
    };
    element.addEventListener('blur', save);
    element.addEventListener('keydown', onKey);
  }

  function createListItem(layer) {
    const item = document.createElement('div');
    item.className = 'text-layer-item' + (layer.id === AppState.activeLayerId ? ' active' : '');
    item.addEventListener('click', () => select(layer.id));
    const preview = document.createElement('div');
    preview.className = 'text-layer-preview';
    const text = document.createElement('div');
    text.className = 'text-layer-text';
    text.textContent = layer.text || '';
    text.addEventListener('dblclick', event => {
      event.stopPropagation();
      commitInlineEdit(layer, text);
    });
    const font = document.createElement('div');
    font.className = 'text-layer-font';
    font.textContent = ((layer.font && layer.font.family) || '?') + ' - ' +
      ((layer.font && layer.font.size) || '?') + 'px';
    preview.append(text, font);
    item.appendChild(preview);
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = 'text-layer-visibility';
    visibility.setAttribute('aria-label', (layer.visible ? 'Ocultar ' : 'Mostrar ') + (layer.text || 'capa'));
    visibility.addEventListener('click', event => {
      event.stopPropagation();
      toggleVisibility(layer.id);
    });
    const icon = document.createElement('i');
    icon.className = 'fas fa-' + (layer.visible ? 'eye' : 'eye-slash');
    icon.setAttribute('aria-hidden', 'true');
    visibility.appendChild(icon);
    item.appendChild(visibility);
    return item;
  }

  function updateList() {
    const container = document.getElementById('text-layers-list');
    if (!container || !manager) return;
    const layers = manager.getAllLayers();
    container.replaceChildren();
    if (!layers.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const message = document.createElement('p');
      message.textContent = 'No hay capas de texto.';
      const action = document.createElement('button');
      action.type = 'button';
      action.id = 'text-layer-empty-cta';
      action.className = 'empty-state__action';
      action.textContent = 'Añadir primera capa';
      action.addEventListener('click', add);
      empty.append(message, action);
      container.appendChild(empty);
      return;
    }
    container.replaceChildren(...layers.map(createListItem));
  }

  function control(id) {
    return document.getElementById('text-layer-' + id);
  }

  function select(layerId) {
    const layer = manager && manager.getLayer(layerId);
    if (!layer) return;
    AppState.activeLayerId = layerId;
    manager.setActiveLayer(layerId);
    updateList();
    const editor = document.getElementById('text-layer-editor');
    if (editor) editor.style.display = 'block';
    const values = {
      text: layer.text || '',
      font: (layer.font && layer.font.family) || 'Roboto',
      size: (layer.font && layer.font.size) || 40,
      color: layer.color || '#ffffff',
      x: Math.round((layer.position && layer.position.x) || 0),
      y: Math.round((layer.position && layer.position.y) || 0),
      rotation: layer.rotation || 0,
      opacity: Math.round((layer.opacity ?? 1) * 100)
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = control(id);
      if (element) element.value = value;
    });
    ['shadow', 'stroke', 'gradient'].forEach(name => {
      const element = control(name);
      if (element) element.checked = !!(layer.effects && layer.effects[name]);
    });
  }

  function effectValue(layer, name, fallback) {
    const element = control(name);
    if (!element || !element.checked) return null;
    return (layer && layer.effects && layer.effects[name]) || fallback;
  }

  async function updateActive() {
    const layerId = AppState.activeLayerId;
    if (!layerId || !manager) return;
    const layer = manager.getLayer(layerId);
    const number = (id, fallback) => {
      const value = parseInt(control(id)?.value, 10);
      return Number.isFinite(value) ? value : fallback;
    };
    await manager.updateLayer(layerId, {
      text: control('text')?.value || '',
      font: { family: control('font')?.value || 'Roboto', size: number('size', 40) },
      position: { x: number('x', 0), y: number('y', 0) },
      color: control('color')?.value || '#ffffff',
      rotation: number('rotation', 0),
      opacity: number('opacity', 100) / 100,
      effects: {
        shadow: effectValue(layer, 'shadow', { offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.3)' }),
        stroke: effectValue(layer, 'stroke', { width: 2, color: '#000000' }),
        gradient: effectValue(layer, 'gradient', { type: 'linear', colors: ['#ff0000', '#0000ff'], angle: 0 })
      }
    });
    updateList();
    render();
  }

  function toggleVisibility(layerId) {
    const layer = manager && manager.getLayer(layerId);
    if (!layer) return;
    manager.updateLayer(layerId, { visible: !layer.visible });
    updateList();
    render();
  }

  function removeActive(options) {
    const layerId = AppState.activeLayerId;
    if (!layerId || !manager) return false;
    const layer = manager.getLayer(layerId);
    if (options?.confirm && layer && !window.confirm('¿Eliminar capa "' + layer.text + '"?')) return false;
    manager.removeLayer(layerId);
    AppState.activeLayerId = manager.activeLayerId || null;
    const editor = document.getElementById('text-layer-editor');
    if (editor && !AppState.activeLayerId) editor.style.display = 'none';
    updateList();
    render();
    if (!options?.silent) UIManager.showSuccess('Capa eliminada');
    return true;
  }

  async function duplicateActive() {
    if (!AppState.activeLayerId || !manager) return null;
    const duplicate = await manager.duplicateLayer(AppState.activeLayerId);
    select(duplicate.id);
    render();
    return duplicate;
  }

  function initializeControls() {
    const text = control('text');
    if (text) text.addEventListener('input', debounce(updateActive, 300));
    ['font', 'size', 'color', 'x', 'y', 'rotation', 'opacity', 'shadow', 'stroke', 'gradient']
      .forEach(id => control(id)?.addEventListener('change', updateActive));
  }

  return {
    configure,
    open,
    close,
    applyTemplate,
    add,
    select,
    updateActive,
    toggleVisibility,
    removeActive,
    duplicateActive,
    updateList,
    render,
    renderLightweight,
    initializeControls
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = window.TextLayerUIManager;
