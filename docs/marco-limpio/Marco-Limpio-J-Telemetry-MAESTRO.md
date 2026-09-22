La única fuente de verdad. Nueve piezas, derivadas del proyecto completo y verificadas una por una por ASAV. Reemplaza toda la documentación vieja (queda archivada). De aquí en adelante, esto es lo único que hay que cargar — ni conversaciones ni docs viejos. Aterrizado en contratos reales (Tecma 47, Honeywell MX07). Fecha: 6 de julio de 2026.
Contenido
Pieza 1 — El dominio y las leyes intocables
Pieza 2 — Las dos caras del producto
Pieza 3 — Las reglas de verificación
Pieza 4 — Usuarios, roles y accesos
Pieza 5 — La forma de la suite
Pieza 6 — Compás, el cimiento de la evidencia · 14 de septiembre de 2026
Pieza 7 — La modalidad del servicio · 16 de septiembre de 2026
Pieza 8 — La app del pasajero de transporte público · 19 de septiembre de 2026
Pieza 9 — El circuito: medir primero, juzgar después · 19 de septiembre de 2026


Pieza 1 — El dominio y las leyes intocables
A. Los sustantivos (las piezas del mundo)
Cuenta: el espacio privado de una organización en la plataforma. Hay dos tipos de dueños: un carrier o un cliente corporativo. Como una cuenta propia: cada quien ve sólo lo suyo. La cuenta de un carrier funciona sola, sin que nadie contrate la verificación.
Carrier: la empresa que ejecuta el transporte (ej. Juárez Bus). Tiene su(s) propia(s) ubicación(es)/geocerca(s). Atiende a varios clientes y plantas.
Cliente corporativo: la empresa que contrata el servicio (ej. Tecma). Sus plantas operadoras son las que lo reciben. Agrupa plantas y ve todas las suyas.
Planta (operadora): la instalación que recibe el servicio (ej. Tecma planta 47). Ve sólo lo suyo.
Grupo de plantas / campus / parque industrial: un conjunto de plantas que pueden compartir un mismo servicio del mismo carrier (ej. plantas 3 y 24 en el campus Santos Dumont). Una planta puede pertenecer a un grupo o ir sola.
Geocerca: la frontera física y de evidencia de un lugar. Tiene dueño (una planta, o un carrier) y un rol (destino, base del carrier, caseta…). No es un atributo suelto.
Unidad: el vehículo. Tiene identidad estable propia; es evidencia de ejecución, no el servicio; puede cambiar de dispositivo. Su identidad rica (documentos, cumplimiento legal) vive en su expediente, dentro de J-Telemetry (Pieza 6 §H), igual que la del chofer.
Dispositivo (GPS): el aparato de rastreo puesto en una unidad en cierto momento. Es intercambiable. La evidencia entra por el dispositivo que la unidad traiga puesto en ese momento.
Chofer: la persona que opera. Su identidad rica (documentos, cumplimiento legal) vive en su expediente, dentro de J-Telemetry (Pieza 6 §H); no bloquea nada.
Ruta (KML/KMZ): el recorrido que el cliente exige que se cumpla. Es política del cliente y un factor de verificación; no es activo del carrier ni del producto. Siempre vive dentro de un turno: la misma ruta (mismo nombre) puede existir en varios turnos, y su KML pertenece a la combinación ruta × turno. No es fija de por vida: cambia con la rotación de empleados, así que es modificable; los hechos pasados quedan atados a la versión vigente cuando ocurrieron.
Turno: una variable propia del servicio, definida por cada cliente en su contrato (no es uniforme entre clientes). Un turno tiene su hora y su deadline; el deadline suele ser la hora en que el personal debe estar en sitio, que puede ser antes del inicio del turno (ej. estar a las 6:45 para una entrada de 7:00).
Política / deadline: las reglas de tiempo y tolerancia — umbrales de temprano/a tiempo/tarde, gracia, y cuándo se genera la verificación.
Contrato de servicio: la raíz de negocio que une carrier + cliente corporativo + planta o grupo de plantas + política. Pertenece a una cuenta.
Perfil de servicio: el contrato ya concreto — con su geocerca, su ruta, su turno y su conjunto de unidades posibles.
Ocurrencia de servicio: un servicio esperado con fecha, generado de un perfil (y por lo tanto de su contrato).
Evidencia: las observaciones de GPS/telemetría de una ventana de tiempo. Puede estar disponible, parcial, en espera o indisponible.
Hecho de cumplimiento: la única verdad guardada de una ocurrencia — qué unidad se observó, llegando dónde y cuándo, qué tanto coincide con ruta y destino, con qué evidencia, si se cumplió o no, a tiempo o no, si requiere revisión. Todos leen este mismo hecho.
Compuerta de atención (soporte): la vía interna del operador de la plataforma para entrar a diagnosticar y resolver una falla de un cliente, respetando datos personales y sin alterar la verdad guardada.


B. Cómo se relacionan (la forma)
Una cuenta contiene lo de una organización (un carrier o un cliente); cada quien ve sólo lo suyo.
El carrier no necesita contrato para usar su producto de flota; vale por sí solo.
Un carrier atiende a varios clientes y plantas; un cliente puede tener varios carriers. Se unen a través de contratos.
Un contrato = un carrier + un cliente + una planta o un grupo de plantas + una política.
Un servicio compartido por un grupo/campus tiene un hecho compartido, visible para las plantas de ese grupo, no para otras.
El servicio esperado concreto = una ruta dentro de un turno + destino + política, en una fecha. Turno y ruta son variables separadas; la ruta vive dentro del turno.
Un perfil concreta un contrato con ruta × turno + geocerca + política + unidades posibles.
Una ocurrencia = un perfil en una fecha (pertenece también a su contrato).
Un hecho = el resultado verificado de una ocurrencia.
La evidencia entra por el dispositivo de una unidad en un momento; se resuelve a la unidad por la asignación vigente en ese momento.


C. Las leyes intocables (la definición de "correcto")
El servicio no es la unidad. El servicio lo define el contrato/perfil (lo esperado). La unidad sólo es evidencia de quién lo ejecutó.
La verdad se calcula una vez y se guarda. Se arma el hecho, y todos leen ese mismo hecho. Nadie recalcula su propia verdad.
Esperado y observado nunca se mezclan. Destino esperado vs. observado; unidad de referencia vs. observada. Siempre separados.
"Sin evidencia" no es "no se cumplió". Falta de datos = en espera o indisponible, jamás incumplimiento automático.
El GPS es un dispositivo, no la unidad. La unidad tiene identidad estable; puede cambiar de dispositivo; la evidencia se resuelve por la asignación vigente al momento observado; cambiar dispositivo no reescribe el historial.
Ruta y turno son variables separadas, definidas por el cliente en el contrato. La ruta vive dentro de un turno; la misma ruta puede existir en varios turnos, y el KML pertenece a la combinación ruta×turno. Todo es modificable (rota con los empleados); los hechos pasados quedan atados a la versión vigente.
La geocerca pertenece a su dueño y es frontera de evidencia. Llegar a otra geocerca no cumple el servicio, salvo que el contrato lo permita.
Multi-cuenta. Los datos de JB o de Tecma son configuración de una cuenta, no el producto. Cada cuenta ve sólo lo suyo.
El carrier no depende de un contrato. Su producto de flota vale por sí solo. La verificación es una capa que se enciende cuando hay contrato carrier↔cliente.
Visibilidad. Una planta ve sólo lo que está dentro de su contrato. El cliente corporativo ve todas sus plantas. El carrier ve su flota.
Datos y privacidad. Se protegen datos personales/sensibles hasta el mínimo que la ley exige. La data procesada de la operación es de la empresa (la plataforma) y así se estipula en el contrato.
Un servicio cumplido siempre tiene unidad observada. No puede existir una hora de llegada sin una unidad observada detrás.
La verificación no se calcula al abrir una pantalla. Se genera sola tras el deadline, y cuándo se genera es configurable por contrato (justo al deadline, o con la gracia que cada cliente prefiera por clima/tráfico/historial). Las pantallas sólo leen el hecho ya guardado.
El producto siempre debe poder soportarse. Existe una compuerta interna para diagnosticar y resolver fallas, respetando datos personales y sin alterar la verdad guardada.
Un dato correcto puede volverse una afirmación falsa según dónde se lea, cómo se agrupe, sobre qué universo hable, de qué color se pinte, cuántos valores se hayan colapsado para producirlo, o qué cosa se haya contado. El valor guardado siendo correcto no basta: lo que el usuario recibe es la afirmación completa, y esa la arman también el lugar, la agrupación, el alcance, el color, la reducción y la unidad. Ver la sección D.
Y lo que el sistema no midió no se dibuja, aunque quede feo. Una pantalla que completa lo que le falta se ve mejor que una que admite el hueco, y por eso la tentación de completarlo es permanente. Ver la sección E.
Y probar no es mentir. Lo prohibido es inventar un dato y presentarlo como real; no lo está montar un espacio aparte con datos de verdad. Confundir las dos cosas paraliza la construcción sin proteger a nadie. Ver la sección F.
Idioma nativo del sistema: español.


D. Cuando un dato correcto miente

Esta sección existe porque el mismo error apareció cuatro veces en un solo piloto de interfaz, y las cuatro veces el valor guardado era correcto. Ninguna se detectó compilando ni leyendo el código: se detectaron mirando la pantalla contra la ley. El quinto caso llegó después, construyendo el inicio corporativo, y el sexto construyendo el expediente del contrato; los dos se detectaron igual: mirándolos.

La forma corta de toda esta sección, y conviene reconocerla de lejos: **correcto como consulta, falso como afirmación.** La consulta hizo exactamente lo que se le pidió. Lo que miente es el título de encima.

Es la clase de falla que más le cuesta a un árbitro. Un motor que calcula mal se arregla y se vuelve a sellar. Un motor que calcula bien y se muestra mal produce una afirmación falsa con toda la autoridad del sello detrás — y el auditado no tiene cómo distinguirlas.

Los seis casos, con lo que hacía falsa cada afirmación:

1. Unidades ya llegadas marcadas "sin señal". El dato era la antigüedad del último punto GPS, correcta al minuto. Pero la traza se corta al entrar a la geocerca porque la geocerca es la frontera de la evidencia: el silencio posterior es la ley funcionando, no una unidad callada. Once de catorce unidades acusaban al carrier de perder señal justo donde el sistema deja de mirar a propósito. Lo falso lo puso el LUGAR donde se leyó el dato.

2. "Sin verificar" mostrado como cuarta tarjeta junto a los tres resultados. El conteo era correcto. Pero puesto al lado de cumplido, no cumplido y pendiente por evidencia, se lee como un cuarto veredicto — y no lo es: es ausencia de veredicto, el motor todavía no juzga ese servicio. Lo falso lo puso la AGRUPACIÓN.

3. Agregados recalculados sobre el filtro. Al filtrar a "cumplido", la tarjeta "No cumplidos" mostraba 0. El 0 era correcto para el conjunto filtrado, y falso como afirmación sobre el periodo, que es lo que una tarjeta de agregado afirma. Un agregado dice la verdad del periodo completo siempre; el filtro es una lente sobre la tabla, no sobre los hechos. Lo falso lo puso el ALCANCE.

4. El motivo "temprano" pintado en ámbar. La medición era correcta: llegó diez minutos antes. Pero el ámbar está reservado a los motivos con costo, así que pintarlo ámbar le imputa al carrier un cargo que el contrato no le pone. Lo falso lo puso el COLOR.

5. La tira de días pintada del peor resultado de cada día. El dato era correcto y además era un hecho: el peor resultado de ese día. Pero con cuarenta y ocho servicios diarios, "el peor resultado" es rojo casi siempre — un día de veintisiete cumplidos contra veintiuno quedaba idéntico a uno de diez contra treinta y ocho. La tira existe para comparar de un vistazo entre sitios y entre días, y la agregación borró exactamente la información que la tira iba a dar: los dos sitios se veían iguales. Lo falso lo puso la REDUCCIÓN — cuántos valores se colapsaron en uno, y con qué regla.

Este caso se distingue del segundo aunque suenen parecidos. En el segundo, cada conteo seguía siendo legible y lo falso venía de junto a qué se puso. Aquí el problema es anterior a colocarlo: al reducir muchos valores a uno se eligió una regla —el peor— que descarta la magnitud, y ninguna colocación posterior podía devolverla. La pregunta que lo atrapa es **qué se pierde al colapsar**, y si lo que se pierde es justo lo que el elemento existía para mostrar. Cuando el dato de un día es una proporción, el elemento muestra la proporción.

