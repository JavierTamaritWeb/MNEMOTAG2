const { src, dest, series, parallel, watch } = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const { rm, mkdir, readdir, readFile, writeFile, copyFile } = require('fs/promises');
const { existsSync } = require('fs');
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
  'js/managers/workspace-manager.js',
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

// Bundle rápido para desarrollo: concat + sourcemaps SIN terser.
// Genera el mismo app.min.js (mismo nombre para que index.html no cambie),
// pero tarda milisegundos en lugar de segundos. Solo lo usa el watcher;
// `npm run build` sigue usando jsBundle (con terser) para producción.
function jsBundleDev() {
  return src(JS_FILES)
    .pipe(sourcemaps.init())
    .pipe(concat('app.min.js'))
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
// Tailwind purgado (v3.6.0) — sustituye los 2.93 MB del CDN
// ============================================================
// Purga node_modules/tailwindcss/dist/tailwind.min.css contra index.html y
// js/**/*.js (las clases construidas en JS aparecen como string literals,
// que el extractor de PurgeCSS tokeniza). Salida: dist/css/tailwind.min.css
// (~10-20 KB gzip frente a 294 KB gzip del CDN, y sin render-blocking externo).

async function tailwindPurge() {
  const { PurgeCSS } = require('purgecss');
  const results = await new PurgeCSS().purge({
    content: ['index.html', 'js/**/*.js'],
    css: ['node_modules/tailwindcss/dist/tailwind.min.css'],
    // Extractor estándar para Tailwind v2: captura clases con ':', '/', '.'
    defaultExtractor: (content) => content.match(/[\w-/:%.]+(?<!:)/g) || [],
    safelist: {
      // Estados aplicados por JS que podrían escapar al extractor
      standard: ['hidden', 'ring-2', 'ring-blue-500'],
      // Variantes de color calculadas (compatibilityClass y afines)
      deep: [],
      greedy: [/^text-(green|blue|orange|red)-600$/]
    }
  });
  await mkdir(DIST_CSS, { recursive: true });
  await writeFile(path.join(DIST_CSS, 'tailwind.min.css'), results[0].css);
  const kb = Math.round(results[0].css.length / 1024);
  console.log(`  tailwind.min.css purgado: ${kb} KB (original: 2866 KB)`);
}

// ============================================================
// Font Awesome subset (v3.6.0) — sustituye los ~170 KB de cdnjs
// ============================================================
// Escanea index.html + js/**/*.js buscando clases fa-*, resuelve alias contra
// el metadata oficial de @fortawesome/fontawesome-free, genera el woff2 solo
// con esos glifos (fontawesome-subset) y un CSS mínimo con @font-face + los
// ::before de cada icono. La app solo usa el estilo solid (fas).

const FA_MODIFIERS = new Set([
  'solid', 'regular', 'brands', 'spin', 'pulse', 'fw', 'lg', 'sm', 'xs',
  '2x', '3x', '4x', '5x', 'stack', 'inverse', 'border', 'pull-left', 'pull-right'
]);

async function scanFaIcons() {
  const sources = ['index.html'];
  const jsFiles = (await walkDir('js')).filter(f => f.endsWith('.js'));
  sources.push(...jsFiles);

  const found = new Set();
  for (const file of sources) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/\bfa-([a-z0-9][a-z0-9-]*)\b/g)) {
      if (!FA_MODIFIERS.has(match[1])) found.add(match[1]);
    }
  }
  return [...found].sort();
}

