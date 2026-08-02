La única fuente de verdad. Cuatro piezas, derivadas del proyecto completo y verificadas una por una por ASAV. Reemplaza toda la documentación vieja (queda archivada). De aquí en adelante, esto es lo único que hay que cargar — ni conversaciones ni docs viejos. Aterrizado en contratos reales (Tecma 47, Honeywell MX07). Fecha: 6 de julio de 2026.
Contenido
Pieza 1 — El dominio y las leyes intocables
Pieza 2 — Las dos caras del producto
Pieza 3 — Las reglas de verificación
Pieza 4 — Usuarios, roles y accesos


Pieza 1 — El dominio y las leyes intocables
A. Los sustantivos (las piezas del mundo)
Cuenta: el espacio privado de una organización en la plataforma. Hay dos tipos de dueños: un carrier o un cliente corporativo. Como una cuenta propia: cada quien ve sólo lo suyo. La cuenta de un carrier funciona sola, sin que nadie contrate la verificación.
Carrier: la empresa que ejecuta el transporte (ej. Juárez Bus). Tiene su(s) propia(s) ubicación(es)/geocerca(s). Atiende a varios clientes y plantas.
Cliente corporativo: la empresa que contrata el servicio (ej. Tecma). Sus plantas operadoras son las que lo reciben. Agrupa plantas y ve todas las suyas.
Planta (operadora): la instalación que recibe el servicio (ej. Tecma planta 47). Ve sólo lo suyo.
Grupo de plantas / campus / parque industrial: un conjunto de plantas que pueden compartir un mismo servicio del mismo carrier (ej. plantas 3 y 24 en el campus Santos Dumont). Una planta puede pertenecer a un grupo o ir sola.
Geocerca: la frontera física y de evidencia de un lugar. Tiene dueño (una planta, o un carrier) y un rol (destino, base del carrier, caseta…). No es un atributo suelto.
Unidad: el vehículo. Tiene identidad estable propia; es evidencia de ejecución, no el servicio; puede cambiar de dispositivo. Su identidad rica (documentos, cumplimiento legal) vive en jrz-pass, igual que la del chofer.
Dispositivo (GPS): el aparato de rastreo puesto en una unidad en cierto momento. Es intercambiable. La evidencia entra por el dispositivo que la unidad traiga puesto en ese momento.
Chofer: la persona que opera. Su identidad rica (documentos, cumplimiento legal) vive en jrz-pass y se conecta después; no bloquea nada.
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
Un dato correcto puede volverse una afirmación falsa según dónde se lea, cómo se agrupe o de qué color se pinte. El valor guardado siendo correcto no basta: lo que el usuario recibe es la afirmación completa, y esa la arman también el lugar, la agrupación y el color. Ver la sección D.
Idioma nativo del sistema: español.


D. Cuando un dato correcto miente

Esta sección existe porque el mismo error apareció cuatro veces en un solo piloto de interfaz, y las cuatro veces el valor guardado era correcto. Ninguna se detectó compilando ni leyendo el código: se detectaron mirando la pantalla contra la ley.

Es la clase de falla que más le cuesta a un árbitro. Un motor que calcula mal se arregla y se vuelve a sellar. Un motor que calcula bien y se muestra mal produce una afirmación falsa con toda la autoridad del sello detrás — y el auditado no tiene cómo distinguirlas.

Los cuatro casos, con lo que hacía falsa cada afirmación:

1. Unidades ya llegadas marcadas "sin señal". El dato era la antigüedad del último punto GPS, correcta al minuto. Pero la traza se corta al entrar a la geocerca porque la geocerca es la frontera de la evidencia: el silencio posterior es la ley funcionando, no una unidad callada. Once de catorce unidades acusaban al carrier de perder señal justo donde el sistema deja de mirar a propósito. Lo falso lo puso el LUGAR donde se leyó el dato.

2. "Sin verificar" mostrado como cuarta tarjeta junto a los tres resultados. El conteo era correcto. Pero puesto al lado de cumplido, no cumplido y pendiente por evidencia, se lee como un cuarto veredicto — y no lo es: es ausencia de veredicto, el motor todavía no juzga ese servicio. Lo falso lo puso la AGRUPACIÓN.

3. Agregados recalculados sobre el filtro. Al filtrar a "cumplido", la tarjeta "No cumplidos" mostraba 0. El 0 era correcto para el conjunto filtrado, y falso como afirmación sobre el periodo, que es lo que una tarjeta de agregado afirma. Un agregado dice la verdad del periodo completo siempre; el filtro es una lente sobre la tabla, no sobre los hechos. Lo falso lo puso el ALCANCE.

4. El motivo "temprano" pintado en ámbar. La medición era correcta: llegó diez minutos antes. Pero el ámbar está reservado a los motivos con costo, así que pintarlo ámbar le imputa al carrier un cargo que el contrato no le pone. Lo falso lo puso el COLOR.

Lo que esto exige al construir:

Cada dato que llega a una pantalla se pregunta no sólo si es correcto, sino qué afirma ahí: al lado de qué queda, sobre qué universo habla, y qué dice el color que se le pone. Un dato correcto en el lugar equivocado no es un detalle de presentación — es el árbitro mintiendo.

Sobre las pruebas, con precisión: ninguna prueba unitaria ENCUENTRA estos casos, porque no hay valor equivocado contra el cual comparar. Pero una vez encontrados, sí se pueden CERCAR, y los cuatro están cercados: tres con pruebas que fallan si el error vuelve, y el del agregado con una valla de tipos — lo que sale del filtro va marcado y la función que cuenta el periodo se niega a recibirlo, así que repetirlo deja de compilar.

Esa diferencia importa al elegir la valla. El caso del agregado no vivía dentro de la función —contar siempre contó bien— sino en el sitio de llamada, y eso ninguna prueba sobre una función pura lo ve. Cuando el error está en quién llama y no en qué hace, la valla es el compilador.

La regla completa: la revisión contra la ley es lo único que los descubre; la valla es lo que impide que regresen. Las dos hacen falta, en ese orden, y nunca al revés.


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
Choferes y unidades con su cumplimiento (licencias, médicos, capacitación; antigüedad, cinturones, GPS…). (Identidad rica en jrz-pass.)
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
Chofer: acceso mínimo (su identidad rica vive en jrz-pass).


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
