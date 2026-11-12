# 04 — Matriz de equivalencia funcional

> Esta matriz describe el **objetivo** de equivalencia, no el estado de implementación.
> El estado real, con lo probado y lo pendiente, está en
> [`09-herramientas-y-paridad.md`](09-herramientas-y-paridad.md).

Escala de fidelidad:

- **Alta**: comportamiento y resultado muy cercanos; diferencias menores de rendimiento.
- **Media**: misma función y flujo, con diferencias visibles de calidad o de tiempo.
- **Baja**: aproximación; el resultado se reconoce pero no es equivalente.
- **No**: no reproducible en Safari 9 / iPad mini 1, o inexistente en la referencia 3.1.

## A. Lienzo

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Crear lienzo con unidades y presets | Sí | Formulario con px/mm/cm/in y presets en almacenamiento | Alta | Presets propios; sin diálogo nativo de iOS |
| Zoom | Sí | Matriz de vista + `setTransform` | Alta | Rango a calibrar; sin aceleración GPU |
| Rotación | Sí | Matriz de vista | Alta | — |
| Desplazamiento | Sí | Matriz de vista con dos dedos | Alta | — |
| Volteo de lienzo | Sí | Transformación espejo de la vista | Alta | — |
| Cuadrícula / guías | Parcial | Cuadrícula 2D dibujada en canvas de vista | Media | Guías isométrica/perspectiva: fase posterior |
| Tamaño máximo | Limitado por A5 | Presets S/M/L/XL según memoria | Media | Se bloquea antes de que Safari cierre |
| Ajuste a pantalla | Sí | Cálculo de escala y centrado | Alta | — |

## B. Pinceles

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Biblioteca por sets | Sí | Panel con sets, búsqueda y previsualización | Alta | Sin miniaturas originales |
| 128 pinceles originales | Sí | 27 pinceles propios en 11 categorías | Baja/Media | No se copian assets; se iguala comportamiento |
| Lápices / tintas / pintura / aerógrafo / acuarela / texturas | Sí | Categorías equivalentes | Media | Textura y grano aproximados |
| Tamaño y opacidad | Sí | Sliders + gestos | Alta | — |
| Espaciado y jitter | Sí | Sellado por distancia con RNG | Alta | — |
| Suavizado (StreamLine/estabilización) | Sí | Filtro exponencial + filtro de movimiento | Media | Distinta formulación, mismo efecto |
| Taper | Sí | Taper por distancia inicio/fin | Alta | Sin presión real |
| Dinámica por presión | Sí (con stylus) | Velocidad + inclinación | Baja | **Sin presión en Safari** |
| Shape / grain | Sí | Formas y texturas propias + `createPattern` | Media | Sin assets originales |
| Smudge | Sí | Muestreo + estampado difuminado | Media/Baja | Coste alto en A5 |
| Importar/exportar pinceles | Sí | Parser propio de `.brush`/`.brushset` | Media | Solo archivos del usuario; esquema a verificar |
| Wet mix / modos de pincel | **No en 3.1** | No aplica | — | Extensión opcional, no fidelidad |

## C. Colores

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Disco cromático | Sí | Canvas con anillo HSV + área SB | Alta | Generado una vez, cacheado |
| Selector clásico | Sí | Canvas + sliders | Alta | — |
| Armonías | Sí | Cálculo de paletas derivadas | Media | Reglas a verificar contra la app |
| Valores / RGB / HEX | Sí | Campos y sliders | Alta | — |
| Paletas | Sí | Almacenamiento + panel | Alta | Sin paletas de sistema de iOS |
| Colores recientes | Sí | Cola en memoria + persistencia | Alta | — |
| Cuentagotas | Sí | `getImageData` puntual con lupa | Alta | Sin muestreo continuo |
| ColorDrop | Sí | Flood fill con tolerancia | Media | Sin referencia de capa en v1 |
| Perfiles de color | No | sRGB | — | El panel del mini 1 es sRGB |

## D. Capas

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Crear / duplicar / eliminar | Sí | Modelo + canvas por capa | Alta | — |
| Renombrar / reordenar | Sí | Panel con arrastre táctil | Alta | — |
| Opacidad | Sí | `globalAlpha` al componer | Alta | — |
| 17 modos de fusión | Sí | `globalCompositeOperation` | Alta | Nombres y resultado a comparar |
| Visibilidad / Alpha Lock | Sí | Flag + `destination-in/out` | Alta | — |
| Bloqueo de capa | No (3.2+) | Opcional | — | Se puede añadir como extensión |
| Grupos | No (3.2+) | Opcional | — | No es fidelidad de 3.1 |
| Máscaras | No (4.0+) | Opcional | — | No es fidelidad de 3.1 |
| Fusión con fondo | Sí | Composición ordenada | Alta | — |

