# Reporte de Diagnóstico — Torre muestra 0 rutas en turno activo

> **Fecha:** 22 de julio de 2026
> **Investigado por:** Claude Sonnet 4.6
> **Ficha madre:** `Ficha-Diagnostico-Torre-Cero-Rutas.md`
> **Estado:** DIAGNÓSTICO COMPLETO — sin cambios de código ni datos

---

## Veredicto rápido

**Confirmado — mecanismo de código vulnerable. No confirmado — datos divergentes.**

| Ítem | Estado |
|------|--------|
| `monitoreo-unit.tsx` mezcla catálogo + ocurrencias sin reconciliar por `(name, startTime)` | **CONFIRMADO por lectura de código** |
| `shifts` sin unique constraint sobre `(plant_group_id, name, start_time)` | **CONFIRMADO por schema** |
| Hechos de cumplimiento: sin impacto | **CONFIRMADO por lectura de código** |
| Turnos duplicados en Campus Santos Dumont, 22 jul 2026 | **NO CONFIRMADO — la medición los descarta** |
| Bug activo el 22 jul para este campus | **NO CONFIRMADO** |

El código tiene una vulnerabilidad estructural real: si los UUIDs del catálogo y las ocurrencias divergen, la torre elige el turno sin rutas. Ese mecanismo es correcto. Pero **la medición directa muestra que en esta base, en esta fecha, los UUIDs coinciden**. La causa raíz del síntoma observado queda indeterminada.

---

## 1. Medición real — Campus Santos Dumont, 2026-07-22

### Identificación del campus

```
plant_group_id: 4c3e2cc9-4f9f-4afa-8245-06c8404bebbf
nombre:         Campus Santos Dumont
contratos:      1 (id: 74e4153e-0ebb-459d-930f-80d1d4de49fb)
```

### Catálogo de turnos (`getShiftsForScope`) — 3 registros

| id (primeros 8) | name | start_time | plant_group_id |
|-----------------|------|-----------|----------------|
| `003d5bc6…` | Primer Turno | 06:00 | `4c3e2cc9…` |
| `054c75d1…` | Segundo Turno | 15:30 | `4c3e2cc9…` |
| `a3597680…` | Turno B | 18:00 | `4c3e2cc9…` |

### `shiftId`s distintos en ocurrencias del 22 jul — 3 registros

| id (primeros 8) | name | start_time | ocurrencias |
|-----------------|------|-----------|-------------|
| `003d5bc6…` | Primer Turno | 06:00 | **14** |
| `054c75d1…` | Segundo Turno | 15:30 | 8 |
| `a3597680…` | Turno B | 18:00 | 5 |
| **Total** | | | **27** |

### Cruce catálogo ↔ ocurrencias

```
En catálogo:          3
En ocurrencias:       3
En ambos (mismo id):  3   ← 100 % de coincidencia
Solo en catálogo:     0   ← no hay turnos sin ocurrencias
Solo en ocurrencias:  0
Duplicados por (name, start_time) en el mismo campus:  0
```

### Simulación de `pickActiveShift` (07:00 del 22 jul)

```
Orden tras el sort:
  1. Primer Turno   06:00  [003d5bc6…]
  2. Segundo Turno  15:30  [054c75d1…]
  3. Turno B        18:00  [a3597680…]

Turno elegido: Primer Turno 06:00 [003d5bc6…]
¿Tiene ocurrencias ese día? SÍ — 14 ocurrencias ✓
```

### Conclusión de la medición

La hipótesis principal **no se confirma** para esta base en esta fecha.
El catálogo y las ocurrencias comparten exactamente los mismos tres UUIDs.
`pickActiveShift` habría elegido el turno correcto (el que tiene 14 ocurrencias).

El síntoma observado — 0 rutas en monitoreo, 14 en historial — no puede explicarse por el mecanismo de divergencia de UUIDs con los datos actuales. La causa raíz del síntoma del 22 jul queda **indeterminada**. Posibles causas no exploradas: estado transitorio durante el día (datos modificados entre la observación y esta medición), otra ruta de código afectada, o causa no relacionada con turnos.

---

## 2. El mecanismo vulnerable — confirmado por código

Aunque la medición no encontró duplicados activos, el mecanismo que los volvería peligrosos existe en el código. Se documenta porque es un riesgo real para cualquier campus donde los UUIDs lleguen a divergir.

### `monitoreo-unit.tsx` construye `shiftById` desde dos fuentes

