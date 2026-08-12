# Ficha de diseño — C19: que el veredicto dependa de la conducta y no del aparato

**Fecha de medición: 11 de agosto de 2026** · **Alcance:** solo lectura, con
`jtel_readonly` —42 tablas, 42 legibles, cero escribibles ese día—. **No se selló
nada, no se re-verificó nada, ningún hecho cambió de versión.** Sin cuentas demo.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **Qué es y qué no.** Es la ficha de **diseño**, escrita antes del código porque
> el arreglo cambia cómo se sella un hecho. **No propone un valor de umbral, no
> toca el motor y no decide.** Pone enfrente el mecanismo, lo medido, y las
> opciones con su veredicto — la decisión es de Asav.

---

## 1. Qué se arregla, en una frase

> **La calificación de un transportista puede subir o bajar sin que él haga nada
> distinto.**

Y ahora con su tamaño: 🟢 **adelgazar la evidencia de hoy al intervalo que Planta
47 tenía en julio tumba 36 de las 94 candidatas que hoy acreditan — el 38 % —
con la misma unidad, el mismo trazado, el mismo día y la misma geometría.**

---

## 2. El mecanismo, leído en el código

`computeRouteMatchPct` ([index.ts:69-86](../../packages/verification/src/index.ts)):

```
for (const wp of waypoints) {
  const closest = points.reduce(...)   ← distancia del waypoint al PUNTO más cercano
  if (closest <= thresholdKm) matched++;
}
return (matched / waypoints.length) * 100;
```

🟢 **La cobertura mide, para cada waypoint, la distancia al punto GPS más
cercano.** Punto a punto — **no** segmento a punto. Así que un waypoint cuenta
como cubierto **solo si una muestra cayó dentro del corredor**, no si la unidad
pasó por ahí.

> **Ahí está C19 entera.** Entre dos muestras la unidad recorrió camino real que
> el árbitro no cuenta, y **cuánto camino queda sin contar lo decide el intervalo
> de emisión del aparato.** La cobertura no mide «cuánto de la ruta hizo»: mide
> **«cuánto de la ruta alcanzamos a ver»**, y se le aplica un umbral pensado para
> lo primero.

---

## 3. Lo medido

### 3.1 La cadencia — no es «más puntos», es el intervalo

🟢 **Planta 47** emitía **un punto cada 60.0 s exactos** los **trece días de
servicio del 9 al 28 de julio** (p90 de 120 s: uno de cada diez se perdía), y
pasó a **37–42 s** con p90 de 60 s del **30 de julio** en adelante.
🟢 **El Campus estuvo en 36–45 s todo el periodo.**

> 🟢 **Planta 47 no mejoró: convergió a la cadencia que el Campus ya tenía.**
> 🟡 Un 60.0 exacto sostenido trece días y un salto a otro valor estable tienen
> forma de **valor configurado**, no de deriva. Lo que falta para pasarlo a 🟢 no
> está de nuestro lado: es el proveedor diciendo qué cambió. **Y si es
> configuración, puede volver a cambiar sin avisarnos** — que es exactamente para
> lo que existe el sensor.

### 3.2 El grupo de control — adelgazar un día bueno

**El método es el que mató el rumbo espurio** (§4 del reporte de los 71): se toma
la evidencia densa de hoy y **se adelgaza hasta la densidad del régimen viejo**,
dejando todo lo demás fijo. **La única variable que se mueve es cuántos puntos
hay.**

La comparación es **pareada**: las mismas candidatas antes y después, no dos
poblaciones distintas. Y va **contra las que pasan**, que es la regla 9.

🟢 **Planta 47** · 30 jul → 11 ago · corredor 120 m · umbral 60 % · 9 267 pares
(ocurrencia × aparato):

| Peldaño | Puntos (med) | Acreditan | Pierde | Cobertura de las que acreditan hoy |
|---|---|---|---|---|
| **tal como está** (~40 s) | 109 | **94** | — | **73.1 %** |
| 1 punto / 40 s | 66 | 70 | −24 | 65.5 % |
| **1 punto / 60 s** *(el régimen de julio)* | 57 | **58** | **−36** | **62.1 %** |
| 1 punto / 120 s | 30 | **0** | **−94** | 37.3 % |

🟢 **El Campus** · mismos días · corredor 150 m · umbral 60 % · 11 947 pares:

| Peldaño | Puntos (med) | Acreditan | Pierde | Cobertura de las que acreditan hoy |
|---|---|---|---|---|
| **tal como está** | 96 | **155** | — | **79.5 %** |
| 1 punto / 40 s | 60 | 134 | −21 | 73.6 % |
| **1 punto / 60 s** | 52 | **115** | **−40** | **68.5 %** |
| 1 punto / 120 s | 27 | **23** | −132 | 48.3 % |

