// Generador de fixtures de imágenes reales para los tests E2E.
//
// Regenerar (desde la raíz del repo, requiere devDependencies instaladas):
//   node tests/e2e/fixtures/generate.js
//
// Los archivos generados se VERSIONAN en git (no son artefactos temporales):
//   - foto-exif.jpg    128×128 JPEG con EXIF básico (Artist/Copyright vía sharp)
//   - transparente.png 128×128 PNG RGBA con zonas alpha=0 (fondo transparente)
//   - muestra.webp     128×128 WebP
//   - muestra.avif     128×128 AVIF

const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'sharp'));

const OUT = __dirname;
const SIZE = 128;

// Base opaca: degradado sencillo generado píxel a píxel (RGB)
function buildOpaquePixels() {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 3;
      buf[i] = Math.round((x / (SIZE - 1)) * 255);     // R: degradado horizontal
      buf[i + 1] = Math.round((y / (SIZE - 1)) * 255); // G: degradado vertical
      buf[i + 2] = 128;                                // B: constante
    }
  }
  return buf;
}

// Base RGBA: círculo opaco centrado sobre fondo totalmente transparente (alpha=0)
function buildTransparentPixels() {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const c = (SIZE - 1) / 2;
  const r = SIZE * 0.35;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r;
      buf[i] = 220;
      buf[i + 1] = 60;
      buf[i + 2] = 60;
      buf[i + 3] = inside ? 255 : 0; // zonas alpha=0 fuera del círculo
    }
  }
  return buf;
}

async function main() {
  const opaque = { raw: { width: SIZE, height: SIZE, channels: 3 } };
  const rgba = { raw: { width: SIZE, height: SIZE, channels: 4 } };
  const opaquePixels = buildOpaquePixels();

  // JPEG con EXIF básico escrito por sharp
  await sharp(opaquePixels, opaque)
    .jpeg({ quality: 85 })
    .withExif({
      IFD0: {
        ImageDescription: 'Fixture E2E MnemoTag',
        Artist: 'MnemoTag Tests',
        Copyright: '© MnemoTag E2E',
        Software: 'MnemoTag fixture generator'
      }
    })
    .toFile(path.join(OUT, 'foto-exif.jpg'));

  // PNG RGBA con transparencia real
  await sharp(buildTransparentPixels(), rgba)
    .png()
    .toFile(path.join(OUT, 'transparente.png'));

  // WebP y AVIF de muestra
  await sharp(opaquePixels, opaque)
    .webp({ quality: 80 })
    .toFile(path.join(OUT, 'muestra.webp'));

  await sharp(opaquePixels, opaque)
    .avif({ quality: 60 })
    .toFile(path.join(OUT, 'muestra.avif'));

  // Verificación rápida de lo generado
  for (const f of ['foto-exif.jpg', 'transparente.png', 'muestra.webp', 'muestra.avif']) {
    const m = await sharp(path.join(OUT, f)).metadata();
    console.log(
      f + ': ' + m.width + 'x' + m.height + ' ' + m.format +
      (m.hasAlpha ? ' (alpha)' : '') +
      (m.exif ? ' (EXIF ' + m.exif.length + ' bytes)' : '')
    );
  }
}

main().catch((err) => {
  console.error('Error generando fixtures:', err);
  process.exit(1);
});
