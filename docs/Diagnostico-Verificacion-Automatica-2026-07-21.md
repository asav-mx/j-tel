# Diagnóstico — Verificación automática no corrió sola (2026-07-21)

> **Fecha:** 21 de julio de 2026
> **Rama:** `diag/verificacion-automatica`
> **Autor:** Diagnóstico de solo lectura — sin cambios al código
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` es la única fuente de verdad.

---

## El síntoma

Campus **Santos Dumont**, turno 1, `2026-07-21`:

| Estado | Antes (sin re-verificar) | Después (re-verificar manual) |
|--------|--------------------------|-------------------------------|
| cumplido | 11 | 12 |
| no_cumplido | 3 | 2 |
| sin hecho / pendiente | 13 (sin_hecho) | 13 (pendiente_evidencia) |

El usuario tuvo que ejecutar manualmente `reverifyContract` con `force=true` vía
`/api/jstaff/reverify-day`. El cron automático no produjo ese resultado por sí solo.

---

## Arquitectura del ciclo automático (confirmado en código)

### Cron schedule (`apps/web/vercel.json`)

```
/api/cron/verify          → cada 1 minuto  (* * * * *)
/api/cron/renew-occurrences → diario a las 06:00 UTC (0 6 * * *)
```

### Qué verifica el cron (`packages/db/src/repositories/index.ts:1933`)

`findPendingVerification(now)` selecciona únicamente ocurrencias que cumplan:

```sql
(deadline + verificationGraceMinutes) ≤ now
AND (
  compliance_facts.id IS NULL          -- nunca verificada
  OR (
    compliance_facts.status = 'pendiente_evidencia'
    AND trips.evidence_status = 'indisponible'  -- GPS aún no llegó
  )
)
```

**Lo que NO selecciona:** ocurrencias con `status = 'cumplido'` o `status = 'no_cumplido'`.

### Protección en `verifyOccurrence` (`packages/services/src/verification.ts:681`)

```typescript
// Sin force: cumplido/no_cumplido son definitivos; pendiente se reintenta.
if (occurrence.complianceFact) {
  if (!opts.force && occurrence.complianceFact.status !== "pendiente_evidencia") {
    return { occurrenceId, skipped: true, status: occurrence.complianceFact.status };
  }
  // ...
}
```

Cumplido y no_cumplido son **muros**: el cron los salta siempre.

### Qué pasa cuando se cambia la política (`apps/web/src/app/api/cliente/contratos/route.ts:165`)

```typescript
// La política nueva aplica solo hacia adelante. Hechos definitivos
// (cumplido / no_cumplido) no se recalculan; pendiente_evidencia sí se
// reintenta en el cron normal (verifyOccurrence sin force).
await repos.contracts.updatePolicy(contractId, parsed.data);
```

El comentario está en el código. La política nueva se guarda. Los hechos existentes no se tocan.

---

## Diagnóstico por hipótesis

### Hipótesis A — Cambiar la política no re-encola: **CONFIRMADA**

El motor evaluó los 3 no_cumplido bajo los parámetros de la política ANTERIOR al cambio.
Cuando la política se modificó (p. ej. umbrales, exclusividad, `verificationGraceMinutes`),
el cron NO volvió a evaluar esos hechos: son "definitivos" por diseño.

**Evidencia directa:**
- `findPendingVerification` excluye explícitamente `cumplido` y `no_cumplido`.
- `verifyOccurrence` hace `return { skipped: true }` sin `force=true`.
- El comentario en `contratos/route.ts:165` lo documenta explícitamente.

**Consecuencia observable:** 1 de los 3 no_cumplido se convirtió en cumplido al re-verificar
con la política actualizada — prueba de que el veredicto anterior era incorrecto bajo la
política nueva.

### Hipótesis B — El ciclo automático no corre a tiempo: **DESCARTADA COMO CAUSA PRINCIPAL**

El cron `/api/cron/verify` tiene schedule `* * * * *` (cada minuto, Vercel Cron).
No hay evidencia de que el ciclo estuviera caído o retrasado en exceso.

Las 13 ocurrencias "sin hecho" → "pendiente_evidencia" se explican correctamente dentro
del diseño normal del sistema:
- Eran ocurrencias del turno 1 del día (deadline ~06:45 + 15 min de gracia = ~07:00).
- Al momento de la re-verificación manual el GPS de esas unidades aún no estaba disponible
  en la base de datos (`evidenceStatus = 'indisponible'`).
- El cron SÍ las habría recogido eventualmente (`isNull(complianceFacts.id)` → se encolan),
  y tras verificarlas también habría quedado en `pendiente_evidencia`.
- El re-verificar manual simplemente aceleró ese proceso.

**Hipótesis B es ruido, no causa.**

---

## Veredicto

**Es Hipótesis A, sin mezcla significativa con B.**

El ciclo automático funciona correctamente dentro de su contrato: verifica ocurrencias
nuevas y reintenta las pendientes por evidencia. Su límite es el diseñado: los hechos
definitivos son inmutables sin `force=true`.

El problema es estructural, no operacional: **el sistema no tiene mecanismo para avisar
al operador que un cambio de política dejó hechos pasados evaluados bajo reglas viejas.**
El operador descubre la inconsistencia por inspección visual y tiene que re-verificar a mano.

---

## Alcance del problema (solo lectura, no propuesta aún)

| Escenario que deja hechos stale | ¿Re-encola solo? |
|----------------------------------|-----------------|
| Cambio de `kmlMatchMinPct` / `kmlCorridorMinPct` | ❌ No |
| Cambio de `verificationGraceMinutes` | ❌ No |
| Cambio de `permitirConsolidacion` | ❌ No |
| Activar/desactivar `routeStrictness` | ❌ No |
| Actualizar trazado KML (nueva versión) | ❌ No (hechos pasados ya usaron la versión anterior) |
| GPS llega tarde → pendiente_evidencia → GPS disponible | ✅ Sí (único caso que sí se reintenta) |

---

## Archivos auditados (sin modificaciones)

| Archivo | Relevancia |
|---------|-----------|
| `apps/web/vercel.json` | Confirma cron cada 1 minuto |
| `apps/web/src/app/api/cron/verify/route.ts` | Entry point del ciclo automático |
| `packages/db/src/repositories/index.ts:1933` | `findPendingVerification` — qué se encola |
| `packages/services/src/verification.ts:681` | Puerta que bloquea re-verificación sin force |
| `apps/web/src/app/api/cliente/contratos/route.ts:165` | Comentario explícito en `updatePolicy` |
| `apps/web/src/app/api/jstaff/reverify-day/route.ts` | Herramienta manual que sí usa `force=true` |
