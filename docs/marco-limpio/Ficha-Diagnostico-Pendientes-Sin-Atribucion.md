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

### 2-bis. CORRECCIÓN — las dos semanas «limpias» no eran limpias

**El §2 concluye que dos semanas con 240 servicios y cero pendientes prueban que
el sistema sí puede atribuir. 🟢 Es falso.** Abierto por contrato y turno:

| Semana | Planta 47 · Turno A | cumplido | no cumplido | pendiente |
|---|---|---|---|---|
| 13 jul | 75 | **0** | **75** | 0 |
| 20 jul | 75 | 1 | **74** | 0 |

**El síntoma no desapareció: cambió de veredicto.** Los mismos servicios, la
misma ruta, el mismo turno — sellados `no_cumplido` en vez de
`pendiente_evidencia`.

🟢 **Y se sabe exactamente por qué.** La política congelada dentro de cada hecho
dice que `routeStrictness` cambió:

| Fecha de servicio | `routeStrictness` de Planta 47 |
|---|---|
| hasta el 13 de julio | `destino_only` |
| **14 al 30 de julio** | **`kml_full`** |
| desde ~31 de julio (contrato actualizado ese día) | `destino_only` |

En el motor, con el mismo fallo de atribución:

- `destino_only` **+ alguna unidad llegó** → `pendiente_evidencia`
  (`llegada_sin_atribucion`)
- cualquier otra estrictez → `no_cumplido` (`ninguna_unidad_coincidio_ruta`)

> 🟢 **El veredicto para la misma evidencia lo decide un campo de la política, y
> ese campo cambió dos veces en tres semanas.** La «tasa que va y viene» del §2
> no mide el fallo: mide cuándo el fallo se llamó pendiente y cuándo acusación.

🟡 **Inferencia:** la tasa real de producción del fallo **no baja**. Lo que baja
es cuántos se cuentan como pendientes.

---

## 2-ter. Lo que esto destapa, y es más grande que los 100

🟢 Medido sobre todo el histórico de Tecma, cruzando el veredicto sellado con la
política congelada y con si alguna candidata registró llegada:

| Sitio | Estrictez congelada | `no_cumplido` | …**con llegada registrada** |
|---|---|---|---|
| Planta 47 | `kml_full` | 241 | **133** |
| Planta 47 | `destino_only` | 50 | **0** |
| Campus | `kml_full` | 215 | **197** |

**330 servicios de Tecma están sellados `no_cumplido` con una unidad que sí llegó
a la geocerca.** Bajo `destino_only` esos mismos hechos habrían sido
`pendiente_evidencia`.

Los `destino_only` con llegada son **cero**, y no por casualidad: bajo esa
estrictez el motor los manda a pendiente por construcción. **Es la misma
bifurcación, vista desde el otro lado.**

🟢 **Que sea legítimo depende del contrato, y esta ficha no lo juzga.**
`kml_full` es una elección de producto válida: significa «exijo que se recorra la
ruta, no solo que se llegue». Un transportista que llega sin recorrer **sí**
incumple bajo esa regla.

🟡 **Lo que sí hay que decir, y es lo que le toca decidir a Asav:** de esos 330,
la compuerta que los reprobó es la misma A∧B del §4-bis — 🟢 y en el corte de
control, **300 de 319 servicios aprobados también fallan el tope de forma**, o
sea que el árbitro aprueba y reprueba con criterios que ninguna de las dos partes
puede leer desde el contrato. 🔵 El plan ya registró un antecedente de esta misma
familia: *«194 de 439 acusaciones eran imposibles de aprobar por construcción»*.

**Esta ficha no propone corregir ningún hecho sellado.** Lo enuncia porque una
acusación mal medida es una acusación, y el tamaño —330— es información que la
decisión necesita.

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

## 4-bis. CORRECCIÓN — el §4 de abajo estaba equivocado

**Escrito el 4 de agosto, después de medir el grupo de control. Se corrige aquí
en vez de borrarse: el §4 se mergeó y se leyó, y un error que se borra no avisa
a quien ya lo leyó.**

El §4 concluye que el tope de Fréchet de 0.8 km es lo que rechaza los 57.
🟢 **Es falso, y el propio dato que lo desmiente estaba a un query de distancia:**

> De los **319 servicios de Tecma que SÍ sellaron `cumplido`**, solo **19** están
> dentro de 0.8 km de Fréchet. Los otros **300 lo exceden y cumplieron igual.**
> Un tope que el 94 % de los aprobados incumple no es lo que rechaza a nadie.

🟢 **Y el código lo dice donde yo no leí.** `servedRoute` es:

```
arrivalAt !== null && (!hasKml || (observableEnough && routeMatchPct >= minKmlPct
                                   && corridorPrecisionPct >= minCorridorPct))
```

**`shapeOk` no aparece.** El comentario de la línea de arriba es explícito:
*«Fréchet / dirección desambiguan el ranking; el match duro es geocerca + A∧B.
Un tope duro de Fréchet descartaba recorridos reales con muestreo irregular.»*
Fréchet **ordena candidatas, no las rechaza**.

**Cómo se coló el error:** medí que 0 de 57 fallaban ese tope y lo leí como
causa. Cero de 57 es un dato correcto; «por eso los rechaza» era la
interpretación, y no la comprobé contra el grupo que sí pasa. Es exactamente lo
que el plan llama validar la medición y no la interpretación.

### La compuerta real, medida

🟢 La compuerta dura es **llegada ∧ tramo observable ∧ A ≥ 60 ∧ B ≥ 60**, donde
A es cobertura de ruta y B es precisión de corredor. Sobre los 57:

| Situación | Servicios |
|---|---|
| Alguna candidata con llegada cumple **A y B a la vez** | **0** |
| Pasa **A**, pero ninguna candidata pasa B | 27 |
| Pasa **B**, pero ninguna candidata pasa A | 26 |
| No pasa ninguna de las dos | 4 |

> 🟢 **Lo que rechaza a los 57 es que ninguna candidata cumple A y B juntas.**
> 53 de los 57 tienen una candidata que cumple **una** de las dos — nunca la
> misma candidata las dos.

🟡 **Inferencia, y es la hipótesis con más apoyo:** A alta con B baja es una
unidad que recorre la ruta y además otra cosa; B alta con A baja es una unidad
que recorre con precisión **solo un pedazo**. El reparto casi simétrico —27 y
26— es lo que se esperaría si **la ruta la sirve más de una unidad** (relevo,
cambio de unidad a media ruta) y ninguna sola cubre el trazado completo. **No
está medido.** Se prueba mirando si las candidatas que pasan A y las que pasan B
son unidades distintas dentro del mismo servicio.

### Qué queda de C12

🟢 `frechetMaxKm` **sigue estando horneado fuera de la política del contrato**, y
eso sigue incumpliendo la Ley 6. Lo que ya **no** se sostiene es que cause los
57: no rechaza a nadie, solo ordena. **Entra al plan porque está mal, no porque
resuelva esto.**

### Y la aritmética de 2, 3 y 5 km, que se pidió

🟢 Se corrió igual, y el resultado confirma la corrección desde otro lado:

| Tope de Fréchet | Rescatados (con A∧B) |
|---|---|
| 0.8 km (hoy) | 0 / 57 |
| 2 km | 3 / 57 |
| 5 km | 9 / 57 |
| **sin tope alguno** | **10 / 57** |

**Quitar el tope entero rescata 10.** El criterio era «si con 2 km pasan la
mayoría, es el umbral». No pasan: **el umbral no era.**

---

## 4. ¿Causa dominante o repartidas? — Dominante · ⚠ SECCIÓN CORREGIDA POR §4-bis

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

## 4-ter. Los 57 por ruta — ¿son las tres de C6?

🟢 **No.** Se reparten entre **15 rutas distintas**, todas las «- A» de Planta 47:

| Ruta | n | | Ruta | n |
|---|---|---|---|---|
| Sanders - A | 5 | | Riveras 9 - A | 4 |
| San Isidro - A | 5 | | Parajes del Sur - A | 3 |
| Finca - A | 5 | | Juarez Nuevo - A | 3 |
| **Centro - A** | 5 | | Safari - A | 3 |
| Riveras 7 - A | 5 | | Colinas - A | 2 |
| Sierra Vista - A | 5 | | Km 30 - A | 2 |
| Km 20 - A | 4 | | Finca Auxiliar - A | 2 |
| Oasis - A | 4 | | | |

🟢 **En las tres rutas que C6 nombra: 8 de 57 (14 %).** Y **Huertas - B no aparece
entre los 57** — está en C6 y no en este grupo.

🟡 **Inferencia:** no son tres trazados malos. Es **el conjunto completo de rutas
de un turno**, lo que apunta a algo compartido por todas —el turno, su ventana,
o el lote de KML que entró junto— y no a errores de dibujo ruta por ruta.
🟢 **Dato que lo apoya:** las 15 versiones de KML de las rutas «- A» se crearon
**todas el mismo día, el 14 de julio**, que es exactamente el día en que la
estrictez cambió a `kml_full`.

---

## 4-quater. La perilla no protege nada — respondido con el código

