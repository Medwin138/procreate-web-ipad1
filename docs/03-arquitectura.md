# 03 — Arquitectura propuesta para Safari 9 / iPad mini 1

Objetivo: máxima fidelidad funcional con un presupuesto de memoria y CPU propio de un A5
con 512 MB, sin WebGL, sin módulos ES y sin Service Workers.

## 1. Principios técnicos

1. **ES5 estricto** en todo el código servido. Sin `let`, `const`, clases, `Promise`
   obligatoria, `fetch`, plantillas literales ni módulos.
2. **Sin framework**. Módulos IIFE que se concatenan en un solo archivo en el build.
3. **DOM para la interfaz, Canvas para el arte**. Los paneles no se dibujan en canvas.
4. **Presupuesto de memoria explícito** y degradación controlada antes de llegar al crash.
5. **Una sola fuente de verdad** para el documento (capas, pinceles, paletas) serializable.
6. **Todo lo caro es diferido**: miniaturas, codificación PNG, autoguardado y
   previsualizaciones se ejecutan en huecos de inactividad, nunca durante un trazo.

## 2. Estructura de código prevista

```
/src
  /core      estado, eventos, geometría, matriz de vista, reloj/rAF, perfil de dispositivo
  /paint     entrada táctil, filtros de trazo, estampado, formas, grano, pinceles
  /doc       capas, composición, selección, transformación, historial
  /io        almacenamiento (IDB/WebSQL/memoria), exportación, importación, plist binario
  /ui        shell, barra superior, barra lateral, paneles, galería, gestos, quick menu
  /vendor    shims mínimos (rAF, bind) y utilidades
/tools       build.js (concat + comprobación ES5 + minificado ES5), server.js (LAN), diag
/tests       pruebas Node de matemática, serialización y plist; golden images opcional
/docs        esta documentación
```

Build: `node tools/build.js` → `dist/app.js` + `dist/index.html` + assets.
Se generan dos variantes: `debug` (legible) y `release` (minificada, ES5).
El servidor de desarrollo sirve por LAN para abrir desde el iPad (`http://IP:8090`).

## 3. Modelo de documento

```js
{
  schema: "pcw/1",
  id: "…",
  name: "Sin título",
  width: 1024, height: 768,
  background: "#ffffff",
  layers: [
    { id:"l1", name:"Capa 1", visible:true, opacity:1, blend:"source-over",
      alphaLock:false, data:"l1.png" }
  ],
  brushes: [ /* pinceles propios + referencia a presets */ ],
  palettes: [ /* paletas */ ],
  view: { scale:1, rotation:0, tx:0, ty:0 },
  historyLimit: 20
}
```

- Metadatos en JSON; **cada capa se guarda como PNG independiente** para no reescribir
  registros grandes en cada autoguardado.
- El estado en memoria mantiene un `canvas` por capa y un canvas compuesto de vista.

## 4. Presupuesto de memoria

| Lienzo | Píxeles | Bytes por capa (RGBA) |
|---|---|---|
| 1024 × 768 | 0,79 MP | 3,1 MB |
| 1536 × 1152 | 1,77 MP | 7,1 MB |
| 2048 × 1536 | 3,15 MP | 12,6 MB |
| 2560 × 1920 | 4,92 MP | 19,7 MB |
| 3072 × 2304 | 7,08 MP | 28,3 MB |
| 4096 × 4096 | 16,8 MP | 67,1 MB |

Perfiles propuestos (ajustables tras medir en el dispositivo):

| Perfil | Lienzo por defecto | Capas simultáneas | Memoria de capas | Uso |
|---|---|---|---|---|
| S | 1024 × 768 | 8 | ~25 MB | Bocetos, uso fluido |
| M | 1536 × 1152 | 5 | ~36 MB | Equilibrio |
| L | 2048 × 1536 | 3 | ~38 MB | Ilustración final |
| XL | 2560 × 1920 | 2 | ~39 MB | Solo bajo prueba |

Reglas:

- Presupuesto duro de píxeles de capa: **~40 MB** (se recalcula al crear/cambiar lienzo).
- Memoria adicional: compuesto de vista (~3 MB), cachés de sellos (~4 MB), historial
  (~12 MB), miniaturas (~2 MB). Techo operativo objetivo: **≤ 70 MB** de datos de imagen.
