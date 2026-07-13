// MnemoTag — Capturas de regresión visual (v3.6.0).
//
// Regresión visual de las 8 combinaciones obligatorias (4 viewports × tema).

const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x568', width: 320, height: 568 },
];
const THEMES = ['light', 'dark'];
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`captura ${vp.name} ${theme}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Una baseline canónica evita triplicar snapshots por motor.');
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((t) => {
        localStorage.setItem('theme', t);
      }, theme);
      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');
      // Estabilizar: desactivar animaciones/transiciones para capturas deterministas
      await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${vp.name}-${theme}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });
  }
}
