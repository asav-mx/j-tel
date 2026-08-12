# Ficha — La ventana congelada, y el arranque que el árbitro tiene y no mira

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y el `PLAN.md`.
**Fecha de medición: 12 de agosto de 2026, 17:15 UTC** · **Alcance:** solo
lectura con `jtel_readonly` —comprobado ese día: **42 tablas, 42 legibles, cero
escribibles**—. **No se selló nada, no se re-verificó nada, ningún hecho cambió
de versión.** Todos los conteos excluyen `is_demo` por los dos lados: solo Tecma.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

**Qué es:** la ficha de **dos frentes hermanos**, y van juntos a propósito porque
el segundo produce el insumo que el primero necesita para avisar:

| | Frente | Estado |
|---|---|---|
| **A** | **La ventana se congela al crear el viaje y nadie la revisa** | Diseñado aquí. Arreglo conocido: el cron que revisa y avisa |
| **B** | **El árbitro tiene el arranque real y no lo mira** | **Sin diseñar.** Aquí van sus dos leyes, escritas antes del diseño |

**El instrumento:** `packages/db/src/medir-ventana-congelada.ts` ·
`pnpm --filter @jtel/db medir-ventana-congelada`. Toda cifra de esta ficha sale
de ahí y se puede volver a correr.

---

## 1. El mecanismo, leído en el código

`trips.evidence_window_start` / `_end` se calculan **una vez, al crear el
viaje**, con `computeEvidenceWindow` sobre la historia que la ruta tenía **ese
día**. 🟢 **Nada la vuelve a mirar nunca.** Los únicos dos sitios del repo que
escriben esa columna después están los dos guardados, y de una forma que importa
para §4:

| Quién escribe la ventana | Guarda |
|---|---|
| `corregir-deadlines.ts:404` | Solo si **no existe hecho** para esa ocurrencia y el viaje sigue `en_espera` |
| `reverificar-zona-planta47.ts:180` | Dentro de una **re-verificación completa**: mueve la ventana *y vuelve a juzgar* |

Y la ventana **se deriva de algo que crece**: `route_traversal_measurements`
suma ~48 filas al día. 🟢 **Medido: 29 mediciones nuevas el 12 de agosto, 48 el
11, 48 el 10.** O sea que *la ventana que hoy se derivaría* para un servicio del
12 de julio **no es la que se le congeló entonces, y se aleja un poco más cada
día**.

> **Es la forma de C21 en un tercer campo.** *Congelar sin forma de revisar es el
> patrón, no el campo* — ya pasó con la hora límite (C21) y con la geocerca (C4).
> ✅ **Resuelto el 12 de agosto: la ventana congelada NO lleva número propio — es
> la tercera población de C21**, porque el mecanismo es idéntico y partirlo
> repartiría la misma causa en tres filas. **Lo que sí se llevó número propio es
> otra cosa, y salió de tirar de este hilo: `C24`**, en §4.3.

---

## 2. Lo medido, y las tres preguntas contestadas

### 2.1 La población

| Contrato | `no_cumplido` | La duración **mediana** de su ruta ya excede lo que su ventana abrió | Con la **máxima** medida |
|---|---|---|---|
| Campus | 288 | **0** | **85** |
| Planta 47 | 309 | **73** | **286** |

🔵 El #288 registró **85** con la mediana en Planta 47 y **83** con la máxima en
el Campus. Hoy dan **73** y **85**. ⚠ **No se pudo reproducir el 85: la consulta
de aquella medición no se commiteó, solo su resultado.** Las mediciones crecieron
entre las dos corridas, lo que explica el movimiento del Campus; **el de la
mediana de Planta 47 no se puede atribuir sin la consulta original.** Es el
argumento entero de por qué este sensor se commitea: **un número sin instrumento
no se puede volver a mirar, y a los tres días ya nadie sabe si cambió el dato o
cambió la pregunta.**

### 2.2 ¿Cuántos de los 286 cambiarían de veredicto con la ventana de hoy?

⚠ **Esa pregunta no se puede contestar leyendo, y contestarla de todos modos
sería §D del Marco.** Un veredicto sale de correr el árbitro: otra ventana es
otra evidencia, otro emparejamiento entre candidatas y otro sello. **Eso es
simulación, y vive en D4 / Tramo 6.** Lo que sí se puede medir es **cuántos se
juzgarían sobre evidencia distinta**, que es su cota superior:

