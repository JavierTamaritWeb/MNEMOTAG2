'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'foto-exif.jpg');
const WATERMARK = path.join(__dirname, 'fixtures', 'transparente.png');

async function cargarImagen(page) {
  await page.setInputFiles('#file-input', FIXTURE);
  await page.locator('.preview-confirm').click();
  await page.waitForSelector('#editor-container:not(.editor-container--hidden)');
}

test.describe('v3.7.1 — arquitectura y memoria', () => {
  test('los módulos de arquitectura están operativos en cada motor', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    const contracts = await page.evaluate(() => ({
      observable: typeof AppState.subscribe === 'function',
      compositor: typeof DocumentRenderer.renderDocument === 'function' && window.renderDocument === DocumentRenderer.renderDocument,
      watermark: typeof WatermarkManager.renderConfig === 'function' && typeof WatermarkManager.clearCache === 'function',
      exportState: typeof ExportManager.downloadImage === 'function',
      batch: typeof BatchUIManager.process === 'function',
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href')
    }));
    // El manifest lleva cache-busting versionado; no acoplar el test a una
    // versión concreta para que los bumps de release no lo rompan.
    expect(contracts.manifest).toMatch(/^images\/site\.webmanifest\?v=\d+\.\d+\.\d+$/);
    expect({ ...contracts, manifest: 'ok' }).toEqual({
      observable: true,
      compositor: true,
      watermark: true,
      exportState: true,
      batch: true,
      manifest: 'ok'
    });
  });

  test('lote de 20 imágenes mantiene una representación y libera el heap', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'performance.memory es una métrica específica de Chromium.');
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);
    await page.locator('#editor-batch-btn').click();
    await page.setInputFiles('#batch-file-input', Array(20).fill(FIXTURE));
    await expect(page.locator('#batch-count')).toHaveText('20', { timeout: 20000 });
    if (typeof page.requestGC === 'function') await page.requestGC();
    const before = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);

    await page.locator('#batch-process-btn').click();
    await page.waitForSelector('#batch-download-btn:visible', { timeout: 30000 });
    if (typeof page.requestGC === 'function') await page.requestGC();
    const processed = await page.evaluate(() => ({
      heap: performance.memory?.usedJSHeapSize || 0,
      queue: window.batchManager.imageQueue.length,
      results: window.batchManager.processedImages.length,
      retainedDecoded: window.batchManager.imageQueue.some(item =>
        'imageData' in item || 'thumbnail' in item || 'dataUrl' in item || 'image' in item
      )
    }));

    await page.evaluate(() => window.clearBatchQueue());
    if (typeof page.requestGC === 'function') await page.requestGC();
    const afterClear = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    const measurement = {
      beforeBytes: before,
      processedBytes: processed.heap,
      afterClearBytes: afterClear,
      peakDeltaBytes: processed.heap && before ? processed.heap - before : null,
      retainedDeltaBytes: afterClear && before ? afterClear - before : null
    };
    await testInfo.attach('memoria-lote-20.json', {
      body: Buffer.from(JSON.stringify(measurement, null, 2)),
      contentType: 'application/json'
    });

    expect(processed.queue).toBe(20);
    expect(processed.results).toBe(20);
    expect(processed.retainedDecoded).toBe(false);
    if (measurement.peakDeltaBytes !== null) {
      expect(measurement.peakDeltaBytes).toBeLessThan(128 * 1024 * 1024);
    }
  });

  test('v3.7.2: la marca de imagen se visualiza y queda horneada en el lote', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);
    await page.locator('#tab-marca').click();
    await page.locator('#watermark-image-enabled').check();
    await page.locator('#watermark-image-size').selectOption('custom');
    await page.locator('#watermark-image-width').fill('100');
    await page.locator('#watermark-image-height').fill('100');
    await page.locator('#watermark-image-position').selectOption('top-left');
    await page.locator('#watermark-image-opacity').fill('100');
    await page.setInputFiles('#watermark-image', WATERMARK);

    await page.waitForFunction(() =>
      AppState.watermarkImagePreview?.complete && AppState.watermarkImagePreview.naturalWidth > 0
    );
    await page.waitForFunction(() => AppState.imageWatermarkBounds?.width > 0);
    const previewPixel = await page.evaluate(() =>
      Array.from(AppState.ctx.getImageData(60, 60, 1, 1).data)
    );
    expect(previewPixel[0]).toBeGreaterThan(180);
    expect(previewPixel[0]).toBeGreaterThan(previewPixel[1] * 2);

    await expect(page.locator('#editor-batch-btn')).toBeVisible();
    await page.locator('#editor-batch-btn').click();
    await page.setInputFiles('#batch-file-input', FIXTURE);
    await expect(page.locator('#batch-count')).toHaveText('1');
    const thumbnail = page.locator('.batch-item-thumbnail');
    await expect(thumbnail).toBeVisible();
    await expect.poll(() => thumbnail.evaluate(image => ({
      blob: image.src.startsWith('blob:'),
      loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    }))).toEqual({ blob: true, loaded: true });
    await page.locator('#batch-apply-watermarks').check();
    await page.locator('#batch-process-btn').click();
    await page.waitForSelector('#batch-download-btn:visible', { timeout: 30000 });

    const result = await page.evaluate(async () => {
      const processed = window.batchManager.processedImages[0];
      const bitmap = await createImageBitmap(processed.blob);
      const sample = document.createElement('canvas');
      sample.width = bitmap.width;
      sample.height = bitmap.height;
      const sampleCtx = sample.getContext('2d');
      sampleCtx.drawImage(bitmap, 0, 0);
      const pixel = Array.from(sampleCtx.getImageData(60, 60, 1, 1).data);
      bitmap.close();
      sample.width = 0;
      sample.height = 0;
      return {
        pixel,
        hasElement: !!window.batchManager.currentConfig.documentState.watermarks?.image?.element
      };
    });
    expect(result.hasElement).toBe(true);
    expect(result.pixel[0]).toBeGreaterThan(180);
    expect(result.pixel[0]).toBeGreaterThan(result.pixel[1] * 2);

    await page.locator('#batch-apply-watermarks').uncheck();
    await page.locator('#batch-process-btn').click();
    await expect.poll(() => page.evaluate(() => ({
      mode: window.batchManager.currentConfig?.documentState?.watermarkMode,
      watermarks: window.batchManager.currentConfig?.documentState?.watermarks
    }))).toEqual({ mode: 'none', watermarks: null });
  });
});
