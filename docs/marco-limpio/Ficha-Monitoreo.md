# Ficha — Monitoreo (la torre)

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reemplaza la piel de** `cliente/planta/[plantId]/monitoreo` y `cliente/campus/[groupId]/monitoreo`, que ya existen.

---

## 1. Qué es esta pantalla y qué no es

La torre muestra **lo que está pasando ahora**. No emite resultados: el resultado se sella al cierre del turno.

Esa frontera es la razón de ser del diseño entero. Si una unidad que llegó a las 06:40 se lee como "cumplió" cuando el árbitro todavía no juzga, la pantalla contradice al producto.

**Consecuencia dura, del skill:** en Monitoreo **no aparece ningún color de veredicto.** Nada de verde, nada de rojo, y el ámbar solo como aviso del sistema. Todo lo demás es acero.

---

## 2. La leyenda de la torre — permanente

Debajo del encabezado, siempre visible, nunca como nota al pie:

> **Vista en vivo. El resultado se emite al cierre.**

Va en una banda con fondo tenue de acero, con un punto que pulsa a la izquierda y la hora de última actualización a la derecha. **Cambia con el estado** (ver §7).

---

## 3. Estructura

### 3.1 Encabezado
Título `Monitoreo` · línea de contexto con el turno vigente, la hora de entrada del personal y el deadline de llegada · una acción a la derecha.

### 3.2 Banda de estado — cinco cifras, todas en acero
En ruta (de cuántas) · Ya llegaron · Sin salir · Sin señal más de 15 min · Falta para el deadline.

**Ninguna lleva color de veredicto.** El ámbar aparece solo en "sin señal" y en "sin salir", como aviso del sistema, no como falta.

Las de "sin salir" y "sin señal" **nombran a los afectados** en su línea de apoyo: son lo prevenible de la pantalla.

### 3.3 El mapa — zona dominante
Ciudad insinuada, rutas como guías punteadas tenues, recorrido real en acero, unidades como puntos sobre su ruta, geocerca del destino con halo.

- La unidad sin señal reciente va **en ámbar con anillo punteado**.
- **La traza corta al entrar a la geocerca.** Nunca se dibuja movimiento posterior.
- Panel de capas con **su audiencia declarada** (`PLANTA` / `CARRIER`). Ver §6.

### 3.4 Lista lateral — el turno completo
**No solo lo que falta: las 14.** Ordenadas por llegada estimada, con las que ya llegaron arriba y marcadas.

Cada renglón: señal de estado · ruta · unidad con su etiqueta de certeza · distancia y antigüedad de señal · llegada estimada con su margen.

- Las que llegaron llevan **etiqueta de llegada en acero**: `Llegó 14:06`. Nunca verde, nunca "cumplido".
- Las que no han salido dicen **"ninguna unidad se ha movido desde el origen"** — si nadie se movió, no hay a quién asociar.
- La que perdió señal muestra `—` en su llegada estimada, con la hora de la última señal. **Nunca una hora calculada sobre datos viejos.**

### 3.5 Tira de llegadas contra el deadline
Pista horizontal con un punto por unidad, la banda de holgura al final y la marca del deadline. Los puntos dentro de la holgura van en ámbar.

Debajo, la nota de frontera: **lo estimado no es lo sellado.**

---

## 4. La certeza de la asociación — regla nueva del skill

Identificar qué unidad cubre cada ruta es una **inferencia que se está formando** mientras corre el turno.

- Cada unidad se muestra con la etiqueta **`probable`** junto a su identificador.
- Debajo de la lista, una línea declara: *"el sistema infiere qué unidad cubre cada ruta a partir de su recorrido, y esa asociación se afina conforme avanza el turno. Se confirma al cierre."*
- En el cierre del turno, la misma unidad aparece como **`confirmada`**.

**Si hoy el sistema no puede distinguir una asociación en formación de una congelada**, la torre muestra la unidad **sin etiqueta de certeza** — nunca afirmándola como confirmada.

---

## 5. Los cuatro estados de la pantalla

Es **una sola pantalla**; lo que cambia es qué ocupa el lugar del mapa.

| Estado | Leyenda | Mapa | Centro |
|---|---|---|---|
| **Turno en vuelo** | pulsa acero | completo, con unidades | lista del turno |
| **Sin turno activo** | punto quieto gris | **quieto**: ciudad, destino, rutas insinuadas | caja tranquila + próximo turno |
| **Cuenta nueva** | punto quieto | **sin mapa** | pasos hasta la primera verificación |
| **Sistema sin señal** | pulsa ámbar | **sin mapa** | la negación primero, luego el alcance |

### 5.1 Sin turno activo
*"Ninguna unidad en ruta ahora mismo. El primer turno cerró a las 06:50 y quedó sellado. El segundo abre a las 13:45."* Con dos salidas: ver el cierre, o las rutas del siguiente turno.

Debajo: próxima salida con cuenta regresiva · unidades programadas · último cierre · **señal de la flota (52/52 reportando)** — esa última confirma que el silencio es porque no toca, no porque algo falló.

### 5.2 Cuenta nueva
Cuatro pasos con los cumplidos palomeados: contrato de alta · geocerca · rutas y turnos · conexión de telemetría. *"La torre empieza a mostrar unidades en cuanto haya rutas con turno y la telemetría esté conectada."*

