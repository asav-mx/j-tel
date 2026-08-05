# Reporte final — La investigación de los servicios sin atribución

**Cierre: 5 de agosto de 2026** · **Alcance:** solo lectura, con `jtel_readonly`
· **No se selló nada, no se re-verificó nada, ningún hecho cambió de versión.**

**Qué es:** el insumo del Tramo 2. El detalle de cada medición vive en
`Ficha-Diagnostico-Pendientes-Sin-Atribucion.md`; esto es el cierre.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

> **No propone orden de arreglo.** Eso se decide con este documento enfrente.

---

## 1. La pregunta cambió tres veces, y eso es parte del resultado

| Se preguntó | Y resultó ser |
|---|---|
| «¿Por qué 71 servicios de julio quedaron sin atribuir?» | 🟢 Son **100**, y los 71 eran la ventana vieja de algo vivo |
| «¿Por qué el sistema sigue produciendo servicios sin atribuir?» | 🟢 La dominante es **una sola** compuerta, en **un contrato y un turno** |
| «¿Qué está mal en el motor?» | 🟢 **Nada del motor.** La cobertura depende de cuántos puntos manda el aparato |

---

## 2. Las causas encontradas, por cuánto explican

### C19 — La cobertura depende de la densidad del muestreo, no de la conducta

**Explica el fenómeno entero.** 🟢 Medido:

| | Planta 47 | Campus |
|---|---|---|
| 9–24 jul | **60 k – 68 k** pts/día | ~120 k (plano) |
| 30 jul – 5 ago | **86 k – 108 k** pts/día | ~110 k – 123 k (plano) |
| Cobertura del trazado | **5–7 → 9.9 de 10** | sin cambio |

🟢 **Mismos aparatos** —53 en los dos periodos, 50–53 por día, estable de punta a
punta—, **mismas unidades, mismas rutas, mismo trazado.** Lo único que cambió es
**~1.5× más puntos por aparato**.

> **La calificación de un transportista puede subir o bajar sin que él haga nada
> distinto.** Si el proveedor cambia su cadencia, el árbitro cambia de opinión.
> **Rompe la promesa del producto: el veredicto tiene que depender de la
> conducta, no del aparato.**

🟢 **Y no fue un cambio nuestro.** Entre el 24 de julio y el 3 de agosto **ningún
commit toca** el archivador, el ingestor, `gps-umbrella` ni la cadencia de los
crons. Lo último antes del 29 es del **16 de julio**; lo siguiente, del 31, y es
de alertas. 🟡 **Fue del proveedor o de los dispositivos, y puede volver a pasar
sin avisarnos.**

### C11 — La compuerta A∧B, que ninguna candidata cumple

🟢 **57 de 100** pendientes son `llegada_sin_atribucion`, **todos de Planta 47 ·
Turno A**. Y **cero** candidatas cumplen las dos condiciones a la vez: 27 cumplen
**cobertura de ruta**, 26 cumplen **precisión de corredor**, **ninguna las dos**.

🟡 Es la **manifestación** de C19: con la traza rala, la cobertura no llega.

### C18 — El empalme: una unidad sirve dos rutas y el sistema no puede saberlo

🟢 Medido el 29 de julio: **tres unidades cubren dos trazados cada una**; una al
**79 % y 76 %**. Práctica normal del transporte de personal —consolidar rutas
cuando falta unidad o falta gente— y **cada servicio la evalúa contra una sola
ruta**.

**No es de umbral, es de planteamiento:** preguntarle «¿cubriste la ruta A?» a un
camión que sirvió A y B **está mal hecha la pregunta**.

### C3 — Se juzga antes de que llegue el expediente

🟢 **Explica los 28** que fallaron cobertura de evidencia: son del **27 y 28 de
julio**, sellados viendo **13–46 puntos**, y hoy esos mismos viajes tienen
**370–1 992** del mismo día. **28 de 28 con más del doble.** La evidencia no
faltaba: **no había llegado.**

### C17 — La cobertura se guardaba ponderada y se leía llana · ✅ arreglado

🟢 **168 de 3 054 candidatas** acreditaban ≥ 60 % teniendo una cobertura real con
mediana de **3.9 %**. Arreglado en el motor: ahora se guardan las dos, cada una
con su nombre. **No movió un solo veredicto.**

### C13 — El veredicto del mismo fallo lo decide `routeStrictness`, sin rastro

🟢 **335 hechos** sellados `no_cumplido` con una unidad que **sí llegó** a la
geocerca. Bajo `destino_only` habrían sido pendientes. 🔵 **Nadie los ha visto** —
no hay acusación emitida. Y `contract_policy_history` **existe y está vacía en
toda la base**, sin un solo `insert` en el código.

### C14 · C15 · C16 — las tres del expediente y la configuración

- **C14:** con `destino_only`, una unidad que llegó **no puede salir cumplida
  jamás**. `routeStrictness` se lee **después** de que la atribución falló.
- **C15:** el ledger escribe **`imei:`** y guarda un **id de unidad**.
- **C16:** el corredor del Campus está en **50 %**, y Asav lo recordaba acordado
  en 60 %. **Seis campos difieren** entre contratos.

---

## 3. Lo que se descartó, y con qué medición

