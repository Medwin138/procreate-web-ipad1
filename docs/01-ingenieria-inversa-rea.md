# 01 — Ingeniería inversa con REA: alcance real, evidencias y límites

Fecha de las comprobaciones: **2026-11-11**
Herramienta: servidor MCP `rea` conectado a este agente.

## 1. Principio de trabajo

Este proyecto usa ingeniería inversa **solo con material y métodos autorizados**:

- Observación del comportamiento de la aplicación en un dispositivo propio.
- Documentación pública del fabricante (manual, notas de versión, fichas de App Store).
- Análisis de paquetes/recursos que el usuario aporte y que haya obtenido legalmente.
- Reimplementación independiente a partir de comportamiento observable y especificaciones web.

Queda fuera de alcance: descifrar el binario FairPlay de la App Store, distribuir assets
propietarios, copiar código, o afirmar resultados de análisis que no se hayan producido.

## 2. Qué puede hacer REA en este equipo (comprobado)

Consulta real a `binary_session` (sesión sin objetivo abierto, `open: false`):

| Proveedor / grupo | Operaciones | Disponible | Motivo |
|---|---|---|---|
| `rea-artifact-graph` | `inspect_artifact`, `extract_artifact` | Sí | — |
| `rea-artifact-graph` | `decode_interface_builder`, `inspect_keyed_archive`, `trace_dylib_resolution` | Sí | — |
| `rea-artifact-graph` | `inspect_asset_catalog` | **No** | requiere `assetutil` de macOS |
| `native-macos` | `inspect_macho`, `inspect_plist`, `inspect_signature`, `list_architectures`, `demangle_swift` | **No** | requiere macOS |
| `native-macos` | `observe_native_ui`, `capture_native_ui_scenario`, `observe_native_calls` | **No** | requiere macOS |
| `ghidra` | análisis nativo/decompilación | **No** | `GHIDRA_INSTALL_DIR` no configurado |
| `ida` | análisis nativo/decompilación | **No** | no configurado |
| `rea-dotnet-static` | metadatos .NET | Sí | no aplica a iOS |

También se comprobó el entorno local:

- `frida`, `frida-ps`, `ideviceinfo`, `rizin`, `ida64`, `ghidraRun`: **no instalados**.
- `python`, `node`, `java`, `npx`: instalados.
- No hay directorio de copias de seguridad de iTunes (`MobileSync\Backup`).
- Búsqueda recursiva en el perfil de usuario de `*.ipa`, `*.app`, `*.brushset`, `*.brush`: **sin resultados**.
- La carpeta del proyecto existía vacía al iniciar la Fase 1.

**Conclusión:** REA está operativo, pero no existe objetivo que analizar y varias rutas de
análisis propias de iOS/macOS no están disponibles en Windows.

## 3. Qué se podría analizar legítimamente y qué no

### 3.1 Si el usuario aporta un IPA de su propia compra

| Artefacto | REA | Límite real |
|---|---|---|
| Inventario del bundle (`.app`, frameworks, recursos) | `inspect_artifact` / `extract_artifact` | Permitido; revela estructura, no código |
| `Info.plist`, cadenas de configuración | Lectura de recursos (los binarios plist no están cifrados) | Permitido |
| `.brush` / `.brushset` (keyed archive) | `inspect_keyed_archive` | Permitido; permitiría conocer el **esquema de parámetros** de pinceles |
| Storyboards/nibs compilados | `decode_interface_builder` | Parcial; no garantiza reconstruir la UI |
| Catálogo de assets (iconos, texturas) | **Bloqueado** | `assetutil` solo en macOS |
| Ejecutable Mach-O | **Bloqueado** | Cifrado FairPlay; además sin proveedor Mach-O en Windows |
| Frameworks propios (Silica/Valkyrie) | **Bloqueado** | Mismo motivo |

Nota importante: incluso en macOS, el binario de la App Store está cifrado. Un análisis
estático del código de Procreate no es viable sin descifrarlo, lo que este proyecto no hará.

### 3.2 Observación en tiempo de ejecución

