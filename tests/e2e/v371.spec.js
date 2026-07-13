'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'foto-exif.jpg');

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
    expect(contracts).toEqual({
      observable: true,
      compositor: true,
      watermark: true,
      exportState: true,
      batch: true,
      manifest: 'images/site.webmanifest?v=3.7.1'
    });
  });

  test('lote de 20 imágenes mantiene una representación y libera el heap', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'performance.memory es una métrica específica de Chromium.');
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.locator('#open-batch-btn').click();
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
});
