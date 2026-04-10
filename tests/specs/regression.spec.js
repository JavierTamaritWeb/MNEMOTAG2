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

  it('el toast genuino "Imagen guardada exitosamente" sigue presente (v3.4.10 en export-manager.js)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('Imagen guardada exitosamente');
  });
});

describe('Regresión — Escritura real de EXIF en JPEG (v3.4.10 en export-manager.js)', function () {
  it('export-manager.js llama a embedExifInJpegBlob después de canvasToBlob', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInJpegBlob');
  });

  it('export-manager.js llama a embedExifInJpegDataUrl en el fallback de descarga', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
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

  it('export-manager.js llama a embedExifInWebpBlob en el flujo de descarga (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInWebpBlob');
    const matches = src.match(/MetadataManager\.embedExifInWebpBlob/g) || [];
    expect(matches.length).toBeGreaterThan(1);
  });

  it('export-manager.js llama a embedExifInWebpDataUrl en el camino fallback (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
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

  it('export-manager.js llama a embedExifInPngBlob en el flujo de descarga (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInPngBlob');
    // Al menos 2 llamadas (downloadImage + downloadImageWithProgress, ramas Blob)
    const matches = src.match(/MetadataManager\.embedExifInPngBlob/g) || [];
    expect(matches.length).toBeGreaterThan(1);
  });

  it('export-manager.js llama a embedExifInPngDataUrl en el camino fallback (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInPngDataUrl');
  });
});

describe('Regresión — Mejoras de UX (v3.3.5)', function () {
  it('main.js define el helper getFlattenColor', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('function getFlattenColor()');
  });

  it('export-manager.js usa flattenCanvasForJpeg con segundo parámetro (color) (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
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

  it('export-manager.js usa flattenCanvasForJpeg en al menos 4 puntos del flujo de descarga (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    // 4 puntos: downloadImage (showSaveFilePicker + fallback) y
    // downloadImageWithProgress (showSaveFilePicker + fallback).
    const matches = src.match(/flattenCanvasForJpeg\(canvas[,)]/g) || [];
    expect(matches.length).toBeGreaterThan(3);
  });

  it('export-manager.js condiciona el aplanado a finalMimeType === image/jpeg (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain("(finalMimeType === 'image/jpeg')");
  });
});

describe('Regresión — Quick wins UX (v3.3.11): paste + export multi-size', function () {
  it('main.js define handlePasteImage para el evento paste global', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('function handlePasteImage');
    expect(src).toContain("addEventListener('paste', handlePasteImage)");
  });

  it('main.js define handlePasteButtonClick usando navigator.clipboard.read', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('handlePasteButtonClick');
    expect(src).toContain('navigator.clipboard.read');
  });

  it('index.html incluye el botón "Pegar imagen" en el área de drop', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="paste-image-btn"');
    expect(src).toContain('Pegar imagen');
  });

  it('export-manager.js define downloadMultipleSizes (v3.4.10: extraído de main.js)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('function downloadMultipleSizes');
    // Debe usar JSZip y generar el blob final
    expect(src).toContain('new JSZip()');
    expect(src).toContain('zip.generateAsync');
  });

  it('index.html incluye los checkboxes de tamaños múltiples y el botón ZIP', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="multisize-2048"');
    expect(src).toContain('id="multisize-1024"');
    expect(src).toContain('id="multisize-512"');
    expect(src).toContain('id="multisize-256"');
    expect(src).toContain('id="download-multisize-btn"');
  });
});

