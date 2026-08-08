# Ficha — Expediente del contrato

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Cara:** cliente y carrier — **las dos partes lo ven, con el mismo contenido.**
**Ola:** el grueso hoy; el bloque de cumplimiento espera Ola 2.

**Reviste:** `cliente/contrato/[contractId]` · `cliente/contrato/[contractId]/expediente` · `carrier/contrato/[contractId]`.

> **Por qué esta línea existe:** sin ella, contar cuántas pantallas tienen
> diseño obliga a leer las trece fichas y a interpretar. Con ella el conteo se
> rehace solo. La ruta va **en el encabezado y con acentos graves**, para que
> un `grep` la encuentre. Ver `PLAN.md` §8.

---

## 1. Qué es, y por qué NO es la Oficina

Es **la quinta y última identidad con expediente propio**, y hasta ahora no existía ninguna puerta hacia ella.

**La distinción, decidida:**

| | Pregunta que responde | Quién la abre |
|---|---|---|
| **Oficina** | *¿con qué reglas se juzga?* | un coordinador que quiere entender un veredicto |
| **Expediente del contrato** | *¿qué es esta relación comercial?* | quien va a renovar, negociar o auditar |

**Distinta pregunta, distinta persona, distinto momento.** Por eso son dos pantallas.

**Cómo se conectan:** el expediente tiene una pestaña "Política" que **lleva a la Oficina**. Una puerta, no una copia — la Oficina sigue siendo el único lugar donde viven las reglas.

---

## 2. Estructura

### 2.1 Cabecera
Migas · nombre del contrato como titular · las dos partes y la vigencia en la línea de contexto · navegación entre hermanos si hay más de un contrato.

**Construido sin pestañas.** Con documentos y módulos fuera por §5, lo que queda —la relación, el alcance, la política, el bloque reservado y las ausencias— cabe en una sola lectura corrida. Unas pestañas sobre cinco secciones cortas esconderían el expediente detrás de clics y sugerirían profundidad que no hay.

### 2.2 La relación — identidad
Cliente y carrier · vigencia con su fecha de fin · estado del contrato · fecha de alta · política vigente con su versión.

### 2.3 Qué cubre — el alcance
Plantas o campus · rutas activas · turnos con sus horas · geocercas · servicios por día.

Cada uno **enlaza a su propia identidad**: las rutas abren su expediente, las geocercas su configuración.

**La unidad del alcance son los servicios al día, no las rutas.** Construyéndolo se vio que "Rutas del alcance: 27" no cuadra con la tabla de abajo, donde el mismo nombre aparece dos y tres veces: son registros de ruta distintos, con trazados distintos, que comparten nombre visible. El conteo era correcto y el lector no podía reconstruirlo. Un contrato se contrata en servicios al día —un perfil por ruta, turno y destino—, y esa es la unidad que las dos partes reconocen; rutas y turnos van como lectura al lado. Deduplicar por nombre habría dado un número más bonito y más falso. Quedó en el Marco §D como el caso de la UNIDAD.

### 2.4 Cumplimiento del contrato — **BLOQUE RESERVADO, ver §4**
El agregado histórico: cumplimiento por mes, servicios sellados, pendientes acumulados.

