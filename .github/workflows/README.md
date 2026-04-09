# GitHub Actions workflows

Dos workflows automatizan el ciclo de calidad y publicación de MnemoTag.
Sin npm, sin `package.json`, sin secrets — coherente con la naturaleza
static-only del proyecto.

## `test.yml` — CI

Ejecuta los dos runners Node sin dependencias en cada `push` y `pull_request`
contra `main`:

- `node tests/run-in-node.js` — 100 aserciones de la suite principal.
- `node tests/binary-validation.js` — 36 aserciones de validación binaria PNG/WebP.

Si alguno falla, el job queda rojo. Tiempo típico: 30–60 segundos.

## `deploy.yml` — CD a GitHub Pages

Tras cada `push` a `main`, re-ejecuta los tests y, si pasan, despliega la
app a GitHub Pages como sitio estático. La URL pública será algo como:

```
https://javiertamaritweb.github.io/MNEMOTAG2/
```

El workflow se puede re-disparar manualmente desde la pestaña **Actions**
del repositorio (`workflow_dispatch`).

## ⚠️ Acciones manuales necesarias en la UI de GitHub (una sola vez)

Estos pasos no se pueden automatizar desde el código del repositorio
porque requieren permisos de admin sobre la configuración del repo.

### 1. Activar GitHub Pages

La primera ejecución de `deploy.yml` **fallará** con un error claro
porque Pages no está activado. Para activarlo:

1. Ve a `Repository → Settings → Pages`.
2. En **Source**, selecciona **GitHub Actions** (NO "Deploy from a branch").
3. Guarda.
4. Vuelve a `Actions → Deploy to GitHub Pages → último run` y haz click en
   **Re-run all jobs**.
5. Espera ~2-3 minutos. La URL pública aparecerá en el resumen del workflow
   y también en `Settings → Pages`.

### 2. (Opcional pero recomendado) Activar branch protection

Si en algún momento empieza a haber colaboradores o trabajas con PRs:

1. Ve a `Repository → Settings → Branches → Add rule`.
2. Pattern: `main`.
3. Marca **"Require status checks to pass before merging"**.
4. Busca y selecciona **"Run Node test suites"** como required check.
5. Guarda.

A partir de ahí, ningún PR podrá mergearse a `main` si los tests fallan.

## Lo que NO hacen estos workflows

- **No introducen npm en el código de la app.** El `node` que usan los
  runners es solo para ejecutar los tests existentes, que están escritos
  en JavaScript puro sin dependencias.
- **No tocan el código de la app.** El deploy es del repo entero como
  archivo estático, sin build step.
- **No usan secrets.** Todo lo que necesitan está en el repositorio público.
- **No hacen preview deployments por PR.** Si en el futuro hay
  colaboradores reales, se puede añadir un workflow más con
  `actions/upload-pages-artifact` por rama.
- **No corren tests E2E con Playwright.** Si en algún momento se monta
  Playwright (sesión dedicada), habrá que añadir un job más a `test.yml`.
