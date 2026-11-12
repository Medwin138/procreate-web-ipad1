# 02 — Inventario funcional de la referencia (Procreate 3.1.x)

Este documento separa tres cosas que suelen confundirse:

1. Lo que **la versión que corre en el iPad mini 1** hace (referencia real).
2. Lo que **versiones posteriores** añadieron (no forman parte de la referencia).
3. Lo que **Procreate 5.4 documenta hoy** (útil como taxonomía, no como prueba del 3.1).

## 1. Determinación de la versión de referencia

| Evidencia | Fecha | Dato |
|---|---|---|
| Notas 3.1.2 | 2016-10-02 | «this is the last update for the iPad 2, iPad mini 1 and iPad 3» |
| Notas 3.1.3 | 2016-10-06 | «back for one last release with our older device users»; «our next release will target iOS 10» |
| Notas 3.1.4 | 2016-10-07 | Corrección de Quickline |
| Ficha App Store 3.2.1 | 2017-03-01 | «Requires iOS 10.0 or later» |
| Notas 3.2 | 2016-12-04 | Grupos de capas, importación PSD, bloqueo de capas, selección múltiple |
| Notas 4.0 | 2017-09-19 | Máscaras de capa, wet mix, modos de fusión de pincel, nueva galería |

**Referencia adoptada: línea 3.1.x (probablemente 3.1.4).**
Compilación exacta a confirmar en el dispositivo y en el historial de compras del Apple ID.

Consecuencia directa sobre el alcance solicitado:

- **Máscaras de capa: no existen en la referencia** (llegan en 4.0). Se pueden estudiar como
  extensión opcional, pero no como «fidelidad».
- **Grupos de capas: no existen en 3.1** (llegan en 3.2).
- **Wet Mix: no existe en 3.1** (llega en 4.0); sí existe el **smudge**.
- **Modos de fusión de pincel: no existen en 3.1**; los modos de fusión son de **capa**.

## 2. Interfaz y flujo de trabajo

| Elemento | Referencia 3.1 | Notas |
|---|---|---|
| Galería de obras | Sí | Vista de cuadrícula, previsualizaciones, menú de obra |
| Crear lienzo | Sí | Unidades px/mm/cm/in, presets guardados (3.1) |
| Barra superior | Sí | Galería, Actions, Adjustments, herramienta (pincel/smudge/borrador), tamaño, opacidad, capas, color |
| Barra lateral | Sí | Sliders verticales de tamaño/opacidad; botón **Modify** (3.1) |
| Quick Menu | Sí | Introducido en 3.1; accesos configurables sobre el lienzo |
| Gestos | Sí | Pinza para zoom/rotación, dos dedos para desplazar, deshacer/rehacer, eyedropper por pulsación larga |
| Controles de gestos avanzados | Sí | Introducidos en 3.1 |
| Pantalla completa | Por confirmar | Verificar gesto en dispositivo |
| Atajos de teclado | Sí | Con teclado Bluetooth |
| Autoguardado continuo | Sí | — |

> Los tamaños exactos de barras, márgenes y tipografías **no se inventan aquí**: se
> calibrarán con capturas del dispositivo (ver `06-plan-adaptacion.md`, tarea V1).

## 3. Lienzo

| Función | 3.1 | Observación |
|---|---|---|
| Crear con unidades y presets | Sí | Presets automáticos por lienzo creado |
| Zoom | Sí | Rango exacto a medir |
| Rotación | Sí | — |
| Desplazamiento | Sí | — |
| Volteo rápido de lienzo | Sí | Mejorado en 3.1 |
| Cuadrícula / guías 2D | Por confirmar | La guía isométrica/perspectiva se documenta en versiones posteriores |
| Guía de perspectiva | Sí (Early Access) | Mencionada en 3.1 |
| Tamaño máximo | Depende del modelo | La ficha promete 16k×4k solo en iPad Pro 12.9"; el límite real del A5 hay que medirlo |

## 4. Pinceles

Cifras de la ficha 3.2.1 (misma familia que 3.1, a confirmar):

- **128 pinceles** incluidos.
- **35 ajustes** por pincel.
- Sistema de **doble textura** (shape + grain).
- Creación de pinceles propios, sets propios, importación/exportación.
- **Smudge** que usa cualquier pincel de la biblioteca.
- **StreamLine** (3.1): estabilización de trazo.
- **Softness** por pincel (desde 3.0.2/3.0.3).
- Ajustes de taper, scatter, rotación, jitter, etc. (subconjunto de la taxonomía actual).

Taxonomía actual del manual 5.4 (E-05), útil como mapa pero **no** como prueba de 3.1:

| Atributo | Contenido |
|---|---|
| Stroke Path | Spacing, spacing jitter, jitter lateral/linear, fall off |
| Stabilization | StreamLine, stabilization, motion filtering |
| Taper | Pressure taper, touch taper, tamaño/opacidad/punta |
| Shape | Fuente de forma, rotación, scatter, count, count jitter, flip, roundness |
| Grain | Fuente, moving/texturized, scale, zoom, rotation, depth, offset jitter, blend mode |
| Rendering | Modos de glaze/blending, flow, wet edges, burnt edges, alpha threshold |
| Wet Mix | Dilution, charge, attack, pull, grade, blur (4.0+) |
| Color Dynamics | Hue/saturation/lightness jitter, secondary color |

