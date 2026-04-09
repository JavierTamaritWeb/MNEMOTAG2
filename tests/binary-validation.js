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

// ---- 5. AVIF / ISOBMFF parser (v3.3.17) -------------------------------------

console.log('\n● ISOBMFF box parser (v3.3.17)');

// AVIF mínimo: ftyp con major brand 'avif' + meta box vacía + mdat vacía.
//
//   00 00 00 18  ftyp size = 24
//   66 74 79 70  'ftyp'
//   61 76 69 66  major brand = 'avif'
//   00 00 00 00  minor version = 0
//   61 76 69 66  compat brand = 'avif'
//   6D 69 66 31  compat brand = 'mif1'
//
//   00 00 00 08  meta size = 8 (vacío, no realista pero válido para parser)
//   6D 65 74 61  'meta'
//
//   00 00 00 08  mdat size = 8 (vacío)
//   6D 64 61 74  'mdat'
const minimalAvif = new Uint8Array([
  // ftyp box (24 bytes)
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
  0x61, 0x76, 0x69, 0x66, 0x6D, 0x69, 0x66, 0x31,
  // meta box (8 bytes, vacía)
  0x00, 0x00, 0x00, 0x08, 0x6D, 0x65, 0x74, 0x61,
  // mdat box (8 bytes, vacía)
  0x00, 0x00, 0x00, 0x08, 0x6D, 0x64, 0x61, 0x74
]);

const avifBoxes = MM._parseIsobmffBoxes(minimalAvif);
assert(avifBoxes.length === 3, `_parseIsobmffBoxes devuelve 3 boxes (ftyp, meta, mdat) — got ${avifBoxes.length}`);
assert(avifBoxes[0].type === 'ftyp', `Box 0 es ftyp — got ${avifBoxes[0].type}`);
assert(avifBoxes[0].start === 0 && avifBoxes[0].end === 24, `ftyp start=0 end=24 — got ${avifBoxes[0].start}/${avifBoxes[0].end}`);
assert(avifBoxes[1].type === 'meta', `Box 1 es meta — got ${avifBoxes[1].type}`);
assert(avifBoxes[2].type === 'mdat', `Box 2 es mdat — got ${avifBoxes[2].type}`);

// _isAvifFile debe detectar este archivo como AVIF válido
assert(MM._isAvifFile(minimalAvif) === true, '_isAvifFile detecta AVIF mínimo');

// Negativo: bytes random NO son AVIF
const notAvif = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
assert(MM._isAvifFile(notAvif) === false, '_isAvifFile rechaza bytes random');

// Negativo: PNG signature NO es AVIF
const pngSig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]);
assert(MM._isAvifFile(pngSig) === false, '_isAvifFile rechaza PNG signature');

// ---- 6. AVIF EXIF injection — AVIF sintético estructurado (v3.4.15) --------

console.log('\n● AVIF EXIF injection (v3.4.15) — parser recursivo y builders');

// Construye un AVIF mínimo realista:
//   ftyp (24 bytes) + meta (hdlr + pitm + iinf con 1 item 'av01' + iloc) + mdat (con 8 bytes de body)
//
// El objetivo es tener un archivo lo suficientemente completo para que
// _injectExifInAvifBytes pueda parsearlo, construir un item Exif nuevo,
// ajustar los offsets del primary item y producir un resultado válido
// que PUEDA RE-PARSEARSE por las mismas funciones.

