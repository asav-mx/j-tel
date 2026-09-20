# Diagnóstico · El motor re-verifica para siempre (19 de septiembre de 2026)

**Qué se midió.** 4 163 318 entradas de `verificacion_automatica` en 1 008 servicios en los últimos 30 días. Las peores: **17 637 entradas en un solo servicio**, del 7-sep 11:50 al 19-sep 18:41. Todo medido en producción con el usuario de sólo lectura `jtel_readonly`; este documento no cambió nada.

**La conclusión, en una línea.** No es un lazo: **son dos**, y el segundo esconde al primero. El primero es de diseño —la cola readmite al servicio que no encuentra evidencia y nada lo retira a tiempo—; el segundo es un defecto —**dos pasadas del cron corriendo a la vez sobre el mismo servicio**, donde la que pierde revienta.

**La lentitud de Servicios especiales es el síntoma.** Optimizar esa consulta habría tapado esto exactamente como Asav dijo.

---

## 1 · El lazo grande: la cola readmite y nadie retira

### Cómo entra, y por qué vuelve a entrar

`condicionesDeCola` (`packages/db/src/repositories/index.ts`) admite dos casos:

```
1) nunca verificado                        → complianceFacts.id IS NULL
2) pendiente por evidencia con GPS caído   → status = 'pendiente_evidencia'
                                             AND trips.evidence_status = 'indisponible'
```

El caso (2) es un **reintento por diseño**: se puso para que un servicio se re-juzgue cuando la memoria propia se ponga al día. Pero **la condición de salida es que aparezca evidencia**, y si la evidencia no va a aparecer nunca, el servicio cumple la condición de entrada para siempre.

El cron `/api/cron/verify` corre **cada minuto** (`apps/web/vercel.json`, `* * * * *`). Cada pasada escribe **una entrada de `verificacion_automatica` sin condición**: no hay ninguna comprobación de «si nada cambió, no escribas».

**Una entrada por servicio por minuto.** 12 días × 1 440 = 17 280, contra las 17 637 medidas. Cuadra.

### El freno existe, y no puede engancharse

`sin-evidencia-posible.ts` se escribió en agosto **para exactamente este problema** (cinco servicios de junio con 31 400 verificaciones cada uno). Retira un servicio de la cola si lleva ≥30 intentos **y** se cumple una de dos razones:

| Razón | Qué exige | Qué se midió |
|---|---|---|
| `ventana_anterior_a_la_memoria` | que la ventana termine **antes** del primer punto de telemetría del transportista | el primer punto de `juarez-bus` es del **28 de junio**. Todas estas ventanas son de septiembre. **Nunca puede dispararse.** |
| `plazo_vencido_sin_evidencia` | más de **14 días** desde el fin de la ventana | la más vieja lleva **13 días**. **Todavía no llega.** |

La primera razón mira `getMemoryHorizon`, que es `min(recorded_at)` de **todos** los puntos del transportista, sin distinguir de dónde vinieron. Mientras el transportista tenga un punto viejo de cualquier origen, la regla está muerta para todo lo nuevo. En junio funcionó porque entonces ese mínimo era reciente.

**Medido:** `sin_evidencia_posible` se ha escrito **5 veces en toda la historia de la base**, las cinco el 3 de agosto. Desde entonces, ninguna.

Hoy hay **365 servicios** en el estado que readmite, con ventanas del 7 al 17 de septiembre, y **ninguno ha pasado los 14 días**.

### Por qué empieza el 7 de septiembre

Umbrella cortó el 5. Las ventanas de evidencia de los servicios atorados van del **7 al 17 de septiembre** — todas posteriores al corte. Sin proveedor y sin memoria propia para esas unidades, el motor pide evidencia, no la encuentra, deja el veredicto en `pendiente_evidencia`, marca la evidencia `indisponible`, y el servicio vuelve a la cola el minuto siguiente. Los ocho peores son **todos de `tecma` / `juarez-bus`**.

**El veredicto nunca fue el problema:** `pendiente_evidencia` es la respuesta correcta. Sin evidencia no es incumplimiento. Lo que falla es que **preguntar otra vez cada minuto no cambia la respuesta** y nadie lo detiene.

---

## 2 · El lazo chico: dos pasadas a la vez, y la que pierde revienta

### Lo medido

- `verificacion_fallida`: **13 881 entradas en 412 servicios**. De ellas, **13 702 con el mismo error**: `Cannot read properties of undefined (reading 'status')`.
- **El 100 % de los fallos tiene un `verificacion_automatica` exitoso de la MISMA ocurrencia a una distancia promedio de 0.0 segundos.** No a 20 s: a cero. Los dos ocurren a la vez.
- Sellos consecutivos de la misma ocurrencia: mediana 58 s, **mínimo 0 s**, y el **41 %** a menos de 45 s. Las pasadas se enciman.
- En seis horas no hay **un solo hueco de 20 segundos** entre sellos: el motor no descansa nunca.

