describe('DocumentStateManager — transacciones del raster canónico', function () {
  function fakeCanvas(width, height, draws) {
    return {
      width: width || 0,
      height: height || 0,
      style: {},
      getContext: function () {
        return {
          clearRect: function () {},
          drawImage: function (source) { if (draws) draws.push(source); }
        };
      },
      toDataURL: function () { return 'data:image/png;base64,AA=='; }
    };
  }

  function installGlobals(targetCanvas) {
    globalThis.currentImage = null;
    globalThis.currentFile = null;
    globalThis.originalExtension = 'jpg';
    globalThis.fileBaseName = 'imagen';
    globalThis.originalWidth = 0;
    globalThis.originalHeight = 0;
    globalThis.transformResetImage = null;
    globalThis.currentRotation = 0;
    globalThis.isFlippedHorizontally = false;
    globalThis.isFlippedVertically = false;
    globalThis.canvas = targetCanvas;
    globalThis.ctx = targetCanvas.getContext('2d');
  }

  it('invalida una carga cancelada sin sustituir el documento actual', function () {
    const previous = AppState.currentImage;
    const token = DocumentStateManager.beginLoad();
    expect(DocumentStateManager.isCurrentLoad(token)).toBe(true);
    expect(DocumentStateManager.cancelLoad(token)).toBe(true);
    expect(DocumentStateManager.isCurrentLoad(token)).toBe(false);
    expect(DocumentStateManager.cancelLoad(token)).toBe(false);
    expect(AppState.currentImage).toBe(previous);
  });

  it('promueve el resultado a un canvas propio y confirma todos los campos juntos', function () {
    const draws = [];
    const target = fakeCanvas(1, 1);
    installGlobals(target);
    DocumentStateManager.configure({
      createCanvas: function (width, height) { return fakeCanvas(width, height, draws); },
      render: function () {},
      onCommit: null
    });
    const input = fakeCanvas(12, 7);
    const token = DocumentStateManager.beginLoad();
    const result = DocumentStateManager.commitNewDocument({
      image: input,
      file: { name: 'entrada.png' },
      extension: 'png',
      fileBaseName: 'entrada',
      saveHistory: false
    }, token);
    expect(result.width).toBe(12);
    expect(result.height).toBe(7);
    expect(AppState.currentImage === input).toBe(false);
    expect(draws[0]).toBe(input);
    expect(AppState.documentRevision).toBe(0);
    expect(AppState.originalExtension).toBe('png');
  });

  it('limita el raster canónico de carga al presupuesto del editor', function () {
    const draws = [];
    const target = fakeCanvas(1, 1);
    installGlobals(target);
    DocumentStateManager.configure({
      createCanvas: function (width, height) { return fakeCanvas(width, height, draws); },
      render: function () {},
      onCommit: null
    });
    const token = DocumentStateManager.beginLoad();
    const result = DocumentStateManager.commitNewDocument({
      image: fakeCanvas(8000, 4000),
      file: { name: 'grande.png' },
      extension: 'png',
      saveHistory: false
    }, token);
    expect(result.width).toBe(2400);
    expect(result.height).toBe(1200);
    expect(AppState.currentImage.width).toBe(2400);
    expect(AppState.originalWidth).toBe(2400);
  });

  it('serializa mutaciones rápidas y descarta una revisión externa obsoleta', async function () {
    const order = [];
    const initialRevision = AppState.documentRevision;
    const first = DocumentStateManager.enqueueRasterMutation('primera', async function () {
      await new Promise(resolve => setTimeout(resolve, 5));
      order.push('primera');
      return fakeCanvas(12, 7);
    }, { saveHistory: false });
    const second = DocumentStateManager.enqueueRasterMutation('segunda', function () {
      order.push('segunda');
      return fakeCanvas(12, 7);
    }, { saveHistory: false });
    expect(await first).toBeTruthy();
    expect(await second).toBeTruthy();
    expect(order).toEqual(['primera', 'segunda']);
    expect(AppState.documentRevision).toBe(initialRevision + 2);

    const stale = DocumentStateManager.commitRaster(fakeCanvas(12, 7), {
      expectedRevision: initialRevision,
      saveHistory: false
    });
    expect(stale).toBeNull();
  });

  it('no dispara onCommit cuando saveHistory es false', function () {
    let commits = 0;
    DocumentStateManager.configure({ onCommit: function () { commits++; } });
    DocumentStateManager.commitRaster(fakeCanvas(12, 7), { saveHistory: false });
    expect(commits).toBe(0);
    DocumentStateManager.commitRaster(fakeCanvas(12, 7), { saveHistory: true });
    expect(commits).toBe(1);
    DocumentStateManager.configure({ onCommit: null, createCanvas: null, render: null });
  });

  it('invalida una operación exclusiva si se carga otro documento durante un await', async function () {
    const target = fakeCanvas(1, 1);
    installGlobals(target);
    DocumentStateManager.configure({
      createCanvas: function (width, height) { return fakeCanvas(width, height); },
      render: function () {},
      onCommit: null
    });
    let releaseOperation;
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    const operationGate = new Promise(resolve => { releaseOperation = resolve; });
    const operation = DocumentStateManager.runExclusive('prueba-race', async function (context) {
      markStarted();
      await operationGate;
      return DocumentStateManager.isContextCurrent(context);
    });
    await started;
    const token = DocumentStateManager.beginLoad();
    DocumentStateManager.commitNewDocument({
      image: fakeCanvas(8, 6),
      file: { name: 'nuevo.png' },
      extension: 'png',
      saveHistory: false
    }, token);
    releaseOperation();
    expect(await operation).toBe(false);
    expect(AppState.currentFile.name).toBe('nuevo.png');
  });

  it('clearDocument invalida el documento sin dejar estado parcial', function () {
    const oldId = AppState.documentId;
    expect(oldId).toBeTruthy();
    DocumentStateManager.clearDocument();
    expect(AppState.currentImage).toBeNull();
    expect(AppState.currentFile).toBeNull();
    expect(AppState.documentId).toBeNull();
    expect(AppState.documentRevision).toBe(0);
    expect(AppState.originalWidth).toBe(0);
    expect(AppState.currentRotation).toBe(0);
  });
});

