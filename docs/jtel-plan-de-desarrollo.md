# J-Tel — Plan de desarrollo

Dónde vamos y qué sigue. **Fuente única: cualquier chat nuevo lee esto para saber el estado.** Se actualiza al cerrar cada pieza. Acompaña al Marco (`docs/marco-limpio/`) y al mapa de la casa (`docs/Mapa-De-La-Casa.md`). Sustituye a `Plan-Desarrollo-Orden-Frentes.md` (15 de agosto), archivado sin editar en `docs/archivo/`. Última actualización: 23 de septiembre de 2026.

> **Éste es el único plan vivo** (decisión de Asav, 23-sep-2026). `PLAN.md`,
> `PLAN-v1.md` y `Plan-Camino-a-v1.md` se movieron a `docs/archivo/` **sin
> editarles una letra**: lo que siga abierto de ellos vive ahora como renglón
> aquí abajo, con puntero a su sección. Un documento archivado se lee por su
> razonamiento, no por su estado — el estado está aquí.

---

## Cómo se trabaja

- **Asav decide y revisa; Devin construye.** Asav no corre comandos de terminal. Lo único técnico que hace Asav es correr SQL en el editor de Neon (copiar/pegar lo que se le da) y usar las pantallas.
- **La secuencia de cada pieza:** decidir → prototipo que Asav revisa antes de escribir código → construir → capturas → (migración en Neon si la trae) → merge.
- **Todo entra por PR.** Asav mergea lo que toca motor, Marco, migración, guardias o endpoints que leen telemetría. Devin mergea lo de sólo presentación tras revisión visual de Asav.
- **Motor, base de datos o Marco: PR, aviso con el número, y esperar** (17-sep). Devin abre el PR, le avisa a Asav con el número y no lo mergea ni lo toca hasta que Asav lo revise. **Verde no es aprobación; la aprobación es de Asav.**
- **Migración siempre antes del merge.** SQL en Neon paso a paso, comprobar, y hasta entonces mergear.
- **Árbol lado a lado.** El UI viejo (`/carrier`, `/cliente`, `/jstaff`) sigue vivo mientras la casa nueva (`/casa/…`) se llena cuarto por cuarto. Nada nuevo se construye en el lenguaje viejo. Lo viejo se apaga cuando su último cuarto tenga versión nueva.
- **Modelos:** Opus para decisiones de arquitectura, diseño y validación contra el Marco; un modelo tipo Fable para tramos largos de construcción, en modo "avanza y detente en cada punto de verificación". Devin recomienda el modelo al inicio de cada tarea.
- **Principio recurrente:** los cambios son eventos, no reemplazos. El expediente versiona, la corrección apila, la baja marca sin borrar, reactivar será un evento encima.

---

## Lo que está en main (hecho)

