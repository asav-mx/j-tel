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

## 3.1 La forma, término por término — ✅ decidida por Asav el 12 de agosto

**Hoy** (`index.ts:575-580`), una sola expresión contesta dos preguntas:

```
servedRoute = arrivalAt !== null && (!hasKml || (observableEnough && A ≥ minA && B ≥ minB))
```

**Separadas**, cada pregunta con su término y su fragilidad declarada:

```
1 · ¿ES ESTA la ruta que sirvió?          ← atribución. Robusta al aparato.
    atribuida = B_esta ≥ minB
             && B_esta es la mayor de las rutas del turno, con margen m

2 · ¿CUBRIÓ bastante de ella?             ← exigencia. Frágil. Protegida por el piso.
    si densidad < piso  → INDETERMINADO   (Ley 7: no se puede ver, no se juzga)
    si no               → A ≥ minA

3 · El veredicto
    cumplido      ← llegó · atribuida · cubrió = sí
    no cumplido   ← llegó · atribuida · cubrió = NO   (y la densidad daba para verlo)
    pendiente     ← llegó · atribuida · cubrió = INDETERMINADO
```

**Qué gana cada término al separarse:**

| Término | Hoy | Separado |
|---|---|---|
| **B** | co-requisito, sin voz propia | **decide quién fue.** 🟢 Conserva 93–96 % al adelgazar y acierta la ruta en 97–99 % |
| **A** | decide quién fue **y** cuánto hizo | **solo decide cuánto hizo.** Sigue siendo frágil — y ahora su fragilidad **no contamina la atribución** |
| **el piso** | no existe | **decide cuándo A tiene derecho a opinar.** Protege exactamente el término frágil |
| **`arrivalAt`** | igual | igual. **No se toca** |
| **`observableEnough`** | igual | igual. **No se toca** |

> **Y la frase que resume por qué el piso solo no alcanzaba:** el piso protege a A,
> pero **mientras A también atribuya, su fragilidad se contagia a la atribución**.
> Separarlas es lo que hace que el piso sirva de algo.

## 3.2 La matriz de casos — qué sale en cada esquina

| ¿Atribuye B? | ¿Densidad ≥ piso? | ¿A ≥ minA? | Veredicto | Comentario |
|---|---|---|---|---|
| sí | sí | sí | **cumplido** | El caso normal |
| sí | sí | **no** | **no cumplido** | **La acusación honesta**: se vio bien y no hizo la ruta |
| sí | **no** | — | **pendiente** | Ley 7. **Hoy esto sale `no_cumplido`** |
| **no** | — | — | sin atribuir | Es la pregunta de **C14**, no de ésta |

> 🟢 **La tercera fila es todo el arreglo de C19**: hoy un servicio con muestreo
> insuficiente sale acusado; separado, sale pendiente **y dice por qué**.

## 3.3 Lo que esta forma NO hace, y hay que decirlo antes de que se espere

- ⚠ **No drena los 87.** Los pendientes de C11 son de la ventana de muestreo ralo:
  con el piso, **seguirían siendo pendientes** — correctamente, porque la evidencia
  no daba para juzgarlos. 🔵 Y de todos modos **están congelados**: moverlos es D4.
  **Lo que esta forma arregla es que dejen de producirse por el motivo equivocado.**
- ⚠ **No sustituye a C14.** C14 pregunta qué pasa cuando **nada** atribuye; ésta
  cambia **con qué** se atribuye. 🟡 **Pero se rozan**: la opción 2 de C14 —A∧B de
  requisito a desempate— y esta forma **mueven la misma pieza en la misma
  dirección**, y **conviene decidir si son un cambio o dos antes de construir
  ninguno**.
- ⚠ **No cambia lo que ve el cliente.** Los tres veredictos siguen siendo tres.

## 3.4 El margen de B, que es la única perilla nueva

**Atribuir a la ruta con mayor B exige un margen**: sin él, dos rutas separadas por
una décima se resuelven por ruido.

🟢 **Medido: hoy los empates dentro de 5 puntos son 0.1 (Planta 47) y 0.0
(Campus).** Así que un margen de esa escala **no rechazaría casi nada hoy** — pero
⚠ **un margen sin medir es un umbral escondido**, y éste **no sale de esta ficha**:
es valor, y va a la política con su historia (C13), no horneado (C12).

**Y qué pasa cuando el margen no alcanza:** no se elige. **Dos rutas empatadas es
una atribución que el sistema no puede hacer**, y eso es `pendiente`, no un volado.
Es la misma ley que el piso, aplicada al empate.

---

## 4. Qué toca del nudo, y por qué no cabe en un PR

🟢 **`servedRoute` tiene cinco términos y esta forma toca dos**:
`routeMatchPct >= minKmlPct` **y** `corridorPrecisionPct >= minCorridorPct` — el
primero cambia de papel y el segundo pasa a mandar.

> **Es el cambio más grande que se le puede hacer a esa expresión**, y la regla
> del nudo dice que **dos términos en el mismo PR hacen inatribuible el
> resultado**. **No cabe en uno.**

⚠ **Y no puede compartir tramo con C14**, que también reescribe cuándo `serving`
sale vacía.

### 4.1 Cómo se parte — propuesto, no decidido

Cada paso **deja el sistema en un estado consistente y medible**, y **ninguno
cambia un veredicto hasta el último**:

| # | Qué entra | ¿Cambia un veredicto? | Qué se mide |
|---|---|---|---|
| **1** | **La densidad se calcula y se anota** en el ledger como paso informativo, y **se congela dentro del hecho** | **No.** Es el «piso apagado» | Que la cifra del hecho case con la de `medir-cadencia`. 🟢 Y deja lo del Tramo 4: **el hecho carga la densidad con la que se le juzgó** |
| **2** | **B se calcula contra TODAS las rutas del turno** y el ledger guarda el ranking | **No.** Solo escribe | Que el ranking case con la corrida de solo lectura de §2 |
| **3** | **La atribución pasa a B** con su margen. A deja de decidir *cuál* | **Sí — toca `corridorPrecisionPct`** | Cuántas candidatas atribuyen antes y después, pareado |
| **4** | **El piso se enciende**: sin densidad, A no opina y el servicio sale pendiente | **Sí — toca `routeMatchPct`** | Cuántos `no_cumplido` pasan a pendiente. 🟢 Hoy serían **cero hacia adelante** |

> **Los pasos 1 y 2 se pueden construir hoy sin decidir nada más**, y **sin
> esperar a la Planta**: no cambian un veredicto, y **dejan medido de antemano lo
> que los pasos 3 y 4 van a mover**. Es la medición de «antes» construida dentro
> del motor en vez de por fuera.
>
> **Los pasos 3 y 4 tocan un término cada uno**, en PRs distintos, en el orden que
> se decida — **pero el 4 después del 3**, porque el piso protege a A y A solo
> queda sola después del 3.

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
