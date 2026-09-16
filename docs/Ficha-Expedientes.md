# Ficha — Expedientes

**Estado: RATIFICADA.** Escrita el 16 de septiembre de 2026, en sesión de ASAV y Claude, y ratificada por ASAV ese mismo día, punto por punto. Lo marcado ✓ lleva su fecha.

**Qué la gobierna:** el Marco, Pieza 6 §H (6.30–6.33, el expediente) y Pieza 5 §C (los papeles); `docs/Mapa-De-La-Casa.md` (dónde vive el cuarto y cómo se llega); el skill `jtel-diseno` (cómo se ve). El Marco manda sobre los tres.

**Qué reemplaza:** la parte de expediente de `marco-limpio/Ficha-Expediente-Unidad.md` y de `marco-limpio/Ficha-Choferes.md`, escritas con la piel y el skill anteriores. No se editan: quedan como antecedente.

---

## 1. Qué es el cuarto

**Expedientes** es un lugar del menú del transportista, sin sello. Es **la puerta a los expedientes de sus cosas**: sus unidades, sus dispositivos y sus choferes (Marco §H, «Qué cambia esto en el mapa de la casa»). No es un archivero de papeles.

- **Es una vista, no guarda nada** (Ley de Acción, `Ficha-Navegacion-Completa.md` §A). Ve, agrupa y liga. Capturar, corregir y renovar un papel se hace **en el expediente de la cosa**, nunca en el cuarto.
- **Tocar una pieza abre su expediente:** `Ver ‹unidad›`, `Ver ‹dispositivo›`, `Ver ‹chofer›`. El expediente **es** la ficha (6.30).
- **La puerta de la casa sigue siendo Flota en vivo** ✓ decidido. Expedientes aparece en el menú el día que aterriza su pantalla; no se le presta la puerta.

### Lo que se ve en el cuarto — ✓ decidido (16 sep)

Tres grupos de piezas, en este orden: **Unidades · Dispositivos · Choferes**. Dentro de cada grupo, primero lo que pide hacer algo.

