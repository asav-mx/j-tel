# Ficha de diseño — C14: la puerta sin salida de `destino_only`

**Fecha de medición: 11 de agosto de 2026** · **Alcance:** solo lectura, con
`jtel_readonly`. **No se selló nada, no se re-verificó nada, ningún hecho cambió
de versión.** Sin cuentas demo.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **Ficha de diseño, antes del código.** El arreglo cambia cómo se sella un
> hecho. **No propone valores, no toca el motor y no decide.**

---

## 1. Qué se arregla, dicho por Asav

> **Un contrato que dice «basta con llegar» y un motor que no puede decirlo.**

---

## 2. El mecanismo, leído en el código

Dos lugares, y el orden entre ellos es toda la causa:

**`servedRoute`** ([index.ts:575-580](../../packages/verification/src/index.ts)) es
quien llena `serving` — la lista de candidatas que acreditan:

```
arrivalAt !== null && (!hasKml || (observableEnough && A && B))
```

**`routeStrictness`** se lee **después**, y solo cuando `serving` ya salió vacía
([index.ts:1089](../../packages/verification/src/index.ts)):

```
if (serving.length === 0) {
  const isDestinoOnly = input.routeStrictness === "destino_only";
  if (isDestinoOnly && anyArrived) → pendiente_evidencia · llegada_sin_atribucion
```

> 🟢 **`destino_only` no abre una puerta: le pone otro nombre a la que está
> cerrada.** Elige entre `pendiente_evidencia` y `no_cumplido` **después** de que
> la atribución falló. **Lo único que apaga A∧B es `!hasKml`** — o sea un dato de
> configuración del catálogo de rutas, **no el contrato**.

🔵 Y C14 ya midió lo que eso significa: **los 48 ruta-turnos de los dos contratos
reales tienen KML activo con waypoints**, así que `!hasKml` **no se dispara nunca**
y A∧B corre siempre.

---

## 3. Lo medido hoy — y corrige el enunciado de la ficha de causas

🟢 **Hechos sellados al 11 de agosto de 2026:**

| Contrato | Estrictez | Cumplido | No cumplido | Pendiente |
|---|---|---|---|---|
| **Tecma 47** | **`destino_only`** | **92** | 309 | **103** |
| TECMA Campus | `kml_full` | 343 | 282 | 36 |

🟢 De los 103 pendientes de Planta 47, **64 son `llegada_sin_atribucion`** —eran
61 el 6 de agosto, **sigue creciendo**— y 1 es `observacion_insuficiente`.

### 3.1 La prueba de que `destino_only` está inerte, y es la distribución

⚠ **§5.1 dice «con `destino_only`, una unidad que llegó no puede salir cumplida
jamás». Eso es impreciso y hay 92 cumplidos que lo desmienten leído literal.** La
frase correcta es más estrecha y más fuerte:

🟢 **De los 92 cumplidos de Planta 47, los 92 traen cobertura de ruta ≥ 60 %.
Mínimo: 60.67 %. Mediana: 90.1 %.**

> **La distribución está truncada exactamente en el umbral.** Si la llegada
> pudiera acreditar por sí sola —que es lo que el contrato dice—, habría
> cumplidos por debajo de 60. **No hay ni uno.**
>
> 🟢 **El contrato de Planta 47 dice `destino_only` y ni uno solo de sus servicios
> cumplidos acreditó por la vía que ese contrato pactó.** Todos pasaron la vara de
> `kml_full`. **La cláusula no está floja: no existe.**

**El enunciado exacto, para que no se vuelva a citar mal:** una unidad que llegó
**y no acredita el trazado** no puede salir `cumplido` jamás — y como no hay otra
vía, **`destino_only` nunca ha acreditado a nadie por llegar.**

---

## 4. Las opciones, con veredicto

| # | Opción | Veredicto |
|---|---|---|
| 1 | **`destino_only` apaga A∧B** — `servedRoute` = llegó | ❌ **No.** Las 21 rutas de Planta 47 llegan **a la misma geocerca de planta**, así que toda unidad que llegue acreditaría **todas** las rutas del turno. No afloja la atribución: **la destruye**. Y choca con la ley del Marco *«un servicio cumplido siempre tiene unidad observada»*: habría muchas, sin forma de elegir |
| **2** | **A∧B deja de ser requisito y pasa a ser desempate** — llegar te hace elegible; el trazado decide **cuál** de las elegibles sirvió cuál ruta | ✅ **Es la forma que encaja, y usa maquinaria que ya existe.** 🟢 El **pase de exclusividad** ya está construido (`services/verification.ts:334`) y hoy quita una unidad de todas las rutas menos la de mejor match. Aquí haría exactamente el trabajo que hace falta. ⚠ **Necesita un piso**: sin él, una unidad que llegó y no manejó nada parecido a la ruta acredita por ser la menos mala del lote |
| 3 | **Identificación por capas** — seis señales que acumulan confianza y ninguna condena sola | ✅ **Es hacia donde apunta el plan** (Tramo 3 lo tiene escrito: llegada · corredor · match fino solo con densidad suficiente · huella histórica · patrón de paradas · rol declarado **opcional siempre**). ⚠ **Es mucho más grande que C14**, y la opción 2 es su primer peldaño: llegada como señal de admisión, trazado como señal de desempate |
| 4 | **No tocar el motor: pasar Planta 47 a `kml_full`** | ❌ **No, y va listada porque es la barata y por eso es la tentadora.** Hace que la configuración diga lo que el motor hace, en vez de al revés — pero **eso es decidir por el cliente qué contrató**, que es exactamente lo que C16 dice que no se puede hacer. 🟢 **Y tiene precio medido:** convertiría los **64 `llegada_sin_atribucion`** en `no_cumplido`, o sea **64 acusaciones nuevas** por un cambio de configuración que nadie pactó |

