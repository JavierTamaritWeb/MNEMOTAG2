// =============================================================================
// MnemoTag — Validación binaria de las funciones EXIF de PNG y WebP
// =============================================================================
//
// Este script NO sustituye a la validación browser real. Lo que hace es:
//   1. Cargar las funciones de manipulación binaria de metadata-manager.js
//      en un sandbox Node con polyfills mínimos.
//   2. Sintetizar un PNG mínimo válido (1x1 pixel rojo) a mano.
//   3. Sintetizar un WebP "fake" mínimo con un chunk VP8L válido.
//   4. Pasarlos por las funciones _buildPngExifChunk, _insertExifChunkInPng,
//      _parseWebpDimensions, _buildVp8xChunk, _buildRiffExifChunk,
//      _convertSimpleWebpToVp8xWithExif y verificar la estructura del output.
//   5. Inspeccionar los bytes generados manualmente y comparar con los specs.
//
// Si todas las verificaciones pasan, las funciones de manipulación binaria
// están bien implementadas a nivel de bytes. Si fallan, hay un bug real.
//
// Uso:
//   node tests/binary-validation.js
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// ---- Polyfills mínimos del entorno browser ----------------------------------

const sandbox = {
  console,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  String,
  Math,
  Promise,
  Date,
  Number,
  Object,
  Array,
  Error,
  Blob: class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = (options && options.type) || '';
      this.size = parts.reduce((s, p) => s + (p.length || p.byteLength || 0), 0);
    }
    async arrayBuffer() {
      const part = this.parts[0];
      if (part instanceof Uint8Array) return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
      return part;
    }
  },
  // Stub piexif: no lo necesitamos para los tests de manipulación binaria
  // de los chunks. Lo dejamos undefined para que las funciones de embedding
  // de alto nivel devuelvan el blob original — testamos los privates directamente.
  document: { getElementById: () => null },
};

// `globalThis` en el sandbox es el propio sandbox, lo necesitamos para
// exportar las `const` declaradas en strict mode al final de cada archivo.
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// IMPORTANTE: cargar helpers.js ANTES que metadata-manager.js, igual que en
// index.html, porque _buildPngExifChunk usa crc32 (definido en helpers.js).
// Si invertimos el orden, _buildPngExifChunk produciría chunks con CRC = 0
// porque entra en su rama defensiva (typeof crc32 !== 'function').
const helpersCode = fs.readFileSync(path.join(ROOT, 'js/utils/helpers.js'), 'utf8');
vm.runInContext(helpersCode + '\nglobalThis.crc32 = crc32;', sandbox, { filename: 'helpers.js' });

const mmCode = fs.readFileSync(path.join(ROOT, 'js/managers/metadata-manager.js'), 'utf8');
vm.runInContext(mmCode + '\nglobalThis.MetadataManager = MetadataManager;', sandbox, { filename: 'metadata-manager.js' });

const MM = sandbox.MetadataManager;
if (!MM) {
  console.error('FALLO: MetadataManager no está disponible tras cargar el archivo');
  process.exit(2);
}

// ---- Helpers de aserción ----------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    console.log('  ✓ ' + msg);
    passed++;
  } else {
    console.log('  ✗ ' + msg);
    failed++;
    failures.push(msg);
  }
}

function bytesEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---- 1. PNG mínimo válido (1x1 rojo) -----------------------------------------

console.log('\n● PNG mínimo (1x1 píxel) construido a mano');

// PNG bytes hex (extraído de un PNG real generado por GIMP, 1x1 rojo opaco):
//   89 50 4E 47 0D 0A 1A 0A    PNG signature
//   00 00 00 0D                IHDR length = 13
//   49 48 44 52                "IHDR"
//   00 00 00 01                width = 1
//   00 00 00 01                height = 1
//   08 02 00 00 00             bit_depth=8, color_type=2 (RGB), compression=0, filter=0, interlace=0
//   90 77 53 DE                CRC del IHDR
//   00 00 00 0C                IDAT length = 12
//   49 44 41 54                "IDAT"
//   08 99 63 F8 CF C0 00 00 00 03 00 01    data zlib comprimido para 1 píxel rojo
//   5C CD FF 69                CRC del IDAT
//   00 00 00 00                IEND length = 0
//   49 45 4E 44                "IEND"
//   AE 42 60 82                CRC del IEND
const minimalPng = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
  0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
  0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
  0x5C, 0xCD, 0xFF, 0x69,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
  0xAE, 0x42, 0x60, 0x82
]);