describe('Regresión — Análisis visual (v3.3.12 → v3.4.7 extraído a AnalysisManager)', function () {
  it('analysis-manager.js define showHistogram con cómputo RGB+luminosidad', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('function showHistogram');
    // Coeficientes ITU-R BT.601 para luminosidad
    expect(src).toContain('0.299');
    expect(src).toContain('0.587');
    expect(src).toContain('0.114');
  });

  it('analysis-manager.js define _extractDominantColors usando cuantización por buckets', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('_extractDominantColors');
    expect(src).toContain('function showPalette');
    // Cuantización shift >> 5 (8 niveles por canal)
    expect(src).toContain('>> 5');
  });

  it('analysis-manager.js define autoBalanceImage con percentiles 1% y 99% y LUT', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('function autoBalanceImage');
    expect(src).toContain('totalPixels * 0.01');
    expect(src).toContain('totalPixels * 0.99');
    expect(src).toContain('Uint8ClampedArray(256)');
    expect(src).toContain('historyManager.saveState');
  });

  it('index.html incluye los botones de histograma, paleta y auto-balance', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="histogram-btn"');
    expect(src).toContain('id="palette-btn"');
    expect(src).toContain('id="auto-balance-btn"');
  });

  it('index.html incluye los modales de histograma y paleta', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="histogram-modal"');
    expect(src).toContain('id="histogram-canvas"');
    expect(src).toContain('id="palette-modal"');
    expect(src).toContain('id="palette-grid"');
  });

  it('css/styles.css define las clases de los modales de análisis y la paleta', async function () {
    const src = await fetchSource('../css/styles.css');
    expect(src).toContain('.analysis-modal');
    expect(src).toContain('.palette-grid');
    expect(src).toContain('.palette-swatch');
  });

  // v3.4.7: la extracción a manager
  it('v3.4.7: analysis-manager.js expone window.AnalysisManager con IIFE', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('window.AnalysisManager = (function');
    expect(src).toContain('showHistogram: showHistogram');
    expect(src).toContain('showPalette: showPalette');
    expect(src).toContain('autoBalanceImage: autoBalanceImage');
  });

  it('v3.4.7: main.js delega los 3 botones de análisis a AnalysisManager', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('AnalysisManager.showHistogram');
    expect(src).toContain('AnalysisManager.showPalette');
    expect(src).toContain('AnalysisManager.autoBalanceImage');
  });

  it('v3.4.7: index.html carga analysis-manager.js antes de main.js', async function () {
    const src = await fetchSource('../index.html');
    const analysisIdx = src.indexOf('analysis-manager.js');
    const mainIdx = src.indexOf('js/main.js');
    expect(analysisIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(analysisIdx);
  });
});

describe('Regresión — Curvas y niveles (v3.3.13 → v3.4.8 extraído a CurvesManager)', function () {
  it('curves-manager.js define el estado interno con los 4 canales', async function () {
    const src = await fetchSource('../js/managers/curves-manager.js');
    expect(src).toContain("activeChannel: 'rgb'");
    expect(src).toContain('rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }]');
  });

  it('curves-manager.js define _buildLutFromPoints con interpolación lineal segmentada', async function () {
    const src = await fetchSource('../js/managers/curves-manager.js');
    expect(src).toContain('function _buildLutFromPoints');
    expect(src).toContain('Uint8ClampedArray(256)');
  });

  it('curves-manager.js define open() y _applyToImage con composición LUT', async function () {
    const src = await fetchSource('../js/managers/curves-manager.js');
    expect(src).toContain('function open');
    expect(src).toContain('function _applyToImage');
    // Composición: primero la LUT por canal, luego la LUT RGB combinada
    expect(src).toContain('lutRGB[lutR[data[i]]]');
    expect(src).toContain('historyManager.saveState');
  });

  it('curves-manager.js define _redrawCanvas con cuadrícula y línea identidad', async function () {
    const src = await fetchSource('../js/managers/curves-manager.js');
    expect(src).toContain('function _redrawCanvas');
    expect(src).toContain('setLineDash([4, 4])');
  });

  it('index.html incluye el modal de curvas con tabs de canal y canvas interactivo', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="curves-modal"');
    expect(src).toContain('id="curves-canvas"');
    expect(src).toContain('id="curves-apply-btn"');
    expect(src).toContain('id="curves-reset-btn"');
    expect(src).toContain('data-channel="rgb"');
    expect(src).toContain('data-channel="r"');
    expect(src).toContain('data-channel="g"');
    expect(src).toContain('data-channel="b"');
  });

  it('css/styles.css define las clases del editor de curvas', async function () {
    const src = await fetchSource('../css/styles.css');
    expect(src).toContain('.curves-channel-tabs');
    expect(src).toContain('.curves-channel-btn');
    expect(src).toContain('#curves-canvas');
  });

  // v3.4.8: la extracción a manager
  it('v3.4.8: curves-manager.js expone window.CurvesManager con IIFE', async function () {
    const src = await fetchSource('../js/managers/curves-manager.js');
    expect(src).toContain('window.CurvesManager = (function');
    expect(src).toContain('open: open');
  });

  it('v3.4.8: main.js openCurvesModal delega a CurvesManager.open()', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('CurvesManager.open()');
  });

  it('v3.4.8: index.html carga curves-manager.js antes de main.js', async function () {
    const src = await fetchSource('../index.html');
    const curvesIdx = src.indexOf('curves-manager.js');
    const mainIdx = src.indexOf('js/main.js');
    expect(curvesIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(curvesIdx);
  });
});

