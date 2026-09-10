# Arranque de un chat nuevo

**Qué es.** Lo que hay que pegarle a un chat nuevo para que se ponga al día solo, y
—más importante— **cómo comprobar que de verdad se puso al día** en vez de haber
leído por encima y contestado con generalidades.

**Por qué existe.** Un chat nuevo llega sin nada. Si arranca a construir con contexto
a medias, lo que produce se ve bien y está mal: en este repo las fallas caras no son
código que no compila, son afirmaciones falsas dichas con autoridad. La forma de
atajarlo es barata — leer en orden, y después **contar de vuelta**.

**Última actualización: 10 de septiembre de 2026**, al cerrar el #381.

---

## Cómo se usa

1. Pegar el bloque de abajo, «El mensaje de arranque».
2. Dejar que lea. No encargarle nada mientras tanto.
3. Leer lo que cuenta de vuelta y **compararlo contra la sección «Lo que tiene que
   poder explicar»**. Si algo falta o suena a resumen de resumen, pedirlo otra vez
   antes de encargarle trabajo.
4. Hacerle **una pregunta de lectura** — ver la sección de más abajo, que explica cómo
   se arma una que no se pueda contestar de memoria.

---

## El mensaje de arranque

> Chat nuevo, contexto anterior perdido. Antes de nada, ponte al día leyendo, **sin
> tocar código**:
>
> 1. El **Marco Limpio Maestro** completo — `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`.
>    Las cinco piezas, y las secciones D, E y F de la Pieza 1.
> 2. Los **últimos PRs mergeados**, con sus descripciones y las fichas que dejaron en
>    `docs/`. Pídeme el rango si no es obvio; hoy el corte útil son del #359 al #381.
>    **Ojo con el salto:** el #363 y el #379 no existen. `gh pr view` contesta «Could
>    not resolve», y eso no es un PR que se perdió.
> 3. Las secciones del **frente activo** en `docs/PLAN.md` y `docs/DESPUES.md`.
> 4. El **estado actual de main**.
>
> Cuando termines, dime **en tus palabras** —no citando— qué encontraste. Y te voy a
> hacer una pregunta de lectura para verificar que el contexto quedó completo antes de
> encargarte lo siguiente.

---

## Lo que hay que leer, en orden

El orden importa: cada capa explica por qué la siguiente está escrita como está.

| # | Qué | Por qué va aquí |
|---|---|---|
| **1** | `docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`, **completo** | Es la única fuente de verdad. Sin las secciones **D** (un dato correcto que miente), **E** (lo correcto se ve peor que lo falso) y **F** (dónde se prueba sin mentir), el chat va a proponer cosas que el repo lleva meses rechazando — y a bloquearse en cosas que el repo permite |
| **2** | Las **fichas del frente activo** en `docs/` | Cada una guarda un defecto encontrado *mirando*, no compilando, y la valla que le pusieron. Es donde vive lo que ninguna prueba dice |
| **3** | `docs/PLAN.md` — el tramo activo | El orden y lo decidido. **PLAN es lo que sí se va a hacer** |
| **4** | `docs/DESPUES.md` — las secciones del tramo | **DESPUES es lo que decidimos NO hacer**, con su razón y su desbloqueo. Confundir los dos hace que el chat reabra decisiones cerradas |
| **5** | Los **PRs mergeados recientes** | Las descripciones traen el razonamiento que no cabe en el código. Leer sólo el diff es leer la mitad |
| **6** | El **estado de main** | Ver las trampas de abajo antes de creerle a `git log` |

---

## Las trampas del repo, y todas costaron tiempo

**El `main` local está viejo.** En la sesión del 3 de septiembre estaba **244 commits
atrás**. `git log main` miente. Hacer `git fetch origin` y leer de **`origin/main`** con
`git show origin/main:ruta`.

