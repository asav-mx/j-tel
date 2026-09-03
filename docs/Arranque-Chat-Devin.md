# Arranque de un chat nuevo

**Qué es.** Lo que hay que pegarle a un chat nuevo para que se ponga al día solo, y
—más importante— **cómo comprobar que de verdad se puso al día** en vez de haber
leído por encima y contestado con generalidades.

**Por qué existe.** Un chat nuevo llega sin nada. Si arranca a construir con contexto
a medias, lo que produce se ve bien y está mal: en este repo las fallas caras no son
código que no compila, son afirmaciones falsas dichas con autoridad. La forma de
atajarlo es barata — leer en orden, y después **contar de vuelta**.

**Última actualización: 3 de septiembre de 2026**, al cerrar el #368.

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
>    `docs/`. Pídeme el rango si no es obvio; hoy el corte útil son del #359 al #368.
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

---

## Lo que tiene que poder explicar de vuelta

No se pide que recite. Se pide que **conteste con lo que la cosa hace**, y que sepa
distinguir lo decidido de lo pendiente.

**Del Marco.** Qué prohíben D, E y F, y en qué se distinguen: en D el dato existe y
engaña por dónde queda; en E el dato no existe y se completa porque la pantalla se ve
mejor entera; F le escribe el alcance a las dos y dice dónde sí se puede montar algo
para probar.

**De la cara pública.** La escalera de cuatro estados, en orden, y **las dos reglas
duras**: la asignación es plan y no evidencia —`estadoDelCircuito` ni siquiera recibe
cuántas unidades hay asignadas—, y los dos estados con evidencia exigen corredor, por el
caso del camión del patio.

**De lo que gobierna el interruptor del rango.** Que apagado se calla **toda** afirmación
de tiempo —la cifra, la palabra, el color y la promesa en futuro—, y que la frescura
aplica esté el interruptor como esté.

**De las vallas que existen, y qué prueba cada una.** `PermisoDeRango`, que hace que
fabricar un minuto sin permiso no compile; y el candado de siembra, que compara
**identidad de base** y no cadenas. Y sobre todo: **qué NO prueba cada una** — está
escrito en su archivo.

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

---

## Cómo se mantiene este documento

Al cerrar cada PR: un renglón en la bitácora, y —si el PR cambió una regla de trabajo o
destapó una trampa nueva— el renglón que corresponda arriba. **Si un cierre no deja nada
que un chat nuevo necesite saber, no se inventa el renglón**: se deja la bitácora como
está y ya. Un documento de arranque que crece por obligación deja de leerse, y entonces
no sirve para lo único que existe.