describe('Regresión — Histórico visual con thumbnails (v3.3.14)', function () {
  it('history-manager.js define getStatesSummary y jumpToState', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain('getStatesSummary: function');
    expect(src).toContain('jumpToState: function');
    expect(src).toContain('_buildThumbnail: function');
  });

  it('history-manager.js dispara window.renderHistoryPanel desde updateUndoRedoButtons', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain('window.renderHistoryPanel');
  });

  it('main.js define renderHistoryPanel y toggleHistoryPanel', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('function renderHistoryPanel');
    expect(src).toContain('function toggleHistoryPanel');
    // Debe exponer la función a window para el hook desde history-manager
    expect(src).toContain('window.renderHistoryPanel = renderHistoryPanel');
  });

  it('main.js usa replaceChildren al renderizar el panel (DOM API segura)', async function () {
    const src = await fetchSource('../js/main.js');
    // Buscar el render del panel y verificar que usa DOM API segura
    expect(src).toContain('history-panel-grid');
    expect(src).toContain("createElement('div')");
    // Click sobre cada thumbnail llama a jumpToState
    expect(src).toContain('historyManager.jumpToState');
  });

  it('index.html incluye el panel de historial visual y el botón toggle', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="history-panel"');
    expect(src).toContain('id="history-panel-grid"');
    expect(src).toContain('id="history-panel-close"');
    expect(src).toContain('id="history-toggle-btn"');
  });

  it('css/styles.css define las clases del panel de historial visual', async function () {
    const src = await fetchSource('../css/styles.css');
    expect(src).toContain('.history-panel');
    expect(src).toContain('.history-thumb');
    expect(src).toContain('.history-thumb.is-current');
  });
});

describe('Regresión — Soporte HEIC/HEIF (v3.3.15)', function () {
  it('index.html carga heic2any desde CDN', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('heic2any');
    expect(src).toContain('heic2any.min.js');
  });

  it('index.html acepta .heic y .heif en el input de archivo', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('.heic,.heif');
    // El texto informativo del área de drop debe mencionar HEIC/HEIF
    expect(src).toContain('HEIC');
    expect(src).toContain('HEIF');
  });

  it('main.js convierte HEIC a JPEG antes de validar (handleFile async)', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('async function handleFile');
    expect(src).toContain("file.type === 'image/heic'");
    expect(src).toContain("file.type === 'image/heif'");
    expect(src).toContain('await heic2any');
    // Conversión a JPEG con quality 0.92
    expect(src).toContain("toType: 'image/jpeg'");
  });

  it('security-manager.js añade HEIC/HEIF a allowedTypes solo si heic2any está disponible', async function () {
    const src = await fetchSource('../js/managers/security-manager.js');
    expect(src).toContain("typeof heic2any !== 'undefined'");
    expect(src).toContain("'image/heic'");
    expect(src).toContain("'image/heif'");
  });
});

describe('Regresión — PWA real con Service Worker (v3.3.16)', function () {
  it('service-worker.js existe en la raíz del proyecto', async function () {
    const res = await fetch('../service-worker.js');
    expect(res.ok).toBe(true);
  });

  it('service-worker.js define las 3 estrategias y los listeners principales', async function () {
    const src = await fetchSource('../service-worker.js');
    expect(src).toContain('CACHE_VERSION');
    // Nombre del cache prefijado con 'mnemotag-v' seguido de versión (v3.3.x, v3.4.x, etc.)
    expect(src).toMatch(/mnemotag-v\d+\.\d+/);
    expect(src).toContain("addEventListener('install'");
    expect(src).toContain("addEventListener('activate'");
    expect(src).toContain("addEventListener('fetch'");
    expect(src).toContain('cacheFirst');
    expect(src).toContain('networkFirst');
  });

  it('service-worker.js precachea index.html y los managers principales', async function () {
    const src = await fetchSource('../service-worker.js');
    expect(src).toContain("'./index.html'");
    expect(src).toContain("'./js/main.js'");
    expect(src).toContain("'./css/styles.css'");
  });

  it('main.js registra el Service Worker en window.load', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain("'serviceWorker' in navigator");
    expect(src).toContain("navigator.serviceWorker.register('./service-worker.js'");
  });

  it('index.html incluye los meta tags PWA para iOS', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('apple-mobile-web-app-capable');
    expect(src).toContain('apple-mobile-web-app-title');
    expect(src).toContain('mobile-web-app-capable');
  });
});