| Grupo | Glifo | Nombre | Apoyo | Dato y etiqueta |
|---|---|---|---|---|
| Unidad | el **peor** estado de vigencia de sus papeles (§4) | número económico | placa | cuántos papeles piden algo · `VENCIDOS` / `POR VENCER` / `FALTAN`; si ninguno, `AL DÍA` |
| Dispositivo | su estado de inventario (Marco 6.6, #411) | nombre `TK-…` | unidad donde está, o `En bodega` | edad de su última señal |
| Chofer | el peor estado de vigencia de sus papeles | nombre | número de licencia | como la unidad |

Un grupo sin cosas no se esconde: dice que está vacío (§3). Hoy el grupo Choferes dice «Sin choferes dados de alta», hasta el PR E.

---

## 2. El expediente: cuatro familias, siempre enteras

**✓ decidido (16 sep).** Cada expediente nace con sus cuatro familias —**Identidad · Actividad · Relaciones · Documentos**— en ese orden (6.31). La estructura no depende de qué tan llena esté: cuando llegue una fuente nueva, llena un lugar que ya existe; no se rehace la pantalla.

## 3. Los tres estados de una parte

**✓ decidido (16 sep).** Cada parte de una familia declara uno de tres estados. Ninguno se esconde.

| Estado | Cuándo | Cómo se ve |
|---|---|---|
| **Con datos** | Hay una fuente que se alimenta, y trae registros | El dato, y su edad si es algo vivo |
| **Vacía** | Hay una fuente que se alimenta, pero no trae registros | Lo dice: «Sin choferes asignados» |
| **Aún no disponible** | Aplica, pero **nada la alimenta todavía** | Lo dice, y de dónde va a llegar: «Aún no disponible · llega con Flota en vivo» |

**La frontera que no se cruza:** decir «aún no disponible» sobre algo que la base ya tiene es una afirmación falsa (Marco 6.19, Pieza 1 §D). Y lo que **no aplica** a un sujeto no es ninguno de los tres: no se dibuja (mapa, regla 4). Ejemplo: sin contrato encendido, la parte «servicios con veredicto» no existe para esa cuenta.

La lista de abajo es de hoy, 16 de septiembre. Cada parte dice su fuente; al construir se comprueba contra la base, no contra esta tabla.

### Ver ‹unidad›

| Familia | Parte | Fuente | Hoy |
|---|---|---|---|
| Identidad | Número económico | `units.label` | con datos |
| Identidad | Placa | `units.plateNumber` | con datos, o vacía si no se capturó |
| Actividad | Última señal, con su edad | `live_positions` y la telemetría archivada; Compás ya las alimenta (#411) | con datos, o vacía si nunca transmitió |
| Actividad | Recorridos y playback | — | **aún no disponible** · llega con Flota en vivo |
| Actividad | Servicios con su veredicto sellado | `compliance_facts.observedUnitId` | con datos o vacía; **sólo con contrato** (sin contrato no aplica) |
| Relaciones | Dispositivo que trae, y los que trajo | `device_assignments`, con sus fechas | con datos, o vacía |
| Relaciones | Choferes | — (`driver_assignments` liga al chofer con ruta × turno, no con la unidad) | **aún no disponible** |
| Documentos | Los papeles del catálogo de su mercado (§5) | nueva, PR B | con datos; `FALTA` si la regla dice obligatorio; aún no disponible mientras la regla no esté cargada |

### Ver ‹dispositivo›

| Familia | Parte | Fuente | Hoy |
|---|---|---|---|
| Identidad | Nombre e IMEI | `devices.label`, `devices.imei` | con datos |
| Identidad | Baja, con fecha y motivo | `devices.retiredAt`, `retiredReason` | con datos, sólo si está de baja |
| Actividad | Última señal, con su edad | la misma fuente que la unidad (#411) | con datos, o vacía |
| Relaciones | Unidad donde está, y las que ha traído | `device_assignments` | con datos, o vacía |
| Documentos | — | — | **no aplica** ✓ decidido (16 sep): un dispositivo no lleva papeles, así que la familia no se dibuja |

### Ver ‹chofer›

| Familia | Parte | Fuente | Hoy |
|---|---|---|---|
| Identidad | Nombre y número de licencia | `driver_credentials` (migración 0016) | vacía: nadie da de alta choferes hasta el PR E |
| Actividad | Unidades que ha operado | `compliance_facts.declaredDriverId` existe, pero nada la escribe | **aún no disponible** |
| Relaciones | Rutas × turnos asignados | `driver_assignments` existe, pero nada la escribe | **aún no disponible** |
| Documentos | Licencia | `driver_credentials.licenseExpiresOn` (sólo la fecha) y la tabla nueva del PR B | vacía hasta el alta |
| Documentos | Examen médico, antidoping | — | **aún no disponible** · esperan la palabra del abogado (§6) |

---

## 4. La vigencia

**✓ decidido (16 sep).**

| Estado | Regla |
|---|---|
| **VENCIDO** | La fecha de vencimiento ya pasó |
| **POR VENCER** | Vence dentro de los **días de aviso de su tipo** o menos |
| **VIGENTE** | Vence después de los días de aviso de su tipo |
| **SIN VENCIMIENTO** | El tipo de papel no vence |
| **FALTA** | El papel es obligatorio y no hay ninguno capturado |

- **El vencido no tiene consecuencias automáticas** ✓: no toca el veredicto (6.32), ni la elegibilidad de la unidad, ni el estado de cuenta. Esas consecuencias son configuración de contrato y llegan después.
- **La vigencia se calcula al leer, no se guarda.** Depende de hoy; guardarla sería guardar un dato que caduca solo.
- **Fecha capturada o calculada** ✓: se captura la fecha de vencimiento cuando el papel la trae. Si el tipo tiene periodicidad y el papel no trae fecha, se calcula desde la de emisión, y la pantalla dice `calculado`.
- **El día del vencimiento** ✓ decidido (16 sep). Un papel que «vence el 30 de septiembre» es vigente **todo ese día** y está vencido desde el 1 de octubre a las 00:00, **hora de Ciudad Juárez**, no UTC.
- **En el vistazo va un solo número** (skill): los días que faltan (`en 12 d`) o los que lleva vencido (`hace 3 d`). **La fecha exacta va en el expediente**, donde se decide.

## 5. El catálogo: configuración por mercado

**✓ decidido (16 sep).** El catálogo **no se hornea en el código**. Qué papel se exige, si vence y cada cuánto depende de la ley de cada país y cada estado, así que son **reglas que viven como dato**, editables desde la pantalla. Es la misma ley del Marco que rige la verificación —«cada contrato define su tolerancia»—: aquí, **cada mercado define su catálogo**. Y cumple el 6.18: si cambia una ley local, alguien edita el valor en la pantalla, no un desarrollador.

Cada tipo de papel de un mercado lleva: sujeto (unidad o chofer), nombre, si es **obligatorio**, si **vence**, sus **días de aviso** para «por vencer» (sólo si vence), y su **periodicidad** (sólo si vence y se puede calcular desde la emisión).

### Chihuahua nace con su catálogo lleno — ✓ decidido (16 sep)

**El mercado es estatal: MX · Chihuahua, sin municipio** (ASAV, 16 sep). El transporte de personal es competencia del Estado —permiso de la Secretaría estatal, GPS obligatorio por ley estatal—; el municipio sólo regula tránsito. El mismo catálogo sirve para los 67 municipios; un papel puramente municipal se agrega después como excepción. Su zona horaria sigue siendo la de Ciudad Juárez (§4).

| Sujeto | Papel |
|---|---|
| Unidad | Póliza de seguro |
| Unidad | Tarjeta de circulación |
| Unidad | Permiso de transporte de personal |
| Unidad | Verificación vehicular |
| Chofer | Licencia |
| Chofer | Examen médico |
| Chofer | Antidoping |

**Nacen los nombres, no los valores.** Obligatorio, vence, días de aviso y periodicidad los carga ASAV como configuración cuando exista la pantalla; no se hornean ni en código ni en la migración. Capacitación queda fuera por decisión de ASAV, aunque la Pieza 5 §C la nombra.

### Lo que la configuración trae consigo — ✓ decidido (16 sep)

1. **Qué es un mercado.** **País + estado** (México · Chihuahua), con **municipio** opcional para la ley que sólo es de una ciudad: el permiso de transporte de personal puede ser municipal.
2. **Cómo sabe una cuenta su mercado.** **Cada cuenta de carrier pertenece a un mercado**, asignado en su alta. Un carrier que opere en dos estados es un caso que hoy no existe; se nombra y no se construye.
3. **Quién edita el catálogo.** Es la ley de un mercado, no la preferencia de un carrier, así que lo edita **J-Staff**, igual que los actos de plataforma de 6.24. Vive dentro de «Cuentas y demos», sin cuarto nuevo; el mapa de la casa lo dice.
4. **Un tipo sin sus valores todavía.** Mientras «obligatorio» no esté cargado, `FALTA` no se puede calcular: esa parte dice **«aún no disponible · falta la regla del catálogo de Juárez»**, sin suponer que es obligatorio ni que no lo es. La vigencia de un papel capturado con su fecha sí se calcula, porque no depende de la regla.
5. **Cambiar una regla no reescribe el pasado.** Cada cambio es una versión nueva, con autor y fecha en el ledger. La vigencia se calcula al leer, con la regla de hoy; la versión anterior queda para saber qué regla valía en una fecha.
6. **Los días de aviso son de cada tipo de papel**, no un número global ✓ (16 sep). Un permiso que tarda dos meses en renovarse necesita más aviso que una verificación de un día. Se cargan junto con la vigencia del tipo, desde la pantalla, y se versionan igual (punto 5). **Mientras un tipo no los tenga**, se aplica el punto 4: un papel no vencido muestra sus días (`en 12 d`) pero no se declara ni VIGENTE ni POR VENCER, porque cualquiera de los dos supondría la regla; dice «falta la regla». VENCIDO sí se declara, porque no depende de ella.

Fuera, con nombre: que un **contrato** exija un papel además de los del mercado (la planta que pide algo extra).

## 6. El papel: qué se guarda, cómo se corrige

**Cada papel es una foja** del expediente de su sujeto (`Ficha-Esqueleto-Navegacion.md`: «foja de la unidad o del chofer, con su vencimiento»). Guarda: sujeto, tipo, número o folio (opcional), fecha de emisión (opcional), fecha de vencimiento (si el tipo vence), si la fecha es calculada, el archivo (§7), quién lo capturó y cuándo.

- **Renovar crea una foja nueva** ✓. La anterior se queda en el historial, ya como no vigente.
- **Corregir crea una versión nueva de la misma foja** ✓. La anterior queda en su historial, con quién corrigió y cuándo (Marco 6.18: se corrige desde la pantalla).
- **Nada se borra** en el expediente de una unidad (6.15).
- **El chofer es la excepción que ya existe:** al darlo de baja se purga su capa 2 —credenciales, papeles y sus archivos— y queda el registro «purgado el ‹fecha›» (`Plan-Choferes.md`).
- **Quién captura** ✓ decidido (16 sep). Mientras la matriz fina 6.29 siga abierta, **cualquier usuario del carrier dueño** captura y corrige, y cada acción queda con su autor en el ledger. La Pieza 4 pone la bitácora e inspecciones en Mantenimiento y el alta de choferes en Coordinador; la matriz lo afinará.

## 7. Los archivos

**✓ decidido (16 sep), a→h:**

- **a. Orden.** Primero los datos del papel (PR B y D); el archivo llega en paralelo (PR C). Mientras falte, cada papel lo dice: «sin archivo».
- **b. Dónde.** Vercel Blob **privado**.
- **c. Acceso.** Nunca una liga pública. El archivo se sirve por una ruta de J-Tel con guardia, y cada apertura queda en el ledger.
- **d. Integridad.** Se guarda su huella SHA-256, tamaño, tipo, quién lo subió y cuándo. Un archivo no se sobrescribe nunca: uno nuevo es un objeto nuevo.
- **e. Borrado.** Los de unidad no se borran (6.15). Los de chofer se purgan con su baja.
- **f. Ambientes.** Un almacén para producción y otro desechable para local y previews. Los tokens los da de alta ASAV. Una prueba nunca escribe en producción.
- **g. Formatos.** PDF, JPG y PNG, hasta 10 MB.
- **h. Legal.** Examen médico y antidoping son datos sensibles: no se suben hasta tener la palabra del abogado. Por eso se empieza por unidades, que no la necesitan.

## 8. Cómo se ve

Las formas nuevas van al skill `jtel-diseno`, sección «Los glifos»: los cinco estados de vigencia y los tres estados de una parte. Los papeles son la **tercera familia de formas, las hojas**, porque el cuadrado ya es del dispositivo. Boceto en las dos pieles, junto a las otras dos familias: https://claude.ai/artifact/RcGFprV2kaHpSRoqqmvwnS. ✓ aprobados por ASAV (16 sep): las tres siluetas se distinguen a 16 px.

---

## 9. Los PRs

| PR | Qué lleva | Qué prueba | Quién mergea |
|---|---|---|---|
| **A** · docs | Esta ficha y los glifos del skill | — | ASAV |
| **B** · lógica sin pantalla | Migración de mercados, catálogo versionado (Juárez con sus siete nombres, sin valores) y fojas con sus versiones; vigencia como función pura; carga del expediente completo de unidad, dispositivo y chofer, con el estado de cada parte; escenario en la base desechable | Pruebas de dominio y de integración contra la desechable | ASAV (migración) |
| **C** · archivos | Blob privado, subir y servir con guardia, huella, ledger de apertura | Contra el almacén desechable | ASAV (secreto) |
| **D** · pantalla | El cuarto, `Ver ‹unidad›` y `Ver ‹dispositivo›` con sus cuatro familias; capturar, corregir y renovar papeles; la ruta en `casas.ts`, con guardia por cuenta | Revisión visual en las dos pieles, celular y computadora | Claude, tras la revisión visual de ASAV |
| **D2** · el catálogo en pantalla | Editar el catálogo de un mercado desde J-Staff, con su historial | Revisión visual | Claude, tras la revisión visual de ASAV |
| **E** · choferes | Alta mínima (`Plan-Choferes.md`), `Ver ‹chofer›`, la licencia | Revisión visual | según lo que toque |

## 10. Fuera, con nombre

- El **espejo de planta** del expediente (Pieza 5 §C y §F): espera la matriz 6.29.
- **Avisos** de papeles por vencer (lo preventivo, Pieza 5 §A): cuando entren, tienen que poder llegar a cero (6.17).
- **Mantenimiento firmado** e **inspecciones**: inspecciones es cuarto de Planta y nunca se definió qué hace.
- **Examen médico y antidoping**, como archivo o como dato: esperan al abogado.
- **Expedientes de contrato y de ruta** (6.30): viven del lado de Vernier.
- **Alta de unidades** en el cascarón: hoy vive en el árbol viejo.

## 11. Lo que espera visto

Nada. Todo lo de esta ficha quedó ratificado el 16 de septiembre de 2026. Lo que aparezca al construir se pregunta y se agrega aquí con su fecha.