6. "Rutas del alcance: 27" en el expediente del contrato. El conteo era correcto: veintisiete registros de ruta cuelgan de ese contrato. Pero en la tabla de abajo "Finca" aparecía dos veces y "Km 30" tres, porque son registros distintos —con trazados distintos— que comparten nombre visible. Quien lee cuenta nombres, no filas, y no le cuadra: o el sistema duplica rutas, o el conteo miente. Ninguna de las dos cosas es cierta, y esa es exactamente la clase de duda que le cuesta el producto a un árbitro. Lo falso lo puso la UNIDAD — qué cosa se contó, frente a qué cosa cree el lector que se contó.

El arreglo no fue deduplicar. Deduplicar por nombre habría borrado rutas reales y habría producido un número más bonito y más falso. Un contrato no se contrata en rutas: se contrata en servicios al día —un perfil por ruta, turno y destino—, y esa es la unidad que las dos partes reconocen. El alcance pasó a medirse ahí, con las rutas y los turnos como lectura al lado. La pregunta que atrapa este caso: ¿puede el lector reconstruir este número con lo que le estoy enseñando debajo? Si no puede, o la unidad está mal elegida o falta la lectura.

Lo que esto exige al construir:

Cada dato que llega a una pantalla se pregunta no sólo si es correcto, sino qué afirma ahí: al lado de qué queda, sobre qué universo habla, qué dice el color que se le pone, —si resume a varios— qué se perdió al resumirlos, y qué cosa cuenta frente a qué cosa va a creer el lector que cuenta. Un dato correcto en el lugar equivocado no es un detalle de presentación — es el árbitro mintiendo.

Sobre las pruebas, con precisión: ninguna prueba unitaria ENCUENTRA estos casos, porque no hay valor equivocado contra el cual comparar. Pero una vez encontrados, sí se pueden CERCAR, y los cinco están cercados: cuatro con pruebas que fallan si el error vuelve, y el del agregado con una valla de tipos — lo que sale del filtro va marcado y la función que cuenta el periodo se niega a recibirlo, así que repetirlo deja de compilar.

El quinto muestra el límite de la valla: la prueba fija que un día mixto conserva sus cifras separadas, así que nadie las vuelve a colapsar al construir los datos. Pero **la decisión de con qué regla se pintan vive en la pantalla**, y ninguna prueba de datos la alcanza. Ese sigue dependiendo de mirar.

El sexto no tiene valla, y conviene decirlo en vez de fingir que la tiene: el conteo era correcto en la base y el desajuste sólo existía frente a la tabla que iba debajo. Ninguna prueba de datos ve eso, porque no hay dato equivocado — hay un rótulo mal elegido. Lo único que lo previene es la pregunta de arriba, hecha al escoger la unidad y antes de escribir el rótulo.

Esa diferencia importa al elegir la valla. El caso del agregado no vivía dentro de la función —contar siempre contó bien— sino en el sitio de llamada, y eso ninguna prueba sobre una función pura lo ve. Cuando el error está en quién llama y no en qué hace, la valla es el compilador.

La regla completa: la revisión contra la ley es lo único que los descubre; la valla es lo que impide que regresen. Las dos hacen falta, en ese orden, y nunca al revés.


E. Lo correcto puede verse peor que lo falso

Una traza continua es más bonita que una traza rota.

El caso que lo enseñó salió del Workbench. El lienzo dibujaba el recorrido de una unidad como una sola línea, y esa línea atravesaba los huecos de señal: entre el último punto de una noche y el primero de la mañana siguiente quedaba una recta limpia cruzando la ciudad, dibujada con el mismo brillo que la evidencia de verdad. Sobre un rango de cinco días eran varias. El mapa se veía impecable, y estaba afirmando un camino que nadie observó.

La versión correcta corta la línea en cada hueco y marca el hueco aparte. Se ve interrumpida. Y esa fealdad es la forma real de la evidencia: hubo horas en las que nadie vio nada, y el mapa lo admite.

La consecuencia práctica, que es lo que hace falta escribir: cuando la versión honesta se ve peor que la falsa, la tentación de "arreglarla" no es un error de una vez — es un riesgo permanente. Alguien va a proponer suavizar la traza, rellenar el hueco, interpolar el punto que falta o completar la línea, y va a sonar razonable, porque el resultado se ve mejor. No es mala fe: una pantalla rota parece un defecto de la pantalla.

La prueba que lo resuelve, y se aplica antes de dibujar: ¿esto que estoy por dibujar lo midió el sistema, o lo estoy completando yo? Si es lo segundo, no va — por bonito que quede.

Por qué esto no lo atrapa ninguna prueba, y aquí se distingue de la sección D: en D el dato es correcto y engaña por dónde queda. Aquí el dato ni siquiera existe — se está inventando para tapar un hueco, y el invento se ve mejor que el hueco. **El error no se veía como error: se veía mejor.** Lo atrapó mirar el mapa y preguntarse por qué un camión cruzaba la ciudad en línea recta a las tres de la mañana.

La valla, cuando la hay, es la misma que en D: una vez encontrado el caso se cerca. La traza partida en tramos observados tiene su prueba, y la parada cortada por hueco de señal también. Lo que ninguna valla cubre es la próxima vez que lo honesto se vea peor en otro lugar de la pantalla.


F. Dónde se prueba sin mentir

Esta sección no cambia ninguna ley. Le escribe su alcance, porque el alcance faltaba y esa falta empezó a costar.

Las secciones D y E prohíben una sola cosa dicha de dos maneras: **no afirmar lo que no se midió.** D lo prohíbe cuando el dato existe y engaña por dónde queda; E lo prohíbe cuando el dato no existe y se completa para que la pantalla se vea entera. Las dos son sobre no mentir.

De ahí se derivó, sin decirlo nunca en voz alta, una tercera regla que nadie escribió y que no se sigue de las otras dos: que no se puede montar nada para probar. Y ésa sí paraliza. Un frente entero se queda esperando fierro en la calle porque construir un espacio de pruebas «se sentía» como violar la ley, cuando la ley no dice eso.

**Lo prohibido, y no se negocia:** inventar datos y presentarlos como reales. Camiones que no existen, posiciones generadas, hechos sembrados que se leen igual que los sellados, un número que sale de un generador y entra a una pantalla sin decir de dónde vino. Eso es exactamente la falta de D y de E, y sigue prohibido en cualquier ambiente y para cualquier propósito, incluido «es solo para probar».

**Lo permitido, y hay que decirlo porque el silencio lo volvió prohibido:** un espacio separado con datos de verdad. Dos formas, las dos ya construidas:

La **rama desechable de la base** (`DATABASE_URL_TEST`), que es donde vive todo lo que escribe. Ya es ley del `Procedimiento-Migraciones`, por su propia razón —que ninguna prueba toque a un cliente vivo— y esta sección sólo la nombra como lo que también es: el lugar donde sí se puede.

Y el **circuito creado y no publicado**, que es la forma nueva y la que faltaba nombrar. Un circuito sin `published_at` existe, se le sube su trazado, se le ponen paradas, se le asignan unidades reales y se prueba de punta a punta contra camiones reales moviéndose — y para la app del pasajero **no existe**: el endpoint público contesta lo mismo que para un slug inventado. No es un modo de demostración ni una bandera que alguien pueda olvidar apagada: es ausencia de publicación, y publicar es un acto explícito.

**Por qué esto no es una rendija.** Un espacio de pruebas con datos reales no puede producir una afirmación falsa, porque no afirma nada hacia afuera: nadie lo lee. El daño de D y de E siempre es un daño a quien recibe la afirmación —el auditado, la planta, el pasajero—, y donde no hay receptor no hay afirmación. La rendija sería la contraria: un ambiente que sí publica y que se disculpa con «era de prueba». Eso lo cierra la misma regla de siempre — el hecho sellado y la pantalla pública no distinguen ambientes, y por eso el ambiente se distingue antes, no después.

**La forma corta, para cuando alguien dude:** ¿esto que voy a montar va a producirle a alguien una afirmación que el sistema no midió? Si sí, no va, sea cual sea el ambiente. Si no, no hay nada que pedir permiso — móntalo con datos reales y pruébalo.

Cómo se usa este documento
Esta pieza es fuente de verdad para el dominio y las leyes. Las siguientes piezas (las dos caras del producto, y las reglas de verificación) colgarán de aquí. Los documentos viejos quedan archivados y no se editan.


Pieza 2 — Las dos caras del producto
La forma general
Un mismo cimiento (el hecho de cumplimiento), y encima dos lados que leen su parte del mismo hecho, más el operador de la plataforma (ustedes). Nadie recalcula verdad; cada quien ve su parte. El carrier además tiene su producto de flota que vale aunque no haya contrato.


Lado 1 — Cliente (verificación / cumplimiento)
Se enciende cuando existe un contrato carrier↔cliente. Tiene dos actores:

Corporativo (el que contrata):

Ve todo lo de todas sus plantas: cumplimiento, historial, evidencia, reportes, excepciones.
Señales derivadas: ausentismo contra la lista de la ruta, alertas de faltas importantes.

Planta operadora (la que recibe el servicio):

Ve sólo lo de su planta (limitado a su contrato); nunca lo de otras plantas.
Es la interesada en las inspecciones (ver zona compartida abajo).

Ambos hacen:

Revisar cumplimiento e historial y ver la evidencia detrás de cada servicio (ruta×turno, fecha).
Recibir notificaciones (tarde, sin evidencia, requiere revisión, reporte listo).
Apoyarse en el hecho para penalizaciones y reembolsos (ej. el "No Show" o el retraso de 10 min de Honeywell: el hecho respalda el descuento).

No ven:

La operación interna del carrier (sólo su parte del hecho), ni datos personales protegidos, ni lo ajeno.


Lado 2 — Carrier (gestión y auditoría de flota + verificación)
Funciona sin contrato; la verificación es una capa extra que se enciende cuando hay contrato.

Ve:

Su flota: unidades, dispositivos, recorridos y kilómetros.
Cargas de combustible/diésel, rendimiento histórico.
Uso de unidades en horario no autorizado.
Choferes y unidades con su cumplimiento (licencias, médicos, capacitación; antigüedad, cinturones, GPS…). (Identidad rica en su expediente, Pieza 6 §H.)
Cuando hay contrato: el cumplimiento de sus servicios, con más detalle operativo que el cliente.

Hace:

Auditar y gestionar su flota y operaciones.
Dar de alta unidades, dispositivos y choferes.
Generar reportes: para sí mismo y los que debe entregar al cliente (GPS, distancia por unidad, cargos por ruta, lista de choferes, mantenimiento).
Actuar sobre alertas (mantenimiento vencido, anomalía de combustible, uso no autorizado).
Capa programable: activar funciones derivadas de sus datos (emisiones por litros/km, gastos no aprobados, detección de anomalías). Va sobre la base, después.

No ve:

Datos de otros carriers ni de clientes que no le corresponden.


Zona compartida
Un mismo hecho: cliente y carrier leen el mismo hecho de cumplimiento, cada quien su parte. Nadie recalcula; la verdad es una sola y ya guardada.
Inspecciones (compartidas): la planta operadora las lleva a cabo — audita el servicio, las unidades, los choferes y la documentación de cumplimiento/legal. El carrier es el auditado: mantiene y provee la evidencia (y las usa para su propio mantenimiento). Ninguna de las dos caras es "dueña" única de la inspección.


Lado 3 — El operador de la plataforma (ustedes)
Compuerta de atención: entrar a diagnosticar y resolver una falla de un cliente, respetando datos personales y sin alterar la verdad.
Altas y demos → contrato: dar de alta cuentas nuevas y montar demos sin tocar código; cuando les gusta, contratan el servicio.
Servicio operado (outsourcing): opción de que ustedes operen la gestión de flota y/o el enforcement de la verificación, para quien prefiera no hacerlo por su cuenta.
Administración de la plataforma multi-cuenta.


Anotado para una pieza futura
Usuarios, roles y jerarquía dentro de cada cuenta. Existe jerarquía (no todos los usuarios de una cuenta ven/hacen lo mismo). Va en su propia pieza, después de la Pieza 3, para no revolverlo aquí.


Reglas de esta pieza
Cada cara lee, no recalcula: la verdad es el hecho ya guardado.
El carrier existe sin contrato; el cliente necesita contrato.
Visibilidad: corporativo ve todas sus plantas; planta operadora sólo la suya; carrier su flota; nadie ve lo ajeno.
Las inspecciones son compartidas (planta audita, carrier provee).
Todo lo derivado (ausentismo, emisiones, fraude…) va sobre la base — primero la base.


Pieza 3 — Las reglas de verificación
La pregunta que responde
Para cada servicio esperado (ruta×turno, en una fecha — una sola identidad): ¿se cumplió, y por cuál unidad? El resultado es el hecho de cumplimiento (se guarda una vez; todos lo leen).


Los insumos
Lo esperado (del contrato/perfil): la ruta×turno (que ya incluye su destino y su recorrido), el deadline, la política del contrato (tolerancia, excepciones, qué tan estricto, consecuencias) y las unidades posibles.

