// ESLint 9 flat config para ImgCraft
// Sin package.json en el repo — se ejecuta vía `npx --yes eslint` en CI.
// Reglas conservadoras: solo marcamos como `error` los bugs reales.
// Los estilos y preferencias van como `warn` o están desactivados.

// Globals compartidos por browser y Node
const COMMON_GLOBALS = {
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  globalThis: 'readonly',
  Promise: 'readonly',
  Symbol: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  WeakMap: 'readonly',
  WeakSet: 'readonly',
  Proxy: 'readonly',
  Reflect: 'readonly',
  Uint8Array: 'readonly',
  Uint8ClampedArray: 'readonly',
  Uint16Array: 'readonly',
  Uint32Array: 'readonly',
  Int8Array: 'readonly',
  Int16Array: 'readonly',
  Int32Array: 'readonly',
  Float32Array: 'readonly',
  Float64Array: 'readonly',
  DataView: 'readonly',
  ArrayBuffer: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  atob: 'readonly',
  btoa: 'readonly'
};

// Globals del DOM browser + app
const BROWSER_GLOBALS = {
  ...COMMON_GLOBALS,
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'writable', // writable porque el runner Node lo polyfill-ea
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestIdleCallback: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  performance: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  Image: 'readonly',
  HTMLCanvasElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLElement: 'readonly',
  Element: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  Worker: 'readonly',
  SharedWorker: 'readonly',
  OffscreenCanvas: 'readonly',
  createImageBitmap: 'readonly',
  ImageBitmap: 'readonly',
  ImageData: 'readonly',
  ClipboardItem: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  getComputedStyle: 'readonly',
  // App managers globales
  AppConfig: 'readonly',
  SecurityManager: 'readonly',
  WorkerManager: 'readonly',
  historyManager: 'readonly',
  MetadataManager: 'readonly',
  FilterLoadingManager: 'readonly',
  FilterManager: 'readonly',
  UIManager: 'readonly',
  BatchManager: 'readonly',
  TextLayerManager: 'readonly',
  CropManager: 'readonly',
  AnalysisManager: 'readonly',
  CurvesManager: 'readonly',
  BgRemovalManager: 'readonly',
  ExportManager: 'readonly',
  PresetManager: 'readonly',
  AppState: 'readonly',
  FormValidator: 'readonly',
  KeyboardShortcutManager: 'readonly',
  SmartDebounce: 'readonly',
  FilterCache: 'readonly',
  FallbackProcessor: 'readonly',
  // Helpers y funciones globales de main.js / helpers.js
  crc32: 'readonly',
  debounce: 'readonly',
  throttle: 'readonly',
  formatFileSize: 'readonly',
  formatNumber: 'readonly',
  canvasToBlob: 'readonly',
  flattenCanvasForJpeg: 'readonly',
  getFileExtension: 'readonly',
  getMimeType: 'readonly',
  sanitizeFileBaseName: 'readonly',
  extractFileBaseName: 'readonly',
  updateFilenamePreview: 'readonly',
  determineFallbackFormat: 'readonly',
  hasImageAlphaChannel: 'readonly',
  supportsEncode: 'readonly',
  applyFilters: 'readonly',
  immediatePreviewUpdate: 'readonly',
  debouncedUpdatePreview: 'readonly',
  debouncedSaveHistory: 'readonly',
  toggleWatermarkType: 'readonly',
  generateAutoCopyright: 'readonly',
  // Variables let/var de main.js accesibles desde otros scripts
  canvas: 'writable',
  ctx: 'writable',
  currentImage: 'writable',
  currentFile: 'writable',
  fileBaseName: 'writable',
  originalWidth: 'writable',
  originalHeight: 'writable',
  customImagePosition: 'writable',
  customTextPosition: 'writable',
  outputFormat: 'writable',
  outputQuality: 'writable',
  showPositioningBorders: 'writable',
  lastDownloadDirectory: 'writable',
  // Funciones globales de main.js que usan los managers extraídos
  showError: 'readonly',
  showSuccess: 'readonly',
  showProgressBar: 'readonly',
  hideProgressBar: 'readonly',
  simulateProgressSteps: 'readonly',
  getFlattenColor: 'readonly',
  redrawCompleteCanvas: 'readonly',
  // Compartido con los managers para commonjs require
  module: 'readonly',
  keyboardShortcuts: 'readonly',
  smartDebounce: 'readonly',
  filterCache: 'readonly',
  fallbackProcessor: 'readonly',
  // Librerías CDN
  piexif: 'readonly',
  JSZip: 'readonly',
  heic2any: 'readonly'
};

// Globals del Service Worker
const SW_GLOBALS = {
  ...COMMON_GLOBALS,
  self: 'readonly',
  caches: 'readonly',
  clients: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  Cache: 'readonly',
  CacheStorage: 'readonly',
  navigator: 'readonly',
  location: 'readonly'
};

// Globals de Node (tests runners)
const NODE_GLOBALS = {
  ...COMMON_GLOBALS,
  process: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly'
};

// Globals del test runner casero (describe/it/expect se definen en test-runner.js)
const TEST_RUNNER_GLOBALS = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  // En los specs de browser también están disponibles los globals del browser
  fetch: 'readonly',
  SecurityManager: 'readonly',
  MetadataManager: 'readonly',
  historyManager: 'readonly',
  AppConfig: 'readonly',
  // Los specs usan helpers globales
  crc32: 'readonly',
  formatFileSize: 'readonly',
  canvasToBlob: 'readonly',
  flattenCanvasForJpeg: 'readonly',
  getFileExtension: 'readonly',
  getMimeType: 'readonly',
  sanitizeFileBaseName: 'readonly'
};

// Reglas base — estrictas solo para bugs reales
const BASE_RULES = {
  // Bugs reales — nivel error
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-func-assign': 'error',
  'no-invalid-regexp': 'error',
  'no-obj-calls': 'error',
  'no-sparse-arrays': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-compare-neg-zero': 'error',
  'no-ex-assign': 'error',
  'no-fallthrough': 'error',
  'no-self-assign': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',

  // Mejores prácticas — nivel warn para no romper CI con deuda existente
  'eqeqeq': ['warn', 'smart'],
  'no-var': 'warn',
  'prefer-const': ['warn', { destructuring: 'all', ignoreReadBeforeAssign: true }],
  'no-unused-vars': ['warn', {
    args: 'none',
    varsIgnorePattern: '^_',
    argsIgnorePattern: '^_',
    caughtErrors: 'none'
  }],
  'no-undef': 'warn', // warn en lugar de error — evita romper CI si falta algún global

  // Desactivadas — el código existente las viola por diseño histórico
  'no-console': 'off',
  'no-empty': 'off',
  'no-prototype-builtins': 'off',
  'no-inner-declarations': 'off',
  'no-useless-escape': 'off',
  'no-case-declarations': 'off',
  'no-constant-condition': 'off',
  'no-redeclare': 'off'
};

export default [
  // Browser scripts (main.js, utils, managers)
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: BROWSER_GLOBALS
    },
    rules: BASE_RULES
  },
  // Service Worker
  {
    files: ['service-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: SW_GLOBALS
    },
    rules: BASE_RULES
  },
  // Test runners Node
  {
    files: ['tests/run-in-node.js', 'tests/binary-validation.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: NODE_GLOBALS
    },
    rules: BASE_RULES
  },
  // Specs del browser (se ejecutan en el runner casero con globals mixtos)
  {
    files: ['tests/specs/**/*.js', 'tests/test-runner.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...BROWSER_GLOBALS, ...TEST_RUNNER_GLOBALS }
    },
    rules: BASE_RULES
  }
];