En 3.1 no existen Wet Mix ni los modos de fusión de pincel; el resto debe verificarse
contra el editor de pincel real del dispositivo antes de fijar el esquema de datos.

## 5. Color

| Función | 3.1 | Notas |
|---|---|---|
| Disco cromático | Sí | Anillo de tono + área de saturación/valor |
| Modo clásico | Sí | Barra de tono + cuadrado SB |
| Armonías | Sí | — |
| Valores | Sí | — |
| Paletas | Sí | Paletas del sistema y propias |
| RGB / HEX | Sí | — |
| ColorDrop | Sí | Relleno por arrastre con umbral |
| Capas de referencia para ColorDrop | Sí (probable) | Aparece en la ficha 3.2.1; confirmar en 3.1 |
| Cuentagotas | Sí | Pulsación larga; lupa de aumento |
| Perfiles de color | No en 3.1 | Llegan con 5.x; el panel del mini 1 es sRGB |

## 6. Capas

| Función | 3.1 | Evidencia |
|---|---|---|
| Crear, duplicar, eliminar | Sí | — |
| Renombrar | Sí | — |
| Reordenar | Sí | — |
| Opacidad | Sí | — |
| Modos de fusión | Sí, **17** | Ficha 3.2.1 |
| Bloqueo alfa (Alpha Lock) | Sí | Se menciona el gesto en notas 3.2 |
| Bloqueo de capa | **No** (3.2+) | Notas 3.2 |
| Grupos | **No** (3.2+) | Notas 3.2 |
| Máscaras | **No** (4.0+) | Notas 4.0 |
| Selección múltiple de capas | **No** (3.2+) | Notas 3.2 |
| Transformar varias capas | **No** (3.2+) | Notas 3.2 |

Los 17 modos encajan bien con Canvas 2D: `source-over` + 16 modos de mezcla estándar
(multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light,
soft-light, difference, exclusion, hue, saturation, color, luminosity), soportados en
iOS 9 según caniuse (E-07). Verificar nombres y orden exactos en la app.

## 7. Edición

| Función | 3.1 | Notas |
|---|---|---|
| Selección automática | Sí (3.1) | Umbral ajustable |
| Selección a mano alzada | Sí | — |
| Selección rectangular / elipse | Sí | — |
| Ajustes avanzados de selección | Sí | — |
| Duplicar selección a capa | Sí (3.1) | — |
| Transformación libre / uniforme / distorsión | Sí | — |
| Warp / snapping / interpolación | Por confirmar | Probablemente posteriores |
| Recorte de lienzo | Sí | Vía Actions/Canvas |
| Relleno | Sí | ColorDrop y relleno de selección |
| Borrador | Sí | — |
| Deshacer / rehacer | Sí, **250 niveles** | Ficha 3.2.1 |
| Deshacer rápido (mantener pulsado) | Sí (3.2) | En 3.1 verificar |
| Ajustes de imagen | Sí | HSB, balance de color, curvas, recolor, desenfoque gaussiano/movimiento, perspectiva, enfocar, ruido |

## 8. Almacenamiento, importación y exportación

| Función | 3.1 | Notas |
|---|---|---|
| Galería persistente | Sí | Base de datos interna de la app |
| Autoguardado | Sí | — |
| Importar imagen | Sí | Fotos/Files |
| Importar PSD | **No** (3.2+) | Notas 3.2 |
| Exportar PNG / JPEG | Sí | — |
| Exportar PSD | Sí | Con capas |
| Exportar PDF | Sí (3.1) | Multilínea/multipágina |
| Formato nativo `.procreate` | Sí | Paquete propietario |
| Exportar/importar pinceles | Sí | `.brush` / `.brushset` |
| Time-lapse | Sí | Vídeo del proceso |
| Retransmisión en directo | Sí | Función de red |
| AirDrop / iCloud / servicios | Sí | Depende del sistema |

## 9. Entrada y sensórica

| Entrada | iPad mini 1 | Safari 9 |
|---|---|---|
| Dedo | Sí | `touch` events |
| Apple Pencil | **No compatible con A1432** | — |
| Presión / inclinación / azimut | **No** salvo stylus Bluetooth propietario | Safari no accede a esos stylus |
| Multitáctil | Sí (nº máximo a medir) | `touches` |
| Acelerómetro/giroscopio | Sí | `DeviceOrientation` (verificar disponibilidad real) |
| Rechazo de palma | Limitado en la app original | No es fiable en web |

Esto define el techo de fidelidad del motor: **sin presión real**, la dinámica de tamaño y
opacidad debe basarse en velocidad, aceleración, dirección, taper por distancia y, si está
disponible, orientación del dispositivo. La app original en ese mismo iPad también carecía
de presión con el dedo, lo que reduce la diferencia frente a lo que podría parecer.

## 10. Diferencias que se documentarán como tales

- Número y aspecto exacto de los 128 pinceles originales: **no se copiarán assets**;
  se crearán pinceles equivalentes por categoría y comportamiento.
- 64-bit color interno, motor Silica y aceleración GPU: no reproducibles en Canvas 2D.
- 250 niveles de deshacer: se sustituyen por un presupuesto de memoria con menos niveles.
- Time-lapse, retransmisión, AirDrop/iCloud, P3: fuera de alcance o sin API en Safari 9.
- Importación PSD y grupos/máscaras: no forman parte de la referencia 3.1.