> ⚠ **Esta tabla se corrigió el 11 de agosto, después de medir C16, y el error
> era mío.** La primera versión comparó la cobertura contra `kmlCorridorMinPct`
> —el umbral de **B**— en vez de contra `kmlMatchMinPct`, que es el de **A**.
> Planta 47 tiene los dos en 60, así que **su tabla no cambió ni un dígito**; el
> Campus los tiene en 60 y 50, así que la suya estaba medida contra 50. **Un
> umbral equivocado que coincide en un contrato no se ve mal en ningún lado:**
> la corrida termina, imprime cifras plausibles y **solo el otro contrato lo
> delata.** Lo atrapó enumerar los campos de la política para C16, no revisar el
> guion.

**Lo que esto cierra:** hasta hoy C19 era una **correlación con fecha** —cambiaron
la densidad y la cobertura el mismo día—. Ahora es **atribución**: con todo lo
demás congelado, quitar puntos tumba candidatas. 🟢 **Y a 120 s en Planta 47 no
acredita ninguna: el instrumento se queda ciego, no severo.**

⚠ **Una honestidad del método:** el peldaño de 40 s **no es una corrida en
blanco** —quita 43 puntos de mediana, porque la evidencia real llega a ráfagas y
no a intervalo perfecto—, así que la comparación buena es **«tal como está» contra
60 s**, no «40 contra 60».

### 3.3 El margen operativo se lo come la densidad

🟢 La cobertura mediana de las que acreditan hoy en Planta 47 es **73.1 %** contra
un umbral de **60 %**: trece puntos de margen. Adelgazar al régimen de julio la
deja en **62.1 %** — **a 2.1 puntos del umbral**.

> **El margen entero con el que opera el sitio cabe dentro del efecto del
> aparato.** No es que la densidad empuje un caso al borde: es que **el borde
> está dentro del ruido del instrumento**.

### 3.4 Un cruce que no se buscaba: C16 decide cuánta ceguera aguanta un sitio

🟢 A 120 s, **Planta 47 se queda en cero acreditadas y el Campus conserva 23**.
Misma flota, mismo carrier, mismo adelgazamiento. A 60 s, Planta 47 pierde el
**38 %** de lo que acredita contra el **26 %** del Campus.

🟢 **Y con la corrección de arriba, lo que los separa se reduce a un solo campo:**
`kmlMatchMinPct` es **60 en los dos**, así que la diferencia no está en el umbral
sino en **el ancho del corredor — 150 m contra 120 m**.

> 🟢 **Treinta metros de corredor compran la diferencia entre quedarse en cero y
> conservar 23** cuando el aparato ralea. **La configuración del contrato fija
> cuánta densidad necesita un sitio para ser juzgable**, y nadie eligió ese
> intercambio — porque nadie lo tenía medido. Es exactamente lo que C16 dice que
> no se puede leer del sistema.
>
> **El hallazgo se achicó al corregirlo y se volvió más limpio:** ya no es «dos
> configuraciones distintas dan fragilidades distintas», es **un campo, aislado,
> con su efecto medido.**

---

## 4. Las opciones, con veredicto

**Ninguna se construye hoy.** El formato es el de C21 en el plan: qué entra, qué
no, y por qué.

| # | Opción | Veredicto |
|---|---|---|
| 1 | **Interpolar entre puntos consecutivos** — un waypoint cuenta si el segmento entre dos muestras pasa por el corredor | ❌ **No.** Afirma que la unidad recorrió la recta entre dos muestras, y **eso es la recta cruzando la ciudad del Workbench** (§E del Marco) movida de un mapa a un veredicto. Un mapa que completa engaña a quien lo lee; **un árbitro que completa sella una acusación sobre un camino que nadie observó.** A 60 s y velocidad de calle el tramo inventado no es un detalle |
| 2 | **Normalizar la cobertura contra su propio techo alcanzable** | ⚠ **Se intentó y la medición lo tumbó.** El techo parecía derivable del hueco entre muestras, pero 🟢 la distribución es **bimodal** —mediana del hueco espacial **0–63 m** porque la unidad pasa buena parte de la ventana detenida, p90 de 360–548 m—, así que ninguna media ni mediana da un techo. Y un techo calculado de los propios puntos es **circular**. **No queda descartada: queda sin definición que no se muerda la cola** |
| **3** | **Piso de densidad: por debajo de X, no hay veredicto** | ✅ **Entra como candidata fuerte.** Es la **Ley 7 del Marco** —sin evidencia no hay incumplimiento— aplicada a la densidad en vez de a la ausencia. 🟢 Y la medición le da forma: a 120 s el instrumento **no ve**, así que juzgar ahí no es rigor, es ruido con autoridad. **No inventa un solo dato** |
| 4 | **Mover el peso a B (`corridorPrecisionPct`), que es invariante a la densidad** | ⚠ **Atractiva y con un costo que hay que mirar de frente.** 🟢 B es una fracción de puntos, así que **escala numerador y denominador por igual** — quedó demostrado midiendo C22. Pero **A es lo que dice CUÁL ruta se sirvió** cuando hay varias candidatas llegando a la misma geocerca, y el frente de C14 ya escribió que la pregunta es *cómo atribuir cuando la ruta no acredita*, **no cómo saltarse la ruta** |
| **5** | **Exigir cadencia mínima al proveedor, y el sensor vigilándola** | ✅ **Entra, y no es código.** 🟢 La causa raíz no está de nuestro lado: el intervalo lo fija el aparato. Sin un mínimo pactado, **cualquier arreglo del motor queda a merced de que el proveedor vuelva a moverlo** — y ya lo movió una vez sin avisar |

