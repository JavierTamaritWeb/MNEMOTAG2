# GitHub Actions

Los workflows de CI independientes (`test.yml`, `lint.yml`, `e2e.yml`) fueron
eliminados en v3.5.7. `deploy.yml` valida, construye y publica `dist/` en
GitHub Pages en cada push a `main`. Los tests también se pueden ejecutar
manualmente:

```bash
npm test                         # Node + binarios
npm run test:e2e                 # Chromium contra la raíz de desarrollo
npm run test:e2e:dist            # Chromium contra dist/ de producción
npm run lint:js                  # ESLint local
npm run lint:css                 # Stylelint local
```

## Build system

El proyecto usa `package.json` con Gulp 5 como build tool:

```bash
npx gulp          # build + watch + browser-sync (se queda esperando)
npx gulp build    # solo compilar (termina)
npm test          # ejecutar tests
```
