/**
 * MnemoTag v3.0 - Filter Loading Manager
 * Sistema de loading states específicos para operaciones de filtros
 * Características: Loading indicators, control disabling, worker loading, animations
 */

const FilterLoadingManager = {
  // Estados activos de carga
  activeLoadings: new Set(),
  
  // Configuración
  config: {
    enableAnimations: true,
    loadingTimeout: 10000, // 10 segundos timeout
    enableLogging: true
  },
  
  // Timers activos para timeout
  activeTimeouts: new Map(),
  
  // Mostrar loading state específico para filtros
  showFilterLoading: function(filterName = null) {
    const key = filterName || 'global';
    this.activeLoadings.add(key);
    
    if (this.config.enableLogging) {
      console.log(`🔄 Filter loading iniciado: ${key}`);
    }
    
    // Mostrar indicador visual
    const indicator = this.createLoadingIndicator(key);
    if (indicator) {
      this.showIndicator(indicator, filterName);
    }
    
    // Deshabilitar controles temporalmente
    this.disableFilterControls(filterName);
    
    // Configurar timeout de seguridad
    this.setLoadingTimeout(key);
  },
  
  // Ocultar loading state
  hideFilterLoading: function(filterName = null) {
    const key = filterName || 'global';
    this.activeLoadings.delete(key);
    
    if (this.config.enableLogging) {
      console.log(`✅ Filter loading terminado: ${key}`);
    }
    
    // Limpiar timeout
    this.clearLoadingTimeout(key);
    
    // Ocultar indicador
    this.hideIndicator(key);
    
    // Rehabilitar controles
    this.enableFilterControls(filterName);
  },
  
  // Mostrar loading específico para worker
  showWorkerLoading: function() {
    this.showFilterLoading('worker');
    
    // Mostrar indicador específico de worker
    const indicator = document.getElementById('filter-loading-worker');
    if (indicator) {
      const textElement = indicator.querySelector('.filter-loading-text');
      if (textElement) {
        textElement.textContent = '🔧 Procesando con Worker...';
      }
      
      // Agregar clase especial para worker
      indicator.classList.add('worker-processing');
    }
    
    if (this.config.enableLogging) {
      console.log('🔧 Worker loading iniciado');
    }
  },
  
  // Mostrar loading para operaciones pesadas
  showHeavyProcessingLoading: function() {
    this.showFilterLoading('heavy');
    
    const indicator = document.getElementById('filter-loading-heavy');
    if (indicator) {
      const textElement = indicator.querySelector('.filter-loading-text');
      if (textElement) {
        textElement.textContent = '⚡ Procesamiento intensivo...';
      }
      
      indicator.classList.add('heavy-processing');
    }
  },
  
  // Crear indicador de carga
  createLoadingIndicator: function(key) {
    const existingIndicator = document.getElementById(`filter-loading-${key}`);
    if (existingIndicator) return existingIndicator;
    
    const indicator = document.createElement('div');
    indicator.id = `filter-loading-${key}`;
    indicator.className = 'filter-loading-indicator';
    
    // Determinar mensaje según el tipo
    let message = 'Aplicando filtros...';
    let icon = '⚡';
    
    switch (key) {
      case 'worker':
        message = '🔧 Procesando con Worker...';
        icon = '🔧';
        break;
      case 'heavy':
        message = '⚡ Procesamiento intensivo...';
        icon = '⚡';
        break;
      case 'preset':
        message = '🎨 Aplicando preset...';
        icon = '🎨';
        break;
      case 'reset':
        message = '🔄 Reseteando filtros...';
        icon = '🔄';
        break;
      default:
        if (key !== 'global') {
          message = `Aplicando ${key}...`;
        }
    }
    
    indicator.innerHTML = `
      <div class="filter-spinner">
        <div class="spinner-icon">${icon}</div>
        <div class="spinner-animation"></div>
      </div>
      <span class="filter-loading-text">${message}</span>
    `;
    
    // Agregar atributos de accesibilidad
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    indicator.setAttribute('aria-label', message);
    
    return indicator;
  },
  
  // Mostrar indicador
  showIndicator: function(indicator, filterName) {
    let container = null;
    
    if (filterName && filterName !== 'global') {
      // Mostrar junto al control específico
      const control = document.getElementById(filterName);
      if (control) {
        container = control.closest('.filter-group') || control.parentNode;
      }
    }
    
    // Fallback a contenedores globales
    if (!container) {
      container = document.querySelector('.filter-controls') || 
                 document.querySelector('.filters-section') ||
                 document.querySelector('.canvas-controls') ||
                 document.body;
    }
    
    if (container) {
      container.appendChild(indicator);
    }
    
    // Animar entrada si las animaciones están habilitadas
    if (this.config.enableAnimations) {
      this.animateIndicatorIn(indicator);
    }
  },
  
  // Animar entrada del indicador
  animateIndicatorIn: function(indicator) {
    indicator.style.opacity = '0';
    indicator.style.transform = 'scale(0.8) translateY(-10px)';
    indicator.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    requestAnimationFrame(() => {
      indicator.style.opacity = '1';
      indicator.style.transform = 'scale(1) translateY(0)';
    });
  },
  
  // Animar salida del indicador
  animateIndicatorOut: function(indicator, callback) {
    if (!this.config.enableAnimations) {
      callback();
      return;
    }
    
    indicator.style.transition = 'all 0.2s ease-in';
    indicator.style.opacity = '0';
    indicator.style.transform = 'scale(0.8) translateY(-10px)';
    
    setTimeout(callback, 200);
  },
  
  // Ocultar indicador
  hideIndicator: function(key) {
    const indicator = document.getElementById(`filter-loading-${key}`);
    if (!indicator) return;
    
    this.animateIndicatorOut(indicator, () => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
  },
  
  // Deshabilitar controles
  disableFilterControls: function(filterName) {
    if (filterName && filterName !== 'global') {
      // Deshabilitar control específico
      const control = document.getElementById(filterName);
      if (control) {
        control.disabled = true;
        control.classList.add('filter-loading');
        
        // Buscar el slider container para agregar clase de loading
        const container = control.closest('.filter-group');
        if (container) {
          container.classList.add('filter-group-loading');
        }
      }
    } else {
      // Deshabilitar todos los controles de filtros
      const selectors = [
        '.filter-controls input',
        '.filter-controls button',
        '.filter-presets button',
        '.filter-sliders input[type="range"]'
      ];
      
      selectors.forEach(selector => {
        const controls = document.querySelectorAll(selector);
        controls.forEach(control => {
          control.disabled = true;
          control.classList.add('filter-loading');
        });
      });
      
      // Agregar clase global
      const filterSection = document.querySelector('.filters-section');
      if (filterSection) {
        filterSection.classList.add('filters-loading');
      }
    }
  },
  
  // Habilitar controles
  enableFilterControls: function(filterName) {
    if (filterName && filterName !== 'global') {
      // Habilitar control específico
      const control = document.getElementById(filterName);
      if (control) {
        control.disabled = false;
        control.classList.remove('filter-loading');
        
        // Remover clase del container
        const container = control.closest('.filter-group');
        if (container) {
          container.classList.remove('filter-group-loading');
        }
      }
    } else {
      // Habilitar todos los controles de filtros
      const selectors = [
        '.filter-controls input',
        '.filter-controls button',
        '.filter-presets button',
        '.filter-sliders input[type="range"]'
      ];
      
      selectors.forEach(selector => {
        const controls = document.querySelectorAll(selector);
        controls.forEach(control => {
          control.disabled = false;
          control.classList.remove('filter-loading');
        });
      });
      
      // Remover clase global
      const filterSection = document.querySelector('.filters-section');
      if (filterSection) {
        filterSection.classList.remove('filters-loading');
      }
    }
  },
  
  // Configurar timeout de seguridad
  setLoadingTimeout: function(key) {
    const timeout = setTimeout(() => {
      if (this.activeLoadings.has(key)) {
        console.warn(`⚠️ Loading timeout para ${key}, forzando finalización`);
        this.hideFilterLoading(key.replace('global', null));
        
        // Mostrar mensaje de error si está disponible UIManager
        if (typeof UIManager !== 'undefined') {
          UIManager.showWarning('El procesamiento está tomando más tiempo del esperado');
        }
      }
    }, this.config.loadingTimeout);
    
    this.activeTimeouts.set(key, timeout);
  },
  
  // Limpiar timeout
  clearLoadingTimeout: function(key) {
    const timeout = this.activeTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(key);
    }
  },
  
  // Verificar si hay loading activo
  isLoading: function(filterName = null) {
    const key = filterName || 'global';
    return this.activeLoadings.has(key);
  },
  
  // Verificar si algún filtro está cargando
  hasAnyLoading: function() {
    return this.activeLoadings.size > 0;
  },
  
  // Obtener estado de loading específico
  getLoadingState: function(filterName = null) {
    const key = filterName || 'global';
    return {
      isLoading: this.activeLoadings.has(key),
      indicator: document.getElementById(`filter-loading-${key}`),
      hasTimeout: this.activeTimeouts.has(key)
    };
  },
  
  // Mostrar loading para preset específico
  showPresetLoading: function(presetName) {
    this.showFilterLoading('preset');
    
    const indicator = document.getElementById('filter-loading-preset');
    if (indicator) {
      const textElement = indicator.querySelector('.filter-loading-text');
      if (textElement) {
        textElement.textContent = `🎨 Aplicando preset: ${presetName}`;
      }
    }
  },
  
  // Mostrar loading para reset
  showResetLoading: function() {
    this.showFilterLoading('reset');
  },
  
  // Limpiar todos los loading states
  clearAllLoadings: function() {
    const loadings = Array.from(this.activeLoadings);
    loadings.forEach(key => {
      this.hideFilterLoading(key === 'global' ? null : key);
    });
    
    if (this.config.enableLogging) {
      console.log('🧹 Todos los filter loadings limpiados');
    }
  },
  
  // Configurar el manager
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('⚙️ FilterLoadingManager configurado:', this.config);
    }
  },
  
  // Obtener estadísticas
  getStats: function() {
    return {
      activeLoadings: Array.from(this.activeLoadings),
      activeTimeouts: this.activeTimeouts.size,
      config: this.config
    };
  },
  
  // Cleanup al cerrar
  cleanup: function() {
    this.clearAllLoadings();
    
    // Limpiar todos los timeouts
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();
    
    if (this.config.enableLogging) {
      console.log('🧹 FilterLoadingManager limpiado');
    }
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.FilterLoadingManager = FilterLoadingManager;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterLoadingManager;
}