> **La combinación que la medición sostiene es 3 + 5:** un piso que convierte la
> ceguera en `pendiente_evidencia` en vez de en acusación, y un mínimo pactado
> para que el piso no se toque todos los días. **La 1 está descartada. La 2 y la 4
> siguen vivas como cambio de métrica, y ésa es la decisión que no me toca.**

---

## 5. Lo que decide Asav

1. **Si el arreglo cambia la métrica (2 · 4) o solo pone un piso (3).** Cambiar la
   métrica cambia cómo se sella un hecho; poner un piso cambia **qué se sella
   como pendiente**. Son dos decisiones distintas y solo la segunda es reversible
   sin re-verificar.
2. **Qué pasa con el piso y D3.** Un piso de densidad **manda servicios a
   pendiente**, y 🔵 los pendientes ya son 106 con 89 de más de 48 h. **El piso no
   se puede decidir sin la regla de cierre**, o se cambia una acusación falsa por
   una pila que nadie cierra.
3. **Si se le pide cadencia mínima al proveedor**, que es conversación comercial y
   no código.

---

## 6. Las reglas que gobiernan este arreglo, y una que ordena el trabajo

- **El nudo.** 🟢 Un arreglo de métrica (2 · 4) toca `routeMatchPct >= minKmlPct`
  y/o `corridorPrecisionPct >= minCorridorPct` — **dos términos de `servedRoute`**,
  y C16 también vive en los dos. **Si el diseño elegido toca los dos, se parte en
  dos PRs**; la regla es un término, no una causa.
- 🟢 **Un piso de densidad probablemente NO toca un término**: decide antes de
  juzgar, como hace `routeStrictness`, que se lee después. Eso lo haría **medible
  por separado** y es un argumento a su favor que no es de mérito sino de método.
- ⚠ **Y un choque de calendario que hay que decir ahora:** un piso de densidad
  decide **`pendiente_evidencia` contra veredicto**, y **eso es exactamente lo que
  C14 decide**. **No pueden ir en el mismo PR ni sin ponerse de acuerdo**, o el
  resultado de las dos queda inatribuible aunque ninguna toque el nudo.
- ⚠ **El orden C19 → C16 se tensa con §3.4.** El piso correcto depende del
  corredor y del umbral, y **el corredor del Campus es justo lo que C16 no puede
  acreditar**. No lo resuelvo aquí: se anota para que la decisión del piso no se
  tome creyendo que la configuración está acordada.

---

## 7. La medición de antes y después que este arreglo va a exigir

**Ya existe y está corrida**, que es la mitad que suele faltar:

- `pnpm --filter @jtel/db medir-cadencia` — la densidad, **al abrir y al cerrar
  cada PR**, porque sin tablero nadie avisa si el proveedor la mueve otra vez.
- `pnpm --filter @jtel/services medir-efecto-densidad` — el efecto sobre la
  cobertura, con su grupo de control.

**La línea base queda fijada aquí**, con su fecha: **94 acreditadas y 73.1 % de
cobertura mediana en Planta 47; 155 y 79.5 % en el Campus, al 11 de agosto de
2026** (la del Campus, corregida — ver §3.2). Cualquier arreglo se compara contra
eso.

---

## 8. Lo que esta ficha NO hizo

- **No tocó el motor**, ni selló, ni re-verificó. 🟢 `servedRoute` sigue intacta.
- **No dice cuántos servicios cambiarían de veredicto.** Eso exige correr el motor
  entero —atribución, empate, sellado— y es **simulación**: D4 / Tramo 6.
- **No propone un valor** de piso, de umbral ni de corredor.
- **No mide Planta 47 en su régimen viejo adelgazando más**, porque no se puede
  añadir densidad que no se emitió: la dirección del experimento es solo hacia
  abajo, y va dicho para que nadie lo lea como simétrico.