```typescript
// apps/web/src/views/monitoreo-unit.tsx, líneas 39-61
const [occs, configuredShifts] = await Promise.all([
  repos.occurrences.findForScope(ctx.scope, day, day),
  repos.routes.getShiftsForScope(ctx.scope),   // ← Fuente 1: catálogo del scope
]);

const shiftById = new Map();
for (const s of configuredShifts)              // Primero: inserta ids del catálogo
  shiftById.set(s.id, { id: s.id, name: s.name, startTime: ... });
for (const o of occs) {                        // Después: agrega ids de ocurrencias
  const shift = o.profile?.routeShift?.shift;
  if (shift?.id && !shiftById.has(shift.id))  // Guard por ID, no por nombre+hora
    shiftById.set(shift.id, { ... });
}
```

`getShiftsForScope` consulta `shifts` directamente por `plant_group_id`. Las ocurrencias obtienen su `shiftId` por la relación `service_occurrences → route_shifts → shifts`. Si esas dos rutas apuntan a UUIDs distintos para el mismo turno, ambos entran al Map.

### `jornada-unit.tsx` no tiene este problema

Solo usa las ocurrencias para construir `shiftById`. Nunca llama a `getShiftsForScope`. El turno elegido siempre coincide con el turno de las ocurrencias.

---

## 3. Por qué `pickActiveShift` elegiría el turno sin ocurrencias (si hubiera duplicados)

`pickActiveShift` (`apps/web/src/lib/local-time.ts`, líneas 37-55) ordena por `startTime` y desempata por `name`:

```typescript
const sorted = [...shifts].sort(
  (a, b) =>
    parseHhMmToMinutes(a.startTime) - parseHhMmToMinutes(b.startTime) ||
    a.name.localeCompare(b.name),
);
```

Si hubiera dos shifts con `startTime = "06:00"` y `name = "Primer Turno"`, ambos desempates valen 0. **El resultado dependería del orden de inserción.** Como el catálogo se inserta primero en el Map, el shift del catálogo tendería a salir primero — y sería el que `pickActiveShift` elegiría como activo. Si ese id no coincide con el de las ocurrencias, el filtro `o.profile?.routeShift?.shiftId === turnoId` devolvería vacío.

---

## 4. El schema no impide turnos duplicados

La tabla `shifts` (`packages/db/src/schema/index.ts`) solo tiene PK sobre `id`. No existe:
- `UNIQUE INDEX (plant_group_id, name, start_time)` para campus
- `UNIQUE INDEX (plant_id, name, start_time)` para planta individual

La única protección es aplicativa: `findShiftByNameAndTime` en el repositorio, invocada desde la API POST de turnos (`apps/web/src/app/api/cliente/turnos/route.ts`). Esta guarda **no cubre**:
- Seeds que llaman a `createShift` directamente sin pasar por la API
- SQL directo o migraciones que inserten turnos
- Race conditions entre dos requests simultáneos

Si se borrara y recreara un turno por cualquier vía, el nuevo tendría UUID nuevo mientras los `route_shifts` y ocurrencias históricas seguirían apuntando al UUID viejo. El catálogo y las ocurrencias divergirían silenciosamente.

---

## 5. Hechos de cumplimiento: sin impacto (confirmado)

- `monitoreo-data.ts` no contiene llamadas a `saveFact`, `materializeFact`, ni `writeVerdict` (grep: 0 coincidencias).
- El archivo lo declara explícitamente en líneas 13-21: *"la torre NO recalcula la verdad... Solo lectura: no escribe hechos, ledger ni veredictos."*
- El árbitro (`packages/services/src/verification.ts`) recibe el `shiftId` de las ocurrencias, no del catálogo de la vista. El bug de catálogo-vs-ocurrencias es invisible para el árbitro.

---

## 6. Respuestas directas a las preguntas de la ficha

**1. ¿Cuántos "Primer Turno 06:00" existen para ese campus y por qué más de uno?**

Uno solo. La medición encontró exactamente 1 registro con `name = "Primer Turno"` y `start_time = "06:00"` en el catálogo del campus.

**2. ¿Cuál eligió la torre y cuál tiene las 14 ocurrencias?**

El mismo: `003d5bc6…`. Los UUIDs coinciden. No hay selección errónea en estos datos.

**3. ¿Es problema de datos, de código, o ambos?**

Con los datos actuales: **problema de código potencial, sin datos que lo activen hoy.**
- **Código confirmado:** La arquitectura de `monitoreo-unit.tsx` es frágil — mezcla dos fuentes sin reconciliar por `(name, startTime)`.
- **Datos no confirmados:** No existen turnos duplicados en el campus en esta fecha.
- **Schema confirmado:** La ausencia de unique constraint es un riesgo real aunque hoy no haya producido duplicados.

