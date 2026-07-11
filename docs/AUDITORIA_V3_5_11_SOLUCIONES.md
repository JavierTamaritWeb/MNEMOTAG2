# Auditoria y reauditoria severa v3.5.11 — soluciones y reglas de no regresion

**Fecha:** 11 de julio de 2026  
**Objetivo:** documentar las correcciones aplicadas tras la auditoria severa para que no se repitan los mismos errores en futuras refactorizaciones.

---

## Resumen ejecutivo

Las dos auditorias encontraron fallos reales que no estaban cubiertos por los tests existentes: cadena de Web Workers muerta, crop invisible o con controles inoperativos, atajos duplicados, seleccion de capas desincronizada, rotacion acumulativa, agotamiento potencial de memoria en batch, corrupcion potencial de AVIF, EXIF bloqueado por SRI y un despliegue que solo funcionaba en un arbol local con `dist/` preexistente.

La correccion se hizo con dos reglas:

1. Cada fix critico debe tener una prueba de regresion o una asercion binaria que falle si vuelve el bug.
2. Los contratos entre managers deben quedar documentados para evitar incompatibilidades silenciosas.

Verificacion final tras las correcciones:

```bash
npm test
# 237/237 tests Node OK
# 92/92 aserciones binarias OK

npm run build
# OK

npm run lint:js
# 0 errores, warnings no bloqueantes

npm run lint:css
# OK

npm run test:e2e
# 6 passed contra desarrollo

npm run test:e2e:dist
# 6 passed contra dist/ de produccion
```

---

## 1. Web Workers y filtros

### Causa raiz

Habia tres contratos rotos a la vez:

- `FilterManager.scheduleWorkerUpdate()` creaba una funcion debounced con `SmartDebounce.intelligent()` pero no la invocaba.
- `WorkerManager` enviaba `{ id, type, data, options }`, mientras `image-processor.js` esperaba `{ id, imageData, filters }`.
- `FilterManager.applyWithWorker()` llamaba a `WorkerManager.processImage()`, metodo que no existia.

Al arreglar solo uno de esos puntos se exponian divergencias de semantica entre CSS, worker y fallback, asi que se corrigio la cadena completa.

### Solucion aplicada

- `FilterManager` conserva una instancia debounced reutilizable y la invoca.
- `FilterManager` llama a `WorkerManager.processInWorker()`.
- `WorkerManager` envia `imageData` y `operations` de forma explicita.
- `image-processor.js` acepta el protocolo nuevo y mantiene compatibilidad defensiva con el antiguo.
- Worker, fallback y CSS usan la misma semantica: `0` es neutro para brillo, contraste, saturacion, sepia, hue y blur.
- `fallback-processor.js` soporta `hueRotate`/`hue-rotate` y `blur`, y usa brillo multiplicativo compatible con CSS.

### Regla de no regresion

No cambiar el protocolo del worker sin actualizar los tres lados:

1. `js/managers/filter-manager.js`
2. `js/managers/worker-manager.js`
3. `js/image-processor.js`

El contrato actual es:

```js
{
  id: string,
  type: 'process',
  data: {
    imageData: ImageData,
    operations: Array<FilterOperation>
  }
}
```

Cada operacion debe tener forma estable:

```js
{
  type: 'filter',
  name: 'brightness' | 'contrast' | 'saturation' | 'sepia' | 'hue-rotate' | 'blur',
  value: number
}
```

### Tests que protegen este bloque

- `tests/specs/regression.spec.js` — bloque `Regresion — Auditoria severa v3.5.11`
- `tests/e2e/smoke.spec.js` — carga real del bundle en Chromium

---

## 2. Crop: panel, sugerencias y ciclo de vida

### Causa raiz

El flujo de crop acumulaba varios contratos rotos:

- `cropManager.cancelCrop()` no existia.
- `cancelCrop()` llamaba a `applyFilters()`, funcion inexistente.
- `setAspectRatio()` recibia `null` o numeros cuando esperaba una clave string.
- El panel tenia `style="display: none"`, pero `openCropPanel()` solo anadia `.active`; cambiar `transform` no anula un `display:none` inline.
- Los botones enviaban indices numericos, mientras `applyCropSuggestion()` buscaba por nombre, por lo que nunca encontraba una sugerencia.
- El selector de proporcion tenia `onchange` inline y otro listener JS: cada cambio se ejecutaba dos veces.
- Cada reapertura registraba un juego nuevo de listeners de canvas y podia perder las referencias necesarias para desmontar los anteriores.
- Escape desactivaba el manager, pero no cerraba el panel ni sincronizaba el estado visual.