| | |
|---|---|
| **TODOS** los no cumplidos (los dos contratos) | 597 |
| De ésos, **la ventana de hoy abre antes** | **581 · 97.3 %** |
| De los **286** de Planta 47 | **286 · 100 %** — ninguno igual, ninguno más angosto |
| Cuánto antes abriría, Planta 47 | **p50 +34 min · p90 +47 · máx +55** |
| Cuánto antes abriría, Campus (85) | p50 +21 · p90 +26 · máx +26 |

🟢 **Y en el tramo que se abriría de más ya hay evidencia propia guardada**, de
la misma candidata que el ledger dejó con más coincidencia de trazado: **344 de
359 medibles (95.8 %) tienen algún punto ahí, y 179 (49.9 %) tienen puntos en
movimiento.** No hay que salir a buscar nada: está en la memoria, del otro lado
de un recorte.

> ⚠ **El 100 % de los 286 está contaminado por construcción y hay que decirlo:**
> §2.1 los selecciona justo por *«la ruta dura más que lo que su ventana abrió»*,
> que es casi el criterio con el que la derivación decide ensanchar. **Su 100 %
> es la definición mirándose al espejo.** La cifra que sí compara algo es la de
> arriba: **581 de 597**, sobre todos los acusados sin seleccionar ninguno.

### 2.3 ¿Cuántos de los 397 con llegada registrada están entre los 286?

🟢 **116.** Y el reparto completo, que es lo que contesta la pregunta de fondo:

| | Campus | Planta 47 | Total |
|---|---|---|---|
| `no_cumplido` | 288 | 309 | 597 |
| Con **llegada registrada** en el ledger vigente | 264 | 133 | **397** |
| En la población de §2.1 | 85 | 286 | 371 |
| **En las dos cosas a la vez** | **81** | **116** | **197** |

> **La respuesta a «si se solapan mucho, es una sola causa con dos nombres»: no
> se solapan mucho, y son dos.** De los 286, **170 no tienen ninguna llegada
> registrada** — a ésos la ventana no los explica por la vía de la atribución. De
> los 397, **200 están fuera de la población** — a ésos no los explica una
> ventana corta. **Sólo 116 son las dos cosas.**
>
> 🟢 **Y el reparto no es igual en los dos contratos, que es el dato que lo
> parte:** en el Campus el solape es **81 de 85 (95 %)** y en Planta 47 **116 de
> 286 (41 %)**. Donde la ventana es el problema chico —el Campus, +21 min— casi
> todos los acusados sí tuvieron llegada; donde es grande —Planta 47, +34 min—
> la mayoría ni eso. **Son dos poblaciones con dos historias, no una con dos
> nombres.**

### 2.4 De los 286, ¿en cuántos hay puntos GPS antes del inicio de su ventana?

🟢 **En los 286. El cien por ciento.** El dato ya está; sólo falta mirarlo.

Pero «hay puntos» es la pregunta floja, y contestarla sola sería vender un 100 %
que no significa nada. ⚠ **La primera versión de este sensor preguntaba por «los
aparatos del viaje» y daba 100 % en todo — porque un `trip` guarda puntos de la
flota entera del carrier: 🟢 mediana de 52 aparatos distintos por viaje en Planta
47 y 51 en el Campus, sobre los 597 no cumplidos.** Preguntar «¿alguno se movía?»
sobre cincuenta camiones contesta que sí siempre. La medición buena pregunta por
**una** candidata: la que el ledger dejó con más coincidencia de trazado.

| Sobre la mejor candidata de cada servicio | Planta 47 | Campus |
|---|---|---|
| Medibles (con candidata identificable) | 286 de 286 | 73 de 85 |
| **1 · Con puntos propios antes de su ventana** | **286 · 100 %** | 73 · 100 % |
| **2 · Ya venía RODANDO cuando la ventana abrió** | **114 · 39.9 %** | 45 · 61.6 % |
| 3 · Cuántos minutos antes arrancó (los dos juntos) | p50 **27** · p90 **63** · máx **179** | |

«Ya venía rodando» = movimiento (> 5 km/h) en los 15 minutos **anteriores** al
inicio de la ventana **y** en los 15 posteriores: el camión cruzó ese borde
andando. «Arrancó» = su primer punto en movimiento después de la última parada de
10 minutos o más — sin ese corte se estaría midiendo cuándo se prendió el
aparato, no cuándo salió el camión.