function buildStructuredAvif() {
  // === FTYP ===
  const ftyp = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, // size=24
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x61, 0x76, 0x69, 0x66, // major brand 'avif'
    0x00, 0x00, 0x00, 0x00, // minor version
    0x61, 0x76, 0x69, 0x66, // compat 'avif'
    0x6D, 0x69, 0x66, 0x31  // compat 'mif1'
  ]);

  // === HDLR (33 bytes) ===
  // FullBox v0, pre_defined=0, handler_type='pict', reserved[3]=0, name=""
  const hdlr = new Uint8Array([
    0x00, 0x00, 0x00, 0x21, // size=33
    0x68, 0x64, 0x6C, 0x72, // 'hdlr'
    0x00, 0x00, 0x00, 0x00, // version=0 flags=0
    0x00, 0x00, 0x00, 0x00, // pre_defined
    0x70, 0x69, 0x63, 0x74, // handler_type='pict'
    0x00, 0x00, 0x00, 0x00, // reserved[0]
    0x00, 0x00, 0x00, 0x00, // reserved[1]
    0x00, 0x00, 0x00, 0x00, // reserved[2]
    0x00                    // name=""
  ]);

  // === PITM (14 bytes): item_ID=1 ===
  const pitm = new Uint8Array([
    0x00, 0x00, 0x00, 0x0E, // size=14
    0x70, 0x69, 0x74, 0x6D, // 'pitm'
    0x00, 0x00, 0x00, 0x00, // version=0 flags=0
    0x00, 0x01              // item_ID=1
  ]);

  // === INFE para item 1 (av01) — version=2 (21 bytes) ===
  const infe = new Uint8Array([
    0x00, 0x00, 0x00, 0x15, // size=21
    0x69, 0x6E, 0x66, 0x65, // 'infe'
    0x02, 0x00, 0x00, 0x00, // version=2 flags=0
    0x00, 0x01,             // item_ID=1
    0x00, 0x00,             // item_protection_index=0
    0x61, 0x76, 0x30, 0x31, // item_type='av01'
    0x00                    // item_name=""
  ]);

  // === IINF (wraps the infe) ===
  // FullBox v0, entry_count=1, [infe box]
  // size = 8 + 4 + 2 + 21 = 35
  const iinf = new Uint8Array(35);
  // size
  iinf[0] = 0; iinf[1] = 0; iinf[2] = 0; iinf[3] = 0x23;
  // 'iinf'
  iinf[4] = 0x69; iinf[5] = 0x69; iinf[6] = 0x6E; iinf[7] = 0x66;
  // version=0 flags=0
  iinf[8] = 0; iinf[9] = 0; iinf[10] = 0; iinf[11] = 0;
  // entry_count=1
  iinf[12] = 0; iinf[13] = 1;
  // infe
  iinf.set(infe, 14);

  // === ILOC (30 bytes): version=0, 1 item apuntando a un offset
  // que calcularemos más abajo ===
  // FullBox v0, offset_size=4, length_size=4, base_offset_size=0, reserved=0,
  // item_count=1, entries[1]:
  //   item_ID=1, data_ref_index=0, extent_count=1, extent_offset=?, extent_length=8
  // size = 8 + 4 + 2 + 2 + 2 + 2 + 2 + 4 + 4 = 30
  const iloc = new Uint8Array(30);
  iloc[0] = 0; iloc[1] = 0; iloc[2] = 0; iloc[3] = 0x1E;
  iloc[4] = 0x69; iloc[5] = 0x6C; iloc[6] = 0x6F; iloc[7] = 0x63; // 'iloc'
  iloc[8] = 0; iloc[9] = 0; iloc[10] = 0; iloc[11] = 0; // version=0 flags=0
  iloc[12] = 0x44; // offset_size=4, length_size=4
  iloc[13] = 0x00; // base_offset_size=0, reserved=0
  iloc[14] = 0; iloc[15] = 1; // item_count=1
  iloc[16] = 0; iloc[17] = 1; // item_ID=1
  iloc[18] = 0; iloc[19] = 0; // data_ref_index=0
  iloc[20] = 0; iloc[21] = 1; // extent_count=1
  // extent_offset (placeholder — lo fijamos después de saber el layout)
  iloc[22] = 0; iloc[23] = 0; iloc[24] = 0; iloc[25] = 0;
  // extent_length=8
  iloc[26] = 0; iloc[27] = 0; iloc[28] = 0; iloc[29] = 0x08;

  // === META box: wrap hdlr+pitm+iinf+iloc ===
  // FullBox v0 + sub-boxes
  // body = 4 (v/f) + 33 + 14 + 35 + 30 = 116
  // total = 8 + 116 = 124
  const meta = new Uint8Array(124);
  meta[0] = 0; meta[1] = 0; meta[2] = 0; meta[3] = 0x7C; // size=124
  meta[4] = 0x6D; meta[5] = 0x65; meta[6] = 0x74; meta[7] = 0x61; // 'meta'
  meta[8] = 0; meta[9] = 0; meta[10] = 0; meta[11] = 0; // version=0 flags=0
  meta.set(hdlr, 12);
  meta.set(pitm, 12 + 33);
  meta.set(iinf, 12 + 33 + 14);
  meta.set(iloc, 12 + 33 + 14 + 35);

  // === MDAT ===
  // header 8 bytes + body 8 bytes = 16 total
  const mdat = new Uint8Array(16);
  mdat[0] = 0; mdat[1] = 0; mdat[2] = 0; mdat[3] = 0x10; // size=16
  mdat[4] = 0x6D; mdat[5] = 0x64; mdat[6] = 0x61; mdat[7] = 0x74; // 'mdat'
  // body: 8 bytes de datos arbitrarios simulando el AV1 primary image
  mdat[8] = 0xAA; mdat[9] = 0xBB; mdat[10] = 0xCC; mdat[11] = 0xDD;
  mdat[12] = 0xEE; mdat[13] = 0xFF; mdat[14] = 0x11; mdat[15] = 0x22;

  // === Concatenar ftyp + meta + mdat ===
  const total = ftyp.length + meta.length + mdat.length;
  const result = new Uint8Array(total);
  result.set(ftyp, 0);
  result.set(meta, ftyp.length);
  result.set(mdat, ftyp.length + meta.length);

  // El extent_offset del primary item debe ser el offset absoluto
  // dentro del archivo del mdat body (después del mdat header).
  // mdat header empieza en ftyp.length + meta.length = 24 + 124 = 148
  // mdat body empieza en 148 + 8 = 156
  const primaryOffset = ftyp.length + meta.length + 8;
  const ilocOffsetInFile = ftyp.length + 12 + 33 + 14 + 35 + 22; // dentro del meta
  result[ilocOffsetInFile] = (primaryOffset >>> 24) & 0xff;
  result[ilocOffsetInFile + 1] = (primaryOffset >>> 16) & 0xff;
  result[ilocOffsetInFile + 2] = (primaryOffset >>> 8) & 0xff;
  result[ilocOffsetInFile + 3] = primaryOffset & 0xff;

  return result;
}