**La pregunta de Asav, textual:** *¿la comprobación de corredor que rechaza a los
57 corre siempre, o solo cuando `routeStrictness` está en `kml_full`?*

🟢 **Corre siempre que la ruta tenga KML. La estrictez no la toca.**

`routeStrictness` aparece **ocho veces** en el motor. **Siete son
`routeStrictnessApplied: input.routeStrictness`** — la copia al resultado, que no
decide nada. **La octava es la única que decide**, y es ésta:

```ts
// index.ts:980, dentro de  if (serving.length === 0) { ... }
const isDestinoOnly = input.routeStrictness === "destino_only";
```

Es decir: **se lee después de que `serving` ya salió vacío**, o sea después de
que la atribución **ya falló**. Solo elige el nombre del fallo.

La comprobación que rechaza no la mira:

```ts
const servedRoute =
  arrivalAt !== null &&
  (!hasKml ||                                    // <- la única condición que la apaga
    (observableEnough &&
      routeMatchPct      >= params.minKmlPct &&
      corridorPrecisionPct >= params.minCorridorPct));
```

> 🟢 **Lo que decide «¿basta con llegar?» no es el contrato: es si la ruta tiene
> KML cargado.** `!hasKml` es lo único que apaga A∧B. Con trazado cargado, A∧B
> corre aunque el contrato diga `destino_only`.

**Consecuencia, y es la que cierra el caso de los 61:** con `destino_only`, un
servicio cuya unidad llegó pero no pasa A∧B **no puede ser `cumplido` jamás**.
`serving` sale vacío → `isDestinoOnly && anyArrived` → `pendiente_evidencia`.
**Queda pendiente para siempre**, y ninguna re-verificación lo mueve mientras el
trazado y los umbrales sean los mismos.

🟡 **Inferencia:** la perilla se lee como *«¿exijo la ruta o basta el destino?»* y
hace otra cosa: *«cuando no pueda atribuir, ¿lo llamo pendiente o acusación?»*.
Entra al plan como **C14**.

---

## 4-quinquies. La cobertura — no es el proveedor

**Lo que exige hoy la política**, 🟢 leído de cada contrato:

| Contrato | estrictez | cobertura mín. | hueco máx. | A | B | corredor |
|---|---|---|---|---|---|---|
| Tecma 47 | `destino_only` | 80 % | 10 min | 60 % | **60 %** | **120 m** |
| Campus Santos Dumont | `kml_full` | 80 % | 10 min | 60 % | **50 %** | **150 m** |

> 🟢 **Planta 47 tiene el corredor MÁS ESTRICTO de los dos** —B ≥ 60 % dentro de
> 120 m contra B ≥ 50 % dentro de 150 m— y es la que falla. 🟡 Es un candidato
> directo para explicar por qué el Campus no tiene ni un `llegada_sin_atribucion`,
> y **no está medido**: se prueba recalculando B de Planta 47 con 150 m.

**Lo que entrega Umbrella**, 🟢 medido sobre los puntos guardados:

| Semana | pts/servicio | mediana entre puntos | peor hueco |
|---|---|---|---|
| 6 jul | 4 680 | 1.0 s | 2.0 min |
| 13 jul | 3 917 | 1.1 s | 1.0 min |
| 20 jul | 3 834 | 1.1 s | 1.0 min |
| 27 jul | 4 378 | 1.0 s | 0.7 min |
| 3 ago | 4 864 | 1.0 s | 2.0 min |

🟢 **El proveedor NO emite más lento que el hueco máximo.** Un punto por segundo
contra una tolerancia de 10 minutos; el peor hueco agregado es 2 min. **La
hipótesis del proveedor queda descartada como causa general.**

🟢 **Pero los 28 que fallaron cobertura son otra cosa:** traen **13 a 46 puntos**
—contra ~4 000 de media— y huecos de **19.7 a 40 minutos**. Fallan **las dos
condiciones a la vez**, el porcentaje y el hueco.

🟡 **Inferencia:** no es cadencia del proveedor, es **evidencia ausente en esos
servicios concretos**. Si el aparato estaba apagado, si la unidad no salió, o si
el proveedor perdió ese tramo, **es una pregunta distinta y no está medida.**

---

## 4-sexies. El reparto A/B — no se turnan, están en extremos opuestos

**La pregunta de Asav:** ¿son las mismas unidades las que fallan cada condición o
se turnan? Y si una cumple cobertura, ¿qué tan lejos queda de cumplir corredor?

🟢 Medido sobre los servicios con `llegada_sin_atribucion`:

| Situación | Servicios |
|---|---|
| Alguna unidad pasa A **y** alguna pasa B, **y es la MISMA** | **0** |
| ...y son unidades **distintas** (se turnan) | **1** |
| Solo se cumple **una** de las dos condiciones, por nadie más | **60** |

**No se turnan: en 60 de 61 servicios ni siquiera hay dos unidades que se
repartan las dos condiciones. Simplemente una de las dos no la cumple nadie.**

Y la distancia a la otra condición **no es un rozar**:

| | Mediana de lo que le falta |
|---|---|
| A la unidad que **sí** cumple cobertura, para cumplir corredor | **53.3 puntos** (B ≈ 6.7 %) |
| A la unidad que **sí** cumple corredor, para cumplir cobertura | **54.1 puntos** (A ≈ 5.9 %) |

> 🟢 **Están en extremos opuestos, no cerca del umbral.** Una unidad que cubre
> ≥ 60 % del trazado tiene el **6.7 %** de sus puntos dentro del corredor; una que
> tiene ≥ 60 % de sus puntos en el corredor cubre el **5.9 %** del trazado.

🟡 **Inferencia — y descarta mi hipótesis anterior del relevo.** Dije que parecía
una ruta servida por varias unidades. **Con 0 casos de la misma unidad y 1 de
unidades distintas, eso no se sostiene.** Lo que describen estos números son dos
formas de traza incompatibles con el trazado: una que **pasa cerca de casi todos
los waypoints pero anda mayormente fuera** —un recorrido mucho más largo que
incluye la ruta— y otra que **anda muy pegada al trazado pero solo por un
pedacito**. Ninguna de las dos es «casi cumple».

---

## 4-septies. Los 330 — los tres cortes

**Primero, lo que cambia la lectura entera** *(aclaración de Asav, 5 de agosto)*:

> 🔵 **Nadie los ha visto.** El único usuario del sistema es Asav; ningún cliente
> ni carrier ha recibido un resultado, y los cambios de `routeStrictness` del 14 y
> del 31 de julio los hizo él. **No hay acusación emitida contra nadie.**
>
> Eso **baja la urgencia y no cierra la pregunta**: el día que esto sea
> vinculante, ese campo es una cláusula.

### ¿Quedó rastro del cambio?

🟢 **No, y el lugar donde debería estar existe y está vacío.**

- La tabla `contract_policy_history` **existe** (migración 0015) con la forma
  exacta que haría falta: `policy_before` · `policy_after` · `actor_kind` ·
  `actor_id` · `note` · `changed_at`.
- 🟢 **Cero filas en toda la base**, no solo para Tecma.
- 🟢 **Ningún código escribe en ella.** Está declarada en el esquema y en los
  repositorios, y no hay un solo `insert`.

**Lo único que queda del cambio es `service_contracts.updated_at`** — una fecha,
sin antes, sin después, sin quién y sin por qué. El estado real solo se puede
reconstruir **desde las consecuencias**: la política congelada dentro de cada
hecho sellado.

🟡 **Inferencia:** es un candado escrito y nunca conectado — la misma forma que
`canAccessPlant` y `ClientRole`. La regla 8 aplicada a la auditoría: **una tabla
de historial vacía no se distingue de una que no existe.**

### El desglose por contrato y fecha

🟢 `no_cumplido` bajo `kml_full` **con una unidad que sí llegó**:

| Semana de servicio | Campus | Planta 47 |
|---|---|---|
| 6 jul | 14 | — |
| 13 jul | 52 | **60** |
| 20 jul | 52 | **59** |
| 27 jul | 54 | **14** |
| 3 ago | 30 | — |

**Planta 47 solo aparece en las tres semanas en que estuvo en `kml_full`.** El
Campus aparece en todas, porque nunca salió de esa estrictez.

### Qué dice el campo hoy

🟢 Leído de `service_contracts.policy` el 5 de agosto:

| Contrato | `routeStrictness` hoy | actualizado |
|---|---|---|
| Tecma 47 — Transporte Personal | **`destino_only`** | 31 jul 2026 |
| TECMA Campus Santos Dumont | **`kml_full`** | 20 jul 2026 |

---

## 4-octies. Nota de vigencia — los datos se movieron

🟢 Entre el 4 y el 5 de agosto el corte cambió solo:

| Razón | 4 ago | 5 ago |
|---|---|---|
| `llegada_sin_atribucion` | 57 | **61** |
| cobertura insuficiente | 28 | 28 |
| observación insuficiente | 10 | 10 |
| evidencia indisponible | 5 | 5 |
| **total** | **100** | **104** |

**Los cuatro nuevos son todos de la causa dominante.** Confirma en un día lo que
el §2 midió por semana: **sigue produciéndose.** Las cifras de esta ficha llevan
su fecha por eso.