Lo observado (de la evidencia GPS): qué unidad se ve sirviendo esa ruta×turno, a qué hora y con qué recorrido.


Las reglas, en orden (se resuelven solas, por dentro)
Cada viaje tiene su propio ID de evidencia. El servicio (ruta×turno×fecha) es una sola identidad; su ejecución es un viaje con su ID, y de ahí cuelga toda la auditoría.
¿Hay evidencia para ese viaje? Si falla el GPS/dispositivo → pendiente por evidencia (el único "no claro" que ve el cliente). Nunca se declara incumplimiento por falta de datos.
¿Una unidad sirvió esta ruta×turno? El destino es parte de la ruta (la ruta ya dice a dónde va), así que es una sola pregunta, no varias. La unidad que la sirvió es la unidad observada (la verdad). Qué tan estricto se mide —recorrido KML completo, o sólo llegada al destino— lo decide el contrato.
¿Dentro del deadline + tolerancia del contrato? → temprano / a tiempo / tarde. (Tecma: 5 min; Honeywell: 10 min.)
Si llegó tarde, ¿es excusable? Se marca (lluvia/nieve, marchas, obstrucción, falla mecánica, ponchadura, obra sin aviso). Automatizar esta detección a nivel sistema queda para una versión futura.

Si ninguna unidad sirvió la ruta×turno → no cumplido, sin especular a dónde se fue una unidad ajena (eso vive en el ledger).


Salida decisiva, no ruido
El valor del sistema es que decide solo. Al cliente le llega lo esencial:

Los servicios cumplidos, con la unidad que los cumplió.
Los servicios no cumplidos.
Y como único "pendiente": los de falla de evidencia (GPS/dispositivo caído).

Todo el razonamiento interno —unidad planeada vs. observada, si una unidad se fue a otro lado, el emparejamiento de candidatas— no se le muestra al cliente como ruido. Vive en el ledger (bitácora de auditoría, anclada en el ID de cada viaje).

Del ledger salen métricas limpias que sí importan, por ejemplo el % de viajes hechos con la unidad planeada.


Estados
Cara del cliente (decisivos): cumplido · no cumplido · pendiente por evidencia.
En el hecho / ledger (interno): unidad observada, planeada vs. observada, recorrido, tarde-excusable, y el porqué. Se guarda todo — pero no se surte como ruido.


Las consecuencias (verificación vs. enforcement)
La verificación produce el hecho (la verdad). El enforcement se apoya en él, según cada contrato:

Tecma: retraso > 5 min no excusable → no se paga ese viaje.
Honeywell: retraso > 10 min / "No Show" → rebate (2% por dos al mes, +1% cada uno) y reembolso.

El producto puede soportar o automatizar ese enforcement (y ustedes pueden operarlo como servicio si el cliente hace outsourcing).


Todo es configurable por contrato
Tolerancia (5, 10 min…), excepciones excusables, qué tan estricto se mide la ruta (KML completo o sólo llegada), variantes de trazado aceptadas, la consecuencia (no-pago, rebate…), y cuándo se materializa el hecho.


Las leyes de verificación (intocables)
El sistema es decisivo y automático. Sólo la falla de evidencia (GPS/dispositivo) llega al cliente como "pendiente"; el razonamiento fino vive en el ledger.
El servicio es una sola identidad (ruta×turno×fecha). El destino es parte de la ruta; no hay un "eje de destino" aparte.
Cada viaje tiene su propio ID de evidencia; la auditoría deriva de ahí.
La unidad observada es la verdad; la de referencia es sólo plan.
Sin evidencia ≠ incumplimiento.
Tarde-excusable ≠ incumplimiento penalizable. (Su detección automática es tema de una versión futura.)
Cada contrato define su tolerancia, su consecuencia y qué tan estricto se mide la ruta.
El hecho se calcula una vez y se guarda; verificación, reportes y notificaciones lo leen igual.
La verificación produce la verdad; el enforcement se apoya en ella.
El árbitro puede cerrar un caso sin pruebas, y cerrarlo es parte de juzgar. (3.10, enmienda del 19 de septiembre de 2026 — ver abajo.)


3.10 — El árbitro que se rinde · enmienda del 19 de septiembre de 2026
Qué resuelve. Un árbitro que no puede cerrar un caso sin pruebas nunca se va del estadio. Medido en producción el 19-sep: 4 163 318 re-verificaciones sobre 1 008 servicios —hasta 17 637 sobre uno solo, una por minuto durante doce días— porque el motor pedía evidencia que ya no podía llegar y nada lo detenía. Ningún servicio que sí se pudo juzgar necesitó más de un intento (mediana y p90 = 1 sobre 381 sellados): reintentar nunca cambió un veredicto.

3.10 El árbitro puede cerrar un caso sin pruebas. Cuando el plazo venció y la evidencia no llegó en un tiempo razonable, el sistema sella «sin evidencia posible» y deja de preguntar.

3.10a Cerrar no es condenar. El veredicto sigue siendo pendiente_evidencia: sin evidencia ≠ incumplimiento (ley intocable de arriba), y esta afirmación NO crea un cuarto veredicto. Lo que se cierra es la espera, no el juicio. La cara del cliente no cambia.

3.10b La imposibilidad se mide contra la ventana, no contra la historia. La pregunta no es cuándo empieza la historia del transportista, sino si ESTA ventana todavía puede recibir algo. Se contesta con la marca de agua del archivador: si ya tiene dato más nuevo que el fin de la ventana y dentro de la ventana no dejó ni un punto, esa ventana ya se cerró vacía y se cierra el caso. Si el archivador todavía no alcanza la ventana, se espera — eso sí se resuelve solo. Preguntar por el primer dato de toda la historia del transportista mata la regla en cuanto exista un punto viejo de cualquier origen, y así estuvo muerta hasta hoy.

3.10c El plazo en días es respaldo, no regla principal. Sirve para cuando no hay marca de agua con la cual afirmar nada. Sin marca de agua no se cierra por esta vía: la ausencia declarada vale más que una causa verosímil.

3.10d Es reversible, y por eso se puede cerrar tranquilo. Si después aparece la evidencia —un relleno de huecos, un archivador que se puso al día, una re-verificación pedida por una persona— el caso se vuelve a abrir y se juzga. Cerrar sin pruebas es dejar de preguntar, no borrar la pregunta.

3.10e Lo que se cierra queda dicho, con su razón y su cuenta. En el expediente consta qué se intentó, cuántas veces, desde cuándo y hasta cuándo, y por qué se dejó de intentar. Un cierre callado sería indistinguible de un olvido. El conteo de intentos es estado del viaje, no entradas del ledger: la bitácora existe para ser la historia, y una historia no se reescribe.


Pieza 4 — Usuarios, roles y accesos
La idea en una frase
Cada persona que entra tiene un rol (qué puede hacer) y un alcance (sobre qué datos). Permisos = rol × alcance. Separar esas dos cosas es lo que mantiene todo limpio.


Los tres conceptos
Usuario: una persona que entra; pertenece a una cuenta.
Rol: qué puede hacer (ver, configurar, aprobar, generar reportes, administrar usuarios, dar soporte…).
Alcance: sobre qué datos puede hacerlo (toda la cuenta, una planta, una flota, un contrato…).

El mismo rol con distinto alcance da permisos distintos.


Roles por tipo de cuenta
J-Staff (operador de la plataforma — ustedes)
Admin de plataforma: administra todo, da de alta cuentas, arma demos.
Soporte: usa la compuerta de atención (diagnostica/arregla), respetando datos personales y sin alterar la verdad.
Comercial: monta y presenta demos que luego se vuelven contrato.
Cuenta cliente (corporativo + plantas operadoras)
Admin corporativo: ve todas sus plantas; administra los usuarios de su cuenta.
Usuario de planta operadora: ve sólo su planta. Con roles funcionales como los de tus contratos:
coordinación de rutas (POC / Employee Services),
cumplimiento y penalizaciones (HR),
inspecciones (HSE),
contrato y escalaciones (Procurement).
Escalación configurable: distintos temas van a distintos roles (lo de Procurement no le toca al supervisor, etc.), tipo la escalera de Honeywell: aviso → supervisor → gerente → HR → Procurement → terminación.
Cuenta carrier
Admin carrier: ve toda su flota y operaciones; administra sus usuarios.
Coordinador: organiza rutas, turnos, unidades, dispositivos y choferes.
Despacho (opcional): monitoreo en vivo — puede no existir, porque el sistema lo hace en automático. (Ese es el punto del producto.)
Mantenimiento: bitácora e inspecciones.
Chofer: acceso mínimo (su identidad rica vive en su expediente, Pieza 6 §H).


Usuarios futuros (vía jrz-pass)
Pasajero: usuario a futuro; su identidad vivirá en jrz-pass. Marca su abordaje, y de ahí sale por adelantado el ausentismo de los trabajadores de la planta.
Aspiración: que con el tiempo todas las identidades (choferes, pasajeros, etc.) lleguen a vivir en jrz-pass. (A futuro; no bloquea nada hoy.)


Las leyes (intocables)
Permisos = rol × alcance. Qué puede hacer y sobre qué datos son cosas separadas.
El alcance nunca rompe la visibilidad de las Piezas 1 y 2: una planta jamás ve otra planta; un carrier jamás ve otro carrier; el cliente jamás ve la operación interna del carrier.
Las cuentas son privadas. Nadie cruza entre cuentas — salvo J-Staff por la compuerta de soporte, respetando datos personales y sin alterar la verdad.
Toda acción sensible queda en el ledger (quién hizo qué y cuándo).
Un usuario pertenece a una cuenta; J-Staff es aparte.
Roles, alcances y escalaciones son configurables — no vienen fijos.


Pieza 5 — La forma de la suite
Por qué existe esta pieza
Las Piezas 1 a 4 definen el árbitro: el dominio, quién ve qué, cómo se verifica y quién entra. No dicen qué se construye encima. Esta pieza lo dice.

Se escribió después de leer contratos reales de dos extremos del mercado: uno que no menciona GPS y tiene una sola regla de puntualidad, y otro con GPS obligatorio, catálogo de penalizaciones con reincidencia mensual, reportes y auditorías. Los dos caben en el mismo producto porque todo umbral es configuración del contrato. Lo que los dos destaparon es que el árbitro solo no es la suite.


La ley que gobierna esta pieza
Penalizar al transportista no es el modelo de negocio. Los contratos están escritos en tono punitivo porque son documentos de la planta protegiéndose; eso describe qué duele, no qué construir. Un producto cuyo valor crece con las faltas del carrier se destruye solo conforme el servicio mejora, y aliena a la mitad del mercado. El valor está en eliminar fricción operativa: facturar con respaldo, no perder papeles, esquivar la penalización antes de que ocurra, y planear mejor.


A. Los tres horizontes
Un solo cuerpo de hechos sellados alimenta tres productos, distinguidos por el tiempo al que miran.

El pasado — el estado de cuenta. La verdad compartida de un periodo, en tono neutral: cuántos servicios, cómo se ejecutaron, qué se justificó, qué quedó pendiente. El carrier lo usa para facturar con respaldo; el cliente para pagar sin discutir. Cuando el contrato define penalizaciones, la aritmética es un renglón derivado del documento, nunca su propósito.

El presente — lo preventivo. Avisar antes de que el hecho se selle, cuando todavía se puede actuar: la unidad que va a llegar tarde y hay tiempo de mandar respaldo, el dispositivo cuya emisión viene degradándose y va a producir pendientes, el documento por vencer, la ruta que lleva semanas llegando con minutos de margen. Los contratos suelen dar ventanas de gracia (avisar con horas de anticipación, reponer unidad en minutos) que solo se aprovechan si alguien avisa a tiempo. Lo preventivo convierte cláusulas punitivas en cláusulas esquivables.

El futuro — la planeación. Un espacio de ensayo donde se dibujan, parten, unen y prueban rutas contra los tiempos reales medidos, con las restricciones del contrato como reglas del juego. Los contratos ya piden esto como entregable del carrier (reingeniería de rutas, datos de uso por parada) y hoy ningún carrier tiene con qué producirlo.


B. Los dos afluentes del hecho
No todo lo que un contrato regula lo puede ver la telemetría. Uniforme, botiquín, extintor, cinturones, la inspección física mensual de la unidad: nada sale del GPS. Son hallazgos humanos registrados por una inspección.

Por lo tanto el estado de cuenta tiene dos afluentes: lo que el árbitro sella con evidencia GPS, y lo que una persona registra en una inspección o en un expediente documental. Los dos desembocan en la misma cuenta del periodo. Ninguno de los dos manda sobre el otro; son de naturaleza distinta y así se muestran.


