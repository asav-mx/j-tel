# J-Tel — El mapa de la casa

Navegación, organización y flujo de la plataforma. Fijado el 15 de septiembre de 2026, en sesión de ASAV y Claude, auditado dos veces contra el `Marco-Limpio-J-Telemetry-MAESTRO.md`. Acompaña al skill `jtel-diseno`: el skill dice cómo se ve una pantalla; este documento dice qué pantallas hay y cómo se llega a ellas. El Marco manda sobre los dos.

Este documento define el **cascarón**: la estructura dentro de la cual entran las pantallas. Se construye primero, con las dos pieles, y las pantallas entran después, cuarto por cuarto. Nada se construye en el lenguaje viejo.

---

## Las cuatro reglas de navegación

1. **Cada casa tiene una puerta, y la puerta responde una sola pregunta.**
   - Transportista → «¿dónde está mi flota?» → **Flota en vivo**
   - Planta → «¿qué pasó hoy?» → **El día**
   - Corporativo → «¿cómo vamos, y con quién?» → **Panorama**
   - J-Staff → «¿está sana la plataforma?» → **Compás · operación**

2. **El menú lista lugares, no fichas.** A una ficha —«Ver ‹unidad›», «Ver ‹servicio›», «Ver ‹dispositivo›», «Ver ‹chofer›», «Ver ‹planta›»— se llega **tocando una pieza**, desde cualquier lugar donde esa cosa aparezca, y siempre con camino de regreso. Nadie busca una unidad concreta en un menú.

3. **Dos niveles como máximo, y pocos lugares.** Si un menú necesita un tercer nivel o más de seis entradas, la casa está mal partida. En celular, la misma casa se colapsa a cuatro pestañas abajo como máximo.

4. **Lo que no aplica, no aparece.** Ni apagado, ni con candado, ni «próximamente». Un cuarto que se ve y no se puede usar es una promesa que la pantalla no puede cumplir. Vernier sólo aparece con contrato; Circuitos sólo si opera transporte público.

**Nombres del menú (ratificado, opción B):** el menú usa **nombres de cosa** —«Flota en vivo», «Servicios especiales», «Circuitos»— y el nombre de producto va como **sello chico** encima de su sección: «Compás» sobre la flota, «Vernier» sobre servicios especiales, «Transporte público» sobre circuitos. Razón: un coordinador sabe buscar lo que hace, no «Vernier»; la marca se graba por repetición del sello, sin estorbar el camino de todos. Compás y Vernier viven fuertes en la web, las ventas y los contratos — dentro del producto sirven mejor como sello que como letrero.

*El lugar de Vernier se llamó «Cumplimiento» hasta el 18 de septiembre de 2026.* ASAV lo renombró «Servicios especiales» al construirlo (Vernier V1): sigue siendo nombre de cosa, y el adjetivo evita que un carrier con concesión busque ahí sus circuitos, que viven en Circuitos.

---

## Las cinco casas

Una casa por cara. No es la misma pantalla con permisos apagados: cada cara es su propio subdominio, con su propia puerta, sobre la misma data organizada.

### 1 · Transportista — cimiento: Compás

Compra Compás aunque nunca tenga contrato. Vernier se enciende encima cuando lo consigue.

