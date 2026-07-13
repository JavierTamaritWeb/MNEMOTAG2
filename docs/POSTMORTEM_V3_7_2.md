# Postmortem v3.7.2: marcas de agua en preview y lote

## Impacto

La marca de agua de imagen podía mostrar su miniatura en el formulario sin aparecer en el canvas ni en el lote. Tras cargar una imagen, los dos accesos existentes al lote quedaban ocultos: uno pertenecía a la zona de carga y el otro estaba dentro de «Herramientas avanzadas».

## Errores cometidos

1. La extracción de `WatermarkManager` conservó la carga asíncrona en una función legacy, pero el nuevo compositor capturaba `AppState.watermarkImagePreview` antes de que existiera.
2. `BatchUIManager` mostraba casillas «Aplicar a todas las imágenes», pero siempre capturaba filtros, marcas y capas sin consultar su estado.
3. La revisión de arquitectura comprobó contratos y rutas de render, pero no inspeccionó los píxeles finales de una marca de imagen real.
4. El acceso al lote del editor quedó dentro de un `details` cerrado; no se validó su visibilidad después de cargar una imagen.

## Solución

- `WatermarkManager.ensureImageReady()` centraliza la decodificación, cachea por identidad de archivo, publica la imagen en `AppState` y evita que una carga antigua sustituya a una selección más reciente.
- Preview, aplicación manual y lote esperan esa promesa antes de capturar o renderizar.
- `BatchManager.captureCurrentConfig()` recibe opciones explícitas y usa `watermarkMode: 'none'` cuando «Marcas de agua» está desmarcada.
- La barra principal del editor incluye un acceso permanente «Procesar en lote» conectado al mismo modal.

## Reglas de no regresión

1. Ninguna ruta puede capturar una marca de imagen antes de `ensureImageReady()`.
2. Preview, export y lote deben componer mediante `DocumentRenderer`; no se admiten renderizadores paralelos.
3. Una casilla visible debe gobernar el estado real que describe. No se aceptan controles decorativos.
4. Las pruebas de marcas de agua deben validar píxeles del canvas o del archivo, no solo buscar nombres de funciones.
5. El flujo crítico se prueba en Chromium, Firefox y WebKit con la casilla de lote activa y desactiva.
6. «Procesar en lote» debe ser visible tanto antes como después de cargar una imagen y no puede depender de desplegar herramientas avanzadas.

## Prueba protectora

`tests/e2e/v371.spec.js` carga una foto y una marca PNG real, verifica un píxel rojo dentro de sus bounds, procesa un lote y comprueba el mismo píxel sobre el `Blob` resultante. Después desmarca «Marcas de agua» y exige que el estado capturado use `watermarkMode: 'none'`.
