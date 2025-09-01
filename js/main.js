 // Variables globales optimizadas
    let currentImage = null;
    let canvas = null;
    let ctx = null;
    let currentFile = null;
    let originalExtension = 'jpg';
    let lastDownloadDirectory = null;
    
    // Variables para redimensionado
    let originalImageDimensions = { width: 0, height: 0 };
    let isResizing = false;
    
    // Variables para rotación
    let currentRotation = 0; // Degrees: 0, 90, 180, 270
    let isFlippedHorizontally = false;
    let isFlippedVertically = false;
    
    // Variables para zoom
    let currentZoom = 1.0; // Factor de zoom (1.0 = 100%)
    let minZoom = 0.1; // Zoom mínimo (10%)
    let maxZoom = 5.0; // Zoom máximo (500%)
    let zoomStep = 0.1; // Incremento del zoom (10%)
    let isZoomed = false;
    
    // Variables para pan (navegación con zoom)
    let panX = 0; // Posición X del pan
    let panY = 0; // Posición Y del pan
    let isPanning = false; // Estado de arrastre
    let startPanX = 0; // Posición inicial X del mouse
    let startPanY = 0; // Posición inicial Y del mouse
    let startOffsetX = 0; // Offset inicial X
    let startOffsetY = 0; // Offset inicial Y
    
    // Variables para configuración de salida
    let outputQuality = 0.8; // Valor por defecto (80%)
    let outputFormat = 'jpeg'; // Formato por defecto
    
    // Variables para posicionamiento interactivo de imagen
    let customImagePosition = null;
    let isPositioningMode = false;
    let watermarkImagePreview = null;
    
    // HistoryManager extraído a js/managers/history-manager.js
    
    // Cache para optimización de rendimiento - MEJORADO
    const cache = {
      watermarkImage: null,
      lastWatermarkConfig: null,
      processedImages: new Map(),
      thumbnails: new Map(),
      
      // Configuración del cache
      maxSize: 50, // Máximo 50 imágenes en cache
      maxAge: 30 * 60 * 1000, // 30 minutos
      
      // Generar clave única para cache
      generateKey: function(config) {
        return JSON.stringify(config);
      },
      
      // Obtener del cache
      get: function(key) {
        const item = this.processedImages.get(key);
        if (!item) return null;
        
        // Verificar si ha expirado
        if (Date.now() - item.timestamp > this.maxAge) {
          this.processedImages.delete(key);
          return null;
        }
        
        // Actualizar timestamp (LRU)
        item.timestamp = Date.now();
        return item.data;
      },
      
      // Guardar en cache
      set: function(key, data) {
        // Limpiar cache si está lleno
        if (this.processedImages.size >= this.maxSize) {
          this.cleanOldest();
        }
        
        this.processedImages.set(key, {
          data: data,
          timestamp: Date.now(),
          size: this.estimateSize(data)
        });
      },
      
      // Limpiar entradas más antiguas
      cleanOldest: function() {
        let oldest = null;
        let oldestTime = Date.now();
        
        for (const [key, item] of this.processedImages.entries()) {
          if (item.timestamp < oldestTime) {
            oldestTime = item.timestamp;
            oldest = key;
          }
        }
        
        if (oldest) {
          this.processedImages.delete(oldest);
        }
      },
      
      // Estimar tamaño de datos
      estimateSize: function(data) {
        if (typeof data === 'string') {
          return data.length * 2; // UTF-16
        }
        return 1000; // Estimación por defecto
      },
      
      // Limpiar cache completo
      clear: function() {
        this.processedImages.clear();
        this.thumbnails.clear();
        this.watermarkImage = null;
        this.lastWatermarkConfig = null;
      },
      
      // Obtener estadísticas del cache
      getStats: function() {
        const totalSize = Array.from(this.processedImages.values())
          .reduce((sum, item) => sum + (item.size || 0), 0);
          
        return {
          entries: this.processedImages.size,
          totalSize: totalSize,
          maxSize: this.maxSize,
          hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
        };
      }
    };

    // WorkerManager extraído a js/managers/worker-manager.js

    // FallbackProcessor extraído a js/utils/fallback-processor.js

    // SmartDebounce extraído a js/utils/smart-debounce.js

    // FilterCache extraído a js/utils/filter-cache.js

    // FilterLoadingManager extraído a js/managers/filter-loading-manager.js

    // Funciones utilitarias extraídas a js/utils/helpers.js

    // Optimized preview update with intelligent debouncing
    const debouncedUpdatePreview = SmartDebounce.intelligent('preview-update', updatePreview, 150);
    const immediatePreviewUpdate = SmartDebounce.immediate('preview-immediate', updatePreview, 50);

    // Utility functions
    const utils = {
      showLoading: (element) => {
        element.classList.add('loading');
      },
      
      hideLoading: (element) => {
        element.classList.remove('loading');
      },
      
      createProgressBar: (container) => {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = '0%';
        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);
        return progressFill;
      },
      
      updateProgress: (progressElement, percentage) => {
        progressElement.style.width = `${percentage}%`;
      },
      
      removeProgress: (container) => {
        const progressBar = container.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.remove();
        }
      }
    };

    document.addEventListener('DOMContentLoaded', function() {
      initializeApp();
      setupFileNaming();
      initializeTheme();
      
    });

    // UIManager extraído a js/managers/ui-manager.js

    function initializeApp() {
      console.log('Aplicación cargada');
      
      try {
        // Obtener elementos del DOM
        canvas = document.getElementById('preview-canvas');
        if (!canvas) {
          throw new Error('Canvas element not found');
        }
        
        ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context not available');
        }
        
        // Configurar event listeners
        setupEventListeners();
        
        // Configurar event listeners de filtros con delay para asegurar DOM
        setTimeout(() => {
          console.log('=== CONFIGURACIÓN TARDÍA DE FILTROS ===');
          setupFilterListeners();
        }, 500);
        
        // Configurar collapsibles
        setupCollapsibles();
        
        // Configurar validación en tiempo real
        setupFormValidation();
        
        // Configurar interceptores de errores globales
        setupGlobalErrorHandling();
        
        // Cargar metadatos guardados
        MetadataManager.loadSavedMetadata();
        
        // Initialize character counters
        initCharacterCounters();
        
        // Initialize rotation functionality
        initRotation();
        
        // Initialize zoom keyboard shortcuts
        initZoomKeyboardShortcuts();
        
        // Initialize mouse wheel zoom
        initMouseWheelZoom();
        
        // Initialize pan navigation
        initPanNavigation();
        
        // Initialize mobile responsive features
        initMobileFeatures();
        
        // Inicializar estado de marcas de agua
        setTimeout(() => {
          toggleWatermarkType();
          // Inicializar modo de posicionamiento
          togglePositioningMode();
          // Inicializar controles de salida
          initializeOutputControls();
        }, 100);
        
        console.log('Aplicación inicializada correctamente');
        
      } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        UIManager.showError('Error al inicializar la aplicación. Por favor, recarga la página.');
      }
    }

    // Global error handling setup
    function setupGlobalErrorHandling() {
      // Manejar errores no capturados
      window.addEventListener('error', function(event) {
        console.error('Error global capturado:', event.error);
        UIManager.showError('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.');
      });

      // Manejar promesas rechazadas no capturadas
      window.addEventListener('unhandledrejection', function(event) {
        console.error('Promesa rechazada no manejada:', event.reason);
        UIManager.showError('Error de procesamiento. Por favor, inténtalo de nuevo.');
        event.preventDefault();
      });
    }

    // Enhanced form validation setup
    function setupFormValidation() {
      // Validación para campos de metadatos
      FormValidator.setupRealTimeValidation('title', (value) => {
        if (value.length > 100) {
          return { valid: false, message: 'El título no puede exceder 100 caracteres' };
        }
        return { valid: true };
      });

      FormValidator.setupRealTimeValidation('author', (value) => {
        if (value.length > 100) {
          return { valid: false, message: 'El autor no puede exceder 100 caracteres' };
        }
        return { valid: true };
      });

      FormValidator.setupRealTimeValidation('description', (value) => {
        if (value.length > 500) {
          return { valid: false, message: 'La descripción no puede exceder 500 caracteres' };
        }
        return { valid: true };
      });

      FormValidator.setupRealTimeValidation('keywords', (value) => {
        if (value.length > 200) {
          return { valid: false, message: 'Las palabras clave no pueden exceder 200 caracteres' };
        }
        return { valid: true };
      });

      FormValidator.setupRealTimeValidation('copyright', (value) => {
        if (value.length > 200) {
          return { valid: false, message: 'El copyright no puede exceder 200 caracteres' };
        }
        return { valid: true };
      });

      // Validación para marca de agua de texto
      FormValidator.setupRealTimeValidation('watermark-text', (value) => {
        if (value.length > 100) {
          return { valid: false, message: 'El texto de marca de agua no puede exceder 100 caracteres' };
        }
        // Verificar caracteres especiales peligrosos
        if (/<script|javascript:|on\w+=/i.test(value)) {
          return { valid: false, message: 'El texto contiene caracteres no permitidos' };
        }
        return { valid: true };
      });

      // Validación para dimensiones personalizadas
      FormValidator.setupRealTimeValidation('watermark-image-width', (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 10 || num > 2000) {
          return { valid: false, message: 'El ancho debe estar entre 10 y 2000 píxeles' };
        }
        return { valid: true };
      });

      FormValidator.setupRealTimeValidation('watermark-image-height', (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 10 || num > 2000) {
          return { valid: false, message: 'La altura debe estar entre 10 y 2000 píxeles' };
        }
        return { valid: true };
      });

      // Validación para calidad de imagen
      FormValidator.setupRealTimeValidation('quality-number', (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 100) {
          return { valid: false, message: 'La calidad debe estar entre 1% y 100%' };
        }
        return { valid: true };
      });
    }

    // Initialize output controls
    function initializeOutputControls() {
      try {
        // Initialize quality control
        const qualitySelect = document.getElementById('output-quality');
        const qualityNumber = document.getElementById('quality-number');
        
        if (qualitySelect && qualityNumber) {
          // Set default value
          qualitySelect.value = '80';
          qualityNumber.value = '80';
          handleQualityChange();
        }
        
        // Initialize format control
        const formatSelect = document.getElementById('output-format');
        if (formatSelect) {
          // Set default format based on original file or JPEG
          if (originalExtension && ['jpg', 'jpeg'].includes(originalExtension.toLowerCase())) {
            formatSelect.value = 'jpeg';
          } else if (originalExtension && ['png'].includes(originalExtension.toLowerCase())) {
            formatSelect.value = 'png';
          } else if (originalExtension && ['webp'].includes(originalExtension.toLowerCase())) {
            formatSelect.value = 'webp';
          } else if (originalExtension && ['avif'].includes(originalExtension.toLowerCase())) {
            formatSelect.value = 'avif';
          } else {
            formatSelect.value = 'jpeg'; // default fallback
          }
          handleFormatChange();
        }
        
        // Check format support and disable unsupported formats
        checkAndUpdateFormatSupport();
        
        console.log('Output controls initialized successfully');
      } catch (error) {
        console.error('Error initializing output controls:', error);
      }
    }

    // Check format support and update UI
    async function checkAndUpdateFormatSupport() {
      const formatSelect = document.getElementById('output-format');
      if (!formatSelect) return;
      
      const formats = ['webp', 'avif'];
      
      for (const format of formats) {
        const isSupported = await checkFormatSupport(format);
        const option = formatSelect.querySelector(`option[value="${format}"]`);
        
        if (option) {
          if (!isSupported) {
            option.disabled = true;
            option.textContent += ' (No soportado)';
            option.style.color = '#9ca3af';
          }
        }
      }
    }

    // Funciones del tema oscuro
    function initializeTheme() {
      const themeToggle = document.getElementById('theme-toggle');
      const themeIcon = document.getElementById('theme-icon');
      
      // Cargar tema guardado o usar preferencia del sistema
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
      
      setTheme(currentTheme);
      
      // Escuchar cambios en las preferencias del sistema
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }

    function setTheme(theme) {
      console.log('SetTheme llamado con:', theme);
      const themeIcon = document.getElementById('theme-icon');
      const html = document.documentElement;
      
      if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (themeIcon) {
          themeIcon.className = 'fas fa-sun';
        }
        console.log('Tema oscuro aplicado');
      } else {
        html.removeAttribute('data-theme');
        if (themeIcon) {
          themeIcon.className = 'fas fa-moon';
        }
        console.log('Tema claro aplicado');
      }
      
      localStorage.setItem('theme', theme);
    }

    function toggleTheme() {
      console.log('Toggle theme llamado');
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      console.log('Cambiando de', currentTheme, 'a', newTheme);
      setTheme(newTheme);
    }

    function setupFileNaming() {
      const titleInput = document.getElementById('metaTitle');
      const fileInput = document.getElementById('file-input');

      // Agregar funcionalidad para seleccionar todo el texto al hacer clic
      titleInput.addEventListener('click', function() {
        this.select();
      });

      // También seleccionar todo al recibir foco (tabulación)
      titleInput.addEventListener('focus', function() {
        this.select();
      });

      // Cuando se selecciona un archivo
      fileInput.addEventListener('change', function(e) {
        if (e.target.files.length) {
          currentFile = e.target.files[0];
          // Guardar la extensión original del archivo
          originalExtension = currentFile.name.split('.').pop().toLowerCase();
          
          // Obtener el nombre del archivo sin extensión
          const fileNameWithoutExtension = currentFile.name.replace(/\.[^/.]+$/, "");
          
          // Actualizar el placeholder del campo título
          titleInput.placeholder = fileNameWithoutExtension;
          
          // Establecer el título inicial como el nombre del archivo (sin extensión)
          if (!titleInput.value.trim()) {
            titleInput.value = fileNameWithoutExtension;
          }
        }
      });
    }

    // Security Manager extraído a js/managers/security-manager.js
    
    // Form Validation Manager
    const FormValidator = {
      // Mostrar errores de validación
      showFieldError: function(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Remover errores anteriores
        this.clearFieldError(fieldId);

        // Crear elemento de error
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        errorElement.id = `${fieldId}-error`;

        // Insertar después del campo
        field.parentNode.insertBefore(errorElement, field.nextSibling);
        
        // Agregar clase de error al campo
        field.classList.add('field-invalid');
      },

      // Limpiar errores de campo
      clearFieldError: function(fieldId) {
        const field = document.getElementById(fieldId);
        const errorElement = document.getElementById(`${fieldId}-error`);
        
        if (field) {
          field.classList.remove('field-invalid');
        }
        
        if (errorElement) {
          errorElement.remove();
        }
      },

      // Limpiar todos los errores del formulario
      clearFormErrors: function(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const errorElements = form.querySelectorAll('.field-error');
        const invalidFields = form.querySelectorAll('.field-invalid');

        errorElements.forEach(el => el.remove());
        invalidFields.forEach(field => field.classList.remove('field-invalid'));
      },

      // Validación en tiempo real
      setupRealTimeValidation: function(fieldId, validator) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const validateField = debounce(() => {
          const isValid = validator(field.value);
          if (!isValid.valid) {
            this.showFieldError(fieldId, isValid.message);
          } else {
            this.clearFieldError(fieldId);
          }
        }, 300);

        field.addEventListener('input', validateField);
        field.addEventListener('blur', validateField);
      }
    };

    function setupEventListeners() {
      try {
        console.log('=== CONFIGURANDO EVENT LISTENERS ===');
        
        // Configurar listeners para controles de filtros
        console.log('Configurando event listeners para filtros...');
        ['brightness', 'contrast', 'saturation', 'blur'].forEach(filter => {
          const slider = document.getElementById(filter);
          console.log(`Slider ${filter}:`, slider ? 'encontrado' : 'NO encontrado');
          if (slider) {
            slider.addEventListener('input', (e) => {
              FilterManager.applyFilter(filter, parseInt(e.target.value));
            });
          }
        });
        
        // Configurar presets de filtros
        const presetButtons = document.querySelectorAll('.filter-preset');
        console.log(`Botones de presets encontrados: ${presetButtons.length}`);
        presetButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            console.log(`Aplicando preset: ${btn.dataset.filter}`);
            FilterManager.applyPreset(btn.dataset.filter);
          });
        });
        
        // Listener para reset de filtros
        const resetFiltersBtn = document.getElementById('resetFilters');
        if (resetFiltersBtn) {
          resetFiltersBtn.addEventListener('click', resetFilters);
        }
        
        // Listeners para metadatos y geolocalización
        const autocopyrightBtn = document.getElementById('autoCopyright');
        if (autocopyrightBtn) {
          autocopyrightBtn.addEventListener('click', generateAutoCopyright);
        }
        
        const getCurrentLocationBtn = document.getElementById('getCurrentLocation');
        if (getCurrentLocationBtn) {
          getCurrentLocationBtn.addEventListener('click', () => {
            MetadataManager.getCurrentLocation();
          });
        }
        
        // Auto-actualizar copyright cuando cambia el autor
        const authorInput = document.getElementById('metaAuthor');
        if (authorInput) {
          authorInput.addEventListener('blur', () => {
            const copyrightInput = document.getElementById('metaCopyright');
            if (authorInput.value && !copyrightInput.value) {
              // Solo generar automáticamente si no hay copyright ya escrito
              setTimeout(() => generateAutoCopyright(), 100);
            }
          });
        }
        
        // Upload de archivos con optimización
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('file-input');
        const fileSelector = document.getElementById('file-selector');
        const removeFile = document.getElementById('remove-file');
        
        // Solo configurar si los elementos existen
        if (dropArea && fileInput && fileSelector && removeFile) {
          // Simplified drag and drop without throttling for testing
          dropArea.addEventListener('dragover', handleDragOver);
          dropArea.addEventListener('dragleave', handleDragLeave);
          dropArea.addEventListener('drop', handleDrop);
          
          // Enhanced file selector
          fileSelector.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', handleFileSelect);
          removeFile.addEventListener('click', removeSelectedFile);
        }
        
        // Form submissions with loading states
        const metadataForm = document.getElementById('metadata-form');
        const watermarkForm = document.getElementById('watermark-form');
        
        if (metadataForm) {
          metadataForm.addEventListener('submit', handleMetadataSubmit);
        }
        
        if (watermarkForm) {
          watermarkForm.addEventListener('submit', handleWatermarkSubmit);
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        const zoomLevel = document.getElementById('zoom-level');

        if (zoomInBtn && zoomOutBtn && zoomResetBtn) {
          zoomInBtn.addEventListener('click', zoomIn);
          zoomOutBtn.addEventListener('click', zoomOut);
          zoomResetBtn.addEventListener('click', resetZoom);
        }
        
        // Watermark type toggle
        const textEnabledCheckbox = document.getElementById('watermark-text-enabled');
        const imageEnabledCheckbox = document.getElementById('watermark-image-enabled');
        
        if (textEnabledCheckbox) {
          textEnabledCheckbox.addEventListener('change', toggleWatermarkType);
        }
        
        if (imageEnabledCheckbox) {
          imageEnabledCheckbox.addEventListener('change', toggleWatermarkType);
        }
        
        // Custom image size toggle
        const watermarkImageSize = document.getElementById('watermark-image-size');
        if (watermarkImageSize) {
          watermarkImageSize.addEventListener('change', toggleCustomImageSize);
        }
        
        // Real-time controls with debouncing for better performance - con verificación de existencia
        const controls = [
          { id: 'watermark-text-enabled', event: 'change' },
          { id: 'watermark-image-enabled', event: 'change' },
          { id: 'watermark-text', event: 'input' },
          { id: 'watermark-font', event: 'change' },
          { id: 'watermark-color', event: 'change' },
          { id: 'watermark-size', event: 'input' },
          { id: 'watermark-opacity', event: 'input' },
          { id: 'watermark-position', event: 'change' },
          { id: 'watermark-image-size', event: 'change' },
          { id: 'watermark-image-opacity', event: 'input' },
          { id: 'watermark-image-position', event: 'change' },
          { id: 'watermark-image-width', event: 'input' },
          { id: 'watermark-image-height', event: 'input' }
        ];
        
        controls.forEach(({ id, event }) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener(event, debouncedUpdatePreview);
          }
        });
        
        // Posicionamiento personalizado para imagen
        const watermarkImagePosition = document.getElementById('watermark-image-position');
        if (watermarkImagePosition) {
          watermarkImagePosition.addEventListener('change', togglePositioningMode);
        }
        
        // Event listener para el canvas en modo posicionamiento
        if (canvas) {
          canvas.addEventListener('click', handleCanvasClick);
        }
        
        // Image watermark controls
        const watermarkImage = document.getElementById('watermark-image');
        if (watermarkImage) {
          watermarkImage.addEventListener('change', handleWatermarkImageChange);
        }
        
        // Action buttons
        const resetChangesBtn = document.getElementById('reset-changes');
        const downloadImageBtn = document.getElementById('download-image');
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (resetChangesBtn) {
          resetChangesBtn.addEventListener('click', resetChanges);
        }
        
        if (downloadImageBtn) {
          downloadImageBtn.addEventListener('click', downloadImageWithProgress);
        }
        
        if (undoBtn) {
          undoBtn.addEventListener('click', () => historyManager.undo());
        }
        
        if (redoBtn) {
          redoBtn.addEventListener('click', () => historyManager.redo());
        }
        
        // Compare and fullscreen buttons
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        
        console.log('Botón fullscreen encontrado:', fullscreenBtn);
        
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', toggleFullscreen);
        }
        
        // Theme toggle button - CRÍTICO PARA EL MODO OSCURO
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
          themeToggle.addEventListener('click', toggleTheme);
          console.log('Event listener del tema configurado correctamente');
        } else {
          console.error('Botón de tema no encontrado');
        }
        
        // Output configuration controls
        const outputQualitySelect = document.getElementById('output-quality');
        const outputQualityNumber = document.getElementById('quality-number');
        const outputFormatSelect = document.getElementById('output-format');
        const outputHeader = document.getElementById('output-header');
        
        if (outputQualitySelect) {
          outputQualitySelect.addEventListener('input', handleQualityChange);
          outputQualitySelect.addEventListener('change', handleQualityChange);
        }
        
        if (outputQualityNumber) {
          outputQualityNumber.addEventListener('input', handleQualityNumberChange);
          outputQualityNumber.addEventListener('change', handleQualityNumberChange);
          outputQualityNumber.addEventListener('blur', handleQualityNumberChange);
          // Handle Enter key
          outputQualityNumber.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.target.blur();
            }
          });
        }
        
        if (outputFormatSelect) {
          outputFormatSelect.addEventListener('change', handleFormatChange);
        }
        
        if (outputHeader) {
          outputHeader.addEventListener('click', () => toggleCollapsible('output'));
          outputHeader.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleCollapsible('output');
            }
          });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
      } catch (error) {
        console.error('Error configurando event listeners:', error);
      }
    }

    // Configurar listeners de filtros con retraso para asegurar que el DOM esté listo
    function setupFilterListeners() {
      console.log('🔧 Configurando listeners de filtros...');
      
      // Listeners para los sliders de filtros
      const filterSliders = ['brightness', 'contrast', 'saturation', 'blur'];
      filterSliders.forEach(filterId => {
        const slider = document.getElementById(filterId);
        const valueDisplay = document.getElementById(filterId + '-value');
        
        if (slider && valueDisplay) {
          console.log(`✅ Configurando listener para ${filterId}`);
          slider.addEventListener('input', (e) => {
            const value = e.target.value;
            valueDisplay.textContent = value;
            console.log(`🎚️ ${filterId} cambiado a: ${value}`);
            
            if (typeof FilterManager !== 'undefined' && FilterManager.applyFilter) {
              FilterManager.applyFilter();
            } else {
              console.warn('❌ FilterManager no está disponible');
            }
          });
        } else {
          console.warn(`❌ No se encontró elemento para ${filterId}`);
          console.warn(`    - Slider encontrado: ${!!slider}`);
          console.warn(`    - ValueDisplay encontrado: ${!!valueDisplay}`);
        }
      });
      
      // Listeners para los botones de presets
      const presetButtons = document.querySelectorAll('.preset-btn');
      console.log(`🎯 Configurando ${presetButtons.length} botones de preset`);
      
      presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const preset = e.target.dataset.preset;
          console.log(`🎨 Aplicando preset: ${preset}`);
          
          if (typeof FilterManager !== 'undefined' && FilterManager.applyPreset) {
            FilterManager.applyPreset(preset);
          } else {
            console.warn('❌ FilterManager no está disponible para preset');
          }
        });
      });
      
      // Listener para el botón de reset
      const resetBtn = document.getElementById('resetFilters');
      if (resetBtn) {
        console.log('🔄 Configurando botón de reset de filtros');
        resetBtn.addEventListener('click', () => {
          console.log('🧹 Reseteando filtros');
          if (typeof FilterManager !== 'undefined' && FilterManager.reset) {
            FilterManager.reset();
          } else {
            console.warn('❌ FilterManager no está disponible para reset');
          }
        });
      }
    }

    function handleWatermarkImageChange() {
      // Clear cache when new image is selected
      cache.watermarkImage = null;
      cache.lastWatermarkConfig = null;
      debouncedUpdatePreview();
    }

    // Output configuration handlers
    function handleQualityChange() {
      const qualitySelect = document.getElementById('output-quality');
      const qualityNumber = document.getElementById('quality-number');
      const qualityPercentage = document.getElementById('quality-percentage');
      const qualityBar = document.getElementById('quality-bar');
      
      if (!qualitySelect || !qualityNumber || !qualityPercentage || !qualityBar) return;
      
      const qualityValue = parseInt(qualitySelect.value);
      outputQuality = qualityValue / 100;
      
      // Sync the number input with slider
      qualityNumber.value = qualityValue;
      
      // Update percentage display
      qualityPercentage.textContent = qualityValue + '%';
      
      // Update progress bar with smooth animation
      qualityBar.style.width = qualityValue + '%';
      
      // Update color based on quality with more nuanced ranges
      if (qualityValue <= 30) {
        qualityPercentage.className = 'text-sm font-bold text-red-600';
      } else if (qualityValue <= 50) {
        qualityPercentage.className = 'text-sm font-bold text-orange-600';
      } else if (qualityValue <= 70) {
        qualityPercentage.className = 'text-sm font-bold text-yellow-600';
      } else if (qualityValue <= 85) {
        qualityPercentage.className = 'text-sm font-bold text-blue-600';
      } else {
        qualityPercentage.className = 'text-sm font-bold text-green-600';
      }
      
      // Update the slider track color dynamically
      updateSliderBackground(qualityValue);
      
      console.log('Quality changed to:', qualityValue + '%');
    }

    function handleQualityNumberChange() {
      const qualitySelect = document.getElementById('output-quality');
      const qualityNumber = document.getElementById('quality-number');
      
      if (!qualitySelect || !qualityNumber) return;
      
      let qualityValue = parseInt(qualityNumber.value);
      
      // Validate and constrain the value
      if (isNaN(qualityValue) || qualityValue < 1) {
        qualityValue = 1;
      } else if (qualityValue > 100) {
        qualityValue = 100;
      }
      
      // Update both inputs
      qualityNumber.value = qualityValue;
      qualitySelect.value = qualityValue;
      
      // Trigger the main quality change handler
      handleQualityChange();
    }

    function updateSliderBackground(value) {
      const slider = document.getElementById('output-quality');
      if (!slider) return;
      
      // Create a dynamic gradient based on the current value
      const percentage = value / 100;
      const hue1 = 0;   // Red
      const hue2 = 45;  // Orange/Yellow  
      const hue3 = 120; // Green
      
      let currentHue;
      if (percentage <= 0.5) {
        // Interpolate between red and yellow
        currentHue = hue1 + (hue2 - hue1) * (percentage * 2);
      } else {
        // Interpolate between yellow and green
        currentHue = hue2 + (hue3 - hue2) * ((percentage - 0.5) * 2);
      }
      
      const saturation = 70;
      const lightness = 55;
      
      // Update CSS custom property for dynamic coloring
      slider.style.setProperty('--slider-color', `hsl(${currentHue}, ${saturation}%, ${lightness}%)`);
    }

    function handleFormatChange() {
      const formatSelect = document.getElementById('output-format');
      const formatInfo = document.getElementById('format-info');
      const formatTitle = document.getElementById('format-title');
      const formatDescription = document.getElementById('format-description');
      const formatCompatibility = document.getElementById('format-compatibility');
      
      if (!formatSelect || !formatInfo || !formatTitle || !formatDescription || !formatCompatibility) return;
      
      outputFormat = formatSelect.value;
      
      // Remove previous format classes
      formatInfo.className = formatInfo.className.replace(/format-\w+/g, '');
      formatInfo.classList.add('p-3', 'border', 'rounded-md', `format-${outputFormat}`);
      
      // Update format information
      const formatData = getFormatInfo(outputFormat);
      formatTitle.textContent = formatData.title;
      formatDescription.textContent = formatData.description;
      formatCompatibility.textContent = formatData.compatibility;
      formatCompatibility.className = `text-xs mt-1 font-medium ${formatData.compatibilityClass}`;
      
      console.log('Format changed to:', outputFormat);
    }

    function getFormatInfo(format) {
      const formatInfo = {
        jpeg: {
          title: 'JPEG (.jpg)',
          description: 'Ideal para fotografías, menor tamaño de archivo.',
          compatibility: '✓ Compatible con todos los navegadores',
          compatibilityClass: 'text-green-600'
        },
        png: {
          title: 'PNG (.png)',
          description: 'Ideal para imágenes con transparencia, sin pérdida de calidad.',
          compatibility: '✓ Compatible con todos los navegadores',
          compatibilityClass: 'text-green-600'
        },
        webp: {
          title: 'WebP (.webp)',
          description: 'Mejor compresión que JPEG/PNG, menor tamaño de archivo.',
          compatibility: '✓ Compatible con navegadores modernos (95%+)',
          compatibilityClass: 'text-blue-600'
        },
        avif: {
          title: 'AVIF (.avif)',
          description: 'Nueva generación, máxima compresión y calidad.',
          compatibility: '⚠ Compatible con navegadores recientes (80%+)',
          compatibilityClass: 'text-orange-600'
        }
      };
      
      return formatInfo[format] || formatInfo.jpeg;
    }

    // Function to check format support
    function checkFormatSupport(format) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        try {
          const mimeType = `image/${format}`;
          canvas.toBlob((blob) => {
            resolve(blob !== null);
          }, mimeType, 1);
        } catch (error) {
          resolve(false);
        }
        
        // Timeout fallback
        setTimeout(() => resolve(false), 100);
      });
    }

    function handleKeyboardShortcuts(e) {
      // Ctrl+S or Cmd+S to download
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canvas && currentImage) {
          downloadImage();
        }
      }
      
      // Ctrl+Z or Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyManager.canUndo()) {
          historyManager.undo();
        }
      }
      
      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z to redo
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        if (historyManager.canRedo()) {
          historyManager.redo();
        }
      }
      
      // Ctrl+R or Cmd+R to reset (prevent page reload)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (currentImage) {
          resetChanges();
        }
      }
      
      // Escape to close any modals or reset focus
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
    }

    function setupCollapsibles() {
      const metadataHeader = document.getElementById('metadata-header');
      const watermarkHeader = document.getElementById('watermark-header');
      
      metadataHeader.addEventListener('click', () => toggleCollapsible('metadata'));
      watermarkHeader.addEventListener('click', () => toggleCollapsible('watermark'));
      
      metadataHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCollapsible('metadata');
        }
      });
      
      watermarkHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCollapsible('watermark');
        }
      });
    }

    function toggleCollapsible(section) {
      const header = document.getElementById(`${section}-header`);
      const content = document.getElementById(`${section}-content`);
      const icon = header.querySelector('.section__icon');
      
      const isOpen = content.classList.contains('section__content--open');
      
      if (isOpen) {
        content.classList.remove('section__content--open');
        icon.classList.add('section__icon--collapsed');
        header.setAttribute('aria-expanded', 'false');
        content.setAttribute('aria-hidden', 'true');
      } else {
        content.classList.add('section__content--open');
        icon.classList.remove('section__icon--collapsed');
        header.setAttribute('aria-expanded', 'true');
        content.setAttribute('aria-hidden', 'false');
      }
    }

    function handleDragOver(e) {
      e.preventDefault();
      document.getElementById('drop-area').classList.add('upload__dropzone--active');
    }

    function handleDragLeave(e) {
      e.preventDefault();
      document.getElementById('drop-area').classList.remove('upload__dropzone--active');
    }

    function handleDrop(e) {
      e.preventDefault();
      document.getElementById('drop-area').classList.remove('upload__dropzone--active');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    }

    function handleFileSelect(e) {
      const file = e.target.files[0];
      if (file) {
        handleFile(file);
      }
    }

    // Enhanced file handling with security validation and preview
    function handleFile(file) {
      // Limpiar errores anteriores
      UIManager.hideError();
      
      // Validación completa del archivo
      const validation = SecurityManager.validateImageFile(file);
      
      if (!validation.isValid) {
        // Mostrar errores específicos con detalles
        validation.errors.forEach(error => {
          let errorMessage = error.message;
          if (error.details) {
            errorMessage += `: ${error.details}`;
          }
          UIManager.showError(errorMessage);
        });
        return;
      }

      // Mostrar advertencias si existen
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          console.warn('Advertencia:', warning.message, warning.details);
          // Opcionalmente mostrar advertencias al usuario
          UIManager.showWarning && UIManager.showWarning(warning.message);
        });
      }

      // Mostrar preview del archivo antes de cargar
      UIManager.showLoadingState('Generando preview...');
      
      SecurityManager.generateFilePreview(file, function(previewData, error) {
        if (error) {
          UIManager.hideLoadingState();
          UIManager.showError('Error al generar preview: ' + error);
          return;
        }

        // Mostrar preview al usuario
        showFilePreview(previewData, function(userConfirmed) {
          if (!userConfirmed) {
            UIManager.hideLoadingState();
            return;
          }

          // Usuario confirmó, proceder con la carga
          loadImageWithValidation(file, previewData.originalDimensions);
        });
      });
    }

    // Función para mostrar preview del archivo
    function showFilePreview(previewData, callback) {
      const previewModal = document.createElement('div');
      previewModal.className = 'file-preview-modal';
      previewModal.innerHTML = `
        <div class="preview-overlay">
          <div class="preview-container">
            <div class="preview-header">
              <h3>Vista previa del archivo</h3>
              <button class="preview-close" type="button">&times;</button>
            </div>
            <div class="preview-content">
              <div class="preview-image-container">
                <img src="${previewData.dataUrl}" alt="Preview" class="preview-image">
              </div>
              <div class="preview-info">
                <h4>Información del archivo:</h4>
                <ul>
                  <li><strong>Nombre:</strong> ${previewData.fileInfo.name}</li>
                  <li><strong>Tamaño:</strong> ${previewData.fileInfo.size}</li>
                  <li><strong>Tipo:</strong> ${previewData.fileInfo.type}</li>
                  <li><strong>Dimensiones:</strong> ${previewData.originalDimensions.width}x${previewData.originalDimensions.height}px</li>
                  <li><strong>Modificado:</strong> ${previewData.fileInfo.lastModified}</li>
                </ul>
              </div>
            </div>
            <div class="preview-actions">
              <button class="btn btn-secondary preview-cancel" type="button">Cancelar</button>
              <button class="btn btn-primary preview-confirm" type="button">Cargar imagen</button>
            </div>
          </div>
        </div>
      `;

      // Agregar estilos CSS para el modal de preview
      if (!document.getElementById('preview-modal-styles')) {
        const previewStyles = document.createElement('style');
        previewStyles.id = 'preview-modal-styles';
        previewStyles.textContent = `
          .file-preview-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .preview-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
          }
          
          .preview-container {
            position: relative;
            background: var(--bg-card, #ffffff);
            border-radius: 12px;
            max-width: 600px;
            max-height: 80vh;
            margin: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .preview-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color, #e2e8f0);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-secondary, #f8f9fa);
          }
          
          .preview-header h3 {
            margin: 0;
            color: var(--text-primary, #0f172a);
            font-size: 1.25rem;
            font-weight: 600;
          }
          
          .preview-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary, #64748b);
            padding: 4px;
            line-height: 1;
          }
          
          .preview-close:hover {
            color: var(--text-primary, #0f172a);
          }
          
          .preview-content {
            padding: 20px;
            display: flex;
            gap: 20px;
            flex: 1;
            overflow: auto;
          }
          
          .preview-image-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-tertiary, #f1f5f9);
            border-radius: 8px;
            min-height: 200px;
          }
          
          .preview-image {
            max-width: 100%;
            max-height: 300px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          
          .preview-info {
            flex: 1;
            min-width: 250px;
          }
          
          .preview-info h4 {
            margin: 0 0 12px 0;
            color: var(--text-primary, #0f172a);
            font-size: 1rem;
            font-weight: 600;
          }
          
          .preview-info ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .preview-info li {
            padding: 6px 0;
            color: var(--text-secondary, #64748b);
            font-size: 0.875rem;
            border-bottom: 1px solid var(--border-color, #e2e8f0);
          }
          
          .preview-info li:last-child {
            border-bottom: none;
          }
          
          .preview-info strong {
            color: var(--text-primary, #0f172a);
          }
          
          .preview-actions {
            padding: 20px;
            border-top: 1px solid var(--border-color, #e2e8f0);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: var(--bg-secondary, #f8f9fa);
          }
          
          @media (max-width: 768px) {
            .preview-container {
              margin: 10px;
              max-height: 90vh;
            }
            
            .preview-content {
              flex-direction: column;
              padding: 15px;
            }
            
            .preview-info {
              min-width: auto;
            }
          }
        `;
        document.head.appendChild(previewStyles);
      }

      document.body.appendChild(previewModal);

      // Event listeners
      const closeBtn = previewModal.querySelector('.preview-close');
      const cancelBtn = previewModal.querySelector('.preview-cancel');
      const confirmBtn = previewModal.querySelector('.preview-confirm');
      const overlay = previewModal.querySelector('.preview-overlay');

      function closePreview(confirmed = false) {
        document.body.removeChild(previewModal);
        callback(confirmed);
      }

      closeBtn.addEventListener('click', () => closePreview(false));
      cancelBtn.addEventListener('click', () => closePreview(false));
      confirmBtn.addEventListener('click', () => closePreview(true));
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closePreview(false);
        }
      });

      // Escape key to close
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escapeHandler);
          closePreview(false);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }

    // Función para cargar imagen con validación de dimensiones
    function loadImageWithValidation(file, knownDimensions = null) {
      UIManager.showLoadingState('Validando imagen...');

      // Guardar información del archivo
      currentFile = file;
      const fileExtension = file.name.split('.').pop().toLowerCase();
      originalExtension = fileExtension;
      
      // Verificación adicional del tipo MIME vs extensión
      const mimeToExt = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/avif': ['avif']
      };
      
      const allowedExtensionsForMime = mimeToExt[file.type];
      if (!allowedExtensionsForMime || !allowedExtensionsForMime.includes(fileExtension)) {
        UIManager.hideLoadingState();
        UIManager.showError('La extensión del archivo no coincide con su tipo');
        return;
      }

      // Leer archivo con manejo de errores mejorado
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const img = new Image();
          
          img.onload = function() {
            // Validar dimensiones
            const dimensionValidation = SecurityManager.validateImageDimensions(img);
            
            if (!dimensionValidation.isValid) {
              UIManager.hideLoadingState();
              dimensionValidation.errors.forEach(error => {
                UIManager.showError(`${error.message}: ${error.details}`);
              });
              return;
            }

            // Mostrar advertencias sobre dimensiones si existen
            if (dimensionValidation.warnings && dimensionValidation.warnings.length > 0) {
              dimensionValidation.warnings.forEach(warning => {
                console.warn('Advertencia de dimensiones:', warning.message, warning.details);
              });
            }

            // Proceder con la carga normal
            loadImage(e.target.result, file.name);
          };

          img.onerror = function() {
            UIManager.hideLoadingState();
            UIManager.showError('Error al cargar la imagen. El archivo podría estar corrupto.');
          };

          img.src = e.target.result;
        } catch (error) {
          UIManager.hideLoadingState();
          console.error('Error al procesar la imagen:', error);
          UIManager.showError('Error al procesar la imagen. Por favor, inténtalo de nuevo.');
        }
      };
      
      reader.onerror = function() {
        UIManager.hideLoadingState();
        UIManager.showError('Error al leer el archivo. Por favor, inténtalo de nuevo.');
      };

      reader.readAsDataURL(file);
    }    // Enhanced image loading with validation
    function loadImage(src, fileName) {
      const img = new Image();
      
      img.onload = function() {
        try {
          // Validar dimensiones de la imagen
          if (img.width < 1 || img.height < 1) {
            UIManager.hideLoadingState();
            UIManager.showError('La imagen no tiene dimensiones válidas');
            return;
          }

          // Validar dimensiones máximas (opcional)
          const maxDimension = 8192; // 8K máximo
          if (img.width > maxDimension || img.height > maxDimension) {
            UIManager.hideLoadingState();
            UIManager.showError(`Las dimensiones de la imagen son demasiado grandes. Máximo ${maxDimension}x${maxDimension} píxeles.`);
            return;
          }

          currentImage = img;
          
          // Store original dimensions for resize functionality
          originalWidth = img.width;
          originalHeight = img.height;
          
          // Reset rotation state when loading new image
          currentRotation = 0;
          isFlippedHorizontally = false;
          isFlippedVertically = false;
          
          console.log('=== IMAGEN CARGADA ===');
          console.log('currentImage asignado:', !!currentImage);
          console.log('Dimensiones originales:', originalWidth, 'x', originalHeight);
          
          // Sanitizar y mostrar información del archivo
          const sanitizedFileName = SecurityManager.sanitizeText(fileName);
          const fileNameElement = document.getElementById('file-name');
          const fileInfoElement = document.getElementById('file-info');
          
          if (fileNameElement) {
            fileNameElement.textContent = sanitizedFileName;
          }
          
          if (fileInfoElement) {
            fileInfoElement.classList.remove('file-info--hidden');
          }
          
          // Establecer título inicial si está vacío
          const titleInput = document.getElementById('metaTitle');
          if (titleInput && !titleInput.value.trim()) {
            const nameWithoutExt = sanitizedFileName.replace(/\.[^/.]+$/, "");
            titleInput.value = SecurityManager.sanitizeText(nameWithoutExt);
            titleInput.placeholder = nameWithoutExt;
          }
          
          // Mostrar editor
          const editorContainer = document.getElementById('editor-container');
          if (editorContainer) {
            editorContainer.classList.remove('editor-container--hidden');
          }
          
          // Mostrar controles de zoom
          const zoomControls = document.getElementById('zoom-controls');
          if (zoomControls) {
            zoomControls.classList.remove('hidden');
          }
          
          // Configurar canvas
          setupCanvas();
          
          // Initialize zoom
          currentZoom = 1.0;
          isZoomed = false;
          resetPan(); // Reset pan también
          updateZoomLevel();
          
          // Mostrar información de la imagen
          updateImageInfo();
          
          // Initialize resize functionality
          initResize();
          
          // Update resize inputs with original dimensions
          const widthInput = document.getElementById('resize-width');
          const heightInput = document.getElementById('resize-height');
          if (widthInput) widthInput.value = originalWidth;
          if (heightInput) heightInput.value = originalHeight;
          
          // Update rotation display
          updateRotationDisplay();
          
          // Actualizar vista previa
          updatePreview();
          
          // Limpiar estado de carga
          UIManager.hideLoadingState();
          
          // Inicializar historial con estado inicial
          setTimeout(() => {
            historyManager.clear();
            historyManager.saveState();
          }, 100);
          
        } catch (error) {
          UIManager.hideLoadingState();
          console.error('Error al configurar la imagen:', error);
          UIManager.showError('Error al configurar la imagen. Por favor, inténtalo de nuevo.');
        }
      };
      
      img.onerror = function() {
        UIManager.hideLoadingState();
        UIManager.showError('Error al cargar la imagen. El archivo puede estar corrupto.');
      };
      
      // Timeout para imágenes que no cargan
      const timeout = setTimeout(() => {
        if (!img.complete) {
          UIManager.hideLoadingState();
          UIManager.showError('La carga de la imagen está tomando demasiado tiempo. Por favor, inténtalo de nuevo.');
        }
      }, 10000);
      
      // Limpiar timeout cuando la imagen se carga exitosamente
      const originalOnload = img.onload;
      img.onload = function() {
        clearTimeout(timeout);
        originalOnload.call(this);
      };

      img.src = src;
    }

    function setupCanvas() {
      if (!currentImage) return;
      
      // Ajustar dimensiones máximas según el tamaño de pantalla
      let maxWidth = 800;
      let maxHeight = 600;
      
      // Para pantallas pequeñas, ajustar los límites
      if (window.innerWidth <= 480) {
        maxWidth = Math.min(window.innerWidth - 32, 400); // 32px de padding
        maxHeight = Math.min(window.innerHeight * 0.6, 400); // 60% de altura de ventana
      } else if (window.innerWidth <= 768) {
        maxWidth = Math.min(window.innerWidth - 48, 600); // 48px de padding
        maxHeight = Math.min(window.innerHeight * 0.7, 500);
      }
      
      let { width, height } = currentImage;
      
      // Calcular nuevas dimensiones manteniendo proporción
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      // Asegurar que el canvas mantenga sus proporciones
      canvas.style.objectFit = 'contain';
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      
      // Configurar zoom con rueda del ratón en el canvas
      canvas.addEventListener('wheel', function(e) {
        if (!currentImage) return;
        e.preventDefault();
        
        const delta = e.deltaY;
        if (delta < 0) {
          zoomInWheel();
        } else if (delta > 0) {
          zoomOutWheel();
        }
      }, { passive: false });
    }

    function updatePreview() {
      if (!currentImage || !ctx) {
        console.log('⚠️ updatePreview: Sin imagen o contexto disponible');
        FilterLoadingManager.hideFilterLoading();
        return;
      }
      
      console.log('🔄 Actualizando preview con filtros optimizados');
      
      // Verificar si necesitamos usar worker para procesamiento pesado
      if (FilterManager.shouldUseWorker()) {
        updatePreviewWithWorker();
      } else {
        updatePreviewStandard();
      }
    }
    
    // Actualización estándar del preview (sin worker)
    function updatePreviewStandard() {
      // Performance optimization: requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        try {
          // Clear canvas with optimized method
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw image with better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
          
          // Apply watermark with caching
          applyWatermarkOptimized();
          
          // Aplicar filtros CSS al canvas (con cache y loading states)
          applyCanvasFilters();
          
          // Save state to history (debounced)
          if (typeof debouncedSaveHistory === 'undefined') {
            window.debouncedSaveHistory = SmartDebounce.intelligent('save-history', () => {
              historyManager.saveState();
            }, 1000);
          }
          debouncedSaveHistory();
          
          console.log('✅ Preview actualizado exitosamente');
          
        } catch (error) {
          console.error('❌ Error al actualizar preview:', error);
          FilterLoadingManager.hideFilterLoading();
        }
      });
    }
    
    // Actualización del preview usando worker para filtros pesados
    async function updatePreviewWithWorker() {
      try {
        console.log('🔧 Usando Worker para filtros pesados');
        
        // Obtener datos de imagen para el worker
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Dibujar imagen base
        tempCtx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Procesar con worker
        const processedImageData = await FilterManager.applyWithWorker(imageData);
        
        // Aplicar resultado en el canvas principal
        requestAnimationFrame(() => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.putImageData(processedImageData, 0, 0);
          
          // Aplicar marcas de agua después del procesamiento
          applyWatermarkOptimized();
          
          // Aplicar filtros CSS restantes (no pesados)
          applyCanvasFiltersLight();
          
          // Save state to history
          if (typeof debouncedSaveHistory === 'undefined') {
            window.debouncedSaveHistory = SmartDebounce.intelligent('save-history', () => {
              historyManager.saveState();
            }, 1000);
          }
          debouncedSaveHistory();
          
          console.log('✅ Preview actualizado con Worker exitosamente');
        });
        
      } catch (error) {
        console.warn('⚠️ Worker falló, usando fallback:', error);
        updatePreviewStandard();
      }
    }

    function applyWatermarkOptimized() {
      const textEnabled = document.getElementById('watermark-text-enabled').checked;
      const imageEnabled = document.getElementById('watermark-image-enabled').checked;
      
      // Aplicar marca de agua de texto si está habilitada
      if (textEnabled) {
        applyTextWatermarkOptimized();
      }
      
      // Aplicar marca de agua de imagen si está habilitada
      if (imageEnabled) {
        applyImageWatermarkOptimized();
      }
    }

    function applyTextWatermarkOptimized() {
      const text = document.getElementById('watermark-text').value.trim();
      if (!text) return;
      
      const font = document.getElementById('watermark-font').value;
      const color = document.getElementById('watermark-color').value;
      const size = parseInt(document.getElementById('watermark-size').value);
      const opacity = parseInt(document.getElementById('watermark-opacity').value) / 100;
      const position = document.getElementById('watermark-position').value;
      
      // Cache font configuration for better performance
      const fontConfig = `${size}px ${font}`;
      ctx.font = fontConfig;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      
      // Add text shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      // Calculate position with better precision
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = size;
      
      const positions = getWatermarkPosition(position, textWidth, textHeight);
      
      // Draw text with enhanced quality
      ctx.fillText(text, positions.x, positions.y);
      
      // Reset shadow and opacity
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = 1;
    }

    function applyImageWatermarkOptimized() {
      const watermarkImageInput = document.getElementById('watermark-image');
      if (!watermarkImageInput.files[0]) return;
      
      // Use cached image if available and configuration hasn't changed
      const currentConfig = {
        file: watermarkImageInput.files[0],
        opacity: document.getElementById('watermark-image-opacity').value,
        size: document.getElementById('watermark-image-size').value,
        position: document.getElementById('watermark-image-position').value,
        width: document.getElementById('watermark-image-width').value,
        height: document.getElementById('watermark-image-height').value,
        customPosition: customImagePosition ? JSON.stringify(customImagePosition) : null
      };
      
      const configChanged = !cache.lastWatermarkConfig || 
        JSON.stringify(currentConfig) !== JSON.stringify(cache.lastWatermarkConfig);
      
      if (cache.watermarkImage && !configChanged) {
        drawCachedWatermark(cache.watermarkImage, currentConfig);
        return;
      }
      
      // Load new watermark image
      const reader = new FileReader();
      reader.onload = function(e) {
        const watermarkImg = new Image();
        watermarkImg.onload = function() {
          // Guardar imagen para referencia en el posicionamiento
          watermarkImagePreview = watermarkImg;
          cache.watermarkImage = watermarkImg;
          cache.lastWatermarkConfig = currentConfig;
          drawCachedWatermark(watermarkImg, currentConfig);
        };
        watermarkImg.src = e.target.result;
      };
      reader.readAsDataURL(watermarkImageInput.files[0]);
    }

    function drawCachedWatermark(watermarkImg, config) {
      const opacity = parseInt(config.opacity) / 100;
      const sizeOption = config.size;
      const position = config.position;
      
      // Calculate size with caching
      let { width, height } = calculateWatermarkImageSize(watermarkImg, sizeOption);
      
      // Calculate position usando la función específica para imagen
      const positions = getImageWatermarkPosition(position, width, height);
      
      // Draw image with enhanced quality and shadow
      ctx.globalAlpha = opacity;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.drawImage(watermarkImg, positions.x, positions.y, width, height);
      
      // Reset effects
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = 1;
    }

    function calculateWatermarkImageSize(img, sizeOption) {
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      let width, height;
      
      switch (sizeOption) {
        case 'small':
          width = Math.min(img.width, canvasWidth * 0.15);
          height = (width / img.width) * img.height;
          break;
        case 'medium':
          width = Math.min(img.width, canvasWidth * 0.25);
          height = (width / img.width) * img.height;
          break;
        case 'large':
          width = Math.min(img.width, canvasWidth * 0.4);
          height = (width / img.width) * img.height;
          break;
        case 'custom':
          width = parseInt(document.getElementById('watermark-image-width').value) || 100;
          height = parseInt(document.getElementById('watermark-image-height').value) || 100;
          break;
        default:
          width = img.width;
          height = img.height;
      }
      
      return { width, height };
    }

    function getWatermarkPosition(position, width, height) {
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const margin = 20;
      
      let x, y;
      
      switch (position) {
        case 'top-left':
          x = margin;
          y = margin + height;
          break;
        case 'top-center':
          x = (canvasWidth - width) / 2;
          y = margin + height;
          break;
        case 'top-right':
          x = canvasWidth - width - margin;
          y = margin + height;
          break;
        case 'center-left':
          x = margin;
          y = (canvasHeight + height) / 2;
          break;
        case 'center':
          x = (canvasWidth - width) / 2;
          y = (canvasHeight + height) / 2;
          break;
        case 'center-right':
          x = canvasWidth - width - margin;
          y = (canvasHeight + height) / 2;
          break;
        case 'bottom-left':
          x = margin;
          y = canvasHeight - margin;
          break;
        case 'bottom-center':
          x = (canvasWidth - width) / 2;
          y = canvasHeight - margin;
          break;
        case 'bottom-right':
          x = canvasWidth - width - margin;
          y = canvasHeight - margin;
          break;
        default:
          x = margin;
          y = margin + height;
      }
      
      return { x, y };
    }

    function getImageWatermarkPosition(position, width, height) {
      // Si es posición personalizada, usar las coordenadas del clic
      if (position === 'custom' && customImagePosition) {
        return {
          x: customImagePosition.x - width / 2,
          y: customImagePosition.y - height / 2
        };
      }
      
      // Si no, usar la función estándar
      return getWatermarkPosition(position, width, height);
    }

    function toggleWatermarkType() {
      const textOptions = document.getElementById('text-watermark-options');
      const imageOptions = document.getElementById('image-watermark-options');
      const textEnabled = document.getElementById('watermark-text-enabled').checked;
      const imageEnabled = document.getElementById('watermark-image-enabled').checked;
      
      // Mostrar/ocultar opciones de texto
      if (textEnabled) {
        textOptions.classList.remove('watermark-options__text--hidden');
        textOptions.classList.add('watermark-options__text');
      } else {
        textOptions.classList.remove('watermark-options__text');
        textOptions.classList.add('watermark-options__text--hidden');
      }
      
      // Mostrar/ocultar opciones de imagen
      if (imageEnabled) {
        imageOptions.classList.remove('watermark-options__image');
        imageOptions.classList.add('watermark-options__image--visible');
      } else {
        imageOptions.classList.remove('watermark-options__image--visible');
        imageOptions.classList.add('watermark-options__image');
      }
      
      updatePreview();
    }

    function toggleCustomImageSize() {
      const sizeSelect = document.getElementById('watermark-image-size');
      const customSizeDiv = document.getElementById('watermark-image-custom-size');
      
      if (sizeSelect.value === 'custom') {
        customSizeDiv.classList.add('watermark-options__custom-size--visible');
        customSizeDiv.classList.remove('watermark-options__custom-size');
      } else {
        customSizeDiv.classList.remove('watermark-options__custom-size--visible');
        customSizeDiv.classList.add('watermark-options__custom-size');
      }
      
      updatePreview();
    }

    // Funciones para posicionamiento personalizado de imagen
    function togglePositioningMode() {
      const positionSelect = document.getElementById('watermark-image-position');
      const customInfo = document.getElementById('custom-position-info');
      
      if (positionSelect.value === 'custom') {
        isPositioningMode = true;
        customInfo.style.display = 'block';
        
        // Agregar clase al canvas para el cursor
        if (canvas) {
          canvas.classList.add('positioning-mode');
        }
        
        // Si ya hay una posición personalizada, mostrar el marcador
        if (customImagePosition) {
          showPositionMarker();
        }
      } else {
        isPositioningMode = false;
        customInfo.style.display = 'none';
        customImagePosition = null;
        
        // Quitar clase del canvas
        if (canvas) {
          canvas.classList.remove('positioning-mode');
        }
        
        // Quitar marcador si existe
        removePositionMarker();
      }
      
      debouncedUpdatePreview();
    }

    function handleCanvasClick(event) {
      if (!isPositioningMode || !watermarkImagePreview) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      // Guardar la posición personalizada
      customImagePosition = { x, y };
      
      // Mostrar marcador visual
      showPositionMarker();
      
      // Actualizar vista previa
      updatePreview();
      
      UIManager.showSuccess('Posición de marca de agua actualizada');
    }

    function showPositionMarker() {
      if (!customImagePosition || !canvas) return;
      
      // Quitar marcador anterior si existe
      removePositionMarker();
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      
      const marker = document.createElement('div');
      marker.className = 'custom-position-marker';
      marker.id = 'position-marker';
      
      const displayX = customImagePosition.x * scaleX;
      const displayY = customImagePosition.y * scaleY;
      
      marker.style.left = displayX + 'px';
      marker.style.top = displayY + 'px';
      
      // Agregar al contenedor del canvas
      const container = canvas.parentElement;
      container.style.position = 'relative';
      container.appendChild(marker);
    }

    function removePositionMarker() {
      const marker = document.getElementById('position-marker');
      if (marker) {
        marker.remove();
      }
    }

    // Enhanced metadata form handler with validation
    function handleMetadataSubmit(e) {
      e.preventDefault();
      
      if (!currentImage) {
        showError('Por favor, selecciona una imagen primero.');
        return;
      }

      const form = e.target;
      
      // Limpiar errores anteriores
      FormValidator.clearFormErrors('metadata-form');
      
      // Mostrar estado de carga
      form.classList.add('form-loading');

      try {
        // Recopilar datos del formulario
        const formData = new FormData(form);
        const metadata = Object.fromEntries(formData);
        
        // Validar metadatos
        const validation = SecurityManager.validateMetadata(metadata);
        
        if (!validation.isValid) {
          // Mostrar errores específicos por campo
          for (const [field, error] of Object.entries(validation.errors)) {
            FormValidator.showFieldError(field, error);
          }
          form.classList.remove('form-loading');
          return;
        }

        // Usar metadatos sanitizados
        const sanitizedMetadata = validation.sanitized;
        
        // Aquí podrías implementar la lógica para aplicar metadatos a la imagen
        // Por ejemplo, usando ExifWriter.js o similar para escribir metadatos EXIF
        
        console.log('Metadatos validados y sanitizados:', sanitizedMetadata);
        
        // Mostrar previsualización de metadatos
        showMetadataPreview(sanitizedMetadata);
        
        // Simular procesamiento
        setTimeout(() => {
          form.classList.remove('form-loading');
          UIManager.showSuccess('Metadatos guardados correctamente.');
        }, 500);
        
      } catch (error) {
        form.classList.remove('form-loading');
        console.error('Error al procesar metadatos:', error);
        UIManager.showError('Error al procesar los metadatos. Por favor, inténtalo de nuevo.');
      }
    }

    // Función para mostrar la previsualización de metadatos
    function showMetadataPreview(metadata) {
      const previewContainer = document.getElementById('metadata-preview');
      
      // Campos a mostrar
      const fields = [
        { key: 'title', label: 'Título' },
        { key: 'author', label: 'Autor' },
        { key: 'description', label: 'Descripción' },
        { key: 'keywords', label: 'Palabras clave' },
        { key: 'copyright', label: 'Copyright' }
      ];
      
      let hasContent = false;
      
      // Mostrar cada campo si tiene contenido
      fields.forEach(field => {
        const value = metadata[field.key];
        const fieldElement = document.getElementById(`preview-${field.key}`);
        const valueElement = document.getElementById(`preview-${field.key}-value`);
        
        if (value && value.trim()) {
          fieldElement.classList.remove('preview-field--hidden');
          valueElement.textContent = value;
          hasContent = true;
        } else {
          fieldElement.classList.add('preview-field--hidden');
        }
      });
      
      // Mostrar/ocultar el contenedor principal
      if (hasContent) {
        previewContainer.classList.remove('metadata-preview--hidden');
        previewContainer.classList.add('metadata-preview');
        
        // Scroll suave hacia la previsualización
        setTimeout(() => {
          previewContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }, 100);
      } else {
        previewContainer.classList.add('metadata-preview--hidden');
      }
    }

    // Función para ocultar la previsualización de metadatos
    function hideMetadataPreview() {
      const previewContainer = document.getElementById('metadata-preview');
      if (previewContainer) {
        previewContainer.classList.add('metadata-preview--hidden');
        previewContainer.classList.remove('metadata-preview');
      }
    }

    // Enhanced watermark form handler with validation
    function handleWatermarkSubmit(e) {
      e.preventDefault();
      
      if (!currentImage) {
        showError('Por favor, selecciona una imagen primero.');
        return;
      }

      const form = e.target;
      const textEnabled = document.getElementById('watermark-text-enabled').checked;
      const imageEnabled = document.getElementById('watermark-image-enabled').checked;
      
      // Verificar que al menos una opción esté habilitada
      if (!textEnabled && !imageEnabled) {
        UIManager.showError('Debe habilitar al menos un tipo de marca de agua');
        return;
      }
      
      // Limpiar errores anteriores
      FormValidator.clearFormErrors('watermark-form');
      form.classList.add('form-loading');

      try {
        // Validar marca de agua de texto si está habilitada
        if (textEnabled) {
          const text = document.getElementById('watermark-text').value;
          const size = document.getElementById('watermark-size').value;
          const opacity = document.getElementById('watermark-opacity').value;
          
          // Validar marca de agua de texto
          const validation = SecurityManager.validateWatermarkText(text, size, opacity);
          
          if (!validation.isValid) {
            validation.errors.forEach(error => UIManager.showError(error));
            form.classList.remove('form-loading');
            return;
          }
        }
        
        // Validar marca de agua de imagen si está habilitada
        if (imageEnabled) {
          const watermarkImageInput = document.getElementById('watermark-image');
          if (!watermarkImageInput.files[0]) {
            UIManager.showError('Debe seleccionar una imagen para la marca de agua');
            form.classList.remove('form-loading');
            return;
          }
        }
        
        // Aplicar marca de agua
        updatePreview();
        
        setTimeout(() => {
          form.classList.remove('form-loading');
          UIManager.showSuccess('Marca de agua aplicada correctamente.');
        }, 300);
        
      } catch (error) {
        form.classList.remove('form-loading');
        console.error('Error al aplicar marca de agua:', error);
        showError('Error al aplicar la marca de agua. Por favor, inténtalo de nuevo.');
      }
    }

    function resetChanges() {
      if (!currentImage) return;
      
      // Limpiar formularios
      document.getElementById('metadata-form').reset();
      document.getElementById('watermark-form').reset();
      
      // Resetear tipo de marca de agua
      document.getElementById('watermark-text-enabled').checked = true;
      document.getElementById('watermark-image-enabled').checked = false;
      toggleWatermarkType();
      
      // Limpiar posicionamiento personalizado
      customImagePosition = null;
      isPositioningMode = false;
      watermarkImagePreview = null;
      removePositionMarker();
      
      const customInfo = document.getElementById('custom-position-info');
      if (customInfo) {
        customInfo.style.display = 'none';
      }
      
      if (canvas) {
        canvas.classList.remove('positioning-mode');
      }
      
      // Ocultar previsualización de metadatos
      const metadataPreview = document.getElementById('metadata-preview');
      if (metadataPreview) {
        metadataPreview.classList.add('metadata-preview--hidden');
        metadataPreview.classList.remove('metadata-preview');
      }
      
      // Resetear controles de salida
      resetOutputControls();
      
      // Limpiar historial
      historyManager.clear();
      
      // Actualizar vista previa
      updatePreview();
      
      // Guardar estado inicial
      setTimeout(() => {
        historyManager.saveState();
      }, 100);
    }

    function resetOutputControls() {
      // Reset quality to default (80%)
      const qualitySelect = document.getElementById('output-quality');
      const qualityNumber = document.getElementById('quality-number');
      
      if (qualitySelect && qualityNumber) {
        qualitySelect.value = '80';
        qualityNumber.value = '80';
        outputQuality = 0.8;
        handleQualityChange();
      }
      
      // Reset format to JPEG (or original extension if available)
      const formatSelect = document.getElementById('output-format');
      if (formatSelect && originalExtension) {
        if (['jpg', 'jpeg'].includes(originalExtension.toLowerCase())) {
          formatSelect.value = 'jpeg';
        } else if (['png'].includes(originalExtension.toLowerCase())) {
          formatSelect.value = 'png';
        } else if (['webp'].includes(originalExtension.toLowerCase())) {
          formatSelect.value = 'webp';
        } else if (['avif'].includes(originalExtension.toLowerCase())) {
          formatSelect.value = 'avif';
        } else {
          formatSelect.value = 'jpeg';
        }
        outputFormat = formatSelect.value;
        handleFormatChange();
      }
    }

    async function downloadImage() {
      if (!canvas) {
        showError('No hay imagen para descargar.');
        return;
      }

      if (!currentFile) {
        showError('Por favor, selecciona una imagen primero.');
        return;
      }
      
      try {
        // Obtener metadatos antes de la descarga
        const metadata = MetadataManager.getMetadata();
        const exifData = MetadataManager.applyMetadataToImage(canvas);
        
        // Mostrar resumen de metadatos si están presentes
        if (metadata.title || metadata.author || metadata.copyright || metadata.latitude) {
          console.log('Metadatos aplicados:', metadata);
          
          let metaInfo = [];
          if (metadata.title) metaInfo.push(`Título: ${metadata.title}`);
          if (metadata.author) metaInfo.push(`Autor: ${metadata.author}`);
          if (metadata.copyright) metaInfo.push(`Copyright: ${metadata.copyright}`);
          if (metadata.latitude && metadata.longitude) {
            metaInfo.push(`Ubicación: ${metadata.latitude.toFixed(4)}, ${metadata.longitude.toFixed(4)}`);
          }
          
          if (metaInfo.length > 0) {
            UIManager.showSuccess(`Imagen descargada con metadatos: ${metaInfo.join(' | ')}`);
          }
        }
        
        // Obtener el título y sanitizar el nombre del archivo
        const titleInput = document.getElementById('metaTitle');
        let filename = metadata.title || titleInput.value.trim() || 'imagen_editada';
        filename = sanitizeFilename(filename);
        
        // Usar el formato seleccionado en lugar de la extensión original
        const extension = getFileExtension(outputFormat);
        const fullFilename = `${filename}.${extension}`;
        
        // Obtener el tipo MIME basado en el formato seleccionado
        const mimeType = getMimeType(outputFormat);
        
        // Usar la API File System Access si está disponible (Chrome/Edge modernos)
        if ('showSaveFilePicker' in window) {
          const options = {
            suggestedName: fullFilename,
            types: [{
              description: 'Imágenes',
              accept: {
                [mimeType]: [`.${extension}`]
              }
            }],
            startIn: lastDownloadDirectory || 'desktop'
          };

          try {
            const handle = await window.showSaveFilePicker(options);
            lastDownloadDirectory = await handle.queryPermission({ mode: 'readwrite' });
            
            const writable = await handle.createWritable();
            const blob = await canvasToBlob(canvas, mimeType, outputQuality);
            await writable.write(blob);
            await writable.close();
            
            const qualityText = outputFormat === 'png' ? '' : ` (calidad: ${Math.round(outputQuality * 100)}%)`;
            showSuccess(`Imagen guardada exitosamente en formato ${outputFormat.toUpperCase()}${qualityText}!`);
            return;
          } catch (saveError) {
            // Si el usuario cancela, no mostrar error
            if (saveError.name === 'AbortError') {
              return;
            }
            console.warn('Error con File System Access API, usando fallback:', saveError);
          }
        }
        
        // Fallback para navegadores que no soportan la API o si falla
        const link = document.createElement('a');
        link.download = fullFilename;
        link.href = canvas.toDataURL(mimeType, outputQuality);
        
        // Simular click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        const qualityText = outputFormat === 'png' ? '' : ` (calidad: ${Math.round(outputQuality * 100)}%)`;
        showSuccess(`Imagen descargada en formato ${outputFormat.toUpperCase()}${qualityText}!`);
        
      } catch (error) {
        console.error('Error al descargar:', error);
        showError('Error al descargar la imagen.');
      }
    }

    // Funciones helper extraídas a js/utils/helpers.js

    // Enhanced canvasToBlob function using native browser capabilities
    // Funciones canvasToBlob extraídas a js/utils/helpers.js

    // Update image information display
    function updateImageInfo() {
      const imageInfoElement = document.getElementById('image-info');
      const dimensionsElement = document.getElementById('image-dimensions');
      const sizeElement = document.getElementById('image-size');
      const formatElement = document.getElementById('image-format');
      const pixelsElement = document.getElementById('image-pixels');
      const currentDimensionsElement = document.getElementById('current-dimensions');
      const currentSizeDisplay = document.getElementById('current-size-display');
      
      if (!currentImage || !imageInfoElement) return;
      
      // Show image info panel
      imageInfoElement.classList.remove('hidden');
      
      // Update dimensions
      if (dimensionsElement) {
        dimensionsElement.textContent = `${currentImage.width} × ${currentImage.height}`;
      }
      
      // Update current size display in resize section
      if (currentDimensionsElement && currentSizeDisplay) {
        currentDimensionsElement.textContent = `${currentImage.width} × ${currentImage.height}`;
        currentSizeDisplay.classList.remove('hidden');
      }
      
      // Update file size
      if (sizeElement && currentFile) {
        sizeElement.textContent = formatFileSize(currentFile.size);
      } else if (sizeElement) {
        sizeElement.textContent = 'Calculando...';
      }
      
      // Update format
      if (formatElement && currentFile) {
        const fileType = currentFile.type.split('/')[1].toUpperCase();
        formatElement.textContent = fileType || originalExtension.toUpperCase();
      } else if (formatElement) {
        formatElement.textContent = originalExtension.toUpperCase();
      }
      
      // Update total pixels
      if (pixelsElement) {
        const totalPixels = currentImage.width * currentImage.height;
        pixelsElement.textContent = formatNumber(totalPixels);
      }
    }
    
    // Funciones de formato extraídas a js/utils/helpers.js

    // Initialize resize functionality
    function initResize() {
      const widthInput = document.getElementById('resize-width');
      const heightInput = document.getElementById('resize-height');
      const aspectRatioCheckbox = document.getElementById('maintain-aspect-ratio');
      const applyResizeBtn = document.getElementById('apply-resize');
      const resetResizeBtn = document.getElementById('reset-original-size');
      
      // Preset buttons
      const presetButtons = document.querySelectorAll('.preset-btn');
      
      // Add event listeners to dimension inputs
      if (widthInput) {
        widthInput.addEventListener('input', function() {
          if (aspectRatioCheckbox && aspectRatioCheckbox.checked && originalWidth && originalHeight) {
            const newHeight = Math.round((this.value * originalHeight) / originalWidth);
            if (heightInput) heightInput.value = newHeight;
          }
        });
      }
      
      if (heightInput) {
        heightInput.addEventListener('input', function() {
          if (aspectRatioCheckbox && aspectRatioCheckbox.checked && originalWidth && originalHeight) {
            const newWidth = Math.round((this.value * originalWidth) / originalHeight);
            if (widthInput) widthInput.value = newWidth;
          }
        });
      }
      
      // Preset buttons functionality
      presetButtons.forEach(button => {
        button.addEventListener('click', function() {
          const width = this.getAttribute('data-width');
          const height = this.getAttribute('data-height');
          
          if (widthInput) widthInput.value = width;
          if (heightInput) heightInput.value = height;
          
          // Update button visual state
          presetButtons.forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
          this.classList.add('ring-2', 'ring-blue-500');
        });
      });
      
      // Apply resize functionality
      if (applyResizeBtn) {
        applyResizeBtn.addEventListener('click', function() {
          const newWidth = parseInt(widthInput.value);
          const newHeight = parseInt(heightInput.value);
          
          if (newWidth > 0 && newHeight > 0 && currentImage) {
            resizeImage(newWidth, newHeight);
          }
        });
      }
      
      // Reset resize functionality
      if (resetResizeBtn) {
        resetResizeBtn.addEventListener('click', function() {
          if (originalWidth && originalHeight) {
            if (widthInput) widthInput.value = originalWidth;
            if (heightInput) heightInput.value = originalHeight;
            presetButtons.forEach(btn => btn.classList.remove('ring-2', 'ring-blue-500'));
            
            if (currentImage) {
              resizeImage(originalWidth, originalHeight);
            }
          }
        });
      }
    }

    // Resize image function
    function resizeImage(newWidth, newHeight) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }
      
      // Validate dimensions
      if (newWidth <= 0 || newHeight <= 0) {
        console.error('Invalid dimensions:', newWidth, newHeight);
        return;
      }
      
      try {
        // Create temporary canvas for resizing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        
        // Draw resized image with high quality
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(currentImage, 0, 0, newWidth, newHeight);
        
        // Create new image from the resized canvas
        const newImage = new Image();
        newImage.onload = function() {
          // Update current image
          currentImage = newImage;
          
          // Update preview canvas
          const canvas = document.getElementById('preview-canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.clearRect(0, 0, newWidth, newHeight);
            ctx.drawImage(newImage, 0, 0);
            
            // Re-apply watermark if present
            updatePreview();
          }
          
          // Update image info display
          updateImageInfo();
          
          // Show success message
          showSuccessMessage(`Imagen redimensionada a ${newWidth} × ${newHeight}`);
          
          console.log('Image resized successfully to:', newWidth, 'x', newHeight);
        };
        
        newImage.onerror = function() {
          console.error('Error creating resized image');
        };
        
        // Convert canvas to data URL and set as image source
        newImage.src = tempCanvas.toDataURL('image/png');
        
      } catch (error) {
        console.error('Error during resize operation:', error);
        showSuccessMessage('Error al redimensionar la imagen');
      }
    }

    // Show success message
    function showSuccessMessage(message) {
      // Create or update success message element
      let successElement = document.getElementById('success-message');
      if (!successElement) {
        successElement = document.createElement('div');
        successElement.id = 'success-message';
        successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
        document.body.appendChild(successElement);
      }
      
      successElement.textContent = message;
      successElement.style.opacity = '1';
      
      // Hide after 3 seconds
      setTimeout(() => {
        successElement.style.opacity = '0';
        setTimeout(() => {
          if (successElement.parentNode) {
            successElement.parentNode.removeChild(successElement);
          }
        }, 300);
      }, 3000);
    }
    
    // Character counter functionality
    function initCharacterCounters() {
      const fields = [
        { id: 'metaTitle', counter: 'title-counter', limit: 60 },
        { id: 'description', counter: 'description-counter', limit: 160 },
        { id: 'keywords', counter: 'keywords-counter', limit: 200 }
      ];

      fields.forEach(field => {
        const input = document.getElementById(field.id);
        const counter = document.getElementById(field.counter);
        
        if (input && counter) {
          // Update counter on input
          input.addEventListener('input', function() {
            updateCharacterCount(this, counter, field.limit);
          });
          
          // Initial count
          updateCharacterCount(input, counter, field.limit);
        }
      });
    }

    function updateCharacterCount(input, counter, limit) {
      const length = input.value.length;
      const remaining = limit - length;
      
      // Update counter text
      counter.textContent = `${length}/${limit} caracteres`;
      
      // Update color based on usage
      counter.classList.remove('good', 'warning', 'danger');
      
      if (length <= limit * 0.7) {
        counter.classList.add('good');
      } else if (length <= limit * 0.9) {
        counter.classList.add('warning');
      } else {
        counter.classList.add('danger');
      }
      
      // Show remaining characters if close to limit
      if (remaining <= 10 && remaining >= 0) {
        counter.textContent = `${length}/${limit} (${remaining} restantes)`;
      } else if (length > limit) {
        counter.textContent = `${length}/${limit} (${Math.abs(remaining)} sobre el límite)`;
      }
    }
    
    // Image rotation functionality
    function initRotation() {
      const rotate90Btn = document.getElementById('rotate-90');
      const rotate180Btn = document.getElementById('rotate-180');
      const rotate270Btn = document.getElementById('rotate-270');
      const resetRotationBtn = document.getElementById('reset-rotation');
      const flipHorizontalBtn = document.getElementById('flip-horizontal');
      const flipVerticalBtn = document.getElementById('flip-vertical');
      
      // Rotation buttons
      if (rotate90Btn) {
        rotate90Btn.addEventListener('click', () => rotateImage(90));
      }
      
      if (rotate180Btn) {
        rotate180Btn.addEventListener('click', () => rotateImage(180));
      }
      
      if (rotate270Btn) {
        rotate270Btn.addEventListener('click', () => rotateImage(270));
      }
      
      if (resetRotationBtn) {
        resetRotationBtn.addEventListener('click', resetRotation);
      }
      
      // Flip buttons
      if (flipHorizontalBtn) {
        flipHorizontalBtn.addEventListener('click', () => flipImage('horizontal'));
      }
      
      if (flipVerticalBtn) {
        flipVerticalBtn.addEventListener('click', () => flipImage('vertical'));
      }
    }

    function rotateImage(degrees) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }
      
      try {
        // Update rotation state
        currentRotation = (currentRotation + degrees) % 360;
        
        // Apply transformation
        applyImageTransformation();
        
        // Update rotation display
        updateRotationDisplay();
        
        // Show success message
        showSuccessMessage(`Imagen rotada ${degrees}° (Total: ${currentRotation}°)`);
        
        console.log('Image rotated:', degrees, 'degrees. Total rotation:', currentRotation);
        
      } catch (error) {
        console.error('Error rotating image:', error);
        showSuccessMessage('Error al rotar la imagen');
      }
    }

    function flipImage(direction) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }
      
      try {
        if (direction === 'horizontal') {
          isFlippedHorizontally = !isFlippedHorizontally;
        } else if (direction === 'vertical') {
          isFlippedVertically = !isFlippedVertically;
        }
        
        // Apply transformation
        applyImageTransformation();
        
        // Update rotation display
        updateRotationDisplay();
        
        // Show success message
        const flipText = direction === 'horizontal' ? 'horizontalmente' : 'verticalmente';
        showSuccessMessage(`Imagen volteada ${flipText}`);
        
        console.log('Image flipped:', direction);
        
      } catch (error) {
        console.error('Error flipping image:', error);
        showSuccessMessage('Error al voltear la imagen');
      }
    }

    function applyImageTransformation() {
      if (!currentImage) return;
      
      const canvas = document.getElementById('preview-canvas');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      // Create a temporary canvas with original image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // Use original dimensions for source
      tempCanvas.width = originalWidth;
      tempCanvas.height = originalHeight;
      tempCtx.drawImage(currentImage, 0, 0, originalWidth, originalHeight);
      
      // Calculate new dimensions based on rotation
      let newWidth, newHeight;
      if (currentRotation === 90 || currentRotation === 270) {
        newWidth = originalHeight;
        newHeight = originalWidth;
      } else {
        newWidth = originalWidth;
        newHeight = originalHeight;
      }
      
      // Set canvas size
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Clear canvas
      ctx.clearRect(0, 0, newWidth, newHeight);
      
      // Save context state
      ctx.save();
      
      // Move to center of canvas for transformations
      ctx.translate(newWidth / 2, newHeight / 2);
      
      // Apply rotation
      if (currentRotation !== 0) {
        ctx.rotate((currentRotation * Math.PI) / 180);
      }
      
      // Apply flips
      const scaleX = isFlippedHorizontally ? -1 : 1;
      const scaleY = isFlippedVertically ? -1 : 1;
      ctx.scale(scaleX, scaleY);
      
      // Draw image centered (use original dimensions for drawing)
      ctx.drawImage(
        tempCanvas,
        -originalWidth / 2,
        -originalHeight / 2,
        originalWidth,
        originalHeight
      );
      
      // Restore context state
      ctx.restore();
      
      // Create new image from canvas for currentImage reference
      const newImageData = canvas.toDataURL('image/png');
      const newImage = new Image();
      newImage.onload = function() {
        currentImage = newImage;
        currentImage.width = newWidth;
        currentImage.height = newHeight;
        
        // Update image info
        updateImageInfo();
        
        // Update preview with watermark if present
        updatePreview();
      };
      newImage.src = newImageData;
    }

    function resetRotation() {
      if (!currentImage) return;
      
      try {
        // Reset all transformations
        currentRotation = 0;
        isFlippedHorizontally = false;
        isFlippedVertically = false;
        
        // Restore original image
        if (originalWidth && originalHeight) {
          currentImage.width = originalWidth;
          currentImage.height = originalHeight;
        }
        
        // Redraw original image
        const canvas = document.getElementById('preview-canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          canvas.width = currentImage.width;
          canvas.height = currentImage.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(currentImage, 0, 0);
        }
        
        // Update displays
        updateRotationDisplay();
        updateImageInfo();
        updatePreview();
        
        showSuccessMessage('Rotación restablecida al original');
        
      } catch (error) {
        console.error('Error resetting rotation:', error);
        showSuccessMessage('Error al restablecer la rotación');
      }
    }

    function updateRotationDisplay() {
      const currentRotationElement = document.getElementById('current-rotation');
      const currentRotationDisplay = document.getElementById('current-rotation-display');
      
      if (currentRotationElement && currentRotationDisplay) {
        let displayText = `${currentRotation}°`;
        
        // Add flip indicators
        if (isFlippedHorizontally || isFlippedVertically) {
          const flips = [];
          if (isFlippedHorizontally) flips.push('H');
          if (isFlippedVertically) flips.push('V');
          displayText += ` (${flips.join(', ')})`;
        }
        
        currentRotationElement.textContent = displayText;
        
        // Show/hide display based on transformations
        if (currentRotation !== 0 || isFlippedHorizontally || isFlippedVertically) {
          currentRotationDisplay.classList.remove('hidden');
        } else {
          currentRotationDisplay.classList.add('hidden');
        }
      }
    }
    
    // Progress bar functionality
    function showProgressBar(title = 'Procesando...') {
      const overlay = document.getElementById('progress-overlay');
      const titleElement = document.getElementById('progress-title');
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressEta = document.getElementById('progress-eta');
      
      if (overlay && titleElement) {
        titleElement.textContent = title;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        progressEta.textContent = 'Calculando tiempo...';
        overlay.classList.add('show');
      }
    }
    
    function updateProgress(percentage, message = '', eta = '') {
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressEta = document.getElementById('progress-eta');
      
      if (progressBar && progressText) {
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
        
        if (message) {
          const titleElement = document.getElementById('progress-title');
          if (titleElement) titleElement.textContent = message;
        }
        
        if (eta && progressEta) {
          progressEta.textContent = eta;
        }
      }
    }
    
    function hideProgressBar() {
      const overlay = document.getElementById('progress-overlay');
      if (overlay) {
        overlay.classList.remove('show');
      }
    }
    
    // Enhanced progress simulation for download operations
    async function simulateProgressSteps(steps, totalDuration = 3000) {
      const stepDuration = totalDuration / steps.length;
      const startTime = Date.now();
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const progress = ((i + 1) / steps.length) * 100;
        const elapsed = Date.now() - startTime;
        const estimatedTotal = (elapsed / (i + 1)) * steps.length;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        const eta = remaining > 1000 
          ? `${Math.ceil(remaining / 1000)}s restantes`
          : `${Math.ceil(remaining)}ms restantes`;
        
        updateProgress(progress, step.message, eta);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, step.duration || stepDuration));
      }
    }
    
    // Enhanced download function with progress bar
    async function downloadImageWithProgress() {
      if (!canvas) {
        showError('No hay imagen para descargar.');
        return;
      }

      if (!currentFile) {
        showError('Por favor, selecciona una imagen primero.');
        return;
      }
      
      try {
        // Show progress bar
        showProgressBar('Iniciando descarga...');
        
        // Define download steps
        const downloadSteps = [
          { message: 'Obteniendo metadatos...', duration: 300 },
          { message: 'Aplicando metadatos...', duration: 400 },
          { message: 'Generando nombre de archivo...', duration: 200 },
          { message: 'Configurando formato de salida...', duration: 300 },
          { message: 'Procesando imagen...', duration: 600 },
          { message: 'Generando archivo...', duration: 500 },
          { message: 'Iniciando descarga...', duration: 400 }
        ];
        
        // Start progress simulation
        const progressPromise = simulateProgressSteps(downloadSteps, 2800);
        
        // Obtener metadatos antes de la descarga
        const metadata = MetadataManager.getMetadata();
        const exifData = MetadataManager.applyMetadataToImage(canvas);
        
        // Wait for initial progress steps
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mostrar resumen de metadatos si están presentes
        if (metadata.title || metadata.author || metadata.copyright || metadata.latitude) {
          console.log('Metadatos aplicados:', metadata);
          
          let metaInfo = [];
          if (metadata.title) metaInfo.push(`Título: ${metadata.title}`);
          if (metadata.author) metaInfo.push(`Autor: ${metadata.author}`);
          if (metadata.copyright) metaInfo.push(`Copyright: ${metadata.copyright}`);
          if (metadata.latitude && metadata.longitude) {
            metaInfo.push(`Ubicación: ${metadata.latitude}, ${metadata.longitude}`);
          }
          
          console.log('Resumen de metadatos aplicados:\n' + metaInfo.join('\n'));
        }
        
        // Wait for more progress
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Generar nombre del archivo basado en el título o usar uno por defecto
        let filename = 'imagen-editada';
        
        if (metadata.title && metadata.title.trim()) {
          filename = metadata.title.trim();
        } else if (currentFile && currentFile.name) {
          filename = currentFile.name.replace(/\.[^/.]+$/, '');
        }
        
        // Limpiar el nombre de archivo
        filename = sanitizeFilename(filename);
        
        // Usar el formato seleccionado en lugar de la extensión original
        const extension = getFileExtension(outputFormat);
        const fullFilename = `${filename}.${extension}`;
        
        // Wait for processing steps
        await new Promise(resolve => setTimeout(resolve, 900));
        
        // Obtener el tipo MIME basado en el formato seleccionado
        const mimeType = getMimeType(outputFormat);
        
        // Complete progress
        await progressPromise;
        
        // Fallback para navegadores que no soportan la API o si falla
        const link = document.createElement('a');
        link.download = fullFilename;
        link.href = canvas.toDataURL(mimeType, outputQuality);
        
        // Simular click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Hide progress bar
        hideProgressBar();
        
        const qualityText = outputFormat === 'png' ? '' : ` (calidad: ${Math.round(outputQuality * 100)}%)`;
        showSuccess(`Imagen descargada en formato ${outputFormat.toUpperCase()}${qualityText}!`);
        
      } catch (error) {
        console.error('Error al descargar:', error);
        hideProgressBar();
        showError('Error al descargar la imagen.');
      }
    }
    
    
    // Hide image info when no image is loaded
    function hideImageInfo() {
      const imageInfoElement = document.getElementById('image-info');
      if (imageInfoElement) {
        imageInfoElement.classList.add('hidden');
      }
    }

    function removeSelectedFile() {
      currentImage = null;
      currentFile = null;
      originalExtension = 'jpg';
      watermarkImagePreview = null;
      customImagePosition = null;
      isPositioningMode = false;
      
      // Limpiar cache
      cache.watermarkImage = null;
      cache.lastWatermarkConfig = null;
      
      // Limpiar formularios
      document.getElementById('file-input').value = '';
      document.getElementById('metadata-form').reset();
      document.getElementById('watermark-form').reset();
      
      // Ocultar elementos
      document.getElementById('file-info').classList.add('file-info--hidden');
      document.getElementById('editor-container').classList.add('editor-container--hidden');
      
      // Ocultar controles de zoom
      const zoomControls = document.getElementById('zoom-controls');
      if (zoomControls) {
        zoomControls.classList.add('hidden');
      }
      
      hideImageInfo(); // Ocultar información de imagen
      
      // Limpiar canvas
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Limpiar marcador de posición si existe
      removePositionMarker();
      
      // Ocultar información de posicionamiento personalizado
      const customInfo = document.getElementById('custom-position-info');
      if (customInfo) {
        customInfo.style.display = 'none';
      }
      
      // Quitar clase de posicionamiento del canvas
      if (canvas) {
        canvas.classList.remove('positioning-mode');
      }
      
      // Ocultar preview de metadatos si está visible
      hideMetadataPreview();
      
      // Resetear controles de salida
      resetOutputControls();
      
      UIManager.hideError();
      UIManager.showSuccess('Archivo removido correctamente');
    }

    // Funciones de pantalla completa
    function toggleFullscreen() {
      const canvas = document.getElementById('preview-canvas');
      const container = canvas.parentElement;
      
      if (!document.fullscreenElement) {
        // Entrar en pantalla completa
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
        
        // Agregar clase para estilos de pantalla completa
        container.classList.add('fullscreen-mode');
        canvas.style.maxWidth = '100vw';
        canvas.style.maxHeight = '100vh';
        canvas.style.objectFit = 'contain';
        
      } else {
        // Salir de pantalla completa
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    }

    function handleFullscreenChange() {
      const canvas = document.getElementById('preview-canvas');
      const container = canvas.parentElement;
      const fullscreenBtn = document.getElementById('fullscreen-btn');
      
      if (!document.fullscreenElement) {
        // Saliendo de pantalla completa
        container.classList.remove('fullscreen-mode');
        canvas.style.maxWidth = '';
        canvas.style.maxHeight = '';
        canvas.style.objectFit = '';
        
        if (fullscreenBtn) {
          fullscreenBtn.innerHTML = '<i class="fas fa-expand" aria-hidden="true"></i> Pantalla completa';
        }
      } else {
        // Entrando en pantalla completa
        if (fullscreenBtn) {
          fullscreenBtn.innerHTML = '<i class="fas fa-compress" aria-hidden="true"></i> Salir';
        }
      }
    }

    function showError(message) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-down max-w-sm';
      notification.innerHTML = `
        <div class="flex items-center">
          <i class="fas fa-exclamation-triangle mr-3"></i>
          <span>${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-red-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.classList.add('animate-fade-out');
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    }

    function hideError() {
      // Legacy function kept for compatibility
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.classList.add('error--hidden');
      }
    }

    function showSuccess(message) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-down max-w-sm';
      notification.innerHTML = `
        <div class="flex items-center">
          <i class="fas fa-check-circle mr-3"></i>
          <span>${message}</span>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-green-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.classList.add('animate-fade-out');
          setTimeout(() => notification.remove(), 300);
        }
      }, 4000);
    }

    // Enhanced download function with progress
    async function downloadImageEnhanced() {
      if (!canvas || !currentImage) {
        showError('No hay imagen para descargar');
        return;
      }
      
      try {
        showLoadingState('Preparando descarga...');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const filename = `imagen-editada-${timestamp}.png`;
        
        // Create download with enhanced quality
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        
        // Trigger download with smooth animation
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        hideLoadingState();
        
      } catch (error) {
        console.error('Error downloading image:', error);
        hideLoadingState();
        showError('Error al descargar la imagen');
      }
    }

    // Loading state management
    function showLoadingState(message = 'Procesando...') {
      const overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in';
      
      overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 text-center animate-slide-up">
          <div class="animate-pulse mb-4">
            <div class="w-8 h-8 bg-blue-500 rounded-full mx-auto"></div>
          </div>
          <p class="text-gray-700 dark:text-gray-300 font-medium">${message}</p>
          <div class="mt-4">
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full animate-loading-bar"></div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
    }

    function hideLoadingState() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) {
        overlay.classList.add('animate-fade-out');
        setTimeout(() => overlay.remove(), 300);
      }
    }

    // Enhanced clear metadata function
    function clearMetadata() {
      const form = document.getElementById('metadata-form');
      if (form) {
        form.reset();
        showSuccess('Metadatos limpiados');
      }
    }

    // Performance monitoring
    function measurePerformance(operation, fn) {
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      
      if (end - start > 100) { // Log operations taking more than 100ms
        console.log(`Performance: ${operation} took ${(end - start).toFixed(2)}ms`);
      }
      
      return result;
    }

    // Enhanced error handling
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      showError('Se ha producido un error inesperado');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      showError('Error en operación asíncrona');
    });

    // MetadataManager extraído a js/managers/metadata-manager.js

    // FilterManager extraído a js/managers/filter-manager.js

    // Función para resetear filtros
    function resetFilters() {
      FilterManager.reset();
      UIManager.showSuccess('Filtros reseteados');
    }

    // Función para aplicar filtros al canvas con optimizaciones
    function applyCanvasFilters() {
      if (!canvas) {
        console.log('No hay canvas disponible para aplicar filtros');
        FilterLoadingManager.hideFilterLoading();
        return;
      }
      
      // Verificar si necesita actualización usando cache
      if (!FilterCache.hasChanged(FilterManager.filters)) {
        console.log('⚡ Filtros no han cambiado, omitiendo aplicación al canvas');
        FilterLoadingManager.hideFilterLoading();
        return;
      }
      
      // Usar requestAnimationFrame para mejor performance
      requestAnimationFrame(() => {
        try {
          const filterString = FilterManager.getFilterString();
          console.log('🎨 Aplicando filtros CSS al canvas:', filterString || 'none');
          
          // Aplicar filtros con transición suave
          canvas.style.transition = 'filter 0.2s ease';
          canvas.style.filter = filterString;
          
          // Ocultar loading states después de aplicar
          setTimeout(() => {
            FilterLoadingManager.hideFilterLoading();
          }, 200);
          
        } catch (error) {
          console.error('❌ Error al aplicar filtros:', error);
          FilterLoadingManager.hideFilterLoading();
        }
      });
    }
    
    // Función para aplicar solo filtros ligeros (después del worker)
    function applyCanvasFiltersLight() {
      if (!canvas) return;
      
      // Solo aplicar filtros que no son procesados por el worker
      const lightFilters = {
        hue: FilterManager.filters.hue,
        sepia: FilterManager.filters.sepia,
        grayscale: FilterManager.filters.grayscale,
        invert: FilterManager.filters.invert
      };
      
      // Generar string de filtros ligeros
      const filterParts = [];
      
      if (lightFilters.hue !== 0) {
        filterParts.push(`hue-rotate(${lightFilters.hue}deg)`);
      }
      if (lightFilters.sepia !== 0) {
        filterParts.push(`sepia(${lightFilters.sepia}%)`);
      }
      if (lightFilters.grayscale !== 0) {
        filterParts.push(`grayscale(${lightFilters.grayscale}%)`);
      }
      if (lightFilters.invert !== 0) {
        filterParts.push(`invert(${lightFilters.invert}%)`);
      }
      
      const filterString = filterParts.join(' ');
      
      requestAnimationFrame(() => {
        canvas.style.transition = 'filter 0.2s ease';
        canvas.style.filter = filterString;
      });
    }
    
    // ===== ZOOM FUNCTIONALITY =====
    
    function zoomIn() {
      if (currentZoom < maxZoom) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
        applyZoom();
        updateZoomLevel();
        UIManager.showSuccess(`Zoom: ${Math.round(currentZoom * 100)}%`);
      }
    }
    
    function zoomOut() {
      if (currentZoom > minZoom) {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
        applyZoom();
        updateZoomLevel();
        UIManager.showSuccess(`Zoom: ${Math.round(currentZoom * 100)}%`);
      }
    }
    
    // Funciones de zoom específicas para rueda del ratón (más suaves)
    function zoomInWheel() {
      if (currentZoom < maxZoom) {
        const wheelStep = 0.05; // Paso más pequeño para rueda del ratón
        currentZoom = Math.min(currentZoom + wheelStep, maxZoom);
        applyZoom();
        updateZoomLevel();
      }
    }
    
    function zoomOutWheel() {
      if (currentZoom > minZoom) {
        const wheelStep = 0.05; // Paso más pequeño para rueda del ratón
        currentZoom = Math.max(currentZoom - wheelStep, minZoom);
        applyZoom();
        updateZoomLevel();
      }
    }
    
    function resetZoom() {
      currentZoom = 1.0;
      isZoomed = false;
      resetPan(); // Reset pan también
      applyZoom();
      updateZoomLevel();
      UIManager.showSuccess('Zoom reseteado');
    }
    
    function applyZoom() {
      if (!canvas) return;
      
      if (currentZoom !== 1.0) {
        isZoomed = true;
        canvas.classList.add('zoomed');
        canvas.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
        canvas.style.transformOrigin = 'center center';
        canvas.style.cursor = 'grab';
      } else {
        isZoomed = false;
        canvas.classList.remove('zoomed');
        canvas.style.transform = 'scale(1)';
        canvas.style.cursor = 'default';
        // Reset pan cuando no hay zoom
        panX = 0;
        panY = 0;
      }
      
      // Actualizar scroll del contenedor si es necesario
      const previewContainer = document.querySelector('.preview__container');
      if (previewContainer && isZoomed) {
        previewContainer.style.overflow = 'hidden'; // Cambiar a hidden para pan
      } else if (previewContainer) {
        previewContainer.style.overflow = 'hidden';
      }
    }
    
    function updateZoomLevel() {
      const zoomLevelElement = document.getElementById('zoom-level');
      if (zoomLevelElement) {
        zoomLevelElement.textContent = `${Math.round(currentZoom * 100)}%`;
      }
      
      // Actualizar estado de los botones
      const zoomInBtn = document.getElementById('zoom-in-btn');
      const zoomOutBtn = document.getElementById('zoom-out-btn');
      
      if (zoomInBtn) {
        zoomInBtn.disabled = currentZoom >= maxZoom;
        zoomInBtn.style.opacity = currentZoom >= maxZoom ? '0.5' : '1';
      }
      
      if (zoomOutBtn) {
        zoomOutBtn.disabled = currentZoom <= minZoom;
        zoomOutBtn.style.opacity = currentZoom <= minZoom ? '0.5' : '1';
      }
    }
    
    // Atajos de teclado para zoom
    function initZoomKeyboardShortcuts() {
      document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
          switch(e.key) {
            case '+':
            case '=':
              e.preventDefault();
              zoomIn();
              break;
            case '-':
              e.preventDefault();
              zoomOut();
              break;
            case '0':
              e.preventDefault();
              resetZoom();
              break;
          }
        }
      });
    }
    
    // Zoom con rueda del ratón
    function initMouseWheelZoom() {
      const previewContainer = document.querySelector('.preview__container');
      const canvas = document.getElementById('preview-canvas');
      
      if (!previewContainer) return;
      
      const handleWheelZoom = function(e) {
        // Solo hacer zoom si hay una imagen cargada
        if (!currentImage || !canvas) return;
        
        // Prevenir el scroll normal de la página
        e.preventDefault();
        
        // Determinar dirección del scroll
        const delta = e.deltaY;
        
        if (delta < 0) {
          // Scroll hacia arriba = Zoom In
          zoomInWheel();
        } else if (delta > 0) {
          // Scroll hacia abajo = Zoom Out
          zoomOutWheel();
        }
      };
      
      // Agregar event listener al contenedor del preview
      previewContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
      
      // También agregar al canvas directamente cuando esté disponible
      if (canvas) {
        canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
      }
      
      console.log('Mouse wheel zoom initialized');
    }
    
    // ===== PAN FUNCTIONALITY =====
    
    function initPanNavigation() {
      const canvas = document.getElementById('preview-canvas');
      if (!canvas) return;
      
      // Mouse down - iniciar pan
      canvas.addEventListener('mousedown', function(e) {
        if (!isZoomed || !currentImage) return;
        
        isPanning = true;
        startPanX = e.clientX;
        startPanY = e.clientY;
        startOffsetX = panX;
        startOffsetY = panY;
        
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      });
      
      // Mouse move - pan activo
      document.addEventListener('mousemove', function(e) {
        if (!isPanning || !isZoomed) return;
        
        const deltaX = e.clientX - startPanX;
        const deltaY = e.clientY - startPanY;
        
        // Calcular nuevas posiciones con límites
        const maxPanX = (canvas.offsetWidth * (currentZoom - 1)) / 2;
        const maxPanY = (canvas.offsetHeight * (currentZoom - 1)) / 2;
        
        panX = Math.max(-maxPanX, Math.min(maxPanX, startOffsetX + deltaX / currentZoom));
        panY = Math.max(-maxPanY, Math.min(maxPanY, startOffsetY + deltaY / currentZoom));
        
        applyZoom();
        e.preventDefault();
      });
      
      // Mouse up - finalizar pan
      document.addEventListener('mouseup', function(e) {
        if (isPanning) {
          isPanning = false;
          if (canvas && isZoomed) {
            canvas.style.cursor = 'grab';
          }
        }
      });
      
      // Mouse leave - finalizar pan
      document.addEventListener('mouseleave', function(e) {
        if (isPanning) {
          isPanning = false;
          if (canvas && isZoomed) {
            canvas.style.cursor = 'grab';
          }
        }
      });
      
      // Touch events para móviles
      canvas.addEventListener('touchstart', function(e) {
        if (!isZoomed || !currentImage) return;
        
        const touch = e.touches[0];
        isPanning = true;
        startPanX = touch.clientX;
        startPanY = touch.clientY;
        startOffsetX = panX;
        startOffsetY = panY;
        
        e.preventDefault();
      }, { passive: false });
      
      document.addEventListener('touchmove', function(e) {
        if (!isPanning || !isZoomed) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - startPanX;
        const deltaY = touch.clientY - startPanY;
        
        // Calcular nuevas posiciones con límites
        const maxPanX = (canvas.offsetWidth * (currentZoom - 1)) / 2;
        const maxPanY = (canvas.offsetHeight * (currentZoom - 1)) / 2;
        
        panX = Math.max(-maxPanX, Math.min(maxPanX, startOffsetX + deltaX / currentZoom));
        panY = Math.max(-maxPanY, Math.min(maxPanY, startOffsetY + deltaY / currentZoom));
        
        applyZoom();
        e.preventDefault();
      }, { passive: false });
      
      document.addEventListener('touchend', function(e) {
        if (isPanning) {
          isPanning = false;
        }
      });
      
      console.log('Pan navigation initialized');
    }
    
    function resetPan() {
      panX = 0;
      panY = 0;
      isPanning = false;
      if (canvas) {
        canvas.style.cursor = isZoomed ? 'grab' : 'default';
      }
    }
    
    // ===== MOBILE RESPONSIVE FEATURES =====
    
    function initMobileFeatures() {
      if (!isMobileDevice()) return;
      
      // Initialize touch gestures
      initTouchGestures();
      
      // Initialize mobile navigation
      initMobileNavigation();
      
      // Initialize mobile canvas interactions
      initMobileCanvasInteraction();
      
      // Initialize keyboard handling for mobile
      initMobileKeyboard();
      
      // Initialize orientation change handling
      initOrientationHandling();
      
      console.log('Mobile features initialized');
    }
    
    function isMobileDevice() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
             window.innerWidth <= 768 ||
             ('ontouchstart' in window) ||
             (navigator.maxTouchPoints > 0);
    }
    
    function initTouchGestures() {
      let startY = 0;
      let isScrolling = false;
      
      // Smooth scrolling for mobile
      document.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY;
        isScrolling = false;
      }, { passive: true });
      
      document.addEventListener('touchmove', function(e) {
        if (!isScrolling) {
          const currentY = e.touches[0].clientY;
          const diffY = Math.abs(currentY - startY);
          
          if (diffY > 10) {
            isScrolling = true;
          }
        }
      }, { passive: true });
      
      // Double tap to reset zoom on canvas
      let lastTap = 0;
      const canvas = document.getElementById('preview-canvas');
      
      if (canvas) {
        canvas.addEventListener('touchend', function(e) {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTap;
          
          if (tapLength < 500 && tapLength > 0) {
            // Double tap detected - reset canvas view
            resetCanvasView();
            e.preventDefault();
          }
          lastTap = currentTime;
        });
      }
    }
    
    function initMobileNavigation() {
      // Auto-collapse sections on mobile after interaction
      const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
      
      collapsibleHeaders.forEach(header => {
        header.addEventListener('touchend', function() {
          // Small delay to ensure smooth animation
          setTimeout(() => {
            // Auto-scroll to the opened section
            if (!header.closest('.collapsible').classList.contains('collapsed')) {
              header.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest' 
              });
            }
          }, 100);
        });
      });
      
      // Mobile sticky navigation helper
      const actionButtons = document.querySelector('.action-buttons');
      if (actionButtons && window.innerWidth <= 767) {
        // Make action buttons sticky on mobile
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              actionButtons.classList.remove('fixed-bottom');
            } else {
              actionButtons.classList.add('fixed-bottom');
            }
          });
        });
        
        // Observe the last section
        const lastSection = document.querySelector('section:last-of-type');
        if (lastSection) {
          observer.observe(lastSection);
        }
      }
    }
    
    function initMobileCanvasInteraction() {
      const canvas = document.getElementById('preview-canvas');
      if (!canvas) return;
      
      let startX = 0;
      let startY = 0;
      let scale = 1;
      let initialDistance = 0;
      
      // Pinch to zoom
      canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
          // Two finger touch - prepare for zoom
          initialDistance = getDistance(e.touches[0], e.touches[1]);
          e.preventDefault();
        } else if (e.touches.length === 1) {
          // Single touch - prepare for pan
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }
      }, { passive: false });
      
      canvas.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2) {
          // Pinch zoom
          const currentDistance = getDistance(e.touches[0], e.touches[1]);
          const scaleChange = currentDistance / initialDistance;
          scale = Math.min(Math.max(0.5, scale * scaleChange), 3);
          
          canvas.style.transform = `scale(${scale})`;
          initialDistance = currentDistance;
          e.preventDefault();
        }
      }, { passive: false });
      
      canvas.addEventListener('touchend', function(e) {
        if (e.touches.length === 0) {
          // Reset if scale is too small
          if (scale < 0.8) {
            scale = 1;
            canvas.style.transform = 'scale(1)';
          }
        }
      });
    }
    
    function initMobileKeyboard() {
      // Handle virtual keyboard appearance
      let initialViewportHeight = window.innerHeight;
      
      window.addEventListener('resize', function() {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // If height decreased significantly, keyboard is likely open
        if (heightDifference > 150) {
          document.body.classList.add('keyboard-open');
          
          // Scroll focused element into view
          const focusedElement = document.activeElement;
          if (focusedElement && focusedElement.tagName !== 'BODY') {
            setTimeout(() => {
              focusedElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }, 100);
          }
        } else {
          document.body.classList.remove('keyboard-open');
        }
      });
      
      // Prevent zoom on input focus for iOS
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        input.addEventListener('focus', function() {
          if (this.style.fontSize !== '16px') {
            this.style.fontSize = '16px';
          }
        });
      });
    }
    
    function initOrientationHandling() {
      // Handle orientation changes
      window.addEventListener('orientationchange', function() {
        setTimeout(() => {
          // Recalculate layout after orientation change
          if (canvas && currentImage) {
            updatePreview();
          }
          
          // Reset any zoom applied to canvas
          const canvas = document.getElementById('preview-canvas');
          if (canvas) {
            canvas.style.transform = 'scale(1)';
          }
          
          // Update container widths
          updateMobileLayout();
        }, 100);
      });
    }
    
    function getDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    function resetCanvasView() {
      const canvas = document.getElementById('preview-canvas');
      if (canvas) {
        canvas.style.transform = 'scale(1)';
        canvas.style.transformOrigin = 'center';
      }
    }
    
    function updateMobileLayout() {
      if (!isMobileDevice()) return;
      
      // Update grid layouts for current screen size
      const grids = document.querySelectorAll('.grid');
      grids.forEach(grid => {
        if (window.innerWidth <= 480) {
          // Extra small screens - single column
          grid.style.gridTemplateColumns = '1fr';
        } else if (window.innerWidth <= 768) {
          // Small screens - adjust based on content
          if (grid.classList.contains('grid-cols-2')) {
            grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
          }
        }
      });
      
      // Update button groups
      const buttonGroups = document.querySelectorAll('.button-group');
      buttonGroups.forEach(group => {
        if (window.innerWidth <= 480) {
          group.style.flexDirection = 'column';
        } else {
          group.style.flexDirection = 'row';
        }
      });
      
      // Reajustar canvas si hay una imagen cargada
      if (currentImage && canvas) {
        setupCanvas();
        updatePreview();
      }
    }
    
    // Add mobile-specific CSS class to body
    if (isMobileDevice()) {
      document.body.classList.add('mobile-device');
    }
    
    // Initialize on window load
    window.addEventListener('load', function() {
      if (isMobileDevice()) {
        updateMobileLayout();
      }
    });
    
    // Add resize event listener for responsive canvas
    window.addEventListener('resize', function() {
      // Debounce the resize event
      clearTimeout(window.resizeTimer);
      window.resizeTimer = setTimeout(function() {
        if (isMobileDevice()) {
          updateMobileLayout();
        }
      }, 250);
    });

    // ===== FILTER OPTIMIZATION & CLEANUP =====
    
    // Limpieza automática de cache cada 5 minutos
    setInterval(() => {
      FilterCache.cleanup();
      console.log('🧹 Limpieza automática de cache de filtros ejecutada');
    }, 5 * 60 * 1000);
    
    // Cleanup al cerrar/recargar página
    window.addEventListener('beforeunload', () => {
      SmartDebounce.clear();
      FilterLoadingManager.activeLoadings.clear();
      console.log('🧹 Cleanup de debounce y loading states completado');
    });
    
    // Función para mostrar métricas de rendimiento (desarrollo)
    window.getFilterPerformanceMetrics = function() {
      const metrics = FilterManager.getPerformanceMetrics();
      console.table({
        'Cache Size': metrics.cacheSize,
        'Cache Dirty': metrics.isDirty,
        'Active Loadings': metrics.activeLoadings,
        'Smart Debounce Timers': SmartDebounce.timers.size,
        'Animation Frames': SmartDebounce.animationFrames.size
      });
      return metrics;
    };
    
    console.log('🎨 Sistema de filtros optimizado inicializado');
    console.log('💡 Usa getFilterPerformanceMetrics() para ver métricas de rendimiento');