const structuredAvif = buildStructuredAvif();
assert(structuredAvif.length === 164, `AVIF sintético total = 164 bytes — got ${structuredAvif.length}`);
assert(MM._isAvifFile(structuredAvif), 'AVIF sintético pasa _isAvifFile');

// Parsear el meta box recursivamente
const top = MM._parseIsobmffBoxes(structuredAvif);
const metaB = top.find(b => b.type === 'meta');
const mdatB = top.find(b => b.type === 'mdat');
assert(metaB && mdatB, 'top-level tiene meta y mdat');

const metaContents = MM._parseMetaBox(structuredAvif, metaB);
assert(metaContents.hdlr, 'meta contiene hdlr');
assert(metaContents.pitm, 'meta contiene pitm');
assert(metaContents.iinf, 'meta contiene iinf');
assert(metaContents.iloc, 'meta contiene iloc');

const primaryId = MM._readPitm(structuredAvif, metaContents.pitm);
assert(primaryId === 1, `pitm devuelve primary item_ID=1 — got ${primaryId}`);

const iinfData = MM._readIinf(structuredAvif, metaContents.iinf);
assert(iinfData.entries.length === 1, `iinf tiene 1 entry — got ${iinfData.entries.length}`);
assert(iinfData.entries[0].item_type === 'av01', `item_type='av01' — got '${iinfData.entries[0].item_type}'`);

const ilocData = MM._readIloc(structuredAvif, metaContents.iloc);
assert(ilocData.items.length === 1, `iloc tiene 1 item — got ${ilocData.items.length}`);
assert(ilocData.offset_size === 4, `iloc offset_size=4 — got ${ilocData.offset_size}`);
assert(ilocData.length_size === 4, `iloc length_size=4 — got ${ilocData.length_size}`);
assert(ilocData.items[0].item_ID === 1, `primer item_ID=1 — got ${ilocData.items[0].item_ID}`);
assert(ilocData.items[0].extents[0].extent_offset === 156, `extent_offset=156 — got ${ilocData.items[0].extents[0].extent_offset}`);
assert(ilocData.items[0].extents[0].extent_length === 8, `extent_length=8 — got ${ilocData.items[0].extents[0].extent_length}`);

// === INYECCIÓN EXIF ===
// TIFF bytes mínimos válidos: little-endian header "II*\0" + IFD vacío
// II*\0 + offset(4)=8 + n_entries(2)=0 + next_ifd(4)=0
const tiffBytes = new Uint8Array([
  0x49, 0x49, 0x2A, 0x00,       // 'II*\0' little-endian TIFF magic
  0x08, 0x00, 0x00, 0x00,       // offset to first IFD = 8
  0x00, 0x00,                   // 0 entries
  0x00, 0x00, 0x00, 0x00        // offset to next IFD = 0 (none)
]);

const injected = MM._injectExifInAvifBytes(structuredAvif, tiffBytes);
assert(injected !== null, '_injectExifInAvifBytes no devuelve null');
assert(injected instanceof Uint8Array, 'resultado es Uint8Array');
assert(injected.length > structuredAvif.length, `resultado es más grande — original=${structuredAvif.length} new=${injected.length}`);

// El ftyp debe ser IDÉNTICO
for (let i = 0; i < 24; i++) {
  if (injected[i] !== structuredAvif[i]) {
    assert(false, `ftyp modificado en offset ${i}`);
    break;
  }
}
assert(injected[4] === 0x66 && injected[5] === 0x74 && injected[6] === 0x79 && injected[7] === 0x70,
       'resultado empieza por ftyp intacto');

// Re-parsear el resultado
const topNew = MM._parseIsobmffBoxes(injected);
const metaBNew = topNew.find(b => b.type === 'meta');
const mdatBNew = topNew.find(b => b.type === 'mdat');
assert(metaBNew, 'resultado tiene meta');
assert(mdatBNew, 'resultado tiene mdat');
assert(metaBNew.end - metaBNew.start > metaB.end - metaB.start, 'meta crecido');
assert(mdatBNew.end - mdatBNew.start > mdatB.end - mdatB.start, 'mdat crecido');