---

## 5. La frontera compartida con el piso de densidad — el argumento de las dos

**Planteado, no decidido**, porque la decisión es de Asav.

**Las dos tocan la misma línea:** qué sale como `pendiente_evidencia` y qué sale
como veredicto. Si las dos la mueven en el mismo tramo, **ninguna medición de
antes y después reparte el efecto** — es la regla del nudo aplicada a una
frontera en vez de a una expresión booleana.

### A favor de que C14 vaya primero

- **C14 es un defecto; el piso es una política nueva.** El contrato dice una cosa
  y el motor hace otra. Arreglar lo roto antes de agregar lo nuevo es el orden
  normal, y el único que deja el «después» comparable contra algo cierto.
- 🟢 **C14 vacía la pila y el piso la llena.** C14 mueve servicios **hacia fuera**
  de pendiente —los 64 `llegada_sin_atribucion` son su población, conocida y
  acotada—; el piso mueve servicios **hacia dentro**. **Si el piso va primero, el
  efecto de C14 queda enterrado bajo pendientes nuevos** y hay que medir un
  drenaje contra un tanque que se está llenando.
- 🟢 **C14 no necesita D3 y el piso sí.** Un arreglo que reduce la pila no espera
  a la regla de cierre; uno que la aumenta, sí — y D3 sigue abierta con **106
  pendientes, 89 de más de 48 h**.

### A favor de que el piso vaya primero

- **El piso ataca daño que se está emitiendo hoy.** Un `no_cumplido` sellado con
  una densidad que no alcanzaba a ver es **una acusación que la evidencia no
  sostiene** — Ley 7 rota ahora mismo. 🟢 Planta 47 tiene **309 `no_cumplido`**,
  sellados a caballo entre los dos regímenes de cadencia.
- 🔵 **Los 64 de C14 no acusan a nadie:** están en `pendiente_evidencia`, que es un
  estado honesto. **Nadie ha recibido un resultado**, así que por daño-ahora C14
  es la menos urgente de las dos.
- **Y el piso protege el arreglo de C14 de nacer mal:** si C14 admite por llegada
  y el piso no existe, se admite también donde el muestreo no daba para ver nada.

### Lo que decide entre las dos, y no está de este lado

**Ninguno de los dos argumentos gana solo: la tensión se resuelve hacia arriba.**

- Si **D3** existe, el piso deja de ser peligroso y puede ir primero.
- Si **la Planta confirma `destino_only`**, C14 deja de depender de C16 y puede ir
  primero.
- **Y hay una tercera salida que conviene tener sobre la mesa:** las dos se pueden
  hacer en el orden que sea **si el piso entra primero apagado** —construido,
  medido en seco y sin efecto— y se enciende después de C14. Eso las separa en el
  tiempo sin separarlas en el calendario, y **cada una conserva su medición.**

---

## 6. Lo que decide Asav

1. **Cuál toca la frontera primero** — con §5 enfrente.
2. **Si `destino_only` es de verdad lo que Planta 47 contrató.** Es la pregunta 1
   de la ficha de C16 vista desde el otro lado: **si la respuesta es «no», C14
   deja de ser un defecto y pasa a ser una configuración mal escrita**, y el
   arreglo es de datos y no de motor.
3. **Qué piso lleva la opción 2**, que es un valor y por lo tanto no sale de aquí.

---

## 7. La medición de antes y después

🟢 **Línea base al 11 de agosto de 2026:** Planta 47 · `destino_only` · **92
cumplido · 309 no cumplido · 103 pendiente**, de los cuales **64
`llegada_sin_atribucion`**. **Cobertura mínima entre los cumplidos: 60.67 %** —
ése es el número que tiene que bajar si el arreglo funciona, porque un cumplido
que acredite por llegada estará por debajo del umbral.

> **Y es una medición inusualmente limpia:** hoy la vía de llegada aporta **cero**
> cumplidos. Cualquier cumplido con cobertura bajo el umbral, después del arreglo,
> **solo puede venir de la puerta nueva.**

---

## 8. Lo que esta ficha NO hizo

- **No tocó el motor.** 🟢 `servedRoute` sigue intacta.
- **No dice cuántos de los 309 `no_cumplido` cambiarían.** Exige correr el motor
  con la regla nueva: **simulación**, D4 / Tramo 6.
- **No propone el piso** de la opción 2.
- **No decide el orden** de la frontera. Plantea el argumento de las dos.