// Generar un bloque TIFF mínimo (II*\0 + 8 bytes IFD0 vacío)
// II*\0 = little-endian TIFF
// offset al primer IFD = 8
// IFD: 0 entradas (2 bytes) + offset al siguiente IFD = 0 (4 bytes)
const minimalTiff = new Uint8Array([
  0x49, 0x49, 0x2A, 0x00,             // II*\0
  0x08, 0x00, 0x00, 0x00,             // IFD0 offset = 8
  0x00, 0x00,                          // 0 entries
  0x00, 0x00, 0x00, 0x00              // next IFD offset = 0
]);

// Construir el chunk eXIf
const exifChunk = MM._buildPngExifChunk(minimalTiff);

assert(exifChunk.length === 4 + 4 + minimalTiff.length + 4, 'Chunk eXIf tiene longitud correcta (length+type+data+crc)');
assert(exifChunk[4] === 0x65 && exifChunk[5] === 0x58 && exifChunk[6] === 0x49 && exifChunk[7] === 0x66, 'Chunk eXIf tiene FourCC "eXIf"');

// Verificar length declarado (big-endian)
const declaredLen = (exifChunk[0] << 24) | (exifChunk[1] << 16) | (exifChunk[2] << 8) | exifChunk[3];
assert(declaredLen === minimalTiff.length, 'Chunk eXIf declara la longitud correcta del data');

// Insertar el chunk en el PNG
const newPng = MM._insertExifChunkInPng(minimalPng, exifChunk);

assert(newPng[0] === 0x89 && newPng[1] === 0x50, 'PNG resultado conserva la signature (89 50)');
assert(newPng.length === minimalPng.length + exifChunk.length, 'PNG resultado tiene longitud = original + chunk');

// El chunk eXIf debe estar entre IHDR (acaba en byte 33) y IDAT (empieza en byte 33 del original)
// En el nuevo PNG: signature(8) + IHDR_chunk(25) = 33, luego eXIf, luego IDAT
const expectedExifPos = 8 + 25; // signature + IHDR chunk completo
assert(
  newPng[expectedExifPos + 4] === 0x65 &&
  newPng[expectedExifPos + 5] === 0x58 &&
  newPng[expectedExifPos + 6] === 0x49 &&
  newPng[expectedExifPos + 7] === 0x66,
  'Chunk eXIf insertado en la posición correcta (entre IHDR y IDAT)'
);

// Verificar que IDAT sigue donde debe (después del chunk eXIf)
const idatPos = expectedExifPos + exifChunk.length;
assert(
  newPng[idatPos + 4] === 0x49 &&
  newPng[idatPos + 5] === 0x44 &&
  newPng[idatPos + 6] === 0x41 &&
  newPng[idatPos + 7] === 0x54,
  'IDAT chunk sigue presente después del chunk eXIf insertado'
);

// Verificar que IEND sigue al final
const lastBytes = newPng.subarray(newPng.length - 8);
assert(
  lastBytes[0] === 0x49 && lastBytes[1] === 0x45 && lastBytes[2] === 0x4E && lastBytes[3] === 0x44,
  'IEND chunk sigue siendo el último'
);

// Verificar CRC32 del chunk eXIf
// CRC se calcula sobre type + data, así que length(4) NO entra.
// helpers.js ya está cargado al inicio, así que sandbox.crc32 está listo.
const crcInput = exifChunk.subarray(4, 8 + minimalTiff.length);
const computedCrc = sandbox.crc32(crcInput);
const declaredCrc = (exifChunk[exifChunk.length - 4] << 24) |
                    (exifChunk[exifChunk.length - 3] << 16) |
                    (exifChunk[exifChunk.length - 2] << 8) |
                    exifChunk[exifChunk.length - 1];
assert(computedCrc === (declaredCrc >>> 0), `CRC32 del chunk eXIf coincide con el declarado (${computedCrc.toString(16)})`);

// ---- 2. WebP simple (VP8L lossless) construido a mano -----------------------

console.log('\n● WebP simple VP8L (1x1 lossless) construido a mano');

