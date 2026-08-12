# Ficha — El expediente de un servicio sin atribución · Parte 1

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Sin código.** Esta ficha define la pantalla; no la construye.

**Reviste:** `carrier/servicio/[id]` — la cara del transportista.
**Toca, sin rehacerla:** `cliente/planta/[plantId]/servicio/[occurrenceId]`.

> **Por qué esa línea existe:** sin ella, contar cuántas pantallas tienen diseño
> obliga a leer las fichas y a interpretar. Ver `PLAN.md` §8.

**El frente va partido en dos y ésta es la primera mitad.** Parte 1 enseña **lo
que ya está guardado**; Parte 2 empieza a guardar lo que falta y tiene ficha
aparte. **La 1 no depende de ninguna decisión de Asav** — por eso va primero.

---

## 1. Qué está mal hoy, dicho corto

Un servicio sin atribución **enseña nada y afirma todo**.

397 servicios sellados `no_cumplido` tienen, guardada, la evidencia de que **una
unidad sí llegó** — y la pantalla muestra el resultado, la hora límite y ni un
dato más. Los camiones anduvieron por la ciudad, sus puntos están en la base, y
el expediente no enseña uno solo.

**No es falta de datos.** El árbitro los mira para juzgar, falla, y los suelta.
La evidencia se queda en la base sin lector.

**La definición de v1, dicha por Asav:** *si algo sale no cumplido, tengo que
poder enseñar qué se hizo y decir por qué.* Esta pantalla es la mitad
«enseñar qué se hizo». La mitad «decir por qué» —el motivo candidata por
candidata— **no existe como dato**, y por eso es la Parte 2.

**Y esto va ANTES de arreglar el árbitro.** Aunque se arreglen las cuatro causas
—C25, C21, C19, C14— van a seguir existiendo servicios sin atribución: es el
estado honesto de un servicio que el instrumento no alcanzó a resolver. **Ese
estado tiene que poder enseñar algo.**

---

## 2. Las tres leyes de esta pantalla

> **1 · Nada de aquí es un veredicto ni lo cambia.**
> Ni un botón, ni un cálculo, ni una lectura. El hecho está sellado y esta
> pantalla lo explica; si algo de lo que muestra sugiere que el resultado
> podría moverse solo al abrirla, está mal. (Ley 2 del Marco.)

> **2 · Nada se inventa. Solo se muestra lo observado, y donde no hay dato se
> dice que no hay.**
> Sin interpolar trazas, sin rellenar huecos, sin completar un motivo que el
> motor no escribió. Cuando la versión honesta se ve peor, gana la honesta.

> **3 · Todo campo nuevo nace vacío hacia atrás.**
> Escrita **antes** de construir, porque después ya no se puede aplicar. Lo que
> la Parte 2 empiece a guardar **no va a existir en lo ya sellado, nunca**. Los
> 397 de julio no van a tener motivo por candidata jamás. **La pantalla tiene
> que decir «esto no se preguntó entonces», y un hueco no puede leerse como un
> cero.**

La tercera es la que se olvida y la que más cuesta. Un campo ausente pintado
como `0.0 %`, como `—` a secas o como una barra vacía **afirma que se midió y
salió en cero**. Son cosas distintas y la diferencia es toda la credibilidad
del árbitro.

---

## 3. En qué cara vive, y por qué no en la del cliente

**Esto es una decisión, no un detalle de ruteo, y hay que tomarla antes de
dibujar.**

Lo que Asav pidió enseñar —las candidatas que llegaron, sus números, el trazo de
cada una— es, palabra por palabra, lo que el skill llama **maquinaria de
identificación**: *«los puntajes de candidatas, el razonamiento de eliminación,
las unidades que se consideraron y se descartaron»*. Y el Marco lo prohíbe en la
cara del cliente por dos razones que no se negocian: es **cocina del motor**, y
**revela la flota del transportista** (Ley 3).

Entonces la Parte 1 se reparte así:

| Cara | Qué ve | Por qué |
|---|---|---|
| **Transportista** — `carrier/servicio/[id]` | **Todo lo de esta ficha.** Es su instrumento de defensa: su flota, sus unidades, sus números | Estructura-Cara-Carrier §6: *el Workbench es el instrumento con el que el transportista se defiende*. Esto es su hermano por servicio |
| **Cliente** — `.../servicio/[occurrenceId]` | **Solo el hecho, sin identidades ni puntajes:** cuántas llegadas se observaron y no se pudieron atribuir, y qué no responde esta lectura | Ley 3. Un conteo no es una flota |
| **J-Staff** | Todo, más el ledger crudo | Ahí el usuario es experto y el razonamiento completo es su trabajo |

