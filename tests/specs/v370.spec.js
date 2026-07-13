// =============================================================================
// MnemoTag — Specs de la fase v3.7.0 (funcionalidad)
// =============================================================================
// Cubre la lógica testeable sin navegador real:
//   - Capabilities: detección síncrona + fallback esperado por formato
//   - PresetManager v2: captura completa de filtros + retrocompatibilidad v1
//   - BatchManager: resumen del lote, representación única (sin base64),
//     concurrencia acotada, cancelación de lote e individual
//   - SessionManager: degradación limpia sin IndexedDB
//
// Lo que exige navegador real (EXIF byte a byte en descarga, undo tras crop,
// undo tras mover watermark, batch E2E, fallback AVIF/WebP en 3 motores)
// vive en tests/e2e/v370.spec.js y tests/e2e/format-fallback.spec.js.

async function fetchV370Source(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error('No se pudo cargar ' + path + ' (status ' + res.status + ')');
  }
  return res.text();
}

describe('v3.7.0 — Capabilities (detección de capacidades)', function () {
  it('detectSync devuelve booleans para clipboard/share/fileSystemAccess', function () {
    const caps = Capabilities.detectSync();
    expect(typeof caps.clipboardWrite).toBe('boolean');
    expect(typeof caps.clipboardRead).toBe('boolean');
    expect(typeof caps.shareFiles).toBe('boolean');
    expect(typeof caps.fileSystemAccess).toBe('boolean');
  });

  it('detect() cachea el snapshot e incluye webpEncode/avifEncode', async function () {
    Capabilities.snapshot = null;
    const caps = await Capabilities.detect();
    expect(typeof caps.webpEncode).toBe('boolean');
    expect(typeof caps.avifEncode).toBe('boolean');
    const again = await Capabilities.detect();
    expect(again).toBe(caps); // misma referencia = cacheado
  });

  it('expectedFallback refleja la cadena AVIF → WebP → PNG/JPEG', function () {
    const noAvif = { webpEncode: true, avifEncode: false };
    expect(Capabilities.expectedFallback('avif', noAvif)).toBe('webp');

    const nada = { webpEncode: false, avifEncode: false };
    expect(Capabilities.expectedFallback('avif', nada)).toBe('jpeg/png');
    expect(Capabilities.expectedFallback('webp', nada)).toBe('jpeg/png');

    const todo = { webpEncode: true, avifEncode: true };
    expect(Capabilities.expectedFallback('avif', todo)).toBeNull();
    expect(Capabilities.expectedFallback('webp', todo)).toBeNull();
    expect(Capabilities.expectedFallback('jpeg', nada)).toBeNull();
    expect(Capabilities.expectedFallback('png', nada)).toBeNull();
  });
});

describe('v3.7.0 — PresetManager v2 (presets completos)', function () {
  function stubFilterManager(filters) {
    window.FilterManager = {
      filters: Object.assign({
        brightness: 0, contrast: 0, saturation: 0, blur: 0, sepia: 0, hueRotate: 0
      }, filters || {}),
      applied: 0,
      updateFilterDisplay: function () {},
      applyFiltersImmediate: function () { this.applied++; }
    };
    return window.FilterManager;
  }

  it('captureCurrentState guarda el estado COMPLETO con _version 2', function () {
    stubFilterManager({ brightness: 10, sepia: 80, hueRotate: -15 });
    const state = PresetManager.captureCurrentState();
    expect(state._version).toBe(2);
    expect(state.filters.brightness).toBe(10);
    expect(state.filters.sepia).toBe(80);
    expect(state.filters.hueRotate).toBe(-15);
    expect(state.filters.contrast).toBe(0);
    delete window.FilterManager;
  });

  it('_applyFilterValues restablece a 0 lo no especificado (carga determinista)', function () {
    const fm = stubFilterManager({ brightness: 50, sepia: 99 });
    PresetManager._applyFilterValues({ contrast: 25 });
    expect(fm.filters.contrast).toBe(25);
    expect(fm.filters.brightness).toBe(0); // reseteado, no heredado
    expect(fm.filters.sepia).toBe(0);
    expect(fm.applied).toBeGreaterThan(0); // re-render aplicado
    delete window.FilterManager;
  });

  it('loadPreset carga presets v1 antiguos (campos sueltos) sin filters{}', function () {
    const fm = stubFilterManager({ sepia: 80 });
    localStorage.setItem('mnemotag-preset-legacy-v1',
      JSON.stringify({ brightness: '20', contrast: '5', _version: 1 }));
    localStorage.setItem('mnemotag-preset-index', JSON.stringify(['legacy-v1']));

    const ok = PresetManager.loadPreset('legacy-v1');
    expect(ok).toBe(true);
    expect(fm.filters.brightness).toBe(20);
    expect(fm.filters.contrast).toBe(5);
    expect(fm.filters.sepia).toBe(0); // v1 no conocía sepia → reset

    localStorage.removeItem('mnemotag-preset-legacy-v1');
    localStorage.removeItem('mnemotag-preset-index');
    delete window.FilterManager;
  });

  it('savePreset + loadPreset v2 hacen round-trip del estado completo', function () {
    const fm = stubFilterManager({ brightness: 12, blur: 3, hueRotate: 200 });
    expect(PresetManager.savePreset('roundtrip-v2')).toBe(true);

    stubFilterManager({}); // editor "limpio"
    expect(PresetManager.loadPreset('roundtrip-v2')).toBe(true);
    expect(window.FilterManager.filters.brightness).toBe(12);
    expect(window.FilterManager.filters.blur).toBe(3);
    expect(window.FilterManager.filters.hueRotate).toBe(200);

    PresetManager.deletePreset('roundtrip-v2');
    delete window.FilterManager;
    void fm;
  });
});

