// Tests de regresión para los 3 bugs corregidos en esta sesión.
// Estrategia: leer el código fuente con fetch() y verificar que los patrones
// vulnerables NO están y los patrones corregidos SÍ están. Esto requiere que
// el servidor sirva la raíz del proyecto por HTTP — file:// no funciona.

async function fetchSource(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error('No se pudo cargar ' + path + ' (status ' + res.status + ')');
  }
  return res.text();
}

describe('Regresión — XSS en updateBatchImagesList (main.js)', function () {
  it('ya no usa innerHTML con interpolación de img.name / img.dataUrl', async function () {
    const src = await fetchSource('../js/main.js');

    // Patrón vulnerable que existía antes de la corrección
    expect(src).not.toContain('innerHTML = batchImages.map');
    expect(src).not.toMatch(/innerHTML\s*=\s*`[^`]*\$\{img\.name\}/);
    expect(src).not.toMatch(/onclick="removeBatchImage\(\$\{img\.id\}\)"/);
  });

  it('construye el listado del batch con DOM API segura', async function () {
    const src = await fetchSource('../js/main.js');

    // Después de la corrección debe haber createElement/appendChild/textContent
    expect(src).toContain('replaceChildren()');
    expect(src).toContain("createElement('div')");
    expect(src).toContain('textContent');
    expect(src).toContain('removeBtn.addEventListener');
  });
});

describe('Regresión — Worker path roto (worker-manager.js)', function () {
  it('apunta a js/image-processor.js, no a workers/...', async function () {
    const src = await fetchSource('../js/managers/worker-manager.js');

    // Path incorrecto histórico
    expect(src).not.toContain("'workers/image-processor.js'");
    expect(src).not.toContain('"workers/image-processor.js"');

    // Path correcto actual
    expect(src).toContain("'js/image-processor.js'");
  });

  it('el archivo del worker existe en la ruta declarada', async function () {
    // Si el path es correcto, este fetch tiene que devolver 200
    const res = await fetch('../js/image-processor.js');
    expect(res.ok).toBe(true);
  });
});

describe('Regresión — Toast falaz de metadatos (main.js)', function () {
  it('ya no afirma "descargada con metadatos" en el éxito de descarga', async function () {
    const src = await fetchSource('../js/main.js');

    // El texto del toast falaz no debe aparecer en ninguna parte del fuente
    expect(src).not.toContain('descargada con metadatos');
    expect(src).not.toContain('Descargada con metadatos');
  });

  it('el toast genuino "Imagen guardada exitosamente" sigue presente', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('Imagen guardada exitosamente');
  });
});

describe('Regresión — Escritura real de EXIF en JPEG', function () {
  it('main.js llama a embedExifInJpegBlob después de canvasToBlob', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInJpegBlob');
  });

  it('main.js llama a embedExifInJpegDataUrl en el fallback de descarga', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInJpegDataUrl');
  });

  it('index.html carga piexifjs desde CDN', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('piexifjs');
    expect(src).toContain('piexif.min.js');
  });

  it('metadata-manager.js define los tres métodos de embedding', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('buildExifObject');
    expect(src).toContain('embedExifInJpegDataUrl');
    expect(src).toContain('embedExifInJpegBlob');
  });
});
