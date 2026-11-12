# 07 — Aprobación y decisiones pendientes

La Fase 2 **no comienza** hasta que se respondan las decisiones bloqueantes.

## Bloqueantes

### D1. Acceso a la referencia real (crítico)

¿Existe Procreate instalado en el iPad mini 1 y está asociado al Apple ID del usuario?

- Si **sí**: se puede ejecutar la Fase 0 (capturas, medidas, exportaciones) y la fidelidad
  será verificable.
- Si **no**: la App Store solo ofrece la versión actual (requiere iOS 15+). Sin la compra
  previa no hay forma legítima de obtener la 3.1.x para ese iPad. En ese caso la referencia
  sería documental (manual y notas de versión) y la fidelidad visual no sería verificable.

**Recomendación:** confirmar esto antes de cualquier desarrollo.

### D2. Aporte de artefactos para REA (opcional)

¿Puede el usuario aportar un `.ipa` o `.brushset` obtenido de su propia compra para
inspección local? Límites que se aplicarían:

- Solo estructura de paquete, plists y keyed archives.
- No se descifra el ejecutable.
- No se publica ni redistribuye el contenido.
- El IPA no se sube a ningún servicio.

**Recomendación:** aportar un `.brushset` propio es suficiente para validar el esquema de
pinceles; el IPA completo aporta poco dado el bloqueo del binario.

### D3. Prioridad fidelidad vs. fluidez

En A5, algunos efectos (smudge, ajustes por píxel, previsualización a resolución completa)
compiten con la fluidez.

- **A. Fidelidad primero**, con degradación automática avisada.
- **B. Fluidez primero**, simplificando efectos en el dispositivo.

**Recomendación:** A, con perfiles y aviso visible; el usuario puede bajar calidad.

### D4. Alcance de extensiones fuera de 3.1

¿Se incluyen funciones que la referencia no tiene (grupos, máscaras, bloqueo de capa,
importación PSD, wet mix) como extras?

- **A. No** en la v1: fidelidad estricta a 3.1.
- **B. Sí**, marcadas como extensiones y desactivadas por defecto.

**Recomendación:** A para la v1; B después de validar el núcleo.

## Decisiones de producto y entrega

### D5. Formato de proyecto y exportación

Safari 9 no permite descargar archivos con un clic. Opciones:

- **A. Todo en cliente** con página de guardado (mantener pulsado → Guardar imagen).
  Sin red, sin servidor, sin cuentas.
- **B. Servicio de conversión** externo para empaquetar ZIP/PSD y descargar. Añade red,
  privacidad y coste.

**Recomendación:** A. Documentar la diferencia de flujo frente a Procreate.

### D6. Nombre público y marca

«Procreate» es marca registrada. ¿Nombre de trabajo interno y nombre público?

**Recomendación:** mantener «Procreate Web Adaptation» solo como nombre interno de
investigación; elegir un nombre propio antes de publicar.

### D7. Publicación

- **A. Uso personal** en LAN o archivo local servido desde el PC.
- **B. Hosting estático HTTPS** para abrir desde cualquier red.

**Recomendación:** B para pruebas reales cómodas; sin Service Worker no hay instalación
offline, así que la conexión es necesaria al abrir.

### D8. Colaboración en pruebas

¿El usuario puede ejecutar el banco de pruebas y enviar capturas/informes tras cada hito?
Sin esto, la Fase 7 no se puede cerrar.

## Checklist de aprobación

- [ ] D1 confirmada (versión instalada o ausencia de la app).
- [ ] D2 decidida (aportar o no artefactos).
- [ ] D3 decidida (fidelidad vs fluidez).
- [ ] D4 decidida (extensiones fuera de 3.1).
- [ ] D5 decidida (exportación en cliente).
- [ ] D6 decidida (nombre).
- [ ] D7 decidida (publicación).
- [ ] D8 confirmada (pruebas en dispositivo).
- [ ] Aprobación explícita para iniciar la Fase 2.

## Lo que no se hará sin autorización

- Escribir código de la aplicación.
- Instalar herramientas o modificar configuración de REA.
- Jailbreak o instalación de Frida en el iPad.
- Publicar, desplegar o compartir artefactos.
- Usar assets, pinceles o código de Procreate.