**4. ¿Afecta a algún hecho de cumplimiento?**

**No. Confirmado con código.** (Ver sección 5.)

---

## 7. Causa del síntoma observado: indeterminada

El síntoma (0 rutas en monitoreo, 14 en historial, 22 jul 2026) **no puede atribuirse con certeza** al mecanismo de UUID divergente — porque la medición directa descarta esa divergencia para esta base en esta fecha.

Hipótesis alternativas que requerirían investigación adicional (con ficha aparte):
- **Estado transitorio:** ¿hubo un turno duplicado durante el día que fue eliminado antes de esta medición? Se necesita revisar `created_at` y posible historial de cambios.
- **Otra ruta de código:** ¿Existe otra condición que produzca `turnoId = undefined` o un id que no coincida con las ocurrencias?
- **Problema de timezone o de scope en la llamada a la API:** Si el `ctx.scope` que recibe `monitoreo-unit.tsx` difiere del usado por `jornada-unit.tsx`, los contratos y ocurrencias filtradas serían distintos.

---

## 8. Propuesta de arreglo (solo descripción — el arreglo va en ficha aparte)

Dos patas, en orden de impacto. La Pata 1 no resuelve el síntoma observado si la causa fue otra — pero sí elimina la vulnerabilidad estructural del código.

**Pata 1 — Código (impacto inmediato, sin migración):**
Cambiar `monitoreo-unit.tsx` para construir `shiftById` igual que `jornada-unit.tsx`: solo desde las ocurrencias del día. El catálogo (`getShiftsForScope`) puede seguir usándose para poblar el selector de turnos del formulario "Forzar fecha/turno", pero no debe ser la fuente primaria para elegir `turnoId`. Esto elimina la divergencia catálogo-vs-ocurrencias de raíz.

**Pata 2 — Schema (impacto permanente, requiere migración):**
Agregar unique indexes parciales:
```sql
CREATE UNIQUE INDEX shifts_plant_group_name_time_key
  ON shifts (plant_group_id, name, start_time)
  WHERE plant_group_id IS NOT NULL;

CREATE UNIQUE INDEX shifts_plant_name_time_key
  ON shifts (plant_id, name, start_time)
  WHERE plant_id IS NOT NULL;
```

### ⚠ Advertencia crítica antes de ejecutar la Pata 2

**La limpieza de duplicados nunca se hace con `DELETE` directo en SQL.**

El schema tiene cascadas encadenadas: `shifts → route_shifts (ON DELETE CASCADE) → service_occurrences (route_shift_id NOT NULL) → trips → compliance_facts`. Borrar un turno duplicado directamente arrastraría rutas, perfiles, ocurrencias y **hechos de cumplimiento ya materializados**.

Cualquier limpieza de duplicados requiere:
1. Inventario previo de qué rutas, perfiles y ocurrencias cuelgan de cada `shift_id` candidato a eliminar.
2. Reasignación de referencias (actualizar `route_shifts.shift_id`, actualizar `service_occurrences.route_shift_id` en cadena) **antes** de tocar el registro en `shifts`.
3. **Parada obligatoria con aprobación explícita de Asav** antes de ejecutar cualquier paso. Esto no es un trámite previo a la migración — es el trabajo principal.

La Pata 1 no requiere la Pata 2 para funcionar. Puede desplegarse independientemente.

---

## 9. ¿Afecta a otros alcances?

El riesgo es estructural. Cualquier alcance donde:
1. Existan turnos en el catálogo con UUID distinto al de las ocurrencias, Y
2. `getShiftsForScope` devuelva al menos uno de esos turnos

...puede sufrir el mismo síntoma. `plant_group` es más susceptible porque agrega turnos de varios sub-scopes, aumentando la probabilidad de divergencia. Una planta individual con un solo set de turnos sin recreaciones es menos propensa, pero no inmune.

La medición de esta fecha/campus no descarta el riesgo en otras fechas o en otros campus donde los datos de turno hayan evolucionado de forma diferente.

---

## 10. Ancla en el Marco

Del Marco Maestro: *"El servicio esperado concreto = una ruta dentro de un turno + destino + política, en una fecha."* El turno es parte de la identidad del servicio. Dos turnos idénticos en nombre y hora pero con distinto UUID son **identidad ambigua** — el sistema no puede saber cuál es "el verdadero" sin una jerarquía de desempate definida.

El arreglo correcto alinea la fuente del `turnoId` en la vista de monitoreo con la misma fuente que usa el árbitro (las ocurrencias), no con un catálogo separado que puede divergir.
