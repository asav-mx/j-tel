# Ficha de Diagnóstico — Servicios con evidencia completa y sin unidad atribuida

**Fecha de la medición:** 4 de agosto de 2026 · **Estado:** investigación cerrada,
sin arreglo · **Alcance:** solo lectura, con `jtel_readonly`

**Qué es:** el reporte que pidió `Handoff-Investigacion-71.md`. No se tocó el
motor, no se selló nada, no se re-verificó nada.

**Cada afirmación va marcada:** 🟢 verificado (medido aquí) · 🔵 reportado (lo
dice otro documento y no se re-midió) · 🟡 inferencia (razonamiento sobre lo
medido, no un dato).

---

## 0. La pregunta cambió de tamaño antes de empezar

El handoff pregunta por **71 servicios de julio**. La primera medición dice otra
cosa:

🟢 **Son 100 los servicios de Tecma en `pendiente_evidencia`, no 71.** Los 71 son
los que llevan más de 48 h sellados; los otros **29 se sellaron en las últimas
48 h**.

Y hay una coincidencia que conviene decir porque parece un dato y es una trampa:

> 🟢 Filtrar «más de 48 h» da 71. Filtrar «del 9 al 31 de julio» da **también
> 71**, y los dos filtros seleccionan **exactamente las mismas filas**. Por eso
> el número se pudo leer como «los 71 de julio» sin que nada chirriara.

**La pregunta correcta no es por qué 71 servicios de julio quedaron sin atribuir.
Es por qué el sistema sigue produciendo servicios con evidencia completa y sin
unidad atribuida.** Los 71 son la parte vieja de algo vivo. Corrección de alcance
de Asav, 4 de agosto.

🟢 Honeywell aporta 9 y **queda fuera de todo conteo por `is_demo`, no por
nombre** — el código no conoce nombres. PRUEBA REAL no tiene ninguno.

---

## 1. El corte por razón de fallo

### Primero: el handoff daba por hecho algo que no era del todo cierto

El método dice *«el ledger ya guarda la razón de cada verificación; agrupar por
esa razón»*. 🟢 **Medido: el motor tiene cuatro caminos hacia
`pendiente_evidencia` y solo dos escriben un paso `decision` con su `reason`.**

| Camino | Escribe `decision.reason` |
|---|---|
| `evidencia` / `indisponible` — cero puntos GPS | **No** |
| `cobertura_evidencia` / `insuficiente` | **No** |
| `decision` · `reason: llegada_sin_atribucion` | Sí |
| `decision` · `reason: observacion_insuficiente` | Sí |

**Agrupar solo por `decision.reason` habría perdido 33 de los 100 en silencio** —
y el corte habría salido en verde, contando 67 y llamándolos «todos». Es la
regla 8 del plan: una clasificación que no distingue «no fue por esto» de «no
lo escribí» no clasifica.

La clasificación de abajo lee **los cuatro caminos**. 🟢 **Los 100 quedaron
clasificados: cero sin entrada de ledger, cero sin clasificar.**

### El corte

| Razón | Total | Los 71 viejos | Los 29 recientes |
|---|---|---|---|
| **`llegada_sin_atribucion`** | **57** | **38** | **19** |
| `cobertura_evidencia` insuficiente | 28 | 28 | **0** |
| `observacion_insuficiente` | 10 | 5 | 5 |
| `evidencia` indisponible | 5 | **0** | 5 |

### Lo que dice el corte de los 29 recientes

Era la pregunta de Asav: si coinciden, es una causa que sigue corriendo; si
difieren, son dos cosas.

🟢 **Coinciden en la dominante y difieren en el resto.**

- **`llegada_sin_atribucion` está viva:** 38 en los viejos y 19 en los recientes.
  Es la misma causa, corriendo hoy.
- **`cobertura_evidencia insuficiente` se apagó:** 28 en los viejos, **cero** en
  los recientes.
