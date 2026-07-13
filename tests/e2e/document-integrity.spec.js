'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'foto-exif.jpg');

async function openApp(page) {
  await page.addInitScript(() => {
    try { delete Window.prototype.showSaveFilePicker; } catch (error) { /* noop */ }
    try { delete window.showSaveFilePicker; } catch (error) { /* noop */ }
  });
  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');
}

async function loadImage(page, fixture = FIXTURE) {
  await page.setInputFiles('#file-input', fixture);
  await page.locator('.preview-confirm').click();
  await page.waitForSelector('#editor-container:not(.editor-container--hidden)');
  await expect.poll(() => page.evaluate(() => Boolean(AppState.documentId))).toBe(true);
}

async function rasterState(page, sourceExpression = 'AppState.currentImage') {
  return page.evaluate(expression => {
    const source = Function('return (' + expression + ')')();
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const sample = document.createElement('canvas');
    sample.width = width;
    sample.height = height;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(source, 0, 0, width, height);
    const data = sampleCtx.getImageData(0, 0, width, height).data;
    let checksum = 2166136261;
    let alpha = 0;
    for (let index = 0; index < data.length; index += 4) {
      checksum ^= data[index];
      checksum = Math.imul(checksum, 16777619);
      checksum ^= data[index + 1];
      checksum = Math.imul(checksum, 16777619);
      checksum ^= data[index + 2];
      checksum = Math.imul(checksum, 16777619);
      checksum ^= data[index + 3];
      checksum = Math.imul(checksum, 16777619);
      alpha += data[index + 3];
    }
    return { width, height, checksum: checksum >>> 0, alpha };
  }, sourceExpression);
}

async function downloadRaster(page) {
  await page.evaluate(() => {
    const format = document.getElementById('output-format');
    format.value = 'png';
    format.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#download-image').click();
  const download = await downloadPromise;
  const filePath = await download.path();
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'downloaded-raster-input';
    document.body.appendChild(input);
  });
  await page.setInputFiles('#downloaded-raster-input', filePath);
  const state = await page.evaluate(async () => {
    const file = document.getElementById('downloaded-raster-input').files[0];
    const bitmap = await createImageBitmap(file);
    const sample = document.createElement('canvas');
    sample.width = bitmap.width;
    sample.height = bitmap.height;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(bitmap, 0, 0);
    const data = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
    let checksum = 2166136261;
    let alpha = 0;
    for (let index = 0; index < data.length; index += 4) {
      for (let channel = 0; channel < 4; channel++) {
        checksum ^= data[index + channel];
        checksum = Math.imul(checksum, 16777619);
      }
      alpha += data[index + 3];
    }
    bitmap.close();
    return { width: sample.width, height: sample.height, checksum: checksum >>> 0, alpha };
  });
  await page.locator('#downloaded-raster-input').evaluate(element => element.remove());
  return state;
}

async function visibleRasterState(page) {
  return page.evaluate(() => {
    const data = AppState.ctx.getImageData(0, 0, AppState.canvas.width, AppState.canvas.height).data;
    let checksum = 2166136261;
    for (let index = 0; index < data.length; index++) {
      checksum ^= data[index];
      checksum = Math.imul(checksum, 16777619);
    }
    return {
      width: AppState.canvas.width,
      height: AppState.canvas.height,
      checksum: checksum >>> 0
    };
  });
}

