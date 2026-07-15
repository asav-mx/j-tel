# Ficha de Diagnóstico — Por qué la 47 no identifica unidades

> **Fecha:** 15 de julio de 2026
> **Repo:** `j-tel`
> **Rama:** `docs/diagnostico-identificacion-unidad`
> **Tipo:** DIAGNÓSTICO — solo investigar y reportar. Cero código de arreglo, cero cambios de datos.
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` es la única fuente de verdad. Donde esta ficha y el Marco choquen, **gana el Marco**.

---

## Resumen en una línea

La 47 **sí identifica y resuelve unidades bien**, y las unidades **sí llegan a la geocerca de la planta**. Lo que falla es el **match de ruta (métrica A / cobertura del KML)**: ninguna unidad cubre el KML importado por encima del umbral, así que **todo cae en `no_cumplido`**, y por diseño un `no_cumplido` **nunca acredita unidad** → "Unidad observada: —".

**No es bug de código. No es ruta borrada. Es que los KML de la 47 (importados el 14-jul) no coinciden geométricamente con el recorrido real de los camiones.**

---

## Lo que se confirmó en la base REAL (producción, solo lectura)

Planta 47 = `Tecma Planta 47` (code `47`), contrato único `Tecma 47 - Transporte Personal` (activo), 21 perfiles activos.

### Estado de perfiles / rutas / geocercas — **TODO válido**

- **Geocerca destino** `Tecma Planta 47`: **polígono con 24 puntos** (válido, ≥3).
- **Los 21 perfiles** apuntan a esa misma geocerca de 24 puntos.
- **Cada perfil tiene ruta con KML vigente y no vacío**: waypoints entre **67 y 192**, `validFrom` 2026-07-14 (frescos), `validTo` null.
- **No hay perfiles huérfanos.** (Nota de esquema: `service_profiles.geofence_id` y `route_shift_id` son `NOT NULL` con `ON DELETE CASCADE`; si se borra la ruta o la geocerca, **el perfil se borra en cascada** — no queda "apuntando a algo vacío". Por eso un perfil que existe **siempre** tiene ruta y geocerca.)

→ **Sospecha 2 (perfil sin ruta/geocerca válida) queda DESCARTADA en el estado actual.** El borrado histórico de una ruta no dejó un perfil roto; lo que hay hoy es ruta + geocerca + KML válidos.

### Resolución de unidad — **FUNCIONA**

Para los viajes reales de la 47:
- Cada viaje trae **~3,232–3,284 puntos GPS** de **51–52 IMEIs distintos** (toda la flota de Juárez Bus).
- **El 100% de los puntos tiene `unit_id` resuelto** (ej. 3,232 de 3,232). La asignación dispositivo↔unidad se aplica sin fallar.
- En el **ledger**, los pasos `candidata` vienen identificados por **UUID de unidad** (ej. `2ec9b27c-…`), **no** por IMEI crudo.

→ **Sospecha 1 (un camino deja `unitId = imei` crudo) queda DESCARTADA como causa.** Ver la sección de código abajo.

### El síntoma medido

- Hechos de la 47: **99 de 99 = `no_cumplido`**, `observed_unit_id` nulo en el 100%.
- Ejemplo `KM-20-A` (2026-07-14): **7 de 52 unidades ENTRARON a la geocerca** de la planta (llegaron). Pero la **cobertura máxima del KML (métrica A) fue 13.4%**, contra un umbral de **60%**. Ninguna sirvió la ruta.

---

## Sospecha 1 — a fondo: no hay "dos caminos" que pierdan la unidad

Hay **un solo camino de veredicto**: `verifyService` (`packages/verification/src/index.ts`). El veredicto de un hecho se emite ahí y en ningún otro lado.

1. **El `unitId: imei` de `packages/verification/src/index.ts:642` NO recibe un IMEI crudo.** Antes de llamar a `verifyService`, `packages/services/src/verification.ts` (líneas **805–814**, `enrichedPoints`) reescribe el campo `imei` de cada punto a **la unidad ya resuelta**:

```805:814:packages/services/src/verification.ts
    const enrichedPoints = evidencePoints
      .filter((p) => {
        const unitId = imeiToUnitId.get(p.imei);
        return !(unitId && excluded.has(unitId));
      })
      .map((p) => ({
        ...p,
        // Agrupar por unidad cuando se conoce; si no, por IMEI.
        imei: imeiToUnitId.get(p.imei) ?? p.imei,
      }));
