const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const { rm, mkdir, readdir, readFile, writeFile, copyFile } = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { minify } = require('html-minifier-terser');

// ============================================================
// Paths
// ============================================================

const DIST = 'dist';
const DIST_CSS = DIST + '/css';
const DIST_JS = DIST + '/js';
const DIST_IMAGES = DIST + '/images';
const SRC_IMAGES = 'images';

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

async function clean() {
  await rm(DIST, { recursive: true, force: true });
}

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
    .pipe(dest(DIST_JS));
}

function scssCompile() {
  return src('src/scss/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({ silenceDeprecations: ['legacy-js-api'] }).on('error', sass.logError))
    .pipe(cleanCSS({ level: 2 }))
    .pipe(rename('styles.css'))
    .pipe(sourcemaps.write('.'))
    .pipe(dest(DIST_CSS));
}

// ============================================================
// Images — copiar originales + generar WebP y AVIF
// ============================================================

const CONVERTIBLE_EXT = new Set(['.png', '.jpg', '.jpeg']);

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function images() {
  const files = await walkDir(SRC_IMAGES);
  let copied = 0;
  let converted = 0;

  for (const file of files) {
    const rel = path.relative(SRC_IMAGES, file);
    const destPath = path.join(DIST_IMAGES, rel);
    const destDir = path.dirname(destPath);
    await mkdir(destDir, { recursive: true });

    await copyFile(file, destPath);
    copied++;

    const ext = path.extname(file).toLowerCase();
    if (CONVERTIBLE_EXT.has(ext)) {
      const baseName = destPath.replace(/\.[^.]+$/, '');
      try {
        await sharp(file).webp({ quality: 80 }).toFile(baseName + '.webp');
        await sharp(file).avif({ quality: 65 }).toFile(baseName + '.avif');
        converted++;
      } catch (err) {
        console.error('sharp error on ' + rel + ':', err.message);
      }
    }
  }

  console.log('  ' + copied + ' copied, ' + converted + ' converted to WebP+AVIF');
}

// ============================================================
// HTML — index.html de producción (minificado, rutas relativas)
// ============================================================

async function html() {
  let content = await readFile('index.html', 'utf8');

  // Reescribir SOLO rutas locales: dist/X → X
  // No tocar URLs absolutas (CDN) que contengan dist/ en su path
  content = content.replace(/href="dist\//g, 'href="');
  content = content.replace(/src="dist\//g, 'src="');
  content = content.replace(/srcset="dist\//g, 'srcset="');

  // Eliminar comentarios HTML de desarrollo (excepto condicionales IE)
  // y el bloque CSP comment que es largo
  const minified = await minify(content, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    sortAttributes: true,
    sortClassName: true
  });

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'index.html'), minified, 'utf8');

  const saved = Math.round((1 - minified.length / content.length) * 100);
  console.log('  index.html: ' + content.length + ' → ' + minified.length + ' bytes (-' + saved + '%)');
}

// ============================================================
// Assets — Workers + Service Worker para dist/ autocontenido
// ============================================================

async function copyAssets() {
  // Workers (no se bundlean — los carga new Worker())
  await mkdir(path.join(DIST, 'js/workers'), { recursive: true });
  await copyFile('js/image-processor.js', path.join(DIST, 'js/image-processor.js'));
  await copyFile('js/workers/analysis-worker.js', path.join(DIST, 'js/workers/analysis-worker.js'));

  // Service Worker — reescribir rutas dist/ → rutas relativas
  let sw = await readFile('service-worker.js', 'utf8');
  sw = sw.replace(/\.\/dist\//g, './');
  await writeFile(path.join(DIST, 'service-worker.js'), sw, 'utf8');

  console.log('  workers + service-worker copied to dist/');
}

// ============================================================
// Watch
// ============================================================

function watchFiles() {
  watch(['js/**/*.js', '!' + DIST_JS + '/**'], jsBundle);
  watch('src/scss/**/*.scss', scssCompile);
  watch(SRC_IMAGES + '/**/*', images);
  watch('index.html', html);
}

// ============================================================
// Browser-Sync
// ============================================================

const browserSync = require('browser-sync').create();

function serve(cb) {
  browserSync.init({
    server: { baseDir: './' },
    port: 5507,
    open: false,
    notify: false,
    ghostMode: false,
    injectChanges: false,
    reloadOnRestart: false,
    watchEvents: []
  });
  cb();
}

function dev(cb) {
  browserSync.init({
    server: { baseDir: './' },
    port: 5507,
    open: false,
    notify: false,
    ghostMode: false,
    injectChanges: false,
    reloadOnRestart: false,
    watchEvents: []
  });
  watch(['js/**/*.js', '!' + DIST_JS + '/**'], jsBundle);
  watch('src/scss/**/*.scss', scssCompile);
  watch('index.html', html);
  cb();
}

// ============================================================
// Exports
// ============================================================

exports.clean = clean;
exports.js = jsBundle;
exports.scss = scssCompile;
exports.images = images;
exports.html = html;
exports.build = series(clean, parallel(jsBundle, scssCompile, images, html, copyAssets));
exports.watch = series(exports.build, watchFiles);
exports.serve = serve;
exports.dev = series(exports.build, dev);
exports.default = exports.build;
