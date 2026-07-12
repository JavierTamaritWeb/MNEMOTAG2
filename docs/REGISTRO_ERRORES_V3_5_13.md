# Registro de errores y barreras de no regresion — v3.5.13

**Fecha:** 12 de julio de 2026  
**Alcance:** quick wins del roadmap v3.5.12 y cierre visual de la interfaz de carga.

## Incidentes detectados

| Incidente | Causa raiz | Correccion | Barrera permanente |
|---|---|---|---|
| El boton **Procesar en lote** se veia mas bajo que los otros botones de carga. | Un override global aplico `min-height: 0` y `padding: 10px 16px`, anulando las dimensiones de `.upload__button`. | El override por ID conserva `min-height: 56px`, `padding: 16px 36px`, `min-width: 200px` y `gap: 12px`. | La regresion Node comprueba el bloque CSS del ID y exige esas dimensiones. |
| Se retiraron JSZip y heic2any del HTML antes de terminar sus cargadores. | La optimizacion de carga se aplico en el markup y los callers, pero faltaba la implementacion compartida de los loaders. | Cargador unico con promesas compartidas, SRI, `crossOrigin` y degradacion visible ante error. | Las pruebas verifican que no haya scripts iniciales y que existan ambos loaders. |
| El boton de lote del hero tenia `data-action` pero no estaba conectado al router. | Se asumio que el atributo bastaba, aunque el listener de lote vive en un bloque especifico de `main.js`. | Listener explicito `openBatchBtn.addEventListener('click', openBatchModal)`. | Regresion estatica exige el ID, el listener y la apertura del modal. |
| El batch aceptaba formatos distintos a la validacion principal. | `BatchManager` mantenia una lista propia desactualizada y el flujo visual no consultaba siempre `SecurityManager`. | Validacion compartida, AVIF aceptado y GIF rechazado. | Regresion de formatos y validacion en `addBatchImages()` y `BatchManager`. |
| La documentacion y las versiones se desincronizaron. | Se actualizaron `package.json` y algunos documentos sin una comprobacion unica sobre lockfile, cache PWA y guias. | Version 3.5.13 sincronizada en manifests, lockfile, service worker, README y documentacion tecnica. | Regresion de version consistente y checklist de release en el pre-commit. |

## Reglas para que no se repita

1. Todo boton nuevo debe tener un selector especifico por ID, conservar las dimensiones de su selector base y tener una prueba estatica de tamaño.
2. Las dependencias opcionales deben tener un unico loader compartido antes de retirar su `<script>` del HTML.
3. Los flujos de archivo deben validar en la frontera de entrada y antes del procesamiento batch; ninguna lista de MIME duplicada puede ser fuente de verdad.
4. Cada release debe actualizar en la misma operacion `package.json`, `package-lock.json`, `service-worker.js`, README, CHANGELOG, CLAUDE/AGENTS e indices de `docs/`.
5. Antes del commit se ejecutan `npm test`, build, ambos E2E y lint. El hook bloquea el commit si los tests o ESLint fallan.

## Estado de v3.5.13

- 248 pruebas Node.
- 92 validaciones binarias.
- 7 E2E en desarrollo y 7 E2E en `dist`.
- 0 errores de ESLint; las advertencias existentes quedan registradas para una limpieza posterior.