**Y la garantía es estructural, no un filtro.** La proyección de la cara cliente
**no lee el paso `candidata`** — hoy ya arma el paso de la unidad desde
`decision`. Esa línea no se toca. *La prueba de fuego del skill: ¿alguien podría
borrar una línea y abrir la fuga? Si la línea no existe, ya es estructura.*

⚠ **Lo que esto deja abierto y decide Asav:** el cliente sigue viendo un
`no cumplido` que enseña poco. La corrección de texto del 12 de agosto ya le
dice *«que ninguna acreditara no significa que ninguna llegara»*; **esta ficha
no le da más**, y la pregunta de cuánto más merece ver **no se puede contestar
sin tocar la Ley 3**.

---

## 4. La pantalla

Registro **denso** (skill §Dos ritmos): es una pantalla de revisión, no un
resumen. Zona dominante: **el mapa**. Todo lo demás lo acompaña.

### 4.1 La declaración de límite va primero

Antes de cualquier dato, en caja con borde ámbar bajo el encabezado — el mismo
patrón que la pantalla de pendientes, que es su hermana de tono:

> **El sistema observó llegadas y no pudo atribuir ninguna a esta ruta.**
> Lo que sigue es **lo que sí se observó**: los recorridos guardados, sus
> medidas y sus umbrales. **Ninguno de estos datos cambia el resultado
> sellado.**

Y debajo, en tenue, lo que esta lectura **no** responde — el formato obligatorio
del skill para evidencia que las partes van a disputar:

> No responde si el servicio se hizo. Responde qué alcanzó a ver el instrumento.

**Titular:** el hecho en una frase — *«Cuatro unidades llegaron al destino.
Ninguna acreditó el trazado.»* Con el número real, nunca «varias».

Y pegado al titular, el conteo que exige la ley del corte (§4.3):
*«3 unidades relevantes de 52 evaluadas.»*

### 4.2 El mapa — real contra contratado, encimados

Es la zona dominante y es lo que Asav pidió primero. Capas apagables (skill
§Mapas), agrupadas por pregunta:

| Capa | Color | Default |
|---|---|---|
| **Trazado contratado** de la ruta | acero punteado | encendida |
| **Recorrido real** de cada candidata que llegó | acero sólido, una por una | encendida, **la mejor primero** |
| **Geocerca del destino** | acero | encendida |
| **Huecos de señal** de la candidata seleccionada | ámbar punteado | apagada |
| **Otra ruta que sirvió esa unidad** (§4.5) | acero tenue | apagada |

**Tres reglas que el mapa no puede romper:**

- **La traza se corta en la llegada.** En un servicio acreditado se corta en
  `observedArrivalAt`; aquí ese campo **está en nulo en los 397**, así que el
  corte es en **el `arrivalAt` de esa candidata**, que sí está en el ledger. Es
  la misma ley con el dato que sí existe. *(Excepción declarada: el Workbench no
  corta, porque ahí no es evidencia de un cliente — Estructura-Cara-Carrier §7.
  Esta pantalla sí corta.)*
- **Los huecos no se cruzan con línea recta.** Un tramo sin señal se dibuja
  **interrumpido**. Una traza continua es más bonita y afirma un camino que
  nadie observó. *(Marco §E.)*
- **Nunca las cincuenta.** Ver §4.3.

### 4.3 Las candidatas relevantes — **no la flota**

Un servicio evalúa **una mediana de 50 candidatas**: es la flota entera del
transportista. Listarlas sería ilegible, y además es el error de población de la
regla 21.

**El corte son dos criterios, y está medido:**

| Filtro | mediana | p90 | máx | servicios que quedarían **vacíos** |
|---|---:|---:|---:|---:|
| evaluadas (la flota) | 50 | 52 | 53 | — |
| **1 ·** llegó a la geocerca | 4 | 7 | 15 | 0 |
| **2 ·** + anduvo cerca del trazado (B > 5 %) | **3** | 7 | 13 | **17** |
| + B > 10 % | 3 | 7 | 13 | 42 |
| + B > 25 % | 1 | 5 | 8 | **110** |

**La última columna es la que decide el piso, y no era obvia:** apretar el
segundo criterio deja expedientes **sin ninguna candidata que enseñar** — con
B > 25 %, **110 de 397 (27.7 %)**. Un expediente vacío es peor que uno con una
fila de más: vuelve a ser la pantalla que enseña nada.

