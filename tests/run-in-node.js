// =============================================================================
// ImgCraft — Runner Node para los tests del browser
// =============================================================================
//
// Ejecuta toda la suite tests/specs/*.spec.js en Node con polyfills mínimos:
// - DOM stub (lo que tocan los managers en tiempo de carga es muy poco)
// - localStorage stub
// - fetch() polyfilleado con fs.readFileSync para que los tests de regresión
//   corran offline (resuelven los paths relativos a este script)
//
// Uso:
//   node tests/run-in-node.js
//
// El runner HTML del browser sigue siendo el principal — este script es
// un atajo para CI / inspección rápida desde la terminal, sin npm.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = __dirname;

// ---- Polyfills mínimos del entorno browser -------------------------------

// Stub barato de Element para evitar TypeError si algún manager toca el DOM
function makeStubElement() {
  const el = {
    style: {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
    dataset: {},
    children: [],
    childNodes: [],
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { return c; },
    replaceChildren() {},
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    },
    getContext() { return null; },
    toBlob(cb) { cb(null); },
    toDataURL() { return 'data:,'; },
  };
  return el;
}

const fakeStorage = new Map();

const sandbox = {};

Object.assign(sandbox, {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  Promise,
  Map,
  Set,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  TypeError,
  Symbol,
  performance: { now: () => Date.now() },
  navigator: {
    hardwareConcurrency: 4,
    geolocation: { getCurrentPosition() {} },
    userAgent: 'node-test',
  },

  document: {
    readyState: 'complete',
    body: makeStubElement(),
    documentElement: makeStubElement(),
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeStubElement(); },
    addEventListener() {},
    removeEventListener() {},
    fonts: { load: async () => {}, ready: Promise.resolve() },
  },

  localStorage: {
    getItem(k) { return fakeStorage.has(k) ? fakeStorage.get(k) : null; },
    setItem(k, v) { fakeStorage.set(k, String(v)); },
    removeItem(k) { fakeStorage.delete(k); },
    clear() { fakeStorage.clear(); },
  },

  // fetch polyfilleado con fs para los tests de regresión
  fetch(url) {
    // Resolver el path relativo al directorio del runner (tests/)
    const localPath = path.resolve(TESTS_DIR, url);
    try {
      const text = fs.readFileSync(localPath, 'utf8');
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(text),
      });
    } catch (err) {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      });
    }
  },

  // Si algún spec llama a runAllTests directamente, no debe explotar.
  // Lo sobrescribimos abajo después de cargar test-runner.js.
});

// window === global, como en el browser
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// ---- Cargador genérico de scripts dentro del sandbox -----------------------

function load(rel) {
  const file = path.resolve(ROOT, rel);
  const code = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: rel });
  } catch (err) {
    console.error(`✗ Error al cargar ${rel}:`, err.message);
    throw err;
  }
}

// ---- 1) Código de la app ---------------------------------------------------

load('js/utils/app-config.js');
load('js/utils/helpers.js');
load('js/utils/app-state.js');
load('js/managers/security-manager.js');
load('js/managers/metadata-manager.js');
load('js/managers/history-manager.js');
load('js/managers/preset-manager.js');
load('js/managers/analysis-manager.js');
load('js/managers/curves-manager.js');
load('js/managers/bg-removal-manager.js');
load('js/managers/export-manager.js');

// ---- 2) Test runner casero -------------------------------------------------

load('tests/test-runner.js');

// El test-runner del browser renderiza al DOM. Aquí lo sustituimos por una
// versión que escribe en consola y devuelve el resumen.
sandbox.runAllTests = async function () {
  // Acceder a las suites internas del runner: el módulo las guarda en una
  // closure, así que no podemos leerlas directamente. En su lugar, registramos
  // nuestras propias listas mediante un wrapper sobre describe/it. Pero el
  // runner ya las almacenó en el momento de cargar los specs, no podemos
  // re-registrarlas. Solución: instrumentar describe/it ANTES de cargar specs.
  throw new Error('runAllTests no debería llamarse directamente en Node');
};

// Reemplazar describe/it para registrar localmente y poder iterar luego
const localSuites = [];
let currentSuite = null;
sandbox.describe = function (name, fn) {
  const suite = { name, tests: [] };
  currentSuite = suite;
  try {
    fn();
  } catch (err) {
    suite.tests.push({ name: '<error en describe()>', fn: null, error: err });
  }
  localSuites.push(suite);
  currentSuite = null;
};
sandbox.it = function (name, fn) {
  if (!currentSuite) {
    throw new Error('it() llamado fuera de describe()');
  }
  currentSuite.tests.push({ name, fn });
};

// ---- 3) Specs --------------------------------------------------------------

const specs = [
  'tests/specs/app-config.spec.js',
  'tests/specs/helpers.spec.js',
  'tests/specs/security-manager.spec.js',
  'tests/specs/metadata-manager.spec.js',
  'tests/specs/history-manager.spec.js',
  'tests/specs/regression.spec.js',
];

for (const spec of specs) {
  load(spec);
}

// ---- 4) Ejecutar -----------------------------------------------------------

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

(async function main() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  const startedAt = Date.now();

  for (const suite of localSuites) {
    console.log(`\n${YELLOW}● ${suite.name}${RESET}`);
    for (const test of suite.tests) {
      if (test.error) {
        console.log(`  ${RED}✗ ${test.name}${RESET}`);
        console.log(`    ${DIM}${test.error.message}${RESET}`);
        failures.push({ suite: suite.name, test: test.name, error: test.error.message });
        failed++;
        continue;
      }

      try {
        const result = test.fn();
        if (result && typeof result.then === 'function') {
          await result;
        }
        console.log(`  ${GREEN}✓${RESET} ${test.name}`);
        passed++;
      } catch (err) {
        console.log(`  ${RED}✗ ${test.name}${RESET}`);
        const msg = err && err.message ? err.message : String(err);
        console.log(`    ${DIM}${msg}${RESET}`);
        failures.push({ suite: suite.name, test: test.name, error: msg });
        failed++;
      }
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  const total = passed + failed;

  console.log('\n' + '─'.repeat(60));
  if (failed === 0) {
    console.log(`${GREEN}✓ ${passed}/${total} tests OK${RESET} · ${elapsed}s`);
  } else {
    console.log(`${RED}✗ ${failed} fallos${RESET} / ${GREEN}${passed} OK${RESET} / ${total} totales · ${elapsed}s`);
    console.log('\nFallos:');
    for (const f of failures) {
      console.log(`  • [${f.suite}] ${f.test}`);
      console.log(`    ${DIM}${f.error}${RESET}`);
    }
  }

  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Error fatal en el runner:', err);
  process.exit(2);
});
