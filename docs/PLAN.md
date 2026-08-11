# J-Telemetry — El Plan

**Corte: 3 de agosto de 2026.**
**Última edición: 6 de agosto de 2026** (Tramo 2 · la ficha de consolidación de §5
reescrita contra producción, y la regla de la fecha de medición en §0).

Este es el único plan. Reemplaza a `PLAN-v1.md`, a `Plan-Camino-a-v1.md`, a
`docs/marco-limpio/Despues.md` y a la parte de orden de `DESPUES.md`.

**La jerarquía, completa:**

| Documento | Qué es |
|---|---|
| `Marco-Limpio-J-Telemetry-MAESTRO.md` | **La ley.** Manda sobre todo, incluido este plan |
| **Este documento** | **El orden.** Qué se hace, en qué secuencia, y qué desbloquea qué |
| `DESPUES.md` | **El backlog.** Lo que decidimos no hacer ahora, y por qué. Sin orden ni fechas |

Tres documentos vivos. Ninguno más.

---

## 0. La regla de este documento

> **Toda actualización se hace editando este documento. Nunca creando uno nuevo.**

Si algo cambia, se edita aquí. Si aparece un frente nuevo, se agrega aquí. Si
algo sale del plan, se mueve a `DESPUES.md` y se borra de aquí.

Un plan nuevo con otro nombre no es una actualización: es una contradicción
futura. Ya nos costó — llegamos a tener cinco documentos gobernándose entre sí,
con once contradicciones medidas entre dos de ellos.

**Corolario:** una ficha de handoff describe *cómo* se construye una pieza, no
*cuándo*. Las fichas pueden multiplicarse; el orden vive solo aquí.

### La segunda regla: toda cifra lleva su fecha de medición

> **Un número sin fecha no entra a este documento.** No como cortesía: como
> formato.

Salió de encontrar el mismo dato en cuatro lugares del repo diciendo dos cosas.
§5 afirmaba **330** acusaciones con una unidad que sí llegó; la bitácora de este
mismo documento, el reporte final y la tabla de los sensores decían **335**; y al
remedirlo el 6 de agosto eran **341**. **Ninguna de las tres estaba mal cuando se
escribió.** Lo que estaba mal es que ninguna decía cuándo.

Es la familia de la regla 18 de «las ganadas por las malas» — *el eje es parte del
resultado*— aplicada al eje que más barato se olvida, que es el tiempo. Una cifra
de un sistema vivo no es un hecho: es **una foto**, y una foto sin fecha envejece
sin avisar. Quien la lee seis días después no tiene forma de saber si sigue
siendo cierta, y **no puede distinguir un número estable de uno que nadie ha
vuelto a mirar** — que es la regla 8 aplicada a los documentos.

Lo que exige al escribir:

- **La fecha va pegada al número**, no en el encabezado de la sección. Una sección
  fechada con cifras de tres días distintos miente sobre las otras dos.
- **Si el número se mueve solo, se dice.** «341 al 6 de agosto, y el Campus sigue
  produciéndolos» vale más que «341», porque avisa de que caducará.
- **Si no se puede fechar, no se afirma:** va como 🔵 reportado o 🟡 inferencia,
  con quién lo dijo y cuándo.
- **Y un 🟡 lleva pegado el costo de medirlo.** Si medir cuesta poco —leer un
  archivo, comparar dos cadenas—, no se marca: **se mide**. El 🟡 es para lo
  que hoy no se puede comprobar, y ahí se dice **qué haría falta** para pasarlo
  a 🟢. Sin eso, la marca de duda deja de leerse como «falta comprobar» y pasa
  a leerse como matiz que suaviza el hallazgo — le pasó a T4 el 8 de agosto de
  2026, y le bajó la prioridad a un riesgo que era real (ver la entrada del 10
  de agosto en §9).
- **Y el eje junto a la fecha**, cuando la cifra agrega: por día · por servicio ·
  por unidad · por contrato. Los dos ejes o ninguno.

---

## 1. Qué es v1

> **v1 es el conjunto de tareas documentadas, terminadas y corriendo en
> producción.**

No es una calificación. Es un estado funcional.

**Y el 90% no mide acierto: mide capacidad de mostrar.**

En el cierre de cada turno, el sistema puede **enseñar evidencia** del ≥90% de
los perfiles y rutas:

- Si **cumplió** → sale como ya está diseñado.
- Si **no cumplió** → se puede mostrar **qué se hizo** y decir **por qué no
  cumplió**, con números auditables.