Eso provocaba excepciones al cancelar o cerrar el panel, y dejaba listeners vivos.

### Solucion aplicada

- El cierre del panel usa `cropManager.deactivate()` y refresca la preview con la API real.
- La cancelacion ya no llama funciones inexistentes.
- El selector de proporcion normaliza la entrada antes de llamar a `setAspectRatio()`.
- Despues de cambios que modifican `canvas.width`/`canvas.height`, se recalcula el layout visual con `setupCanvas()` y se actualiza la preview.
- Abrir establece `display:flex` antes de activar la transicion; cerrar retira `.active`, desactiva el manager y oculta el panel al terminar la animacion.
- Las sugerencias se resuelven con `suggestions[index]`, el mismo contrato que usan los botones `data-index`.
- Los controles de proporcion y grid se conectan solo mediante `addEventListener`.
- `CropManager.setupEventListeners()` desmonta primero cualquier juego anterior.
- Escape pasa por `closeCropPanel()` y restaura la preview.

### Regla de no regresion

No llamar metodos de managers por intuicion. Antes de cablear un boton o panel, revisar la API publica real del manager.

Para crop, la API real de control es:

- `CropManager.initCropMode(image)`
- `CropManager.deactivate()`
- `CropManager.setAspectRatio(key)`
- `CropManager.draw()`

La visibilidad del panel pertenece a `main.js`, no al manager. Toda salida —boton cerrar, cancelar, aplicar o Escape— debe converger en `closeCropPanel()`.

Si se agregan nuevos presets, usar claves string estables. No pasar dimensiones numericas directamente a `setAspectRatio()`.

### Tests que protegen este bloque

- `tests/specs/regression.spec.js` protege visibilidad, ausencia de handlers inline, grid, indices y desmontaje.
- `tests/e2e/smoke.spec.js` carga una imagen, confirma la preview, abre el panel, aplica una sugerencia y comprueba el cierre.
- El mismo E2E se ejecuta contra desarrollo y contra `dist/`.

---

## 3. Atajos de teclado

### Causa raiz

Habia varios listeners `keydown` en `document`. `stopPropagation()` no evita que otros listeners del mismo nodo se ejecuten, asi que:

- `Cmd/Ctrl+S` podia descargar dos veces.
- `Cmd/Ctrl+Z` podia deshacer dos pasos.
- `Cmd/Ctrl+=` podia aplicar zoom doble.

### Solucion aplicada

- Se elimino el handler legacy duplicado en `main.js`.
- Los atajos quedan centralizados en el sistema actual.
- Se corrigio la deteccion de redo con `e.key.toLowerCase()` para no depender de `z` vs `Z`.

### Regla de no regresion

Debe existir un solo propietario para atajos globales. Si se anade un atajo:

1. Buscar antes `addEventListener('keydown'`.
2. Confirmar que no existe otro listener global para la misma combinacion.
3. Usar `preventDefault()` solo despues de decidir que el atajo pertenece a la app.
4. No duplicar atajos ya gestionados por `KeyboardShortcuts` o `ZoomPanManager`.

### Tests que protegen este bloque

- `tests/specs/regression.spec.js` comprueba que el handler legacy no vuelve.

---

## 4. Rotacion, resize, zoom y dimensiones visuales

### Causa raiz

Algunas operaciones horneaban pixeles en el canvas pero dejaban estado acumulado o dimensiones CSS antiguas:

- La rotacion podia volver a aplicarse sobre una imagen ya rotada.
- Resize/crop/rotacion cambiaban el tamano real del canvas sin recalcular su tamano visual.
- Al cargar una nueva imagen podia quedar un `transform: scale(...)` antiguo aunque el indicador dijera 100%.

### Solucion aplicada