describe('Regresión — AVIF EXIF (v3.3.17 infra → v3.4.15 inyección real)', function () {
  it('metadata-manager.js define las funciones públicas embedExifInAvifBlob/DataUrl', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('embedExifInAvifBlob: async function');
    expect(src).toContain('embedExifInAvifDataUrl: async function');
  });

  it('metadata-manager.js define el parser ISOBMFF y el detector AVIF', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('_parseIsobmffBoxes');
    expect(src).toContain('_isAvifFile');
    // El parser debe manejar el caso largesize (size === 1 con 64-bit body size)
    expect(src).toContain('size === 1');
    // Debe verificar el major brand `avif`
    expect(src).toContain("'avif'");
  });

  it('metadata-manager.js NUNCA corrompe AVIF: degradación elegante en TODOS los caminos (v3.4.15)', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    // Error inyectando → devolver original
    expect(src).toContain('error inyectando EXIF en AVIF, devolviendo original');
    // Validación post-construcción fallida → devolver original
    expect(src).toContain('resultado no empieza por ftyp');
    // try/catch envuelve TODO el flujo binario
    expect(src).toContain('try {');
    expect(src).toContain('} catch (err) {');
    // _injectExifInAvifBytes puede devolver null y el caller lo maneja
    expect(src).toContain('devolvió null');
  });

  // v3.4.15: la inyección REAL
  it('metadata-manager.js define el parser recursivo y los builders ISOBMFF (v3.4.15)', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('_parseIsobmffBoxesInRange');
    expect(src).toContain('_readFullBoxHeader');
    expect(src).toContain('_parseMetaBox');
    expect(src).toContain('_readPitm');
    expect(src).toContain('_readIinf');
    expect(src).toContain('_readIloc');
  });

  it('metadata-manager.js define los builders para infe/iref/iloc/meta (v3.4.15)', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    expect(src).toContain('_buildInfeBoxForExif');
    expect(src).toContain('_buildIinfWithExtra');
    expect(src).toContain('_buildIrefWithCdsc');
    expect(src).toContain('_buildIlocWithExtra');
    expect(src).toContain('_buildNewMetaBox');
    expect(src).toContain('_injectExifInAvifBytes');
  });

  it('metadata-manager.js ajusta offsets existentes por metaGrowth (v3.4.15)', async function () {
    const src = await fetchSource('../js/managers/metadata-manager.js');
    // El builder de iloc debe desplazar los offsets absolutos en metaGrowth
    expect(src).toContain('metaGrowth');
    expect(src).toContain('eo += metaGrowth');
  });

  it('export-manager.js llama a embedExifInAvifBlob en el flujo de descarga (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInAvifBlob');
    // ≥3 llamadas (downloadImage + downloadImageWithProgress + downloadMultipleSizes)
    const matches = src.match(/MetadataManager\.embedExifInAvifBlob/g) || [];
    expect(matches.length).toBeGreaterThan(2);
  });

  it('export-manager.js llama a embedExifInAvifDataUrl en los caminos fallback (v3.4.10)', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('MetadataManager.embedExifInAvifDataUrl');
    expect(src).toContain("finalMimeType === 'image/avif'");
  });
});