---

## 3. Frente A — El cron que revisa la ventana y avisa

**Es el mismo arreglo de C21, en el otro campo.** No se inventa nada: las cuatro
opciones ya se pesaron el 7 de agosto y el veredicto no cambia porque cambie la
columna. Regenerar al detectar es C13 otra vez (los disparadores se saltan);
derivar al leer choca con la ley del hecho congelado.

### 3.1 Qué revisa

**Solo lo que todavía no se ha juzgado.** Para cada ocurrencia **sin hecho
sellado** y con viaje `en_espera`:

1. Lee su `trips.evidence_window_start` congelada.
2. Deriva la que hoy saldría: `computeEvidenceWindow(deadline, política, ruta)`
   con la historia que `route_traversal_measurements` tiene **hoy** — la misma
   función que usa el generador, no una copia.
3. Compara. Si difieren, es una desalineada.

**Corre una vez al día, después del generador**, en el mismo sitio de
`vercel.json` donde ya corre `revisar-horas-limite`. La razón de que sea diario
y no más seguido es la de C21 y no ha cambiado: **la causa es la historia
creciendo, no un incidente**, y una alerta que grita seguido enseña a ignorarla.

**Un cero tiene que distinguirse de un medidor ciego:** si la revisión no
encontró **nada que revisar**, responde 503, igual que su hermano. Con la ventana
rodante generando treinta días por adelantado, cero ocurrencias sin sellar no es
salud: es una lectura rota.

### 3.2 Qué avisa

Un correo por el canal de verdad, agrupado **por ruta×turno** y no por servicio
—si un ruta-turno se desalineó, se desalinearon sus treinta ocurrencias futuras y
treinta renglones idénticos no son treinta hallazgos—, diciendo:

- **Cuántas** ocurrencias sin sellar corren hoy con una ventana que su ruta ya no
  produce, y de qué ruta×turno.
- **Cuánto** difieren: minutos congelados contra minutos de hoy.
- **Por qué** cambió: la duración medida se movió (con cuántas muestras nuevas),
  o la política del contrato cambió. Son dos causas distintas y el aviso las
  separa.
- **Qué NO dice:** si eso cambiaría algún veredicto. No lo sabe y no lo insinúa.

### 3.3 Qué NO hace, y es la decisión

**No corrige.** Un cron que corrige en silencio la ventana con la que se va a
juzgar a un transportista **no se distingue de uno que no corre** (regla 8), y su
resultado llega sellado a un cliente. **Corregir es decisión de Asav.**

⚠ **Y la compuerta que este frente hereda entera:** C21 sigue con «detectar está
probado; avisar no» — nadie ha visto el correo llegar a una bandeja. 🔵 Las
llaves de Resend no existen fuera de producción. **Este cron nace con la misma
deuda y no debe contarse como cerrado hasta que su aviso se vea llegar**, por el
mismo simulacro (`?simular=1`) que ya existe.

---

## 4. ¿Se pueden re-dimensionar las ventanas ya congeladas sin tocar un hecho sellado?

**La pregunta tiene tres poblaciones y tres respuestas distintas.**

| Población | ¿Se puede? |
|---|---|
| **Sin hecho sellado** (futuras y pendientes) | ✅ **Sí, y no es re-verificar.** Es corregir el marco antes de que haya juicio. Precedente exacto: `corregir-deadlines.ts` ya lo hace, revalidando *dentro* del `UPDATE` que no exista hecho |
| **Con hecho sellado** | ❌ **No, y la trampa es que mecánicamente sí se puede** |
| **Con hecho sellado, queriendo moverla de verdad** | Es **re-verificación**: firma, motivo canónico y una versión más en la historia. **D4** |

### 4.1 Por qué el «sí se puede» del caso 2 es la trampa

🟢 **La ventana NO vive dentro del hecho.** `compliance_facts` congela la
política byte a byte (`contract_policy_snapshot`), el deadline, la geocerca
esperada, la unidad, el rigor aplicado — **y no guarda la ventana**. La ventana
vive en `trips`, una fila 1-a-1, editable, que nadie versiona.

Entonces un `UPDATE trips SET evidence_window_start = …` deja la fila de
`compliance_facts` **intacta**. Se puede decir con cara seria «no toqué ningún
hecho sellado». Y es falso en lo único que importa:

- 🟢 **La pantalla del expediente lee `trips.evidenceWindowStart`**, no el hecho
  — `service-detail-data.ts:213,231,297`, `carrier/servicio/[id]/page.tsx:111`,
  `workbench-data.ts:678`, `diagnostico-data.ts:278`. **El servicio pasaría a
  explicarse con una ventana que no es la que lo juzgó**, conservando su
  veredicto. Un acta que cambia su fundamento y mantiene su sentencia.
- Y si además se re-ingiere la evidencia para que cuadre con la ventana nueva,
  **cambia la evidencia sobre la que descansa un veredicto que sigue firmado**.

> **Eso no es «no tocar el hecho»: es tocarlo por debajo.** Es peor que
> re-verificar, porque la re-verificación al menos deja una versión en la
> historia. Ésta no deja nada.

### 4.2 Y aunque se vaya a D4, falta decidir CON CUÁL ventana

⚠ **«La ventana de hoy» no es obviamente la correcta.** Se deriva de mediciones
que en su mayoría son **posteriores** al servicio que se re-juzgaría: aplicarla a
julio es juzgar julio con información de agosto. Las dos opciones son
defendibles y **son de Asav, no del código**:

- **La que se habría derivado con la historia disponible entonces** — reconstruye
  lo que el sistema *podía* saber. Es la que respeta la ley del hecho congelado.
- **La de hoy** — la mejor estimación de cuánto dura de verdad esa ruta. Es la
  que más servicios rescataría, y la que peor se explica.

Y precede a las dos: 🔵 **D5** —cómo se le cuenta a Tecma que su número se
mueve—, que el plan ya marca como anterior a D4.

### 4.3 Lo que este frente sí debería dejar arreglado hacia adelante

**Que la ventana viaje dentro del hecho**, como viaja la política. Es
literalmente el hallazgo de la `Ficha-Diagnostico-Geocerca-No-Congelada` en otro
campo: *la frontera de la evidencia vive en una fila editable que nadie
versiona*. Va a la lista del **Tramo 4** —«que el hecho se baste a sí mismo»—,
donde ya está la geocerca por la misma razón. **No arregla ninguna acusación
pasada; hace imposible la trampa de §4.1 hacia adelante.**

> ### 🆕 Y de aquí salió C24, que es más grande que este frente
>
> La pregunta obvia después de §4.1 —**¿qué MÁS lee el expediente de tablas
> editables?**— se midió el 12 de agosto, y la respuesta redimensiona el Tramo 4:
> **la ventana no era la única, ni la peor.**
>
> 🟢 **`service-detail-data.ts` lee `contract.policy` VIVA**, no
> `fact.contractPolicySnapshot`. De ahí salen la tolerancia, los cuatro números
> de la ventana, la zona horaria de todos los instantes y las consecuencias
> económicas. **Y la regla contraria ya está escrita en el repo**, en
> `no-cumplido-motivo.ts:58`: *«se lee del `contractPolicySnapshot` del hecho, no
> de la política de hoy»*. Sus tres pantallas hermanas —cierre, diagnóstico,
> tabla de ocurrencias— **sí la cumplen**. La incumple justo el expediente.
>
> 🟢 **Y ya hay daño vivo, no potencial: 197 de 1 194 hechos sellados (16.5 %)**
> muestran hoy un «cierra la observación» que no es el suyo —124 congelados en
> **30 → 45** y 73 en **0 → 45**—, y **519 (43.5 %)** tienen la geocerca
> congelada distinta de la del perfil, con **polígonos distintos**.
>
> ⚠ **Lo peor no tiene cifra:** la ventana, la etiqueta y placas de la unidad,
> los nombres y los propios `evidence_points` se leen vivos y **el hecho no
> guarda copia**, así que un cambio ahí es **indetectable por construcción**.
> **Cero divergencias ahí no es cero daño: es ausencia de memoria.**
>
> El detalle vive en la causa **C24** del plan. **El instrumento:**
> `pnpm --filter @jtel/db medir-expediente-mutable`.

---

## 5. Frente B — El arranque real, como alerta y nunca como acusación

**Sin diseñar.** Aquí sólo van sus dos leyes, escritas **antes** de que se
diseñe, y la medición que justifica que exista.

### 5.1 Qué es