- Si el usuario pide más capas de las que caben, la app **impide la operación con aviso**
  en lugar de provocar un cierre de Safari.
- El perfil se elige por prueba empírica al arrancar (ver §10), no solo por `userAgent`.

> Los límites de canvas de iOS 9 no están documentados de forma fiable. Se tratan como
> desconocidos hasta medirlos; por eso el diseño incluye un banco de pruebas y un modo
> degradado, no una promesa de 4096 px.

## 5. Composición y vista

- **Canvas de vista**: tamaño del área de dibujo en píxeles CSS (1024 × 768 menos barras).
- **Transformación de vista** (escala, rotación, traslación) aplicada con
  `ctx.setTransform`, sin tocar los canvas de capa.
- **Caché de composición por tramos**: se precomponen las capas inferiores y superiores a
  la activa. Mientras se pinta, solo se recompone la capa activa sobre esas cachés.
  Se invalida al cambiar orden, opacidad, visibilidad o fusión.
- **Repintado por regiones sucias**: cada trazo acumula un rectángulo sucio; se redibuja
  solo esa zona.
- **Durante el trazo** se puede reducir la calidad de previsualización (p. ej. estampar a
  media resolución en un buffer de trazo y volcar al soltar) si la medición lo exige.
  Es una diferencia visible que se documentará y podrá desactivarse.

## 6. Motor de pintura

Cadena de procesamiento:

```
touchstart/move/end
  → normalización (coordenadas de lienzo, radio, tiempo)
  → filtro de entrada (StreamLine / estabilización / filtro de movimiento)
  → remuestreo por distancia (spacing)
  → cálculo de parámetros por sello (tamaño, opacidad, rotación, jitter, taper)
  → sello pre-renderizado (shape × grain × color)
  → dibujo en la capa activa (source-over / destination-out)
  → marca de región sucia y solicitud de repintado
```

Decisiones clave:

- **Sellos pre-renderizados por cubos de tamaño** (p. ej. razón 1,15×): evita regenerar
  la forma en cada punto. Caché LRU con límite de bytes.
- **Forma + grano**: se compone una sola sprite por combinación (forma, grano, color,
  tamaño). El grano se aplica con `createPattern` y máscara alfa.
- **Sin `getImageData` por sello**. Solo se lee para: cuentagotas, ColorDrop, smudge
  (muestreo limitado) y snapshots de historial.
- **Taper por distancia** al inicio/fin del trazo, equivalente al «Touch Taper» original.
- **Dinámica sin presión**: velocidad → tamaño/opacidad; dirección → rotación;
  `DeviceOrientation` opcional para inclinación. Se documenta como aproximación.
- **Smudge**: muestreo de una región pequeña + estampado desplazado y difuminado.
  Coste alto: se limita a pinceles y tamaños concretos y se degrada en el perfil S.
- **ColorDrop**: relleno por scanline sobre `ImageData` de la capa, con tolerancia y
  referencia opcional. Operación puntual, no interactiva.

### Esquema de pincel (subconjunto 3.1, a validar)

```js
{
  id, name, category: "pencil|ink|painting|airbrush|water|texture|charcoal|…",
  stroke:  { spacing, spacingJitter, jitterLateral, jitterLinear, fallOff },
  stab:    { streamline, stabilization, motionFiltering },
  taper:   { start, end, size, opacity, tip },
  shape:   { source, rotation, scatter, count, countJitter, randomize, flipX, flipY,
             roundness, roundnessJitter },
  grain:   { source, moving, scale, zoom, rotation, depth, depthJitter, offsetJitter,
             blendMode, brightness, contrast },
  render:  { mode, flow, wetEdges, alphaThreshold },
  dyn:     { sizeBySpeed, opacityBySpeed, sizeByTilt, opacityByTilt }
}
```

`source` es una imagen propia (generada o importada por el usuario); nunca un asset copiado.

## 7. Historial (undo/redo)

