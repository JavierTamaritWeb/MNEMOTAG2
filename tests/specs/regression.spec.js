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

describe('Regresión — WebP EXIF real con manipulación RIFF/VP8X (v3.3.7)', function () {
  it('metadata-manager.js define los métodos de embedding WebP', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('embedExifInWebpBlob');
    expect(src).toContain('embedExifInWebpDataUrl');
    expect(src).toContain('_parseWebpDimensions');
    expect(src).toContain('_buildVp8xChunk');
    expect(src).toContain('_buildRiffExifChunk');
    expect(src).toContain('_addExifToVp8xWebp');
    expect(src).toContain('_convertSimpleWebpToVp8xWithExif');
  });

  it('metadata-manager.js maneja los 3 tipos de chunk WebP (VP8/VP8L/VP8X)', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain("type === 'VP8X'");
    expect(src).toContain("type === 'VP8 '");
    expect(src).toContain("type === 'VP8L'");
  });

  it('metadata-manager.js setea el flag EXIF (bit 3) en VP8X', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    // El bit EXIF en VP8X es 0x08
    expect(src).toContain('0x08');
  });

  it('metadata-manager.js valida el resultado WebP antes de devolverlo', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    // Tras la generación, debe verificar que el resultado sigue empezando por
    // los bytes 'RIFF' (0x52 0x49 0x46 0x46) y contiene 'WEBP' en bytes 8-11.
    expect(src).toContain('0x52');
    expect(src).toContain('0x57');
    expect(src).toContain('no parece WebP válido, devolviendo original');
  });

  it('main.js llama a embedExifInWebpBlob en el flujo de descarga', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInWebpBlob');
    const matches = src.match(/MetadataManager\.embedExifInWebpBlob/g) || [];
    expect(matches.length).toBeGreaterThan(1);
  });

  it('main.js llama a embedExifInWebpDataUrl en el camino fallback', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInWebpDataUrl');
  });
});

describe('Regresión — PNG EXIF real con chunks eXIf (v3.3.6)', function () {
  it('helpers.js define la utilidad crc32 con tabla de lookup', async function () {
    const src = await fetchSource('../js/utils/helpers.js');
    expect(src).toContain('CRC32_TABLE');
    expect(src).toContain('function crc32(bytes)');
    expect(src).toContain('0xEDB88320');
  });

  it('metadata-manager.js define los métodos de embedding PNG', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('embedExifInPngBlob');
    expect(src).toContain('embedExifInPngDataUrl');
    expect(src).toContain('_buildPngExifChunk');
    expect(src).toContain('_insertExifChunkInPng');
    expect(src).toContain('_piexifBinaryToTiffBytes');
  });

  it('metadata-manager.js construye el chunk eXIf con type y CRC', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    // El chunk eXIf debe tener bytes 'e','X','I','f'
    expect(src).toContain('0x65'); // 'e'
    expect(src).toContain('0x58'); // 'X'
    expect(src).toContain('0x49'); // 'I'
    expect(src).toContain('0x66'); // 'f'
  });

  it('metadata-manager.js valida la signature PNG antes de manipular', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('PNG_SIG');
    expect(src).toContain('0x89'); // primer byte de la signature PNG
  });

  it('main.js llama a embedExifInPngBlob en el flujo de descarga', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInPngBlob');
    // Debe haber al menos 2 llamadas (downloadImage + downloadImageWithProgress, ramas Blob)
    const matches = src.match(/MetadataManager\.embedExifInPngBlob/g) || [];
    expect(matches.length).toBeGreaterThan(1);
  });

  it('main.js llama a embedExifInPngDataUrl en el camino fallback', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.embedExifInPngDataUrl');
  });
});

describe('Regresión — Mejoras de UX (v3.3.5)', function () {
  it('main.js define el helper getFlattenColor', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('function getFlattenColor()');
  });

  it('main.js usa flattenCanvasForJpeg con segundo parámetro (color)', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('flattenCanvasForJpeg(canvas, flattenColor');
  });

  it('main.js incluye lógica de auto-escala del texto del watermark', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain("getElementById('watermark-auto-scale')");
    expect(src).toContain('canvas.width / 1000');
  });

  it('main.js maneja hover state del borde guía con hoveredWatermark', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('let hoveredWatermark');
    expect(src).toContain("hoveredWatermark === 'text'");
    expect(src).toContain("hoveredWatermark === 'image'");
  });

  it('metadata-manager.js define setupAutoSave y persistencia ampliada', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('setupAutoSave: function');
    expect(src).toContain('saveFormToLocalStorage: function');
    expect(src).toContain('AUTOSAVE_FIELDS');
  });

  it('main.js dispara MetadataManager.setupAutoSave al inicializar', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('MetadataManager.setupAutoSave()');
  });

  it('index.html incluye el input de color de aplanado JPEG', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="jpeg-flatten-color"');
    expect(src).toContain('type="color"');
  });

  it('index.html incluye el checkbox de auto-escalar texto', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="watermark-auto-scale"');
  });
});

