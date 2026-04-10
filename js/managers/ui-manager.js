'use strict';

/**
 * ImgCraft v3.0 - UI Manager
 * Sistema de gestión de interfaz de usuario con notificaciones, loading states y utilidades
 * Características: Toasts, loading states, form management, debounce/throttle, error handling
 */

const UIManager = {
  // Configuración de notificaciones
  config: {
    defaultDuration: {
      error: 5000,
      warning: 4000,
      success: 3000,
      info: 3000
    },
    maxToasts: 5,
    enableLogging: true,
    animations: true
  },
  
  // Estados activos
  activeToasts: new Set(),
  activeLoaders: new Set(),
  
  // Loading state management con stack para múltiples loaders
  showLoadingState: function(message = 'Procesando...', id = null) {
    const loaderId = id || 'default';
    
    // Verificar si ya existe un loader con este ID
    if (this.activeLoaders.has(loaderId)) {
      // Solo actualizar el mensaje
      const existingLoader = document.querySelector(`[data-loader-id="${loaderId}"]`);
      if (existingLoader) {
        const messageElement = existingLoader.querySelector('.loader-message');
        if (messageElement) {
          messageElement.textContent = typeof SecurityManager !== 'undefined' 
            ? SecurityManager.sanitizeText(message) 
            : message;
        }
        return loaderId;
      }
    }
    
    const loader = document.createElement('div');
    loader.className = 'global-loader';
    loader.setAttribute('data-loader-id', loaderId);
    loader.innerHTML = `
      <div class="loader-content">
        <div class="loader-spinner"></div>
        <p class="loader-message">${typeof SecurityManager !== 'undefined' ? SecurityManager.sanitizeText(message) : message}</p>
      </div>
    `;
    
    document.body.appendChild(loader);
    this.activeLoaders.add(loaderId);
    
    return loaderId;
  },

  hideLoadingState: function(id = null) {
    const loaderId = id || 'default';
    
    if (id) {
      // Ocultar loader específico
      const loader = document.querySelector(`[data-loader-id="${loaderId}"]`);
      if (loader) {
        loader.remove();
        this.activeLoaders.delete(loaderId);
        
      }
    } else {
      // Ocultar todos los loaders
      const loaders = document.querySelectorAll('.global-loader');
      loaders.forEach(loader => loader.remove());
      this.activeLoaders.clear();
      
    }
  },

  // Enhanced error handling con stack traces y categorización
  showError: function(message, options = {}) {
    const config = {
      duration: options.duration || this.config.defaultDuration.error,
      category: options.category || 'general',
      action: options.action || null,
      stackTrace: options.stackTrace || null,
      persistent: options.persistent || false
    };
    
    this.hideError(); // Clear any existing error

    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-toast';
    errorContainer.setAttribute('data-category', config.category);
    // v3.4.3: accesibilidad — los errores son urgentes (assertive).
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    errorContainer.setAttribute('aria-atomic', 'true');

    // Construir el HTML SIN el botón de acción para evitar XSS por
    // interpolación de config.action.handler dentro de onclick="..."
    // (mismo patrón que se arregló en el batch listing en 3.2.12).
    errorContainer.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <div class="error-text">
          <span class="error-message">${typeof SecurityManager !== 'undefined' ? SecurityManager.sanitizeText(message) : message}</span>
          ${config.stackTrace ? `<details class="error-details"><summary>Detalles técnicos</summary><pre>${config.stackTrace}</pre></details>` : ''}
        </div>
        <button class="error-close" type="button" aria-label="Cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Si hay action, construir el botón de forma segura con DOM API.
    // El handler se acepta como función o (deprecado) como string que se
    // ignora con un warning — nunca se evalúa.
    if (config.action) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'error-action';
      actionBtn.textContent = String(config.action.label || 'Acción');
      if (typeof config.action.handler === 'function') {
        actionBtn.addEventListener('click', config.action.handler);
      } else if (config.action.handler != null) {
        console.warn('UIManager.showError: action.handler como string ya no se soporta (XSS). Pasa una función.');
      }
      const content = errorContainer.querySelector('.error-content');
      const closeBtn = errorContainer.querySelector('.error-close');
      if (content && closeBtn) {
        content.insertBefore(actionBtn, closeBtn);
      } else if (content) {
        content.appendChild(actionBtn);
      }
    }

    document.body.appendChild(errorContainer);
    this.activeToasts.add(errorContainer);
    
    // Aplicar animación de entrada si está habilitada
    if (this.config.animations) {
      errorContainer.style.animation = 'slideInRight 0.3s ease-out';
    }
    
    // Auto-hide después de la duración especificada (a menos que sea persistente)
    if (config.duration > 0 && !config.persistent) {
      setTimeout(() => {
        if (errorContainer.parentNode) {
          this.removeToast(errorContainer);
        }
      }, config.duration);
    }
    
    if (this.config.enableLogging) {
      console.error(`❌ Error mostrado [${config.category}]:`, message);
    }
    
    // Mantener un máximo de toasts activos
    this.limitActiveToasts();
    
    return errorContainer;
  },

  hideError: function() {
    const existingErrors = document.querySelectorAll('.error-toast');
    existingErrors.forEach(error => this.removeToast(error));
  },

  // Warning messages con categorización
  showWarning: function(message, options = {}) {
    const config = {
      duration: options.duration || this.config.defaultDuration.warning,
      category: options.category || 'general',
      action: options.action || null
    };
    
    const warningContainer = document.createElement('div');
    warningContainer.className = 'warning-toast';
    warningContainer.setAttribute('data-category', config.category);
    // v3.4.3: accesibilidad — warnings anunciados con polite.
    warningContainer.setAttribute('role', 'status');
    warningContainer.setAttribute('aria-live', 'polite');
    warningContainer.setAttribute('aria-atomic', 'true');

    // HTML sin el botón de acción para evitar XSS (ver showError)
    warningContainer.innerHTML = `
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <span class="warning-message">${typeof SecurityManager !== 'undefined' ? SecurityManager.sanitizeText(message) : message}</span>
        <button class="warning-close" type="button" aria-label="Cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    if (config.action) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'warning-action';
      actionBtn.textContent = String(config.action.label || 'Acción');
      if (typeof config.action.handler === 'function') {
        actionBtn.addEventListener('click', config.action.handler);
      } else if (config.action.handler != null) {
        console.warn('UIManager.showWarning: action.handler como string ya no se soporta (XSS). Pasa una función.');
      }
      const content = warningContainer.querySelector('.warning-content');
      const closeBtn = warningContainer.querySelector('.warning-close');
      if (content && closeBtn) {
        content.insertBefore(actionBtn, closeBtn);
      } else if (content) {
        content.appendChild(actionBtn);
      }
    }

    document.body.appendChild(warningContainer);
    this.activeToasts.add(warningContainer);
    
    // Aplicar animación de entrada
    if (this.config.animations) {
      warningContainer.style.animation = 'slideInRight 0.3s ease-out';
    }
    
    // Auto-hide después de la duración
    if (config.duration > 0) {
      setTimeout(() => {
        if (warningContainer.parentNode) {
          this.removeToast(warningContainer);
        }
      }, config.duration);
    }
    
    if (this.config.enableLogging) {
      console.warn(`⚠️ Warning mostrado [${config.category}]:`, message);
    }
    
    this.limitActiveToasts();
    
    return warningContainer;
  },

  hideWarning: function() {
    const existingWarnings = document.querySelectorAll('.warning-toast');
    existingWarnings.forEach(warning => this.removeToast(warning));
  },

  // Enhanced success messages con iconos personalizables
  showSuccess: function(message, options = {}) {
    const config = {
      duration: options.duration || this.config.defaultDuration.success,
      icon: options.icon || '✅',
      category: options.category || 'general',
      action: options.action || null
    };
    
    const successContainer = document.createElement('div');
    successContainer.className = 'success-toast';
    successContainer.setAttribute('data-category', config.category);
    // v3.4.3: accesibilidad — éxitos anunciados con polite.
    successContainer.setAttribute('role', 'status');
    successContainer.setAttribute('aria-live', 'polite');
    successContainer.setAttribute('aria-atomic', 'true');

    // HTML sin el botón de acción para evitar XSS (ver showError)
    successContainer.innerHTML = `
      <div class="success-content">
        <span class="success-icon">${config.icon}</span>
        <span class="success-message">${typeof SecurityManager !== 'undefined' ? SecurityManager.sanitizeText(message) : message}</span>
        <button class="success-close" type="button" aria-label="Cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    if (config.action) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'success-action';
      actionBtn.textContent = String(config.action.label || 'Acción');
      if (typeof config.action.handler === 'function') {
        actionBtn.addEventListener('click', config.action.handler);
      } else if (config.action.handler != null) {
        console.warn('UIManager.showSuccess: action.handler como string ya no se soporta (XSS). Pasa una función.');
      }
      const content = successContainer.querySelector('.success-content');
      const closeBtn = successContainer.querySelector('.success-close');
      if (content && closeBtn) {
        content.insertBefore(actionBtn, closeBtn);
      } else if (content) {
        content.appendChild(actionBtn);
      }
    }

    document.body.appendChild(successContainer);
    this.activeToasts.add(successContainer);
    
    // Aplicar animación de entrada
    if (this.config.animations) {
      successContainer.style.animation = 'slideInRight 0.3s ease-out';
    }
    
    // Auto-hide después de la duración
    setTimeout(() => {
      if (successContainer.parentNode) {
        this.removeToast(successContainer);
      }
    }, config.duration);
    
    this.limitActiveToasts();
    
    return successContainer;
  },
  
  // Mensajes informativos
  showInfo: function(message, options = {}) {
    const config = {
      duration: options.duration || this.config.defaultDuration.info,
      icon: options.icon || 'ℹ️',
      category: options.category || 'general'
    };
    
    const infoContainer = document.createElement('div');
    infoContainer.className = 'info-toast';
    infoContainer.setAttribute('data-category', config.category);
    // v3.4.3: accesibilidad — info anunciada con polite.
    infoContainer.setAttribute('role', 'status');
    infoContainer.setAttribute('aria-live', 'polite');
    infoContainer.setAttribute('aria-atomic', 'true');
    
    infoContainer.innerHTML = `
      <div class="info-content">
        <span class="info-icon">${config.icon}</span>
        <span class="info-message">${typeof SecurityManager !== 'undefined' ? SecurityManager.sanitizeText(message) : message}</span>
        <button class="info-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(infoContainer);
    this.activeToasts.add(infoContainer);
    
    // Aplicar animación de entrada
    if (this.config.animations) {
      infoContainer.style.animation = 'slideInRight 0.3s ease-out';
    }
    
    // Auto-hide después de la duración
    setTimeout(() => {
      if (infoContainer.parentNode) {
        this.removeToast(infoContainer);
      }
    }, config.duration);
    
    this.limitActiveToasts();
    
    return infoContainer;
  },

  // Gestión de toasts
  removeToast: function(toast) {
    if (this.config.animations) {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
          this.activeToasts.delete(toast);
        }
      }, 300);
    } else {
      toast.remove();
      this.activeToasts.delete(toast);
    }
  },
  
  limitActiveToasts: function() {
    if (this.activeToasts.size > this.config.maxToasts) {
      const oldestToast = this.activeToasts.values().next().value;
      if (oldestToast) {
        this.removeToast(oldestToast);
      }
    }
  },
  
  clearAllToasts: function() {
    this.activeToasts.forEach(toast => this.removeToast(toast));
  },

  // Form state management mejorado
  setFormDisabled: function(formSelector, disabled, options = {}) {
    const forms = typeof formSelector === 'string' 
      ? document.querySelectorAll(formSelector)
      : [formSelector];
    
    if (!forms.length) {
      console.warn(`UIManager: No se encontraron formularios con selector: ${formSelector}`);
      return;
    }
    
    const config = {
      includeButtons: options.includeButtons !== false,
      excludeSelectors: options.excludeSelectors || [],
      loadingMessage: options.loadingMessage || null
    };
    
    forms.forEach(form => {
      if (!form) return;
      
      let selectors = ['input', 'textarea', 'select'];
      if (config.includeButtons) {
        selectors.push('button');
      }
      
      const inputs = form.querySelectorAll(selectors.join(', '));
      inputs.forEach(input => {
        // Verificar si el input debe ser excluido
        const shouldExclude = config.excludeSelectors.some(excludeSelector => 
          input.matches(excludeSelector)
        );
        
        if (!shouldExclude) {
          input.disabled = disabled;
        }
      });
      
      if (disabled) {
        form.classList.add('form-disabled');
        if (config.loadingMessage) {
          this.showLoadingState(config.loadingMessage, `form-${form.id || 'unnamed'}`);
        }
      } else {
        form.classList.remove('form-disabled');
        this.hideLoadingState(`form-${form.id || 'unnamed'}`);
      }
    });
    
  },

  // Gestión de estado de elementos individuales
  setElementDisabled: function(elementSelector, disabled) {
    const elements = typeof elementSelector === 'string' 
      ? document.querySelectorAll(elementSelector)
      : [elementSelector];
    
    elements.forEach(element => {
      if (element) {
        element.disabled = disabled;
        
        if (disabled) {
          element.classList.add('element-disabled');
        } else {
          element.classList.remove('element-disabled');
        }
      }
    });
  },

  // Debounced functions for performance con almacenamiento de timeouts
  debounceMap: new Map(),
  
  debounce: function(key, func, wait = 300) {
    // Si se proporciona una función como primer parámetro, usar el comportamiento original
    if (typeof key === 'function') {
      const originalFunc = key;
      const originalWait = func || 300;
      
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          originalFunc(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, originalWait);
      };
    }
    
    // Comportamiento con key para reutilización
    if (this.debounceMap.has(key)) {
      clearTimeout(this.debounceMap.get(key));
    }
    
    const timeout = setTimeout(() => {
      func();
      this.debounceMap.delete(key);
    }, wait);
    
    this.debounceMap.set(key, timeout);
  },

  // Throttled functions for performance con almacenamiento de estados
  throttleMap: new Map(),
  
  throttle: function(key, func, limit = 100) {
    // Si se proporciona una función como primer parámetro, usar el comportamiento original
    if (typeof key === 'function') {
      const originalFunc = key;
      const originalLimit = func || 100;
      
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          originalFunc.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, originalLimit);
        }
      };
    }
    
    // Comportamiento con key para reutilización
    if (this.throttleMap.has(key)) {
      return; // Ya está en throttle
    }
    
    func();
    this.throttleMap.set(key, true);
    
    setTimeout(() => {
      this.throttleMap.delete(key);
    }, limit);
  },
  
  // Utilidades de animación
  animateElement: function(element, animation, duration = 300) {
    if (!this.config.animations) return Promise.resolve();
    
    return new Promise(resolve => {
      element.style.animation = `${animation} ${duration}ms ease-out`;
      setTimeout(() => {
        element.style.animation = '';
        resolve();
      }, duration);
    });
  },
  
  // Gestión de estado de la aplicación
  setAppBusy: function(busy, message = null) {
    const app = document.body;
    
    if (busy) {
      app.classList.add('app-busy');
      if (message) {
        this.showLoadingState(message, 'app-busy');
      }
    } else {
      app.classList.remove('app-busy');
      this.hideLoadingState('app-busy');
    }
  },
  
  // Configuración del manager
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
  },
  
  // Obtener estadísticas del manager
  getStats: function() {
    return {
      activeToasts: this.activeToasts.size,
      activeLoaders: this.activeLoaders.size,
      debounceTimers: this.debounceMap.size,
      throttleStates: this.throttleMap.size,
      config: this.config
    };
  },
  
  // Limpiar todos los estados
  cleanup: function() {
    this.clearAllToasts();
    this.hideLoadingState();
    
    // Limpiar debounce timers
    this.debounceMap.forEach(timeout => clearTimeout(timeout));
    this.debounceMap.clear();
    
    // Limpiar throttle states
    this.throttleMap.clear();
    
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}
