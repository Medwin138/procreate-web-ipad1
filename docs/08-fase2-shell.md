# 08 — Fase 2: shell funcional (alcance real y pruebas)

Fecha de trabajo: 11 de noviembre de 2026. Actualizado: 12 de noviembre de 2026.

Esta fase construye la **carcasa funcional** de la adaptación: galería, estudio,
paneles, almacenamiento, exportación y diagnóstico. No es todavía la adaptación
final de Procreate 3.1: el motor de trazo es **provisional** y la fidelidad visual
**no se ha podido comparar contra la aplicación original** (no hay IPA ni app en el
iPad; ver `docs/01-ingenieria-inversa-rea.md`).

> Estado honesto: implementado y probado en un navegador de escritorio (Chromium).
> **No validado en Safari 9 ni en el iPad mini 1.** No se declara terminado hasta
> ejecutar la lista de validación de la sección 7 en el dispositivo real.

## 1. Qué incluye el shell

### Galería

- Rejilla de proyectos con miniatura JPEG, nombre, dimensiones, fecha y número de capas.
- Crear lienzo con presets (S, M, L, XL) o tamaño manual, con comprobación de
  presupuesto de píxeles antes de crear.
- Abrir, renombrar, duplicar (incluidas las capas), exportar respaldo `.pcw` y eliminar.
- Aviso visible cuando el almacenamiento cae a WebSQL o a memoria.

### Estudio

- Barra superior con nombre de pantalla, herramientas (pincel, difuminar, borrador),
  acciones, ajustes, selección, Quick Menu y vuelta a la galería.
- Barra lateral con vista previa del pincel, tamaño y opacidad (deslizadores verticales)
  y acceso a capas y color.
- Lienzo con ajuste automático, sombra, borde y zoom/rotación.
- Panel de capas: añadir, duplicar, subir, bajar, eliminar, visibilidad, mezcla y
  opacidad por capa, con miniaturas.
- Panel de color: rueda de tono, cuadrado saturación/valor, campo hexadecimal, colores
  recientes y paleta base.
- Insertar imagen desde Fotos/Archivos (Acciones → Insertar imagen): crea una capa
  nueva con el nombre del archivo, centra la imagen y la escala para que quepa.
  Rechaza archivos que no son imagen, mayores de 20 MB o cuando no quedan capas.
- Biblioteca de pinceles con las **11 categorías nativas** (Boceto, Entintado, Dibujo,
  Pintura, Artístico, Caligrafía, Aerógrafo, Carboncillos, Elementos, Luminancia y
  Materiales) y **27 pinceles propios** (sin recursos de Procreate), con vista previa
  generada en canvas. Incluye «Pluma de estudio» y «G-Pen manga», con grosor modulado
  por la velocidad y adelgazamiento inicial (taper).
- ColorDrop: mantener pulsado el círculo de color y arrastrarlo al lienzo; umbral
  ajustable en el panel de color. El relleno por inundación respeta la selección activa
  y el bloqueo alfa de la capa.
- Selección por rectángulo, elipse, lazo y automática por color, con modos **nueva,
  añadir y restar**, invertir, duplicar a capa y deseleccionar. El trazo y el relleno
  se recortan a la máscara de selección.
- Transformación interactiva de la capa activa: mover arrastrando dentro del recuadro,
  escalar desde las esquinas, rotar con el tirador superior, voltear y restablecer,
  con aplicar o cancelar.
- Ajustes de imagen sobre la capa activa con vista previa: brillo, contraste,
  saturación, desenfoque de caja, ruido, blanco y negro e invertir.
- Bloqueo alfa por capa y configuración del lienzo (nombre y color de fondo).
- Relleno de capa, relleno de selección y vaciado de capa desde el menú de acciones.
- Menú de acciones con voltear, rotar, ajustar, exportar PNG/JPEG, respaldo `.pcw` y
  diagnóstico.
- Quick Menu con ocho accesos.

### Entrada y gestos

- Un dedo (o ratón) dibuja en el lienzo. El trazo táctil se confirma al primer
  movimiento (más de 6 px) para que el primer dedo de un gesto no cree un punto ni
  tome la instantánea completa del lienzo.
- Dos dedos: desplazar, hacer zoom y rotar la vista.
- Dos dedos, toque sin desplazamiento (hasta 16 px por dedo y 900 ms): deshacer.
- Tres dedos, toque en las mismas condiciones: rehacer. También se admite si Safari
  entrega `touchcancel` al soltar.
