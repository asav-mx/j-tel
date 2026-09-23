# Diagnóstico · El rojo del generador era mío, y debajo hay una zona horaria suelta

**23 de septiembre de 2026.** Al correr la suite de integración mientras construía el
P3.5 reporté, en el cuerpo del PR #528, que
`packages/db/src/integration.test.ts > generateForProfile — alineación de calendario >
rango sáb-22 a lun-24 ago-2026` **fallaba también en `main`**. Asav pidió el diagnóstico.

**El diagnóstico es: la prueba está bien y `main` está verde. El rojo lo produje yo
al invocarla.** Lo que sí encontré al perseguirlo es una dependencia real de la zona
horaria de la máquina en el generador de ocurrencias, que hoy no muerde en producción
por una razón que no está escrita en ninguna parte. **Este documento no trae arreglo.**

---

## Parte 1 · De dónde salió el rojo

La suite se corre con el script del paquete:

```
"test:integration": "TZ=UTC vitest run --config vitest.integration.config.ts"
```

Yo la corrí así, para poder filtrar un archivo:

```
npx vitest run --config vitest.integration.config.ts        ← sin TZ=UTC
```

Esa es toda la diferencia. Medido, la misma prueba y el mismo commit:

| Cómo se corre | Resultado |
|---|---|
| `TZ=UTC npx vitest run … -t "rango sáb-22 a lun-24"` | ✓ pasa |
| `npx vitest run … -t "rango sáb-22 a lun-24"` (zona de la máquina: `America/Ciudad_Juarez`) | ✗ `expected '2026-08-21' to be '2026-08-24'` |

**El nombre de la prueba ya lo decía** —«(TZ=UTC simula Vercel)»— y yo lo leí como
una descripción del escenario, no como un requisito de la corrida.

### Lo que hice mal al reportarlo, por si sirve de método

Comprobé que el rojo **no era de mi rama** sustituyendo el repositorio por el de
`origin/main` y volviendo a correr. Falló igual, y de ahí concluí «es de `main`». La
comprobación era correcta y la conclusión no: probé que **mi código** no lo causaba,
no que el repo estuviera roto. Las dos cosas se parecen y no son la misma, y la
diferencia estaba en la línea que yo mismo escribí para correrla.

Ya está corregido en el cuerpo del PR #528.

---

## Parte 2 · Debajo del rojo sí hay algo

La prueba pasa en UTC y falla en `America/Ciudad_Juarez` porque el generador **decide
el rango en la zona de la máquina**, no en la zona del circuito ni en UTC.

`OccurrenceRepository`:

```ts
private startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);   // ← zona de la MÁQUINA
  return x;
}
```

y en `generateForProfile`:

```ts
const rangeStart = this.startOfDay(fromDate);
…
const startIso = start.toISOString().slice(0, 10);   // ← de vuelta a UTC
```

`setHours` interpreta en local y `toISOString` devuelve en UTC. Con un `Date` que viene
en **medianoche UTC**, las dos operaciones no se cancelan: corren el día hacia atrás.
Medido en aislamiento, sin base de datos:

```
entra                                              2026-08-22T00:00:00.000Z
startOfDay con TZ=America/Ciudad_Juarez (UTC-6)  → 2026-08-21T06:00:00.000Z → "2026-08-21"
startOfDay con TZ=UTC                            → 2026-08-22T00:00:00.000Z → "2026-08-22"
```

De ahí sale el `'2026-08-21'` de la prueba: **un viernes que nadie pidió**, dentro de
un rango que empezaba el sábado 22. `civilDatesInRange` no tiene nada que ver — es
aritmética puramente UTC anclada a mediodía, y hace bien su trabajo con lo que le den.

### Por qué casi nunca se nota

En `renewRollingWindow` hay **dos caminos** para el `from`, y sólo uno muerde:

| Camino | Cómo se arma el `from` | Con TZ local |
|---|---|---|
| Ya hay ocurrencias | `addDays(new Date("‹maxDate›T00:00:00"), 1)` — parseo **local** | El parseo local y el `startOfDay` local **se cancelan**: sale bien |
| No hay, o están atrás | `today = new Date("‹hoy›T00:00:00.000Z")` — medianoche **UTC** | Se corre **un día hacia atrás** |