Esta definición reemplaza a la anterior ("≥90% contra verdad de campo sostenido
dos semanas"). La vieja dependía de que alguien externo declarara cuál era la
verdad. Esta se mide sola: ¿puedes abrir el expediente y explicarlo? Sí o no.

**Lo que la definición nueva arrastra, y hay que decirlo:**

1. **El expediente del no cumplido deja de ser adorno y pasa a ser el corazón de
   v1.** Sin esa pantalla, "explicar por qué no cumplió" es buena intención: el
   motor puede medir el porqué y nadie lo ve.
2. **"El hecho debe bastarse a sí mismo" pasa a ser bloqueante.** Si un veredicto
   no puede explicarse sin salir a buscar cosas que ya cambiaron debajo de él,
   entonces no se puede cumplir esta definición.
3. **Sigue vigente la segunda condición:** ninguna cara de cliente accesible sin
   autenticación.

---

## 2. Reglas de trabajo

**Del repo:**

- Una rama por tarea · todo por PR · nunca directo a `main`.
- **Un carril a la vez**, salvo carpetas distintas (`packages/` vs `apps/web`) y
  worktrees separados.
- **Asav mergea** cuando el PR toca: el motor o cómo se sella un hecho · una
  migración de base · secretos, credenciales o variables · el Marco o este plan.
  **Devin mergea** lo demás: pantallas, reportes, vistas de solo lectura,
  documentos, pruebas, higiene. Si mezcla o hay duda, es de Asav.
- **`main` protegida** (activado el 3 de agosto): checks obligatorios y rama al
  día antes de mergear.

**De la verdad:**

- **Antes de afirmar, verificar.** Si no se midió, se dice como inferencia.
- **Las pruebas deben fallar contra código roto** antes de contar como cobertura.
- **Validar la medición no valida la interpretación.**
- **Cuando lo medido contradice una garantía, el sospechoso es el medidor.**
- **Cada hallazgo tiene derecho a una medición y a un arreglo.** Medir tres veces
  sin construir es no avanzar.

**Las ganadas por las malas:**

1. **Una migración se aplica ANTES de mergear el código que la necesita.** Con
   SQL directo, en transacción. Nunca `pnpm db:migrate` contra producción.
2. **Ordenar por fecha sin techo devuelve el futuro.** El generador crea
   ocurrencias por adelantado.
3. **El fallo silencioso que devuelve de menos es peor que el que revienta.**
4. **Si el default es un secreto, credencial, identidad o URL de base, no lleva
   default: revienta.**
5. **Una rotación de credencial se acompaña de redespliegue en el mismo
   movimiento.**
6. **Antes de mergear una rama vieja, revisar si toca archivos que cambiaron
   mientras esperaba.**
7. **Un `redirect()` desde un layout NO impide que la página hija se
   renderice.** Next las renderiza en paralelo, así que la respuesta sale con
   el código de la redirección **y el payload de la página dentro**. La guardia
   va **en el layout y en la página**: el layout como red para lo que nadie ha
   escrito todavía, la página como la comprobación que cuenta.
   **Y se verifica midiendo el cuerpo de la respuesta, no el código de
   estado.** Medido el 4 de agosto de 2026: `/cliente?account=tecma` contestaba
   **307 con 35 901 bytes** de payload RSC y «Tecma Planta 47 (73) y Campus
   Santos Dumont (25)» adentro. Una puerta que dice que no y pasa el expediente
   por debajo. Ver un 307 y darlo por bueno era lo fácil.

8. **Una defensa que ninguna prueba distingue de su ausencia no cuenta como
   defensa.** No basta con que las pruebas pasen: hay que poder quitar cada
   comprobación y ver cuál se cae. Si al borrarla nada se pone en rojo, o sobra
   —otra capa la tapa— o no sirve —ninguna entrada la dispara—, y las dos cosas
   se arreglan distinto pero ninguna se arregla dejándola ahí. Salió del
   validador de `?volver=` (#229): con las comprobaciones estructurales y la
   lista blanca en una sola función, **quitar la comprobación de origen no ponía
   nada en rojo** porque la lista blanca atajaba los mismos casos un paso
   después. Se partió en dos capas con batería propia cada una, y ahí sí: las
   seis mueren en rojo al quitarlas. De paso se descubrió una séptima que
   ninguna entrada podía disparar, y se borró — **un candado que no cierra nada
   solo infla la cuenta de candados.** Es el mismo criterio que la pared entre
   carriers: cerrado por construcción, no por disciplina repetida.
   **Y se aplica al instrumento tanto como al código.** Un medidor que devuelve
   cero cuando no midió nada se ve idéntico a uno que midió y encontró todo
   limpio: la compuerta de este mismo tramo dio verde en su primera corrida
   **con el servidor caído** —`curl` contestando `000`, cuerpo vacío, y contar
   ocurrencias sobre nada da cero—. La corrección es la misma de los dos lados:
   **contar también algo que TIENE que estar**, no solo lo que no debe estar.

   **Segundo caso del instrumento, y éste devolvió cero con una hipótesis viva.**
   🟢 El 6 de agosto se midió si las ocurrencias con la hora límite corrida
   estaban **seis horas** fuera. La consulta restó las dos horas con `::time` —y
   `::time` **no cruza medianoche**, así que `23:45 → 05:45` salió como **18
   horas** en vez de 6. El resultado fue **«0 hechos con desfase de 6 h»**, que se
   lee como *hipótesis refutada* cuando lo que estaba roto era la resta. El dato
   era correcto de los dos lados; **lo falso lo puso el operador**. Lo atrapó que
   el cero no cuadraba con las horas que ya estaban a la vista — **no una
   prueba**.
   La forma general: **un cero es una afirmación, y hay que poder distinguir
   «medí y no hay» de «mi medidor no puede verlo».** Cuando una resta puede
   envolver —horas, ángulos, módulos—, el cero es sospechoso por construcción.

   **Y un cuarto caso del eje, del 6 de agosto, que costó una ejecución
   detenida.** Se levantó una alarma —«la ventana corregida arranca quince
   minutos tarde»— apoyada en que la operación pica a las **14:00**. Ese dato
   salía de `DESPUES.md`, era **correcto**, y estaba **medido un solo día**: el
   27 de julio. 🟢 Remedido sobre **catorce días** hábiles contra la telemetría
   cruda, las seis rutas pican a las **15:00**, que las ventanas sí contienen.
   **La alarma era falsa y frenó una corrección que sí servía.**

   Lo que hay que sacar de aquí, porque es lo que no era obvio: **una medición
   vieja del propio repo es tan peligrosa como una mal hecha, y más — porque
   viene con sello de casa.** Un número de `DESPUES.md` se lee como verificado
   y no dice sobre cuántos días se agregó ni cuándo. **Antes de apoyar una
   decisión en una cifra del repo, se comprueba su eje y su fecha**, igual que
   si la hubiera traído un extraño. Es la regla de §0 —toda cifra lleva su fecha
   de medición— dicha desde el lado de quien la consume.

9. **Una causa no se acredita contra los que fallan; se acredita contra los que
   pasan.** Medir que el 100 % de los reprobados incumple una condición no
   prueba que esa condición los reprobó — solo prueba que la incumplen. La
   comprobación que decide es la del **grupo de control**: si los que **sí**
   pasaron también la incumplen, no era esa. Salió de la investigación de C11:
   se midió que 0 de 57 pendientes estaban dentro del tope de Fréchet y se
   concluyó que ese tope los rechazaba; **300 de los 319 aprobados también lo
   exceden**, y cumplieron igual. El dato era correcto y la conclusión falsa.
   Es la regla 8 mirando al otro lado: **la mitad que confirma una causa es la
   que la descarta.**

10. **Un check cuyo resultado se descarta no es un check.** **Nunca `>/dev/null`
    sobre una verificación**, y **`&&` en vez de `;`** para que el fallo detenga
    la cadena. Salió del #245: la build corrió, falló, y la línea decía
    `pnpm -r build >/dev/null 2>&1; pnpm ... tsc --noEmit && ...`. El error se
    fue a la basura y el `;` dejó seguir. Lo que se vio después —`tsc OK`,
    `548 passed`— **era cierto**: el paquete que fallaba no estaba en ninguno de
    esos dos. **Un verde honesto de la mitad equivocada se lee igual que un
    verde entero.**
11. **Una edición que no encuentra su patrón tiene que gritar.** **Toda
    sustitución lleva su `assert`, sin excepción.** Del mismo PR: una de doce
    sustituciones se escribió sin comprobación, su patrón vivía en otro paquete,
    y `.replace()` devolvió el texto intacto **sin decir nada**. Un editor que no
    distingue «cambié» de «no encontré» es la regla 8 aplicada a la herramienta:
    los dos estados se ven idénticos desde fuera.
12. **Hay defectos que solo el compilador ve. `pnpm build` va siempre, no solo
    la suite.** Vitest transpila con esbuild y **no typechequea**, así que un
    campo que falta en un tipo pasa la suite entera y revienta en `tsc`. En el
    #245 las pruebas **sí** atraparon la mitad —el campo llegaba `undefined` en
    tiempo de ejecución— y **ninguna podía ver la otra**. No fue un problema de
    orden ni de escribir la prueba primero: **fue no correr el compilador.**

14. **Una regla escrita no es una regla aplicada.** 🟢 El 6 de agosto de 2026,
    **la primera escritura de esta historia que rompe producción**: un guion
    dejó la política de un contrato real como un **arreglo** en vez de un
    objeto, y el motor no la podía validar. Detectada y revertida **en
    minutos**, sin pérdida —el original íntegro en el elemento 0— y con los
    1 057 hechos sellados intactos.
    **Lo que hay que registrar no es el error: es que las dos causas ya estaban
    escritas.** La **regla 10** —un resultado que no se comprueba no es un
    check— y la disciplina de **ensayar en la base desechable**. Las dos
    existían, las dos se saltaron, y ninguna de las dos avisó de que se estaba
    saltando. **Una regla vive en la cabeza de quien la recuerda hasta que algo
    la hace obligatoria**: por eso el guion ahora **lee de vuelta antes de decir
    que sí** y **sale con código 1** si no cuadra. La regla que no se puede
    saltar es la única que se aplica sola.
16. **Un instrumento no está probado hasta que se comprueba que su AVISO LLEGA
    a un humano. Detectar y avisar son dos cosas, y la segunda casi nunca se
    prueba.** Dos generaciones del mismo vigilante, las dos fallando del mismo
    lado:

    - **1ª** — el heartbeat vivía **dentro de Vercel** y cayó con lo que
      vigilaba: 🔵 **13 horas** a ciegas (2026-07-28). La lección que se sacó fue
      *«el vigía tiene que vivir fuera»*, y se construyó uno en GitHub.
    - **2ª** — ese vigilante nuevo. 🟢 **117 corridas, cero éxitos, NUEVE DÍAS
      mudo.** Detectaba el 503 perfectamente y **no podía avisar**: `gh` sin
      `GH_REPO` moría con «fatal: not a git repository», y **la etiqueta `salud`
      ni existía**. Dos defectos, los dos en el camino del aviso.

    **Lo que corrige del aprendizaje anterior:** sacar al vigía de la
    infraestructura que vigila resolvió **dónde vive** y no tocó **si habla**. La
    independencia era necesaria y no suficiente. **Un vigilante mudo es peor que
    ninguno: con ninguno, alguien mira; con uno roto, nadie.**

    **Cómo se prueba, y es lo único que cuenta:** se **provoca un aviso a
    propósito** y se comprueba que llegó. Por eso `salud.yml` tiene
    `simular_codigo`. **Hasta que ese aviso se vio llegar, el instrumento no
    cuenta.** Es la regla 8 llevada al final: ahí el que no se distinguía de su
    ausencia era la defensa; aquí es **el canal**.

17. **Una verificación que usa el mismo instrumento mal configurado no
    verifica: confirma el error.** Repetir no es contrastar.

    🟢 **Cuarta vez en una sola sesión, 6 de agosto.** La prueba
    `generateForProfile — alineación de calendario` salió roja porque se corrió
    con `npx vitest` en vez del comando sancionado, que fija **`TZ=UTC`**. La
    máquina está en `America/Ciudad_Juarez`, así que `2026-08-22T00:00:00Z` cae a
    las 18:00 del 21 y el generador produjo el viernes. **La prueba existe justo
    para atrapar ese error de zona, y se le provocó desde fuera.**

    **Lo grave vino después:** para saber si el rojo era preexistente se revirtió
    a `origin/main` y se corrió otra vez — **con el mismo comando mal
    configurado**. Salió rojo igual, y eso se leyó como «es preexistente». **No
    probó nada sobre `main`: repitió el error.** Con el comando sancionado, 25 de
    25 pasan.

    **La diferencia entre repetir y contrastar:** repetir es correr lo mismo y
    ver lo mismo — que es lo que un instrumento mal puesto garantiza. Contrastar
    es **cambiar algo que debería cambiar el resultado**: otro comando, otro eje,
    otro grupo. Es la regla 9 —una causa se acredita contra los que pasan—
    aplicada al medidor: **el control no es correrlo de nuevo, es correrlo
    distinto.**

    Y la señal barata que lo delata: **un resultado idéntico en dos condiciones
    que deberían diferir** es sospecha de instrumento, no confirmación de
    hallazgo.

18. **Una medición agregada puede confirmar lo que la medición por caso
    desmiente. El eje es parte del resultado.** Sobre veinte días, el 100 % del
    trazado tenía traza real a menos de 500 m — «el trazado sí corresponde». En
    **un** día, un tercio no lo pisaba nadie. Las dos mediciones eran correctas
    y decían cosas opuestas **porque agregaban distinto**. Al reportar, el eje
    —por día, por servicio, por unidad, por mes— **va dicho junto al número**, y
    una conclusión sacada de un agregado **no se aplica al caso** sin volver a
    medir ahí. Es la hermana de §D del Marco: aquélla es sobre el alcance
    temporal de una cifra, ésta sobre el nivel al que se agregó.

    **Tercer caso, y el más barato de repetir — el promedio que mezcla un
    periodo roto con periodos sanos.** 🟢 Medido el 6 de agosto: este plan decía
    que el archivador iba **«~7 h detrás, p95 30 h»** (C3). Por semana de
    `recorded_at`: **22.13 h** la del 6 de julio, y **0.10 h** de la del 13 en
    adelante — hoy va a **seis minutos**. El «~7 h» no era falso: era el
    promedio de las dos cosas, y **no describía ningún momento que haya
    existido**. Un lector razonable lo entiende como «así va el archivador», y
    así no fue nunca.

    Lo que distingue este caso de los otros dos: ahí el eje era el **nivel de
    agregación** —día contra periodo—; aquí es que **el periodo abarcaba un
    cambio de régimen**. Promediar a través de un antes y un después borra
    justo el hecho de que hubo un antes y un después. **La pregunta que lo
    atrapa: ¿este número describe un estado, o el promedio de dos estados
    distintos?** Si es lo segundo, la serie va en vez del promedio.

19. **Un comentario que miente sobre el código es peor que ninguno.** Uno
    ausente deja al lector leyendo el código; uno falso lo convence de que no
    hace falta leerlo. 🟢 El caso, del 8 de agosto de 2026 y es de C12:
    `monitoreo-data.ts` pasaba `frechetMaxKm: 0.8` **dos líneas debajo de un
    comentario que decía «umbrales de la política del contrato»**. Los otros
    tres umbrales de esa llamada sí salían de la política, así que el
    comentario era cierto para la mayoría y falso para el que importaba — que
    es la forma más difícil de detectar, porque no se contradice de lejos.

    Es §D del Marco aplicado al código en vez de a la pantalla: el dato era
    correcto, lo falso lo puso **lo que estaba escrito junto a él**. Y ninguna
    prueba lo ve: un comentario no compila, no corre, y no falla.

    Lo que exige: cuando un comentario afirma de dónde sale un valor —«de la
    política», «del contrato», «del esquema»— esa afirmación se comprueba
    contra la línea, no contra la intención de quien la escribió. Y cuando un
    comentario cubre varias líneas, vale para **todas**: si una se sale, o se
    cambia la línea o se acota el comentario.

**De producto:**

> *"¿Esto tendría sentido para una planta en Bogotá cuyas rutas nunca hemos
> visto?"* Si sí, es producto. Si solo tiene sentido por una ruta específica, es
> caso de uso y va mal.
>
> **Planta 47 es el laboratorio, no el paciente.**

**Las dos caras no son simétricas. El carrier es producto, no anexo.**

La cara del cliente y la del carrier no son dos vistas del mismo sistema con
distinta pintura. Son **dos productos que se tocan en el contrato**.

Para el carrier, sus unidades son **una sola operación**. El mismo camión sirve a
una planta el lunes y a otra el martes; su mantenimiento, su diésel, su chofer y
su historial son los mismos sin importar a quién sirvió ese día. El carrier ve
**todo su universo, sin partir por contrato**. Partírselo sería romperle su
realidad para acomodar la de otro.

Sobre estos cimientos se construyen pisos: la suite del carrier crece hacia sus
propias unidades y actividades, y esa suite se vuelve más valiosa cuando
J-Telemetry sustituya a los proveedores de GPS actuales —obsoletos y casi
imposibles de programar alrededor. El carrier además puede ofrecer la
verificación como **valor agregado** de su operación frente a la planta.

**Las dos líneas que no se cruzan**, y son del Marco («Las leyes (intocables)»):

1. El carrier ve **todo lo suyo**, y **nada de lo interno del cliente** — ni
   otros carriers de la misma planta, ni operación que no sea suya.
2. El cliente **jamás** ve la operación interna del carrier.

**Consecuencia para las guardias:** el alcance del carrier se resuelve contra
**su universo**, no contra el contrato por el que llegó. Por eso `/carrier`
necesita la misma procedencia por fila que `/cliente` — no para partirle la
vista, sino para que la pared entre carriers la sostenga la estructura y no la
memoria de quien escribe cada pantalla.

**Y esto último hay que decirlo medido, porque la primera redacción de este
párrafo sugería que hoy los carriers se alcanzan entre sí, y es falso.** El 4
de agosto de 2026 se armó el escenario en la rama desechable —dos
transportistas sirviendo a la misma planta— y se pidió, desde B, todo lo de A:
la unidad, el contrato, el servicio, el lienzo con la unidad ajena por
parámetro y el lienzo entrado por el servicio ajeno. **Los seis caminos
niegan.**

Lo que sí es cierto es otra cosa, y es la que manda el trabajo:

> `/carrier` está cerrado **por disciplina repetida, no por construcción.**
> Son cinco comprobaciones escritas cinco veces, en cinco archivos, cada una
> dependiendo de que quien escribió esa pantalla se acordara de filtrar por
> carrier. `/cliente` tiene **un solo** `exigirRecurso`, en un lugar.

El riesgo, entonces, no es lo que hoy se ve. Es **la pantalla dieciséis**: la
que alguien escriba mañana y olvide el filtro. No rompe nada, no falla ninguna
prueba, y filtra en silencio. Es la forma exacta del `[0]` de
`resolveAccountByType` que cerró el #222 — invisible mientras haya una sola
cuenta de ese tipo, y una fuga el día que haya dos.

**Lo que es real y lo que no:** la única cuenta con operación real es **Tecma**.
Honeywell y PRUEBA REAL son cuentas de ejemplo. Ningún análisis, conteo ni
conversación con cliente las incluye.

---

## 3. Lo que solo Asav puede desbloquear

**Esta sección va primero a propósito.** El cuello de botella del plan no es
código: son las entradas que esperan a una persona. Varias están en la ruta
crítica y detienen tramos enteros.

**Al 3 de agosto por la tarde quedan nueve.** Empezaron siendo trece; Clerk y el
dominio se resolvieron el mismo día.

### 3.1 Trámites

| # | Trámite | Qué desbloquea | Estado |
|---|---|---|---|
| **T1** | **Clerk** | Todo el candado, el login real y el tramo vendible | ✅ **Hecho.** Aplicación `J-Telemetry` creada · **sin organizaciones** (verificado contra el código) · **solo Email** · llaves de test en Vercel: la pública en los 3 entornos sin sensitive, la secreta en Production y Preview con sensitive. Las llaves de producción se generan al conectar el dominio |
| **T2** | **Correo — y son dos cosas, no una.** (a) **Resend**: verificar dominio, API key, tres variables. (b) **Que exista `hola@j-telemetry.com`** | (a) Que las alertas salgan de verdad. Hoy `/api/cron/alertas` responde 503 cada 5 min: el sistema detecta y no puede avisar. (b) Que un cliente pueda escribir. **(b) es de negocio, no de sistema** | **Pendiente.** Alta. El instrumento existe y no tiene bocina — y el landing no tiene buzón |
| **T3** | **Dominio** | Los subdominios del producto | ✅ **Resuelto: `j-telemetry.com`.** `j-tel.io` queda descartado — pero ver la deuda que deja, abajo |
| **T4** | **Rotar la contraseña del readonly** | `jtel_readonly` y `neondb_owner` compartían contraseña | 🟨 **PARCIALMENTE CERRADA al 10 de agosto de 2026: la mitad de lectura rotada y verificada, la del dueño pendiente y con procedimiento escrito.** 🟢 **Mitad de lectura, cerrada.** Asav rotó `jtel_readonly` en Neon y actualizó `DATABASE_URL_READONLY`. Comprobado sobre el `.env` vigente: huellas SHA-256 **distintas** (dueño `c9e9b7f65e65`, lectura `61d0eada3d3b`), **y los dos passwords legibles** —lo que confirma que el detector *corrió* y no se saltó en silencio, que es su modo de falla conocido—. `verificar-solo-lectura` en verde el 10 de agosto: **42 tablas, 42 legibles, cero escribibles**. ❌ **Corrección del 10 de agosto: el matiz 🟡 «hosts distintos, quizá una réplica» era FALSO.** Medidos, son **el mismo endpoint** `ep-fancy-shape-ad8idz4g`; el de lectura es su variante `-pooler`. No había réplica que salvara nada: **el ataque sí habría funcionado**. ❌ **Y «con redespliegue en el mismo movimiento» también sobraba:** medido el 10 de agosto sobre `origin/main`, **nada en producción consume `DATABASE_URL_READONLY`** —sus únicos lectores son los guiones de `packages/db/src/`, que se corren a mano; la app y los 8 crons entran por `DATABASE_URL`—, así que no hay nada que redesplegar. ⏳ **Lo que falta:** (a) actualizar el valor en Vercel — no rompe producción, pero un `pnpm env:pull` con el valor viejo reparte una credencial muerta; (b) **rotar `neondb_owner`**, porque la contraseña que estuvo compartida **sigue viva en la cuenta dueña** — decidido por Asav el 10 de agosto, ver el procedimiento en `docs/Procedimiento-Credenciales.md` |
| **T6** | **Tres identidades de prueba en Clerk** | Que Asav pueda abrir **las tres caras a la vez** en navegadores distintos, que hoy no puede | **Pendiente.** Alta. Tres usuarios en la instancia de prueba con la convención `+clerk_test` —sin buzón real, marcados por construcción—, con nombre y apellido, y sus tres `user_...`. Deja **3 filas** en `user_memberships` y nada más: ni cuentas, ni hechos, ni veredictos. Ver `Ficha-Identidades-De-Prueba.md`. **La cara de planta no se podrá ver hasta 1.h** |
| **T5** | **`CRON_SECRET`** | — | ✅ **Cerrado.** Rotado en Vercel · el valor viejo fuera de los documentos desde el 2 de agosto (comprobado sobre `main` el 4: cero archivos versionados) · **permanece en el historial de git, rotado y sin efecto** — no se reescribe historia por esto (decisión de Asav, 4 de agosto) |

**Deuda que dejó T3 — ✅ saldada el 3 de agosto** (#212 y el PR de fichas).
`j-tel.io` salió del landing, su CSS, nueve archivos de prueba, el Brief de
identidad, el skill de interfaz y las tres fichas del Marco. Solo sigue escrito
donde se le nombra **como descartado**: aquí, en `DESPUES.md` y en la foto de
`corte-2026-08-03/`.

**Y destapó algo peor que el dominio viejo.** Los dos botones de contacto del
landing —«Solicitar demo» y «Hablar con el equipo»— apuntaban a
`hola@j-tel.io`, **un buzón en un dominio que nunca se compró**. Es decir:
el botón de solicitar demo lleva muerto desde que el landing existe. Cambiarlo
a `hola@j-telemetry.com` no lo revive por sí solo — hace falta que el buzón
exista. Por eso T2 tiene ahora dos mitades.

### 3.2 Decisiones

Cada una lleva **la recomendación del chat** y el porqué. Asav decide.

---

**D1 · Los 294 hechos sellados con el deadline mal calculado**

*Qué pasa:* el deadline dependía de dónde corrió el generador. Ya hay corrección
de código; la pregunta es qué se hace con los **294 hechos ya sellados** bajo la
regla vieja.

### 🟢 Los 294 dejan de ser un número: tienen población identificada (6 ago)

Comparado **ocurrencia por ocurrencia** con `clasificarDiferencia` —el mismo
clasificador que usa el guion `corregir-deadlines`— pero **sin su filtro
`expected_deadline > now()`**, que es justo lo que le impide ver las selladas:

| Población | Hora guardada | Corrimiento | Ocurrencias |
|---|---|---|---|
| Planta 47 · **Turno A** | 23:45 (contra 05:45) | **+360 min** | **210**, todas selladas |
| Planta 47 · **Turno B** | 11:45 (contra las 17:45 que su turno implicaba entonces) | **seis horas** | **84**, todas selladas |
| | | | **294** |

> 🟢 **Y el código lo dice por su cuenta, que es lo que la cierra desde dos lados.**
> El comentario de `packages/db/src/repositories/index.ts:2168` —escrito al arreglar
> el defecto, sin haber contado esta población— dice que esas seis horas
> *«produjeron **294 hechos sellados** a la hora equivocada, **con un solo cumplido**
> entre todos»*. 🟢 **La base dice lo mismo por camino independiente:** 210 del Turno
> A —que tiene exactamente **1** cumplido— más 84 del Turno B con **cero**.
> **El número y el reparto coinciden sin que ninguno se derive del otro.**

> 🟢 **Las dos están exactamente seis horas corridas**, que es la forma del defecto
> que el propio guion documenta: *«`computeExpectedDeadline` construía la fecha sin
> marca de zona… las ocurrencias generadas por el cron de Vercel (UTC) quedaron
> seis horas corridas»*. **210 + 84 = 294**, el número exacto de esta decisión.

⚠ **Y hay que decir qué NO son, porque el clasificador de hoy los mezcla.** Corrido
sobre toda la base, `causa: zona` + sellada da **330**, no 294. Los **36** de
diferencia son ocurrencias del Turno B a las **17:45**, que **eran correctas al
generarse** —el turno era 18:00— y quedaron viejas cuando el turno se movió a
15:30. **Ésas son C21, no D1**: no hay defecto de cálculo, hay un cambio que no
alcanzó a lo ya generado. El clasificador no las distingue porque compara contra el
turno de **hoy**.

⚠ **Y un aviso de lectura, porque este documento ya tiene dos:** este **330** no es
el **330** de C13 —aquél era `no_cumplido` con una unidad que sí llegó, y hoy son
341—. **Mismo número, dos poblaciones sin relación.** Es la familia de C20 aplicada
a las cifras en vez de a los nombres.

*Recomendación:* **corregirlos, con firma y motivo canónico.** Un hecho sellado
contra un deadline equivocado es una acusación mal medida, y la ley dice que la
política cambia hacia adelante pero un **error** de cálculo no es un cambio de
política: es un defecto. Se corrige como re-verificación explícita y auditada, no
en silencio.

*Bloquea:* el orden es primero el código, después los datos.

---

**D2 · Turno B de Planta 47 — la hora declarada no cuadra con la hora límite**

*Qué pasa:* **No es código: es una conversación con la Planta** para confirmar la
hora real y a qué turno pertenecen esas rutas.

### 🟢 Cuál de los dos «Turno B» es — medido el 6 de agosto

**No están mezclados: cada uno cuelga de un contrato distinto de la misma cuenta**,
así que la pregunta tiene respuesta limpia.

| | **Planta 47 · Turno B** | **Campus · Turno B** |
|---|---|---|
| Cuenta cliente | Tecma | Tecma |
| Contrato | `Tecma 47 - Transporte Personal` | `TECMA Campus Santos Dumont - Juarez Bus` |
| Alcance | planta **Tecma Planta 47** | grupo **Campus Santos Dumont** |
| Arranca (hoy) | **15:30** | **18:00** |
| Ruta-turnos | 6 (Huertas-B, Juárez Nuevo-B, Km 30-B, Riveras 9-B, San José-B, San José Auxiliar-B) | 5 |

> 🟢 **El de D2 es el de Planta 47.** No cruza cuentas —los dos son de Tecma con
> Juárez Bus— pero **sí cruza contratos dentro de la misma cuenta**, que es
> exactamente donde un conteo «por Turno B» suma dos cosas sin avisar. Ver **C20**.

**🟢 Y los 36 son 100 % de Planta 47.** Medido sobre la ventana original (servicios
hasta el 28 de julio):

| | Planta 47 · Turno B | Campus · Turno B |
|---|---|---|
| Hechos | 84 | 70 |
| Fallos | **84 — el 100 %** | 32 |
| Cumplidos | **0** | **38** |

Las seis rutas `- B` dan **14 hechos y 14 fallos cada una, sin excepción**. El «36»
original era 6 rutas × 6 días; la serie completa hasta el 28 de julio da 6 × 14 =
**84**, con la misma tasa. **El Turno B del Campus nunca estuvo en ese conteo**, y
en esa misma ventana iba 54 % cumplido.

### 🟢 La hora límite tuvo TRES regímenes, no uno

**Corrección de método, y va escrita porque casi cuesta la conversación:** la
primera lectura de esta sección tomó la hora límite con `min()` —o sea **la más
vieja de la serie**— y la presentó como el estado de hoy. Son tres:

| Hora límite | Fechas de servicio | Ventana vigilada | Ocurrencias | Selladas | Cumplidas |
|---|---|---|---|---|---|
| **11:45** | 9 → 28 jul | 10:45–12:30 | 84 | 84 | **0** |
| **17:45** | 29 jul → 28 ago | **16:45–18:30** | 138 | 36 | **0** |
| **15:15** | 31 ago → 4 sep | **12:59–16:00** | 30 | 0 (aún futuras) | — |

> 🟢 **La premisa de D2 era correcta para julio:** el régimen de 17:45 con ventana
> 16:45–18:30 es exactamente «declarado 18:00», y así lo describió `DESPUES.md` el
> 28 de julio. **Lo que pasó después es que alguien ya movió el turno a 15:30**, y
> las ocurrencias generadas desde el 1 de agosto derivan bien: 15:15.
>
> 🔵 **Y aquí está lo que cambia de qué se trata.** `DESPUES.md` midió que estas
> rutas se recorren **alrededor de las 14:00**. Las 14:00 **no caen ni en
> 10:45–12:30 ni en 16:45–18:30** — caen justo dentro de **12:59–16:00**, que es la
> ventana del régimen nuevo. **Es la primera que contiene la operación.**
>
> 🟢 **Pero ese régimen empieza el 31 de agosto.** Entre hoy y el 28 quedan **102
> ocurrencias** que se juzgarán con la ventana que no contiene la operación. Y en
> los dos regímenes ya sellados van **cero cumplidos de 120**.

### 🟢 Qué es posible con esas 102 — capacidad, no recomendación (6 ago)

**El 31 no lo eligió nadie.** `renewRollingWindow(30)` genera desde
`max(service_date) + 1` hasta hoy + 30 días. Medido corrida por corrida: **todas**
aterrizan a 30 días exactos. La última que produjo 17:45 fue la del **29 de julio**
(llegó al 28 de agosto); la primera con 15:15, la del **1 de agosto** (llegó al 31).
El 29 y 30 de agosto son fin de semana. **El 31 es la primera fecha que no estaba
generada cuando cambió el turno.**

🟡 El turno cambió **entre esas dos corridas**. No se puede precisar más: **`shifts`
no tiene `updated_at`**, así que cuándo se cambió la hora **no se lee de la base**.
Es C13 en otra tabla.

**Reparto de las 138 del régimen 17:45, al 6 de agosto:**

| | Ocurrencias | Fechas |
|---|---|---|
| Selladas | **36** | 29 jul → 5 ago, todas pasadas |
| Sin sellar — hoy | **6** | 6 de agosto |
| Sin sellar — por venir | **96** | 7 → 28 de agosto |

**Cero sin sellar en el pasado.**

**La hora límite NO es inmutable.** El guion `corregir-deadlines` la corrige **en
sitio** —`UPDATE` sobre `expected_deadline` y la ventana del viaje, sin borrar ni
recrear, porque el índice único es `(service_profile_id, service_date)` y el
deadline no participa en ninguna restricción—. Sus cuatro guardas:

| Guarda | Las 102 |
|---|---|
| Sin hecho sellado | ✅ las 102 |
| Con viaje | ✅ las 102 |
| Cero puntos de evidencia anclados | ✅ las 102 |
| Viaje en `en_espera` | ✅ las 102 |

> 🟢 **Las 102 cumplen las cuatro.** Por las guardas del guion son **corregibles en
> sitio**. Las 5 del Campus también, con la diferencia de que el guion las clasifica
> como `deriva` y **no las toca sin `--con-deriva`**, mientras que las 102 salen
> como `zona` y entran por omisión.
>
> ⚠ **Dos límites que van dichos:** el guion **solo mira `expected_deadline > now()`**,
> así que las 6 de hoy salen o no de su alcance según a qué hora corra; y **es
> simulacro por omisión** — sin `--aplicar` no escribe nada.

**Esto es lo que el sistema permite hoy. Qué hacer con ellas no se decide aquí.**

### ✅ Decidido por Asav el 6 de agosto de 2026

> **Se corrigen las 96 futuras del Turno B de Planta 47. Las 5 del Campus no se
> tocan.**

**La razón de corregir las 96, escrita para dentro de tres meses:** ninguna está
sellada, así que **no se reescribe ningún hecho**; y si no se corrigen, se van a
juzgar con una ventana que ya se sabe que no contiene la operación. **Sellar 96
acusaciones que se saben falsas es peor que corregir 96 ocurrencias que nadie ha
visto.** La política cambia hacia adelante, y esto es hacia adelante.

**La razón de dejar correr las 6 de hoy — decidido el 6 de agosto:** se van a
sellar mal y **se asume**. Son **6 contra 96**, y el guion no sabe separarlas sin
editar el SQL a mano. **Correr una herramienta que se sabe rota para ganarle al
reloj es peor que perder seis**: dejaría dos cosas movidas y ninguna medida. El
reloj venció a las 17:45 locales de ese día.

**La razón de NO tocar las 5 del Campus:** ahí **no hubo defecto** — hubo una
política que cambió cinco minutos. **Corregir eso sería reescribir una decisión, no
un error.** Por eso el guion las clasifica como `deriva` y las deja fuera sin
necesidad de bandera.

### ⚠ Lo que la corrida en seco destapó DESPUÉS de la decisión

🟢 **Simulacro corrido el 6 de agosto** con la credencial de solo lectura en
`DATABASE_URL` —para que no pudiera escribir ni por error—: **102 por `zona`, 5 por
`deriva` (no se tocan sin `--con-deriva`), cero bloqueadas.** Dos cosas que la
decisión no tenía enfrente:

**1 · El guion no sabe elegir 96 en vez de 102.** Su único filtro es
`expected_deadline > now()`. Al 6 de agosto a las 06:13 locales, las 6 de hoy
todavía **no** han pasado su hora límite —vence a las **17:45 local / 23:45 UTC**—
así que **el guion las ve y las incluiría**. Después de esa hora salen solas. Las
tres formas que existen: correr ahora y tocar **102** · correr después de las 17:45
y tocar **96**, con las 6 ya camino de sellarse con la ventana vieja · o usar
`--sql` y **quitar a mano las 6 del `VALUES`**, que es la única que elige por
decisión y no por reloj — el SQL lleva las mismas guardas dentro del `WHERE`.

**2 · La ventana que escribe el guion NO es la que escribe el generador.** 🟢
`computeEvidenceWindow(deadline, policy, route?)` deriva la ventana por ruta cuando
recibe su tercer argumento. **El generador se lo pasa** (`repositories/index.ts:2176`);
**el guion no** (`corregir-deadlines.ts:89`), y además le arma una política de tres
campos, así que `maxWindowBeforeMinutes`, `windowSlackPct` y `routeAvgSpeedKmh`
llegan vacíos.

| | Arranque de la ventana |
|---|---|
| Lo que escribiría el guion | **14:15** local, fijo (deadline − 60 min) |
| Lo que el generador produjo para el régimen 15:15 | **12:59 a 13:59**, distinto por ruta |

> 🟢 **Y eso importa para lo que la corrección busca:** de las 30 ocurrencias que el
> generador creó bajo el régimen nuevo, **25 contienen las 14:00**. De las 102 de
> hoy, **cero** las contienen — arrancan todas a las 16:45. **Pero corregidas por el
> guion arrancarían a las 14:15, que también queda después de las 14:00.**
>
> ⚠ **Queda abierto**, y es lo que hay que resolver antes de aplicar: corregir con
> el guion mueve la hora límite bien y **deja la ventana quince minutos tarde**.

### ✅ Resuelto el 6 de agosto — el guion arreglado, y una corrección mía

**El guion se arregló primero** (#258): `ventanaCorregida` llama a
`windowForOccurrence` con la **política completa y el dimensionado por ruta**, así
que escribe **la misma ventana que el generador**. 🟢 **La valla es el compilador:**
el parámetro pide `ContractPolicy` completa —no `Partial`— y el dimensionado es
obligatorio, así que volver a pasarle tres campos sueltos **deja de compilar**.
Comprobado por mutación en los dos sentidos: aflojar el tipo a `Partial` rompe
`tsc`, y volver a la llamada vieja **mata 3 de las 14 pruebas**.

**⚠ Y una corrección a lo que se advirtió antes, porque frenó una ejecución.** La
alarma de «quince minutos tarde» descansaba en que la operación pica a las **14:00**
— dato de `DESPUES.md`, medido **un día** (27 de julio) y con otro método.

🟢 **Remedido del 23 de julio al 6 de agosto, días hábiles, las seis rutas contra la
telemetría cruda (~155 000 puntos sobre el trazado):**

| Ruta | Hora pico | Actividad 13–16 h | Actividad 16–19 h |
|---|---|---|---|
| Huertas - B | **15:00** (23 %) | 32 % | 14 % |
| Juarez Nuevo - B | **15:00** (36 %) | 44 % | 10 % |
| Km 30 - B | **15:00** (29 %) | 37 % | 13 % |
| Riveras 9 - B | **15:00** (33 %) | 42 % | 10 % |
| San Jose - B | **15:00** (24 %) | 35 % | 14 % |
| San Jose Auxiliar - B | **15:00** (22 %) | 34 % | 15 % |

> 🟢 **Las seis pican a las 15:00, no a las 14:00.** Las 14:00 son un pico
> secundario en cuatro de ellas. **La ventana vieja —16:45–18:30— se queda con el
> 10–15 % de la actividad; la nueva se lleva el 32–44 %.**

**La respuesta a la pregunta que condicionaba la corrección:**

| | |
|---|---|
| Ventanas corregidas que contienen las **15:00** (el pico real) | 🟢 **126 de 126** |
| Que contienen las 14:00 (el secundario) | 42 de 126 |

*(126 = las 96 del régimen 17:45 más las 30 que ya estaban bien; a las 30 la
corrección no les cambia nada.)*

🟢 **Y el detalle honesto del arreglo: cambia la ventana de dos rutas, no de las
seis.** Con la historia de hoy, cuatro rutas derivan un ancho menor al piso de la
política —60 min— así que quedan igual en **14:15–16:00**; *Juarez Nuevo* y *San
José Auxiliar* se abren a **13:47** y **13:56**. El arreglo importa porque el guion
**deja de inventar su propia ventana**, no porque mueva las seis.

> **Conclusión medida: la corrección sí resuelve el problema que la motivó.** Y la
> advertencia que la frenó era mía y estaba mal — no por el dato, que era correcto,
> sino por **apoyarla en una medición de un día cuando había catorce disponibles**.

**La pregunta para la Planta cambia de forma, y por eso importaba medirlo antes de
sentarse:** ya no es «¿es a las 18:00 o a las 14:00?». Es **confirmar que 15:30 es
la hora real** — y entonces la decisión de negocio es qué pasa con las tres semanas
que todavía se van a juzgar con la ventana vieja.

🟡 **Lo que no se decide desde aquí:** si el 11:45 salió de la zona horaria (D1) —el
hueco contra 17:45 es de seis horas exactas, que es la forma de ese defecto— o de
otra cosa. **No está probado**, y no hace falta probarlo para tener la
conversación.

*Recomendación:* **tener esa conversación antes de tocar el árbitro.** Es parte de
lo que Planta 47 no sella sin causa identificada —🟢 al 6 de agosto sella **11.0 %**
contra **53.9 %** del Campus— y arreglar el motor sin resolver esto mete ruido en
la medición.

*Ojo:* `PLAN-v1.md` lo declaraba ✅ resuelto. **Estaba equivocado.** Ver §7, F1.

---

**D3 · Regla de cierre del pendiente por evidencia**

*Qué pasa:* hay servicios de Tecma atorados en `pendiente_evidencia`, **con
evidencia guardada**. No están pendientes por falta de datos: el motor, teniendo
los puntos, no logró atribuir unidad.

🟢 **Al 6 de agosto son 106 pendientes en total, y 89 llevan más de 48 h** — no los
71 con que se abrió esta decisión. El corte por causa vive en §5.1: 61
`llegada_sin_atribucion` (todos de Planta 47 · Turno A), 28 por cobertura, 12 por
observación, 5 sin evidencia. **Sigue creciendo**, así que este número caduca.

*Qué hay que decidir, con la Planta y con legal:* cuánto tiempo puede un servicio
quedarse en pendiente, y qué pasa después.

*Recomendación:* **no decidir esto hasta entender por qué no atribuyó.** Si la
causa es del motor, la regla de cierre sería tapar un defecto con una política.
Primero la investigación de atribución (§5, C3), después la regla.

---

**D4 · Re-verificación de las 300 congeladas**

*Qué pasa:* 300 ocurrencias de Planta 47 con deadline corrido. El PR #124 está
abierto a propósito como foto de referencia. La simulación del 30 de julio con el
motor arreglado dio **139/160/1**, contra 91/209/0 con la ventana rota.

*Recomendación:* **no re-verificar todavía.** Esperar a que el árbitro esté
afinado y `route_traversal_measurements` tenga historia real. Cada
re-verificación mete una versión más en la historia del hecho: no es gratis.

---

**D5 · Cómo se le cuenta a Tecma que su número cambia**

*Qué pasa:* cuando se re-verifiquen las 300, el número de cumplimiento de Tecma
va a moverse. Hacia arriba, y por verdad — pero se mueve.

*Recomendación:* **preparar el mensaje antes de que el número cambie, no
después.** El encuadre correcto es que el árbitro estaba siendo injusto **contra
el carrier** y se corrigió; eso fortalece la neutralidad del producto en vez de
debilitarla. Decidir esto antes de D4.

---

**D6 · Qué contratos permiten que la planta modifique la política sin acuerdo del
carrier**

*Qué pasa:* hoy la política se sobrescribe al editarse. La pieza de "acuerdo de
las partes" está anclada a `auth-rbac`, pero **la política de producto es
decisión de Asav**, configurable por contrato.

*Recomendación:* **configurable, con un piso no negociable.** Hay contratos donde
la planta se reserva el derecho de modificar a su criterio, y eso es legítimo. Lo
que **nunca** es opcional es que exista método de comunicación: el carrier se
entera del cambio, siempre, aunque no tenga que aprobarlo. Una tolerancia que
cambia sin que el auditado lo sepa rompe al árbitro ante quien lo mira.

---

**D7 · Dirección visual del producto**

*Qué pasa:* marcada en rojo y **bloquea pantallas**. Necesita tres respuestas de
Asav que este plan no puede suplir.

*Recomendación:* **resolverla en sesión con el chat de diseño**, no aquí. Pero
resolverla pronto: hay trabajo de interfaz esperando y no está esperando a Devin.

---

**D8 · Qué dominio manda** — ✅ **RESUELTA el 3 de agosto**

**El dominio del producto es `j-telemetry.com`.** `j-tel.io` queda descartado y
sale del plan como trámite. Lo que queda es la deuda de sacarlo del landing y del
código, que va en el Tramo 1 junto con la portada.

---

**D9 · El modelo de altas** — ✅ **DECIDIDA. Completada el 4 de agosto. Sin diseñar**

*El criterio, ya fijado:* una cuenta **no se crea sola, se invita.** Una cuenta
puede tener **uno o varios usuarios** monitoreando su servicio, según el cliente.

*Las cinco reglas, completas:*

**1. El alta la hace cada cuenta, no J-Staff.** El **admin corporativo** da de
alta a su gente; el **admin del carrier**, a la suya. J-Staff deja de ser el
cuello de botella de cada usuario nuevo.

**2. Nadie crea a alguien con más alcance del que él tiene.** Un usuario de
planta solo crea usuarios **de su planta** — nunca corporativos, nunca de otra
planta. **Sin esta ley un usuario se asciende solo**, creándose a sí mismo un
segundo usuario con más alcance. Es la regla que sostiene a las otras cuatro.

**3. El permiso de dar de alta es un interruptor por contrato, no automático
por ser admin.** Hay plantas que van a querer que todo pase por J-Tel y otras
que quieren autonomía; las dos son legítimas y la diferencia se configura.

**4. Cuenta nueva: la crea J-Staff, y con ella su primer admin.** Ese primer
admin es la semilla desde la que la cuenta se administra sola. **Solo J-Staff
crea J-Staff.**

**5. El demo del landing es una presentación, no un modo de la app.** No toca
la base, no tiene cuenta, y **nunca comparte superficie con datos reales**. Un
demo que vive dentro de la aplicación termina teniendo una cuenta, y una cuenta
termina teniendo hechos sellados — que es exactamente cómo nacieron los 84 de
la causa C1.

*Dónde vive:* el alta **del lado del cliente** se fue al **Frente del alcance
fino** (al cerrar el Tramo 2), junto con 1.h y el `admin_planta`. Lo de J-Staff
—crear cuentas y su primer admin— se queda en el Tramo 7, junto con el
interruptor de J-Staff y la administración de
usuarios. **No se diseña todavía** — decorar una casa sin puerta es el orden
equivocado. La decisión queda tomada para no volver a discutirla cuando llegue.

*Estado hoy, y es importante:* **el único usuario del sistema es Asav.** No
existe el flujo de altas, no hay personas reales de Tecma ni de Juárez Bus
entrando. El mapeo de identidad (Tramo 1) mapea **una sola identidad**; las otras
tres filas del seed se quedan intactas hasta que haya gente real.

---

**D10 · Falta el rol de admin de planta** — ✅ **DECIDIDA el 4 de agosto. Sin
diseñar**

*Qué falta.* Hoy no existe un administrador **dentro** de una planta. La
administración vive entera en el corporativo: `admin_corporativo` tiene
`client.manage` y `usuario_planta` no —solo `plant.read`, `compliance.read` e
`inspection.manage`—, así que un usuario de planta puede operar e inspeccionar
pero **no puede dar de alta a nadie**.

*Por qué es un hueco y no una preferencia.* Choca de frente con la **regla 2 de
D9**, que es la que sostiene a las otras cuatro: *«nadie crea a alguien con más
alcance del que él tiene · un usuario de planta solo crea usuarios de su
planta»*. Esa regla **presupone un admin dentro de la planta**, y ese rol no
existe. Sin él, la única forma de que una planta administre su gente es darle un
`admin_corporativo` —que ve todas las plantas de la cuenta— y eso es exactamente
lo que la regla 2 prohíbe. **El hueco no se ve hoy porque el único usuario del
sistema es Asav; se ve el día que un cliente tenga diez plantas.**

*Decisión:* **se declara el rol ahora, con la lista de permisos vacía.** Mismo
trato de fondo que `chofer` (`Ficha-Diseno-Permisos.md` §5): existe, nombrado, y
no puede hacer nada todavía. **Los permisos se definen en el Frente del alcance
fino** —al cerrar el Tramo 2—, junto con 1.h y la pantalla de altas, porque las
tres se necesitan entre sí: un admin de planta sin alcance fino no tiene sobre
qué mandar, y sin pantalla de altas es un rol decorativo. Ahí entra también el
interruptor de altas por contrato de la regla 3 de D9.

> **Ojo con el precedente, porque no es exacto y conviene saberlo antes de
> copiarlo:** la ficha dice que `chofer` quedó «sin permisos activos», pero en el
> código tiene `["self.read"]`. Es una diferencia chica y sin efecto —nadie
> entra con ese rol— pero el rol nuevo se declara con lista **vacía de verdad**,
> no con un permiso nominal. Queda anotado, no arreglado.

*Y aquí va una corrección, porque la razón que se dio al pedirlo no se
sostiene y el registro tiene que ser exacto.* Declararlo **no evita una
migración**: `user_memberships.role` es una columna de **texto**, no un enum de
Postgres —el que sí es enum es `scope_type`—, así que un rol nuevo nunca costó
migración. Lo que declararlo sí evita es peor que una migración:

> Mientras el rol no exista, quien necesite que una planta administre a su gente
> va a alcanzarle lo único que hay — `admin_corporativo` — y eso **rompe la
> regla 2 sin que nada lo señale**. Un rol declarado y vacío es una respuesta
> que ya existe cuando llegue la pregunta.

*Y hay un segundo motivo, que es la regla 8 aplicada a los roles.*
`hasPermission` resuelve `ROLE_PERMISSIONS[rol] ?? []`, así que **un rol que
nadie declaró se comporta exactamente igual que un rol declarado sin permisos:
sin ninguno.** Los dos estados son indistinguibles desde el código. Declararlo
es lo que convierte «no lo hemos definido» en algo que se puede leer, en vez de
en un silencio que se ve idéntico a una decisión.

*Nota de higiene que sale de mirar esto:* `ClientRole` está declarado en
`@jtel/domain` con seis roles y **no lo valida nadie** — cero llamadores fuera
de su propia definición. Es la misma forma de `canAccessPlant`. Declarar el rol
ahí no cierra nada por sí solo; que la validación exista es trabajo del Tramo 7.

---

**D11 · J-Staff crece sin rol nuevo** — ✅ **DECIDIDA el 4 de agosto**

Los roles del equipo de J-Tel **ya existen**: `admin_plataforma`, `soporte` y
`comercial`, con sus permisos repartidos en `@jtel/auth-rbac`. Cuando entre gente
al equipo, entra **bajo `admin_plataforma`** con el rol que le toque de esos
tres. **No hace falta inventar ninguno**, y por la regla 4 de D9 **solo J-Staff
crea J-Staff**.

Se anota justamente para que nadie lo abra como pendiente: es el caso donde la
respuesta correcta es que no hay nada que hacer.

---

### 3.3 Trabajo humano que no es código ni decisión

**H1 · Las tres rutas con falla real** — Huertas-B, Centro-A, Parajes del Sur-A,
~43 servicios. Necesitan que **una persona abra el KML en un visor y lo compare a
ojo**. No lo puede hacer el motor ni Devin. Es falla real de trazado, no del
reloj.

---

## 4. El orden de construcción

**Regla:** un tramo se cierra antes de abrir el siguiente. Si algo aparece a
media obra, se anota en `DESPUES.md` y se replantea al cerrar el tramo, no a
media fase.

### Tramo 0 — El incendio · ✅ CERRADO el 3 de agosto

Lote del INSERT · `sin_evidencia_posible` · tope de cola · consulta acotada ·
rastro en el ledger · contador de fallos mudos (2 h) y de pendientes estancados
(48 h) · `/api/salud` mide verificación · **el archivador es la única puerta al
proveedor** · **la llave demo cerrada**.

PRs #203 · #204 · #205 · #206 · #207 · #208. `main` protegida.

---

### Tramo 1 — El candado · ✅ CERRADO el 4 de agosto

**Por qué primero, y ahora con evidencia:** el 3 de agosto se abrió
`j-telemetry.com` y **la portada muestra, sin login**, tres tarjetas que entran
directo a Cara Cliente, Cara Carrier y J-Staff, con enlaces nombrados «Tecma» y
«Juárez Bus», más un bloque «Estado del sistema» que imprime los nombres de los
clientes.

Son **dos defectos distintos** y hay que decirlos por separado:

1. **No hay login.** La portada entra a los datos sin preguntar quién eres.
2. **Filtra nombres de clientes en una página pública.** Contra la ley de que una
   planta jamás ve otra — y el mundo no debería ver a ninguna.

Hoy solo lo tapa la protección de despliegue de Vercel. Eso no es un candado: es
una cortina.

| Pieza | Qué | Orden |
|---|---|---|
| **1.a** | ✅ **Hecha (#209).** **Mapeo de identidad.** Ligar la identidad de Clerk de Asav a `jstaff_admin` (global). **Se agrega, no se reemplaza** — las cadenas del seed son lo que hoy sostiene el acceso; reemplazarlas deja las pantallas en blanco sin error. Tres piezas: `vincular()` en `MembershipRepository` · archivo de mapeo versionado con `user_...`, sin correos · ejecutor en seco por omisión | **Primero.** Destraba la ficha de permisos entera |
| **1.b** | ✅ **Hecha (#214).** `lib/guardia-pagina.ts`, hermana de `guardia-api.ts`, **reutilizando `decidir`, no duplicándola**. Hace `redirect()`, no HTTP. Falla cerrado | |
| **1.c** | ✅ **Hecha (#215 · #220 · #222 · #226).** Aplicarla en las **65 páginas** (`jstaff` 9 · `cliente` 41 · `carrier` 15), empezando por `/jstaff` — es donde vive el razonamiento del árbitro | |
| **1.d** | ✅ **Hecha (#227).** El filtro de unidades por membresía, con las dos advertencias del #138 y una tercera medida al construirlo: **hoy no le cambia la pantalla a nadie**, porque un usuario de planta no pasa de `resolveAccountByType` —que pregunta por cuenta— y nunca llega al filtro. Lo que entra es la estructura para 1.h. Y la mitad que no era obvia: recortar la lista sin recortar las cifras habría sido §D con el eje del lugar | |
| **1.e** | ✅ **Hecha (#230).** Sin señal no hay identidad: `userId` pasa a `string \| null` y el origen `default-heredado` se llama `anonimo`. **En producción no cambia nada hoy** —`JTEL_DEV_USER=jstaff_admin` está puesto—; cierra local, CI y cualquier despliegue al que le falte esa variable | |
| **1.f** | ✅ **Hecha (#216 · #218).** **La portada.** Una ruta con dos caras: **sin sesión → landing público; con sesión → portada**, y la portada **enseña solo lo tuyo** (de las membresías, no de `listByType`). **Sin nombres de clientes.** El bloque «Estado del sistema» **se quita, no se protege** — ya vive en `/jstaff` y en `/api/salud`. Aquí entra también sacar `j-tel.io` del landing y su CSS | |
| **1.g** | ✅ **Hecha (#231).** `CRON_SECRET` fuera de los documentos. Resultó ser más chica de lo escrito: el valor salió del `README.md` y de `DESPUES.md` el 2 de agosto, en el mismo commit que quitó el respaldo de las siete rutas. Lo que quedaba era la redacción — `DESPUES.md` seguía diciendo en tres lugares que **faltaba rotarlo**, y ya estaba rotado. **Del historial NO se quita:** ahí se queda, rotado y sin efecto, como registro y no como llave | |
| **1.i** | ✅ **Hecha (#228).** **`/entrar` como puerta limpia.** Hoy el botón de iniciar sesión vive en `/quien-soy`, que es **pantalla de diagnóstico**: enseña el origen de la identidad, las membresías y si el encabezado fue rechazado. Pedirle a alguien que entre por ahí es hacerle leer el tablero del taller para abrir la puerta | **Después de cerrar `/cliente` y `/carrier`.** Antes no urge: hoy el único que entra sabe qué es `/quien-soy` |
| **1.j** | ✅ **Hecha (#229),** con la validación de `?volver=` revisada por Asav antes del merge. **Volver al destino después de entrar.** Quien llega por un enlace profundo —el correo de una alerta, un expediente compartido— hoy termina en `/quien-soy` y tiene que volver a navegar a mano. La guardia ya sabe a dónde iba: falta llevarlo de vuelta al entrar. **Ojo al diseñarlo:** el destino viaja en la URL, así que hay que validarlo como ruta propia y relativa — un `?volver=` sin comprobar es un redirector abierto | **Con 1.i**, que es su puerta |
| **1.h** | 🔶 **NO entra en este tramo — sale abierta y es lo único que queda.** **La guardia por alcance, no por cuenta.** 1.c cierra a nivel **cuenta**: pregunta «¿es tu cuenta?», que es lo que sabe `canAccessClientAccount`. Falta la pregunta fina — «¿tu alcance cubre **esta planta**?» — y con ella **la regla del campus de `Ficha-Diseno-Permisos.md` §2.2, que no está implementada**: `canAccessPlant` resuelve alcance `plant` y `account`, pero **no tiene rama para `plant_group`**. **Sin diseñar todavía** | **Después de 1.c.** Hoy no protege a nadie —la única identidad real es global— y mezclarlo con 1.c serían dos cambios de comportamiento en un PR |

**Regla de oro mientras dure este tramo:** **no iniciar sesión en Clerk hasta que
1.a esté hecho.** La sesión de Clerk gana sobre el bypass de desarrollo; entrar
antes convierte la identidad en un `user_...` sin membresías, y como el candado
todavía no cierra puertas, las pantallas abren **vacías en vez de dar error**. Se
ve como producto roto. `JTEL_DEV_USER=jstaff_admin` sigue puesto en Vercel.

**El candado no puede preguntar "¿hay identidad?".** Con `JTEL_DEV_USER` puesto,
el bypass le da identidad a **todo el mundo**: un visitante anónimo de producción
*es* `jstaff_admin` con sus membresías. La guardia tiene que exigir **sesión de
Clerk real** — el campo `sesionActiva` de `getIdentidad()` existe para eso. Por
eso 1.a va antes que 1.b, y no al revés.

**Prueba de aceptación (ya escrita en el código):** `/quien-soy` debe decir
`origen: clerk` con las membresías **pobladas**, no vacías.

### Cómo se niega el paso, y qué NO se cierra con eso

Dos negativas distintas, y la diferencia es lo que impide que un extraño
averigüe qué existe:

| Caso | Respuesta | Por qué no filtra |
|---|---|---|
| **Sin sesión** | redirección a `/quien-soy?motivo=sin-sesion` | Se decide **antes de mirar el recurso**, así que es idéntica exista o no |
| **Con sesión, el recurso no es tuyo** | **404**, igual que si no existiera | Decir «no perteneces a esa cuenta» **confirmaría que el id existe** |

**La existencia de un servicio solo es distinguible desde dentro de la cuenta
que lo posee.** Fuera de ella, no existe.

> ⚠ **Límite conocido, y queda escrito para que nadie lo descubra creyendo que
> estaba resuelto: los dos 404 no son indistinguibles en el tiempo.** Un 404 por
> id inexistente hace una consulta; uno por recurso ajeno hace una o dos. Con
> suficientes intentos y un cronómetro, esa diferencia es un canal. **No se
> cierra en este tramo** — hacerlo es trabajo de otra naturaleza (respuesta de
> tiempo constante) y hoy no compite con lo que sí está abierto. Si alguien
> decide que importa, entra como pieza propia, no como parche.

### La compuerta, corrida el 4 de agosto de 2026

No se da por buena de memoria. Se levantó producción en local contra la base
desechable —nunca la de producción— y **se midió el cuerpo de cada respuesta, no
el código de estado**, que es la regla 7.

**1 · Ventana anónima contra `/jstaff/*` → redirección, nunca contenido.** ✅
Las cinco pantallas probadas contestan **307 a `/entrar?motivo=sin-sesion`**, con
cuerpos de 8 099 a 8 696 bytes que traen el armazón de la redirección y nada
más: **cero nombres de cliente y cero contenido propio de J-Staff** —ni cuentas,
ni ledger, ni autopsia, ni resync—.

> **Y una del oficio, porque casi se cuela:** la primera corrida de esta
> comprobación dio **cero en todo** con el servidor **caído**. `curl` devolvía
> `000` y cuerpo vacío, y contar ocurrencias sobre nada da cero — que se lee
> idéntico a una pantalla limpia. Por eso la comprobación cuenta también algo
> que **tiene** que estar: el marcador de la redirección. Un verde que no
> distingue «limpio» de «no hubo respuesta» es la regla 8 aplicada al medidor en
> vez de al código.

**2 · Un usuario con membresía solo de carrier no abre ninguna pantalla de
cliente.** ✅ **en el dato, y hay que decir cómo.** `jb_admin` no obtiene **ni un
nombre de cliente** en ninguna pantalla de `/cliente`, y en una pantalla de
recurso —`/cliente/planta/<id>` con un id real— recibe **404** mientras
`tecma_admin` recibe 200. Ésa es la pared, y la sostiene `exigirRecurso`.

> **El matiz, que es de la familia del `[0]` del #222 y por eso se escribe:** en
> el índice `/cliente` la respuesta es **200 con «No hay cuentas cliente»**, no
> una negativa. Lo que lo vacía es que `resolveAccountByType` no resuelve
> ninguna cuenta para él, no una guardia diciendo que no. **El dato no se fuga
> —medido— pero el mecanismo es ausencia de cuenta, no denegación.** Entra como
> insumo de 1.h.

**3 · La portada pública no nombra a ningún cliente.** ✅ `/` contesta 200 con
**cero ocurrencias** de Tecma, Juárez Bus, Honeywell, Planta 47, Santos Dumont y
PRUEBA REAL.

### Qué queda abierto al cerrar el tramo

**Una sola pieza: 1.h, la guardia por alcance.** Y no es un pendiente
administrativo — es la pregunta fina que este tramo no supo hacer.
**Ya no viaja suelta:** es una de las tres piezas del **Frente del alcance fino**,
que se coloca al cerrar el Tramo 2.

- **`canAccessPlant` no la llama nadie.** Comprobado sobre `main`: cero
  llamadores fuera de sus propias pruebas.
- **Y no tiene rama para `plant_group`**, así que **la regla del campus de
  `Ficha-Diseno-Permisos.md` §2.2 y §2.3 —confirmada por Asav el 31 de julio—
  sigue sin implementarse en la guardia.** Vive implementada en el filtro de
  presentación de 1.d (`alcance-cliente.ts`), que **enseña** el campus a quien
  alcanza una de sus plantas; lo que falta es que la guardia **abra** por esa
  misma regla.
- **Consecuencia hoy, dicha sin adorno:** el candado cierra a nivel **cuenta**.
  Un usuario de planta no ve de más — ve **de menos**: `canAccessClientAccount`
  lo rechaza y `/cliente` le dice «No hay cuentas cliente». Nadie está expuesto
  por esto, y nadie de planta puede trabajar todavía.

**Dos límites conocidos que el tramo deja escritos y no cierra:** el canal de
tiempo entre los dos 404 (arriba), y que `/carrier` está cerrado por disciplina
repetida y no por construcción (§2).

**Lo que este tramo NO era:** el login real. `JTEL_DEV_USER=jstaff_admin` sigue
puesto en Vercel y es lo que sostiene el acceso. El candado exige sesión de
Clerk en producción; lo que falta para que eso sea la puerta de todos es el
Tramo 7.

---

### Tramo 2 — Ordenar el árbitro (no arreglarlo)

> **1.h no entra aquí, y ya no viaja suelta.** Este tramo no toca guardias.
> 1.h pasó a ser una de las tres piezas del **Frente del alcance fino**, que se
> coloca al cerrar este tramo — abajo, después de la compuerta.

**No toca el motor.** Es leer, medir y ordenar. Ver §5, que es esta ficha viviendo
dentro del plan.

**Por qué existe:** las causas se solapan sobre las mismas rutas. Arreglar una sin
saber cuál movió el número reproduce el problema.

**Compuerta:** cada causa de §5 tiene medición, dependencia y ruta compartida
declarada.

**Corrida el 6 de agosto de 2026.** ✅ Las **19** causas tienen las tres cosas:
§5.1 la medición con su fecha · §5.2 la dependencia, una línea por par · §5.3 el
solapamiento, y **por código además de por ruta**. Y §5.4 separa lo medible hoy
sin sellar de lo que exige motor, de lo que no se puede leer desde aquí y de lo
que necesita una persona.

> 🟢 **Todo se remidió contra producción con `jtel_readonly`** —comprobado de solo
> lectura ese día— **sin sellar, sin re-verificar y sin que ningún hecho cambiara
> de versión.** Lo que el tramo tocó fue este documento.

---

### Frente — El alcance fino y quién administra dentro de él

**Sale del Tramo 7 y se coloca al cerrar el Tramo 2.** No es un tramo: es un
frente de tres piezas que **se necesitan entre sí**, y por eso se sacan de donde
estaban repartidas y se ponen juntas.

| Pieza | Qué | De dónde viene |
|---|---|---|
| **1.h — el alcance fino** | La guardia deja de preguntar «¿es tu cuenta?» y pregunta «¿tu alcance cubre **esta planta**?». Arrastra **la regla del campus** de `Ficha-Diseno-Permisos.md` §2.2 y §2.3: `canAccessPlant` resuelve `plant` y `account` y **no tiene rama para `plant_group`** | Lo único que quedó abierto del Tramo 1 |
| **El admin de planta** | `admin_planta` con **permisos de verdad**. Hoy está declarado y parqueado con lista vacía (D10) | D10, y la regla 2 de D9 que lo presupone |
| **El alta completa** | **No es «administración de usuarios»: es dar de alta un cliente.** 🟢 Medido el 6 de agosto — hoy hacen falta **tres pasos manuales en tres sistemas distintos**: la cuenta en la base, el usuario en el panel de Clerk, y ligarlos con un guion. **Nada de eso está en la interfaz.** Su alcance real: **cuenta · contrato · primer admin · identidad en Clerk · membresía con su alcance, en un solo flujo desde J-Staff** | Tramo 7 y `Ficha-Diseno-Permisos.md` §6. **BLOQUEANTE PARA VENDER:** un cliente nuevo hoy **no se puede dar de alta sin tocar código** |

### El alta completa — y por qué deja de ser comodidad

**Se llamaba «administración de usuarios» y se quedaba corto.** 🟢 Medido el 6 de
agosto, dar de alta **un cliente nuevo** cuesta **tres pasos manuales en tres
sistemas distintos**:

| Paso | Dónde | En la interfaz |
|---|---|---|
| La cuenta | La base | ❌ |
| El usuario | **El panel de Clerk** | ❌ |
| Ligarlos | Un guion (`vincular-identidades`) | ❌ |

**Su alcance real, y así queda nombrado:** **cuenta · contrato · primer admin ·
identidad en Clerk · membresía con su alcance — en un solo flujo desde J-Staff.**

> 🟢 **Eso lo mueve de comodidad a BLOQUEANTE PARA VENDER: un cliente nuevo hoy
> no se puede dar de alta sin tocar código.**

**Y el requisito de forma, que sale de haberlo hecho a mano:** el flujo tiene que
crear la identidad en Clerk y la membresía en la base **en un solo paso, sin que
nadie toque el panel** — o la **regla 2 de D9** no la puede garantizar nadie:
«no crear a alguien con más alcance del que tienes» es incomprobable si el
alcance se escribe en otro sistema y después.

**Por qué las tres juntas, y no en tres momentos distintos:**

> **Un admin de planta sin alcance fino no tiene sobre qué mandar** — la guardia
> solo sabe de cuentas, así que administrar «su planta» no tiene referente.
> **Y sin pantalla de altas es un rol decorativo:** existe, tiene permisos, y no
> hay dónde ejercerlos.
>
> Las tres por separado son media pieza cada una. Es la misma forma del problema
> que resolvieron juntas: dar `admin_corporativo` porque es el único admin que
> existe rompe la regla 2 de D9 **sin que nada lo señale**.

### Qué ve exactamente un usuario de planta — medido el 6 de agosto

🟢 Con la identidad del seed `tecma_planta47` (alcance `plant`, rol
`usuario_planta`), que es **la misma membresía** que tendrá la tercera identidad
de prueba:

| Ruta | Qué pasa |
|---|---|
| `/` | **307 → `/cliente?account=tecma`** — la puerta única **sí** lo manda |
| `/cliente?account=tecma` | **«No hay cuentas cliente. Crea una en J-Staff → Cuentas.»** |
| `/cliente` | Lo mismo |
| `/cliente/planta/<su planta>` | **404** |

**No es una pantalla vacía: es una contradicción entre dos partes del producto.**

> 🟢 **La portada cuenta su membresía y ve una puerta, así que lo empuja adentro.
> La guardia pregunta por alcance de CUENTA, no la tiene, y le dice que no hay
> cuentas.** El mismo usuario, en la misma petición, es «tienes exactamente una
> cuenta» para una mitad y «no hay ninguna» para la otra.

🟢 **Y el remate: 404 en su propia planta.** `exigirRecurso` pregunta
`canAccessClientAccount`, que exige alcance `account`. **La planta que sí es suya
le contesta como si no existiera.**

🟡 **Es exactamente el mismo 307 que recibe `tecma_admin`** —medido, los dos van
a `/cliente?account=tecma`— **y a partir de ahí uno ve su operación y el otro un
mensaje de error de configuración.** La diferencia no está en la puerta: está en
la pregunta que hace la guardia al otro lado.

**Eso es 1.h dejando de ser teoría**, y con la forma más incómoda posible: no
falla cerrado ni falla abierto — **se contradice**.

### La prueba viva de por qué hace falta, y por qué esto deja de ser teórico

🟢 **`tecma_planta47` no puede ver su propia cara.** Tiene alcance `plant`,
`canAccessClientAccount` exige `account`, y `/cliente` le contesta **«No hay
cuentas cliente»**. No ve de más: **ve nada**.

> **Ésa es 1.h dejando de ser un argumento y volviéndose una pantalla en
> blanco.** Un usuario de planta con su membresía correcta, entrando bien, sin
> poder trabajar.

**Y cambia el estado del frente.** Con las tres identidades de prueba del T6,
**dos de las tres caras van a funcionar** y la tercera va a fallar **de la forma
exacta que 1.h arregla**. Eso es el escenario que hoy no existe:

| Antes | Con T6 |
|---|---|
| Una sola identidad, alcance global · una guardia por alcance **pasa siempre** contra ella | Tres identidades reales, **dos alcances distintos**, y una que debe ser negada |
| «No se puede medir» | **«Ya casi»** — falta el usuario de campus |

🟡 **Sigue sin estar completo:** para la regla del campus de §2.2 hace falta
además un usuario con alcance `plant_group`, que el seed no tiene. Pero el salto
es real: se pasa de **no poder probar nada** a poder probar **la mitad que hoy
rompe**.

### Lo que hoy hace imposible probarlo, y es la razón de que no se empiece ya

**La única identidad real del sistema tiene alcance `global`.** Contra ella, una
guardia por alcance **pasa siempre** — y una batería de pruebas contra esa
identidad **entraría en verde sin haber probado nada**.

Es exactamente lo que pasó en `/carrier`: las comprobaciones parecían sostener la
pared entre transportistas, y **hasta que no hubo un segundo carrier en la rama
desechable (#225) no se supo si sostenían algo.** Los seis caminos negaron, pero
eso se supo **midiendo con dos**, no razonando con uno.

**Consecuencia para este frente:** antes de escribir la guardia por alcance hace
falta **el escenario** — una cuenta con varias plantas, un campus, y usuarios de
alcance `plant` y `plant_group` de verdad. Sin eso, cualquier verde que salga es
del tipo que la regla 8 nombra: no distingue una guardia que funciona de una que
no está.

**El lugar exacto se decide al cerrar el Tramo 2**, con el dato de los pendientes
de Tecma (D3) en mano — porque ese dato puede mover el orden de lo que sigue, y
ordenar este frente antes de tenerlo sería elegir a ciegas. 🟢 **Ese dato ya está:
106 pendientes al 6 de agosto, 89 de más de 48 h** (§5.1 y §5.5).

**Lo que este frente NO es:** el login real. Eso sigue en el Tramo 7, con retirar
el bypass.

---

### Frente — La puerta sin salida de `destino_only` (C14)

**Se coloca al cerrar el Tramo 2, con los otros dos frentes.** **Sin diseñar.**

**Qué se arregla, dicho por Asav:** *un contrato que dice «basta con llegar» y un
motor que no puede decirlo.*

🟢 **Medido:** con `destino_only`, un servicio cuya unidad **llegó a la geocerca**
pero no pasa A∧B **no puede salir `cumplido` jamás**. `serving` queda vacío, el
motor cae a `pendiente_evidencia` con `llegada_sin_atribucion`, y **ninguna
re-verificación lo mueve** mientras el trazado y los umbrales sean los mismos.
Es una **puerta sin salida**, no una falta de datos.

**Por qué pasa:** la comprobación A∧B vive en `servedRoute` y **lo único que la
apaga es `!hasKml`**. La estrictez se lee después, y solo elige el nombre del
fallo. **Lo que hoy decide «¿basta con llegar?» es si la ruta tiene KML cargado**
— o sea, un dato de configuración, no el contrato.

**Lo que este frente NO puede hacer:** apagar A∧B para todos. El KML no está de
adorno — es lo que permite decir **cuál** unidad sirvió cuando hay varias
candidatas llegando a la misma geocerca. La pregunta de diseño es **cómo atribuir
con destino cuando la ruta no acredita**, no cómo saltarse la ruta.

**Dato que acota el diseño:** 🟢 el trazado contratado **sí corresponde** a lo
que se maneja —100 % de los waypoints con traza real a menos de 500 m, mediana
20 m—, así que **el problema no es el KML**. Ver
`Ficha-Diagnostico-Pendientes-Sin-Atribucion.md` §4-duodecies.

---

### Frente — La app del coordinador de planta

**Se coloca al cerrar el Tramo 2.** **Sin diseñar.**

**Qué es:** que el coordinador de planta pueda declarar, desde el teléfono y
**antes del turno**, qué unidad va a servir qué ruta.

**La ley que la gobierna, y no se negocia:**

> **Opcional siempre.** Es la señal de rol declarado ya escrita: **si el sistema
> depende de que alguien declare, dejó de ser autónomo.** Es una comodidad para
> quien la quiera, **nunca un requisito**, y un servicio sin declaración se
> verifica exactamente igual que hoy.

**Por qué ahora tiene sentido y antes no:** con la atribución fallando en 61
servicios, una declaración previa sería **una señal más para desempatar
candidatas** — no la verdad, una pista. El árbitro sigue midiendo; la declaración
solo le dice por dónde empezar a mirar.

**Lo que hay que cuidar al diseñarla:** una declaración que el motor **crea** en
vez de **comprobar** convierte al coordinador en el que decide el veredicto. Eso
rompe la misma ley que protege al carrier. **La declaración se contrasta contra
la telemetría, siempre.**

---

### Frente — Los sensores: ver el instrumento, no solo el veredicto

**Se coloca al cerrar el Tramo 2, con los otros frentes.** **Sin diseñar.**

**Por qué existe, y la fecha lo dice:** el 29 de julio la densidad de muestreo de
Planta 47 se multiplicó por ~1.5 y **la cobertura del trazado saltó de 5–7 a 9.9
de 10 sin que nadie manejara distinto** (C19). 🟢 **No fue un cambio nuestro** —
ningún commit toca el archivador ni la cadencia en esa ventana— y **nadie se
enteró**. Lo supimos investigando otra cosa, once días después.

> **Un árbitro que no puede ver su propio instrumento no sabe cuándo dejó de
> medir bien.**

#### Pieza 1 — Tablero de sensores en J-Staff, por cuenta y por unidad

| Sensor | Qué enseña | El caso que lo pide |
|---|---|---|
| **Cadencia** | Puntos por unidad por hora, **y su cambio contra la semana anterior** | 🟢 **Es el que habría avisado del 29 de julio** |
| **Aparatos vivos** | Cuántos de los declarados reportan hoy, contra los declarados | 🟢 Hoy se sabe que fueron 50–53 de punta a punta **solo porque se midió a mano** |
| **Retraso del archivador** | Cuánto tarda la evidencia en llegar | 🟢 **Ya costó 28 servicios** juzgados con el expediente a medias — sellados viendo 13–46 puntos cuando hoy hay 370–1 992 (C3) |
| **Salud del trazado** | Qué rutas tienen KML y **de cuándo es cada versión** | 🟢 **Tener KML o no decide más que el contrato**: `!hasKml` es lo único que apaga A∧B, y `routeStrictness` se lee después (C14) |
| **Divergencias de política** | Qué campos difieren entre contratos y **cuáles corren con valor de fábrica** | 🟢 **6 ago: dieciséis de 24 campos difieren** entre los dos contratos de Tecma, y **siete existen solo en Planta 47** — el Campus corre esos siete con el valor de fábrica sin que nadie lo decidiera (C16) |
| **Observación contra conducta** | Un contador que separe **«no cumplió»** de **«no pudimos ver»** | 🟢 **6 ago: 341** hechos `no_cumplido` con una unidad que **sí llegó** (C13) y **106** pendientes que no son falta de datos. **Las dos cifras se mueven solas** — eran 335 y 100 hace dos días —, que es justo por qué el contador tiene que existir |

#### Pieza 2 — Que el hecho sellado cargue su densidad de evidencia

**Cuántos puntos, qué cadencia, qué huecos**, congelados dentro del hecho.

🟢 **Hoy hay servicios de julio y de agosto que parecen comparables y no lo son**,
y **sin ese dato adentro nadie lo puede saber después**. Es el Tramo 4 con nombre
propio: *el hecho debe bastarse a sí mismo*. Ya está anotado en su tabla.

#### La ley del tablero, escrita antes de dibujarlo

> **Es instrumento, no juicio.**
>
> **Lenguaje de radar: azules y grises.** **Nunca los colores del veredicto** — y
> **verde sigue significando cumplido y nada más**, que es la ley 1 del Marco y
> la primera del skill de interfaz. Un sensor en rojo enseñaría a leer un
> problema de medición como un incumplimiento, que es exactamente la confusión
> que este frente existe para deshacer.
>
> **Ver la cadencia para entender está bien; ajustar umbrales hasta que la
> operación pase, no.** Es la misma frontera del letrero de «Tu operación
> medida» (#243), y la pantalla **no puede distinguir las dos intenciones** — así
> que se enuncia.

**Y una consecuencia de leerlos juntos:** si la cadencia cae y la cobertura cae
con ella, **el tablero tiene que poder decir que el problema es de observación y
no de conducta**. Esa distinción es la ley 7 del Marco —«sin evidencia no hay
incumplimiento»— convertida en algo que se ve.

---

### Frente — El diseño no alcanza a la construcción

**Se coloca al cerrar el Tramo 2.** **Sin construir hoy.**

**El dato, medido el 7 de agosto:** entre el 1 y el 7 de agosto el universo de
pantallas de cliente y carrier pasó de **48 a 56 rutas** — ocho nuevas en seis
días — y en el mismo periodo aparecieron **cuatro fichas de diseño**. 🟢 **Se
construyen pantallas al doble de velocidad de la que se diseñan.**

**Por qué es frente y no una nota.** El saldo no es estático, es una **tasa**: cada
semana que pasa, la deuda de diseño crece aunque nadie deje de trabajar. Hoy son
**33 rutas sin ficha de 69**, con **J-Staff entero —nueve— sin una sola**. Un
frente que se mide en pantallas pendientes se cierra construyendo; uno que se mide
en **velocidad relativa** no se cierra hasta que se invierte el orden.

> **Y es la explicación más simple de la retroalimentación de fuera** —*«la
> información se siente dispersa y no es obvia de navegar»*—: **una pantalla sin
> ficha no es una pantalla fea, es una pantalla sin decisión de navegación
> tomada.** Trece de cliente y siete de carrier están en ese estado, y ahí es donde
> alguien se pierde.

**Lo que este frente NO es:** revestir. Es **decidir qué va en cada pantalla y cómo
se llega a ella** — que es lo que la ficha fija y lo que hoy falta. El Tramo 5
supone que ese trabajo está hecho.

> 🟢 **Y el hallazgo que más pesa del conteo: J-Staff son nueve rutas y ninguna
> tiene ficha.** **Es la cara desde la que Asav opera el producto, la que usa todos
> los días, y es la única sin una sola decisión de diseño tomada.** Las otras dos
> caras tienen 36 rutas con ficha entre ambas; ésta, cero.

### La lección del mapeo: una declaración que nadie comprueba se degrada en las dos direcciones

🟢 Al hacer el conteo mecánico salieron **dos trampas, y son la misma familia**:

| Trampa | Qué pasó |
|---|---|
| **Ruta parcial** | `Ficha-Oficina-Contrato` declaraba `cliente/*/configuracion`. El comodín **no cubre el alcance corporativo**, que no tiene segmento intermedio: **cinco rutas aparecían sin ficha teniéndola** |
| **Ruta inexistente** | `Ficha-Choferes` declara `carrier/choferes`, y **esa ruta no existe** en `apps/web/src/app`. Una ficha sin pantalla |

> **Una declaración que nadie comprueba contra la realidad se degrada en las dos
> direcciones:** de menos —cubre más de lo que dice— y de más —dice cubrir algo que
> no está—. **Las dos producen un conteo falso y ninguna se ve mal al leerla.**
>
> Por eso el mapeo mecánico vale más que las trece líneas que lo hacen posible: no
> es que ahorre leer, es que **cruza lo declarado contra lo que existe**, y ése es
> el único paso que ninguna ficha puede hacer sobre sí misma. Es la regla 8
> —una defensa que nadie distingue de su ausencia— aplicada a la documentación.

⚠ **Y lo que hay que decir del Tramo 5, porque el plan lo daba por resuelto:**
mientras este plan afirmaba que «el frente visual está cerrado», **33 rutas no
tenían decisión de diseño**. El Tramo 5 está dimensionado como trabajo de piel
sobre pantallas diseñadas. **No lo es para la mitad del producto.**

---

### Frente — Que las pruebas de integración corran en CI

**Se coloca al cerrar el Tramo 2.** **Sin construir hoy.**

**Qué pasa.** 🟢 **41 pruebas existen y ningún check las ejecuta.** Tres archivos,
dos paquetes, y todas escriben contra la rama desechable de Neon:

| Suite | Pruebas | Tiempo |
|---|---|---|
| `packages/db` | 25 | **51 s** |
| `apps/web` (alcance y guardia de carrier) | 16 | **12 s** |

**Por qué es frente y no un arreglo suelto.** El secreto es media hora; lo caro es
lo que sigue después. En orden:

1. **Un secreto, y nada de infraestructura.** `DATABASE_URL_TEST` como secret de
   Actions. **No hay que levantar nada** — Neon es hospedado. Los dos
   `vitest.integration.config.ts` cargan `.env` con `try/catch`, así que en CI las
   variables entran por entorno. Y conviene que `DATABASE_URL` **no exista** ahí:
   el candado que se niega a correr contra producción queda satisfecho por
   ausencia.
2. **Concurrencia entre PRs — el costo real.** Las suites escriben **en la misma
   rama desechable**. `fileParallelism: false` ya las serializa *dentro* de una
   corrida, pero **dos PRs a la vez se pisan**. O un `concurrency` que las encole
   —y cada PR espera al anterior— o una rama de Neon por corrida vía su API, que
   es bastante más obra. **Es trabajo recurrente, no de una vez.**
3. **Estado sembrado, que es lo que no se ve de fuera.** No son autosuficientes:
   el escenario de dos carriers lo crea un guion aparte. CI tendría que sembrarlo
   **y mantener esa siembra al día** cuando el esquema o los datos cambien.
4. **La desechable tiene que estar migrada.** Si el esquema avanza y esa rama no,
   las pruebas revientan por columnas que faltan — el incidente exacto que motivó
   `esquema.yml`.
5. **Y el rename del check**, que va de la mano: hoy se llama `pruebas` y corre
   solo las unitarias. Pasa a **`pruebas unitarias`**. ⚠ **No es libre:** el
   ruleset «main protegida» exige por nombre `pruebas`, `esquema` y `Vercel
   Preview Comments` con rama al día, así que renombrar sin tocar el ruleset deja
   `main` **immergeable**. El orden que no deja hueco: **agregar el nombre nuevo
   al ruleset, luego renombrar el job, luego quitar el viejo.**

> ⚠ **Bloqueo previo, y no se negocia: no se enciende con pruebas rojas dentro.**
> Un check que nace en rojo **enseña a ignorar el canal desde el día uno** — la
> misma lección del vigilante (regla 16). Al 6 de agosto las 41 están en verde,
> pero eso se comprobó a mano y **hay que volver a comprobarlo el día que se
> encienda**.

**Y el caso que lo hace urgente, que es §D del Marco aplicado al control
automático:** 🟢 el verde de GitHub afirma **«las pruebas pasan»** y lo que midió
es **«las unitarias pasan»**. La consulta es correcta —esas sí pasan— y la
afirmación es falsa, porque el nombre habla de un universo mayor que el medido.
**Correcto como consulta, falso como afirmación**, con el agravante de que aquí el
lector es quien decide mergear. Lo falso lo puso el **alcance**, igual que en el
caso 3 de §D — y el nombre del check es el rótulo que lo dice.

---

### Frente — Independencia del proveedor de GPS

**Se coloca al cerrar el Tramo 2, con los otros frentes.** **Sin diseñar, y no se
diseña hoy.**

**Qué pasa.** 🟢 **El código conoce el nombre de un proveedor concreto.** Está en
todas las capas a la vez: un paquete **`gps-umbrella`** · las columnas
**`umbrella_user_id`** y **`umbrella_password_encrypted`** · las variables
**`UMBRELLA_GPS_URL` · `UMBRELLA_GPS_USERID` · `UMBRELLA_GPS_PASSWORD`** · y el
nombre **impreso en una pantalla de la cara del carrier**.

**Por qué es del plan y no de higiene.** Rompe la regla de producto de §2 —*«¿esto
tendría sentido para una planta en Bogotá cuyas rutas nunca hemos visto?»*—
aplicada al otro lado: **un carrier con otro proveedor no cabe en este código sin
obra.** Y está exactamente donde se va a construir, porque sustituir a los
proveedores de GPS actuales es parte del piso propio de la suite del carrier
(§2, «las dos caras no son simétricas»).

**El orden, que es lo único que este frente fija hoy:**

> **Abstraer primero, conectar después.**
>
> Si el puente al segundo proveedor se construye sobre esta base, **quedan dos
> casos especiales cosidos** —uno por proveedor, repartidos por paquete, esquema,
> variables y pantalla— **y el tercero vuelve a ser obra.** El costo de abstraer
> no baja por esperar: sube, porque cada proveedor nuevo multiplica los sitios
> donde el nombre está escrito.

**Lo que este frente NO es:** conectar un proveedor nuevo. Es que el sistema deje
de saber cómo se llama el que tiene.

---

### Frente — La reconciliación del expediente

**Sale del Tramo 7 y se coloca al cerrar el Tramo 2, junto al frente del alcance
fino.** No es un tramo y **no se diseña hoy**.

**Por qué existe.** Hoy un `no_cumplido` dice que no se cumplió **y nada más**.
Eso no tiene valor ni para la planta ni para el carrier: la planta no puede
explicar qué pasó y el carrier no tiene dónde poner su versión. Un veredicto que
no se puede reconciliar no es un árbitro — es un marcador.

| Pieza | Qué | Estado |
|---|---|---|
| **Mostrar qué sí hizo** | El **trazo real junto al contratado**, siempre, en **todo** `no_cumplido`. No es discusión: es evidencia, y **los puntos ya están guardados** | Sin diseñar |
| **La planta aprueba una variante hacia adelante** | Ya decidido y ya anotado. La política cambia hacia adelante y nunca reescribe el pasado | Decidido, sin diseñar |
| **El carrier aporta al expediente** | Su versión de qué pasó, **apoyada en los motivos excusables que la política ya define** | Sin diseñar |

**La ley, intacta, y es la que gobierna la tercera pieza:**

> **El carrier no cambia el veredicto.** Agrega contexto; **la planta decide si
> mueve algo**. Es la Ley 5 del Marco —«el auditado no edita el veredicto»— y no
> se negocia: **si el carrier pudiera cambiar su propio resultado, J-Tel deja de
> ser árbitro.**

**El vocabulario ya existe, y eso acorta el trabajo.** 🟢 `excusableReasons` es
**configurable por contrato** y ya vive en la política. **Lo que falta no es el
vocabulario: es quién los invoca y quién los aprueba.**

**Por qué las tres van juntas:** enseñar el trazo real sin dónde responder deja a
la planta con una pregunta y a nadie a quien hacérsela; dejar que el carrier
aporte sin enseñar el trazo convierte el expediente en dos relatos sin evidencia
en medio; y aprobar variantes sin ninguna de las dos es decidir a ciegas.

**Lo que este frente NO es:** re-verificar el pasado. La política cambia hacia
adelante.

---

### Tramo 3 — Arreglar el árbitro

En el orden que el Tramo 2 determine, **no en el orden en que están listadas**.

- **Nada se sella hasta que se pueda medir el efecto por separado.**
- Una causa por PR. No se mezclan dos cambios de comportamiento del motor.
- Cada arreglo trae su medición de antes y después.

#### C21 — cómo se cierra, decidido el 7 de agosto de 2026

**Entran la 2 y la 4. No se construyen hoy.**

| # | Opción | Veredicto |
|---|---|---|
| 1 | Regenerar al detectar el cambio de turno | ❌ **Los disparadores se saltan.** Un `UPDATE` desde la consola de Neon no pasa por código nuestro. **Es la forma exacta de C13** — `contract_policy_history` existe, tiene la forma correcta y está vacía porque escribir en ella depende de que alguien se acuerde |
| **2** | **Un cron que revisa y AVISA** | ✅ **Entra.** La consulta ya está escrita —es la que produjo el 465— y corre en menos de un segundo. **Avisa; no corrige.** Un cron que corrige en silencio **no se distingue de uno que no corre** (regla 8), y sobre todo: **corregir la ventana con la que se juzga es decisión de Asav, no de un programa** |
| 3 | Derivar la hora límite al leer, no congelarla al crear | ❌ **Choca con la ley del Marco** —*los hechos se calculan una vez y se congelan; la política cambia hacia adelante*—. Una ocurrencia generada hoy se juzgaría mañana con otra regla sin que nadie lo decidiera. **Mueve el defecto de sitio en vez de quitarlo** |
| **4** | **Darle historia a los turnos** | ✅ **Entra.** 🟢 `shifts` **no tiene `updated_at`**: por eso no se pudo fechar el cambio, solo acotarlo entre dos corridas del cron. No arregla nada por sí solo — **hace legible la divergencia en vez de inferible**, y es lo mismo que C13 pide para la política. **Es la única que sirve aunque no se haga ninguna otra** |

> **Y la razón de que el orden importe, que la salió del episodio del 7 de agosto:**
> el precio de C21 lo pagó **la latencia, no el defecto**. Doce ocurrencias se
> sellaron mal entre descubrirlo y arreglarlo. **Cualquier cosa que acorte el tiempo
> entre «cambió el turno» y «alguien se entera» ataca lo que costó esas doce.**

#### La regla del nudo — nunca dos términos de `servedRoute` en el mismo PR

**Sale del Tramo 2, y es la única regla de este tramo que nombra líneas de
código.** 🟢 Medido el 6 de agosto: **siete causas se cruzan en una sola expresión
booleana**, `servedRoute` en `packages/verification/src/index.ts:575-580`. Sus
cinco términos son:

| Término | Causas que lo mueven |
|---|---|
| `arrivalAt !== null` | **C4** (contra qué polígono) · **C8** |
| `!hasKml` | **C14** · **C6** |
| `observableEnough` | **C16** (`kmlOriginToleranceFraction`) |
| `routeMatchPct >= minKmlPct` | **C17** (decide la ponderada) · **C19** · **C16** |
| `corridorPrecisionPct >= minCorridorPct` | **C16** (Campus al 50 %) · **C19** |

> **Los cinco producen el mismo número: cuántas candidatas acreditan.** No son
> cinco mediciones que se puedan comparar entre sí — son cinco entradas de un
> mismo resultado. **Tocar dos en el mismo PR hace inatribuible el efecto de las
> dos**, y ninguna medición de antes y después lo recupera después: el número se
> movió y no hay forma de repartir cuánto puso cada una.
>
> **Por eso «una causa por PR» aquí es más estricto de lo que suena.** No basta
> con que el PR nombre una sola causa: **tiene que tocar un solo término.** C16 y
> C19 pueden aparecer las dos en un mismo término, y ésos son los casos donde hay
> que parar y partir el trabajo, no acelerarlo.

**Y el corolario que da holgura, porque no todo está en el nudo:** 🟢 `shapeOk`
**no entra en `servedRoute`** — solo ordena candidatas. Ésa es la razón exacta de
que **C12 no cause C11**, y de que arreglar C12 sea seguro de medir por separado
aunque toque el mismo archivo. **Compartir archivo no es compartir el nudo; lo que
importa es si el término entra en la expresión.**

**Aquí vive la identificación por capas** — seis señales que acumulan confianza y
ninguna condena sola: llegada a geocerca (la más robusta, ya existe) · corredor ·
match fino (solo con densidad suficiente) · huella histórica · patrón de paradas ·
rol declarado (**opcional siempre**; si el sistema depende de que alguien declare,
dejó de ser autónomo).

---

### Tramo 4 — Que el hecho se baste a sí mismo

**Bloqueante para la definición de v1.** Un hecho sellado tiene que contener —o
referenciar de forma inmutable— todo lo que hizo falta para producirlo. Hoy sale a
buscar cosas del catálogo que pudieron cambiar debajo de él.

| Qué le falta cargar | Estado medido |
|---|---|
| Política del contrato | ✅ se congela byte a byte |
| Unidad de cada punto de evidencia | ✅ anclada |
| Asignación equipo ↔ unidad | ✅ temporal, resuelta por fecha |
| Versión de trazado | 🟡 referenciada en 92.5% **pero el motor no la lee** — re-resuelve por fecha |
| Conjunto de variantes evaluadas | ❌ no se congela |
| Forma de la geocerca | ❌ no se versiona, y el campo guardado no es el que el motor usó (546 divergen) |
| Versión del motor | ❌ |
| **Densidad de la evidencia** | ❌ **— pieza 2 del Frente de los sensores.** Cuántos puntos, qué cadencia, qué huecos. 🟢 Sin esto, un servicio de julio y uno de agosto **parecen comparables y no lo son**: los mismos aparatos, las mismas rutas y ~1.5× más puntos por aparato movieron la cobertura de 5–7 a 9.9 de 10 (C19) |

**Por qué es bloqueante y no deuda:** sin esto, explicar un no cumplido de julio
leyendo el motor de agosto **miente sin querer**. Y explicar es la mitad de la
definición de v1.

---

### Tramo 5 — Ver y explicar

**Aquí se cumple la segunda mitad de la definición de v1.**

| Pieza | Qué |
|---|---|
| **Expediente del no cumplido** | **El corazón.** Mapa con los dos trazos encimados —contratado punteado, real sólido—, divergencias resaltadas, enunciados medidos al lado, y para la planta el botón "aprobar esta variante hacia adelante" |
| Diff estructural | Dónde dejó el trazado, cuántos km por fuera, dónde lo retomó, qué tramo omitió. **Números auditables** |
| Cumplimiento (dos caras) | Las cifras de juicio, que hasta aquí no se muestran |
| `mapa-instrumento` · `vista-de-ruta` · `preventivo-jtel` | |
| Tablero de calibración | |
| Módulo de choferes | |

---

### Tramo 6 — Re-verificar y sostener

- Simulación nueva con el motor afinado, contra 139/160/1 y 91/209/0.
- **Con el número en mano**, decidir si se re-verifica formalmente (D4), con firma
  y motivo canónico.
- Sostener el ≥90% **de capacidad de mostrar** dos semanas · cero rojos sin
  expediente · ningún hecho sellado sobre cuenta no declarada · ningún hecho cuya
  frontera de evidencia viva fuera de él.

---

### Tramo 7 — Vendible

| Pieza | Qué |
|---|---|
| `auth-rbac` cerrado | **Retirar el bypass** y el login real. La guardia por alcance, los permisos del `admin_planta` y la administración de usuarios **ya no viven aquí**: se fueron juntas al **Frente del alcance fino**, que se coloca al cerrar el Tramo 2 |
| **Lenore-vigía** | Alertas preventivas durante la operación: *"6 unidades no reportan y el turno cierra en 20 minutos"*. **No está bloqueada por nada técnico** — necesita T2 (que las alertas salgan) y saber a quién avisar |
| **Lenore-narradora** | El diff estructural contado en cristiano dentro del expediente. **Bloqueada por el Tramo 4** |
| Interruptor de J-Staff | Activar / desactivar / eliminar cuentas y contratos. Hoy la única vía es tocar la base a mano, y eso no es producto. **Desactivar es hacia adelante y no toca el pasado; eliminar abre la pregunta de qué pasa con los hechos ya sellados.** Y J-Staff **enuncia, no esconde**: los excluidos por cuenta de ejemplo se muestran con su motivo |
| **J-Staff altas y demos** | Con el modelo ya decidido en **D9**: invitación de J-Tel o solicitud del cliente aprobada desde J-Staff · uno o varios usuarios por cuenta |
| **La suite del carrier** | **No es una cara pendiente de pulir: es un producto con piso propio** (§2, «las dos caras no son simétricas»). Lo que entra a v1 son **los cimientos** — que el carrier vea todo lo suyo, con el alcance resuelto contra **su universo** y no contra el contrato por el que llegó. Su alcance completo —sus propias unidades y actividades, sustituir a los proveedores de GPS, la verificación como valor agregado frente a la planta— **vive más allá de v1**, en `DESPUES.md` |
| Pase de interfaz final | |

**Compuerta de v1:** un cliente nuevo se da de alta, entra con su usuario, ve solo
lo suyo, y el ≥90% de capacidad de mostrar se sostiene.

---

## 5. Las causas del árbitro

**Esta es la ficha de consolidación.** Vive aquí, no en un documento aparte.

**Son veintiuna, no once.** El plan viejo decía seis en una línea y listaba ocho en
su propia tabla; el 3 de agosto se sumaron tres, entre el 4 y el 5 de agosto
**C12 a C19** salieron de investigar C11, y el 6 de agosto **C20 y C21** salieron de
medir D2. Quien compare contra esta lista **dice contra cuántas y cuáles**, nunca
«es la séptima».

**Qué hace esta sección, y qué no.** Ordena por **dependencia**, dice qué comparte
ruta y qué comparte código, y separa lo que se puede medir sin sellar de lo que no.
**No propone por dónde empezar.** Ese orden lo decide Asav con esto enfrente.

> **Corte de medición: 6 de agosto de 2026**, contra producción con `jtel_readonly`
> —comprobado de solo lectura ese día: 41 tablas, lee todas, no escribe ninguna—.
> **No se selló nada, no se re-verificó nada, ningún hecho cambió de versión.**
> Todos los conteos excluyen `is_demo`: solo **Tecma**.

**Marcas:** 🟢 verificado · 🔵 reportado por otro documento · 🟡 inferencia.

---

### 5.1 La lista, con el estado real

| # | Causa | Qué se sabe, con la fecha de cada cifra | Estado |
|---|---|---|---|
| **C19** | **La cobertura depende de la DENSIDAD del muestreo, no de la conducta** | 🟢 **6 ago:** el salto **se sostuvo**. Puntos de evidencia por día de servicio de Planta 47: **61–68 k** del 9 al 24 de julio → **93 k · 97 k · 99 k · 108 k · 110 k** del 29 de julio al 5 de agosto. El Campus, plano (**113–142 k**) todo el periodo. Mismos aparatos —51–54 por día, estable de punta a punta—, mismas unidades, mismas rutas, mismo trazado. 🔵 **5 ago:** la cobertura del trazado saltó de **5–7 a 9.9 de 10**. 🟢 **No fue un cambio nuestro:** ningún commit toca archivador, ingestor, `gps-umbrella` ni la cadencia de los crons entre el 24 de julio y el 3 de agosto. **La calificación de un transportista puede subir o bajar sin que él haga nada distinto** | **Sin construir.** Rompe la promesa del producto: el veredicto tiene que depender de la conducta, no del aparato |
| **C11** | **Servicios con evidencia y sin atribución** | **Investigación CERRADA** — `Reporte-Final-Investigacion-71.md`; el detalle, en `Ficha-Diagnostico-Pendientes-Sin-Atribucion.md`. La causa raíz es **C19**. 🟢 **6 ago, por causa × sitio × turno:** **106** pendientes (eran 100 el 4 ago y 104 el 5) — `llegada_sin_atribucion` **61**, *todos* de **Planta 47 · Turno A**; cobertura insuficiente **28**; observación insuficiente **12**; sin evidencia **5**. Lo que la produce: **ninguna candidata cumple A (cobertura ≥ 60 %) y B (corredor ≥ 60 %) a la vez** | **Medida.** Falta decidir el arreglo |
| **C14** | **`routeStrictness` no gobierna lo que su nombre promete** | Se lee en **un solo punto** (`packages/verification/src/index.ts:1018`) y solo elige entre `pendiente_evidencia` y `no_cumplido` **después** de que la atribución falló. La comprobación A∧B vive en `servedRoute` (`index.ts:575`) y **lo único que la apaga es `!hasKml`**. 🟢 **6 ago, y esto cierra el argumento: los 48 ruta-turnos de los dos contratos reales tienen KML activo con waypoints.** O sea `!hasKml` **no se dispara nunca hoy**, así que A∧B corre siempre y `destino_only` está **inerte para todos los servicios reales**. Con `destino_only`, una unidad que llegó **no puede salir `cumplido` jamás** | **Sin construir.** Es la causa de que los 61 no se puedan cerrar solos. **Tiene frente propio** — «La puerta sin salida» |
| **C13** | **El veredicto del mismo fallo lo decide `routeStrictness`, y el cambio no deja rastro** | Con `destino_only` + llegada → `pendiente_evidencia`; con `kml_full` → `no_cumplido`. 🟢 **6 ago: 341** `no_cumplido` con una unidad que **sí llegó** — **208 del Campus** (`kml_full`, 9 jul → 5 ago, **sigue creciendo**) y **133 de Planta 47** (`kml_full`, 14 → 30 jul, **congelado**: salió de esa estrictez el 31). Eran 330 el 4 de agosto y 335 el 5: **lo que crece es el Campus, y solo el Campus.** 🟢 **El mismo día visto por el otro lado:** los 61 `llegada_sin_atribucion` de Planta 47 caen el 9, 10, 31 de julio y el 3, 4 y 5 de agosto — **cero entre el 13 y el 30**, que es exactamente su ventana de `kml_full`. El mismo fallo, dos nombres. 🟢 **El caso de esta causa, con fecha, y es nuestro:** `contract_policy_history` **existe y sigue en cero filas al 6 de agosto**, y el contrato del Campus **se editó ese mismo día a las 09:14 sin dejar una sola fila**. Lo editamos **nosotros**, con el guion de `kmlOriginToleranceFraction`, **sabiendo que C13 existe y que esa tabla es su arreglo.** **Ni siquiera quien conoce el problema deja historia**, porque dejarla no es obligatorio: es la regla 14 —una regla escrita no es una regla aplicada— aplicada a la auditoría. Mientras escribir la fila dependa de que alguien se acuerde, la tabla seguirá vacía. ⚠ **7 ago — la lectura de arriba estaba incompleta, y la corrección es el hallazgo:** escribir la fila **NO dependía de que alguien se acordara**. `updatePolicy` la escribe dentro de la misma transacción que el `UPDATE` desde el **31 de julio** (`990be4f`), con el comentario explícito de que el registro va ahí y no en quien llama justamente para que un camino de edición nuevo no lo pueda olvidar. 🟢 **El camino de la aplicación llevaba cerrado más de una semana y la tabla seguía en cero.** Lo que falla es otra cosa: la edición del Campus del 6 de agosto la hizo un **guion con `UPDATE` crudo**, que no pasa por ahí, y la consola de Neon tampoco pasaría. **Cerrar el camino bueno no cierra la puerta de atrás**, y el hueco no se ve hasta que alguien va a leer la historia y no hay nada. Es la regla 8 —una defensa que ninguna prueba distingue de su ausencia— aplicada al registro: la defensa existía, funcionaba, y **ninguna escritura real la atravesaba** | **En construcción — el arreglo cambió de forma con la corrección de arriba.** No es «hacer que la aplicación registre», que ya estaba: es **un trigger de Postgres** (migración `0020`), que alcanza a la aplicación, a los guiones y a la consola. ✅ **Decidido por Asav el 7 de agosto**, con su costo aceptado por escrito: una escritura cruda no puede firmar quién fue y queda como `sql_directo` — menos malo que cero filas. 🔵 Nadie los ha visto: ningún cliente ni carrier ha recibido un resultado, así que **no hay acusación emitida**. Eso baja la urgencia y no cierra la pregunta |
| **C18** | **El empalme: una unidad sirve dos rutas y el sistema no puede saberlo** | 🔵 **29 jul:** tres unidades cubren dos trazados cada una, una al **79 % y 76 %**. 🟢 **6 ago — medido sobre toda la ventana, que es lo que faltaba:** contando cuántas unidades **acreditan** (`sirvio_ruta`) más de un ruta-turno el mismo día, el empalme aparece en **18 de 28 días del Campus**, con hasta **3 rutas** por unidad. **Es rutinario, no ocasional.** ⚠ **Y el eje manda:** en Planta 47 sale **0 de 7 días**, pero eso **no dice que ahí no pase** — dice que ahí casi nada acredita (es C11), así que el empalme no es observable por esta vía. **La consecuencia, que no es de umbral sino de planteamiento:** preguntar «¿cubriste la ruta A?» a un camión que sirvió A y B **está mal hecha la pregunta**, y ningún umbral la arregla. ⚠ **Y una perilla que se va a confundir con el arreglo, dicho antes de que llegue el momento:** `permitirConsolidacion` **ya existe** en la política y los dos contratos la tienen en `false`. 🟢 Lo único que hace es **apagar el pase de exclusividad** (`packages/services/src/verification.ts:334`), que es el que hoy *quita* una unidad de todas las rutas menos la de mejor match. **Ponerla en `true` no arregla C18: solo deja de castigar el empalme.** El árbitro seguiría evaluando cada servicio contra una sola ruta — que es exactamente la pregunta mal hecha | **Sin construir.** Hipótesis de Asav, medida y confirmada |
| **C16** | **La configuración del contrato no coincide con lo acordado, y no hay contra qué comparar** | 🟢 **6 ago: difieren dieciséis de 24 campos** entre los dos contratos — **no seis**, como decía este plan. Los que deciden un veredicto: `routeStrictness` · `kmlCorridorMinPct` (**60 vs 50**) · `kmlCorridorMeters` (120 vs 150) · `evidenceMarginMinutesAfter` · `verificationGraceMinutes` · `excusableReasons` (Planta 47 admite `falla_mecanica`, el Campus no) · `enforcementRules` (el Campus está **vacío**). 🟢 **Y siete existen solo en Planta 47**, así que el Campus corre con el valor de fábrica sin que nadie lo decidiera: `maxWindowBeforeMinutes` · `routeAvgSpeedKmh` · `routeDurationMinSamples` · `routeDurationPercentile` · `windowDerivationEnabled` · `windowSlackPct` · y **`timeZone`**, que es el campo del que salió D1. 🔵 Asav recordaba el corredor del Campus **acordado en 60 %**. 🟢 **Ya no difiere `kmlOriginToleranceFraction`**: se escribió en el Campus el 6 de agosto con `0.15`, el mismo de fábrica — **cambió quién manda, no el comportamiento**. Con `contract_policy_history` vacía (C13), **no hay forma de leer del sistema qué se pactó** | **Sin construir.** Más grave que un umbral flojo: el árbitro puede estar aplicando una regla que las partes no pactaron |
| **C4** | **La geocerca congelada no es la que se usa** | El hecho guarda `expectedGeofenceId`; el motor juzga contra `profile.geofence` (`packages/services/src/verification.ts:1055`). 🟢 **6 ago: 546 ocurrencias divergen** —la cifra no se movió— **y todas son de Planta 47**. 🟢 **Y lo que este plan no decía: 420 de esas ocurrencias ya tienen hecho sellado**, o sea 420 de los 973 hechos reales (**43 %**) cargan una geocerca que no es contra la que se les juzgó | **Sin construir.** Requiere D-decisión: congelar el polígono, qué pasa con el campo huérfano, cómo se re-verifica un hecho viejo |
| **C2** | **La cadena de auditoría rota** | 🟢 **6 ago: 374 de 581 filas** (**64.4 %**) sin referencia a qué las reemplazó. La cifra es la misma de siempre **porque dejó de crecer**: 🟢 **las 374 son todas de la semana del 27 de julio**, y la semana del 3 de agosto agregó **una fila, con** su referencia. 🟢 **371 de las 374 son de `actor_kind: human`.** El mecanismo: `archiveAndDeleteFact` escribe la fila con `replacedByFactId` en nulo y un segundo paso, `updateHistorySuccessor`, es el que la cierra; en esas 374 el segundo paso no ocurrió. 🟡 **Por qué no ocurrió no se puede leer desde aquí** | **Sin construir. Toca la promesa comercial**: sin cadena, un veredicto no puede probar de dónde vino. 🟡 **Y la urgencia cambió:** es una cicatriz de una tanda, no una hemorragia |
| **C3** | **Se juzga antes de que llegue el expediente** | 🟢 **6 ago, y hay que decirlo con el eje o miente:** el archivador **hoy va a 6 minutos**, no a 7 horas — mediana **0.10 h**, p95 **0.18 h** en los últimos 7 días. Por semana de `recorded_at`: **22.13 h** la del 6 de julio · **0.10 h** de la del 13 en adelante · con un pico de **p95 5.31 h** la del 27 de julio. **El «~7 h, p95 30 h» de este plan era el promedio de un periodo roto con periodos sanos.** 🟢 Los intentos por servicio bajaron de **206 → 157 → 117 → 101 → 38.7** por semana, con el tope de cola del Tramo 0. 🟢 **Lo que no cambió es el mecanismo: nada retrasa el primer intento.** Y su cicatriz sigue medida: los **28** pendientes por cobertura son exactamente el **27 de julio (13, Campus)** y el **28 de julio (15, Planta 47)** — el fin de semana en que el archivador se atrasó | **Sin construir.** 🟡 Arreglar esto probablemente elimina la mayor parte de C2 — pero al 6 de agosto **ninguno de los dos está sangrando** |
| **C17** | **La cobertura de ruta se guarda ponderada y se lee llana** | ✅ **Arreglado en el motor.** Ahora se guardan las dos: `routeMatchPct` —la que decide, ponderada por TF-IDF— y `routeMatchPlainPct` —la llana—. 🔵 **5 ago:** 168 de 3 054 candidatas acreditaban ≥ 60 % teniendo una cobertura real con mediana de **3.9 %**; la correlación con la precisión pasa de **0.373 ponderada a 0.672 sin ponderar**. **No movió un solo veredicto.** 🟢 **6 ago, y esto acota quién lo puede leer: la primera entrada de ledger con `routeMatchPlainPct` es del 5 de agosto.** Todo lo sellado antes trae **solo la ponderada**, y quien lo lea debe decirlo así | **Hecho en el motor.** **Falta que las pantallas del expediente lean la llana** — que es justo donde la cifra miente |
| **C5** | **Ventana derivada vs. match observable** | No afinados entre sí: +50 se enderezan por uno, −2 se caen por el otro. 🟢 **6 ago — y esto cambia su estado: los datos ya llegaron.** `route_traversal_measurements` tiene **192 filas sobre 48 ruta-turnos**, del 31 de julio al 5 de agosto, y **48 de 48 llegan a las 3 muestras** que pide `routeDurationMinSamples`. ⚠ **102 de las 192 topan con el borde de la ventana** (`lower_bound`), así que el percentil sale sesgado hacia abajo | **Deja de estar bloqueado por datos.** Este plan decía «no es trabajo, es tiempo»; el tiempo ya pasó |
| **C15** | **El expediente etiqueta mal su propia evidencia** | El ledger escribe cada candidata con el campo **`imei:`** y adentro guarda un **id de UNIDAD**. 🟢 **Comprobado otra vez el 6 de agosto** sobre la entrada más reciente: el valor casa con `units.id` (1 fila) y con `evidence_points.imei` (**0 filas**). 🟢 **Y tiene origen exacto:** `verification.ts:1104` sustituye el imei por el id de unidad antes de entrar al motor, y el motor agrupa y etiqueta con lo que recibe. **Quien lea un expediente creerá que ve el aparato y está viendo el vehículo.** No cambia ningún veredicto y **sí cambia lo que el expediente dice**, que es el activo | ✅ **Arreglado el 8 de agosto (#267), y era peor que la etiqueta.** 🟢 El origen no solo nombraba mal: **`imei: imeiToUnitId.get(p.imei) ?? p.imei` SOBRESCRIBÍA el aparato**, así que el dispositivo no llegaba al expediente — no estaba mal nombrado, **no estaba**. La Ley 5 rota en una línea. Ahora el punto lleva `unitId` aparte y el ledger escribe `unidadId` e `imeis` (en plural: una unidad puede cambiar de aparato a media ventana). 🟢 **No movió ningún veredicto**, y está acreditado: el motor agrupa por `unitId ?? imei`, que es exactamente el valor que dejaba la sustitución — con pruebas que comparan las dos claves caso por caso y grupo por grupo, y seis que mueren al volver a agrupar por aparato. ⚠ **La regla de lectura que esto deja, y hay que aplicarla:** lo sellado **antes del 8 de agosto** trae la unidad bajo `imei:` y **no trae `unidadId`**. Esa ausencia es la única forma de distinguir las dos épocas. En las entradas viejas **el aparato no se guardó**, así que `imeis` sale vacío y eso significa «no se guardó», no «no hubo aparato» — rellenarlo con la clave repetiría C15 dentro de la pantalla (§E del Marco). Mismo criterio que `routeMatchPlainPct` en C17 |
| **C12** | **`frechetMaxKm` horneado fuera de la política** | 🟢 **6 ago: ninguno de los dos contratos reales lo declara** — el motor lo resuelve con `?? 0.8` (`index.ts:905`). Es el **único** umbral de KML que no vive en `contractPolicySchema`. **NO causa C11**, y ahora se puede decir por qué en una línea: alimenta `shapeOk`, y `shapeOk` **no entra en la expresión `servedRoute`** — solo ordena candidatas. Aun así incumple la **Ley 6** | ✅ **Arreglado el 8 de agosto (#269).** El default vive en `@jtel/domain` junto al esquema y el motor lo importa. 🟢 **Y había un TERCER `0.8` que esta ficha no mencionaba: la torre.** `monitoreo-data.ts` lo horneaba **dos líneas debajo de un comentario que decía «umbrales de la política del contrato»** — cierto para los otros tres umbrales de esa llamada y falso para éste. De ahí sale la **regla 19**. 🟢 **No movió nada, medido:** los **cuatro** contratos de la base (los dos reales y los dos de ejemplo) tienen el umbral efectivo en **0.8**, ninguno lo declaraba, cero cambian. 🟢 Al volverse obligatorio el campo, el compilador señaló **seis fixtures de política incompletos** en cuatro paquetes — ninguna prueba los habría encontrado. C7 sigue siendo su gemelo y sigue sin construir |
| **C7** | **`maxRouteDurationMinutes` fijo en 60** | Segundo «cuánto dura una ruta» sin derivar. Hoy no causa falsos negativos. 🟢 **6 ago:** los dos contratos lo tienen en **60**, y la historia que haría falta para derivarlo **ya existe** (ver C5) | **Tarea propia, no se mezcla.** Dos derivaciones cambiando juntas hacen inatribuible el resultado |
| **C6** | **Trazado KML que no corresponde** | Huertas-B, Centro-A, Parajes del Sur-A · ~43 servicios. 🔵 **5 ago:** el trazado **sí corresponde** en general — 1 461 waypoints con traza real a < 500 m, mediana 20 m —, así que esto es de rutas concretas, no del catálogo | **Trabajo humano** (H1), no código |
| **C9** | **Nombre del chofer sin congelar — y no es lo que esta ficha decía** | 🟢 **6 ago: 0 de 973 hechos reales** traen `declared_driver_name`. ⚠ **8 ago — remedido, y la redacción de arriba invita al arreglo equivocado.** Son **0 de 1 069** (la cifra creció con el sistema vivo), pero lo que importa es lo que había alrededor: 🟢 **0 choferes dados de alta · 0 expedientes · 0 asignaciones chofer↔ruta-turno**, sobre **48 ruta-turnos reales** que podrían tener uno. 🟢 **Y no existe el camino para crearlos:** no hay repositorio de choferes, ni API, ni pantalla de alta — la migración `0016` creó `drivers`, `driver_credentials` y `driver_assignments`, y **el único código que escribe en ellas es una prueba de integración**, con `insert` directo. **«El campo nunca se ha escrito» es cierto y engaña:** no es que el sellado se olvide de copiar un dato que existe — **es el último eslabón de una cadena cuyos cuatro primeros no existen**. Sellar el chofer declarado hoy congelaría `null` igual, y sería la regla de §9 otra vez: una defensa que ninguna escritura real atraviesa | **Espera al alta completa.** ✅ **Decidido el 8 de agosto:** no se construye la mitad del sellado hasta que exista de dónde declarar. Su medición de antes y después en producción sería **0 → 0**, así que no habría forma de acreditarla ahí. **El sellado es lo barato; lo que falta es el alta**, que incluye pantalla y por lo tanto entra al frente del rediseño |
| **C8** | **Identificación en vivo** | La sala no sabe qué unidad cubre qué ruta antes del cierre | Se piensa junto con C1 y C4 |
| **C1** | **Cuentas demo con veredictos vinculantes** | 🟢 **6 ago: la llave sigue cerrada.** Son **84** hechos exactos —54 de PRUEBA REAL, 30 de Honeywell, 52 `no_cumplido` entre los dos— y **el último se selló el 3 de agosto**: ni uno después | **Llave cerrada** (#206). Falta limpiar los 84 — con firma y motivo |
| **C10** | **Planta 47 sella menos que el Campus** | **Explicada por C11.** 🟢 **6 ago: 11.0 % de Planta 47 contra 53.9 % del Campus** (era 6.7/55.2 el 3 ago y 8.8/54.0 el 4). **La brecha se cierra despacio y por arriba**, y sigue siendo la sombra de C11, no una causa | **Explicada.** Deja de ser causa propia |
| **C20** | **Dos cosas distintas con el mismo nombre, y el conteo las suma sin avisar** | 🟢 **6 ago: existen dos turnos llamados «Turno B»** —uno de `Tecma 47` que arranca 15:30, otro de `TECMA Campus Santos Dumont` que arranca 18:00—, **en la misma cuenta cliente y con el mismo carrier**. Es el único nombre de turno repetido en toda la base. 🟢 **Ya costó una premisa:** D2 se abrió como «Turno B declarado 18:00» describiendo el turno del Campus mientras hablaba del de Planta 47, y el del Campus es el sano de los dos (54 % cumplido en esa ventana contra 0 %). 🟢 **Y no es solo turnos:** dentro del contrato del Campus hay **ocho nombres de ruta repetidos** —`Km 30` y `Oasis` tres veces cada uno, `Finca`, `Haciendas`, `Juarez Nuevo`, `Riveras`, `Sanders` y `Sierra Vista` dos—, que es el **caso 6 de §D del Marco** («Rutas del alcance: 27») visto desde el otro lado: allá el lector no podía reconstruir el número; aquí quien agrupa suma dos cosas | **Partida en dos, 8 de agosto.** ✅ **La valla está construida**: `agruparPorId` en `@jtel/domain` no acepta un nombre como clave, y aflojar el tipo pone `tsc` en rojo. ⏸ **La etiqueta espera al rediseño de pantallas** — es cambio de piel y su verificación exige navegador, así que hacerla antes sería trabajo de pantalla dos veces. **Es causa de NOMBRE, no de dato**: cada fila es correcta y el conteo también; lo falso lo pone la etiqueta que las junta. Misma familia que **C15** —el campo `imei:` que guarda un id de unidad— y por eso van juntas: **ninguna mueve un veredicto y las dos cambian lo que el documento dice**. 🟢 **Y el caso que la prueba mejor que el argumento: mordió a la medición que la descubrió.** Tres horas después de escribir esta causa, el conteo de perfiles de C21 dio **48 por id y 47 por nombre** — hay dos perfiles distintos que comparten nombre, y agrupar por nombre los colapsó en uno. **Quien escribió la causa cayó en ella el mismo día**, que es la regla 14 otra vez: una regla escrita no es una regla aplicada. 🟢 **7 ago — remedido, y con un detalle que esta ficha no tenía:** las tres colisiones siguen ahí (1 turno · 8 rutas del Campus · 48 perfiles por id contra 47 por nombre), y **la del perfil no es dentro de un sitio: es el mismo nombre, `Km 30 - B`, en LOS DOS CONTRATOS** —uno del Campus y otro de Planta 47—. Las otras dos colapsan cosas de un mismo sitio; ésta **cruza contratos**, que es el eje sobre el que se factura, así que es la peor de las tres. 🟢 **Y una buena noticia medida: ningún conteo del código agrupa hoy por nombre** — los índices existentes son por id. O sea que C20 no está produciendo cifras falsas en pantalla: el daño es la etiqueta que un humano no distingue, más el corte que alguien escriba mañana |
| **C21** | **Un cambio de turno no alcanza a lo ya generado — la hora límite se congela al crear la ocurrencia** | 🟢 **Mecanismo, leído en el código:** `renewRollingWindow(30)` (cron `/api/cron/renew-occurrences`) genera desde `max(service_date) + 1` hasta hoy + 30 días, calcula la hora límite **en ese momento** y la congela en la fila. **Nunca toca una ocurrencia que ya existe**, y **nada la revisa cuando el turno o la política cambian.** 🟢 **6 ago: 555 de 2 029 ocurrencias (27 %) llevan una hora límite que su perfil ya no produce, en 26 de 48 perfiles.** Cuatro poblaciones, y **no son el mismo defecto**: **(1)** Planta 47 · Turno A, **210 selladas** a las 23:45 contra 05:45 — **+360 min, seis horas**; **(2)** Planta 47 · Turno B, **84 selladas** a las 11:45 — **seis horas** bajo las 17:45 que su turno implicaba entonces; **(3)** Planta 47 · Turno B, **36 selladas + 102 sin sellar** a las 17:45 contra 15:15 — **eran correctas al generarse** y quedaron viejas porque el turno se movió a 15:30 después; **(4)** Campus · Primer Turno, **118 selladas + 5 sin sellar** a las 05:45 contra 05:40 — **cinco minutos**, forma de un cambio de `arrivalAnticipationMinutes`. 🟢 **Las poblaciones 1 y 2 son D1** (ver §3.2); **la 3 y la 4 no lo son**, y ésa es la razón de que esto sea causa aparte | **Sin construir.** **D1 es una población de este mecanismo, no el mecanismo.** El guion `corregir-deadlines` arregla el defecto de zona, pero **solo mira `expected_deadline > now()`** y corrige en sitio: no existe forma de que un cambio de turno alcance a lo ya generado, ni de saber que quedó desalineado 🟢 **7 ago — se corrigió el caso, NO la razón.** Se arreglaron **90** ocurrencias del Turno B (90 viajes, cero hechos movidos) y hoy **no queda ninguna sin sellar corriendo con hora límite vieja**. **Pero el mecanismo sigue intacto:** si mañana alguien mueve otro turno, vuelve a pasar igual y **nadie se entera hasta que alguien investigue**. 🟢 **Quedan 465 con hora límite que su perfil ya no produce — las 465 selladas**: 210 del Turno A y 84 del Turno B (que son D1), 123 del Campus (política que cambió 5 min) y 48 del Turno B que **eran correctas al generarse**. Moverlas ya no es corregir: es re-verificar, y eso es D1/D4. 🟢 **Y este episodio le puso precio, que antes no tenía:** de las 96 que se iban a corregir, **doce se sellaron mal esperando** — seis por decisión de Asav y **seis porque GitHub estuvo caído dos días**. **Entre descubrir un defecto y arreglarlo, el sistema sigue sellando.** El costo de C21 no es el defecto: es su latencia, y se paga en acusaciones que ya no se pueden deshacer sin re-verificar. ✅ **Cómo se cierra, decidido el 7 de agosto: el cron que revisa y AVISA, más historia para los turnos** — las razones y las dos descartadas viven en el Tramo 3. ✅ **8 ago — CONSTRUIDO y en producción** (#264, #265): el cron `/api/cron/revisar-horas-limite` corre a diario tras el generador, y `shifts` tiene historia con su trigger (migración `0019`, aplicada). ⚠ **Y la compuerta SIGUE ABIERTA, que es lo único que le falta al Tramo 3:** nadie ha visto el correo llegar a una bandeja. **Detectar está probado; avisar no.** El detector encuentra CERO hoy —no queda ninguna sin sellar con la hora vieja—, así que una corrida limpia no distingue un canal sano de uno mudo. Por eso existe `?simular=1` y el botón «Simulacro del aviso» en Actions: manda un correo real, marcado como simulacro, sin leer la base. **Hasta que ese correo se vea en una bandeja, C21 no cuenta como cerrada** — es la regla 16, y es donde murieron las dos generaciones del vigilante |

---

### 5.2 El grafo de dependencias — cuál desbloquea a cuál

**Una línea por par.** Ordena por dependencia, no por gravedad: una causa grave que
depende de otra va después de la que la desbloquea, **aunque duela**.

| Depende de | La que espera | Por qué, en una línea |
|---|---|---|
| **C19** | **C11** | 🟢 La densidad decide la cobertura, y la cobertura es la entrada de A: medir cualquier umbral con la densidad moviéndose mide el aparato, no la regla |
| **C19** | **C17** | 🟢 La ponderación se calcula sobre los puntos que hay; con 1.5× puntos, la misma unidad da otro número sin cambiar de conducta |
| **C19** | **C5 · C7** | 🟢 Las dos derivan una duración de la traza observada, y la traza cambió de densidad a media serie |
| **C19** | **C18** | 🟡 Detectar que una unidad cubrió dos trazados exige puntos suficientes en los dos; con traza rala el empalme es invisible |
| **C14** | **C11** | 🟢 Mientras `!hasKml` sea lo único que apaga A∧B, ningún servicio `destino_only` cuya unidad llegó puede cerrar solo — los 61 no tienen salida |
| **C13** | **C11** | 🟢 El mismo fallo cuenta como pendiente o como acusación según la perilla: los 61 desaparecen del conteo durante la ventana `kml_full` de Planta 47 y reaparecen el 31 de julio |
| **C13** | **C16** | 🟢 Sin `contract_policy_history` no hay contra qué comparar la configuración: la divergencia se puede ver, pero no se puede fechar ni atribuir |
| **C16** | **C11 · C13 · C14** | 🟢 A y B salen del contrato; si el contrato no dice lo que se pactó, toda medición de umbral se hace contra una regla sin acreditar |
| **C3** | **C11** | 🟢 Los 28 pendientes por cobertura son exactamente el 27 y 28 de julio, el fin de semana en que el archivador se atrasó |
| **C3** | **C2** | 🟡 Menos reintentos, menos borrado — pero al 6 de agosto **los dos dejaron de crecer solos**, así que la dependencia es de mecanismo y ya no de presión |
| **C4** | **C11 · C13** | 🟢 `arrivalAt` sale del polígono, y el motor usa uno distinto del que el hecho guarda: cualquier remedición de «llegó» se mueve con esto |
| **C5** | **C7** | 🟢 Las dos comen de `route_traversal_measurements`, y **ya tiene historia suficiente** (48 de 48 ruta-turnos con ≥ 3 muestras) |
| **C6** | **C14** | 🟢 `!hasKml` es el interruptor real de A∧B, así que qué rutas tienen trazado —y si el suyo es el correcto— decide más que el contrato |
| **C1 · C4** | **C8** | 🔵 Comparten la pregunta «qué se congela dentro del hecho», que es el Tramo 4 |
| **—** | **C12 · C15 · C9 · C20** | 🟢 No dependen de nada ni desbloquean nada: **no mueven un veredicto**, mueven lo que el expediente dice y lo que la ley exige |
| **C20** | **D2** | 🟢 No es dependencia de motor sino de lectura: **ya le costó una premisa a D2**, y cualquier corte «por Turno B» que no diga cuál seguirá sumando dos contratos |
| **C21** | **D1 · D2** | 🟢 D1 es **una población** de C21 —las 294 con seis horas de corrimiento—, y lo que D2 va a acordar con la Planta **no alcanza a las 138 ocurrencias ya generadas** de ese turno mientras C21 exista |
| **C21** | **C4** | 🟡 Misma forma en otro campo: el hecho congela `expectedGeofenceId` y el motor usa `profile.geofence`. **Congelar sin forma de revisar** es el patrón, no el campo |
| **—** | **C10** | 🟢 No es causa: es la sombra de C11 medida por contrato |

---

### 5.3 Los solapamientos — qué comparte ruta, y qué comparte código

**Compartir ruta ya se sabía. Lo que faltaba es esto:** siete causas se cruzan en
**una sola expresión booleana**, y por eso mover una mueve la medición de la otra.

#### El nudo: `servedRoute` — `packages/verification/src/index.ts:575-580`

```
const servedRoute =
  arrivalAt !== null &&                          ← C4 (qué polígono) · C8
  (!hasKml ||                                    ← C14 · C6
    (observableEnough &&                         ← C16 (kmlOriginToleranceFraction)
     routeMatchPct >= params.minKmlPct &&        ← C17 (decide la ponderada) · C19 · C16
     corridorPrecisionPct >= params.minCorridorPct));  ← C16 (Campus al 50 %) · C19
```

> 🟢 **Los cinco términos producen el mismo número: cuántas candidatas acreditan.**
> Dos de ellos tocados en el mismo PR hacen **inatribuible** el resultado. Es la
> regla «una causa por PR» del Tramo 3 dicha a nivel de línea.
>
> 🟢 **Y `shapeOk` no está en esa expresión** — vive fuera, solo ordena candidatas.
> Ésa es la razón exacta de que **C12 no cause C11**, y de que arreglarlo sea seguro
> de medir por separado.

#### Los otros tres racimos

| Racimo | Dónde | Quiénes caen ahí |
|---|---|---|
| **El camino del sello** | `services/src/verification.ts` · `db/src/repositories/index.ts:3375` | **C2** (`archiveAndDeleteFact` → `updateHistorySuccessor`, dos pasos) · **C3** (nada retrasa el primer intento) · **C4** (`expectedGeofenceId` se escribe aquí) · **C9** (el nombre del chofer se congelaría aquí) |
| **La política del contrato** | `service_contracts.policy` · `contractPolicySchema` | **C16** (dieciséis de 24 campos divergen) · **C13** (sin historia) · **C12** (el único umbral fuera del esquema) · **C7** · **D6** (quién puede cambiarla) |
| **El ledger y el expediente** | `ledger_entries.steps` | **C15** (`imei:` con id de unidad) · **C17** (la llana solo desde el 5 ago) · **C11** (la causa del pendiente se lee de aquí) |

#### Y lo que comparte ruta o sitio

- **Planta 47** aparece en C4 (las 546 son *todas* suyas), C10, C11 (los 61), C13 (133 congelados) y C19 (el salto de densidad es suyo).
- **El Campus** aparece en C13 (208 y creciendo), C16 (el corredor al 50 %) y C18 (18 de 28 días con empalme).
- **Huertas-B** aparece en C5 y en C6 — 🔵 **y NO aparece entre los pendientes de C11**, medido el 4 de agosto.
- **Ya no aparece en D2:** los pendientes de C11 son del **Turno A**, y D2 habla del **Turno B**, así que resolver D2 no los mueve.
- 🟢 **Y el Turno B de Planta 47 es un agujero propio, medido el 6 de agosto: 120 hechos, cero cumplidos.** No entra en C11 —solo 1 de sus 120 es pendiente— sino en D2. Es el turno que nunca ha acreditado un servicio.
- 🟢 **Y la trampa de nombres tiene causa propia — C20:** hay **dos turnos distintos llamados «Turno B»**, el de **Planta 47 a las 15:30** y el del **Campus a las 18:00**, en la misma cuenta. Cualquier conteo «por Turno B» que no diga cuál, suma dos contratos. **Ya le costó una premisa a D2.** Y dentro del Campus hay ocho nombres de ruta repetidos.

---

### 5.4 Qué se puede medir hoy sin sellar, y qué no

**Va primero por regla:** si una causa necesita re-verificar para dimensionarse, eso
es decisión de Asav y no se toma aquí.

| | Causas | Notas |
|---|---|---|
| ✅ **Medido hoy, solo lectura** | C1 · C2 · C3 · C4 · C5 · C7 · C9 · C10 · C11 · C12 · C13 · C14 · C15 · C16 · C17 · C18 · C19 · C20 · C21 | Toda la tabla de 5.1. Se leyó producción con `jtel_readonly`; **ninguna escribió, selló ni re-verificó nada** |
| 🔎 **Medible hoy, sin medir aún** | **C18** en Planta 47 por geometría (cubrir dos trazados ≠ acreditar dos rutas; la de hoy usa la segunda definición) · **C6**: qué rutas tienen versión de trazado y de cuándo · **C7**: derivar la duración con las 192 filas de C5 · **C2**: qué corrida dejó las 374 sin cerrar | Nada de esto exige sellar. Es trabajo de lectura que aún no se hizo |
| ⚙ **Requiere tocar el motor** | Si mover un umbral **rescata** servicios · si el arreglo de C14 cierra los 61 · si C18 evaluado contra el conjunto de rutas cambia veredictos | Eso es **simulación** y vive en D4 / Tramo 6, no aquí |
| 🚫 **No es leíble desde aquí** | **Por qué cambió la densidad el 29 de julio** (C19) · **por qué el archivador se atrasó el 25–26 de julio** (C3) · **por qué esos tres lunes y no los otros**. 🟢 Lo verificado es que **no fue nuestro código**; 🟡 la causa se infiere del proveedor o de los dispositivos | Son tres de las cuatro cosas que el reporte final dejó sin explicar. **La cuarta —si el empalme es rutinario— ya se midió** (C18). **Y puede repetirse sin avisarnos** |
| 👤 **Necesita una persona** | **C6 / H1**: abrir el KML de Huertas-B, Centro-A y Parajes del Sur-A en un visor y compararlo a ojo | No lo puede hacer el motor ni Devin |

---

### 5.5 Qué espera decisión de Asav

**Separado de lo que es solo código**, y dentro de eso, distinguiendo qué clase de
decisión es cada una.

| Qué | Clase | La decisión concreta que hace falta | Causas que destraba |
|---|---|---|---|
| **D1** · los 294 hechos con el deadline mal calculado | Negocio | Corregirlos con firma y motivo, o dejarlos | — |
| **D2** · Turno B de Planta 47 | **Conversación con la Planta** | 🟢 **Resuelto cuál de los dos es: el de Planta 47**, y **los 36 son 100 % suyos**. El turno **ya se movió a 15:30** y su ventana nueva (12:59–16:00) es la primera que contiene la operación de ~14:00 — **pero arranca el 31 de agosto**. Falta: **confirmar que 15:30 es la real**. 🟢 **7 ago: lo de las 102 ya se resolvió** — se corrigieron **90** (las otras 12 se sellaron antes) y **ninguna sin sellar corre ya con la ventana vieja** | No mueve C11 (Turno A) |
| **D3** · regla de cierre del pendiente por evidencia | **Negocio + legal** | Cuánto puede un servicio quedarse en pendiente y qué pasa después. 🟢 **El dato se movió: son 106 pendientes y 89 llevan más de 48 h** al 6 de agosto, contra los 71 con que se abrió esta decisión — y sigue creciendo | C11 |
| **D4** · re-verificar las 300 congeladas | Negocio | Cuándo, sabiendo que cada re-verificación mete una versión más en la historia del hecho | C5 |
| **D5** · cómo se le cuenta a Tecma que su número cambia | Negocio | El mensaje, **antes** de que el número se mueva. 🟢 Ya se movió solo: 6.7 % → 8.8 % → **11.0 %** en tres días | Precede a D4 |
| **D6** · quién puede modificar la política sin acuerdo del carrier | Negocio | Configurable con piso no negociable: **que el carrier se entere siempre** | C13 · C16 |
| **D7** · dirección visual del producto | Negocio | Tres respuestas que este plan no puede suplir | Bloquea pantallas |
| **H1** · las tres rutas con falla real de trazado | **Trabajo humano** | Abrir el KML en un visor y compararlo | C6 |
| 🆕 **Qué se pactó de verdad en el Campus** | **Conversación con la Planta** | 🟢 El corredor está en **50 %** y Asav lo recordaba en **60 %**; **dieciséis de 24 campos difieren** entre los dos contratos y **siete corren con valor de fábrica** en el Campus. **Sin esto, C16 no se puede cerrar: no hay contra qué comparar** | C16 · C13 |
| 🆕 **Qué se hace con los 84 hechos demo** | Negocio | 🟢 La llave está cerrada y los 84 siguen ahí. Limpiarlos **con firma y motivo** es la misma pregunta de D1 aplicada a otro conjunto | C1 |

---

### 5.6 Lo que cerrar este tramo coloca

**No es solo el orden de las causas.** **Ocho** frentes están escritos y sin lugar,
y se colocan al cerrar el Tramo 2 — cuatro salen directo de esta tabla. Eran cinco
al abrir el tramo; los tres que se sumaron —el diseño, las pruebas en CI y el
proveedor de GPS— salieron de medir, no de planear.

| Frente | De qué causa sale | Qué de esta ficha lo alimenta |
|---|---|---|
| **La puerta sin salida de `destino_only`** | **C14** | 🟢 Los 48 ruta-turnos tienen KML, así que la perilla está inerte para todos |
| **Los sensores** | **C19 · C3 · C13 · C16 · C14** | 🟢 Cada sensor ya tiene su cifra del 6 de agosto en 5.1 |
| **La app del coordinador de planta** | **C11 · C18** | 🟢 El empalme es rutinario (18 de 28 días del Campus), así que una declaración previa desempata más de lo que se creía |
| **El alcance fino** (1.h · `admin_planta` · el alta completa) | — | 🟢 El dato que este plan pedía tener en mano para colocarlo: **106 pendientes, 89 de más de 48 h** (D3) |
| **El diseño no alcanza a la construcción** | — | 🟢 8 rutas nuevas contra 4 fichas nuevas en seis días; **33 de 69 sin ficha**, J-Staff entero |
| **Las pruebas de integración en CI** | — | 🟢 41 pruebas existen y ningún check las ejecuta; el verde dice «las pruebas pasan» y midió «las unitarias pasan» |
| **Independencia del proveedor de GPS** | — | 🟢 El código nombra a un proveedor concreto en paquete, esquema, variables y pantalla. **Abstraer antes de conectar el segundo**, o quedan dos casos especiales cosidos |
| **La reconciliación del expediente** | **C15 · C17** | 🟢 El expediente hoy etiqueta mal la evidencia y, en todo lo sellado antes del 5 de agosto, solo tiene la cobertura ponderada |

---

## 6. Lo que NO entra en v1

Queda en `DESPUES.md`. No bloquea.

**Sin diseñar:** Diésel · Taller · Rastreadores · Inspecciones · Reportes ·
J-Staff completo · móvil.

**Bloqueado por datos, se llena solo:** duración esperada de ruta · rendimiento de
diésel · lectura del cambio de rastreador.

**Legales, no bloquean v1:** qué contiene un export con evidencia · qué hace
probatorio un documento en una disputa.

**Conceptos v2:** Sandbox · map matching como capa de explicación · promoción de
variantes · **modo pasajero** · pre-nómina · Lenore-auditora · Lenore-copiloto de
configuración · Lenore-detección de deriva · Lenore-copiloto general.

**Advertencia que no se puede perder:** la perilla `destino_only` de
`routeStrictness` **está reservada para el modo pasajero y no se usa como
estabilizador**. Ponerla para que un contrato deje de salir rojo es apagar la
verificación de ruta y llamarlo otra cosa.

---

## 7. Contradicciones resueltas

Registro de las once contradicciones medidas entre `PLAN-v1.md` y `DESPUES.md`, y
cuál ganó. Se conserva para que nadie las reabra.

| # | Qué | Resolución |
|---|---|---|
| **F1** | **Turno B de Planta 47** | `PLAN-v1` decía ✅ resuelto. **Falso.** Gana `DESPUES.md`: falla 6 de 6 días y está bloqueado por una conversación con la Planta que no ha ocurrido — **D2** |
| **F2** | Las 300 | La simulación **ya se corrió** (139/160/1 el 30-jul). El bloqueo es otro: falta afinar C5 e historia en `route_traversal_measurements` — **D4** |
| **F3** | Historia de la política | **Entregada** en #125 y en producción. `PLAN-v1` la listaba como faltante |
| **F4** | Historial / vista de flota | **Construido** y ya conectado al resumen. Se resuelve a favor de `PLAN-v1` |
| **F5** | Política como acuerdo vivo | Es **v1**: pieza 1 hecha, pieza 2 (cláusula) pendiente, pieza 3 anclada a `auth-rbac` — **D6** |
| **F6** | `maxRouteDurationMinutes` | Entra a v1 como **C7**, tarea propia |
| **F7** | Historia del sello | v1, componente parcial: falta la columna de causa |
| **F8** | **Lenore v1** | **No estaba en el camino, ni programada ni excluida.** Resuelto: vigía y narradora entran en v1, Tramo 7. La narradora bloqueada por el Tramo 4; **la vigía no está bloqueada por nada técnico** |
| **F9** | Auth / seguridad | Es **condición no negociable de v1**. Tramo 1 y Tramo 7 |
| **F10** | `jrz-pass` | **Descartado.** `jrz-drone-os` es fuente de datos, nunca de código ni de diseño |
| **F11** | Las tablas de decisiones no coincidían | Reemplazadas por §3 de este documento, que es la única |

**Contradicción interna de `DESPUES.md`** (sobre si la zona horaria empeoró el
cálculo o si nunca se leyó): **queda abierta.** Requiere medición antes de
escribirse aquí como hecho. No se arrastra a este plan.

**Resuelto también, fuera de esas once:** el número de hechos demo. Los documentos
decían 73; la medición del 3 de agosto dio **84**, porque el cron siguió sellando
mientras la llave estaba abierta.

---

## 8. Estado del repo

`asav-mx/j-tel` · Next.js, Neon/Postgres, Vercel (`j-tel-web`).
Paquetes: `db` · `domain` · `verification` · `services` · `gps-umbrella` ·
`auth-rbac` · `reports`.

**Construido y en producción:** las dos caras con datos reales y dos temas ·
cinco expedientes ·
26 de 26 rutas de API guardadas · **las 65 páginas guardadas y el Tramo 1
cerrado** —`/entrar` como puerta, vuelta al destino validada, sin identidad por
omisión— · historia de la política · plomería de alertas · el árbitro con sus
cuatro arreglos de ventana.

**El candado ya no es «identidad sin enforcement».** Lo que falta de él es una
pieza nombrada —1.h, que vive en el **Frente del alcance fino**— y el login real
del Tramo 7.

### La UI, medida el 7 de agosto de 2026 — y una contradicción resuelta

⚠ **Este plan decía «el frente visual está cerrado» y era falso.** Al mismo tiempo,
`docs/Analisis-Que-Falta-UI.md` decía «36 pantallas nunca se diseñaron». **Las dos
vivas, opuestas, y ninguna medible sin volver a contar.** Gana el número medido:

| Cara | Rutas | Con ficha | Sin ficha |
|---|---|---|---|
| Cliente | 41 | **28** | 13 |
| Carrier | 15 | **8** | 7 |
| J-Staff | 9 | **0** | **9** |
| Públicas / raíz | 4 | 0 | 4 |
| **Total** | **69** | **36** | **33** |

🟢 **Ni «cerrado» ni «36 sin diseñar»: son 36 CON ficha y 33 sin.** El análisis viejo
contaba un universo de 48 —solo cliente y carrier— contra `7c5a471`, del 1 de
agosto; `main` iba **140 commits** por delante cuando se remidió. Queda **superado,
no borrado**: su lectura de fondo —*el hueco es de diseño, no de construcción*—
sigue siendo cierta, y J-Staff entero sin ficha lo demuestra.

**Y el número se puede rehacer solo.** Cada ficha de pantalla declara su ruta en el
encabezado, entre acentos graves, con `**Reviste:**` o `**Reemplaza la piel de**`.
Contar es leer esas líneas y cruzarlas con los `page.tsx` — **no hace falta
interpretar ninguna ficha.** Antes sí hacía falta, y por eso el conteo envejeció
sin que nadie lo notara.

> ⚠ **Dos trampas que salieron al hacerlo mecánico, y quedan escritas:**
> `Ficha-Oficina-Contrato` declaraba `cliente/*/configuracion`, que **se lee como si
> cubriera los tres alcances y deja fuera el corporativo** — cinco rutas aparecían
> sin ficha teniéndola. Y `Ficha-Choferes` declara `carrier/choferes`, **una ruta
> que todavía no existe**: una ficha sin pantalla, que es el hueco al revés.

**La foto de referencia del 3 de agosto** de los documentos viejos vive en
`docs/corte-2026-08-03/`. Es foto, no ley. No se edita.

---

## 9. Bitácora de ediciones

Toda edición de este documento se anota aquí, con fecha y qué cambió. Es la forma
de saber por qué el plan dice hoy algo distinto a la semana pasada, sin tener que
adivinar.

**3 de agosto de 2026 — creación.** Unifica `PLAN-v1.md`, `Plan-Camino-a-v1.md` y
los dos `Despues.md`. Resuelve las once contradicciones medidas entre los dos
primeros (§7). Adopta la definición nueva de v1 (§1), que sube el expediente del
no cumplido a corazón de v1 y convierte "el hecho debe bastarse a sí mismo" en
bloqueante.

**3 de agosto de 2026, tarde.**
- **T1 Clerk: hecho.** Sin organizaciones (verificado contra el código: el
  alcance de seis niveles no cabe en una organización plana, y un usuario
  necesita varias cuentas a la vez). Solo Email. Llaves de test en Vercel.
- **T3/D8 dominio: `j-telemetry.com`.** `j-tel.io` descartado; queda la deuda de
  sacarlo del landing y su CSS — pieza 1.f.
- **D9 modelo de altas: decidido**, sin diseñar. Invitación o solicitud aprobada
  desde J-Staff.
- **Hallazgo: la portada pública entra a los datos sin login y nombra a los
  clientes.** Nuevo, no estaba en ningún documento anterior. Sube el Tramo 1 y le
  agrega la pieza 1.f.
- **El mapeo de identidad se simplifica:** hoy el único usuario del sistema es
  Asav. Una sola identidad se mapea; las otras tres filas del seed quedan
  intactas. Y **se agrega, no se reemplaza** — reemplazar dejaría las pantallas
  en blanco sin error.
- Bloqueos de §3: de trece a nueve.

**3 de agosto de 2026, noche.**
- **Pieza 1.a cerrada.** El mapeo se construyó (#209), se ligó la identidad de
  Asav (#211) y se aplicó a producción: `admin_plataforma` · alcance global ·
  cuenta J-Staff. Se comprobó que `/quien-soy` dice `origen: clerk` con 1
  membresía. Las tres filas del seed restantes, intactas.
- **La deuda del dominio, saldada** (#212 y este PR). Verificado en el
  navegador, no solo compilando.
- **T2 pasa a tener dos mitades**, y la segunda no la resuelve el sistema: que
  exista `hola@j-telemetry.com`. El botón «Solicitar demo» del landing llevaba
  apuntando a un buzón inexistente desde que se construyó.
- **Ficha-Cara-De-Producto §4.1 corregida**: decía que el dominio no estaba
  comprado. Ya lo está; lo que sigue pendiente son los subdominios y las llaves
  de producción de Clerk.

**4 de agosto de 2026.**
- **1.b y la primera tanda de 1.c, hechas** (#214, #215). `/jstaff` cierra en
  producción: nueve páginas más su layout, comprobado contra el build **con
  `JTEL_DEV_USER` puesto** — el bypass no abre la puerta.
- **1.f hecha** (#216), y era **fuga activa**: `www.j-telemetry.com` servía
  «Tecma» y «Juárez Bus» sin login, ya sin la cortina de Vercel. La raíz pasa a
  ser una ruta con dos caras y la portada enseña solo lo tuyo.
- **Los dos dominios son uno.** `j-telemetry.com` responde **308 permanente** a
  `www.j-telemetry.com`; el ápex nunca sirve contenido, así que las guardias
  cubren las dos direcciones por construcción.
- **Pieza 1.h abierta:** la guardia por alcance. 1.c cierra a nivel cuenta; el
  alcance fino va aparte, y arrastra la regla del campus de la ficha §2.2, que
  **no está implementada** en `canAccessPlant`.
- **Queda escrito el límite del canal de tiempo** entre los dos 404. No se
  cierra en este tramo, y ahora está donde se ve.
- **La tanda de `/cliente` cerrada** (#220): 41 páginas, con la cuenta sacada
  de la fila del recurso y no de `?account=`. Barrido contra el build de
  producción: 25 rutas, cero con datos reales en el cuerpo.
- **Regla 7 de «las ganadas por las malas»**, salida de ahí: un `redirect()` de
  layout no impide que la hija se renderice, y por eso se verifica el cuerpo y
  no el código de estado.
- **El fallback de `resolveAccountByType`, cerrado** (#222, la tanda que cerró
  `/carrier`). Y resultaron ser **dos agujeros, no uno**: sin `?account=` la
  función terminaba en `listByType(type)[0]` y devolvía la primera cuenta de la
  tabla, fuera de quien fuera; y **con** `?account=` tampoco comprobaba nada —
  el parámetro elegía contra quién compararse. Ahora el default sale del
  **alcance** de quien pregunta, no del orden de la tabla: con parámetro, la
  cuenta tiene que existir, ser del tipo y estar dentro de tu alcance; sin
  parámetro, si tu alcance cubre exactamente una, esa, y si cubre varias o
  ninguna, `null` y que decida quien llama. Un solo cambio arregló los 26
  sitios que lo llamaban.
- **1.f solo era el escaparate, y hay que decirlo:** comprobado contra
  producción, `/cliente?account=tecma` responde **200 sin sesión** y entrega
  «Tecma Planta 47 (73) y Campus Santos Dumont (25)». Quitar los nombres de la
  portada **no cerró el acceso**. Por eso `/cliente` pasa delante de `/carrier`
  en 1.c: es la fuga más urgente, no la más simple.
- **`tieneAlcanceGlobal`** (#218): la portada leía membresías en vez de
  alcance, y una identidad global tiene una sola fila. La regla vive en
  `@jtel/auth-rbac` y la usan también las funciones de acceso — ofrecer una
  puerta que no abre es la misma mentira al revés.
- **D9 completada** con sus cinco reglas. La segunda es la que sostiene a las
  demás: nadie crea a alguien con más alcance del que tiene.
- **Piezas 1.i y 1.j abiertas:** `/entrar` como puerta limpia, y volver al
  destino tras entrar. Las dos van después de cerrar `/cliente` y `/carrier`.
- **§2 corregido, y la corrección es del tipo que este plan existe para
  registrar.** El párrafo del carrier sugería que hoy los carriers se alcanzan
  entre sí. **Medido con dos transportistas de verdad en la rama desechable
  (#225): los seis caminos con id niegan lo ajeno.** Lo que sí falla es la
  forma: cerrado por disciplina repetida —cinco comprobaciones en cinco
  archivos— y no por construcción. El riesgo es la pantalla dieciséis, no la
  quince. Y lo que lo destapó fue exigir la medición antes de escribir la
  guardia: leer cinco archivos era exactamente lo que iba a fallar.
- **La tanda chica del Tramo 1, cerrada o en la puerta: 1.d, 1.e, 1.g, 1.i y 1.j.**
  Cada una se clasificó por el lado de §2 **antes** de abrirla, como quedamos.
- **1.d resultó ser estructura, no cambio visible, y hay que decirlo así.** Un
  usuario de planta no llega al filtro: `resolveAccountByType` pregunta
  `canAccessClientAccount`, que exige alcance de cuenta, y ahí se queda —
  medido con el seed contra la base desechable, no inferido. Lo que entra sirve
  para cuando 1.h abra la puerta.
- **Y destapó un §D que habría nacido con el filtro.** Las cifras del titular
  —total de pendientes, antigüedad del más viejo— salen de consultas de
  **cuenta**. Recortar la lista de sitios sin recortarlas habría dejado un
  total contando sitios que no aparecen: la misma mentira de «contar desde
  siempre», cambiando el eje del tiempo por el del lugar.
- **1.i movió la puerta y destapó una contradicción de pantalla.** Con
  producción levantada en local, `/entrar` decía «Necesitas entrar para ver
  eso» y en la esquina el distintivo decía `tecma_admin · variable`: le
  anunciaba a un visitante sin sesión un identificador interno y que el bypass
  está puesto. No era redundancia, era contradicción.
- **1.j: la comprobación obvia del `?volver=` no alcanzaba, y se supo por
  medir.** Antes de escribir el validador se corrieron cadenas de ataque contra
  el parser de Node: `new URL("/..//evil.com", centinela)` **conserva el
  origen** y devuelve `pathname` `//evil.com`, que el navegador lee como
  externo. De ahí la regla del archivo — se comprueba la cadena que se va a
  **devolver**, no la que llegó.
- **Y las pruebas de mutación cambiaron el diseño, no solo lo confirmaron.**
  Con el validador en una sola función, quitarle la comprobación de origen **no
  ponía nada en rojo**: la lista blanca atajaba los mismos casos un paso
  después. Una defensa que ninguna prueba distingue es una defensa que no sabes
  si tienes. Se partió en dos capas con batería propia cada una; de paso se
  borró una comprobación que ninguna entrada podía disparar.
- **1.e retira la muleta, y el tipo hizo el trabajo.** `userId: string | null`
  obligó a decidir qué hace cada pantalla sin identidad; TypeScript encontró
  los cuatro consumidores exactos. **En producción no cambia nada hoy** porque
  `JTEL_DEV_USER` está puesto: lo que cierra es local, CI y el despliegue al
  que le falte esa variable.
- **1.g era más chica de lo que este plan decía.** El valor de `CRON_SECRET`
  salió de `README.md` y `DESPUES.md` el 2 de agosto, en el mismo commit que
  quitó el respaldo. Comprobado sobre `main` el 4: **cero archivos versionados**
  lo contienen. Lo que quedaba era documentación mintiendo — `DESPUES.md` decía
  en **tres lugares** que faltaba rotarlo, y ya estaba rotado.
- **Del historial no se quita, y queda escrito por qué.** Estando rotado, ese
  valor no abre nada: es un registro de lo que pasó, no una llave. No se
  reescribe historia por esto.

**5 de agosto de 2026 (los tramos).**
- **La pregunta abierta, contestada: ni un viaje ni la ruta en tramos.** Las 15
  rutas del Turno A del 9 de julio, cada trazado partido en diez tramos: **la
  mejor unidad cubre 4.8 de 10**, y **las 52 unidades del turno juntas, 7.1**.
  Solo 2 de 15 rutas llegan a 10/10. En *Sanders - A* **siete tramos no los pisó
  nadie** ese día.
- **Se concilia con «el trazado sí corresponde» porque el eje es distinto:**
  aquél agregaba veinte días, éste mira uno. 🟡 **Cada día se recorre una parte
  distinta del trazado.**
- **Y eso reencuadra la métrica entera:** exigir que **una** unidad cubra el 60 %
  de un trazado que **ninguna** recorre entero **no es un umbral apretado, es una
  cuenta que no puede salir.**
- **Lo siguiente:** si la selección diaria sigue un patrón —variantes declaradas,
  paradas de algunos días— o es arbitraria. Ahí entran C5 y las variantes sin
  congelar.
- **El guion de `kmlOriginToleranceFraction` ya no copia el valor a mano:** lo lee
  de `packages/verification/src/index.ts` y **se niega a correr si no puede
  leerlo**. Regla 10 aplicada al propio guion.

**6 de agosto de 2026 (lo que ve la planta).**
- **Medido qué ve exactamente un usuario de alcance `plant`**, con la identidad
  del seed que tiene la misma membresía que tendrá la tercera de prueba.
- **No es una pantalla vacía: es una contradicción.** La portada cuenta su
  membresía, ve **una** puerta y lo empuja adentro con un **307 idéntico al de
  `tecma_admin`**; la guardia pregunta por alcance de **cuenta**, no la tiene, y
  le contesta **«No hay cuentas cliente»**. Y su propia planta por id le da
  **404**.
- 🟡 **1.h no falla cerrado ni falla abierto: se contradice.** El mismo usuario,
  en la misma petición, es «tienes exactamente una cuenta» para una mitad del
  producto y «no hay ninguna» para la otra.

**6 de agosto de 2026 (la tarde).**
- **Las dos caras probadas con identidades reales, y la pared aguanta:** Tecma
  solo ve Tecma, Juárez Bus solo ve Juárez Bus. **Primera vez que se prueba con
  personas y no con el bypass.**
- **La portada se salta cuando hay una sola puerta.** Con una cuenta pedía elegir
  entre una opción. Medido en las tres identidades: `tecma_admin` → 307 a
  `/cliente?account=tecma` · `jb_admin` → 307 a `/carrier?account=juarez-bus` ·
  `jstaff_admin` (alcance global) → **200, portada**, que es lo correcto.
- **J-Staff cuenta como puerta:** quien tiene consola **y** una cuenta tiene dos
  destinos reales y debe poder elegir.
- **El frente de altas se renombra a «el alta completa»** y gana su alcance real
  —cuenta, contrato, primer admin, identidad en Clerk y membresía— porque
  «administración de usuarios» se quedaba corto. **Pasa a bloqueante para
  vender.**
- **Regla 14, y la ruptura del Campus queda como caso y no como nota.**

**6 de agosto de 2026.**
- **`kmlOriginToleranceFraction` escrito en el contrato del Campus.** Valor
  `0.15`, el mismo de fábrica: **cambia quién manda, no el comportamiento**.
- **Y hubo un incidente en el primer intento, que queda escrito.** El guion hacía
  `policy || <objeto>::jsonb`; el driver manda el objeto como **cadena**,
  Postgres la castea a un jsonb *string*, y `objeto || string` **no fusiona:
  produce un ARREGLO**. La política del Campus quedó como `[ {original}, "{…}" ]`
  — **nada se perdió** (el original íntegro en el elemento 0) pero la columna
  dejó de ser un objeto y el motor no la podía validar. **Restaurado con
  `policy = policy->0`**, comprobado con el usuario de solo lectura, y **los
  1 057 hechos sellados intactos**.
- **Lo que lo dejó pasar fue no comprobar después de escribir.** El guion
  imprimía «✓ escrito» sin leer nada — **un `UPDATE` cuyo resultado no se
  comprueba no se distingue de uno que no corrió**. Es la regla 10 del lado de la
  escritura. Ahora construye con `jsonb_build_object`, se niega si la política no
  es un objeto, y **lee de vuelta antes de decir que sí**.
- **Y lo que lo habría evitado fue ensayar en la desechable, que es justo lo que
  no hice.** La segunda corrida ensayó primero ahí —4 contratos, los 4
  correctos— y solo entonces tocó producción.
- **Dos identidades de prueba ligadas:** admin corporativo de Tecma y admin de
  Juárez Bus, marcadas `prueba: true`. **2 filas insertadas, ninguna modificada
  ni borrada**, 1 057 hechos sin cambio. Falta la de Planta 47, que **no va a
  poder ver su cara** — y ése es el punto.
- **La carencia de la pantalla de altas pasa de teórica a observable**, y queda
  con su requisito: **crear la identidad en Clerk y la membresía en la base en un
  solo paso**.

**6 de agosto de 2026 (Tramo 2 — la ficha de consolidación).**
- **§5 reescrita entera**, con las cinco cosas que le faltaban: la lista con el
  estado real y **la fecha pegada a cada cifra** · el grafo de dependencias, una
  línea por par · los solapamientos **por código además de por ruta** · qué se
  puede medir hoy sin sellar · y qué espera decisión de Asav, con la decisión
  concreta. **No propone por dónde empezar**, a propósito.
- **Regla nueva en §0: toda cifra lleva su fecha de medición.** Salió de que §5
  decía **330** y la bitácora de este mismo documento, el reporte final y la tabla
  de sensores decían **335**. Ninguna estaba mal cuando se escribió; ninguna decía
  cuándo. Es la regla 18 —el eje es parte del resultado— aplicada al eje que más
  barato se olvida.
- **Todo remedido contra producción con `jtel_readonly`**, comprobado de solo
  lectura ese día. **Cero escrituras, cero sellos, cero re-verificaciones.**
- 🟢 **C14 queda cerrado como argumento:** los **48 ruta-turnos** de los dos
  contratos reales **tienen KML activo**, así que `!hasKml` —lo único que apaga
  A∧B— **no se dispara nunca**, y `destino_only` está **inerte para todos**.
- 🟢 **C18 deja de ser «medido en un día»:** el empalme aparece en **18 de 28 días
  del Campus**, con hasta 3 rutas por unidad. **Es rutinario.** ⚠ En Planta 47 sale
  0 de 7 días, y eso **no dice que ahí no pase**: dice que ahí casi nada acredita,
  que es C11. Era una de las cuatro cosas sin explicar del reporte final.
- 🟢 **C3 cambió de tamaño y el número viejo era un promedio mentiroso.** El
  archivador va hoy a **6 minutos** (mediana 0.10 h, p95 0.18 h), no a 7 horas: por
  semana fue **22.13 h** la del 6 de julio y **0.10 h** de la del 13 en adelante.
  El mecanismo sigue intacto —nada retrasa el primer intento— pero **la presión se
  fue**. Los intentos por servicio bajaron de 206 a **38.7**.
- 🟢 **C2 dejó de crecer:** las 374 filas sin referencia son **todas** de la semana
  del 27 de julio, y la del 3 de agosto agregó una **con** su referencia. Es una
  cicatriz de una tanda, no una hemorragia. 371 de las 374 son de `actor_kind:
  human`.
- 🟢 **C5 deja de estar bloqueado por datos.** `route_traversal_measurements` tiene
  192 filas y **48 de 48 ruta-turnos llegan a las 3 muestras**. Este plan decía «no
  es trabajo, es tiempo»; el tiempo ya pasó. ⚠ 102 de las 192 topan con el borde de
  la ventana, así que el percentil sale sesgado hacia abajo.
- 🟢 **C16 era más grande de lo escrito: difieren dieciséis de 24 campos**, no seis
  — y **siete existen solo en Planta 47**, incluido **`timeZone`**, que es el campo
  del que salió D1. `kmlOriginToleranceFraction` ya no difiere.
- 🟢 **C13 tiene la prueba limpia de su propio mecanismo:** los 61
  `llegada_sin_atribucion` de Planta 47 caen el 9, 10 y 31 de julio y el 3, 4 y 5
  de agosto, y **cero entre el 13 y el 30** — exactamente su ventana de `kml_full`.
  El mismo fallo, dos nombres, según una perilla. Y `contract_policy_history` sigue
  en **cero filas** aunque el contrato del Campus **se editó ese mismo día**.
- 🟢 **C4 gana la mitad que importaba:** las 546 divergencias son **todas** de
  Planta 47, y **420 ya tienen hecho sellado** — 43 % de los hechos reales cargan
  una geocerca que no es contra la que se les juzgó.
- **Cifras que se movieron y quedan fechadas:** pendientes **106** (89 de más de
  48 h, contra los 71 que citaba D3) · C13 **341** · C10 **11.0 % contra 53.9 %** ·
  C1 **84**, último sellado el 3 de agosto, llave cerrada · C9 **0 de 973** hechos
  con nombre de chofer congelado.
- **Y una trampa de nombres, para que nadie sume dos cosas:** hay **dos turnos
  distintos llamados «Turno B»**, uno a las 15:30 y otro a las 18:00.
- **§5.6 nuevo:** qué coloca cerrar este tramo — los cinco frentes que hoy están
  escritos y sin lugar, y qué dato de la ficha alimenta a cada uno.

**6 de agosto de 2026 (lo que el tramo dejó fuera de §5).**
Cuatro cosas salieron de la ficha y se colocaron donde mandan, porque como nota de
§5 no obligan a nadie:
- **Regla del nudo, en el Tramo 3.** El solapamiento de `servedRoute` deja de ser
  un hallazgo y pasa a ser ley del tramo que arregla: **nunca dos términos de esa
  expresión en el mismo PR.** «Una causa por PR» era más flojo de lo necesario —
  no basta con nombrar una causa, hay que **tocar un solo término**, y C16 y C19
  pueden caer las dos en el mismo. Con su corolario: `shapeOk` está fuera de la
  expresión, así que **compartir archivo no es compartir el nudo**.
- **Tercer caso de la regla del eje (la 15).** El «~7 h» del archivador era el
  **promedio de un periodo roto con periodos sanos** —22.13 h una semana, 0.10 h
  las demás— y **no describía ningún momento que haya existido**. Se distingue de
  los dos casos anteriores: ahí el eje era el nivel de agregación; aquí es que el
  periodo abarcaba **un cambio de régimen**. La pregunta que lo atrapa: *¿esto
  describe un estado, o el promedio de dos?*
- **El caso de C13, y es nuestro.** El contrato del Campus se editó el 6 de agosto
  a las 09:14 **sin dejar una fila** en `contract_policy_history` — y lo editamos
  nosotros, con el guion de `kmlOriginToleranceFraction`, **sabiendo que C13
  existe y que esa tabla es su arreglo**. Es la regla 14 aplicada a la auditoría:
  **ni quien conoce el problema deja historia mientras dejarla sea opcional.**
- **C18 gana su advertencia antes de tiempo:** `permitirConsolidacion` ya existe y
  **ponerla en `true` no arregla C18** — solo apaga el pase de exclusividad, o sea
  **deja de castigar el empalme** sin hacer que el árbitro evalúe contra el
  conjunto de rutas. Queda escrito ahora para que no se confunda cuando llegue.

**6 de agosto de 2026 (D2 — cuál de los dos «Turno B», y C20).**
- 🟢 **Los dos son de Tecma**, mismo carrier, **contratos distintos**: el de las
  **15:30** es de `Tecma 47` (planta Planta 47); el de las **18:00**, del
  `Campus Santos Dumont` (grupo de plantas). **No cruza cuentas — cruza contratos
  dentro de una.**
- 🟢 **Los 36 son 100 % de Planta 47**, y no están mezclados. En la ventana original
  (hasta el 28 jul): Planta 47 · Turno B va **84 de 84 fallos, cero cumplidos**, con
  las seis rutas `- B` en **14 y 14** cada una; el Campus · Turno B va 32 fallos de
  70 y **38 cumplidos**. El «36» era 6 rutas × 6 días; la serie completa da 6 × 14.
- ⚠ **Corrección de método, y queda escrita porque casi cuesta la conversación:** la
  primera lectura tomó la hora límite con `min()` —**la más vieja de la serie**— y la
  presentó como el estado de hoy. **Son tres regímenes:** 11:45 (9–28 jul, ventana
  10:45–12:30) · 17:45 (29 jul–28 ago, **16:45–18:30**) · 15:15 (31 ago–4 sep,
  **12:59–16:00**). La «brecha de 3 h 45» que se reportó **no existe como estado
  simultáneo**: era comparar el turno de hoy contra la hora límite de julio. Es la
  regla del eje otra vez, ahora en la forma más tonta — **un agregado que elige un
  extremo y se lee como el valor vigente.**
- 🟢 **La premisa de D2 era correcta para julio:** 17:45 con ventana 16:45–18:30 es
  «declarado 18:00». **Lo que pasó es que alguien ya movió el turno a 15:30**, y lo
  generado desde el 1 de agosto deriva bien.
- 🔵🟢 **Y eso cambia de qué se trata la conversación.** `DESPUES.md` midió que estas
  rutas se recorren **~14:00**, que **no cae en 10:45–12:30 ni en 16:45–18:30** y sí
  cae en **12:59–16:00**. Es la primera ventana que contiene la operación — **pero
  arranca el 31 de agosto**, así que **102 ocurrencias** se juzgarán antes con la
  ventana vieja. En lo ya sellado van **cero cumplidos de 120**.
- 🟡 **Sin probar:** si el 11:45 salió de la zona horaria (D1). El hueco contra 17:45
  es de **seis horas exactas**, que es la forma de ese defecto, y no hace falta
  probarlo para tener la conversación.

**6 de agosto de 2026 (C21 — el régimen congelado, y los 294 con nombre).**
- **Causa nueva, y son veintiuna. C21: un cambio de turno no alcanza a lo ya
  generado.** El cron congela la hora límite al crear la ocurrencia y **nada la
  revisa** cuando el turno o la política cambian. 🟢 **555 de 2 029 ocurrencias
  (27 %) llevan una hora límite que su perfil ya no produce, en 26 de 48 perfiles.**
- **Cuatro poblaciones, y no son el mismo defecto** — que es la razón de que esto
  sea causa y no una nota de D1: 210 selladas del Turno A a **+6 h** · 84 selladas
  del Turno B a **+6 h** · 36 selladas y 102 sin sellar del Turno B que **eran
  correctas al generarse** y quedaron viejas cuando el turno se movió · 118 selladas
  y 5 sin sellar del Campus a **5 minutos**, forma de un cambio de política.
- 🟢 **D1 deja de ser un número: las 294 tienen población identificada.** Comparadas
  ocurrencia por ocurrencia con `clasificarDiferencia` —el clasificador del guion de
  corrección— **sin su filtro `expected_deadline > now()`**, que es lo que le impide
  ver las selladas: **210 del Turno A + 84 del Turno B = 294**, las dos poblaciones
  exactamente **seis horas** corridas.
- ⚠ **Y queda escrito qué NO son.** El clasificador corrido entero da **330**
  selladas con causa `zona`; los **36** de más son del Turno B a las 17:45, que eran
  correctas cuando se generaron. **Ésas son C21, no D1**, y el clasificador no las
  distingue porque compara contra el turno de **hoy**.
- ⚠ **Aviso de lectura: este 330 no es el 330 de C13.** Aquél era `no_cumplido` con
  una unidad que sí llegó, y hoy son 341. **Mismo número, dos poblaciones sin
  relación** — C20 aplicada a las cifras en vez de a los nombres.
- 🟢 **El 31 de agosto no lo eligió nadie.** `renewRollingWindow(30)` genera desde
  `max(service_date) + 1` a 30 días; la última corrida con 17:45 fue la del 29 de
  julio (llegó al 28 de agosto), la primera con 15:15 la del 1 de agosto (llegó al
  31), y el 29–30 es fin de semana. 🟡 El turno cambió entre esas dos corridas y **no
  se puede precisar más: `shifts` no tiene `updated_at`.**
- 🟢 **Las 102 son 6 de hoy y 96 futuras; cero sin sellar en el pasado.** Y **la hora
  límite no es inmutable**: el guion la corrige **en sitio**, y las 102 cumplen sus
  cuatro guardas. Queda escrito como **capacidad, no como recomendación**.

**6 de agosto de 2026 (decisión sobre las 102, y lo que el simulacro destapó).**
- ✅ **Asav decide: se corrigen las 96 futuras del Turno B de Planta 47; las 5 del
  Campus no se tocan.** Las razones quedan escritas en §3.2, D2: ninguna de las 96
  está sellada, así que no se reescribe ningún hecho, y **sellar 96 acusaciones que
  se saben falsas es peor que corregir 96 ocurrencias que nadie ha visto**. Las 5
  del Campus son una política que cambió cinco minutos: **corregirlas sería
  reescribir una decisión, no un error.**
- 🟢 **Simulacro corrido con la credencial de solo lectura en `DATABASE_URL`**, para
  que no pudiera escribir ni por error: **102 por `zona`, 5 por `deriva` fuera sin
  bandera, cero bloqueadas.**
- ⚠ **Y destapó dos cosas que la decisión no tenía enfrente.** **(1)** El guion no
  sabe elegir 96 en vez de 102: su único filtro es `expected_deadline > now()`, y a
  las 06:13 locales las 6 de hoy **todavía no vencen** —lo hacen a las 17:45— así
  que las incluiría. Elegir por decisión y no por reloj solo es posible con `--sql`
  quitando esas seis del `VALUES`. **(2)** **La ventana que escribe el guion no es
  la que escribe el generador:** `computeEvidenceWindow` deriva por ruta cuando
  recibe su tercer argumento, el generador se lo pasa y el guion no. El guion
  escribiría **14:15 fijo**; el generador produjo **12:59–13:59** según la ruta. De
  las 30 del régimen nuevo, **25 contienen las 14:00**; corregidas por el guion,
  **ninguna las contendría** — arrancarían quince minutos tarde.
- 🟢 **Y una confirmación independiente de D1 que apareció leyendo ese código:** el
  comentario de `repositories/index.ts:2168` dice que esas seis horas *«produjeron
  **294 hechos sellados** a la hora equivocada, **con un solo cumplido** entre
  todos»*. Coincide con lo medido: 210 del Turno A —que tiene exactamente **1**
  cumplido— más 84 del Turno B con cero. **El código y la base dicen lo mismo.**
- ⚠ **Queda abierto antes de aplicar:** corregir con el guion mueve la hora límite
  bien y **deja la ventana quince minutos tarde**.

**7 de agosto de 2026 (las 90 corregidas — el caso, no la razón).**
- ✅ **Aplicado contra producción:** **90 ocurrencias y 90 viajes** del Turno B de
  Planta 47. 🟢 **Cero hechos sellados movidos** —1 153 antes y después— y **cero
  hechos con `expected_deadline` distinto al de su ocurrencia**. Ninguna bloqueada.
- 🟢 **Las 90 quedaron con ventana que contiene las 15:00**, el pico medido sobre
  catorce días. Y **derivada por ruta**, que es lo que el arreglo del guion
  perseguía: *Juarez Nuevo* abre 13:47, *Huertas* 13:48, *San José Auxiliar* 13:56;
  las otras tres quedan en el piso de 60 min de la política.
- 🟢 **El régimen bueno ya no arranca el 31 de agosto: arranca el 10.**
- ⚠ **Eran 96 y se corrigieron 90.** **Doce se sellaron mal esperando**: seis por
  decisión de Asav —asumidas— y **seis porque GitHub Actions estuvo caído dos días**
  y no se pudo mergear el arreglo. **Entre descubrir un defecto y arreglarlo, el
  sistema sigue sellando.**
- ⚠ **Y esto arregló el caso, no la razón. C21 sigue viva:** nada revisa la hora
  límite de lo ya generado cuando el turno cambia. Si mañana se mueve otro turno,
  **vuelve a pasar igual y nadie se entera hasta que alguien investigue.**
- 🟢 **Quedan 465 con hora límite que su perfil ya no produce, y las 465 están
  selladas** — cero sin sellar. 210 del Turno A y 84 del Turno B son **D1**; 123 del
  Campus son una política que cambió cinco minutos; 48 del Turno B **eran correctas
  al generarse**. Moverlas ya no es corregir: es re-verificar, y eso es D1/D4.
- **El precio de C21, que antes no tenía:** no es el defecto, **es su latencia** —
  y se paga en acusaciones que ya no se pueden deshacer sin re-verificar.

**7 de agosto de 2026 (la UI medida, y una contradicción del propio plan).**
- ⚠ **Este plan decía «el frente visual está cerrado». Era falso**, y al mismo
  tiempo `Analisis-Que-Falta-UI.md` decía «36 pantallas nunca se diseñaron». Dos
  documentos vivos, opuestos, y ninguno medible sin volver a contar.
- 🟢 **El número medido: 69 rutas, 36 con ficha de diseño, 33 sin.** Por cara —
  cliente 41 (28/13) · carrier 15 (8/7) · **J-Staff 9, ninguna con ficha** ·
  públicas 4, ninguna. §8 corregida con esto.
- **El análisis viejo queda SUPERADO, no borrado.** Medía 48 rutas contra
  `7c5a471` del 1 de agosto, con `main` 140 commits adelante, y **nunca contó
  J-Staff ni las públicas**. Su §4 sigue siendo el mejor mapa del diseño que falta.
- 🟢 **Y ahora el conteo se rehace solo:** las trece fichas de pantalla declaran su
  ruta en el encabezado, entre acentos graves. Antes había que leerlas e
  interpretar — por eso el número envejeció sin que nadie lo notara.
- ⚠ **Dos trampas del mapeo, escritas donde se ven:** `Ficha-Oficina-Contrato`
  declaraba `cliente/*/configuracion`, que **deja fuera el alcance corporativo** —
  cinco rutas parecían sin ficha teniéndola. Y `Ficha-Choferes` declara una ruta
  **que todavía no existe**: una ficha sin pantalla, el hueco al revés.
- 🟢 **El hallazgo del conteo: J-Staff son nueve rutas y ninguna tiene ficha.** Es
  **la cara desde la que Asav opera el producto, la que usa todos los días, y es la
  única sin una sola decisión de diseño tomada.**
- **Y la lección del mapeo, con sus dos trampas:** una ficha declaraba una ruta
  **parcial** —el comodín dejaba fuera el alcance corporativo, cinco rutas parecían
  sin ficha— y otra declara una ruta **que no existe**. **Una declaración que nadie
  comprueba contra la realidad se degrada en las dos direcciones**, y ninguna de
  las dos se ve mal al leerla.
- **Frente nuevo: el diseño no alcanza a la construcción.** 🟢 Ocho rutas nuevas
  contra cuatro fichas nuevas en seis días. **No es un saldo, es una tasa** — la
  deuda crece sola. Y es la explicación más simple de la retroalimentación de
  fuera: **una pantalla sin ficha no es fea, es una pantalla sin decisión de
  navegación tomada.**
- ⚠ **Consecuencia para el Tramo 5, que el plan daba por resuelta:** está
  dimensionado como trabajo de piel sobre pantallas ya diseñadas, y **no lo es para
  la mitad del producto**.
- **Por qué el documento viejo envejeció aunque traía su commit:** la fecha estaba
  en la segunda línea y **el número alarmante viajaba solo**. Una cifra fechada en
  el documento y sin fecha en la boca de quien la repite envejece igual.

**6 de agosto de 2026 (las dos rojas, y lo que una de ellas escondía).**
- ⚠ **La del calendario no estaba roja: se rompió corriéndola mal.** `npx vitest`
  en vez del comando sancionado, que fija `TZ=UTC`; la máquina está en
  `America/Ciudad_Juarez`. Con el comando correcto, **25 de 25 pasan**. Y la
  «verificación contra `main`» repitió el mismo error, así que **no verificó
  nada**. → **Regla 17.**
- 🟢 **La de `apps/web` sí era real, y tapaba un defecto que importa.** El
  sembrador del escenario elegía el contrato de A con **`LIMIT 1` sin `ORDER
  BY`** —el mismo patrón que el `[0]` de `resolveAccountByType` del #222— y
  escribía el de B con **`onConflictDoNothing` sobre un id fijo**, así que B
  quedaba clavado al cliente de la primera corrida. **Los dos carriers dejaban de
  compartir cliente.**
- **Por qué pesaba más que el frente entero:** el plan cita ese escenario como la
  evidencia de que `/carrier` no filtra («los seis caminos niegan», #225). Con
  clientes distintos, esas seis pruebas pasan por una razón más débil — **la pared
  que se mide es la del cliente, no la del carrier**. Lo único que lo notaba era
  la auto-comprobación del propio archivo, y se queda como está.
- ✅ **Arreglado:** orden explícito para elegir el contrato de A, y
  `onConflictDoUpdate` para que el contrato y el perfil de B **converjan**.
  **Sembrar tiene que dejar la base en el estado pedido, no «en el estado pedido
  si estaba vacía».** Comprobado con dos corridas seguidas: 16/16 las dos veces.
- **Frente nuevo: las pruebas de integración en CI.** Las cinco cosas que cuesta,
  en orden, con el bloqueo previo escrito —**no se enciende con pruebas rojas
  dentro**— y con el caso §D: el verde afirma «las pruebas pasan» y midió «las
  unitarias pasan».
- **El check pasa a llamarse `pruebas unitarias`**, y el cambio **no es libre**:
  el ruleset lo exige por nombre. El orden que no deja hueco es agregar el nombre
  nuevo al ruleset, renombrar el job, y quitar el viejo.

**6 de agosto de 2026 (el vigilante mudo y el frente del proveedor).**
- 🟢 **El vigilante de salud nunca ha funcionado: 117 corridas desde el 28 de julio,
  cero éxitos.** No es una regresión — nació roto.
- **Son dos fallos apilados. (1)** `/api/salud` responde **503** de verdad: cuatro
  chequeos sanos y **`verificacion` enfermo** — «6 servicios vencidos hace más de
  2 h SIN veredicto, el más viejo hace **49.8 h**». **(2)** El paso que abre el aviso
  revienta con `fatal: not a git repository`: el workflow **no hace `checkout`** y
  `gh` no puede deducir el repositorio. **Cero issues creados en nueve días**, y como
  ese paso sale con código 1, **el `::error::` final tampoco se emite**.
- **Lo que queda es una corrida roja en una pestaña que nadie mira.** Y el detalle
  que lo vuelve exacto: este vigilante existe porque un heartbeat que vivía dentro
  de Vercel cayó con lo que vigilaba y **nadie se enteró en 13 horas**. El reemplazo
  lleva **nueve días** mudo. **Se probó que detecta; no que avisa.** Regla 8 sobre el
  instrumento, tercera vez.
- **Frente nuevo: independencia del proveedor de GPS.** 🟢 El código nombra a uno
  concreto en cuatro capas —paquete `gps-umbrella`, columnas `umbrella_*`, variables
  `UMBRELLA_GPS_*` y el nombre impreso en una pantalla del carrier—. **Sin diseñar.**
  Lo único que fija hoy es el orden: **abstraer primero, conectar después**, porque
  construir el puente sobre esta base deja **dos casos especiales cosidos** y hace
  que el tercer proveedor vuelva a ser obra.
- **Cuarto caso de la regla del eje, y costó una ejecución detenida:** una alarma
  apoyada en una cifra de `DESPUES.md` medida **un solo día**. **Una medición vieja
  del propio repo es tan peligrosa como una mal hecha, y más — viene con sello de
  casa.**

**6 de agosto de 2026 (el guion arreglado, y la corrección que lo desbloquea).**
- **No se ejecutó nada.** Asav paró la corrección al ver que el guion escribía su
  propia ventana en vez de la del generador. **Se arregló el guion primero** (#258).
- 🟢 **`ventanaCorregida` llama a `windowForOccurrence` con la política completa y el
  dimensionado por ruta.** **La valla es el compilador**, no una prueba: el
  parámetro pide `ContractPolicy` completa —no `Partial`— y el dimensionado es
  obligatorio. **Comprobado por mutación en los dos sentidos:** aflojar el tipo a
  `Partial` rompe `tsc`; volver a la llamada vieja **mata 3 de las 14 pruebas**.
- ⚠ **Y una corrección mía que frenó una ejecución, dicha completa.** La alarma de
  «quince minutos tarde» se apoyaba en que la operación pica a las **14:00** — dato
  de `DESPUES.md`, medido **un solo día**. 🟢 Remedido del 23 de julio al 6 de agosto,
  días hábiles, las seis rutas contra la telemetría cruda: **las seis pican a las
  15:00**, y las 14:00 son secundarias en cuatro. **La ventana vieja se queda con el
  10–15 % de la actividad; la nueva con el 32–44 %.**
- 🟢 **La respuesta a lo que condicionaba la corrección: 126 de 126 ventanas
  corregidas contienen las 15:00.** La corrección **sí** resuelve el problema que la
  motivó.
- 🟢 **Y el detalle honesto del arreglo:** cambia la ventana de **dos** rutas, no de
  las seis — en cuatro, la derivación queda por debajo del piso de 60 min de la
  política. Importa porque el guion **deja de inventar su ventana**, no porque mueva
  las seis.
- **El error no fue el dato: fue apoyar una alarma en una medición de un día
  teniendo catorce.** Es la regla 18 otra vez, con el eje del tiempo.
- ✅ **Decidido: las 6 de hoy se dejan correr y se van a sellar mal.** Son 6 contra
  96, y **correr una herramienta que se sabe rota para ganarle al reloj es peor que
  perder seis.**
- 🟢 **D1 queda cerrada desde dos lados.** El comentario de
  `repositories/index.ts:2168` dice «294 hechos sellados a la hora equivocada, con un
  solo cumplido entre todos»; la base da 210 del Turno A —con exactamente 1
  cumplido— más 84 del Turno B con cero. **Ninguno se deriva del otro.**

**6 de agosto de 2026 (dos errores de método propios).**
- **La resta que no cruza medianoche.** Se midió el desfase con `::time`, que no
  envuelve, así que `23:45 → 05:45` dio **18 h** y la consulta contestó **«0 hechos
  con desfase de 6 h»** — que se lee como hipótesis refutada cuando lo roto era la
  resta. Queda como segundo caso del instrumento en la **regla 8**: **un cero es una
  afirmación**, y hay que poder distinguir «medí y no hay» de «mi medidor no puede
  verlo».
- **C20 mordió a la medición que la descubrió.** Tres horas después de escribirla, el
  conteo de perfiles dio **48 por id y 47 por nombre**: dos perfiles distintos
  comparten nombre y agrupar por nombre los colapsó. **Quien escribió la causa cayó
  en ella el mismo día.** Queda dentro de C20, porque el caso vale más que la regla.

**6 de agosto de 2026 (C20 — la causa de nombre).**
- **Causa nueva, y son veinte.** **Dos cosas distintas con el mismo nombre, y el
  conteo las suma sin avisar.** 🟢 «Turno B» es el **único** nombre de turno repetido
  en toda la base, y los dos viven en la misma cuenta cliente. 🟢 Dentro del contrato
  del Campus hay además **ocho nombres de ruta repetidos** — `Km 30` y `Oasis` tres
  veces, otros seis dos veces.
- **Es causa de NOMBRE, no de dato**, y por eso entra aparte: cada fila es correcta y
  el conteo también; **lo falso lo pone la etiqueta que las junta.** Misma familia
  que **C15** —el campo `imei:` que guarda un id de unidad—: ninguna mueve un
  veredicto y las dos cambian lo que el documento dice.
- **Y no es hipotética: ya cobró.** D2 se abrió describiendo el Turno B del Campus
  mientras hablaba del de Planta 47 — y el del Campus es el **sano** de los dos.
- 🔵 **Es el caso 6 de §D del Marco visto desde el otro lado.** Allá («Rutas del
  alcance: 27») el lector no podía reconstruir el número con lo que tenía debajo;
  aquí el problema es anterior: **quien agrupa por el nombre ya sumó dos cosas antes
  de que nadie lea nada.**

**5 de agosto de 2026 (los sensores).**
- **Frente nuevo: los sensores.** Dos piezas que van juntas — un **tablero en
  J-Staff** con seis sensores por cuenta y por unidad, y que **el hecho sellado
  cargue su densidad de evidencia**. **Sin diseñar**, al cerrar el Tramo 2.
- **La fecha es el argumento:** el 29 de julio la cadencia cambió, la cobertura
  saltó de 5–7 a 9.9 de 10, **no fue nuestro y nadie se enteró**. Lo supimos
  investigando otra cosa, once días después.
- **Cada sensor entra con el caso que lo pide**, no como buena idea: la cadencia
  habría avisado del 29; el retraso del archivador ya costó 28 servicios; la
  salud del trazado existe porque **tener KML o no decide más que el contrato**;
  y el contador de observación contra conducta, porque hay 335 acusaciones con
  una unidad que sí llegó.
- **Y la ley del tablero queda escrita antes de dibujarlo:** es instrumento, no
  juicio. **Azules y grises, nunca los colores del veredicto** — verde sigue
  siendo cumplido y nada más. Ver la cadencia para entender, sí; ajustar umbrales
  hasta que la operación pase, no.
- **La pieza 2 entra además a la tabla del Tramo 4**, que es donde vive «el hecho
  debe bastarse a sí mismo».

**5 de agosto de 2026 (cierre de la investigación).**
- **C19, y va arriba de la lista: la cobertura depende de la densidad del
  muestreo, no de la conducta.** Mismos aparatos, mismas unidades, mismas rutas
  — **1.5× más puntos por aparato** y la cobertura salta de 5–7 a 9.9 de 10.
  **La calificación de un transportista puede subir o bajar sin que él haga nada
  distinto.**
- 🟢 **Y no fue nuestro:** ningún commit toca el archivador, el ingestor,
  `gps-umbrella` ni la cadencia de los crons entre el 24 de julio y el 3 de
  agosto. Lo último antes del 29 es del **16 de julio**. 🟡 Fue del proveedor o de
  los dispositivos, **y puede repetirse sin avisarnos.**
- **El cabo suelto del sesgo direccional queda cerrado, y era mío.** Adelgazando
  un día bueno hasta la densidad de un día partido, **el sesgo reaparece con el
  mismo rumbo** (0.19 a 119° ESE con 1 de cada 60; 0.28 a 114° con 1 de cada
  120). **Es artefacto de pocos puntos**, no corrimiento de coordenadas. Mi
  lectura de «apunta al trazado» estaba mal.
- **Reporte final escrito:** causas por cuánto explican, doce hipótesis
  descartadas con su medición, cuatro cosas sin explicar, y las cinco reglas que
  dejó. **No propone orden de arreglo.**
- 🟢 **Tres conclusiones de esta investigación fueron falsas y las atrapó el grupo
  de control, no una prueba.** Ninguna se habría atrapado leyendo el código con
  más cuidado.

**5 de agosto de 2026 (el vector).**
- **Hay sesgo direccional, y solo en Planta 47 y solo en los tres días
  partidos:** razón 0.24 · 0.40 · 0.36, con dos rumbos casi idénticos (116° y
  117° ESE). En los días buenos **desaparece: 0.03 y 0.02**.
- **Pero no es un desplazamiento rígido** —eso daría razón cercana a 1— y **el
  Campus no lo tiene** (0.07–0.13 contra 0.03–0.04). 🟡 **Por el criterio de
  Asav, apunta al lado del trazado y no al proveedor.**
- **Una corrección de método a mitad de camino:** la primera corrida promedió los
  puntos de los 52 autobuses contra cada trazado, casi todos en otras rutas, y
  dio ~1 000 m **incluso el día en que los puntos caen encima**. **Un número
  imposible delató la pregunta mal acotada** — y el control fue, otra vez, el que
  lo atrapó.
- **Los tres son lunes, pero el 3 de agosto también y tuvo 9.9 de 10.** No es
  «los lunes»: son esos tres.
- **Y lo que sí cambió con fecha: el volumen de evidencia de Planta 47 se duplica
  a partir del 29 de julio** —de 60–68 k a 86–108 k puntos/día— **con el mismo
  conjunto de aparatos** (53 en los dos periodos, 50–53 por día, estable). **El
  Campus no se mueve.** 🟡 Cambió la densidad de muestreo, no la flota, y coincide
  con el salto de cobertura de 5–7 a 9.9 de 10.
- **Anotada en C18 la consecuencia de planteamiento:** el árbitro tiene que poder
  evaluar una unidad contra el **conjunto** de rutas que sirvió en el turno.
  Preguntar «¿cubriste la ruta A?» a un camión que sirvió A y B **está mal hecha
  la pregunta, y ningún umbral la arregla.**

**5 de agosto de 2026 (el empalme).**
- **La pista de la versión de trazado NO cierra la investigación.** Hay una sola
  versión por ruta, vigente desde el 14 de julio, y cada ocurrencia apunta a la
  de su propia ruta. El 20 y el 27 usan la correcta y aun así quedaron en 0.3.
  **C4 por versión queda descartada para esos días.**
- **C18 — el empalme existe y está medido.** El 29 de julio, tres unidades
  cubren dos trazados cada una; una de ellas al **79 % y 76 %**. Es la hipótesis
  de Asav, que viene de conocer la operación: consolidar rutas cuando falta
  unidad o falta gente. **El sistema no tiene forma de saberlo** — cada servicio
  la evalúa contra su propia ruta.
- **Y se descarta como causa de los tres días partidos:** ahí **la unidad típica
  no toca ninguna ruta al 30 %**.
- **Lo que sí caracteriza esos tres días, y es nuevo:** tienen evidencia de sobra
  —41 k, 26 k y 77 k puntos— y **ningún punto se acerca a menos de ~160 metros
  del trazado**. El 29 de julio los puntos caen **encima** (0.00 km) y la mejor
  cobertura es 88.6 % contra 2.2–2.8 %.
- 🟡 **Un piso consistente de 0.16 km en tres días y decenas de miles de puntos no
  se parece a «tomó otra calle»: se parece a un desplazamiento sistemático.** Y
  160 m cae justo afuera de los dos corredores. **La siguiente medición:** si ese
  desplazamiento tiene dirección constante.

**5 de agosto de 2026 (el patrón).**
- **Regla 15 (antes 13):** una medición agregada puede confirmar lo que la medición por caso
  desmiente. El eje es parte del resultado.
- **La hipótesis de la variante diaria queda descartada.** 300 servicios-día: **0
  tramos siempre recorridos, 0 nunca, 150 de 150 a veces**. No hay ramal
  condicional ni tramo muerto. **No depende del día de la semana** en ninguna de
  las 15 rutas. Y hay **exactamente una variante declarada por ruta**, así que no
  hay catálogo con el que comparar.
- **Y el trazado no está mal: en 8 de las 15 rutas el patrón más común es el
  trazado COMPLETO.** *Centro - A* lo cubre entero 16 de 20 días.
- **Lo que sí tiene forma es el calendario.** Desde el **29 de julio** el trazado
  se cubre entero **todos los días** —9.7 a 10.0 de 10, siete días seguidos—. La
  partialidad era un fenómeno **con fecha**, del 9 al 28 de julio.
- **Y tres días rompen la explicación fácil:** 13, 20 y 27 de julio con ~0.3
  tramos y volumen de puntos **normal** — el 27 con **5 166 puntos por viaje** y
  cobertura casi cero. **No es falta de evidencia: es evidencia que no coincide
  con el trazado.** La correlación puntos↔tramos es 0.506; explica parte y no el
  todo.
- **La siguiente pregunta, concreta y sin medir:** qué versión de trazado tenía
  cada ocurrencia del 13, 20 y 27 de julio, y si es la misma contra la que se
  sellaron sus hechos. Huele a C4.

**5 de agosto de 2026 (la autopsia del #245).**
- **Reglas 10, 11 y 12**, las tres del mismo PR y las tres sobre instrumentos
  que dieron verde sin haber medido: la salida silenciada, la edición que no
  encontró su patrón, y la suite que no typechequea.
- **Es la regla 8 aplicada a las herramientas, dos veces en el mismo PR.** Un
  check descartado y una edición silenciosa **no se distinguen de su ausencia**,
  que es exactamente lo que esa regla nombra.

**5 de agosto de 2026 (los viajes).**
- **C17 arreglado en el motor.** El ledger guarda ahora `routeMatchPct` —la que
  decide— y `routeMatchPlainPct` —la llana—. **No mueve un solo veredicto**, y
  hay una prueba que lo fija para que no pueda convertirse en uno. Comprobado por
  mutación: no escribir la llana pone 1 en rojo; hacer que la llana **sea** la
  ponderada, otro.
- **Cinco viajes, contados uno por uno.** Los cinco del Turno A del 9 de julio
  **llegaron antes de la hora límite** —05:17, 05:17, 05:19, 05:36, 05:41 contra
  un límite de 05:45—, los cinco recorrieron **más kilómetros que su trazado**, y
  los cinco **siguieron manejando después de llegar**: la ventana cierra ~45 min
  después.
- **Y uno de los cinco tira la explicación fácil.** *Finca - A* **nunca se alejó
  700 metros del trazado**, tuvo **87.6 % de precisión de corredor** y llegó
  **veintiséis minutos antes** — y está en `pendiente_evidencia` porque su
  cobertura es **27 %**. La vuelta explica a los otros; a éste no.
- **La pregunta que queda:** el trazado contratado mide 27.9 km y esa unidad
  recorrió del kilómetro 2 al 16. **¿El trazado describe un viaje, o el recorrido
  completo de una ruta que se sirve en tramos?** No está medido, y es la primera
  del frente de C14.
- **`kmlOriginToleranceFraction` para el Campus:** guion escrito, **en seco por
  omisión**, corrido y verificado — escribiría `0.15` en un contrato, **sin
  cambiar comportamiento** y sin tocar un hecho sellado. **No se ejecutó.**

**5 de agosto de 2026 (cierre 2).**
- **C17 — la cobertura de ruta se guarda ponderada y se lee llana.** 168
  candidatas acreditan ≥ 60 % teniendo una cobertura real con mediana de 3.9 %.
  La ponderación no está mal por existir; está mal guardarla con un nombre que
  se lee como porcentaje llano. **Corregirlo no rescata servicios** —9 en vez de
  11—: quita la ilusión de que 27 candidatas cubrían la ruta.
- **Y contesta la sospecha de Asav: sí se desacoplan.** La correlación entre
  cobertura y precisión pasa de **0.373 ponderada a 0.672 sin ponderar**.
- **El campo huérfano tiene nombre:** `kmlOriginToleranceFraction`, ausente en el
  Campus, con valor de fábrica **0.15** — el mismo que Planta 47 tiene escrito,
  así que **hoy no hay divergencia de comportamiento**, solo de procedencia. El
  día que alguien cambie el valor de fábrica, el Campus cambia de regla sin que
  nadie toque su contrato.
- **Las dos perillas se nombran por separado de aquí en adelante:** «cobertura de
  ruta» —cuánto de la ruta recorrió— y «precisión de corredor» —qué tan pegada
  fue—. Se confunden con facilidad.
- **El frente del alcance fino pasa de «no se puede medir» a «ya casi».**
  `tecma_planta47` sin poder ver su cara es 1.h volviéndose una pantalla en
  blanco, y con T6 habrá dos alcances distintos y una negativa que comprobar.
- **Letrero de calibración en «Tu operación medida»** (#243): el rango sirve para
  entender dónde cae la operación, no para ajustarlo hasta que pase.

**5 de agosto de 2026 (cierre).**
- **La ventana de evidencia tampoco era.** El motor recibe todos los puntos del
  viaje sin filtro —`getPointsForTrip`, la ventana solo mide cobertura— pero ese
  conjunto abarca **76 minutos de mediana** contra una ruta de 60+5. **No es la
  jornada.** Recortarlo a la ventana descarta el **1 %** de los puntos y rescata
  **12 de 61**, casi los mismos 10 que rescataba quitar el tope de forma.
  **Las dos hipótesis —la de Asav y la mía— caen.**
- **Y queda la pregunta mejor planteada:** cada servicio evalúa **~50
  candidatas** —los autobuses del turno— y 🟢 **A está ponderada por TF-IDF**
  (`weightedIdf: true` en el ledger) mientras **B es una fracción simple**. Una
  unidad puede puntuar alto en una y bajísimo en la otra sin contradecirse. **La
  siguiente medición: recalcular A sin ponderar y ver si A y B se mueven
  juntas.** No está hecha.
- **T6 — tres identidades de prueba.** Las tres membresías del seed ya existen;
  falta ligarles Clerk. Deja **3 filas** y nada más, el nombre **se lee de Clerk
  y no se guarda nunca**, y **la cara de planta no se podrá ver hasta 1.h**.

**5 de agosto de 2026 (continuación).**
- **El landing gana por dónde entrar** (#240). No había un solo enlace a
  `/entrar` en la cara pública: se llegaba escribiendo la ruta a mano.
- **Y estuve a punto de arreglar un desbordamiento que no existía.** Chrome en
  macOS no baja de ~500 px de ventana, así que un `--window-size=390` entrega una
  página de 500 recortada en un PNG de 390. **El control —`main` a 500 px
  reales— tenía la barra perfecta.** Regla 9 del lado del instrumento.
- **El trazado SÍ corresponde, y eso mata la hipótesis.** 1 461 waypoints de las
  15 rutas del Turno A contra toda su traza real: **100 % a menos de 500 m,
  mediana 20 m**, el más solitario a 430 m. No hay un tramo contratado por el que
  nadie pase. **Hacia dónde mirar ahora: cómo se arma el conjunto de puntos de
  cada candidata**, no el KML ni los umbrales.
- **C15 — el expediente etiqueta mal su propia evidencia.** El ledger escribe
  `imei:` y guarda un id de unidad. No cambia veredictos; cambia lo que el
  expediente dice, que es el activo.
- **C16 — la configuración no coincide con lo acordado.** El corredor del Campus
  está en 50 % y Asav lo recordaba en 60 %. Seis campos difieren entre contratos
  y uno existe en uno y no en el otro. **Y con el historial de política vacío, no
  hay contra qué comparar.**
- **Dos frentes nuevos:** la puerta sin salida de `destino_only` (C14) y la app
  del coordinador de planta, **opcional siempre**.

**5 de agosto de 2026.**
- **Frente nuevo: la reconciliación del expediente.** Tres piezas —enseñar el
  trazo real en todo `no_cumplido`, la planta aprueba variante hacia adelante, el
  carrier aporta al expediente— con la Ley 5 intacta: **el carrier no cambia el
  veredicto**. `excusableReasons` ya existe y es configurable por contrato; lo
  que falta es **quién los invoca y quién los aprueba**. Se coloca al cerrar el
  Tramo 2, junto al frente del alcance fino. **Sin diseñar.**
- **Los 28 de cobertura son C3, observado.** Sellados con 13–46 puntos; hoy esos
  viajes tienen 370–1 992 del mismo día. **28 de 28.** La evidencia no faltaba:
  no había llegado.
- **La política del Campus rescataría 17 de 61 (28 %).** Explica un cuarto del
  problema, no el problema — con los umbrales más flojos que existen hoy, 44
  seguirían pendientes.
- **Y el recálculo pasó su propio control antes de contar:** 3 054 de 3 054
  candidatas reproducidas a 120 m con desviación 0.0. **El primer intento falló
  el control y por eso no se reportó** — destapó que el ledger escribe `imei:` y
  guarda un **id de unidad**.
- **Los 330 ya son 335**, y el Campus sigue produciéndolos: 5 el 5 de agosto.
  Planta 47 aparece solo del 14 al 30 de julio, la ventana exacta de `kml_full`.

- **Regla 9 de «las ganadas por las malas»:** una causa no se acredita contra los
  que fallan; se acredita contra los que pasan.
- **C14 — `routeStrictness` no gobierna lo que su nombre promete.** Se lee en un
  solo punto del motor y solo elige el nombre del fallo, no si hay fallo. **La
  perilla no protege nada:** aunque el contrato diga «basta con llegar», el motor
  necesita el KML para saber quién llegó.
- **El proveedor queda descartado como causa de la cobertura:** Umbrella entrega
  un punto cada ~1 s contra un hueco máximo de 10 min. Los 28 que fallaron
  cobertura traen 13–46 puntos y huecos de 20–40 min — **evidencia rala en esos
  servicios concretos**, no cadencia lenta del proveedor.
- **El reparto A/B es extremo, no un rozar:** cero servicios donde la MISMA
  unidad cumpla las dos; a la que cumple cobertura le faltan **53.3 puntos** de
  corredor, y a la que cumple corredor le faltan **54.1** de cobertura.
- **`contract_policy_history` está vacía en toda la base y nadie escribe en
  ella.** El cambio que decidió 330 veredictos no dejó rastro.
- **Los 330 no los ha visto nadie**, y eso queda escrito: baja la urgencia y no
  cierra la pregunta.

**4 de agosto de 2026 (continuación).**
- **C11 investigada y cerrada, y salieron dos causas nuevas.** La ficha vive en
  `marco-limpio/`. Son 100, no 71. La dominante es que **ninguna candidata
  cumple A y B a la vez** — 27 cumplen una, 26 la otra, cero las dos.
- **Y una corrección mía, dicha completa porque la primera versión de la ficha ya
  se había mergeado:** concluí que el tope de Fréchet de 0.8 km rechazaba los 57.
  **Es falso.** `shapeOk` no entra en `servedRoute` —solo ordena candidatas— y el
  grupo de control lo gritaba: **300 de los 319 servicios aprobados también
  exceden ese tope**. Medir que 0 de 57 lo fallan era el dato; «por eso los
  rechaza» era la interpretación, y no la comprobé contra los que sí pasan.
- **C10 deja de ser causa propia:** es la sombra de C11. Y **sale de D2**, porque
  los 57 son del Turno A y D2 habla del Turno B.
- **C12 — `frechetMaxKm` horneado fuera de la política.** No causa C11. Entra
  igual: es el único umbral de KML que ningún contrato puede configurar, y eso
  incumple la Ley 6. **Se arregla porque está mal, no porque convenga.**
- **C13 — el veredicto del mismo fallo lo decide `routeStrictness`.** Con
  `destino_only` es pendiente; con `kml_full` es acusación. Planta 47 cambió dos
  veces en tres semanas, y por eso las «dos semanas limpias» de la primera
  lectura no eran limpias: **75 servicios sellados `no_cumplido` en vez de
  pendientes**. Medido: **330 acusaciones de Tecma con una unidad que sí llegó**.
- **El handoff de la investigación queda archivado en `docs/handoffs/` con sus
  correcciones adentro**, no aparte. Un handoff guardado se vuelve a leer.

- **Frente nuevo: el alcance fino y quién administra dentro de él.** Sale del
  Tramo 7 y se coloca **al cerrar el Tramo 2**. Tres piezas juntas —1.h, el
  `admin_planta` con permisos de verdad, y la pantalla de altas— porque **cada
  una sin las otras dos es media pieza**: un admin de planta sin alcance fino no
  tiene sobre qué mandar, y sin pantalla de altas es un rol decorativo.
- **Y la razón de que no se empiece ya no es de agenda, es de medición.** La
  única identidad real tiene alcance `global`, así que una guardia por alcance
  **pasa siempre** contra ella y una batería de pruebas **entraría en verde sin
  probar nada**. Es lo mismo que pasó en `/carrier`: hasta que no hubo un
  **segundo** carrier en la rama desechable (#225) no se supo si las
  comprobaciones sostenían algo. Antes de escribir la guardia hace falta el
  escenario: varias plantas, un campus, y usuarios de alcance `plant` y
  `plant_group` de verdad.
- **El lugar exacto se decide al cerrar el Tramo 2**, con el dato de los 71
  pendientes de Tecma (D3) en mano.

- **Regla 8 extendida al instrumento.** Un medidor que devuelve cero cuando no
  midió nada se ve idéntico a uno que midió y encontró todo limpio. La
  corrección es la misma de los dos lados: contar también algo que **tiene** que
  estar.
- **D10 abierta y decidida: falta el rol de admin de planta.** Se declara sin
  permisos activos, como `chofer`; los permisos se definen en el Frente del
  alcance fino.
- **Y su justificación se corrigió al verificarla.** Se pidió como «evita una
  migración», y **no la evita**: `user_memberships.role` es columna de texto, no
  enum de Postgres. Lo que evita es peor — que alguien alcance
  `admin_corporativo` por ser el único admin que existe, rompiendo la regla 2 de
  D9 sin que nada lo señale.
- **Y hay un segundo motivo, que es la regla 8 aplicada a los roles:**
  `hasPermission` resuelve `ROLE_PERMISSIONS[rol] ?? []`, así que un rol **no
  declarado** se comporta igual que uno declarado **sin permisos**. Los dos
  estados son indistinguibles; declararlo es lo que hace legible la diferencia.
- **Y el precedente de `chofer` no era exacto:** la ficha lo declara «sin
  permisos activos» y el código le da `["self.read"]`. Sin efecto —nadie entra
  con ese rol— pero el rol nuevo va con lista vacía de verdad. Anotado, no
  arreglado.
- **D11: J-Staff crece sin rol nuevo.** `admin_plataforma`, `soporte` y
  `comercial` ya existen y alcanzan. Se anota para que no se abra como
  pendiente: la respuesta correcta es que no hay nada que hacer.
- **Higiene detectada de paso:** `ClientRole` está declarado en `@jtel/domain` y
  **no lo valida nadie** — misma forma que `canAccessPlant`. Queda anotado, no
  arreglado.

- **TRAMO 1 CERRADO.** Diez piezas, 1.a a 1.j. Nueve hechas; **1.h sale
  abierta**, y desde el frente nuevo se coloca al cerrar el Tramo 2. La
  compuerta se corrió y se midió el 4 de
  agosto —el cuerpo de cada respuesta, no el código de estado— y quedó escrita
  arriba con sus tres resultados.
- **Nota de conteo, para que el registro sea exacto:** este cierre se pidió con
  «once piezas». Son **diez** — de `1.a` a `1.j`, sin hueco. La numeración salta
  a la vista porque `1.h` está escrita al final de la tabla, después de `1.i` y
  `1.j`, por el orden en que se abrió.
- **Lo que queda abierto del candado tiene nombre y una consecuencia medida.**
  `canAccessPlant` no la llama nadie y no tiene rama para `plant_group`, así que
  **la regla del campus de la ficha §2.2 y §2.3 no está implementada en la
  guardia** — vive solo en el filtro de presentación de 1.d. Hoy eso no expone a
  nadie: un usuario de planta ve **de menos**, no de más.
- **Regla 8 de «las ganadas por las malas», salida del #229:** una defensa que
  ninguna prueba distingue de su ausencia no cuenta como defensa. Es el mismo
  criterio que ya aplicábamos a la pared entre carriers —por construcción, no
  por disciplina repetida— dicho ahora del lado de las pruebas.
- **Y el caso que la produjo, porque es de los que se ven correctos y no lo
  son:** `new URL("/..//evil.com", centinela)` **conserva el origen** y devuelve
  un `pathname` que el navegador lee como externo. La comprobación razonable
  pasa y el resultado es un redirector abierto.

- **El carrier queda encuadrado como producto, no como anexo.** Entra a §2 «De
  producto» y gana fila propia en el Tramo 7. Las dos caras no son simétricas:
  para el carrier sus unidades son una sola operación, así que ve todo su
  universo sin partir por contrato. De ahí sale la consecuencia para las
  guardias — el alcance se resuelve contra su universo, no contra el contrato
  por el que llegó — y el encuadre de v1: **lo que entra son los cimientos**, y
  la suite completa vive en `DESPUES.md`.

**7 de agosto de 2026 (C13 — la premisa que estaba mal, y el arreglo que cambió de forma).**

- **La lectura de C13 en §5.1 estaba incompleta, y la corrección es el
  hallazgo.** El plan decía que la tabla seguía vacía porque «escribir la fila
  depende de que alguien se acuerde». 🟢 **Medido el 7 de agosto contra el
  código: no dependía.** `updatePolicy` escribe la fila en la misma transacción
  que el `UPDATE` desde el **31 de julio** (`990be4f`), y su comentario dice
  explícitamente que el registro va ahí y no en quien llama para que un camino
  de edición nuevo no lo pueda olvidar.
- **O sea que el camino bueno llevaba más de una semana cerrado, y la tabla
  seguía en cero.** 🟢 Re-medido el 7 de agosto con `jtel_readonly`: cero filas,
  y los dos contratos reales con última edición el **2026-07-31 13:28** (Tecma
  47) y el **2026-08-06 09:14** (Campus). La segunda es la del guion de
  `kmlOriginToleranceFraction`, con `UPDATE` crudo.
- **Lo que falla es otra cosa: la puerta de atrás.** El guion no pasa por
  `updatePolicy`, y la consola de Neon tampoco pasaría. **Cerrar el camino bueno
  no cierra la puerta de atrás**, y el hueco no se ve hasta que alguien va a
  leer la historia y no hay nada. Es la regla 8 aplicada al registro: la defensa
  existía, funcionaba, y **ninguna escritura real la atravesaba**.
- **✅ Decidido por Asav: un trigger de Postgres**, no solo el camino de la
  aplicación. La razón, dicha por él: cuando se descartó la opción 1 de C21 fue
  porque «los disparadores se saltan», pero ahí el disparador era código
  nuestro; un trigger de Postgres atrapa a cualquiera que escriba, incluida la
  consola. **Es la diferencia entre una regla que se pide y una que no se puede
  saltar.**
- **Y su costo, aceptado por escrito y no descubierto después:** una escritura
  cruda no puede firmar quién fue y queda como `sql_directo`. Es menos malo que
  cero filas. Los guiones del repo (`escribir-tolerancia-origen`,
  `restaurar-politica`) declaran su actor para no caer ahí: el trigger es la
  red, y el camino bueno sigue siendo el camino bueno.
- **El trigger CEDE EL PASO cuando la aplicación ya registró**, y eso no es
  detalle: `updatePolicy` compara la política **efectiva** —con los defaults del
  esquema aplicados— y un trigger solo puede comparar bytes. Sin la cesión, el
  primer guardado de un contrato al que le faltan llaves registraría un
  «cambio» por cada default, y **una historia que arranca con cambios falsos no
  se vuelve a creer**.
- **Las dos mitades están cercadas por separado**, comprobado quitando cada una
  contra la rama desechable: sin el trigger mueren tres pruebas —las de la
  puerta de atrás—; sin la cesión mueren las otras tres —fila duplicada y
  cambios falsos—.
- **Lo mismo se aplicó a los turnos** (C21, opción 4): `shift_history` con su
  propio trigger, migración `0019`. La forma es la misma porque el defecto es el
  mismo.
- **Regla nueva, y es la generalización de todo lo anterior:** *una defensa que
  ninguna escritura real atraviesa no es una defensa, aunque funcione.* Es la
  regla 8 mirando el otro lado — allá el problema era que ninguna prueba
  distinguía la defensa de su ausencia; aquí las pruebas sí la distinguían, y
  lo que no la atravesaba era **el tráfico**. Se comprueba igual: no basta con
  que el camino bueno registre, hay que ver **por dónde entran de verdad las
  escrituras**.

**8 de agosto de 2026 (C20 — se parte en dos, y el hallazgo que la agrava).**

- 🟢 **Remedido contra producción, solo lectura.** Las tres colisiones siguen:
  un turno con nombre repetido («Turno B», 15:30 y 18:00), **ocho** nombres de
  ruta repetidos en el Campus con las mismas multiplicidades de la ficha, y
  **48 perfiles por id contra 47 por nombre**. Geocercas y unidades: **cero**
  colisiones.
- 🟢 **Y el detalle que la ficha no tenía, que la agrava:** el perfil que
  colisiona es `Km 30 - B`, y **está en los DOS contratos** —uno del Campus y
  otro de Planta 47—. Las otras dos colisiones colapsan cosas de un mismo
  sitio; **ésta cruza contratos**, que es el eje sobre el que se factura. Un
  corte por nombre de perfil no mezcla dos rutas: mezcla dos clientes-sitio.
- 🟢 **Ningún conteo del código agrupa hoy por nombre.** Los índices existentes
  —`shiftById`, `geofenceById`, `variantsByRoute`— son todos por id. C20 **no
  está produciendo cifras falsas en pantalla**, y decirlo importa: la urgencia
  es del corte que alguien escriba mañana, no de una hemorragia de hoy.
- **Se parte en dos, y por qué.** ✅ La **valla** entra ahora: `agruparPorId` /
  `contarPorId` / `indexarPorId` en `@jtel/domain` no aceptan un nombre como
  clave. Es del compilador, no de disciplina — regla 12 —, y se comprobó
  aflojando el tipo: `tsc` se pone en rojo. ⏸ La **etiqueta** —que un humano
  lea «Turno B» y sepa cuál— espera al **rediseño de pantallas** que corre en
  otro frente. Es cambio de piel y su verificación exige navegador; hacerla
  antes del rediseño sería trabajo de pantalla dos veces.
- **Lo que la valla NO hace, y va dicho para que nadie lo suponga:** no
  deduplica. Deduplicar por nombre borraría filas reales y daría un número más
  bonito y más falso — es el error que §D caso 6 del Marco descarta. Las dos
  filas siguen existiendo y siguen contando dos.

**8 de agosto de 2026 (cierre del Bloque A y del Bloque B — y el estado operativo que no vive en ningún otro lado).**

Siete PRs dentro: #264 · #265 · #266 · #267 · #268 · #269, más el botón del
simulacro. Las causas quedan así, y el detalle de cada una está en su fila de
§5.1:

| Causa | Estado |
|---|---|
| **C21** | Construida. **Compuerta abierta**: el aviso no se ha visto llegar |
| **C13** | Cerrada, con trigger. La puerta de atrás también |
| **C15** | Cerrada, y era peor que la etiqueta |
| **C12** | Cerrada. Había un tercer `0.8` |
| **C20** | **Partida**: la valla está; la etiqueta espera al rediseño |
| **C9** | **Espera al alta completa.** No es lo que la ficha decía |

**Lo único que le falta al Tramo 3 para cerrar de verdad es ver un correo.** Va
dicho así de simple porque es fácil darlo por hecho: seis causas construidas y
verificadas no compensan un canal que nadie comprobó. Es la regla 16, y es
exactamente donde murieron las dos generaciones del vigilante.

### El estado de las tres bases, que no está escrito en ninguna otra parte

- **Producción** tiene aplicadas la `0019` y la `0020`, con sus verificaciones
  cuadradas antes del `COMMIT`. Desde ese momento **toda edición de un turno o
  de una política deja fila**, venga de la app, de un guion o de la consola de
  Neon — y la de la consola queda firmada `sql_directo`. Conviene saberlo la
  primera vez que alguien edite algo por ahí y vea aparecer una fila.
- **La rama desechable** (`DATABASE_URL_TEST`) tiene las dos migraciones
  aplicadas también, o las pruebas de integración no correrían. Y **arranca de
  20 ocurrencias hasta el 2026-07-31**: las suites que necesitan futuro lo
  generan y lo borran. Si alguna vez aparecen ocurrencias posteriores a esa
  fecha, es basura de una corrida que no limpió.
- 🟡 **Un `.env` local puede tener el `CRON_SECRET` viejo.** El del working tree
  principal no coincidía con el de Vercel el 8 de agosto —da 401 contra las
  rutas de cron, no 503—, casi seguro por la rotación que documenta
  `docs/cron-secret-rotado`. Antes de culpar a una ruta de cron, comprobar eso.

### Lo que Bloque C hereda, y no debería tener que volver a descubrir

- 🟢 **`servedRoute` sigue intacta.** Ninguno de los siete PRs tocó uno solo de
  sus cinco términos. C12 tocó el mismo archivo y no el nudo, que era
  exactamente la razón de que se pudiera hacer sin contaminar nada.
- 🟢 **C15 cambió cómo se AGRUPA la evidencia** —de `imei` a `unitId ?? imei`—
  con la clave demostrada idéntica. No mueve un veredicto, pero **es lo primero
  que hay que descartar** si alguna medición del Bloque C sale distinta de lo
  que decía el corte del 6 de agosto.
- ⚠ **La precondición del Bloque C no cambió:** los **sensores de cadencia**
  tienen que existir **antes** de tocar C19. Si la cobertura mejora sin ellos,
  no habrá forma de saber si fue el arreglo o el proveedor moviendo la densidad
  otra vez.

**8 de agosto de 2026 (T4 sigue vivo — y el error de método de quien lo «encontró»).**

- 🟢 **`jtel_readonly` y `neondb_owner` siguen compartiendo contraseña**,
  comprobado el 8 de agosto sobre el `.env` vigente comparando las huellas
  SHA-256 de los dos passwords: **idénticas**, mismo largo. Lo detectó
  `verificar-env.mjs` **solo**, al correrlo por otra cosa.
- **Lo que cambia es la garantía, no lo que pasó.** Ninguna medición hecha con
  `jtel_readonly` fue insegura —`verificar-solo-lectura` lo confirma cada vez:
  41 tablas, cero escribibles—. Lo que descansa sobre esto es la **frontera**:
  todo el diagnóstico de este proyecto se apoya en «solo lectura» como límite,
  y ese límite hoy es un password compartido y no un secreto distinto.
- ~~🟡 **No está comprobado que el ataque funcione.** Las dos URL apuntan a
  **hosts distintos**: si el de lectura es una réplica, escribir ahí fallaría
  por construcción.~~ ❌ **FALSO, medido el 10 de agosto de 2026.** Los dos
  hosts son **el mismo endpoint de Neon** `ep-fancy-shape-ad8idz4g`, y el de
  lectura es su variante `-pooler` — el pooler de PgBouncer del mismo endpoint,
  **no una réplica**. La misma base, por otra puerta. El ataque **sí habría
  funcionado**: cambiar el usuario en esa URL entraba como dueño a la base de
  producción. Se deja tachado y no borrado porque el caso vale más que la
  corrección — ver la entrada del 10 de agosto.

**Y el error de método, que es lo que de verdad hay que registrar.** Esto se
reportó como un *hallazgo nuevo*, y **ya estaba escrito en §3.1 como el trámite
T4**. Quien lo reportó midió con cuidado, verificó sin filtrar secretos y no
tocó nada — e igual se saltó el paso barato: **preguntarle al plan si ya lo
sabía.**

Es la regla de §0 —*antes de apoyar una decisión en una cifra del repo, se
comprueba su eje y su fecha*— vista desde el otro lado: **antes de anunciar algo
como nuevo, se comprueba si el repo ya lo tenía.** El costo de no hacerlo no es
el ridículo: es que un hallazgo repetido **infla la lista de lo pendiente** y
hace parecer que apareció un riesgo cuando lo que hay es uno viejo sin atender.
Lo primero se atiende con urgencia; lo segundo, con una decisión de prioridad
que ya estaba tomada.

Lo que sí aporta esta pasada, y por eso T4 se edita en vez de solo repetirse:
que **sigue siendo cierto hoy**, que **lo atrapó el instrumento solo**, y la
distinción entre la garantía y los hechos.

**10 de agosto de 2026 (T4 — la mitad que cierra, la que no, y una inferencia
marcada con duda que era falsa).**

- 🟢 **El password de `jtel_readonly` ya no es el del dueño.** Asav lo rotó en
  Neon y actualizó `DATABASE_URL_READONLY`. Comprobado el 10 de agosto sobre el
  `.env` vigente: huellas SHA-256 **distintas** —dueño `c9e9b7f65e65`, lectura
  `61d0eada3d3b`, ambos de largo 16—. `pnpm env:check` **ya no levanta la
  bandera del password compartido**.
- 🟢 **Y se comprobó que el detector CORRIÓ, no que calló.** La comprobación
  solo dispara si los dos passwords se pudieron parsear (`pd && pl`); si
  `new URL()` falla, se salta **en silencio** y el árbitro anuncia verde. Se
  verificó aparte que ambos se leyeron. Sin ese paso, «la alarma no salió» y
  «la alarma se apagó sola» se ven idénticas desde afuera — que es exactamente
  la falla que `pnpm env:test` existe para vigilar.
- 🟢 **Los permisos siguen bien:** `verificar-solo-lectura` el 10 de agosto,
  **42 tablas, 42 legibles, cero escribibles**, sin `CREATE` en `public` y
  heredando las futuras. (Eran 41 el 8 de agosto: la base creció, la cifra no
  se copia sin fecha.)
- ❌ **La otra mitad de T4 no cierra, y por dos razones distintas.** Falta
  actualizar el valor **en Vercel** —no rompe producción, pero deja que el
  próximo `pnpm env:pull` reparta una credencial muerta— y falta **rotar
  `neondb_owner`**: la contraseña que estuvo compartida **sigue viva en la
  cuenta dueña**, así que la cadena que estuvo sobre-distribuida sigue abriendo
  la base con todos los permisos. Rotar solo el lado de lectura mueve el
  candado, no el secreto.
- 🟢 **Y «con redespliegue en el mismo movimiento» era de más.** Medido sobre
  `origin/main`: **ningún archivo de `apps/` lee `DATABASE_URL_READONLY`**. Sus
  únicos lectores son cinco guiones de `packages/db/src/` que se corren a mano;
  la app y los ocho crons de `apps/web/vercel.json` entran por `DATABASE_URL`.
  Rotar el de lectura **no puede romper producción**, ni antes ni después.
- ⚠ **`pnpm env:check` sigue en rojo, y no es por T4.** Faltan
  `ALERTAS_REMITENTE` y `ALERTAS_DESTINATARIOS`, que pasaron a `REQUERIDAS` el
  8 de agosto (#272); el `.env` de la máquina es anterior a ese cambio. Se
  arregla con `pnpm env:pull`. Se anota porque **un check rojo por dos motivos
  distintos es un check que se lee mal**: el rojo de hoy no dice nada sobre el
  password.

**El caso de método: una inferencia razonable, marcada con duda, que era falsa
— y que la marca de duda protegió en vez de exponer.**

El 8 de agosto se escribió que las dos URL apuntaban a «hosts distintos» y que
por eso quizá el de lectura fuera una réplica, donde escribir fallaría por
construcción. Iba con 🟡 y con una justificación buena: comprobarlo exigía
conectarse como dueño a esa base, y **eso no se hace para confirmar una
sospecha**. Todo correcto salvo el hecho. Los hosts son **el mismo endpoint**;
uno es la variante `-pooler` del otro. Distinguirlo no exigía conectarse a
nada: era **leer las dos cadenas**, que ya estaban en el `.env`.

Lo que hay que registrar no es el error, es lo que le pasó a la marca. §0 dice
*si no se puede fechar, no se afirma: va como 🟡 inferencia*. Se cumplió. Pero
un 🟡 **no caduca ni pide ser medido**, y en dos días dejó de leerse como «esto
falta comprobar» y pasó a leerse como **matiz que suaviza el hallazgo** — «no
está comprobado que el ataque funcione» terminó funcionando como «quizá no haya
riesgo». La marca de duda, que existe para señalar un hueco, **se convirtió en
el argumento para no taparlo.**

De ahí la regla que falta, y es barata: **un 🟡 lleva pegado el costo de
medirlo.** Si medir cuesta poco —leer un archivo, comparar dos cadenas—, no se
marca: **se mide**. El 🟡 es para lo que de verdad no se puede comprobar hoy, y
en esos casos se dice **qué haría falta** para pasarlo a 🟢. Un 🟡 sin costo
anotado es una tarea que nadie va a hacer disfrazada de honestidad
epistémica — y aquí, además, **le bajó la prioridad a un riesgo que era real**.

**10 de agosto de 2026 (T4 — la pregunta que quedaba abierta, contestada; y la
rotación del dueño baja de urgente a higiene con ventana).**

- 🟢 **T4 queda PARCIALMENTE CERRADA.** La mitad de lectura, rotada y
  verificada. La del dueño, pendiente — pero ya no en el aire: con
  procedimiento escrito en `docs/Procedimiento-Credenciales.md`.
- 🟢 **Deja de ser urgente, y por una medición.** La contraseña del dueño **no
  aparece en ningún archivo versionado de `main` ni en el historial completo de
  git** (0 commits). Su única exposición fue vivir dentro de
  `DATABASE_URL_READONLY`. No corre como corrió T5, que sí estaba escrita.
  **Decisión de Asav el 10 de agosto: se hace con ventana, no entre dos cosas.**
- 🟢 **Contestada la pregunta que decidía si el procedimiento era de cinco
  minutos o de un susto: no es ninguna de las dos, es una ventana.** La
  integración **sí** sincroniza sola las variables al resetear en Neon. Lo que
  no puede hacer nadie es que un despliegue **ya corriendo** tome el valor
  nuevo: las variables se ligan al despliegue. Y el artículo de Vercel para
  Neon dice que la credencial vieja **deja de funcionar de inmediato**. Las dos
  cosas juntas dan **un hueco inevitable entre el reset y el fin del
  redespliegue**, del tamaño de un build, con `/api/cron/verify` fallando cada
  minuto adentro.
- ⚠ **Y por eso el consejo general de Vercel no sirve aquí.** «Actualiza Vercel
  ANTES de invalidar la credencial vieja» supone que las dos pueden convivir; un
  password de rol no admite dos valores. La única salida al hueco es la ventana
  de gracia (`delayOldSecretsExpirationHours`) que la ruta de rotación **desde
  Vercel** puede ofrecer — **si Neon la implementa, lo cual se ve en ese diálogo
  y no está comprobado**. Va marcado 🟡 con su costo pegado, según la regla de
  §0: comprobarlo cuesta abrir el diálogo el día que se rote.
- 🔵 **Cuál integración está instalada, sin verificar.** El `.env.example`
  declara las tres `POSTGRES_*` y ninguna `PG*`, lo que apunta a la
  **Vercel-managed** del Marketplace. **No se confirmó contra el panel** —el
  comando para leer las variables de Vercel quedó bloqueado por permisos— y es
  el primer paso del procedimiento, porque las dos integraciones se rotan
  distinto.