C. El expediente
Lo penalizable que ningún GPS ve, y lo que hace que a un carrier le suspendan pagos completos sin haber llegado tarde una sola vez: pólizas y permisos con su vencimiento, exámenes y capacitaciones con su periodicidad, mantenimiento firmado, inspecciones físicas con su evidencia.

El expediente es del carrier y el cliente ve su espejo — porque en los contratos reales el cliente queda expuesto si su transportista incumple obligaciones patronales o legales. Esto es coherente con la zona compartida de la Pieza 2: la planta audita, el carrier provee. El expediente es donde vive esa evidencia.


D. Las justificaciones
Los contratos reconocen causas que excusan un retraso: lluvia que inunda, marcha, paso de ferrocarril, falla mecánica, obra sin aviso. Hoy eso se resuelve de palabra y el carrier siempre pierde el argumento.

La regla es la siguiente, y no admite excepción: el hecho sellado no cambia. Si la unidad llegó tarde, eso es verdad congelada y así se queda, conforme a la ley de la Pieza 1. Lo que se agrega es una capa adjunta al hecho — la justificación — donde el auditado registra la causa con su evidencia, y donde el propio GPS sirve de respaldo (una unidad detenida largo rato en un cruce es evidencia, no palabra).

El estado de cuenta muestra entonces las tres cosas por separado: el hecho, la justificación, y la consecuencia resultante. Verdad intacta, consecuencia ajustada. Quién acepta una justificación y bajo qué proceso es configuración del contrato, no del producto: los contratos ya traen sus propios mecanismos de disputa y plazos de enmienda.


E. La telemetría base del carrier
El carrier hoy paga a un proveedor de telemetría por lecturas crudas: mapa en vivo, historial de recorridos, kilómetros por unidad, velocidades, geocercas propias, uso fuera de horario. Eso no necesita veredictos, ni contratos, ni hechos sellados.

Por eso la telemetría base cuelga directamente de la capa de captura y no pasa por el árbitro. Es la quinta pieza de la suite del carrier y la que hace que dejar a su proveedor actual no le cueste nada.

Regla de convivencia: la lectura cruda jamás puede contradecir en pantalla a un hecho sellado. Las trazas se cortan en la llegada a la geocerca, en todas las caras y en todos los productos, sin excepción — protege al carrier y al chofer.


F. Cómo queda la suite por cara
Cada cara arma su suite escogiendo piezas de la misma casa. Nadie lee una base de datos distinta.

Carrier: telemetría base, su lado del estado de cuenta con justificaciones, su expediente, lo preventivo, la planeación.
Cliente — planta: su lado del estado de cuenta, lo que requiere decisión, el seguimiento del día, y el espejo del expediente de su carrier.
Cliente — corporativo: el panorama de sus plantas. Comparar, no operar.
Operador de la plataforma: todo, más el razonamiento completo.


Reglas de esta pieza
El árbitro es el cimiento; sin veredicto confiable, nada de lo que va encima vale.
Un solo cuerpo de hechos, tres horizontes: pasado, presente, futuro.
Dos afluentes: lo que sella el árbitro y lo que registra una persona.
El hecho no se reescribe nunca; la justificación se adjunta y la consecuencia se ajusta.
La telemetría base no pasa por el árbitro, y nunca lo contradice.
Penalizar no es el modelo de negocio.
Todo umbral, tolerancia, catálogo de penalización y proceso de disputa es configuración del contrato.


---

# Pieza 6 — Compás, el cimiento de la evidencia

**Estado: RATIFICADA.** Redactada y verificada renglón por renglón por ASAV el 14 de septiembre de 2026, igual que las Piezas 1 a 5. Las 29 afirmaciones quedaron ✓, con una corrección: el tercer lector de 6.8 se llama **app del pasajero de transporte público**, y no "el lado público", porque más adelante existirá también la de transporte especial. Los puntos 6.27 a 6.29 quedan abiertos a propósito: son decisiones pendientes, no afirmaciones sin verificar.

**Por qué existe esta pieza.** El Marco original (6 de julio de 2026) se escribió asumiendo un proveedor de GPS externo: la evidencia "entraba" de Umbrella y el producto empezaba en el hecho de cumplimiento. El 5 de septiembre Umbrella cortó, y J-Telemetry tomó su lugar en la cadena: servidor propio, chips propios, aparatos propios. Al tomar el enchufe de Umbrella se heredó también su obligación — darle al transportista la vista de su flota. Esta pieza escribe lo que el Marco dejó implícito: **la casa tiene cuatro niveles: la operación, Compás, la data organizada y los lectores** (ver la tabla F). Compás es el cimiento de la evidencia, la data organizada el cimiento del valor, y Vernier el primer lector. Lo que cambió el 5 de septiembre es que el extractor ahora es nuestro.

**Qué NO cambia.** Las Piezas 1 a 5 siguen vigentes enteras. **Esta pieza nombra el nivel del extractor y la forma de la casa completa**; no mueve los pisos de arriba. Donde toca un renglón existente, lo dice explícitamente en la sección F.

---

## A. Los sustantivos nuevos

**6.1 Compás.** La infraestructura de telemetría propia de J-Telemetry: el servidor que escucha a los aparatos, los chips que los conectan y el puente que lleva sus posiciones a la base. Es de la plataforma, no de ninguna cuenta. Hay un solo Compás para todos los carriers.

**6.2 Aparato (dispositivo GPS), ampliado.** La Pieza 1 lo define como "el aparato de rastreo puesto en una unidad en cierto momento". Esta pieza le da vida antes y después de eso. Un aparato existe desde que se compra hasta que se da de baja, y pasa por estados: *en caja* → *configurado* → *en el servidor* → *declarado en J-Tel* → *instalado en una unidad* → *dado de baja*. Cada estado es un hecho, no una intención.

**6.3 Identidad y nombre del aparato.** La identidad es el IMEI: único en el mundo, único en la plataforma. El nombre es una etiqueta para humanos, generada por el sistema: marca + modelo + consecutivo global (`TK-FTC927-001`). El consecutivo es de toda la plataforma, no por carrier ni por modelo; se asigna una vez y nunca se reutiliza ni se renumera. El carrier no va dentro del nombre, porque un aparato puede cambiar de dueño.

**6.4 Chip (SIM).** La línea que conecta al aparato. Tiene su propia identidad (ICCID) y su propia vida. Un aparato sin chip es fierro mudo; un chip sin aparato es una línea pagada de más. Se sabe cuál chip va en cuál aparato.

**6.5 Baja.** El fin de servicio de un aparato, con fecha y motivo obligatorios. La fila no se borra: sus puntos, sus asignaciones y los veredictos que se juzgaron con sus datos siguen apuntando a él. Un aparato dado de baja no se sondea, no se cuenta ni se ofrece para asignar; si vuelve a transmitir, el sistema lo dice.

**6.6 Inventario.** La vista de todos los aparatos de un carrier, estén o no en un camión: cuáles hay, cuál está en qué unidad, cuál en bodega, cuál dejó de reportar, cuál está de baja. Es el cuarto que un aparato ocupa mientras no está en una unidad.

**6.7 Cotejo.** La comparación permanente entre lo que Compás oye y lo que J-Tel tiene declarado. Sus desacuerdos son avisos: aparato sin dueño, aparato cuya cuenta lee de otro lado, aparato declarado que Compás no conoce, IMEI en dos cuentas, aparato de baja que transmite.

---

## B. La forma: cuatro niveles

**6.8** Compás es el cimiento de la evidencia. Sobre la data que alimenta —organizada como la describen las Piezas 1 a 5— se apoyan tres lectores:

- **Compás · flota** — el producto del carrier: mapa vivo, historial, playback, expedientes de unidad y de aparato. Vale por sí solo, sin contrato (Pieza 2, Lado 2).
- **Vernier** — la verificación. Se enciende cuando hay contrato carrier↔cliente (Pieza 3).
- **La app del pasajero de transporte público** — lee dónde van los camiones; no juzga nada. Se nombra así, y no "el lado público", porque más adelante existirá también una app del pasajero de transporte especial: son dos lectores distintos, cada uno con su pieza.

**6.9** El flujo es hacia arriba y nunca al revés. Compás produce posiciones; los tres lectores las consumen. Ningún lector escribe en Compás ni recalcula lo que Compás midió.

**6.10** Un solo Compás, muchas cuentas. La conexión al servidor es una para toda la plataforma. A qué carrier pertenece cada aparato lo sabe J-Tel, no el servidor; el muro entre cuentas (Pieza 1.C, Pieza 4) se sostiene en J-Tel, y el servidor no lo necesita conocer.

**6.11** El valor que Compás · flota debe dar es, como mínimo, el que el transportista tenía con su proveedor anterior: ver su flota en vivo y ver por dónde anduvo. Lo hace mejor de tres formas concretas: navegado por expedientes en vez de por mapa suelto; en español; y bajo la Pieza 1 §E (no se dibuja lo que no se midió, no se rellena, no se especula).

---

## C. Las leyes intocables del cimiento

**6.12 El silencio excluye.** Un aparato cuenta para J-Tel sólo cuando alguien lo declara. Que hable con el servidor no lo hace existir; que esté en la lista de compra tampoco. La declaración es un acto humano explícito, aunque el tecleo desaparezca.

**6.13 La identidad es el IMEI; el nombre es etiqueta.** Nada del motor decide por nombre. El nombre puede cambiar; el IMEI no.

**6.14 Un IMEI, una fila.** Cambiar de carrier mueve la fila, no crea otra. Al moverse, se cierra su asignación de unidad, porque el camión era del carrier anterior.

**6.15 La baja no borra.** Lo que existió y trajo datos se marca, no se elimina. Lo que nunca existió —datos de ejemplo, ficciones— se borra, porque borrar una ficción no reescribe historia.

**6.16 El aparato no es la unidad** (Pieza 1.C, reafirmado). Un aparato que no está en un vehículo no tiene unidad, y no se le inventa una para poder verlo. Para eso existe el inventario.

**6.17 Toda alarma tiene que poder llegar a cero.** Un aviso que nunca se apaga no es aviso: entrena a ignorarlo. No hay excepciones permanentes; lo que justifica una excepción es lo que hay que arreglar.

**6.18 Lo que se puede crear se puede corregir desde la pantalla.** Dar de alta, asignar, renombrar, soltar, dar de baja, suspender. Una corrección normal de captura no requiere un desarrollador ni un guion. Un producto donde equivocarse cuesta un desarrollador no es un producto.

**6.19 Nada afirma lo que no comprobó.** Ni una perilla que no llega al fierro, ni un botón que no existe, ni un mensaje que promete una pantalla, ni una revisión que pone verde sin revisar. Es la Pieza 1 §E ("lo que el sistema no midió no se dibuja") aplicada a la interfaz y a la infraestructura, no sólo a los mapas.

**6.20 Los secretos viven en la plataforma, no en las cuentas.** La credencial de Compás es de J-Tel. No se copia cuenta por cuenta.

**6.21 El dueño del dato es quien pone el chip y el destino.** La data que Compás produce es de la plataforma (Pieza 1.C, "Datos y privacidad"). Los datos personales se protegen al mínimo que la ley exige.

---

## D. El alcance del cimiento, y su límite

**6.22** El alcance de Compás · flota lo define lo que la operación real usa, no el catálogo de la competencia. Los proveedores de GPS acumulan quince años de funciones; perseguir paridad es una caminadora sin fin. Compás base es: dónde están mis camiones, dónde estuvieron, qué aparato traen, cuál dejó de reportar, cuánto consumen. Lo demás se gana el lugar cuando alguien de la operación lo pida.

**6.23** Lo que Compás no es: no es un producto para vender GPS a terceros que no sean carriers de la plataforma, no compite en funciones con proveedores de rastreo, y no reemplaza a Vernier como **primer lector**. **Lo que nadie más puede copiar es la operación real produciendo datos, más la forma en que los organizamos**; Vernier es el primer lector que lo cobra. Compás existe para que esa data tenga de dónde salir y para que el transportista no pierda con el cambio de proveedor.

---

## E. Quién opera Compás (extiende la Pieza 4)

**6.24 J-Staff, Lado 3, agrega:** operar Compás — el servidor, los chips, la compra y alta masiva de aparatos (por lista del distribuidor, sin teclear IMEIs), la configuración remota y la medición de capacidad. Subir la lista de compra es un acto de plataforma porque toca el consecutivo global y la unicidad del IMEI entre carriers.

**6.25 Carrier, Coordinador, agrega:** asignar cada aparato a su unidad al instalarlo (es humano a propósito: sólo quien atornilla sabe en qué camión quedó), soltarlo, darlo de baja, y ver su inventario.

**6.26 Quién ve el inventario:** el carrier ve el suyo entero; J-Staff ve todos por la compuerta; el cliente y la planta no ven aparatos — ven hechos.

---

