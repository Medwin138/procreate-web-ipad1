# 05 — Limitaciones de Safari 9.3.5 y del iPad mini 1

## 1. Hardware de referencia

| Dato | Valor | Fuente |
|---|---|---|
| Modelo | iPad mini 1 (A1432) | Enunciado / Wikipedia |
| SoC | Apple A5, 2 núcleos Cortex-A9 a 1 GHz | E-10 |
| GPU | PowerVR SGX543MP2 | E-10 |
| RAM | 512 MB | E-10 |
| Pantalla | 1024 × 768, 163 ppp, no Retina | E-10 |
| `devicePixelRatio` esperado | 1 | Consecuencia del panel no Retina; verificar |
| Sistema máximo | iOS 9.3.5 (Wi-Fi) / 9.3.6 (cellular) | E-10 |
| Safari | 9.x (WebKit de iOS 9.3) | — |
| Apple Pencil | No compatible | El Pencil requiere iPad Pro |
| Presión táctil | No disponible por API | `Touch.force` no aplica a este equipo |

## 2. APIs: disponibilidad y consecuencia

| API / función | Safari 9.3 | Consecuencia en el proyecto | Evidencia |
|---|---|---|---|
| Canvas 2D | Sí | Base del motor | — |
| Modos de fusión de canvas | Sí | Capas con 16 modos + normal | E-07 |
| `Path2D` | Sí (Safari 8+) | Formas y trazados | E-08 |
| `requestAnimationFrame` | Sí | Bucle de dibujo | — |
| Touch Events | Sí | Entrada multitáctil | — |
| `DeviceOrientation` | Sí (verificar) | Inclinación aproximada | A medir |
| Web Workers | Sí | Solo para tareas sin DOM; memoria limitada | A medir |
| IndexedDB | **Defectuoso** («seriously buggy»), sin WebView | Almacenamiento principal frágil | E-06 |
| WebSQL | Sí (obsoleto) | Respaldo de almacenamiento | A medir |
| `localStorage` | Sí, ~5 MB | Solo ajustes pequeños | — |
| `canvas.toDataURL` | Sí | Export PNG/JPEG | — |
| `canvas.toBlob` | **No** | Sin Blob directo; usar data URL | Safari 11+ |
| Atributo `download` | **No** | Guardado manual vía pestaña/`<img>` | E-09 |
| `URL.createObjectURL` | Sí | Posible, pero la descarga sigue sin `download` | A probar |
| Service Workers | **No** | Sin caché offline fiable ni app instalable | Safari 11.1+ |
| Módulos ES (`import`) | **No** | Build concatenado en ES5 | — |
| `fetch` | **No** | `XMLHttpRequest` | — |
| `Promise` | Sí (Safari 8+) | Se evita por simplicidad y memoria | — |
| Pointer Events | **No** | Solo Touch/Mouse | Safari 13+ |
| `touch-action` | **No** | Hay que `preventDefault` manualmente | Safari 13+ |
| CSS Grid | **No** | Layout con flexbox con prefijo o tablas | — |
| Variables CSS | **No** | Tokens en JS o valores repetidos | Safari 9.1+ |
| `mix-blend-mode` CSS | Parcial | No usar para el arte; sí para UI simple | A verificar |
| `backdrop-filter` | **No** | Paneles opacos o semitransparentes simples | — |
| `OffscreenCanvas` | **No** | Canvas ocultos en DOM | — |
| WebGL | Disponible pero **excluido por requisito** | Todo el render es CPU | — |
| `MediaRecorder` | **No** | Sin time-lapse de vídeo | — |
| `navigator.share` | **No** | Sin hoja de compartir nativa | — |
| `navigator.deviceMemory` | **No** | Perfil por medición empírica | — |
| `getCoalescedEvents` | **No** | Menos muestras por frame | — |

## 3. Límites no documentados que hay que medir

No existe una cifra fiable y estable para iOS 9 sobre:

1. **Área máxima de canvas** asignable por pestaña y número de canvas simultáneos.
2. **Memoria máxima del proceso Safari** antes de recargar la pestaña.
3. **Cuota real de IndexedDB y WebSQL**, y comportamiento al superarla.
4. **Tamaño máximo de data URL** que Safari acepta abrir o renderizar.
5. **Rendimiento de `globalCompositeOperation`** por modo y tamaño.
6. **Tasa efectiva de `touchmove`** y latencia hasta el primer píxel pintado.
7. **Límite real de capas y de tamaño de lienzo de Procreate 3.1 en este modelo**.

El banco de pruebas `?diag=1` (ver `03-arquitectura.md` §10) existe para responder a 1–6.
El punto 7 se responde observando la app original en el dispositivo.

## 4. Funciones que no podrán reproducirse exactamente

| Función original | Motivo | Alternativa |
|---|---|---|
| Aspecto exacto de los 128 pinceles | Assets propietarios; no se copian | Pinceles propios equivalentes por categoría |
| Motor Silica / GPU | Sin WebGL por requisito; Canvas 2D es CPU | Optimización por sellos, cachés y regiones sucias |
| Color de 64 bits | Canvas trabaja en 8 bits por canal | sRGB 8 bits; suficiente para el panel |
| 250 niveles de deshacer | Memoria | 10–30 según lienzo, con presupuesto en bytes |
| Presión, inclinación y azimut del Pencil | El A1432 no soporta Pencil; Safari no lee stylus Bluetooth | Velocidad, dirección, taper e inclinación del dispositivo |
| Rechazo de palma fiable | Sin API | Heurística; puede fallar |
| Time-lapse y retransmisión | Sin `MediaRecorder` ni captura de pantalla web | No disponible |
| AirDrop, iCloud, compartir nativo | Sin APIs | Exportación por archivo/pestaña |
| Importar PSD y grupos | No existen en 3.1 | No aplica a la fidelidad |
| Máscaras de capa | No existen en 3.1 (4.0+) | Extensión opcional |
| Lienzos de 16k | Memoria y CPU | Perfiles S/M/L/XL |
| P3 / gestión de color | Panel sRGB y canvas sRGB | sRGB |

## 5. Restricciones legales y de marca

- **No se copiarán** código, iconos, texturas, pinceles, paletas ni capturas de Procreate
  dentro del producto.
- El análisis de un IPA propio se limita a estructura y recursos no cifrados; **no se
  descifrará** el ejecutable.
- «Procreate» es marca registrada de Savage Interactive. El proyecto puede usar el nombre
  como referencia interna de investigación, pero **el producto publicable necesitará otro
  nombre** y no debe sugerir afiliación.
- Las capturas del dispositivo se usarán como referencia de diseño, no como assets.

## 6. Riesgos de estabilidad y su tratamiento

| Síntoma esperado | Causa | Tratamiento |
|---|---|---|
| Recarga de pestaña | Presión de memoria | Presupuesto duro, liberar cachés, menos capas |
| Cierre al crear lienzo grande | Límite de canvas | Medición + bloqueo preventivo |
| Pérdida de proyectos | IndexedDB defectuoso | Respaldo WebSQL, verificación, exportación |
| Trazo con retraso | CPU/Canvas 2D | Previsualización degradada opcional |
| Gestos del navegador interfiriendo | Sin `touch-action` | `preventDefault` + viewport + zona de gestos |
| Guardado imposible | Sin `download` | Página de exportación con instrucciones |
