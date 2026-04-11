const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');

// SCSS se añadirá en Fase 2 — por ahora solo JS bundling.
// const sass = require('gulp-sass')(require('sass'));
// const cleanCSS = require('gulp-clean-css');
// const rename = require('gulp-rename');

// ============================================================
// JS Bundle — Orden EXACTO de concatenación (dependencias)
// ============================================================
// CRÍTICO: este orden replica el de los <script> en index.html.
// Si se añade un nuevo manager, insertarlo en la posición correcta.

const JS_FILES = [
  // Utils (base — sin dependencias entre sí)
  'js/utils/app-config.js',
  'js/utils/helpers.js',
  'js/utils/app-state.js',
  'js/utils/smart-debounce.js',
  'js/utils/filter-cache.js',
  'js/utils/fallback-processor.js',
  'js/utils/keyboard-shortcuts.js',

  // Managers (dependen de utils y entre sí en este orden)
  'js/managers/security-manager.js',
  'js/managers/worker-manager.js',
  'js/managers/history-manager.js',
  'js/managers/metadata-manager.js',
  'js/managers/filter-loading-manager.js',
  'js/managers/filter-manager.js',
  'js/managers/ui-manager.js',
  'js/managers/batch-manager.js',
  'js/managers/text-layer-manager.js',
  'js/managers/crop-manager.js',
  'js/managers/preset-manager.js',
  'js/managers/analysis-manager.js',
  'js/managers/curves-manager.js',
  'js/managers/bg-removal-manager.js',
  'js/managers/export-manager.js',

  // Punto de entrada (instancia los managers y conecta todo)
  'js/main.js'
];

// NO bundlear (son Web Workers / Service Worker — se ejecutan en su
// propio thread y necesitan ser archivos standalone):
//   js/image-processor.js
//   js/workers/analysis-worker.js
//   service-worker.js

// ============================================================
// Tasks
// ============================================================

function jsBundle() {
  return src(JS_FILES)
    .pipe(sourcemaps.init())
    .pipe(concat('app.min.js'))
    .pipe(terser({
      mangle: false,       // NO renombrar variables — rompe los globals
      compress: {
        drop_console: false // mantener console.warn/error
      },
      format: {
        comments: false     // quitar comentarios
      }
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('js/'));
}

// SCSS task — placeholder para Fase 2
// function scssCompile() {
//   return src('src/scss/main.scss')
//     .pipe(sourcemaps.init())
//     .pipe(sass().on('error', sass.logError))
//     .pipe(cleanCSS())
//     .pipe(rename('styles.css'))
//     .pipe(sourcemaps.write('.'))
//     .pipe(dest('css/'));
// }

function watchFiles() {
  watch(
    ['js/**/*.js', '!js/app.min.js', '!js/app.min.js.map'],
    jsBundle
  );
  // Fase 2: watch('src/scss/**/*.scss', scssCompile);
}

exports.js = jsBundle;
// exports.scss = scssCompile;
exports.build = jsBundle; // Fase 2: parallel(jsBundle, scssCompile)
exports.watch = series(exports.build, watchFiles);
exports.default = exports.build;