O sea: el camino que muerde es el del perfil **nuevo o rezagado**, que es justo donde
menos ojos hay. Y `target` se arma con `new Date(`${targetIso}T00:00:00`)`, sin `Z`,
así que el final del rango **no** se mueve: el efecto neto es un día de más hacia
atrás, no un corrimiento del rango entero.

---

## Parte 3 · Quién corre hoy por el camino que muerde

Medido en **producción** con el usuario de sólo lectura, el 23-sep-2026:

| Lo medido | Valor |
|---|---|
| Perfiles activos con contrato vigente | **51** |
| Última `service_date` generada, en todos ellos | **2026-09-18** |
| Hoy civil en Juárez | 2026-09-23 |

**Los cinco días sin generar no son una falla: son la pausa.** Hay cuatro contratos con
evento `pausa` desde el 2026-09-18 (registrados el 19-sep), y el generador salta lo que
cae en pausa a propósito — «lo no medido durante la pausa jamás se inventa hacia atrás»
(0041). Lo digo porque un «última ocurrencia: hace cinco días» en un tablero parece una
alarma y no lo es.

Lo que sí se sigue de ese dato: como `maxDate (18-sep) < hoy`, **el `from` de la
renovación es `today`** —el `Date` de medianoche UTC— para los 51 perfiles. Es decir,
**el camino vulnerable es el que corre todos los días**, no un caso raro.

No muerde por una sola razón: **los tres llamadores viven en Vercel, que corre en UTC.**

| Quién llama al generador | Dónde corre | Zona |
|---|---|---|
| `/api/cron/renew-occurrences` | Vercel | UTC |
| `/api/occurrences/generate` | Vercel | UTC |
| `/api/cliente/servicios` (el botón «generar») | Vercel | UTC |
| `packages/db/src/seed.ts` | **la laptop de quien lo corra** | la de la máquina |

**Nada en el repo afirma que el runtime es UTC.** No hay prueba, ni variable, ni
comprobación de arranque que lo diga: es cierto porque Vercel lo hace así. El día que
algo del motor corra desde una laptop en Juárez contra una base de verdad —un guion de
una sola vez, una corrección a mano, un runtime nuevo— generaría un día de servicio que
nadie pidió, y ese día se verificaría y se sellaría como cualquier otro.

Es la misma familia del bug que esta prueba vigila: la zona horaria implícita que
produjo 294 hechos sellados a la hora equivocada.

---

## Parte 4 · Lo que NO se hace aquí, y las dos decisiones que quedan

**No se arregla nada en este PR** (Asav, 23-sep: diagnóstico primero).

**a) La valla.** Hoy la suite es correcta sólo si se invoca por su script. Cualquiera
que corra `vitest` desde el editor, desde `npx`, o desde un workflow nuevo obtiene un
rojo que parece un fallo del producto — me pasó a mí, y lo escribí en un PR. Se puede
fijar la zona en el propio `vitest.integration.config.ts` (y en el de unitarias, que
depende del mismo script), para que no exista una forma de correrla sin ella.

**b) El código.** El rango podría calcularse con **fechas civiles explícitas** de punta
a punta —`localDateIso`, `addDaysIso`, `civilDatesInRange`, que ya existen y ya son
puras— en vez de pasar por `Date` + `setHours`. Eso quitaría la dependencia de la zona
de la máquina en lugar de esconderla detrás de una variable de entorno.

Las dos son decisiones tuyas. La (a) es chica y quita el ruido; la (b) es la que quita
la trampa, y toca el generador del motor.

---

## Lo que se midió, para que se pueda repetir

- Las dos corridas de la Parte 1, con y sin `TZ=UTC`, sobre la misma rama de prueba.
- El aislamiento de `startOfDay` de la Parte 2, que no toca base de datos.
- Las tres consultas de la Parte 3, de sólo lectura, contra `DATABASE_URL_READONLY`:
  perfiles activos con su última ocurrencia, eventos de verificación por tipo, y
  ocurrencias por fecha de los últimos doce días.