- Snapshots **por mosaicos** de 128 × 128 px de la capa afectada, no del lienzo completo.
- Cada entrada guarda: capa, rectángulo sucio, píxeles previos y posteriores (o solo previos
  y se rehace reaplicando el trazo cuando sea determinista).
- Límite por **bytes** (p. ej. 12 MB), no por número fijo. En 1024 × 768 suele equivaler a
  20–40 pasos; en 2048 × 1536, a 5–10.
- Diferencia documentada frente a los 250 niveles de Procreate 3.1.

## 8. Almacenamiento

Sondeo de capacidades al arrancar y selección del adaptador:

1. **IndexedDB** (principal). En iOS 9.3 está marcado como gravemente defectuoso
   (E-06): puede fallar al abrir, al escribir o tras reabrir la pestaña. Todas las
   operaciones van envueltas en timeout y verificación de lectura.
2. **WebSQL** (respaldo). Disponible en Safari 9; guarda PNG como base64/`ArrayBuffer`.
   Cuota a medir; se usa para proyectos pequeños si IDB falla.
3. **Memoria** (modo seguro). La app funciona, pero avisa de que no hay persistencia.

Medidas de seguridad de datos:

- Verificación de escritura (leer lo escrito) tras cada guardado.
- Autoguardado con debounce; nunca durante el trazo.
- Chevron de recuperación: si al abrir IDB falla, se intenta WebSQL.
- **Exportar proyecto** como acción de respaldo siempre visible.
- Aviso explícito de que iOS puede desalojar la pestaña y de que el respaldo fiable es
  el archivo exportado.

## 9. Importación / exportación

| Formato | Viabilidad | Método |
|---|---|---|
| PNG | Alta | `canvas.toDataURL('image/png')` |
| JPEG | Alta | `toDataURL('image/jpeg', q)` |
| Proyecto propio (`.pcw`) | Alta | JSON + PNG por capa, empaquetado con cabecera propia |
| PDF | Media | Generador PDF mínimo en JS (una página por capa o compuesto) |
| PSD | Media/baja | Escritor PSD propio (RLE); costoso en A5, fase posterior |
| `.brush` / `.brushset` | Media | Parser de plist binario + NSKeyedArchiver propio, solo para archivos del usuario |

**Problema de entrega en Safari 9:** no existe el atributo `download` (E-09) ni
`canvas.toBlob`. Opciones a prototipar:

- Abrir el data URL en una pestaña y guiar al usuario a «mantener pulsado → Guardar imagen».
- Página de exportación con la imagen en `<img>` y la misma instrucción.
- Para archivos grandes, dividir o comprimir antes; los data URLs enormes pueden fallar.

La experiencia de exportación será distinta a la de Procreate y se documentará como tal.

## 10. Perfil de dispositivo y banco de pruebas

`?diag=1` ejecuta y muestra:

- UA, `devicePixelRatio`, tamaño de pantalla, `navigator.platform`.
- Área máxima de canvas asignable (bucle creciente hasta fallo).
- Tiempo de `fillRect`, `drawImage` y modos de fusión sobre 1 MP.
- Apertura/escritura/lectura/reapertura de IndexedDB; disponibilidad de WebSQL.
- Tasa real de `touchmove` y latencia de `touchstart` a primer pintado.
- Tamaño máximo de data URL generado con éxito.

Con esos datos se fijan los perfiles S/M/L/XL y el límite de capas. Sin esta medición no se
promete ningún límite de rendimiento.

## 11. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| IndexedDB defectuoso en 9.3 | Pérdida de proyectos | Respaldo WebSQL, verificación, exportación |
| Límite de canvas desconocido | Crash de Safari | Perfil conservador + medición + aviso |
| Canvas 2D lento en A5 | Trazo con retraso | Cachés, sellos, regiones sucias, degradación |
| Sin presión | Menor expresividad | Dinámica por velocidad + taper + inclinación |
| Memoria de Safari | Recarga de pestaña | Presupuesto duro, sin cachés ilimitadas |
| Complejidad de PSD/.brush | Retraso | Fases separadas y opcionales |
| Fidelidad visual de pinceles | Percepción de «app genérica» | Biblioteca por categorías + ajustes equivalentes |
