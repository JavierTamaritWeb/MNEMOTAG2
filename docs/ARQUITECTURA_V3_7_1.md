# Arquitectura MnemoTag v3.7.1

**Fecha:** 13 de julio de 2026
**Estado:** implementada y protegida por pruebas

## Objetivo

La v3.7.1 reduce el acoplamiento de `main.js` sin romper los nombres globales que usa la aplicacion. El orquestador conserva la carga de imagen y el wiring general, mientras el estado compartido, la composicion del documento y las funciones de cada subsistema tienen propietarios explicitos.

## Flujo de estado

`AppState` es la fachada unica para el estado compartido que consumen managers:

```text
UI / managers
    |
    | setters explicitos
    v
AppState --------------------> subscribe('clave', listener)
    |                                      |
    |                                      +--> estimacion de export
    |                                      +--> autosave de sesion
    |                                      +--> consumidores futuros
    v
variables compatibles de main.js
```

Contrato:

- `AppState.subscribe(key, fn)` devuelve una funcion de desuscripcion.
- `AppState.subscribe('*', fn)` recibe toda mutacion que pase por un setter.
- El callback recibe `(value, previousValue, key)`.
- Un listener que lanza una excepcion no bloquea la mutacion ni al resto.
- Una asignacion sin cambio estricto no emite evento.
- Los managers nuevos no deben escribir directamente las variables de `main.js`.

## Render canonico

Solo `js/managers/document-renderer.js` define `renderDocument`:

```js
DocumentRenderer.renderDocument(state, targetCanvas);
window.renderDocument === DocumentRenderer.renderDocument;
```

Orden de composicion:

```text
sourceImage
  -> filtros en el contexto
  -> WatermarkManager.renderConfig
  -> TextLayerManager.renderLayerCollection
  -> targetCanvas
```

Consumidores:

- Preview estandar: `renderMainDocument`, adaptador interno que prepara el snapshot y publica bounds.
- Preview con worker: usa como fuente un canvas con los pixeles ya procesados y delega las pasadas restantes.
- Exportacion: `ExportManager` crea un canvas destino y llama directamente al compositor.
- Batch: `BatchManager` decodifica cada archivo bajo demanda y llama al mismo compositor.

No se admiten rutas alternativas que reimplementen filtros, watermarks o capas. Las diferencias entre preview/export/batch se expresan mediante el snapshot (`watermarkMode`, `textLayerMode`, `filterString`, dimensiones de referencia).

## Propietarios por subsistema

| Modulo | Responsabilidad |
|---|---|
| `WatermarkManager` | Configuracion, persistencia, cache, render, bounds, marcadores y drag raton/tactil |
| `DocumentRenderer` | Composicion unica sobre cualquier canvas destino |
| `ExportManager` | Snapshot de AppState, codificacion, EXIF, descarga, share y estimacion |
| `HistoryManager` | Captura/restauracion de bitmap y estado compartido via AppState |
| `ZoomPanManager` | Zoom, pan y sincronizacion de controles via AppState |
| `BatchManager` | Cola, concurrencia, decodificacion bajo demanda y render canonico |
| `BatchUIManager` | Modal, lista segura, progreso, cancelacion y ZIP |
| `TextLayerUIManager` | Panel, seleccion, render de capas y controles |
| `SessionManager` | Persistencia IndexedDB y planificacion del autosave |
| `SessionCoordinator` | Serializacion/restauracion del documento y formulario |
| `RulerManager` | Reglas y overlays metricos |
| `ComparisonManager` | Comparacion antes/despues y cache visual |
| `MobileManager` | Pinch, orientacion y comportamiento movil |
| `EditorShortcutManager` | Registro y modal de atajos |
| `main.js` | Carga de imagen, wiring general y adaptadores de compatibilidad |

## Persistencia de sesion

La imagen se almacena como `ArrayBuffer`, junto a nombre, MIME y fecha. Al restaurar se reconstruye un `File`. Esta representacion evita el `UnknownError` que WebKit puede producir al clonar `File` o `Blob` dentro de IndexedDB.

Las escrituras resuelven al completar la transaccion, no al recibir `request.onsuccess`. `SessionManager.flushAutoSave()` fuerza el trabajo pendiente y espera el commit real.

## PWA

- Manifest canonico: `images/site.webmanifest`.
- Manifest legacy eliminado: `images/favicon_io/site.webmanifest`.
- Iconos `any`: 192 y 512 px existentes.
- Iconos `maskable`: `maskable-192x192.png` y `maskable-512x512.png`, con zona segura opaca.
- Service worker y cache versionados con `mnemotag-v3.7.1`.

## Contratos de no regresion

- `main.js` debe mantenerse por debajo de 5.000 lineas.
- Solo debe existir una definicion `function renderDocument`.
- Preview, export y batch deben contener una llamada a `DocumentRenderer.renderDocument`.
- `ExportManager`, `HistoryManager`, `ZoomPanManager` y `BatchManager` deben consumir `AppState`.
- `downloadImageEnhanced`, `renderImageForBatch` y `redrawCompleteCanvas()` no deben reaparecer.
- El HTML debe apuntar al manifest canonico y este debe declarar ambos iconos maskable.
- Los cambios de layout deben pasar las ocho capturas y el control anti-desborde a 320 px.

## Resultado

- `main.js`: 4.877 lineas.
- Bundle: 36 fuentes JavaScript ordenadas por Gulp.
- Managers: 27.
- Node: 283/283.
- Binario: 92/92.
- E2E: 81 ejecutados en verde y 18 omisiones deliberadas dependientes del motor.