- La rotacion se normaliza despues de hornear la transformacion.
- Los cambios de dimension llaman a `setupCanvas()` y refrescan overlay/preview.
- La carga de nueva imagen reinicia zoom/pan/transform.
- El fullscreen registra `fullscreenchange` para restaurar estilos si el usuario sale con Escape.

### Regla de no regresion

Toda operacion que cambie pixeles o dimensiones debe dejar sincronizados:

- `canvas.width` / `canvas.height`
- estilos CSS del canvas
- zoom/pan
- posiciones custom de marcas de agua
- historial
- preview

Checklist minimo despues de resize/crop/rotacion/carga:

```js
setupCanvas();
updatePreview();
ZoomPanManager.resetZoom();
```

Usar el reset de zoom solo cuando el cambio invalide la transformacion anterior.

### Tests que protegen este bloque

- `tests/specs/regression.spec.js` cubre `fullscreenchange`, recalculo de canvas y uso de `getCanvasContentRect()`.
- `tests/e2e/smoke.spec.js` valida que la app arranca sin errores de consola criticos.

---

## 5. Batch y ZIP

### Causa raiz

El batch podia perder imagenes sin avisar:

- Los nombres dentro del ZIP se generaban con base y extension hardcodeada.
- Dos archivos con mismo basename pero distinta extension podian colisionar.
- Algunos errores por imagen se contabilizaban como exito.
- El JPEG del batch no aplanaba transparencia, por lo que podia salir negro.
- Los limites permitian 50 imagenes de hasta 8192x8192 y 50 MB cada una, sin presupuesto agregado de pixeles.
- Cada archivo se decodificaba una vez para validar y otra para encolarlo.

### Solucion aplicada

- Los nombres del ZIP conservan el nombre original y aplican extension segun formato real.
- Se evita la sobrescritura silenciosa con nombres unicos.
- Los errores por imagen se propagan al resumen del proceso.
- JPEG en batch usa `flattenCanvasForJpeg()` antes de codificar.
- El lote limita cantidad, tamano por archivo, megapixeles por imagen y megapixeles agregados.
- La imagen decodificada durante la validacion se reutiliza al crear `imageData`.

### Regla de no regresion

El batch no debe tener una implementacion visual paralela a la preview. Debe usar el `renderFn` capturado desde `main.js` para que filtros, marcas de agua y composicion sean identicos.

Al exportar a ZIP:

- Nunca hardcodear `.jpeg`.
- Nunca usar solo `baseName` como clave final.
- Contar fallos y exitos por separado.
- Aplanar transparencia si `finalMimeType === 'image/jpeg'`.
- Presupuestar memoria por pixeles decodificados, no solo por bytes comprimidos.
- No volver a llamar `loadImageElement()` despues de una validacion que ya devolvio el elemento decodificado.

### Tests que protegen este bloque

- `tests/specs/regression.spec.js` mantiene regresiones de batch v3.5.6+.
- `tests/e2e/smoke.spec.js` cubre carga basica de imagen.

---

## 6. AVIF EXIF

### Causa raiz

La inyeccion AVIF era defensiva, pero dos layouts validos podian generar offsets corruptos sin disparar la defensa:

- `base_offset_size=4` con `base_offset=0`: se desplazaba el offset dos veces.
- Boxes top-level entre `meta` y `mdat` se perdian al reconstruir el archivo.

Ademas, `iref` version 1 requiere IDs de 32 bits; escribir IDs de 16 bits corrompe `meta`.

### Solucion aplicada

- La reconstruccion conserva boxes top-level intermedios como `free`.
- Los offsets solo se desplazan cuando realmente apuntan a datos movidos por el crecimiento de `meta`.
- `base_offset=0` se trata como base relativa nula, no como offset absoluto a desplazar dos veces.
- `iref` respeta el tamano de ID segun version.
- Se ampliaron los tests binarios con AVIF sinteticos que cubren los dos layouts problematicos.

### Regla de no regresion

En AVIF/ISOBMFF no basta con validar magic bytes. Cualquier cambio debe preservar:

- Orden y contenido de boxes top-level no modificadas.
- `ftyp` intacto.
- `meta` reconstruido con `iinf`, `iref`, `iloc` coherentes.
- `mdat` con payload original intacto.
- Offsets existentes ajustados exactamente una vez.

