# J-Tel — Plan de desarrollo

Dónde vamos y qué sigue. **Fuente única: cualquier chat nuevo lee esto para saber el estado.** Se actualiza al cerrar cada pieza. Acompaña al Marco (`docs/marco-limpio/`) y al mapa de la casa (`docs/Mapa-De-La-Casa.md`). Sustituye a `Plan-Desarrollo-Orden-Frentes.md` (15 de agosto), archivado sin editar en `docs/archivo/`. Última actualización: 19 de septiembre de 2026.

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

**El Marco: 7 piezas.** Pieza 6 (Compás, el cimiento), enmienda del expediente (§H, 6.30–6.33), Pieza 7 (la modalidad del servicio).

---

## Lo que sigue, en orden

### Ahora
1. **A · El archivero de Expedientes.** El cuarto deja de ser lista y se vuelve tablero + cajones: un buscador que atraviesa todo, «Piden atención» como bandeja del día, y cajones de Unidades · Equipos · Choferes con filas compactas. La pestaña Dispositivos muere; sus acciones se mudan al cajón Equipos. Prototipo aprobado el 19-sep; la ficha de construcción llega antes del código. Los lugares propios del carrier (base, taller) serán cajón cuando exista su fuente; los destinos de las plantas no viven aquí porque no son suyos.
2. **B · La suite de transporte público.** La terminal de operación del carrier (tiempos de parada por ubicación, y con el tiempo conteo de pasajeros) y la app del pasajero rumbo a producto. Es donde hoy ruedan los GPS propios. Sesión de diseño con prototipo antes de construir, como Vernier.

### Después
3. **C · Los pasillos.** Cómo se camina: el paso entre casas para quien tiene varias llaves, toda pieza abre su expediente desde cualquier pantalla, y el apagado de la piel vieja.
4. **D · Migrar Planta y Corporativo** — cuando los Teltonika devuelvan la evidencia y las pausas se reanuden (oct–nov). Antes serían pantallas vacías.
5. Higiene entre tramos: la lentitud de Servicios especiales (EXPLAIN pendiente), las cifras en cero, Protomaps antes de las 80 unidades.

### La muerte de la piel vieja — 30 de noviembre de 2026
La piel vieja se apaga el 30-nov: las direcciones redirigen a la casa nueva y nada de datos se toca. Antes: (1) inventario medido contra el código de todo lo que sólo ella sabe hacer, en un PR de documento; (2) cada cosa del inventario recibe destino en la casa nueva o muerte declarada. Cada «hazlo en la vieja» de aquí a esa fecha es tiempo prestado.

### Condición, no fecha
6. **Los 80+ GPS y el alta por lote.** NO es una fecha: se hace SÓLO cuando el cuarto de Compás funcione y Asav lo haya visto trabajar con los 8. Umbrella se deja cuando la prueba convenza.
   - **Decidido (17-sep):** se compran Teltonika nuevos; no se redirigen los 82 Meitrack de Umbrella. Razón: 37 son 3G (red muriendo), ~20 ya callados, cinco modelos por validar contra el árbitro, dos protocolos que mantener. Un solo modelo probado vale más que cinco por validar.
   - Pendiente sin prisa: mandar `0000,A10` por SMS al chip del 10249 (656 551 7725). Si contesta, evaluar redirigir sólo los 42 de 4G como puente mientras llegan los Teltonika.

---

## Pendientes con nombre (anotados para no perderse)

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
- **La cadencia de reporte por tipo de servicio.** La frecuencia cuesta SIM y no todas las unidades necesitan la misma: transporte público con app de pasajero pide frecuencia alta; transporte especial puede reportar menos, porque al árbitro le bastan las entradas y salidas de geocerca. Se decide con la medición real de consumo de los 8 — no antes.
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
- Cuadrar el dispositivo que no coincide: la hoja de Umbrella tiene 81 renglones (el 9181 repetido) pero en la base se dieron de baja 82.

---

## Decisiones grandes pendientes con papá / negocio

- Los valores del catálogo de documentos de Chihuahua (obligatorio, vence, periodicidad, días de aviso) — Asav los junta con su papá y los captura en la pantalla del catálogo.
- Si Compás·flota se vende solo y a qué precio (6.27).
- Las reglas del contrato Tecma, el estado de cuenta, la matriz de permisos (6.29) — sesión con papá.