🟢 El motor lee **exclusivamente** la memoria propia recortada por la ventana:
`telemetry.getForImeis(imeis, trip.evidenceWindowStart, trip.evidenceWindowEnd)`
(`verification.ts:972`). **Los puntos anteriores existen en la misma tabla.** No
los mira nadie porque están del otro lado del recorte.

Lo que este frente pide: que el sistema **vea a qué hora arrancó de verdad la
unidad** y, cuando eso quede fuera de la ventana, **lo anote como alerta**.

**Es una petición de ayuda del sistema, no una acusación:** *«esto no me cuadra,
míralo»*. Que una unidad arranque antes de lo previsto **no es falta del
transportista** — es una ruta más larga, tráfico, o una ventana mal dimensionada.
Convertirlo en castigo sería exactamente lo que la regla del arranque existe para
impedir.

### 5.2 Las dos leyes

> **Ley 1 — Ese arranque NO entra al veredicto.**
> Es evidencia **fuera de la ventana congelada**, y la ventana es la frontera de
> lo que se juzgó. Si el árbitro usa datos de fuera para decidir, la ventana deja
> de significar algo.
>
> **Ley 2 — Sí alimenta la alerta y el expediente.**
> No cambia el resultado; **explica por qué salió como salió**.

🟢 **Y las dos leyes ya tienen precedente construido en este repo, lo que las
hace verificables y no aspiracionales:** el paso `llegada_fuera_ventana`
(`verification.ts:659,706`) registra llegadas posteriores al fin de la ventana
como `result: "info"`, con la nota literal *«Informativo; no cambia el
veredicto»*. **Este frente es su espejo del lado del arranque.** Lo que allá se
hizo con la llegada, aquí se hace con la salida.

### 5.3 Y es el dato que el cron del Frente A necesita

En vez de detectar la divergencia **comparando configuraciones** —que sólo ve
que dos números difieren—, la detecta **viendo camiones que arrancan antes de que
el árbitro abra los ojos**, que es el hecho que la divergencia causa. 🟢 Medido:
**114 de los 286 (39.9 %) ya venían rodando cuando su ventana abrió**, con una
mediana de 27 minutos de anticipación.

### 5.4 Lo que hay que decidir antes de diseñarlo, y no está decidido

- **Sobre qué candidata se reconstruye el arranque.** Este sensor usó *la de más
  coincidencia de trazado según el ledger*, que sirve para medir y **no sirve
  para alertar**: en un `no_cumplido` esa candidata puede no ser la unidad que
  hizo el viaje. ⚠ **Elegirla mal convierte la alerta en ruido dirigido a una
  unidad inocente**, y eso la vuelve la clase de aviso que se aprende a ignorar.
- **Si la alerta es por servicio o por ruta×turno.** Un servicio suelto que
  arrancó temprano es operación; el mismo ruta-turno arrancando temprano treinta
  días seguidos es una ventana mal dimensionada. **Sólo el segundo merece
  correo.**
- **Qué umbral separa «arrancó un poco antes» de «la ventana está corta».** No se
  puede sacar de esta corrida: la mediana de 27 minutos mezcla los dos contratos
  y las dos causas.

---

## 6. Lo que esta ficha NO establece

- ⚠ **Ningún veredicto cambiaría.** Nada aquí lo dice ni lo insinúa. Más
  evidencia puede confirmar una acusación igual de bien que tumbarla, y saber
  cuál exige correr el árbitro: **D4 / Tramo 6**.
- ⚠ **Cuántos minutos exactos debe abrir cada ventana.** Sigue siendo lo que
  🔵 `medir-ventana` ya declaró que no puede establecer.
- ⚠ **Por qué 170 de los 286 no tienen ninguna llegada registrada.** Es la otra
  causa de §2.3 y no la toca este frente.
- ⚠ **El 85 del #288 no se pudo reproducir** (§2.1).

---

## 7. Lo que abre — decisiones de Asav

1. **¿Número propio (C24) o tercera población de C21?** (§1)
2. **¿Se re-dimensionan las ventanas sin sellar?** El cron avisa; corregir es
   suyo. (§4)
3. **Si se va a D4: ¿con la ventana de entonces o con la de hoy?** Y **D5 antes**
   que las dos. (§4.2)
4. **¿Entra la ventana al hecho, en el Tramo 4?** (§4.3)
5. **Sobre qué candidata alerta el Frente B.** (§5.4)