- Deshacer y rehacer están además en la barra superior y en el Quick Menu, con atenuado
  cuando no hay pasos disponibles. En escritorio: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` y
  `Ctrl/Cmd+Y`.
- Rueda del ratón: zoom (solo escritorio; no aplica al iPad).

### Motor de trazo provisional (Fase 3 lo sustituye)

- Estampado por distancia con espaciado por pincel, jitter, dispersión, dureza,
  opacidad, grano y taper de entrada.
- Caché de sellos por pincel/color/herramienta/radio, con límite de memoria.
- Borrador real (`destination-out`), difuminar por parche y cuentagotas sobre el
  compuesto.
- Historial por rectángulo sucio, no por fotograma completo, con presupuesto de 12 MB.
  En XL (2560 × 1920) el snapshot completo supera el límite: se avisa y el trazo no
  se puede deshacer.
- Capas en canvas separados, composición con modos de fusión cuando Safari los soporta
  (`multiply` comprobado en el banco de diagnóstico).

### Persistencia

- IndexedDB → WebSQL → memoria, con timeout, verificación de escritura/lectura y
  reapertura.
- Autoguardado a los 1,6 s de inactividad y guardado explícito al volver a la galería.
- Serialización del documento con metadatos de capas y PNG por capa en data URL.

### Exportación

- PNG y JPEG compuestos con fondo.
- Respaldo `.pcw` (JSON con PNG por capa) desde el estudio y desde la galería.
- En navegadores sin atributo `download` (Safari 9) se abre una ventana previa con la
  imagen o el texto para guardar/compartir manualmente.

### Diagnóstico

- Informe de entorno, almacenamiento, presupuestos por perfil, pruebas de canvas,
  modos de fusión, `toDataURL`, IndexedDB y WebSQL.
- Medición de frecuencia de `touchmove` durante 3 s (para el iPad).
- Guardado del informe como archivo o texto seleccionable.
- Ruta directa `?diag=1`.

## 2. Qué no incluye (a propósito o pendiente)

- **Fidelidad visual de Procreate 3.1 sin verificar**: no hay app de referencia en el
  iPad. Los paneles y flujos se basan en documentación pública, no en una comparación
  pixel a pixel.
- **Warp, licuar y distorsión de cuatro puntos**: no implementados. `docs/02` los marca
  como «por confirmar» en 3.1, así que no se presentan como carencia de fidelidad
  comprobada.
- **Transformación limitada a la capa completa**: no transforma solo la selección ni
  varias capas a la vez (esto último llegó en 3.2).
- **El difuminado (smudge) no se recorta a la selección** y actúa sobre la capa activa.
- **Recorte y redimensionado del lienzo**: la configuración del lienzo solo cambia el
  nombre y el color de fondo; no recorta ni interpola el contenido.
- **Grupos de capas y máscaras**: pertenecen a versiones posteriores a la línea 3.1
  (grupos en 3.2, máscaras en 4.0), así que no se implementan como «fidelidad».
- **Bloqueo de capa**: llega en 3.2, así que no se implementa como fidelidad; sí existe
  bloqueo alfa. **Fusionar capas** sigue pendiente como herramienta de edición.
- **Texto**: el shell no incluye herramienta de texto.
- **Ajustes avanzados de Procreate**: curvas, balance de color, recolor, desenfoque
  gaussiano/movimiento, perspectiva y enfoque no están implementados. Los ajustes
  propios son los siete indicados arriba.
- **Colocación libre de la imagen importada**: se centra y se ajusta para caber, pero no
  se puede mover, escalar ni rotar después de insertarla. Tampoco se corrige la
  orientación EXIF de fotos giradas.
- **Presión, inclinación y Apple Pencil**: el iPad mini 1 no las aporta. La dinámica se
  limita a velocidad, dirección y taper. «Pluma de estudio» y «G-Pen manga» adelgazan
  al acelerar el trazo, no al presionar.
- **El truco de G-Pen a 2-3 % de opacidad no se replica**: aquí la opacidad se aplica por
  sello y se acumula. Para línea sólida usa 100 %; los grises no se comportan como la
  opacidad de trazo de Procreate.
- **Motor de pincel de Procreate**: no se copian parámetros ni recursos; el motor actual es
  propio y provisional. No hay editor de los 35 ajustes por pincel ni importación
  `.brushset`.
- **Repintado incremental por regiones, mosaicos y compresión de capas**: pendiente de la
  Fase 3 para reducir memoria y latencia en el A5.

## 3. Archivos

| Archivo | Función |
|---|---|
| `index.html` | Estructura del shell y todos los paneles |
| `css/app.css` | Estilos 1024 × 768, flexbox prefijado, sin Grid ni variables CSS |
| `src/00-core.js` | Utilidades, entorno, eventos, DOM, matrices, registro |
| `src/10-storage.js` | IndexedDB, WebSQL, memoria, verificación y ajustes |
| `src/20-model.js` | Documento, capas, presupuestos, pinceles y serialización |
| `src/30-ui.js` | Pantallas, modales, avisos, sliders, paneles y entrega de archivos |
| `src/40-gallery.js` | Galería y operaciones de proyecto |
| `src/50-studio.js` | Vista, entrada, motor provisional, historial, selección, transformación, ajustes, ColorDrop, guardado y exportación |
| `src/60-panels.js` | Capas, color, pinceles, acciones, selección, transformación, ajustes y Quick Menu |
| `src/70-diag.js` | Banco de diagnóstico y medición táctil |
| `src/80-app.js` | Arranque y errores globales |
| `tools/build.js` | Concatena y verifica ES5 |
| `tools/check-ids.js` | Comprueba que los `id` usados existen en el HTML |
| `tools/server.js` | Servidor estático para LAN, puerto 8090 |
| `tests/model.test.js` | Pruebas de núcleo y modelo en Node |

## 4. Compilar, probar y ejecutar

```bash
npm run check     # build + pruebas + comprobación de ids
npm run build     # solo build
npm test          # solo pruebas de modelo
npm start         # servidor en http://0.0.0.0:8090
```

El servidor imprime las direcciones LAN; el iPad debe estar en la misma red y abrir
`http://IP-DEL-PC:8090/`.

