# 06 — Plan de adaptación para el iPad mini 1

Cada fase termina con evidencia y un criterio de aceptación verificable. Ninguna fase se
declara terminada por tener código escrito.

## Fase 0 — Acceso a la referencia y línea base (bloqueante)

| Tarea | Resultado | Criterio |
|---|---|---|
| V1. Confirmar versión instalada de Procreate | Captura de Ajustes/ficha | Versión anotada (3.1.x esperada) |
| V2. Capturar la interfaz | 15–25 capturas: galería, creación, barras, pinceles, color, capas, ajustes, selección, transformación | Cobertura de todos los paneles de la matriz |
| V3. Grabar gestos | Vídeos cortos de pinza, rotación, pan, deshacer/rehacer, eyedropper, Quick Menu | Gestos y umbrales visibles |
| V4. Medir límites de la app | Tamaño máximo de lienzo y capas aceptadas en el A1432 | Tabla de límites real |
| V5. Exportar muestras | PNG y PSD de una obra de prueba | Archivos para comparar color y capas |
| V6. (Opcional) Aportar `.brushset` propio | Esquema de parámetros con `inspect_keyed_archive` | Informe de estructura, sin redistribuir |

Sin V1–V5 no se puede afirmar fidelidad visual: solo se podría aproximar.

## Fase 1 — Investigación y diseño (esta entrega)

Estado: **completada en su parte documental, pendiente de validación en dispositivo**.

Entregables: `docs/01` a `docs/07`.

Criterio de aceptación:

- Funciones clasificadas por versión de origen (3.1 vs posteriores).
- Capacidades reales de REA documentadas con evidencias y bloqueos.
- Arquitectura con presupuesto de memoria y estrategia de degradación.
- Matriz de equivalencia con diferencias explícitas.
- Decisiones pendientes identificadas.

## Fase 2 — Shell de interfaz y banco de pruebas

| Entregable | Detalle |
|---|---|
| `index.html` + CSS con prefijos de Safari 9 | Layout fijo 1024 × 768, sin Grid ni variables CSS |
| Galería | Cuadrícula de proyectos, crear/renombrar/duplicar/eliminar |
| Creación de lienzo | Unidades, presets, validación de memoria |
| Shell de estudio | Barra superior, barra lateral, paneles, Quick Menu |
| `?diag=1` | Medición de canvas, IDB, WebSQL, touch, data URL, fill-rate |
| Build y servidor LAN | `node tools/build.js`, `node tools/server.js` |

Criterio de aceptación:

- Se abre en el iPad mini 1 sin errores de sintaxis ni APIs ausentes.
- La galería carga en < 2 s con 20 proyectos de prueba.
- El diagnóstico se ejecuta completo y produce un informe legible.
- Navegación entre paneles sin pérdida de estado.

## Fase 3 — Motor de pintura y biblioteca de pinceles

| Entregable | Detalle |
|---|---|
| Entrada y filtros | Touch, estabilización, StreamLine, remuestreo |
| Sellado | Formas, grano, jitter, scatter, taper, rotación |
| Pinceles | 11 categorías nativas con 27 pinceles propios; edición de parámetros pendiente |
| Smudge y borrador | Implementación con límites de coste |
| Dinámica | Velocidad/dirección/inclinación (sin presión) |

Criterio de aceptación (medido en el iPad):

- Trazo continuo a 60 Hz percibidos sin huecos visibles en 1024 × 768 con 3 capas.
- Latencia desde `touchstart` hasta primer píxel < 80 ms (objetivo), medida con la app.
- Un trazo de 5 s no bloquea la interfaz más de 150 ms por frame.
- Comparación visual lado a lado con capturas de la app original: sin diferencias
  estructurales en tamaño, opacidad, taper y textura por categoría.

## Fase 4 — Capas, selección, transformación y ajustes

| Entregable | Detalle |
|---|---|
| Capas | CRUD, orden, opacidad, 16 modos + normal, alpha lock |
| Composición | Cachés inferior/superior y regiones sucias |
| Historial | Snapshots por mosaicos con presupuesto en bytes |
| Selección | Automática, freehand, rectángulo, elipse, operaciones |
| Transformación | Libre, uniforme, distorsión; duplicar a capa |
| Ajustes | HSB, balance, curvas, recolor, blur, enfocar, ruido |
| ColorDrop | Relleno con tolerancia |

