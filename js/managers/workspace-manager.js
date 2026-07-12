'use strict';

// ===== WORKSPACE MANAGER (v3.6.1) =====
// Gestiona el área de trabajo: pestañas del panel de controles, indicadores
// de sección modificada con restauración por sección, bottom-sheet móvil y
// botón Descargar de la barra móvil.
//
// Principio: NO reimplementa ninguna lógica de edición. Los botones movidos
// a la toolbar conservan sus IDs y el wiring de main.js; las restauraciones
// se hacen reseteando los formularios existentes y re-disparando sus eventos
// (o pulsando los botones de reset ya existentes), nunca tocando estado
// interno de main.js.

window.WorkspaceManager = (function () {

  const TABS = ['metadatos', 'marca', 'ajustes', 'exportar'];

  // Serialización de cada panel para detectar "sección modificada"
  const baselines = {};
  let dirtyCheckTimer = null;

  function getPanel(tabId) {
    return document.getElementById('tabpanel-' + tabId);
  }

  function getTabButton(tabId) {
    return document.getElementById('tab-' + tabId);
  }

  // --------------------------------------------------------------
  // Pestañas
  // --------------------------------------------------------------
  function selectTab(tabId) {
    TABS.forEach(function (id) {
      const btn = getTabButton(id);
      const panel = getPanel(id);
      if (!btn || !panel) return;
      const selected = id === tabId;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
  }

  function initTabs() {
    TABS.forEach(function (id) {
      const btn = getTabButton(id);
      if (btn) {
        btn.addEventListener('click', function () { selectTab(id); });
      }
    });

    // Navegación con flechas dentro del tablist (patrón WAI-ARIA)
    const tablist = document.querySelector('.workspace__tabs');
    if (tablist) {
      tablist.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const current = TABS.findIndex(function (id) {
          return getTabButton(id) === document.activeElement;
        });
        if (current === -1) return;
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = (current + delta + TABS.length) % TABS.length;
        const nextBtn = getTabButton(TABS[next]);
        if (nextBtn) {
          nextBtn.focus();
          selectTab(TABS[next]);
        }
      });
    }
  }

  // --------------------------------------------------------------
  // Indicadores de sección modificada
  // --------------------------------------------------------------
  function serializePanel(tabId) {
    const panel = getPanel(tabId);
    if (!panel) return '';
    const parts = [];
    panel.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        parts.push(el.id + '=' + el.checked);
      } else if (el.type !== 'file') {
        parts.push(el.id + '=' + el.value);
      } else {
        // input file: solo si hay archivo seleccionado
        parts.push(el.id + '=' + (el.files && el.files.length ? 'file' : ''));
      }
    });
    // Ajustes: los sliders de filtros están en el panel, pero los presets y
    // el estado real viven en FilterManager — incluirlo hace el check fiable
    if (tabId === 'ajustes' && typeof FilterManager !== 'undefined') {
      parts.push('filters=' + FilterManager.getFilterString());
    }
    return parts.join('|');
  }

  function captureBaseline(tabId) {
    baselines[tabId] = serializePanel(tabId);
    updateDirtyDot(tabId);
  }

  function captureBaselines() {
    TABS.forEach(captureBaseline);
  }

  function updateDirtyDot(tabId) {
    const dot = document.querySelector('[data-dirty-dot="' + tabId + '"]');
    if (!dot) return;
    const dirty = baselines[tabId] !== undefined &&
      serializePanel(tabId) !== baselines[tabId];
    if (dirty) {
      dot.removeAttribute('hidden');
    } else {
      dot.setAttribute('hidden', '');
    }
  }

  function scheduleDirtyCheck() {
    clearTimeout(dirtyCheckTimer);
    dirtyCheckTimer = setTimeout(function () {
      TABS.forEach(updateDirtyDot);
    }, 300);
  }

  function initDirtyTracking() {
    TABS.forEach(function (id) {
      const panel = getPanel(id);
      if (!panel) return;
      ['input', 'change', 'click'].forEach(function (evt) {
        panel.addEventListener(evt, scheduleDirtyCheck);
      });
    });
  }

  // --------------------------------------------------------------
  // Restauración por sección
  // --------------------------------------------------------------
  function dispatchRefresh(el, type) {
    try {
      el.dispatchEvent(new Event(type, { bubbles: true }));
    } catch (e) { /* defensivo */ }
  }

  const RESTORE_ACTIONS = {
    metadatos: function () {
      const form = document.getElementById('metadata-form');
      if (form) {
        form.reset();
        // Re-disparar input en los campos con listeners (preview de metadatos)
        form.querySelectorAll('input, textarea, select').forEach(function (el) {
          dispatchRefresh(el, 'input');
          dispatchRefresh(el, 'change');
        });
      }
    },
    marca: function () {
      const form = document.getElementById('watermark-form');
      if (form) {
        form.reset();
        // Los checkboxes de activación y los campos tienen listeners que
        // redibujan el preview: re-disparar sus eventos tras el reset
        form.querySelectorAll('input, select, textarea').forEach(function (el) {
          dispatchRefresh(el, 'input');
          dispatchRefresh(el, 'change');
        });
      }
    },
    ajustes: function () {
      // Botón de reset de filtros existente (wiring completo en main.js)
      const btn = document.getElementById('resetFilters');
      if (btn) btn.click();
    },
    exportar: function () {
      const panel = getPanel('exportar');
      if (!panel) return;
      // Restaurar los controles de salida a sus valores por defecto del DOM
      panel.querySelectorAll('form').forEach(function (f) { f.reset(); });
      panel.querySelectorAll('input, select').forEach(function (el) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = el.defaultChecked;
        } else if (el.type !== 'file') {
          el.value = el.defaultValue !== undefined ? el.defaultValue : el.value;
        }
        dispatchRefresh(el, 'input');
        dispatchRefresh(el, 'change');
      });
    }
  };

  function initRestoreButtons() {
    document.querySelectorAll('.workspace__restore').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tabId = btn.getAttribute('data-restore');
        const action = RESTORE_ACTIONS[tabId];
        if (!action) return;
        action();
        // La sección vuelve a su línea base
        setTimeout(function () {
          captureBaseline(tabId);
          if (typeof UIManager !== 'undefined') {
            UIManager.showSuccess('Sección restaurada');
          }
        }, 50);
      });
    });
  }

  // --------------------------------------------------------------
  // Móvil: bottom-sheet + descarga
  // --------------------------------------------------------------
  function initMobileBar() {
    const toggle = document.getElementById('mobile-panel-toggle');
    const panel = document.getElementById('workspace-panel');
    const download = document.getElementById('mobile-download-btn');

    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        const open = panel.classList.toggle('workspace__panel--open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.innerHTML = open
          ? '<i class="fas fa-times" aria-hidden="true"></i> Cerrar'
          : '<i class="fas fa-sliders-h" aria-hidden="true"></i> Controles';
      });
    }

    if (download) {
      download.addEventListener('click', function () {
        // Reutilizar el flujo completo del botón principal (EXIF, progreso…)
        const main = document.getElementById('download-image');
        if (main) main.click();
      });
    }

    // v3.7.0: Compartir (Web Share API). El botón solo es visible si
    // Capabilities detectó navigator.canShare({files}); el flujo tiene
    // fallback interno a descarga si el share falla.
    const share = document.getElementById('mobile-share-btn');
    if (share) {
      share.addEventListener('click', function () {
        if (typeof ExportManager !== 'undefined' && ExportManager.shareImage) {
          ExportManager.shareImage();
        }
      });
    }
  }

  // --------------------------------------------------------------
  // Init
  // --------------------------------------------------------------
  function init() {
    // Si el workspace no está en el DOM (tests con markup parcial), no-op
    if (!document.getElementById('workspace')) return;
    initTabs();
    initDirtyTracking();
    initRestoreButtons();
    initMobileBar();
    captureBaselines();
  }

  return {
    init: init,
    selectTab: selectTab,
    captureBaselines: captureBaselines
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.WorkspaceManager;
}
