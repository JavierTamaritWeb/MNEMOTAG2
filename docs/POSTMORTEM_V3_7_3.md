# Postmortem v3.7.3: acceso contextual y miniaturas del lote

**Fecha:** 13 de julio de 2026  
**Alcance:** pantalla inicial y revisión previa del procesamiento por lotes

## Errores corregidos

### 1. Acción de lote sin contexto en la carga inicial

La pantalla «Selecciona una imagen» ofrecía «Procesar en lote» al mismo nivel que cargar y pegar. En ese momento todavía no existían una imagen de referencia ni filtros, marcas de agua o capas que reutilizar, por lo que la acción competía con el objetivo principal sin aportar contexto suficiente.

**Corrección:** el acceso visible al lote se mantiene en la barra del editor, después de cargar la referencia. El multi-drop de varios archivos continúa como acceso avanzado directo.

### 2. Tarjetas sin miniaturas reales

Las tarjetas del lote mostraban un icono genérico aunque los archivos fueran imágenes válidas. Esto impedía comprobar visualmente qué archivos se iban a procesar y hacía especialmente arriesgado un lote de fotografías con nombres parecidos.

## Causa raíz

En v3.7.0 se eliminó la antigua preview base64 porque retenía representaciones grandes y duplicaba memoria. La solución sustituyó toda representación visual por un icono. Se confundieron dos requisitos distintos:

- La cola de procesamiento no debe retener imágenes decodificadas ni data URLs.
- La interfaz sí necesita una miniatura ligera para la revisión previa.

La prueba de memoria protegía el primer requisito, pero no existía una comprobación semántica ni visual que exigiera contenido real en las tarjetas.

## Solución aplicada

Durante la validación, el `Image` ya decodificado se dibuja una sola vez en un canvas limitado a `320×180`. El resultado se codifica como JPEG con calidad `0.72` y se entrega a la UI como `Blob`:

- `BatchManager.imageQueue` continúa guardando solo `File`, dimensiones y estado.
- `BatchUIManager` crea una URL `blob:` para cada miniatura reducida.
- La tarjeta usa un `<img>` con `object-fit: contain`; el icono queda solo como fallback.
- La URL se revoca al quitar una imagen, limpiar la cola o cerrar el modal.
- No se usa `FileReader`, base64 ni `toDataURL`.

## Reglas de no regresión

1. La pantalla inicial debe tener exactamente dos acciones visibles: seleccionar y pegar.
2. El lote visible se abre desde el editor una vez cargada la imagen de referencia.
3. Cada archivo válido debe mostrar una miniatura cargada con `naturalWidth > 0`.
4. Las miniaturas deben proceder de URLs `blob:` de copias reducidas, nunca de data URLs.
5. La preview reducida no puede formar parte de `BatchManager.imageQueue`.
6. Toda URL creada para una tarjeta debe revocarse al eliminar, limpiar o cerrar.
7. La prueba de 20 imágenes debe mantenerse por debajo del límite de heap establecido.

## Barreras automáticas

- `tests/e2e/smoke.spec.js`: impide reintroducir el botón de lote en la carga inicial.
- `tests/e2e/v371.spec.js`: exige una miniatura `blob:` cargada en Chromium, Firefox y WebKit y conserva la medición de memoria con 20 imágenes.
- `tests/e2e/capture-baseline.spec.js`: añade una referencia visual del modal oscuro con dos miniaturas reales.
- `tests/specs/v370.spec.js`: prohíbe previews base64 y exige creación/revocación de Object URLs.
- `tests/specs/regression.spec.js`: protege la ubicación contextual del acceso al lote.

## Checklist para cambios futuros

- [ ] La cola sigue conteniendo una sola representación procesable por imagen.
- [ ] Las tarjetas permiten reconocer visualmente cada archivo.
- [ ] Quitar y limpiar liberan todas las URLs temporales.
- [ ] El modal funciona con 1, 2 y 20 imágenes.
- [ ] Las miniaturas cargan en Chromium, Firefox y WebKit.
- [ ] La captura visual del lote no muestra iconos genéricos para archivos válidos.

## Verificación de la versión

- `npm test`: 286/286 pruebas Node y 92/92 aserciones binarias.
- ESLint: 0 errores; Stylelint: 0 errores.
- Playwright desarrollo y `dist`: 85 pruebas superadas y 20 omisiones deliberadas por motor.
- Memoria: lote de 20 imágenes dentro del límite de 128 MB de incremento de heap.
- Visual: ocho combinaciones viewport/tema más una captura específica del lote con dos miniaturas.
- Axe: cero incidencias serias o críticas.
