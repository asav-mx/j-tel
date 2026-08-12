# Ficha — El expediente de un servicio sin atribución · Parte 2

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Sin código.** Define **qué se empieza a guardar**; no lo construye.

**Continúa** la `Ficha-Expediente-Sin-Atribucion.md` (Parte 1, PR #293), que
define la pantalla con lo que ya está guardado. **Esta define lo que falta.**

**Toca el motor.** Escribe en el paso `candidata` del ledger y en el sello de un
hecho. **Parada obligatoria para aprobación de Asav antes de construir.**

---

## 1. Por qué existe, dicho con el número

De los 397 servicios acusados con una llegada registrada:

- el **motivo por candidata** existe en **0**
- la **señal por candidata** existe en **0**
- **cuál trazado contratado se usó** existe en **0**

El único motivo guardado es del **servicio**, no de la candidata, y es
`ninguna_unidad_coincidio_ruta` en **397 de 397** — que **es una tautología**:
dice lo mismo que «no se pudo atribuir». **El expediente no explica porque el
motor nunca escribió el porqué.**

**Y el plazo es lo que hace que esto no pueda esperar:** todo campo nuevo nace
vacío hacia atrás. Cada día que pasa sin esto, se sella otra tanda de servicios
que **no van a poder explicar nunca**. Los 397 de julio ya son irrecuperables.
La Parte 2 no los arregla — **evita los de octubre.**

---

## 2. Qué de la lista ya está resuelto — y esto reduce el frente

⚠ **Verificado en el código, no supuesto.** De los cuatro campos que la Parte 1
listó como faltantes, **dos ya fluyen hoy** y no hay nada que construir:

| Campo | Estado real | Dónde |
|---|---|---|
| **A llana** (`routeMatchPlainPct`) | ✅ **Ya se escribe**, en cada candidata | `verification/src/index.ts:1045` |
| **Tramo observable** (`observableFraction`) | ✅ **Ya se escribe**, cuando hay trazado | `index.ts:1059` |
| **Motivo por candidata** | ❌ No existe | — |
| **Señal por candidata** | ❌ No existe | la cobertura es de **una sola unidad** |
| **Trazado usado en los no cumplidos** | ❌ **Se calcula y se tira** | `services/src/verification.ts:1318` |

**Que aparezcan en 67 y 121 de los 397 no es que fallen: es que esos 397 son
viejos.** La ficha de la Parte 1 los marca como `no se preguntó` y eso sigue
siendo correcto — pero **no hay que construir nada para ellos**.

**Entonces el frente real son tres cosas, no cinco.** Y la tercera no es
construir: es **dejar de tirar** un dato que el motor ya tiene en la mano.

---

## 3. Las tres piezas

### 3.1 El motivo por candidata — la que importa

**Qué falta:** el paso `candidata` guarda los números y el resultado
(`sirvio_ruta` / `no_sirvio`), pero **no guarda por qué**. Hoy la compuerta que
falló se deduce comparando cada número con su umbral, y **eso solo funciona
donde están todos los números**.

**Qué se guarda:** el motivo, **enunciado por el motor en el momento en que
decide**, que es el único momento en que se sabe sin deducir. Con dos partes que
no se pueden colapsar:

- **La compuerta que falló** — tramo observable · cobertura de trazado ·
  precisión de corredor · no llegó. Y **cuando falla más de una, van las dos**:
  colapsarlas a «la primera» inventa una prioridad que el motor no tiene.
- **A qué población se le preguntó** — la candidata o el viaje entero.

⚠ **Lo segundo no es un adorno, es C25.** La compuerta de Ley 1 hoy pregunta por
la evidencia del **viaje** —la flota, mediana de 50 unidades— y la que tumba a
la candidata pregunta por **la candidata**. Mismo umbral, dos poblaciones.
**Un motivo que no diga a quién se le preguntó repite el defecto en el registro**
y deja al expediente afirmando una causa que no es la que operó.

**Y el motivo se escribe aunque C25 no esté arreglado.** Son cosas distintas:
arreglar C25 cambia veredictos y es decisión de Asav; **escribir qué pasó no
cambia ninguno**. Registrar el defecto mientras existe es lo que permite
medirlo.

### 3.2 La señal por candidata

**Qué falta:** el paso `cobertura_evidencia` guarda cobertura, hueco máximo y
conteo de puntos **de una sola unidad — la mejor**. Las otras candidatas no
tienen señal registrada, así que el expediente no puede decir *«esta unidad
reportó cada 3 minutos y por eso su recorrido se ve entrecortado»*.

**Qué se guarda:** por cada candidata evaluada, su cobertura de la ventana, su
hueco máximo y su cadencia mediana.

**Por qué importa más de lo que parece:** es **C19 hecho visible en el
expediente**. Está medido que adelgazar la evidencia al intervalo de julio tumba
36 de 94 candidatas que acreditan — o sea que **la calificación depende del
aparato**. Sin la señal por candidata, el expediente no puede distinguir *«este
camión no hizo la ruta»* de *«a este camión no se le vio hacerla»*, que es la
distinción que sostiene todo el producto.

⚠ **Y el costo hay que decirlo antes:** son ~50 candidatas por servicio, así que
esto multiplica el tamaño del paso del ledger. **Falta medir cuánto** — y si
resulta caro, la salida es guardarlo **solo para las relevantes** (el corte de
dos criterios de la Parte 1 §4.3), no bajar la calidad del dato.

### 3.3 El trazado que se usó — dejar de tirarlo

**Qué pasa hoy, y es una línea:**

```
servedVariantId: finalStatus === "cumplido" ? servedVariantId : null
```

El motor **evalúa contra cada variante, elige la mejor, y luego la descarta** si
el veredicto no fue `cumplido`. La decisión fue deliberada —un `no_cumplido` no
«sirvió» ninguna variante— y **es correcta como semántica y equivocada como
registro**: el expediente necesita saber **contra qué se le juzgó**, que no es lo
mismo que **cuál sirvió**.

**Qué se guarda:** la variante y la versión de trazado **contra las que se
calificó**, en todos los veredictos. Nombre distinto del que ya existe, porque
**es otra cosa**: `servedVariantId` significa «la que sirvió» y debe seguir en
nulo cuando ninguna sirvió.

**Lo que esto cierra:** hoy el mapa de la Parte 1 dibuja el trazado
reconstruyéndolo por fecha, y va marcado `lectura de hoy` porque **si alguien
edita el trazado, el expediente cambia lo que dice sobre un hecho sellado**. Eso
es C24. Con esto, el trazado del expediente se vuelve **del sello**.

---

## 4. Dónde vive lo que se guarda — y la pregunta abierta

Lo natural es el paso `candidata` del ledger: ya existe, ya lo lee el expediente,
y **no toca `compliance_facts`**, así que ningún hecho sellado se mueve.

⚠ **Pero hay una dependencia que hay que mirar antes de decidir: C2.** El
expediente encuentra su ledger por emparejamiento, y **374 de 581 filas
(64.4 %) no tienen referencia a qué las reemplazó**. Si el porqué de un servicio
vive solo ahí, **el expediente hereda la fragilidad de ese emparejamiento**.

**Las dos salidas, y decide Asav:**

- **En el ledger** — barato, aditivo, cero migraciones. Hereda C2.
- **En el hecho** — Tramo 4, *el hecho debe bastarse a sí mismo*. Caro, exige
  migración, y **es la respuesta correcta a largo plazo**.

**Esta ficha no elige.** Recomienda empezar por el ledger **si y solo si** se
acepta que el Tramo 4 lo va a mover después — y que moverlo entonces será más
caro que hacerlo ahora.

---

## 5. La ley que gobierna todo lo de aquí

> **Todo campo nuevo nace vacío hacia atrás.**

Se escribe otra vez en esta ficha porque **es aquí donde se aplica**, no en la
Parte 1. Tres consecuencias que hay que aceptar **antes** de construir:

1. **No hay relleno retroactivo, y no se debe intentar.** Deducir el motivo de un
   servicio de julio con los números que sí tiene sería **escribir un hecho que
   nadie observó** dentro de un expediente sellado. Marco §E. Los 397 se quedan
   con `no se preguntó`, para siempre.
2. **El valor por defecto no puede ser un cero ni un vacío.** Un motivo ausente
   tiene que ser distinguible de un motivo que dice «no falló nada». Si el campo
   nace como `null` y la pantalla lo pinta como `—`, **la ley se rompe el primer
   día**.
3. **La fecha de corte se declara y se muestra.** El expediente tiene que poder
   decir *«desde el 20 de septiembre de 2026, este expediente explica candidata
   por candidata»*. Sin esa fecha, la ausencia se lee como falla del sistema en
   vez de como su historia.

---

## 6. Cómo se verifica

**Con la regla 8 por delante: una defensa que ninguna prueba distingue de su
ausencia no cuenta.**

1. **Una prueba que muera si el motivo no se escribe.** Un servicio sin
   atribución cuyo ledger no traiga motivo por candidata **pone la prueba en
   rojo** — y se comprueba que se pone en rojo quitando la escritura.
2. **Una prueba que muera si el motivo colapsa dos compuertas en una.** El caso
   de dos fallos simultáneos tiene que traer las dos.
3. **Una prueba de que el veredicto NO se movió.** Es la garantía central de
   esta ficha: se corre el motor sobre los casos sellados y **cada veredicto sale
   idéntico**. `servedRoute` no se toca.
4. **Contra la base desechable, nunca sobre un cliente vivo.**
5. **Y en el navegador:** un servicio nuevo con motivo y uno viejo sin él, uno
   junto al otro, para ver que la pantalla los distingue y no disimula.

---

## 7. Lo que NO entra

- **Arreglar C25.** Escribir el motivo **no** cambia a qué población se le
  pregunta. Registrar el defecto y corregirlo son dos trabajos, y el segundo
  mueve veredictos.
- **Rellenar hacia atrás.** Nunca.
- **Tocar `servedRoute`, un umbral o un veredicto.**
- **Re-verificar los 397.** Eso es D4 / Tramo 6, con firma.
- **A llana y tramo observable.** Ya fluyen — §2.

---

## 8. Lo que decide Asav antes de construir

- ⚠ **Ledger o hecho** (§4). Es la decisión que más cuesta cambiar después.
- ⚠ **Señal de todas las candidatas o solo de las relevantes** (§3.2), y depende
  de un tamaño que **falta medir**.
- 🔵 **Si el motivo por candidata entra antes o después del arreglo de C25.**
  Escribirlo antes deja medido de antemano lo que el arreglo va a mover — es la
  misma forma que ya se usó con el piso de densidad.