- **`evidencia indisponible` es nueva:** cero en los viejos, 5 en los recientes.

🟢 Los 5 «sin evidencia» son servicios del **22 al 26 de junio**, todos de la
ruta **Riveras 9**, sellados en las últimas 48 h. O sea: **servicios viejos
sellados hace poco**, no servicios nuevos.

🟡 **Inferencia:** son al menos tres fenómenos distintos con un solo síntoma. El
único que hay que perseguir para detener la producción es
`llegada_sin_atribucion`.

---

## 2. La tasa de entrada — ¿crece solo?

🟢 Pendientes por semana de servicio, sobre el total juzgado de Tecma:

| Semana | Juzgados | Pendientes | % |
|---|---|---|---|
| 22 jun | 5 | 5 | 100.0 |
| 29 jun | 5 | 0 | 0.0 |
| 6 jul | 99 | 30 | 30.3 |
| 13 jul | 240 | **0** | 0.0 |
| 20 jul | 240 | **0** | 0.0 |
| 27 jul | 240 | 41 | 17.1 |
| 3 ago | 96 | 24 | 25.0 |

**No crece de forma sostenida: aparece, desaparece dos semanas enteras, y
vuelve.** Dos semanas con 240 servicios juzgados y **cero** pendientes no son
ruido — son la prueba de que el sistema sí puede atribuir cuando algo está en su
sitio.

🟡 **Inferencia, y es la que más manda el trabajo que sigue:** un fallo continuo
del motor no produce dos semanas perfectas en medio. Lo que cambió entre el 13 y
el 26 de julio, y volvió a cambiar el 27, es más probable que sea **un dato de
configuración** —trazado, geocerca, variante— que una constante del código.
**Esto no se midió; es la hipótesis con más apoyo en los datos y la primera que
hay que descartar.**

🟢 En cuanto a prioridad: el ritmo de las últimas dos semanas es de **65
servicios en 14 días**, ~4.6 por día. La causa demo (C1) subió de prioridad con
~11/semana. **Ésta va a ~32/semana.**

---

## 3. El corte por contrato — y el 6.7% vs 55.2%

🟢 Medido hoy, sobre todo el histórico de Tecma:

| Contrato | Total | Cumplido | No cumplido | Pendiente | % cumplido |
|---|---|---|---|---|---|
| TECMA Campus Santos Dumont | 526 | 284 | 215 | 27 | **54.0 %** |
| Tecma 47 — Transporte Personal | 399 | 35 | 291 | 73 | **8.8 %** |

🔵 El handoff reporta 6.7 % y 55.2 %. 🟢 **Hoy son 8.8 % y 54.0 %** — la brecha
sigue, del mismo tamaño, y los números se movieron porque los datos están vivos.
La diferencia no se cerró.

### ¿Se explica la diferencia? Sí, y no era la hipótesis

La hipótesis de Asav —marcada como hipótesis en el handoff— era que Planta 47 y
el Campus **sufren el mismo problema**. 🟢 **Medido: no.** Los 71 se reparten así:

| Sitio | `llegada_sin_atribucion` | Cobertura insuficiente | Observación insuficiente | Total |
|---|---|---|---|---|
| **Tecma Planta 47** | **38** | 15 | 1 | 54 |
| **Campus Santos Dumont** | **0** | 13 | 4 | 17 |

> 🟢 **El Campus no tiene ni un solo `llegada_sin_atribucion`. Los 57 son de
> Planta 47.** Los dos sitios fallan por razones distintas.

🟢 Y hay un segundo corte que lo aprieta más: **los 57 son todos del mismo
turno**, «Turno A», declarado a las 06:00.

🟡 **Inferencia:** C10 —«Planta 47 sella 6.7 % vs Campus 55.2 %, causa no
identificada»— **ya tiene causa identificada, y es ésta.** No es una diferencia
difusa entre dos operaciones: es un modo de fallo que solo ocurre en un contrato
y en un turno.

---