```

Como en producción **todos** los puntos traen `unit_id`, el agrupado (`groupPointsByImei`) queda por **UUID de unidad**, y `candidateUnits[].unitId` (línea 642) es ese UUID. El ledger real lo confirma: las `candidata` están keyed por UUID de unidad.

2. **El bloque `packages/services/src/verification.ts:516–543` NO es un camino de veredicto.** Es `recordArrivalOutsideWindowContext`: solo agrega una **entrada informativa** al ledger ("llegada fuera de ventana") cuando el hecho quedó **sin** llegada. No emite estado ni asigna la unidad observada del hecho. La ficha lo confundió con un segundo camino de asignación.

3. **Por qué "Unidad observada: —":** en `verifyOccurrence` la unidad solo se persiste **si el estado es `cumplido`**:

```843:855:packages/services/src/verification.ts
    let observedUnitId: string | null = null;
    if (verification.observedUnitId && finalStatus === "cumplido") {
      const winner = verification.candidateUnits.find(
        (c) => c.unitId === verification.observedUnitId,
      );
      const candidate =
        (winner && units.some((u) => u.id === winner.unitId) ? winner.unitId : null) ??
        imeiToUnitId.get(verification.observedUnitId) ??
        units.find((u) => u.id === verification.observedUnitId)?.id ??
        null;
      // Solo persistir UUID de unidad real (nunca un IMEI crudo).
      observedUnitId = candidate && units.some((u) => u.id === candidate) ? candidate : null;
    }
```

Como en la 47 **nada llega a `cumplido`**, este bloque siempre deja `observedUnitId = null`. **La unidad no se "pierde" en un camino malo: no se acredita porque no hubo cumplimiento**, que es exactamente lo que manda el Marco (*"'Sin evidencia' no es 'no se cumplió'"* y *la unidad observada es la que **sirvió** el servicio*).

> **Bug latente (honestidad, no es la causa del 47):** si algún día un servicio saliera `cumplido` pero el grupo ganador quedara con IMEI **sin** resolver (`imeiToUnitId` vacío para ese IMEI), las líneas 848–854 forzarían `observedUnitId = null` → un cumplido "sin unidad". Hoy **no ocurre** en la 47 (no hay cumplidos) ni en Santos Dumont (las unidades resuelven). Queda anotado para la ficha de arreglo, pero **no explica el síntoma**.

---

## Sospecha 2 — a fondo: la ruta existe, el KML no coincide

El árbitro marca `servedRoute` (unidad que sirvió la ruta) así:

```400:403:packages/verification/src/index.ts
  const servedRoute =
    arrivalAt !== null &&
    (!hasKml ||
      (routeMatchPct >= params.minKmlPct && corridorPrecisionPct >= params.minCorridorPct));
