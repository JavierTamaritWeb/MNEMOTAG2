const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const fixturePath = path.resolve(__dirname, 'fixtures', 'foto-exif.jpg');

test.describe('Seguridad y accesibilidad de entrada', () => {
  test('el nombre del archivo se representa como texto y la CSP bloquea atributos de script', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });

    // Se fuerza únicamente el paso de la validación para verificar que la
    // salida sigue siendo segura aunque una futura regresión relaje el filtro.
    await page.evaluate(() => {
      window.__filenameCodeExecuted = false;
      const validate = SecurityManager.validateImageFile.bind(SecurityManager);
      SecurityManager.validateImageFile = file => {
        const result = validate(file);
        result.errors = result.errors.filter(error => error.type !== 'UNSAFE_FILENAME');
        result.isValid = result.errors.length === 0;
        return result;
      };
    });

    const hostileName = 'foto<img src=x onerror="window.__filenameCodeExecuted=true">.jpg';
    await page.locator('#file-input').setInputFiles({
      name: hostileName,
      mimeType: 'image/jpeg',
      buffer: fs.readFileSync(fixturePath)
    });

    const modal = page.locator('.file-preview-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-preview-field="name"]')).toHaveText(hostileName);
    await expect(modal.locator('img')).toHaveCount(1);
    expect(await page.evaluate(() => window.__filenameCodeExecuted)).toBe(false);

    const scriptPolicy = await page.locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    const scriptSrc = scriptPolicy.split(';').find(value => value.trim().startsWith('script-src '));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).toContain("script-src-attr 'none'");
  });

  test('la vista previa atrapa el foco, cierra con Escape y restaura el foco', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    const trigger = page.locator('#file-selector');
    await trigger.focus();
    await page.locator('#file-input').setInputFiles(fixturePath);

    const modal = page.locator('.file-preview-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal.locator('.preview-close')).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(modal.locator('.preview-confirm')).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('el selector de lote se activa con teclado y el modal restaura el foco', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    const trigger = page.locator('#theme-toggle');
    await trigger.focus();
    await page.evaluate(() => window.openBatchModal());

    const modal = page.locator('#batch-modal');
    const dropzone = page.locator('#batch-dropzone');
    await expect(modal).toBeVisible();
    await expect(dropzone).toHaveJSProperty('tagName', 'BUTTON');

    await page.evaluate(() => {
      window.__batchFileInputClicks = 0;
      document.getElementById('batch-file-input').addEventListener('click', event => {
        event.preventDefault();
        window.__batchFileInputClicks += 1;
      }, { once: true });
    });
    await dropzone.focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__batchFileInputClicks)).toBe(1);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('Geometría móvil crítica', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('preview, lote y progreso permanecen dentro del viewport', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    await page.locator('#file-input').setInputFiles(fixturePath);
    await expect(page.locator('.file-preview-modal')).toBeVisible();

    const previewBounds = await page.locator('.file-preview-modal .preview-container').boundingBox();
    expect(previewBounds.x).toBeGreaterThanOrEqual(0);
    expect(previewBounds.x + previewBounds.width).toBeLessThanOrEqual(320);
    expect(previewBounds.y + previewBounds.height).toBeLessThanOrEqual(568);
    await page.locator('.preview-cancel').click();

    await page.evaluate(() => window.openBatchModal());
    await expect(page.locator('#batch-modal')).toBeVisible();
    for (const button of await page.locator('#batch-modal .modal-footer button:visible').all()) {
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    await page.keyboard.press('Escape');

    await page.locator('#progress-title').evaluate(element => {
      element.textContent = 'Procesando una operación con un nombre deliberadamente largo';
      document.getElementById('progress-overlay').classList.add('show');
    });
    const progressBounds = await page.locator('.progress-card').boundingBox();
    expect(progressBounds.x).toBeGreaterThanOrEqual(0);
    expect(progressBounds.x + progressBounds.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
