# Procreate Web Adaptation — iPad mini 1 (A1432, iOS 9.3.5)

**Demo publicada:** https://medwin138.github.io/procreate-web-ipad1/

Adaptación web de Procreate orientada a conservar el flujo de trabajo, la organización
de la interfaz y el comportamiento de las herramientas de la aplicación original,
ejecutable en Safari 9.3.5 sobre iPad mini 1 (A5, 512 MB RAM, 1024 × 768).

> **Estado: FASE 2 — shell funcional y herramientas principales reconstruidas. Pendiente de validación en el iPad real.**
> La galería, el estudio, los paneles, el almacenamiento, la exportación y el diagnóstico
> funcionan en Chromium de escritorio. También están implementados ColorDrop, selección
> (con añadir/restar), transformación, ajustes, bloqueo alfa, configuración del lienzo y
> una biblioteca propia de 29 pinceles en las 11 categorías nativas. El motor de trazo
> incorpora estabilización, StreamLine, filtro de movimiento, QuickShape, curvas Bézier
> editables y corrección de forma a petición. Deshacer y rehacer funcionan por gesto
> (2 y 3 dedos) y por botón de barra o Quick Menu, con tolerancia a temblor y
> `touchcancel`. La fidelidad visual **no se ha comparado contra Procreate 3.1**. Ver
> [`docs/08-fase2-shell.md`](docs/08-fase2-shell.md) y
> [`docs/09-herramientas-y-paridad.md`](docs/09-herramientas-y-paridad.md).

## Hallazgo principal de la Fase 1

La versión de referencia **no es Procreate 5.x**. Por el historial público de la App Store:

- Procreate 3.1.2 (2 oct 2016) se anunció como «the last update for the iPad 2, iPad mini 1 and iPad 3».
- 3.1.3 y 3.1.4 (oct 2016) fueron mantenimientos para «older device users».
- Procreate 3.2 (dic 2016) ya requería iOS 10; la ficha archivada de 3.2.1 indica «Requires iOS 10.0 or later».

Por tanto, la referencia funcional para este proyecto es la **línea Procreate 3.1.x**,
no las versiones actuales. Esto cambia el alcance: por ejemplo, **las máscaras de capa
llegan en Procreate 4.0** y los **grupos de capas en 3.2**, así que no forman parte de la
aplicación original que corre en este iPad. Documentar esa diferencia es parte del trabajo.

Detalle y evidencias: [`docs/02-inventario-funcional-procreate-3.1.md`](docs/02-inventario-funcional-procreate-3.1.md).

## Estado real de la ingeniería inversa

REA está conectado (servidor MCP `rea`), pero **hoy no puede analizar Procreate**:

1. No existe ningún `.ipa`, `.app`, `.brushset` ni copia de seguridad de iTunes en este equipo
   (búsqueda verificada; ver `docs/01-ingenieria-inversa-rea.md`).
2. No hay herramientas de dispositivo iOS (`frida`, `libimobiledevice`) ni proveedor nativo
   configurado (Ghidra/IDA). Las utilidades Mach-O/asset-catalog de REA requieren macOS.
3. Aunque se aportara un IPA obtenido legalmente, el binario de App Store está cifrado
   (FairPlay); descifrarlo queda fuera del alcance autorizado. Sí serían analizables
   recursos no cifrados y archivos keyed-archive (p. ej. pinceles), si el usuario los aporta.

En consecuencia, esta fase **no afirma haber recuperado código, assets ni parámetros
internos de Procreate**. Lo que se documenta son funciones observables en fuentes públicas
y el plan para obtener evidencia de comportamiento en el dispositivo del usuario.

## Documentos

| Archivo | Contenido |
|---|---|
| `docs/01-ingenieria-inversa-rea.md` | Capacidades reales de REA, evidencias, alcance legal, qué falta |
| `docs/02-inventario-funcional-procreate-3.1.md` | Funciones identificadas y su versión de origen |
| `docs/03-arquitectura.md` | Arquitectura web compatible con Safari 9 y presupuesto de memoria |
| `docs/04-matriz-equivalencia.md` | Equivalencia función por función y diferencias admisibles |
| `docs/05-limitaciones-safari9.md` | Límites de API y hardware, con evidencia |
| `docs/06-plan-adaptacion.md` | Fases, criterios de aceptación y validación en iPad real |
| `docs/07-aprobacion-y-decisiones.md` | Decisiones pendientes antes de programar |
| `docs/08-fase2-shell.md` | Alcance real del shell, pruebas ejecutadas y límites |
| `docs/09-herramientas-y-paridad.md` | ColorDrop, selección, transformación, ajustes, bloqueo alfa, lienzo, asistencia de trazos y paridad real con 3.1 |

## Restricciones del proyecto

- HTML5, CSS3, JavaScript ES5, Canvas 2D, IndexedDB/WebSQL. Sin WebGL, sin módulos ES,
  sin Service Workers, sin frameworks modernos.
- Sin copiar código, assets, pinceles ni recursos propietarios de Savage Interactive.
- Sin eludir DRM ni usar material no autorizado.
- Nada se declara terminado sin probarlo en el iPad mini 1 real.

## Cómo ejecutar

```bash
npm run check   # build + pruebas + comprobación de ids
npm start       # servidor en http://0.0.0.0:8090
```

Abre `http://localhost:8090/` en el equipo o `http://IP-DEL-PC:8090/` en el iPad.
Diagnóstico directo: `http://localhost:8090/?diag=1`.

El proyecto está versionado con Git en la rama `master`. `dist/app.js` se versiona
porque es el archivo que sirve el navegador del iPad; se regenera con `npm run check`
y no debe editarse a mano.

## Publicación en GitHub Pages

La web es estática y se publica desde la raíz de `master` en GitHub Pages. El flujo es:

```bash
npm run check
git add -A
git commit -m "Actualiza la build"
git push origin master
```

GitHub Pages reconstruye el sitio solo. No hay backend: cada navegador guarda sus
proyectos en IndexedDB/WebSQL bajo el origen publicado, separados de los de
`localhost:8090`.

## Aviso legal

Proyecto independiente de estudio y compatibilidad. **No está afiliado, patrocinado ni
respaldado por Savage Interactive Pty Ltd.** «Procreate» es una marca de su titular y se
menciona solo para describir la referencia funcional. No se copian código, recursos,
pinceles ni parámetros propietarios: la interfaz y los pinceles son aproximaciones
propias y no se distribuye ningún binario de la app original.

## Siguiente paso

1. Ejecutar la lista de validación en el iPad mini 1 real
   (`docs/08-fase2-shell.md`, sección 7) y guardar el informe de diagnóstico.
2. Corregir lo que falle en Safari 9 antes de ampliar el motor.
3. Decidir el orden de los pendientes de paridad: warp/licuar, recorte y redimensionado
   del lienzo, transformación limitada a la selección, o validación en el dispositivo.
4. Validar en el iPad los filtros de trazo, QuickShape y el editor Bézier, y calibrar sus
   umbrales y radios táctiles con el hardware real.
