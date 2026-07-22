# Reporte de Diagnóstico — Torre muestra 0 rutas en turno activo

> **Fecha:** 22 de julio de 2026
> **Investigado por:** Claude Sonnet 4.6
> **Ficha madre:** `Ficha-Diagnostico-Torre-Cero-Rutas.md`
> **Estado:** DIAGNÓSTICO COMPLETO — sin cambios de código ni datos

---

## Veredicto rápido

**Causa raíz encontrada y confirmada con medición real: zona horaria.**

| Ítem | Estado |
|------|--------|
| Causa raíz: `monitoreo-data.ts:171` construye `day` sin sufijo Z → Vercel UTC lo interpreta como medianoche UTC → `localDateIso(JUÁREZ)` devuelve el día anterior | **CONFIRMADO — medición real con TZ=UTC** |
| `findForScope` con esa `day` retorna 27 ocurrencias del 21 jul; el filter `=== '2026-07-22'` elimina todo → 0 rutas | **CONFIRMADO — SELECT directo a BD** |
| `jornada-data.ts` usa `T12:00:00.000Z` (correcto) → retorna 27 del 22 jul → Historial ve 14 en Primer Turno | **CONFIRMADO** |
| Vercel no tiene `TZ` configurado → corre en UTC | **CONFIRMADO — no hay vercel.json con TZ ni variable de entorno** |
| Hechos de cumplimiento: sin impacto | **CONFIRMADO por lectura de código** |
| Vulnerabilidad secundaria: `monitoreo-unit.tsx` mezcla catálogo + ocurrencias sin reconciliar por `(name, startTime)` | **CONFIRMADO por código — no activa hoy pero existe** |
| Turnos duplicados en Campus Santos Dumont, 22 jul 2026 | **DESCARTADO — medición directa** |

El PR "un solo reloj" estableció `localDateIso` como la función canónica para resolver "qué día es". `monitoreo-data.ts` no se actualizó con ese PR — quedó con un segundo reloj que en UTC no marca la hora correcta.

---

## 1. Zona del runtime — confirmado

Vercel no tiene `TZ` configurado en ningún lado:
- `apps/web/vercel.json` → solo crons, sin env `TZ`
- `.env` → sin `TZ` ni `timezone`
- `next.config.*` → sin configuración de TZ

**Consecuencia:** `process.env.TZ` es `undefined`. Node.js asume UTC. Todo `new Date('YYYY-MM-DDThh:mm:ss')` sin Z se interpreta en UTC.

Medición real (script con `TZ=UTC`):
```
process.env.TZ:                       UTC
Intl.DateTimeFormat resolvedOptions:  UTC
```

---

## 2. Los tres constructores de fecha y lo que producen en Vercel

```typescript
// monitoreo-data.ts:171
const day = new Date(`${opts.fecha}T00:00:00`);
//  → 2026-07-22T00:00:00.000Z  (medianoche UTC)
//  → localDateIso(JUÁREZ) = '2026-07-21'  ⚠ DÍA ANTERIOR

// jornada-unit.tsx:33  (shift list de Historial)
const day = new Date(`${fecha}T00:00:00`);
//  → 2026-07-22T00:00:00.000Z  (medianoche UTC)
//  → localDateIso(JUÁREZ) = '2026-07-21'  ⚠ mismo bug, enmascarado*

// monitoreo-unit.tsx:38  (shift list de Monitoreo)
const day = new Date(`${fecha}T12:00:00`);
//  → 2026-07-22T12:00:00.000Z  (mediodía UTC)
//  → localDateIso(JUÁREZ) = '2026-07-22'  ✓ correcto

// jornada-data.ts:97   (datos de Historial — CORRECTO)
const day = new Date(`${opts.fecha}T12:00:00.000Z`);
//  → 2026-07-22T12:00:00.000Z  (mediodía UTC)
//  → localDateIso(JUÁREZ) = '2026-07-22'  ✓ correcto
```

*`jornada-unit.tsx:33` tiene el mismo bug de T00:00:00 pero está enmascarado: construye el shift list a partir de las ocurrencias del 21 jul, que tienen los mismos UUIDs de turno que las del 22 → `turnoId` es correcto → `loadJornada` carga los datos reales del 22 jul con T12:00:00.000Z.

---

## 3. El camino exacto que produce 0 rutas

