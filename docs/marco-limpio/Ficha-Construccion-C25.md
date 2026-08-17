# Ficha de construcción — C25, la Ley 1 evadida por grano

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md`. Subordinada al
`Acta-Cierre-Bloque-C.md`, que la nombra **última pieza de construcción** del
bloque.

**Fecha:** 17 de agosto de 2026.
**Base:** diagnóstico del 13 de agosto (PLAN.md y `Bitacora-2026-08-13.md`),
releído contra el código vigente el 17 de agosto.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **Ficha de construcción. No decide lo que no está decidido.** El defecto está
> medido y su forma es clara; **a qué población hay que preguntarle no lo decide
> esta ficha**, porque esa elección cambia cuántos servicios pasan a pendiente.
> Va en §E.

---

## A. El problema, dicho en una línea

**El motor ya tiene escrita la salida para este caso y no la toma**, porque se
la pregunta a la población equivocada.

Hay una compuerta de Ley 1 —*«la ventana de observación no alcanzó a cubrir el
origen de la ruta»* → `pendiente_evidencia`— y **ningún acusado con llegada sale
por ahí**. Los 397 salieron por `no_cumplido`.

🟢 **La razón no es el umbral. Es a quién se le pregunta.**

| | Quién calcula | Sobre qué puntos | Dónde |
|---|---|---|---|
| La que **tumba** a la candidata | `observableRouteSpan` | **sus** puntos (`sortedPoints`) | `verification/src/index.ts:568` |
| La que la **salvaría** | `earliestObservedRouteFraction` | `input.evidencePoints` — **la flota entera** | `verification/src/index.ts:1562` |

**Mismo umbral (`originToleranceFraction`), dos poblaciones.** Basta con que
CUALQUIER unidad de la flota haya pisado el origen para que la compuerta dé por
observado un origen que la candidata nunca recorrió.

🟢 **Y la flota no es un detalle de tamaño: la mediana es de 50 candidatas
evaluadas por servicio**, así que la pregunta de flota contesta «sí» casi
siempre, por construcción.

### El camino exacto, leído en el código

```
candidata → observableRouteSpan(SUS puntos) < piso → servedRoute = false
                                                          ↓
                                          serving.length === 0
                                                          ↓
                        ¿destino_only y alguna llegó? → pendiente (llegada_sin_atribucion)
                                                          ↓ no (kml_full)
                        Ley 1: earliestObservedRouteFraction(LA FLOTA) > tolerancia?
                                                          ↓ casi nunca
                                                    no_cumplido
