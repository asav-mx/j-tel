# Handoff — La investigación de los 71

> ## ⚠ ARCHIVADO CON CORRECCIONES · 4 de agosto de 2026
>
> Este handoff **ya se ejecutó**. El resultado vive en
> `docs/marco-limpio/Ficha-Diagnostico-Pendientes-Sin-Atribucion.md`.
>
> Se archiva **con las correcciones dentro y no aparte**, porque un handoff
> guardado se vuelve a leer y un error corregido en otro documento no viaja con
> él. Las correcciones van marcadas **⚠ CORRECCIÓN** en el punto exacto donde
> estaba el error.
>
> **Tres cosas salieron mal en este documento, y ninguna era de mala fe: eran
> supuestos que nadie había medido.**
>
> 1. **El método daba por hecho que el ledger guarda la razón de cada
>    verificación.** Solo la guarda en dos de los cuatro caminos. Seguido al pie
>    de la letra, el corte habría salido **en verde sobre 67 de 100, perdiendo 33
>    en silencio**. Corregido en §3. *(Corrección de Asav, que escribió el
>    handoff.)*
> 2. **El alcance eran 71 y son 100.** Los 71 son la ventana vieja de algo vivo.
>    Corregido en §1.
> 3. **«8 de diferencia eran de Honeywell» no cuadra con la medición de hoy.**
>    Corregido en §1.

**Para:** un chat nuevo, dedicado solo a esto.
**Fecha del corte:** 4 de agosto de 2026.
**Modelo recomendado:** Opus. Es investigación sobre el motor del árbitro.

---

## 0. Qué es esto, y qué NO es

**Es:** entender por qué 71 servicios de Tecma, **con su evidencia GPS completa
guardada**, no lograron que el motor dijera qué unidad los hizo.

**No es:** arreglarlos. No se toca el motor en este chat. No se sella nada, no se
re-verifica nada, no se abre una rama de código. **Solo lectura.**

**Por qué importa más que cualquier otra investigación pendiente:** la definición
de v1 de Asav es *"poder mostrar evidencia del ≥90% de los perfiles al cierre de
cada turno, y si algo salió no cumplido, poder decir qué se hizo y por qué"*.

Un servicio atorado en `pendiente_evidencia` para siempre **es exactamente una
falla de mostrar**. Estos 71 no contribuyen al 90%: **son el 90%.**

---

## 1. Lo que está verificado

Medido contra producción el 3 de agosto, con usuario de solo lectura.

| Dato | Valor |
|---|---|
| Servicios en `pendiente_evidencia` con más de 48 h | **71** |
| Rango de fechas | 9 al 31 de julio de 2026 |
| Contrato «Tecma 47 - Transporte Personal» | 54 |
| Contrato «TECMA Campus Santos Dumont» | 17 |
| **Cuántos tienen evidencia GPS guardada** | **71 de 71** |
| Cuántos tienen unidad observada | 0 |

**Ninguno está pendiente por falta de datos.** El expediente está lleno y el juez
no pudo decir quién fue.

> **⚠ CORRECCIÓN — el alcance era mayor.** Medido el 4 de agosto: los servicios
> de Tecma en `pendiente_evidencia` son **100**, no 71. Los 71 son los que
> llevaban más de 48 h sellados; los otros 29 se sellaron después.
>
> **Y hay una coincidencia que lo escondía:** filtrar «>48 h» da 71 y filtrar
> «9–31 de julio» da **también 71**, seleccionando **las mismas filas**. Por eso
> el número se leyó como «los 71 de julio» sin que nada chirriara.
>
> **La pregunta correcta:** no por qué 71 servicios de julio quedaron sin
> atribuir, sino **por qué el sistema sigue produciendo servicios con evidencia
> completa y sin unidad atribuida.**

**Ojo con el número:** un reporte anterior hablaba de **79**. Los 8 de diferencia
eran de **Honeywell, que es cuenta de ejemplo sin operación real**. Están
excluidos y no vuelven a entrar a ningún conteo, análisis ni conversación. La
única cuenta con operación real es **Tecma**.

> **⚠ CORRECCIÓN — el número de Honeywell.** Medido el 4 de agosto, Honeywell
> tiene **9** pendientes, no 8, y PRUEBA REAL ninguno. **Lo que no cambia** es la
> regla: quedan fuera de todo conteo, y la exclusión se hace por `is_demo` y
> **nunca por nombre** — el código no conoce nombres.

---

## 2. La pregunta

> **¿Por qué el motor no atribuyó unidad, teniendo el expediente completo?**

Y la de segundo orden, que es la que decide el trabajo que sigue:

> **¿Es una sola causa dominante, o son varias repartidas?**

Si es una, hay una pieza que arreglar y probablemente mueve el número entero. Si
son cuatro repartidas, no hay atajo y el orden lo decide el Tramo 2 del plan.