```
monitoreo-data.ts:171
  day = new Date('2026-07-22T00:00:00')
  → en Vercel (UTC): 2026-07-22T00:00:00.000Z

findForScope(scope, day, day)
  → localDateIso(day, 'America/Ciudad_Juarez')
      = 2026-07-21 (son las 18:00 del 21 en Juárez)
  → WHERE service_date >= '2026-07-21' AND service_date <= '2026-07-21'
  → devuelve 27 ocurrencias del 21 de julio

filter: o.serviceDate === opts.fecha ('2026-07-22')
  → 0 ocurrencias pasan el filtro

Resultado: 0 rutas · 0 cerrado · 0 llegó · 0 avanzando · 0 en ruta · 0 programada
```

`0 programada` en particular confirma que el vacío está en `filtered`, no en la tarjeta — exactamente lo que el dato del user indicaba.

---

## 4. Confirmación con SELECT directo a la BD (TZ=UTC simulado)

```
Constructor                              localDateIso   findForScope  después de filter(==='2026-07-22')
─────────────────────────────────────────────────────────────────────────────────────────────────────
T00:00:00 sin Z (monitoreo-data + jornada-unit)  '2026-07-21'   27 del 21 jul  0 rutas  ⚠ BUG
T12:00:00 sin Z (monitoreo-unit shift list)      '2026-07-22'   27 del 22 jul  27       ✓
T12:00:00.000Z  (jornada-data — correcto)        '2026-07-22'   27 del 22 jul  27       ✓
```

Estos son los números reales contra la base de producción.

---

## 5. Medición de turnos — hipótesis UUID descartada

La primera hipótesis (turnos duplicados en el catálogo) fue descartada por medición directa.

```
plant_group_id: 4c3e2cc9-4f9f-4afa-8245-06c8404bebbf  (Campus Santos Dumont)
contrato:       74e4153e-0ebb-459d-930f-80d1d4de49fb
```

### Catálogo de turnos (`getShiftsForScope`) — 3 registros

| id (primeros 8) | name | start_time | plant_group_id |
|-----------------|------|-----------|----------------|
| `003d5bc6…` | Primer Turno | 06:00 | `4c3e2cc9…` |
| `054c75d1…` | Segundo Turno | 15:30 | `4c3e2cc9…` |
| `a3597680…` | Turno B | 18:00 | `4c3e2cc9…` |

### `shiftId`s distintos en ocurrencias del 22 jul

| id (primeros 8) | name | start_time | ocurrencias |
|-----------------|------|-----------|-------------|
| `003d5bc6…` | Primer Turno | 06:00 | **14** |
| `054c75d1…` | Segundo Turno | 15:30 | 8 |
| `a3597680…` | Turno B | 18:00 | 5 |

### Cruce

```
En catálogo:          3
En ocurrencias:       3
En ambos (mismo id):  3   ← 100 % de coincidencia
Solo en catálogo:     0
Duplicados (name+start_time, mismo campus): 0
```

Simulación de `pickActiveShift` a las 07:00 del 22 jul: elige `003d5bc6…` (Primer Turno 06:00) — el mismo UUID que tiene las 14 ocurrencias. **Sin divergencia activa.**

---

## 6. Patrón T00:00:00 sin Z en el resto del codebase

Búsqueda completa de `new Date(…T00:00:00)` (sin Z) que se pasa a `findForScope` u otras funciones que llaman a `localDateIso`:

| Archivo | Pasa a scope/localDateIso | Impacto |
|---------|--------------------------|---------|
| `apps/web/src/lib/monitoreo-data.ts:171` | **Sí — directo** | **Bug activo. Causa del síntoma.** |
| `apps/web/src/views/jornada-unit.tsx:33` | **Sí — directo** | Bug enmascarado: shift list del 21 jul, turnoId aun coincide con el 22 → la vista muestra datos correctos |
| `apps/web/src/views/unit-compliance.tsx:68-107` | **Sí — vía `date-range.ts:116-117`** | Vista de cumplimiento puede mostrar 0 ocurrencias para el día pedido |
| `apps/web/src/lib/date-range.ts:116-117` | Depende del caller | Fuente del patrón para `resolveDateRange` |
| `apps/web/src/app/api/cliente/servicios/route.ts:62-63` | Sí — pasa a `generateForProfile` | No es `findForScope`, pero `generateForProfile` puede usar la fecha para marcar contratos — alcance a confirmar en ficha aparte |
| `packages/db/src/repositories/index.ts:1839-1840` | **No** | Comparación de vigencia de contrato — aritmética pura |
| `packages/db/src/repositories/index.ts:1972,1983` | **No** | Generación de ocurrencias — aritmética de fechas, no `localDateIso` |
| `packages/domain/src/index.ts:249` | **No** | `computeExpectedDeadline` — usa `setMinutes`, no comparación de fecha civil |

