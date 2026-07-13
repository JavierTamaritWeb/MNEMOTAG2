// =============================================================================
// MnemoTag — Specs de la fase v3.7.1 (arquitectura)
// =============================================================================
// Cubre la lógica testeable sin navegador real:
//   - AppState observable: subscribe/unsubscribe, notificación en setters,
//     comodín '*', aislamiento de listeners rotos, listenerCount
//   - Regresiones de fuente: main.js y los managers consumen AppState en los
//     puntos de mutación compartidos; el código muerto eliminado no vuelve
//
// El comportamiento de la app completa (render, drag de watermarks, export)
// se verifica en los E2E de Playwright.

async function fetchV371Source(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error('No se pudo cargar ' + path + ' (status ' + res.status + ')');
  }
  return res.text();
}

// Variables de estado "de main.js" simuladas para ejercitar la fachada.
// En la suite (Node y browser) main.js no se carga, así que las creamos como
// propiedades del objeto global: los typeof-guards de AppState las ven igual
// que a las let del ámbito de script de main.js.
window.outputQuality = 0.8;
window.outputFormat = 'jpeg';
window.customTextPosition = null;

describe('v3.7.1 — AppState observable', function () {
  it('el setter notifica a los suscriptores con (value, prev, key)', function () {
    window.outputQuality = 0.8;
    let received = null;
    const off = AppState.subscribe('outputQuality', function (value, prev, key) {
      received = { value: value, prev: prev, key: key };
    });
    AppState.outputQuality = 0.5;
    off();
    expect(received).not.toBe(null);
    expect(received.value).toBe(0.5);
    expect(received.prev).toBe(0.8);
    expect(received.key).toBe('outputQuality');
    expect(AppState.outputQuality).toBe(0.5);
  });

  it('no notifica si el valor no cambia (comparación estricta)', function () {
    window.outputFormat = 'png';
    let calls = 0;
    const off = AppState.subscribe('outputFormat', function () { calls++; });
    AppState.outputFormat = 'png'; // sin cambio
    AppState.outputFormat = 'webp'; // cambio
    off();
    expect(calls).toBe(1);
  });

  it("el comodín '*' recibe los cambios de cualquier clave", function () {
    const keys = [];
    const off = AppState.subscribe('*', function (value, prev, key) {
      keys.push(key);
    });
    AppState.outputQuality = 0.9;
    AppState.outputFormat = 'avif';
    AppState.customTextPosition = { x: 10, y: 20 };
    off();
    expect(keys.join(',')).toBe('outputQuality,outputFormat,customTextPosition');
  });

  it('unsubscribe deja de notificar y listenerCount refleja el estado', function () {
    const before = AppState.listenerCount('outputQuality');
    let calls = 0;
    const off = AppState.subscribe('outputQuality', function () { calls++; });
    expect(AppState.listenerCount('outputQuality')).toBe(before + 1);
    AppState.outputQuality = 0.31;
    off();
    AppState.outputQuality = 0.32;
    expect(calls).toBe(1);
    expect(AppState.listenerCount('outputQuality')).toBe(before);
  });

  it('un listener que lanza no rompe la mutación ni al resto de listeners', function () {
    let secondCalled = false;
    const off1 = AppState.subscribe('outputQuality', function () {
      throw new Error('listener roto');
    });
    const off2 = AppState.subscribe('outputQuality', function () {
      secondCalled = true;
    });
    AppState.outputQuality = 0.41;
    off1();
    off2();
    expect(secondCalled).toBe(true);
    expect(AppState.outputQuality).toBe(0.41);
  });

  it('subscribe con argumentos inválidos devuelve un no-op sin registrar nada', function () {
    const before = AppState.listenerCount();
    const off = AppState.subscribe(null, 'no-es-funcion');
    expect(typeof off).toBe('function');
    off(); // no debe lanzar
    expect(AppState.listenerCount()).toBe(before);
  });

  it('los setters de claves sin variable subyacente degradan sin lanzar', function () {
    // isDragging no existe en este contexto (main.js no está cargado)
    let notified = false;
    const off = AppState.subscribe('isDragging', function () { notified = true; });
    AppState.isDragging = true; // typeof-guard: no asigna ni notifica
    off();
    expect(AppState.isDragging).toBe(false); // default del getter
    expect(notified).toBe(false);
  });

  it('snapshot() incluye las claves nuevas de la fase v3.7.1', function () {
    const snap = AppState.snapshot();
    expect('isPositioningMode' in snap).toBe(true);
    expect('isTextPositioningMode' in snap).toBe(true);
    expect('isDragging' in snap).toBe(true);
    expect(snap.outputQuality).toBe(AppState.outputQuality);
  });
});

