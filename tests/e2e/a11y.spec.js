// MnemoTag — Auditoría de accesibilidad con axe-core (v3.5.14).
//
// Criterio de aceptación de la v3.5.14: cero incidencias SERIAS o CRÍTICAS
// de axe en la página principal y con el modal de atajos abierto.
// Las incidencias moderate/minor no bloquean (se listan en consola con
// PWDEBUG para poder revisarlas), pero serious/critical hacen fallar el test.

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

function seriousViolations(results) {
  return results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
}

function formatViolations(violations) {
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.length} nodo(s): ` +
      v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '))
    .join('\n');
}

test.describe('Accesibilidad (axe-core)', () => {
  test('la página principal no tiene incidencias serias ni críticas', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    const serious = seriousViolations(results);

    expect(serious, formatViolations(serious)).toEqual([]);
  });

  test('el modal de atajos abierto no tiene incidencias serias ni críticas', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    // Abrir el modal de atajos (se genera dinámicamente desde el registro)
    await page.evaluate(() => window.openShortcutsModal());
    await expect(page.locator('#shortcuts-modal')).toBeVisible();
    // El grid debe haberse generado desde el registro real
    await expect(page.locator('#shortcuts-grid .shortcut-section').first()).toBeVisible();

    // Esperar a que termine la animación de entrada (slideIn 0.3s): axe
    // muestrea los colores computados y a mitad de fade reporta falsos
    // positivos de contraste (p. ej. #334155 medido como #c0c4ca).
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .include('#shortcuts-modal')
      .analyze();
    const serious = seriousViolations(results);

    expect(serious, formatViolations(serious)).toEqual([]);
  });

  test('el modal de lote abierto no tiene incidencias serias ni críticas', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => window.openBatchModal());
    await expect(page.locator('#batch-modal')).toBeVisible();
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .include('#batch-modal')
      .analyze();
    const serious = seriousViolations(results);

    expect(serious, formatViolations(serious)).toEqual([]);
  });
});