No aceptar un cambio AVIF sin ampliar `tests/binary-validation.js` si introduce una nueva variante de `iloc`, `iref`, `meta`, `mdat` o boxes intermedias.

### Tests que protegen este bloque

- `tests/binary-validation.js`:
  - AVIF sintetico base.
  - AVIF con `free` entre `meta` y `mdat`.
  - AVIF con `base_offset_size=4` y `base_offset=0`.

---

## 7. Exportacion y fallback de formatos

### Causa raiz

Si `canvas.toBlob()` fallaba para WebP/AVIF, el fallback podia devolver JPEG/PNG mientras el nombre del archivo mantenia extension `.webp` o `.avif`.

### Solucion aplicada

- La cadena de exportacion valida el MIME final antes de guardar.
- Los caminos fallback degradan con formato y extension coherentes.
- JPEG se aplana antes de codificar para evitar zonas negras con alpha.
- El overlay de progreso se oculta antes de abrir dialogos bloqueantes.

### Regla de no regresion

El formato real del `Blob` manda sobre la extension solicitada. Antes de guardar:

1. Resolver MIME final.
2. Resolver extension final desde MIME real.
3. Aplicar EXIF segun MIME final.
4. Abrir dialogo solo cuando el overlay este oculto.

---

## 8. Metadatos generales

### Causa raiz

Algunos campos validos se perdian por coerciones:

- GPS `0` se descartaba con `parseFloat(...) || null`.
- Fechas podian moverse un dia por parseo UTC + formateo local.
- WebP podia recibir un segundo chunk `EXIF`.
- PNG podia escribir CRC 0 si `crc32` no estaba disponible.

### Solucion aplicada

- Coordenadas se parsean diferenciando `NaN` de `0`.
- Fechas se manejan como fecha local del formulario.
- WebP reemplaza o normaliza EXIF existente en vez de duplicar chunks.
- PNG aborta defensivamente si falta `crc32`.

### Regla de no regresion

No usar `||` para valores numericos de formulario cuando `0` sea valido. Usar `Number.isFinite()` o `??` segun corresponda.

Ejemplo correcto:

```js
const latitude = Number.parseFloat(input.value);
const normalizedLatitude = Number.isFinite(latitude) ? latitude : null;
```

---

## 9. Capas de texto y valores falsy

### Causa raiz

Algunos valores validos se destruian por usar `||`:

- `opacity: 0`
- `position.x = 0`
- `position.y = 0`

Tambien habia listeners hacia IDs inexistentes (`layer-*` en vez de `text-layer-*`).

La reauditoria encontro dos fuentes de seleccion: `activeLayerId` en `main.js` y `TextLayerManager.activeLayerId`. Al seleccionar visualmente otra capa solo cambiaba la primera; Backspace y duplicar consultaban la segunda y podian actuar sobre una capa distinta o sobre una capa oculta despues de cerrar el panel.

### Solucion aplicada

- Se usa `??` para defaults donde `0` es valido.
- Se centralizo el acceso a controles con `getTextLayerControl(id)`.
- Los listeners apuntan a IDs reales.
- Se eliminaron asignaciones condicionales que rompian ESLint `no-cond-assign`.
- `selectTextLayer()` valida la capa y sincroniza ambos estados mediante `setActiveLayer()`.
- Cerrar el panel limpia tambien el estado del manager con `clearActiveLayer()`.
- Los atajos usan el `activeLayerId` visual y vuelven a sincronizar la seleccion despues de eliminar o duplicar.

### Regla de no regresion

En capas de texto, `0` casi siempre es un valor valido. No usar:

```js
layer.opacity || 100
layer.position.x || 0
```

Usar:

```js
layer.opacity ?? 100
layer.position?.x ?? 0
```

No introducir una tercera fuente de seleccion. Cualquier seleccion programatica debe pasar por `selectTextLayer(layerId)`; cualquier cierre debe limpiar ambas representaciones.

---

## 10. UI, listeners y toasts

### Causa raiz

Habia fugas o estados obsoletos:

- Toast cerrado con `x` podia quedar en `activeToasts`.
- Escape de modal podia reejecutar callbacks.
- Header accesible podia abrir y cerrar en el mismo evento.
- `fullscreenchange` no estaba registrado.

