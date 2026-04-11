const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');

// ============================================================
// JS Bundle — Orden EXACTO de concatenación (dependencias)
// ============================================================

const JS_FILES = [
  'js/utils/app-config.js',
  'js/utils/helpers.js',
  'js/utils/app-state.js',
  'js/utils/smart-debounce.js',
  'js/utils/filter-cache.js',
  'js/utils/fallback-processor.js',
  'js/utils/keyboard-shortcuts.js',
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
  'js/managers/zoom-pan-manager.js',
  'js/main.js'
];

// ============================================================
// Tasks
// ============================================================

function jsBundle() {
  return src(JS_FILES)
    .pipe(sourcemaps.init())
    .pipe(concat('app.min.js'))
    .pipe(terser({
      mangle: false,
      compress: { drop_console: false },
      format: { comments: false }
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('js/'));
}

function scssCompile() {
  return src('src/scss/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({ silenceDeprecations: ['legacy-js-api'] }).on('error', sass.logError))
    .pipe(cleanCSS({ level: 2 }))
    .pipe(rename('styles.css'))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('css/'));
}

function watchFiles() {
  watch(['js/**/*.js', '!js/app.min.js', '!js/app.min.js.map'], jsBundle);
  watch('src/scss/**/*.scss', scssCompile);
}

exports.js = jsBundle;
exports.scss = scssCompile;
exports.build = parallel(jsBundle, scssCompile);
exports.watch = series(exports.build, watchFiles);
exports.default = exports.build;
