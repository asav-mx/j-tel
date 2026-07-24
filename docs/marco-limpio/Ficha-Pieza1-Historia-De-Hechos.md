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

### Opción B — tabla de historial separada ✅ APROBADA

`compliance_facts` no cambia de estructura. El UNIQUE constraint se queda. La tabla siempre tiene exactamente una fila por ocurrencia — la vigente.

**Por qué esta opción:**

1. **Cero cambios en lectores existentes.** `compliance_facts` sigue con UNIQUE, sigue con una sola fila vigente por ocurrencia. Los 8+ lectores actuales no tocan una línea.
2. **La invariante la garantiza la base, no el código.** El UNIQUE constraint sigue activo. No hay índice parcial que dependa de un booleano. Un bug en la lógica de re-juicio no puede producir dos hechos "vigentes" silenciosamente.
3. **El Marco es más legible.** `compliance_facts` = la verdad vigente siempre. `compliance_fact_history` = el expediente de lo que fue. Dos conceptos distintos, dos tablas distintas.
4. **La migración es aditiva.** Añadir una tabla nueva no toca nada existente. Quitar una constraint UNIQUE sí.
5. **La puerta `deleteFactForOccurrence` desaparece naturalmente.** Se reemplaza por `archiveAndDeleteFact(occurrenceId, actor)` — que copia antes de borrar. No hay función pública que borre sin archivar.

**Única limitación conocida:** caminar la cadena completa (versión 1 → 2 → 3) requiere queries en dos tablas. Para el caso de uso previsto (auditoría, rebate del carrier) esto es aceptable — no es un hot path.

---

## DDL de la nueva tabla

```sql
CREATE TABLE "compliance_fact_history" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_occurrence_id" uuid NOT NULL,

  -- Columnas reales para queries sin abrir JSON
  "status"                text NOT NULL,   -- 'cumplido' | 'no_cumplido' | 'pendiente_evidencia'
  "timing"                text,            -- 'temprano' | 'a_tiempo' | 'tarde' | null

  -- Snapshot completo del hecho en el momento de ser superado
  "fact_snapshot"         jsonb NOT NULL,

  -- Vínculo al hecho sucesor (puede quedar null si el sucesor también fue re-juzgado — ver nota)
  "replaced_by_fact_id"   uuid REFERENCES compliance_facts(id) ON DELETE set null,

  -- Autoría del re-juicio (dos columnas, nunca una)
  "actor_kind"            text NOT NULL,   -- 'human' | 'system:exclusivity-pass' | 'system:elimination-pass' | 'system:cli' | 'system:e2e'
  "actor_id"              text,            -- id del humano cuando actor_kind = 'human'; null en automáticos

  "replaced_at"           timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON compliance_fact_history (service_occurrence_id);
```

### Por qué dos columnas de actor, no una

El Marco dice: *"el veredicto no cambia solo ni en silencio; sí puede haber re-juicio explícito y auditado."* Un humano apretando re-verificar es explícito. Un pase automático de exclusividad no — es el sistema acomodando sus cuentas.

Cuando el carrier impugne, la primera pregunta será "¿esto lo decidió una persona o fue el sistema?". Con dos columnas se contesta mirando. Con una sola cadena de texto, comparando prefijos.

`actor_id` es `text` (no `uuid`) porque el sistema de autenticación aún no está implementado y los ids de los usuarios probablemente no serán UUID.

### Nota sobre `replaced_by_fact_id` y la cadena de versiones

`replaced_by_fact_id` apunta al hecho sucesor en `compliance_facts`. **Pero cuando ese sucesor también es re-juzgado, la FK se pone en `null` (ON DELETE SET NULL)** — el sucesor dejó de existir en `compliance_facts`.

Consecuencia: **la cadena NO se puede caminar de forma confiable siguiendo `replaced_by_fact_id`**. Para reconstruir el orden cronológico de versiones de una ocurrencia, la consulta correcta es:

```sql
SELECT * FROM compliance_fact_history
WHERE service_occurrence_id = $1
ORDER BY replaced_at ASC;
```

El vínculo `replaced_by_fact_id` existe para el caso de auditoría donde el sucesor aún está vigente — es útil pero no es el eje de la cadena. `replaced_at` es el eje.

---

## Hallazgo colateral: `ledger_entries.actor_user_id` tiene el tipo equivocado

`ledger_entries.actor_user_id` está definido como `uuid`. Esto es el tipo incorrecto y explica por qué **nunca se pudo poblar**: los actores automáticos del sistema (`"system:exclusivity-pass"`, etc.) no tienen UUID — son etiquetas de texto. Y los actores humanos, cuando existan, pueden producir IDs de texto que tampoco caben en `uuid`.

La construcción incluye una migración adicional: `ALTER COLUMN actor_user_id TYPE text`. El ledger también adoptará las dos columnas `actor_kind` + `actor_id` — o en su defecto, `actor_user_id text` para no romper el esquema existente del ledger.

**Decisión pendiente para la construcción:** ¿el ledger adopta la misma separación `actor_kind` / `actor_id`, o se migra `actor_user_id` a `text` y se agrega `actor_kind` como columna nueva? Ambas son aditivas. Se decide al arrancar la construcción.

