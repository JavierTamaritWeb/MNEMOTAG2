// =============================================================================
// ImgCraft - Mini test runner casero (sin dependencias, sin npm)
// =============================================================================
//
// Uso:
//   1. Sirve la raíz del proyecto con un servidor HTTP (Live Server, port 5505).
//   2. Abre http://localhost:5505/tests/index.html
//   3. Mira los resultados en pantalla.
//
// API expuesta:
//   describe(name, fn)         - Agrupa tests bajo un título
//   it(name, fn)               - Define un test (sync o async)
//   expect(value)              - Devuelve un objeto con matchers
//
// Matchers disponibles:
//   .toBe(expected)            - ===
//   .toEqual(expected)         - igualdad estructural (JSON.stringify)
//   .toBeTruthy()              - !!value
//   .toBeFalsy()               - !value
//   .toBeNull()                - === null
//   .toBeUndefined()           - === undefined
//   .toBeDefined()             - !== undefined
//   .toContain(substring)      - String.includes / Array.includes
//   .toMatch(regex)            - regex.test
//   .toBeGreaterThan(n)        - > n
//   .toBeLessThan(n)           - < n
//   .toBeInstanceOf(Class)     - instanceof
//   .toThrow()                 - función lanza error al invocarla
//   .not.<matcher>             - niega cualquiera de los anteriores
// =============================================================================

(function () {
  'use strict';

  const suites = [];
  let currentSuite = null;

  // ---- API pública -----------------------------------------------------------

  window.describe = function (name, fn) {
    const suite = { name: name, tests: [] };
    currentSuite = suite;
    try {
      fn();
    } catch (err) {
      suite.tests.push({
        name: '<error al definir la suite>',
        status: 'failed',
        error: err && err.message ? err.message : String(err),
      });
    }
    suites.push(suite);
    currentSuite = null;
  };

  window.it = function (name, fn) {
    if (!currentSuite) {
      throw new Error('it() llamado fuera de un describe()');
    }
    currentSuite.tests.push({ name: name, fn: fn, status: 'pending' });
  };

  window.expect = function (actual) {
    return makeExpect(actual, false);
  };

  // ---- Matchers --------------------------------------------------------------

  function makeExpect(actual, negated) {
    const api = {};

    function check(condition, message) {
      const pass = negated ? !condition : condition;
      if (!pass) {
        throw new Error(message);
      }
    }

    api.toBe = function (expected) {
      check(
        actual === expected,
        `esperaba ${format(actual)} ${negated ? 'NO ' : ''}=== ${format(expected)}`
      );
    };

    api.toEqual = function (expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      check(a === b, `esperaba ${a} ${negated ? 'NO ' : ''}== ${b}`);
    };

    api.toBeTruthy = function () {
      check(!!actual, `esperaba que ${format(actual)} fuera ${negated ? 'falsy' : 'truthy'}`);
    };

    api.toBeFalsy = function () {
      check(!actual, `esperaba que ${format(actual)} fuera ${negated ? 'truthy' : 'falsy'}`);
    };

    api.toBeNull = function () {
      check(actual === null, `esperaba ${format(actual)} ${negated ? 'NO ' : ''}=== null`);
    };

    api.toBeUndefined = function () {
      check(
        actual === undefined,
        `esperaba ${format(actual)} ${negated ? 'NO ' : ''}=== undefined`
      );
    };

    api.toBeDefined = function () {
      check(
        actual !== undefined,
        `esperaba ${format(actual)} ${negated ? 'NO ' : ''}!== undefined`
      );
    };

    api.toContain = function (sub) {
      let contains = false;
      if (typeof actual === 'string') {
        contains = actual.indexOf(sub) !== -1;
      } else if (Array.isArray(actual)) {
        contains = actual.indexOf(sub) !== -1;
      }
      check(
        contains,
        `esperaba que ${format(actual)} ${negated ? 'NO ' : ''}contuviera ${format(sub)}`
      );
    };

    api.toMatch = function (regex) {
      check(
        regex.test(String(actual)),
        `esperaba que ${format(actual)} ${negated ? 'NO ' : ''}coincidiera con ${regex}`
      );
    };

    api.toBeGreaterThan = function (n) {
      check(actual > n, `esperaba ${format(actual)} ${negated ? 'NO ' : ''}> ${n}`);
    };

    api.toBeLessThan = function (n) {
      check(actual < n, `esperaba ${format(actual)} ${negated ? 'NO ' : ''}< ${n}`);
    };

    api.toBeInstanceOf = function (Class) {
      check(
        actual instanceof Class,
        `esperaba ${format(actual)} ${negated ? 'NO ' : ''}instanceof ${Class.name || Class}`
      );
    };

    api.toThrow = function () {
      let threw = false;
      try {
        if (typeof actual === 'function') actual();
      } catch (e) {
        threw = true;
      }
      check(threw, `esperaba que la función ${negated ? 'NO ' : ''}lanzara`);
    };

    Object.defineProperty(api, 'not', {
      get: function () {
        return makeExpect(actual, !negated);
      },
    });

    return api;
  }

  function format(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'function') return '<function>';
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    try {
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  }

  // ---- Runner ----------------------------------------------------------------

  window.runAllTests = async function () {
    const root = document.getElementById('test-results');
    if (!root) {
      console.error('No se encontró #test-results en el DOM');
      return;
    }
    root.innerHTML = '';

    const summary = { passed: 0, failed: 0, total: 0 };
    const startedAt = performance.now();

    for (const suite of suites) {
      const suiteEl = document.createElement('section');
      suiteEl.className = 'suite';

      const title = document.createElement('h2');
      title.textContent = suite.name;
      suiteEl.appendChild(title);

      const list = document.createElement('ul');
      suiteEl.appendChild(list);
      root.appendChild(suiteEl);

      for (const test of suite.tests) {
        const li = document.createElement('li');
        li.className = 'test';

        if (test.status === 'failed' && test.error) {
          // Error en la propia definición de la suite
          li.classList.add('failed');
          li.textContent = '✗ ' + test.name;
          const err = document.createElement('pre');
          err.className = 'error';
          err.textContent = test.error;
          li.appendChild(err);
          summary.failed++;
          summary.total++;
          list.appendChild(li);
          continue;
        }

        try {
          const result = test.fn();
          if (result && typeof result.then === 'function') {
            await result;
          }
          li.classList.add('passed');
          li.textContent = '✓ ' + test.name;
          summary.passed++;
        } catch (err) {
          li.classList.add('failed');
          li.textContent = '✗ ' + test.name;
          const pre = document.createElement('pre');
          pre.className = 'error';
          pre.textContent = (err && err.message) || String(err);
          li.appendChild(pre);
          summary.failed++;
        }
        summary.total++;
        list.appendChild(li);
      }
    }

    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(2);
    const summaryEl = document.getElementById('test-summary');
    if (summaryEl) {
      summaryEl.textContent =
        summary.failed === 0
          ? `✓ ${summary.passed}/${summary.total} tests OK · ${elapsed}s`
          : `✗ ${summary.failed} fallos / ${summary.passed} OK / ${summary.total} totales · ${elapsed}s`;
      summaryEl.className = summary.failed === 0 ? 'summary ok' : 'summary fail';
    }
  };
})();
