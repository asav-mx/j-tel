# Ficha — Oficina del contrato

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reemplaza la piel de** `cliente/*/configuracion` y sus cinco subrutas, que ya existen (PR #116).

---

## 1. Por qué esta pantalla existe

Es donde se ve **con qué reglas juzga el árbitro**. Si esos números no son legibles para las dos partes, el resultado es una caja negra — y un árbitro cuyas reglas no se pueden leer no es un árbitro.

**Titular de la pantalla:** *"Con estas reglas se juzga."*

---

## 2. La decisión que la salva de ser un formulario

**Cada parámetro se presenta como la respuesta a una pregunta en español**, no como un campo técnico.

En vez de:
```
arrivalAnticipationMinutes    [ 15 ]
```

Se muestra:

> **15 min** · *anticipación*
> **¿A qué hora es tarde?**
> El deadline se calcula restando este tiempo a la entrada del personal. Turno de 07:00 — deadline 06:45.
> `[ Cambiar ]`

Tres columnas: **el número grande en mono acero** · **la pregunta y su explicación** · **la acción**.

Un coordinador que nunca ha visto el sistema tiene que entender con qué lo están midiendo.

---

## 3. Agrupación — por lo que deciden, no por su nombre técnico

### Cuándo se considera que llegó a tiempo
- `arrivalAnticipationMinutes` — **¿A qué hora es tarde?**
- `toleranceMinutes` — **¿Cuánto retraso se perdona?** *(llegar dentro de esta ventana sigue siendo cumplido, con motivo "tarde")*

### Cuándo hay evidencia suficiente para juzgar
- `evidenceMinCoveragePct` — **¿Cuánta señal hace falta para emitir un resultado?** *(debajo de esto queda pendiente por evidencia)*
- `evidenceMaxGapMinutes` — **¿Qué tan largo puede ser un silencio del GPS?** *(un solo hueco mayor deja el servicio sin juzgar, aunque la cobertura total alcance)*
- `evidenceMarginMinutesBefore` / `After` — **¿Qué pedazo del día se mira?**

### Cómo se calcula la ventana del servicio
*Este grupo no estaba en el mockup; salió de la auditoría. Ver §7.*

Va **colapsado por defecto**, bajo el encabezado *"Cómo se calcula la ventana de cada servicio"*, con una línea que lo resuma en español antes de abrirlo. No se esconde: se ordena.

- `windowDerivationEnabled` — **¿La ventana se deriva del historial de esta ruta, o se usa el margen fijo de siempre?** Apagado: una ruta que dura 96 minutos con margen de 60 arranca con el sistema ciego, y después se le califica el trazado completo — incluido el tramo que nunca se miró.
- `routeDurationPercentile` — **¿Quiero cubrir el día típico de esta ruta, o el día malo?** Con 90, la ventana cubre casi el peor día medido; con 50, solo el típico.
- `routeDurationMinSamples` — **¿Cuántos recorridos medidos hacen falta antes de confiarle a la historia el ancho de la ventana?** Sin este mínimo, el percentil de arriba no significa nada — van juntos.
- `windowSlackPct` — **¿Cuánto colchón le doy a un día lento?** Holgura adicional sobre la duración aprendida.
- `routeAvgSpeedKmh` — **¿A qué velocidad opera esta ruta cuando todavía no hay historia suficiente?** Solo se usa para estimar la duración de una ruta sin recorridos medidos; es recolección con paradas, no flujo libre.
- `maxWindowBeforeMinutes` — **¿Cuánto puede abrirse la ventana hacia atrás, como tope?** Salvaguarda: una medición atípica no debe abrir una ventana absurda.

### Cómo se organiza la operación
*Este grupo tampoco estaba en el mockup; sale de la misma auditoría, pero no es técnico como el anterior — se explica igual de directo que "cuánto retraso se perdona".*

- `permitirConsolidacion` — **¿Una unidad puede cubrir varias rutas del mismo turno?** El recorrido mínimo de cada ruta sigue siendo obligatorio; es la excepción para fuerza operativa, no la norma.
- `maxRouteDurationMinutes` — **¿Cuánto dura, como máximo, un recorrido?** Define si dos servicios de la misma mañana compiten por la misma unidad.

### Cuándo se cierra el turno
- `shiftEndMinutes` — **¿A qué hora se sellan los resultados?**
- Plazo del pendiente — **¿Cuánto tiempo hay para completar la evidencia?** — **valor de demostración, ver §5**

### Qué pasa con el resultado
- `enforcementRules` — **¿El resultado afecta el pago?** — **apagado, requiere acuerdo de las dos partes**

---

## 4. Estado del acuerdo — banda bajo el encabezado

> **Política v3 · vigente desde 2026-06-01**
> las dos partes la ven igual · cambiarla no reescribe hechos ya sellados

Con acceso a la historia de la política, que ya existe en `cliente/contrato/[id]/historia`.

---

## 5. Lo que no está acordado se declara

Dos valores se muestran con su botón bloqueado y su razón visible:

- **Plazo del pendiente (48 h):** *"valor de demostración: este plazo todavía no está acordado en el contrato y no produce consecuencia."* Botón: `Sin acordar`.
- **Consecuencia sobre el pago:** *"se activa solo cuando las dos partes lo acuerdan. Mientras esté apagado, el sistema informa y no descuenta."* Botón: `Requiere acuerdo`.

**Nunca un número horneado que parezca acordado.** Esta es la misma disciplina del pendiente por evidencia aplicada a la configuración.

---

## 6. Resto de la pantalla

**Qué cubre el contrato:** rutas · turnos con sus horas · geocercas · vigencia.

**Módulos:** activos y no contratados, cada uno con su estado y su requisito. Los no contratados con borde punteado — **nunca se esconden**.

**Últimos cambios a la política:** las versiones con qué cambió, y la nota: *"cada versión queda; los hechos conservan la que estaba vigente."*

**Pestañas:** Política · Rutas · Turnos · Geocercas · Historia. Las cuatro últimas ya existen como subrutas.

---

## 7. Auditoría de datos

*Requisito de PLAN-v1 §0.*

**Confirmado en `packages/domain/src/index.ts` (`contractPolicySchema`):**
`arrivalAnticipationMinutes` (15) · `toleranceMinutes` · `evidenceMinCoveragePct` (80) · `evidenceMaxGapMinutes` (10) · `evidenceMarginMinutesBefore` (60) / `After` (30) · `shiftEndMinutes` · `enforcementRules` · `windowDerivationEnabled` · `windowSlackPct` (25) · `routeDurationPercentile` (90) · `routeDurationMinSamples` (3) · `maxRouteDurationMinutes` (60) · `routeAvgSpeedKmh` (20) · `maxWindowBeforeMinutes` (360) · `permitirConsolidacion`.

**Confirmado también:** `contract_policy_history` existe con su lector (`historia-politica-data.ts`, PR #125).

**Respondido — investigación previa a construir:**

1. **Los parámetros de derivación de ventana y operación, ¿son configuración real o internos del motor?** **Los ocho son configuración real — ninguno es afinación interna del motor.** No solo por argumento de diseño: ya existe un catálogo en el propio repo, `apps/web/src/lib/perillas-contrato.ts`, que los trata como "perillas" de cara al cliente, con textos en español, categorías y riesgos — y ya están expuestos y editables en `cliente/contrato/[contractId]/page.tsx` y en `contratos-unit.tsx`. Ese catálogo ya distingue tres tipos: `decide: "ventana"` (define qué telemetría se observa — `windowDerivationEnabled`, `windowSlackPct`, `routeDurationPercentile`, `routeDurationMinSamples`, `routeAvgSpeedKmh`, `maxWindowBeforeMinutes`), `decide: "operacion"` (organiza turnos/unidades — `permitirConsolidacion`, `maxRouteDurationMinutes`) y `decide: "arbitro"` / `"consecuencia"` (mueve el veredicto directamente — el resto de los grupos de esta ficha). Esa es la distinción que preserva esta sección: los dos grupos nuevos de §3 (ventana y operación) reflejan exactamente esa clasificación existente, no una inventada para esta ficha.

2. **El plazo del pendiente, ¿existe como campo de política, o hoy está fijo en el código?** No aparece en `contractPolicySchema` (línea 374-379 y alrededores) — coherente con que la propia ficha ya lo trata en §5 como valor de demostración, sin acuerdo. Sigue siendo la decisión pendiente de PLAN-v1 §4.

3. **Quién puede cambiar qué.** Sigue pendiente de `auth-rbac`. Sin esa respuesta, la pantalla se construye en modo lectura — los botones `Cambiar` existen visualmente pero no ejecutan hasta que haya roles que los autoricen.

**Regla:** si un parámetro es interno del motor, no se muestra. Si es del contrato, se muestra aunque hoy no se pueda editar. **Con la investigación, ningún parámetro de `contractPolicySchema` cae en el primer caso.**

---

## 8. Lo que NO lleva

- **Parámetros internos del motor.** Umbrales de identificación, puntajes de candidatas, pesos de las capas: eso es cocina, no acuerdo
- **Valores fijos en el código presentados como configurables.** Si no se puede cambiar, se dice
- **Colores de veredicto.** Aquí no hay resultados: todo es acero, y el ámbar solo marca lo no acordado