// WebP VP8L mínimo válido para 1x1:
//   52 49 46 46                "RIFF"
//   1A 00 00 00                file size = 26 (LE)
//   57 45 42 50                "WEBP"
//   56 50 38 4C                "VP8L"
//   0E 00 00 00                chunk size = 14 (LE)
//   2F                          signature 0x2F
//   00 00 00 00                width-1=0, height-1=0, alpha=0, version=0 (4 bytes bit-packed)
//   88 88 08 00 00 00 00 00 00  9 bytes de bitstream lossless válido (1 píxel)
const minimalVp8l = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,
  0x1A, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x4C,
  0x0E, 0x00, 0x00, 0x00,
  0x2F, 0x00, 0x00, 0x00, 0x00,
  0x88, 0x88, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

// Verificar parsing de dimensiones VP8L
const dims = MM._parseWebpDimensions(minimalVp8l);
assert(dims !== null, '_parseWebpDimensions devuelve algo para un VP8L válido');
assert(dims && dims.type === 'VP8L', `Tipo detectado correctamente: ${dims && dims.type}`);
assert(dims && dims.width === 1, `Width parseada correctamente: ${dims && dims.width} (esperado 1)`);
assert(dims && dims.height === 1, `Height parseada correctamente: ${dims && dims.height} (esperado 1)`);

// Construir VP8X chunk para 1x1
const vp8xChunk = MM._buildVp8xChunk(1, 1, true, false);

assert(vp8xChunk.length === 18, 'Chunk VP8X tiene 18 bytes (FourCC 4 + size 4 + data 10)');
assert(vp8xChunk[0] === 0x56 && vp8xChunk[1] === 0x50 && vp8xChunk[2] === 0x38 && vp8xChunk[3] === 0x58, 'VP8X chunk tiene FourCC "VP8X"');
// size LE = 10
assert(vp8xChunk[4] === 0x0A && vp8xChunk[5] === 0 && vp8xChunk[6] === 0 && vp8xChunk[7] === 0, 'VP8X chunk size = 10 (LE)');
// flags: bit 3 (EXIF) = 0x08
assert(vp8xChunk[8] === 0x08, 'VP8X flags tiene bit EXIF activado (0x08)');
// canvas width-1 = 0 (3 bytes LE)
assert(vp8xChunk[12] === 0 && vp8xChunk[13] === 0 && vp8xChunk[14] === 0, 'VP8X canvas_width-1 = 0');
// canvas height-1 = 0 (3 bytes LE)
assert(vp8xChunk[15] === 0 && vp8xChunk[16] === 0 && vp8xChunk[17] === 0, 'VP8X canvas_height-1 = 0');

// Construir RIFF EXIF chunk
const riffExifChunk = MM._buildRiffExifChunk(minimalTiff);
const expectedSize = 8 + minimalTiff.length + (minimalTiff.length % 2);
assert(riffExifChunk.length === expectedSize, `RIFF EXIF chunk tiene longitud con padding par: ${riffExifChunk.length}`);
assert(riffExifChunk[0] === 0x45 && riffExifChunk[1] === 0x58 && riffExifChunk[2] === 0x49 && riffExifChunk[3] === 0x46, 'RIFF EXIF chunk tiene FourCC "EXIF"');

// Convertir el WebP simple a VP8X con EXIF
const newWebp = MM._convertSimpleWebpToVp8xWithExif(minimalVp8l, vp8xChunk, riffExifChunk);

assert(newWebp[0] === 0x52 && newWebp[1] === 0x49 && newWebp[2] === 0x46 && newWebp[3] === 0x46, 'WebP nuevo conserva signature RIFF');
assert(newWebp[8] === 0x57 && newWebp[9] === 0x45 && newWebp[10] === 0x42 && newWebp[11] === 0x50, 'WebP nuevo conserva magic WEBP');

// Después del header (12 bytes) debe venir el chunk VP8X
assert(
  newWebp[12] === 0x56 && newWebp[13] === 0x50 && newWebp[14] === 0x38 && newWebp[15] === 0x58,
  'Tras el header del WebP nuevo viene el chunk VP8X'
);

// Después del VP8X (18 bytes) debe venir el bitstream original (VP8L)
const afterVp8x = 12 + 18;
assert(
  newWebp[afterVp8x] === 0x56 && newWebp[afterVp8x + 1] === 0x50 && newWebp[afterVp8x + 2] === 0x38 && newWebp[afterVp8x + 3] === 0x4C,
  'Tras el VP8X viene el chunk VP8L original (bitstream)'
);

// Verificar que el size del RIFF se ha recalculado correctamente
const declaredRiffSize = newWebp[4] | (newWebp[5] << 8) | (newWebp[6] << 16) | (newWebp[7] << 24);
const expectedRiffSize = newWebp.length - 8;
assert(declaredRiffSize === expectedRiffSize, `Size del RIFF declarado correctamente: ${declaredRiffSize} (esperado ${expectedRiffSize})`);