### Por qué revienta

Una pasada que re-juzga un servicio pendiente **borra el hecho y vuelve a insertarlo** (`deleteFactForOccurrence` → `saveFact`). Y `saveFact` termina así:

```ts
const [fact] = await this.db
  .insert(complianceFacts)
  .values(data)
  .onConflictDoNothing()     // ← si ya hay fila, no inserta y no devuelve nada
  .returning();
return fact!;                // ← la afirmación de que nunca es undefined
```

`compliance_facts.service_occurrence_id` es **único**. Con dos pasadas encima del mismo servicio: la primera borra e inserta; la segunda borra (ya no hay nada), inserta, **choca contra la fila de la primera**, `onConflictDoNothing` no devuelve ninguna fila, `fact` es `undefined`, y el `!` lo deja pasar. Unas líneas después se lee `fact.status` — y ése es, textualmente, el error medido 13 702 veces.

El `!` no es un descuido de tipos: es la única línea del camino que afirma algo que la base no garantiza.

**Consecuencia medida:** los 412 servicios que fallan **sí tienen su hecho** (`pendiente_evidencia`, los 412). No se quedaron sin veredicto — se quedaron con el de la pasada que ganó. El daño no es un servicio sin juzgar: es ruido, trabajo doble y un `catch` que escribe otra entrada de ledger por cada choque.

### Y explica el tercer número

`recuperacion_tardia`: 19 199 entradas en 360 servicios, 53 por servicio. Esa nota se escribe cuando `esPrimerVeredicto`, que es `!occurrence.complianceFact`. En la carrera, **una de las dos pasadas lee la ocurrencia justo después de que la otra borró el hecho** y la ve como primer veredicto. Mismo origen, mismo remedio. *(Esto es la explicación más probable del número, no una medición directa — se confirma con el arreglo.)*

---

## 3 · Por qué se detuvo hoy a las 18:41, y por qué eso no es una buena noticia

| Evento | Registrado |
|---|---|
| pausa · prueba-real | 19-sep **18:38** |
| pausa · honeywell | 19-sep **18:39** |
| pausa · tecma | 19-sep **18:40** y **18:41** |

La última `verificacion_automatica` es de las **18:41**. El ritmo venía en ~21 900 entradas por hora, estable, durante días.

**Lo paró la pausa de los contratos, que se registró por otra razón.** `fueraPorPausa` saca de la cola todo lo de un contrato en pausa, incluidos los pendientes viejos. El defecto está intacto: **vuelve solo en cuanto se reanude cualquiera de esos contratos**, y le va a pasar igual a los contratos del piloto cuando el circuito arranque y una unidad no reporte.

**Una consecuencia que conviene conocer antes de reanudar:** los 365 atorados ya llevan ≥30 intentos. Si se reanuda **después** de que cada uno cumpla 14 días desde su ventana (del 21-sep en adelante), el freno los retira **en la primera pasada**. Reanudar antes de esa fecha los devuelve al lazo.

---

## 4 · Lo que NO se tocó

- **No se borró ni una entrada del ledger.** Los 4.16 millones siguen ahí. Son hechos, y son la evidencia de este diagnóstico.
- **No se cambió ningún veredicto.**
- **No se escribió una línea de código.** El arreglo se discute después de esto, como pidió Asav.

---

## 5 · Las preguntas que el arreglo tiene que contestar (no las contesto solo)

1. **¿Se escribe al ledger cuando nada cambió?** Hoy sí, una vez por minuto por servicio. Si se deja de escribir, se pierde «lo volví a intentar y seguía sin haber nada»; si se sigue escribiendo, vuelven los millones. La tercera vía —una entrada que **cuenta intentos** en vez de una por intento— cambia la forma del ledger, y eso toca el expediente.
2. **¿Cuál es el intervalo correcto del reintento?** Cada minuto no tiene justificación: la evidencia llega por el recolector (30 s) o por el relleno de huecos (cada hora). Reintentar más seguido que la fuente más lenta no puede encontrar nada nuevo.
3. **¿El horizonte de memoria debe mirar sólo la telemetría propia?** Hoy mira todos los puntos, y por eso la primera razón del freno está muerta para cualquier transportista con historia vieja.
4. **¿Dos pasadas pueden correr a la vez?** Hoy sí, y el 41 % lo hace. Se arregla con una llave (un candado por ocurrencia o por corrida) o haciendo que borrar e insertar el hecho sea una sola operación atómica. **Son dos arreglos distintos y conviene no confundirlos.**
5. **¿Qué pasa con `return fact!`?** La afirmación es falsa y el tipo lo sabía. Aquí se decide si `saveFact` devuelve `null` y quien llama lo maneja, o si el conflicto deja de ser posible.

---

## 6 · Cómo volver a medir esto

`docs/correcciones/2026-09-19-medir-lazo-de-reverificacion.sql` — de sólo lectura, para correr en Neon. Los mismos seis números de este documento, para poder comprobar que el arreglo los movió.