### Solucion aplicada

- Cierre de toast limpia el Set.
- Listeners temporales se registran y eliminan con una sola responsabilidad.
- Eventos de teclado en headers evitan doble toggle.
- `fullscreenchange` se registra globalmente.

### Regla de no regresion

Todo listener temporal debe tener una estrategia de desmontaje clara. Si un componente guarda estado global (`Set`, arrays de elementos, flags), el cierre manual y el cierre automatico deben limpiar el mismo estado.

---

## 11. Presets y almacenamiento

### Causa raiz

Un preset llamado `index` podia colisionar con la clave interna del indice de presets.

### Solucion aplicada

- Las claves de usuario se guardan con prefijo propio.
- El indice interno no comparte namespace con nombres elegidos por el usuario.

### Regla de no regresion

Nunca mezclar claves internas y nombres de usuario en el mismo namespace de `localStorage`. Usar prefijos distintos:

```js
mnemotag-presets:index
mnemotag-presets:item:<nombre>
```

---

## 12. Tooling y tests

### Problemas encontrados

- Stylelint estaba parseando SCSS como CSS plano.
- Playwright usaba sintaxis ESM sin que el proyecto declarara `"type": "module"`.
- Los tests Node estaban verdes pero no cubrian flujos rotos en navegador real.
- ESLint no estaba instalado localmente y `npx` dependia de red.
- El smoke llamado "botones clicables" solo comprobaba que existieran en el DOM.
- Los E2E servian la raiz, pero no `dist/index.html` como artefacto autocontenido.

### Solucion aplicada

- `.stylelintrc.json` usa `customSyntax: "postcss-scss"` para SCSS.
- Playwright se ajusto a CommonJS.
- Se agregaron regresiones de auditoria y casos binarios AVIF.
- El smoke E2E valida carga real del bundle, managers globales y ausencia de errores criticos de consola.
- ESLint 9 queda fijado en `devDependencies`; `js/vendor/**` y `dist/**` se excluyen por ser dependencia externa y artefactos generados.
- `test:e2e` valida desarrollo y `test:e2e:dist` sirve exclusivamente `dist/`.
- El E2E de crop realiza acciones reales; no se limita a `toBeAttached()`.

### Regla de no regresion

Antes de una release, ejecutar como minimo:

```bash
npm test
npm run build
npm run lint:js
npm run lint:css
npm run test:e2e
npm run test:e2e:dist
```

Si Playwright falla arrancando el servidor por permisos locales, repetirlo en un entorno con permiso para abrir el puerto definido en `playwright.config.js`.

---

## 13. EXIF y dependencias externas

### Causa raiz

`piexifjs` se cargaba desde una URL minificada dinamicamente de jsDelivr con SRI. El propio recurso advierte que no admite SRI estable: distintos nodos entregaron variantes con hashes distintos y Chromium bloqueo la libreria. Como los cuatro formatos construyen el TIFF con `piexif`, JPEG, PNG, WebP y AVIF dejaron de escribir metadatos a la vez y degradaron silenciosamente.

### Solucion aplicada

- `piexifjs@1.0.6` se sirve desde `js/vendor/piexif.min.js`.
- Gulp copia el archivo a `dist/js/vendor/`.
- El service worker lo incluye en precache.
- Playwright exige `typeof window.piexif === 'object'`.

### Regla de no regresion

No aplicar SRI a recursos que el proveedor genera dinamicamente. Para una dependencia critica del pipeline y pequena, preferir una copia local versionada con licencia/cabecera conservada. Si cambia la dependencia, verificar desarrollo y `dist/`.

---

## 14. GitHub Pages y checkout limpio

### Causa raiz

La demo enlazada respondia 404: `dist/` esta correctamente ignorado, pero no habia un workflow activo que lo generase y publicase. El primer workflow nuevo fallo porque ejecutaba `npm test` antes de `npm run build`; tres specs leen `dist/css/styles.css` y solo pasaban localmente porque el desarrollador ya tenia `dist/` generado. Despues, Actions no pudo crear por primera vez el sitio Pages con su token de integracion.

### Solucion aplicada