describe('Regresión — Eliminar fondo con IA, lazy load (v3.3.18 → v3.4.9 extraído)', function () {
  it('bg-removal-manager.js define removeBackground con lazy load del modelo', async function () {
    const src = await fetchSource('../js/managers/bg-removal-manager.js');
    expect(src).toContain('function removeBackground');
    expect(src).toContain('_loadLib');
    // Lazy load: dynamic import via jsdelivr +esm
    expect(src).toContain('background-removal');
    expect(src).toContain('+esm');
  });

  it('bg-removal-manager.js NO carga la librería al arrancar (cero impacto en peso inicial)', async function () {
    const src = await fetchSource('../js/managers/bg-removal-manager.js');
    expect(src).toContain('await import');
    // Cache del módulo en closure privada (singleton)
    expect(src).toContain('let _module');
  });

  it('bg-removal-manager.js avisa al usuario del tamaño del modelo antes de descargarlo', async function () {
    const src = await fetchSource('../js/managers/bg-removal-manager.js');
    expect(src).toContain('Descargando modelo de IA');
    // Debe mencionar el tamaño aproximado para gestionar expectativas
    expect(src).toMatch(/10.{0,5}MB/);
  });

  it('bg-removal-manager.js degrada elegantemente si la librería falla al cargar', async function () {
    const src = await fetchSource('../js/managers/bg-removal-manager.js');
    expect(src).toContain('No se pudo cargar el modelo de IA');
    // El flag _loading se resetea en finally para no dejar el manager bloqueado
    expect(src).toContain('_loading = false');
  });

  it('index.html incluye el botón "Eliminar fondo (IA)" en la sección de filtros', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="remove-bg-btn"');
    expect(src).toContain('Eliminar fondo');
    expect(src).toContain('10-15 MB');
  });

  // v3.4.9: la extracción a manager
  it('v3.4.9: bg-removal-manager.js expone window.BgRemovalManager con IIFE', async function () {
    const src = await fetchSource('../js/managers/bg-removal-manager.js');
    expect(src).toContain('window.BgRemovalManager = (function');
    expect(src).toContain('removeBackground: removeBackground');
  });

  it('v3.4.9: main.js delega el botón remove-bg-btn a BgRemovalManager.removeBackground()', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('BgRemovalManager.removeBackground()');
  });

  it('v3.4.9: index.html carga bg-removal-manager.js antes de main.js', async function () {
    const src = await fetchSource('../index.html');
    const bgIdx = src.indexOf('bg-removal-manager.js');
    const mainIdx = src.indexOf('js/main.js');
    expect(bgIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(bgIdx);
  });
});

describe('Regresión — Export extraído a ExportManager (v3.4.10)', function () {
  it('export-manager.js expone window.ExportManager con IIFE y 3 métodos', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('window.ExportManager = (function');
    expect(src).toContain('downloadImage: downloadImage');
    expect(src).toContain('downloadImageWithProgress: downloadImageWithProgress');
    expect(src).toContain('downloadMultipleSizes: downloadMultipleSizes');
  });

  it('export-manager.js define las 3 funciones de descarga con EXIF embed chain', async function () {
    const src = await fetchSource('../js/managers/export-manager.js');
    expect(src).toContain('async function downloadImage');
    expect(src).toContain('async function downloadImageWithProgress');
    expect(src).toContain('async function downloadMultipleSizes');
    // La chain de embed EXIF (JPEG/PNG/WebP/AVIF) sigue intacta
    expect(src).toContain('MetadataManager.embedExifInJpegBlob');
    expect(src).toContain('MetadataManager.embedExifInPngBlob');
    expect(src).toContain('MetadataManager.embedExifInWebpBlob');
    expect(src).toContain('MetadataManager.embedExifInAvifBlob');
  });

  it('main.js delega los listeners de descarga a ExportManager', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain('ExportManager.downloadImage()');
    expect(src).toContain('ExportManager.downloadImageWithProgress()');
    expect(src).toContain('ExportManager.downloadMultipleSizes()');
  });

  it('main.js ya NO define las 3 funciones de descarga extraídas', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).not.toContain('async function downloadMultipleSizes');
    expect(src).not.toContain('async function downloadImage()');
    expect(src).not.toContain('async function downloadImageWithProgress');
  });

  it('index.html carga export-manager.js antes de main.js', async function () {
    const src = await fetchSource('../index.html');
    const exportIdx = src.indexOf('export-manager.js');
    const mainIdx = src.indexOf('js/main.js');
    expect(exportIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(exportIdx);
  });
});

