# Ficha — Expediente del contrato

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Cara:** cliente y carrier — **las dos partes lo ven, con el mismo contenido.**
**Ola:** el grueso hoy; el bloque de cumplimiento espera Ola 2.

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
Migas · nombre del contrato como titular · las dos partes y la vigencia en la línea de contexto · navegación entre hermanos si hay más de un contrato · pestañas: **Resumen · Alcance · Política · Historia · Documentos**.

### 2.2 La relación — identidad
Cliente y carrier · vigencia con su fecha de fin · estado del contrato · fecha de alta · política vigente con su versión.

### 2.3 Qué cubre — el alcance
Plantas o campus · rutas activas · turnos con sus horas · geocercas · servicios por día.

Cada uno **enlaza a su propia identidad**: las rutas abren su expediente, las geocercas su configuración.

### 2.4 Cumplimiento del contrato — **BLOQUE RESERVADO, ver §4**
El agregado histórico: cumplimiento por mes, servicios sellados, pendientes acumulados.

### 2.5 La historia de la política
Las versiones con qué cambió en cada una y desde cuándo rigió. Ya existe (`contractPolicyHistory`, PR #125).

Con la nota: *"cada versión queda; los hechos conservan la que estaba vigente el día que se sellaron."*

### 2.6 Módulos contratados
Qué está activo y qué no, con su requisito. Los no contratados con borde punteado, nunca escondidos.

---

## 3. Las dos partes lo ven igual

**Mismo contenido para cliente y carrier.** Es el documento de la relación, y una relación no tiene dos versiones.

**La única diferencia es dónde vive:** `portal.j-tel.io` para el cliente, `carrier.j-tel.io` para el transportista.

**Lo que NO cambia entre las dos caras:** el alcance, la política, la historia, los módulos. Si algo tuviera que ocultarse de una de las partes, no pertenece a este expediente.

---

## 4. EL CORTE

**Va hoy:** identidad, alcance, historia de la política, módulos. Todo es configuración y hechos administrativos.

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

**Debe confirmar desarrollo:**

1. **Documentos.** La pestaña de documentos supone que hay dónde guardar archivos del contrato. **Probablemente no existe** — si es así, la pestaña no se construye y queda anotada.
2. **Contratos por cuenta.** ¿Un cliente puede tener varios contratos con distintos carriers? De eso depende si la navegación entre hermanos aplica.
3. **Qué roles ven qué.** Con `auth-rbac`, ¿todos los roles del cliente ven el expediente completo, o hay partes solo para `admin_corporativo` y `procurement`?

---

## 6. Lo que NO lleva

- **Las reglas del árbitro.** Eso es la Oficina; aquí solo la puerta hacia ella
- **Contenido distinto para cada parte.** Si algo debe ocultarse de una, no va aquí
- **Cifras de juicio antes de la compuerta**
- **Términos comerciales que el sistema no puede sostener** (tarifas, penalizaciones), a menos que se decidan y modelen aparte
