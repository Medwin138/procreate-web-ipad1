# 09 — Herramientas principales y paridad real con Procreate 3.1

Fecha de trabajo: 12 de noviembre de 2026.

Este documento describe lo que **realmente hace** la adaptación después de ampliar el
shell con las herramientas principales de Procreate, separa lo implementado de lo
pendiente y de lo que **no forma parte de la referencia 3.1**. La validación en el
iPad mini 1 sigue pendiente: todo lo que aparece como «probado» se ejecutó en Chromium
de escritorio, no en Safari 9.

> Regla del proyecto: ninguna función se declara terminada por estar escrita. Se indica
> si está implementada, si se probó en escritorio y si falta la prueba en el dispositivo.

## 1. Resumen de alcance

| Área | Estado | Nota |
|---|---|---|
| Biblioteca de pinceles | Implementada y probada en escritorio | 27 pinceles propios en 11 categorías + «Todos» |
| ColorDrop / relleno por arrastre | Implementada y probada en escritorio | Umbral 0-100, respeta selección y bloqueo alfa |
| Selección | Implementada y probada en escritorio | Rectángulo, elipse, lazo, automática, añadir, restar, invertir, duplicar |
| Transformación | Implementada y probada en escritorio | Solo capa activa; mover, escalar, rotar, voltear |
| Ajustes de imagen | Implementados y probados en escritorio | Brillo, contraste, saturación, desenfoque, ruido, B/N, invertir |
| Bloqueo alfa | Implementado y probado en escritorio | Pincel, ColorDrop y relleno |
| Configuración del lienzo | Implementada y probada en escritorio | Nombre y color de fondo; sin recorte ni cambio de tamaño |
| Rellenar / vaciar | Implementados y probados en escritorio | Capa completa o selección, con historial |
| Fusionar capas | No implementado | Pendiente del panel de capas |
| Warp / licuar / distorsión | No implementado | `docs/02` lo marca «por confirmar» en 3.1 |
| Texto | No implementado | No confirmado en 3.1; pendiente de verificar |
| Grupos y máscaras de capa | Fuera de la referencia 3.1 | Grupos en 3.2; máscaras en 4.0 |

## 2. Pinceles

La biblioteca se organiza en las **11 categorías nativas** de Procreate, más «Todos»:

1. Boceto
2. Entintado
3. Dibujo
4. Pintura
5. Artístico
6. Caligrafía
7. Aerógrafo
8. Carboncillos
9. Elementos
10. Luminancia
11. Materiales

Contiene **27 pinceles propios**. No se copiaron recursos, texturas ni parámetros de
Savage Interactive; los pinceles son aproximaciones funcionales creadas para este
proyecto.

Comportamiento del motor actual:

- Estampado por distancia con espaciado por pincel, jitter, dispersión, dureza,
  opacidad, grano y taper de entrada.
- Modulación por **velocidad** del trazo, no por presión: el iPad mini 1 no aporta
  presión con el dedo y Safari 9 no expone presión de stylus.
- Borrador real (`destination-out`), difuminar por parche y cuentagotas sobre el
  compuesto.
- Los 27 pinceles se probaron dibujando un trazo con cada uno: 27 trazos, 32 445 píxeles
  pintados, 27 entradas de historial y ningún error de JavaScript.

## 3. ColorDrop y relleno

- Se activa manteniendo pulsado el círculo de color y arrastrándolo al lienzo. Un toque
  sin arrastre abre el panel de color.
- El umbral (0-100) se ajusta en el panel de color y se traduce a una tolerancia RGBA.
  El valor 0 equivale a tolerancia 4 para no exigir coincidencia exacta.
- El relleno por inundación usa `util.floodRegion`, una función pura probada en Node.
  Tiene en cuenta el compuesto visible, la máscara de selección y el bloqueo alfa.
- Si hay una selección activa, el relleno se limita a ella.
- Cada ColorDrop genera una entrada de historial y se puede deshacer y rehacer.

Pruebas de escritorio: relleno correcto en 26-71 ms sobre 900 × 700; deshacer deja el
píxel vacío y rehacer lo recupera; el indicador flotante aparece y desaparece.

## 4. Selección

Modos:

| Modo | Comportamiento |
|---|---|
| Rectángulo | Arrastrar para definir el área |
| Elipse | Arrastrar para definir la elipse |
| Lazo | Dibujar el contorno a mano alzada |
| Automática | Tocar una zona de color; usa el umbral de ColorDrop |

Operaciones:

- **Nueva**: sustituye la selección actual.
- **Añadir**: une la nueva máscara con la existente.
- **Restar**: recorta la nueva máscara de la existente.
- **Invertir**: selecciona el resto del lienzo.
- **Duplicar a capa**: crea una capa «Selección» con el contenido recortado.
- **Deseleccionar**: elimina la máscara.

La selección activa recorta el trazo del pincel, el borrador y los rellenos. La máscara
se muestra con un tinte azul y un contorno discontinuo. No se persiste al cerrar el
proyecto ni al recargar la página.

Pruebas de escritorio: unión de dos rectángulos, resta que perfora el centro (alfa 0) y
conserva el resto, resta del bloque completo que deja solo el segundo rectángulo,
inversión, duplicado a capa y relleno limitado a la máscara.

## 5. Transformación

- Actúa sobre la **capa activa completa**, no sobre una selección ni sobre varias capas.
- Mover: arrastrar dentro del recuadro.
- Escalar: arrastrar una esquina.
- Rotar: arrastrar el tirador superior.
- Voltear horizontal/vertical y restablecer desde el panel.
- Aplicar escribe el resultado en la capa y crea historial; cancelar no modifica nada.
- La transformación pendiente se aplica al empezar otro trazo, cambiar de capa, usar
  ColorDrop o salir del estudio; también se puede cancelar desde el panel.

Pruebas de escritorio: desplazamiento de 100 × 50 px, escala ×2, rotación de 0,78 rad,
volteos H/V, aplicar con deshacer y cancelar sin cambios.

## 6. Ajustes de imagen

Se aplican a la capa activa con vista previa antes de confirmar:

| Ajuste | Rango | Implementación |
|---|---|---|
| Brillo | -100 a 100 | Suma con factor 1,6 |
| Contraste | -100 a 100 | Fórmula clásica de contraste |
| Saturación | -100 a 100 | Mezcla con luminancia |
| Desenfoque | 0 a 20 | Desenfoque de caja |
| Ruido | 0 a 100 | Ruido monocromo |
| Blanco y negro | Interruptor | Luminancia |
| Invertir | Interruptor | Inversión RGB |

No incluye curvas, balance de color, recolor, desenfoque gaussiano/movimiento,
perspectiva ni enfoque de Procreate. «Aplicar» convierte la vista previa en píxeles y
crea historial; «Cancelar» no modifica la capa.

Pruebas de escritorio: la combinación de brillo, contraste, saturación, desenfoque,
ruido y blanco y negro produjo gris 131 sobre un píxel original (170, 51, 102); deshacer
restauró el color y cancelar no cambió nada.

## 7. Bloqueo alfa y lienzo

- **Bloqueo alfa** por capa: el pincel, ColorDrop y el relleno solo modifican píxeles con
  alfa distinto de cero. El botón muestra «Bloqueo alfa: activado/desactivado».
- **Configuración del lienzo**: cambia el nombre del documento y el color de fondo.
  Indica las dimensiones actuales y avisa de que cambiar el tamaño no está disponible.
- **Rellenar capa**, **Rellenar selección** y **Vaciar capa** están en el menú de
  acciones, con historial y respeto al bloqueo alfa.

Pruebas de escritorio: relleno con bloqueo solo dentro del trazo; relleno de selección
solo dentro de la máscara; vaciar deja alfa 0 y se recupera con deshacer; el color de
fondo cambió a `#f2f2f2` y el nombre se conservó.

## 8. Paridad con Procreate 3.1