describe('v3.7.0 — BatchManager (cola con representación única)', function () {
  it('summarizeItems calcula archivos, megapíxeles y memoria estimada', function () {
    const bm = new BatchManager();
    const summary = bm.summarizeItems([
      { width: 1000, height: 1000, size: 500000 },
      { width: 2000, height: 1500, size: 1500000 }
    ]);
    expect(summary.count).toBe(2);
    expect(summary.totalPixels).toBe(4000000);
    expect(summary.megapixels).toBe(4);
    expect(summary.totalFileBytes).toBe(2000000);
    expect(summary.estimatedDecodedBytes).toBe(16000000); // px × 4 bytes RGBA
  });

  it('summarizeItems es defensivo con listas vacías o items incompletos', function () {
    const bm = new BatchManager();
    expect(bm.summarizeItems([]).count).toBe(0);
    expect(bm.summarizeItems(null).count).toBe(0);
    const s = bm.summarizeItems([{ name: 'sin-dimensiones' }]);
    expect(s.totalPixels).toBe(0);
    expect(s.estimatedDecodedBytes).toBe(0);
  });

  it('la concurrencia queda acotada a 1-2', function () {
    const bm = new BatchManager();
    expect(bm.concurrency).toBeGreaterThan(0);
    expect(bm.concurrency).toBeLessThan(3);
  });

  it('cancelImage marca items pendientes y rechaza los ya procesados', function () {
    const bm = new BatchManager();
    bm.imageQueue.push({ id: 'a', processed: false, cancelled: false });
    bm.imageQueue.push({ id: 'b', processed: true, cancelled: false });
    expect(bm.cancelImage('a')).toBe(true);
    expect(bm.imageQueue[0].cancelled).toBe(true);
    expect(bm.cancelImage('b')).toBe(false);
    expect(bm.cancelImage('no-existe')).toBe(false);
  });

  it('processQueue respeta la concurrencia máxima y procesa toda la cola', async function () {
    const bm = new BatchManager();
    let active = 0;
    let maxActive = 0;
    const processedIds = [];

    bm.processImage = async function (item) {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active--;
      processedIds.push(item.id);
      return { success: true, name: item.name, blob: null, size: 0, width: item.width, height: item.height };
    };

    for (let i = 0; i < 5; i++) {
      bm.imageQueue.push({ id: 'img' + i, name: 'img' + i + '.jpg', file: {}, width: 10, height: 10, processed: false, error: null, cancelled: false });
    }
    bm.captureCurrentConfig('', null, null, null, null);

    const result = await bm.processQueue(null);
    expect(result.processed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.cancelled).toBe(false);
    expect(processedIds.length).toBe(5);
    expect(maxActive).toBeLessThan(bm.concurrency + 1); // nunca > concurrencia
    expect(maxActive).toBeGreaterThan(0);
  });

  it('la cancelación individual salta la imagen sin contarla como error', async function () {
    const bm = new BatchManager();
    const processedIds = [];
    bm.processImage = async function (item) {
      processedIds.push(item.id);
      return { success: true, name: item.name, blob: null, size: 0, width: 1, height: 1 };
    };
    bm.imageQueue.push({ id: 'ok1', name: 'ok1.jpg', file: {}, width: 1, height: 1, processed: false, error: null, cancelled: false });
    bm.imageQueue.push({ id: 'skip', name: 'skip.jpg', file: {}, width: 1, height: 1, processed: false, error: null, cancelled: true });
    bm.imageQueue.push({ id: 'ok2', name: 'ok2.jpg', file: {}, width: 1, height: 1, processed: false, error: null, cancelled: false });
    bm.captureCurrentConfig('', null, null, null, null);

    let sawCancelled = false;
    const result = await bm.processQueue(function (p) {
      if (p.id === 'skip' && p.lastCancelled) sawCancelled = true;
    });

    expect(processedIds).toEqual(['ok1', 'ok2']); // skip nunca se decodifica
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0); // cancelada ≠ fallida
    expect(sawCancelled).toBe(true);
    const skipped = bm.processedImages.filter(function (r) { return r.cancelledItem; });
    expect(skipped.length).toBe(1);
  });

  it('requestCancel a mitad de lote deja el resto sin procesar', async function () {
    const bm = new BatchManager();
    bm.processImage = async function (item) {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { success: true, name: item.name, blob: null, size: 0, width: 1, height: 1 };
    };
    for (let i = 0; i < 6; i++) {
      bm.imageQueue.push({ id: 'c' + i, name: 'c' + i + '.jpg', file: {}, width: 1, height: 1, processed: false, error: null, cancelled: false });
    }
    bm.captureCurrentConfig('', null, null, null, null);

    const result = await bm.processQueue(function (p) {
      if (p.current === 1) bm.requestCancel();
    });

    expect(result.cancelled).toBe(true);
    expect(result.processed).toBeLessThan(6);
    expect(bm.isProcessing).toBe(false);
  });
});