**El cimiento del rediseño:**
- Identidad visual (cobre con tinta azul, dos pieles), skill `jtel-diseno`, mapa de la casa (cinco caras), cascarón con navegación por pestañas.
- Expedientes completo: el cuarto (#421), el catálogo de documentos D2 (#422), mercado de Chihuahua para Juárez Bus (#420).
- Arreglo del menú que perdía la cuenta + selector de cuenta (#429).
- Muro entre cuentas: lo que un dispositivo trajo en otra cuenta no se enseña en ésta (#435).
- La flecha › en las piezas que llevan a otra pantalla (#438).

**El cuarto de Compás — COMPLETO:**
- C1 — recorrido del día con huecos (#424) y corte de traza por modalidad (#426).
- C2 — Flota en vivo con mapa (#428).
- C3 — recorrido y playback en Ver ‹unidad› (#431, #432, #433).
- C4 — acciones y candados (#434), el cuarto Dispositivos (#436), asignar/soltar/dar de baja (#437). Actúan coordinador y admin del carrier; el admin de plataforma de J-Staff también, en cualquier cuenta (soporte y comercial no) — **provisional hasta la 6.29**. C4-e (#444): dar de alta y corregir unidades desde la casa nueva, con su VIN (único por cuenta), y ningún nombre repetido en una cuenta, en el código y en la base (0040). La 2101 duplicada de juarez-bus se corrigió el 18-sep (conservada la del camión con su historia).
- Recorrido y playback en Ver ‹dispositivo›, partido por unidad (#439).
- Una traza rota se dibuja rota (#443): el salto del GPS (más de 300 km/h) parte la traza sin borrar puntos y se declara con su rombo; los huecos de un camión estacionado se dicen en una pastilla; la línea se lee sobre un halo (4.78:1 y 4.59:1 medidos). Marcas de la traza ratificadas como familia propia en el skill (18 sep).

**Servicios especiales — Vernier V1:**
- El cuarto con la lista por ventana y el acta de cada ocurrencia, la familia del sello (hexágonos, `--sello-ok`, `--ladrillo`) y la barra de ventana compartida con C3 («Esta semana» reemplaza a «Últimos 7 días» también en Compás) (#445). El menú lee el contrato de verdad.
- El filtro: cada fila de chips con su rótulo, y los turnos sólo con un contrato elegido (#448).
- Los cuartos viejos del carrier (`cumplimiento`, `historial`, `reportes`) siguen vivos hasta el apagado de la piel vieja.

**Infraestructura / motor:**
- Migración a Compás cerrada; marca de lectura por aparato (#408 / 0037).
- Los 8 FTC927 configurados; los 7 movidos a Juárez Bus (#419), el 002 en el Jeep (ASAV).
  - **Los 7 de Juárez Bus, medidos en producción el 19-sep** (consulta de sólo lectura que corrió Asav, sobre `live_positions` y `telemetry_points`): **cuatro instalados y vinculados** —001→2109, 003→2120, 004→2101, 008→2126— y **tres en bodega esperando camiones en pintura** —005, 006, 007—. El **001** está montado en la 2109 pero mudo desde el 14-sep (última señal 14 sep 19:43): es el que está en reclamo con Teltonika. El 005 sí transmitió (última señal 17 sep 23:17), así que hoy ningún aparato entra a «Piden atención» del archivero por «nunca reportó»; la regla se queda para el que se compre y nadie pruebe.
- Velocidad: consulta de última señal 3.3 s → 1 ms (#423), cronómetro de lentitud (#427).
- Muro entre cuentas **dentro del motor**: verificación, reverificación y el backfill de duraciones leen la evidencia filtrando por la cuenta del servicio que juzgan (#441). Medido en producción el 17-sep-2026 antes de cerrar: cero IMEIs con puntos en más de una cuenta, así que no movió ningún veredicto ya sellado. El 18-sep se borró la lectura sin cuenta del repositorio: ya no existe la puerta, no sólo está cerrada. Lo cuida una prueba-guardia que barre todos los paquetes y pone en rojo cualquier lectura sin cuenta que se reintroduzca.
- La pausa de la verificación de un contrato (#447 / 0041): se pausa y se reanuda como evento, con quién, desde cuándo vale y motivo; lo sellado no se toca y lo no medido durante la pausa jamás se genera hacia atrás. **En uso:** los cuatro contratos quedaron pausados el 19-sep, con vigencia desde el 18-sep (se registró después y los eventos no se editan, así que no vale desde el 5). Los dos de Tecma, por el corte del proveedor de GPS; PRUEBA REAL y Honeywell, porque nunca operaron de verdad. Al pausar se borraron 1095 ocurrencias sin hecho.

**El Marco: 9 piezas.** Pieza 6 (Compás, el cimiento), enmienda del expediente (§H, 6.30–6.33), Pieza 7 (la modalidad del servicio), **Pieza 8** (la app del pasajero público) y **Pieza 9** (el cumplimiento del circuito), las dos ratificadas el 19-sep y consolidadas con sus enmiendas el 22 (#455, #498).

**Del 20 al 23 de septiembre — lo que entró mientras la cadena esperaba el arranque:**

- **La torre y el detector de pasos, completos.** El detector con su comparación (0045, 0046, #469), el orquestador que lo corre solo (0047, #471), el muro de los pasos que se abre por la unidad (9.14, #472), la puerta de posiciones con muro por cuenta y su derivación (#473, #474) y el radar (#475). Y la promesa por franja horaria como **única fuente** (0044, #466; #481, #482), con quién capturó cada versión (0049, #483) y el borrado de `circuits.declared_frequency_minutes` (0050, #485).
- **Circuitos en la casa nueva de J-Staff** (A1–A4, #494–#497) y **las reglas de la medición firmadas** (0051, #499): quién, cuándo, por qué y el antes → después leído de la base. La pantalla vieja sigue viva hasta el PR D.
- **Ontoy 2.0 — la app del pasajero, rehecha y publicada.** La barra de cuatro lugares (#503), «a N paradas» mientras la velocidad no esté calibrada (#504), el hilo de la ruta con su piso de contraste (#505), el Mapa de la ciudad con las favoritas en una sola consulta (#506), los avisos de la concesión firmados (0052, #507) con su campana (#510), las rutas en Inicio ordenadas por cercanía (#516, #517), el filtro del Mapa (#519) y el resumen de recorridos por tramo (0053, #511, #512). **Está publicada y abierta:** contesta 200 sin sesión (comprobado el 23-sep). **Se muda a `ontoy.app`** en cuanto termine su registro en Unstoppable Domains: `juarezbus.digital` es el nombre de **un transportista** y la plataforma no se viste de ninguno (ASAV, 23-sep). El dominio viejo **redirige y no se apaga**, conservando la ruta; los pasos están en `docs/Procedimiento-Dominio-Ontoy-App.md`. **La redirección entra temporal (307) la primera semana** y sube a permanente (308) en un PR de una línea cuando la mudanza esté probada en teléfonos reales: un 308 equivocado se queda en los teléfonos aunque se revierta el despliegue (ASAV, 23-sep). **Falta el planeador**, que es su último eslabón y espera recorridos medidos después del 28.
- **La jornada de una unidad** (#493, #500): el día de una unidad en su circuito, sólo con lo medido y **SIN DATOS ante la duda**. Es recuerdo, así que va sin cobre.
- **El lazo de re-verificación**, diagnosticado (#459, #461) y cerrado: el árbitro se rinde, cuenta sin escribir y hay llave (0043, #463). Y la carrera de `saveFact` —13 702 reventones que eran un `!`— arreglada (#460).
- **Ontoy 3.0 · pagos, en laboratorio.** Ver abajo: salió de la cola el 22-sep y no está en la cadena.

---

## El límite de la versión 1 de Ontoy — 1 de octubre de 2026

**Decisión de ASAV del 25 de septiembre de 2026.** Ontoy **no se lanza por partes**: sale
completo, como versión 1.

| | |
|---|---|
| **Lanzamiento** | **jueves 1 de octubre** |
| **Ensayo general** | **martes 29.** Si no pasa, la fecha se mueve |
| **Congelamiento** | desde la **noche del martes 29**: sólo arreglos, nada nuevo |

Reemplaza el lanzamiento del domingo 28, y con él la regla de «después del 29»: meter todo
**después** del arranque es peor que antes, porque si algo se rompe conviene que se rompa un
viernes y no con pasajeros un martes.

### Qué entra

Landing en la raíz de `ontoy.app` · app en `/rutas` con el manifiesto abriendo ahí · identidad
completa (los tokens del skill `ontoy-design`) · el mapa nuevo (ropa + Tino + Cami desde arriba
+ el pasajero) · caritas de estado en Inicio · Tino en la hoja de parada · «Ir a» con la
identidad · reacciones que nacen **de un dato o de un toque** · pantallas vacías con Ontoy · el
QR de las paradas funcionando · la mudanza a `ontoy.app` (#534).

### Qué NO entra, y por qué el «no» es la parte importante

| Fuera | Por qué |
|---|---|
| **El planeador** | Necesita recorridos medidos. Es el último eslabón de la app, no el primero |
| **«Llega en 2 min»** | Depende de medición en vivo que todavía no se sostiene |
| **«Cami lleno»** | Ídem: es una pieza dibujada, no un dato que exista |
| **El barrio** (tiendita, tacos, semáforo…) | Es para escenas y redes, no para el mapa en vivo |

Los tres primeros son la misma regla del Marco escrita cuatro veces: **no se promete lo que no
se midió.** El cuarto es la frontera del universo: en el mapa en vivo el barrio va sólo con
referencias reales.

**La lista viva de pendientes está en Notion («Ontoy versión 1»), no aquí.** Lo que este
documento guarda es el **límite** —qué entra, qué no y por qué—, porque eso es una decisión y las
decisiones viven en el repo. Una lista de pendientes copiada en dos lados se separa; un límite no.

### Dos constructores en paralelo

Una rama por tarea, por área, todo por PR. **Las áreas no se cruzan**, que es lo único que hace
que dos construyan a la vez sin pisarse:

| Quién | Su área |
|---|---|
| **Claude Code, con ASAV** | Las pantallas de la app: Inicio, la hoja de parada, «Ir a», las vacías, «Pronto me verás en la calle». Y los tokens del skill, que salen primero en un PR chico |
| **El otro constructor** | El mapa (Tino, Cami desde arriba, el pasajero), la landing en la raíz, y lo técnico |

El mapa arranca **cuando la cadena del viernes 26 esté en `main`**: toca `vista-mapa.tsx`, y
salir de un `main` ya asentado ahorra un rebase. La landing puede empezar antes — no choca con
nada.

### Mientras tanto

Uno o dos camiones dan vueltas al circuito **midiendo tiempos**. Oasis–Centro **no lleva
pasajeros** hasta el 1 de octubre: su `service_launch_date` es esa fecha, y Ontoy la enseña
«por arrancar» sin prometer frecuencia. **La medición no se detiene por eso** — el detector de
pasos filtra por asignación vigente, unidad activa y circuito activo, y no lee la fecha de
arranque.

---

## Lo que sigue, en orden

**Reordenado el 19 de septiembre de 2026 por un dato nuevo:** las 8 unidades **arrancan la semana del 28 de septiembre**, con **dos días de prueba entre el 22 y el 25**. Todo lo que sigue cuelga de esas dos fechas.

> ✎ **25 de septiembre:** esas dos fechas siguen valiendo para **las unidades**, que ya andan dando vueltas midiendo tiempos. Lo que se movió es **Oasis–Centro con pasajeros y Ontoy**: los dos el **1 de octubre**, y con el alcance cerrado — ver «El límite de la versión 1» arriba. Así que donde abajo se lea «después del 29» como regla de calendario, manda la sección de arriba.

**La regla de esta cadena.** Se avanza de eslabón en eslabón y **no se salta ninguno**. Lo que se nos ocurra en el camino no entra: se manda a la **cola** del final, con una línea de por qué. La cola se revisa entre eslabones, nunca en medio.

### Lo que ya existe y no hay que construir

**Medido contra `origin/main` el 19-sep, no supuesto.** La primera versión de esta cadena daba por faltantes tres cosas que ya estaban, y se corrigen aquí para que nadie las construya dos veces:

- **La pantalla de captura existe** — editor de circuito con KML y paradas sobre el mapa (#346), el alta de concesión y circuito (#348), el arreglo del mapa y el encuadre (#349), y un solo lugar para configurarlo (#364). Con su API completa: crear parada con el pegado rehecho en el servidor, corregirla con vigencia, trazado, publicación, unidades y rango. Trae además su propia lista de armado, que dice qué le falta a cada circuito.
- **El color del circuito existe como dato** — `circuits.color_hex` desde la 0029, obligatorio, con su comprobación de hexadecimal y su valor de origen. La pantalla ya tiene el selector. Lo que puede faltar es que alguien lo **escoja**, que es otra cosa.
- **El orden y el sentido de cada parada existen** — `circuit_stop_versions.orden` y `.sentido`, con el candado de una sola versión vigente por parada.

Y con lo demás de la 0025 a la 0033: la concesión, el circuito, la parada con su QR, la asignación de unidad, el interruptor de publicación, la velocidad, los estados públicos, la fecha de arranque y el contador anónimo de aperturas.

### Lo que Oasis–Centro tiene hoy, medido en producción el 19-sep

Corrido por Asav en Neon con `docs/correcciones/2026-09-19-medir-oasis-centro.sql`:

- **Cero paradas en los dos circuitos** — ni Oasis–Centro ni el Corredor de prueba tienen una sola.
- **El trazado sí está completo y cuadra con lo medido en agosto:** ida 661 puntos / 20.83 km, vuelta 456 / 16.44 km, subido el 27-ago. No hay que volver a subir el KML.
- **Oasis–Centro está NO PUBLICADO**, que es lo correcto mientras se arma.
- **Los dos circuitos traen el color de fábrica** (`#7C5CE0`): el dato existe desde la 0029 y **nadie lo ha escogido**. Escogerlo es parte de la tarde de captura, no un frente.
- **La tabla por franja no existe, confirmado contra la base** — el PASO 7 devolvió cero renglones.
- **Oasis–Centro no tiene ninguna asignación vigente.** Las cuatro que hay son del **Corredor de prueba**, y son **Meitrack de Umbrella que ya no reportan** — o sea, cuatro asignaciones que no publican nada.
- **La fecha de arranque dice 10 de septiembre y ya pasó.** Con fecha pasada el circuito deja de estar «por arrancar» y queda a merced de la evidencia, que hoy no existe.

Falta una respuesta que la hoja no pedía y ahora sí: **si la concesión de Oasis–Centro tiene un transportista ligado**. El selector «Asignar una unidad» sólo lista unidades de los transportistas ligados a esa concesión por un `concession_carriers` vigente; sin liga sale vacío y la pantalla no dice por qué. Es el PASO 9 de la hoja, agregado después de ensayar la captura.

### Eslabón 1 · La franja horaria, y las paradas de Oasis–Centro capturadas
**Antes del 22 de septiembre.**

Dos cosas, y sólo una es código.

- **La promesa por franja horaria** (Marco 9.1c). Hoy la promesa es **un solo número para todo el día** —`circuits.declared_frequency_minutes`— y la ley dice que una tabla publicada promete distinto en hora pico que en el valle. Sin esto, lo medido no tiene contra qué compararse, y comparar la hora pico contra el promedio del día es la afirmación falsa del alcance (Marco §D). **Tabla nueva con vigencia, que nazca sin el defecto que el plan ya tiene anotado** para el horario de servicio: cambiar la tabla no sobrescribe, cierra la vigente y abre la nueva. Ficha de construcción antes del código: `docs/Ficha-Construccion-Franja-Horaria.md`.
- **Capturar las paradas de Oasis–Centro**, y escogerle su color. No es un frente de construcción: es una tarde de Asav sobre la pantalla que ya existe, en `/jstaff/circuitos`. Lo que sí hacía falta era que la pantalla sirviera — y no servía: al reabrir un circuito que ya trae su trazado, **picar el mapa no ponía nada** (#457, arreglado, probado en el navegador y en producción desde el 19-sep).

  **Y antes que las paradas, una comprobación:** el selector «Asignar una unidad» sólo lista unidades de los transportistas **ligados a esa concesión** por un `concession_carriers` vigente. Sin liga sale vacío y la pantalla no dice por qué — que explicaría «Oasis–Centro sin ninguna asignación vigente» mejor que el olvido. Es el PASO 9 de la hoja de medición.

**Cómo se sabe que está hecho:** Oasis–Centro tiene sus paradas cargadas con nombre, orden y sentido, su tabla por franja y su color, y un humano las capturó desde una pantalla.

### Eslabón 2 · El detector de pasos por parada — el frente grande
**Del 22 al 25 de septiembre, los dos días de prueba.**

**Éste es el trabajo de verdad, y la primera versión de esta cadena lo subestimaba.** La Pieza 9.2 ya es ley desde el 19-sep, pero **no tiene fuente: no hay una sola tabla de pasos por parada en ninguna migración**, y la propia Pieza dejó su detección abierta (9.11). Los dos días de prueba no miden nada si esto no existe.

- Que un camión rodando produzca **pasos por parada**: unidad, parada, hora, sentido.
- Que la desviación se calcule **contra la franja vigente** del eslabón 1, con sus dos orillas — el adelanto daña igual que el atraso (9.1b).
- **Nada se sella.** Es la etapa del metro (9.3): se mide, no se juzga.

**Decidido por Asav el 19-sep**, sobre `docs/Ficha-Construccion-Pasos-Por-Parada.md`: detección **por cruce sobre el trazado**; la hora interpolada **es medición y se guarda como rango**, con el ancho del hueco entre pings; la comparación contra la promesa es **banda contra banda** —cabe dentro: sostuvo; cae entero fuera: se agujeró; se traslapa: **sin datos**, nunca un veredicto a medias—; y el hecho **guarda su evidencia** (qué dos pings, qué hueco) para poder recalcular sin perder el día. Las decisiones restantes siguen en la ficha.

**La cadencia ya está medida** (19-sep, producción, sólo lectura): los FTC927 dan **4–6 s entre puntos y 15–61 m con el camión andando** — entre 7 y 50 veces más fino que Umbrella, y por encima de los 15–20 s que el pendiente «cadencia de reporte por tipo de servicio» iba a pedir. Lo que no cambió son los huecos: 35 de más de cinco minutos en un aparato en una semana, y ahí es donde el cruce gana.

**Cómo se sabe que está hecho:** una unidad real da una vuelta real y la base registra sus pasos con la desviación correcta. Si esto falla, lo demás da igual.

### Eslabón 3 · La app del pasajero, publicada
**Semana del 28 de septiembre, con el arranque.**

**Está más construida de lo que este plan suponía:** `apps/publico` ya es una PWA con su dirección por circuito, buscador, mapa vivo, el hilo de paradas ordenado, el color de ruta, la escalera de cuatro estados y la fecha de arranque (#351, #353, #359, #373, #380). Existe despublicada, que es como debe estar.

Lo que falta de verdad:

- **La tabla publicada de cada parada** (8.2), que vale aunque no haya unidad en vivo — y que **depende del eslabón 1**: sin franja no hay tabla que publicar.
- El ETA hasta el pasajero, calculado en su teléfono (8.3b).
- Prender la publicación del circuito cuando el eslabón 1 esté completo.

**Y una cuenta que conviene tener antes de culpar a la cadencia:** si el camión se ve brincar en la app, **no es el aparato**. La cadena es aparato **4–6 s** (medido) → recolector cada **30 s** (`docs/Procedimiento-Traccar-Servidor.md`) → TTL del CDN **15 s** → la app sondea cada **15 s** (`SONDEO_MS`). Los dos cuellos son el recolector y el TTL: **hasta 45 s de retraso**, y el propio endpoint lo dice en su comentario. Subirle la cadencia al aparato no movería ninguno de los dos. Si el brinco molesta, se ataca ahí — o dibujando el movimiento entre lecturas, que es otra conversación.

**Cómo se sabe que está hecho:** un pasajero cualquiera abre la app en la calle y ve a qué hora pasa su camión.

### Eslabón 4 · La terminal del carrier
**Después del arranque, con días medidos de verdad.**

Prototipo v2 aprobado en forma: https://claude.ai/artifact/7NmMd5oC7HzB9HYUZj8P25

**También tiene piso:** `Operar` (#362) y el reporte de la jornada (#372) existen. Cuelgan de `/jstaff` por una razón que hay que resolver, no rodear: **una cuenta de tipo `concesion` no puede entrar a ninguna parte** — no tiene membresía, no hay cara propia y la guardia sólo conoce jstaff · cliente · carrier. Hoy sólo J-Staff captura y sólo J-Staff opera.

- La forma de tres golpes: **piden atención · las cifras · los cajones**.
- `Ver ‹parada›` como ficha, no expediente (9.8b).
- La jornada de cada unidad en el circuito, dentro de la familia Actividad de su expediente.
- El bloque «Ahora» sólo cuando la ventana es hoy y el circuito está abierto (9.2b).

**Cómo se sabe que está hecho:** Asav abre la terminal al final de un día real y entiende cómo salió el servicio sin preguntarle a nadie.

### Eslabón 5 · La forma estándar se vuelve ley, y Servicios especiales la hereda
- La forma de tres golpes entra al skill de diseño como ley de todo cuarto.
- **Servicios especiales** deja de ser lista interminable y adopta la misma forma.

### Eslabón 6 · El editor del trazado, con calca
**Cuando haya semanas de rastro real.**

- La **calca** se dibuja del rastro propio de Compás — ya no hay Umbrella de dónde bajar KML.
- Encima de la calca se corrige el trazado con clics.
- **Subir un KML** se queda como puerta secundaria, para trazados que lleguen de fuera.

### Eslabón 7 · Los beacons: identificación del chofer y nómina
**Cuando lleguen los beacons de Teltonika.**

- El FTC927 lee el beacon a bordo y lo liga al chofer (cierra la asignación chofer ↔ servicio).
- **El beacon es evidencia declarada, no prueba:** en pantalla dice que el beacon iba a bordo, nunca que esa persona manejó. Con el contrato laboral que lo declara como identificación, eso basta para asistencia y nómina.
- Desbloquea el ausentismo (9.5), que jamás se infiere del GPS.

### Higiene que no espera su turno

Se atienden entre eslabones porque se agravan con el arranque:

- **La lentitud de Servicios especiales.** Con 8 unidades en vez de 4, los puntos se duplican. El EXPLAIN sigue sin correrse (`docs/correcciones/2026-09-19-medir-lentitud-servicios-especiales.sql`). **Vale más que cualquier prueba de carga.**
- **Las cifras en cero** y **Protomaps antes de las 80 unidades**.
- **Cuántos GPS aguanta el sistema.** Nunca se ha medido. Se simula la carga de 50, 200 y 500 unidades contra una base desechable. No es urgente; es una pregunta abierta que conviene no contestar de memoria.

### Ontoy 3.0 · pagos — fuera de la cadena, en laboratorio

**Salió de la cola el 22 de septiembre de 2026**, donde estaba como «cuentas de pasajero y cartera de pago, pieza propia con abogado». Se adelantó porque la cadena esperaba el arranque y esto es **mecánica aislada**: no toca el motor, no toca el árbitro y no toca la app publicada.

**La raya, que manda sobre todo lo demás:** se construye con **datos falsos** para probar la mecánica, **nunca dinero real de una persona real** hasta que responda el abogado. Sin procesador, sin banco, sin cuenta. Lo vigila una valla en CI (`pnpm cobro:check`) que se cae si aparece un SDK de pagos. Ficha: `docs/Ficha-Construccion-Ontoy-3-Pagos.md`.

Lo que está en `main`: el **boleto firmado** que se verifica sin red (#523), el **pase del pasajero** con su QR rotante (#524) y el **lector del camión** (#525, #526, #527). Abierto: el **libro de boletos y la sincronización** (#528) — la primera pieza con migración (0054) y con lado servidor. **La puerta del lector está cerrada** (23-sep): `/validador` sale de los buscadores con `noindex` en el HTML y en la cabecera, Ontoy no lo enlaza —hay prueba que se cae si alguien lo hace— y el `robots.txt` **no** lo prohíbe a propósito, porque prohibir el rastreo impide leer el `noindex` y lo dejaría listado igual. Cerrarle la puerta **no cambia la regla del #528**: un lector sin alta sigue leyendo y entrega cuando lo registren; no se queda mudo por un trámite.

**Y el orden que esto cambió: la Pieza 10 va ANTES del P4.** La caja de J-Staff reparte dinero entre transportistas, y **a qué se ata un viaje para repartirlo no está decidido** — el libro guarda lo observado y no lo decide. Escribir la caja sin esa pieza sería inventar el reparto en una pantalla, que es exactamente lo que el Marco no deja hacer.

### Fuera de la cadena, y sigue vivo

La cadena es el arranque, no el plan entero. Estos dos frentes no entran en ella y no se cancelan:

- **C · Los pasillos.** El paso entre casas para quien tiene varias llaves, toda pieza abre su expediente desde cualquier pantalla, y el apagado de la piel vieja. **Le toca la puerta del concesionario del eslabón 4.**
- **D · Migrar Planta y Corporativo** — cuando los Teltonika devuelvan la evidencia y las pausas se reanuden (oct–nov). Antes serían pantallas vacías.

### La muerte de la piel vieja — 30 de noviembre de 2026
La piel vieja se apaga el 30-nov: las direcciones redirigen a la casa nueva y nada de datos se toca. Antes: (1) inventario medido contra el código de todo lo que sólo ella sabe hacer, en un PR de documento; (2) cada cosa del inventario recibe destino en la casa nueva o muerte declarada. Cada «hazlo en la vieja» de aquí a esa fecha es tiempo prestado. **El editor de circuito y Operar viven ahí: son parte del inventario.**

### Condición, no fecha
- **Los 80+ GPS y el alta por lote.** NO es una fecha: se hace SÓLO cuando el cuarto de Compás funcione y Asav lo haya visto trabajar con los 8. Umbrella se deja cuando la prueba convenza.
   - **Decidido (17-sep):** se compran Teltonika nuevos; no se redirigen los 82 Meitrack de Umbrella. Razón: 37 son 3G (red muriendo), ~20 ya callados, cinco modelos por validar contra el árbitro, dos protocolos que mantener. Un solo modelo probado vale más que cinco por validar.
   - Pendiente sin prisa: mandar `0000,A10` por SMS al chip del 10249 (656 551 7725). Si contesta, evaluar redirigir sólo los 42 de 4G como puente mientras llegan los Teltonika.

### La cola

Lo que se nos ocurre mientras avanzamos. No interrumpe la cadena.

- El vigilante que avisa (Lenore sobre la torre): cuando haya frecuencia real medida que vigilar.
- ~~Las cuentas de pasajero y la cartera de pago (Pieza 8.14)~~ → **salió de la cola el 22 de septiembre de 2026.** Ver «Ontoy 3.0 · pagos» abajo.
- Guardar posiciones de pasajeros (8.15): pieza propia, con abogado y sus seis condiciones.
- El árbitro del circuito, etapa 2 (9.12): sólo tras semanas de medición con servicio real.
- Comparar circuitos entre sí (9.10): igual.
- Horarios en puerta (idea del 16-sep) — también anotada abajo como pendiente con nombre.

Los **pendientes con nombre** de abajo siguen vivos y no se repiten aquí.

---

## Lo que quedó abierto del PLAN viejo

**Inventario del 23-sep-2026, al archivar `PLAN.md`.** Se hizo por estructura
—sus tramos, sus bloqueos y su lista de causas— **no releyendo sus 5 242
líneas**: lo que cada renglón dice de sí mismo es lo que se traslada, y el
detalle se queda allá, que para eso se archivó completo.

**Nada de esto está cancelado.** Lo que no tenía fecha sigue sin tenerla, y lo
que la cadena del arranque no toca, no se toca.

| Qué sigue abierto | Dónde está el detalle | Estado al archivarlo |
|---|---|---|
| **Tramo 3 — arreglar el árbitro.** Las 26 causas medidas del motor, contadas por lo que su propia tabla dice de cada una: **19 sin construir**, **4 partidas o a medias** (C1, C17, C20, C24), **2 cerradas** (C12, C15) y **1 que dejó de ser causa** (C10) | `docs/archivo/PLAN.md` §4 «Tramo 3» y §5.1 con la medición de cada una | Abierto. La regla que lo gobierna sigue en pie: **una causa por PR, y nunca dos términos de `servedRoute` en el mismo** |
| **Tramo 4 — que el hecho se baste a sí mismo.** Un hecho sellado no carga todo lo que hizo falta para producirlo: geocerca, variantes, ventana de evidencia, nombres y densidad | `docs/archivo/PLAN.md` §4 «Tramo 4» | Abierto, y **bloqueante para la definición de v1**. Su propia tabla avisa que en la mitad sin copia congelada **cero no es una medición, es ausencia de memoria** |
| **Tramo 5 — ver y explicar.** El expediente del no cumplido con los dos trazos encimados, el diff estructural y las cifras de juicio | `docs/archivo/PLAN.md` §4 «Tramo 5» | Abierto. Parte se cubrió por otro camino (el archivero y las actas de Vernier); el corazón —los dos trazos y el diff— no |
| **Tramo 6 — re-verificar y sostener** | `docs/archivo/PLAN.md` §4 «Tramo 6» | Abierto, y espera al 3 y al 4 |
| **Tramo 7 — vendible.** Login real sin bypass, Lenore-vigía y narradora, el interruptor de J-Staff, las altas de usuarios | `docs/archivo/PLAN.md` §4 «Tramo 7» | Abierto. El **interruptor de J-Staff** y las **altas por invitación o solicitud** ya se nombran en este plan como frentes propios |
| **Tramo JB — transporte concesionado** | `docs/archivo/PLAN.md` §4 «Tramo JB» | **Es la cadena del arranque de este documento.** Se siguió por aquí, no por allá |
| **T2 — el correo, y son dos cosas.** (a) Resend con dominio verificado; (b) que exista `hola@j-telemetry.com` | `docs/archivo/PLAN.md` §3.1 | Abierto. Sigue vivo en este plan como «los avisos que no llegan» |
| **T4 — rotar `neondb_owner`.** La mitad de lectura se rotó el 10-ago; la del dueño no | `docs/archivo/PLAN.md` §3.1 y `docs/Procedimiento-Credenciales.md` | Abierto, con procedimiento escrito |
| **T6 — tres identidades de prueba en Clerk**, para abrir las tres caras a la vez | `docs/archivo/PLAN.md` §3.1 y `Ficha-Identidades-De-Prueba.md` | Abierto |
| **Las decisiones D1–D9 de Asav** que siguen sin cerrarse | `docs/archivo/PLAN.md` §3.2 | Abiertas. D9 (el modelo de altas) ya está decidido y vive aquí, en el Tramo 7 |
| **Lo que NO entra a v1** | `docs/archivo/PLAN.md` §6 | Se queda donde está: es una lista de fronteras, no de trabajo |

**Los dos archivos que acompañan a `PLAN.md`** —`PLAN-v1.md` (el plan de olas,
anterior al 3-ago) y `Plan-Camino-a-v1.md`— se archivan **sin inventario
propio**: `PLAN.md` los reemplazó en su momento y lo que sobrevivía de ellos ya
había pasado por él. Se guardan porque su razonamiento se cita en fichas del
Marco que siguen vivas.

---

## Pendientes con nombre (anotados para no perderse)

- ✎ **La trampa de la hora — y el pendiente que decía aquí era falso.** Este renglón afirmaba que `integration.test.ts > generateForProfile — alineación de calendario` **fallaba en `origin/main` sin tocar nada**, y culpaba a los datos de la rama desechable. **No falla, y no eran los datos.** La suite exige `TZ=UTC`, que vivía sólo en el script del paquete; correrla con `npx vitest` —para filtrar un archivo— la pierde, y entonces se pone roja. Diagnosticado el 23-sep (**#529**) y cerrado por el lado de la valla: la zona vive ahora en la configuración de vitest y no se puede perder (**#530**).

  **Lo que sí quedó abierto, y es lo que importa:** el generador de ocurrencias **decide su rango en la zona de la máquina** (`setHours`) y lo devuelve a UTC (`toISOString`). Con un `Date` en medianoche UTC —que es justo el `from` de la renovación diaria— el rango arranca **un día antes**. Hoy no muerde porque los tres llamadores viven en Vercel, que corre en UTC, y **nada en el repo lo afirma ni lo comprueba**. El arreglo son dos cosas juntas: **fechas civiles explícitas** en el rango (`localDateIso`/`addDaysIso`, que ya existen y ya son puras) **y una alarma si el proceso no corre en UTC**. PR propio, **después del 29 de septiembre** (Asav, 23-sep).

  **Hecho, esperando el 29:** el rango del generador viaja en fechas civiles de punta a punta —`generateForProfile` recibe dos strings y `startOfDay`/`addDays` dejaron de existir—, la alarma vive en `packages/domain/src/zona-del-proceso.ts` y la dispara la renovación diaria (avisa una vez por proceso y no tumba nada), y una prueba de integración corre el caso con el proceso movido a `America/Ciudad_Juarez` desde dentro, porque la suite entera corre en UTC. Comprobada al revés: con el camino viejo genera 2 ocurrencias en vez de 1 y se pone roja.

- **El registro de entradas de la compuerta de atención.** Hoy J-Staff cruza entre cuentas **sin dejar huella**: la compuerta existe como lugar del menú y no tiene registro. Está escrito en `docs/Mapa-De-La-Casa.md` §4 y se trae aquí para que tenga fecha de disparo, no sólo mención. **Su disparador: antes de una segunda persona en J-Staff, o antes de la primera pregunta de un cliente — lo que llegue primero.** Mientras tanto vale la decisión del 21-sep: **J-Staff no escribe como otra cuenta**; una aportación la crea sólo el transportista, y el día que J-Staff necesite escribir de parte de alguien, será por la compuerta **con** registro.
- **La bitácora de correcciones de identidad.** Corregir una unidad sobrescribe (decisión del 18-sep para C4-e): renombrar un número económico cambia cómo se lee toda su historia, y no queda registro de cómo se llamaba antes. No es decorativa. La pantalla lo avisa al corregir.
- **Nombre único de usuario por cuenta** — la regla de C4-e alcanza a los usuarios, pero hoy no existe ninguna alta de usuarios y el nombre vive en Clerk. Entra con el Tramo 7 (altas por invitación o solicitud aprobada desde J-Staff).
- **El evento de cambio de cuenta.** Hoy mover un dispositivo entre cuentas no deja fecha, así que no se puede decir «sin registro en esta cuenta». Cuando se construya (J-Staff), que sea un evento con fecha, y que el 6.14 lo diga al enmendarse.
- **Quitar la baja desde la pantalla (6.18).** Hoy sólo con SQL. Necesita su propia conversación: reactivar debe ser un evento encima, no un borrado, para no perder fecha y motivo (6.15).
- **El estado de una unidad y de un dispositivo debe derivar del lugar** (patio, taller, en servicio, en bodega) cuando existan Lugares y el mapa en vivo. Requiere roles nuevos de geocerca que hoy no existen.
- **La historia del horario de servicio de los circuitos** — hoy se sobrescribe, por eso el botón de circuito sólo sale hoy.
- `corredor-prueba` es transporte especial cargado como circuito; se corrige cuando la modalidad exista como dato marcable.
- Las alertas viejas de Umbrella (5–11 sep) siguen abiertas y nunca llegan a cero; limpiar al retirar lo viejo (6.17).
- Texto cortado en celular en nombres largos del catálogo («Permiso de transpo…»).
- Marcar el lugar activo dentro de "Más" en el menú.
- Las 23 fichas del Marco que apuntaban al skill viejo (revisión de Asav).
- Las 5 reglas candidatas al Marco en `Trampas-De-Medicion.md` §2, sin ratificar.
- **La cadencia de reporte por tipo de servicio — y la pregunta salió al revés.** La frecuencia cuesta SIM y no todas las unidades necesitan la misma: transporte público con app de pasajero pide frecuencia alta; transporte especial puede reportar menos, porque al árbitro le bastan las entradas y salidas de geocerca. **Medido el 19-sep en producción:** los FTC927 ya dan **4–6 s entre puntos** con el camión andando (mediana 6 s el 003, 4 s el 005, 5 s el 008), o sea **más fino de los 15–20 s que se iba a pedir**. La pregunta pasa a ser si eso es más de lo necesario, y qué cuesta — en SIM y en base. Dos datos que la misma medición destapó: hoy `juarez-bus` produce **1 693 puntos en siete días** porque los camiones casi no ruedan, y con los 8 en servicio real el ritmo sube del orden de **~57 000 puntos al día**, contra una tabla que hoy lleva 4.47 M de filas y 1 621 MB. **Se decide con el consumo real de los 8 — no antes**, pero el orden de magnitud ya se conoce y toca a la lentitud y a «cuántos GPS aguanta el sistema». Si el intervalo se puede bajar, es del lado de Teltonika (configurador o FOTA): en este repo no hay camino para cambiarle parámetros a un aparato.
- **Horarios en puerta** (idea de Asav, 16-sep). En el piso de flota / monitoreo, el tablero de lo que viene: para especial, la lista de servicios por salir con su ventana (como pantalla de aeropuerto); para circuito, los circuitos en servicio con sus tablas de horario por parada. Un carrier con contrato y concesión ve los dos registros, uno por modalidad (Pieza 7). Es un cuarto/parte propio del piso de flota — se diseña en su momento, con prototipo.
- **La deuda de Planta 47 · Turno A (Vernier, 6.17).** Los pendientes `llegada_sin_atribucion` del destino compartido se ven en Servicios especiales tal como están sellados. No es defecto de pantalla: es la guardia de atribución, decisión de motor y de negocio. El chip de pendientes tiene que poder llegar a cero el día que se salde; la cifra se mide cuando el cuarto ruede.
- **La zona de la cuenta en las demás pantallas.** Servicios especiales usa la del mercado de la cuenta (respaldo: la política del contrato); C3 y las pantallas viejas siguen con `America/Ciudad_Juarez` fija.
- **Congelar las unidades posibles con el hecho.** Hoy el acta las muestra «según el perfil hoy», porque el perfil sólo guarda el conjunto vigente. Es decisión de motor.
- **Evidencia de lo que sí se hizo en un no cumplido** (Vernier, pendiente con nombre del 18-sep).
- **Ligar «Servicios con veredicto» de Ver ‹unidad› al acta** de cada ocurrencia, con el hexágono. PR chico después de Vernier V1.
- **`service_contracts.status = 'suspended'`** es una etiqueta comercial que ningún proceso lee, y la pausa de la verificación sí detiene al motor: dos cosas que se llaman casi igual y sólo una hace algo. Cuando se trabaje el tramo de contratos, se decide si se retira o se conecta. Mientras, J-Staff la muestra como «estado comercial», nunca junto a la pausa sin distinguirla.
- **La lentitud de Servicios especiales**: 97–99 % en «datos» (cronómetro, 19 sep). Espera los EXPLAIN que corre Asav (`docs/correcciones/2026-09-19-medir-lentitud-servicios-especiales.sql`) y las líneas nuevas del cronómetro (#446) antes de optimizar.
- **Corregir las geocercas mal trazadas.** Hoy sólo se puede en la piel vieja: necesita destino en la casa nueva antes del 30-nov.
- **El hueco de navegación entre casas.** Quien tiene varias llaves no tiene cómo pasar de una casa a otra: del transportista a J-Staff no hay paso dentro del producto, hoy se entra escribiendo la dirección (visto el 18-sep). Se cierra con C · Los pasillos.
- **C4-d — apagar el alta vieja** de `/carrier/flota/alta`. Espera a que los 7 FTC estén rodando; hoy van 4.
- **Migrar el alta de cuentas de J-Staff** a la casa nueva. Cuando se acerque el primer cliente real, no antes.
- **La baja del chofer, con ficha propia.** Es el momento delicado: purga datos personales (Plan-Choferes 6.5) y no se cuela de pasada en otra ficha. Purga en el mismo acto las credenciales y los papeles del chofer (incluida la «Licencia» del alta de Choferes V1) y conserva los hechos; mientras no exista, un chofer no se puede dar de baja.
- Cuadrar el dispositivo que no coincide: la hoja de Umbrella tiene 81 renglones (el 9181 repetido) pero en la base se dieron de baja 82.

---

## Decisiones grandes pendientes con papá / negocio

- Los valores del catálogo de documentos de Chihuahua (obligatorio, vence, periodicidad, días de aviso) — Asav los junta con su papá y los captura en la pantalla del catálogo.
- Si Compás·flota se vende solo y a qué precio (6.27).
- Las reglas del contrato Tecma, el estado de cuenta, la matriz de permisos (6.29) — sesión con papá.
