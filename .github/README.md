# GitHub Actions

Los workflows de CI (`test.yml`, `lint.yml`, `e2e.yml`) fueron eliminados
en v3.5.7. Los tests se ejecutan manualmente:

```bash
npm test                         # 217 + 86 = 303 aserciones
node tests/run-in-node.js        # 217 aserciones de regresion
node tests/binary-validation.js  # 86 aserciones binarias PNG/WebP/AVIF
```

## Build system

El proyecto usa `package.json` con Gulp 5 como build tool:

```bash
npx gulp          # build + watch + browser-sync (se queda esperando)
npx gulp build    # solo compilar (termina)
npm test          # ejecutar tests
```