Criterio de aceptación:

- Cambiar de capa y pintar no invalida la caché completa en cada frame.
- Deshacer/rehacer restaura píxeles exactos de la región afectada.
- Los modos de fusión coinciden visualmente con la app en una imagen de prueba.
- Selección automática en 1024 × 768 termina en < 1,5 s.

> Estado a 12 de noviembre de 2026: capas, alpha lock, historial por región, selección
> (incluidas suma y resta), ColorDrop, transformación de capa completa y siete ajustes
> están implementados y probados en Chromium. Quedan pendientes la distorsión de cuatro
> puntos, warp/licuar, el recorte/redimensionado de lienzo, los ajustes avanzados y la
> validación en Safari 9. Detalle en `docs/09-herramientas-y-paridad.md`.

## Fase 5 — Proyectos, almacenamiento e importación/exportación

| Entregable | Detalle |
|---|---|
| Persistencia | IDB con verificación, respaldo WebSQL, modo memoria |
| Autoguardado | Debounce y guardado por capa |
| Formato `.pcw` | JSON + PNG por capa, versión de esquema |
| Exportación | PNG/JPEG con página de guardado; PDF básico |
| Importación | Imagen desde Fotos/Files con reducción a presupuesto |
| Recuperación | Detección de datos corruptos y exportación de emergencia |

Criterio de aceptación:

- Ciclo crear → pintar → cerrar pestaña → reabrir → capas intactas, 20 veces seguidas.
- Apagar/encender el iPad y reabrir: proyecto recuperado.
- Exportar PNG y recomponer en escritorio: diferencias solo por compresión.
- Fallo simulado de IDB: la app no pierde el proyecto en curso y avisa.

## Fase 6 — Adaptación específica a Safari 9

| Entregable | Detalle |
|---|---|
| ES5 y shims | Comprobación automática del bundle |
| Gestos | Bloqueo de zoom/scroll del navegador, reconocedores propios |
| Memoria | Perfil de dispositivo, liberación de cachés, avisos |
| Exportación | Flujo alternativo sin `download` |
| Compatibilidad visual | Tipografías, radios, transiciones, sin CSS moderno |

Criterio de aceptación:

- Cero errores en consola en Safari 9 del iPad.
- Zoom del navegador y rebote de página no interfieren con el lienzo.
- Sesión de 30 minutos con 3 capas y trazos continuos sin recarga de pestaña.
- Uso de memoria estable (sin crecimiento monotónico) en la medición disponible.

## Fase 7 — Prueba en dispositivo real y optimización

| Actividad | Evidencia |
|---|---|
| Matriz de pruebas funcional | Checklist firmado por módulo |
| Pruebas de estrés | 30 min, 100 trazos, 20 capas creadas/eliminadas, exportaciones |
| Perfilado | Tiempos por operación, memoria, recargas |
| Ajuste de perfiles | S/M/L/XL definitivos y límites publicados |
| Comparación con la app | Capturas lado a lado y lista de diferencias aceptadas |

Criterio de aceptación final:

- Todas las funciones de la matriz marcadas como Alta/Media están implementadas y probadas.
- Las marcadas Baja/No están documentadas como diferencia y aceptadas por el usuario.
- Ningún dato inventado sobre REA ni sobre pruebas no ejecutadas.

## Estimación de esfuerzo (orientativa)

| Fase | Esfuerzo |
|---|---|
| 0 | 2–4 días (depende del acceso al dispositivo) |
| 2 | 1–2 semanas |
| 3 | 2–4 semanas |
| 4 | 2–3 semanas |
| 5 | 1–2 semanas |
| 6 | 1 semana |
| 7 | 1–2 semanas + iteraciones |

Los rangos son orientativos y se ajustarán tras la Fase 0. La optimización en A5 puede
consumir más tiempo que la implementación funcional.

## Protocolo de prueba en el iPad

1. Servir `dist/` por LAN desde el PC (`http://IP:8090`).
2. Abrir en Safari, añadir a pantalla de inicio para uso cuasi-pantalla completa.
3. Ejecutar `?diag=1` y guardar el informe (captura o exportación de texto).
4. Recorrer el checklist funcional y anotar tiempos con cronómetro manual.
5. Repetir tras cada hito; nunca validar solo en escritorio.