---

## Cambios por capa (post-aprobación)

### 1. Migraciones de base de datos

Dos migraciones consecutivas (números siguientes en drizzle):

**Migración A:** `CREATE TABLE compliance_fact_history (…)` — aditiva, sin tocar nada existente.

**Migración B:** Corregir `ledger_entries.actor_user_id`:
- `ALTER COLUMN actor_user_id TYPE text` (de `uuid` a `text`)
- Agregar `actor_kind text` si se decide la separación en dos columnas

Sin `ALTER TABLE` en `compliance_facts`. Sin quitar constraints.

### 2. Repositorio — `packages/db/src/repositories/index.ts`

- **`archiveAndDeleteFact(occurrenceId: string, actorKind: string, actorId: string | null): Promise<void>`**
  Reemplaza a `deleteFactForOccurrence`. Copia la fila vigente a `compliance_fact_history` (con `status`, `timing`, JSON completo, y actor) luego hace el DELETE.

- **`deleteFactForOccurrence`** — eliminada del repositorio. No quedará ruta de código que borre un hecho sin archivar.

- **`getFactHistory(occurrenceId: string): Promise<FactHistoryRow[]>`**
  Para auditoría y UI de expediente. Devuelve en orden `replaced_at ASC`.

### 3. Motor de verificación — `packages/services/src/verification.ts`

- `verifyOccurrence` recibe nuevos parámetros: `actorKind?: string`, `actorId?: string | null`.
- En el camino de re-juicio (`force: true`), llama `archiveAndDeleteFact(occurrenceId, resolvedActorKind, resolvedActorId)`.
- Si `actorKind` es undefined en un re-juicio, **la operación falla ruidosamente** con error explícito antes de tocar datos.
- Los seis caminos pasan su actor — **tanto a `compliance_fact_history` como al ledger**:

| Camino | `actor_kind` | `actor_id` |
|--------|-------------|-----------|
| Cron `/api/cron/verify` | No aplica — nunca `force: true` | — |
| J-Staff UI `/api/jstaff/reverify-day` | `"human"` | `session.userId` |
| CLI `reverify-day.ts` | `"system:cli"` | `null` |
| `real-e2e.ts` | `"system:e2e"` | `null` |
| `resolveExclusiveUnitClaims` | `"system:exclusivity-pass"` | `null` |
| `resolveEliminationPass` | `"system:elimination-pass"` | `null` |

### 4. Endpoint J-Staff

`/api/jstaff/reverify-day/route.ts` extrae `session.userId` y lo pasa hacia abajo a través de `reverifyContract` → `verifyOccurrence` con `actorKind: "human"`.

### 5. La primera verificación no cambia

Si no hay hecho previo, no hay archivo. El INSERT es directo, igual que hoy. `archiveAndDeleteFact` no se llama para ocurrencias vírgenes.

---

## 🛑 PARADA 2 — Auditoría de lectores (antes de mergear la construcción)

Antes de abrir el PR de construcción, listar TODOS los lectores de `compliance_facts` y confirmar que cada uno lee el vigente sin necesidad de cambios:

Lectores conocidos a auditar:
- `repos.occurrences.findById` — incluye el fact en el join
- `loadServiceDetail` ([service-detail-data.ts](../../apps/web/src/lib/service-detail-data.ts))
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
    → compliance_fact_history: 1 fila (hecho anterior serializado)
    → history.actor_kind: el kind correcto
    → history.actor_id: id del humano o null para automáticos
    → ledger: entrada con actor_kind/actor_id poblados

□ Re-juzgar sin actorKind → error explícito antes de cualquier escritura

□ Re-juzgar tres veces la misma ocurrencia:
    → compliance_facts: 1 fila (el más reciente)
    → compliance_fact_history: 3 filas ordenadas por replaced_at
    → replaced_by_fact_id: null en las dos más antiguas (el sucesor fue re-juzgado),
      no-null solo en la más reciente (su sucesor aún está vigente)

□ Los lectores devuelven el vigente aunque existan entradas de historial
    (compliance_facts sin cambio → lectores sin cambio → este test pasa sin modificar lectores)

□ Primera verificación (sin hecho previo):
    → compliance_fact_history: 0 filas nuevas
    → compliance_facts: 1 fila nueva
    → Comportamiento idéntico al actual

□ Query de auditoría por ocurrencia devuelve versiones en orden replaced_at ASC
□ Query "¿cuántos veredictos voltearon de cumplido a no_cumplido?" funciona con
  columnas reales sin abrir JSON

□ Suite completa TZ=UTC pasa sin regresiones
□ compare-verify-dry: 0 cambios (el criterio de juicio no se toca)
```

---

## Límites estrictos

- **Cero cambios en el criterio de verificación.** Mismo motor, mismos umbrales, mismos veredictos.
- **Cero migración de datos históricos.** Los hechos ya reescritos antes de esta pieza se quedan como están — no hay historia que restaurar porque se borró.
- **Suite completa `TZ=UTC`** en cada checkpoint.
- **Una rama, un PR para esta ficha. Otro PR para la construcción. No mergees ninguno.**
