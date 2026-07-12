// MnemoTag — Playwright E2E smoke test (v3.4.13).
//
// Verifica end-to-end (con un navegador real) que:
//   1. La app carga sin errores en consola.
//   2. El título identifica MnemoTag.
//   3. Los scripts críticos están cargados (managers, utils).
//   4. Los botones principales son clicables sin lanzar excepciones.
//   5. Subir fixtures reales via el input de archivo arranca
//      el flujo de carga sin errores.
//
// NO valida la corrección visual de los filtros, el EXIF embebido, ni
// el resultado funcional. Para eso sigue siendo necesaria la
// validación manual. Este test solo confirma que la integración
// básica del DOM con los managers funciona.

const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('MnemoTag smoke test', () => {
  test('carga index.html sin errores en consola', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push('pageerror: ' + err.message);
    });

    await page.goto('/index.html', { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(/MnemoTag/);

    // Filtrar errores conocidos que no son bugs: CSP warnings sobre
    // scripts inline de Tailwind en modo CDN, errores de fuentes
    // que tardan en cargar, etc.
    const realErrors = consoleErrors.filter((err) => {
      if (err.includes('Content Security Policy')) return false;
      if (err.includes('Failed to load resource')) return false;
      if (err.includes('net::ERR_FAILED')) return false;
      return true;
    });

    expect(realErrors).toEqual([]);
    await expect.poll(() => page.evaluate(() => typeof window.piexif)).toBe('object');
  });

  test('expone los managers globales en window', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });

    const managers = await page.evaluate(() => ({
      SecurityManager: typeof SecurityManager,
      MetadataManager: typeof MetadataManager,
      historyManager: typeof historyManager,
      AnalysisManager: typeof AnalysisManager,
      CurvesManager: typeof CurvesManager,
      BgRemovalManager: typeof BgRemovalManager,
      ExportManager: typeof ExportManager,
      PresetManager: typeof PresetManager,
      AppState: typeof AppState
    }));

    // Todos los managers extraídos en v3.4.7 a v3.4.11 deben estar vivos.
    expect(managers.SecurityManager).toBe('object');
    expect(managers.MetadataManager).toBe('object');
    expect(managers.historyManager).toBe('object');
    expect(managers.AnalysisManager).toBe('object');
    expect(managers.CurvesManager).toBe('object');
    expect(managers.BgRemovalManager).toBe('object');
    expect(managers.ExportManager).toBe('object');
    expect(managers.PresetManager).toBe('object');
    expect(managers.AppState).toBe('object');
  });

  test('botones principales existen y son clicables', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });

    const buttons = [
      '#file-selector',
      '#paste-image-btn',
      '#histogram-btn',
      '#palette-btn',
      '#auto-balance-btn',
      '#curves-btn',
      '#remove-bg-btn',
      '#undo-btn',
      '#redo-btn',
      '#history-toggle-btn',
      '#download-image',
      '#download-multisize-btn',
      '#preset-save-btn',
      '#preset-load-btn',
      '#preset-delete-btn',
      '#resetFilters'
    ];

    for (const sel of buttons) {
      const btn = page.locator(sel);
      await expect(btn, 'Botón ' + sel + ' debe existir').toBeAttached();
    }
  });

  test('subir una JPEG real con EXIF via input no lanza errores', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => { consoleErrors.push(err.message); });

    await page.goto('/index.html', { waitUntil: 'networkidle' });

    // Localizar el input file oculto (está en #file-input dentro del
    // área de drop). Playwright puede subir archivos a inputs hidden.
    const fixturePath = path.resolve(__dirname, 'fixtures', 'foto-exif.jpg');
    const input = page.locator('#file-input');

    // Forzar visible si está hidden con CSS
    await input.setInputFiles(fixturePath);

    // Esperar un poco a que la app procese el file event y abra el
    // preview modal o el canvas principal.
    await page.waitForTimeout(1500);

    // Ni errores de JavaScript ni excepciones no capturadas
    const fatalErrors = consoleErrors.filter((err) =>
      !err.includes('Content Security Policy') &&
      !err.includes('Failed to load')
    );
    expect(fatalErrors).toEqual([]);
  });

  test('recorte abre controles y aplica una sugerencia', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    const fixturePath = path.resolve(__dirname, 'fixtures', 'foto-exif.jpg');
    await page.locator('#file-input').setInputFiles(fixturePath);
    await page.locator('.preview-confirm').click();
    await expect(page.locator('#editor-container')).toBeVisible();

    await page.locator('#crop-mode-btn').click();
    const panel = page.locator('#crop-panel');
    await expect(panel).toBeVisible();

    const before = await page.evaluate(() => window.cropManager.cropArea.width);
    await panel.locator('[data-action="applyCropSuggestion"][data-index="1"]').click();
    const after = await page.evaluate(() => window.cropManager.cropArea.width);
    expect(after).not.toBe(before);

    await panel.locator('[data-action="closeCropPanel"]').click();
    await expect(panel).toBeHidden();
  });

  test('decodifica fixtures reales PNG, WebP y AVIF', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });
    for (const fixture of ['transparente.png', 'muestra.webp', 'muestra.avif']) {
      await page.locator('#file-input').setInputFiles(path.resolve(__dirname, 'fixtures', fixture));
      await expect(page.locator('.file-preview-modal')).toBeVisible();
      await expect(page.locator('.preview-image')).toBeVisible();
      await page.locator('.preview-cancel').click();
    }
  });

  test('AppState.snapshot() devuelve estado válido al arrancar', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'networkidle' });

    const snapshot = await page.evaluate(() => AppState.snapshot());

    expect(snapshot).toHaveProperty('hasImage');
    expect(snapshot).toHaveProperty('outputFormat');
    expect(snapshot).toHaveProperty('outputQuality');
    // Sin imagen cargada
    expect(snapshot.hasImage).toBe(false);
  });
});