## E. Edición

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Selección automática | Sí | Flood fill por umbral sobre máscara | Media | Costosa en lienzos grandes |
| Selección a mano alzada | Sí | Polígono + máscara | Alta | — |
| Rectángulo / elipse | Sí | Máscara geométrica | Alta | — |
| Añadir/sustraer selección | Sí | Operaciones sobre máscara | Alta | — |
| Duplicar selección a capa | Sí | Recorte + nueva capa | Alta | — |
| Transformar libre/uniforme | Sí | Matriz afín + remuestreo | Alta | Calidad de interpolación limitada |
| Distorsión | Sí | Transformación de 4 puntos | Media | Remuestreo por triángulos/mapeo |
| Warp | Por confirmar | — | Baja | Fase posterior si existe en 3.1 |
| Recorte de lienzo | Sí | Redimensionar capas + vista | Media | Coste de memoria |
| Relleno | Sí | Flood fill / relleno de selección | Alta | — |
| Borrador | Sí | `destination-out` | Alta | — |
| Deshacer / rehacer | 250 niveles | Snapshots por mosaicos | Media | Menos niveles por memoria |
| Deshacer rápido | Sí (3.2) | Pulsación sostenida | Media | A confirmar en 3.1 |
| Ajustes (HSB, curvas, blur, ruido…) | Sí | Procesado por píxel en canvas | Media | Curvas y blur lentos sin GPU |

## F. Almacenamiento

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Galería de proyectos | Sí | Cuadrícula DOM con miniaturas | Alta | — |
| Crear / renombrar / duplicar / eliminar | Sí | Modelo + almacenamiento | Alta | — |
| Autoguardado | Sí | Debounce + verificación | Media | IDB defectuoso en 9.3 |
| Importar imagen | Sí | `input[type=file]` + `FileReader` | Alta | Sin arrastrar y soltar |
| Exportar PNG / JPEG | Sí | `toDataURL` + página de guardado | Media | Sin `download`; guardado manual |
| Exportar proyecto editable | `.procreate` propietario | `.pcw` propio | Alta (propio) | No compatible con Procreate |
| Exportar PSD | Sí | Escritor PSD propio | Media | Fase posterior; coste alto |
| Importar PSD | No (3.2+) | — | — | — |
| Preservar capas | Sí | PNG por capa + JSON | Alta | — |
| Time-lapse | Sí | — | No | Sin codificador de vídeo en Safari 9 |
| Retransmisión / AirDrop / iCloud | Sí | — | No | Sin APIs equivalentes |

## G. Interfaz y gestos

| Función | 3.1 | Equivalente web | Fidelidad | Técnica / diferencia |
|---|---|---|---|---|
| Barra superior y lateral | Sí | DOM/CSS con medidas calibradas | Alta | Tipografía del sistema iOS 9 |
| Paneles deslizantes | Sí | DOM con transiciones cortas | Alta | Evitar animaciones costosas |
| Quick Menu | Sí | Menú flotante configurable | Alta | — |
| Pinza, rotación, pan | Sí | Reconocedor táctil propio | Alta | Hay que anular los gestos de Safari |
| Dos dedos: deshacer | Sí | Reconocedor por tiempo/umbral | Media | Conflictos con pan; calibrar |
| Tres dedos: rehacer | Sí | Idem | Media | — |
| Eyedropper por pulsación larga | Sí | Temporizador + lupa | Alta | — |
| Rechazo de palma | Parcial en la app | Heurística por tamaño/velocidad | Baja | No hay detección fiable |

## Resumen de fidelidad por módulo

| Módulo | Fidelidad esperada | Comentario |
|---|---|---|
| Lienzo | Alta | Limitado por tamaño máximo |
| Interfaz/gestos | Alta | Calibración con capturas reales |
| Capas | Alta | Los 17 modos encajan en Canvas 2D |
| Color | Alta | Sin perfiles de color |
| Pinceles | Media | Comportamiento sí; aspecto exacto no |
| Edición | Media | Selección/transformación viables; ajustes lentos |
| Almacenamiento | Media | IDB frágil; exportación manual |
| Motor de pintura | Media | Sin GPU ni presión; depende de optimización |
