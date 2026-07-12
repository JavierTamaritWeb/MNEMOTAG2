// MnemoTag — Capturas de regresión visual (v3.6.0).
//
// NO es un test con aserciones: genera capturas de la página completa en las
// 8 combinaciones exigidas por la fase 3.6.0 (4 viewports × claro/oscuro)
// para comparar antes/después del refactor visual (purga de Tailwind,
// componentes cerrados, subset de Font Awesome).
//
// Uso:  CAPTURE_DIR=/ruta/salida npx playwright test tests/e2e/capture-baseline.spec.js
// Por defecto escribe en test-results/visual-captures/.

const { test } = require('@playwright/test');

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x568', width: 320, height: 568 },
];
const THEMES = ['light', 'dark'];
const OUT = process.env.CAPTURE_DIR || 'test-results/visual-captures';

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`captura ${vp.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((t) => {
        localStorage.setItem('theme', t);
      }, theme);
      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');
      // Estabilizar: desactivar animaciones/transiciones para capturas deterministas
      await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${OUT}/${vp.name}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}