---

## 4-nonies. Por qué falta la evidencia en los 28 — es C3, visto

Era la única pregunta que la investigación había dejado abierta.

🟢 **Los 28 no están repartidos: caen en dos días consecutivos.**

| Día | Servicios | Sitio |
|---|---|---|
| 27 de julio | 13 | Campus |
| 28 de julio | 15 | Planta 47 |

🟢 **No es de unidades ni de aparatos.** Los puntos guardados **de toda la base**,
por día:

| Día | Puntos | Aparatos |
|---|---|---|
| 20–24 jul | 180 k – 218 k | 52–54 |
| **25 jul** (sáb) | **8 996** | 48 |
| **26 jul** (dom) | **3 482** | 47 |
| 27 jul | 200 669 | 50 |
| **28 jul** | **103 080** | 52 |
| **29 jul** | **371 891** | 51 |
| 30–31 jul | 222 k – 228 k | 51–52 |

Los desplomes del 25–26 de julio y del 1–2 de agosto son **fines de semana** y no
tienen nada de raro. Lo que sí lo tiene es el par **28 con la mitad · 29 con el
doble**.

### La comprobación decisiva

🟢 Para cada uno de los 28, cuántos puntos vio el motor al sellar contra cuántos
hay hoy en ese mismo viaje y ese mismo día:

| Al sellar | Hoy |
|---|---|
| 13 puntos · cobertura 38.5 % | **370 – 420** |
| 43 puntos · cobertura 46.7 % | **1 992** |
| 46 puntos · cobertura 69.6 % | **1 269 – 1 389** |

> 🟢 **28 de 28 tienen hoy más del doble de puntos que cuando se selló su
> veredicto.** La evidencia no faltaba: **todavía no había llegado.**

🟡 **Inferencia:** el archivador se atrasó y se puso al día el 29 —de ahí el día
con el doble—, y los servicios del 27 y 28 se juzgaron con el expediente a
medias. **Esto no es una causa nueva: es C3 —«se juzga antes de que llegue el
expediente»— observada directamente**, con el número que el plan estimaba (~7 h
de atraso, p95 30 h) hecho consecuencia visible.

**Lo que NO se midió:** por qué el archivador se atrasó ese fin de semana.

---

## 4-decies. El recálculo con los umbrales del Campus

**La pregunta:** ¿cuántos de los 61 pasarían con B ≥ 50 % en 150 m, que es lo que
usa el Campus?

### Primero el control — regla 9 aplicada a mi propio método

Antes de recalcular a 150 m se recalculó a **120 m** y se comparó contra lo que el
ledger ya tenía guardado. Si no reproducía, el número a 150 m no valdría nada.

🟢 **3 054 de 3 054 candidatas coinciden · desviación mediana 0.0 puntos.** El
recálculo es exacto.

> **El primer intento falló el control (0 de 0 emparejadas) y por eso no se
> reporta.** Destapó dos cosas: el ledger escribe el campo como **`imei:` y
> guarda un id de UNIDAD** —quien lea el expediente creerá que es el aparato— y
> el trazado hay que tomarlo de `kml_version_id` de la ocurrencia, que las 61
> traen, y no derivarlo por vigencia.

### El resultado

| Umbrales | Pasan A ∧ B |
|---|---|
| **120 m · B ≥ 60** — los de hoy | **0 de 61** |
| 120 m · B ≥ 50 — solo aflojar B | **16** |
| 150 m · B ≥ 60 — solo ensanchar | **13** |
| **150 m · B ≥ 50** — los del Campus | **17 de 61** |

🟢 **Adoptar la política del Campus rescataría 17 de 61 — el 28 %.** 🟡 **La
política explica alrededor de un cuarto del problema, no el problema.** Los otros
44 seguirían pendientes con los umbrales más flojos de los dos contratos que
existen.

---

## 4-undecies. Los 330, por contrato y fecha

🟢 `no_cumplido` bajo `kml_full` **con llegada registrada**, al 5 de agosto son
**335** (eran 330 el 4 — sigue creciendo):

| | Total | Rango de fechas |
|---|---|---|
| **Planta 47** | **133** | 14 → 30 de julio |
| **Campus** | **202** | 9 de julio → **5 de agosto** |

**Planta 47 aparece solo dentro de la ventana en que estuvo en `kml_full`** —
empieza el **14 de julio**, el día exacto del cambio, y termina el 30. **El
Campus aparece todos los días hasta hoy**, porque nunca salió de esa estrictez.

🟢 **El Campus sigue produciéndolos: 5 el 5 de agosto.** No es un episodio
cerrado.

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