## 5. Pruebas ejecutadas y resultados

### Automáticas (Node v24.20.0)

`npm run check`:

- Build correcto: `dist/app.js` 230,1 KB, 7739 líneas fuente, 9 módulos.
- Escáner ES5: sin `let`, `const`, funciones flecha, clases, plantillas, spread,
  `Promise`, `Symbol`, `fetch`, parámetros por defecto.
- 14/14 pruebas superadas (color, matrices, presupuestos, capas, serialización,
  pinceles y categorías, nombres, historial y `util.floodRegion`).
- 92 `id` en el HTML; 79 usados con `dom.id`/`id()` desde el código, 7 de ellos
  dinámicos (creados por los modales). Ningún `id` usado falta en el HTML.

### Interactivas (Chromium 152 de escritorio, dentro de OpenCode)

| Prueba | Resultado |
|---|---|
| Galería vacía y aviso de almacenamiento | Correcto; IndexedDB activo |
| Crear lienzo 1024 × 768 | Correcto; estudio a 74 % y perfil S |
| Dibujo con ratón y undo/redo | Trazo pintado; 1 entrada de historial; deshacer deja 0 píxeles y rehacer los recupera |
| Capas: añadir, duplicar, mover, ocultar, mezcla y opacidad | Correcto; límite y nombres coherentes |
| Panel de color: rueda, SV, hexadecimal, recientes y paleta | Correcto; el color del chip y del pincel se sincroniza |
| Biblioteca de pinceles | 27 pinceles, 11 categorías + «Todos», 27 vistas previas; selección actualiza tamaño/opacidad |
| Los 27 pinceles dibujando | 27 trazos sin errores, 32 445 píxeles pintados y 27 entradas de historial |
| ColorDrop | Relleno correcto en 26-71 ms sobre 900 × 700; deshacer lo vacía y rehacer lo restaura |
| ColorDrop por arrastre | El indicador aparece y se oculta; el píxel destino cambia; un toque sin arrastre abre el panel de color |
| Selección rectangular y automática | Máscara y límites correctos; invertir cubre el resto del lienzo |
| Duplicar selección a capa | Capa «Selección» con píxeles dentro y alfa 0 fuera |
| Añadir y restar selección | Dos rectángulos se unen; restar perfora el centro (alfa 0) y conserva el resto; restar el bloque entero deja solo el segundo rectángulo |
| Transformación: mover, escalar, rotar y voltear | Desplazamiento de 100 × 50 px; escala ×2; rotación de 0,78 rad; volteos H/V; aplicar y deshacer; cancelar no modifica |
| Ajustes con vista previa | Brillo/contraste/saturación/desenfoque/ruido + blanco y negro produce gris 131; deshacer restaura; cancelar no cambia píxeles |
| Bloqueo alfa | Rellenar con bloqueo colorea solo los píxeles existentes; fuera del trazo el alfa sigue en 0 |
| Rellenar capa, rellenar selección y vaciar capa | Relleno de selección solo dentro de la máscara; vaciar deja alfa 0 y se recupera con deshacer |
| Configuración del lienzo | Nombre y color de fondo actualizados y modal cerrado |
| Pluma de estudio y G-Pen manga | Trazo lento 9/14 px y rápido 6/8 px con tamaño 8/14; la Tinta técnica previa sigue igual con cualquier velocidad |
| Borrador | Reduce el alfa del trazo y se restaura con deshacer |
| Difuminar | Modifica el contenido sin errores |
| Cuentagotas | Toma el color del compuesto y vuelve al pincel |
| Gestos: pinza | Escala ×2 sin falsos deshacer |
| Gestos: 2 dedos toque / 3 dedos toque | Deshacer y rehacer correctos, con 6 px de temblor y suelta dedo a dedo |
| Gestos: 3 dedos con `touchcancel` | Rehacer correcto |
| Gestos: arrastre de 3 dedos | Desplaza la vista 40 px y no modifica el historial |
| Rehacer por barra, Quick Menu y teclado | Recupera el píxel; el botón se atenúa al agotar la pila |
| Toque de un dedo | Crea un punto y una entrada de historial, como antes |
| Autoguardado y cierre | Tarjeta con miniatura, 3 capas y fecha actualizada |
| Reapertura tras recargar la página | Capas, píxeles, pincel, tamaño, color y capa activa restaurados |
| Insertar imagen (400 × 300 y 2000 × 1200) | Capa nueva con el nombre del archivo, centrada; la grande se reduce a 1024 × 614; píxeles y alfa correctos |
| Insertar imagen: texto, 21 MB y límite de capas | Rechazado con aviso claro en los tres casos |
| Deshacer y rehacer tras insertar | El área importada se vacía y se restaura; la capa permanece |
| Renombrar, duplicar y eliminar proyecto | Correcto, incluida la copia de capas y píxeles |
| Presupuesto inválido (4096 × 4096) | Bloquea la creación y explica el límite de 40 MB |
| Perfil M (1536 × 1152) | Máximo 5 capas; aviso al intentar la sexta |
| Perfil XL (2560 × 1920) | Aviso de que no hay deshacer por tamaño; historial vacío |
| Exportar PNG, JPEG y `.pcw` | Descargas generadas (PNG 73 KB, `.pcw` 198 KB en la prueba) |
| Diagnóstico desde galería, estudio y `?diag=1` | Informe completo y vuelta a la pantalla de origen |
| Guardar informe de diagnóstico | Archivo de texto generado |

