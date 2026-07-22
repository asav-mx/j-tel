# Ficha de Diagnóstico — La torre en vivo muestra 0 rutas en turno activo

> **Fecha:** 22 de julio de 2026
> **Repo:** `j-tel`
> **Tipo:** DIAGNÓSTICO — investigar y reportar. **Cero código de arreglo, cero cambios de datos.**
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` es la única fuente de verdad. Donde esta ficha y el Marco choquen, **gana el Marco**.
> **Modelo:** Opus. Esto toca identidad de servicio.

---

## El síntoma (medido en producción, 22 jul 2026)

Campus Santos Dumont (Tecma), misma cuenta, misma fecha, mismo turno en pantalla:

- **Monitoreo** — encabezado: *"Turno activo (automático) · Primer Turno · 2026-07-22 · 06:00"*. Debajo: **0 rutas · 0 cerrado · 0 llegó · 0 avanzando · 0 en ruta · 0 programada · 0 alerta.** Mapa vacío con las tres capas activadas.
- **Historial**, misma fecha y turno: **14 rutas · 14 sin verificar.**

La torre se contradice dentro de la misma pantalla: elige un turno como activo y acto seguido reporta que ese turno no tiene rutas. Y `0 programada` no se explica por falta de GPS — las programadas salen del contrato.

---

## Lo que ya está confirmado por lectura de código (no re-investigar)

**Las dos pantallas usan el MISMO filtro de ocurrencias.** Idéntico en `monitoreo-data.ts` y `jornada-data.ts`:

```
o.serviceDate === opts.fecha && o.profile?.routeShift?.shiftId === opts.turnoId
```

**Pero construyen la LISTA DE TURNOS de forma distinta:**

- `jornada-unit.tsx`: `shiftById` se llena **solo desde las ocurrencias del día**.
- `monitoreo-unit.tsx`: `shiftById` se llena desde **dos fuentes** — primero `repos.routes.getShiftsForScope(ctx.scope)` (el catálogo del alcance), y después las ocurrencias del día. La deduplicación es **por `s.id`**.

Luego `pickActiveShift(shifts, now)` elige por hora local y el resultado se pasa como `turnoId` a `loadMonitoreo`.

**Consecuencia mecánica:** Monitoreo **puede** elegir un turno del catálogo que no tiene ninguna ocurrencia ese día. Historial **no puede**.

---

## Hipótesis principal — confirmar o descartar con evidencia

Existen **dos o más registros de turno distintos** para el campus, con **el mismo nombre y la misma hora de inicio**, pero distinto `id`:

- uno en el catálogo del alcance (`getShiftsForScope`)
- otro atado a los perfiles/rutas que generan las ocurrencias

Como `shiftById` deduplica por `id` — no por nombre + hora — **ambos entran a la lista**. `pickActiveShift` ordena por `startTime` y desempata por `name`; con nombre y hora idénticos el desempate es indefinido, y puede quedar seleccionado el `id` sin ocurrencias.

Esto explicaría los tres hechos a la vez: **nombre correcto, hora correcta, cero rutas.**

No la des por buena. Mídela.

---

## Lo que hay que medir (solo lectura)

1. **Para el campus Santos Dumont (`plant_group`), fecha 2026-07-22:**
   - ¿Cuántos registros devuelve `getShiftsForScope`? Lista `id`, `name`, `startTime`.
   - ¿Cuántos `shiftId` distintos aparecen en las ocurrencias de ese día? Lista `id`, `name`, `startTime`.
   - ¿Se solapan? ¿Hay ids del catálogo que **no** aparecen en ninguna ocurrencia?

2. **¿Cuál id habría elegido `pickActiveShift`?** Reproduce la función con la lista real y una hora del 22 jul. Reporta el id ganador.

3. **Si hay turnos duplicados: ¿de dónde salieron?** ¿Uno por planta miembro y uno del grupo? ¿Un alta repetida? Reporta el **origen**. No los toques.

4. **¿El patrón afecta a otros alcances?** Prueba con una planta independiente y con otro campus si existe. ¿Es exclusivo de `plant_group` o es general?

---

## Preguntas que el diagnóstico debe contestar, en español simple

1. ¿Cuántos "Primer Turno 06:00" existen para ese campus, y **por qué** más de uno si es el caso?
2. ¿Cuál eligió la torre y cuál tiene las 14 ocurrencias?
3. ¿Es problema de **datos** (turnos duplicados), de **código** (la lista se arma mal), o de **ambos**?
4. ¿Afecta a algún hecho de cumplimiento? La lectura previa dice que **no** — Monitoreo es vista en vivo y no emite veredicto. **Confirma o corrígeme con evidencia.**

---

## 🛑 Límites inviolables

- Prohibido escribir código de arreglo.
- Prohibido crear, borrar, modificar o deduplicar turnos, perfiles, rutas u ocurrencias — ni siquiera "para probar".
- Prohibido tocar `saveFact`, el motor, o cualquier hecho existente.
- Solo `SELECT` y lectura de código.
- **Investiga y deténte.** Si crees tener el arreglo obvio, descríbelo como propuesta y para. El arreglo va en ficha aparte, con aprobación previa de Asav.

---

## Ancla en el Marco (para quien arregle después)

- *"El servicio esperado concreto = una ruta dentro de un turno + destino + política, en una fecha."* El turno **es parte de la identidad del servicio**. Dos turnos idénticos = identidad ambigua.
- *"Un servicio compartido por un grupo/campus tiene un hecho compartido, visible para las plantas de ese grupo, no para otras."*
- *"La verdad se calcula una vez y se guarda."* Monitoreo **lee**, no calcula. Ningún arreglo aquí puede tocar un hecho.
- **El código nunca conoce nombres específicos.** Santos Dumont es donde se detectó, no un caso especial. El arreglo debe servir para cualquier alcance.

---

## Reglas de trabajo

- `git fetch origin` primero. Rama nueva desde `origin/main`.
- **Una rama, un PR.**
- Esta ficha se guarda en `docs/marco-limpio/Ficha-Diagnostico-Torre-Cero-Rutas.md` y entra por PR junto con el reporte de hallazgos.
- **No mergees.** El merge lo hace Asav.
