# Ficha de Handoff — Evidencia de llegada y mapa de calibración extendido

**Repo:** j-tel — este archivo: `docs/Ficha-Handoff-Evidencia-Llegada.md`. Entra por PR.  
**Fecha:** 13 de julio de 2026  
**Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` (en `docs/marco-limpio/`) es la única fuente de verdad. Donde esta ficha y el Marco choquen, **gana el Marco**.

---

## El problema

En los dudosos del campus, el trazo GPS “se corta” antes de la planta y el operador no puede determinar a qué destino llegó la unidad (Santos Dumont u otra planta de otro contrato del mismo carrier). Diagnóstico confirmado en el repo — son **tres capas**:

1. **Dato:** el archivador guarda GPS continuo por carrier (watermarks). La llegada casi seguro sí existe en la tabla de telemetría. No hay que traer datos nuevos de Umbrella para el pasado reciente, salvo huecos (gap-backfill ya existe).
2. **Veredicto:** `computeEvidenceWindow` = deadline − margenAntes … deadline + gracia + margenDespués. El contrato del campus tiene `margenDespués = 0`, así que el árbitro nunca ve la llegada tardía. Es **configuración**, no bug.
3. **Vista:** el mapa de dudosos (`apps/web/src/app/carrier/servicio/[id]/page.tsx`) carga telemetría solo entre `evidenceWindowStart` y `evidenceWindowEnd`, y `clipTrackToRoute` recorta el trazo al corredor del KML (0.75 km). El tramo hacia la planta desaparece de pantalla aunque exista en la base.

---

## Tarea 1 (sin código) — Corregir la política del campus

**Asav** lo hace desde la UI (Contratos → Ver/editar política), no Cursor:

- `evidenceMarginMinutesAfter`: **0 → 30**

Aplica solo **hacia adelante** (ley de hechos congelados). Los días pasados no se reverifican salvo orden explícita de Asav vía la herramienta J-Staff.

---

## Tarea 2 (código) — Mapa de calibración extendido en dudosos

**Rama sugerida:** `feat/carrier-mapa-calibracion-extendido`  
(en cloud agent: `cursor/carrier-mapa-calibracion-extendido-8dc2`)

**Alcance:** solo lectura, solo cara del carrier. No toca el motor, no toca `saveFact`, no toca hechos.

### Regla transversal — la evidencia mostrada termina en la llegada (todas las caras)

El Marco define la geocerca como “la frontera física y de evidencia de un lugar”. Por lo tanto, en todo mapa de evidencia (cara cliente y cara carrier), cuando el hecho tiene `observedArrivalAt`, el trazo dibujado se **corta en la llegada**. Lo que la unidad hizo después de cruzar la geocerca es operación interna del carrier y **NO se muestra** — ni al cliente (ley: jamás ve la operación interna del carrier) ni como ruido en el detalle. Esto aplica a **cumplido** y a **no_cumplido tarde** (que también tienen llegada). Es un **corte de pantalla**: el árbitro sigue guardando y usando la ventana completa por dentro; la telemetría archivada no se toca.

La ventana extendida de los puntos siguientes aplica **ÚNICAMENTE** a dudosos sin unidad observada (`observedUnitId = null`) — que por definición no tienen llegada donde cortar:

- **Ventana extendida de visualización:** en el detalle de un dudoso, cargar telemetría de las unidades sugeridas desde `evidenceWindowStart` hasta `deadline + gracia + max(60, margenDespués)` minutos. Esta ventana es de **pantalla**, no del veredicto. Etiquetarla en la UI: *«vista extendida de calibración — no afecta el veredicto»*.
- **Toggle «recorrido completo»:** apagar el recorte de `clipTrackToRoute` para ver el trazo entero (con downsample para no matar el navegador). Default: recortado; un clic: completo.
- **Geocercas del carrier:** dibujar en el mapa las geocercas destino de **todos** los contratos de ese carrier (solo los suyos), cada una con su nombre (ej. «Campus Santos Dumont», «Honeywell MX07»). Así el operador ve a qué planta entró la unidad.

**Ley de visibilidad:** esto vive únicamente en la cara del carrier. El cliente/planta jamás ve geocercas ni razonamiento de otros contratos. Nunca mostrar contratos de carriers ajenos.

- **Marcador de llegada (visual):** si el trazo extendido entra a alguna geocerca, marcar el punto y la hora en el mapa, y **cortar el trazo ahí mismo** (misma regla transversal: la evidencia mostrada termina al cruzar la frontera). Es información de pantalla; **no escribe llegada al hecho ni al veredicto**.

### Pruebas mínimas (Tarea 2)

1. Servicio cumplido con llegada a las 06:52 y margen después de 30 min → el mapa (cliente y carrier) dibuja el trazo solo hasta las 06:52; los puntos posteriores existen en la base pero no se dibujan.
2. `no_cumplido` tarde con unidad y llegada → mismo corte en la llegada.
3. Dudoso cuyo GPS entra a la geocerca del contrato 5 min después del fin de ventana → el marcador aparece en la vista extendida, el trazo se corta en la entrada; el hecho no cambia.
4. Dudoso cuyo GPS entra a la geocerca de OTRO contrato del mismo carrier → se ve esa geocerca con su nombre, trazo cortado en la entrada; el hecho no cambia.
5. La cara del cliente para ese mismo servicio no muestra nada nuevo (tres estados intactos).
6. Toggle apagado/encendido no altera datos, solo lo dibujado.

---

## Tarea 3 (motor — 🛑 PUNTO DE PARADA OBLIGATORIO)

**No escribir código de esta tarea sin visto bueno de Asav.**

**Pregunta de diseño:** cuando el motor detecta que la unidad llegó a la geocerca después del fin de ventana (dentro de la vista extendida), ¿debe registrarse en el ledger como contexto (*«llegada detectada fuera de ventana a las HH:MM»*), sin tocar el veredicto?

Antes de tocar el árbitro, presentar a Asav en español simple:

- **(a)** qué se escribiría exactamente al ledger y cuándo,
- **(b)** confirmación de que el veredicto y los tres estados no cambian,
- **(c)** 2 ejemplos con residuales reales del 9–10 jul.

**Razonamiento Marco:** el hecho se calcula una vez y se congela; el razonamiento fino vive en el ledger. Contexto adicional en el ledger es compatible; cambiar el veredicto no lo es.

---

## Tarea 4 (código, solo lectura) — Motivo del `no_cumplido`: «tarde» vs «sin servicio»

**Rama sugerida:** `feat/motivo-no-cumplido`  
(en cloud agent: `cursor/motivo-no-cumplido-8dc2`)

**Contexto de Marco:** los tres estados de cara al cliente son ley — **NO** se crea un cuarto estado. Pero un `no_cumplido` tiene dos motivos muy distintos, y el hecho ya los distingue por dentro:

| Motivo | Cómo se ve en el hecho (ya existe) |
|--------|-------------------------------------|
| Se hizo pero tarde | `observedUnitId` con unidad, `observedArrivalAt` con hora, `timing = tarde` |
| No se detectó servicio | `observedUnitId = null`, `timing = null`, razón en ledger (`ninguna_unidad_coincidio_ruta` / `ninguna_unidad_sirvio`) |

Esta distinción importa para enforcement (el contrato Honeywell distingue retraso vs «No Show») y para el trabajo del carrier. No hay que cambiar el motor ni el hecho — solo **leer** lo que ya está guardado y mostrarlo.

### Alcance

- **Cara del carrier — separar los rojos:** en el filtro «Dudosos» del cumplimiento carrier, dividir en dos vistas:
  - **«Tarde»** (`no_cumplido` con `observedUnitId` presente): unidad y llegada ya identificadas. No requieren etiquetado — **no son dudosos**.
  - **«Sin servicio detectado»** (`no_cumplido` con `observedUnitId = null`): estos son los dudosos reales, los únicos que van al flujo de etiquetado/calibración.

- **Detalle del servicio (carrier y cliente):** bajo el chip rojo `no_cumplido`, una línea de detalle leída del hecho: *«Llegada tarde (+N min, unidad X)»* o *«Sin servicio detectado en la ventana»*. El chip no cambia; los tres estados quedan intactos. Este detalle es lectura del hecho ya congelado — nunca se recalcula en pantalla.

- **Reportes:** donde el reporte ya incluye `timing`, asegurar que los `no_cumplido` sin unidad salgan como «sin servicio» (columna motivo), porque el enforcement por contrato puede penalizarlos distinto.

### Pruebas mínimas (Tarea 4)

1. `no_cumplido` con unidad y `timing=tarde` → aparece en vista «Tarde», con «+N min» y unidad; no aparece en el flujo de etiquetado.
2. `no_cumplido` sin unidad → aparece en «Sin servicio detectado» y sí ofrece etiquetado.
3. El cliente ve exactamente los mismos tres estados de siempre; solo cambia la línea de detalle bajo el veredicto.
4. Ningún cambio en `saveFact`, en el motor, ni en hechos existentes.

---

## Reglas de trabajo

- Una rama por tarea; todo por PR; nunca directo a `main`.
- Checks en verde o no hay merge.
- Modo **«avanza y detente»**: parar en el punto marcado de la Tarea 3 y ante cualquier ambigüedad contra el Marco.

## Prohibido

- Escribir en `saveFact` o alterar veredictos desde cualquier parte de estas tareas.
- Exponer al cliente/planta geocercas, candidatas o razonamiento del carrier.
- Mostrar en cualquier cara lo que la unidad hizo después de la llegada registrada — la geocerca es la frontera de evidencia. Se guarda todo por dentro; no se dibuja.
- Estados nuevos de cara al cliente: solo `cumplido` / `no_cumplido` / `pendiente_evidencia`.
- Reverificar días pasados como efecto colateral. Solo la herramienta J-Staff, solo a petición de Asav.