const metaContentsNew = MM._parseMetaBox(injected, metaBNew);
assert(metaContentsNew.iinf && metaContentsNew.iloc && metaContentsNew.iref,
       'nuevo meta tiene iinf, iloc y iref');

const iinfNew = MM._readIinf(injected, metaContentsNew.iinf);
assert(iinfNew.entries.length === 2, `iinf tiene 2 entries — got ${iinfNew.entries.length}`);
const exifEntry = iinfNew.entries.find(e => e.item_type === 'Exif');
assert(exifEntry, 'iinf contiene un entry de tipo Exif');
assert(exifEntry.item_ID === 2, `Exif item_ID=2 — got ${exifEntry.item_ID}`);

const ilocNew = MM._readIloc(injected, metaContentsNew.iloc);
assert(ilocNew.items.length === 2, `iloc tiene 2 items — got ${ilocNew.items.length}`);

// Primary item_ID=1 debe haber desplazado su offset en metaGrowth
const primaryItemNew = ilocNew.items.find(it => it.item_ID === 1);
const exifItemNew = ilocNew.items.find(it => it.item_ID === 2);
assert(primaryItemNew, 'primary item_ID=1 sigue en iloc');
assert(exifItemNew, 'Exif item_ID=2 añadido a iloc');
assert(primaryItemNew.extents[0].extent_offset > 156,
       `primary extent_offset desplazado — original=156 new=${primaryItemNew.extents[0].extent_offset}`);
assert(primaryItemNew.extents[0].extent_length === 8, 'primary extent_length sigue siendo 8');
assert(exifItemNew.extents[0].extent_length === 4 + tiffBytes.length,
       `Exif extent_length = 4 (prefix) + ${tiffBytes.length} (tiff) — got ${exifItemNew.extents[0].extent_length}`);

// Los bytes del payload EXIF deben estar en el offset que dice iloc
const exifOffset = exifItemNew.extents[0].extent_offset;
const exifLength = exifItemNew.extents[0].extent_length;
assert(exifOffset + exifLength <= injected.length, 'Exif extent queda dentro del archivo');
// Los primeros 4 bytes en ese offset son el tiff_header_offset=0
assert(
  injected[exifOffset] === 0 && injected[exifOffset + 1] === 0 &&
  injected[exifOffset + 2] === 0 && injected[exifOffset + 3] === 0,
  'payload EXIF empieza con tiff_header_offset=0'
);
// Luego vienen los bytes TIFF originales ('II*\0')
assert(
  injected[exifOffset + 4] === 0x49 && injected[exifOffset + 5] === 0x49 &&
  injected[exifOffset + 6] === 0x2A && injected[exifOffset + 7] === 0x00,
  'payload EXIF contiene los bytes TIFF ("II*\\0") correctos'
);

// El primary item debe seguir leyéndose correctamente
const primaryOffsetNew = primaryItemNew.extents[0].extent_offset;
assert(
  injected[primaryOffsetNew] === 0xAA && injected[primaryOffsetNew + 1] === 0xBB &&
  injected[primaryOffsetNew + 2] === 0xCC && injected[primaryOffsetNew + 3] === 0xDD,
  'primary image data intacto en el offset desplazado'
);

// iref debe contener un cdsc del item Exif al primary
// El nuevo iref tiene: FullBox header + 1 sub-box cdsc
const irefBox = metaContentsNew.iref;
const cdscStart = irefBox.bodyStart + 4; // skip FullBox header
// sub-box cdsc: [size(4)][type'cdsc'(4)][from(2)][count=1(2)][to(2)]
assert(injected[cdscStart + 4] === 0x63 && injected[cdscStart + 5] === 0x64 &&
       injected[cdscStart + 6] === 0x73 && injected[cdscStart + 7] === 0x63,
       'iref contiene sub-box cdsc');
const cdscFromId = (injected[cdscStart + 8] << 8) | injected[cdscStart + 9];
const cdscToId = (injected[cdscStart + 12] << 8) | injected[cdscStart + 13];
assert(cdscFromId === 2, `cdsc from_item_ID=2 (Exif) — got ${cdscFromId}`);
assert(cdscToId === 1, `cdsc to_item_ID=1 (primary) — got ${cdscToId}`);

// Negativo: inyectar en el mismo archivo 2 veces debe devolver null
// (porque ya hay un item Exif)
const reinjected = MM._injectExifInAvifBytes(injected, tiffBytes);
assert(reinjected === null, '2ª inyección sobre archivo con Exif previo devuelve null');

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
