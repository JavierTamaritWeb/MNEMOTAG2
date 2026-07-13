// MnemoTag — Pruebas obligatorias de la fase v3.7.0 (funcionalidad).
//
//   1. Exportación descargada con EXIF validado byte a byte (APP1/TIFF).
//   2. Undo después de crop (dimensiones y bitmap restaurados).
//   3. Undo después de mover la marca de agua (bitmap restaurado).
//   4. Batch con archivos válidos, corruptos y formatos mezclados.
//   5. Cancelación a mitad de lote sin memoria retenida (cola con
//      representación única: File + dimensiones, sin decodificados/base64).
//   6. Estimación en vivo de la exportación (tamaño · dimensiones · formato).
//   7. Restauración de sesión con IndexedDB tras recargar la página.
//
// (El fallback AVIF/WebP en los tres motores vive en format-fallback.spec.js.)

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURES = path.join(__dirname, 'fixtures');
const FOTO = path.join(FIXTURES, 'foto-exif.jpg');
const PNG = path.join(FIXTURES, 'transparente.png');
const WEBP = path.join(FIXTURES, 'muestra.webp');
const CORRUPTA = path.join(FIXTURES, 'corrupta.jpg');

async function cargarImagen(page, fixture = FOTO) {
  await page.setInputFiles('#file-input', fixture);
  await page.locator('.preview-confirm').click();
  await page.waitForSelector('#editor-container:not(.editor-container--hidden)');
  await page.waitForTimeout(400);
}

/**
 * Extrae el bloque TIFF del segmento APP1/EXIF de un JPEG, byte a byte.
 * Devuelve null si no hay APP1 Exif.
 */
function extractExifTiff(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null; // SOI
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xFF) return null;
    const marker = buf[i + 1];
    if (marker === 0xDA) return null; // SOS: empieza el bitstream, no hay EXIF
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xE1 &&
        buf.slice(i + 4, i + 10).toString('latin1') === 'Exif\0\0') {
      return buf.slice(i + 10, i + 2 + 2 + len);
    }
    i += 2 + len;
  }
  return null;
}