**Lo que fija esta ficha:**

- **Criterio 2 con piso en B > 5 %.** Deja mediana de **3**, que es un
  expediente que se lee, y solo vacía 17.
- **Y nunca vacía: si el criterio 2 no deja ninguna, se muestran las que
  llegaron**, con la nota *«ninguna se acercó al trazado contratado»* — que es
  un hecho del servicio, y de los más elocuentes que puede dar esta pantalla.
- ⚠ **`B > 0 %` no sirve como criterio 2**: da exactamente lo mismo que llegar
  (mediana 4, cero vacíos). El destino está sobre el trazado, así que **entrar a
  la geocerca ya implica tocar el corredor**. Se descarta por medición, no por
  gusto.

> **La ley del corte, y sin ella el filtro es ocultamiento:**
> **El expediente dice siempre cuántas se evaluaron en total.**
>
> *«3 unidades relevantes de 52 evaluadas.»*
>
> Si una unidad hizo la ruta y su GPS reportó tan poco que quedó fuera del
> corte, **tiene que seguir siendo visible que hubo un corte** — o el
> transportista diría *«sí fui y ni aparezco»*, con razón. El conteo total es lo
> que le deja saber que hay algo detrás y pedirlo.

Y el renglón es **clicable**: abre las evaluadas que no pasaron el corte, con su
motivo de exclusión —no llegó · llegó y no se acercó al trazado—. **El corte
ordena; no esconde.**

Una fila por candidata relevante, ordenadas por **la que más cerca estuvo de
acreditar** —mayor `min(A, B)`, el mismo orden del motor—. Cada fila:
identificador · hora de llegada con fecha completa · sus medidas (§4.4) · su
línea de empalme si la tiene (§4.5) · enlace a su recorrido en el Workbench.

**La fila seleccionada manda en el mapa.** Se entra por la primera.

### 4.4 Los números, cada uno junto a su umbral

Regla del skill, sin excepción: **todo número va con su lectura**. Nunca la
medición sola, nunca el umbral solo.

| Qué | Cómo se escribe | Guardado en |
|---|---|---|
| Cobertura del trazado | `25.4 % · mínimo del contrato 60.0 %` | **397 de 397** |
| Precisión de corredor | `38.0 % · mínimo del contrato 50.0 %` | **397 de 397** |
| Forma del recorrido | `0.412 km · tope 0.800 km` | **383 de 397** |
| Sentido de la marcha | `0.94` | **383 de 397** |
| Corredor aplicado | `120 m` | **397 de 397** |

⚠ **Y la trampa de esta pantalla, que es C17 y hay que resolverla aquí:** la
cobertura que **decide** va ponderada por TF-IDF, y **no se puede escribir como
un porcentaje llano sin mentir**. Está medido: en esta población la ponderada
tiene mediana **25.4 %** y la llana **100 %** — el mismo recorrido, dos números
que se llevan setenta y cinco puntos.

**La regla que queda, y es de esta ficha:**

- Donde existan las dos, van **las dos, rotuladas**: *«cobertura que decide
  (ponderada) 25.4 % · cobertura del trazado 100.0 %»*. Nunca una sola.
- Donde solo exista la ponderada —**330 de 397**—, se escribe **la ponderada con
  su etiqueta** y debajo: *«la cobertura llana no se guardó en este servicio»*.
  **No se recalcula y se presenta como si fuera del sello.**

### 4.5 El empalme — **parte de la explicación, no un dato al lado**

**Medido: en 150 de 397 (37.8 %) la candidata que llegó acreditó otra ruta ese
mismo día.** En más de un tercio de los casos, el sistema **ya sabe qué estaba
haciendo esa unidad** — y hoy no lo dice.

**Por eso no va como tarjeta aparte.** Va **dentro de la fila de la candidata**,
como el renglón que completa su historia. Los tres hechos en una sola línea, en
orden de tiempo, cada uno medido:

> **Llegó 2026-07-23 05:41:07** · no acreditó esta ruta ·
> **ese mismo turno acreditó `Sierra Vista 3`**
> *lectura de hoy*

Eso es lo que convierte a la fila de un renglón de datos en una explicación:
las tres piezas juntas dicen algo que ninguna dice sola. **Y no inventa nada** —
las tres salen del ledger, y la tercera lleva su marca de procedencia (§5)
porque se deriva cruzando el ledger del día consigo mismo, no es un campo.

