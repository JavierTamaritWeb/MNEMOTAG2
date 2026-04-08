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
});
