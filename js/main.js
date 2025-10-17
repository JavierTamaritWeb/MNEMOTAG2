 // Variables globales optimizadas
    let currentImage = null;
    let canvas = null;
    let ctx = null;
    let currentFile = null;
    let originalExtension = 'jpg';
    let lastDownloadDirectory = null;
    let fileBaseName = 'imagen'; // Nombre base del archivo (sin extensión)
    
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
    
    // Variables para posicionamiento interactivo de imagen y texto
    let customImagePosition = null;
    let customTextPosition = null;
    let isPositioningMode = false;
    let isTextPositioningMode = false;
    let watermarkImagePreview = null;
    let lastPositioningModeActivated = null; // 'image' o 'text' - rastrea cuál se activó último
    
    // Variables para sistema Drag & Drop
    let isDragging = false;
    let dragTarget = null; // 'text' o 'image'
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let textWatermarkBounds = null; // { x, y, width, height }
    let imageWatermarkBounds = null; // { x, y, width, height }
    let showPositioningBorders = true; // Controla si se muestran los bordes de guía (false al descargar)
    
    // Variables para sistema de Reglas Métricas
    let isRulerMode = false;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let rulerElements = {
      horizontalRuler: null,
      verticalRuler: null,
      horizontalLine: null,
      verticalLine: null,
      coordinateDisplay: null,
      container: null
    };
    
    // Managers Avanzados (Nuevos)
    let keyboardShortcuts = null;
    let batchManager = null;
    let textLayerManager = null;
    let cropManager = null;
    
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
        // Inicializar UI dinámica desde AppConfig
        initializeUIFromConfig();
        
        // Obtener elementos del DOM
        canvas = document.getElementById('preview-canvas');
        if (!canvas) {
          throw new Error('Canvas element not found');
        }
        
        ctx = canvas.getContext('2d', { 
          alpha: true,
          willReadFrequently: false // Optimizar para escritura, no lectura frecuente
        });
        if (!ctx) {
          throw new Error('Canvas context not available');
        }
        
        // Configurar renderizado de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
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
          // Inicializar modo de posicionamiento de imagen
          togglePositioningMode();
          // Inicializar modo de posicionamiento de texto
          toggleTextPositioningMode();
          // Inicializar controles de salida
          initializeOutputControls();
        }, 100);
        
        // Inicializar managers avanzados
        initializeAdvancedManagers();
        
        // Configurar atajos de teclado
        setupKeyboardShortcuts();
        
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
      
      const formats = [
        { value: 'webp', mimeType: 'image/webp' },
        { value: 'avif', mimeType: 'image/avif' }
      ];
      
      for (const format of formats) {
        const isEncodeSupported = await supportsEncode(format.mimeType);
        const option = formatSelect.querySelector(`option[value="${format.value}"]`);
        
        if (option) {
          if (!isEncodeSupported) {
            // NO deshabilitar la opción, solo agregar información
            if (!option.textContent.includes('(Fallback automático)')) {
              option.textContent = option.textContent.replace(' (No soportado)', '') + ' (Fallback automático)';
            }
            option.style.color = '#f59e0b'; // Color ámbar para indicar fallback
            option.title = `${format.value.toUpperCase()} no es soportado nativamente. Se exportará en el mejor formato compatible disponible.`;
          } else {
            option.style.color = ''; // Restaurar color original
            option.title = `Formato ${format.value.toUpperCase()} disponible nativamente`;
          }
        }
      }
      
      console.log('Verificación de soporte de formatos completada - todas las opciones habilitadas con fallback');
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
        
        // Auto-actualizar copyright cuando cambia la licencia
        const licenseSelect = document.getElementById('metaLicense');
        if (licenseSelect) {
          licenseSelect.addEventListener('change', () => {
            const copyrightInput = document.getElementById('metaCopyright');
            const authorInput = document.getElementById('metaAuthor');
            if (authorInput && authorInput.value) {
              // Regenerar copyright con la nueva licencia
              generateAutoCopyright();
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
        const rulerToggleBtn = document.getElementById('ruler-toggle-btn');

        if (zoomInBtn && zoomOutBtn && zoomResetBtn) {
          zoomInBtn.addEventListener('click', zoomIn);
          zoomOutBtn.addEventListener('click', zoomOut);
          zoomResetBtn.addEventListener('click', resetZoom);
        }
        
        if (rulerToggleBtn) {
          rulerToggleBtn.addEventListener('click', toggleRulerMode);
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
            // Verificar si este elemento es un slider que necesita sincronización
            const sliderIds = ['watermark-size', 'watermark-opacity', 'watermark-image-opacity'];
            if (sliderIds.includes(id) && event === 'input') {
              // Crear listener personalizado que sincroniza con el campo numérico
              element.addEventListener(event, (e) => {
                // Actualizar el campo numérico correspondiente
                const numberInput = document.getElementById(`${id}-num`);
                if (numberInput) {
                  numberInput.value = e.target.value;
                }
                // Llamar a la función de actualización original
                debouncedUpdatePreview(e);
              });
            } else if (id === 'watermark-font') {
              // Cargar fuente de Google Fonts si es necesaria
              element.addEventListener(event, async (e) => {
                const fontFamily = e.target.value;
                const googleFonts = ['Roboto', 'Montserrat', 'Montserrat Alternates', 'Open Sans', 'Lato', 'Poppins', 'Inter', 'Playfair Display', 'Bebas Neue', 'Dancing Script', 'Lobster'];
                
                if (googleFonts.includes(fontFamily)) {
                  try {
                    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;600;700&display=swap`;
                    const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/ /g, '+')}"]`);
                    
                    if (!existingLink) {
                      const link = document.createElement('link');
                      link.rel = 'stylesheet';
                      link.href = fontUrl;
                      document.head.appendChild(link);
                      await document.fonts.load(`16px "${fontFamily}"`);
                      console.log(`✅ Google Font cargada para marca de agua: ${fontFamily}`);
                    }
                  } catch (error) {
                    console.warn(`Error cargando fuente ${fontFamily}:`, error);
                  }
                }
                debouncedUpdatePreview(e);
              });
            } else {
              // Usar el listener original para otros elementos
              element.addEventListener(event, debouncedUpdatePreview);
            }
          }
        });
        
        // Posicionamiento personalizado para imagen
        const watermarkImagePosition = document.getElementById('watermark-image-position');
        if (watermarkImagePosition) {
          watermarkImagePosition.addEventListener('change', togglePositioningMode);
        }
        
        // Posicionamiento personalizado para texto
        const watermarkTextPosition = document.getElementById('watermark-position');
        if (watermarkTextPosition) {
          watermarkTextPosition.addEventListener('change', toggleTextPositioningMode);
        }
        
        // Event listener para el canvas en modo posicionamiento
        if (canvas) {
          canvas.addEventListener('click', handleCanvasClick);
          
          // Event listeners para sistema Drag & Drop (Mouse)
          canvas.addEventListener('mousedown', handleDragStart);
          canvas.addEventListener('mousemove', handleDragMove);
          canvas.addEventListener('mouseup', handleDragEnd);
          canvas.addEventListener('mouseleave', handleDragEnd); // Finalizar drag si sale del canvas
          
          // Event listeners para sistema Drag & Drop (Touch)
          canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
          canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
          canvas.addEventListener('touchend', handleTouchEnd);
          canvas.addEventListener('touchcancel', handleTouchEnd);
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
        
        // Advanced Tools buttons (v3.1)
        const batchModeBtn = document.getElementById('batch-mode-btn');
        const textLayersBtn = document.getElementById('text-layers-btn');
        const cropModeBtn = document.getElementById('crop-mode-btn');
        const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');
        
        if (batchModeBtn) {
          batchModeBtn.addEventListener('click', () => {
            if (typeof window.openBatchModal === 'function') {
              window.openBatchModal();
            } else {
              console.error('❌ openBatchModal no está definida. Verifica que initializeAdvancedUI() se haya ejecutado.');
            }
          });
          console.log('✅ Event listener de Batch Mode configurado');
        }
        
        if (textLayersBtn) {
          textLayersBtn.addEventListener('click', () => {
            if (typeof window.openTextLayersPanel === 'function') {
              window.openTextLayersPanel();
            } else {
              console.error('❌ openTextLayersPanel no está definida. Verifica que initializeAdvancedUI() se haya ejecutado.');
            }
          });
          console.log('✅ Event listener de Text Layers configurado');
        }
        
        if (cropModeBtn) {
          cropModeBtn.addEventListener('click', () => {
            if (typeof window.openCropPanel === 'function') {
              window.openCropPanel();
            } else {
              console.error('❌ openCropPanel no está definida. Verifica que initializeAdvancedUI() se haya ejecutado.');
            }
          });
          console.log('✅ Event listener de Crop Mode configurado');
        }
        
        if (shortcutsHelpBtn) {
          shortcutsHelpBtn.addEventListener('click', () => {
            if (typeof window.openShortcutsModal === 'function') {
              window.openShortcutsModal();
            } else {
              console.error('❌ openShortcutsModal no está definida. Verifica que initializeAdvancedUI() se haya ejecutado.');
            }
          });
          console.log('✅ Event listener de Shortcuts configurado');
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
        
        // File basename editor
        const fileBasenameInput = document.getElementById('file-basename');
        if (fileBasenameInput) {
          fileBasenameInput.addEventListener('input', handleFileBaseNameInput);
          fileBasenameInput.addEventListener('blur', handleFileBaseNameBlur);
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
        
        // Setup bidirectional sync for watermark sliders
        setupWatermarkSliderSync();
        
      } catch (error) {
        console.error('Error configurando event listeners:', error);
      }
    }

    // Inicializar UI dinámica desde AppConfig
    function initializeUIFromConfig() {
      // Actualizar texto de tamaño máximo dinámicamente
      const maxFileSizeElement = document.getElementById('max-file-size');
      if (maxFileSizeElement && AppConfig) {
        const maxSizeMB = Math.round(AppConfig.maxFileSize / (1024 * 1024));
        maxFileSizeElement.textContent = `${maxSizeMB} MB`;
      }
    }

    // Configurar sincronización bidireccional para sliders de marca de agua
    function setupWatermarkSliderSync() {
      console.log('🔧 Configurando sincronización bidireccional para sliders de marca de agua...');
      
      // Definir los sliders que necesitan sincronización
      const sliderConfigs = [
        { sliderId: 'watermark-size', numberId: 'watermark-size-num' },
        { sliderId: 'watermark-opacity', numberId: 'watermark-opacity-num' },
        { sliderId: 'watermark-image-opacity', numberId: 'watermark-image-opacity-num' }
      ];
      
      sliderConfigs.forEach(({ sliderId, numberId }) => {
        const slider = document.getElementById(sliderId);
        const numberInput = document.getElementById(numberId);
        
        if (slider && numberInput) {
          console.log(`✅ Configurando sincronización para ${sliderId}`);
          
          // Copiar atributos del slider al input numérico
          numberInput.min = slider.min;
          numberInput.max = slider.max;
          numberInput.step = slider.step || 1;
          
          // Sincronizar valores iniciales
          numberInput.value = slider.value;
          
          // Función para validar y clamp valores
          const validateAndClamp = (value, min, max, step = 1) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) return null;
            
            // Clamp al rango
            const clampedValue = Math.max(min, Math.min(max, numValue));
            
            // Redondear al step más cercano
            const stepValue = Math.round(clampedValue / step) * step;
            
            return Math.max(min, Math.min(max, stepValue));
          };
          
          // Crear debounced update function para el input numérico
          const debouncedNumberUpdate = SmartDebounce.intelligent(`${sliderId}-number-update`, () => {
            updatePreview();
          }, 150);
          
          // Slider → Number input
          slider.addEventListener('input', (e) => {
            numberInput.value = e.target.value;
          });
          
          // Number input → Slider
          numberInput.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Si el campo está vacío, no hacer nada hasta que sea válido
            if (value === '') return;
            
            const validatedValue = validateAndClamp(
              value,
              parseFloat(slider.min),
              parseFloat(slider.max),
              parseFloat(slider.step || 1)
            );
            
            if (validatedValue !== null) {
              slider.value = validatedValue;
              e.target.value = validatedValue;
              
              // Aplicar cambios con debounce
              debouncedNumberUpdate();
            }
          });
          
          // Validación en blur para corregir valores inválidos
          numberInput.addEventListener('blur', (e) => {
            const value = e.target.value;
            
            if (value === '' || isNaN(parseFloat(value))) {
              // Si está vacío o inválido, restaurar al valor del slider
              e.target.value = slider.value;
              return;
            }
            
            const validatedValue = validateAndClamp(
              value,
              parseFloat(slider.min),
              parseFloat(slider.max),
              parseFloat(slider.step || 1)
            );
            
            if (validatedValue !== null && validatedValue != value) {
              e.target.value = validatedValue;
              slider.value = validatedValue;
              updatePreview();
            }
          });
          
          // Manejar Enter key
          numberInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.target.blur();
            }
          });
          
        } else {
          console.warn(`❌ No se pudo configurar sincronización para ${sliderId}:`, {
            slider: !!slider,
            numberInput: !!numberInput
          });
        }
      });
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
      
      // Update button label with filename
      const watermarkInput = document.getElementById('watermark-image');
      const labelSpan = document.getElementById('watermark-file-label');
      const uploadLabel = document.getElementById('watermark-upload-label');
      const thumbnailElement = document.getElementById('watermark-preview-thumb');
      
      if (watermarkInput && labelSpan) {
        if (watermarkInput.files && watermarkInput.files[0]) {
          const fileName = watermarkInput.files[0].name;
          const shortName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
          labelSpan.textContent = shortName;
          
          // Cambiar botón a verde
          if (uploadLabel) {
            uploadLabel.classList.add('watermark-loaded');
          }
          
          // Mostrar miniatura
          if (thumbnailElement) {
            const reader = new FileReader();
            reader.onload = function(e) {
              thumbnailElement.src = e.target.result;
              thumbnailElement.style.display = 'block';
            };
            reader.readAsDataURL(watermarkInput.files[0]);
          }
        } else {
          labelSpan.textContent = 'Seleccionar archivo';
          
          // Restaurar botón a rojo
          if (uploadLabel) {
            uploadLabel.classList.remove('watermark-loaded');
          }
          
          // Ocultar miniatura
          if (thumbnailElement) {
            thumbnailElement.style.display = 'none';
            thumbnailElement.src = '';
          }
        }
      }
      
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

    async function handleFormatChange() {
      const formatSelect = document.getElementById('output-format');
      const formatInfo = document.getElementById('format-info');
      const formatTitle = document.getElementById('format-title');
      const formatDescription = document.getElementById('format-description');
      const formatCompatibility = document.getElementById('format-compatibility');
      const formatFallback = document.getElementById('format-fallback');
      
      if (!formatSelect || !formatInfo || !formatTitle || !formatDescription || !formatCompatibility) return;
      
      outputFormat = formatSelect.value;
      
      // Remove previous format classes
      formatInfo.className = formatInfo.className.replace(/format-\w+/g, '');
      formatInfo.classList.add('p-3', 'border', 'rounded-md', `format-${outputFormat}`);
      
      // Update format information
      const formatData = await getFormatInfo(outputFormat);
      formatTitle.textContent = formatData.title;
      formatDescription.textContent = formatData.description;
      formatCompatibility.textContent = formatData.compatibility;
      formatCompatibility.className = `text-xs mt-1 font-medium ${formatData.compatibilityClass}`;
      
      // Show fallback information if applicable
      if (formatFallback) {
        if (formatData.fallbackMessage) {
          formatFallback.textContent = formatData.fallbackMessage;
          formatFallback.style.display = 'block';
        } else {
          formatFallback.style.display = 'none';
        }
      }
      
      console.log('Format changed to:', outputFormat);
    }

    async function getFormatInfo(format) {
      const baseFormatInfo = {
        jpeg: {
          title: 'JPEG (.jpg)',
          description: 'Ideal para fotografías, menor tamaño de archivo. No soporta transparencia.',
          compatibility: '✓ Compatible con todos los navegadores',
          compatibilityClass: 'text-green-600',
          fallbackMessage: null
        },
        png: {
          title: 'PNG (.png)',
          description: 'Ideal para imágenes con transparencia, sin pérdida de calidad.',
          compatibility: '✓ Compatible con todos los navegadores',
          compatibilityClass: 'text-green-600',
          fallbackMessage: null
        },
        webp: {
          title: 'WebP (.webp)',
          description: 'Mejor compresión que JPEG/PNG, soporta transparencia.',
          compatibility: '✓ Compatible con navegadores modernos (95%+)',
          compatibilityClass: 'text-blue-600',
          fallbackMessage: null
        },
        avif: {
          title: 'AVIF (.avif)',
          description: 'Nueva generación, máxima compresión y calidad, soporta transparencia.',
          compatibility: '⚠ Compatible con navegadores recientes (85%+)',
          compatibilityClass: 'text-orange-600',
          fallbackMessage: null
        }
      };
      
      const formatData = baseFormatInfo[format] || baseFormatInfo.jpeg;
      
      // Check actual browser support for modern formats
      if (format === 'webp') {
        const isSupported = await supportsEncode('image/webp');
        if (!isSupported) {
          formatData.compatibility = '🔄 Fallback automático disponible';
          formatData.compatibilityClass = 'text-amber-600';
          formatData.fallbackMessage = 'ℹ️ Se exportará automáticamente en PNG o JPEG según la transparencia';
        }
      } else if (format === 'avif') {
        const isSupported = await supportsEncode('image/avif');
        if (!isSupported) {
          formatData.compatibility = '🔄 Fallback automático disponible';
          formatData.compatibilityClass = 'text-amber-600';
          formatData.fallbackMessage = 'ℹ️ Se exportará automáticamente en WebP, PNG o JPEG según disponibilidad';
        }
      }
      
      return formatData;
    }

    // ===== FUNCIONES DE MANEJO DE NOMBRE DE ARCHIVO =====

    /**
     * Maneja la entrada de texto en el campo de nombre de archivo
     * @param {Event} event - Evento input
     */
    function handleFileBaseNameInput(event) {
      const rawValue = event.target.value;
      const sanitized = sanitizeFileBaseName(rawValue);
      
      // Actualizar valor si fue sanitizado
      if (sanitized !== rawValue) {
        event.target.value = sanitized;
      }
      
      // Actualizar variable global inmediatamente
      fileBaseName = sanitized || 'imagen';
      
      // Validar y actualizar estado
      validateAndUpdateFileBaseName(sanitized);
      
      // Actualizar preview del nombre final
      updateFilenamePreview();
      
      console.log('✅ Nombre de archivo actualizado a:', fileBaseName);
    }

    /**
     * Maneja cuando el campo pierde el foco
     * @param {Event} event - Evento blur
     */
    function handleFileBaseNameBlur(event) {
      const value = event.target.value.trim();
      
      if (!value) {
        // Si está vacío, usar fallback
        event.target.value = 'imagen';
        fileBaseName = 'imagen';
        validateAndUpdateFileBaseName('imagen');
      }
    }

    /**
     * Valida y actualiza el nombre base del archivo
     * @param {string} basename - Nombre base a validar
     */
    function validateAndUpdateFileBaseName(basename) {
      const errorElement = document.getElementById('file-basename-error');
      const downloadBtn = document.getElementById('download-image');
      
      const isValid = SecurityManager.isValidFileBaseName(basename);
      
      if (isValid) {
        // Nombre válido
        fileBaseName = basename;
        if (errorElement) {
          errorElement.classList.add('hidden');
          errorElement.textContent = '';
        }
        
        // Habilitar descarga si hay imagen
        if (downloadBtn && currentImage) {
          downloadBtn.disabled = false;
        }
        
      } else {
        // Nombre inválido
        const errorMsg = SecurityManager.getFileBaseNameError(basename);
        if (errorElement) {
          errorElement.textContent = errorMsg;
          errorElement.classList.remove('hidden');
        }
        
        // Usar fallback para evitar bloquear completamente
        fileBaseName = 'imagen';
      }
      
      // Actualizar preview del nombre final
      updateFilenamePreview();
    }

    /**
     * Actualiza la previsualización del nombre final del archivo
     */
    function updateFilenamePreview() {
      const previewElement = document.getElementById('filename-preview');
      const previewTextElement = document.getElementById('filename-preview-text');
      
      if (!previewElement || !previewTextElement) return;
      
      if (currentImage) {
        const extension = getFileExtension(outputFormat);
        const finalName = `${fileBaseName}.${extension}`;
        
        previewTextElement.textContent = finalName;
        previewElement.classList.remove('hidden');
      } else {
        previewElement.classList.add('hidden');
      }
    }

    /**
     * Configura el nombre base inicial del archivo
     * @param {File} file - Archivo cargado
     */
    function setupInitialFileBaseName(file) {
      if (!file || !file.name) return;
      
      const originalBaseName = extractFileBaseName(file.name);
      const sanitizedBaseName = sanitizeFileBaseName(originalBaseName);
      
      fileBaseName = sanitizedBaseName;
      
      // Actualizar input del nombre
      const basenameInput = document.getElementById('file-basename');
      if (basenameInput) {
        basenameInput.value = sanitizedBaseName;
        basenameInput.placeholder = sanitizedBaseName;
      }
      
      // Validar el nombre inicial
      validateAndUpdateFileBaseName(sanitizedBaseName);
    }

    // Function to check format support
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
      const sections = ['metadata', 'watermark', 'filters', 'output'];
      
      // Usar delegación de eventos en el documento para capturar TODOS los clicks
      document.addEventListener('click', (e) => {
        // Buscar si el click fue en un header o dentro de uno
        const header = e.target.closest('.section__header');
        if (!header) return;
        
        // Obtener el ID del header y extraer el nombre de la sección
        const headerId = header.id;
        if (!headerId || !headerId.endsWith('-header')) return;
        
        const section = headerId.replace('-header', '');
        if (sections.includes(section)) {
          e.preventDefault();
          e.stopPropagation();
          toggleCollapsible(section);
        }
      }, true);
      
      // Configurar estilos y estado inicial de cada sección
      sections.forEach(section => {
        const header = document.getElementById(`${section}-header`);
        const content = document.getElementById(`${section}-content`);
        
        if (!header || !content) {
          console.warn(`No se encontró header o content para sección: ${section}`);
          return;
        }
        
        // Verificar estado inicial y sincronizar
        const isOpen = content.classList.contains('section__content--open');
        const icon = header.querySelector('.section__icon');
        
        // Sincronizar ícono con estado inicial
        if (icon) {
          if (isOpen) {
            icon.classList.remove('section__icon--collapsed');
          } else {
            icon.classList.add('section__icon--collapsed');
          }
        }
        
        // Hacer que el header sea más interactivo
        header.style.cursor = 'pointer';
        header.style.position = 'relative';
        header.style.zIndex = '100';
        
        // Keyboard support directo en el header
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapsible(section);
          }
        });
      });
    }

    function toggleCollapsible(section) {
      const header = document.getElementById(`${section}-header`);
      const content = document.getElementById(`${section}-content`);
      
      if (!header || !content) {
        return;
      }
      
      const icon = header.querySelector('.section__icon');
      const card = header.closest('.card');
      const isOpen = content.classList.contains('section__content--open');
      
      if (isOpen) {
        content.classList.remove('section__content--open');
        if (icon) icon.classList.add('section__icon--collapsed');
        if (card) card.classList.add('card--collapsed');
        header.setAttribute('aria-expanded', 'false');
        content.setAttribute('aria-hidden', 'true');
      } else {
        content.classList.add('section__content--open');
        if (icon) icon.classList.remove('section__icon--collapsed');
        if (card) card.classList.remove('card--collapsed');
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
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          
          .preview-container {
            position: relative;
            background: var(--bg-card, #ffffff);
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            z-index: 10000;
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
            font-size: 20px;
            cursor: pointer;
            color: var(--text-secondary, #64748b);
            padding: 4px 8px;
            line-height: 1;
            transition: color 0.2s ease;
            flex-shrink: 0;
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
              width: 95%;
              max-height: 90vh;
            }
            
            .preview-content {
              flex-direction: column;
              padding: 15px;
            }
            
            .preview-header {
              padding: 10px 12px;
            }
            
            .preview-header h3 {
              font-size: 0.875rem;
              line-height: 1.2;
              margin: 0;
            }
            
            .preview-close {
              font-size: 14px;
              padding: 2px 4px;
              margin-left: 8px;
              flex-shrink: 0;
            }
            
            .preview-actions {
              padding: 12px;
              flex-direction: column;
            }
            
            .preview-actions button {
              width: 100%;
            }
            
            .preview-info {
              min-width: auto;
            }
            
            .preview-info h4 {
              font-size: 0.875rem;
            }
            
            .preview-info li {
              font-size: 0.75rem;
              padding: 4px 0;
            }
          }
          
          @media (max-width: 480px) {
            .preview-header h3 {
              font-size: 0.8rem;
            }
            
            .preview-close {
              font-size: 12px;
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
            
            // Configurar nombre base del archivo
            setupInitialFileBaseName(file);
            
            // Configurar fecha de creación desde el archivo
            if (typeof MetadataManager !== 'undefined') {
              MetadataManager.setupCreationDate(file);
            }
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
          
          // Cambiar botón a verde y mostrar miniatura
          const uploadButton = document.getElementById('file-selector');
          if (uploadButton) {
            uploadButton.classList.add('image-loaded');
          }
          
          // Mostrar miniatura de la imagen
          const thumbnailElement = document.getElementById('file-preview-thumbnail');
          if (thumbnailElement) {
            thumbnailElement.src = src;
            thumbnailElement.style.display = 'block';
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
      
      // Usar dimensiones originales de la imagen para mantener calidad máxima
      // Solo limitar en casos extremos (imágenes muy grandes)
      const maxWidth = AppConfig.maxCanvasWidth || 2400;
      const maxHeight = AppConfig.maxCanvasHeight || 2400;
      
      let { width, height } = currentImage;
      
      // Guardar dimensiones originales
      originalImageDimensions = { width: currentImage.width, height: currentImage.height };
      
      // Solo redimensionar si la imagen es extremadamente grande
      // Esto mantiene la calidad original en la mayoría de casos
      let needsResize = false;
      let ratio = 1;
      
      if (width > maxWidth || height > maxHeight) {
        needsResize = true;
        ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // Configurar canvas con dimensiones calculadas
      canvas.width = width;
      canvas.height = height;
      
      // Para pantallas pequeñas, ajustar solo la visualización CSS, no el canvas interno
      // Esto mantiene la calidad mientras se adapta a la pantalla
      if (window.innerWidth <= 768) {
        const maxDisplayWidth = window.innerWidth - 48;
        if (width > maxDisplayWidth) {
          const displayRatio = maxDisplayWidth / width;
          canvas.style.width = maxDisplayWidth + 'px';
          canvas.style.height = Math.round(height * displayRatio) + 'px';
        } else {
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
        }
      } else {
        // En pantallas grandes, mostrar tamaño real del canvas
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
      
      // Configuración para mantener calidad de renderizado
      canvas.style.objectFit = 'contain';
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      
      // Mejorar calidad de renderizado del canvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      console.log(`📐 Canvas configurado: ${width}x${height}px (Original: ${originalImageDimensions.width}x${originalImageDimensions.height}px, Ratio: ${ratio.toFixed(2)})`);
      
      // DESACTIVADO: El zoom con rueda del mouse se maneja solo en móviles (<768px)
      // Ver initMouseWheelZoom() para la implementación con detección de dispositivo
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

    // Funciones de posicionamiento personalizado (deben estar antes de apply)
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

    function getTextWatermarkPosition(position, width, height) {
      // Si es posición personalizada, usar las coordenadas del clic
      if (position === 'custom' && customTextPosition) {
        return {
          x: customTextPosition.x - width / 2,
          y: customTextPosition.y
        };
      }
      
      // Si no, usar la función estándar
      return getWatermarkPosition(position, width, height);
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
    
    // Función auxiliar para redibujar el canvas completo desde cero
    function redrawCompleteCanvas() {
      if (!canvas || !ctx || !currentImage) {
        console.warn('⚠️ No se puede redibujar: canvas, ctx o currentImage no disponibles');
        return;
      }
      
      // 1. Limpiar canvas completamente
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 2. Redibujar imagen base con alta calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
      
      // 3. Aplicar marcas de agua (respetará showPositioningBorders)
      applyWatermarkOptimized();
      
      // 4. Aplicar filtros CSS si existen
      applyCanvasFilters();
    }

    function applyTextWatermarkOptimized() {
      const text = document.getElementById('watermark-text').value.trim();
      if (!text) {
        textWatermarkBounds = null; // No hay texto, limpiar bounds
        return;
      }
      
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
      
      // Usar función específica para texto que soporta posición personalizada
      const positions = getTextWatermarkPosition(position, textWidth, textHeight);
      
      // Guardar bounds para detección de drag & drop
      textWatermarkBounds = {
        x: positions.x,
        y: positions.y - textHeight, // Ajuste porque fillText dibuja desde la baseline
        width: textWidth,
        height: textHeight
      };
      
      // Draw text with enhanced quality
      ctx.fillText(text, positions.x, positions.y);
      
      // Si está en modo personalizado Y showPositioningBorders es true, dibujar borde indicador
      if (position === 'custom' && showPositioningBorders) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Azul semi-transparente
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Línea punteada
        ctx.strokeRect(
          textWatermarkBounds.x - 5,
          textWatermarkBounds.y - 5,
          textWatermarkBounds.width + 10,
          textWatermarkBounds.height + 10
        );
        ctx.restore();
      }
      
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
      
      // Guardar bounds para detección de drag & drop
      imageWatermarkBounds = {
        x: positions.x,
        y: positions.y,
        width: width,
        height: height
      };
      
      // Draw image with enhanced quality and shadow
      ctx.globalAlpha = opacity;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.drawImage(watermarkImg, positions.x, positions.y, width, height);
      
      // Si está en modo personalizado Y showPositioningBorders es true, dibujar borde indicador
      if (position === 'custom' && showPositioningBorders) {
        ctx.save();
        ctx.globalAlpha = 1; // Opacidad completa para el borde
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'; // Naranja semi-transparente
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]); // Línea punteada
        ctx.strokeRect(
          imageWatermarkBounds.x - 5,
          imageWatermarkBounds.y - 5,
          imageWatermarkBounds.width + 10,
          imageWatermarkBounds.height + 10
        );
        ctx.restore();
      }
      
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
        lastPositioningModeActivated = 'image'; // Registrar que imagen fue la última activada
        customInfo.style.display = 'block';
        
        // Agregar clase al canvas para el cursor
        if (canvas) {
          canvas.classList.add('positioning-mode');
          canvas.style.cursor = 'crosshair';
          
          // Actualizar clases según qué modos están activos
          updatePositioningClasses();
        }
        
        // Si ya hay una posición personalizada, mostrar el marcador
        if (customImagePosition) {
          showPositionMarker();
        }
      } else {
        isPositioningMode = false;
        // Si este era el modo activo, limpiarlo
        if (lastPositioningModeActivated === 'image') {
          lastPositioningModeActivated = isTextPositioningMode ? 'text' : null;
        }
        customInfo.style.display = 'none';
        customImagePosition = null;
        
        // Quitar clase del canvas si no hay modo de texto activo
        if (canvas && !isTextPositioningMode) {
          canvas.classList.remove('positioning-mode', 'positioning-image', 'positioning-text', 'positioning-both');
          canvas.style.cursor = 'default';
        } else if (canvas) {
          updatePositioningClasses();
        }
        
        // Quitar marcador si existe
        removePositionMarker();
      }
      
      debouncedUpdatePreview();
    }

    // Función para posicionamiento personalizado de texto
    function toggleTextPositioningMode() {
      const positionSelect = document.getElementById('watermark-position');
      const customInfo = document.getElementById('custom-text-position-info');
      
      if (positionSelect.value === 'custom') {
        isTextPositioningMode = true;
        lastPositioningModeActivated = 'text'; // Registrar que texto fue el último activado
        customInfo.style.display = 'block';
        
        // Agregar clase al canvas para el cursor
        if (canvas) {
          canvas.classList.add('positioning-mode');
          canvas.style.cursor = 'crosshair';
          
          // Actualizar clases según qué modos están activos
          updatePositioningClasses();
        }
        
        // Si ya hay una posición personalizada, mostrar el marcador
        if (customTextPosition) {
          showTextPositionMarker();
        }
      } else {
        isTextPositioningMode = false;
        // Si este era el modo activo, limpiarlo
        if (lastPositioningModeActivated === 'text') {
          lastPositioningModeActivated = isPositioningMode ? 'image' : null;
        }
        customInfo.style.display = 'none';
        customTextPosition = null;
        
        // Quitar clase del canvas si no hay modo de imagen activo
        if (canvas && !isPositioningMode) {
          canvas.classList.remove('positioning-mode', 'positioning-image', 'positioning-text', 'positioning-both');
          canvas.style.cursor = 'default';
        } else if (canvas) {
          updatePositioningClasses();
        }
        
        // Quitar marcador si existe
        removeTextPositionMarker();
      }
      
      debouncedUpdatePreview();
    }

    // Función auxiliar para actualizar las clases del canvas según los modos activos
    function updatePositioningClasses() {
      if (!canvas) return;
      
      // Limpiar clases previas
      canvas.classList.remove('positioning-image', 'positioning-text', 'positioning-both');
      
      // Añadir clase según el estado actual
      if (isPositioningMode && isTextPositioningMode) {
        canvas.classList.add('positioning-both');
      } else if (isPositioningMode) {
        canvas.classList.add('positioning-image');
      } else if (isTextPositioningMode) {
        canvas.classList.add('positioning-text');
      }
    }

    function handleCanvasClick(event) {
      // DESACTIVADO: El sistema drag & drop maneja todo automáticamente
      // Este click inicial ya no es necesario
      return;
      
      // Verificar si estamos en modo de posicionamiento (texto o imagen)
      if (!isPositioningMode && !isTextPositioningMode) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      // SISTEMA INTUITIVO: Si ambos modos están activos, usar el último activado
      if (isPositioningMode && isTextPositioningMode) {
        // Usar el último modo que se activó
        if (lastPositioningModeActivated === 'image') {
          // Posicionar IMAGEN (último activado)
          if (!watermarkImagePreview) {
            UIManager.showError('Por favor, selecciona primero una imagen de marca de agua');
            return;
          }
          customImagePosition = { x, y };
          showPositionMarker();
          updatePreview();
          UIManager.showSuccess('🖼️ Posición de IMAGEN actualizada (modo activo)');
        } else if (lastPositioningModeActivated === 'text') {
          // Posicionar TEXTO (último activado)
          customTextPosition = { x, y };
          showTextPositionMarker();
          updatePreview();
          UIManager.showSuccess('📝 Posición de TEXTO actualizada (modo activo)');
        } else {
          // Fallback: si no hay último, posicionar imagen por defecto
          if (watermarkImagePreview) {
            customImagePosition = { x, y };
            showPositionMarker();
            updatePreview();
            UIManager.showSuccess('🖼️ Posición de IMAGEN actualizada');
          } else {
            customTextPosition = { x, y };
            showTextPositionMarker();
            updatePreview();
            UIManager.showSuccess('📝 Posición de TEXTO actualizada');
          }
        }
        return;
      }
      
      // Posicionamiento de imagen (solo modo imagen activo)
      if (isPositioningMode && !isTextPositioningMode) {
        if (!watermarkImagePreview) {
          UIManager.showError('Por favor, selecciona primero una imagen de marca de agua');
          return;
        }
        
        customImagePosition = { x, y };
        showPositionMarker();
        updatePreview();
        UIManager.showSuccess('🖼️ Posición de IMAGEN actualizada');
      }
      // Posicionamiento de texto (solo modo texto activo)
      else if (isTextPositioningMode && !isPositioningMode) {
        customTextPosition = { x, y };
        showTextPositionMarker();
        updatePreview();
        UIManager.showSuccess('📝 Posición de TEXTO actualizada');
      }
    }
    
    // ========================================================================
    // SISTEMA DRAG & DROP para marcas de agua
    // ========================================================================
    
    /**
     * Detecta si un punto está dentro del texto de marca de agua
     */
    function isPointInText(x, y) {
      if (!textWatermarkBounds) return false;
      const bounds = textWatermarkBounds;
      return x >= bounds.x && x <= bounds.x + bounds.width &&
             y >= bounds.y && y <= bounds.y + bounds.height;
    }
    
    /**
     * Detecta si un punto está dentro de la imagen de marca de agua
     */
    function isPointInImage(x, y) {
      if (!imageWatermarkBounds) return false;
      const bounds = imageWatermarkBounds;
      return x >= bounds.x && x <= bounds.x + bounds.width &&
             y >= bounds.y && y <= bounds.y + bounds.height;
    }
    
    /**
     * Maneja el inicio del arrastre (mousedown)
     */
    function handleDragStart(event) {
      // No interferir con el pan del zoom
      if (isZoomed) return;
      
      // Verificar si hay elementos con posición personalizada
      const textPosition = document.getElementById('watermark-position')?.value;
      const imagePosition = document.getElementById('watermark-image-position')?.value;
      
      const textInCustomMode = textPosition === 'custom';
      const imageInCustomMode = imagePosition === 'custom';
      
      if (!textInCustomMode && !imageInCustomMode) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      // NUEVO: Si no hay posición personalizada definida, establecer una inicial
      if (textInCustomMode && !customTextPosition && textWatermarkBounds) {
        customTextPosition = {
          x: textWatermarkBounds.x + textWatermarkBounds.width / 2,
          y: textWatermarkBounds.y + textWatermarkBounds.height
        };
      }
      
      if (imageInCustomMode && !customImagePosition && imageWatermarkBounds) {
        customImagePosition = {
          x: imageWatermarkBounds.x + imageWatermarkBounds.width / 2,
          y: imageWatermarkBounds.y + imageWatermarkBounds.height / 2
        };
      }
      
      // Detectar sobre qué elemento se hizo click (Prioridad: texto > imagen)
      if (textInCustomMode && isPointInText(x, y)) {
        isDragging = true;
        dragTarget = 'text';
        dragOffsetX = x - customTextPosition.x;
        dragOffsetY = y - customTextPosition.y;
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
        event.stopPropagation();
      } else if (imageInCustomMode && isPointInImage(x, y)) {
        isDragging = true;
        dragTarget = 'image';
        dragOffsetX = x - customImagePosition.x;
        dragOffsetY = y - customImagePosition.y;
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
        event.stopPropagation();
      }
    }
    
    /**
     * Maneja el movimiento del arrastre (mousemove)
     */
    function handleDragMove(event) {
      if (!isDragging) {
        // Cambiar cursor si está sobre un elemento arrastrable
        const textPosition = document.getElementById('watermark-position')?.value;
        const imagePosition = document.getElementById('watermark-image-position')?.value;
        
        if (textPosition !== 'custom' && imagePosition !== 'custom') {
          canvas.style.cursor = 'default';
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        if ((textPosition === 'custom' && isPointInText(x, y)) || 
            (imagePosition === 'custom' && isPointInImage(x, y))) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      
      if (dragTarget === 'text') {
        customTextPosition = {
          x: x - dragOffsetX,
          y: y - dragOffsetY
        };
        showTextPositionMarker();
        updatePreview();
      } else if (dragTarget === 'image') {
        customImagePosition = {
          x: x - dragOffsetX,
          y: y - dragOffsetY
        };
        showPositionMarker();
        updatePreview();
      }
      
      event.preventDefault();
    }
    
    /**
     * Maneja el fin del arrastre (mouseup)
     */
    function handleDragEnd(event) {
      if (isDragging) {
        isDragging = false;
        const elementType = dragTarget === 'text' ? 'TEXTO' : 'IMAGEN';
        const emoji = dragTarget === 'text' ? '📝' : '🖼️';
        UIManager.showSuccess(`${emoji} ${elementType} reposicionado correctamente`);
        dragTarget = null;
        canvas.style.cursor = 'default';
      }
    }
    
    /**
     * Maneja el inicio del arrastre táctil (touchstart)
     */
    function handleTouchStart(event) {
      // No interferir con el pan del zoom
      if (isZoomed && isPanning) return;
      
      // Solo si está en modo personalizado
      const textPosition = document.getElementById('watermark-position')?.value;
      const imagePosition = document.getElementById('watermark-image-position')?.value;
      
      const textInCustomMode = textPosition === 'custom';
      const imageInCustomMode = imagePosition === 'custom';
      
      if (!textInCustomMode && !imageInCustomMode) return;
      
      const touch = event.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;
      
      // Prioridad: primero verificar texto, luego imagen
      if (textInCustomMode && isPointInText(x, y)) {
        isDragging = true;
        dragTarget = 'text';
        dragOffsetX = x - (customTextPosition?.x || textWatermarkBounds.x + textWatermarkBounds.width / 2);
        dragOffsetY = y - (customTextPosition?.y || textWatermarkBounds.y + textWatermarkBounds.height);
        event.preventDefault();
        event.stopPropagation();
      } else if (imageInCustomMode && isPointInImage(x, y)) {
        isDragging = true;
        dragTarget = 'image';
        dragOffsetX = x - (customImagePosition?.x || imageWatermarkBounds.x + imageWatermarkBounds.width / 2);
        dragOffsetY = y - (customImagePosition?.y || imageWatermarkBounds.y + imageWatermarkBounds.height / 2);
        event.preventDefault();
        event.stopPropagation();
      }
    }
    
    /**
     * Maneja el movimiento del arrastre táctil (touchmove)
     */
    function handleTouchMove(event) {
      if (!isDragging) return;
      
      const touch = event.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;
      
      if (dragTarget === 'text') {
        customTextPosition = {
          x: x - dragOffsetX,
          y: y - dragOffsetY
        };
        showTextPositionMarker();
        updatePreview();
      } else if (dragTarget === 'image') {
        customImagePosition = {
          x: x - dragOffsetX,
          y: y - dragOffsetY
        };
        showPositionMarker();
        updatePreview();
      }
      
      event.preventDefault();
    }
    
    /**
     * Maneja el fin del arrastre táctil (touchend)
     */
    function handleTouchEnd(event) {
      if (isDragging) {
        isDragging = false;
        const elementType = dragTarget === 'text' ? 'TEXTO' : 'IMAGEN';
        const emoji = dragTarget === 'text' ? '📝' : '🖼️';
        UIManager.showSuccess(`${emoji} ${elementType} reposicionado correctamente`);
        dragTarget = null;
      }
    }
    
    // ========================================================================
    // SISTEMA DE REGLAS MÉTRICAS Y COORDENADAS
    // ========================================================================
    
    /**
     * Toggle del sistema de reglas métricas
     */
    function toggleRulerMode() {
      isRulerMode = !isRulerMode;
      
      if (isRulerMode) {
        createRulers();
        UIManager.showSuccess('📐 Reglas métricas activadas');
      } else {
        removeRulers();
        UIManager.showSuccess('📐 Reglas métricas desactivadas');
      }
      
      // Actualizar el botón
      const rulerBtn = document.getElementById('ruler-toggle-btn');
      if (rulerBtn) {
        rulerBtn.classList.toggle('active', isRulerMode);
      }
    }
    
    /**
     * Crear reglas métricas y elementos visuales
     */
    function createRulers() {
      if (!canvas) return;
      
      const previewContainer = canvas.parentElement;
      if (!previewContainer) return;
      
      // Asegurar que el contenedor tenga position relative
      previewContainer.style.position = 'relative';
      
      // Crear contenedor para las reglas
      const container = document.createElement('div');
      container.id = 'ruler-system-container';
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
      `;
      
      // Crear regla horizontal (superior)
      const horizontalRuler = document.createElement('div');
      horizontalRuler.id = 'ruler-horizontal';
      horizontalRuler.style.cssText = `
        position: absolute;
        top: 0;
        left: 30px;
        right: 0;
        height: 30px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 10px;
        font-family: monospace;
        display: flex;
        align-items: flex-end;
        padding: 0 5px 2px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      `;
      
      // Crear regla vertical (izquierda)
      const verticalRuler = document.createElement('div');
      verticalRuler.id = 'ruler-vertical';
      verticalRuler.style.cssText = `
        position: absolute;
        top: 30px;
        left: 0;
        bottom: 0;
        width: 30px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 10px;
        font-family: monospace;
        box-shadow: 2px 0 5px rgba(0,0,0,0.3);
      `;
      
      // Crear línea horizontal (sigue el cursor)
      const horizontalLine = document.createElement('div');
      horizontalLine.id = 'ruler-line-horizontal';
      horizontalLine.style.cssText = `
        position: absolute;
        left: 30px;
        right: 0;
        height: 1px;
        background: #FFFFFF;
        opacity: 0.7;
        pointer-events: none;
        display: none;
      `;
      
      // Crear línea vertical (sigue el cursor)
      const verticalLine = document.createElement('div');
      verticalLine.id = 'ruler-line-vertical';
      verticalLine.style.cssText = `
        position: absolute;
        top: 30px;
        bottom: 0;
        width: 1px;
        background: #FFFFFF;
        opacity: 0.7;
        pointer-events: none;
        display: none;
      `;
      
      // Crear display de coordenadas
      const coordinateDisplay = document.createElement('div');
      coordinateDisplay.id = 'ruler-coordinates';
      coordinateDisplay.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        font-weight: bold;
        pointer-events: none;
        display: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        white-space: nowrap;
      `;
      
      // Agregar elementos al contenedor
      container.appendChild(horizontalRuler);
      container.appendChild(verticalRuler);
      container.appendChild(horizontalLine);
      container.appendChild(verticalLine);
      container.appendChild(coordinateDisplay);
      
      // Agregar contenedor al preview
      previewContainer.appendChild(container);
      
      // Guardar referencias
      rulerElements.container = container;
      rulerElements.horizontalRuler = horizontalRuler;
      rulerElements.verticalRuler = verticalRuler;
      rulerElements.horizontalLine = horizontalLine;
      rulerElements.verticalLine = verticalLine;
      rulerElements.coordinateDisplay = coordinateDisplay;
      
      // Dibujar marcas en las reglas
      drawRulerMarks();
      
      // Agregar event listeners
      canvas.addEventListener('mousemove', handleRulerMouseMove);
      canvas.addEventListener('mouseenter', showRulerGuides);
      canvas.addEventListener('mouseleave', hideRulerGuides);
    }
    
    /**
     * Dibujar marcas de medición en las reglas
     */
    function drawRulerMarks() {
      if (!canvas || !rulerElements.horizontalRuler || !rulerElements.verticalRuler) return;
      
      // Usar dimensiones REALES del canvas (no las visuales)
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calcular escala de visualización
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvasWidth;
      const scaleY = rect.height / canvasHeight;
      
      const step = 50; // Marca cada 50 píxeles en coordenadas reales
      
      // Marcas horizontales - escalar posición visual pero mostrar valor real
      let htmlH = '';
      for (let x = 0; x <= canvasWidth; x += step) {
        const visualX = x * scaleX; // Posición en pantalla
        htmlH += `<span style="position: absolute; left: ${visualX}px; bottom: 2px; font-size: 10px;">${x}</span>`;
      }
      rulerElements.horizontalRuler.innerHTML = htmlH;
      
      // Marcas verticales - escalar posición visual pero mostrar valor real
      let htmlV = '';
      for (let y = 0; y <= canvasHeight; y += step) {
        const visualY = y * scaleY; // Posición en pantalla
        htmlV += `<span style="position: absolute; left: 2px; top: ${visualY}px; font-size: 10px;">${y}</span>`;
      }
      rulerElements.verticalRuler.innerHTML = htmlV;
    }
    
    /**
     * Manejar movimiento del mouse sobre el canvas
     */
    function handleRulerMouseMove(event) {
      if (!isRulerMode) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      currentMouseX = Math.round((event.clientX - rect.left) * scaleX);
      currentMouseY = Math.round((event.clientY - rect.top) * scaleY);
      
      // Limitar a los bordes del canvas
      currentMouseX = Math.max(0, Math.min(currentMouseX, canvas.width));
      currentMouseY = Math.max(0, Math.min(currentMouseY, canvas.height));
      
      updateCrosshair();
      updateCoordinates();
    }
    
    /**
     * Actualizar líneas guía (crosshair)
     */
    function updateCrosshair() {
      if (!rulerElements.horizontalLine || !rulerElements.verticalLine) return;
      
      const rect = canvas.getBoundingClientRect();
      const displayX = (currentMouseX / canvas.width) * rect.width;
      const displayY = (currentMouseY / canvas.height) * rect.height;
      
      // Detectar brillo del fondo y ajustar color de líneas
      const lineColor = detectBackgroundBrightness(currentMouseX, currentMouseY);
      
      rulerElements.horizontalLine.style.top = (displayY + 30) + 'px';
      rulerElements.horizontalLine.style.background = lineColor;
      
      rulerElements.verticalLine.style.left = (displayX + 30) + 'px';
      rulerElements.verticalLine.style.background = lineColor;
    }
    
    /**
     * Actualizar display de coordenadas
     */
    function updateCoordinates() {
      if (!rulerElements.coordinateDisplay) return;
      
      const rect = canvas.getBoundingClientRect();
      const displayX = (currentMouseX / canvas.width) * rect.width;
      const displayY = (currentMouseY / canvas.height) * rect.height;
      
      rulerElements.coordinateDisplay.textContent = `X: ${currentMouseX}px, Y: ${currentMouseY}px`;
      
      // Posicionar el display cerca del cursor, ajustando para no salir del canvas
      let coordX = displayX + 30 + 15; // 30 de la regla + 15 de offset
      let coordY = displayY + 30 - 30; // 30 de la regla - 30 para estar arriba del cursor
      
      // Ajustar si se sale por la derecha
      if (coordX + 150 > rect.width) {
        coordX = displayX + 30 - 160;
      }
      
      // Ajustar si se sale por arriba
      if (coordY < 35) {
        coordY = displayY + 30 + 15;
      }
      
      rulerElements.coordinateDisplay.style.left = coordX + 'px';
      rulerElements.coordinateDisplay.style.top = coordY + 'px';
    }
    
    /**
     * Detectar brillo del fondo para color adaptativo
     */
    function detectBackgroundBrightness(x, y) {
      if (!ctx || !currentImage) return '#FFFFFF';
      
      try {
        // Limitar coordenadas al canvas
        x = Math.max(0, Math.min(x, canvas.width - 1));
        y = Math.max(0, Math.min(y, canvas.height - 1));
        
        const imageData = ctx.getImageData(x, y, 1, 1).data;
        const brightness = (imageData[0] + imageData[1] + imageData[2]) / 3;
        
        // Si el fondo es claro (>128), usar negro; si es oscuro, usar blanco
        return brightness > 128 ? '#000000' : '#FFFFFF';
      } catch (error) {
        // Si hay error al leer el píxel, usar blanco por defecto
        return '#FFFFFF';
      }
    }
    
    /**
     * Mostrar guías al entrar al canvas
     */
    function showRulerGuides() {
      if (!isRulerMode) return;
      
      if (rulerElements.horizontalLine) rulerElements.horizontalLine.style.display = 'block';
      if (rulerElements.verticalLine) rulerElements.verticalLine.style.display = 'block';
      if (rulerElements.coordinateDisplay) rulerElements.coordinateDisplay.style.display = 'block';
    }
    
    /**
     * Ocultar guías al salir del canvas
     */
    function hideRulerGuides() {
      if (!isRulerMode) return;
      
      if (rulerElements.horizontalLine) rulerElements.horizontalLine.style.display = 'none';
      if (rulerElements.verticalLine) rulerElements.verticalLine.style.display = 'none';
      if (rulerElements.coordinateDisplay) rulerElements.coordinateDisplay.style.display = 'none';
    }
    
    /**
     * Eliminar reglas métricas y limpiar
     */
    function removeRulers() {
      // Remover event listeners
      if (canvas) {
        canvas.removeEventListener('mousemove', handleRulerMouseMove);
        canvas.removeEventListener('mouseenter', showRulerGuides);
        canvas.removeEventListener('mouseleave', hideRulerGuides);
      }
      
      // Eliminar contenedor y todos sus elementos
      if (rulerElements.container && rulerElements.container.parentElement) {
        rulerElements.container.parentElement.removeChild(rulerElements.container);
      }
      
      // Reset de referencias
      rulerElements.horizontalRuler = null;
      rulerElements.verticalRuler = null;
      rulerElements.horizontalLine = null;
      rulerElements.verticalLine = null;
      rulerElements.coordinateDisplay = null;
      rulerElements.container = null;
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

    // Funciones para marcadores de posición de texto
    function showTextPositionMarker() {
      if (!customTextPosition || !canvas) return;
      
      // Quitar marcador anterior si existe
      removeTextPositionMarker();
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / canvas.width;
      const scaleY = rect.height / canvas.height;
      
      const marker = document.createElement('div');
      marker.className = 'custom-position-marker text-marker';
      marker.id = 'text-position-marker';
      marker.style.borderColor = '#3b82f6'; // Color azul para diferenciar del marcador de imagen
      
      const displayX = customTextPosition.x * scaleX;
      const displayY = customTextPosition.y * scaleY;
      
      marker.style.left = displayX + 'px';
      marker.style.top = displayY + 'px';
      
      // Agregar al contenedor del canvas
      const container = canvas.parentElement;
      if (container) {
        container.style.position = 'relative';
        container.appendChild(marker);
      }
    }

    function removeTextPositionMarker() {
      const marker = document.getElementById('text-position-marker');
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
      
      // Sincronizar campos numéricos con valores por defecto de los sliders
      const sliderConfigs = [
        { sliderId: 'watermark-size', numberId: 'watermark-size-num' },
        { sliderId: 'watermark-opacity', numberId: 'watermark-opacity-num' },
        { sliderId: 'watermark-image-opacity', numberId: 'watermark-image-opacity-num' }
      ];
      
      sliderConfigs.forEach(({ sliderId, numberId }) => {
        const slider = document.getElementById(sliderId);
        const numberInput = document.getElementById(numberId);
        if (slider && numberInput) {
          numberInput.value = slider.value;
        }
      });
      
      // Resetear tipo de marca de agua
      document.getElementById('watermark-text-enabled').checked = true;
      document.getElementById('watermark-image-enabled').checked = false;
      toggleWatermarkType();
      
      // Restaurar botón de marca de agua a rojo y ocultar miniatura
      const watermarkUploadLabel = document.getElementById('watermark-upload-label');
      const watermarkThumbnail = document.getElementById('watermark-preview-thumb');
      const watermarkFileLabel = document.getElementById('watermark-file-label');
      
      if (watermarkUploadLabel) {
        watermarkUploadLabel.classList.remove('watermark-loaded');
      }
      
      if (watermarkThumbnail) {
        watermarkThumbnail.style.display = 'none';
        watermarkThumbnail.src = '';
      }
      
      if (watermarkFileLabel) {
        watermarkFileLabel.textContent = 'Seleccionar archivo';
      }
      
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
      
      // Resetear zoom al 100%
      resetZoom();
      
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
        // IMPORTANTE: Desactivar bordes de guía antes de descargar
        showPositioningBorders = false;
        
        // Redibujar canvas completo sin los bordes
        redrawCompleteCanvas();
        
        // Detectar si la imagen tiene transparencia
        const hasAlpha = hasImageAlphaChannel(canvas);
        
        // Determinar formato final con fallback
        const requestedMimeType = getMimeType(outputFormat);
        const finalMimeType = await determineFallbackFormat(hasAlpha, requestedMimeType);
        const finalFormat = finalMimeType.split('/')[1];
        
        // Si el formato cambió, mostrar notificación informativa
        if (finalMimeType !== requestedMimeType) {
          const requestedFormat = outputFormat.toUpperCase();
          const actualFormat = finalFormat.toUpperCase();
          console.info(`Usando fallback: ${requestedFormat} → ${actualFormat} (mejor compatibilidad)`);
          UIManager.showInfo(`📄 Exportando en ${actualFormat} para máxima compatibilidad (solicitado: ${requestedFormat})`);
        }
        
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
        // Usar fileBaseName personalizado o fallback a metadata/título
        const basenameInput = document.getElementById('file-basename');
        const customBaseName = basenameInput ? basenameInput.value.trim() : '';
        const titleInput = document.getElementById('metaTitle');
        
        // Prioridad: 1) Input personalizado (ya sanitizado), 2) fileBaseName actual, 3) Metadata, 4) Fallback
        let filename = customBaseName || fileBaseName;
        
        // Solo si no hay nombre personalizado, usar metadata o fallback
        if (!filename || filename === 'imagen') {
          filename = metadata.title || titleInput.value.trim() || 'imagen';
          // Sanitizar solo si viene de metadata/título
          filename = sanitizeFileBaseName(filename);
        }
        
        console.log('📥 Descargando con nombre:', filename, '(Input:', customBaseName, ', Variable:', fileBaseName, ')');
        
        // Validar que el nombre sea válido (ya está sanitizado por sanitizeFileBaseName)
        if (!SecurityManager.isValidFileBaseName(filename)) {
          console.warn('⚠️ Nombre inválido, usando fallback:', filename);
          filename = 'imagen'; // Fallback seguro
        }
        
        // Usar el formato final determinado por el sistema de fallback
        const extension = getFileExtension(finalFormat);
        const fullFilename = `${filename}.${extension}`;
        
        // Usar la API File System Access si está disponible (Chrome/Edge modernos)
        if ('showSaveFilePicker' in window) {
          const options = {
            suggestedName: fullFilename,
            types: [{
              description: 'Imágenes',
              accept: {
                [finalMimeType]: [`.${extension}`]
              }
            }],
            startIn: lastDownloadDirectory || 'desktop'
          };

          try {
            const handle = await window.showSaveFilePicker(options);
            lastDownloadDirectory = await handle.queryPermission({ mode: 'readwrite' });
            
            const writable = await handle.createWritable();
            const blob = await canvasToBlob(canvas, finalMimeType, outputQuality);
            await writable.write(blob);
            await writable.close();
            
            const qualityText = finalFormat === 'png' ? '' : ` (calidad: ${Math.round(outputQuality * 100)}%)`;
            showSuccess(`Imagen guardada exitosamente en formato ${finalFormat.toUpperCase()}${qualityText}!`);
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
        link.href = canvas.toDataURL(finalMimeType, outputQuality);
        
        // Simular click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        const qualityText = finalFormat === 'png' ? '' : ` (calidad: ${Math.round(outputQuality * 100)}%)`;
        showSuccess(`Imagen descargada en formato ${finalFormat.toUpperCase()}${qualityText}!`);
        
      } catch (error) {
        console.error('Error al descargar:', error);
        showError('Error al descargar la imagen.');
      } finally {
        // IMPORTANTE: Reactivar bordes de guía después de descargar
        showPositioningBorders = true;
        
        // Redibujar canvas completo CON los bordes para la vista previa
        redrawCompleteCanvas();
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
      
      // Configurar renderizado de alta calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Create a temporary canvas with original image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // Configurar alta calidad también en canvas temporal
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      
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
          
          // Configurar alta calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
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
        // IMPORTANTE: Desactivar bordes de guía antes de descargar
        showPositioningBorders = false;
        
        // Redibujar canvas completo sin los bordes
        redrawCompleteCanvas();
        
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
        
        // Generar nombre del archivo usando el campo personalizado o fallback
        const basenameInput = document.getElementById('file-basename');
        const customBaseName = basenameInput ? basenameInput.value.trim() : '';
        
        // Prioridad: 1) Input personalizado, 2) fileBaseName, 3) Metadata.title, 4) Nombre original, 5) Fallback
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
        
        console.log('📥 Descarga con progreso - nombre:', filename, '(Input:', customBaseName, ', Variable:', fileBaseName, ')');
        
        // Validar que el nombre sea válido
        if (!SecurityManager.isValidFileBaseName(filename)) {
          console.warn('⚠️ Nombre inválido en descarga con progreso, usando fallback');
          filename = 'imagen-editada';
        }
        
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
      } finally {
        // IMPORTANTE: Reactivar bordes de guía después de descargar
        showPositioningBorders = true;
        
        // Redibujar canvas completo CON los bordes para la vista previa
        redrawCompleteCanvas();
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
      
      // Restaurar botón de marca de agua a rojo y ocultar miniatura
      const watermarkUploadLabel = document.getElementById('watermark-upload-label');
      const watermarkThumbnail = document.getElementById('watermark-preview-thumb');
      const watermarkFileLabel = document.getElementById('watermark-file-label');
      
      if (watermarkUploadLabel) {
        watermarkUploadLabel.classList.remove('watermark-loaded');
      }
      
      if (watermarkThumbnail) {
        watermarkThumbnail.style.display = 'none';
        watermarkThumbnail.src = '';
      }
      
      if (watermarkFileLabel) {
        watermarkFileLabel.textContent = 'Seleccionar archivo';
      }
      
      // Ocultar elementos
      document.getElementById('file-info').classList.add('file-info--hidden');
      document.getElementById('editor-container').classList.add('editor-container--hidden');
      
      // Restaurar botón a rojo y ocultar miniatura
      const uploadButton = document.getElementById('file-selector');
      if (uploadButton) {
        uploadButton.classList.remove('image-loaded');
      }
      
      // Ocultar miniatura
      const thumbnailElement = document.getElementById('file-preview-thumbnail');
      if (thumbnailElement) {
        thumbnailElement.style.display = 'none';
        thumbnailElement.src = '';
      }
      
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
        // IMPORTANTE: Desactivar bordes de guía antes de descargar
        showPositioningBorders = false;
        
        // Redibujar canvas completo sin los bordes
        redrawCompleteCanvas();
        
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
      } finally {
        // IMPORTANTE: Reactivar bordes de guía después de descargar
        showPositioningBorders = true;
        
        // Redibujar canvas completo CON los bordes para la vista previa
        redrawCompleteCanvas();
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
        
        // SOLO EN MÓVILES: Detectar si la pantalla es menor a 768px
        const isMobile = window.innerWidth < 768;
        if (!isMobile) {
          // En desktop, no hacer nada (zoom solo con botones)
          return;
        }
        
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
      
      console.log('Mouse wheel zoom initialized (solo móvil <768px)');
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

    // ===== ADVANCED MANAGERS INITIALIZATION =====
    
    /**
     * Inicializar managers avanzados
     */
    function initializeAdvancedManagers() {
      try {
        // Inicializar Keyboard Shortcuts
        keyboardShortcuts = new KeyboardShortcutManager();
        console.log('✅ KeyboardShortcutManager inicializado');
        
        // Inicializar Batch Manager
        batchManager = new BatchManager();
        console.log('✅ BatchManager inicializado');
        
        // Inicializar Text Layer Manager
        textLayerManager = new TextLayerManager();
        console.log('✅ TextLayerManager inicializado');
        
        // Inicializar Crop Manager con el canvas
        if (canvas) {
          cropManager = new CropManager(canvas);
          console.log('✅ CropManager inicializado');
        } else {
          console.warn('⚠️ Canvas no disponible, CropManager no inicializado');
        }
        
        console.log('✅ Managers avanzados listos');
        
      } catch (error) {
        console.error('Error inicializando managers avanzados:', error);
      }
    }
    
    /**
     * Configurar atajos de teclado
     */
    function setupKeyboardShortcuts() {
      if (!keyboardShortcuts) return;
      
      try {
        // Ctrl/Cmd + Z: Deshacer
        keyboardShortcuts.register('z', ['ctrl'], () => {
          if (historyManager && historyManager.canUndo()) {
            historyManager.undo();
            UIManager.showSuccess('Deshecho');
          }
        }, { description: 'Deshacer última acción' });
        
        // Ctrl/Cmd + Shift + Z o Ctrl/Cmd + Y: Rehacer
        keyboardShortcuts.register('z', ['ctrl', 'shift'], () => {
          if (historyManager && historyManager.canRedo()) {
            historyManager.redo();
            UIManager.showSuccess('Rehecho');
          }
        }, { description: 'Rehacer acción' });
        
        keyboardShortcuts.register('y', ['ctrl'], () => {
          if (historyManager && historyManager.canRedo()) {
            historyManager.redo();
            UIManager.showSuccess('Rehecho');
          }
        }, { description: 'Rehacer acción' });
        
        // Ctrl/Cmd + S: Guardar/Exportar (solo cuando NO estés en un input)
        keyboardShortcuts.register('s', ['ctrl'], async () => {
          if (currentImage) {
            await downloadImage();
          }
        }, { description: 'Guardar imagen' });
        
        // Ctrl/Cmd + Shift + C: Copiar imagen al portapapeles
        keyboardShortcuts.register('c', ['ctrl', 'shift'], async () => {
          if (canvas && currentImage) {
            try {
              await copyCanvasToClipboard();
              UIManager.showSuccess('✅ Imagen copiada al portapapeles');
            } catch (err) {
              UIManager.showError('❌ Error al copiar imagen');
            }
          } else {
            UIManager.showInfo('ℹ️ Carga una imagen primero');
          }
        }, { description: 'Copiar imagen al portapapeles' });
        
        // Ctrl/Cmd + Shift + V: Pegar imagen desde portapapeles
        keyboardShortcuts.register('v', ['ctrl', 'shift'], async () => {
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              for (const type of item.types) {
                if (type.startsWith('image/')) {
                  const blob = await item.getType(type);
                  const file = new File([blob], 'pasted-image.png', { type });
                  await loadImageFromFile(file);
                  UIManager.showSuccess('✅ Imagen pegada desde portapapeles');
                  return;
                }
              }
            }
            UIManager.showInfo('ℹ️ No hay imagen en el portapapeles');
          } catch (err) {
            UIManager.showError('❌ Error al pegar imagen. Usa Cmd+V nativo en un campo de carga.');
          }
        }, { description: 'Pegar imagen desde portapapeles' });
        
        // Ctrl/Cmd + Shift + X: Exportar con ajustes actuales
        keyboardShortcuts.register('x', ['ctrl', 'shift'], async () => {
          if (currentImage) {
            await downloadImageWithProgress();
            UIManager.showSuccess('✅ Imagen exportada');
          } else {
            UIManager.showInfo('ℹ️ Carga una imagen primero');
          }
        }, { description: 'Exportar imagen con ajustes' });
        
        // Espacio: Vista antes/después (mantener presionado)
        let originalCanvas = null;
        keyboardShortcuts.register(' ', [], (e) => {
          if (!currentImage || !canvas) return;
          
          if (e.type === 'keydown' && !originalCanvas) {
            // Guardar estado actual y mostrar original
            originalCanvas = canvas.toDataURL();
            showOriginalImage();
            UIManager.showInfo('👁️ Mostrando imagen original');
          }
        }, { description: 'Ver imagen original (mantener presionado)', preventDefault: false });
        
        // Esc: Cancelar operación actual
        keyboardShortcuts.register('escape', [], () => {
          if (cropManager && cropManager.isActive) {
            cropManager.deactivate();
            UIManager.showInfo('❌ Modo recorte cancelado');
          }
        }, { description: 'Cancelar operación actual', preventDefault: false });
        
        // Delete: Eliminar capa seleccionada (solo cuando NO estés en un input)
        keyboardShortcuts.register('delete', [], () => {
          if (textLayerManager && textLayerManager.activeLayerId) {
            const layer = textLayerManager.getActiveLayer();
            if (layer && confirm(`¿Eliminar capa "${layer.text}"?`)) {
              textLayerManager.removeLayer(textLayerManager.activeLayerId);
              updatePreview();
              UIManager.showSuccess('🗑️ Capa eliminada');
            }
          }
        }, { description: 'Eliminar capa seleccionada', preventDefault: false });
        
        // Ctrl/Cmd + D: Duplicar capa
        keyboardShortcuts.register('d', ['ctrl'], async () => {
          if (textLayerManager && textLayerManager.activeLayerId) {
            const duplicate = await textLayerManager.duplicateLayer(textLayerManager.activeLayerId);
            updatePreview();
            UIManager.showSuccess(`📋 Capa duplicada: ${duplicate.text}`);
          } else {
            UIManager.showInfo('ℹ️ Selecciona una capa de texto primero');
          }
        }, { description: 'Duplicar capa de texto actual' });
        
        // Ctrl/Cmd + Shift + R: Reiniciar todos los ajustes
        keyboardShortcuts.register('r', ['ctrl', 'shift'], () => {
          if (confirm('¿Reiniciar todos los filtros y ajustes?')) {
            resetFilters();
            UIManager.showSuccess('🔄 Ajustes reiniciados');
          }
        }, { description: 'Reiniciar filtros y ajustes' });
        
        // Ctrl/Cmd + B: Abrir procesamiento por lotes
        keyboardShortcuts.register('b', ['ctrl'], () => {
          if (typeof window.openBatchModal === 'function') {
            window.openBatchModal();
            UIManager.showInfo('📦 Modo lote activado');
          }
        }, { description: 'Abrir procesamiento por lotes' });
        
        // Ctrl/Cmd + T: Abrir panel de capas de texto
        keyboardShortcuts.register('t', ['ctrl'], () => {
          if (typeof window.openTextLayersPanel === 'function') {
            window.openTextLayersPanel();
            UIManager.showInfo('📝 Panel de texto activado');
          }
        }, { description: 'Abrir panel de capas de texto' });
        
        // Ctrl/Cmd + R: Abrir modo recorte
        keyboardShortcuts.register('r', ['ctrl'], () => {
          if (typeof window.openCropPanel === 'function') {
            window.openCropPanel();
            UIManager.showInfo('✂️ Modo recorte activado');
          }
        }, { description: 'Abrir modo recorte' });
        
        // Ctrl/Cmd + ?: Ver atajos de teclado
        keyboardShortcuts.register('/', ['ctrl', 'shift'], () => {
          if (typeof window.openShortcutsModal === 'function') {
            window.openShortcutsModal();
          }
        }, { description: 'Ver atajos de teclado' });
        
        // +: Zoom in
        keyboardShortcuts.register('+', [], () => {
          zoomIn();
        }, { description: 'Aumentar zoom', preventDefault: false });
        
        // -: Zoom out
        keyboardShortcuts.register('-', [], () => {
          zoomOut();
        }, { description: 'Reducir zoom', preventDefault: false });
        
        // 0: Zoom 100%
        keyboardShortcuts.register('0', [], () => {
          resetZoom();
        }, { description: 'Restaurar zoom 100%', preventDefault: false });
        
        // K: Toggle comparison mode
        keyboardShortcuts.register('k', ['ctrl'], () => {
          toggleComparisonMode();
        }, { description: 'Activar/desactivar modo comparación', preventDefault: true });
        
        console.log('⌨️ Atajos de teclado configurados');
        console.log('📖 Atajos disponibles:', keyboardShortcuts.getAllShortcuts());
        
      } catch (error) {
        console.error('Error configurando atajos de teclado:', error);
      }
    }
    
    /**
     * Copiar canvas al portapapeles
     */
    async function copyCanvasToClipboard() {
      try {
        if (!navigator.clipboard || !navigator.clipboard.write) {
          throw new Error('API de portapapeles no disponible');
        }
        
        // Convertir canvas a blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/png');
        });
        
        // Escribir al portapapeles
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        
        UIManager.showSuccess('✅ Imagen copiada al portapapeles');
        console.log('📋 Imagen copiada al portapapeles');
        
      } catch (error) {
        console.error('Error copiando al portapapeles:', error);
        UIManager.showError('No se pudo copiar al portapapeles. Intenta usar la función de descarga.');
      }
    }
    
    /**
     * Mostrar imagen original (sin filtros)
     */
    function showOriginalImage() {
      if (!currentImage || !canvas || !ctx) return;
      
      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Configurar alta calidad
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Dibujar imagen original sin filtros
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    }
    
    // Exponer funciones globales para debugging
    window.keyboardShortcuts = keyboardShortcuts;
    window.batchManager = batchManager;
    window.textLayerManager = textLayerManager;
    window.cropManager = cropManager;

    // ============================================
    // FUNCIONES DE INTEGRACIÓN UI v3.1
    // ============================================

    /**
     * ====================================
     * BATCH PROCESSING UI
     * ====================================
     */
    
    let batchImages = [];
    
    function openBatchModal() {
      const modal = document.getElementById('batch-modal');
      if (modal) {
        modal.style.display = 'flex';
        setupBatchDropzone();
      }
    }

    function closeBatchModal() {
      const modal = document.getElementById('batch-modal');
      if (modal) {
        modal.style.display = 'none';
        batchImages = [];
        updateBatchImagesList();
      }
    }

    function setupBatchDropzone() {
      const dropzone = document.getElementById('batch-dropzone');
      const fileInput = document.getElementById('batch-file-input');
      
      if (!dropzone || !fileInput) return;

      // Click to select files
      dropzone.onclick = (e) => {
        if (e.target === dropzone || e.target.closest('.dropzone-content')) {
          fileInput.click();
        }
      };

      // File input change
      fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        addBatchImages(files);
        fileInput.value = ''; // Reset input
      };

      // Drag and drop
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      };

      dropzone.ondragleave = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addBatchImages(files);
      };
    }

    function addBatchImages(files) {
      // Validar límite de imágenes
      if (batchImages.length + files.length > 50) {
        UIManager.showError('Máximo 50 imágenes por lote');
        return;
      }

      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            batchImages.push({
              id: Date.now() + Math.random(),
              file: file,
              name: file.name,
              size: file.size,
              dataUrl: e.target.result
            });
            updateBatchImagesList();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    function removeBatchImage(imageId) {
      batchImages = batchImages.filter(img => img.id !== imageId);
      updateBatchImagesList();
    }

    function updateBatchImagesList() {
      const container = document.getElementById('batch-images-list');
      if (!container) return;

      if (batchImages.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay imágenes agregadas</p>';
        return;
      }

      container.innerHTML = batchImages.map(img => `
        <div class="batch-item">
          <img src="${img.dataUrl}" alt="${img.name}" class="batch-item-thumbnail">
          <div class="batch-item-info">
            <div class="batch-item-name">${img.name}</div>
            <div class="batch-item-size">${formatFileSize(img.size)}</div>
          </div>
          <button class="batch-item-remove" onclick="removeBatchImage(${img.id})">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
    }

    async function processBatch() {
      if (batchImages.length === 0) {
        UIManager.showError('Agrega imágenes al lote primero');
        return;
      }

      const progressBar = document.getElementById('batch-progress-bar');
      const progressText = document.getElementById('batch-progress-text');
      const processBtn = document.getElementById('batch-process-btn');
      const downloadBtn = document.getElementById('batch-download-btn');
      
      if (!progressBar || !progressText || !processBtn) return;

      // Obtener configuración
      const config = {
        applyFilters: document.getElementById('batch-apply-filters').checked,
        applyBorder: document.getElementById('batch-apply-border').checked,
        applyMetadata: document.getElementById('batch-apply-metadata').checked,
        applyWatermark: document.getElementById('batch-apply-watermark').checked
      };

      // UI feedback
      processBtn.disabled = true;
      processBtn.classList.add('loading');
      progressBar.style.width = '0%';
      progressText.textContent = 'Procesando 0/0 (0%)';

      try {
        // Preparar imágenes para BatchManager
        const imagesToProcess = [];
        
        for (const img of batchImages) {
          const imageObj = await loadImageFromFile(img.file);
          imagesToProcess.push({
            image: imageObj,
            name: img.name
          });
        }

        // Procesar con BatchManager
        await batchManager.processQueue(
          imagesToProcess,
          (current, total, percentage) => {
            progressBar.style.width = `${percentage}%`;
            progressText.textContent = `Procesando ${current}/${total} (${percentage}%)`;
          }
        );

        // Mostrar botón de descarga
        downloadBtn.classList.remove('hidden');
        UIManager.showSuccess(`✅ ${batchImages.length} imágenes procesadas`);

      } catch (error) {
        console.error('Error procesando lote:', error);
        UIManager.showError('Error al procesar el lote de imágenes');
      } finally {
        processBtn.disabled = false;
        processBtn.classList.remove('loading');
      }
    }

    async function downloadBatchZip() {
      try {
        const blob = await batchManager.exportToZip();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mnemotag-batch-${Date.now()}.zip`;
        link.click();
        URL.revokeObjectURL(url);
        
        UIManager.showSuccess('✅ ZIP descargado correctamente');
      } catch (error) {
        console.error('Error descargando ZIP:', error);
        UIManager.showError('Error al descargar el archivo ZIP');
      }
    }

    function loadImageFromFile(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * ====================================
     * TEXT LAYERS UI
     * ====================================
     */

    let activeLayerId = null;

    function openTextLayersPanel() {
      const panel = document.getElementById('text-layers-panel');
      if (panel) {
        panel.style.display = 'flex'; // Quitar display: none inline
        setTimeout(() => {
          panel.classList.add('active'); // Activar transición
        }, 10);
        updateTextLayersList();
      }
    }

    function closeTextLayersPanel() {
      const panel = document.getElementById('text-layers-panel');
      if (panel) {
        panel.classList.remove('active');
        setTimeout(() => {
          panel.style.display = 'none'; // Ocultar después de transición
        }, 300);
        activeLayerId = null;
      }
    }

    function applyTextTemplate(templateName) {
      if (!currentImage) {
        UIManager.showError('Carga una imagen primero');
        return;
      }

      try {
        textLayerManager.applyTemplate(templateName, canvas.width, canvas.height);
        updateTextLayersList();
        renderCanvasWithLayers();
        UIManager.showSuccess(`✅ Plantilla "${templateName}" aplicada`);
      } catch (error) {
        console.error('Error aplicando plantilla:', error);
        UIManager.showError('Error al aplicar la plantilla');
      }
    }

    function addNewTextLayer() {
      if (!currentImage) {
        UIManager.showError('Carga una imagen primero');
        return;
      }

      const newLayer = textLayerManager.addLayer({
        text: 'Nuevo texto',
        x: canvas.width / 2,
        y: canvas.height / 2
      });

      updateTextLayersList();
      selectTextLayer(newLayer.id);
      renderCanvasWithLayers();
    }

    function updateTextLayersList() {
      const container = document.getElementById('text-layers-list');
      if (!container) return;

      const layers = textLayerManager.getAllLayers();

      if (layers.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay capas de texto</p>';
        return;
      }

      container.innerHTML = layers.map(layer => `
        <div class="text-layer-item ${layer.id === activeLayerId ? 'active' : ''}" onclick="selectTextLayer('${layer.id}')">
          <div class="text-layer-preview">
            <div class="text-layer-text">${layer.text}</div>
            <div class="text-layer-font">${layer.fontFamily} - ${layer.fontSize}px</div>
          </div>
          <button class="text-layer-visibility" onclick="event.stopPropagation(); toggleLayerVisibility('${layer.id}')">
            <i class="fas fa-${layer.visible ? 'eye' : 'eye-slash'}"></i>
          </button>
        </div>
      `).join('');
    }

    function selectTextLayer(layerId) {
      activeLayerId = layerId;
      const layer = textLayerManager.getLayer(layerId);
      
      if (!layer) return;

      // Actualizar lista
      updateTextLayersList();

      // Mostrar editor
      const editor = document.getElementById('text-layer-editor');
      if (editor) {
        editor.classList.remove('hidden');
      }

      // Cargar valores en el editor
      document.getElementById('layer-text').value = layer.text;
      document.getElementById('layer-font').value = layer.fontFamily;
      document.getElementById('layer-size').value = layer.fontSize;
      document.getElementById('layer-color').value = layer.color;
      document.getElementById('layer-x').value = Math.round(layer.x);
      document.getElementById('layer-y').value = Math.round(layer.y);
      document.getElementById('layer-rotation').value = layer.rotation;
      document.getElementById('layer-opacity').value = Math.round(layer.opacity * 100);
      document.getElementById('layer-shadow').checked = layer.shadow;
      document.getElementById('layer-stroke').checked = layer.stroke;
      document.getElementById('layer-gradient').checked = layer.gradient;
    }

    function updateActiveTextLayer() {
      if (!activeLayerId) return;

      const updates = {
        text: document.getElementById('layer-text').value,
        fontFamily: document.getElementById('layer-font').value,
        fontSize: parseInt(document.getElementById('layer-size').value),
        color: document.getElementById('layer-color').value,
        x: parseInt(document.getElementById('layer-x').value),
        y: parseInt(document.getElementById('layer-y').value),
        rotation: parseInt(document.getElementById('layer-rotation').value),
        opacity: parseInt(document.getElementById('layer-opacity').value) / 100,
        shadow: document.getElementById('layer-shadow').checked,
        stroke: document.getElementById('layer-stroke').checked,
        gradient: document.getElementById('layer-gradient').checked
      };

      textLayerManager.updateLayer(activeLayerId, updates);
      updateTextLayersList();
      renderCanvasWithLayers();
    }

    function toggleLayerVisibility(layerId) {
      const layer = textLayerManager.getLayer(layerId);
      if (layer) {
        textLayerManager.updateLayer(layerId, { visible: !layer.visible });
        updateTextLayersList();
        renderCanvasWithLayers();
      }
    }

    function deleteActiveTextLayer() {
      if (!activeLayerId) return;

      textLayerManager.removeLayer(activeLayerId);
      activeLayerId = null;
      
      const editor = document.getElementById('text-layer-editor');
      if (editor) {
        editor.classList.add('hidden');
      }

      updateTextLayersList();
      renderCanvasWithLayers();
      UIManager.showSuccess('✅ Capa eliminada');
    }

    function renderCanvasWithLayers() {
      if (!currentImage || !canvas || !ctx) return;

      // Redibujar imagen base
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

      // Aplicar filtros actuales si existen
      applyFilters();

      // Renderizar capas de texto
      textLayerManager.renderLayers(ctx);
    }

    /**
     * ====================================
     * CROP UI
     * ====================================
     */

    let cropActive = false;

    function openCropPanel() {
      if (!currentImage) {
        UIManager.showError('Carga una imagen primero');
        return;
      }
      
      if (!cropManager) {
        console.error('❌ CropManager no inicializado');
        UIManager.showError('El sistema de recorte no está disponible');
        return;
      }

      const panel = document.getElementById('crop-panel');
      if (panel) {
        panel.classList.add('active');
        cropActive = true;
        
        // Inicializar crop mode
        cropManager.initCropMode(currentImage);
        
        // Actualizar info
        updateCropInfo();
      }
    }

    function closeCropPanel() {
      const panel = document.getElementById('crop-panel');
      if (panel) {
        panel.classList.remove('active');
        cropActive = false;
        if (cropManager) {
          cropManager.cancelCrop();
        }
      }
    }

    function changeCropAspectRatio() {
      const select = document.getElementById('crop-aspect-ratio');
      if (!select) return;

      const value = select.value;
      
      if (value === 'free') {
        cropManager.setAspectRatio(null);
      } else {
        const [w, h] = value.split(':').map(Number);
        cropManager.setAspectRatio(w / h);
      }

      updateCropInfo();
    }

    function updateCropInfo() {
      if (!cropManager || !cropManager.cropArea) return;
      
      const cropData = cropManager.cropArea;

      const widthEl = document.getElementById('crop-width');
      const heightEl = document.getElementById('crop-height');
      const ratioEl = document.getElementById('crop-ratio');

      if (widthEl) widthEl.textContent = Math.round(cropData.width);
      if (heightEl) heightEl.textContent = Math.round(cropData.height);
      if (ratioEl) {
        const ratio = (cropData.width / cropData.height).toFixed(2);
        ratioEl.textContent = ratio;
      }
    }

    function toggleCropGrid() {
      if (!cropManager) return;
      
      const btn = document.getElementById('crop-grid-btn');
      cropManager.showGrid = !cropManager.showGrid;
      
      if (btn) {
        btn.textContent = cropManager.showGrid ? 'Ocultar Cuadrícula' : 'Mostrar Cuadrícula';
      }
      
      // Redibujar si está activo
      if (cropManager.isActive) {
        cropManager.draw();
      }
    }

    function applyCropSuggestion(type) {
      if (!currentImage || !cropManager) return;

      try {
        const suggestions = cropManager.suggestCrops();
        const suggestion = suggestions.find(s => s.name === type);

        if (suggestion) {
          cropManager.applySuggestion(suggestion);
          updateCropInfo();
          UIManager.showSuccess(`✅ Sugerencia "${suggestion.name}" aplicada`);
        }
      } catch (error) {
        console.error('Error aplicando sugerencia:', error);
        UIManager.showError('No se pudo aplicar la sugerencia de recorte');
      }
    }

    function applyCrop() {
      try {
        const croppedCanvas = cropManager.applyCrop();
        
        if (croppedCanvas) {
          // Actualizar canvas principal con la imagen recortada
          canvas.width = croppedCanvas.width;
          canvas.height = croppedCanvas.height;
          ctx.drawImage(croppedCanvas, 0, 0);
          
          // Crear nueva imagen del resultado
          const croppedImage = new Image();
          croppedImage.onload = () => {
            currentImage = croppedImage;
            closeCropPanel();
            UIManager.showSuccess('✅ Imagen recortada correctamente');
          };
          croppedImage.src = croppedCanvas.toDataURL();
        }
      } catch (error) {
        console.error('Error aplicando crop:', error);
        UIManager.showError('Error al recortar la imagen');
      }
    }

    function cancelCrop() {
      closeCropPanel();
      // Redibujar imagen original
      if (currentImage && canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        applyFilters();
      }
    }

    /**
     * ====================================
     * SHORTCUTS UI
     * ====================================
     */

    function openShortcutsModal() {
      const modal = document.getElementById('shortcuts-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    }

    function closeShortcutsModal() {
      const modal = document.getElementById('shortcuts-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    /**
     * ====================================
     * INICIALIZACIÓN UI
     * ====================================
     */

    function initializeAdvancedUI() {
      console.log('🎨 Inicializando UI avanzada v3.1...');

      // Exponer funciones globalmente para onclick handlers
      window.openBatchModal = openBatchModal;
      window.closeBatchModal = closeBatchModal;
      window.removeBatchImage = removeBatchImage;
      window.processBatch = processBatch;
      window.downloadBatchZip = downloadBatchZip;

      window.openTextLayersPanel = openTextLayersPanel;
      window.closeTextLayersPanel = closeTextLayersPanel;
      window.applyTextTemplate = applyTextTemplate;
      window.addNewTextLayer = addNewTextLayer;
      window.selectTextLayer = selectTextLayer;
      window.updateActiveTextLayer = updateActiveTextLayer;
      window.toggleLayerVisibility = toggleLayerVisibility;
      window.deleteActiveTextLayer = deleteActiveTextLayer;

      window.openCropPanel = openCropPanel;
      window.closeCropPanel = closeCropPanel;
      window.changeCropAspectRatio = changeCropAspectRatio;
      window.toggleCropGrid = toggleCropGrid;
      window.applyCropSuggestion = applyCropSuggestion;
      window.applyCrop = applyCrop;
      window.cancelCrop = cancelCrop;

      window.openShortcutsModal = openShortcutsModal;
      window.closeShortcutsModal = closeShortcutsModal;

      // Agregar event listeners para inputs de texto (con debounce)
      const textInput = document.getElementById('layer-text');
      if (textInput) {
        textInput.addEventListener('input', debounce(updateActiveTextLayer, 300));
      }

      // Event listeners para otros controles de texto
      ['layer-font', 'layer-size', 'layer-color', 'layer-x', 'layer-y', 
       'layer-rotation', 'layer-opacity', 'layer-shadow', 'layer-stroke', 'layer-gradient'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('change', updateActiveTextLayer);
        }
      });

      // Event listener para aspect ratio
      const aspectRatioSelect = document.getElementById('crop-aspect-ratio');
      if (aspectRatioSelect) {
        aspectRatioSelect.addEventListener('change', changeCropAspectRatio);
      }

      console.log('✅ UI avanzada inicializada correctamente');
    }

    // ===== COMPARISON MODE - ANTES/DESPUÉS CON SLIDER =====

    let comparisonMode = false;
    let comparisonSliderPosition = 50; // Porcentaje (0-100)
    let comparisonOriginalCanvas = null; // Canvas de imagen original
    let isDraggingSlider = false;

    /**
     * Inicializa el modo de comparación
     */
    function initializeComparisonMode() {
      const toggleBtn = document.getElementById('compare-toggle-btn');
      const overlay = document.getElementById('comparison-overlay');
      const slider = document.getElementById('comparison-slider');
      
      if (!toggleBtn || !overlay || !slider) {
        console.error('❌ Elementos de comparación no encontrados');
        return;
      }
      
      // Event: Toggle button
      toggleBtn.addEventListener('click', toggleComparisonMode);
      
      // Event: Slider drag
      slider.addEventListener('mousedown', startDraggingSlider);
      slider.addEventListener('touchstart', startDraggingSlider, { passive: false });
      
      // Event: Click en overlay para mover slider
      overlay.addEventListener('click', (e) => {
        if (e.target === slider || slider.contains(e.target)) return;
        moveSliderToClick(e);
      });
      
      // Event: Doble click en handle para resetear
      const handle = slider.querySelector('.comparison-slider-handle');
      if (handle) {
        handle.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          comparisonSliderPosition = 50;
          updateSliderPosition();
        });
      }
      
      // Event: Teclado (flechas)
      document.addEventListener('keydown', (e) => {
        if (!comparisonMode) return;
        
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          comparisonSliderPosition = Math.max(0, comparisonSliderPosition - 5);
          updateSliderPosition();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          comparisonSliderPosition = Math.min(100, comparisonSliderPosition + 5);
          updateSliderPosition();
        } else if (e.key === 'Escape') {
          if (comparisonMode) toggleComparisonMode();
        }
      });
      
      // Event: Mouse/Touch move global
      document.addEventListener('mousemove', dragSlider);
      document.addEventListener('touchmove', dragSlider, { passive: false });
      document.addEventListener('mouseup', stopDraggingSlider);
      document.addEventListener('touchend', stopDraggingSlider);
      
      console.log('✅ Modo de comparación inicializado');
    }

    /**
     * Toggle entre modo normal y modo comparación
     */
    function toggleComparisonMode() {
      if (!currentImage) {
        UIManager.showError('CARGA UNA IMAGEN PRIMERO');
        return;
      }
      
      comparisonMode = !comparisonMode;
      const overlay = document.getElementById('comparison-overlay');
      const toggleBtn = document.getElementById('compare-toggle-btn');
      const mainCanvas = document.getElementById('preview-canvas');
      
      if (comparisonMode) {
        // Activar modo comparación
        
        // 1. Guardar copia de imagen original
        saveOriginalImageForComparison();
        
        // 2. Renderizar ambos canvas
        renderComparisonCanvases();
        
        // 3. Mostrar overlay
        overlay.style.display = 'block';
        
        // 4. Actualizar botón
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = `
          <i class="fas fa-times" aria-hidden="true"></i>
          CERRAR
        `;
        
        // 5. Ocultar canvas principal
        if (mainCanvas) mainCanvas.style.opacity = '0';
        
        UIManager.showSuccess('MODO COMPARACIÓN ACTIVADO - USA ← → PARA MOVER EL SLIDER');
        
      } else {
        // Desactivar modo comparación
        
        overlay.style.display = 'none';
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = `
          <i class="fas fa-sliders-h" aria-hidden="true"></i>
          COMPARAR
        `;
        
        // Mostrar canvas principal
        if (mainCanvas) mainCanvas.style.opacity = '1';
        
        UIManager.showSuccess('MODO COMPARACIÓN DESACTIVADO');
      }
    }

    /**
     * Guarda copia de la imagen original sin ediciones
     */
    function saveOriginalImageForComparison() {
      if (!currentImage) return;
      
      // Crear canvas temporal con imagen original
      comparisonOriginalCanvas = document.createElement('canvas');
      comparisonOriginalCanvas.width = currentImage.width;
      comparisonOriginalCanvas.height = currentImage.height;
      const ctx = comparisonOriginalCanvas.getContext('2d');
      ctx.drawImage(currentImage, 0, 0);
    }

    /**
     * Renderiza ambos canvas (original y editado)
     */
    function renderComparisonCanvases() {
      const originalCanvas = document.getElementById('comparison-canvas-original');
      const editedCanvas = document.getElementById('comparison-canvas-edited');
      const mainCanvas = document.getElementById('preview-canvas');
      
      if (!originalCanvas || !editedCanvas || !mainCanvas || !currentImage) return;
      
      // Canvas original (sin filtros)
      originalCanvas.width = comparisonOriginalCanvas.width;
      originalCanvas.height = comparisonOriginalCanvas.height;
      const ctxOriginal = originalCanvas.getContext('2d');
      ctxOriginal.drawImage(comparisonOriginalCanvas, 0, 0);
      
      // Canvas editado (con todos los filtros y ediciones)
      editedCanvas.width = mainCanvas.width;
      editedCanvas.height = mainCanvas.height;
      const ctxEdited = editedCanvas.getContext('2d');
      ctxEdited.drawImage(mainCanvas, 0, 0);
      
      // Aplicar clipping según posición del slider
      updateSliderPosition();
    }

    /**
     * Actualiza la posición visual del slider
     */
    function updateSliderPosition() {
      const slider = document.getElementById('comparison-slider');
      const editedCanvas = document.getElementById('comparison-canvas-edited');
      const overlay = document.getElementById('comparison-overlay');
      
      if (!slider || !editedCanvas || !overlay) return;
      
      // Mover slider
      slider.style.left = `${comparisonSliderPosition}%`;
      
      // Aplicar clipping al canvas editado
      const overlayWidth = overlay.offsetWidth;
      const clipWidth = (comparisonSliderPosition / 100) * overlayWidth;
      editedCanvas.style.clipPath = `inset(0 ${overlayWidth - clipWidth}px 0 0)`;
    }

    /**
     * Inicia el arrastre del slider
     */
    function startDraggingSlider(e) {
      e.preventDefault();
      e.stopPropagation();
      isDraggingSlider = true;
      document.body.style.cursor = 'ew-resize';
    }

    /**
     * Detiene el arrastre del slider
     */
    function stopDraggingSlider() {
      isDraggingSlider = false;
      document.body.style.cursor = '';
    }

    /**
     * Arrastra el slider según posición del mouse/touch
     */
    function dragSlider(e) {
      if (!isDraggingSlider || !comparisonMode) return;
      
      e.preventDefault();
      
      const overlay = document.getElementById('comparison-overlay');
      if (!overlay) return;
      
      const rect = overlay.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      
      comparisonSliderPosition = (x / rect.width) * 100;
      comparisonSliderPosition = Math.max(0, Math.min(100, comparisonSliderPosition));
      
      updateSliderPosition();
    }

    /**
     * Mueve el slider a la posición del click
     */
    function moveSliderToClick(e) {
      const overlay = document.getElementById('comparison-overlay');
      if (!overlay) return;
      
      const rect = overlay.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      
      comparisonSliderPosition = (x / rect.width) * 100;
      comparisonSliderPosition = Math.max(0, Math.min(100, comparisonSliderPosition));
      
      updateSliderPosition();
    }

    // ===== FIN COMPARISON MODE =====

    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // Inicializar UI avanzada cuando el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initializeAdvancedUI();
        initializeComparisonMode();
      });
    } else {
      initializeAdvancedUI();
      initializeComparisonMode();
    }
    

    console.log('🎨 Sistema de filtros optimizado inicializado');
    console.log('💡 Usa getFilterPerformanceMetrics() para ver métricas de rendimiento');