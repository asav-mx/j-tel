# Reporte de Diagnóstico — Torre muestra 0 rutas en turno activo

> **Fecha:** 22 de julio de 2026
> **Investigado por:** Claude Opus 4.6
> **Ficha madre:** `Ficha-Diagnostico-Torre-Cero-Rutas.md`
> **Estado:** DIAGNÓSTICO COMPLETO — sin cambios de código ni datos

---

## Veredicto rápido

**Problema de datos Y de código.**

- **Datos:** Existen (o pueden coexistir) dos registros en la tabla `shifts` con el mismo `name` y `start_time` para el mismo campus, pero con `id` distintos. El schema no lo impide.
- **Código:** `monitoreo-unit.tsx` mezcla dos fuentes al construir la lista de turnos (catálogo + ocurrencias) sin reconciliar por nombre+hora. Si el catálogo tiene un turno con `id` distinto al de las ocurrencias, la torre elige el id del catálogo → filtro devuelve 0 rutas.
- **Hechos de cumplimiento: sin impacto.** Confirmado con código.

---

## 1. El camino exacto que produce el bug

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

`getShiftsForScope` consulta la tabla `shifts` directamente por `plant_group_id`. Devuelve los registros del catálogo con sus propios UUIDs.

Las ocurrencias obtienen su `shiftId` por la relación `service_occurrences → service_profiles → route_shifts → shifts`. Si el `route_shift` apunta a un registro de `shifts` con distinto UUID que el catálogo, la deduplicación por `id` **no los une**: ambos entran al Map.

### `jornada-unit.tsx` no tiene este problema

Solo usa las ocurrencias para construir `shiftById`. Nunca llama a `getShiftsForScope`. El turno elegido siempre coincide con el turno de las ocurrencias.

---

## 2. Por qué `pickActiveShift` elige el turno sin ocurrencias

`pickActiveShift` (`apps/web/src/lib/local-time.ts`, líneas 37-55) ordena por `startTime` y desempata por `name`:

```typescript
const sorted = [...shifts].sort(
  (a, b) =>
    parseHhMmToMinutes(a.startTime) - parseHhMmToMinutes(b.startTime) ||
    a.name.localeCompare(b.name),
);
```

Si hay dos shifts con `startTime = "06:00"` y `name = "Primer Turno"`, ambos desempates valen 0. **El resultado depende del orden de inserción en el array.** Como el catálogo se inserta primero en el Map, el shift del catálogo tiende a salir primero — y es el que `pickActiveShift` elige como activo.

Ese shift_id del catálogo no coincide con el `shiftId` de las 14 ocurrencias. El filtro `o.profile?.routeShift?.shiftId === turnoId` devuelve vacío. **Resultado: 0 rutas.**

---

## 3. El schema no impide turnos duplicados

La tabla `shifts` (`packages/db/src/schema/index.ts`) solo tiene PK sobre `id`. No existe:
- `UNIQUE INDEX (plant_group_id, name, start_time)` para campus
- `UNIQUE INDEX (plant_id, name, start_time)` para planta individual

La única protección es aplicativa: `findShiftByNameAndTime` en el repositorio, invocada desde la API POST de turnos (`apps/web/src/app/api/cliente/turnos/route.ts`). Esta guarda **no cubre**:
- Seeds que llaman a `createShift` directamente sin pasar por la API
- SQL directo o migraciones que inserten turnos
- Race conditions entre dos requests simultáneos

Si se borró y recreó un turno por cualquier vía, el nuevo tiene UUID nuevo mientras los `route_shifts` y ocurrencias históricas siguen apuntando al UUID viejo. El catálogo y las ocurrencias divergen silenciosamente.

---

## 4. Respuestas directas a las preguntas de la ficha

**1. ¿Cuántos "Primer Turno 06:00" existen para ese campus y por qué más de uno?**

El schema permite N registros con mismo nombre/hora/scope sin error. La causa más probable: un turno se creó o recreó por fuera de la API de turnos (seed, SQL directo, o la UI si existió un duplicado previo), generando un segundo UUID. Las ocurrencias históricas siguen apuntando al UUID original.

**2. ¿Cuál eligió la torre y cuál tiene las 14 ocurrencias?**

La torre elige el shift del catálogo (`getShiftsForScope`) porque el catálogo se inserta primero en el Map. Las 14 ocurrencias tienen el shift de su `route_shift`, que apunta a un UUID distinto.

**3. ¿Es problema de datos, de código, o ambos?**

**Ambos.**
- **Datos:** El schema no tiene unique constraint sobre (scope, name, start_time). Dos registros con mismo nombre/hora pueden coexistir.
- **Código:** `monitoreo-unit.tsx` mezcla catálogo + ocurrencias sin reconciliar por nombre+hora. Debería hacer lo mismo que `jornada-unit.tsx` (solo ocurrencias), o reconciliar por `(name, startTime)` en lugar de por `id`.

**4. ¿Afecta a algún hecho de cumplimiento?**

**No. Confirmado con código.**
- `monitoreo-data.ts` no contiene llamadas a `saveFact`, `materializeFact`, ni `writeVerdict` (grep: 0 coincidencias).
- El archivo lo declara explícitamente en líneas 13-21: *"la torre NO recalcula la verdad... Solo lectura: no escribe hechos, ledger ni veredictos."*
- El árbitro (`packages/services/src/verification.ts`) recibe el `shiftId` de las ocurrencias, no del catálogo de la vista. El bug de catálogo-vs-ocurrencias es invisible para el árbitro.

---

## 5. ¿Afecta a otros alcances?

El riesgo es estructural, no exclusivo de `plant_group`. Cualquier alcance donde:
1. Existan turnos en el catálogo que no coincidan exactamente (por UUID) con los turnos de las ocurrencias, Y
2. `getShiftsForScope` devuelva al menos uno de esos turnos

...puede sufrir el mismo síntoma. `plant_group` es más susceptible porque agrega turnos de varios sub-scopes, aumentando la probabilidad de divergencia. Una planta individual con un solo set de turnos y sin recreaciones es menos propensa, pero no inmune.

---

## 6. Propuesta de arreglo (solo descripción — el arreglo va en ficha aparte)

Dos patas, en orden de impacto:

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
Antes de la migración, se necesita auditar y limpiar duplicados existentes. La Pata 1 no requiere la Pata 2 para funcionar, pero la Pata 2 evita que el problema resurja por otra vía.

---

## 7. Ancla en el Marco

Del Marco Maestro: *"El servicio esperado concreto = una ruta dentro de un turno + destino + política, en una fecha."* El turno es parte de la identidad del servicio. Dos turnos idénticos en nombre y hora pero con distinto UUID son **identidad ambigua** — el sistema no puede saber cuál es "el verdadero" sin una jerarquía de desempate definida.

El arreglo correcto alinea la fuente del `turnoId` en la vista de monitoreo con la misma fuente que usa el árbitro (las ocurrencias), no con un catálogo separado que puede divergir.