**El árbol puede estar parado en una rama vieja.** Los archivos en disco pueden ser de
hace semanas, incluidos los `docs/`. Mismo remedio: leer de `origin/main`.

**Hay otras sesiones en el mismo repo.** Entrar siempre a un **worktree propio**. El
*stash* es compartido: nunca `git stash` a secas.

**El `.env` vive en el checkout principal, no en el worktree.** Los guiones lo resuelven
solos derivándolo de `git rev-parse --git-common-dir`; ver `escenario-hilo-permiso.ts`.

**El trailer de los commits va sin sufijo:** `Co-Authored-By: Claude <noreply@anthropic.com>`.
Sin modelo y sin ventana de contexto.

**Qué se mergea y qué no.** Motor (`packages/domain`, `packages/verification`),
migraciones, secretos y el Marco **los espera Asav**. Se abre el PR con su punto de
parada y no se mergea.

**Probar no es mentir, y confundirlo paraliza.** El Marco §F permite montar un escenario
con datos puestos a mano **en la rama desechable**, mirarlo y borrarlo. Lo prohibido es
que una afirmación no medida le llegue a alguien. Existe
`pnpm --filter @jtel/db escenario-permiso`, con candado que se niega si la URL no es
`DATABASE_URL_TEST`.

**Hay estados que la calle no regala.** Oasis–Centro **no tiene unidades asignadas**, así
que no alcanza `en_vivo` ni `por_horario` a ninguna hora. Esperar a la hora de turno no
es una alternativa al escenario: no es una opción.