describe('Regresión — AppState singleton (v3.4.11)', function () {
  it('app-state.js expone window.AppState con getters para variables globales', async function () {
    const src = await fetchSource('../js/utils/app-state.js');
    expect(src).toContain('window.AppState = Object.freeze');
    // Getters principales
    expect(src).toContain('get canvas()');
    expect(src).toContain('get ctx()');
    expect(src).toContain('get currentImage()');
    expect(src).toContain('get fileBaseName()');
    expect(src).toContain('get outputFormat()');
    expect(src).toContain('get outputQuality()');
  });

  it('app-state.js usa typeof guards para no crashear sin main.js cargado', async function () {
    const src = await fetchSource('../js/utils/app-state.js');
    expect(src).toContain("typeof canvas !== 'undefined'");
    expect(src).toContain("typeof currentImage !== 'undefined'");
  });

  it('app-state.js define setters escribibles para estado mutable', async function () {
    const src = await fetchSource('../js/utils/app-state.js');
    expect(src).toContain('set fileBaseName(v)');
    expect(src).toContain('set currentRotation(v)');
    expect(src).toContain('set outputFormat(v)');
  });

  it('app-state.js define snapshot() para debugging desde consola', async function () {
    const src = await fetchSource('../js/utils/app-state.js');
    expect(src).toContain('snapshot()');
    expect(src).toContain('hasImage: !!this.currentImage');
  });

  it('index.html carga app-state.js antes de los managers', async function () {
    const src = await fetchSource('../index.html');
    const stateIdx = src.indexOf('app-state.js');
    const firstManagerIdx = src.indexOf('js/managers/');
    expect(stateIdx).toBeGreaterThan(0);
    expect(firstManagerIdx).toBeGreaterThan(stateIdx);
  });

  it('AppState carga correctamente en el sandbox Node sin crashear', function () {
    // Si el runner llegó hasta aquí, AppState se cargó sin lanzar
    // porque todos los getters usan typeof guards.
    // eslint-disable-next-line no-undef
    expect(typeof AppState).toBe('object');
    // eslint-disable-next-line no-undef
    expect(AppState).not.toBe(null);
  });
});

describe('Regresión — Web Worker para pixel ops (v3.4.12)', function () {
  it('analysis-worker.js define los 3 handlers (buildHistogram, extractPalette, autoBalance)', async function () {
    const src = await fetchSource('../js/workers/analysis-worker.js');
    expect(src).toContain("case 'buildHistogram'");
    expect(src).toContain("case 'extractPalette'");
    expect(src).toContain("case 'autoBalance'");
  });

  it('analysis-worker.js usa el protocolo id/ok/result para postMessage', async function () {
    const src = await fetchSource('../js/workers/analysis-worker.js');
    expect(src).toContain('self.addEventListener');
    expect(src).toContain('self.postMessage');
    // Protocolo: {id, ok: true/false, result/error}
    expect(src).toContain('ok: true');
    expect(src).toContain('ok: false');
  });

  it('analysis-manager.js crea el Worker lazily con fallback main-thread', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain("typeof Worker !== 'undefined'");
    expect(src).toContain("new Worker('js/workers/analysis-worker.js')");
    expect(src).toContain('_workerAvailable');
    expect(src).toContain('_autoBalanceMainThread');
  });

  it('analysis-manager.js autoBalanceImage es async y delega al worker cuando disponible', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('async function autoBalanceImage');
    expect(src).toContain("_runInWorker('autoBalance'");
    // Fallback explícito
    expect(src).toContain('fallback main-thread');
  });

  it('analysis-manager.js usa transferable objects para evitar copia', async function () {
    const src = await fetchSource('../js/managers/analysis-manager.js');
    expect(src).toContain('imageData.data.buffer');
    expect(src).toContain('postMessage(msg, [imageData.data.buffer])');
  });
});