| Método | Disponibilidad | Comentario |
|---|---|---|
| Captura de UI nativa de iOS | **No** | REA solo cubre UI nativa macOS |
| Frida sobre iPad (jailbreak) | **No instalado** | Requiere jailbreak y consentimiento; no es necesario para la Fase 1 |
| Safari Web Inspector remoto | **No en Windows** | Requiere Safari de macOS y cable; iOS 9 no expone alternativas |
| Grabación de pantalla del iPad + revisión manual | **Sí** | Método principal propuesto para la referencia visual y de gestos |
| Exportaciones de la app (PNG, PSD, `.procreate`) | **Sí** | Evidencia de salida real para comparar color, capas y compresión |
| Barridos de parámetros (tamaño, opacidad, estabilidad) | **Sí** | Evidencia cuantificable de comportamiento de pincel |

## 4. Evidencias documentales utilizadas

| ID | Fuente | Dato extraído |
|---|---|---|
| E-01 | Llamada `binary_session` de REA (2026-11-11) | Capacidades y bloqueos de la tabla anterior |
| E-02 | Búsqueda local de artefactos | No hay IPA/app/pinceles ni backups |
| E-03 | App Store archivada, 2017-03-01, Procreate 3.2.1 | «Requires iOS 10.0 or later» |
| E-04 | App Store archivada, 2018-04-08, historial de versiones | 3.1.2 «last update for iPad 2, iPad mini 1 and iPad 3»; 3.1.3/3.1.4 para dispositivos antiguos; 3.2 requiere iOS 10 |
| E-05 | Manual oficial Procreate (v5.4), Brush Studio Settings | Taxonomía actual de atributos de pincel |
| E-06 | caniuse `indexeddb` | iOS 9.3: soporte «a #2» = comportamiento gravemente defectuoso |
| E-07 | caniuse `canvas-blending` | iOS 9.3: modos de fusión de canvas soportados |
| E-08 | MDN browser-compat-data `Path2D` | Safari 8+ |
| E-09 | caniuse `download` | iOS Safari no soporta `download` hasta 13 |
| E-10 | Wikipedia, iPad mini (1.ª gen.) | A5, 512 MB, 1024×768, iOS 9.3.5 (Wi-Fi) / 9.3.6 (cellular) |
| E-11 | Ficha App Store 3.2.1 | 128 pinceles, 35 ajustes por pincel, 17 modos de fusión, 250 niveles de undo, motor Silica 64-bit |
| E-12 | Notas de versión 3.1 | StreamLine, Quick Menu, selección automática, presets de lienzo, botón Modify, gestos avanzados, export PDF, duplicar selección a capa |
| E-13 | Notas de versión 3.2 | Grupos de capas, importación PSD, bloqueo de capas, selección múltiple de capas |
| E-14 | Notas de versión 4.0 | Máscaras de capa, wet mix, modos de fusión de pincel, nueva galería |

## 5. Lo que NO se ha verificado (y no se afirmará)

- No se ha visto el código de Procreate ni su motor.
- No se conocen los valores internos de los 35 ajustes de sus 128 pinceles.
- No se ha medido el rendimiento real del iPad mini 1 de este usuario.
- No se ha confirmado qué compilación exacta (3.1.3 o 3.1.4) ofrece la App Store a ese iPad.
- No se ha comprobado si el usuario posee la compra de Procreate en su Apple ID.

## 6. Plan de evidencia para cerrar la Fase 1 en el dispositivo

1. **Identificar la versión instalada** (Ajustes → Procreate; o ficha de la app).
2. **Capturar la referencia visual**: pantalla de Galería, creación de lienzo, barras, paneles,
   biblioteca de pinceles, editor de pincel, color, capas, ajustes, selección y transformación.
3. **Medir comportamiento**: latencia percibida, muestras de trazo, respuesta de zoom/rotación,
   umbrales de gestos, límites de capas y tamaño de lienzo que la app acepta en ese modelo.
4. **Exportar muestras** (PNG/PSD) para comparar color y composición.
5. **Opcional**: aportar un `.brushset` propio para inspeccionar el esquema con
   `inspect_keyed_archive` (sin publicar ni redistribuir su contenido).

Con esas evidencias se sustituyen supuestos por datos y se cierra la matriz de equivalencia.