### Defectos encontrados y corregidos durante la fase

1. `deepStrictEqual` fallaba entre contextos de Node (objetos de distinto realm): las
   pruebas comparan campos, no referencias.
2. El botón de rotación no volvía a mostrar `0°` tras «Ajustar»: se añadió
   `updateResetLabel()` a `resetView`.
3. El botón «Volver» del diagnóstico estaba enlazado dos veces (galería y diagnóstico):
   se dejó un único enlace.
4. Una pinza pequeña podía interpretarse como toque de dos dedos y deshacer: se añadió
   un umbral absoluto de 8 px al cambio de distancia.
5. La rueda de color redibujaba 180 arcos en cada movimiento y reconstruía los
   swatches: el anillo se cachea y los swatches no se reconstruyen durante el arrastre.
6. Mover la opacidad de capa reconstruía toda la lista con miniaturas: ahora solo se
   actualiza la fila activa.
7. Si se cerraba un proyecto mientras las capas aún cargaban, la miniatura podía
   guardarse en blanco: se conserva la miniatura anterior hasta terminar la carga.
8. En Safari 9 la exportación podía perder la ventana emergente: ahora se abre antes
   de generar el PNG/JPEG o el `.pcw`.
9. El relleno por inundación entraba en un bucle infinito al mezclar índices absolutos
   con columnas: se reescribió como `util.floodRegion` con recorrido por filas y prueba
   automática en Node. El umbral 0 equivale a una tolerancia de 4 para no exigir
   coincidencia exacta de color.