**Lo que la línea NO dice, y es deliberado:** *«por eso no acreditó aquí»*. Esa
conclusión es C18 —el empalme— y **C18 está sin construir**: el árbitro todavía
le pregunta a un camión que sirvió dos rutas si cubrió una sola, y ningún umbral
arregla una pregunta mal hecha. La pantalla pone los tres hechos en fila y deja
que quien lea saque la conclusión. *(Skill: la lectura no dictamina.)*

**Donde no hay empalme, no hay línea.** No se escribe «no sirvió otra ruta»:
la ausencia de la línea ya lo dice, y afirmar una negativa sobre datos derivados
sería prometer una búsqueda exhaustiva que esta lectura no hizo.

### 4.6 El destino dibujado

⚠ **133 de los 397 tienen la geocerca sellada en el hecho distinta de la del
perfil contra la que se juzgó.** Es C4 dentro de esta pantalla, y **no se puede
esquivar dibujando**: si se dibuja la sellada, se dibuja un polígono que el
motor nunca usó; si se dibuja la del perfil, el campo del hecho nombra otra.

**Lo que hace esta ficha:** dibuja **la que el motor usó** —porque el mapa
explica un juicio, y el juicio se hizo contra ésa— y **declara la divergencia
cuando existe**, en una línea:

> *El hecho nombra otra geocerca (`VOID`). Se dibuja la que se usó para juzgar.*

**No se corrige nada aquí.** Arreglarlo es C4 / Tramo 4.

---

## 5. Las tres procedencias — la marca que hace honesta la pantalla

Es la pieza que sostiene la ley 2 y la ley 3 del §2, y **es lo primero que se
construye**, porque sin ella cada bloque de arriba puede mentir por omisión.

Todo dato de esta pantalla lleva **una de tres marcas**, visibles, en mono tenue:

| Marca | Qué significa | Cómo se ve |
|---|---|---|
| *(sin marca)* | **Del sello.** Lo que el árbitro guardó al juzgar | El caso normal — el silencio es el mensaje |
| **`lectura de hoy`** | Calculado ahora con lo guardado. Si la tabla de la que sale cambió, este número cambia | Marca en tenue junto al dato |
| **`no se preguntó`** | El motor de esa época no lo calculaba. **No es cero, no es vacío** | El dato se sustituye por la frase, no por `—` |

**Por qué `lectura de hoy` no es paranoia:** es C24 medido. El expediente ya
mostró durante semanas una ventana que no era la del hecho por leer la política
viva. Un número derivado **sin declarar** es exactamente esa falla otra vez.

**Y `no se preguntó` tiene tamaño medido en esta población:**

- **el tramo sobre el que se calificó la cobertura** — sellado en **121 de 397**
- **la cobertura llana** — sellada en **67 de 397**
- **el aparato que emitió** — sellado en **29 de 397**
- **cuál trazado contratado se usó** — sellado en **0 de 397**

Ese último es el que más duele en una pantalla que **encima el real con el
contratado**: el trazado se puede reconstruir por fecha, pero **eso es lectura
de hoy** y va marcado como tal. Sellarlo es Parte 2.

---

## 6. Auditoría de datos

*Requisito de `PLAN-v1` §0. Todo lo de esta sección sale de guiones commiteados
—regla 20— y se reproduce con:*

```
pnpm --filter @jtel/db separar-397
pnpm --filter @jtel/db inventario-expediente
```

**Guardado y listo para mostrarse:**

- El **recorrido real** de todas las candidatas: **397 de 397**, con lat/lng,
  hora y velocidad. **La evidencia no se poda** — `evidence_points` solo cae por
  cascada al borrar una ocurrencia, y eso solo alcanza a futuras.
- La **lista de candidatas con su llegada**: 397 de 397 — y el corte de dos
  criterios sale de datos que ya están: `arrivalAt` y la precisión de corredor,
  las dos selladas en los 397. **El corte no necesita nada nuevo.**
- **Cobertura ponderada, precisión de corredor, corredor y umbrales**: 397 de
  397. **Fréchet y dirección**: 383.
- El **motivo del servicio**: 397 de 397 — pero **es uno solo para todas**, y
  ése es justo el agregado que la Parte 2 viene a partir.

**Derivable, y va marcado:**

- El **tramo observable** de cada candidata: recalculable en 397 con la misma
  función del motor. **Valla pasada:** coincide con la fracción ya sellada en
  **121 de 121 (±0.02)**.
- La **señal de cada candidata**: no hay campo; sale de sus puntos. La cobertura
  sellada es **de una sola unidad, la mejor**.
- El **trazado contratado** vigente esa fecha.
- El **empalme**: 150 de 397.

