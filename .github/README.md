# GitHub Actions workflows

Tres workflows automatizan el ciclo de calidad de MnemoTag.

## `test.yml` — CI

Ejecuta los dos runners Node en cada `push` y `pull_request` contra `main`:

- `node tests/run-in-node.js` — 186 aserciones de la suite principal.
- `node tests/binary-validation.js` — 86 aserciones de validacion binaria PNG/WebP/AVIF.

Si alguno falla, el job queda rojo. Tiempo tipico: 30-60 segundos.

## `lint.yml` — Linting

Ejecuta ESLint 9 y Stylelint 16 via `npx --yes` en cada push/PR.

## `e2e.yml` — Playwright E2E

Instala Chromium via `npx playwright install`, arranca un servidor Python
y ejecuta 5 smoke tests que verifican carga, managers, botones y upload.

## `deploy.yml` — CD a GitHub Pages

Tras cada `push` a `main`, re-ejecuta los tests y despliega la app como
sitio estatico. La URL publica:

```
https://javiertamaritweb.github.io/MNEMOTAG2/
```

### Activar GitHub Pages (una sola vez)

1. `Repository > Settings > Pages`
2. Source: **GitHub Actions**
3. Guardar y re-ejecutar el workflow

## Build system

Desde v3.5.0 el proyecto usa `package.json` con Gulp 5 como build tool.
Los workflows de CI usan Node para ejecutar los tests (JavaScript puro,
sin dependencias npm). El build de Gulp es solo para desarrollo local.