---

## 3. El método aprobado

Lo propuso Devin y Asav lo aprobó. **No teorizar antes de medir.**

**Paso 1 — Separar los 71 por dónde falló la atribución.** El ledger ya guarda la
razón de cada verificación. Agrupar por esa razón. Las categorías conocidas:

- Cobertura por debajo del umbral
- Ninguna candidata dentro del corredor
- Origen no observado
- El filtro de candidatas los descartó

> **⚠ CORRECCIÓN — este paso, seguido literal, sale en verde midiendo de menos.**
>
> **El ledger NO guarda la razón de cada verificación.** El motor tiene **cuatro**
> caminos hacia `pendiente_evidencia` y **solo dos escriben un paso `decision`
> con su `reason`**:
>
> | Camino | ¿Escribe `decision.reason`? |
> |---|---|
> | `evidencia` / `indisponible` — cero puntos GPS | **No** |
> | `cobertura_evidencia` / `insuficiente` | **No** |
> | `decision` · `llegada_sin_atribucion` | Sí |
> | `decision` · `observacion_insuficiente` | Sí |
>
> Agrupar por `decision.reason` habría clasificado **67 de 100** y perdido **33
> en silencio** — sin error, sin hueco visible, con cara de corte completo.
>
> **Cómo se hace bien:** clasificar leyendo **los cuatro caminos**, y **contar
> los no clasificados como categoría propia**. Si esa categoría no sale cero, el
> corte no está terminado. Es la regla 8 del plan: una clasificación que no
> distingue «no fue por esto» de «no lo escribí» no clasifica.

**Paso 2 — Cortar por contrato.** 54 de Planta 47 contra 17 del Campus. Existe una
diferencia medida y **sin causa identificada**: Planta 47 sella el **6.7%** contra
**55.2%** del Campus. La hipótesis de Asav —marcada como hipótesis, no como
dato— es que es el mismo problema. **Hay que medirlo, no asumirlo.**

> **⚠ RESULTADO — la hipótesis se midió y era que no.** El Campus **no tiene ni un
> solo** `llegada_sin_atribucion`; los 57 son todos de Planta 47 y todos del
> Turno A. Los dos sitios fallan por razones distintas. Y los porcentajes hoy son
> **8.8 % y 54.0 %**.

**Paso 3 — Decir contra qué lista se compara.** El documento del plan decía «seis
modos de falla» y su propia tabla listaba ocho; hoy son **once**. Al reportar, no
decir «es la séptima»: decir **contra cuántas y cuáles** se comparó.

---

## 4. Reglas que no se rompen

- **Solo lectura.** Usar el usuario de solo lectura. Ninguna escritura contra
  producción.
- **Verificado, reportado o inferencia.** Cada afirmación se marca con cuál de las
  tres es. No colapsarlas.
- **Honeywell y PRUEBA REAL no existen.** Son cuentas de ejemplo. Fuera de todo
  conteo.
- **No proponer política.** Si la investigación destapa que hace falta una regla
  de cierre para el pendiente por evidencia, eso lo decide Asav con la planta y
  con legal. Aquí solo se mide.
- **Nada se re-verifica.** Cada re-verificación mete una versión más en la
  historia del hecho. No es gratis.

> **Las cinco se respetaron.** Y la segunda es la que atrapó el error del §6 de
> la ficha: medir que 0 de 57 fallan un tope era el **dato**; decir que por eso
> los rechaza era la **interpretación**, y no se sostuvo contra el grupo de
> control.

---

## 5. Lo que ya se descartó, para no repetirlo

- **No es falta de evidencia.** Los 71 tienen puntos GPS guardados.
- **No es el proveedor de GPS.** Umbrella no entregó un solo punto en 30 días; el
  motor ya solo lee la memoria propia y eso no costó ningún veredicto.
- **No es la cuenta demo.** Esa causa se midió aparte (84 hechos) y su llave se
  cerró el 3 de agosto.
- **No es «el carrier llegó tarde».** El Anexo del 23 de julio lo afirmaba y el
  plan del 30 de julio lo retiró con datos: **194 de 439 acusaciones eran
  imposibles de aprobar por construcción**, y en Huertas-B el 96% de los puntos
  GPS caen a menos de 150 m del trazado. El camión iba bien; el árbitro no sabía
  leerlo.

> **⚠ NOTA — el último punto resultó ser la pista más grande.** La investigación
> midió **330 servicios de Tecma sellados `no_cumplido` con una unidad que sí
> llegó a la geocerca**. Es la misma familia que esas 194, y el tamaño de hoy
> está en la ficha.

---

## 6. Causas conocidas que podrían explicarlo

De las once del plan, estas cinco son las candidatas plausibles. **Sirven de
hipótesis, no de conclusión.**