**No está y no se puede reconstruir:**

- El **motivo por candidata**. Se puede *deducir* comparando cada número contra
  su umbral, pero **solo en 121 de 397** — donde falta el tramo observable, la
  deducción se queda coja justo en la compuerta que más rechaza (C25). **En los
  otros 276 la pantalla dice `no se preguntó` y no deduce.**
- **Cuál trazado contratado se usó**: `servedVariantId` solo se llena en
  `cumplido`, y el paso `multi_variante` **no aparece en ninguno de los 397**.

**Si un dato no existe, ese bloque no se muestra. No se inventa el número.**

---

## 7. Lo que NO lleva

- **Un botón que re-verifique, recalcule o «corrija».** Esta pantalla explica un
  hecho sellado. Re-verificar es D4 / Tramo 6, con firma.
- **Las cincuenta candidatas.** Solo las relevantes — pero **jamás sin decir
  cuántas se evaluaron**: un corte sin su total es ocultamiento.
- **Un expediente vacío.** Si el segundo criterio no deja a nadie, se cae al
  primero. La pantalla nunca se queda sin nada que enseñar.
- **«No sirvió otra ruta»** cuando no hay empalme. La ausencia de la línea lo
  dice; afirmar la negativa promete una búsqueda que no se hizo.
- **Un motivo por candidata deducido y presentado como del sello.** Donde no
  está, se dice.
- **Verde, ámbar o rojo en las medidas.** Son medición: **acero**. El único
  color de veredicto de la pantalla es el chip del resultado. Y la brecha contra
  el umbral se marca como en la pantalla de pendientes: lo observado en acero
  sólido, lo que faltó en ámbar rayado.
- **Trazas cruzando huecos de señal.** Ni suavizadas, ni interpoladas.
- **Lenguaje de culpa**, ni del transportista ni del GPS. El instrumento reporta
  qué alcanzó a ver.
- **Nombres propios de cliente, planta o ruta horneados** en ningún componente.
- **Una conclusión sobre el empalme.** El hecho sí; el dictamen no.

---

## 8. Cómo se verifica que está bien construida

**En el navegador, en los dos temas** — compilar no prueba nada en una pantalla.
Y sobre casos elegidos a propósito, no sobre el primero que abra:

1. **Un servicio de julio** — sin tramo observable, sin cobertura llana, sin
   aparato. Tiene que verse **`no se preguntó` tres veces**, y ni un `0.0 %`.
2. **Un servicio de agosto** con los campos completos, para comparar contra el
   anterior: la misma pantalla contando dos épocas sin disimular la diferencia.
3. **Uno de los 133 con la geocerca divergente** — la línea de §4.6 tiene que
   estar.
4. **Uno de los 150 con empalme** — con su marca `lectura de hoy`.
5. **Uno con huecos de señal grandes**, para ver la traza interrumpida y
   comprobar que **no se cruzó sola**.
6. **Uno de los 17 que el criterio 2 dejaría vacíos** — tiene que caer al
   criterio 1 con su nota, y **no quedar en blanco**.
7. **Uno de los 150 con empalme**, para leer la línea de tres hechos completa —
   y **uno sin empalme**, para confirmar que ahí **no hay renglón**, ni uno que
   diga «no».

Y una comprobación que no es visual: **abrir el mismo servicio en la cara del
cliente y confirmar que ni un identificador de unidad ni un puntaje aparece.**

---

## 9. Lo que esta ficha deja abierto

- ⚠ **Cuánto más merece ver el cliente** — no se puede contestar sin tocar la
  Ley 3. Decide Asav.
- ⚠ **Si el trazado contratado reconstruido por fecha basta**, o si mostrarlo
  como `lectura de hoy` es demasiado frágil para una pantalla de defensa. Si no
  basta, la Parte 2 se vuelve requisito de la 1.
- ⚠ **El piso del criterio 2 (B > 5 %) es de esta ficha, no del contrato**, y
  por eso se declara aquí: **no decide ningún veredicto**, solo a quién vale la
  pena enseñar. Si al verlo en pantalla deja fuera algo que importa, se mueve —
  y moverlo no toca el motor ni un hecho sellado. **Lo que no se puede hacer es
  esconderlo dentro del código:** un corte sin número escrito vuelve a ser un
  filtro que nadie puede auditar.
- 🔵 **El expediente del servicio en la cara del cliente** tiene su propia ficha
  (`Ficha-Expediente-Servicio.md`) y **esta no la rehace**: solo le agrega el
  conteo de llegadas no atribuidas.