## 4. ¿Causa dominante o repartidas? — Dominante, y el gate no es el que se creía

`llegada_sin_atribucion` significa: *una unidad llegó a la geocerca, pero su
recorrido no alcanza el mínimo de ninguna ruta.* Hay **dos** compuertas que
pueden decir eso. Se midieron por separado, sobre los 57.

### Compuerta A — cobertura de ruta (umbral 60 %, configurable por contrato)

🟢 Mejor cobertura que logró **cualquier** candidata:

| Cobertura lograda | Servicios |
|---|---|
| ≥ 60 % — **pasa el umbral** | **28** |
| 50–60 % — rozando | 1 |
| 30–50 % | 10 |
| 10–30 % | 18 |
| 0–10 % | 0 |

**28 de 57 SÍ alcanzan el umbral de cobertura y aun así quedaron pendientes.**
La cobertura no es lo que los rechaza.

### Compuerta B — forma del recorrido, Fréchet ≤ 0.8 km

🟢 Mejor distancia de Fréchet lograda:

- mínimo **1.50 km** · mediana **4.34 km** · máximo **10.49 km**
- **dentro del máximo permitido: 0 de 57.**

> **Ni uno solo se acerca.** El mejor caso está a casi el doble del límite, y la
> mediana a más de cinco veces. Esto **no es un umbral mal afinado**: un umbral
> mal afinado tiene casos rozando. Aquí no hay ninguno.

### Y la parte que convierte el hallazgo en acción

🟢 **`frechetMaxKm` es el único de los umbrales de KML que NO vive en la política
del contrato.** Está fuera de `contractPolicySchema`; el motor lo resuelve con
`input.frechetMaxKm ?? 0.8`, y quien llama al motor en producción
(`packages/services/src/verification.ts`) **le pasa seis umbrales de la política
y no le pasa éste**. Está horneado en 0.8 km, y además repetido literal en
`apps/web/src/lib/monitoreo-data.ts`.

> **Ley 6 del Marco:** *«todo umbral y tolerancia es configurable por contrato ·
> nunca hornees un número en un componente».* 🟢 Este número la incumple, y es
> justo el que está rechazando los 57.

🟡 **Inferencia:** la respuesta a «¿causa dominante o repartidas?» es
**dominante**. 57 de 100 caen por una sola compuerta, la misma para todos, en un
solo contrato y un solo turno. Las otras tres razones suman 43 y son fenómenos
separados.

---

## 5. Contra qué lista se comparó — las once de `PLAN.md` §5

El handoff pide decirlo explícitamente, no decir «es la séptima».

**Se comparó contra las once causas de `docs/PLAN.md` §5**, no contra seis ni
contra ocho:

| Causa | ¿Explica los 57? |
|---|---|
| C1 · Cuentas demo | **No.** 🟢 Excluidas por `is_demo`; la llave se cerró el 3 ago |
| C2 · Cadena de auditoría rota | No. Es sobre historial, no sobre atribución |
| C3 · Se juzga antes del expediente | **No.** 🟢 Los 100 tienen entrada de ledger completa con candidatas evaluadas |
| C4 · Geocerca congelada ≠ la usada | **No para éstos.** 🟢 La unidad **sí llegó** a la geocerca — ése es el punto de partida de `llegada_sin_atribucion` |
| C5 · Ventana derivada vs match observable | **No.** 🟢 Es un problema de afinar umbrales entre sí; aquí ningún caso roza |
| C6 · Trazado KML que no corresponde | **Parcialmente, y hay que medirlo aparte.** 🔵 El handoff le atribuye ~43 servicios en Huertas-B, Centro-A y Parajes del Sur-A. 🟢 Centro-A y Parajes del Sur-A aparecen aquí; **Huertas-B no aparece en los 57** |
| C7 · `maxRouteDurationMinutes` fijo en 60 | **No, pero es la misma familia:** un umbral horneado sin derivar |
| C8 · Identificación en vivo | No. Es sobre la sala, no sobre el sellado |
| C9 · Chofer sin congelar | No |
| C10 · Planta 47 6.7 % vs Campus 55.2 % | **Sí — y ésta es su causa.** Ver §3 |
| C11 · Los 71 sin atribución | Es esta ficha |