```

Con KML presente, exige **llegada a geocerca Y métrica A ≥ umbral A Y métrica B ≥ umbral B**. Política de la 47: `kmlMatchMinPct = 60`, `kmlCorridorMinPct = 60`, `kmlCorridorMeters = 120`.

### Medición directa (réplica de la matemática del motor) — `KM-20-A`, 2026-07-14

| unidad | pts | ¿entró a geocerca? | A (cobertura KML) | dist. mín. al KML |
|---|---|---|---|---|
| 2ec9b27c | 83 | **sí** | **13.4%** | 0.003 km (3 m) |
| 8e765161 | 65 | sí | 3.0% | 0.004 km |
| 8fa9a5d6 | 90 | sí | 3.0% | 0.003 km |
| 3b6a0218 | 113 | sí | 1.5% | 0.002 km |
| a30da12c | 123 | no | 0% | 3.71 km |

- **7 de 52** unidades entran a la geocerca (llegan a la planta).
- Las que llegan pasan a **2–7 metros** de **algún** waypoint del KML… pero solo cubren **≤13.4%** del KML.

**Lectura:** las unidades que llegan a la 47 tocan el KML **solo en la cola, cerca de la planta** (todos los KML de la 47 terminan en el mismo punto de entrada, ~31.721, −106.397). El **cuerpo del KML** (el loop por la colonia, ~11 km de extensión en el bbox) **no lo recorre ningún camión**. Es decir: el trazo KML importado **no es el recorrido que hace el camión** de esa ruta.

### El contraste que lo prueba: Santos Dumont funciona con el MISMO motor

Contrato `TECMA Campus Santos Dumont - Juarez Bus`, misma flota, mismo código, misma política (60/60, 120 m), **misma volcada de flota completa** (51 IMEIs por viaje):

- **84 cumplidos** (76 con unidad), **A promedio 82.2%**.
- En un cumplido de muestra, la unidad ganadora: **A = 72.9%, B = 77.9% → `sirvio_ruta` → `cumplido`**, unidad acreditada.

Mismo motor, misma flota, mismos umbrales, misma resolución de unidad. **La única diferencia es que el KML de Santos Dumont sí traza el recorrido real (su ganadora cubre 73%), y el de la 47 no (su mejor unidad cubre 13%).**

---

## Relación entre las dos sospechas

No están encadenadas como suponía la ficha (2 → 1). **Ambas, tal como estaban formuladas, se descartan:**

- No hay dos caminos de código (Sospecha 1): hay uno, y resuelve la unidad bien.
- El perfil de la 47 no está roto ni sin ruta (Sospecha 2): tiene geocerca (24 pts) y KML (67–192 wp) válidos.

La causa real es **una tercera**, de **datos**: el **contenido geométrico de los KML de la 47** no corresponde al recorrido real de los camiones → métrica A nunca llega a 60% → nadie sirve la ruta → `no_cumplido` en todo → sin unidad observada (por diseño).

---

## Veredicto (claro, para Asav)

1. **Por cuál camino pasa un servicio fallido de la 47 y dónde "se pierde" la unidad.**
   Pasa por el único camino, `verifyService`. La unidad **no se pierde**: se resuelve correctamente (candidatas por UUID de unidad, 100% de puntos con `unit_id`). El estado sale `no_cumplido` porque **ninguna candidata cubre el KML ≥60%** (`decision → no_cumplido`, `reason: ninguna_unidad_coincidio_ruta`). Y `verifyOccurrence` solo acredita unidad si el estado es `cumplido` (líneas 843–855). Por eso "Unidad observada: —".

2. **Estado real del perfil de la 47 en producción.**
   Ruta válida: **sí** (KML de 67–192 waypoints, vigente). Geocerca válida: **sí** (24 puntos). Los camiones **sí llegan** a la geocerca (7/52 en `KM-20-A`).

3. **¿Código, datos, o ambos?**
   **Solo datos.** El código del árbitro es correcto (lo prueba Santos Dumont, que cumple con el mismo motor). El problema es que **los KML importados para la 47 el 14-jul no coinciden con el recorrido real** de los camiones (los buses tocan el KML solo cerca de la planta; cubren ≤13% del trazo). No es la ruta "borrada" de la Sospecha 2 — las rutas existen; es que el **trazo es incorrecto/no representativo** de lo que manejan las unidades.

---

## Propuesta de arreglo (solo descrita — NO implementada aquí)

> Punto de parada. Esto va en **ficha aparte**, con aprobación previa. No se toca nada hasta entonces.

Hipótesis principal a resolver primero (barata y de datos):

- **Revisar la fidelidad y asignación de los KML de la 47.** Confirmar, ruta por ruta, si el KML importado corresponde al recorrido de recolección real (colonia correcta, sentido correcto, no solo el tramo final hacia la planta). Muy probablemente el import del 14-jul cargó trazos que no son los recorridos reales, o los asignó al perfil equivocado.

Preguntas abiertas que la ficha de arreglo debe cerrar **con evidencia** antes de tocar código:

- ¿El camión que realmente hace `KM-20` está en la flota ese día y cuál es su cobertura A contra un KML corregido?
- ¿Los KML de la 47 se importaron con menos densidad / distinto formato que los de Santos Dumont? (SD cubre 73%; la 47 topa en 13% con distancia mínima de 3 m — patrón de "solo toca la cola".)
- ¿Conviene fijar `possibleUnits` por perfil (hoy los 21 perfiles tienen **0** unidades fijadas, igual que SD) para no evaluar 51 camiones por ruta? Es un **agravante de ruido**, no la causa (SD también evalúa 51 y funciona).

Cualquier cambio de umbrales (A/B/corredor) queda **fuera** de la propuesta: bajarlos para "arreglar" la 47 rompería la ley del Marco (umbrales = política del contrato) y ensuciaría el veredicto de Santos Dumont.

---

## Cómo se obtuvo (reproducible, solo lectura)

- Lectura de código: `packages/services/src/verification.ts`, `packages/verification/src/index.ts`, `packages/db/src/schema/index.ts`.
- Consultas **SELECT** contra la base real (Neon de producción, `DATABASE_URL` del repo), sin escrituras: conteo de hechos por estado, geocerca/KML por perfil, puntos de evidencia por viaje y por unidad, réplica de la métrica A y de la entrada a geocerca para `KM-20-A`, y contraste con el contrato de Santos Dumont.
- No se creó, modificó ni borró ningún dato. No se tocó `saveFact`, ni el motor, ni ningún hecho.