| Hipótesis | Cómo murió |
|---|---|
| **Falta de evidencia** | 🟢 Los 71 tienen puntos guardados. 71 de 71 |
| **El tope de Fréchet los rechaza** | 🟢 **300 de los 319 cumplidos también lo exceden.** Y `shapeOk` no entra en `servedRoute` |
| **El umbral está apretado** | 🟢 Con los umbrales del Campus pasarían **17 de 61**. Quitando el tope de forma **entero**, 10 |
| **El trazado no corresponde** | 🟢 1 461 waypoints: **100 % con traza real a < 500 m**, mediana **20 m** |
| **La ventana de evidencia sobra o falta** | 🟢 El conjunto abarca **76 min** contra una ruta de 60+5. Recortarlo descarta el **1 %** |
| **Es el día entero del camión** | 🟢 Mismo dato: 76 minutos, no una jornada |
| **Hay variantes o ramales por día** | 🟢 De 150 tramos: **0 siempre, 0 nunca, 150 a veces**. Sin dependencia del día de la semana. **Una sola variante declarada por ruta** |
| **La versión de trazado no era la vigente** | 🟢 Una sola versión por ruta; cada ocurrencia apunta a la suya. El 20 y el 27 usan la correcta |
| **El empalme explica los días partidos** | 🟢 Existe el 29 (3 unidades), pero el 13/20/27 **ninguna unidad toca ninguna ruta al 30 %** |
| **Un desplazamiento sistemático de coordenadas** | 🟢 **Artefacto de densidad** — ver §4 |
| **El proveedor emite más lento que el hueco máximo** | 🟢 Un punto cada **~1 s** contra 10 min de tolerancia |
| **Es la cuenta demo** | 🟢 Excluida por `is_demo`; llave cerrada el 3 ago |

---

## 4. El cabo suelto, cerrado — y era mío

El sesgo direccional de Planta 47 en los tres días partidos (razón 0.24–0.40,
rumbos **116°–117° ESE**) parecía apuntar al trazado, porque el Campus no lo
tenía.

🟢 **Se probó adelgazando un día bueno hasta la densidad de un día partido:**

| Día 4 ago · 1 de cada | Puntos | Razón | Rumbo |
|---|---|---|---|
| 10 | 491 | 0.02 | — |
| 60 | 76 | **0.19** | **119° ESE** |
| 120 | 39 | **0.28** | **114° ESE** |
| *(13, 20, 27 jul, sin adelgazar)* | 164–231 | 0.24–0.40 | 116°–151° |

> 🟢 **El sesgo se reproduce con solo quitar puntos.** No es un corrimiento de
> coordenadas ni una diferencia entre plantas: **con pocos puntos el vector medio
> no se cancela y aparece un rumbo espurio.** El Campus no lo tenía **porque
> nunca perdió densidad.**

**Mi lectura anterior —«apunta al lado del trazado»— era mía y estaba mal.**
Queda absorbido por C19.

---

## 5. Lo que queda sin explicar

1. 🟢 **Por qué cambió la densidad el 29 de julio.** No fue nuestro código. Si fue
   configuración del proveedor o de los dispositivos, **no se puede leer desde
   aquí** — y **puede repetirse sin aviso**.
2. 🟢 **Por qué el archivador se atrasó el fin de semana del 25–26 de julio**, que
   es lo que produjo los 28 de C3.
3. 🟢 **Por qué esos tres lunes y no los otros.** El 3 de agosto también es lunes
   y tuvo 9.9 de 10.
4. 🟡 **Si el empalme (C18) es ocasional o rutinario.** Se midió en un día.

---

## 6. Lo que esta investigación NO hizo

- **No selló ni re-verificó nada.** Ningún hecho cambió de versión.
- **No propone orden de arreglo**, ni valores de umbral, ni regla de cierre del
  pendiente por evidencia — ésa la decide Asav con la planta y con legal.
- **No tocó producción**, salvo un guion **en seco** para escribir
  `kmlOriginToleranceFraction`, que **no se ejecutó desde aquí**.

---

## 7. Las reglas que dejó, y por qué importan más que el hallazgo

La investigación produjo **cinco reglas** para «las ganadas por las malas», y las
cinco son sobre **no creerle a un verde**:

| # | Regla | El caso |
|---|---|---|
| **9** | Una causa se acredita **contra los que pasan**, no contra los que fallan | 300 de 319 cumplidos también excedían el tope «culpable» |
| **10** | Un check cuyo resultado se descarta **no es un check** | `>/dev/null` y `;` sobre una build que falló |
| **11** | Una edición que no encuentra su patrón **tiene que gritar** | Un `.replace()` sin `assert`, en el paquete equivocado |
| **12** | Hay defectos que **solo el compilador ve** | Vitest no typechequea |
| **13** | **El eje es parte del resultado** | 100 % del trazado cubierto en 20 días · un tercio sin pisar en 1 día |

🟢 **Tres conclusiones de esta investigación fueron falsas y las atrapó el grupo
de control, no una prueba:** el tope de Fréchet, el desplazamiento sistemático, y
la media contaminada de ~1 000 m en el día en que los puntos caían encima.
**Ninguna la habría atrapado leyendo el código con más cuidado.**
