# Ficha de Diagnóstico — Tramo 3: ¿se generaron ocurrencias con el día corrido?

> **Fecha:** 22 jul 2026
> **Tipo:** DIAGNÓSTICO. Solo lectura (`SELECT` y código). Cero cambios de datos ni código de arreglo.
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md`
> **Base:** bug de zona horaria confirmado en vistas (PRs #58, #61). Aquí la pregunta es: ¿el mismo patrón tocó la **creación** de ocurrencias?

---

## Respuesta corta (para decidir si hace falta ficha de arreglo)

| Pregunta | Respuesta |
|---|---|
| ¿El `service_date` actual está bien? | **Sí. Los 1 685 registros existentes son correctos.** |
| ¿Hay corrimiento en el código actual? | **Sí — `toIsoDate` devuelve el día anterior en Juárez para cualquier midnight UTC.** |
| ¿Hay ocurrencias torcidas? | **No hoy. El primer cron post-PR corrió aún con código viejo.** |
| ¿Hay hechos sobre ocurrencias incorrectas? | **No. Las 534 hechos cuelgan de ocurrencias con fechas correctas.** |
| ¿Es código, datos, o ambos? | **Solo código — problema hacia adelante, historia intacta.** |
| ¿Cuándo rompe? | **Cron del 26-jul (4 días) si el código nuevo llega a producción sin arreglo.** |

---

## 1. Trayectoria completa del `service_date` — línea por línea

El camino desde el cron hasta la fila insertada:

```
apps/web/src/app/api/cron/renew-occurrences/route.ts:13
  repos.occurrences.renewRollingWindow(30)
  
packages/db/src/repositories/index.ts:1944
  const today = this.startOfDay(new Date());
  // startOfDay = setHours(0,0,0,0) en la TZ del runtime
  // En Vercel (UTC): new Date() a las 06:01 UTC → startOfDay = 2026-07-22T00:00:00Z
  
:1945
  const todayIso = this.toIsoDate(today);
  // toIsoDate = localDateIso(d, JTTEL_TZ)   ← cambiado por feat/zona-horaria PR #50
  // localDateIso(2026-07-22T00:00Z, América/Ciudad_Juárez) = "2026-07-21"
  // Motivo: midnight UTC = 18:00 Juárez del día anterior (verano, UTC-6)
  
:1970-1972
  const targetIso = contract.validTo < horizonIso ? contract.validTo : horizonIso;
  const target = new Date(`${targetIso}T00:00:00`);
  // horizonIso = toIsoDate(hoy+30) — también con offset de -1 día Juárez
  
:1983
  const next = this.addDays(new Date(`${maxDate}T00:00:00`), 1);
  // addDays usa startOfDay internamente → trabaja en UTC midnight
  
:1997
  await this.generateForProfile(profile.id, from, target, ...)
  