Los tres primeros son riesgos activos. El más grave es `monitoreo-data.ts` porque es el que produce los ceros. `unit-compliance.tsx` puede estar silenciando datos sin que nadie lo haya notado.

---

## 7. Conexión con el PR "un solo reloj"

El PR de zona horaria (commit `1c9181b`, rama `feat/zona-horaria`) estableció `localDateIso` como **la función canónica** para resolver "qué día es" — documentado así en `packages/domain/src/index.ts`:

> "Esta es LA función canónica para resolver 'qué día es' — no duplicar."

`jornada-data.ts` fue actualizado en ese PR: usa `T12:00:00.000Z` correctamente.

`monitoreo-data.ts` **no fue actualizado**. Quedó con `T00:00:00` sin Z — un segundo reloj que en UTC siempre marca seis horas antes de lo correcto, cruzando la medianoche civil de Juárez.

---

## 8. Hechos de cumplimiento: sin impacto (confirmado)

- `monitoreo-data.ts` no contiene llamadas a `saveFact`, `materializeFact`, ni `writeVerdict` (grep: 0 coincidencias).
- El archivo lo declara explícitamente en líneas 13-21: *"la torre NO recalcula la verdad... Solo lectura: no escribe hechos, ledger ni veredictos."*
- El árbitro (`packages/services/src/verification.ts`) recibe el `shiftId` de las ocurrencias, no del catálogo de la vista. El bug de timezone es invisible para el árbitro.

---

## 9. Respuestas directas a las preguntas de la ficha

**1. ¿Cuántos "Primer Turno 06:00" existen para ese campus y por qué más de uno?**

Uno solo. No hay duplicados.

**2. ¿Cuál eligió la torre y cuál tiene las 14 ocurrencias?**

La torre no llegó a elegir un turno con datos correctos. La consulta de ocurrencias ya retornó vacío para el 22 jul antes de que `pickActiveShift` pudiera producir resultados útiles.

**3. ¿Es problema de datos, de código, o ambos?**

**Problema de código.** Específicamente: `monitoreo-data.ts:171` construye la `day` con `T00:00:00` sin Z, lo que en Vercel (UTC) desplaza la fecha un día atrás. Los datos son correctos.

Persiste una **vulnerabilidad secundaria en el código** (`monitoreo-unit.tsx` mezcla catálogo + ocurrencias por UUID), y un **riesgo en el schema** (sin unique constraint). Ninguno causó el síntoma del 22 jul, pero existen.

**4. ¿Afecta a algún hecho de cumplimiento?**

**No. Confirmado con código.** (Ver sección 8.)

---

## 10. Propuesta de arreglo (solo descripción — el arreglo va en ficha aparte)

**Pata principal — `monitoreo-data.ts:171`:**
Cambiar `new Date(`${opts.fecha}T00:00:00`)` por `new Date(`${opts.fecha}T12:00:00.000Z`)` — idéntico al patrón de `jornada-data.ts:97`. Noon UTC = 6am Juárez, dentro del mismo día civil en cualquier zona UTC-6 a UTC+14. Resolverá el síntoma inmediatamente.

**Pata complementaria — resto del patrón:**
Revisar y corregir `jornada-unit.tsx:33`, `unit-compliance.tsx` y `date-range.ts:116-117` con el mismo cambio. `generateForProfile` en `servicios/route.ts` requiere análisis aparte.

**Pata de resguardo — schema:**
Agregar unique indexes parciales sobre `(plant_group_id, name, start_time)` y `(plant_id, name, start_time)` para evitar que la vulnerabilidad secundaria se active si en el futuro los turnos divergen.

### ⚠ Advertencia sobre limpieza de duplicados (si existieran)

Si la auditoría previa a la migración de schema encontrara duplicados, **no usar `DELETE` directo**. Las cascadas encadenadas `shifts → route_shifts → service_occurrences → trips → compliance_facts` destruirían hechos materializados. Requiere inventario, reasignación de referencias, y **aprobación explícita de Asav** en cada paso. No es un trámite — es el trabajo principal.

---

## 11. Ancla en el Marco

Del Marco Maestro: *"El servicio esperado concreto = una ruta dentro de un turno + destino + política, en una fecha."* El turno es parte de la identidad del servicio.

La función canónica `localDateIso` ya existe y ya resuelve "qué día es" en la zona correcta. El arreglo es darle una `Date` que caiga en el centro del día en UTC, no en la medianoche — donde el cambio de día UTC cruza el medio de la tarde en Juárez.
