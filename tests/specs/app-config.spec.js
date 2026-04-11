// Tests de AppConfig — sanity checks de la configuración global.

describe('AppConfig', function () {
  it('está definido como objeto global', function () {
    expect(typeof AppConfig).toBe('object');
    expect(AppConfig).not.toBeNull();
  });

  it('declara un maxFileSize > 0', function () {
    expect(typeof AppConfig.maxFileSize).toBe('number');
    expect(AppConfig.maxFileSize).toBeGreaterThan(0);
  });

  it('declara los tipos MIME esperados', function () {
    expect(AppConfig.allowedTypes).toContain('image/jpeg');
    expect(AppConfig.allowedTypes).toContain('image/png');
    expect(AppConfig.allowedTypes).toContain('image/webp');
    expect(AppConfig.allowedTypes).toContain('image/avif');
  });

  it('tiene dimensiones de canvas razonables', function () {
    expect(AppConfig.maxCanvasWidth).toBeGreaterThan(0);
    expect(AppConfig.maxCanvasHeight).toBeGreaterThan(0);
  });

  it('tiene los límites de longitud de texto por campo', function () {
    expect(typeof AppConfig.maxTextLength).toBe('object');
    expect(AppConfig.maxTextLength.title).toBeGreaterThan(0);
    expect(AppConfig.maxTextLength.description).toBeGreaterThan(0);
  });

  it('tiene los límites de zoom configurados', function () {
    expect(AppConfig.minZoom).toBe(0.1);
    expect(AppConfig.maxZoom).toBe(5.0);
    expect(AppConfig.zoomStep).toBe(0.1);
    expect(AppConfig.wheelZoomStep).toBe(0.05);
  });

  it('tiene los z-index de modales configurados', function () {
    expect(AppConfig.modalZIndex).toBe(10000);
    expect(AppConfig.overlayZIndex).toBe(9999);
  });

  it('tiene los delays de debounce configurados', function () {
    expect(AppConfig.debounceDelay).toBeGreaterThan(0);
    expect(AppConfig.previewDebounceDelay).toBeGreaterThan(0);
    expect(AppConfig.throttleDelay).toBeGreaterThan(0);
  });
});

describe('MNEMOTAG_DEBUG', function () {
  it('está definido como boolean', function () {
    expect(typeof MNEMOTAG_DEBUG).toBe('boolean');
  });

  it('es false en el entorno de tests (sin ?debug=1)', function () {
    expect(MNEMOTAG_DEBUG).toBe(false);
  });
});