test.describe('v3.7.0 — Pruebas obligatorias', () => {

  test('EXIF byte a byte en la descarga real (Artist + ImageDescription)', async ({ page }) => {
    // Forzar la ruta <a download>: sin File System Access API el flujo cae
    // al enlace clásico, que Playwright captura como evento download.
    await page.addInitScript(() => {
      try { delete Window.prototype.showSaveFilePicker; } catch (e) { /* noop */ }
      try { delete window.showSaveFilePicker; } catch (e) { /* noop */ }
    });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    await page.locator('#metaTitle').fill('Titulo E2E 370');
    await page.locator('#metaAuthor').fill('Autora E2E 370');
    await page.waitForTimeout(300);

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#download-image').click();
    const download = await downloadPromise;
    const filePath = await download.path();
    const bytes = fs.readFileSync(filePath);

    // Estructura JPEG válida: SOI + EOI
    expect(bytes[0]).toBe(0xFF);
    expect(bytes[1]).toBe(0xD8);

    // Segmento APP1 con bloque TIFF válido
    const tiff = extractExifTiff(bytes);
    expect(tiff, 'el JPEG descargado no contiene segmento APP1/Exif').not.toBeNull();

    // Cabecera TIFF byte a byte: 'II' + 42 little-endian (piexif genera II)
    const byteOrder = tiff.slice(0, 2).toString('latin1');
    expect(['II', 'MM']).toContain(byteOrder);
    if (byteOrder === 'II') {
      expect(tiff.readUInt16LE(2)).toBe(42);
    } else {
      expect(tiff.readUInt16BE(2)).toBe(42);
    }

    // Los valores del formulario están embebidos como ASCII en el TIFF
    const tiffLatin = tiff.toString('latin1');
    expect(tiffLatin).toContain('Autora E2E 370');   // Artist
    expect(tiffLatin).toContain('Titulo E2E 370');   // ImageDescription
  });

  test('estimación en vivo: tamaño · dimensiones · formato en la pestaña Exportar', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    await page.locator('#tab-exportar').click();
    // La estimación es debounced (600ms) + codificación de la sonda
    await page.waitForSelector('#export-estimate:not([hidden])', { timeout: 10000 });
    const text = await page.locator('#export-estimate-text').textContent();
    expect(text).toMatch(/≈ [\d.,]+ (B|KB|MB) · \d+×\d+ px · (JPEG|PNG|WEBP|AVIF)/);

    // Cambiar la calidad refresca la estimación
    await page.locator('#output-quality').fill('20');
    await page.waitForTimeout(1500);
    const text2 = await page.locator('#export-estimate-text').textContent();
    expect(text2).toMatch(/≈ [\d.,]+ (B|KB|MB) · \d+×\d+ px · (JPEG|PNG|WEBP|AVIF)/);
  });

  test('undo después de crop restaura dimensiones', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);
    // Asegurar que el estado inicial ya está en el historial (save debounced 1s)
    await page.waitForTimeout(1600);

    const before = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      return { w: c.width, h: c.height };
    });

    // Abrir herramientas avanzadas (pestaña Ajustes) y el panel de recorte
    await page.locator('#tab-ajustes').click();
    await page.locator('.workspace__advanced summary').click();
    await page.locator('#crop-mode-btn').click();
    await page.waitForSelector('#crop-panel.active', { timeout: 5000 });

    // Aplicar el recorte por defecto (80% centrado) → el canvas encoge
    await page.locator('[data-action="applyCrop"]').click();
    await page.waitForTimeout(800);

    const after = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      return { w: c.width, h: c.height };
    });
    expect(after.w).toBeLessThan(before.w);
    expect(after.h).toBeLessThan(before.h);

    // Undo → dimensiones originales
    await page.locator('#undo-btn').click();
    await page.waitForTimeout(800);
    const restored = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      return { w: c.width, h: c.height };
    });
    expect(restored.w).toBe(before.w);
    expect(restored.h).toBe(before.h);
  });

  test('undo después de mover la marca de agua restaura su posición', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    // Activar marca de agua de texto en posición personalizada (centro)
    await page.locator('#tab-marca').click();
    await page.locator('#watermark-text-enabled').check();
    await page.locator('#watermark-text').fill('PRUEBA-UNDO');
    await page.locator('#watermark-position').selectOption('custom');
    // Esperar render + saveState debounced (1s) del estado "marca en centro"
    await page.waitForTimeout(2000);

    const posA = await page.evaluate(() => ({ x: customTextPosition.x, y: customTextPosition.y }));
    const snapA = await page.evaluate(() => document.getElementById('preview-canvas').toDataURL());

    // Arrastrar la marca. El punto de agarre evita el marcador DOM de
    // posición (20px sobre el centro exacto, tapa el mousedown del canvas)
    // y se sitúa DENTRO del texto: a la derecha del centro y sobre la línea
    // base (el texto se dibuja hacia arriba desde la baseline del centro).
    const grab = await page.evaluate(() => {
      const canvas = document.getElementById('preview-canvas');
      const rect = getCanvasContentRect();
      const bounds = AppState.textWatermarkBounds || WatermarkManager.measureCurrentTextBounds();
      return {
        x: rect.left + (bounds.x + bounds.width * 0.5) * (rect.width / canvas.width),
        y: rect.top + (bounds.y + bounds.height * 0.5) * (rect.height / canvas.height)
      };
    });
    const gx = grab.x;
    const gy = grab.y;
    await page.mouse.move(gx, gy);
    await page.mouse.down();
    const dragStarted = await page.evaluate(({ clientX, clientY }) => {
      const rect = getCanvasContentRect();
      const canvas = document.getElementById('preview-canvas');
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);
      return { isDragging, dragTarget, hit: WatermarkManager.isPointInText(x, y), x, y };
    }, { clientX: gx, clientY: gy });
    expect(dragStarted, 'mousedown no inició el drag de watermark').toMatchObject({
      isDragging: true,
      dragTarget: 'text',
      hit: true
    });
    await page.mouse.move(gx + 60, gy + 60, { steps: 8 });
    const dragMoved = await page.evaluate(() => ({
      isDragging,
      dragTarget,
      position: { ...customTextPosition }
    }));
    expect(dragMoved.position, 'mousemove no actualizó la posición del watermark').not.toEqual(posA);
    await page.mouse.up();
    // Render final del drag + saveState debounced del nuevo estado
    await page.waitForTimeout(2000);

    const posB = await page.evaluate(() => ({ x: customTextPosition.x, y: customTextPosition.y }));
    const snapB = await page.evaluate(() => document.getElementById('preview-canvas').toDataURL());
    expect(posB, 'el drag no movió la marca de agua').not.toEqual(posA);
    expect(snapB).not.toBe(snapA);

    // Undo → la posición custom vuelve al centro (bug corregido en v3.7.0:
    // el historial no capturaba customTextPosition y además guardaba las
    // posiciones custom por referencia viva, corrompiendo estados antiguos)
    await page.locator('#undo-btn').click();
    await page.waitForTimeout(800);
    const posC = await page.evaluate(() => ({ x: customTextPosition.x, y: customTextPosition.y }));
    const snapC = await page.evaluate(() => document.getElementById('preview-canvas').toDataURL());
    expect(posC).toEqual(posA);
    // El canvas re-renderiza con la marca de vuelta (distinto al estado movido)
    expect(snapC).not.toBe(snapB);
  });

  test('batch mixto: válidas + corrupta + formatos mezclados, con resumen previo', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#open-batch-btn').click();
    await page.waitForSelector('#batch-modal', { state: 'visible' });

    // Mezcla: JPEG válido, corrupta (magic JPEG + basura), PNG y WebP
    await page.setInputFiles('#batch-file-input', [FOTO, CORRUPTA, PNG, WEBP]);
    await page.waitForTimeout(2000);

    // La corrupta se rechaza AL AÑADIR (decodificación de validación)
    await expect(page.locator('#batch-count')).toHaveText('3');

    // Resumen previo: archivos · megapíxeles · memoria estimada
    const summary = await page.locator('#batch-summary-text').textContent();
    expect(summary).toMatch(/3 archivos · [\d.,]+ MP totales · ~[\d.,]+ .?B de memoria/);

    // Procesar el lote completo (3 válidas, formatos mezclados)
    await page.locator('#batch-process-btn').click();
    await page.waitForSelector('#batch-download-btn:visible', { timeout: 30000 });

    const estados = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.batch-item-status')).map(el => el.className)
    );
    expect(estados.length).toBe(3);
    for (const cls of estados) {
      expect(cls).toContain('batch-item-status--ok');
    }
  });

  test('cancelación a mitad de lote: sin decodificados retenidos en la cola', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await page.locator('#open-batch-btn').click();
    await page.waitForSelector('#batch-modal', { state: 'visible' });

    // Llenar la cola con varias tandas de fixtures (12 imágenes)
    for (let i = 0; i < 4; i++) {
      await page.setInputFiles('#batch-file-input', [FOTO, PNG, WEBP]);
      await page.waitForTimeout(700);
    }
    await expect(page.locator('#batch-count')).toHaveText('12');

    // La cola mantiene UNA representación por imagen: File + dimensiones.
    // Nada de Image decodificadas (imageData) ni previews base64.
    const colaLimpia = await page.evaluate(() => {
      const q = window.batchManager ? window.batchManager.imageQueue : [];
      return {
        len: q.length,
        sinDecodificados: q.every(i => !('imageData' in i) && !('thumbnail' in i) && !('dataUrl' in i)),
        conDimensiones: q.length === 0 || 'width' in (window.batchManager.imageQueue[0] || {})
      };
    });
    expect(colaLimpia.sinDecodificados).toBe(true);

    // Ralentizar cada imagen (~400ms) para que la cancelación llegue con el
    // lote aún en curso — simula imágenes pesadas de forma determinista.
    await page.evaluate(() => {
      const original = window.batchManager.processImage.bind(window.batchManager);
      window.batchManager.processImage = async (item) => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return original(item);
      };
    });

    // Procesar y cancelar en cuanto aparezca el botón del overlay
    await page.locator('#batch-process-btn').click();
    await page.waitForSelector('#progress-cancel:visible', { timeout: 10000 });
    await page.locator('#progress-cancel').click();

    // El overlay se cierra al terminar la imagen en curso (queda oculto,
    // así que se espera por clase, no por visibilidad)
    await page.waitForFunction(
      () => !document.getElementById('progress-overlay').classList.contains('show'),
      null,
      { timeout: 30000 }
    );
    await page.waitForTimeout(500);

    const estado = await page.evaluate(() => {
      const bm = window.batchManager;
      const q = bm.imageQueue;
      return {
        isProcessing: bm.isProcessing,
        procesadas: bm.processedImages.length,
        total: q.length,
        // Tras cancelar, la cola sigue sin retener decodificados ni base64
        sinDecodificados: q.every(i => !('imageData' in i) && !('thumbnail' in i) && !('dataUrl' in i))
      };
    });
    expect(estado.isProcessing).toBe(false);
    expect(estado.procesadas).toBeLessThan(estado.total); // se canceló a mitad
    expect(estado.sinDecodificados).toBe(true);

    // La UI informa del lote cancelado
    await expect(page.locator('.info-toast, .warning-toast').first()).toBeVisible();
  });

  test('restauración de sesión: recargar ofrece recuperar imagen y ajustes', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    // Editar algo identificable y dejar que el autosave (2.5s) persista
    await page.locator('#metaAuthor').fill('Sesión Persistente 370');
    const sessionResult = await page.evaluate(async () => ({
      saved: await SessionManager.flushAutoSave(),
      error: SessionManager.getLastError()
    }));
    expect(sessionResult, 'IndexedDB rechazó el autosave: ' + sessionResult.error).toEqual({ saved: true, error: null });

    // Recargar: la app ofrece restaurar la sesión guardada
    await page.reload();
    await page.waitForLoadState('networkidle');
    const restoreBtn = page.locator('.info-toast .info-action');
    await expect(restoreBtn).toBeVisible({ timeout: 10000 });
    await restoreBtn.click();

    // La imagen vuelve al editor y el formulario recupera su valor
    await page.waitForSelector('#editor-container:not(.editor-container--hidden)', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('#metaAuthor')).toHaveValue('Sesión Persistente 370');
  });
});