| Función de 3.1 | Esta adaptación | Diferencia |
|---|---|---|
| 11 categorías de pinceles | Sí, con 27 pinceles propios | No son los 128 originales ni sus recursos |
| Grosor por velocidad | Sí (taper y velocidad) | Sin presión real |
| ColorDrop con umbral | Sí | Implementación propia, umbral simplificado |
| Selección rectangular/elipse/lazo/automática | Sí | Sin ajustes avanzados de selección |
| Añadir/restar selección | Sí | Máscaras propias, sin recolorear bordes |
| Duplicar selección a capa | Sí | Crea una capa nueva |
| Transformación libre | Parcial: mover, escalar, rotar, voltear | Solo capa completa; sin distorsión de 4 puntos |
| Warp / licuar | No | 3.1 «por confirmar» |
| Ajustes de imagen | Parcial: 7 ajustes | Faltan curvas, balance, recolor, perspectiva, enfoque |
| Bloqueo alfa | Sí | Pincel, ColorDrop y relleno |
| Relleno de capa/selección | Sí | Con historial y bloqueo alfa |
| Recorte/redimensionado de lienzo | No | Solo nombre y color de fondo |
| Fusionar capas | No | Pendiente |
| Grupos de capas | No (3.2+) | Fuera de la referencia |
| Máscaras de capa | No (4.0+) | Fuera de la referencia |
| Texto | No | Pendiente |
| Exportar PSD/PDF, time-lapse, AirDrop | No | Fuera del alcance web actual |
| 250 niveles de deshacer | No | Presupuesto de 12 MB; sí hay deshacer/rehacer ilimitado dentro del presupuesto |

### Deshacer y rehacer

- Dos dedos, toque sin desplazamiento: deshacer. Tres dedos: rehacer. Se toleran
  hasta 16 px de temblor **por dedo** y 900 ms de duración; antes bastaba un temblor
  de 1-2 px o superar 420 ms para que el gesto se ignorara.
- El primer dedo ya no crea un trazo al instante: se confirma al primer movimiento
  (>6 px). Así un toque multitáctil no deja un punto ni limpia la pila de rehacer.
- El fin del gesto se calcula con `changedTouches`, no con `ev.touches`, y también se
  acepta un `touchcancel` de Safari al soltar los dedos.
- Hay botones explícitos en la barra superior además del Quick Menu. Se atenúan cuando
  no hay pasos, pero siguen siendo pulsables para mostrar el aviso.
- Deshacer y rehacer aplican la entrada sin sacarla de la pila si la capa ya no existe,
  invalidan el compuesto y actualizan miniaturas y botones.

## 9. Pruebas y evidencias

- `npm run check`: build correcto de 238,0 KB y 7993 líneas fuente, 9 módulos ES5,
  15/15 pruebas de Node y comprobación de ids sin errores.
- Pruebas interactivas en Chromium: galería, creación de lienzo, capas, 27 pinceles,
  borrador, difuminar, ColorDrop, selección con añadir/restar, transformación, ajustes,
  bloqueo alfa, rellenos, configuración del lienzo, autoguardado y exportación.
- Deshacer/rehacer: botones de barra y Quick Menu, toque de 2 y 3 dedos con 6 px de
  temblor y suelta dedo a dedo, `touchcancel`, arrastre de 3 dedos sin efecto en el
  historial y punto de un dedo. Verificado con píxeles y contadores del historial.
- La única prueba automática del relleno por inundación está en Node
  (`util.floodRegion`), además de las pruebas manuales en el navegador.

## 10. Pendientes y riesgos

1. **Validación en Safari 9 / iPad mini 1**: no ejecutada. Es el paso más importante
   antes de considerar cualquier función como entregada.
2. **Warp/licuar**: no implementado; no se presenta como carencia de fidelidad porque
   `docs/02` no confirma que exista en 3.1.
3. **Transformación de selección**: hoy transforma la capa completa.
4. **Recorte y redimensionado de lienzo**: no implementados.
5. **Fusión de capas y ajustes avanzados / texto**: no implementados.
6. **Rendimiento**: selección automática, ColorDrop, transformación y ajustes recorren
   o duplican píxeles en el hilo principal; en XL puede haber pausas y presión de
   memoria.
7. **Persistencia**: la selección, la transformación pendiente y los ajustes en vista
   previa no se guardan; se aplican o se descartan al salir.
8. **Fidelidad visual**: sigue sin compararse contra la app real en el dispositivo.

## 11. Cómo continuar

1. Ejecutar la lista de validación de `docs/08-fase2-shell.md`, sección 7, en el iPad.
2. Corregir primero los fallos de Safari 9 (memoria, IndexedDB/WebSQL, eventos táctiles).
3. Decidir el siguiente bloque: warp/licuar, recorte/redimensionado de lienzo,
   transformación de selección o ajustes avanzados.
4. Solo después, ampliar el motor de trazo de la Fase 3.
