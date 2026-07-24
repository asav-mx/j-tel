# Ficha — Pieza 1: Historia de hechos

**Fecha:** 24 jul 2026
**Tipo:** CONSTRUCCIÓN con paradas obligatorias — la implementación arranca cuando Asav mergee esta ficha.
**Base:** `Ficha-Diagnostico-Rejuicio.md` (PR #71) — confirmado: `deleteFactForOccurrence` borra sin dejar copia; `actor_user_id` nunca se llena; los pases internos de exclusividad re-juzgan automáticamente.
**Autoridad:** el Marco. *"La verdad se calcula una vez y se congela."* Esta ficha convierte esa ley en estructura que la máquina cumple sola.

---

## El objetivo en una frase

**Que re-juzgar nunca borre y siempre firme.** El hecho anterior se conserva marcado como superado; el nuevo apunta al viejo; y todo re-juicio dice quién lo pidió — humano con su id, automático con etiqueta de proceso.

---

## Evaluación de esquema: dos opciones

### Opción A — columna `superseded_by` en la misma tabla

Añadir a `compliance_facts`:
- `is_current boolean NOT NULL DEFAULT true`
- `superseded_by uuid REFERENCES compliance_facts(id)`
- `superseded_at timestamptz`

Quitar `CONSTRAINT compliance_facts_service_occurrence_id_unique` y reemplazarlo con índice parcial:

```sql
CREATE UNIQUE INDEX compliance_facts_current_unique
  ON compliance_facts (service_occurrence_id)
  WHERE is_current = true;
```

Cuando entra un re-juicio: `UPDATE … SET is_current = false, superseded_by = <nuevo_id>, superseded_at = now()` → INSERT nuevo.

**Lo que tiene a favor:**
- La cadena de versiones vive en una sola tabla; el grafo `superseded_by` es auto-referencial y natural.
- No hay que copiar filas a otro lugar.

**Lo que tiene en contra:**
- Eliminar una `UNIQUE` constraint es una operación irreversible de alto riesgo. El índice parcial (`WHERE is_current = true`) es más frágil: si un bug deja dos filas con `is_current = true`, el índice no lo detecta hasta el próximo INSERT del mismo `service_occurrence_id`.
- **Todos los lectores existentes** de `compliance_facts` deben añadir `WHERE is_current = true` — de lo contrario devuelven filas duplicadas. Hay al menos 8 puntos de lectura directa. Un solo lector que se olvide el filtro rompe silenciosamente datos de cara al usuario.
- La prueba de corrección ("¿tengo exactamente un vigente?") requiere una query activa; con la UNIQUE constraint, la base la hace sola.

---

### Opción B — tabla de historial separada (RECOMENDADA)

`compliance_facts` no cambia de estructura. El UNIQUE constraint se queda. La tabla siempre tiene exactamente una fila por ocurrencia — la vigente.

Nueva tabla `compliance_fact_history`:

```sql
CREATE TABLE "compliance_fact_history" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_occurrence_id" uuid NOT NULL,
  "fact_snapshot"         jsonb NOT NULL,        -- copia del hecho completo al momento de ser superado
  "replaced_by_fact_id"   uuid REFERENCES compliance_facts(id) ON DELETE set null,
  "actor_user_id"         text NOT NULL,          -- UUID humano o etiqueta de proceso (nunca null)
  "replaced_at"           timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON compliance_fact_history (service_occurrence_id);
```

Cuando entra un re-juicio:
1. Copiar la fila vigente de `compliance_facts` a `compliance_fact_history` como JSONB + metadata.
2. DELETE de `compliance_facts` (igual que hoy, pero ya no borra para siempre).
3. INSERT del hecho nuevo.

**Por qué esta opción:**

1. **Cero cambios en lectores existentes.** `compliance_facts` sigue con UNIQUE, sigue con una sola fila vigente por ocurrencia. Los 8+ lectores actuales no tocan una línea.
2. **La invariante la garantiza la base, no el código.** El UNIQUE constraint sigue activo. No hay índice parcial que dependa de un booleano. Un bug en la lógica de re-juicio no puede producir dos hechos "vigentes" silenciosamente.
3. **El Marco es más legible.** `compliance_facts` = la verdad vigente siempre. `compliance_fact_history` = el expediente de lo que fue. Dos conceptos distintos, dos tablas distintas.
4. **La migración es aditiva.** Añadir una tabla nueva no toca nada existente. Quitar una constraint UNIQUE sí.
5. **La puerta `deleteFactForOccurrence` desaparece naturalmente.** Se reemplaza por `archiveAndDeleteFact(occurrenceId, actorUserId)` — que copia antes de borrar. No hay función pública que borre sin archivar.

**Única limitación:** caminar la cadena completa (versión 1 → 2 → 3) requiere queries en dos tablas. Para el caso de uso previsto (auditoría, rebate del carrier) esto es aceptable — no es un hot path.

---

## 🛑 PARADA 1 — Aprobación de esquema

**El trabajo de construcción no comienza hasta que Asav apruebe el esquema propuesto.**

Pregunta de diseño abierta para Asav antes de proceder:

> **`actor_user_id` en `compliance_fact_history` es `text NOT NULL`.** Propongo `text` en vez de `uuid` porque los actores automáticos (procesos del sistema) no tienen UUID de usuario — son etiquetas fijas como `"system:exclusivity-pass"`. Si `actor_user_id` fuera `uuid`, los actores automáticos requerirían UUIDs ficticios o una columna separada. Con `text`, los humanos pasan su UUID como string y los procesos pasan su etiqueta. ¿Aceptado?

---

## Cambios por capa (post-aprobación)

### 1. Migración de base de datos

Una sola migración nueva (número siguiente en drizzle):

```sql
CREATE TABLE "compliance_fact_history" ( … );
```

Sin tocar `compliance_facts`. Sin `ALTER TABLE`. Sin quitar constraints.

### 2. Repositorio — `packages/db/src/repositories/index.ts`

- **`archiveAndDeleteFact(occurrenceId: string, actorUserId: string): Promise<void>`**
  Reemplaza a `deleteFactForOccurrence`. Copia la fila vigente a `compliance_fact_history` (serializada como JSONB) + metadata, luego hace el DELETE.

- **`deleteFactForOccurrence`** — eliminada del repositorio. No quedará ruta de código que borre un hecho sin archivar.

- **`getFactHistory(occurrenceId: string): Promise<FactHistoryRow[]>`**
  Para auditoría y UI de expediente.

### 3. Motor de verificación — `packages/services/src/verification.ts`

- `verifyOccurrence` recibe nuevo parámetro opcional `actorUserId?: string`.
- En el camino de re-juicio (`force: true`), llama `archiveAndDeleteFact(occurrenceId, resolvedActorUserId)`.
- Si `actorUserId` es undefined en un re-juicio (i.e., llega null cuando debería tener valor), **la operación falla ruidosamente** con error explícito antes de tocar datos.
- Los seis caminos de re-juicio pasan su actor:

| Camino | Actor que pasa |
|--------|----------------|
| Cron `/api/cron/verify` | No aplica — nunca llama con `force: true` |
| J-Staff UI `/api/jstaff/reverify-day` | `session.userId` (string UUID) |
| CLI `reverify-day.ts` | `"system:cli-reverify-day"` |
| `real-e2e.ts` | `"system:test-e2e"` |
| `resolveExclusiveUnitClaims` | `"system:exclusivity-pass"` |
| `resolveEliminationPass` | `"system:elimination-pass"` |

### 4. Endpoint J-Staff

`/api/jstaff/reverify-day/route.ts` extrae `session.userId` y lo pasa hacia abajo a través de `reverifyContract` → `verifyOccurrence`.

### 5. La primera verificación no cambia

Si no hay hecho previo, no hay archivo. El INSERT es directo, igual que hoy. `archiveAndDeleteFact` no se llama para ocurrencias vírgenes.

---

## 🛑 PARADA 2 — Auditoría de lectores (antes de mergear la construcción)

Antes de abrir el PR de construcción, listar TODOS los lectores de `compliance_facts` y confirmar que cada uno lee el vigente sin necesidad de cambios:

Lectores conocidos a auditar:
- `repos.occurrences.findById` — incluye el fact en el join
- `loadServiceDetail` (service-detail-data.ts)
- `processPending` / `verifyOccurrence` — lee `occurrence.complianceFact`
- `resolveExclusiveUnitClaims`
- `resolveEliminationPass`
- `reverifyContract`
- Cualquier query directa en scripts de diagnóstico o e2e
- Exports, reportes, endpoints de rebate

Criterio: si el lector funciona sin cambios con el esquema Opción B (una sola fila vigente, UNIQUE intacto), se marca ✅. Si requiere cambio, se detalla.

---

## Pruebas obligatorias (rotas primero, verdes después)

```
□ Re-juzgar una ocurrencia:
    → compliance_facts: sigue con 1 fila (el nuevo hecho)
    → compliance_fact_history: 1 fila (el hecho anterior, serializado)
    → history.actor_user_id: el actor correcto, nunca null

□ Re-juzgar sin actorUserId → error explícito antes de cualquier escritura

□ Re-juzgar tres veces la misma ocurrencia:
    → compliance_facts: 1 fila (el más reciente)
    → compliance_fact_history: 3 filas
    → replaced_by_fact_id apunta a la fila vigente (o null si el hecho vigente fue re-juzgado de nuevo)

□ Los lectores devuelven el vigente aunque existan entradas de historial
    (compliance_facts sin cambio → lectores sin cambio → este test pasa sin modificar lectores)

□ Primera verificación (sin hecho previo):
    → compliance_fact_history: 0 filas nuevas
    → compliance_facts: 1 fila nueva
    → Comportamiento idéntico al actual

□ Suite completa TZ=UTC pasa sin regresiones
□ compare-verify-dry: 0 cambios (el criterio de juicio no se toca)
```

---

## Límites estrictos

- **Cero cambios en el criterio de verificación.** Mismo motor, mismos umbrales, mismos veredictos.
- **Cero migración de datos históricos.** Los hechos ya reescritos antes de esta pieza se quedan como están — no hay historia que restaurar porque se borró.
- **Suite completa `TZ=UTC`** en cada checkpoint.
- **Una rama, un PR para esta ficha. Otro PR para la construcción. No mergees ninguno.**