- **Compás** (la plataforma de GPS propia)
  - **Flota en vivo** — la puerta. Mapa y lista de toda la flota ahora; grupos EN LÍNEA · SIN SEÑAL · DESCONECTADO · SIN DISPOSITIVO. Se toca una unidad y se abre su ficha. *(nuevo; lógica en #411)*
  - **Lugares** — las geocercas propias, cada una con su rol; el rol decide si la traza se corta. *(existe en parte)*
- **Expedientes** — la puerta a los expedientes de las cosas del transportista: sus unidades, sus dispositivos, sus choferes, cada uno con sus cuatro familias —identidad, actividad, relaciones y documentos— (Marco 6.30–6.33). No es un archivero de papeles: es un archivero de **expedientes** (19 sep 2026, `docs/Ficha-Construccion-Expedientes-V2-Archivero.md`). Abre en un **tablero** —un buscador que atraviesa todo, «Piden atención» como bandeja del día y una tarjeta por cajón— y cada **cajón** (Unidades · Dispositivos · Choferes) lista sus piezas en filas compactas, con chips y buscador propio. Los cajones no son lugares del menú: se llega tocando su tarjeta. La familia de documentos —el segundo afluente: pólizas, permisos, exámenes, capacitaciones, mantenimiento firmado, inspecciones— es la que hoy más falta, y es por donde se empieza. Aquí viven los **choferes**: hoy toda su sustancia es su expediente documental; cuando ganen actividad propia, su expediente crece sin cambiar de lugar. *(nuevo — construible ya, no depende del GPS)*
  - **El cajón Dispositivos** es el inventario (6.6): EN UNIDAD · EN BODEGA · DESCONECTADO · DE BAJA, con el alta; asignar, soltar y dar de baja se hacen en Ver ‹dispositivo› (6.18). Del 17 al 19 de septiembre fue un lugar propio del menú bajo Compás; el mismo inventario estaba dos veces, y su dirección vieja redirige al cajón.
  - **Los lugares propios del carrier** (su base, su taller) serán un cuarto cajón el día que exista la fuente que los alimente. Los destinos de las plantas no viven aquí: son de la planta, y son la frontera contra la que se juzga al transportista.
- **Vernier** (con contrato) — servicios con veredicto, **justificaciones** (§D), reportes propios, su lado del estado de cuenta.
  - **Servicios especiales** — los servicios de modalidad especial con su veredicto, por ventana de tiempo; se toca uno y se abre su acta. *(construido: Vernier V1, `docs/Ficha-Construccion-Vernier-V1.md`)*
  - **Contratos y perfiles** — ruta × turno, KML, tolerancias, unidades posibles. *(existe en la piel vieja; sin cuarto en la casa nueva, no se dibuja)*
- **Circuitos** (si opera público) — circuitos, paradas, tabla de horario, publicación a la app del pasajero. Su cara de operación es **la terminal del circuito** (9.9): mide la frecuencia de paso contra la tabla publicada —adelanto y retraso pesan igual (9.1b), contra la promesa de su franja horaria (9.1c)— y **no sella nada**: una pantalla de aquí que diga «cumplió» se pasó de etapa (9.3). **El circuito y la concesión son sujetos con expediente** (9.8); **la parada no lo es** —es parte del circuito—, pero **sí tiene su ficha, `Ver ‹parada›`**, a la que se llega tocándola (regla 2). Y **cada circuito registra su color**: en México una ruta se conoce por su color, así que el color es **identidad del circuito, nunca estado** —jamás «bien» o «mal», nunca el único portador de una diferencia (el nombre siempre acompaña)— y cumple 3:1 en las dos pieles (8.8c). *(existe en parte; la modalidad la define la Pieza 7 y el cumplimiento la Pieza 9; cómo se marca la modalidad en los datos sigue abierto, 7.7, y la detección del paso por parada también, 9.11)*

Fichas (se llega tocando): **Ver ‹unidad›** (ubicación viva + historial + playback + dispositivo + documentos + ledger + lo que mide de ella el circuito), **Ver ‹dispositivo›**, **Ver ‹chofer›**, **Ver ‹parada›**, **Ver ‹ruta› · ‹turno› · ‹fecha›** — el acta de una ocurrencia: veredicto + identidad + evidencia + justificación (Vernier V1).

**Ver ‹parada›** (su ley es el **9.8b**) — todo lo que se quiere ver de una parada de un vistazo: su nombre, su ubicación en el mapa, **su tabla prometida por franja** (9.1c), lo medido en ella —cada paso con su palabra y su referencia al lado («4 min · rango 5–15»)—, su **espera** —lo que lleva sin que pase nadie (9.2d, 9.3b)— y su demanda —las aperturas anónimas cerca de ella, el indicio que son y no un conteo de pasajeros (9.4, 9.7)—. Tres límites, y ninguno es negociable:

1. **La parada no es sujeto con expediente.** Es parte del circuito (9.8, sin enmienda). Tener ficha no es tener expediente: se llega tocándola, como a cualquier pieza, y lo que muestra sale del circuito del que es parada. *(El detalle vive aquí; la ley es el 9.8b.)*
2. **No lleva papeles.** Los permisos y derechos de vía viven en la **concesión**, con las reglas de vigencia del archivero. La ficha de una parada no tiene cajón de documentos.
3. **Nunca recibe veredicto propio — ley, no costumbre (9.8b).** Lo medido en una parada es **el cumplimiento del circuito en esa parada**, dicho en el vocabulario de pantalla de la etapa 1: **EN RANGO · ADELANTADA · ATRASADA · SIN DATOS** (9.3b). «Se sostuvo», «se agujeró» y «sin datos» del 9.3 quedan como nombres internos del motor y no aparecen en pantalla; tampoco **«hueco»**, que en pantalla ya significa que el equipo calló y nadie midió — lo que una parada lleva sin que pase nadie se llama **espera** (9.3b). Sin sello hasta que exista el árbitro (9.12). Este límite es **afirmación numerada del Marco** a propósito: un renglón del mapa se puede discutir, una afirmación no.

**Lo que se mide de una unidad en el circuito no crea ficha nueva.** Sus vueltas, sus pasos en rango (9.2c), sus adelantos y atrasos (9.1b), sus kilómetros y su entrada y salida del corredor (9.4) viven en la familia **Actividad** del expediente de la unidad **que ya existe** (6.30–6.33), junto a lo que esa unidad hace en especial. Una unidad es una sola, dé el servicio que dé: abrir `Ver ‹unidad›` enseña su vida completa, no una por modalidad.

Pendientes con nombre: uso fuera de horario y ubicaciones que frecuenta (§E); lo preventivo (§A presente); la planeación (§A futuro); cuenta y usuarios (Pieza 4); Diésel y Taller; y dos que existen en la piel vieja **sin casa ni nombre en la nueva** (inventario del 21 sep 2026):
- **Monitoreo** (`/carrier/monitoreo`) — los servicios del día **en curso**, ordenados por lo que cierra primero, sin un solo veredicto (el resultado se emite al cierre). Servicios especiales no lo cubre: ahí sólo entra lo ya sellado.
- **Reportes** (`/carrier/reportes`) — hoy una lista fija de entregables contractuales (reporte GPS mensual, distancia por unidad, cargos por ruta, lista de choferes, mantenimiento), sin datos detrás. Es el «reportes propios» de Vernier, todavía sin sustancia.

### 2 · Planta — cimiento: Vernier

Vive la operación diaria. Ve sólo lo suyo; jamás el Compás de su proveedor.

- **El día** — la puerta: servicios de hoy con veredicto, y lo que requiere decisión.
- **Historial** — servicios de periodos anteriores.
- **Inspecciones** — la planta audita (uniforme, botiquín, extintor, la unidad); el espejo del expediente del proveedor. *(nuevo — construible ya)*
- **Estado de cuenta** — su lado del documento del periodo (§F). *(nuevo)*

Fichas: **Ver ‹servicio›** (veredicto + evidencia + justificación cuando existe).

Pendientes con nombre: lo preventivo del lado planta; usuarios y escalación por tema (Pieza 4).

### 3 · Corporativo — cimiento: Vernier

Comparar, no operar. Agrupa sus plantas; puede tener varios transportistas.

- **Panorama** — la puerta: sus plantas comparadas, y sus transportistas comparados.
- **Estado de cuenta** — el consolidado del periodo.
- **Contratos** — con cada transportista: tolerancias, consecuencias, catálogo, disputa; sus plantas y grupos/campus; la geocerca de cada planta con su rol; el encendido y apagado del contrato.

Fichas: **Ver ‹planta›** (bajar a una planta cuando el panorama levanta bandera).

Pendientes con nombre: ausentismo contra la lista de ruta (Pieza 2); usuarios y escalación (Pieza 4).

### 4 · J-Staff — el operador de la plataforma

Ve todo, con el razonamiento completo. La única cara que cruza entre cuentas, siempre por la compuerta.

- **Compás · operación** — la puerta: salud del servidor y la ingesta, avisos del cotejo, alta masiva por lista, chips y consumo (6.24).
- **Compuerta de atención** — entrar a una cuenta con registro; el ledger completo; las correcciones que el producto aún no sabe hacer.
- **Cuentas y demos** — altas de carrier y cliente, demos que se vuelven contrato, servicio operado; el **catálogo de documentos de cada mercado** (qué papel se exige, si vence, sus días de aviso), porque es ley del mercado y no preferencia del carrier (`docs/Ficha-Expedientes.md` §5).
  - **Contratos** — todos los contratos de la plataforma con el estado de su verificación; en Ver ‹contrato› se **pausa y se reanuda la verificación** (0041, 19 sep 2026): un evento con quién, desde cuándo vale y por qué. Sólo el admin de plataforma, provisional hasta la 6.29. El estado comercial (`suspended`) va aparte y con su nombre: es una etiqueta que no detiene nada.

- **Circuitos** — la captura y la operación de los circuitos de transporte público: alta de concesión y circuito, trazado desde KML, paradas en el mapa, su horario y su frecuencia declarada, la publicación a la app del pasajero, la asignación de unidades con su historia, y su operación (`operar`) y su reporte. La promesa por franja (9.1c) todavía no se captura desde aquí. **La concesión es J-Tel**, así que su vista vive en esta casa. Es **lo más usado de la casa**. **Se está mudando** (ficha de Circuitos en la casa nueva, 21 sep 2026): el cuarto nuevo vive en `/casa/jstaff/circuitos`, con sello «Transporte público» —la lista, «Nuevo circuito» aparte y el expediente con la cadena de siete pasos (A1), en el expediente las unidades —con quién asignó y quién soltó— y la promesa por franja con «Ontoy ahorita dice» (A2), y el trazado y las paradas —cada una con su distancia al trazado de su sentido— con el editor del mapa de siempre envuelto sin tocarlo (A3); y la identidad y los ajustes de medición, cada ajuste con su valor de fábrica al lado (A4). Con A4b (0051) **las reglas de la medición se firman**: los ajustes, la tolerancia de llegada, los minutos fuera del corredor, el tiempo estimado, el horario, la zona y la fecha de arranque piden motivo y quedan en su historia con quién, cuándo y el antes → después leído de la base; el nombre y el color no son reglas. Las dos pantallas pueden guardar (ASAV, 22 sep 2026). **La jornada de una unidad** (C): desde Unidades, «Ver jornada →» abre su día en el circuito con selector de día —el resumen en números medidos, el recorrido sobre la ruta sin trayecto en los silencios, las vueltas con el vocabulario de la 9.3c y los pasos con el intervalo del servicio en cada parada, nunca como veredicto de la unidad—. Es recuerdo: sin cobre. Sólo J-Staff; la cara del transportista, si ASAV la decide. **Deuda escrita hasta el PR D:** en el mapa de ese editor el sentido de una parada se distingue sólo por color, y el skill pide forma; se paga cuando D rehaga el editor en la piel nueva (ASAV, 21 sep 2026)—. «Lo mínimo para medir» se define una sola vez, en la capa de servicios, y lo leen el expediente y la torre. **La pantalla vieja (`/jstaff/circuitos`) sigue viva** —la prueba con camiones corre sobre ella— y se retira en el PR D, cuando el cuarto nuevo se haya usado de verdad. *(existe en parte en la piel nueva; el resto, en la vieja)*

Pendientes con nombre: la matriz de permisos fina (6.29); y **el registro de entradas de la compuerta de atención, que todavía no existe**: hoy J-Staff cruza entre cuentas sin dejar huella. Se construye **antes de una segunda persona en J-Staff o de la primera pregunta de un cliente**, lo que llegue primero. Y J-Staff no escribe como otra cuenta (decisión de ASAV, 21 sep 2026): una aportación la crea sólo el transportista —cierre de la ruta en el #479— y si J-Staff algún día necesita escribir de parte de una cuenta, será por la compuerta con registro.

### 5 · Pasajero — dos apps, dos cocinas

- **Público** — la app de la ciudad: **Rutas y Mapa**, nada más (8.8), con la **parada guardada** como atajo, viviendo en el teléfono y no en el servidor (8.8b), y el color de cada ruta como su identidad (8.8c). Es un **lector**: nunca escribe, nunca juzga (8.1). Muestra la tabla publicada aunque no haya unidad en vivo (8.2), separa siempre la promesa de lo medido (8.3), estima la llegada hasta donde está el pasajero **calculándolo en su propio teléfono** (8.3b) y **no sabe quién eres**: sin cuenta y sin registro (8.7). *(existe despublicada; **ya tiene su ley: la Pieza 8 del Marco**, ratificada el 19 de septiembre de 2026)*
- **Especial** — la app del empleado: mi ruta, mi unidad en vivo, a qué hora pasa. *(nuevo; sigue sin pieza propia — el 6.28 quedó cumplido sólo a la mitad, y esta app vive como pendiente con nombre en 8.12)*

Cada app merece su propia pieza del Marco antes de construirse. La pública ya la tiene (Pieza 8); la de especial, no.

---

## Cómo se decidió qué es cuarto y qué es pendiente

Un **cuarto** existe en el mapa si tiene sustancia hoy o se puede construir ya. Todo lo demás se **nombra** con su cita del Marco —para que no se pierda— pero no se dibuja. Un mapa con cuartos imaginarios miente igual que una pantalla con botones que no existen (6.19). Cuando un pendiente gana sustancia, se gradúa a cuarto.