### 2.5 La historia de la política
Las versiones con qué cambió en cada una y desde cuándo rigió. Ya existe (`contractPolicyHistory`, PR #125).

Con la nota: *"cada versión queda; los hechos conservan la que estaba vigente el día que se sellaron."*

**Se construye aunque esté vacía.** Hay 0 versiones en toda la base, y cero versiones no es "no sé": es que la política no ha cambiado desde el alta. Eso se escribe, para que el silencio no se lea como un dato perdido.

### 2.6 Módulos contratados — **NO SE CONSTRUYÓ, ver §5**
Qué está activo y qué no, con su requisito. Los no contratados con borde punteado, nunca escondidos. El concepto no existe en el modelo: la sección quedó como ausencia declarada.

---

## 3. Las dos partes lo ven igual

**Mismo contenido para cliente y carrier.** Es el documento de la relación, y una relación no tiene dos versiones.

**La única diferencia es dónde vive:** `portal.j-telemetry.com` para el cliente, `carrier.j-telemetry.com` para el transportista — y la puerta a la Oficina, que solo aparece del lado del cliente, porque el auditado no edita las reglas con las que se le juzga (ley 5). La política que los dos leen es la misma.

**Lo que NO cambia entre las dos caras:** el alcance, la política, la historia. Si algo tuviera que ocultarse de una de las partes, no pertenece a este expediente.

**La ley se construyó como estructura, no como intención:** las dos caras renderizan **el mismo componente**. Si mañana alguien quisiera esconderle algo a una de las partes tendría que partirlo, y eso se ve en un diff. Una condición que sólo vive en la disciplina se rompe el día que alguien tiene prisa; ésta se rompe ruidosamente.

---

## 4. EL CORTE

**Va hoy:** identidad, alcance, historia de la política. Todo es configuración y hechos administrativos. Los módulos salieron del corte por §5.

**Espera la compuerta de Ola 2 (§2.4):** el bloque de cumplimiento agregado. Espacio reservado declarado: *"Disponible cuando la verificación alcance su umbral de confianza"*.

---

## 5. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `serviceContracts` (clientAccountId, carrierAccountId, status, notes, createdAt) con su enum de estado (`draft`, `demo`, y los demás)
- **La vigencia sí se persiste.** `serviceContracts.validFrom` y `validTo` son columnas `date` y `notNull` en `packages/db/src/schema/index.ts` — el renglón de vigencia de §2.2 se puede mostrar
- `contractPolicyHistory` con su lector (`historia-politica-data.ts`)
- `routes`, `routeShifts`, `shifts`, `geofences` — el alcance
- `plants` y `plantGroups` — a quién sirve
- `complianceFacts` — base del agregado cuando llegue su momento

**Medido contra producción el 2026-08-02 (lectura por `jtel_readonly`):**

1. **Documentos: no hay dónde guardarlos.** Ninguna tabla de archivos en el esquema. La pestaña no se construyó; quedó como ausencia declarada, con la razón escrita en pantalla.
2. **Módulos contratados: el concepto no existe.** Ninguna tabla de módulos. Dibujar hoy una lista de activos e inactivos sería hornearla en la vista, y lo que se cobra en una relación comercial no puede vivir en el código de una pantalla (ley 6). Ausencia declarada también.
3. **Historia de la política: 0 versiones en toda la base.** El lector existe; la sección se construye y dice que no ha cambiado (§2.5).
4. **Contratos por cuenta: sí aplica.** Una cuenta tiene 2 contratos, así que la navegación entre hermanos se construyó.
5. **Alcance real de un contrato:** 27 perfiles de servicio · 27 rutas · 3 turnos · 1 geocerca. De ahí salió el caso de la UNIDAD de §2.3.

**Sigue abierto:**

- **Qué roles ven qué.** Con `auth-rbac`, ¿todos los roles del cliente ven el expediente completo, o hay partes solo para `admin_corporativo` y `procurement`? Hoy la pertenencia se comprueba por cuenta: quien pide tiene que ser **parte del contrato**, o no hay expediente.
- **Términos comerciales** (tarifas, penalizaciones): no modelados, ausencia declarada. Un expediente que insinúa términos que el sistema no sostiene es peor que uno que no los menciona.

---

## 6. Lo que NO lleva

- **Las reglas del árbitro.** Eso es la Oficina; aquí solo la puerta hacia ella
- **Contenido distinto para cada parte.** Si algo debe ocultarse de una, no va aquí
- **Cifras de juicio antes de la compuerta**
- **Términos comerciales que el sistema no puede sostener** (tarifas, penalizaciones), a menos que se decidan y modelen aparte