test.describe('Integridad del documento canónico', () => {
  test('crop, export, undo y redo conservan raster y dimensiones', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await openApp(page);
    await loadImage(page);
    const original = await rasterState(page);

    await page.locator('#tab-ajustes').click();
    await page.locator('.workspace__advanced summary').click();
    await page.locator('#crop-mode-btn').click();
    await page.waitForSelector('#crop-panel.active');
    await page.locator('[data-action="applyCrop"]').click();
    await expect.poll(() => page.evaluate(() => AppState.documentRevision)).toBeGreaterThan(0);

    const cropped = await rasterState(page);
    expect(cropped.width).toBeLessThan(original.width);
    expect(cropped.height).toBeLessThan(original.height);
    expect(cropped.alpha).toBeGreaterThan(0);

    const downloaded = await downloadRaster(page);
    expect(downloaded).toEqual(cropped);

    await page.locator('#undo-btn').click();
    await expect.poll(() => rasterState(page)).toMatchObject({
      width: original.width,
      height: original.height,
      checksum: original.checksum
    });

    await page.locator('#redo-btn').click();
    await expect.poll(() => rasterState(page)).toMatchObject({
      width: cropped.width,
      height: cropped.height,
      checksum: cropped.checksum
    });
    expect(pageErrors).toEqual([]);
  });

  test('Curvas sobrevive al rerender y a la exportación', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    const before = await rasterState(page);
    const revision = await page.evaluate(() => AppState.documentRevision);

    await page.locator('#tab-ajustes').click();
    await page.locator('#curves-btn').click();
    const box = await page.locator('#curves-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.15);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const livePreview = await visibleRasterState(page);
    await page.locator('#curves-apply-btn').click();
    await expect.poll(() => page.evaluate(() => AppState.documentRevision)).toBeGreaterThan(revision);

    const applied = await rasterState(page);
    expect(applied.checksum).not.toBe(before.checksum);
    expect(await visibleRasterState(page)).toEqual(livePreview);
    const rerendered = await page.evaluate(() => {
      DocumentRenderer.renderDocument(DocumentRenderer.snapshot({ showPositioningBorders: false }), AppState.canvas);
      const data = AppState.ctx.getImageData(0, 0, AppState.canvas.width, AppState.canvas.height).data;
      let checksum = 2166136261;
      for (let index = 0; index < data.length; index++) {
        checksum ^= data[index];
        checksum = Math.imul(checksum, 16777619);
      }
      return checksum >>> 0;
    });
    expect(rerendered).toBe(applied.checksum);
    expect(await downloadRaster(page)).toEqual(applied);

    // Los controles de rotación viven en la pestaña Exportar
    // (tabpanel-exportar > output-content), no en Ajustes.
    await page.locator('#tab-exportar').click();
    await page.locator('#rotate-90').click();
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await page.evaluate(() => AppState.currentRotation)).toBe(90);
    await page.locator('#reset-rotation').click();
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await rasterState(page)).toEqual(applied);
    expect(await page.evaluate(() => AppState.currentRotation)).toBe(0);
  });

  test('eliminación de fondo confirma alpha en el raster y la descarga', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    await page.evaluate(() => {
      BgRemovalManager.configure({
        removeBackground: async function(blob) {
          const bitmap = await createImageBitmap(blob);
          const output = document.createElement('canvas');
          output.width = bitmap.width;
          output.height = bitmap.height;
          const outputCtx = output.getContext('2d');
          outputCtx.drawImage(bitmap, 0, 0);
          outputCtx.clearRect(0, 0, Math.ceil(output.width / 2), output.height);
          bitmap.close();
          return new Promise(resolve => output.toBlob(resolve, 'image/png'));
        }
      });
      return BgRemovalManager.removeBackground();
    });
    const source = await rasterState(page);
    const transparent = await page.evaluate(() => {
      const sample = document.createElement('canvas');
      sample.width = AppState.currentImage.width;
      sample.height = AppState.currentImage.height;
      const sampleCtx = sample.getContext('2d');
      sampleCtx.drawImage(AppState.currentImage, 0, 0);
      return sampleCtx.getImageData(0, 0, 1, 1).data[3];
    });
    expect(transparent).toBe(0);
    expect(await downloadRaster(page)).toEqual(source);
  });

  test('rotaciones y flips rápidos se ejecutan en orden', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    const original = await rasterState(page);

    await page.locator('#tab-ajustes').click();
    await page.evaluate(() => {
      document.getElementById('rotate-90').click();
      document.getElementById('rotate-90').click();
    });
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await page.evaluate(() => AppState.currentRotation)).toBe(180);

    const afterRotation = await rasterState(page);
    await page.evaluate(() => {
      document.getElementById('flip-horizontal').click();
      document.getElementById('flip-horizontal').click();
    });
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await page.evaluate(() => AppState.isFlippedHorizontally)).toBe(false);
    expect((await rasterState(page)).checksum).toBe(afterRotation.checksum);

    await page.evaluate(() => document.getElementById('reset-rotation').click());
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await rasterState(page)).toEqual(original);
    expect(await page.evaluate(() => ({
      rotation: AppState.currentRotation,
      flipH: AppState.isFlippedHorizontally,
      flipV: AppState.isFlippedVertically
    }))).toEqual({ rotation: 0, flipH: false, flipV: false });
  });

  test('un crop abierto no puede sobrescribir una mutación posterior', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    await page.locator('#tab-ajustes').click();
    await page.locator('.workspace__advanced summary').click();
    await page.locator('#crop-mode-btn').click();
    await page.waitForSelector('#crop-panel.active');

    await page.evaluate(() => document.getElementById('rotate-90').click());
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    const rotated = await rasterState(page);
    const revision = await page.evaluate(() => AppState.documentRevision);

    await page.locator('[data-action="applyCrop"]').click();
    await page.waitForTimeout(100);
    expect(await rasterState(page)).toEqual(rotated);
    expect(await page.evaluate(() => AppState.documentRevision)).toBe(revision);
    await expect(page.locator('#crop-panel')).toHaveClass(/active/);
  });

  test('undo restaura también la baseline usada por restablecer rotación', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    const original = await rasterState(page);
    await page.locator('#tab-ajustes').click();
    await page.locator('.workspace__advanced summary').click();
    await page.locator('#crop-mode-btn').click();
    await page.waitForSelector('#crop-panel.active');
    await page.locator('[data-action="applyCrop"]').click();
    await expect.poll(() => page.evaluate(() => AppState.documentRevision)).toBeGreaterThan(0);

    await page.locator('#undo-btn').click();
    await expect.poll(() => rasterState(page)).toMatchObject(original);
    await page.evaluate(() => document.getElementById('rotate-90').click());
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    await page.evaluate(() => document.getElementById('reset-rotation').click());
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await rasterState(page)).toEqual(original);
  });

  test('crop tras rotar hornea la orientación y deja transformaciones coherentes', async ({ page }) => {
    await openApp(page);
    await loadImage(page);
    // Rotación vive en la pestaña Exportar; el crop en Herramientas
    // avanzadas de la pestaña Ajustes.
    await page.locator('#tab-exportar').click();
    await page.locator('#rotate-90').click();
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    await page.locator('#tab-ajustes').click();
    await page.locator('.workspace__advanced summary').click();
    await page.locator('#crop-mode-btn').click();
    await page.waitForSelector('#crop-panel.active');
    await page.locator('[data-action="applyCrop"]').click();
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    const cropped = await rasterState(page);
    expect(await page.evaluate(() => ({
      rotation: AppState.currentRotation,
      flipH: AppState.isFlippedHorizontally,
      flipV: AppState.isFlippedVertically
    }))).toEqual({ rotation: 0, flipH: false, flipV: false });

    await page.locator('#tab-exportar').click();
    await page.locator('#reset-rotation').click();
    await page.evaluate(() => DocumentStateManager.waitForIdle());
    expect(await rasterState(page)).toEqual(cropped);
  });
});