describe('Regresión — Bugs latentes y limpieza (v3.3.4)', function () {
  it('history-manager.js define el límite de memoria HISTORY_MAX_TOTAL_SIZE', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain('HISTORY_MAX_TOTAL_SIZE');
    expect(src).toContain('100 * 1024 * 1024');
  });

  it('text-layer-manager.js envuelve fonts.load en Promise.race con timeout', async function () {
    const src = await fetchSource('../js/managers/text-layer-manager.js');
    expect(src).toContain('Promise.race');
    expect(src).toContain('FONT_LOAD_TIMEOUT_MS');
    expect(src).toContain('document.fonts.load');
  });

  it('helpers.js ya no testa el formato con un canvas 1x1 vacío', async function () {
    const src = await fetchSource('../js/utils/helpers.js');
    // El bloque del test prematuro tenía estas líneas exactas
    expect(src).not.toContain('tempCanvas.width = 1');
    expect(src).not.toContain('const testDataUrl = tempCanvas.toDataURL(mimeType)');
  });

  it('smart-debounce.js ya no define pauseAll ni resumeAll', async function () {
    const src = await fetchSource('../js/utils/smart-debounce.js');
    expect(src).not.toContain('pauseAll: function');
    expect(src).not.toContain('resumeAll: function');
  });
});

describe('Regresión — XSS latente en toasts (ui-manager)', function () {
  it('ui-manager.js ya no interpola config.action.handler en onclick=', async function () {
    const src = await fetchSource('../js/managers/ui-manager.js');

    // Patrón vulnerable que existía antes del fix
    expect(src).not.toMatch(/onclick="\$\{config\.action\.handler\}"/);
    expect(src).not.toContain('${config.action.handler}');
  });

  it('ui-manager.js construye los botones de acción con DOM API segura', async function () {
    const src = await fetchSource('../js/managers/ui-manager.js');

    // Después del fix debe haber createElement + addEventListener + textContent
    expect(src).toContain("createElement('button')");
    expect(src).toContain("addEventListener('click', config.action.handler)");
    expect(src).toContain('actionBtn.textContent');
  });

  it('security-manager.js ya no define la función global sanitizeFilename', async function () {
    const src = await fetchSource('../js/managers/security-manager.js');
    expect(src).not.toContain('function sanitizeFilename');
  });

  it('metadata-manager.js ya no define exportToJSON ni importFromJSON', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).not.toContain('exportToJSON: function');
    expect(src).not.toContain('importFromJSON: function');
  });
});

describe('Regresión — Conversión de formato JPEG con alpha', function () {
  it('helpers.js ya NO fuerza PNG cuando hay alpha y se pidió JPEG', async function () {
    const src = await fetchSource('../js/utils/helpers.js');
    // El bug original tenía esta línea exacta — debe haber sido eliminada
    expect(src).not.toContain("if (hasAlpha && (preferredFormat === 'image/jpeg'))");
    expect(src).not.toContain('JPEG no soporta transparencia, usando PNG');
  });

  it('helpers.js define la función flattenCanvasForJpeg', async function () {
    const src = await fetchSource('../js/utils/helpers.js');
    expect(src).toContain('function flattenCanvasForJpeg');
    // Verifica que el aplanado tiene un fallback a blanco (default)
    expect(src).toContain("'#ffffff'");
    expect(src).toContain('flatCtx.fillStyle');
  });

  it('main.js usa flattenCanvasForJpeg en al menos 4 puntos del flujo de descarga', async function () {
    const src = await fetchSource('../js/main.js');
    // Hay 4 puntos: downloadImage (showSaveFilePicker + fallback) y
    // downloadImageWithProgress (showSaveFilePicker + fallback). Desde
    // v3.3.5 la función acepta un segundo parámetro (color de fondo),
    // así que el match es por nombre + paréntesis abierto + 'canvas'.
    const matches = src.match(/flattenCanvasForJpeg\(canvas[,)]/g) || [];
    expect(matches.length).toBeGreaterThan(3);
  });

  it('main.js condiciona el aplanado a finalMimeType === image/jpeg', async function () {
    const src = await fetchSource('../js/main.js');
    // El patrón ternario debe estar presente para no aplicar flatten en
    // PNG/WebP/AVIF
    expect(src).toContain("(finalMimeType === 'image/jpeg')");
  });
});