## F. Qué toca esta pieza del Marco existente

Ningún renglón de las Piezas 1 a 5 se borra. Estos se amplían:

| Dónde | Decía | Ahora además |
|---|---|---|
| Pieza 1.A · Dispositivo (GPS) | "el aparato de rastreo puesto en una unidad en cierto momento" | tiene vida antes y después de la unidad (6.2); identidad IMEI y nombre generado (6.3); baja con fecha y motivo (6.5) |
| Pieza 1.A · nuevo sustantivo | — | Compás (6.1), Chip (6.4), Inventario (6.6), Cotejo (6.7) |
| Pieza 2 · La forma general | "Un mismo cimiento (el hecho de cumplimiento)" | el hecho es el cimiento de las caras de verificación; debajo del hecho está Compás, que lo alimenta (6.8) |
| Pieza 2 · Lado 2 · Carrier ve | "unidades, dispositivos, recorridos y kilómetros" | + el inventario de aparatos y su estado (6.6, 6.26) |
| Pieza 2 · Lado 3 · J-Staff | compuerta, altas, demos, outsourcing | + opera Compás (6.24) |
| Pieza 3 · Los insumos | "Lo observado (de la evidencia GPS)" | la evidencia GPS viene de Compás; su calidad es responsabilidad de la plataforma, no de un tercero |
| Pieza 4 · Carrier · Coordinador | "organiza rutas, turnos, unidades, dispositivos y choferes" | + asigna, suelta y da de baja aparatos (6.25) |
| Pieza 4 · Usuarios futuros · Pasajero | "usuario a futuro" | ya existe la app del pasajero de transporte público, que lee de Compás; y se prevé la de transporte especial. Su detalle va en pieza propia (6.8, 6.28) |
| Pieza 5 · Reglas de esta pieza | «El árbitro es el cimiento; sin veredicto confiable, nada de lo que va encima vale.» | **No se contradicen: hablan de pisos distintos de la misma casa.** La casa tiene cuatro niveles. **① La operación**, la fuente: camiones, rutas, contratos, gente. **② Compás**, el extractor; cimiento de la evidencia: sin telemetría propia no hay de dónde leer. **③ La data organizada**: el dominio, el hecho, el expediente; cimiento del valor: es lo que este Marco describe desde julio y lo que hizo construible a Vernier. **④ Los lectores**: Vernier, Compás · flota y la app del pasajero de transporte público; cada uno es una pregunta distinta a la misma data, y es donde el valor se cobra. Vernier es el primero, no el único. «El árbitro es el cimiento» sigue siendo cierto **dentro de la cara de verificación**: ahí, sin veredicto confiable, nada de lo que va encima vale. **La disciplina:** la data organizada es el capital y los lectores son la caja. No se acumula data que ningún lector use, ni se construye un lector que no lea de la misma data. |
| Pieza 5 · §E · La telemetría base del carrier | «cuelga directamente de la capa de captura y no pasa por el árbitro» | **Es Compás · flota** (6.8). **Queda un solo nombre: Compás · flota.** Donde las Piezas 1 a 5 dicen «telemetría base», se lee Compás · flota. Hereda sin cambio todo lo que §E le exige: no pasa por el árbitro, y la lectura cruda nunca contradice en pantalla a un hecho sellado; **las trazas se cortan al llegar a la geocerca, en todas las caras y en todos los productos.** |
| Pieza 5 · §E · lo que enumera la telemetría base | «mapa en vivo, historial de recorridos, kilómetros por unidad, velocidades, geocercas propias, uso fuera de horario» | **Esa lista describe lo que el transportista pagaba a su proveedor**: lo que le debemos, no un compromiso de entregarlo todo de golpe. **El alcance de construcción lo fija 6.22.** Velocidades, geocercas propias y uso fuera de horario entran cuando alguien de la operación los pida, igual que lo demás. |

---

## G. Lo que esta pieza deja abierto (para decidir, no para adivinar)

**6.27** Si Compás · flota se vende por sí solo, a qué precio, y si un carrier puede traer su propio proveedor de GPS en lugar de Compás. Es decisión de negocio, no de arquitectura; el sistema debe permitir las dos respuestas.

**6.28** Las apps del pasajero merecen su propia pieza, y son dos: la de **transporte público**, que ya existe y espera servicio real de la ruta, y la de **transporte especial**, prevista y aún no construida. De cada una: qué lee de Compás, qué no muestra, y cómo se relaciona con los circuitos y con los contratos.

**6.29** La matriz fina de quién ve exactamente qué pantalla (sesión con la operación; ya listada en Notion).

---

## H. El expediente — enmienda del 15 de septiembre de 2026

**Estado: RATIFICADA.** Redactada y verificada por ASAV el 15 de septiembre de 2026. Enmienda a la Pieza 6: agrega un sustantivo (6.30–6.33) que el Marco ya usaba en dos sentidos sin definirlo. No es pieza nueva. Las cuatro afirmaciones quedaron ✓ sin cambio.

**Por qué existe esta enmienda.** La palabra «expediente» aparece en el Marco en dos sentidos que nunca se separaron:

- **Pieza 5 §C** la usa para los papeles: pólizas, permisos, exámenes, capacitaciones, mantenimiento firmado, inspecciones.
- **Pieza 6** la usa para una forma de ver: «navegado por expedientes en vez de por mapa suelto», «expedientes de unidad y de aparato».

Y el código ya la usa en los dos sentidos a la vez, lo que es exactamente la trampa de la UNIDAD (Pieza 1 §D caso 6): el lector cree que cuenta una cosa y el sistema cuenta otra. Esta enmienda lo resuelve nombrando el sentido grande, del que el documental es sólo una parte.

**6.30 El expediente.** La vista completa de un id: todo lo que se sabe de esa cosa, reunido en un solo lugar. No es una carpeta de documentos — es la historia y las actividades de la cosa, y los documentos son una de sus partes.

Cada sujeto del dominio tiene su expediente: una **unidad**, un **dispositivo**, un **chofer**, un **contrato**, una **ruta**. Se abre tocando esa cosa desde cualquier lugar donde aparezca (`docs/Mapa-De-La-Casa.md`, regla 2: a una ficha «se llega tocando una pieza»). El expediente **es** la ficha.

**6.31 Qué reúne un expediente.** Según el sujeto, pero siempre las mismas familias:

- **Identidad** — qué es esta cosa y sus datos estables. Para una unidad: placa, identidad; para un chofer: nombre, licencia.
- **Actividad** — qué ha hecho y qué está haciendo. Para una unidad: dónde está, su historial con playback, sus servicios; para un chofer: qué unidades ha operado.
- **Relaciones** — con qué otras cosas se liga. Una unidad con sus dispositivos y sus choferes; un dispositivo con las unidades que ha traído.
- **Documentos** — los papeles del §C, con su vigencia: lo que vence, cuándo, y qué está vencido. Es la parte documental, no el todo.

Cada familia trae lo que su evidencia sostiene, y nada más (Pieza 1 §E). Una familia sin datos se muestra vacía y lo dice; no se rellena ni se inventa.

**6.32 El expediente no calcula veredictos.** Reúne y muestra; no juzga. Lo sellado por el árbitro se lee desde aquí, pero el expediente no lo recalcula (Pieza 1.C: «La verdad se calcula una vez y se guarda… Nadie recalcula su propia verdad»). Un expediente de unidad muestra sus servicios con el veredicto que ya tienen; no emite uno nuevo.

**6.33 «Expediente» documental vs. de servicio.** El §C —los papeles— es la **familia de documentos** dentro del expediente de una cosa. Lo que el código hoy llama «expediente de servicio», «de contrato» o «de ruta» en el sentido de evidencia sellada es la **familia de actividad** de esos sujetos. No son dos cosas distintas peleando por un nombre: son familias distintas del mismo expediente. La palabra se queda; lo que se aclara es que un expediente tiene familias, y cada mención vieja apunta a una de ellas.

**Qué cambia esto en el mapa de la casa.** El lugar «Expedientes» del menú del transportista no es un archivero de papeles: es **la puerta a los expedientes de sus cosas** — sus unidades, sus dispositivos, sus choferes — cada uno con sus cuatro familias. La familia de documentos es la que hoy más falta (no existe forma de subir ni de fechar un papel), así que es por donde se empieza a construir; pero el cuarto es el expediente completo, no sólo los papeles.

Los choferes viven aquí porque hoy toda su sustancia es su expediente documental; cuando ganen actividad propia (jrz-pass, abordaje) su expediente crece, sin cambiar de lugar.

---

## Registro de ratificación

**14 de septiembre de 2026 — ASAV.** Las 29 afirmaciones revisadas una por una. Resultado: 28 ✓ sin cambio, 1 ✎ corregida.

- **✎ 6.8** — el tercer lector se llama **app del pasajero de transporte público**, no "el lado público". Razón: eventualmente existirá también una app del pasajero de transporte especial, y son dos lectores distintos. La corrección arrastró a 6.28 y al renglón del pasajero en la sección F.
- **✓ 6.1 a 6.7, 6.9 a 6.27, 6.29** — sin cambio.

Esta pieza pasa a formar parte del Maestro con esta fecha. Los documentos viejos quedan archivados y no se editan.

**15 de septiembre de 2026 — ASAV.** Ubicación en el Maestro y tres renglones nuevos de la tabla F.

- **Entra como Pieza 6, no como Pieza 5.** Se escribió sobre la copia del Maestro del 6 de julio; el del repo ya tenía la Pieza 1 §D, §E y §F y la Pieza 5 «La forma de la suite» (13 de agosto). Opción ratificada: las Piezas 1 a 5 quedan intactas y Compás entra como Pieza 6. Sus afirmaciones pasan de 5.1–5.29 a 6.1–6.29, y el título a «Compás, el cimiento de la evidencia».
- **✎ Tabla F, renglón nuevo · el cimiento.** La casa tiene cuatro niveles —la operación, Compás, la data organizada, los lectores—, con la disciplina de que la data es el capital y los lectores la caja. Disuelve el choque con «el árbitro es el cimiento» de la Pieza 5 sin tocarla.
- **✓ Tabla F, renglón nuevo · telemetría base = Compás · flota**, un solo nombre, heredando §E sin cambio.
- **✓ Tabla F, renglón nuevo · las dos listas**: §E dice lo que el transportista pagaba; el alcance de construcción lo fija 6.22.
- **✎ Cuatro frases alineadas con el renglón del cimiento:** «Por qué existe esta pieza», «Qué NO cambia», el título de B y 6.8, y 6.23.
- **✎ Dos citas corregidas** (6.11 y 6.19): «no se dibuja lo que no se midió» vive en la Pieza 1 §E, no en 1.C.

El Maestro de cinco piezas queda archivado sin editar en `docs/marco-limpio/archivo/`.

**15 de septiembre de 2026 — ASAV.** Enmienda a la Pieza 6: **H. El expediente** (6.30–6.33).

- **✓ 6.30 a 6.33** — las cuatro afirmaciones revisadas y sin cambio. Nombran el sentido grande de «expediente» —la vista completa de un id, con cuatro familias: identidad, actividad, relaciones y documentos— y resuelven los dos sentidos en que el Marco y el código ya usaban la palabra.
- **El mapa de la casa se ajusta a esta definición:** «Expedientes» es la puerta a los expedientes completos de las cosas del transportista, no un archivero de papeles.
- **✎ Tres citas corregidas** al subirla al Maestro (punteros mal puestos, no cambios de fondo): «Por qué existe» cita el 6.8 literal («de aparato», no «de dispositivo»); 6.30 apunta a la regla 2 del mapa de la casa, no a la Pieza 6; 6.32 apunta a la Pieza 1.C, porque el 6.9 habla de Compás y no de lo sellado.
- **✎ Pieza 1 y sus ecos, con visto de ASAV (16 de septiembre):** Unidad y Chofer (Pieza 1.A), el renglón de choferes y unidades (Pieza 2, Lado 2) y el Chofer (Pieza 4) dejan de decir que la identidad rica —documentos, cumplimiento legal— «vive en jrz-pass», que está descartado; ahora vive en su expediente (§H). Los renglones de usuarios futuros (pasajero, aspiración de identidades) no hablan de documentos y quedan sin tocar.

El Maestro anterior a esta enmienda queda archivado sin editar en `docs/marco-limpio/archivo/`.


---

# Pieza 7 — La modalidad del servicio

**Estado: RATIFICADA.** Redactada y verificada por ASAV el 16 de septiembre de 2026. Las nueve afirmaciones (7.1–7.9) quedaron ✓. La modalidad ha aparecido en Compás, en Expedientes, en el corte de traza y en las apps de pasajero; dejó de poder ser un pendiente suelto. Esta pieza la escribe, y enmienda la ley del corte de traza que hoy la contradice.

---

## Por qué existe esta pieza