describe('TextLayerManager — snapshots aislados', function () {
  it('clona profundamente al exportar e importar capas', async function () {
    const manager = new window.TextLayerManager();
    manager.loadFont = function () { return Promise.resolve(); };
    manager.layers = [{
      id: 'layer-1',
      text: 'Texto',
      font: { family: 'Roboto', size: 40 },
      position: { x: 10, y: 20 },
      effects: { gradient: { colors: ['#000000', '#ffffff'] } }
    }];
    const exported = manager.exportConfig();
    manager.layers[0].position.x = 99;
    manager.layers[0].effects.gradient.colors[0] = '#ff0000';
    expect(exported.layers[0].position.x).toBe(10);
    expect(exported.layers[0].effects.gradient.colors[0]).toBe('#000000');

    await manager.importConfig(exported);
    manager.layers[0].position.y = 77;
    manager.layers[0].font.size = 12;
    expect(exported.layers[0].position.y).toBe(20);
    expect(exported.layers[0].font.size).toBe(40);
  });
});

describe('Estado canónico — historial y sesión v2', function () {
  it('contabiliza la memoria nativa declarada por los snapshots', function () {
    historyManager.clear();
    const watermark = { width: 10, height: 10 };
    historyManager.states = [
      { estimatedBytes: 1024, watermarkConfig: { imageElement: watermark }, watermarkEstimatedBytes: 400 },
      { estimatedBytes: 2048, watermarkConfig: { imageElement: watermark }, watermarkEstimatedBytes: 400 }
    ];
    historyManager.currentIndex = 1;
    expect(historyManager.getInfo().memoryBytes).toBe(3472);
    historyManager.clear();
  });

  it('la sesión v2 incluye raster, baseline, transformaciones y marca de agua', async function () {
    const source = await fetch('../js/managers/session-coordinator.js').then(response => response.text());
    expect(source).toContain('const stateVersion = 2');
    expect(source).toContain('DocumentStateManager.serializeRaster(source)');
    expect(source).toContain('resetRaster');
    expect(source).toContain('watermarkFile');
    expect(source).toContain('documentRevision');
    expect(source).toContain('assertRestoreCurrent');
    expect(source).toContain('sequence !== collectSequence');
    expect(source).toContain('serializeRaster(preview)');
  });
});
