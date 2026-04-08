'use strict';

// ===== FILTER MANAGER =====
// Sistema de filtros avanzados con Web Workers para MnemoTag v3.0

/**
 * FilterManager - Sistema avanzado de filtros fotográficos
 * 
 * Funcionalidades:
 * - Filtros preestablecidos (sepia, vintage, frío, cálido, etc.)
 * - Controles manuales (brillo, contraste, saturación, desenfoque)
 * - Procesamiento con Web Workers para rendimiento
 * - Sistema de cache inteligente
 * - Debouncing optimizado para tiempo real
 * - Fallback para compatibilidad
 */

const FilterManager = {
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sepia: 0,
    hueRotate: 0
  },
  
  presets: {
    none: { brightness: 0, contrast: 0, saturation: 0, blur: 0, sepia: 0, hueRotate: 0 },
    sepia: { brightness: 20, contrast: 10, saturation: -20, blur: 0, sepia: 80, hueRotate: 0 },
    grayscale: { brightness: 0, contrast: 0, saturation: -100, blur: 0, sepia: 0, hueRotate: 0 },
    vintage: { brightness: -10, contrast: 25, saturation: -30, blur: 0.5, sepia: 30, hueRotate: 0 },
    cold: { brightness: -15, contrast: 30, saturation: -25, blur: 0, sepia: 0, hueRotate: 200 },
    warm: { brightness: 15, contrast: 10, saturation: 20, blur: 0, sepia: 10, hueRotate: -10 }
  },
  
  // Configuración para workers
  useWorkers: false,
  heavyFilterThreshold: 3, // Número de filtros para considerar "pesado"
  
  /**
   * Inicializar sistema de filtros
   */
  initialize: function() {
    // Intentar inicializar workers
    if (typeof WorkerManager !== 'undefined') {
      this.useWorkers = WorkerManager.initializeWorkerPool();
    }
    
    if (this.useWorkers) {
      console.log('🔧 FilterManager: Workers habilitados para filtros pesados');
    } else {
      console.log('⚠️ FilterManager: Usando procesamiento en hilo principal');
    }
  },
  
  /**
   * Determinar si debe usar worker
   * @returns {boolean}
   */
  shouldUseWorker: function() {
    if (!this.useWorkers) return false;
    
    // Contar filtros activos
    const activeFilters = Object.values(this.filters).filter(value => value !== 0).length;
    
    // Usar worker si hay muchos filtros o imagen grande
    const isHeavyProcessing = activeFilters >= this.heavyFilterThreshold;
    const isLargeImage = typeof canvas !== 'undefined' && canvas && (canvas.width * canvas.height) > (1920 * 1080);
    
    return isHeavyProcessing || isLargeImage;
  },
  
  /**
   * Aplicar filtro individual con cache y loading
   * @param {string} filterName - Nombre del filtro
   * @param {number} value - Valor del filtro
   */
  applyFilter: function(filterName, value) {
    console.log(`🎨 Aplicando filtro ${filterName}: ${value}`);
    
    // Verificar si el valor realmente cambió
    if (this.filters[filterName] === value) {
      console.log(`⚡ Filtro ${filterName} ya tiene el valor ${value}, omitiendo actualización`);
      return;
    }
    
    // Mostrar loading state para este filtro específico
    if (typeof FilterLoadingManager !== 'undefined') {
      FilterLoadingManager.showFilterLoading(filterName);
    }
    
    // Actualizar valor
    this.filters[filterName] = value;
    this.updateFilterDisplay(filterName, value);
    
    // Marcar cache como sucio
    if (typeof FilterCache !== 'undefined') {
      FilterCache.markDirty();
      FilterCache.saveState(`filter-${filterName}`, this.filters);
    }
    
    console.log('📊 Estado actual de filtros:', this.filters);
    
    // Aplicar con debounce inteligente o worker
    if (this.shouldUseWorker()) {
      this.scheduleWorkerUpdate();
    } else {
      this.scheduleFilterUpdate();
    }
  },
  
  /**
   * Aplicar preset con optimizaciones y workers
   * @param {string} presetName - Nombre del preset
   */
  applyPreset: function(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {
      console.warn(`❌ Preset "${presetName}" no encontrado`);
      return;
    }
    
    console.log(`🎭 Aplicando preset: ${presetName}`);
    
    // Verificar si ya está aplicado usando cache
    if (typeof FilterCache !== 'undefined') {
      const currentHash = FilterCache.generateHash(this.filters);
      const presetHash = FilterCache.generateHash(preset);
      
      if (currentHash === presetHash) {
        console.log(`⚡ Preset ${presetName} ya está aplicado, omitiendo actualización`);
        this.highlightActivePreset(presetName);
        return;
      }
    }
    
    // Mostrar loading global
    if (typeof FilterLoadingManager !== 'undefined') {
      FilterLoadingManager.showFilterLoading();
    }
    
    // Aplicar todos los valores del preset
    Object.keys(preset).forEach(filter => {
      this.filters[filter] = preset[filter];
      this.updateFilterDisplay(filter, preset[filter]);
      
      // Actualizar sliders
      const slider = document.getElementById(filter);
      if (slider) {
        slider.value = preset[filter];
      }
    });
    
    // Guardar en cache
    if (typeof FilterCache !== 'undefined') {
      FilterCache.saveState(`preset-${presetName}`, this.filters);
      FilterCache.markDirty();
    }
    
    // Resaltar botón activo
    this.highlightActivePreset(presetName);
    
    // Aplicar inmediatamente con workers si es necesario
    if (this.shouldUseWorker()) {
      this.applyFiltersWithWorker();
    } else {
      this.applyFiltersImmediate();
    }
  },
  
  /**
   * Programar actualización con worker
   */
  scheduleWorkerUpdate: function() {
    if (typeof SmartDebounce !== 'undefined') {
      SmartDebounce.intelligent('filter-worker-update', () => {
        this.applyFiltersWithWorker();
      }, 200); // Más tiempo para workers
    } else {
      this.applyFiltersWithWorker();
    }
  },
  
  /**
   * Aplicar filtros usando worker
   */
  applyFiltersWithWorker: async function() {
    if (!canvas || !currentImage) {
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
      return;
    }
    
    try {
      console.log('🔧 Aplicando filtros con worker');
      
      // Obtener ImageData actual
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Preparar operaciones para worker
      const operations = this.prepareWorkerOperations();
      
      if (operations.length === 0) {
        console.log('⚡ No hay filtros que aplicar');
        if (typeof FilterLoadingManager !== 'undefined') {
          FilterLoadingManager.hideFilterLoading();
        }
        return;
      }
      
      // Procesar en worker
      if (typeof WorkerManager !== 'undefined') {
        const result = await WorkerManager.processInWorker(imageData, operations);
        
        // Aplicar resultado al canvas
        if (result instanceof ImageBitmap) {
          // Si es ImageBitmap, dibujarlo directamente
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(result, 0, 0);
        } else if (result instanceof ImageData) {
          // Si es ImageData, aplicarlo
          ctx.putImageData(result, 0, 0);
        }
      }
      
      // Marcar como aplicado en cache
      if (typeof FilterCache !== 'undefined') {
        FilterCache.markApplied(this.filters);
      }
      
      console.log('✅ Filtros aplicados con worker exitosamente');
      
    } catch (error) {
      console.warn('⚠️ Error en worker, usando fallback:', error);
      // Fallback al procesamiento normal
      this.applyFiltersImmediate();
    } finally {
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
    }
  },
  
  /**
   * Aplicar filtros usando fallback
   */
  applyFiltersWithFallback: async function() {
    if (!canvas || !currentImage) {
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
      return;
    }
    
    try {
      console.log('⚠️ Aplicando filtros con fallback');
      
      // Obtener ImageData actual
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Preparar operaciones para fallback
      const operations = this.prepareWorkerOperations();
      
      if (operations.length === 0) {
        if (typeof FilterLoadingManager !== 'undefined') {
          FilterLoadingManager.hideFilterLoading();
        }
        return;
      }
      
      // Procesar en hilo principal
      if (typeof FallbackProcessor !== 'undefined') {
        const result = await FallbackProcessor.processInMainThread(imageData, operations);
        ctx.putImageData(result, 0, 0);
      }
      
      // Marcar como aplicado en cache
      if (typeof FilterCache !== 'undefined') {
        FilterCache.markApplied(this.filters);
      }
      
      console.log('✅ Filtros aplicados con fallback exitosamente');
      
    } catch (error) {
      console.error('❌ Error en fallback:', error);
      if (typeof UIManager !== 'undefined') {
        UIManager.showError('Error al aplicar filtros');
      }
    } finally {
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
    }
  },
  
  /**
   * Preparar operaciones para worker/fallback
   * @returns {Array} Array de operaciones
   */
  prepareWorkerOperations: function() {
    const operations = [];
    
    // Solo agregar filtros que tienen valores diferentes de 0
    Object.entries(this.filters).forEach(([filterName, value]) => {
      if (value !== 0) {
        operations.push({
          type: 'filter',
          config: {
            type: filterName,
            value: value
          }
        });
      }
    });
    
    return operations;
  },
  
  /**
   * Programar actualización de filtros con debounce (método original)
   */
  scheduleFilterUpdate: function() {
    // Usar debounce inteligente para filtros individuales
    if (typeof debouncedUpdatePreview !== 'undefined') {
      debouncedUpdatePreview();
    }
  },
  
  /**
   * Aplicar filtros inmediatamente (para presets)
   */
  applyFiltersImmediate: function() {
    // Verificar si realmente necesita actualización usando cache
    if (typeof FilterCache !== 'undefined' && !FilterCache.hasChanged(this.filters)) {
      console.log('⚡ Estado de filtros no ha cambiado, omitiendo actualización');
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
      return;
    }
    
    // Usar immediate update para respuesta rápida
    if (typeof immediatePreviewUpdate !== 'undefined') {
      immediatePreviewUpdate();
    }
  },
  
  /**
   * Aplicar filtros usando worker para operaciones pesadas
   * @param {ImageData} imageData - Datos de la imagen
   * @returns {Promise<ImageData>}
   */
  applyWithWorker: async function(imageData) {
    const filters = {...this.filters};
    
    try {
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.showWorkerLoading();
      }
      
      if (typeof WorkerManager !== 'undefined') {
        const result = await WorkerManager.processImage(imageData, filters);
        if (typeof FilterLoadingManager !== 'undefined') {
          FilterLoadingManager.hideFilterLoading();
        }
        return result;
      }
    } catch (error) {
      console.warn('Worker falló, usando fallback:', error);
      if (typeof FilterLoadingManager !== 'undefined') {
        FilterLoadingManager.hideFilterLoading();
      }
      
      if (typeof FallbackProcessor !== 'undefined') {
        return FallbackProcessor.processImage(imageData, filters);
      }
    }
    
    return imageData; // Fallback básico
  },
  
  /**
   * Aplicar filtros usando fallback processor
   * @param {ImageData} imageData - Datos de la imagen
   * @returns {ImageData}
   */
  applyWithFallback: function(imageData) {
    const filters = {...this.filters};
    
    if (typeof FallbackProcessor !== 'undefined') {
      return FallbackProcessor.processImage(imageData, filters);
    }
    
    return imageData; // Fallback básico
  },
  
  /**
   * Actualizar display de valores con animaciones
   * @param {string} filterName - Nombre del filtro
   * @param {number} value - Valor del filtro
   */
  updateFilterDisplay: function(filterName, value) {
    const display = document.getElementById(`${filterName}-value`);
    if (display) {
      const formattedValue = filterName === 'blur' ? `${value}px` : value;
      
      // Animar cambio de valor
      display.style.transition = 'all 0.2s ease';
      display.style.transform = 'scale(1.1)';
      display.textContent = formattedValue;
      
      setTimeout(() => {
        display.style.transform = 'scale(1)';
      }, 150);
    }
  },
  
  /**
   * Resaltar preset activo con animaciones
   * @param {string} activePreset - Preset activo
   */
  highlightActivePreset: function(activePreset) {
    const presetButtons = document.querySelectorAll('.filter-preset');
    presetButtons.forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
      btn.style.transform = 'scale(1)';
      
      if (btn.dataset.filter === activePreset) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        
        // Animación de activación
        btn.style.transition = 'all 0.2s ease';
        btn.style.transform = 'scale(1.05)';
        setTimeout(() => {
          btn.style.transform = 'scale(1)';
        }, 200);
      }
    });
  },
  
  /**
   * Reset con cache clearing
   */
  reset: function() {
    console.log('🔄 Reseteando filtros');
    
    // Mostrar loading
    if (typeof FilterLoadingManager !== 'undefined') {
      FilterLoadingManager.showFilterLoading();
    }
    
    // Reset valores
    Object.keys(this.filters).forEach(filter => {
      this.filters[filter] = 0;
      this.updateFilterDisplay(filter, 0);
      
      const slider = document.getElementById(filter);
      if (slider) {
        slider.value = 0;
      }
    });
    
    // Limpiar cache
    if (typeof FilterCache !== 'undefined') {
      FilterCache.cleanup();
      FilterCache.markDirty();
      FilterCache.saveState('reset', this.filters);
    }
    
    this.highlightActivePreset('none');
    
    // Aplicar inmediatamente
    this.applyFiltersImmediate();
  },
  
  /**
   * Generar string de filtros CSS optimizado
   * @returns {string}
   */
  getFilterString: function() {
    const { brightness, contrast, saturation, blur, sepia, hueRotate } = this.filters;
    
    let filterStr = '';
    
    // Solo agregar filtros que tienen valores diferentes de 0
    if (brightness !== 0) {
      filterStr += `brightness(${(100 + brightness) / 100}) `;
    }
    
    if (contrast !== 0) {
      filterStr += `contrast(${(100 + contrast) / 100}) `;
    }
    
    if (saturation !== 0) {
      filterStr += `saturate(${(100 + saturation) / 100}) `;
    }
    
    if (sepia > 0) {
      filterStr += `sepia(${sepia}%) `;
    }
    
    if (hueRotate !== 0) {
      filterStr += `hue-rotate(${hueRotate}deg) `;
    }
    
    if (blur > 0) {
      filterStr += `blur(${blur}px) `;
    }
    
    const finalFilter = filterStr.trim();
    console.log('🎨 Filtro CSS generado:', finalFilter || 'none');
    
    // Marcar como aplicado en cache
    if (typeof FilterCache !== 'undefined') {
      FilterCache.markApplied(this.filters);
    }
    
    return finalFilter;
  },
  
  /**
   * Obtener rendimiento de filtros
   * @returns {Object}
   */
  getPerformanceMetrics: function() {
    const defaultMetrics = {
      cacheSize: 0,
      isDirty: false,
      lastApplied: null,
      activeLoadings: 0
    };
    
    if (typeof FilterCache === 'undefined' || typeof FilterLoadingManager === 'undefined') {
      return defaultMetrics;
    }
    
    return {
      cacheSize: FilterCache.states?.size || 0,
      isDirty: FilterCache.isDirty || false,
      lastApplied: FilterCache.lastApplied || null,
      activeLoadings: FilterLoadingManager.activeLoadings?.size || 0
    };
  }
};

/**
 * Función utilitaria para resetear filtros
 * Se mantiene como función global para compatibilidad
 */
function resetFilters() {
  FilterManager.reset();
  if (typeof UIManager !== 'undefined') {
    UIManager.showSuccess('Filtros reseteados');
  }
}

// Export para uso modular
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FilterManager, resetFilters };
}