// El chunk EXIF debe estar al final
const exifFourCCPos = newWebp.length - riffExifChunk.length;
assert(
  newWebp[exifFourCCPos] === 0x45 && newWebp[exifFourCCPos + 1] === 0x58 &&
  newWebp[exifFourCCPos + 2] === 0x49 && newWebp[exifFourCCPos + 3] === 0x46,
  'Chunk EXIF al final del WebP nuevo'
);

// ---- 3. WebP VP8 lossy fake -------------------------------------------------

console.log('\n● WebP simple VP8 lossy (parsing de dimensiones)');

// VP8 lossy mínimo: simulamos el frame tag + signature + width/height
// Este NO es un VP8 funcional, solo tiene los bytes que _parseWebpDimensions lee.
//   52 49 46 46                "RIFF"
//   1E 00 00 00                file size = 30 (LE)
//   57 45 42 50                "WEBP"
//   56 50 38 20                "VP8 "
//   12 00 00 00                chunk size = 18 (LE)
//   00 00 00                   frame tag (3 bytes, contenido irrelevante)
//   9D 01 2A                   signature
//   01 00                      width raw = 1
//   01 00                      height raw = 1
//   00 00 00 00 00 00          padding
const minimalVp8 = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,
  0x1E, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
  0x12, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00,
  0x9D, 0x01, 0x2A,
  0x01, 0x00,
  0x01, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const dimsVp8 = MM._parseWebpDimensions(minimalVp8);
assert(dimsVp8 !== null, '_parseWebpDimensions parsea VP8 lossy fake');
assert(dimsVp8 && dimsVp8.type === 'VP8', `Tipo detectado: ${dimsVp8 && dimsVp8.type}`);
assert(dimsVp8 && dimsVp8.width === 1, `Width VP8: ${dimsVp8 && dimsVp8.width} (esperado 1)`);
assert(dimsVp8 && dimsVp8.height === 1, `Height VP8: ${dimsVp8 && dimsVp8.height} (esperado 1)`);

// ---- 4. WebP VP8X (extended) parsing ----------------------------------------

console.log('\n● WebP VP8X (extended) parsing');

// VP8X 4x6 (sin más chunks, solo header). NO es un WebP funcional pero
// _parseWebpDimensions debe sacar las dimensiones del header.
//   RIFF + size + WEBP + VP8X + size=10 + flags + reserved + canvas_w-1 + canvas_h-1
//   = 12 + 18 = 30 bytes mínimo
const minimalVp8x = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,             // RIFF
  0x16, 0x00, 0x00, 0x00,             // size = 22
  0x57, 0x45, 0x42, 0x50,             // WEBP
  0x56, 0x50, 0x38, 0x58,             // VP8X
  0x0A, 0x00, 0x00, 0x00,             // size = 10
  0x10,                               // flags: bit 4 (alpha) activado
  0x00, 0x00, 0x00,                   // reserved
  0x03, 0x00, 0x00,                   // canvas width-1 = 3 → width = 4
  0x05, 0x00, 0x00                    // canvas height-1 = 5 → height = 6
]);

const dimsVp8x = MM._parseWebpDimensions(minimalVp8x);
assert(dimsVp8x !== null, '_parseWebpDimensions parsea VP8X');
assert(dimsVp8x && dimsVp8x.type === 'VP8X', `Tipo: ${dimsVp8x && dimsVp8x.type}`);
assert(dimsVp8x && dimsVp8x.width === 4, `Width VP8X: ${dimsVp8x && dimsVp8x.width} (esperado 4)`);
assert(dimsVp8x && dimsVp8x.height === 6, `Height VP8X: ${dimsVp8x && dimsVp8x.height} (esperado 6)`);
assert(dimsVp8x && dimsVp8x.hasAlpha === true, `hasAlpha VP8X: ${dimsVp8x && dimsVp8x.hasAlpha} (esperado true)`);

// ---- Resumen ----------------------------------------------------------------

console.log('\n' + '─'.repeat(60));
const total = passed + failed;
if (failed === 0) {
  console.log(`✓ ${passed}/${total} aserciones binarias OK`);
  process.exit(0);
} else {
  console.log(`✗ ${failed} fallos / ${passed} OK / ${total} totales`);
  console.log('\nFallos:');
  for (const f of failures) console.log('  • ' + f);
  process.exit(1);
}