```

La compuerta que existía para decir «no se pudo ver» se salta por preguntarle a
quien sí vio.

### Lo medido

🟢 **372 de 397 (93.7 %)** tienen a su candidata por debajo del piso que se le
aplicó, recalculado con la **misma función del motor** sobre la misma evidencia
y la misma ventana — sin simular nada.

🟢 **La valla del recálculo cuadra:** de los 121 expedientes que ya traían la
fracción sellada, coincide en **121 de 121 (±0.02)**.

**Instrumentos:** `pnpm --filter @jtel/db separar-397` y `reparto-397`.

---

## B. Por qué es la de mayor rendimiento, y por qué eso no la hace la primera

🔵 Es la causa que **sola** quita más de las 397 —372— contra 0 del modo inerte
(C14: los 397 se sellaron `kml_full`). Su arreglo **no mueve ningún umbral**:
cambia el argumento de una función, no la regla.

Y aun así **no entra primero**, por la razón que el Acta ya fijó: entra después
de que el paso 3 esté medido, para no revolver dos efectos en la misma ventana
de medición.

### ⚠ Lo que este documento agrega al diagnóstico, y cambia el número

🟢 **C25 está aguas abajo de los pasos 3 y 4, exactamente igual que C14.** Su
compuerta vive dentro del bloque `if (serving.length === 0)`, y **los pasos 3 y
4 cambian precisamente qué llena `serving`**. Se lee en el código, no hace falta
medirlo.

Y la dirección se puede acotar hoy:

- **Después del paso 3 solo**, `servedRoute` pasó de exigir `A ≥ minA ∧ B ≥ minB`
  a exigir `A ≥ minA ∧ B ≥ minB ∧ gana el ranking por el margen`. Es
  **estrictamente más restrictivo**, así que el conjunto que acredita solo puede
  encoger y **la población que llega a la compuerta de C25 solo puede crecer**.
- **Después del paso 4**, A deja de exigirse cuando la densidad no da, y ahí la
  población vuelve a moverse — en la otra dirección.

🟡 **Consecuencia práctica: el 372 es de antes del paso 3 y ya no describe el
presente.** Sirve para dimensionar la causa, no para prometer un resultado. Se
vuelve a medir con los mismos instrumentos antes de construir, y **el número que
se use en el PR es el nuevo**.

---

## C. La construcción

**Un solo cambio de fondo**, y no cabe repartirlo: la compuerta tiene que
preguntar por la misma población que tumbó a la candidata.

**Lo que NO cambia, y hay que decirlo antes de que alguien lo mueva de más:**

- El umbral `originToleranceFraction` **no se toca**. Sigue siendo el mismo
  número y la misma regla.
- `servedRoute` **no se toca**. Este arreglo vive después, en el camino del
  veredicto, no en el de la atribución. Es lo que lo hace medible aparte de los
  pasos 3 y 4 aunque toque el mismo archivo.
- Ningún hecho sellado se mueve. 🔵 Re-juzgar los 372 es **D4 / Tramo 6**, con
  firma.

**Las vallas que el PR tiene que traer**, que salen de lo que ya costó caro
aquí:

1. **Una prueba que muera si el arreglo se quita.** Y la trampa de este caso es
   específica: una prueba que solo compruebe «salió pendiente» pasaría también
   si saliera pendiente por otra compuerta. Tiene que fijar **cuál** compuerta
   contestó y **a qué población** se le preguntó.
2. **El paso del ledger declara la población**, como ya lo hace hoy
   (`poblacion: "viaje"`). Cuando cambie, el valor tiene que cambiar con él — un
   registro que siga diciendo `viaje` después del arreglo es peor que no
   escribirlo.
3. **Medición pareada, por contrato.** Planta 47 corre `destino_only` y el
   Campus `kml_full`: 🟢 la compuerta de C25 **solo se alcanza en `kml_full`**
   —en `destino_only` con llegada, la rama anterior devuelve
   `llegada_sin_atribucion` y no llega—, así que **el efecto de C25 se concentra
   en el Campus por construcción**, no por casualidad. Un promedio de los dos
   contratos describiría a ninguno.
4. **No se rellena hacia atrás.** Lo que empiece a distinguirse nace vacío en lo
   ya sellado, y la pantalla dice «no se preguntó».

---

## D. Cuándo cierra C25

C25 cierra cuando:

1. La compuerta de Ley 1 pregunta por la misma población que tumbó a la
   candidata, y el ledger dice cuál es.
2. Un servicio cuya candidata no alcanzó a ser observada sale **pendiente y
   diciendo por qué**, en vez de acusado.
3. La medición pareada por contrato existe y se corrió **después** del paso 3 —
   con el número nuevo, no con el 372.
4. Un servicio real, sellado después del cambio, se lee coherente en su
   expediente.

El punto 4 lo cierra Asav mirando un expediente. Una compuerta no se da por
probada porque el código compile.

---

## E. Lo que decide Asav, y no sale de aquí

**1. A qué población se le pregunta.** «La misma que tumbó a la candidata» tiene
más de una lectura y no son equivalentes:

| Opción | Qué significa | Efecto |
|---|---|---|
| La **mejor** candidata | la primera del orden que ya existe | la más parecida a lo que hoy se pretende |
| **Cualquiera** que haya llegado | basta una no observada | manda más servicios a pendiente |
| **Todas** las que llegaron | solo si a ninguna se le vio el origen | manda menos |

🟡 Las tres son defendibles y **cambian cuántos servicios pasan a pendiente**.
No se elige midiendo: se elige decidiendo qué afirma el árbitro cuando no pudo
ver.

**2. El orden contra C19 y C14.** ⚠ Las tres deciden `pendiente` contra
veredicto sobre poblaciones que se tocan, y **cuál se toca primero decide
cuántos servicios cambian de estado**. El Acta ya puso a C25 después del paso 3;
falta si va antes o después del paso 4.

**3. Si el 372 re-medido cambia la prioridad.** Si después del paso 3 la
población creció mucho, C25 deja de ser «la que más quita» para ser también «la
que más manda a pendiente», y eso es una conversación con la planta, no una
decisión de motor.

---

## F. Reglas que aplican

- Un cambio por PR; este es uno solo y no se reparte.
- Ningún hecho sellado se toca; la corrección gobierna hacia adelante.
- El umbral no se mueve. Si pareciera necesitarlo, se detiene y se decide
  aparte.
- Asav revisa Files Changed y mergea: esto es motor.