El Marco asumió, sin decirlo, un solo tipo de servicio: el que tiene un inicio y un fin, llega a un destino, y el árbitro sella su llegada. Ese es **un** tipo. Hay otro que el Marco nombra de pasada —el circuito de transporte público— pero nunca definió, y los dos se comportan distinto en lo más básico: **qué significa una geocerca y si la traza se corta al pasar por ella.**

El caso que lo obligó: una unidad da el turno de la mañana a una planta (llega, la traza corta, «llegó 06:08») y en la tarde corre un circuito que pasa por esa misma geocerca (no corta, va de paso). Misma unidad, misma geocerca, mismo día. Lo único que cambió es **qué servicio estaba dando en ese momento.** Sin nombrar la modalidad, el sistema no puede saber cuál de las dos cosas hacer.

---

## A. La definición

**7.1 La modalidad.** La clase de servicio que una unidad está ejecutando en un momento dado. Hay dos, y el sistema debe poder distinguirlas:

- **Especial** — el servicio con inicio y fin: recoge personal, lo lleva a un destino, y ahí termina. Es lo que verifica Vernier. La maquila es especial.
- **Circuito** (transporte público) — el servicio que recorre una ruta con paradas y no termina en ningún destino: da vueltas mientras el circuito está abierto. Sólo tiene apertura y cierre, no un fin al que llegar.

**7.2 La modalidad es del servicio, no de la unidad ni del carrier ni del contrato.** Una misma unidad puede ser especial en la mañana y circuito en la tarde. Un mismo carrier puede operar las dos. Preguntar «¿esta unidad es especial o pública?» no tiene respuesta fija: la respuesta es «¿qué servicio está dando **ahora**?». La modalidad se resuelve por el servicio vigente de la unidad en el momento que se mira.

**7.3 Qué significa una geocerca depende de la modalidad.** La misma geocerca, el mismo rol, significan cosas distintas según la modalidad del servicio que la cruza:

- En **especial**, una geocerca de rol destino es **el fin del servicio**: llegar ahí es cumplir.
- En **circuito**, una geocerca es **una parada**: la unidad pasa, marca su paso, y sigue. Ninguna parada es un fin.

---

## B. La enmienda al corte de la traza

**7.4 La traza se corta según la modalidad, no según la geocerca sola.** El Marco decía (Pieza 5 §E, regla de convivencia; Pieza 6, tabla F): «las trazas se cortan al llegar a la geocerca, en todas las caras y en todos los productos, sin excepción». Esa ley se precisa así, sin debilitarse:

**La razón por la que la traza se corta es que la lectura cruda no contradiga un hecho sellado.** Donde el árbitro selló una llegada, mostrar la traza entrando y saliendo contradiría el sello; por eso se corta. De esa razón sale la regla completa:

- **Especial** — hay sello (el árbitro juzga la llegada a destino). La traza **se corta** al llegar a la geocerca de destino, en todas las caras y en todos los productos, sin excepción. Esto no cambia: es la ley original, ahora con su porqué escrito.
- **Circuito** — **no hay sello**: el motor sólo mide y reporta, no juzga una llegada. No hay hecho sellado que proteger, así que la traza **no se corta** al pasar por una parada. Recorre el circuito completo.

**7.5 El corte recibe la modalidad como dato; no la adivina.** La función que dibuja o corta una traza pregunta «¿este tramo es especial o circuito?» y actúa según la respuesta. No infiere la modalidad de que una unidad tenga un circuito asignado (una unidad especial puede estar cargada como circuito por otras razones); la modalidad viene del servicio vigente, resuelta antes.

**7.6 Las paradas de circuito no son geocercas de corte.** Una parada es un punto con nombre por el que la unidad pasa, no una frontera de evidencia que corte. Aunque una unidad de circuito cruce una geocerca que para otro servicio sería de destino, no corta: lo que manda es la modalidad de **su** servicio, no la geocerca que cruza.

---

## C. Lo que esta pieza toca del Marco existente

Ningún renglón de las Piezas 1 a 6 se borra. Se precisan dos:

| Dónde | Decía | Ahora |
|---|---|---|
| Pieza 5 · §E · Regla de convivencia | «Las trazas se cortan en la llegada a la geocerca, en todas las caras y en todos los productos, sin excepción» | La razón es que la lectura cruda no contradiga un hecho sellado. En especial (con sello) se corta, sin excepción. En circuito (sin sello) no hay qué proteger y no se corta (7.4) |
| Pieza 6 · tabla F · §E telemetría base | «las trazas se cortan al llegar a la geocerca, en todas las caras y en todos los productos» | igual: el corte es de la modalidad especial; el circuito no corta (7.4) |
| Pieza 1.A · nuevo sustantivo | — | Modalidad (7.1): especial o circuito, la clase de servicio vigente de una unidad |

---

## D. Lo que esta pieza deja abierto

**7.7** Cómo se marca en los datos qué modalidad tiene un servicio, y de dónde la lee el corte de traza en cada momento. Es implementación; el corte la recibe como dato de entrada (7.5) hasta que exista.

**7.8 — CERRADO por la Pieza 9** (19 de septiembre de 2026). Decía: «El cumplimiento del circuito —qué significa «cumplir» cuando no hay un destino final, sino un horario por parada— queda para cuando se construya la verificación de transporte público.» Ya tiene respuesta: **la promesa del circuito es la frecuencia de paso** (9.1), y se mide parada por parada antes de juzgarse (9.3). Sigue siendo cierto que esta pieza define la modalidad y el corte de traza, no el árbitro del circuito: ese árbitro es la etapa 2 de la Pieza 9, y sigue abierto ahí (9.12).

**7.9** `corredor-prueba` es transporte especial cargado como circuito en los datos de hoy. Hay que corregirlo para que no mienta sobre su modalidad.

---

## Registro de ratificación

**16 de septiembre de 2026 — ASAV.** Las nueve afirmaciones (7.1–7.9) revisadas y ✓ sin cambio. La Pieza 7 entra al Maestro. La enmienda del corte de traza (secciones B y C) queda vigente: la traza se corta en modalidad especial (con sello) y no en circuito (sin sello). Con esto se desbloquea el corte por modalidad en C1 de Compás.

- **✎ Una cita corregida** al subirla al Maestro (puntero, no fondo): la regla de convivencia se citaba como «Pieza 5 (:199)», número de línea de otra copia del Maestro; en el del repo vive en la **Pieza 5 §E**. Corregido en 7.4 y en la tabla C.
- **Las Piezas 1 a 6 no se editan**, igual que hizo la Pieza 6 con su tabla F: la tabla C de esta pieza es la que precisa sus renglones. Donde la Pieza 5 §E y la tabla F de la Pieza 6 dicen «sin excepción», se lee con 7.4.

El Maestro de seis piezas queda archivado sin editar en `docs/marco-limpio/archivo/`.


---

# Pieza 8 — La app del pasajero de transporte público

**Estado: RATIFICADA.** Redactada el 19 de septiembre de 2026 con las ideas de ASAV. Cumple la mitad pública de la ley 6.28 («las apps del pasajero merecen su propia pieza»). La app del pasajero de transporte **especial** sigue prevista y fuera de esta pieza.

---

## Por qué existe esta pieza

La app ya existe, despublicada, y demostró que el motor funciona en una ruta. Lo que no tenía era su ley: qué promete, qué lee, qué nunca muestra, y qué es cuando el dato no alcanza. Sin eso, cada pantalla nueva vuelve a discutir lo mismo. Tres fichas ya vividas se elevan aquí a ley: la escalera de estados (28-ago), «toda pantalla necesita su propia salida» (4-sep) y el contador anónimo de aperturas.

---

## A. Qué es

**8.1 La app es un lector.** Vive en el nivel ④ de la casa: lee de Compás y de la data organizada, **nunca escribe, nunca juzga, nunca pasa por el árbitro**. Es la cara pública de la promesa del transportista, no un instrumento de vigilancia.

**8.2 La promesa publicada es el corazón.** Cada parada de un circuito publicado tiene su **tabla de paso** (sus horarios, o su frecuencia — «pasa cada N minutos» — según cómo el circuito publique). Esa tabla es **lo esperado**. La app la muestra siempre, aunque no haya ninguna unidad en vivo: la promesa vale por sí sola, como el horario impreso en un poste.

**8.3 Esperado y observado, separados también aquí** (ley 1.C del Marco). La app muestra dos cosas y nunca las funde:
- **La promesa:** «pasa cada 15 min» / la tabla de la parada.
- **Lo medido:** la unidad en vivo y su rango de llegada («entre 4 y 7 min»), gobernado por la escalera de estados.

La confianza del pasajero se construye de las dos: saber a qué hora pasa, y **ver venir** la unidad que va a pasar.

**8.3b La llegada se estima hasta el pasajero, no sólo hasta la parada.** Además del rango de llegada a la parada, la app estima cuánto tarda la unidad en llegar **a donde está el pasajero**, cuando el pasajero está sobre el corredor de la ruta. **El cálculo ocurre en el teléfono** ✓ (ASAV, 19-sep), con las posiciones publicadas de las unidades: para esta función la ubicación no necesita salir del aparato, y no sale. La estimación es un rango y la escalera de estados (8.9) la gobierna igual: cuando el dato no alcanza, se degrada, no se inventa.

## B. Qué lee, y qué nunca muestra

**8.4 Sólo circuitos publicados.** El interruptor de publicación por circuito ya existe y manda: lo no publicado no existe para la app. Y **fuera del corredor no se publica** (ley vigente): una unidad que se sale de su corredor desaparece de la app, sin drama y sin explicación al pasajero.

**8.5 La unidad se muestra; su historia no.** El pasajero ve la unidad en vivo (su número económico incluido — «viene la 2120» es parte de la confianza) **sólo mientras está en servicio del circuito que mira**. Nunca: su historial de recorridos, su traza de ayer, dónde duerme, ni ninguna unidad fuera de servicio. La app enseña el presente del servicio, no la vida del camión.

**8.6 El chofer no existe en la app.** Ni nombre, ni foto, ni «tu conductor es…». El paso por parada se atribuye al chofer **en su expediente, del lado del carrier** (Pieza 9); el pasajero nunca lo ve. Un pasajero molesto con un chofer reclama al carrier, no lo caza por la app.

**8.7 La app no sabe quién eres.** Sin cuenta, sin registro, sin identificación del pasajero. La única medición sobre el pasajero es el **contador anónimo de aperturas**, ya construido, que cuenta aperturas y no personas. Las cuentas de pasajero — pensando en una cartera de pago (8.14) — son futuro declarado, y cuando lleguen serán **opcionales**: mirar la app jamás exigirá identificarse.

## C. La forma

> ✎ **Reemplazada el 22-sep-2026 por la 8.8 que sigue, que es la que rige** (ASAV). Se conserva tal cual, sin borrar, como registro de la decisión del 19-sep.

**8.8 Dos vistas: Rutas y Mapa** (decisión de ASAV, 19-sep). La app abre en la ciudad con el conmutador arriba:
- **Rutas** — la lista de circuitos publicados. Abrir una ruta muestra sus paradas, cada una con su tabla de paso y su próximo paso estimado, y las unidades en servicio.
- **Mapa** — los circuitos sobre la ciudad; tocar uno lo enfoca con sus paradas y sus unidades en vivo.

La estructura es de la app de la ciudad, no de una cuenta: el pasajero no elige carrier, elige ruta.

**8.8 (reemplaza a la 8.8 del 19-sep) — Cuatro lugares, y la app abre contestando.** La barra tiene cuatro lugares: **Inicio · Mapa · Ir a · Pase**.
- **Inicio** abre con la respuesta que el pasajero viene a buscar: su parada guardada con su próximo camión y su promesa. Si no tiene guardadas, ofrece las paradas cerca de él, calculadas en su teléfono (8.3b).
- **Mapa** enseña sus rutas favoritas en vivo y cualquier ruta que abra. Tocar una ruta abre su **hilo**: la ruta como una línea con paradas, camiones y dónde está él. Desde el Mapa se llega a la lista completa de rutas publicadas.
- **Ir a** es el buscador y el planeador (8.16).
- **Pase** es el lugar de la cartera de pago (8.14); hasta que exista, dice que llega después.
- Los **avisos** viven en la campana de arriba (8.13b).

*Por qué se reemplaza:* la 8.8b pedía evidencia de uso antes de una tercera vista. Inicio no es vista nueva: es el atajo de la parada guardada subido a la portada. Ir a sí es nuevo, y se aprueba **por diseño, no por evidencia de uso** — y así se registra.