**En un PR de piel, verlo en el navegador ES la verificación.** Y contra **compilación de
producción**, no `next dev`: el indicador de desarrollo de Next se confundió una vez con
un defecto de la app y produjo una afirmación falsa (#368).

**Pero las pantallas internas de `/jstaff` NO se pueden revisar así, y hay que decirlo en
el PR.** `guardia-pagina` exige sesión de Clerk real, así que con `next start` el
expediente, Operar y el reporte contestan **307 a `/entrar?motivo=sin-sesion`** antes de
dibujar nada. Ahí se revisa contra `next dev` con el bypass, y se **declara** que el
indicador de desarrollo y la pastilla de identidad que salen en la captura no son de esa
pantalla (#372, #373). La app del pasajero sí se revisa contra producción, siempre.

**Una migración se aplica ANTES de mergear, y no es formalidad.** La consulta del
circuito pide **todas** las columnas del esquema: contra una base sin la columna nueva no
falla sólo el circuito nuevo — **fallan todas las pantallas de circuito**, y los preview
del PR también, porque leen producción. Los checks verdes no lo ven, porque compilar no
toca la base (#373, #380).

**El worktree se puede negar a nacer.** La configuración local del repo trae **76 866
renglones repetidos** de `github-pr-owner-number`, escritos por la extensión de GitHub, y
a 3.5 MB la herramienta de worktree no la puede leer. `git worktree add` a mano sí
funciona. Medido el 10 de septiembre de 2026; no está arreglado.

---

## Lo que tiene que poder explicar de vuelta

No se pide que recite. Se pide que **conteste con lo que la cosa hace**, y que sepa
distinguir lo decidido de lo pendiente.

**Del Marco.** Qué prohíben D, E y F, y en qué se distinguen: en D el dato existe y
engaña por dónde queda; en E el dato no existe y se completa porque la pantalla se ve
mejor entera; F le escribe el alcance a las dos y dice dónde sí se puede montar algo
para probar.

**De la cara pública.** La escalera de **cinco** estados, en orden —`por_arrancar` ·
`fuera_de_horario` · `en_vivo` · `por_horario` · `sin_evidencia`—, y **las tres reglas
duras**: la asignación es plan y no evidencia —`estadoDelCircuito` ni siquiera recibe
cuántas unidades hay asignadas—; los dos estados con evidencia exigen corredor, por el
caso del camión del patio; y **la fecha de arranque manda sobre el reloj**, o un circuito
que todavía no opera diría «Abre 05:00» e invitaría a alguien a la parada (#373).

**De quién firma cada renglón.** El rótulo de la tarjeta **dice de dónde sale la
afirmación de arriba, nunca repite qué es** (#376), y **sigue la fuente del titular, no
el estado** (#377): el mismo `por_horario` firma «Según el concesionario» con cadencia
declarada y «Vimos una unidad en la ruta hace 6 min» sin ella. Firmar con el nombre del
operador algo que midió nuestro GPS es la ley de no exponerlo, invertida.

**Y del error contrario, que también es error.** Callar lo que el sistema **sí** midió le
miente al pasajero por omisión y lo manda a caminar a otra ruta (#378). La prueba es la
de siempre con el signo cambiado: *¿esto que me estoy callando lo midió el sistema?* Si
lo midió, se dice — y se fecha.

**De lo que gobierna el interruptor del rango.** Que apagado se calla **toda** afirmación
de tiempo —la cifra, la palabra, el color y la promesa en futuro—, y que la frescura
aplica esté el interruptor como esté.

**De que la cara pública ya ESCRIBE.** Dejó de ser sólo lectura con el contador anónimo
(#380): `POST .../apertura`, sin autenticación, una fila por aparato distinguible por
día, con la huella derivada **en el servidor** y rotando con el día. Mide **aperturas, no
regresos**, y eso es la decisión, no una versión reducida.

**De las vallas que existen, y qué prueba cada una.** `PermisoDeRango`, que hace que
fabricar un minuto sin permiso no compile; el candado de siembra, que compara
**identidad de base** y no cadenas; `fuenteDelTitular`, que pregunta por la fuente antes
que por el estado; `haceNMinutos`, que comparte **la frase entera y no el número**,
porque dos sitios pueden redondear igual y escribir distinto; y
`textos-de-privacidad.test.ts`, que **no prueba una función: prueba una decisión** — la
frase retirada era cierta y sonaba mejor, así que quien la reponga va a creer que repara
una regresión. Y sobre todo: **qué NO prueba cada una** — está escrito en su archivo.

**De la deuda.** Qué está en DESPUES con su desbloqueo, y por qué no se toca.

---

## La pregunta de lectura

Es lo que separa «leí» de «entendí», y **es lo que más ha rendido**. Una buena pregunta
de lectura tiene tres propiedades:

1. **No se contesta desde un resumen.** Hay que haber abierto el archivo.
2. **Tiene respuesta verificable** — sí o no, o un lugar concreto del código.
3. **Toca una frontera**, no el centro. Las fronteras es donde viven los defectos.

**El ejemplo que funcionó**, el 2 de septiembre:

> *El aviso de «Llegando», ¿también se apaga con el interruptor del rango de llegada, o
> sale aunque el rango esté apagado?*

La respuesta corta era «sí se apaga», y era verdad **para el titular**. Buscarla en serio
destapó que la misma palabra salía en el hilo de paradas sin mirar el interruptor, que
los minutos de ahí se calculaban desde camiones con dato viejo, y que el verde seguía
encendido. **Cuatro defectos, ninguno visible en una prueba**, de una sola pregunta bien
puesta. Salieron los PRs #366 y #368.

Molde para armar otra: *«Además de X, ¿Y también hace Z, o queda fuera?»* — donde Y es
un lugar secundario de la misma pantalla y Z la regla que se supone que gobierna a los
dos.

---

## Bitácora de cierres

Se agrega un renglón **al cerrar cada PR**, con lo que un chat nuevo tendría que saber de
él y no está en el título.

| PR | Qué dejó, para quien llegue después |
|---|---|
| **#366** | El interruptor del rango gobierna toda afirmación de tiempo. Nació `PermisoDeRango`: `rangoDeLlegada` ya **no** recibe una velocidad suelta. Tres `@ts-expect-error` en `llegada.test.ts` fallan si alguien afloja la firma o la marca — la valla se queja cuando *deja* de hacer falta |
| **#367** | `escenario-permiso` entra al repo con `candado-desechable`. Compara **host, puerto y base**, normalizando el sufijo `-pooler` de Neon: dos URLs distintas pueden ser la misma base. **No prueba** que el destino sea *la* desechable — prueba que no es ninguna de las que el ambiente conoce |
| **#370** | El buscador de «¿a dónde vas?». La trampa que destapó, y no está en ningún otro lado: **`--ruta` y `--ruta-claro` son los dos únicos tokens de la app pública SIN par en las paletas de noche, a propósito** —los inyecta el componente que sabe de qué ruta habla, con `tinte(color, deNoche)`—. Usarlos en una superficie que no los inyecta deja el valor de DÍA puesto en los dos temas, mientras el texto de encima sí sigue al tema: blanco sobre blanco, sin romper nada y sin que ninguna prueba lo vea. Para lo que no es de una ruta está `--acento`. Y el umbral de caminata es **declarado, no medido**: sale de la prueba de campo |
| **#368** | Los detalles de la cara pública. Dos cosas que conviene no perder: **no hay brújula en el mapa** —lo que se veía era el indicador de desarrollo de Next, y esa confusión produjo una afirmación falsa—; y **el crédito de OpenStreetMap no se veía nunca**, tapado por la hoja en los dos estados, que es obligación de licencia y no estética. Además `--sin-publicar` en el escenario, y la corrección a `PLAN.md` sobre Oasis–Centro |
| **#372** | El reporte de la jornada — vueltas observadas e intervalo medido. Tres cosas que no están en el título: **`declared_frequency_minutes` está en `NULL` en los dos circuitos de producción**, así que el tercio del PLAN que pedía «adelantada / a tiempo / atrasada» **no se puede dar** y el reporte enuncia el hueco en vez de escoger un número. **La consulta se une por IMEI, no por `unit_id`**: esa columna viene vacía en el **3.4%** de las filas, y unir por ella devuelve de menos **en silencio**. Y nació `HUECO_QUE_ROMPE_MINUTOS` porque el conteo cosía dos momentos sin relación y producía **una vuelta de 8 h 20 min** en un corredor de 24.6 km — §E, con el agravante de que lo inventado era la mitad de un recorrido |
| **#373** | La escalera gana `por_arrancar` **hasta arriba**, y la fecha manda sobre el reloj. La columna se llama **`service_launch_date` y NO `service_start_date`**, a propósito: ya existe `service_start_local`, que es la hora de apertura diaria, y dos columnas con el mismo prefijo se leen como variantes de lo mismo. **`NULL` significa «ya opera», nunca «arranca hoy»** — un default habría apagado el servicio de todo circuito existente hasta la medianoche. Dos defectos que salieron escribiendo las pruebas: **`Date.UTC` no rechaza un día imposible, lo desborda** (`2026-13-45` da el 14 de febrero de 2027), y `new Date("2026-09-15")` se dibuja en Juárez como el **14**. Migración `0032` |
| **#374** | La salida del buscador. La razón de fondo y la que no se ve desarrollando: **el manifiesto declara `display: "standalone"`**, así que instalada en la pantalla de inicio **no hay flecha de atrás**, y en el escritorio con Chrome la pantalla se ve perfectamente usable. La salida es **liga de verdad, nunca `history.back()`** — quien abre el buscador de frío no tiene historia. Dejó `Ficha-Salidas-App-Pasajero.md`: **en esta app, una pantalla sin salida en la pantalla es una pantalla sin salida** |
| **#375** | El teñido de noche del mapa. Lo que hay que llevarse: **la vista de la ruta no estaba bien, funcionaba por casualidad.** Sus dependencias incluían `vivo`, que cambia con cada sondeo, así que el primer sondeo re-corría el efecto; con el endpoint de unidades caído se habría quedado igual de blanca. La dependencia que faltaba no era «llegaron datos» sino **«ya hay mapa»** (`mapaListo`), y una referencia no habría servido porque no vuelve a correr nada |
| **#376** | **El rótulo dice DE DÓNDE SALE la afirmación; nunca repite QUÉ ES.** Qué es ya lo dijeron el titular y la frase, y repetirlo gasta el único renglón que quedaba para decir quién responde. Tercera vez que esta pantalla comete la misma falta, y las tres se vieron mirando. Los cinco rótulos declarados **comparten copia a propósito**: la fuente es la misma persona, y darle a cada uno su variante insinuaría cuatro fuentes |
| **#377** | Generaliza al #376: **el rótulo sigue la fuente del TITULAR, no el estado.** `por_horario` es la prueba — el mismo estado cambia de dueño según haya cadencia declarada o no. Firmar con el nombre del concesionario una medición nuestra **es la ley de no exponer al operador, invertida**: el día que el GPS se equivoque, el rótulo le carga a él nuestra falla, con su nombre, delante del pasajero |
| **#378** | La lección más grande de la semana, y va contra el reflejo que la semana entrena: **quedarnos cortos con algo que sí sabemos también es un error.** Una pantalla que se calla lo que el sistema midió le miente por omisión y manda al pasajero a caminar a otra ruta. Por eso «En servicio» **se queda en presente** — está escrito en la ficha para que el siguiente no lo «arregle» de vuelta. Y la valla comparte **la frase entera, no el número**: dos sitios pueden redondear igual y escribir distinto |
| **#380** | El contador anónimo, y **la primera ruta de ESCRITURA de toda la cara pública** — la regla de «solo lectura» del PLAN se corrigió ahí mismo en vez de dejarla mintiendo. Mide **aperturas, no regresos**, y eso es la decisión: la huella lleva el día adentro y rota con él, así que los regresos **no se pueden medir sin deshacerla**. **Se enseña un número y se guardan dos**: el crudo no sale a la pantalla porque es el detector de raspado, no una cifra de uso. Y **un cero no es un hueco** — un día anterior al contador dice «sin registro». Corrige la entrada de `DESPUES` sobre el pasajero como usuario. Migración `0033` |
| **#381** | Los textos de privacidad. **La frase «no se envía a ningún servidor» se retiró**, no se precisó: era cierta de lo que hacemos y más ancha que lo que la pantalla sostiene, porque los mosaicos se piden a un tercero y el mapa se encuadra a lo que el pasajero mira. Una promesa sobre **el dónde** ata a la arquitectura futura; una sobre **el para qué** sólo se rompe si el dato se usa para otra cosa. Y lo que cuesta, dicho en voz alta: **es un guardián menos** — la regla dejó de estar donde el pasajero podía leerla y reclamarla. Contesta la pregunta que el #371 había dejado abierta, y ninguna de las tres salidas que ésta planteaba, porque **las tres suponían conservar la promesa** |

**Los que faltan del rango, y por qué faltan.** Un hueco en esta tabla no es un renglón
que se olvidó, así que se enuncia en vez de dejarlo adivinar. **#359 a #365** son
anteriores a este documento y sus lecciones están arriba, en las trampas y en lo que hay
que poder explicar. **#369** es este archivo. **#371** abría la pregunta de la frase de
privacidad y el **#381** la contesta, así que el renglón vive ahí. **#363 y #379 no
existen** — el rango salta esos dos números.

---

## Cómo se mantiene este documento

Al cerrar cada PR: un renglón en la bitácora, y —si el PR cambió una regla de trabajo o
destapó una trampa nueva— el renglón que corresponda arriba. **Si un cierre no deja nada
que un chat nuevo necesite saber, no se inventa el renglón**: se deja la bitácora como
está y ya. Un documento de arranque que crece por obligación deja de leerse, y entonces
no sirve para lo único que existe.
