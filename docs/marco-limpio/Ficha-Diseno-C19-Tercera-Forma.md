# Ficha de diseño — La tercera forma: que la atribución descanse en B

**Fecha de medición: 12 de agosto de 2026** · **Alcance:** solo lectura, con
`jtel_readonly`. **No se selló nada, no se re-verificó nada.** Sin cuentas demo.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **Ficha de diseño. No decide, no toca el motor y no propone valores.** Es la
> única forma que satisface los dos criterios a la vez —*el veredicto no depende
> del aparato* y *no se pierde la atribución*—, así que se pone completa antes de
> decidir.

---

## 1. Primero: la forma que propuse antes NO sirve, y lo dice la medición

En la ficha de C19 escribí que la salida podía ser **«B como piso adicional, no
como reemplazo»**. 🟢 **Medido el 12 de agosto: eso es exactamente lo que `A∧B`
hace ya, y no compra nada.**

| Peldaño | A ponderada | B corredor | **A∧B (la compuerta)** |
|---|---|---|---|
| 1 punto / 60 s | 86 % | **96 %** | **88 %** |
| 1 punto / 120 s | 36 % | **95 %** | **53 %** |

> **La conjunción hereda la fragilidad de A**, que es lo que una conjunción hace.
> Sumarle a B un papel que ya tiene no cambia quién se rompe primero. **La idea
> era mía y la medición la tumbó en una corrida.**

---

## 2. Lo que la medición sí encontró, y era al revés de lo que temíamos

El argumento que descartó «mover el peso a B» era: **«dos rutas que comparten
avenida comparten corredor, así que B no sabe decir CUÁL ruta se sirvió».**
Sonaba sólido. **Se midió, y es falso en esta flota.**

**Método:** sobre las candidatas que **hoy acreditan A∧B en la ruta de su
ocurrencia**, se calcula A y B **contra todos los trazados del contrato** y se
mira en qué posición queda la ruta verdadera.

| | Planta 47 · 21 trazados | Campus · 27 trazados |
|---|---|---|
| Candidatas evaluadas | 105 | 139 |
| **A ponderada** la deja 1.ª | 96 (**91 %**) | 127 (**91 %**) |
| **B corredor** la deja 1.ª | **102 (97 %)** | **137 (99 %)** |
| Rutas que empatan con la propia (±5 pts de B) | **0.1** | **0.0** |

> 🟢 **B no solo aguanta la densidad: identifica la ruta MEJOR que A**, en los dos
> contratos, y **los empates prácticamente no existen**. La avenida compartida
> resultó no ser el problema que parecía — porque **B castiga los puntos que caen
> fuera del corredor de esa ruta**, y una unidad que sirve otra ruta acumula
> muchos.

⚠ **El sesgo de esta medición, que hay que decir antes de que alguien la use de
más:** está hecha **sobre las candidatas que ya acreditan**, o sea **los casos
fáciles**. Dice que **B no pierde atribución donde hoy se resuelve bien**. **No
dice** que resuelva los difíciles —los 87 `llegada_sin_atribucion` son
exactamente los que no acreditan— y averiguarlo es **simulación**: D4 / Tramo 6.

---

## 3. Y la objeción que sigue en pie, que es la que da la forma

🟢 **B mide precisión, no cobertura.** Una unidad que recorre **el 10 % de la
ruta perfectamente** y se va tiene **B alto y A bajo**. Si B decidiera sola,
**acreditaría**.

**Eso no lo arregla ninguna ponderación, y es justo lo que A protege.** Así que
la tercera forma **no es cambiar A por B**: es **repartir las dos preguntas que
hoy están mezcladas en un solo `∧`.**

| La pregunta | Hoy | En la tercera forma | Por qué |
|---|---|---|---|
| **¿Cuál ruta sirvió?** | A y B mezcladas | **B** | 🟢 Robusta a la densidad (93–96 %) y mejor discriminando (97–99 %) |
| **¿Cubrió bastante de esa ruta?** | A | **A**, pero **solo se exige cuando la densidad da para medirla** | 🟢 A es frágil (36 % a 120 s), y el **piso** protege exactamente ese término |
| **¿Cuánto de la ruta hizo?** | se lee de A | **A llana y A ponderada, siempre en el expediente** | Es C17: la que decide y la que se lee, cada una con su nombre |

> **La forma corta:** **B atribuye, A exige, y el piso decide cuándo A tiene
> derecho a opinar.** Hoy A hace las tres cosas y por eso el aparato mueve el
> veredicto.

**Y esto explica por qué el piso solo no alcanzaba:** el piso protege a A, pero
mientras A también atribuya, **su fragilidad se contagia a la atribución**. Al
separarlas, el piso protege un término que ya no decide quién fue.

---

## 4. Qué toca del nudo, y por qué no cabe en un PR

🟢 **`servedRoute` tiene cinco términos y esta forma toca dos**:
`routeMatchPct >= minKmlPct` **y** `corridorPrecisionPct >= minCorridorPct` — el
primero cambia de papel y el segundo pasa a mandar.

> **Es el cambio más grande que se le puede hacer a esa expresión**, y la regla
> del nudo dice que **dos términos en el mismo PR hacen inatribuible el
> resultado**. **No cabe en uno.** Cómo se parte no se decide aquí, pero la
> partición existe y hay que nombrarla al aprobarla.

⚠ **Y no puede compartir tramo con C14**, que también reescribe cuándo `serving`
sale vacía.

---

## 5. Lo que decide Asav

1. **Si se separan las dos preguntas** —atribución y cobertura— o el árbitro sigue
   contestándolas con una sola expresión.
2. **Con qué margen atribuye B**: hoy los empates son 0.0–0.1, pero **un margen
   sin medir es un umbral escondido**.
3. **Qué pasa con los casos difíciles**: esta medición no los cubre y **solo la
   simulación (D4) puede decirlo**.

---

## 6. La medición de antes y después que esto exigirá

Ya existe: `medir-efecto-densidad` mide **las tres métricas y la compuerta** con
comparación pareada. **La línea base del 12 de agosto** queda fijada así —
candidatas que acreditan la compuerta A∧B parcial:

| | Planta 47 (A 60 · B 60) | Campus (A 60 · B 50 *configurado*) | Campus (A 60 · **B 60 pactado**) |
|---|---|---|---|
| Acreditan | **105** | **163** | **139** |
| Conserva a 60 s | 89 % | 88 % | 88 % |
| Conserva a 120 s | 39 % | 51 % | 53 % |

---

## 7. Lo que esta ficha NO hizo

- **No tocó el motor.** 🟢 `servedRoute` sigue intacta.
- **No mide los casos difíciles.** El sesgo está declarado en §2.
- **No propone el margen** con el que B atribuiría.
- **No dice cuántos veredictos cambiarían.** Simulación, D4.
