# Diagnóstico · La cadencia del árbitro, y las dos redacciones que faltaban

**19 de septiembre de 2026.** Tres respuestas a lo que quedó abierto del diagnóstico del lazo (#459), medidas en producción con el usuario de sólo lectura. **Ninguna trae arreglo.**

1. ¿Cada minuto es la cadencia correcta para un árbitro? (pregunta de Asav)
2. La redacción de la ley del árbitro que se rinde, y cómo debe plantearse `ventana_anterior_a_la_memoria`.
3. Si la entrada que cuenta intentos cambia la forma del expediente. **Sí la cambia, y hay una forma de que no.**

---

# Parte 1 · La cadencia

## Lo que el minuto compra, medido

**Ningún servicio que se pudo juzgar necesitó más de un intento.**

| Veredicto | Servicios | Intentos: mínimo | mediana | p90 | máximo |
|---|---|---|---|---|---|
| `cumplido` | 243 | 1 | **1** | 1 | 3 |
| `no_cumplido` | 138 | 1 | **1** | 1 | **1** |

381 servicios sellados en los últimos 30 días. **La mediana y el p90 son 1.** El reintento cada minuto no ha cambiado un solo veredicto: el servicio se juzga bien a la primera o no se puede juzgar. Los 4.16 millones de entradas salieron de servicios que **nunca iban a poder juzgarse**.

**Y el minuto tampoco compra tiempo.** Del vencimiento del plazo al primer sello: **mediana 12 minutos, p90 17, mínimo 10**. Ese tiempo es la gracia de verificación de la política del contrato, no la cadencia del cron. Pasar de un minuto a cinco le sumaría, en el peor caso, **cuatro minutos a una espera de doce**.

**Nadie lo notaría, y se puede demostrar:** el único consumidor de un veredicto nuevo es `/api/cron/alertas`, que corre **cada 5 minutos**. Un veredicto sellado más fino que eso se queda esperando igual.

## Reintentar más seguido que la fuente más lenta no puede encontrar nada

| Fuente de evidencia | Cada cuánto |
|---|---|
| recolector (`/api/cron/collect`) | 1 min |
| archivador (`/api/cron/archive`) | 10 min |
| relleno de huecos (`/api/cron/gap-backfill`) | **1 hora** |
| **verificación** (`/api/cron/verify`) | **1 min** |

El motor pregunta por evidencia **sesenta veces por cada vez que el relleno de huecos pudo haberla traído**. Cincuenta y nueve de esas sesenta preguntas tienen la respuesta garantizada de antemano.

## Las pasadas se enciman Y se pierden: el motor está saturado

Huecos entre sellos consecutivos del mismo servicio, últimas 36 h (639 906 parejas):

- mediana **59 s**, p90 **117 s**
- **262 035 a menos de 45 s** (41 %) → dos pasadas vivas a la vez
- **143 357 a más de 90 s** (22 %) → una pasada se saltó ese servicio

Las dos cosas a la vez dicen lo mismo: **una pasada tarda aproximadamente lo que dura el intervalo**, así que oscila entre encimarse y quedarse corta. Con 365 atorados en la cola, recorrerla no cabe en 60 segundos.

**El lazo causó el encimamiento.** Con la cola sana —**~51 servicios al día** cuyo plazo vence— una pasada terminaría en segundos y el encimamiento sería raro. Pero *raro* no es *imposible*, y ésa es la pregunta de diseño.

## ¿Pueden dos pasadas encimarse por diseño? Sí, y nada lo impide

Vercel dispara el cron cada minuto **sin preguntar si la pasada anterior terminó**, y `processPending` no toma ninguna llave: ni por corrida ni por ocurrencia. **Que hoy no se encimen sería una consecuencia del tamaño de la cola, no una garantía.**

Y con el arranque del 28 la cola crece: 8 unidades, un circuito, y cada unidad sin señal es un servicio que entra.

## Lo que propongo discutir (no decido)

- **Bajar la cadencia a 5 minutos**, alineada con el único consumidor. Cuesta, en el peor caso, 4 minutos sobre una espera de 12. Reduce el trabajo del motor a la quinta parte sin cambiar un veredicto.
- **Una llave que haga imposible el encimamiento**, independientemente de la cadencia. Son dos decisiones distintas: bajar la cadencia hace el choque *improbable*; la llave lo hace *imposible*. Con el arranque encima, la segunda vale más que la primera.
- **Separar «vencer» de «reintentar».** Hoy la misma pasada hace las dos cosas a la misma frecuencia. Un servicio que acaba de vencer merece atención pronta; uno que lleva 900 intentos sin evidencia no merece la misma. No es lo mismo un árbitro atento que un árbitro nervioso.

---

# Parte 2 · Las dos redacciones

## 2a · El árbitro puede cerrar sin pruebas — propuesta de afirmación para el Marco

> **El árbitro puede cerrar un caso sin pruebas, y cerrarlo es parte de juzgar.** Cuando el plazo venció y la evidencia no llegó en un tiempo razonable, el sistema sella **«sin evidencia posible»** y deja de preguntar. Un árbitro que no puede cerrar un caso sin pruebas nunca se va del estadio.
>
> **Cerrar no es condenar.** El veredicto sigue siendo `pendiente_evidencia`: sin evidencia no es incumplimiento, y esta afirmación no crea un cuarto veredicto. Lo que se cierra es **la espera**, no el juicio.
>
> **Y es reversible, por eso se puede cerrar tranquilo.** Si mañana aparece la evidencia —un relleno de huecos, un archivador que se puso al día, una re-verificación pedida por una persona— el caso se vuelve a abrir y se juzga. Cerrar sin pruebas es dejar de preguntar, no borrar la pregunta.
>
> **Lo que se cierra queda dicho, con su razón y su cuenta.** En el expediente consta qué se intentó, cuántas veces, desde cuándo y hasta cuándo, y por qué se dejó de intentar. Un cierre callado sería indistinguible de un olvido.

Si Asav la ratifica, entra como afirmación de la pieza que gobierna la verificación, y `sin-evidencia-posible.ts` pasa de ser una defensa contra un lazo a ser la implementación de una ley.

## 2b · `ventana_anterior_a_la_memoria` está mal planteada, y la pregunta correcta ya se está haciendo

**Cómo está hoy:** compara el fin de la ventana contra `min(recorded_at)` de **toda la historia** del transportista. Medido: el primer punto de `juarez-bus` es del **28 de junio**, así que para cualquier ventana de septiembre la regla **nunca puede dispararse**. Un solo punto viejo, de cualquier origen, la mata para siempre.

**La pregunta correcta no es cuándo empieza la historia del transportista. Es si esta ventana todavía puede recibir algo.**

Y aquí está lo bueno: **esa pregunta ya se hace, en la misma función, dos líneas antes.** `motivoSinEvidencia` compara el fin de la ventana contra **la marca de agua del archivador** —hasta qué instante tiene dato guardado ese transportista— y distingue dos cosas que hoy se ven iguales:

- `memoria_no_alcanza` — el archivador todavía no llega a esa ventana. **Se resuelve con tiempo: hay que esperar.**
- `sin_senal` — **el archivador ya pasó de largo esa ventana y no dejó ni un punto.**

`sin_senal` es, literalmente, la afirmación que la regla necesita: *esta ventana ya se cerró vacía*. El motor la calcula, la guarda en el ledger y se la enseña a J-Staff — y **no la conecta con el freno**.

**Propuesta de redacción de la regla:**

> Un servicio deja de esperar evidencia cuando se cumplen las dos:
>
> 1. **la ventana ya se cerró vacía** — el archivador tiene dato de ese transportista **más nuevo que el fin de la ventana**, y dentro de la ventana no hay ni un punto (`motivoSinEvidencia === "sin_senal"`); y
> 2. lleva al menos N intentos, para que un fallo pasajero no lo retire.
>
> El plazo de 14 días se queda como **segunda razón independiente**, para el caso en que no haya marca de agua con la cual afirmar nada. Sin marca de agua no se retira por esta vía: **la ausencia declarada vale más que una causa verosímil.**

Lo que esto cambia, medido: hoy **365 servicios atorados y el freno alcanza a 0**. Con la regla replanteada, los que el archivador ya rebasó se retirarían **en la siguiente pasada**, sin esperar catorce días.

---

# Parte 3 · La entrada que cuenta intentos SÍ toca el expediente

**Y toca justo la parte frágil.** `ledger_entries` **no tiene `factId`** — es deuda conocida y está anotada en `docs/DESPUES.md` («El ledger debe colgar del hecho»). Por eso, para saber qué entrada produjo el veredicto vigente, `ledger-pairing.ts` empareja **por fecha**, con diez minutos de tolerancia, y ante la duda **no empareja**: prefiere un hueco honesto a una cifra de la corrida equivocada.

Una entrada que se **reescribe** para incrementar un contador rompe dos cosas:

1. **El emparejamiento por fecha.** Una entrada que nació el 7 de septiembre y se sigue tocando el 19 ya no representa «la corrida que produjo este hecho». El acta empezaría a no emparejar —o peor, a emparejar mal.
2. **El principio de la casa.** «Los cambios son eventos, no reemplazos»: el expediente versiona, la corrección apila, la baja marca sin borrar. Un renglón del ledger que se reescribe cada minuto es exactamente lo contrario, y en la tabla que existe para ser la historia.

## La forma que no lo rompe

**El contador no es una entrada del ledger: es estado del viaje.**

```
trips
  intentos_de_verificacion   INTEGER NOT NULL DEFAULT 0
  primer_intento_at          TIMESTAMPTZ
  ultimo_intento_at          TIMESTAMPTZ
```

El estado vive donde vive el estado, y se actualiza sin reescribir historia porque **nunca fue historia**. Y el ledger recibe **una sola entrada, cuando la espera se cierra** — que ya existe, ya se llama `sin_evidencia_posible` y ya carga `intentosPrevios`. Bastaría con que además lleve las dos fechas.

Así se conserva exactamente lo que Asav pidió —«se intentó 17 280 veces, desde tal fecha hasta tal fecha»— **sin un solo renglón de más**, sin reescribir ninguno, y sin tocar el emparejamiento.

**Lo que sí hay que decidir:** si el sello que no cambia nada deja de escribirse, el acta pierde la línea «se volvió a intentar y seguía sin haber nada». Con esta forma esa línea existe **una vez**, al cerrar, con su cuenta y sus dos fechas. Es menos, y es lo que pasó.