describe('Regresión — Playwright E2E (v3.4.13)', function () {
  it('playwright.config.js existe en la raíz', async function () {
    const res = await fetch('../playwright.config.js');
    expect(res.ok).toBe(true);
  });

  it('playwright.config.js configura webServer con python3', async function () {
    const src = await fetchSource('../playwright.config.js');
    expect(src).toContain('testDir: \'./tests/e2e\'');
    expect(src).toContain('python3 -m http.server 8080');
    expect(src).toContain("baseURL: 'http://localhost:8080'");
  });

  it('tests/e2e/smoke.spec.js existe con los smoke tests principales', async function () {
    const src = await fetchSource('../tests/e2e/smoke.spec.js');
    expect(src).toContain("import { test, expect } from '@playwright/test'");
    expect(src).toContain('carga index.html sin errores en consola');
    expect(src).toContain('expone los managers globales en window');
    expect(src).toContain('botones principales existen y son clicables');
    expect(src).toContain('AppState.snapshot()');
  });

  it('.github/workflows/e2e.yml define el job Playwright con npx', async function () {
    const res = await fetch('../.github/workflows/e2e.yml');
    expect(res.ok).toBe(true);
    const src = await res.text();
    expect(src).toContain('npx --yes playwright@latest install');
    expect(src).toContain('npx --yes playwright@latest test');
    expect(src).toContain('--project=chromium');
  });

  it('tests/e2e/fixtures/1x1.png existe como fixture de imagen', async function () {
    const res = await fetch('../tests/e2e/fixtures/1x1.png');
    expect(res.ok).toBe(true);
  });
});

describe('Regresión — Filter presets (v3.4.5)', function () {
  it('preset-manager.js define la API pública mínima', async function () {
    const src = await fetchSource('../js/managers/preset-manager.js');
    expect(src).toContain('savePreset: function');
    expect(src).toContain('loadPreset: function');
    expect(src).toContain('listPresets: function');
    expect(src).toContain('deletePreset: function');
    expect(src).toContain('populateSelect: function');
  });

  it('preset-manager.js persiste en localStorage con prefijo propio', async function () {
    const src = await fetchSource('../js/managers/preset-manager.js');
    expect(src).toContain("STORAGE_PREFIX: 'mnemotag-preset-'");
    expect(src).toContain('localStorage.setItem');
    expect(src).toContain('localStorage.getItem');
  });

  it('index.html incluye la UI de presets (input, select, botones)', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="preset-name-input"');
    expect(src).toContain('id="preset-select"');
    expect(src).toContain('id="preset-save-btn"');
    expect(src).toContain('id="preset-load-btn"');
    expect(src).toContain('id="preset-delete-btn"');
  });

  it('index.html carga preset-manager.js antes de main.js', async function () {
    const src = await fetchSource('../index.html');
    const presetIdx = src.indexOf('preset-manager.js');
    const mainIdx = src.indexOf('js/main.js');
    expect(presetIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(presetIdx);
  });

  it('main.js registra los listeners de PresetManager', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain("PresetManager.savePreset");
    expect(src).toContain("PresetManager.loadPreset");
    expect(src).toContain("PresetManager.deletePreset");
    expect(src).toContain("PresetManager.populateSelect");
  });
});

describe('Regresión — Undo/redo con ImageBitmap (v3.4.6)', function () {
  it('history-manager.js usa createImageBitmap en saveState con fallback a dataURL', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain("typeof createImageBitmap === 'function'");
    expect(src).toContain('createImageBitmap(canvas)');
    // Fallback legacy sigue existiendo para navegadores sin la API
    expect(src).toContain('canvas.toDataURL()');
  });

  it('history-manager.js restoreState acepta state.bitmap y state.imageData', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain('state.bitmap');
    expect(src).toContain('ctx.drawImage(state.bitmap');
    expect(src).toContain('state.imageData');
  });

  it('history-manager.js cierra ImageBitmaps descartados en saveState/clear (sin fugar memoria GPU)', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    // Al rebasar maxStates o al limpiar descartes, debe llamar a bitmap.close()
    expect(src).toContain('bitmap.close');
  });

  it('history-manager.js _buildThumbnail pinta el bitmap en un canvas 80x80', async function () {
    const src = await fetchSource('../js/managers/history-manager.js');
    expect(src).toContain('_buildThumbnail: function');
    expect(src).toContain("toDataURL('image/jpeg', 0.8)");
    // object-fit: contain manual
    expect(src).toContain('Math.min(size / bw, size / bh)');
  });

  it('index.html incluye el botón "Vaciar historial" en el panel', async function () {
    const src = await fetchSource('../index.html');
    expect(src).toContain('id="history-clear-btn"');
  });

  it('main.js conecta el botón Vaciar historial a historyManager.clear()', async function () {
    const src = await fetchSource('../js/main.js');
    expect(src).toContain("getElementById('history-clear-btn')");
    expect(src).toContain('historyManager.clear()');
  });
});
