// MnemoTag — Fallback de codificación AVIF/WebP por motor (v3.7.0).
//
// Este spec corre en los TRES proyectos de Playwright (chromium, firefox,
// webkit): la capacidad de codificar AVIF/WebP con canvas difiere por motor
// y la cadena de fallback (AVIF → WebP → PNG/JPEG; WebP → PNG/JPEG) debe
// devolver SIEMPRE un formato que el motor pueda codificar de verdad.

const { test, expect } = require('@playwright/test');

const ENCODABLE = ['image/avif', 'image/webp', 'image/png', 'image/jpeg'];

test.describe('Fallback de formatos por navegador (v3.7.0)', () => {
  test('determineFallbackFormat devuelve un formato realmente codificable', async ({ page, browserName }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const res = await page.evaluate(async () => {
      // Verificación REAL: pedir un blob al canvas con el MIME resultante
      // y comprobar que el blob generado es de ese MIME (no un sustituto
      // silencioso del navegador).
      async function encode(mime) {
        const c = document.createElement('canvas');
        c.width = 8; c.height = 8;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#3366aa';
        ctx.fillRect(0, 0, 8, 8);
        const blob = await new Promise((resolve) => {
          try { c.toBlob(resolve, mime, 0.8); } catch (e) { resolve(null); }
        });
        return blob ? blob.type : null;
      }

      const avif = await determineFallbackFormat(false, 'image/avif');
      const avifAlpha = await determineFallbackFormat(true, 'image/avif');
      const webp = await determineFallbackFormat(false, 'image/webp');
      const webpAlpha = await determineFallbackFormat(true, 'image/webp');
      const jpeg = await determineFallbackFormat(false, 'image/jpeg');
      const png = await determineFallbackFormat(true, 'image/png');

      return {
        avif, avifAlpha, webp, webpAlpha, jpeg, png,
        avifReal: await encode(avif),
        webpReal: await encode(webp),
        avifAlphaReal: await encode(avifAlpha),
        webpAlphaReal: await encode(webpAlpha)
      };
    });

    // El formato elegido pertenece a la cadena conocida…
    for (const key of ['avif', 'avifAlpha', 'webp', 'webpAlpha']) {
      expect(ENCODABLE, browserName + ': ' + key + ' fuera de la cadena').toContain(res[key]);
    }
    // …y el motor lo codifica DE VERDAD (blob.type coincide)
    expect(res.avifReal, browserName + ': avif→' + res.avif + ' no codificable').toBe(res.avif);
    expect(res.webpReal, browserName + ': webp→' + res.webp + ' no codificable').toBe(res.webp);
    expect(res.avifAlphaReal).toBe(res.avifAlpha);
    expect(res.webpAlphaReal).toBe(res.webpAlpha);

    // JPEG y PNG nunca necesitan fallback
    expect(res.jpeg).toBe('image/jpeg');
    expect(res.png).toBe('image/png');
  });

  test('Capabilities refleja las capacidades reales del motor en la UI', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    // Capabilities.applyToUI corre en la inicialización de managers
    await page.waitForTimeout(600);

    const res = await page.evaluate(async () => {
      const caps = await Capabilities.detect();
      const options = {};
      document.querySelectorAll('#output-format option').forEach((opt) => {
        options[opt.value] = opt.textContent;
      });
      const shareBtn = document.getElementById('mobile-share-btn');
      return {
        caps,
        options,
        shareHidden: !shareBtn || shareBtn.hidden
      };
    });

    // Si el motor no codifica un formato, su <option> lo anuncia con el
    // fallback previsto; si lo codifica, el texto queda intacto.
    if (!res.caps.avifEncode) {
      expect(res.options.avif).toContain('exportará →');
    } else {
      expect(res.options.avif).not.toContain('exportará →');
    }
    if (!res.caps.webpEncode) {
      expect(res.options.webp).toContain('exportará →');
    } else {
      expect(res.options.webp).not.toContain('exportará →');
    }

    // El botón Compartir solo es visible si hay Web Share con archivos
    expect(res.shareHidden).toBe(!res.caps.shareFiles);
  });
});