**8.8b No hay tercera vista; hay un atajo.** Se evaluó una tercera vista y dos bastan: lo que el pasajero de todos los días necesita no es otra pantalla sino llegar en un toque a **su parada**. La app permite **guardar una parada** (o más de una), y las guardadas aparecen en **Inicio** (8.8), con su próximo paso ya visible. La parada guardada **vive en el teléfono**, no en el servidor (8.7): guardarla no identifica a nadie. Si con el uso real aparece la necesidad de una tercera vista, se enmienda con evidencia, no antes.

> ✎ **22-sep-2026 (ASAV):** decía «las guardadas aparecen hasta arriba de Rutas»; ahora apuntan a Inicio, para leerse con la 8.8 nueva. Lo de la tercera vista lo contesta el *por qué* de la 8.8 nueva: Inicio es este mismo atajo subido a la portada, e Ir a se aprobó por diseño.

**8.8c Cada ruta tiene su color, y es identidad.** En México las rutas se conocen por su color, y la app lo respeta: cada circuito registra su color (parte de su identidad, Pieza 9.8) y la app lo usa para pintar su trazado, sus paradas y sus piezas. Dos reglas del skill lo acotan: el color de ruta es **identidad, nunca estado** — jamás significa «bien» o «mal», y no puede ser el único portador de una diferencia (el nombre siempre acompaña) —, y sobre el mapa debe cumplir el contraste mínimo de 3:1 en las dos pieles, con el halo de la traza si hace falta. Los colores reservados de la plataforma (el cobre de lo vivo, el verde del latido, el ladrillo, el verde sello) no se les asignan a rutas.

**8.8d El tinte de la ruta.** Una ruta abierta tiñe la pantalla con su color; un viaje de varias rutas mezcla sus colores sin promediarlos. Hereda las reglas de la 8.8c. Tres cosas que el tinte nunca toca: **el texto**, **el verde del latido** y **el dato viejo** (si pintara el dato viejo, el color diría estado).

**8.9 La escalera de estados gobierna la honestidad** (ficha del 28-ago, ahora ley): cuando el dato vivo no alcanza, la app degrada por su escalera declarada y jamás inventa una llegada. El cuarto estado no emite veredictos: un camión con dato viejo se queda en el mapa como dato viejo, no como acusación.

**8.9b «A N paradas».** Mientras la velocidad del corredor de una ruta no esté calibrada con sus propios camiones, la app no da minutos: dice a cuántas paradas viene la unidad, que sale de su posición real. Los minutos se prenden cuando la calibración exista. Dar minutos con velocidad de otra flota es inventar una llegada (8.9).

**8.10 Toda pantalla tiene su salida** (ficha del 4-sep, ahora ley): ninguna pantalla de la app es un callejón; siempre hay un camino de regreso visible.

**8.16 El planeador («Ir a»).** El pasajero busca a dónde va y la app arma el viaje, con o sin transbordo. Seis reglas:
1. Cada tramo dice de dónde sale su número: calculado en el teléfono, medido en vivo, o prometido por la concesión.
2. Lo medido y lo prometido nunca se funden en un número sin su condición. Un total sólo se da si dice, a la vista, qué parte es promesa: «27–47 min, si el Circuito Norte pasa como promete».
3. Una espera prometida entra completa. «Cada 20 min» sin camión a la vista es una espera de 0 a 20 min, y el total la carga completa.
4. Sin recorridos medidos no hay total.
5. Los recorridos publicados son del circuito, agregados, nunca de un transportista ni de una unidad. La comparación entre transportistas sigue en el cajón reservado (9.14).
6. El viaje del pasajero no se guarda: origen y destino no quedan en ningún servidor ni en registros. Las búsquedas recientes viven en el teléfono.

## D. Lo que esta pieza deja abierto

**8.11** El nombre público de la app y su distribución (PWA hoy; tiendas después) — decisión de negocio.
**8.12** La app del pasajero de transporte **especial** («mi ruta, mi unidad, a qué hora pasa por mí»): prevista, con su propia pieza cuando toque.
**8.13** Avisos al pasajero (notificaciones de «tu ruta abrió» o «se cayó el servicio»): esperan a que el servicio real ruede semanas; un aviso sobre un servicio inestable enseña a desinstalar.
**8.13b Avisos dentro de la app, fechados y atribuidos.** Un aviso dentro de la app dice quién lo dijo y desde cuándo («según la concesión») y nunca es un letrero de alarma. Los avisos del propio teléfono se dicen aparte. Esto **no abre las notificaciones**: la 8.13 sigue igual; el aviso se ve al abrir la app, no llega solo.
**8.15 Guardar las posiciones de los pasajeros: decidido que sí, con condiciones** (ASAV, 19-sep). ASAV quiere, a futuro, conservar posiciones de pasajeros para entender la demanda real: de dónde a dónde viaja la gente, qué paradas faltan, qué ruta pide más unidades. Es data que hoy nadie tiene en la ciudad y es parte de la visión del producto. Se hará **en su propia pieza**, redactada con el abogado, y esta pieza fija desde hoy las condiciones que esa pieza no podrá aflojar, porque diseñarlas después sería un parche:

- **Nunca por defecto, nunca en silencio.** Se activa con consentimiento explícito, informado y revocable; la app completa funciona sin él, y negarse no degrada ninguna función (el ETA del 8.3b no lo necesita: se calcula en el teléfono).
- **Se guarda el viaje, no la persona.** Lo que se conserva son recorridos con identificador rotatorio, no una identidad seguida en el tiempo. Un perfil permanente de una persona no es un objetivo de este producto.
- **Se recorta en los extremos.** El origen y el destino reales se truncan antes de guardarse: la demanda se entiende por zona y por parada, no por domicilio.
- **Con fecha de caducidad.** Todo dato crudo de posición de pasajero vive un plazo declarado y luego se borra; lo que sobrevive es el agregado. Lo que no se guarda no se pierde, no se filtra y no se puede pedir.
- **Nunca se cruza con el carrier ni con el chofer.** La demanda es del sistema, no un instrumento para vigilar a nadie.
- **Se declara en palabras claras dentro de la app**, no sólo en un documento legal que nadie lee — la misma ley que rige todas las pantallas de J-Tel: nada afirma lo que no se comprobó, y nada esconde lo que sí se hace.

**8.14** Las cuentas de pasajero y la **cartera de pago** (visión de ASAV, 19-sep): merecen su propia pieza cuando toquen — mueven dinero y identidad, las dos cosas más delicadas de la casa. Nada de esta pieza se diseña de forma que las estorbe: la app anónima de hoy es el piso, no el techo.

---

## Registro de ratificación

**19 de septiembre de 2026 — ASAV.** Afirmaciones 8.1–8.15 revisadas y ✓. La pieza entra al Maestro. Cuatro aportaciones de ASAV en esta sesión quedaron como ley: el ETA hasta el pasajero calculado en su propio teléfono (8.3b), la parada guardada en vez de una tercera vista (8.8b), el color de ruta como identidad (8.8c), y la decisión de conservar posiciones de pasajeros a futuro, con sus seis condiciones y su propia pieza redactada con abogado (8.15).

- **✎ Una frase borrada** al subirla al Maestro (redacción, no fondo): el encabezado decía «Estado: RATIFICADA» y tres renglones después «Espera la ratificación de ASAV, afirmación por afirmación», frase que sobró del borrador y que este registro contradice. Ninguna afirmación se tocó.
- **La ley 6.28 queda cumplida a la mitad.** Pedía pieza propia para las dos apps del pasajero; ésta es la de transporte **público**. La de transporte **especial** sigue prevista y sin pieza: vive aquí como 8.12. El 6.28 no se edita — las piezas anteriores no se reescriben; se lee con esta.
- **Las Piezas 1 a 7 no se editan por esta pieza.** Donde la Pieza 4 anota al pasajero como «usuario a futuro», se lee con 8.7: hoy no hay cuenta de pasajero, y cuando la haya será opcional.

El Maestro de siete piezas queda archivado sin editar en `docs/marco-limpio/archivo/`.

**22 de septiembre de 2026 — ASAV.** Afirmaciones 8.8 (nueva), 8.8d, 8.9b, 8.13b, 8.16 y 9.3c revisadas y ✓.

- **✎ Dos ajustes de redacción, no de fondo** (ASAV, 22-sep). Al subir la 8.8 nueva, la del 19-sep se quedó sin marcar y la 8.8b seguía mandando las paradas guardadas «hasta arriba de Rutas», así que el Maestro se contradecía. La 8.8 del 19-sep queda **marcada como reemplazada, sin borrarse**, y la 8.8b apunta a Inicio. **Rige la 8.8 nueva.**

---

# Pieza 9 — El circuito: medir primero, juzgar después

**Estado: RATIFICADA.** Redactada el 19 de septiembre de 2026 con las ideas de ASAV. Resuelve el 7.8 («qué significa cumplir cuando no hay un destino final») y da su ley a la terminal de operación del carrier.

---

## Por qué existe esta pieza

La Pieza 7 definió la modalidad circuito y dejó abierto, a propósito, qué significa cumplirla. ASAV lo contestó el 19-sep: **la promesa del circuito es la frecuencia.** Un pasajero confía cuando sabe que su camión pasa cuando la tabla dice, y lo ve venir. Esta pieza escribe esa respuesta como ley, y ordena en qué orden se construye — porque la maquila ya enseñó el camino: primero existió el metro (Compás midiendo), después el juez (Vernier sellando). El circuito recorre el mismo camino y no se lo salta.

---

## A. Qué es cumplir en un circuito

**9.1 La promesa del circuito es la frecuencia de paso.** Cumplir un circuito es que **el paso por cada parada sostenga la tabla publicada** — sus horarios, o su frecuencia — mientras el circuito está abierto. No hay destino que alcanzar ni llegada que selle nada: hay una promesa que se sostiene o se agujera, parada por parada, hora por hora.

**9.1b El adelanto daña igual que el retraso.** Un camión que pasa **antes** de su hora deja al pasajero plantado igual que uno que pasa después — peor, porque el pasajero llegó a tiempo y el camión ya no estaba. La promesa es una **banda con dos orillas**, y la medición registra la desviación en los dos sentidos: adelantado y atrasado son los dos nombres del mismo daño. Ninguna pantalla trata el adelanto como mérito.

**9.1c La promesa puede variar por franja horaria.** La flota en servicio no es fija: sube en horas pico y baja cuando está tranquilo, y la tabla publicada puede prometer frecuencias distintas por franja («cada 10 min de 6 a 9; cada 20 el resto del día»). **Lo medido se compara contra la promesa vigente de esa franja**, nunca contra un promedio del día: juzgar la hora pico con la tabla del valle — o al revés — es la afirmación falsa del alcance (Marco §D).

**9.2 El paso por parada es el hecho atómico.** Unidad ‹n› pasó por la parada ‹p› a las ‹hh:mm:ss›. De ahí se deriva todo lo demás: la frecuencia real, los huecos de servicio, las vueltas. Cada paso **se atribuye a la unidad y — cuando exista la asignación — al chofer**: es la familia de actividad de sus expedientes (6.30–6.31). La operación del circuito alimenta los expedientes; no vive aparte de ellos.

**9.2b La torre del circuito.** Mientras el circuito está abierto, la terminal funciona como torre de control: por cada parada y cada unidad muestra **en vivo** su desviación contra la promesa vigente — adelantada, en banda, atrasada — para que el operador corrija por radio antes de que el hueco llegue al pasajero. Dos límites que no se cruzan: **la torre muestra y el humano decide** — J-Tel no maneja camiones ni ordena velocidades —, y la torre **vive del lado del carrier**: el pasajero nunca ve «adelantado/atrasado», ve su tabla y su unidad venir (Pieza 8). La velocidad se mide y se muestra como contexto del ritmo; nunca como orden.

**9.2c «En banda» se dice «en rango».** (Enmienda 20-sep.) Cambio de palabra, no de significado. El 9.2b decía «adelantada, en banda, atrasada»; se lee **«adelantada, en rango, atrasada»**. La orilla que define el rango es la de la promesa vigente de esa franja (9.1c).

**9.2d Los dos tiempos del circuito.** (Enmienda 20-sep, de ASAV.) Un circuito se mide con dos relojes que corren en sentidos opuestos, y confundirlos produce afirmaciones falsas. **El esperado** corre hacia adelante y está declarado: la promesa de la franja («cada 10 min»); no se mide, se captura. **El ejecutado** corre en reversa y es medido, y se mide distinto según el sujeto: en la **unidad**, hacia atrás contra **el paso anterior por esa parada, de cualquier unidad** —el intervalo entre camiones que vive el pasajero, la frecuencia real, no la vuelta de la unidad— un número **cerrado**; en la **parada**, desde la última pasada hacia el ahora — un número **abierto que crece mientras nadie pasa**. Una parada puede declarar que la promesa se rompe sin que ninguna unidad haya hecho nada todavía. Ninguno de los dos es un pronóstico: el tiempo estimado de llegada es del pasajero (Pieza 8), no de esta pieza.

