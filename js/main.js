    // MNEMOTAG_DEBUG se define en app-config.js (carga primero).
    // Bloque de arranque de diagnóstico.
    if (MNEMOTAG_DEBUG) {
      try {
        const now = Date.now();
        const prevBootRaw = sessionStorage.getItem('mnemotag-boot-info');
        const prev = prevBootRaw ? JSON.parse(prevBootRaw) : null;
        const bootCount = prev ? (prev.count + 1) : 1;
        const deltaMs = prev ? (now - prev.ts) : null;
        sessionStorage.setItem('mnemotag-boot-info', JSON.stringify({ ts: now, count: bootCount }));
        MNEMOTAG_DEBUG && console.warn('[MnemoTag debug] Arranque #' + bootCount + (deltaMs !== null ? ' (hace ' + Math.round(deltaMs / 1000) + 's)' : ''));
      } catch (e) { /* sessionStorage puede fallar */ }

      window.addEventListener('error', function (e) {
        console.error('[MnemoTag debug] ERROR:', (e && e.message), (e && e.filename) + ':' + (e && e.lineno));
      });
      window.addEventListener('unhandledrejection', function (e) {
        console.error('[MnemoTag debug] PROMISE REJECTED:', (e && e.reason));
      });
    }

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
    let originalWidth = 0;
    let originalHeight = 0;
    let isResizing = false;

    // Variables para rotación
    let currentRotation = 0; // Degrees: 0, 90, 180, 270 (solo informativo: cada op se hornea)
    // Imagen base para "restablecer rotación": se fija al cargar imagen y se
    // actualiza tras crop/resize (esas operaciones definen el nuevo "original").
    let transformResetImage = null;
    let isFlippedHorizontally = false;
    let isFlippedVertically = false;

    // Variables para zoom (límites en AppConfig)
    let currentZoom = 1.0;
    let minZoom = AppConfig.minZoom;
    let maxZoom = AppConfig.maxZoom;
    let zoomStep = AppConfig.zoomStep;
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
    let hoveredWatermark = null; // v3.3.5: 'text' | 'image' | null — para hover state visual del borde guía

    // Bounds de las capas de texto para hit-testing del drag en el canvas.
    // Se recalculan cada vez que renderCanvasWithLayers() pinta las capas.
    let textLayerBounds = []; // [{ layerId, x, y, width, height }]
    let activeLayerId = null;
    let closeActiveFilePreview = null;

    // Variables para sistema de Reglas Métricas
    let isRulerMode = false;

    // Managers Avanzados (Nuevos)
    let keyboardShortcuts = null;
    let batchManager = null;
    let textLayerManager = null;
    let cropManager = null;

    // HistoryManager extraído a js/managers/history-manager.js

    // WorkerManager extraído a js/managers/worker-manager.js

    // FallbackProcessor extraído a js/utils/fallback-processor.js

    // SmartDebounce extraído a js/utils/smart-debounce.js

    // FilterCache extraído a js/utils/filter-cache.js

    // FilterLoadingManager extraído a js/managers/filter-loading-manager.js

    // Funciones utilitarias extraídas a js/utils/helpers.js

    // Optimized preview update with intelligent debouncing
    const debouncedUpdatePreview = SmartDebounce.intelligent('preview-update', updatePreview, 150);
    const immediatePreviewUpdate = SmartDebounce.immediate('preview-immediate', updatePreview, 50);

    document.addEventListener('DOMContentLoaded', function() {
      initializeApp();
      setupFileNaming();
      initializeTheme();

      // Wiring de seguridad del botón "Limpiar todo" — aislado de initializeApp.
      // Si setupEventListeners falla en mitad (catch silencioso interno), este
      // listener garantiza que el botón sigue operativo.
      try {
        const btn = document.getElementById('clear-all-btn');
        if (btn && !btn.dataset.clearAllWired) {
          btn.dataset.clearAllWired = '1';
          btn.addEventListener('click', function () {
            if (window.confirm('¿Limpiar absolutamente TODOS los datos? Se borrarán la imagen, metadatos, marcas de agua, filtros, historial, presets y datos guardados.')) {
              if (typeof clearAllData === 'function') clearAllData();
            }
          });
        }
      } catch (e) { MNEMOTAG_DEBUG && console.warn('[boot] clear-all-btn wiring falló:', e); }
    });

    // UIManager extraído a js/managers/ui-manager.js

    // ================================================================
    // Persistencia y formulario de watermark: extraídos a
    // js/managers/watermark-manager.js (v3.7.1). Delegados finos para
    // conservar los call sites históricos de main.js.
    // ================================================================

    function setupWatermarkPersistence() { WatermarkManager.setupWatermarkPersistence(); }
    function restoreWatermarkState() { WatermarkManager.restoreWatermarkState(); }
    function clearWatermarkState() { WatermarkManager.clearWatermarkState(); }

    /**
     * Limpia ABSOLUTAMENTE TODOS los datos de la app:
     * - Imagen cargada (canvas + currentImage)
     * - Formulario de metadatos
     * - Formulario de watermark + localStorage
     * - Filtros (brightness, contrast, saturation, blur)
     * - Historial de undo/redo (libera ImageBitmaps)
     * - Presets guardados
     * - sessionStorage de diagnóstico
     * - Toda la clave localStorage de la app
     * - Caché LRU local (processedImages, thumbnails, watermarkImage)
     * - FilterCache (LRU de estados de filtros)
     * - Cache API del Service Worker (caches "mnemotag-*")
     */
    function clearAllData() {
      // Cada paso envuelto en try/catch: si uno falla, los demás siguen.
      // Antes, una excepción temprana (p. ej. un getElementById().reset() sobre null)
      // abortaba toda la función y daba la sensación de que "no se limpiaba nada".
      const safe = function (label, fn) {
        try { fn(); }
        catch (e) { MNEMOTAG_DEBUG && console.warn('[clearAllData] ' + label + ' falló:', e); }
      };

      // 1. Limpiar la imagen cargada
      safe('removeSelectedFile', function () {
        if (typeof removeSelectedFile === 'function') removeSelectedFile();
      });

      // 1b. v3.7.0: borrar la sesión guardada en IndexedDB — limpiar todo
      // implica que el usuario NO quiere que se le ofrezca restaurarla.
      safe('SessionManager.clear', function () {
        if (typeof SessionManager !== 'undefined') SessionManager.clear();
      });

      // Helper: limpia un form sin romper la UI.
      // Estrategia: (1) form.reset() hace el trabajo pesado y respeta
      // <option selected> / value="" / defaultChecked; (2) los campos
      // de texto libre (text/email/url/search/tel/textarea) se vacían a
      // cadena vacía aunque el HTML tuviera value="algo"; (3) los type=file
      // se limpian a mano porque reset() no siempre los limpia; (4) se
      // dispara 'change' en selects/checkboxes para que los handlers de
      // visibilidad (p. ej. toggleCustomImageSize) resincronicen la UI al
      // estado restaurado (form.reset NO emite eventos).
      const forceClearForm = function (form) {
        if (!form) return;
        try { form.reset(); } catch (_) { /* ignored */ }

        const emptyableTypes = ['text', 'email', 'url', 'search', 'tel', 'password', ''];
        form.querySelectorAll('input, textarea').forEach(function (el) {
          const type = (el.type || '').toLowerCase();
          if (el.tagName === 'TEXTAREA' || emptyableTypes.includes(type)) {
            el.value = '';
          } else if (type === 'file') {
            try { el.value = ''; } catch (_) { /* ignored */ }
          }
        });

        form.querySelectorAll('select, input[type="checkbox"], input[type="radio"]').forEach(function (el) {
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) { /* ignored */ }
        });
      };

      // 2. Limpiar formulario de metadatos + su localStorage
      safe('metadata-form clear', function () {
        forceClearForm(document.getElementById('metadata-form'));
      });
      safe('localStorage.imageMetadata', function () { localStorage.removeItem('imageMetadata'); });

      // 3. Limpiar formulario de watermark (estado + form + localStorage)
      safe('clearWatermarkState', function () {
        if (typeof clearWatermarkState === 'function') clearWatermarkState();
      });
      safe('watermark-form force-clear', function () {
        forceClearForm(document.getElementById('watermark-form'));
      });

      // 4. Resetear filtros (brightness, contrast, saturation, blur → 0)
      safe('reset filters sliders', function () {
        ['brightness', 'contrast', 'saturation', 'blur'].forEach(function (id) {
          const el = document.getElementById(id);
          if (el) {
            el.value = '0';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const valSpan = document.getElementById(id + '-value');
          if (valSpan) valSpan.textContent = '0';
        });
        if (typeof resetFilters === 'function') resetFilters();
      });

      // 5. Limpiar historial de undo/redo (libera ImageBitmaps)
      safe('historyManager.clear', function () {
        if (typeof historyManager !== 'undefined' && historyManager && historyManager.clear) {
          historyManager.clear();
        }
      });

      // 6. Limpiar presets guardados
      safe('PresetManager clear', function () {
        if (typeof PresetManager === 'undefined') return;
        const presets = PresetManager.listPresets();
        presets.forEach(function (name) { PresetManager.deletePreset(name); });
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect) PresetManager.populateSelect(presetSelect);
      });

      // 7. Limpiar sessionStorage de diagnóstico
      safe('sessionStorage', function () { sessionStorage.removeItem('mnemotag-boot-info'); });

      // 8. Limpiar cualquier otra clave de localStorage que empiece por 'mnemotag-'
      safe('localStorage mnemotag-*', function () {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mnemotag-')) keysToRemove.push(key);
        }
        keysToRemove.forEach(function (key) { localStorage.removeItem(key); });
      });

      // 9. Limpiar caché LRU local (processedImages, thumbnails, watermarkImage)
      safe('WatermarkManager.clearCache', function () {
        WatermarkManager.clearCache();
      });

      // 10. Limpiar FilterCache (LRU de estados de filtros)
      safe('FilterCache.clear', function () {
        if (typeof FilterCache !== 'undefined' && FilterCache && FilterCache.clear) FilterCache.clear();
      });

      // 11. Limpiar Cache API del Service Worker (mnemotag-*)
      safe('caches.delete', function () {
        if (typeof caches !== 'undefined' && caches.keys) {
          caches.keys().then(function (names) {
            names.filter(function (n) { return n.startsWith('mnemotag-'); })
                 .forEach(function (n) { caches.delete(n); });
          }).catch(function () { /* defensivo */ });
        }
      });

      // 12. Refrescar UI
      safe('updatePreview', function () {
        if (typeof updatePreview === 'function' && canvas && currentImage) updatePreview();
      });

      safe('UIManager.showSuccess', function () {
        if (typeof UIManager !== 'undefined' && UIManager.showSuccess) {
          UIManager.showSuccess('🗑️ Todos los datos limpiados. La app está como nueva.');
        }
      });
    }

    // Defensa contra reloads automáticos de Live Server en localhost.
    // Live Server inyecta un <script> DESPUÉS de </body> que abre un
    // WebSocket a ws://host:port/ws y llama a location.reload() cuando
    // recibe el mensaje "reload". Nuestros scripts se ejecutan ANTES
    // que el de Live Server, así que podemos monkey-patchear WebSocket
    // para impedir que Live Server abra su conexión.
    //
    // Solo se activa en dev local. En producción no interfiere.
    (function () {
      try {
        const hostname = location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' ||
                      hostname === '0.0.0.0' || hostname === '::1' ||
                      hostname.endsWith('.localhost');
        if (!isLocal) return;

        // 1) Monkey-patch WebSocket para bloquear conexiones de Live Reload.
        //    Live Server conecta a ws://host:port/ws. Browser-sync usa
        //    /browser-sync/socket.io. Detectamos ambos patrones.
        const OrigWebSocket = window.WebSocket;
        window.WebSocket = function (url, protocols) {
          if (typeof url === 'string') {
            // Patrón Live Server: ws://localhost:PORT/ws
            const isLiveServer = /\/ws\/?$/.test(url);
            // Patrón browser-sync
            const isBrowserSync = url.indexOf('browser-sync') !== -1;

            if (isLiveServer || isBrowserSync) {
              MNEMOTAG_DEBUG && console.warn(
                '%c[MnemoTag] WebSocket de Live Reload BLOQUEADO: ' + url,
                'background:#f59e0b;color:#000;font-weight:bold;padding:2px 6px;border-radius:4px;'
              );
              // Devolver un objeto fake que no hace nada.
              // Live Server asignará onmessage/onopen pero nunca recibirá
              // el mensaje "reload" porque la conexión no existe.
              const fake = {
                send: function () {},
                close: function () {},
                addEventListener: function () {},
                removeEventListener: function () {},
                onopen: null,
                onclose: null,
                onmessage: null,
                onerror: null,
                readyState: 3, // CLOSED
                CONNECTING: 0,
                OPEN: 1,
                CLOSING: 2,
                CLOSED: 3,
                url: url,
                protocol: '',
                extensions: '',
                bufferedAmount: 0,
                binaryType: 'blob'
              };
              return fake;
            }
          }
          // Cualquier otro WebSocket (ej: Web Workers, librerías reales)
          // pasa al constructor original sin modificar.
          if (protocols !== undefined) {
            return new OrigWebSocket(url, protocols);
          }
          return new OrigWebSocket(url);
        };
        // Preservar las constantes estáticas del WebSocket original.
        window.WebSocket.CONNECTING = 0;
        window.WebSocket.OPEN = 1;
        window.WebSocket.CLOSING = 2;
        window.WebSocket.CLOSED = 3;
        window.WebSocket.prototype = OrigWebSocket.prototype;

      } catch (e) {
        MNEMOTAG_DEBUG && console.warn('[MnemoTag] No se pudo monkey-patchear WebSocket:', e);
      }
    })();

    function initializeApp() {

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
          setupFilterListeners();
        }, 500);

        // Configurar collapsibles
        setupCollapsibles();

        // Configurar validación en tiempo real
        setupFormValidation();

        // Configurar interceptores de errores globales
        setupGlobalErrorHandling();

        // Cargar metadatos guardados (v3.3.5: ahora restaura todos los
        // campos textuales, no solo el autor)
        MetadataManager.loadSavedMetadata();
        // Engancha los listeners para auto-guardar el formulario en cada
        // cambio (debounced 500ms). Antes solo se guardaba al descargar.
        MetadataManager.setupAutoSave();

        // Persistencia de watermark en localStorage (sobrevive a reloads).
        // Los datos se mantienen hasta que el usuario pulse el botón "Limpiar".
        restoreWatermarkState();
        setupWatermarkPersistence();

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

        // v3.6.1: área de trabajo (pestañas, indicadores de sección
        // modificada, bottom-sheet móvil)
        if (typeof WorkspaceManager !== 'undefined') {
          WorkspaceManager.init();
        }


      } catch (error) {
        MNEMOTAG_DEBUG && console.error('Error al inicializar la aplicación:', error);
        UIManager.showError('Error al inicializar la aplicación. Por favor, recarga la página.');
      }
    }

    // Global error handling setup
    function setupGlobalErrorHandling() {
      // Manejar errores no capturados
      window.addEventListener('error', function(event) {
        MNEMOTAG_DEBUG && console.error('Error global capturado:', event.error);
        UIManager.showError('Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.');
      });

      // Manejar promesas rechazadas no capturadas
      window.addEventListener('unhandledrejection', function(event) {
        MNEMOTAG_DEBUG && console.error('Promesa rechazada no manejada:', event.reason);
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
      const themeIcon = document.getElementById('theme-icon');
      const html = document.documentElement;

      if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (themeIcon) {
          themeIcon.className = 'fas fa-sun';
        }
      } else {
        html.removeAttribute('data-theme');
        if (themeIcon) {
          themeIcon.className = 'fas fa-moon';
        }
      }

      localStorage.setItem('theme', theme);
    }

    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    }

    function setupFileNaming() {
      const titleInput = document.getElementById('metaTitle');

      // Agregar funcionalidad para seleccionar todo el texto al hacer clic
      titleInput.addEventListener('click', function() {
        this.select();
      });

      // También seleccionar todo al recibir foco (tabulación)
      titleInput.addEventListener('focus', function() {
        this.select();
      });

      // El título derivado del archivo se asigna únicamente después del
      // commit atómico de loadImage. Una selección rechazada no debe alterar
      // el documento que ya estaba abierto.
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

        // Configurar listeners para controles de filtros
        ['brightness', 'contrast', 'saturation', 'blur'].forEach(filter => {
          const slider = document.getElementById(filter);
          if (slider) {
            slider.addEventListener('input', (e) => {
              FilterManager.applyFilter(filter, parseInt(e.target.value));
            });
            // v3.5.9: Guardar estado al soltar el slider para el historial
            slider.addEventListener('change', () => {
              if (typeof historyManager !== 'undefined') {
                historyManager.saveState();
              }
            });
          }
        });

        // Configurar presets de filtros
        const presetButtons = document.querySelectorAll('.filter-preset');
        presetButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            FilterManager.applyPreset(btn.dataset.filter);
            // v3.5.9: Guardar estado tras aplicar preset
            if (typeof historyManager !== 'undefined') {
              historyManager.saveState();
            }
          });
        });

        // Listener para reset de filtros
        const resetFiltersBtn = document.getElementById('resetFilters');
        if (resetFiltersBtn) {
          resetFiltersBtn.addEventListener('click', () => {
            resetFilters();
            // v3.5.9: Guardar estado tras reset
            if (typeof historyManager !== 'undefined') {
              historyManager.saveState();
            }
          });
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

        setupGlobalDragAndDrop();

        // v3.3.11: Paste global desde el portapapeles. Antes solo había un
        // shortcut Cmd+Shift+V vía keyboardShortcuts; ahora cualquier Cmd+V
        // natural sobre la página dispara la carga de la imagen pegada.
        document.addEventListener('paste', handlePasteImage);

        // v3.3.11: Botón visible "Pegar imagen" en el área de drop.
        const pasteBtn = document.getElementById('paste-image-btn');
        if (pasteBtn) {
          pasteBtn.addEventListener('click', handlePasteButtonClick);
        }
        // v3.3.11 / v3.4.10: extraído a ExportManager.
        const multisizeBtn = document.getElementById('download-multisize-btn');
        if (multisizeBtn) {
          multisizeBtn.addEventListener('click', function () { ExportManager.downloadMultipleSizes(); });
        }

        // v3.3.12 / v3.4.7: Análisis visual — extraído a AnalysisManager.
        const histogramBtn = document.getElementById('histogram-btn');
        if (histogramBtn) {
          histogramBtn.addEventListener('click', function () { AnalysisManager.showHistogram(); });
        }
        const paletteBtn = document.getElementById('palette-btn');
        if (paletteBtn) {
          paletteBtn.addEventListener('click', function () { AnalysisManager.showPalette(); });
        }
        const autoBalanceBtn = document.getElementById('auto-balance-btn');
        if (autoBalanceBtn) {
          autoBalanceBtn.addEventListener('click', function () { AnalysisManager.autoBalanceImage(); });
        }
        // v3.3.13: Curvas y niveles.
        const curvesBtn = document.getElementById('curves-btn');
        if (curvesBtn) {
          curvesBtn.addEventListener('click', openCurvesModal);
        }
        // v3.3.18 / v3.4.9: extraído a BgRemovalManager. Delegado.
        const removeBgBtn = document.getElementById('remove-bg-btn');
        if (removeBgBtn) {
          removeBgBtn.addEventListener('click', function () { BgRemovalManager.removeBackground(); });
        }

        // Hero feature links: scroll suave + expandir sección colapsada.
        document.querySelectorAll('.hero-feature[data-scroll-to]').forEach(function (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = link.getAttribute('data-scroll-to');
            const target = document.getElementById(targetId);
            if (!target) return;
            // Si la sección está colapsada, expandirla antes de hacer scroll.
            const content = target.getAttribute('aria-controls');
            if (content) {
              const contentEl = document.getElementById(content);
              if (contentEl && !contentEl.classList.contains('section__content--open')) {
                // Simular click en el header para expandir (usa toggleCollapsible).
                target.click();
              }
            }
            // Scroll suave con un pequeño delay para que la sección se expanda
            setTimeout(function () {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          });
        });

        // Botón global "Limpiar todo" en el hero.
        // Envuelto en su propio try/catch: este botón es crítico y debe
        // quedar conectado aunque otros listeners del bloque exterior fallen.
        try {
          const clearAllBtn = document.getElementById('clear-all-btn');
          if (clearAllBtn && !clearAllBtn.dataset.clearAllWired) {
            clearAllBtn.dataset.clearAllWired = '1';
            clearAllBtn.addEventListener('click', function () {
              if (window.confirm('¿Limpiar absolutamente TODOS los datos? Se borrarán la imagen, metadatos, marcas de agua, filtros, historial, presets y datos guardados.')) {
                clearAllData();
              }
            });
          }
        } catch (e) { MNEMOTAG_DEBUG && console.warn('clear-all-btn wiring failed:', e); }

        // v3.4.5: Filter presets (guardar/cargar/eliminar en localStorage)
        const presetSelect = document.getElementById('preset-select');
        const presetNameInput = document.getElementById('preset-name-input');
        const presetSaveBtn = document.getElementById('preset-save-btn');
        const presetLoadBtn = document.getElementById('preset-load-btn');
        const presetDeleteBtn = document.getElementById('preset-delete-btn');
        const presetEmptyCta = document.getElementById('preset-empty-cta');
        if (typeof PresetManager !== 'undefined' && presetSelect) {
          // Poblar el select al arrancar.
          PresetManager.populateSelect(presetSelect);
        }
        if (presetSaveBtn && presetNameInput && presetSelect) {
          presetSaveBtn.addEventListener('click', function () {
            const name = presetNameInput.value;
            if (PresetManager.savePreset(name)) {
              presetNameInput.value = '';
              PresetManager.populateSelect(presetSelect);
              presetSelect.value = name.trim();
            }
          });
          // Enter en el input también guarda.
          presetNameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              presetSaveBtn.click();
            }
          });
        }
        if (presetLoadBtn && presetSelect) {
          presetLoadBtn.addEventListener('click', function () {
            const name = presetSelect.value;
            if (!name) {
              UIManager.showError('Selecciona un preset primero');
              return;
            }
            PresetManager.loadPreset(name);
          });
        }
        if (presetDeleteBtn && presetSelect) {
          presetDeleteBtn.addEventListener('click', function () {
            const name = presetSelect.value;
            if (!name) {
              UIManager.showError('Selecciona un preset primero');
              return;
            }
            if (window.confirm('¿Eliminar el preset "' + name + '"?')) {
              PresetManager.deletePreset(name);
              PresetManager.populateSelect(presetSelect);
            }
          });
        }
        if (presetEmptyCta && presetNameInput) {
          presetEmptyCta.addEventListener('click', function () {
            presetNameInput.focus();
          });
        }
        // v3.3.14: Panel de historial visual.
        const historyToggleBtn = document.getElementById('history-toggle-btn');
        if (historyToggleBtn) {
          historyToggleBtn.addEventListener('click', toggleHistoryPanel);
        }
        const historyPanelClose = document.getElementById('history-panel-close');
        if (historyPanelClose) {
          historyPanelClose.addEventListener('click', () => {
            const panel = document.getElementById('history-panel');
            if (panel) {
              panel.classList.add('hidden');
              panel.inert = true;
            }
          });
        }
        // Botones de navegación del historial
        const historyPrevBtn = document.getElementById('history-prev-btn');
        const historyNextBtn = document.getElementById('history-next-btn');
        if (historyPrevBtn) {
          historyPrevBtn.addEventListener('click', () => historyManager.undo());
        }
        if (historyNextBtn) {
          historyNextBtn.addEventListener('click', () => historyManager.redo());
        }
        // v3.4.6: botón "Vaciar historial" — libera memoria GPU.
        const historyClearBtn = document.getElementById('history-clear-btn');
        if (historyClearBtn) {
          historyClearBtn.addEventListener('click', () => {
            if (typeof historyManager !== 'undefined' && historyManager.clear) {
              if (window.confirm('¿Vaciar el historial? Se perderán todos los estados guardados.')) {
                historyManager.clear();
                renderHistoryPanel();
              }
            }
          });
        }
        // Cerrar modales de análisis (click en backdrop o botón X).
        // v3.4.3: usa el helper accesible para restaurar foco y limpiar listeners.
        document.querySelectorAll('[data-close-modal]').forEach(el => {
          el.addEventListener('click', function () {
            const which = el.getAttribute('data-close-modal');
            const modal = document.getElementById(which + '-modal');
            _closeAccessibleModal(modal);
          });
        });

        // Delegación de eventos: todos los botones con data-action
        // (reemplaza los 23 onclick= inline que violaban buenas prácticas)
        document.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;
          const action = btn.getAttribute('data-action');
          switch (action) {
            case 'hideMetadataPreview': hideMetadataPreview(); break;
            case 'closeBatchModal': closeBatchModal(); break;
            case 'clearBatchQueue': clearBatchQueue(); break;
            case 'processBatch': processBatch(); break;
            case 'downloadBatchZip': downloadBatchZip(); break;
            case 'closeTextLayersPanel': closeTextLayersPanel(); break;
            case 'addNewTextLayer': addNewTextLayer(); break;
            case 'updateActiveTextLayer': updateActiveTextLayer(); break;
            case 'deleteActiveTextLayer': deleteActiveTextLayer(); break;
            case 'closeCropPanel': closeCropPanel(); break;
            case 'applyCrop': applyCrop(); break;
            case 'cancelCrop': cancelCrop(); break;
            case 'closeShortcutsModal': closeShortcutsModal(); break;
            case 'applyTextTemplate':
              applyTextTemplate(btn.getAttribute('data-template'));
              break;
            case 'applyCropSuggestion':
              applyCropSuggestion(parseInt(btn.getAttribute('data-index'), 10));
              break;
          }
        });

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
          { id: 'watermark-auto-scale', event: 'change' }, // v3.3.5
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
                    }
                  } catch (error) {
                    MNEMOTAG_DEBUG && console.warn(`Error cargando fuente ${fontFamily}:`, error);
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
          // v3.4.10: delegado a ExportManager
          downloadImageBtn.addEventListener('click', function () { ExportManager.downloadImageWithProgress(); });
        }

        if (undoBtn) {
          undoBtn.addEventListener('click', () => historyManager.undo());
        }

        if (redoBtn) {
          redoBtn.addEventListener('click', () => historyManager.redo());
        }

        // Advanced Tools buttons (v3.1)
        const batchModeBtn = document.getElementById('batch-mode-btn');
        const editorBatchBtn = document.getElementById('editor-batch-btn');
        const textLayersBtn = document.getElementById('text-layers-btn');
        const cropModeBtn = document.getElementById('crop-mode-btn');
        const shortcutsHelpBtn = document.getElementById('shortcuts-help-btn');

        if (batchModeBtn) {
          // v3.4.20: llamada directa en lugar de via window.openBatchModal
          // para evitar timing issue si initializeAdvancedUI() aún no se ejecutó.
          batchModeBtn.addEventListener('click', () => openBatchModal());
        }

        if (editorBatchBtn) {
          editorBatchBtn.addEventListener('click', () => openBatchModal());
        }

        if (textLayersBtn) {
          textLayersBtn.addEventListener('click', () => openTextLayersPanel());
        }

        if (cropModeBtn) {
          cropModeBtn.addEventListener('click', () => openCropPanel());
        }

        if (shortcutsHelpBtn) {
          shortcutsHelpBtn.addEventListener('click', () => openShortcutsModal());
        }

        // Compare and fullscreen buttons
        const fullscreenBtn = document.getElementById('fullscreen-btn');


        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', toggleFullscreen);
        }

        // Theme toggle button - CRÍTICO PARA EL MODO OSCURO
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
          themeToggle.addEventListener('click', toggleTheme);
        } else {
          console.error('Botón de tema no encontrado');
        }

        // Output configuration controls
        const outputQualitySelect = document.getElementById('output-quality');
        const outputQualityNumber = document.getElementById('quality-number');
        const outputFormatSelect = document.getElementById('output-format');

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

        // v3.7.0: calidad y formato alimentan la estimación en vivo del
        // archivo final (no pasan por updatePreview, que solo re-renderiza).
        const scheduleEstimate = () => {
          if (typeof ExportManager !== 'undefined' && ExportManager.scheduleEstimateUpdate) {
            ExportManager.scheduleEstimateUpdate();
          }
        };
        if (outputQualitySelect) outputQualitySelect.addEventListener('input', scheduleEstimate);
        if (outputQualityNumber) outputQualityNumber.addEventListener('input', scheduleEstimate);
        if (outputFormatSelect) outputFormatSelect.addEventListener('change', scheduleEstimate);

        // File basename editor
        const fileBasenameInput = document.getElementById('file-basename');
        if (fileBasenameInput) {
          fileBasenameInput.addEventListener('input', handleFileBaseNameInput);
          fileBasenameInput.addEventListener('blur', handleFileBaseNameBlur);
        }

        // Nota: el header "output" ya queda cableado por setupCollapsibles()
        // (click delegado + keydown); cablearlo aquí duplicaba el toggle y
        // Enter/Espacio abría y cerraba la sección en el mismo evento.

        // Nota: los atajos de teclado se gestionan únicamente en
        // KeyboardShortcutManager (setupKeyboardShortcuts). El handler legacy
        // duplicaba Ctrl+S (doble export) y Ctrl+Z (doble undo).


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
    function setupWatermarkSliderSync() { WatermarkManager.setupWatermarkSliderSync(); }

    // Configurar listeners de filtros con retraso para asegurar que el DOM esté listo
    function setupFilterListeners() {

      // Listeners para los sliders de filtros
      const filterSliders = ['brightness', 'contrast', 'saturation', 'blur'];
      filterSliders.forEach(filterId => {
        const slider = document.getElementById(filterId);
        const valueDisplay = document.getElementById(filterId + '-value');

        if (slider && valueDisplay) {
          slider.addEventListener('input', (e) => {
            const value = e.target.value;
            valueDisplay.textContent = value;

            if (typeof FilterManager !== 'undefined' && FilterManager.applyFilter) {
              FilterManager.applyFilter();
            } else {
              MNEMOTAG_DEBUG && console.warn('❌ FilterManager no está disponible');
            }
          });
        } else {
          MNEMOTAG_DEBUG && console.warn(`❌ No se encontró elemento para ${filterId}`);
          MNEMOTAG_DEBUG && console.warn(`    - Slider encontrado: ${!!slider}`);
          MNEMOTAG_DEBUG && console.warn(`    - ValueDisplay encontrado: ${!!valueDisplay}`);
        }
      });

      // Listeners para los botones de presets
      const presetButtons = document.querySelectorAll('.preset-btn');

      presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const preset = e.target.dataset.preset;

          if (typeof FilterManager !== 'undefined' && FilterManager.applyPreset) {
            FilterManager.applyPreset(preset);
          } else {
            MNEMOTAG_DEBUG && console.warn('❌ FilterManager no está disponible para preset');
          }
        });
      });

      // Listener para el botón de reset
      const resetBtn = document.getElementById('resetFilters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (typeof FilterManager !== 'undefined' && FilterManager.reset) {
            FilterManager.reset();
          } else {
            MNEMOTAG_DEBUG && console.warn('❌ FilterManager no está disponible para reset');
          }
        });
      }
    }

    function handleWatermarkImageChange() { WatermarkManager.handleWatermarkImageChange(); }

    // Output configuration handlers
    function handleQualityChange() {
      const qualitySelect = document.getElementById('output-quality');
      const qualityNumber = document.getElementById('quality-number');
      const qualityPercentage = document.getElementById('quality-percentage');
      const qualityBar = document.getElementById('quality-bar');

      if (!qualitySelect || !qualityNumber || !qualityPercentage || !qualityBar) return;

      const qualityValue = parseInt(qualitySelect.value);
      AppState.outputQuality = qualityValue / 100;

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

      AppState.outputFormat = formatSelect.value;

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

    // Los atajos de teclado viven en KeyboardShortcutManager
    // (ver setupKeyboardShortcuts). El handler legacy que existía aquí
    // duplicaba Ctrl+S/Ctrl+Z con registros del manager y provocaba
    // doble export / doble undo por pulsación.

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
          MNEMOTAG_DEBUG && console.warn(`No se encontró header o content para sección: ${section}`);
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
      document.getElementById('drop-area')?.classList.add('upload__dropzone--active');
    }

    function handleDragLeave(e) {
      e.preventDefault();
      document.getElementById('drop-area')?.classList.remove('upload__dropzone--active');
    }

    function handleDrop(e) {
      e.preventDefault();
      document.getElementById('drop-area')?.classList.remove('upload__dropzone--active');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    }

    function isSupportedDroppedImage(file) {
      if (!file) return false;
      return file.type.startsWith('image/') || /\.(?:jpe?g|png|webp|avif|heic|heif)$/i.test(file.name || '');
    }

    function setupGlobalDragAndDrop() {
      const overlay = document.getElementById('dnd-overlay');
      let dragDepth = 0;

      document.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        dragDepth++;
        if (overlay) {
          overlay.classList.add('show');
          overlay.setAttribute('aria-hidden', 'false');
        }
      });

      document.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      document.addEventListener('dragleave', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0 && overlay) {
          overlay.classList.remove('show');
          overlay.setAttribute('aria-hidden', 'true');
        }
      });

      document.addEventListener('drop', (e) => {
        dragDepth = 0;
        if (overlay) {
          overlay.classList.remove('show');
          overlay.setAttribute('aria-hidden', 'true');
        }

        // Los dropzones específicos conservan su comportamiento propio.
        if (e.target && e.target.closest && e.target.closest('#drop-area, #batch-dropzone')) return;

        e.preventDefault();
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || [])
          .filter(isSupportedDroppedImage);
        if (files.length === 1) {
          handleFile(files[0]);
        } else if (files.length > 1) {
          openBatchModal();
          addBatchImages(files);
        } else {
          UIManager.showError('Suelta una imagen JPG, PNG, WebP, AVIF o HEIC válida.');
        }
      });
    }

    function handleFileSelect(e) {
      const file = e.target.files[0];
      if (file) {
        handleFile(file);
      }
    }

    /**
     * v3.3.11: Handler para el evento `paste` global del documento.
     * Detecta una imagen en el portapapeles (e.clipboardData.items) y la
     * pasa al flujo normal de carga. Soporta pegar screenshots, imágenes
     * copiadas de otras webs, etc., con Cmd+V natural.
     */
    function handlePasteImage(e) {
      if (!e.clipboardData || !e.clipboardData.items) return;
      // Si el usuario está escribiendo en un input/textarea, NO interceptar.
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      for (const item of e.clipboardData.items) {
        if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            if (typeof UIManager !== 'undefined' && UIManager.showSuccess) {
              UIManager.showSuccess('📋 Imagen pegada desde el portapapeles');
            }
            return;
          }
        }
      }
    }

    /**
     * v3.3.11: Click handler del botón "Pegar imagen" del área de drop.
     * Usa navigator.clipboard.read() (más moderno y permite leer el
     * portapapeles incluso sin un evento `paste`).
     */
    async function handlePasteButtonClick() {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        UIManager.showError('Tu navegador no soporta lectura del portapapeles. Usa Cmd+V o arrastra el archivo.');
        return;
      }
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const ext = type.split('/')[1] || 'png';
              const file = new File([blob], `pasted-image.${ext}`, { type });
              handleFile(file);
              UIManager.showSuccess('📋 Imagen pegada desde el portapapeles');
              return;
            }
          }
        }
        UIManager.showInfo('No hay ninguna imagen en el portapapeles');
      } catch (err) {
        UIManager.showError('No se pudo leer el portapapeles: ' + (err.message || err));
      }
    }

    // Enhanced file handling with security validation and preview
    async function handleFile(file) {
      // Una segunda selección invalida también el diálogo anterior. Mantener
      // dos previews abiertos permitía confirmar después el archivo obsoleto
      // y dejaba el overlay de carga en un estado contradictorio.
      if (closeActiveFilePreview) closeActiveFilePreview();
      const loadToken = DocumentStateManager.beginLoad();
      // Limpiar errores anteriores
      UIManager.hideError();

      if (!file || file.size <= 0 || file.size > AppConfig.maxFileSize) {
        DocumentStateManager.cancelLoad(loadToken);
        UIManager.showError('El archivo supera el límite de 25 MB o está vacío.');
        return;
      }

      // v3.3.15: Soporte HEIC/HEIF (formatos del iPhone). Si la imagen
      // es HEIC/HEIF y la librería heic2any está cargada, convertimos a
      // JPEG ANTES de validar. La validación posterior verá un JPEG
      // estándar y todo el flujo de carga / EXIF / filtros / descarga
      // sigue funcionando sin tocar nada más.
      const isHeic = (file && (
        file.type === 'image/heic' ||
        file.type === 'image/heif' ||
        /\.heic$|\.heif$/i.test(file.name || '')
      ));
      if (isHeic) {
        try {
          UIManager.showInfo('🔄 Convirtiendo HEIC/HEIF a JPEG...');
          await ensureHeic2any();
          const converted = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.92
          });
          const blob = Array.isArray(converted) ? converted[0] : converted;
          if (!DocumentStateManager.isCurrentLoad(loadToken)) return;
          const newName = (file.name || 'imagen').replace(/\.heic$|\.heif$/i, '.jpg');
          file = new File([blob], newName, { type: 'image/jpeg' });
          UIManager.showSuccess('✅ HEIC convertido a JPEG correctamente');
        } catch (err) {
          DocumentStateManager.cancelLoad(loadToken);
          console.error('Error al convertir HEIC:', err);
          UIManager.showError('Error al convertir HEIC: ' + (err.message || err));
          return;
        }
      }

      // Validación completa del archivo
      const validation = SecurityManager.validateImageFile(file);

      if (!validation.isValid) {
        DocumentStateManager.cancelLoad(loadToken);
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
          MNEMOTAG_DEBUG && console.warn('Advertencia:', warning.message, warning.details);
          // Opcionalmente mostrar advertencias al usuario
          UIManager.showWarning && UIManager.showWarning(warning.message);
        });
      }

      // Mostrar preview del archivo antes de cargar
      UIManager.showLoadingState('Generando preview...');

      SecurityManager.generateFilePreview(file, function(previewData, error) {
        if (!DocumentStateManager.isCurrentLoad(loadToken)) return;
        if (error) {
          DocumentStateManager.cancelLoad(loadToken);
          UIManager.hideLoadingState();
          UIManager.showError('Error al generar preview: ' + error);
          return;
        }

        // Mostrar preview al usuario
        showFilePreview(previewData, function(userConfirmed) {
          if (!userConfirmed) {
            DocumentStateManager.cancelLoad(loadToken);
            UIManager.hideLoadingState();
            return;
          }

          // Usuario confirmó, proceder con la carga
          loadImageWithValidation(file, previewData.originalDimensions, {
            token: loadToken,
            decodedImage: previewData.decodedImage || null,
            thumbnailSrc: previewData.dataUrl
          });
        });
      });
    }

    // Función para mostrar preview del archivo
    function showFilePreview(previewData, callback) {
      const template = document.getElementById('file-preview-template');
      if (!template || !template.content) {
        UIManager.hideLoadingState();
        UIManager.showError('No se pudo abrir la vista previa del archivo.');
        callback(false);
        return;
      }

      const previewModal = template.content.firstElementChild.cloneNode(true);
      const previewImage = previewModal.querySelector('.preview-image');
      const fields = {
        name: previewData.fileInfo.name,
        size: previewData.fileInfo.size,
        type: previewData.fileInfo.type,
        dimensions: previewData.originalDimensions.width + 'x' +
          previewData.originalDimensions.height + 'px',
        lastModified: previewData.fileInfo.lastModified
      };

      // Todo dato procedente del archivo se asigna como texto o propiedad.
      // Nunca debe interpolarse en innerHTML: el nombre es controlado por el
      // archivo y puede contener markup o atributos de evento.
      previewImage.src = String(previewData.dataUrl || '');
      Object.entries(fields).forEach(([field, value]) => {
        const target = previewModal.querySelector('[data-preview-field="' + field + '"]');
        if (target) target.textContent = String(value || '');
      });

      document.body.appendChild(previewModal);

      // Event listeners
      const closeBtn = previewModal.querySelector('.preview-close');
      const cancelBtn = previewModal.querySelector('.preview-cancel');
      const confirmBtn = previewModal.querySelector('.preview-confirm');
      let confirmed = false;
      let closed = false;

      function finishPreview() {
        if (closed) return;
        closed = true;
        if (closeActiveFilePreview === cancelActivePreview) closeActiveFilePreview = null;
        previewModal.remove();
        callback(confirmed);
      }

      function closePreview(accepted = false) {
        if (closed) return;
        confirmed = accepted;
        _closeAccessibleModal(previewModal);
      }

      function cancelActivePreview() {
        closePreview(false);
      }

      closeActiveFilePreview = cancelActivePreview;

      closeBtn.addEventListener('click', () => closePreview(false));
      cancelBtn.addEventListener('click', () => closePreview(false));
      confirmBtn.addEventListener('click', () => closePreview(true));
      previewModal.addEventListener('click', (event) => {
        if (event.target === previewModal) {
          closePreview(false);
        }
      });

      // El controlador común aporta Escape, focus trap y restauración de foco.
      _openAccessibleModal(previewModal, finishPreview, 'display');
    }

    // Función para cargar imagen con validación de dimensiones
    function loadImageWithValidation(file, knownDimensions = null, options = {}) {
      // SessionCoordinator v1 pasaba las opciones como segundo argumento.
      // Mantener el contrato público mientras la ruta normal sigue aceptando
      // dimensiones verificadas por la vista previa.
      if (knownDimensions &&
          !Object.prototype.hasOwnProperty.call(knownDimensions, 'width') &&
          !Object.prototype.hasOwnProperty.call(knownDimensions, 'height')) {
        options = knownDimensions;
        knownDimensions = null;
      }
      if (options.token && !DocumentStateManager.isCurrentLoad(options.token)) {
        return Promise.resolve({ committed: false });
      }
      UIManager.showLoadingState('Validando imagen...');
      const loadToken = options.token || DocumentStateManager.beginLoad();

      const fileExtension = file.name.split('.').pop().toLowerCase();

      // Verificación adicional del tipo MIME vs extensión
      const mimeToExt = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/avif': ['avif']
      };

      const allowedExtensionsForMime = mimeToExt[file.type];
      if (!allowedExtensionsForMime || !allowedExtensionsForMime.includes(fileExtension)) {
        DocumentStateManager.cancelLoad(loadToken);
        UIManager.hideLoadingState();
        UIManager.showError('La extensión del archivo no coincide con su tipo');
        return Promise.resolve({ committed: false });
      }

      const objectUrl = options.decodedImage ? null : URL.createObjectURL(file);
      const img = options.decodedImage || new Image();
      const validateAndCommit = function() {
        if (!DocumentStateManager.isCurrentLoad(loadToken)) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return { committed: false };
        }
        const dimensionValidation = SecurityManager.validateImageDimensions(img);
        if (!dimensionValidation.isValid) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          DocumentStateManager.cancelLoad(loadToken);
          UIManager.hideLoadingState();
          dimensionValidation.errors.forEach(error => {
            UIManager.showError(`${error.message}: ${error.details}`);
          });
          return { committed: false };
        }
        if (knownDimensions &&
            (Number(knownDimensions.width) !== img.width || Number(knownDimensions.height) !== img.height)) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          DocumentStateManager.cancelLoad(loadToken);
          UIManager.hideLoadingState();
          UIManager.showError('La imagen cambió durante la validación. Vuelve a seleccionarla.');
          return { committed: false };
        }
        dimensionValidation.warnings.forEach(warning => {
          MNEMOTAG_DEBUG && console.warn('Advertencia de dimensiones:', warning.message, warning.details);
        });

        const thumbnailSrc = options.thumbnailSrc || objectUrl || '';
        return loadImage(img, file.name, () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        }, file, fileExtension, loadToken, thumbnailSrc);
      };

      if (options.decodedImage) {
        return Promise.resolve(validateAndCommit());
      }

      return new Promise(resolve => {
        img.onload = function() { resolve(validateAndCommit()); };
        img.onerror = function() {
          URL.revokeObjectURL(objectUrl);
          DocumentStateManager.cancelLoad(loadToken);
          UIManager.hideLoadingState();
          UIManager.showError('Error al cargar la imagen. El archivo podría estar corrupto.');
          resolve({ committed: false });
        };
        img.src = objectUrl;
      });
    }    // Enhanced image loading with validation

    function loadImage(img, fileName, cleanupSrc, file, fileExtension, loadToken, thumbnailSrc) {
      let cleaned = false;
      const cleanup = () => {
        if (!cleaned && typeof cleanupSrc === 'function') cleanupSrc();
        cleaned = true;
      };

      img.onload = function() {
        if (!DocumentStateManager.isCurrentLoad(loadToken)) {
          cleanup();
          MNEMOTAG_DEBUG && console.log('Carga de imagen obsoleta descartada:', fileName);
          return { committed: false };
        }
        try {
          // Validar dimensiones de la imagen
          if (img.width < 1 || img.height < 1) {
            cleanup();
            UIManager.hideLoadingState();
            UIManager.showError('La imagen no tiene dimensiones válidas');
            return;
          }

          // Validar dimensiones máximas (opcional)
          const maxDimension = 8192; // 8K máximo
          if (img.width > maxDimension || img.height > maxDimension) {
            cleanup();
            UIManager.hideLoadingState();
            UIManager.showError(`Las dimensiones de la imagen son demasiado grandes. Máximo ${maxDimension}x${maxDimension} píxeles.`);
            return;
          }

          const initialBaseName = sanitizeFileBaseName(extractFileBaseName(fileName));
          const committed = DocumentStateManager.commitNewDocument({
            sourceImage: img,
            file,
            extension: fileExtension,
            fileBaseName: initialBaseName,
            saveHistory: false,
            syncCanvas: false
          }, loadToken);
          if (!committed) {
            cleanup();
            return { committed: false };
          }
          ComparisonManager.invalidate();
          setupInitialFileBaseName(file);
          if (typeof MetadataManager !== 'undefined') MetadataManager.setupCreationDate(file);


          // Sanitizar y mostrar información del archivo
          const displayFileName = String(fileName || '').trim();
          const fileNameElement = document.getElementById('file-name');
          const fileInfoElement = document.getElementById('file-info');

          if (fileNameElement) {
            fileNameElement.textContent = displayFileName;
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
            thumbnailElement.src = thumbnailSrc || '';
            thumbnailElement.style.display = 'block';
          }

          // La imagen principal ya está decodificada; la URL temporal puede
          // liberarse sin conservar una copia base64 del archivo completo.
          if (thumbnailElement) {
            thumbnailElement.addEventListener('load', cleanup, { once: true });
            thumbnailElement.addEventListener('error', cleanup, { once: true });
            setTimeout(cleanup, 5000);
          } else {
            cleanup();
          }

          // Establecer título inicial si está vacío
          const titleInput = document.getElementById('metaTitle');
          if (titleInput && !titleInput.value.trim()) {
            const nameWithoutExt = displayFileName.replace(/\.[^/.]+$/, "");
            titleInput.value = nameWithoutExt;
            titleInput.placeholder = nameWithoutExt;
          }

          // Mostrar editor
          const editorContainer = document.getElementById('editor-container');
          if (editorContainer) {
            editorContainer.classList.remove('editor-container--hidden');
          }

          // v3.6.1: con imagen cargada la dropzone se oculta (CSS) y las
          // líneas base de "sección modificada" se capturan con los valores
          // recién autorrellenados (título, fecha…)
          document.body.classList.add('has-image');
          if (typeof WorkspaceManager !== 'undefined') {
            setTimeout(() => WorkspaceManager.captureBaselines(), 150);
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
          applyZoom(); // Limpiar el transform CSS del zoom anterior (sin esto
                       // la imagen nueva heredaba el scale() de la anterior)
          updateZoomLevel();

          // Recentrar posiciones custom de marcas de agua: las coordenadas de
          // la imagen anterior pueden caer fuera del canvas nuevo (marca
          // invisible e irrecuperable)
          if (customImagePosition && canvas) {
            customImagePosition = { x: canvas.width / 2, y: canvas.height / 2 };
            if (isPositioningMode) showPositionMarker();
          }
          if (customTextPosition && canvas) {
            customTextPosition = { x: canvas.width / 2, y: canvas.height / 2 };
            if (isTextPositioningMode) showTextPositionMarker();
          }

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

          // Inicializar historial después del commit atómico. HistoryManager
          // serializa internamente los snapshots asíncronos.
          historyManager.clear();
          historyManager.saveState();
          return {
            committed: true,
            documentId: AppState.documentId,
            revision: AppState.documentRevision
          };

        } catch (error) {
          cleanup();
          UIManager.hideLoadingState();
          console.error('Error al configurar la imagen:', error);
          UIManager.showError('Error al configurar la imagen. Por favor, inténtalo de nuevo.');
          return { committed: false };
        }
      };

      const configureLoadedImage = img.onload;
      img.onload = null;
      img.onerror = null;
      return configureLoadedImage.call(img);
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
        const maxDisplayHeight = Math.floor(window.innerHeight * 0.6) - 1; // match CSS max-height: 60vh
        const aspectRatio = height / width;
        let displayW = Math.min(maxDisplayWidth, width);
        let displayH = Math.round(displayW * aspectRatio);
        // Si la altura excede el límite, recalcular desde la altura
        if (displayH > maxDisplayHeight) {
          displayH = maxDisplayHeight;
          displayW = Math.round(displayH / aspectRatio);
        }
        canvas.style.width = displayW + 'px';
        canvas.style.height = displayH + 'px';
      } else {
        // Desktop: hacer que el canvas ocupe todo el ancho del contenedor.
        // Calculamos el tamaño explícito en píxeles respetando tanto el ancho
        // del contenedor como el max-height CSS (75vh) para evitar letterboxing
        // que rompe la conversión de coordenadas en imágenes verticales.
        const container = canvas.parentElement;
        if (container) {
          const containerWidth = container.clientWidth - 8; // -8 por padding
          const maxDisplayHeight = Math.floor(window.innerHeight * 0.75) - 1; // match CSS max-height: 75vh
          const aspectRatio = height / width;
          let displayW = Math.min(containerWidth, width * 2); // hasta 2x el tamaño real
          let displayH = Math.round(displayW * aspectRatio);
          // Si la altura excede 75vh, recalcular ambas dimensiones desde la altura
          if (displayH > maxDisplayHeight) {
            displayH = maxDisplayHeight;
            displayW = Math.round(displayH / aspectRatio);
          }
          canvas.style.width = displayW + 'px';
          canvas.style.height = displayH + 'px';
        } else {
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
        }
      }

      canvas.style.maxWidth = '100%';

      // Mejorar calidad de renderizado del canvas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';


    }

    /**
     * Calcula el rectángulo real del contenido del canvas dentro de su box CSS.
     * Necesario cuando object-fit: contain (fullscreen, mobile CSS) crea letterboxing,
     * ya que getBoundingClientRect() devuelve el box CSS completo, no el área de contenido.
     */
    function getCanvasContentRect() {
      const rect = canvas.getBoundingClientRect();
      const canvasAR = canvas.width / canvas.height;
      const boxAR = rect.width / rect.height;

      // Fast path: aspect ratios coinciden, no hay letterboxing
      if (Math.abs(canvasAR - boxAR) < 0.01) {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }

      let contentWidth, contentHeight, offsetX, offsetY;
      if (canvasAR > boxAR) {
        // Limitado por ancho (landscape en box estrecho)
        contentWidth = rect.width;
        contentHeight = rect.width / canvasAR;
        offsetX = 0;
        offsetY = (rect.height - contentHeight) / 2;
      } else {
        // Limitado por altura (portrait en box ancho)
        contentHeight = rect.height;
        contentWidth = rect.height * canvasAR;
        offsetX = (rect.width - contentWidth) / 2;
        offsetY = 0;
      }

      return {
        left: rect.left + offsetX,
        top: rect.top + offsetY,
        width: contentWidth,
        height: contentHeight
      };
    }

    // DESACTIVADO: El zoom con rueda del mouse se maneja solo en móviles (<768px)
    // Ver initMouseWheelZoom() para la implementación con detección de dispositivo

    // Flag para coalescer múltiples llamadas a updatePreview en un solo RAF.
    // Sin este flag, cada mousemove durante un drag encolaba un RAF
    // independiente y los renders se acumulaban tras soltar el ratón.
    let pendingPreviewRender = false;

    function updatePreview() {
      if (!currentImage || !ctx) {
        FilterLoadingManager.hideFilterLoading();
        return;
      }

      // v3.7.0: cada re-render alimenta (debounced) la estimación en vivo
      // de la exportación y el autosave de sesión en IndexedDB.
      if (typeof ExportManager !== 'undefined' && ExportManager.scheduleEstimateUpdate) {
        ExportManager.scheduleEstimateUpdate();
      }
      if (typeof SessionManager !== 'undefined' && SessionManager.scheduleAutoSave) {
        SessionManager.scheduleAutoSave();
      }

      // Durante un drag activo, forzamos siempre el camino estándar (rápido).
      // El camino con worker se reserva para cambios de filtros pesados, no
      // para reposicionamiento de marcas de agua.
      if (!isDragging && FilterManager.shouldUseWorker()) {
        updatePreviewWithWorker();
      } else {
        updatePreviewStandard();
      }
    }

    /**
     * v3.7.1: COMPOSITOR ÚNICO del documento.
     *
     * Todos los caminos de render que parten de la imagen base decodificada
     * (preview estándar, redibujado para export, render con capas de texto,
     * render ligero durante drag de capas) pasan por aquí. Antes cada camino
     * duplicaba la secuencia clear → drawImage → watermarks → filtros y las
     * variantes divergían con el tiempo.
     *
     * NO cubre el camino con worker (updatePreviewWithWorker): ese parte de
     * píxeles ya horneados (putImageData), no de la imagen base.
     *
     * @param {Object} [state] - Qué pasadas aplicar:
     *   - watermarks:  bool ('true' por defecto) — marcas de agua de texto/imagen.
     *   - cssFilters:  'full' | 'light' | 'none' ('full' por defecto) — filtros
     *                  CSS sobre el canvas visible ('light' = solo los que el
     *                  worker no hornea).
     *   - textLayers:  'none' | 'full' | 'light' ('none' por defecto) — capas
     *                  de texto ('light' = sin efectos, para drag a 60 fps).
     * @param {HTMLCanvasElement} [targetCanvas] - Canvas destino (por defecto
     *   el canvas principal).
     * @returns {boolean} true si se pintó, false si faltaba imagen/canvas.
     */
    function renderMainDocument(state = {}, targetCanvas = canvas) {
      const options = Object.assign({
        watermarks: true,
        cssFilters: 'full',
        textLayers: 'full'
      }, state);
      const result = DocumentRenderer.renderDocument({
        sourceImage: currentImage,
        referenceWidth: canvas ? canvas.width : 0,
        referenceHeight: canvas ? canvas.height : 0,
        filterString: options.cssFilters === 'none' ? '' : FilterManager.getFilterString(),
        watermarks: WatermarkManager.captureConfig(),
        watermarkMode: options.watermarks ? 'full' : 'none',
        textLayers: textLayerManager ? textLayerManager.getAllLayers() : [],
        textLayerMode: options.textLayers,
        showPositioningBorders: AppState.showPositioningBorders
      }, targetCanvas);

      if (targetCanvas === canvas) {
        canvas.style.filter = '';
        AppState.textWatermarkBounds = result.watermarkBounds?.text || null;
        AppState.imageWatermarkBounds = result.watermarkBounds?.image || null;
        AppState.textLayerBounds = result.textLayerBounds || [];
      }
      return result.rendered;
    }

    // Actualización estándar del preview (sin worker)
    function updatePreviewStandard() {
      // Coalescing: si ya hay un RAF en vuelo, no encolamos otro.
      if (pendingPreviewRender) return;
      pendingPreviewRender = true;

      requestAnimationFrame(() => {
        pendingPreviewRender = false;
        try {
          // Composición única: imagen base + watermarks. Durante un drag
          // activo se saltan los filtros CSS y el saveState (P2): son los
          // dos puntos calientes. Al soltar, handleDragEnd dispara un
          // updatePreview() final completo.
          renderMainDocument({ cssFilters: isDragging ? 'none' : 'full' });

          // Sincronizar overlays DOM con la posición actual cuando estamos
          // en modo personalizado (S1). Antes solo se actualizaban durante el
          // drag, así que cambiar size/opacity dejaba el overlay desfasado.
          const textPositionMode = document.getElementById('watermark-position')?.value;
          const imagePositionMode = document.getElementById('watermark-image-position')?.value;
          if (textPositionMode === 'custom' && customTextPosition && typeof showTextPositionMarker === 'function') {
            showTextPositionMarker();
          }
          if (imagePositionMode === 'custom' && customImagePosition && typeof showPositionMarker === 'function') {
            showPositionMarker();
          }

          if (!isDragging && !historyManager.isRestoring) {
            if (typeof debouncedSaveHistory === 'undefined') {
              window.debouncedSaveHistory = SmartDebounce.intelligent('save-history', () => {
                historyManager.saveState();
              }, 1000);
            }
            debouncedSaveHistory();
          }
        } catch (error) {
          console.error('❌ Error al actualizar preview:', error);
          FilterLoadingManager.hideFilterLoading();
        }
      });
    }

    // Contador de secuencia para descartar resultados obsoletos del worker
    let updatePreviewWithWorkerSeq = 0;

    // Actualización del preview usando worker para filtros pesados
    async function updatePreviewWithWorker() {
      try {
        // Obtener datos de imagen para el worker
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Dibujar imagen base
        tempCtx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

        // Token de secuencia: si mientras el worker procesa llega otra llamada
        // (o cambia la imagen/dimensiones), este resultado queda obsoleto y se
        // descarta en vez de pintarse encima del más reciente
        const seq = ++updatePreviewWithWorkerSeq;

        // Procesar con worker
        const processedImageData = await FilterManager.applyWithWorker(imageData);

        if (seq !== updatePreviewWithWorkerSeq) return;
        if (processedImageData.width !== canvas.width ||
            processedImageData.height !== canvas.height) {
          // La imagen/canvas cambió durante el procesado
          return;
        }

        // Aplicar resultado mediante el compositor único. El worker entrega
        // la imagen base con los filtros pesados ya horneados; renderDocument
        // añade los filtros ligeros restantes, watermarks y capas de texto.
        requestAnimationFrame(() => {
          if (seq !== updatePreviewWithWorkerSeq) return;
          const processedCanvas = document.createElement('canvas');
          processedCanvas.width = canvas.width;
          processedCanvas.height = canvas.height;
          processedCanvas.getContext('2d').putImageData(processedImageData, 0, 0);
          const result = DocumentRenderer.renderDocument({
            sourceImage: processedCanvas,
            referenceWidth: canvas.width,
            referenceHeight: canvas.height,
            filterString: getCanvasFiltersLight(),
            watermarks: WatermarkManager.captureConfig(),
            textLayers: textLayerManager ? textLayerManager.getAllLayers() : [],
            showPositioningBorders: AppState.showPositioningBorders
          }, canvas);
          canvas.style.filter = '';
          AppState.textWatermarkBounds = result.watermarkBounds?.text || null;
          AppState.imageWatermarkBounds = result.watermarkBounds?.image || null;
          AppState.textLayerBounds = result.textLayerBounds || [];

          // Save state to history
          if (!historyManager.isRestoring) {
            if (typeof debouncedSaveHistory === 'undefined') {
              window.debouncedSaveHistory = SmartDebounce.intelligent('save-history', () => {
                historyManager.saveState();
              }, 1000);
            }
            debouncedSaveHistory();
          }

        });

      } catch (error) {
        MNEMOTAG_DEBUG && console.warn('⚠️ Worker falló, usando fallback:', error);
        updatePreviewStandard();
      }
    }

    // Funciones de posicionamiento personalizado (deben estar antes de apply)
    // Posicionamiento y render de watermarks: extraídos a
    // js/managers/watermark-manager.js (v3.7.1).
    function getImageWatermarkPosition(position, width, height) { return WatermarkManager.getImageWatermarkPosition(position, width, height); }
    function getTextWatermarkPosition(position, width, height) { return WatermarkManager.getTextWatermarkPosition(position, width, height); }
    function applyWatermarkOptimized() { WatermarkManager.applyWatermarkOptimized(); }

    function applyTextWatermarkOptimized() { WatermarkManager.applyTextWatermarkOptimized(); }
    function applyImageWatermarkOptimized() { WatermarkManager.applyImageWatermarkOptimized(); }
    function drawCachedWatermark(watermarkImg, config) { WatermarkManager.drawCachedWatermark(watermarkImg, config); }
    function calculateWatermarkImageSize(img, sizeOption) { return WatermarkManager.calculateWatermarkImageSize(img, sizeOption); }
    function getWatermarkPosition(position, width, height) { return WatermarkManager.getWatermarkPosition(position, width, height); }
    function toggleWatermarkType() { WatermarkManager.toggleWatermarkType(); }
    function toggleCustomImageSize() { WatermarkManager.toggleCustomImageSize(); }
    function togglePositioningMode() { WatermarkManager.togglePositioningMode(); }
    function toggleTextPositioningMode() { WatermarkManager.toggleTextPositioningMode(); }
    function updatePositioningClasses() { WatermarkManager.updatePositioningClasses(); }

    function handleCanvasClick(_event) {
      // DESACTIVADO: El sistema drag & drop maneja todo automáticamente
      // (ver la sección "SISTEMA DRAG & DROP para marcas de agua" más abajo).
      // Esta función queda como no-op explícito para no romper el listener
      // registrado en setupEventListeners → `canvas.addEventListener('click', handleCanvasClick)`.
      // v3.4.2: código muerto eliminado para satisfacer a eslint no-unreachable.
    }

    // ========================================================================
    // SISTEMA DRAG & DROP para marcas de agua — extraído a
    // js/managers/watermark-manager.js (v3.7.1). Delegados finos.
    // ========================================================================

    function isPointInText(x, y) { return WatermarkManager.isPointInText(x, y); }
    function isPointInImage(x, y) { return WatermarkManager.isPointInImage(x, y); }
    function isPointInTextLayer(x, y) { return WatermarkManager.isPointInTextLayer(x, y); }
    function handleDragStart(event) { WatermarkManager.handleDragStart(event); }
    function handleDragMove(event) { WatermarkManager.handleDragMove(event); }
    function handleDragEnd(event) { WatermarkManager.handleDragEnd(event); }
    function handleTouchStart(event) { WatermarkManager.handleTouchStart(event); }
    function handleTouchMove(event) { WatermarkManager.handleTouchMove(event); }
    function handleTouchEnd(event) { WatermarkManager.handleTouchEnd(event); }

    // Reglas métricas extraídas a RulerManager (v3.7.1).
    function toggleRulerMode() { RulerManager.toggle(); }

    // Marcadores DOM de posición personalizada: extraídos a
    // js/managers/watermark-manager.js (v3.7.1).
    function showPositionMarker() { WatermarkManager.showPositionMarker(); }
    function removePositionMarker() { WatermarkManager.removePositionMarker(); }
    function showTextPositionMarker() { WatermarkManager.showTextPositionMarker(); }
    function removeTextPositionMarker() { WatermarkManager.removeTextPositionMarker(); }

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


        // Mostrar previsualización de metadatos
        showMetadataPreview(sanitizedMetadata);

        // Simular procesamiento
        setTimeout(() => {
          form.classList.remove('form-loading');
          UIManager.showSuccess('Metadatos guardados correctamente.');

          // v3.5.9: Guardar estado en el historial tras actualizar metadatos
          if (typeof historyManager !== 'undefined') {
            historyManager.saveState();
          }
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
    function handleWatermarkSubmit(e) { WatermarkManager.handleWatermarkSubmit(e); }

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
      const wtEnabled = document.getElementById('watermark-text-enabled');
      const wiEnabled = document.getElementById('watermark-image-enabled');
      if (wtEnabled) wtEnabled.checked = true;
      if (wiEnabled) wiEnabled.checked = false;
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
        AppState.outputQuality = 0.8;
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
        AppState.outputFormat = formatSelect.value;
        handleFormatChange();
      }
    }

    /**
     * Lee el color elegido por el usuario para aplanar transparencia al
     * exportar JPEG. Devuelve un string hex válido (#rrggbb). Si no existe
     * el control o el valor es inválido, devuelve blanco como fallback
     * (coherente con Photoshop/GIMP).
     */
    function getFlattenColor() {
      const input = document.getElementById('jpeg-flatten-color');
      const value = input && input.value ? String(input.value).trim() : '';
      return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
    }

    /**
     * v3.3.11: Exporta la imagen actual a varios tamaños a la vez,
     * empaquetando los blobs resultantes en un ZIP con JSZip.
     *
     * Lee qué checkboxes "multisize-XXX" están activos, redimensiona el
     * canvas a cada ancho conservando aspect ratio, aplica el flujo
     * normal de export (canvasToBlob + EXIF embedding según formato), y
     * genera un único archivo .zip que el usuario descarga.
     */

    // ============================================================
    // v3.4.3 — Helpers de accesibilidad para modales
    // ============================================================
    // Cada modal llama a `_openAccessibleModal(modal)` en vez de
    // `modal.classList.remove('hidden')`. El helper:
    //   1. Guarda el elemento que tenía el foco antes de abrir.
    //   2. Muestra el modal.
    //   3. Enfoca el primer elemento focusable dentro.
    //   4. Engancha listeners de `keydown` para:
    //      - `Escape` → cerrar el modal.
    //      - `Tab` / `Shift+Tab` → atrapar el foco dentro del modal.
    //   5. Al cerrar (`_closeAccessibleModal(modal)`), desengancha los
    //      listeners y devuelve el foco al elemento guardado en (1).

    const _modalKeyHandlers = new WeakMap();

    function _getFocusableElements(container) {
      if (!container) return [];
      return Array.from(container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null);
    }

    /**
     * ModalController único (v3.5.14): TODOS los modales abren/cierran por
     * aquí. Soporta dos modos de visibilidad:
     *  - 'class'   → alterna la clase .hidden (analysis-modals, default)
     *  - 'display' → alterna style.display flex/none (batch, shortcuts)
     */
    function _openAccessibleModal(modal, onClose, visibility = 'class') {
      if (!modal) return;
      const previouslyFocused = document.activeElement;
      if (visibility === 'display') {
        modal.style.display = 'flex';
      } else {
        modal.classList.remove('hidden');
      }
      modal.setAttribute('aria-hidden', 'false');

      // Foco inicial: el primer elemento focusable dentro del modal,
      // o el propio modal si no hay ninguno (con tabindex=-1 implícito).
      const focusables = _getFocusableElements(modal);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (modal.tabIndex < 0) {
        modal.tabIndex = -1;
        modal.focus();
      }

      const keyHandler = function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          _closeAccessibleModal(modal);
          return;
        }
        if (e.key === 'Tab') {
          const currentFocusables = _getFocusableElements(modal);
          if (currentFocusables.length === 0) {
            e.preventDefault();
            return;
          }
          const first = currentFocusables[0];
          const last = currentFocusables[currentFocusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', keyHandler);
      _modalKeyHandlers.set(modal, { handler: keyHandler, previouslyFocused, onClose, visibility });
    }

    function _closeAccessibleModal(modal) {
      if (!modal) return;
      const stateForVisibility = _modalKeyHandlers.get(modal);
      if (stateForVisibility && stateForVisibility.visibility === 'display') {
        modal.style.display = 'none';
      } else {
        modal.classList.add('hidden');
      }
      modal.setAttribute('aria-hidden', 'true');

      const state = _modalKeyHandlers.get(modal);
      if (state) {
        document.removeEventListener('keydown', state.handler);
        _modalKeyHandlers.delete(modal);
        // v3.4.4: dispara el callback onClose del caller si existe
        // (para rollback de live preview en curves, por ejemplo).
        if (typeof state.onClose === 'function') {
          try { state.onClose(); } catch (e) { console.error('onClose callback failed:', e); }
        }
        // Devolver el foco al elemento que lo tenía antes de abrir.
        if (state.previouslyFocused && typeof state.previouslyFocused.focus === 'function') {
          try { state.previouslyFocused.focus(); } catch (e) { /* defensive */ }
        }
      }
    }

    // ============================================================
    // v3.3.12 — Análisis visual: extraído a js/managers/analysis-manager.js (v3.4.7)
    // Helper local _getCanvasImageData se mantiene para curves-manager
    // y futuros consumidores internos de main.js.
    // ============================================================

    function _getCanvasImageData() {
      if (!canvas || !currentImage) return null;
      try {
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.error('No se pudo leer imageData del canvas:', err);
        return null;
      }
    }

    // ============================================================
    // v3.3.13 — Curvas y niveles — extraído a js/managers/curves-manager.js (v3.4.8)
    // ============================================================
    // openCurvesModal se mantiene como shim para que el listener
    // existente no requiera cambios. Delega a CurvesManager.open().
    function openCurvesModal() {
      if (typeof CurvesManager !== 'undefined' && CurvesManager.open) {
        return CurvesManager.open();
      }
      UIManager.showError('Editor de curvas no disponible (CurvesManager no cargado).');
    }


    // ============================================================
    // v3.3.14 — Panel de historial visual con thumbnails clicables
    // ============================================================

    function toggleHistoryPanel() {
      const panel = document.getElementById('history-panel');
      if (!panel) return;
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        renderHistoryPanel();
        panel.classList.remove('hidden');
        panel.inert = false;
      } else {
        panel.classList.add('hidden');
        panel.inert = true;
      }
    }

    // Exponer a window para que historyManager.updateUndoRedoButtons
    // pueda invocar el re-render del panel sin acoplar managers entre sí.
    window.renderHistoryPanel = renderHistoryPanel;

    function renderHistoryPanel() {
      const panel = document.getElementById('history-panel');
      const grid = document.getElementById('history-panel-grid');
      if (!panel || !grid) return;
      // Si el panel está oculto no perdemos tiempo construyendo el DOM.
      if (panel.classList.contains('hidden')) return;
      if (typeof historyManager === 'undefined' || !historyManager.getStatesSummary) return;

      const summary = historyManager.getStatesSummary();
      grid.replaceChildren();

      if (summary.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'history-panel__empty';
        empty.textContent = 'Aún no hay estados en el historial. Aplica un filtro o cambio para empezar a guardarlo.';
        grid.appendChild(empty);
        return;
      }

      summary.forEach(item => {
        const thumb = document.createElement('div');
        thumb.className = 'history-thumb' + (item.isCurrent ? ' is-current' : '');
        thumb.title = 'Estado ' + (item.index + 1) + ' · click para restaurar';

        const img = document.createElement('img');
        img.className = 'history-thumb__image';
        img.alt = 'Estado ' + (item.index + 1);
        img.src = item.thumbnail;
        // El navegador escala a 80px de altura via CSS object-fit.

        const info = document.createElement('div');
        info.className = 'history-thumb__info';
        const date = new Date(item.timestamp);
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        info.textContent = '#' + (item.index + 1) + ' · ' + hh + ':' + mm + ':' + ss;

        thumb.appendChild(img);
        thumb.appendChild(info);
        thumb.addEventListener('click', () => {
          if (typeof historyManager.jumpToState === 'function') {
            historyManager.jumpToState(item.index);
            // Re-render para mover el highlight de "is-current"
            renderHistoryPanel();
          }
        });

        grid.appendChild(thumb);

        // Scroll automático al estado actual
        if (item.isCurrent) {
          requestAnimationFrame(() => {
            thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          });
        }
      });
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

      if (canvas) {
        const name = currentFile && currentFile.name ? currentFile.name : 'imagen cargada';
        canvas.setAttribute(
          'aria-label',
          `Previsualización de ${name}, ${currentImage.width} por ${currentImage.height} píxeles`
        );
      }

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
    // Guard: initResize se invoca desde loadImage en CADA carga de imagen;
    // sin este flag los listeners se acumulaban y un clic en "Aplicar"
    // ejecutaba el resize una vez por cada imagen cargada en la sesión.
    let resizeControlsInitialized = false;

    function initResize() {
      if (resizeControlsInitialized) return;
      resizeControlsInitialized = true;

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
    async function resizeImage(newWidth, newHeight) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }

      // Validate dimensions
      const maxWidth = AppConfig.maxCanvasWidth || 2400;
      const maxHeight = AppConfig.maxCanvasHeight || 2400;
      if (!Number.isSafeInteger(newWidth) || !Number.isSafeInteger(newHeight) ||
          newWidth <= 0 || newHeight <= 0 || newWidth > maxWidth || newHeight > maxHeight) {
        UIManager.showError(`El tamaño debe estar entre 1×1 y ${maxWidth}×${maxHeight} píxeles.`);
        return;
      }

      try {
        const committed = await DocumentStateManager.enqueueRasterMutation(
          'resize',
          async function(source) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = newWidth;
            tempCanvas.height = newHeight;
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(source, 0, 0, newWidth, newHeight);
            return tempCanvas;
          },
          {
            takeOwnership: true,
            updateOriginalDimensions: false,
            updateResetImage: true,
            rotation: 0,
            isFlippedHorizontally: false,
            isFlippedVertically: false,
            saveHistory: true
          }
        );
        if (committed) {
          showSuccessMessage(`Imagen redimensionada a ${newWidth} × ${newHeight}`);
        }
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

    async function rotateImage(degrees) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }

      try {
        const mutationOptions = {
          takeOwnership: true,
          updateOriginalDimensions: false,
          saveHistory: true
        };
        const committed = await DocumentStateManager.enqueueRasterMutation(
          'rotate',
          async function(source) {
            mutationOptions.rotation = ((AppState.currentRotation + degrees) % 360 + 360) % 360;
            return applyImageTransformation(source, degrees, null);
          },
          mutationOptions
        );
        if (committed) {
          showSuccessMessage(`Imagen rotada ${degrees}° (Total: ${AppState.currentRotation}°)`);
        }
      } catch (error) {
        console.error('Error rotating image:', error);
        UIManager.showError('Error al rotar la imagen');
      }
    }

    async function flipImage(direction) {
      if (!currentImage) {
        console.error('No current image available');
        return;
      }

      try {
        const mutationOptions = {
          takeOwnership: true,
          updateOriginalDimensions: false,
          saveHistory: true
        };
        const committed = await DocumentStateManager.enqueueRasterMutation(
          'flip-' + direction,
          async function(source) {
            mutationOptions.isFlippedHorizontally = direction === 'horizontal'
              ? !AppState.isFlippedHorizontally
              : AppState.isFlippedHorizontally;
            mutationOptions.isFlippedVertically = direction === 'vertical'
              ? !AppState.isFlippedVertically
              : AppState.isFlippedVertically;
            return applyImageTransformation(source, 0, direction);
          },
          mutationOptions
        );
        const flipText = direction === 'horizontal' ? 'horizontalmente' : 'verticalmente';
        if (committed) showSuccessMessage(`Imagen volteada ${flipText}`);
      } catch (error) {
        console.error('Error flipping image:', error);
        UIManager.showError('Error al voltear la imagen');
      }
    }

    /**
     * Hornea UNA transformación incremental (delta) sobre currentImage.
     * @param {number} deltaDegrees - rotación a aplicar en esta operación
     * @param {string|null} flipAxis - 'horizontal' | 'vertical' | null
     * currentImage ya contiene las transformaciones anteriores, por lo que
     * aquí nunca se usa el ángulo acumulado ni las dimensiones originales
     * pre-transformación (eso causaba doble transformación y distorsión).
     */
    function applyImageTransformation(source, deltaDegrees = 0, flipAxis = null) {
      // Dimensiones reales de la imagen actual (no las originales obsoletas)
      const srcW = source.naturalWidth || source.width;
      const srcH = source.naturalHeight || source.height;

      const rot = ((deltaDegrees % 360) + 360) % 360;
      const swapDims = rot === 90 || rot === 270;
      const newWidth = swapDims ? srcH : srcW;
      const newHeight = swapDims ? srcW : srcH;

      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = newWidth;
      resultCanvas.height = newHeight;
      const resultCtx = resultCanvas.getContext('2d');

      resultCtx.imageSmoothingEnabled = true;
      resultCtx.imageSmoothingQuality = 'high';
      resultCtx.translate(newWidth / 2, newHeight / 2);
      if (rot !== 0) {
        resultCtx.rotate((rot * Math.PI) / 180);
      }
      const scaleX = flipAxis === 'horizontal' ? -1 : 1;
      const scaleY = flipAxis === 'vertical' ? -1 : 1;
      resultCtx.scale(scaleX, scaleY);
      resultCtx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);
      return resultCanvas;
    }

    async function resetRotation() {
      if (!currentImage) return;

      try {
        const committed = await DocumentStateManager.enqueueRasterMutation(
          'reset-transform',
          async function() { return AppState.transformResetImage; },
          {
            updateOriginalDimensions: false,
            rotation: 0,
            isFlippedHorizontally: false,
            isFlippedVertically: false,
            saveHistory: true
          }
        );
        if (committed) showSuccessMessage('Rotación restablecida al original');
      } catch (error) {
        console.error('Error resetting rotation:', error);
        UIManager.showError('Error al restablecer la rotación');
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
    /**
     * @param {string} title
     * @param {Object} [options] - v3.5.14: { onCancel } muestra un botón
     *   "Cancelar" en el overlay que ejecuta el callback (una sola vez).
     */
    function showProgressBar(title = 'Procesando...', options = {}) {
      const overlay = document.getElementById('progress-overlay');
      const titleElement = document.getElementById('progress-title');
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressEta = document.getElementById('progress-eta');
      const progressTrack = document.getElementById('progress-track');
      const cancelBtn = document.getElementById('progress-cancel');

      if (overlay && titleElement) {
        titleElement.textContent = title;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        progressEta.textContent = 'Calculando tiempo...';
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', '0');

        if (cancelBtn) {
          if (typeof options.onCancel === 'function') {
            cancelBtn.style.display = 'inline-flex';
            cancelBtn.disabled = false;
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.onclick = () => {
              cancelBtn.disabled = true;
              cancelBtn.textContent = 'Cancelando…';
              options.onCancel();
            };
          } else {
            cancelBtn.style.display = 'none';
            cancelBtn.onclick = null;
          }
        }

        overlay.classList.add('show');
      }
    }

    function updateProgress(percentage, message = '', eta = '') {
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressEta = document.getElementById('progress-eta');
      const progressTrack = document.getElementById('progress-track');

      if (progressBar && progressText) {
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
        if (progressTrack) {
          const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
          progressTrack.setAttribute('aria-valuenow', String(clamped));
        }

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


    // Hide image info when no image is loaded
    function hideImageInfo() {
      const imageInfoElement = document.getElementById('image-info');
      if (imageInfoElement) {
        imageInfoElement.classList.add('hidden');
      }
    }

    function removeSelectedFile() {
      // v3.7.0: quitar la imagen explícitamente invalida la sesión guardada
      if (typeof SessionManager !== 'undefined') SessionManager.clear();
      // v3.6.1: restaurar la dropzone al quitar la imagen
      document.body.classList.remove('has-image');
      DocumentStateManager.clearDocument({ resetCanvasSize: true });
      historyManager.clear();
      ComparisonManager.invalidate();
      watermarkImagePreview = null;
      customImagePosition = null;
      isPositioningMode = false;
      customTextPosition = null;
      isTextPositioningMode = false;
      if (canvas) canvas.setAttribute('aria-label', 'Previsualización: sin imagen cargada');

      WatermarkManager.clearCache();

      // Limpiar formularios
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
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
      document.getElementById('file-info')?.classList.add('file-info--hidden');
      document.getElementById('editor-container')?.classList.add('editor-container--hidden');

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

      // Limpiar marcadores de posición si existen (imagen Y texto)
      removePositionMarker();
      removeTextPositionMarker();

      // Ocultar información de posicionamiento personalizado (imagen y texto)
      const customInfo = document.getElementById('custom-position-info');
      if (customInfo) {
        customInfo.style.display = 'none';
      }
      const customTextInfo = document.getElementById('custom-text-position-info');
      if (customTextInfo) {
        customTextInfo.style.display = 'none';
      }

      // Quitar clases de posicionamiento del canvas
      if (canvas) {
        canvas.classList.remove('positioning-mode', 'positioning-image', 'positioning-text', 'positioning-both');
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

        // Restaurar dimensiones correctas del canvas
        if (currentImage) {
          setupCanvas();
          updatePreview();
        }

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

    // Registrar el listener: la función existía pero nunca se registraba, así
    // que salir de pantalla completa con Escape dejaba los estilos inline y el
    // botón en estado "Salir" para siempre.
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    function showError(message) {
      UIManager.showError(message);
    }

    function hideError() {
      // Legacy function kept for compatibility
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.classList.add('error--hidden');
      }
    }

    function showSuccess(message) {
      UIManager.showSuccess(message);
    }

    // v3.7.1: downloadImageEnhanced eliminado — era código muerto (la descarga
    // real vive en export-manager.js: downloadImage / downloadImageWithProgress).

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
        FilterLoadingManager.hideFilterLoading();
        return;
      }

      // Verificar si necesita actualización usando cache
      if (!FilterCache.hasChanged(FilterManager.filters)) {
        FilterLoadingManager.hideFilterLoading();
        return;
      }

      // Usar requestAnimationFrame para mejor performance
      requestAnimationFrame(() => {
        try {
          const filterString = FilterManager.getFilterString();

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

    // Aplica vía CSS SOLO los filtros que el worker NO horneó en píxeles.
    // Se llama después del camino worker. La versión anterior leía claves
    // inexistentes (filters.hue/.grayscale/.invert) y generaba un string CSS
    // inválido que el CSSOM rechazaba, dejando el filter completo anterior
    // aplicado ENCIMA de los píxeles ya procesados (filtros dobles).
    function getCanvasFiltersLight() {
      // Claves que el worker hornea (contrato con filter-manager.js).
      const baked = Array.isArray(FilterManager.workerBakedFilters)
        ? FilterManager.workerBakedFilters
        : ['brightness', 'contrast', 'saturation', 'sepia'];

      const f = FilterManager.filters;
      const filterParts = [];

      if (!baked.includes('brightness') && f.brightness !== 0) {
        filterParts.push(`brightness(${(100 + f.brightness) / 100})`);
      }
      if (!baked.includes('contrast') && f.contrast !== 0) {
        filterParts.push(`contrast(${(100 + f.contrast) / 100})`);
      }
      if (!baked.includes('saturation') && f.saturation !== 0) {
        filterParts.push(`saturate(${(100 + f.saturation) / 100})`);
      }
      if (!baked.includes('sepia') && f.sepia > 0) {
        filterParts.push(`sepia(${f.sepia}%)`);
      }
      if (!baked.includes('hueRotate') && f.hueRotate !== 0) {
        filterParts.push(`hue-rotate(${f.hueRotate}deg)`);
      }
      if (!baked.includes('blur') && f.blur > 0) {
        filterParts.push(`blur(${f.blur}px)`);
      }

      // String vacío es válido: limpia el filter CSS completo anterior para
      // que no se acumule sobre los píxeles ya horneados.
      return filterParts.join(' ');
    }

    function applyCanvasFiltersLight() {
      if (!canvas) return;
      const filterString = getCanvasFiltersLight();

      requestAnimationFrame(() => {
        canvas.style.transition = 'filter 0.2s ease';
        canvas.style.filter = filterString;
      });
    }

    // ===== ZOOM FUNCTIONALITY — extraído a js/managers/zoom-pan-manager.js (v3.5.0) =====
    // Shims locales para que las llamadas existentes en main.js
    // (zoomIn(), resetZoom(), etc.) sigan funcionando sin cambiar cada callsite.
    function zoomIn() { ZoomPanManager.zoomIn(); }
    function zoomOut() { ZoomPanManager.zoomOut(); }
    function resetZoom() { ZoomPanManager.resetZoom(); }
    function applyZoom() { ZoomPanManager.applyZoom(); }
    function updateZoomLevel() { ZoomPanManager.updateZoomLevel(); }
    function resetPan() { ZoomPanManager.resetPan(); }
    function initZoomKeyboardShortcuts() { ZoomPanManager.initZoomKeyboardShortcuts(); }
    function initMouseWheelZoom() { ZoomPanManager.initMouseWheelZoom(); }
    function initPanNavigation() { ZoomPanManager.initPanNavigation(); }

    // Interacciones responsive/táctiles extraídas a MobileManager (v3.7.1).
    function initMobileFeatures() {
      MobileManager.initialize({ setupCanvas, updatePreview });
    }

    // ===== FILTER OPTIMIZATION & CLEANUP =====

    // Limpieza automática de cache cada 5 minutos
    setInterval(() => {
      FilterCache.cleanup();
    }, 5 * 60 * 1000);

    // Cleanup al cerrar/recargar página
    window.addEventListener('beforeunload', () => {
      SmartDebounce.clear();
      FilterLoadingManager.activeLoadings.clear();
    });

    // Función para mostrar métricas de rendimiento (solo en modo debug)
    if (MNEMOTAG_DEBUG) {
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
    }

    // ===== ADVANCED MANAGERS INITIALIZATION =====

    /**
     * Inicializar managers avanzados
     */
    function initializeAdvancedManagers() {
      try {
        // Inicializar Keyboard Shortcuts
        keyboardShortcuts = new KeyboardShortcutManager();
        EditorShortcutManager.configure({
          keyboardShortcuts,
          handleFile,
          getCropManager: () => cropManager,
          closeCropPanel,
          updatePreview,
          resetFilters,
          resetChanges,
          toggleComparisonMode,
          openModal: _openAccessibleModal,
          closeModal: _closeAccessibleModal
        });

        // Inicializar Batch Manager
        batchManager = new BatchManager();

        // Inicializar Text Layer Manager
        textLayerManager = new TextLayerManager();

        DocumentStateManager.configure({
          createCanvas: function(width, height) {
            const owned = document.createElement('canvas');
            owned.width = width;
            owned.height = height;
            return owned;
          },
          render: function() {
            ComparisonManager.invalidate();
            if (customImagePosition) {
              customImagePosition.x = Math.min(customImagePosition.x, AppState.currentImage.width);
              customImagePosition.y = Math.min(customImagePosition.y, AppState.currentImage.height);
            }
            if (customTextPosition) {
              customTextPosition.x = Math.min(customTextPosition.x, AppState.currentImage.width);
              customTextPosition.y = Math.min(customTextPosition.y, AppState.currentImage.height);
            }
            setupCanvas();
            updateImageInfo();
            updateRotationDisplay();
            // El commit no termina hasta que el canvas visible refleja el
            // nuevo raster. Delegar aquí a updatePreview() dejaba el pintado
            // pendiente en RAF: export y pruebas podían observar revisión
            // nueva con píxeles antiguos.
            renderMainDocument({ cssFilters: 'full' });
            if (typeof ExportManager !== 'undefined' && ExportManager.scheduleEstimateUpdate) {
              ExportManager.scheduleEstimateUpdate();
            }
            if (typeof SessionManager !== 'undefined' && SessionManager.scheduleAutoSave) {
              SessionManager.scheduleAutoSave();
            }
          },
          onCommit: function() {
            if (typeof historyManager !== 'undefined' && !historyManager.isRestoring) {
              historyManager.saveState();
            }
          }
        });

        BatchUIManager.configure({
          batchManager,
          textLayerManager,
          openModal: _openAccessibleModal,
          closeModal: _closeAccessibleModal,
          showProgress: showProgressBar,
          updateProgress,
          hideProgress: hideProgressBar,
          simulateProgress: simulateProgressSteps
        });
        TextLayerUIManager.configure({
          textLayerManager,
          render: renderCanvasWithLayers,
          renderLightweight: renderCanvasWithLayersLightweight
        });
        SessionCoordinator.configure({
          textLayerManager,
          loadImage: loadImageWithValidation,
          updatePreview
        });

        // Inicializar Crop Manager con el canvas
        if (canvas) {
          cropManager = new CropManager(canvas);
        } else {
          MNEMOTAG_DEBUG && console.warn('⚠️ Canvas no disponible, CropManager no inicializado');
        }

        // Exponer referencias de debugging una vez creadas (hacerlo en tiempo
        // de evaluación del módulo las dejaba congeladas a null)
        window.keyboardShortcuts = keyboardShortcuts;
        window.batchManager = batchManager;
        window.textLayerManager = textLayerManager;
        window.cropManager = cropManager;

        // v3.7.0: reflejar capacidades del navegador en la UI (opciones de
        // formato no codificables, botón Compartir) y ofrecer restaurar la
        // sesión anterior si hay una guardada en IndexedDB.
        if (typeof Capabilities !== 'undefined') {
          Capabilities.applyToUI();
        }
        if (typeof SessionManager !== 'undefined') {
          SessionCoordinator.initialize();
        }

      } catch (error) {
        console.error('Error inicializando managers avanzados:', error);
      }
    }

    function setupKeyboardShortcuts() { EditorShortcutManager.setup(); }

    // ============================================
    // FUNCIONES DE INTEGRACIÓN UI v3.1
    // ============================================

    /** UI de lote delegada; estos wrappers conservan el contrato público. */
    function openBatchModal() { BatchUIManager.open(); }
    function closeBatchModal() { BatchUIManager.close(); }
    function clearBatchQueue() {
      BatchUIManager.clear();
      UIManager.showSuccess('Cola de imágenes vaciada');
    }
    function addBatchImages(files) { return BatchUIManager.addImages(files); }
    function processBatch() { return BatchUIManager.process(); }
    function downloadBatchZip() { return BatchUIManager.downloadZip(); }

    // BatchUIManager posee cola, validación, estados, reintentos y descarga.

    /** UI de capas delegada; wrappers para conservar contratos públicos. */
    function openTextLayersPanel() { TextLayerUIManager.open(); }
    function closeTextLayersPanel() { TextLayerUIManager.close(); }
    function applyTextTemplate(name) { return TextLayerUIManager.applyTemplate(name); }
    function addNewTextLayer() { return TextLayerUIManager.add(); }
    function updateTextLayersList() { TextLayerUIManager.updateList(); }
    function selectTextLayer(id) { TextLayerUIManager.select(id); }
    function updateActiveTextLayer() { return TextLayerUIManager.updateActive(); }
    function toggleLayerVisibility(id) { TextLayerUIManager.toggleVisibility(id); }
    function deleteActiveTextLayer() { TextLayerUIManager.removeActive(); }

    // Render ligero para el drag: solo imagen base + capas de texto.
    // Salta watermarks y filters (son pesados y causan interferencias
    // async con requestAnimationFrame durante el drag).
    function renderCanvasWithLayersLightweight() {
      renderMainDocument({ watermarks: false, cssFilters: 'none', textLayers: 'light' });
    }

    function renderCanvasWithLayers() {
      renderMainDocument({ watermarks: true, cssFilters: 'full', textLayers: 'full' });
    }

    /**
     * ====================================
     * CROP UI
     * ====================================
     */

    let cropActive = false;
    let cropDocumentId = null;
    let cropDocumentRevision = null;

    async function openCropPanel() {
      if (!currentImage) {
        UIManager.showError('Carga una imagen primero');
        return;
      }

      if (!cropManager) {
        console.error('❌ CropManager no inicializado');
        UIManager.showError('El sistema de recorte no está disponible');
        return;
      }

      await DocumentStateManager.waitForIdle();
      if (!AppState.currentImage) return;

      const panel = document.getElementById('crop-panel');
      if (panel) {
        // Evitar listeners duplicados si el botón se pulsa repetidamente.
        if (cropManager.isActive) cropManager.deactivate();
        panel.style.display = 'flex';
        requestAnimationFrame(() => panel.classList.add('active'));
        cropActive = true;

        // Inicializar crop mode
        cropDocumentId = AppState.documentId;
        cropDocumentRevision = AppState.documentRevision;
        cropManager.initCropMode(AppState.currentImage);

        // Actualizar info
        updateCropInfo();
      }
    }

    function closeCropPanel() {
      const panel = document.getElementById('crop-panel');
      if (panel) {
        panel.classList.remove('active');
        cropActive = false;
        cropDocumentId = null;
        cropDocumentRevision = null;
        if (cropManager) {
          cropManager.deactivate();
        }
        setTimeout(() => {
          if (!panel.classList.contains('active')) panel.style.display = 'none';
        }, 300);
      }
    }

    function changeCropAspectRatio() {
      const select = document.getElementById('crop-aspect-ratio');
      if (!select) return;

      if (!cropManager) return;

      // setAspectRatio espera la clave del preset ('free', '1:1', '16:9'...),
      // que coincide con los values del <select>.
      try {
        cropManager.setAspectRatio(select.value);
      } catch (error) {
        MNEMOTAG_DEBUG && console.warn('Proporción no válida:', select.value, error);
        return;
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
      const checkbox = document.getElementById('crop-show-grid');
      cropManager.showGrid = checkbox ? checkbox.checked : !cropManager.showGrid;

      // Redibujar si está activo
      if (cropManager.isActive) {
        cropManager.draw();
      }
    }

    function applyCropSuggestion(index) {
      if (!currentImage || !cropManager) return;

      try {
        const suggestions = cropManager.suggestCrops();
        const suggestion = suggestions[index];

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

    async function applyCrop() {
      try {
        await DocumentStateManager.waitForIdle();
        if (cropDocumentId !== AppState.documentId ||
            cropDocumentRevision !== AppState.documentRevision) {
          cropDocumentId = AppState.documentId;
          cropDocumentRevision = AppState.documentRevision;
          cropManager.initCropMode(AppState.currentImage);
          updateCropInfo();
          UIManager.showInfo('La imagen cambió. Revisa de nuevo el área de recorte.');
          return;
        }
        const result = cropManager.applyCrop();
        const committed = DocumentStateManager.commitRaster(result.canvas, {
          reason: 'crop',
          expectedDocumentId: cropDocumentId,
          expectedRevision: cropDocumentRevision,
          takeOwnership: true,
          updateOriginalDimensions: false,
          updateResetImage: true,
          rotation: 0,
          isFlippedHorizontally: false,
          isFlippedVertically: false,
          saveHistory: true
        });
        if (!committed) throw new Error('El documento cambió durante el recorte');
        closeCropPanel();
        UIManager.showSuccess('✅ Imagen recortada correctamente');
      } catch (error) {
        console.error('Error aplicando crop:', error);
        UIManager.showError('Error al recortar la imagen');
      }
    }

    function cancelCrop() {
      closeCropPanel();
      // Redibujar el preview completo (imagen + watermarks + filtros CSS)
      if (currentImage && canvas && ctx) {
        updatePreview();
      }
    }

    function openShortcutsModal() { EditorShortcutManager.openModal(); }
    function closeShortcutsModal() { EditorShortcutManager.closeModal(); }

    /**
     * ====================================
     * INICIALIZACIÓN UI
     * ====================================
     */

    function initializeAdvancedUI() {

      // Exponer funciones globalmente para onclick handlers
      window.openBatchModal = openBatchModal;
      window.closeBatchModal = closeBatchModal;
      window.clearBatchQueue = clearBatchQueue;
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

      TextLayerUIManager.initializeControls();

      // Event listener para aspect ratio
      const aspectRatioSelect = document.getElementById('crop-aspect-ratio');
      if (aspectRatioSelect) {
        aspectRatioSelect.addEventListener('change', changeCropAspectRatio);
      }

      const cropGridCheckbox = document.getElementById('crop-show-grid');
      if (cropGridCheckbox) {
        cropGridCheckbox.addEventListener('change', toggleCropGrid);
      }

    }

    // Comparación antes/después extraída a ComparisonManager (v3.7.1).
    function initializeComparisonMode() { ComparisonManager.initialize(); }
    function toggleComparisonMode() { ComparisonManager.toggle(); }


    // v3.7.1: debounce eliminado de main.js — era un duplicado byte a byte
    // del debounce canónico de js/utils/helpers.js (mismo ámbito de script).

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

    // v3.3.16 (registro) + v3.4.16 (skip en localhost):
    // Registrar Service Worker solo en PRODUCCIÓN. En dev local (VS Code
    // Live Server, python -m http.server, etc.) el SW interfiere con el
    // live reload del servidor y con el flujo de trabajo del desarrollador,
    // causando "reinicios" constantes de la app mientras se editan archivos.
    //
    // Además desregistramos activamente cualquier SW fantasma que haya
    // quedado de sesiones anteriores en localhost para limpiar el cache
    // en la siguiente recarga.
    if ('serviceWorker' in navigator) {
      const isLocalhost =
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.hostname === '0.0.0.0' ||
        location.hostname === '::1' ||
        location.hostname.endsWith('.localhost');

      if (isLocalhost) {
        // Desarrollo local: limpiar cualquier SW registrado de sesiones
        // anteriores. Evita que el cache viejo interfiera con Live Server.
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) {
            r.unregister().then((ok) => {
              if (ok) console.warn('[App] Service Worker desregistrado en localhost:', r.scope);
            });
          }
        }).catch(() => { /* defensivo */ });

        // También borrar los caches asociados al SW para dejar el entorno limpio.
        if (typeof caches !== 'undefined' && caches.keys) {
          caches.keys().then((names) => {
            names.filter((n) => n.startsWith('mnemotag-')).forEach((n) => caches.delete(n));
          }).catch(() => { /* defensivo */ });
        }
      } else {
        // Producción (GitHub Pages, etc.): registrar normalmente.
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./service-worker.js', { scope: './' })
            .then((reg) => {
              MNEMOTAG_DEBUG && console.warn('[App] Service Worker registrado:', reg.scope);
            })
            .catch((err) => {
              MNEMOTAG_DEBUG && console.warn('[App] Service Worker no se pudo registrar:', err);
            });
        });
      }
    }