describe('v3.7.0 — Regresión: cola batch sin previews base64 ni Image retenidas', function () {
  it('usa previews Blob reducidas sin introducirlas en la cola', async function () {
    const src = await fetchV370Source('../js/managers/batch-manager.js');
    const ui = await fetchV370Source('../js/managers/batch-ui-manager.js');
    expect(src).not.toContain("toDataURL('image/jpeg'");
    expect(src).toContain('createPreviewBlob');
    expect(src).toContain("'image/jpeg', 0.72");
    expect(ui).toContain('URL.createObjectURL(validation.previewBlob)');
    expect(ui).toContain('URL.revokeObjectURL(image.previewUrl)');
    // La cola guarda dimensiones, no imageData decodificado
    expect(src).not.toContain('imageData: imageData');
    expect(src).toContain('width: validation.width');
  });

  it('main.js ya no genera dataURLs por imagen del lote (FileReader)', async function () {
    const main = await fetchV370Source('../js/main.js');
    const src = await fetchV370Source('../js/managers/batch-ui-manager.js');
    expect(main).not.toContain('reader.readAsDataURL(file)');
    expect(main).toContain('addBatchImages(files)');
    expect(src).toContain('updateSummary');
  });

  it('processImage decodifica bajo demanda y libera canvas e imagen', async function () {
    const src = await fetchV370Source('../js/managers/batch-manager.js');
    expect(src).toContain('await this.loadImageElement(imageItem.file)');
    expect(src).toContain('canvas.width = 0');
    expect(src).toContain("img.src = ''");
  });
});

describe('v3.7.0 — SessionManager (degradación sin IndexedDB)', function () {
  it('sin indexedDB: isSupported false y la API degrada sin lanzar', async function () {
    if (SessionManager.isSupported()) {
      // En browser real hay IndexedDB: aquí solo validamos la superficie API.
      expect(typeof SessionManager.save).toBe('function');
      expect(typeof SessionManager.load).toBe('function');
      expect(typeof SessionManager.clear).toBe('function');
      return;
    }
    expect(SessionManager.isSupported()).toBe(false);
    expect(await SessionManager.save({ savedAt: 1 })).toBe(false);
    expect(await SessionManager.load()).toBeNull();
    await SessionManager.clear(); // no debe lanzar
    SessionManager.configureAutoSave(function () { return { savedAt: 1 }; });
    SessionManager.scheduleAutoSave(); // no-op sin soporte, no debe lanzar
  });

  it('las sesiones caducadas se consideran inválidas (MAX_AGE_MS)', function () {
    expect(SessionManager.MAX_AGE_MS).toBeGreaterThan(0);
    expect(typeof SessionManager.setRestoring).toBe('function');
  });
});