- `.github/workflows/deploy.yml` hace checkout, `npm ci`, build, tests, lint, upload y deploy.
- El build ocurre antes de los tests que inspeccionan `dist/`.
- GitHub Pages se habilito una vez con fuente `workflow` mediante una cuenta autorizada.
- El workflow publica exclusivamente `dist/`.
- La URL publica se verifico con HTTP 200 despues del despliegue.

### Regla de no regresion

Un release debe funcionar desde un checkout limpio. Nunca confiar en un `dist/` local ignorado. El orden obligatorio del job es:

```text
npm ci -> npm run build -> npm test -> lint -> upload dist -> deploy
```

No eliminar `deploy.yml` mientras README anuncie una demo en GitHub Pages. Si Pages se recrea o transfiere, habilitar previamente la fuente GitHub Actions en la configuracion del repositorio.

### Verificacion remota

```bash
gh run list --workflow deploy.yml --limit 1
gh run watch <run-id> --exit-status
curl -I https://javiertamaritweb.github.io/MNEMOTAG2/
```

No considerar terminado un push de release hasta que el workflow concluya correctamente y la URL publica responda 200.

---

## Checklist obligatorio antes de tocar estas zonas

### Filtros/workers

- Confirmar contrato `imageData + operations`.
- Confirmar neutralidad `0`.
- Probar worker y fallback.
- No cambiar el orden de operaciones sin test visual o regresion.

### Crop/rotacion/resize

- Confirmar que no hay metodos inexistentes.
- Recalcular `setupCanvas()` si cambia el tamano real.
- Guardar historial solo despues de completar una operacion valida.
- Resetear o reclampear zoom/pan cuando corresponda.
- Confirmar que el panel pasa de `display:none` a visible y vuelve a ocultarse.
- Abrir/cerrar varias veces y comprobar que no se multiplican listeners.
- Probar al menos una sugerencia por click real.

### Export/batch

- Resolver MIME real antes de extension.
- Aplanar JPEG con alpha.
- No tragar errores por imagen.
- No duplicar logica visual fuera del render principal.
- Aplicar presupuesto agregado de pixeles al lote.

### Metadatos binarios

- PNG: no escribir `eXIf` sin CRC valido.
- WebP: no duplicar chunks `EXIF`.
- AVIF: conservar boxes intermedias y validar offsets con tests binarios.

### UI global

- Un solo propietario por atajo global.
- Todo listener temporal debe desmontarse.
- No usar `dark:` de Tailwind; usar `[data-theme="dark"]`.
- No usar `||` para defaults donde `0` sea valido.
- Mantener una sola seleccion efectiva de capa y sincronizar manager/UI.

### Release y despliegue

- Ejecutar E2E contra raiz y contra `dist/`.
- Probar desde checkout limpio o CI, nunca solo con artefactos locales.
- Esperar el workflow Pages y comprobar HTTP 200.
- Confirmar que dependencias criticas locales se copian a `dist/` y precache.

---

## Donde estan las pruebas de proteccion

| Riesgo | Archivo de test |
|---|---|
| Contrato worker/filtros | `tests/specs/regression.spec.js` |
| Crop/fullscreen/atajos | `tests/specs/regression.spec.js` |
| Crop funcional real | `tests/e2e/smoke.spec.js` en desarrollo y `dist/` |
| Seleccion de capas | `tests/specs/regression.spec.js` |
| Disponibilidad de piexif | `tests/e2e/smoke.spec.js` |
| AVIF offsets/boxes | `tests/binary-validation.js` |
| Carga real en navegador | `tests/e2e/smoke.spec.js` |
| Regresiones historicas | `tests/specs/regression.spec.js` |
| Seguridad/metadatos/helpers | `tests/specs/*.spec.js` |

---

## Nota para futuras auditorias

Los tests Node son utiles como smoke rapido, pero no sustituyen:

- navegador real para Canvas, eventos, workers y CDN/SRI;
- tests binarios para contenedores PNG/WebP/AVIF;
- revision de contratos entre managers cuando se extrae codigo desde `main.js`.

Si una correccion solo cambia texto de tests sin cubrir el flujo que fallo, no se considera cerrada.

Del mismo modo, un build local verde no demuestra que el despliegue funcione: CI debe partir de checkout limpio y la URL publica debe verificarse despues de publicar.
