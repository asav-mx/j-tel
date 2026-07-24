# Ficha de Diagnóstico — El re-juicio y la historia

**Fecha:** 24 jul 2026
**Tipo:** DIAGNÓSTICO — solo lectura de código y esquema. Cero cambios de código, cero cambios de datos.
**Base:** `Ficha-Diagnostico-Expediente-Fiel.md` (PR #67) confirmó que el motor juzga contra el catálogo actual y no relee los snapshots que él mismo escribe. Esta ficha responde lo que sigue: ¿qué pasa con el hecho anterior cuando se re-juzga?

---

## Respuestas directas

### 1. Al re-juzgar, ¿se pierde el veredicto anterior — sí o no?

**Sí. Se pierde.**

`compliance_facts` tiene `UNIQUE(service_occurrence_id)` — una sola fila por ocurrencia. `saveFact` usa `.onConflictDoNothing()`: si ya existe un hecho, el INSERT no hace nada.

Para que entre uno nuevo, el motor llama primero a `deleteFactForOccurrence(occurrenceId)`, que hace un `DELETE` sin restricciones sobre la fila. Después inserta el nuevo hecho.

No hay tabla de historial. No hay columna `previous_status`. No hay `status_before`. El veredicto anterior desaparece en el `DELETE` y no queda ninguna copia en la BD.

---

### 2. ¿Queda constancia de quién re-juzgó y cuándo?

**Parcialmente. Hay rastro temporal pero no hay autoría.**

El ledger (`ledger_entries`) tiene `actor_user_id uuid` — pero **nunca se puebla desde `verifyOccurrence`**. Es `null` en todos los registros de verificación. No hay forma hoy de saber si un re-juicio lo disparó un J-Staff desde la UI, un script de línea de comandos o el motor interno.

Lo que sí sobrevive al `deleteFactForOccurrence`: los `ledger_entries` de la ocurrencia, porque sus FK apuntan a `trips` y `service_occurrences`, no a `compliance_facts`. Cuando un re-juicio ocurre, se acumula una segunda entrada con `action: "verificacion_automatica"` y su propio `created_at`.

Para detectar re-juicios hoy: una ocurrencia con más de una entrada de `ledger_entries` con `action = 'verificacion_automatica'` fue juzgada más de una vez. El tiempo de cada juicio está en `created_at`. El actor está en `null`.

---

### 3. ¿Cuántos caminos pueden disparar un re-juicio, y quién los alcanza?

**Cuatro caminos externos, dos internos automáticos.**

**Externos:**

| Camino | `force` | Quién lo alcanza |
|--------|---------|-----------------|
| Cron `/api/cron/verify` (cada minuto) | ❌ No | Automático — solo retoca `pendiente_evidencia`, nunca sobrescribe `cumplido`/`no_cumplido` |
| J-Staff UI `/api/jstaff/reverify-day` (POST) | ✅ Sí | Cualquier usuario con acceso a `/jstaff/soporte` |
| Script `packages/services/src/reverify-day.ts` | ✅ Sí | Solo quien tiene `DATABASE_URL` + credenciales de Umbrella en el entorno |
| `real-e2e.ts` | Solo sobre datos de prueba | Solo dev — crea entidades propias etiquetadas como "PRUEBA REAL", no toca producción |

**Internos automáticos (parte del ciclo normal de verificación):**

- **Resolución de unidades exclusivas** (`resolveExclusiveUnitClaims`): cuando dos rutas en la misma ventana acreditan la misma unidad, el perdedor se re-verifica con `force: true` y `keepEvidence: true`. Esto ocurre automáticamente después de cada ciclo de `processPending` y de cada `reverifyContract`.
- **Pasada de eliminación** (`resolveEliminationPass`): los `no_cumplido` residuales se re-evalúan excluyendo las unidades que ganaron en ventanas traslapadas, también con `force: true`.

Ambos internos no tienen limitación de actor ni dejan rastro de quién los disparó — son invisibles en el ledger salvo por el `action: "eliminacion_candidatas"` en la pasada de eliminación.

---

### 4. ¿Hay hechos que ya fueron reescritos?

**No puedo confirmarlo sin acceso a la BD, pero es casi seguro que sí.**

Toda ocurrencia procesada en un día con calles compartidas (empalmes) pasa por `resolveExclusiveUnitClaims` — lo que significa que el perdedor de la disputa fue re-juzgado automáticamente dentro del mismo ciclo. La autopsia de Santos Dumont mostró 14 empalmes sobre 55 no_cumplidos. Cada uno de esos 14 perdedores fue re-juzgado al menos una vez el mismo día.

Para confirmar con datos: `SELECT service_occurrence_id, COUNT(*) as n FROM ledger_entries WHERE action = 'verificacion_automatica' GROUP BY service_occurrence_id HAVING COUNT(*) > 1`.

---

### 5. ¿Se puede reconstruir el estado del día D, o ya se perdió?

**Reconstrucción parcial. Hay tres agujeros estructurales que la impiden.**

| Componente necesario para reproducir | Estado |
|--------------------------------------|--------|
| **Política del contrato** | ✅ Congelada. `contractPolicySnapshot` (JSONB) está en el hecho. Si el hecho no fue re-juzgado, es recuperable. Si lo fue, el snapshot corresponde al re-juicio, no al original. |
| **ID de la geocerca destino** | ✅ Congelado. `expectedGeofenceId` está en la ocurrencia (NOT NULL). |
| **Polígono de la geocerca** | ⚠️ **Agujero.** El motor lee `profile.geofence` en vivo — el polígono actual, no el del día D. Si alguien modificó la geocerca después de la verificación, el ID es el mismo pero el área es distinta. No hay snapshot del polígono en el hecho. La FK en `compliance_facts.expected_geofence_id` apunta a `geofences.id ON DELETE no action`, lo que impide borrar la geocerca pero no impide modificar su polígono. |
| **Trazado KML** | ⚠️ **Parcialmente.** `servedVariantId` se congela en el hecho solo si el status es `cumplido` — si fue `no_cumplido`, es `null`. El motor selecciona variantes activas por fecha (`getActiveVariantVersionsForDate`), que lee el catálogo actual. Los waypoints de una versión podrían haber cambiado. No hay snapshot del KML en el hecho. |
| **Asignación IMEI → unidad** | ❌ **Agujero.** La tabla `device_assignments` no tiene snapshot. La asignación IMEI→unidad que existía el día D puede haber cambiado o desaparecido. Sin esto, el motor no puede saber qué unidad corresponde a cada ping. |
| **Puntos GPS** | ⚠️ **Condicional.** Guardados en `evidence_points`. Si la re-verificación se hizo con `keepEvidence: false` (el script CLI lo hace así por defecto), los puntos se borraron. Con `keepEvidence: true` (default de la UI J-Staff), sobreviven. |
| **Ventana de evidencia** | ✅ Derivada de `contractPolicySnapshot` → recuperable donde el snapshot existe. |

**Diagnóstico de fondo:** el motor fue diseñado para juzgar hacia adelante — una sola vez, con el estado vivo del catálogo. No fue diseñado para reproducir. Guarda snapshots (`expectedGeofenceId`, `contractPolicySnapshot`) pero no los relee para juzgar: cuando hay `force: true`, vuelve al catálogo en vivo. La Ficha-Diagnostico-Expediente-Fiel ya documentó esto para la geocerca específicamente (40% de divergencia en compare-verify-dry).

---

## Mapa de lo que se pierde en cada re-juicio

```
Re-juicio con force: true
│
├── deleteFactForOccurrence(occurrenceId)
│     └── DELETE compliance_facts WHERE service_occurrence_id = X
│           → status anterior: BORRADO
│           → snapshot de política anterior: BORRADO
│           → expectedGeofenceId anterior: BORRADO
│           └── ledger_entries: SOBREVIVEN (FK a trip/occurrence, no a fact)
│
└── verifyOccurrence(force: true)
      ├── Lee geocerca: profile.geofence (VIVA, no la del día D)
      ├── Lee KML: variantes activas del catálogo actual (VIVO)
      ├── Lee asignación IMEI→unidad: device_assignments (VIVA)
      └── saveFact → inserta nuevo hecho con snapshot de la POLÍTICA ACTUAL
```

---

## Lo que bloquea

**Cualquier asistente que "explique por qué salió rojo" usando el motor actual mentiría sin querer.** El motor de hoy no puede reproducir fielmente el estado del día D. Si el carrier impugna un `no_cumplido`, el sistema no puede reproducir la evaluación original con los datos originales. Esto no bloquea la operación diaria — el veredicto está congelado en el hecho. Sí bloquea:

1. **Defensa auditada del carrier**: el carrier necesita ver exactamente lo que el réferi vio. Hoy ese estado ya no existe de forma reproducible.
2. **Copiloto que narra el porqué**: cualquier explicación derivada del motor actual reflejaría el catálogo de hoy, no el del día del servicio.
3. **Re-juicios a petición**: cada re-juicio con `force: true` borra la historia. Si el producto decide permitir "re-evaluar con nueva geocerca", no hay forma de volver atrás.

**Decisión pendiente de producto antes de diseñar el arreglo:**
- ¿Los re-juicios serán frecuentes o excepcionales?
- ¿El sistema debe guardar el historial de veredictos (quién cambió qué cuándo)?
- ¿O la apuesta es guardar el estado completo del catálogo al momento del juicio (snapshot total)?

Ambas son decisiones de producto con consecuencias de almacenamiento y complejidad. Se documentan aquí, no se propone implementación.

---

## Sobre la rama `docs/mapa-lenore-definida`

Rama creada el 24 jul a las 04:32 por otra sesión (Claude Sonnet 5). Un solo commit: agrega sección 7 (Lenore — el copiloto) al Mapa de Producto J-Telemetry. Está en el remoto sin PR visible. No la toqué.