async function fontawesomeSubsetTask() {
  const { fontawesomeSubset } = require('fontawesome-subset');
  // FA 6.4.0 publica el metadata como icon-families.json:
  // { nombre: { unicode, aliases: { names: [...] }, familyStylesByLicense: { free: [{style}] } } }
  const iconsMeta = JSON.parse(
    await readFile('node_modules/@fortawesome/fontawesome-free/metadata/icon-families.json', 'utf8')
  );

  const hasFreeSolid = (meta) =>
    ((meta.familyStylesByLicense && meta.familyStylesByLicense.free) || [])
      .some(fs => fs.style === 'solid');

  // Índice de alias → nombre canónico
  const aliasIndex = new Map();
  for (const [name, meta] of Object.entries(iconsMeta)) {
    aliasIndex.set(name, name);
    const aliases = (meta.aliases && meta.aliases.names) || [];
    for (const alias of aliases) aliasIndex.set(alias, name);
  }

  const requested = await scanFaIcons();
  const canonical = new Set();
  const cssRules = [];
  const unknown = [];

  for (const name of requested) {
    const target = aliasIndex.get(name);
    if (!target || !hasFreeSolid(iconsMeta[target])) {
      unknown.push(name);
      continue;
    }
    canonical.add(target);
    cssRules.push(`.fa-${name}::before{content:"\\${iconsMeta[target].unicode}"}`);
  }

  if (unknown.length) {
    console.warn('  ⚠️ Iconos fa-* sin glifo solid en FA 6.4 (revisar):', unknown.join(', '));
  }

  await mkdir(DIST + '/webfonts', { recursive: true });
  await fontawesomeSubset({ solid: [...canonical] }, DIST + '/webfonts', {
    targetFormats: ['woff2']
  });

  const css = [
    '/* Font Awesome 6.4.0 Free (subset MnemoTag v3.6.0) — https://fontawesome.com',
    '   License: https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1) */',
    `@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:block;src:url("../webfonts/fa-solid-900.woff2") format("woff2")}`,
    `.fa,.fas,.fa-solid{font-family:"Font Awesome 6 Free";font-weight:900;-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;line-height:1;text-rendering:auto}`,
    cssRules.join('\n')
  ].join('\n');

  await mkdir(DIST_CSS, { recursive: true });
  await writeFile(path.join(DIST_CSS, 'fontawesome.min.css'), css);
  console.log(`  fontawesome.min.css: ${canonical.size} iconos, ${Math.round(css.length / 1024)} KB CSS`);
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

// Procesa UNA imagen: copia a dist/ y, si es PNG/JPEG, genera variantes
// WebP + AVIF — salvo que esas variantes ya existan en el árbol fuente
// (p. ej. images/applicacion.webp/.avif están versionadas), en cuyo caso
// la copia directa ya las lleva a dist/ y no hay que regenerarlas
// (regenerarlas provocaría además una carrera con la copia según el orden
// de recorrido). Devuelve true si hubo conversión con sharp.
async function processImageFile(file) {
  const rel = path.relative(SRC_IMAGES, file);
  const destPath = path.join(DIST_IMAGES, rel);
  await mkdir(path.dirname(destPath), { recursive: true });

  await copyFile(file, destPath);

  const ext = path.extname(file).toLowerCase();
  if (!CONVERTIBLE_EXT.has(ext)) return false;

  const srcBase = file.replace(/\.[^.]+$/, '');
  const destBase = destPath.replace(/\.[^.]+$/, '');
  let converted = false;
  try {
    if (!existsSync(srcBase + '.webp')) {
      await sharp(file).webp({ quality: 80 }).toFile(destBase + '.webp');
      converted = true;
    }
    if (!existsSync(srcBase + '.avif')) {
      await sharp(file).avif({ quality: 65 }).toFile(destBase + '.avif');
      converted = true;
    }
  } catch (err) {
    console.error('sharp error on ' + rel + ':', err.message);
  }
  return converted;
}

async function images() {
  const files = await walkDir(SRC_IMAGES);
  let copied = 0;
  let converted = 0;

  for (const file of files) {
    if (await processImageFile(file)) converted++;
    copied++;
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
  await mkdir(path.join(DIST, 'js/vendor'), { recursive: true });
  await copyFile('js/image-processor.js', path.join(DIST, 'js/image-processor.js'));
  await copyFile('js/workers/analysis-worker.js', path.join(DIST, 'js/workers/analysis-worker.js'));
  await copyFile('js/vendor/piexif.min.js', path.join(DIST, 'js/vendor/piexif.min.js'));

  // Service Worker — reescribir rutas dist/ → rutas relativas
  let sw = await readFile('service-worker.js', 'utf8');
  sw = sw.replace(/\.\/dist\//g, './');
  await writeFile(path.join(DIST, 'service-worker.js'), sw, 'utf8');

  console.log('  workers + vendor assets + service-worker copied to dist/');
}

// ============================================================
// Watch — espera cambios y recompila automáticamente
// ============================================================

const browserSync = require('browser-sync').create();

function setupWatchers() {
  // JS: cualquier .js en js/ (excepto dist/) → rebundle rápido (sin terser)
  watch(
    ['js/**/*.js', '!' + DIST + '/**'],
    series(jsBundleDev, copyAssets)
  ).on('change', (file) => console.log('  JS changed: ' + file));

  // SCSS: cualquier .scss en src/scss/ → recompilar CSS
  watch(
    'src/scss/**/*.scss',
    scssCompile
  ).on('change', (file) => console.log('  SCSS changed: ' + file));

  // Imágenes: procesado INCREMENTAL — solo el archivo añadido/cambiado
  // se copia y convierte, en vez de recorrer todo images/.
  const onImageChange = (file) => {
    console.log('  Image changed: ' + file);
    processImageFile(file).catch((err) =>
      console.error('  image error: ' + err.message)
    );
  };
  const imageWatcher = watch(SRC_IMAGES + '/**/*');
  imageWatcher.on('change', onImageChange);
  imageWatcher.on('add', onImageChange);

  // HTML: index.html → regenerar dist/index.html minificado
  watch(
    'index.html',
    html
  ).on('change', () => console.log('  index.html changed'));

  // Service Worker: regenerar copia en dist/
  watch(
    'service-worker.js',
    copyAssets
  ).on('change', () => console.log('  service-worker.js changed'));

  console.log('\n  Watching for changes...\n');
}

// Solo watch (sin servidor)
function watchOnly(cb) {
  setupWatchers();
  cb();
}

// Servidor estático (sin watch)
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

// Dev: build + watch + servidor
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
  setupWatchers();
  cb();
}

// ============================================================
// Exports
// ============================================================

exports.clean = clean;
exports.js = jsBundle;
exports.jsDev = jsBundleDev;
exports.scss = scssCompile;
exports.tailwind = tailwindPurge;
exports.fontawesome = fontawesomeSubsetTask;
exports.images = images;
exports.html = html;
exports.build = series(clean, parallel(jsBundle, scssCompile, tailwindPurge, fontawesomeSubsetTask, images, html, copyAssets));
exports.watch = series(exports.build, watchOnly);
exports.serve = serve;
exports.dev = series(exports.build, dev);
exports.default = exports.dev;