describe('v3.7.1 — regresiones de fuente (consumo de AppState y código muerto)', function () {
  it('main.js muta formato/calidad de salida vía AppState (setters observables)', async function () {
    const src = await fetchV371Source('../js/main.js');
    expect(src.includes('AppState.outputQuality =')).toBe(true);
    expect(src.includes('AppState.outputFormat =')).toBe(true);
  });

  it('history-manager captura y restaura las posiciones custom vía AppState', async function () {
    const src = await fetchV371Source('../js/managers/history-manager.js');
    expect(src.includes('AppState.customImagePosition')).toBe(true);
    expect(src.includes('AppState.customTextPosition')).toBe(true);
  });

  it('export-manager se suscribe a outputFormat/outputQuality para la estimación', async function () {
    const src = await fetchV371Source('../js/managers/export-manager.js');
    expect(src.includes("AppState.subscribe('outputFormat'")).toBe(true);
    expect(src.includes("AppState.subscribe('outputQuality'")).toBe(true);
  });

  it("session-manager se suscribe al comodín '*' para el autosave", async function () {
    const src = await fetchV371Source('../js/managers/session-manager.js');
    expect(src.includes("AppState.subscribe('*'")).toBe(true);
  });

  it('el código muerto eliminado en v3.7.1 no vuelve a main.js', async function () {
    const src = await fetchV371Source('../js/main.js');
    expect(src.includes('async function downloadImageEnhanced')).toBe(false);
    expect(src.includes('function measurePerformance')).toBe(false);
    expect(src.includes('function clearMetadata')).toBe(false);
    expect(src.includes('function loadImageFromFile')).toBe(false);
    // Los duplicados de helpers.js tampoco: debounce/formatFileSize canónicos
    expect(src.includes('function debounce(')).toBe(false);
    expect(src.includes('function formatFileSize(')).toBe(false);
  });

  it('preview, export y batch consumen DocumentRenderer', async function () {
    const main = await fetchV371Source('../js/main.js');
    const exportManager = await fetchV371Source('../js/managers/export-manager.js');
    const batchManager = await fetchV371Source('../js/managers/batch-manager.js');
    expect(main.includes('DocumentRenderer.renderDocument(')).toBe(true);
    expect(exportManager.includes('DocumentRenderer.renderDocument(')).toBe(true);
    expect(batchManager.includes('DocumentRenderer.renderDocument(')).toBe(true);
    expect(exportManager.includes('redrawCompleteCanvas()')).toBe(false);
    expect(main.includes('function renderDocument(')).toBe(false);
    expect(main.includes('function renderMainDocument(')).toBe(true);
  });

  it('main.js permanece por debajo de 5.000 líneas', async function () {
    const src = await fetchV371Source('../js/main.js');
    expect(src.split('\n').length < 5000).toBe(true);
  });

  it('los gestores compartidos consumen AppState', async function () {
    for (const path of [
      '../js/managers/export-manager.js',
      '../js/managers/history-manager.js',
      '../js/managers/zoom-pan-manager.js',
      '../js/managers/batch-manager.js'
    ]) {
      const src = await fetchV371Source(path);
      expect(src.includes('AppState.')).toBe(true);
    }
  });

  it('el PWA tiene un manifest canónico e iconos maskable dedicados', async function () {
    const html = await fetchV371Source('../index.html');
    const manifest = await fetchV371Source('../images/site.webmanifest');
    expect(html.includes('images/site.webmanifest?v=3.7.1')).toBe(true);
    expect(html.includes('favicon_io/site.webmanifest')).toBe(false);
    expect(manifest.includes('maskable-192x192.png')).toBe(true);
    expect(manifest.includes('maskable-512x512.png')).toBe(true);
    expect(manifest.includes('"purpose": "maskable"')).toBe(true);
  });
});
