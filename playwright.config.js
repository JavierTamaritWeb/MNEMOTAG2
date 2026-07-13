// Playwright config para el smoke test E2E de MnemoTag (v3.4.13).
//
// Sin package.json: se ejecuta via `npx playwright@latest test`.
// El webServer arranca un HTTP server simple con Python (siempre
// disponible en GitHub Actions y macOS/Linux) para servir el proyecto
// en http://localhost:8080.

module.exports = {
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 60000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.03 }
  },
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    // Python 3 está disponible en todas las runner images de GitHub
    // Actions y en macOS/Linux modernos. No introduce dependencia en
    // el repo.
    command: 'python3 -m http.server 8080',
    url: 'http://localhost:8080/index.html',
    reuseExistingServer: true,
    timeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--enable-precise-memory-info'] }
      }
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' }
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' }
    }
  ]
};