### Lo que sale y no estaba en la lista

> **C12 (propuesta) — `frechetMaxKm` horneado en 0.8 km.** No es C5 (afinar dos
> umbrales entre sí) ni C6 (el trazado está mal). Es un umbral que **ningún
> contrato puede configurar**, incumpliendo la Ley 6, y que hoy rechaza el
> 100 % de los 57. C7 es su gemelo con otro nombre.

---

## 6. Qué se puede medir sin sellar nada, y qué exige tocar el motor

**Sin sellar nada, y sin permiso adicional:**

- 🟢 Todo lo de esta ficha, ya hecho, con `jtel_readonly`.
- **Qué pasaría si el tope de Fréchet fuera otro.** El ledger guarda el
  `frechetKm` de cada candidata, así que se puede contar **cuántos de los 57
  pasarían con 2 km, 3 km o 5 km** sin correr el motor y sin sellar. Es
  aritmética sobre datos ya escritos.
- **Qué cambió entre el 13 y el 26 de julio** —las dos semanas limpias— leyendo
  versiones de KML, geocercas y variantes por fecha.
- **Si Huertas-B pertenece a este grupo o al de C6**, comparando sus servicios
  contra este corte.

**Exige tocar el motor, y por lo tanto no entra aquí:**

- Cambiar el tope o sacarlo a la política del contrato.
- Re-verificar cualquiera de los 100. **Cada re-verificación mete una versión más
  en la historia del hecho.**
- Decidir si un servicio con cobertura ≥ 60 % y forma fuera de tolerancia debe
  atribuirse.

---

## 7. Qué necesita de Asav

**Decisión de negocio**

1. **El tope de Fréchet: ¿sale a la política del contrato, y con qué valor?** Es
   un cambio de comportamiento del árbitro sobre 57 servicios ya sellados. Aquí
   **no se propone valor** — se propone medir primero cuántos pasarían con cada
   uno, que se puede hacer sin sellar nada.
2. **Dónde entra este arreglo respecto de la ficha de consolidación** (Tramo 2).
   Con C10 explicada, el orden puede cambiar.
3. **La regla de cierre del pendiente por evidencia** sigue sin definirse, y esta
   ficha **no la propone** — la decide Asav con la planta y con legal. Lo que sí
   aporta es el tamaño: 🟢 al ritmo actual entran ~32 por semana.

**Trabajo humano**

4. **Abrir en un visor los trazados de las rutas «- A» de Planta 47** y
   compararlos a ojo con el recorrido real. 🟢 Las 15 rutas del corte terminan
   todas en «- A». Es el H1 del plan, apuntando a rutas concretas.

**Conversación con la Planta**

5. 🟢 Los 57 son **todos del Turno A, declarado 06:00** — no del Turno B de D2,
   que está declarado 18:00 y se opera cerca de las 14:00. **D2 y esta ficha
   hablan de turnos distintos**, así que resolver D2 no mueve estos 57. Sigue
   haciendo falta la conversación, pero por otro motivo.

---

## 8. Lo que esta ficha NO dice

- **No dice que el trazado esté mal.** Dice que la forma medida queda lejos del
  tope. Que la culpa sea del KML, del recorrido real o del tope es justo lo que
  falta medir.
- **No propone tocar el motor**, ni un valor de umbral, ni una regla de cierre.
- **No explica las otras tres razones** —cobertura, observación, evidencia
  indisponible—. Suman 43 servicios y son trabajo aparte.
- **No mide Huertas-B**, que el handoff pone en C6 y que **no aparece** entre los
  57.
- **No re-verificó nada.** Ningún hecho cambió de versión por esta
  investigación.