### 5.3 Sistema sin señal — **el más delicado**
**La negación va en el primer párrafo, antes de cualquier dato:**

> No estamos recibiendo señal desde las 04:12. **Esto no significa que las unidades no salieron.** Significa que el sistema no las está viendo.

Luego el alcance medido: última lectura con fecha completa · tiempo sin señal como duración · unidades afectadas · servicios en riesgo. Y qué pasa si se resuelve.

**Ámbar, nunca rojo.** No hay veredicto que dar.

**Sin mapa, ni siquiera con la última posición conocida:** un camión dibujado cerca de la planta se lee como "va llegando" aunque el dato sea de hace dos horas.

---

## 6. Capas y confidencialidad

Cada capa **declara su audiencia y el código la hace cumplir**. Una capa de carrier no se filtra ni se apaga en la vista de planta: **no se le manda.**

| Capa | Audiencia |
|---|---|
| Unidades en ruta | planta |
| Trazado contratado | planta |
| Sin señal reciente | planta |
| Resto de la flota | **carrier — no existe en vista de planta** |

Y la regla del Marco: **la traza corta al entrar a la geocerca.**

---

## 7. Auditoría de datos

*Requisito de PLAN-v1 §0.*

**Confirmado que existe:**
- `pickActiveShift` en `apps/web/src/lib/local-time.ts` resuelve el turno vigente.
- `shifts.startTime` da la hora de entrada; el deadline se deriva con `arrivalAnticipationMinutes` de la política.
- Telemetría por unidad con su marca de tiempo; posición y antigüedad de señal.
- `IngestHealthService.checkHeartbeat` y las alertas `heartbeat_stale` detectan la caída del archivador — base del estado §5.3.

**Respondido — investigación previa a construir:**

1. **Próximo turno.** `pickActiveShift` cubre "turno activo" pero no "cuál sigue" cuando ya pasaron todos los del día. Hay que extenderlo para el estado §5.1. *(Ya señalado en la auditoría de la ficha del inicio, #142.)*

2. **Llegada estimada (ETA).** **No existe.** No hay ningún cálculo que combine velocidad y distancia restante para proyectar una hora de llegada — el campo `speed` existe en la telemetría (`packages/db/src/schema/index.ts:507`, `:686`) pero nunca se usa con ese fin. Lo único parecido en `monitoreo-data.ts:58-60` y `:417-459` es `arrivalAt`, que es la **detección de entrada real a la geocerca** (`findGeofenceEntry`), no una proyección. **La lista se construye sin columna de estimación**, solo con distancia y antigüedad de señal, tal como anticipa esta pregunta.

3. **Sin señal por unidad.** El heartbeat existe **agregado por `carrierAccountId`** (`TelemetryRepository.latestPointAgeMinutes`, `packages/db/src/repositories/index.ts:2873`), no por unidad — confirmado. `monitoreo-data.ts` sí tiene la materia prima (`pointsByUnit`, líneas 261-332, y `currentPoint.at`, líneas 489-502) pero **nadie resta contra la hora actual** para producir una antigüedad por unidad; el único cálculo de "hace cuánto" que existe (`secondsAgo`, `monitoreo-map.tsx:239`) mide el refresco del cliente, no la señal GPS. **Hace falta construir esa resta** para la banda de estado y la marca ámbar del mapa.

4. **Certeza de la asociación.** El código ya trata esto como **binario, sin campo de confianza persistido**: mientras el turno está abierto, la asociación se recalcula en memoria en cada request (`evaluateUnitRouteMatch`, `packages/verification/src/index.ts:495`, invocado desde `monitoreo-data.ts:337-390`) y el propio código la comenta como *"provisional, no veredicto"* (línea 49). Al cerrar, la asociación se congela en `complianceFacts.observedUnitId` (`schema/index.ts:529`). **No hace falta un campo nuevo**: la etiqueta `probable` de §4 se deriva del estado del turno mismo (abierto = siempre provisional) y `confirmada` de que exista el `compliance_fact` cerrado — no de una tabla intermedia que hoy no existe.

5. **"Sin salir".** **No existe la distinción.** En `monitoreo-data.ts:518-529`, cuando no hay `match`, el único criterio es si ya pasó `windowStart` (→ `alerta`) o no (→ `programada`). "Hay candidatas pero ninguna se movió" y "no hay ninguna unidad del carrier con puntos en la ventana" colapsan en el mismo resultado. **El texto del renglón no puede afirmar "ninguna unidad se ha movido desde el origen"** hasta que se construya esa distinción — mientras tanto, el renglón usa una redacción que cubra ambos casos sin afirmar de más.

**Si un dato no existe, ese bloque no se muestra.** No se inventa el número ni se pinta un cero falso.

---

## 8. Lo que NO lleva

- **Ningún color de veredicto.** Ni verde, ni rojo, ni ámbar de resultado
- **Botones para actuar sobre la operación del carrier.** Si una unidad lleva 18 minutos sin señal, la planta llama por teléfono — el árbitro no le da instrucciones al vigilado
- **Puntajes de identificación** (candidatas, eliminaciones): eso es cocina del motor y vive del lado carrier
- **Horas estimadas calculadas sobre señal vieja**
- **Nada del recorrido posterior a la geocerca**