10. Rehacer no era fiable en el dispositivo: el toque se detectaba con la distancia y el
    ángulo entre dedos, así que un temblor de 1-2 px lo anulaba, y solo se aceptaba antes
    de 420 ms. Además, el primer dedo iniciaba un trazo cuyo punto podía limpiar la pila
    de rehacer al soltar. Ahora se mide el desplazamiento de cada dedo (16 px), el plazo
    es de 900 ms, el trazo se confirma al primer movimiento y el fin del gesto se cuenta
    con `changedTouches`. Deshacer y rehacer consultan la cima de la pila sin sacarla si
    la capa ya no existe, y hay botones propios en la barra superior.

## 6. Riesgos y limitaciones conocidas

- **Safari 9 no está probado.** Chromium no reproduce sus fallos de IndexedDB, su
  gestión de memoria ni el rendimiento del A5. La caída a WebSQL está implementada,
  pero no verificada en iOS 9.3.5.
- **Memoria**: 8 capas de 1024 × 768 son 24 MB de píxeles, más canvas de vista,
  historial (hasta 12 MB), sellos (6 MB) y data URLs de guardado. En 512 MB es un
  presupuesto ajustado; el perfil XL puede fallar al exportar o al guardar.
- **Historial**: sin snapshot completo en XL; los trazos grandes pueden no caber en el
  presupuesto y se avisa.
- **Exportación**: los data URL grandes pueden superar límites de Safari 9; la interfaz
  lo advierte, pero no hay empaquetado por partes.
- **Fidelidad**: distribución y flujo son una aproximación documentada; no hay
  comparación contra Procreate 3.1 en el dispositivo.
- **Almacenamiento**: iOS puede desalojar datos de sitios web; el respaldo `.pcw` es la
  única garantía de conservación.
- **Pinceles**: son propios; no hay importación de `.brushset` ni equivalencia con los
  pinceles originales.
- **Sin multihilo**: toda la codificación y el guardado ocurren en el hilo principal.
- **Selección y ColorDrop leen el lienzo completo**: la selección automática y el
  relleno por inundación recorren todos los píxeles en el hilo principal. En 900 × 700
  tardan decenas de milisegundos; en XL puede haber una pausa perceptible.
- **Transformación y ajustes usan canvas temporales**: pueden duplicar el uso de memoria
  de la capa activa durante la operación.

## 7. Validación pendiente en el iPad mini 1 real

1. Abrir la URL LAN en Safari 9 y confirmar que no hay errores en consola.
2. Ejecutar `?diag=1` y guardar el informe: canvas S/M/L/XL, `multiply`, `toDataURL`,
   IndexedDB/WebSQL, frecuencia táctil.
3. Crear un lienzo S y dibujar trazos largos; medir fluidez y calor.
4. Probar pinza y rotación; después deshacer con dos dedos y rehacer con tres, con
   temblor natural, y con los botones Deshacer/Rehacer de la barra y del Quick Menu.
   Abrir Diagnóstico tras cada gesto: la línea «Historial» debe mostrar el cambio de
   los contadores.
5. Añadir 8 capas, dibujar en todas y comprobar el uso de memoria y el autoguardado.
6. Insertar una foto desde Fotos y otra desde Archivos: comprobar centrado, nitidez,
   orientación y que el lienzo siga respondiendo.
7. Cerrar Safari, reabrir y verificar la persistencia real.
8. Probar ColorDrop con umbral 0, 12 y 60; comprobar que respeta una selección y el
   bloqueo alfa.
9. Probar selección rectangular, lazo y automática; añadir y restar; invertir;
   duplicar a capa y rellenar la selección.
10. Transformar una capa: mover, escalar, rotar y voltear; aplicar, deshacer y cancelar.
11. Aplicar cada ajuste y comprobar la pausa y la memoria; cancelar sin cambios.
12. Cambiar nombre y color de fondo del lienzo.
13. Exportar PNG y `.pcw`; comprobar el guardado en Fotos/Archivos.
14. Repetir con M, L y XL; documentar dónde falla.
15. Comparar lado a lado con Procreate 3.1 si el usuario consigue instalarlo, y anotar
    diferencias de distribución y comportamiento.

## 8. Siguiente fase

- **Pendientes de paridad**: warp/licuar, recorte y redimensionado de lienzo,
  transformación limitada a la selección, ajustes avanzados (curvas, balance de color,
  desenfoque gaussiano) y recorte del difuminado a la selección.
- **Fase 3 (motor)**: repintado incremental por regiones, texturas de pincel propias,
  estabilización tipo StreamLine, sellos precalculados y recorte del área de trabajo
  para reducir memoria.
- **Fase 4 (fidelidad)**: comparación guiada contra la app original en el iPad y ajuste
  de distribución, tamaños y comportamiento.
