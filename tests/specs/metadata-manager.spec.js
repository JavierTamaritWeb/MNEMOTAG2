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

describe('MetadataManager — escritura EXIF en JPEG', function () {
  it('expone los nuevos métodos de embedding', function () {
    expect(typeof MetadataManager.buildExifObject).toBe('function');
    expect(typeof MetadataManager.embedExifInJpegBlob).toBe('function');
    expect(typeof MetadataManager.embedExifInJpegDataUrl).toBe('function');
  });

  it('buildExifObject devuelve null si no hay piexif disponible', function () {
    // En el runner Node, piexif no está cargado: el método debe degradar.
    // En el runner browser SÍ está, así que el resultado depende de si hay
    // metadatos rellenados. Aquí solo verificamos la rama de degradación
    // cuando piexif no existe en el sandbox de tests.
    if (typeof piexif === 'undefined') {
      const result = MetadataManager.buildExifObject({
        title: 'Test',
        author: 'Javier',
      });
      expect(result).toBeNull();
    } else {
      // En el browser: debe devolver objeto con sección "0th"
      const result = MetadataManager.buildExifObject({
        title: 'Test',
        author: 'Javier',
      });
      expect(result).not.toBeNull();
      expect(typeof result['0th']).toBe('object');
    }
  });

  it('embedExifInJpegDataUrl devuelve la cadena tal cual si no es JPEG', function () {
    const pngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const result = MetadataManager.embedExifInJpegDataUrl(pngDataUrl);
    expect(result).toBe(pngDataUrl);
  });

  it('embedExifInJpegDataUrl devuelve la cadena tal cual si la entrada no es string', function () {
    expect(MetadataManager.embedExifInJpegDataUrl(null)).toBeNull();
    expect(MetadataManager.embedExifInJpegDataUrl(undefined)).toBeUndefined();
    expect(MetadataManager.embedExifInJpegDataUrl(42)).toBe(42);
  });

  it('embedExifInJpegBlob devuelve el blob tal cual si no es JPEG', async function () {
    const fakePng = { type: 'image/png', size: 100 };
    const result = await MetadataManager.embedExifInJpegBlob(fakePng);
    expect(result).toBe(fakePng);
  });

  it('embedExifInJpegBlob devuelve el blob tal cual si es null/undefined', async function () {
    expect(await MetadataManager.embedExifInJpegBlob(null)).toBeNull();
    expect(await MetadataManager.embedExifInJpegBlob(undefined)).toBeUndefined();
  });
});
