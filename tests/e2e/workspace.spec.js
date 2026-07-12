// MnemoTag — Criterios de aceptación del área de trabajo (v3.6.1).
//
// Verifica con navegador real los criterios de la fase:
//   1. Sin scroll horizontal desde 320 px.
//   2. Canvas ≥55% del ancho útil en escritorio.
//   3. Descargar accesible sin recorrer la página (toolbar en viewport).
//   4. Ningún control tapa el canvas (sheet móvil cerrado por defecto).
//   5. Pestañas funcionales + indicador de sección modificada + restaurar.

const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'transparente.png');

async function cargarImagen(page) {
  await page.setInputFiles('#file-input', FIXTURE);
  await page.locator('.preview-confirm').click();
  await page.waitForSelector('#editor-container:not(.editor-container--hidden)');
  await page.waitForTimeout(400);
}

test.describe('Área de trabajo (v3.6.1)', () => {
  test('escritorio: canvas ≥55%, descargar visible, sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    const m = await page.evaluate(() => {
      const main = document.getElementById('workspace-main').getBoundingClientRect();
      const ws = document.getElementById('workspace').getBoundingClientRect();
      const dl = document.getElementById('download-image').getBoundingClientRect();
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        canvasPct: main.width / ws.width,
        dlEnViewport: dl.top >= 0 && dl.bottom <= window.innerHeight && dl.width > 0
      };
    });

    expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
    expect(m.canvasPct).toBeGreaterThanOrEqual(0.55);
    expect(m.dlEnViewport).toBe(true);
  });

  test('pestañas: cambio de sección y flujo en menos de 3 vistas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    // Vista única: las 4 secciones accesibles por pestañas sin scroll
    await expect(page.locator('#tabpanel-metadatos')).toBeVisible();
    await page.locator('#tab-marca').click();
    await expect(page.locator('#tabpanel-marca')).toBeVisible();
    await expect(page.locator('#tabpanel-metadatos')).toBeHidden();
    await page.locator('#tab-exportar').click();
    await expect(page.locator('#tabpanel-exportar')).toBeVisible();
    // Descargar sigue visible tras cambiar de pestaña (flujo en 1 vista)
    await expect(page.locator('#download-image')).toBeInViewport();
  });

  test('indicador de sección modificada + restaurar sección', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    const dot = page.locator('[data-dirty-dot="metadatos"]');
    await expect(dot).toBeHidden();

    await page.locator('#metaAuthor').fill('Autora de Prueba');
    await page.waitForTimeout(500);
    await expect(dot).toBeVisible();

    await page.locator('[data-restore="metadatos"]').click();
    await page.waitForTimeout(400);
    await expect(dot).toBeHidden();
    await expect(page.locator('#metaAuthor')).toHaveValue('');
  });

  test('móvil 320px: sin scroll horizontal, barra fija, sheet no tapa el canvas', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await cargarImagen(page);

    const m = await page.evaluate(() => {
      const panel = document.getElementById('workspace-panel').getBoundingClientRect();
      const dl = document.getElementById('mobile-download-btn').getBoundingClientRect();
      return {
        scrollW: document.documentElement.scrollWidth,
        sheetFuera: panel.top >= window.innerHeight, // cerrado: fuera de pantalla
        dlVisible: dl.bottom <= window.innerHeight && dl.width > 0
      };
    });
    expect(m.scrollW).toBeLessThanOrEqual(320);
    expect(m.sheetFuera).toBe(true);
    expect(m.dlVisible).toBe(true);

    // Abrir el sheet y cambiar de pestaña
    await page.locator('#mobile-panel-toggle').click();
    await page.waitForTimeout(400);
    await page.locator('#tab-ajustes').click();
    await expect(page.locator('#tabpanel-ajustes')).toBeVisible();
  });
});
