# Ficha de Diagnóstico — El expediente fiel

> **Fecha:** 23 jul 2026
> **Tipo:** DIAGNÓSTICO. Cero código de arreglo, cero cambios de datos. Solo `SELECT` y lectura.
> **Investigadores:** Claude Opus (claude-opus-4-8) · sesión asav-mx
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md`

---

## PARTE A — "Invalid Date" en el detalle del servicio

### Diagnóstico

**Causa raíz:** doble formateo. La capa de datos (`service-detail-data.ts`) ya entrega las fechas convertidas a texto legible mediante `localTimeHHMM()` — por ejemplo `"14:30"`. La vista (`service-detail-view.tsx`) recibe esos strings y los pasa por `new Date("14:30")`, que devuelve `Invalid Date`. No es un dato nulo ni un valor ausente; es un string que fue formateado una vez demasiado.

**Commit que lo introdujo:** `1c9181b` — `feat(timezone): zona horaria configurable por contrato y un solo reloj`. Ese PR cambió el contrato de `service-detail-data.ts`: antes devolvía strings ISO, ahora devuelve `"HH:MM"` vía `localTimeHHMM(value, tz)`. La función `formatDateTime` de la vista no se actualizó para acompañar ese cambio.

### Archivos involucrados

| Archivo | Líneas | Rol |
|---|---|---|
| `apps/web/src/components/service-detail-view.tsx` | 6-12, 64, 80, 92, 110, 132, 142 | Vista — llama `formatDateTime(data.<campo>)` |
| `apps/web/src/lib/service-detail-data.ts` | ~303-322 | Datos — devuelve strings `"HH:MM"` ya formateados |
| `packages/domain/src/index.ts` | 84-93 | `localTimeHHMM` — devuelve `string`, no `Date` |

**La función rota** (vista, líneas 6-12):
```ts
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}
```

Asume que recibirá un ISO string. Recibe `"14:30"`. `new Date("14:30")` → `Invalid Date`.

### Campos afectados

- Deadline (`data.expectedDeadline`)
- Ventana (política): `data.policyWindowStart` / `data.policyWindowEnd`
- Ventana usada en este viaje: `data.tripWindowStart` / `data.tripWindowEnd`
- Llegada: `data.observedArrivalAt`
- GPS en ruta: `data.evidenceFirstAt` / `data.evidenceLastAt`

### Por qué el resto no se rompe

Veredicto, unidad, puntualidad, mapa y GPS crudo no pasan por `formatDateTime` — se renderizan como strings/labels directos. Solo los 8 valores de tiempo que cruzan esa función fallan.

### Caras afectadas

**Dos caras:** cliente/planta (`/app/cliente/servicio/[id]/page.tsx`) y carrier (`/app/carrier/servicio/[id]/page.tsx`). Comparten el mismo componente y loader. J-Staff usa `localTimeHHMM` directamente en su propio path y no está afectado.

### Propuesta de arreglo (sin código — para aprobación)

Opción A (alineada con "un solo reloj"): eliminar `formatDateTime` de la vista y mostrar los strings tal cual llegan de `service-detail-data.ts`. La capa de datos ya es la fuente única del formateo.

Opción B (mayor visibilidad): cambiar `service-detail-data.ts` para devolver ISO en esos campos y mantener el formateo en la vista — pero esto reintroduce el riesgo de doble reloj que `1c9181b` cerró.

**Recomendación:** Opción A. El loader ya aplica la zona horaria del contrato; la vista solo tiene que mostrar.

Nota de diseño: aun con el fix, esos campos mostrarán solo hora (`"14:30"`), no fecha+hora. Si se necesita fecha completa en algún campo, el loader debería usar `localDateTimeShort` en vez de `localTimeHHMM` para ese campo específico.

---

## PARTE B — El ~4% de hechos que el motor no reproduce

### Diagnóstico

**La hipótesis original era incorrecta.** No es deriva de KML. El número `~4%` de discrepancia corresponde a **deriva de geocerca**: el dry-run (y el motor real) usan la geocerca **actual del perfil**, no la congelada en la ocurrencia. Cuando la geocerca del perfil cambia después de que la ocurrencia fue generada, el re-juicio evalúa contra un polígono distinto al que vio el juicio original.

### Evidencia empírica (SELECT read-only, 17–23 jul, 260 ocurrencias con ruta)

| Tipo de deriva | Casos afectados | % |
|---|---|---|
| KML (frozen ≠ live) | **0 / 260** | 0% |
| Geocerca (frozen ≠ live) | **105 / 260** | **40%** |
| Política (snapshot ≠ actual) | 27 / 247 | 11% |

La hipótesis de deriva de versión KML no se confirma. `valid_to` nunca está seteado (cero versiones cerradas), así que `getKmlVersionForDate` devuelve siempre la misma versión — no hay deriva KML activa en producción hoy.

Los 105 casos con geocerca distinta explican el síntoma `unit=— A=— B=—`: el motor devuelve `no_cumplido` cuando ninguna unidad entra a la geocerca **actual**. Una unidad que llegó a la geocerca **original** no aparece en la nueva; de ahí el resultado vacío.

### Dónde ocurre en el código

**`compare-verify-dry.ts`:**

| Recurso | Cómo se obtiene | Debería leer |
|---|---|---|
| Geocerca | `profile.geofence` — live, línea 96 | `occ.expectedGeofenceId` — congelado, NOT NULL |
| Política | `contract.policy` — live, línea 57 | `fact.contractPolicySnapshot` — congelado, JSON |
| KML | `getKmlVersionForDate(routeId, fecha)` — live, líneas 112-116 | `occ.kml_version_id` — congelado (frecuentemente NULL) |

**`verification.ts` (motor real `verifyOccurrence`):**

| Recurso | Cómo se obtiene | Dónde sí congela |
|---|---|---|
| Geocerca | `profile.geofence!` — live, línea 811 | Escribe `expectedGeofenceId` en el hecho (línea 992) |
| Política | `contract.policy` — live, línea 700 | Escribe `contractPolicySnapshot` en el hecho (línea 1004) |
| KML | `getActiveVariantVersionsForDate` + fallback — live, líneas 819-852 | Lee `served_variant_id` pero no lo usa para re-juzgar |

El motor **escribe** los valores congelados en el hecho pero **nunca los vuelve a leer** para juzgar.

### ⚠️ Motor afectado

El motor real (`verifyOccurrence`) tiene el mismo problema estructural que el dry-run. El juicio **inicial** es fiel por construcción — en ese momento, el catálogo vivo y el valor congelado coinciden. Pero cualquier **re-juicio con `force:true`** (llamadas desde `reverify-day`, pases de exclusividad, eliminación de candidatas) evalúa contra el catálogo actual e ignorará la geocerca/política vigente al momento del hecho original. Un hecho `cumplido` puede voltearse a `no_cumplido` si la geocerca cambió.

### Datos congelados disponibles (ya están en el schema)

| Columna | Tabla | Tipo | Siempre presente |
|---|---|---|---|
| `expected_geofence_id` | `service_occurrences` | FK | NOT NULL |
| `expected_geofence_id` | `compliance_facts` | FK | NOT NULL |
| `contract_policy_snapshot` | `compliance_facts` | JSON | NOT NULL |
| `served_variant_id` | `compliance_facts` | FK | nullable |
| `kml_version_id` | `service_occurrences` | FK | **nullable** (frecuentemente NULL) |

Para geocerca y política, todo lo necesario ya está guardado. Para KML, el snapshot existe pero es poco confiable (se genera antes de que suba el KML y no captura multi-variante).

### Tamaño del arreglo

| Componente | Qué cambiar | Tamaño |
|---|---|---|
| Geocerca en dry-run | Cargar `getGeofenceById(occ.expectedGeofenceId)` en vez de `profile.geofence` | Pequeño |
| Política en dry-run | Usar `fact.contractPolicySnapshot` cuando existe | Pequeño |
| Geocerca en motor (`force`) | Idem, leer `occ.expectedGeofenceId` antes de juzgar | Pequeño, pero **requiere parada** (toca el motor) |
| KML congelado | Snapshotear variante+versión al generar ocurrencia de forma confiable | Trabajo de fondo — derive KML actual es cero, prioridad menor |

---

## Respuestas directas

### 1. ¿Por qué sale `Invalid Date`, desde cuándo, y en qué caras?

`service-detail-view.tsx` pasa por `new Date()` strings `"HH:MM"` que ya devuelve formateados `service-detail-data.ts`. El mismatch lo introdujo el commit `1c9181b` al cambiar el contrato del loader sin actualizar la vista. Afecta **cliente/planta y carrier**. J-Staff no está afectado.

### 2. ¿El dato para reproducir un hecho con fidelidad ya está guardado?

**Sí para geocerca y política.** `expected_geofence_id` y `contract_policy_snapshot` están en el schema y son NOT NULL en sus columnas principales. No se usa ningún snapshot para KML de manera confiable, pero la deriva de KML en producción es actualmente cero.

### 3. ¿Es defecto de la herramienta de comparación, o también del motor?

**De ambos.** `compare-verify-dry` ignora los valores congelados. El motor real (`verifyOccurrence`) tiene el mismo problema estructural: juzga en vivo y solo escribe snapshots después — nunca los relee para un re-juicio.

### 4. Si es de la herramienta: ¿qué tan chico es el arreglo?

El arreglo del dry-run es **pequeño**: cambiar dos líneas para leer geocerca y política desde los valores congelados de la ocurrencia/hecho. El arreglo del motor requiere **parada obligatoria** antes de tocar código — toca `verifyOccurrence` y cualquier path con `force:true`.

---

## Archivos clave

- `apps/web/src/components/service-detail-view.tsx` (líneas 6-12, formatDateTime)
- `apps/web/src/lib/service-detail-data.ts` (líneas ~303-322, campos de tiempo)
- `packages/domain/src/index.ts` (líneas 84-93, `localTimeHHMM`)
- `packages/services/src/compare-verify-dry.ts` (líneas 57, 96, 112-116)
- `packages/services/src/verification.ts` (líneas 700, 811, 819-852, 992, 1004)
- `packages/db/src/repositories/index.ts` (`getKmlVersionForDate` líneas 657-677)
- `packages/db/src/schema/index.ts` (columnas congeladas líneas 421, 426, 479, 491, 499)
