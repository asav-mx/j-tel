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

**Nombres del menú (ratificado, opción B):** el menú usa **nombres de cosa** —«Flota en vivo», «Cumplimiento», «Circuitos»— y el nombre de producto va como **sello chico** encima de su sección: «Compás» sobre la flota, «Vernier» sobre cumplimiento, «Transporte público» sobre circuitos. Razón: un coordinador sabe buscar «cumplimiento», no «Vernier»; la marca se graba por repetición del sello, sin estorbar el camino de todos. Compás y Vernier viven fuertes en la web, las ventas y los contratos — dentro del producto sirven mejor como sello que como letrero.

---

## Las cinco casas

Una casa por cara. No es la misma pantalla con permisos apagados: cada cara es su propio subdominio, con su propia puerta, sobre la misma data organizada.

### 1 · Transportista — cimiento: Compás

Compra Compás aunque nunca tenga contrato. Vernier se enciende encima cuando lo consigue.

- **Compás** (la plataforma de GPS propia)
  - **Flota en vivo** — la puerta. Mapa y lista de toda la flota ahora; grupos EN LÍNEA · SIN SEÑAL · DESCONECTADO · SIN DISPOSITIVO. Se toca una unidad y se abre su ficha. *(nuevo; lógica en #411)*
  - **Dispositivos** — el inventario (6.6): EN UNIDAD · EN BODEGA · DESCONECTADO · DE BAJA. Alta, asignación, soltar, baja desde la pantalla (6.18). *(nuevo; lógica en #411)*
  - **Lugares** — las geocercas propias, cada una con su rol; el rol decide si la traza se corta. *(existe en parte)*
- **Expedientes** — la puerta a los expedientes de las cosas del transportista: sus unidades, sus dispositivos, sus choferes, cada uno con sus cuatro familias —identidad, actividad, relaciones y documentos— (Marco 6.30–6.33). No es un archivero de papeles. La familia de documentos —el segundo afluente: pólizas, permisos, exámenes, capacitaciones, mantenimiento firmado, inspecciones— es la que hoy más falta, y es por donde se empieza. Aquí viven los **choferes**: hoy toda su sustancia es su expediente documental; cuando ganen actividad propia, su expediente crece sin cambiar de lugar. *(nuevo — construible ya, no depende del GPS)*
- **Vernier** (con contrato) — servicios con veredicto, **justificaciones** (§D), reportes propios, su lado del estado de cuenta.
  - **Contratos y perfiles** — ruta × turno, KML, tolerancias, unidades posibles. *(existe)*
- **Circuitos** (si opera público) — circuitos, paradas, tabla de horario, publicación a la app del pasajero. *(existe en parte; la modalidad la define la Pieza 7 del Marco; cómo se marca en los datos sigue abierto, 7.7)*

Fichas (se llega tocando): **Ver ‹unidad›** (ubicación viva + historial + playback + dispositivo + documentos + ledger), **Ver ‹dispositivo›**, **Ver ‹chofer›**.

Pendientes con nombre: uso fuera de horario y ubicaciones que frecuenta (§E); lo preventivo (§A presente); la planeación (§A futuro); cuenta y usuarios (Pieza 4); Diésel y Taller.

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

Pendiente con nombre: la matriz de permisos fina (6.29).

### 5 · Pasajero — dos apps, dos cocinas

- **Público** — la app de la ciudad: llegada estimada, mi parada, planear el viaje. *(existe despublicada; espera su pieza de Marco, 6.28)*
- **Especial** — la app del empleado: mi ruta, mi unidad en vivo, a qué hora pasa. *(nuevo; previsto en 6.28)*

Cada app merece su propia pieza del Marco antes de construirse.

---

## Cómo se decidió qué es cuarto y qué es pendiente

Un **cuarto** existe en el mapa si tiene sustancia hoy o se puede construir ya. Todo lo demás se **nombra** con su cita del Marco —para que no se pierda— pero no se dibuja. Un mapa con cuartos imaginarios miente igual que una pantalla con botones que no existen (6.19). Cuando un pendiente gana sustancia, se gradúa a cuarto.