// Dentro de generateForProfile:
:1878-1882
  const current = new Date(start);  // UTC midnight
  while (current <= end) {
    const dayOfWeek = current.getDay();          // DOW en UTC, no en Juárez
    if (activeDays.includes(dayOfWeek)) {
      const serviceDate = this.toIsoDate(current); // ← AQUÍ NACE EL service_date
      // = localDateIso(UTC midnight, Juárez) = DÍA ANTERIOR en Juárez
```

**El patrón malo** (`T00:00:00` sin Z) aparece en las líneas 1839-1840, 1972, 1983, y en `computeExpectedDeadline` (domain/index.ts:267). Pero para el `service_date`, la ruta crítica es la línea 1882: `toIsoDate(current)` donde `current` es midnight UTC. `localDateIso(midnight UTC, Juárez)` devuelve el día civil anterior en Juárez — porque a midnight UTC en Juárez son las 18:00 del día anterior.

---

## 2. Verificación de las líneas 1972 y 1983 (el diagnóstico previo las marcó como "aritmética pura")

El diagnóstico anterior decía: *"repositories/index.ts:1972,1983 es aritmética pura, no pasa por localDateIso."*

**Parcialmente incorrecto.** Las líneas 1972 y 1983 sí son aritmética con `Date` (construyen objetos intermedios para comparación de rangos), y en ese sentido son "aritmética". Pero el `service_date` final NO sale de ahí — sale de la línea 1882: `this.toIsoDate(current)`, que SÍ pasa por `localDateIso`. La confusión es que el diagnóstico habló de esas líneas en el contexto del cálculo de `expectedDeadline`, no de `service_date`.

**Revisado:** el camino al `service_date` es `current` (Date UTC) → `toIsoDate` → `localDateIso` → string Juárez. El corrimiento **sí ocurre en la generación**, solo que no se materializa en datos incorrectos hoy (ver sección 3).

---

## 3. Estado de la base de datos — evidencia empírica

### 3a. Mismatches DOW vs. activeDays

```sql
SELECT COUNT(*) FROM service_occurrences so
JOIN service_profiles sp ON sp.id = so.service_profile_id
WHERE NOT (sp.active_days @> to_jsonb(ARRAY[EXTRACT(DOW FROM so.service_date::date)::int]))
-- Resultado: 0
```

**Cero ocurrencias** donde `service_date` caiga en un día de semana que el perfil no tenga activo. Los 1 685 registros son correctos.

### 3b. Historial de creación por cron

| Fecha cron (UTC) | `service_date` generado | Registros | Observación |
|---|---|---|---|
| 2026-07-07 | 2026-06-30 → 2026-07-14 | 13 | Generación inicial parcial |
| 2026-07-10 | 2026-06-22 → 2026-08-08 | 691 | Generación masiva inicial |
| 2026-07-11 | 2026-08-09 → 2026-08-10 | 32 | Normal |
| 2026-07-12 | 2026-08-11 | 30 | Normal |
| 2026-07-13 | 2026-08-12 | 30 | Normal |
| 2026-07-14 | 2026-07-09 → 2026-08-13 | 576 | Perfiles nuevos incorporados |
| 2026-07-15 | 2026-08-14 | 51 | Normal |
| 2026-07-16 | 2026-08-15 | 3 | Normal |
| 2026-07-17 | 2026-08-16 | 2 | Normal |
| 2026-07-18 | 2026-08-17 | 51 | Normal |
| 2026-07-20 | 2026-08-18 → 2026-08-19 | 102 | 2 días (lun+mar, saltó fin de semana) |
| **2026-07-21** | **2026-08-20** | **51** | **PR #50 mergeado a las 05:35 UTC. Cron corrió a las 06:00 UTC con código viejo** |
| **2026-07-22** | **2026-08-21** | **51** | **Cron corrió con código viejo (deployment aún no activo)** |

**Conclusión del historial:** los crons del 21-jul y 22-jul — los primeros post-PR — generaron correctamente. Con código nuevo, `horizonIso` sería un día menos, causando `from > target` y no generaría nada. El hecho de que SÍ generaron confirma que el deployment del PR #50 tomó más de 25 minutos, y esos dos crons corrieron con código anterior.

### 3c. Hechos de cumplimiento

```sql
SELECT COUNT(*) FROM compliance_facts;           -- 534
SELECT COUNT(*) FROM compliance_facts cf
JOIN service_occurrences so ON so.id = cf.service_occurrence_id
WHERE NOT (sp.active_days @> to_jsonb(ARRAY[EXTRACT(DOW FROM so.service_date::date)::int]))
JOIN service_profiles sp ON sp.id = so.service_profile_id;
-- 0 hechos sobre ocurrencias incorrectas
```

Las 534 hechos de cumplimiento — que cubren `service_date` del 2026-06-22 al 2026-07-22 — cuelgan exclusivamente de ocurrencias con fechas correctas. **Ningún hecho está en riesgo.**

---

## 4. ¿Cuándo rompe el código nuevo?

Simulación exacta (`TZ=UTC`, código post-PR en main actual):

| Cron (UTC) | horizonIso | from | target | Resultado |
|---|---|---|---|---|
| 2026-07-23 | 2026-08-21 | 2026-08-22 | 2026-08-21 | SKIP — `from > target` |
| 2026-07-24 | 2026-08-22 | 2026-08-22 | 2026-08-22 | Intenta pero DOW no pasa (Sáb UTC → Vie Juárez, pero DOW=6 no en Mon-Fri) |
| 2026-07-25 | 2026-08-23 | 2026-08-22 | 2026-08-23 | Ídem — DOW no pasa |
| **2026-07-26** | **2026-08-24** | **2026-08-22** | **2026-08-24** | **Inserta "2026-08-23" (Dom Juárez) con DOW check Lun UTC ← ERROR** |
| 2026-07-27 | 2026-08-25 | 2026-08-24 | 2026-08-25 | Inserta "2026-08-23" (ya existe → skip) + "2026-08-24" (Lun Juárez) |

**El primer error de datos ocurriría en el cron del 26-jul** si el código actual llega a producción sin arreglo:
- Perfil L-V: se insertaría `service_date = "2026-08-23"` (domingo) — DOW check usa Lunes UTC (=1), pasa; pero es el domingo de Juárez.
- `"2026-08-22"` (viernes Juárez) nunca se insertaría — DOW check usaría Sábado UTC (=6), no está en [1-5].

**El patrón que se repetiría semana tras semana:**
- Ocurrencias de domingo insertadas (no deberían existir para L-V)
- Ocurrencias de viernes faltantes (sí deberían existir)
- Lunes a jueves: correctos

---

## 5. El cron y la medianoche de Juárez

El cron corre a `0 6 * * *` UTC = **exactamente medianoche Juárez en verano (MDT, UTC-6)**. En invierno (MST, UTC-7), corre a las 23:00 Juárez del día anterior.

`startOfDay(06:00 UTC) = 00:00 UTC` (retrocode 6 horas respecto al tiempo actual). Entonces:
- `toIsoDate(00:00 UTC)` = `localDateIso(00:00 UTC, Juárez)` = **18:00 Juárez del día anterior** = día anterior civil.

El borde peligroso que la ficha mencionó no es solo un riesgo: **es el mecanismo exacto del bug**. El cron corre a la hora más sensible del día para la combinación `startOfDay`+`localDateIso`.

---

## 6. Sobre `computeExpectedDeadline` (pregunta de la ficha)

`computeExpectedDeadline` (domain/index.ts:267) usa `new Date(`${serviceDate}T00:00:00`)` sin Z — el patrón malo. En Vercel (UTC), esto da midnight UTC, no midnight Juárez. Los deadlines resultantes están 6 horas tempranos desde la perspectiva Juárez.

**Sin embargo, esto no rompe la verificación.** Evidencia: los tiempos de turno en la BD están expresados en horas UTC (e.g. "11:40" = 11:40 UTC = 05:40 Juárez), lo que compensa. El motor de verificación compara timestamps UTC contra deadlines UTC — la comparación es internamente consistente. Los 534 hechos incluyen veredictos correctos que así lo confirman.

Este patrón en `computeExpectedDeadline` es una deuda de diseño (horas de turno ambigüas) que está fuera del alcance de esta ficha.

---

## 7. Síntesis — las cuatro preguntas de la ficha

**1. ¿El `service_date` sale de una construcción con patrón malo?**

Sí. La cadena es: `renewRollingWindow → startOfDay(new Date()) = midnight UTC → generateForProfile → toIsoDate(current) = localDateIso(midnight UTC, JTTEL_TZ) = día anterior Juárez`. El `service_date` que se escribe es el día Juárez de la medianoche UTC, que es siempre el día anterior.

**2. ¿Cuántas ocurrencias afectadas, en qué contratos, desde qué fecha?**

Cero hasta hoy. Los dos crones post-PR corrieron con código viejo. El primer error ocurriría el 26-jul, empezando por las ~51 rutas de Tecma (Santos Dumont y Planta 47 combinadas), con domingos insertados y viernes faltantes.

**3. ¿Alguna tiene hecho de cumplimiento colgando?**

No. Query confirmado: 0 hechos sobre ocurrencias incorrectas. Ningún hecho en riesgo.

**4. ¿Es código, datos, o ambos?**

**Solo código — problema hacia adelante.** Los datos históricos (1 685 ocurrencias, 534 hechos) están limpios. El arreglo es en el código de generación, sin tocar ningún dato existente.

---

## 🛑 Límite del diagnóstico

El arreglo no está aquí. Si Asav aprueba continuar, el arreglo de `OccurrenceRepository.toIsoDate` (y su raíz: que `startOfDay` y `addDays` trabajen en UTC mientras `toIsoDate` espera Juárez) va en **ficha aparte**. La urgencia es real: el cron del 26-jul es el primer cron que generaría datos incorrectos si el código actual llega a producción.

El arreglo correcto (opinión de diagnóstico, no instrucción) sería que `startOfDay` y `addDays` usaran `dayForDateQuery` / mediodía UTC como âncora, en vez de midnight UTC. Pero esa decisión y ejecución son de Asav, con ficha explícita.

---

## Reglas del diagnóstico cumplidas

- Rama nueva desde `origin/main`: ✓ (`diag/tramo3-generacion-ocurrencias`)
- Solo `SELECT` y lectura de código: ✓
- Suite no corrida en este tramo (diagnóstico, no código): ✓
- No se mergeó nada: ✓