**9.2e El ritmo prometido se dibuja del tiempo medido, o no se dibuja.** (Enmienda 20-sep.) La torre puede mostrar, como referencia, dónde iría una unidad si la frecuencia se sostuviera. Esa referencia **no es una unidad**: vive en su propio carril, con forma y tono propios, y ninguna pantalla la cuenta como camión ni la mezcla con la traza (la prohibición de simular en el mapa sigue intacta). Su posición **se deriva del tiempo de vuelta ya medido** de esa franja. Está prohibido repartirla pareja sobre el corredor: eso supone velocidad uniforme, que nadie midió, y es completar lo que falta (Marco 1.E). Mientras no haya vueltas medidas, el carril va vacío y lo declara.

**9.3 Dos etapas, y el orden es ley: primero el metro, después el juez.**
- **Etapa 1 — medir (esta pieza la habilita):** la terminal del carrier muestra lo medido, con el vocabulario de la medición — «se sostuvo», «se agujeró», «sin datos» — y sin sellar nada. Territorio de Compás.
- **Etapa 2 — juzgar (fuera de esta pieza):** sellar cumplimiento del circuito como hechos, con las leyes del árbitro (la verdad se calcula una vez, sin evidencia no es incumplimiento, alarmas que llegan a cero). **No se construye hasta que la medición haya rodado con servicio real y ASAV la ratifique.** Qué producto le pone el sello — Vernier u otro nombre — se decide entonces, no ahora.

Una pantalla de la etapa 1 que diga «cumplió» o «no cumplió» se pasó de etapa: se detiene y se corrige.

**9.3b El vocabulario de la etapa 1 en pantalla es el de la operación, no el del motor.** (Enmienda 20-sep.) Los nombres «se sostuvo», «se agujeró», «sin datos» del 9.3 quedan **sólo como nombres internos del motor**; en pantalla no aparecen — confunden a quien opera, que no es ingeniero. El vocabulario de pantalla es **uno solo**, el mismo para el estado de una unidad y para cada paso medido: **EN RANGO · ADELANTADA · ATRASADA · SIN DATOS.** Todo número lleva su referencia al lado («4 min · rango 5–15»). «Sostener la frecuencia» se conserva en prosa (9.1); como etiqueta de pantalla, no. **La palabra «hueco» no se usa en pantalla:** ahí ya significa que el equipo calló y nadie midió (dos cosas con el mismo nombre en la misma pantalla es la trampa del Marco §D). Lo que una parada lleva sin que pase nadie se llama **espera**; el 9.4 conserva «hueco de servicio» sólo en su prosa.

**9.3c El vocabulario de la jornada.** Al describir el día de una unidad:
- **Completa** — pasó por todas las paradas de su sentido, en orden.
- **Incompleta · salió del corredor en ‹parada›** (o **entró**, si faltan las del principio) — sólo con una salida del corredor medida que lo explique.
- **SIN DATOS** — lo que falta cae en un silencio del GPS. No se afirma que no lo hizo.
- **Paradas sin paso** — faltan pasos sin causa medida: se listan, sin adjetivo.
- **Todavía no se mide** — lo que el detector aún no alcanza.

**«Cortó», «cortada», «cortó la ruta» no se dicen en pantalla:** implican intención, y lo único medido es por dónde anduvo el camión. La calificación, cuando llegue, será un catálogo de incumplimientos con reglas escritas antes que Vernier aplica solo — no adjetivos en la jornada.

## B. Lo que la terminal mide (etapa 1)

**9.4 El conjunto medido, todo derivado del paso por parada y de la traza:**
- **Puntualidad de paso** por parada contra su tabla.
- **La frecuencia real** (el tiempo entre pasos) y sus **huecos de servicio**: tramos donde ninguna unidad pasó por una parada en más de lo prometido.
- **Vueltas completadas** por unidad y por circuito.
- **Kilómetros del día** por unidad.
- **Apertura y cierre reales** del circuito contra su horario.
- **Cobertura del corredor**: cuánto del recorrido fue dentro del corredor (la regla «fuera del corredor no se publica» ya lo mide para la app).
- **Demanda por parada**: las aperturas anónimas de la app cerca de cada parada — **declarada como lo que es, un indicio**, no un conteo de pasajeros.

**9.5 El ausentismo del chofer se mide cuando exista quién.** Que un chofer no se presentó o llegó tarde requiere choferes dados de alta y la asignación chofer ↔ servicio, que hoy nada escribe. Hasta entonces, esa parte de la terminal declara **aún no disponible · llega con el alta de choferes** — y **jamás se infiere del GPS** quién faltó: el GPS mide camiones, no personas.

**9.6 El dinero queda fuera hasta el estado de cuenta.** El ROI tiene mitad física y mitad de pesos. La terminal muestra la física — kilómetros, vueltas, horas de servicio — y ni un peso: la ley de «cero dinero en pantallas» sigue hasta que exista el estado de cuenta, y entonces el ROI se arma solo, con esta mitad ya medida.

**9.7 El conteo de pasajeros es futuro declarado.** Requiere sensor o abordaje (jrz-pass); ninguna pantalla lo estima desde otra cosa. Cuando exista su fuente, ya tiene lugar: la actividad del circuito y de la parada.

## C. Los sujetos nuevos

**9.8 El circuito y la concesión son sujetos con expediente** (extienden 6.30). Se abren tocándolos, como todo:
- **Circuito** — Identidad: su trazado, **su color** (en México una ruta se conoce por su color; la app y la terminal lo usan como identidad, nunca como estado — Pieza 8.8c), sus paradas con sus tablas, su horario de servicio. Actividad: los pasos, las vueltas, los huecos, el km. Relaciones: sus unidades en servicio, sus choferes asignados, su concesión. Documentos: no aplica (los papeles son de la concesión).
- **Concesión** — Identidad: quién la otorga, su vigencia, sus circuitos. Documentos: los papeles del permiso, con las reglas de vigencia del archivero (§4 de la ficha de Expedientes).
- **La parada es parte del circuito**, no sujeto propio. Si algún día gana vida propia (obras, quejas, demanda), su expediente crece desde ahí sin mudarse.

**9.8b La parada tiene ficha, no expediente.** Se abre tocándola y muestra su nombre, ubicación, tabla prometida por franja, lo medido y su demanda. Tres límites: no es sujeto con expediente; no lleva papeles — viven en la concesión; y **nunca recibe veredicto propio**: lo medido en una parada es el cumplimiento del circuito en esa parada, en vocabulario de etapa 1 — se sostuvo, se agujeró, sin datos — sin sello hasta que exista el árbitro del 9.12.

**9.9 La terminal es la cara de operación del cuarto Circuitos** (sello «Transporte público», Mapa). Abrir una ruta abre **su expediente** — la estructura Rutas/Mapa que ASAV pidió es exactamente la gramática de la casa: el cuarto lista los circuitos, tocar uno abre su expediente, y el mapa vivo es su parte de actividad. No se inventa una pantalla nueva; se llena una que la casa ya sabe hacer.

**9.10 Comparar circuitos llega después de medir.** «Cuáles son los mejores y cuáles requieren mejora» es la pregunta correcta y se contesta con esta data — pero la comparación se dibuja cuando haya semanas de medición real, no el día uno. Comparar dos circuitos con tres días de datos es la afirmación falsa del alcance (Marco §D).

## D. Lo que esta pieza deja abierto

**9.11** La detección del paso por parada (radio, permanencia, doble sentido) — implementación; se calibra con los camiones reales.
**9.12** El árbitro del circuito completo (etapa 2): sus hechos, sus sellos, su producto.
**9.13** `corredor-prueba` sigue pendiente de corregirse (7.9).

## E. Qué es público, qué reserva J-Tel, y qué es privado del carrier

**9.14 Los tres cajones de visibilidad del circuito.** (Enmienda 20-sep, de ASAV.) La operación de un circuito toca tres cajones, y confundirlos abre o cierra el muro donde no debe:
- **Público** — la ruta, sus paradas, sus horarios, y el hecho de que un camión de servicio público pasó por una parada a cierta hora. Cualquiera lo observa desde la calle; ocultarlo no protege a nadie.
- **Reservado de J-Tel** — el **resultado de la medición** (si la frecuencia de paso se sostuvo) y **la comparación entre carriers** de un mismo servicio. No se publica: es el valor que produce la plataforma. El acceso de un carrier a medirse contra el resto del servicio, y el de cualquier tercero a la data agregada, **pasa por J-Tel**.
- **Privado del carrier** — su negocio: ingresos, números, choferes, expediente. **Nunca cruza** de una cuenta a otra.

De aquí, la regla de visibilidad: **J-Staff** ve el agregado completo del circuito; **la concesión** dueña ve todos los pasos de su circuito; **el carrier** ve los pasos de **sus propias unidades**, y su medición se calcula **sobre lo que puede ver** (en un circuito de un solo carrier eso es el servicio completo, correcto tal cual). Medir un carrier contra los camiones de **otro** carrier **no es la ruta pública: es comparación**, y por lo tanto valor reservado — se habilita **por circuito, según el acuerdo de esa concesión**, nunca por ley general ni por default. El muro estricto entre carriers no es una limitación técnica: es la política que protege el negocio de cada carrier y el de J-Tel a la vez.

**SIN DATOS antes que un número prestado.** Mientras la comparación compartida no esté habilitada para un circuito, la torre del carrier en un servicio compartido **declara lo que no puede medir** en vez de medir contra un flujo incompleto (que produciría un ATRASADA falso — Marco §D). La honestidad del hueco (1.E) manda sobre la completitud de la pantalla.

---

## Registro de ratificación

**19 de septiembre de 2026 — ASAV.** Afirmaciones 9.1–9.13 revisadas y ✓ sin cambio. La pieza entra al Maestro y resuelve el 7.8. Tres afirmaciones nacieron de ASAV en esta sesión: el adelanto daña igual que el retraso (9.1b), la promesa varía por franja horaria (9.1c) y la torre del circuito (9.2b).

- **Añadida el mismo día: 9.8b** (ASAV, 19-sep), antes de que la pieza entrara al Maestro. **El 9.8 no se enmienda** —la parada sigue siendo parte del circuito, no sujeto propio—; el 9.8b escribe lo que sí existe: su ficha, y los tres límites que la mantienen en su sitio. **Por qué es afirmación y no renglón del mapa de la casa:** una pantalla futura puede argumentar que el mapa no es ley; de una afirmación numerada no se escapa nadie. El detalle de los dos primeros límites —qué muestra la ficha, dónde viven los papeles— vive en el mapa; el tercero es el que tenía que ser citable. **La redacción del 9.8b es de ASAV, palabra por palabra.**

- **✎ Una frase borrada** al subirla al Maestro (redacción, no fondo): el encabezado decía «Estado: RATIFICADA» y tres renglones después «Espera la ratificación de ASAV, afirmación por afirmación», frase que sobró del borrador y que este registro contradice. Ninguna afirmación se tocó.
- **✎ El 7.8 se cierra en su lugar, por orden de ASAV.** A diferencia de las Piezas 6 y 7 —que no editaron nada anterior y precisaron con su propia tabla—, ésta sí toca un renglón de la Pieza 7: el 7.8 deja de estar abierto y queda marcado **CERRADO por la Pieza 9**, con su texto viejo citado adentro para que nadie pierda qué decía. Razón: un pendiente que ya tiene respuesta y sigue diciéndose abierto es una afirmación falsa del Marco contra sí mismo. El resto de la Pieza 7 no se toca; el 7.9 sigue abierto y esta pieza lo hereda como 9.13.
- **Las Piezas 1 a 6 no se editan.** Donde la Pieza 3 habla del árbitro y del sello, se lee con 9.3: el circuito hoy está en la etapa de medir, y la etapa de juzgar no existe hasta que ASAV la ratifique.

El Maestro de siete piezas queda archivado sin editar en `docs/marco-limpio/archivo/`.

**20 de septiembre de 2026 — ASAV.** Enmiendas ratificadas al diseñar la torre del circuito (prototipo v6): **9.2c** (en rango), **9.2d** (los dos tiempos), **9.2e** (el ritmo prometido derivado del tiempo medido), **9.3b** (el vocabulario de pantalla) y **9.14** (los tres cajones de visibilidad y el valor reservado). Tres nacieron de ASAV en esta sesión: los dos tiempos (9.2d) y la visibilidad como negocio (9.14); el vocabulario de pantalla (9.3b) corrige el 9.3 sin borrarlo. Las decisiones de interfaz asociadas (el cobre del reloj de espera, la dirección del eje del instrumento) **no entran al Marco**: viven en el skill `jtel-diseno`.

**22 de septiembre de 2026 — ASAV.** Afirmaciones 8.8 (nueva), 8.8d, 8.9b, 8.13b, 8.16 y 9.3c revisadas y ✓.
