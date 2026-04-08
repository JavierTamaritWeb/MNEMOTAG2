// Tests de MetadataManager (solo lo testeable sin DOM/canvas real).
// Recordatorio: applyMetadataToImage() es un STUB — no se testea como si
// escribiera EXIF, porque no lo hace.

describe('MetadataManager.generateCopyright', function () {
  it('genera el formato "all-rights-reserved" por defecto', function () {
    const txt = MetadataManager.generateCopyright('Javier', '');
    expect(txt).toContain('Javier');
    expect(txt).toContain('Todos los derechos reservados');
  });

  it('genera CC BY 4.0 cuando se pide cc-by', function () {
    const txt = MetadataManager.generateCopyright('Javier', 'cc-by');
    expect(txt).toContain('Creative Commons');
    expect(txt).toContain('CC BY 4.0');
  });

  it('genera CC0 (dominio público) cuando se pide cc0', function () {
    const txt = MetadataManager.generateCopyright('Javier', 'cc0');
    expect(txt).toContain('Dominio Público');
    expect(txt).toContain('CC0');
  });

  it('incluye el año actual', function () {
    const txt = MetadataManager.generateCopyright('Javier', 'all-rights-reserved');
    expect(txt).toContain(String(new Date().getFullYear()));
  });
});

describe('MetadataManager.validateMetadata', function () {
  it('acepta coordenadas GPS dentro de rango', function () {
    const result = MetadataManager.validateMetadata({
      latitude: 40.4168,
      longitude: -3.7038,
    });
    expect(result.isValid).toBe(true);
  });

  it('rechaza latitud fuera de [-90, 90]', function () {
    const result = MetadataManager.validateMetadata({ latitude: 91, longitude: 0 });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rechaza longitud fuera de [-180, 180]', function () {
    const result = MetadataManager.validateMetadata({ latitude: 0, longitude: 181 });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('acepta lat/lon nulas (campo opcional)', function () {
    const result = MetadataManager.validateMetadata({ latitude: null, longitude: null });
    expect(result.isValid).toBe(true);
  });
});