| Causa | Por qué podría ser |
|---|---|
| **Ventana derivada vs. match observable** | No están afinados entre sí: +50 se enderezan por uno y −2 se caen por el otro. Espera historia en `route_traversal_measurements` |
| **Trazado KML que no corresponde** | Huertas-B, Centro-A, Parajes del Sur-A · ~43 servicios. Falla real de trazado, no de reloj. Requiere que **una persona abra el KML en un visor** y lo compare a ojo |
| **La geocerca congelada no es la que se usa** | El hecho guarda una geocerca y el motor juzga contra otra. **546 ocurrencias divergen** |
| **`maxRouteDurationMinutes` fijo en 60** | Segundo «cuánto dura una ruta» sin derivar |
| **Variantes no congeladas** | El conjunto de variantes evaluadas no se guarda dentro del hecho. Si el carrier corre una desviación legítima, el sistema no tiene cómo aprenderla |

> **⚠ RESULTADO — ninguna de las cinco explica los 57.** La causa medida es que
> **ninguna candidata cumple A (cobertura ≥ 60 %) y B (corredor ≥ 60 %) a la
> vez**: 27 cumplen A, 26 cumplen B, **cero cumplen las dos**. Y las tres rutas
> del KML solo aportan **8 de 57**; **Huertas-B no aparece**.

---

## 7. Qué se necesita de Asav

**Nada para empezar.** La investigación es de solo lectura y Devin puede correrla
con lo que ya tiene.

Lo que sí se le va a pedir **según lo que salga**:

1. **Si sale que el KML no corresponde** → hace falta que una persona abra esos
   trazados en un visor y los compare a ojo. Trabajo humano, no de código.
2. **Si sale que el Turno B de Planta 47 pesa** → hace falta una conversación con
   la Planta: el turno está declarado a las 18:00 y se opera cerca de las 14:00.
   Eso no se arregla con código.
3. **Si sale una causa dominante** → decidir si se arregla antes o después de la
   ficha de consolidación (Tramo 2 del plan).

**Y una decisión que probablemente se destape:** si al final quedan servicios que
nunca van a poder atribuirse, hace falta la **regla de cierre del pendiente por
evidencia** — cuánto tiempo puede quedarse ahí y qué pasa después. Esa la define
Asav con la planta y con legal, **no este chat**.

> **⚠ CORRECCIÓN al punto 2 — es el Turno A, no el B.** Los 57 son **todos del
> Turno A, declarado 06:00**. El Turno B de D2 es otro turno. **Resolver D2 no
> mueve estos 57**, aunque la conversación con la Planta siga haciendo falta.

---

## 8. Cómo termina bien esta investigación

Con un reporte que diga, en este orden:

1. **El corte de los 71 por razón de fallo**, con números.
2. **El corte por contrato**, y si la diferencia 6.7% vs 55.2% se explica o no.
3. **Si hay causa dominante o están repartidas.**
4. **Contra qué lista de causas se comparó**, dicho explícitamente.
5. **Qué se puede medir sin sellar nada**, y qué requeriría tocar el motor.
6. **Qué necesita de Asav**, separando: decisión de negocio · trabajo humano ·
   conversación con la Planta.

**No termina con un arreglo.** Termina con la ficha que le dice al Tramo 2 y al
Tramo 3 en qué orden trabajar.

> **Terminó así.** Ver `Ficha-Diagnostico-Pendientes-Sin-Atribucion.md`, que
> además lleva dos cortes que este handoff no pedía y que Asav agregó al
> corregir el alcance: **los 29 recientes** y **la tasa de entrada por semana**.

---

## 9. Contexto mínimo del producto

Para que el chat nuevo no pida lo que ya está decidido:

- **J-Telemetry es un árbitro**, no una herramienta de telemetría. El activo es el
  veredicto que las dos partes aceptan, no el dato.
- **Servicio = ruta × turno × fecha.** El GPS es un dispositivo, no una unidad.
- **Tres estados y nada más:** `cumplido` · `no_cumplido` ·
  `pendiente_evidencia`. «Tarde» es un motivo bajo `cumplido`, nunca un cuarto
  estado.
- **Los hechos se calculan una vez y se congelan.** La política cambia hacia
  adelante y nunca reescribe el pasado.
- **Falta de evidencia nunca es incumplimiento.**
- **La matemática decide; la IA explica.** Ningún asistente toca el veredicto.
- **Planta 47 es el laboratorio, no el paciente.** Si un arreglo solo tiene
  sentido por una ruta específica, es caso de uso y va mal.
- **El idioma nativo del sistema es el español.**

La ley suprema es `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`. El
orden lo manda `docs/PLAN.md`. El backlog es `docs/DESPUES.md`. **No hay más
documentos vivos.**
