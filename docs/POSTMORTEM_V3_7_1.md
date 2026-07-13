# Postmortem y reglas de no regresion v3.7.1

**Fecha:** 13 de julio de 2026
**Alcance:** extraccion arquitectonica, UI responsive y release

## Resumen

La migracion termino con el estado observable, el render canonico y `main.js` por debajo de 5.000 lineas. La validacion multiplataforma encontro cuatro errores de integracion que no aparecian en las pruebas de fuente. Todos se corrigieron antes de versionar y cada causa tiene una barrera automatica o una regla operativa.

## Error 1: build `dist` obsoleta durante E2E

**Sintoma:** carga de imagen bloqueada y `ReferenceError` para `WatermarkManager`, `TextLayerUIManager` y `ComparisonManager`.

**Causa raiz:** Gulp ya incluia los managers nuevos, pero `index.html` ejecuta `dist/js/app.min.js`; la primera repeticion E2E uso un bundle construido antes de que esos archivos existieran.

**Correccion:** reconstruir `dist` antes de validar integracion y repetir la matriz completa.

**No regresion:**

- Toda prueba de release empieza por `npm run build`.
- `test:e2e:dist` valida exclusivamente los artefactos generados.
- Un fallo global de inicializacion se investiga desde consola/traza antes de tocar la funcionalidad probada.

## Error 2: drag de watermark dependiente de bounds y overlay

**Sintoma:** la posicion personalizada existia, pero el drag no comenzaba o terminaba en el primer movimiento.

**Causas raiz:**

- Una carrera entre preview estandar/worker podia dejar `textWatermarkBounds` a `null`.
- El marcador DOM de 20 px interceptaba eventos destinados al canvas.
- La prueba agarraba un texto autoescalado cerca del borde derecho; el primer paso salia del canvas y disparaba `mouseleave`.

**Correccion:**

- `WatermarkManager.measureCurrentTextBounds()` recalcula geometria bajo demanda.
- El hit-testing incluye el borde visible de seleccion.
- Los marcadores usan `pointer-events: none`.
- El E2E calcula el punto desde los bounds reales y confirma estado tras `mousedown` y `mousemove`.

**No regresion:** el escenario corre en Chromium, Firefox y WebKit y verifica posicion, bitmap y undo.

## Error 3: IndexedDB de WebKit rechazaba la sesion

**Sintoma:** Chromium y Firefox ofrecian restaurar; WebKit devolvia `UnknownError` al guardar.

**Causas raiz:**

- Clonar `File` y despues `Blob` dentro del registro no fue fiable en WebKit.
- `request.onsuccess` no equivale a una transaccion confirmada; una recarga podia cerrar la pagina antes del commit.

**Correccion:**

- La imagen se serializa como `ArrayBuffer` y se reconstruye como `File` al restaurar.
- `_withStore` resuelve en `tx.oncomplete` y rechaza en `onerror/onabort`.
- `flushAutoSave()` espera recoleccion asincrona y commit.

**No regresion:** el E2E fuerza flush, recarga, restaura la imagen y comprueba un valor de formulario en los tres motores.

## Error 4: inconsistencia visual en botones de carga

**Sintoma:** "Procesar en lote" tenia altura/padding distintos y en movil los botones se recortaban o solapaban.

**Causa raiz:** overrides historicos competian con reglas globales y los tres controles no compartian un contenedor responsive estable.

**Correccion:** `upload__actions` fija el layout; los tres `.upload__button` comparten dimensiones y estilo especifico en claro/oscuro, y pasan a columna en movil.

**No regresion:** capturas en 1440×900, 1024×768, 390×844 y 320×568, cada una en tema claro y oscuro.

## Error 5: dos funciones llamadas `renderDocument`

**Sintoma:** el compositor real era unico, pero `main.js` conservaba un adaptador con el mismo nombre, debilitando el contrato solicitado.

**Causa raiz:** el adaptador preparaba opciones y publicaba bounds, por lo que sobrevivio al reemplazo de las rutas duplicadas.

**Correccion:** renombrarlo a `renderMainDocument`; `DocumentRenderer.renderDocument` queda como unica definicion y `window.renderDocument` como alias publico.

**No regresion:** spec de fuente que exige ausencia de `function renderDocument` en `main.js` y presencia del adaptador con nombre explicito.

## Validacion del release

| Control | Resultado |
|---|---|
| Lighthouse movil, produccion gzip | Rendimiento 96, accesibilidad 100 |
| Web Vitals de laboratorio | FCP 2,0 s; LCP 2,4 s; TBT 0 ms; CLS 0 |
| Axe | 0 serious / 0 critical |
| Visual | 8/8 combinaciones |
| E2E desarrollo | 81 passed / 18 skipped deliberados |
| Node | 283/283 |
| Binario | 92/92 |
| Lint | ESLint 0 errores; Stylelint verde |
| `main.js` | 4.877 lineas |
| Batch 20 JPEG | pico +620.713 B; sin decodificados/base64 retenidos en cola |

El delta de heap tras limpiar fue +1.460.970 B. Es inferior en dos ordenes de magnitud al presupuesto de 128 MB y no incluye referencias decodificadas en la cola; pequeñas diferencias son esperables por caches internos y trabajo asincrono del navegador.

## Checklist obligatorio futuro

1. Ejecutar build limpio antes de cualquier E2E de release.
2. Ejecutar Node, binario y ambos linters.
3. Ejecutar la matriz completa en los tres motores.
4. Revisar las ocho capturas, no solo regenerarlas.
5. Medir memoria con `--enable-precise-memory-info` y fixture real.
6. Medir Lighthouse con compresion equivalente al hosting de produccion.
7. Probar carga, watermark+undo, crop+undo, batch y export JPEG con EXIF.
8. Sincronizar version en package, service worker, README, changelog, guias y `dist`.
