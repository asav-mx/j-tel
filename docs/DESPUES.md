# DESPUÉS — lo que aplazamos a propósito

Backlog de J-Telemetry. Aquí vive todo lo que se decidió **no** construir todavía,
con la razón por la que se aplazó y qué tiene que pasar para retomarlo.

No es una lista de deseos ni un tablero de tareas. Una entrada entra aquí solo
cuando alguien decidió aplazar algo concreto, y sale cuando se construye.

**El Marco Maestro manda sobre este archivo.** Si una entrada choca con
`docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`, gana el Marco.

## Cómo se agrega una entrada

Cuatro líneas, siempre las mismas:

- **Qué es** — en una frase, como afirmación.
- **Por qué se aplazó** — la razón real, no "falta tiempo".
- **Qué lo desbloquea** — la condición concreta que hay que cumplir primero.
- **Dónde toca** — los archivos o tablas involucrados, si ya se verificaron.

Si algo se aplaza sin razón escrita, no se aplazó: se olvidó.

**Excepción, la sección 1.** Lo que está en construcción ahora no está aplazado, así
que no lleva "por qué se aplazó". Lleva **por qué ahora**. Vive aquí porque este
archivo es el único lugar donde el alcance completo se lee de un jalón, y porque una
entrada que baja de la sección 1 a la 2 deja rastro de la decisión.

---

# Leyes de producto

**Esto no es backlog. Es ley.** Sale del incidente del 21 al 28 de julio de 2026 y de
las decisiones que lo cerraron. Cualquier entrada de este archivo que choque con una
de estas leyes está mal escrita, y se corrige la entrada.

1. **Un problema de observación jamás se convierte en veredicto.** Si el sistema no
   vio con calidad suficiente —densidad, cobertura, huecos—, el resultado es
   `pendiente_evidencia`. Nunca una acusación. Extensión operativa de la Ley 7 del
   Marco: sin evidencia ≠ incumplimiento.

2. **El servicio siempre se hace: todo `no_cumplido` carga su evidencia y su porqué
   medido.** La ausencia total es el 1–2% a lo mucho. Un rojo sin trazo GPS y sin
   motivo cuantificado —"llegó 12 minutos tarde", "el recorrido difiere del
   contratado en 3 tramos, 4.8 km por fuera"— es una acusación sin expediente y no
   debe existir. **"Sin servicio detectado" con la flota reportando es una falla de
   identificación, no una ausencia**, y se trata como tal.

3. **La matemática decide, la AI explica.** El veredicto es determinista y
   reproducible. Lenore narra, correlaciona y audita; jamás opina dentro del
   veredicto. La lectura no dictamina.

4. **El vigilante no comparte nada con lo vigilado** — ni runtime, ni base, ni
   credenciales. Si comparte uno solo de los tres, existe un fallo que los apaga a los
   dos. Ver [El vigilante vive dentro de lo vigilado](#el-vigilante-vive-dentro-de-lo-vigilado)
   para cómo se demostró.

5. **Nunca rotar credenciales sin redesplegar en el mismo movimiento.** Regla
   operativa, aprendida a lo caro el 27–28 de julio: la rotación dejó a los crones sin
   acceso 13 horas y nadie se enteró.

6. **Todo `no_cumplido` enseña lo que SÍ ocurrió.** No basta con decir el porqué
   medido: hay que mostrar **el recorrido real de las unidades del carrier en esa
   ventana**, aunque ninguna haya hecho match. La [Ley 2](#leyes-de-producto) llevada
   hasta el final — el porqué sin el qué sigue siendo una acusación que el acusado no
   puede revisar. Si el expediente no puede enseñar dónde estuvieron los camiones, no
   es un expediente.

7. **Hasta que el veredicto se sella, la política está viva.** El congelamiento ocurre
   en el **juicio**, no en el calendario. Una ocurrencia que todavía no tiene hecho
   sellado refleja la política vigente; un servicio que aún no pasó no tiene nada que
   congelar. En palabras de Asav: *"¿cuál es el punto de cambiar los valores si no se
   usan para juzgar?"*

   Lo que la regla evita es concreto: si la ocurrencia se queda con el valor viejo,
   **cambiar una perilla no tiene efecto y nada avisa** — que es exactamente lo que nos
   confundió con el corredor durante dos semanas.

   ⚠ **Pregunta abierta para el Marco Maestro.** El Marco no define esta regla hoy.
   Queda escrita aquí como decisión de producto y hay que llevarla a ratificación,
   junto con su arista: [qué pasa si la política cambia con la ventana
   abierta](#qué-pasa-si-la-política-cambia-con-la-ventana-abierta).

---

## Índice

### 1 · v1 — en construcción ahora

| Entrada | Estado |
|---|---|
| [Meta del demo](#meta-del-demo) | La cifra que hay que sostener |
| [El deadline depende de dónde corre el generador](#el-deadline-depende-de-dónde-corre-el-generador) | **PRIORIDAD 1 — bug en producción** |
| [Vista de flota del carrier](#vista-de-flota-del-carrier) | **PRIORIDAD 1 — en curso** |
| [Compuerta de densidad de observación](#compuerta-de-densidad-de-observación) | Diseño aprobado, sin construir |
| [Identificación que se explica](#identificación-que-se-explica) | El corazón de v1 |
| [Expediente del no cumplido](#expediente-del-no-cumplido) | Consecuencia de la Ley 2 |
| [Lenore v1 — vigía y narradora](#lenore-v1--vigía-y-narradora) | Entra en el demo |
| [El vigilante vive dentro de lo vigilado](#el-vigilante-vive-dentro-de-lo-vigilado) | Fase 0 — parcialmente construido |
| [Planta 47 casi no produce cumplidos](#planta-47-casi-no-produce-cumplidos) | **Diagnóstico cerrado — dos causas medidas** |
| [Turno B de Planta 47: declarado 18:00, operado ~14:00](#turno-b-de-planta-47-declarado-1800-operado-1400) | **Decisión de configuración con la Planta** |
| [Ponderación de la cobertura por valor del tramo](#ponderación-de-la-cobertura-por-valor-del-tramo) | Hipótesis medible, sin caso todavía |
| [Pendientes puntuales de v1](#pendientes-puntuales-de-v1) | En cola |

### 2 · v1.1 — inmediatamente después del demo

| Entrada | Horizonte |
|---|---|
| [Historia de cambios de configuración](#historia-de-cambios-de-configuración) | **Antes del segundo cliente** |
| [La versión del motor en el hecho](#la-versión-del-motor-en-el-hecho) | v1.1 |
| [Historia del sello en Cierre del turno](#historia-del-sello-en-cierre-del-turno) | v1.1 |
| [Medición honesta de kilómetros con brincos de GPS](#medición-honesta-de-kilómetros-con-brincos-de-gps) | v1.1 |
| [Compuerta per-candidata](#compuerta-per-candidata) | v1.1 |
| [Qué pasa si la política cambia con la ventana abierta](#qué-pasa-si-la-política-cambia-con-la-ventana-abierta) | **Al Marco Maestro** |
| [`/cliente/*` no tiene autenticación](#cliente-no-tiene-autenticación) | **Bloqueante antes del segundo cliente** |
| [El enforcement usa la política de hoy, no la congelada](#el-enforcement-usa-la-política-de-hoy-no-la-congelada) | Antes de encender enforcement |
| [Gesto explícito para borrar la hora de cierre](#gesto-explícito-para-borrar-la-hora-de-cierre) | Si más gente configura contratos |
| [Distinguir "sin hora de cierre" de "no configurado"](#distinguir-sin-hora-de-cierre-de-no-configurado) | v1.1 |

### 3 · v2 — línea Lenore completa

| Entrada | Horizonte |
|---|---|
| [El loop de aprendizaje de la operación](#el-loop-de-aprendizaje-de-la-operación) | **Marco — gobierna varias entradas** |
| [Lenore — el copiloto](#lenore--el-copiloto) | Línea de producto propia |
| [Lenore-auditora](#lenore-auditora) | **Caso de uso estrella** |
| [Lenore-copiloto de configuración](#lenore-copiloto-de-configuración) | v2 |
| [Lenore-detección de deriva](#lenore-detección-de-deriva) | v2 |
| [Lenore-copiloto general en J-Staff](#lenore-copiloto-general-en-j-staff) | v2 |
| [Modo pasajero](#modo-pasajero) | Producto aparte |

### 4 · Deuda técnica y datos — sin horizonte fijo

| Entrada | Horizonte |
|---|---|
| [El ledger debe colgar del hecho](#el-ledger-debe-colgar-del-hecho) | Cuando una cara cliente dependa del ledger |
| [Migración B](#migración-b) | Cuando exista auth-rbac |
| [Datos sintéticos en producción](#datos-sintéticos-en-producción) | Por definir |
| [Contratos demo sin corredor propio](#contratos-demo-sin-corredor-propio) | Por definir |
| [64 hechos pre-12-jul sin umbral en el snapshot](#64-hechos-pre-12-jul-sin-umbral-en-el-snapshot) | Por definir |
| [3 de 4 contratos activos sin `timeZone`](#3-de-4-contratos-activos-sin-timezone) | Antes de operar en otra zona |
| [Retención de Neon](#retención-de-neon) | Por definir |
| [El vigilante se apaga tras 60 días de repo inactivo](#el-vigilante-se-apaga-tras-60-días-de-repo-inactivo) | Vigilar |
| [`apps/web` no tiene corredor de pruebas](#appsweb-no-tiene-corredor-de-pruebas) | Antes de mover lógica a la web |
| [Migrar `autopsia.ts` al emparejamiento nuevo](#migrar-autopsiats-al-emparejamiento-nuevo) | Herramienta interna |
| [Los 15 pendientes del 28-jul se quedan pendientes](#los-15-pendientes-del-28-jul-se-quedan-pendientes) | Decidido, no se toca |

---

# 1 · v1 — en construcción ahora

El demo **es** la v1 completa. Nada de esta sección está aplazado.

## Meta del demo

**Qué es.** Sostener **≥ 90% de servicios correctamente resueltos** contra ground
truth, durante **al menos dos semanas**. "Correctamente resuelto" significa las tres
cosas a la vez: cumplidos que sí ocurrieron, no cumplidos con expediente completo, y
pendientes solo por observación genuinamente insuficiente. **Cero acusaciones sin
evidencia.**

**Por qué importa.** Esa cifra es la que levanta el capital para el GPS propio. No es
una métrica de vanidad: es el argumento.

**Ojo con la trampa.** 90% de veredictos *emitidos* no es la meta —eso se logra
aflojando umbrales—. La meta es 90% de veredictos *correctos*, y un pendiente honesto
cuenta como correcto cuando la observación de verdad no alcanzaba.

## El deadline depende de dónde corre el generador

**Qué es.** `computeExpectedDeadline` construye la fecha así:

```ts
const d = new Date(`${serviceDate}T00:00:00`);   // domain/index.ts:320 — sin Z
```

Sin marca de zona, eso se resuelve **en la zona del proceso que corre**. El mismo
contrato, el mismo turno y la misma fecha producen deadlines distintos según dónde se
generó la ocurrencia. Medido: `new Date("2026-07-21T00:00:00")` da `06:00Z` en una
máquina en horario de Juárez y `00:00Z` en Vercel, que corre en UTC. **Seis horas.**

**No es una bifurcación por contrato.** `computeExpectedDeadline` no recibe ni lee
`timeZone`, y hay un solo camino de generación. `policy.timeZone` se usa
**exclusivamente para formatear texto en pantalla**. Que Planta 47 fuera el único
contrato con la zona declarada resultó ser coincidencia.

**Cómo se demostró.** Los cuatro contratos activos tienen ocurrencias con las dos
bases, separadas por **cuándo** se crearon:

| Base usada | Creadas | Origen |
|---|---|---|
| 06:00 (correcta) | 2026-07-10 03:07 y 17:50 | corridas sueltas desde una máquina en Juárez |
| 00:00 (rota) | 2026-07-11 06:00 → 07-27 06:01 | el cron `0 6 * * *` de Vercel, en UTC |

Planta 47 está afectada al 100% por una razón banal: **su contrato se creó el 14 de
julio**, después de la última corrida local, así que todas sus ocurrencias salieron del
cron.

**El daño, medido.** El veredicto sigue a la base, no al carrier:

| Base del cálculo | hechos | cumplidos | % no cumplido |
|---|---:|---:|---:|
| Juárez (correcta) | 360 | 177 | 47.2% |
| **UTC (rota)** | **294** | **1** | **84.4%** |

**Un solo cumplido en 294 hechos sellados.**

**Y sigue ocurriendo.** El cron corre todos los días a las 06:00 UTC y agrega
ocurrencias nuevas con la base rota. Al 2026-07-28 hay **843 ocurrencias futuras** con
el deadline corrido —441 de Planta 47, 351 del Campus, 36 de PRUEBA REAL, 15 de
Honeywell— esperando su turno de juicio.

**Por qué es el peor de la familia.** La saga del reloj afectaba lo que se mostraba:
impacto monetario cero, ningún veredicto se movió. Este vive en el **cálculo del
deadline**, así que mueve veredictos y produce acusaciones falsas contra un carrier
real. Misma familia, otra gravedad.

**Qué se está construyendo.** `instanteZonificado` sube a `@jtel/domain` con sus
pruebas de horario de verano; `computeExpectedDeadline` recibe `timeZone` y delega,
con Juárez por omisión; se corrige el mismo patrón en
`apps/web/src/app/api/cliente/servicios/route.ts`. La guarda es una prueba que corre el
cálculo bajo `TZ=UTC` y bajo `TZ=America/Ciudad_Juarez` y **exige resultado idéntico** —
ese es el invariante que se violó, y no se puede satisfacer por accidente.

**El orden importa: primero el código, después los datos.** Corregir las 843 antes de
arreglar la función es achicar con la llave abierta — el cron vuelve a llenarlas a la
mañana siguiente.

**Qué NO se toca.** Los **294 hechos ya sellados**, de los cuales 248 son no cumplidos.
Simulado con la ventana corregida, **69 se volverían cumplidos (27.8%)**, 171 seguirían
en rojo y 8 pasarían a pendiente. Corregirlos reescribe historia y es **decisión de
Asav**, que la toma cuando el resto esté estable. La Pieza 1 hace que sea auditable si
se decide.

**DIAGNÓSTICO CERRADO — 2026-07-28.** Planta 47 **nunca fue el motor, ni el catálogo,
ni los umbrales.** Son **dos errores de configuración apilados**:

| Causa | Servicios que explica | Estado |
|---|---:|---|
| Zona horaria en el cálculo del deadline | **69 de 248** | Corregida en código; datos pendientes de aplicar |
| [Turno B declarado 18:00, operado ~14:00](#turno-b-de-planta-47-declarado-1800-operado-1400) | **36 más** | Requiere decisión con la Planta |

Corregidos los dos, Planta 47 quedaría **cerca del 40% de no cumplido, que es
exactamente donde está el Campus** — residuo operativo normal, no una anomalía.

Medido con la ventana corregida: 126 servicios, 27.0% cumplido y 68.3% no cumplido,
contra 59.9% y 40.1% del Campus como control. De los 86 fallos, 40 caen por A y B a la
vez, 28 solo por A, 18 solo por B y 6 porque ninguna unidad entró a la geocerca.

**Dónde toca.** `computeExpectedDeadline` en `packages/domain/src/index.ts:314`;
`generateForProfile` en `packages/db/src/repositories/index.ts:1960`;
`apps/web/src/app/api/cliente/servicios/route.ts:62`; el cron
`/api/cron/renew-occurrences`.

## Vista de flota del carrier

**Qué es.** El carrier ve **todas** sus unidades sobre una ventana de tiempo, con sus
trazos desde `telemetry_points`, sin depender del match ni de las ocurrencias.
Observación pura de lo propio: cero veredicto, cero cruce con otros carriers.

**Por qué ahora.** Cerró el diagnóstico del incidente. La pregunta que lo decidía
—"¿por dónde fue el camión el 21, el 24 y el 27?"— **no se podía contestar desde el
producto**: hoy solo existe el inventario de altas (`/carrier/flota`) y las
credenciales del proveedor (`/carrier/gps`). Ni el carrier ni nosotros pudimos
comprobar a ojo qué pasó.

**Lo que el primer sondeo ya destapó**, medido el 2026-07-28 sobre el carrier real:
de **82 unidades activas, 50 reportaron** el 27 de julio. **32 no aparecen en ningún
lado**, y **23 de ellas nunca han reportado un solo punto**. No están en el motor
—que solo ve las que hacen match— ni en la vista de flota —que solo lista altas—.
Ese es el primer caso de la Ley 2: no es ausencia de servicio, es ausencia de
identificación, y nadie la estaba viendo.

**Dónde toca.** Cara carrier, ruta nueva; `telemetry_points` con el índice
`telemetry_points_carrier_recorded_idx` que ya existe; Leaflet, ya en el proyecto
(`apps/web/src/components/carrier-candidate-compare-map.tsx` es la pieza más cercana).
Confidencialidad intacta: `carrier_account_id` es columna de la propia fila, el filtro
no pasa por ningún join.

## Compuerta de densidad de observación

**Qué es.** Medir el **intervalo mediano entre pings por unidad candidata**. Por
debajo del umbral, el resultado es `pendiente_evidencia`, no rojo. El umbral vive en
la política del contrato —`evidenceMaxPingSeconds`, o `evidenceMinResolutionPct`
derivado de la geometría—, nunca clavado en código.

**Compuerta, no normalizador.** Decisión tomada y su razón: normalizar A hacia arriba
inventa evidencia que nadie observó. La compuerta dice la verdad —*no vimos con
suficiente resolución para juzgar*— y por la Ley 1 eso es un pendiente.

**Por qué ahora.** La métrica A mide **resolución de observación, no cumplimiento**, y
la resolución la controla el proveedor de GPS, no el carrier. El 28 de julio la
densidad cayó a la mitad —de ~140 puntos por unidad por ventana (~40 s entre pings) a
77.9 (~73 s)— y desplomó A mecánicamente, sin que nadie manejara distinto.

**La geometría que fija el umbral.** Con waypoints separados ~100 m y un autobús a
40 km/h, el camión recorre 100 m en 9 segundos. Un ping cada 40 s muestrea cada
~440 m; uno cada 73 s, cada ~810 m. **La A máxima alcanzable es una función del
intervalo de ping, la velocidad y la separación de waypoints** — el carrier no puede
superarla por bien que maneje. De ahí sale el umbral, no de un número redondo.

**Qué NO arregla.** Los rojos del 21, 24 y 27 de julio tenían densidad sana
(7 197 / 7 495 / 7 134 puntos) y aun así fallaron por corredor (B = 22.6 / 38.2 /
27.3%). La compuerta habría salvado el 28 y nada más. Es correcta y necesaria; no es
la causa de aquello.

**Dónde toca.** El paso `cobertura_evidencia` del ledger — medición y umbral juntos,
como manda el Marco. `packages/verification/src`, `contractPolicySchema` en
`packages/domain/src`, y su perilla en la pantalla de contratos.

## Identificación que se explica

**Qué es.** La ficha grande, y el corazón de v1. **La inversión del orden:** primero
DESCRIBIR la realidad, luego COMPARAR contra lo contratado, luego EXPLICAR. Hoy el
motor hace lo contrario —compara contra una plantilla y si no cuadra, calla—.

Cuatro piezas:

1. **Descriptor del viaje.** De GPS crudo a un esqueleto **sin plantilla**: salida,
   paradas con su duración, tramos, llegada a geocerca. Determinista, reproducible.
   *Bonus:* las paradas detectadas son puntos de abordaje inferidos — habilita el modo
   pasajero sin tener que registrar pasajeros.

   **Requisito medido (2026-07-28): el detector de paradas se basa en POSICIÓN, no en
   velocidad.** No porque el campo `speed` mienta —se midió y es mayormente fiel: solo
   el **5.1%** de los tramos con movimiento real por encima de 15 km/h reportan cero, y
   ninguno de los 56 equipos se queda pegado en cero—. El 69% de ceros del día completo
   era flota estacionada; **dentro de las ventanas de servicio baja a 42.3%**, y de esos
   ceros la mayoría son racimos en sitios fijos (1 236 de 1 765 en una ventana medida),
   con 342 concentrados en el último 20% del recorrido: la espera en planta.

   La razón real para usar posición es otra, y es más dura: **la resolución del ping no
   alcanza**. Con un intervalo de 40 a 73 segundos, una parada de abordaje de 20 o 30
   segundos deja un punto o ninguno. Detectando por posición se encontraron las mismas
   dos paradas que detectando por velocidad — el límite no es el campo, es el muestreo.
   Posición además no depende de lo que el proveedor decida mandar. Conecta con la
   [compuerta de densidad](#compuerta-de-densidad-de-observación).

2. **Diff estructural contra el KML.** Dónde dejó el trazado, cuántos kilómetros por
   fuera, dónde lo retomó, qué tramo omitió. **Números auditables** — este es
   literalmente el "porqué medido" que exige la Ley 2.

3. **Agrupador de variantes.** Un camino alterno repetido ≥ N veces se vuelve variante
   candidata, y alimenta la promoción de variantes de la Ficha 3: la planta aprueba con
   un clic y el mapa aprende. Materializa el clustering traza-a-traza que ya estaba
   señalado como superficie pendiente.

4. **Jerarquía de señales para identificar.** En orden de robustez:
   - **Llegada a geocerca** — señal primaria del veredicto. Robusta, y ya existe.
   - **Corredor (B)** — confirma el camino.
   - **Match fino (A)** — califica fidelidad, y **solo con densidad suficiente**.
   - **Huella histórica** contra viajes ya aceptados — autocalibrante.
   - **Patrón de paradas.**
   - **Rol declarado por el coordinador** — **opcional siempre**. La autonomía es la
     promesa del producto; si el sistema depende de que alguien declare, dejó de ser
     autónomo.

**En vivo vs. sellado, sin contradicción.** La torre identifica **provisional**
mientras el viaje ocurre —corredor + dirección + historia, con su porcentaje de
confianza a la vista— y la llegada **confirma**. Monitoreo en tiempo real y veredicto
robusto conviven porque son dos afirmaciones distintas, y cada una se presenta como lo
que es.

**Toda identificación deja sus señales y sus números en el ledger.** Una identificación
que no se puede reconstruir no sirve de expediente.

## Expediente del no cumplido

**Qué es.** La pantalla que hace cumplible la Ley 2. Mapa con los dos trazos
encimados —**contratado punteado, real sólido**—, las divergencias resaltadas, los
enunciados medidos al lado, y para la planta el botón **"aprobar esta variante hacia
adelante"**.

**Por qué ahora.** Sin esta pantalla la Ley 2 es una buena intención: el motor puede
medir el porqué y aun así nadie lo ve. Y sin el botón de aprobar, cada variante
legítima vuelve a salir roja mañana.

**Dónde toca.** Cara cliente y cara planta; el diff estructural de la pieza 2 de
[Identificación que se explica](#identificación-que-se-explica);
`docs/Ficha-Handoff-Variantes-Trazado.md`.

## Lenore v1 — vigía y narradora

**Qué es.** Las dos únicas caras de Lenore que entran en el demo:

- **Lenore-vigía** — alertas preventivas durante la operación: *"6 unidades no
  reportan y el turno cierra en 20 minutos"*. Primer caso de uso: **"no te estoy
  viendo"**.
- **Lenore-narradora** — el diff estructural contado en cristiano dentro del
  expediente. Entran hechos medidos, sale lenguaje, **etiquetado como lectura**.

**Por qué ahora.** Son las dos que no tocan el veredicto, y por eso no chocan con la
Ley 3. Todo lo demás de Lenore es v2 y vive en la sección 3.

## El vigilante vive dentro de lo vigilado

**Qué es.** Todo lo que avisa de que J-Telemetry está sano corría **dentro** de
J-Telemetry: el heartbeat de ingesta era un cron de Vercel y escribía sus alertas en
la misma base que vigila. Cuando falla la base o falla Vercel, el vigilante cae con
todo lo demás y **el silencio se vuelve indistinguible de la salud**.

**Cómo se demostró.** El 2026-07-28, una rotación de contraseña dejó a los crones sin
acceso a la base. Archivado y verificación se detuvieron a las 20:00 UTC del 27 y no
volvieron hasta el redeploy de las ~09:00 UTC del 28: **13 horas.** La primera alerta
se creó a las 11:01 del 28 — *quince horas después del inicio*, y solo porque para
entonces el heartbeat ya había revivido. Nadie fue avisado en todo ese tiempo. El
incidente se descubrió porque una persona abrió Monitoreo y vio cero unidades.

**La lección, que sobrevive a la Fase 0.** Es la [Ley 4](#leyes-de-producto): un
vigilante no puede compartir **ningún** componente con lo vigilado. Cualquier alerta
futura se diseña contra esa regla.

**Qué ya se construyó.** Endpoint `/api/salud` con contrato 200/503 y sin nombres en
el cuerpo, más un vigilante externo en GitHub Actions cada 15 minutos, fuera de Vercel
y fuera de Neon (PR #89). `SALUD_URL` configurada y activa. Umbrales: **20 minutos**
para el GPS, **30 minutos** para el archivador.

**Qué falta de la Fase 0.**
- **Bitácora de corridas (`cron_runs`) y crones que no mientan.** Hoy `archiveAll`
  devuelve 200 con el error adentro, y `listByType` tronaba fuera del `try`. Un cron
  que responde 200 mientras falla es un vigilante que miente.
- **Entrega de alertas** — `notified_at` en `ingest_alerts` + Issues de GitHub, para
  que una alerta crítica salga de la plataforma.
- **Semáforo de salud en la portada de J-Staff** — acero/tenue cuando está sano,
  **azul** cuando está enfermo. Los colores de veredicto no se tocan.

**Qué sí queda aplazado.** Escalamiento por turnos y guardias, canal de voz o SMS, y
vigilancia del propio vigilante. La Fase 0 cubre un solo destinatario y un solo canal;
con más gente de operación eso deja de alcanzar.

**Dónde toca.** `vercel.json` — los cinco crones; `apps/web/src/app/api/cron/`;
`packages/services/src/ingest-health.ts`; `packages/services/src/salud.ts`; tablas
`ingest_alerts` y `telemetry_watermarks`; `.github/workflows/salud.yml`.

## Planta 47 casi no produce cumplidos

**Qué es.** El contrato de Planta 47 sella casi puros no cumplidos. Medido sobre la
base el 2026-07-28, de **285 hechos sellados: 242 no cumplidos, 42 pendientes por
evidencia y 1 solo cumplido.** Es decir, el 99.6% de los servicios no logra
acreditarse. El otro contrato de la misma cuenta, en campus, va en 36.9% de no
cumplidos sobre 363 hechos — misma planta cliente, mismo carrier, resultado
radicalmente distinto.

Esto es lo que estaba inflando el número global de no cumplidos, no los datos de
experimento. Archivar las cuentas demo mueve el total de 58.8% a 58.0%: casi nada.

**LA CAUSA ESTÁ MEDIDA — 2026-07-28. No es el catálogo ni el motor: es la hora.**

El contrato de Planta 47 (`Tecma 47 - Transporte Personal`) es **el único de los cuatro
activos que trae `timeZone` en su política** (`America/Ciudad_Juarez`). Y es justamente
el que calcula mal sus ventanas:

| Contrato | `timeZone` | Turno inicia | Deadline calculado |
|---|---|---|---|
| TECMA Campus Santos Dumont | (ninguna) | 06:00 | 11:40 UTC = **05:40 local** ✓ |
| Tecma 47 — Planta 47 | `America/Ciudad_Juarez` | 06:00 | 05:45 UTC = **23:45 local** ✗ |

**Seis horas de corrimiento, hacia la noche anterior.** El contrato vigila la ventana
04:45–06:30 UTC, que en Juárez son las 22:45–00:30. Ahí no pasa nada, y por eso nunca
encuentra a nadie.

**La prueba de que el servicio sí se presta.** El 2026-07-27, la unidad 9180 cubre el
**69% del inicio del trazado `Riveras 9 - A` a las 11:00 UTC (05:00 local)** y el **83%
a las 22:00 UTC (16:00 local)**. En la ventana que el contrato sí vigila, la mejor
cobertura de cualquier unidad es de **0% a 19%**, y el perfil `RIVERAS-9-B` marca **0%
todos los días** del 21 al 28 de julio.

Los camiones hacen la ruta. El contrato los busca a la hora equivocada.

**Lo que esto invalida.** La hipótesis anterior —que los KML no correspondan a las rutas
reales— **ya no hace falta para explicar Planta 47**, y la sesión con la Planta deja de
ser el desbloqueo. Puede seguir siendo cierta en otros contratos; aquí no era la causa.

**Lo que queda por entender, y es lo delicado.** Poner `timeZone` **empeoró** el
cálculo: el contrato sin zona acierta y el contrato con zona se corre seis horas. Eso
apunta a que la conversión se aplica invertida o dos veces en algún punto del camino
entre la política, `computeExpectedDeadline` y la generación de ocurrencias. **Está
medido el síntoma, no el código.** Encontrar el punto exacto es terreno del motor y
entra bajo parada obligatoria.

**Por qué no se corrige solo quitando la perilla.** Quitar `timeZone` de Planta 47
probablemente arregle sus ventanas hoy, pero deja la falla viva para el primer contrato
que de verdad opere en otra zona — y la deja viva en silencio, porque un hecho sellado
con la hora equivocada se ve idéntico a uno correcto. Ver
[3 de 4 contratos activos sin `timeZone`](#3-de-4-contratos-activos-sin-timezone).

**Qué lo desbloquea.** Ubicar dónde se aplica la conversión y por qué se invierte. Con
eso decidido, la corrección de Planta 47 es un cambio de configuración y una
re-verificación de sus hechos — que **sí cambiaría veredictos, así que no se toca sin
decisión explícita**.

**Por qué no puede quedarse afuera de v1.** Con 285 hechos al 99.6% de no cumplido, la
[meta del demo](#meta-del-demo) es inalcanzable mientras este contrato siga así. Y
ahora sabemos que la mayoría de esos rojos **son falsos**: acusan a un carrier que sí
prestó el servicio.

**Dónde toca.** `service_contracts.policy` → `timeZone`; `computeExpectedDeadline` en
`packages/domain/src/index.ts`; la generación de ocurrencias; `trips.evidence_window_*`.

## Turno B de Planta 47: declarado 18:00, operado ~14:00

**Qué es.** Las seis rutas `- B` del contrato de Planta 47 fallan **6 de 6 días, el
100%**, incluso después de corregir la zona horaria. Son **36 de los 86 fallos
restantes**. La causa está medida: **el trazado se recorre alrededor de las 14:00
locales y el contrato lo vigila entre las 16:45 y las 18:30.**

**El barrido de 24 horas, 27 de julio de 2026:**

| Ruta | Mejor cobertura, y a qué hora local | Ventana vigilada |
|---|---|---|
| Huertas - B | **74% a las 14:00** | 16:45–18:30 |
| Juarez Nuevo - B | **68% a las 14:00** | 16:45–18:30 |
| Km 30 - B | 52% a las 17:00 | 16:45–18:30 |
| Riveras 9 - B | **ninguna hora llega al 40%** | — |

El control descarta que sea un problema del instrumento: `Centro - A` marca **63% a
las 05:00**, justo dentro de la ventana del Turno A. Ahí el reloj sí cuadra.

**Es consistente, no errático.** Medido día por día del 15 al 28 de julio, la hora de
máxima cobertura es **las 14:00 en casi todos los días con dato**: Huertas 11 de 14
días, Juarez Nuevo 12 de 14, Riveras 9 - B las 7 veces que aparece. No es una
operación que varíe: es una hora fija distinta de la declarada. Hay un segundo pico
ocasional a las 00:00 en dos rutas, que queda por explicar.

**No es un bug.** El código calcula bien lo que se le declara. Es un horario declarado
que la operación no sigue — la misma familia que
[el deadline sin zona](#el-deadline-depende-de-dónde-corre-el-generador), pero del lado
de los datos, no del código.

**La pista que apunta al arreglo, y es más barato de lo que parece.** Tecma ya tiene un
turno **"Segundo Turno" a las 15:30**, con 8 rutas colgadas. Un servicio que llega para
un turno de 15:30 se opera justo alrededor de las 14:00. **Es probable que las rutas
`- B` estén colgadas del turno equivocado**, y entonces el arreglo es reasignarlas, no
cambiar el horario de "Turno B" — que además afectaría a las otras rutas que sí
dependen de él.

**Qué NO se puede decidir desde la base.** Cuál de los dos está mal: el horario
declarado o la asignación de rutas al turno. Y dos datos acotan la pregunta: tres de
las seis rutas `- B` **no tienen par `- A`** (Huertas, San José, San José Auxiliar), así
que "B" no es simplemente el regreso de "A"; y `Riveras 9 - B` solo comparte el **9%**
de su trazado con `Riveras 9 - A`, o sea son caminos distintos, no ida y vuelta.

**Qué lo desbloquea.** Confirmar con la Planta la hora real de ese servicio y a qué
turno pertenecen esas rutas. Es una conversación, no código.

**Y es el tercer caso del mismo patrón.** Un valor declarado que la operación contradice
todos los días, detectado a mano por una persona que fue a buscarlo. Ver
[El loop de aprendizaje de la operación](#el-loop-de-aprendizaje-de-la-operación).

**Dónde toca.** `shifts.start_time`; `route_shifts` — la asignación ruta↔turno; nada de
`packages/verification`.

## Ponderación de la cobertura por valor del tramo

**Qué es.** Que la cobertura no se promedie pareja a lo largo de la ruta: que los tramos
de recolección —donde sube la gente— pesen más que los de traslado a la planta. La razón
de Asav: una unidad puede recoger a todos perfectamente y desviarse solo en el traslado,
y un score global la condena por el tramo que menos importa.

**Por qué se aplazó.** Se midió el 2026-07-28 sobre RIBERAS-9-I en el 21, 24 y 27 de
julio, dividiendo el trazado en diez tramos de igual distancia, y **quedó refutada en
ese caso — al revés de lo esperado**: el fallo no estaba repartido parejo ni
concentrado al final, sino que **los primeros 13.6 km (el 60% de la ruta) tenían
cobertura cero**. Ponderar más la recolección habría hecho ver **peor** a esa ruta, no
mejor, porque lo que faltaba era justamente la recolección.

**Por qué no se descarta.** Refutada en ese caso, no en general. El escenario que
describe —recoger bien y desviarse en el traslado— simplemente no ocurría ahí: ninguna
unidad recogía bien. La hipótesis sigue viva y ahora es **barata de probar**, porque el
instrumento ya está construido.

**Qué lo desbloquea.** Encontrar una ruta donde **una sola unidad cubra el trazado
completo y aun así el score quede corto**. Ahí la ponderación prueba algo. Mientras no
exista ese caso, es una perilla sin evidencia que la pida.

**Cómo se mide, para no repetir el diseño.** Tramos de **igual distancia sobre el
trazado**, no por número de waypoints ni por paradas detectadas. Segmentar por paradas
presupone dónde termina la recolección, y entonces la medición ya no puede contradecir
a quien la diseñó. Las paradas son la unidad correcta del producto; el kilómetro es el
instrumento neutro de la medición.

## Pendientes puntuales de v1

**Anomalía del sello anticipado — verificación pendiente.** Sospecha sin comprobar:
que el motor juzgue en `deadline + gracia` (10 min) mientras la ventana de evidencia
sigue abierta hasta `deadline + gracia + margen` (45 min). Si es cierto, sella con
evidencia incompleta y viola la Ley 1 sin que nadie lo note. **Es solo lectura y hay
que medirlo antes de construir nada encima.**

**Cierre del turno.** PR #87 en pausa. Se retoma cuando el motor de identificación
esté estable — sellar un turno con identificación que no se explica es apilar sobre
arena.

**Medidor de calidad del proveedor.** Densidad de pings por equipo por día, con alerta
y gráfica. No es solo diagnóstico interno: es el **expediente para negociar con
Umbrella o con quien sea el proveedor**. Comparte medición con la
[compuerta de densidad](#compuerta-de-densidad-de-observación).

---

# 2 · v1.1 — inmediatamente después del demo

## Historia de cambios de configuración

**Qué es.** Quién editó qué KML, qué política o qué perfil, cuándo, y qué había antes.
La Pieza 1 —historia de hechos— aplicada río arriba, a la configuración que los
produce.

**Por qué se aplazó.** No existía cuando se decidió el alcance de v1, y el hecho
congelado ya guarda el snapshot de la política, que parecía suficiente. **No lo es:**
el snapshot dice qué valor gobernó, pero no quién lo puso ni contra qué lo cambió.

**Lo que costó no tenerla.** El forense del 28 de julio se llevó un día entero
reconstruyendo a mano, desde snapshots congelados, que el corredor pasó de 120 a
150 m y el match de 40 a 60% entre el 13 y el 14 de julio. Con esta historia, esa
reconstrucción era una consulta.

**Qué lo desbloquea.** Nada técnico — es una decisión de prioridad. **Requisito antes
del segundo cliente:** con un solo cliente y una sola persona configurando, la memoria
humana todavía alcanza. Con dos, no.

**Es además prerrequisito de otra cosa más grande.** Sin esta historia, *"la
configuración aprendió"* es indistinguible de *"alguien le movió"*. Ver
[El loop de aprendizaje de la operación](#el-loop-de-aprendizaje-de-la-operación).

**Dónde toca.** `route_kml_versions`, `service_contracts.policy`, `service_profiles`.

## La versión del motor en el hecho

**Qué es.** Guardar en el hecho congelado qué versión del código lo juzgó, junto al
snapshot de la política que ya se guarda.

**Por qué se aplazó.** No se había notado el hueco. El hecho **congela la política
pero no el motor**, así que un veredicto no es reproducible de verdad: el mismo
contrato, la misma evidencia y la misma política pueden dar resultados distintos si el
código cambió en medio, y nada en el hecho lo delataría.

**Qué lo desbloquea.** Decidir qué se guarda —hash del commit, versión del paquete de
verificación, o ambos— y aceptar que un cambio de motor obliga a marcar los hechos
anteriores como juzgados por otra versión.

**Por qué importa más de lo que parece.** Marco Legal construye el contrato sobre la
promesa de reproducibilidad. Sin esto, la promesa tiene una grieta que el forense del
28 tuvo que cerrar a mano, re-corriendo 22 hechos del 14 de julio contra el motor de
hoy para demostrar que no habíamos sido nosotros.

**Dónde toca.** `compliance_facts` — junto a `contract_policy_snapshot`.

## Historia del sello en Cierre del turno

**Qué es.** El cajón "Historia del sello · N versiones" dentro del Cierre del turno,
con la versión vigente arriba y la anterior tachada pero legible, cada una con su
firma y su motivo.

**Por qué se aplazó.** Mostrar el motivo exige guardar la intención de la
re-verificación, y `compliance_fact_history` hoy guarda **quién** (`actorKind`,
`actorId`) pero no **por qué**: no tiene columna de causa ni de intención. Agregarla
toca la escritura de hechos, y eso no lo justifica una pantalla de resumen. En v1 el
Cierre del turno muestra solo el punto azul junto al chip; el motivo vive en el
expediente.

**Qué lo desbloquea.** Que el expediente necesite la causa. Ahí sí se justifica la
columna, y el punto azul del Cierre se vuelve la miniatura de algo que ya existe.

**Dónde toca.** `packages/db/src/schema/index.ts` — `complianceFactHistory`.

## Medición honesta de kilómetros con brincos de GPS

**Qué es.** Que la distancia recorrida deje de ser aproximada: descartar el tramo del
brinco con criterio propio y poder presentar el kilometraje como medición exacta, no
como estimación.

**Por qué se aplazó.** En v1 los kilómetros se calculan al vuelo sumando haversine
sobre el rastro, descartando brincos con el detector de salto por velocidad que ya
existe. Eso alcanza para orientar, no para afirmar: por eso en pantalla van marcados
como **aproximados**. Un brinco descartado deja un hueco en la suma, y hoy no hay
regla acordada para rellenarlo.

**Qué lo desbloquea.** Una regla de reconstrucción del tramo descartado, y la
decisión de si el kilometraje se sella con el hecho o se queda como medición al
vuelo. Mientras siga siendo al vuelo, no puede vivir en la zona de veredictos —
el árbitro no lo selló.

**Dónde toca.** `packages/verification/src` (`haversineKm`, unificado ahí en v1),
`evidence_points`, `route_kml_versions.waypoints`.

## Compuerta per-candidata

**Qué es.** Que la compuerta de cobertura se evalúe **por unidad candidata** y no una
sola vez para todo el servicio.

**Por qué se aplazó.** Hoy `assessEvidenceCoverage` corre por IMEI y se queda con la
cobertura **del mejor** — o sea, una unidad con telemetría impecable abre la compuerta
para todas las demás, incluidas las que no reportaron. **El defecto está señalado y
medido, y hoy no muerde** porque el servicio se acredita con la unidad que sí se vio;
empezará a morder cuando la compuerta decida entre candidatas, que es justo lo que
introduce la [compuerta de densidad](#compuerta-de-densidad-de-observación).

**Qué lo desbloquea.** La compuerta de densidad. Las dos tocan el mismo paso del
ledger y conviene corregirlas de una vez, no en dos pasadas.

**Dónde toca.** `assessEvidenceCoverage` en `packages/verification/src`; el paso
`cobertura_evidencia` del ledger.

## Qué pasa si la política cambia con la ventana abierta

**Qué es.** La [Ley 7](#leyes-de-producto) dice que una ocurrencia sin juzgar refleja
la política vigente. Falta el caso intermedio: **la ventana ya se abrió y está
anclando evidencia** cuando alguien mueve una perilla. Recalcular podría **descartar
puntos ya observados**, y eso choca de frente con la Ley 1.

**La propuesta, en tres estados y un invariante.**

| Estado | Condición | Qué pasa con un cambio de política |
|---|---|---|
| **Programada** | Cero evidencia anclada | Se recomputa. La política vigente manda. |
| **Recogiendo** | Hay evidencia anclada | Se recomputa **solo si la ventana nueva contiene a la anterior**. Si no, el cambio se **difiere** a la siguiente ocurrencia. |
| **Sellada** | Hay hecho | Congelada. Lo dice el Marco. |

El invariante que sostiene los tres: **ningún cambio de configuración descarta una
observación ya hecha.** Ampliar la ventana no pierde nada —solo suma—, así que se
permite; recortarla o desplazarla sí perdería, así que espera.

El estado se decide por **evidencia anclada, no por reloj**: "la ventana ya abrió" es
una condición temporal ambigua; "tiene puntos" es un hecho que se consulta.

**Y lo que hace que la regla no se muerda la cola: un cambio diferido tiene que
verse.** En la pantalla de contratos, algo como *"esta política aplica desde la próxima
ocurrencia; N ocurrencias en curso conservan la anterior"*. Sin ese aviso volvemos al
problema exacto que originó la Ley 7 — mover una perilla, que no pase nada, y que nadie
avise.

**Qué está construido hoy.** La forma **estricta**: `corregir-deadlines` bloquea
cualquier ocurrencia con evidencia anclada y la reporta con su motivo, en vez de
recomputarla. Es más conservadora que la propuesta y no muerde: al 2026-07-28 hay
**cero** ocurrencias futuras con evidencia. La versión con superconjunto se construye
cuando exista el primer caso, no antes.

**Qué lo desbloquea.** Ratificación en el Marco Maestro. Mientras tanto gana la forma
estricta, que nunca descarta nada.

**Dónde toca.** `packages/db/src/corregir-deadlines.ts`;
`packages/db/src/deadline-diff.ts`; la pantalla de contratos.

## `/cliente/*` no tiene autenticación

**Qué es.** Las rutas de cara al cliente no están protegidas. El único middleware que
las toca (`apps/web/src/middleware.ts`) solo **repara parámetros `?account=` mal
pegados**; no verifica identidad. Cualquiera con la URL ve **cualquier cuenta**
cambiando el parámetro, y `resolveAccountByType` cae a la primera cuenta del tipo
cuando no se pasa ninguno.

**Por qué es grave.** Choca de frente con la ley del Marco de que las cuentas son
privadas: el carrier no ve a otros carriers, el cliente no ve a otros clientes. Hoy esa
promesa la sostiene el desconocimiento de la URL, no el sistema. Y tiene un efecto
secundario que ya mordió: **no hay bitácora de acceso**, así que ante la pregunta
"¿este cliente ya vio esto?" la base no puede responder — solo se puede preguntar.

**Por qué se aplazó.** El proyecto ha corrido con una sola cuenta real por tipo y con
Clerk instalado pero sin cablear a los caminos de datos. Mientras el círculo de gente
con la URL es el equipo, el riesgo es teórico.

**Qué lo desbloquea.** Auth-rbac cableado a las rutas de cara al cliente.
**Bloqueante antes del segundo cliente**: el día que dos clientes distintos tengan URL,
el riesgo deja de ser teórico y se vuelve una fuga.

**Dónde toca.** `apps/web/src/middleware.ts`; `apps/web/src/lib/account-context.ts` —
`resolveAccountByType`; `packages/auth-rbac`.

## El enforcement usa la política de hoy, no la congelada

**Qué es.** `loadServiceDetail` calcula las consecuencias con `contract.policy`
—la política **vigente**— en vez de `fact.contractPolicySnapshot`, que es la que
gobernó el veredicto. Un servicio de hace tres semanas se muestra con las reglas de
hoy.

**Por qué es un problema de ley, no de estética.** El Marco dice que el hecho se
computa una vez y se congela. Si alguien agrega una regla de no pago hoy, la pantalla
la aplica retroactivamente a hechos que se sellaron cuando esa regla no existía — y el
expediente deja de ser reproducible.

**Por qué se aplazó.** El impacto hoy es bajo: el enforcement **no se persiste en
ningún lado** —es función pura al momento de pintar—, no viaja en el CSV del reporte
mensual, y la única superficie que lo muestra es el detalle de servicio de cara al
cliente. Nada ha salido de la pantalla.

**Qué lo desbloquea.** Encender enforcement. La decisión de producto es que **primero
el árbitro confiable y después el enforcement** —encenderlo antes multiplica los
errores en vez de corregirlos—, así que esto se corrige en el mismo movimiento en que
se encienda, no antes.

**Dónde toca.** `apps/web/src/lib/service-detail-data.ts:132` y `:267`;
`packages/domain/src/enforcement.ts`.

## Gesto explícito para borrar la hora de cierre

**Qué es.** Un gesto propio —una casilla, un botón— para quitar
`shiftCloseMinutesAfterStart` de la política, en vez de vaciar el campo.

**Por qué se aplazó.** En v1, vaciar la casilla borra el valor y la llave ni siquiera
llega al jsonb. Con una sola persona configurando contratos, eso es suficiente y no
sorprende a nadie.

**Qué lo desbloquea.** Que más gente configure contratos. En cuanto haya alguien que
no escribió la regla, "vaciar borra" deja de ser obvio y se vuelve una trampa.

**Dónde toca.** `apps/web/src/views/contratos-unit.tsx`;
`apps/web/src/app/api/cliente/contratos/route.ts` — `toOptionalInt`.

## Distinguir "sin hora de cierre" de "no configurado"

**Qué es.** Que la política sepa diferenciar *este contrato no cierra turno* de *nadie
ha decidido todavía si cierra*.

**Por qué se aplazó.** Hoy las dos cosas se ven igual: la llave simplemente no está en
el jsonb. Para v1 alcanza porque el default es no cerrar, pero es la misma clase de
ambigüedad que la Ley 1 combate — ausencia de dato leída como decisión.

**Qué lo desbloquea.** Que alguna pantalla necesite decir "sin configurar" en vez de
callar. Ahí hace falta un tercer estado explícito.

**Dónde toca.** `contractPolicySchema` en `packages/domain/src`.

---

# 3 · v2 — línea Lenore completa

## El loop de aprendizaje de la operación

**Qué es.** J-Tel ve **la misma operación repetirse todos los días**. Cada valor
declarado —la hora de un turno, el radio del corredor, el trazado de una ruta, la
unidad asignada— es una **hipótesis sobre esa operación**. Cuando lo declarado y lo
observado divergen de forma sostenida, eso no es ruido: es **información que hoy se
desperdicia**.

La forma es siempre la misma:

> **declarado ↔ observado → divergencia sostenida → propuesta → aprobación humana → la
> configuración aprende**

**Por qué es marco y no tarea.** Esta entrada no se construye. Es la **forma
compartida** de varias entradas que ya viven en este archivo y que hasta hoy estaban
sueltas. Se escribe para que la siguiente que aparezca se reconozca como parte de lo
mismo y no se vuelva a diseñar desde cero.

**No es teórico: ya lo pagamos tres veces.** Los tres hallazgos del 28 de julio de 2026
son exactamente esta forma, resuelta a mano por una persona en vez de por el sistema:

| Caso | Declarado | Observado | Cómo se detectó |
|---|---|---|---|
| [Zona horaria en el deadline](#el-deadline-depende-de-dónde-corre-el-generador) | ventana 22:45–00:30 local | la ruta se recorre a las 05:00 | forense de un día entero |
| Anticipación vieja en 40 ocurrencias del Campus | la política dice 20 min | las ocurrencias traen 15 | comparación fila por fila |
| [Turno B declarado 18:00](#turno-b-de-planta-47-declarado-1800-operado-1400) | ventana 16:45–18:30 | 14:00, 11 de 14 días | barrido de 24 horas |

Ninguno de los tres necesitó un dato que no tuviéramos. Los tres estaban repitiéndose
todos los días, a la vista, y nadie los estaba mirando.

### Las tres capas

**Capa 1 — lo declarado que debe coincidir con la realidad.** El loop **corrige la
declaración**: hora del turno · asignación ruta↔turno · trazado y variantes (Ficha 3) ·
unidad habitual por ruta · días activos · geocerca de destino · puntos de abordaje
inferidos.

**Capa 2 — umbrales que deben calibrarse, no adivinarse.** El loop **afina la
perilla**: radio del corredor desde la dispersión real del GPS · umbrales A y B ·
[umbral de densidad](#compuerta-de-densidad-de-observación) desde la geometría de ping ×
velocidad × separación de waypoints · duración máxima desde la distribución observada ·
márgenes de evidencia desde la distribución real de llegadas.

**Capa 3 — lo que el loop revela de la operación misma.** Aquí **informa, no corrige**,
y esto es **producto nuevo**: rutas que se hacen más lentas semana a semana · equipos
GPS que se degradan antes de enmudecer, o sea mantenimiento predictivo · reasignación de
flota detectada · patrones por día de la semana · velocidades y congestión por calle y
por hora · rutas crónicamente tarde con su causa medida.

**Esta capa es valor que el cliente y el carrier querrían aunque no hubiera contrato que
verificar.** Es la única de las tres que no depende de que exista un árbitro.

### La trampa

**No se pueden calibrar umbrales contra la operación que se juzga.** Afinar el corredor
hasta que todo pase convierte al árbitro en decorado: el sistema deja de medir
cumplimiento y empieza a medir su propia tolerancia. La calibración se mide contra una
vara externa, **nunca contra el deseo de que se vayan los rojos**.

Y esa vara externa no es "verdad de campo" a secas. Tiene dueño, y son dos.

### Quién calibra qué

| Lado | Qué se calibra | Quién | Por qué le toca |
|---|---|---|---|
| **Normativo** — qué cuenta como cumplido | variantes de ruta, tolerancias, motivos excusables, desviación aceptable | **La planta** | Los servicios son para ella: los solicita y los paga. El estándar de cumplimiento es una **definición contractual suya**, no un hecho de la naturaleza. El carrier tiene incentivo de aflojar el umbral; la planta no. |
| **Factual** — si observamos bien | identificación, cobertura, unidad correcta, huecos | **El carrier** | Es su operación. La planta sabe si su gente llegó; **no sabe si el camión fue el 9180**. Solo el carrier sabe eso. |
| — | nada | **El árbitro** | No calibra. **Aplica.** |

En palabras de Asav: *"las solicitudes son juzgadas conforme a lo que el cliente defina,
y el árbitro es imparcial hacia el resultado."*

**Esto extiende el Marco, no agrega una regla nueva.** La planta ya define geocercas,
turnos, rutas y contratos —**lo que se verifica**—; el carrier ya configura flota y GPS
—**cómo atiende**—. El loop no reparte poder nuevo: pone a cada lado a calibrar lo que
ya le pertenece.

**Y los dos calibran de forma distinta, que es lo que impide que se rompa.**

- La planta **aprueba**. Su aprobación es normativa: define la vara. Se sella como hecho.
- El carrier **señala**. Su señalamiento es factual: apunta dónde buscar. Lo verifica la
  matemática.

Ninguno de los dos mueve la compuerta de observación. La frase, en las dos direcciones:

> La planta puede decir *"ese camino alterno cuenta"*; no puede decir *"nuestro GPS ve
> mejor de lo que ve."*
> El carrier puede decir *"fue la unidad 9180"*; no puede decir *"sí se hizo,
> créanme."*

Si las dos cosas se mezclan, alguien afloja la compuerta de densidad *"porque la planta
aprobó"* —o *"porque el carrier lo asegura"*— y el sistema emite veredictos sobre lo que
no observó, rompiendo la [Ley 1](#leyes-de-producto).

### El dicho del carrier no es evidencia

**Es una hipótesis a verificar.** Si el carrier pudiera decir *"sí se hizo"* y el
veredicto cambiara, el juzgado le estaría preguntando al acusado si es culpable.

Lo que sí puede hacer son tres cosas, y las tres son legítimas:

1. **Señalar evidencia que existe y no se consideró** — *"fue la unidad 9180"*.
2. **Aportar contexto que cae en un motivo excusable** — ya previsto en el Marco.
3. **Proponer que un camino alterno se reconozca** — y esa propuesta va **a la planta**,
   porque es normativa.

Las tres son **punteros hacia evidencia**, no afirmaciones que sustituyan a la
evidencia, y las tres se verifican con la misma matemática que juzga a todos. **El
carrier dirige la búsqueda; la matemática dictamina.** Es la
[Ley 3](#leyes-de-producto) extendida: la matemática decide, **las partes aportan**.

### Lo que esto conecta

Tres cosas que ya estaban en el backlog, sueltas, y que resultan ser **el lado factual
del mismo loop**:

| Pieza | Dónde vive hoy | Qué le falta |
|---|---|---|
| El circuito de defensa del carrier | `docs/Pieza3-Expediente-Contenido-Canonico.md` ya le reserva el hueco: la cara del carrier incluye *"su vista de defensa"* | que el señalamiento salga de la pantalla y llegue a alguien |
| **Ficha 4 — defensa del carrier** | `docs/marco-limpio/Anexo-Estado-J-Telemetry.md` | el circuito completo: coordinador reporta → planta acepta → re-juicio auditado |
| La etiqueta de calibración | **construida**, hoy solo para rojos sin unidad | el carrier ya dice *"sí se hizo"* — pero **solo calibra y no llega a nadie** |

**Y un bloqueo real que hay que decir en voz alta.** El Anexo ya lo registra y lo marca
como relevante para la Ficha 4: **~4% de los hechos congelados no son reproducibles por
el motor actual** (hallazgo del 23 de julio, sin investigar). Si el carrier impugna un
`no_cumplido`, hoy el sistema **no puede reproducir la evaluación del día D con los datos
del día D** — el dry-run usa el catálogo de hoy. Un circuito de defensa montado sobre un
motor que no reproduce el pasado le contesta al carrier con algo que no corresponde al
hecho sellado. Emparenta con
[la versión del motor en el hecho](#la-versión-del-motor-en-el-hecho).

### Las dos consecuencias

**(a) Cada aprobación de la planta se sella como un hecho** — quién, cuándo, qué aprobó y
**desde qué fecha aplica**. Es la Pieza 1 aplicada a las aprobaciones. Sin ese registro,
el argumento de imparcialidad se cae ante la primera disputa: *"usted aprobó esa
variante"* no se sostiene si no hay dónde leerlo. Lo mismo del otro lado: **un re-juicio
pedido por defensa queda archivado con quién lo pidió, cuándo y por qué** — auditable por
construcción, porque la Pieza 1 ya guarda la historia del sello.

**(b) Mientras una propuesta espera aprobación, el servicio se juzga contra la vara
vigente y sale rojo si no la cumple** — pero el expediente muestra que hay una variante
pendiente. Es la fórmula que ya está en el Marco: **rojo honesto + motivo claro +
aprobación rápida hacia adelante**. Un rojo que se retiene *"por si acaso la aprueban"*
es un veredicto que no afirma nada.

### La métrica que sale del diseño

**Tasa de acierto de las disputas del carrier.** Sale gratis del circuito de defensa y es
**la señal más limpia de calidad de identificación que podemos tener**:

- Disputa y **la matemática le da la razón** → nuestra identificación falló ahí. Es un
  falso negativo con nombre, fecha y ruta.
- Disputa y **la matemática lo desmiente** → está confundido, o probando suerte.

**Un carrier que dispute 50 veces y acierte 45 nos está diciendo que el motor está
ciego.** Ninguna métrica interna diría eso con esa claridad, porque todas las que
tenemos las calcula el mismo motor que estaría fallando.

Con una condición: la métrica solo es honesta si el re-juicio es reproducible. Ver el
bloqueo de arriba.

### Los tres prerrequisitos

Dejan de ser opcionales el día que se decida construir el loop:

1. **[El descriptor del viaje](#identificación-que-se-explica)** — no se detectan
   patrones en lo que no se describe. Sin esqueleto del viaje no hay "hora habitual" ni
   "camino habitual" que comparar contra lo declarado.
2. **[La historia de cambios de configuración](#historia-de-cambios-de-configuración)** —
   es a la configuración lo que la Pieza 1 es a los veredictos. Sin ella, *"la
   configuración aprendió"* es indistinguible de *"alguien le movió"*.
3. **Una superficie de propuestas** — dónde aparece *"detectamos esto, ¿lo apruebas?"*
   con su mapa y sus números. Es **la razón de ser de Lenore**, y donde se cruzan
   [Lenore-detección de deriva](#lenore-detección-de-deriva) y
   [Lenore-copiloto de configuración](#lenore-copiloto-de-configuración).

**Qué lo desbloquea.** Los tres prerrequisitos, en ese orden. Y una precondición que no
es técnica: **nada de esto se construye antes de que el árbitro sea confiable.** Un loop
de aprendizaje montado sobre un motor que se equivoca aprende los errores más rápido de
lo que los corrige.

**Dónde toca.** `docs/marco-limpio/Anexo-Estado-J-Telemetry.md` — Fichas 2, 3 y 4;
`docs/Pieza3-Expediente-Contenido-Canonico.md` — la vista de defensa del carrier; la
etiqueta de calibración ya construida; `compliance_fact_history`; `ledger_entries`.

## Lenore — el copiloto

**Qué es.** Línea de producto propia. J-Tel es el juez: espera a que el viaje termine
y dicta resultado. Lenore es el copiloto: ve el viaje mientras ocurre y avisa antes de
que truene. De cara al cliente en ambas cuentas, no herramienta interna. Definida en
`docs/Mapa-Producto-J-Telemetry.md`, sección 7.

**Por qué se aplazó.** Es un producto aparte, no una pantalla de J-Telemetry. Mezclarla
con el árbitro confunde las dos promesas: una afirma sobre el pasado y está sellada, la
otra anticipa el futuro y no puede estarlo. La [Ley 3](#leyes-de-producto) es la línea:
la matemática decide, la AI explica.

**Qué lo desbloquea.** Nombre comercial final y sesión de diseño propia. Dos superficies
distintas, no una con permisos apagados.

**Qué sí entra antes.** Las dos caras que no tocan el veredicto —vigía y narradora—
van en v1. Ver [Lenore v1](#lenore-v1--vigía-y-narradora).

## Lenore-auditora

**Qué es.** El **caso de uso estrella**. La pregunta *"¿por qué salió roja esta ruta
tal día?"* contestada con una investigación automática y con evidencia: comparar
snapshots de política a lo largo del tiempo, simular con umbrales viejos, cruzar
densidades de GPS, descartar sospechosos uno por uno.

**La especificación ya existe: es el forense del 28 de julio de 2026.** Ese día, para
explicar por qué Campus Santos Dumont pasó de 14/14 cumplidos el 14-jul a 1/14 el
28-jul, hubo que eliminar cuatro sospechosos con evidencia:

| Sospechoso | Cómo se descartó |
|---|---|
| El motor | 22/22 hechos del 14-jul reproducen idénticos con el código de hoy |
| El catálogo KML | Una sola versión, creada el 09-jul, nunca reemplazada |
| La política | Congelada byte a byte desde el 20-jul, con verdes **y** rojos después |
| La densidad de GPS | Sana el 21, 24 y 27 — solo explica el 28 |

Y quedó demostrado que revertir umbrales no habría salvado nada, porque el fallo era
por corredor (B) y no por match (A).

**Por qué se aplazó.** Requiere que Lenore lea hechos sellados, ledger e historia de
configuración —y la [historia de cambios de configuración](#historia-de-cambios-de-configuración)
todavía no existe—. Sin ella, la auditora reconstruye a mano lo mismo que reconstruimos
nosotros.

**Qué lo desbloquea.** La historia de cambios de configuración, y
[la versión del motor en el hecho](#la-versión-del-motor-en-el-hecho). Con esas dos, la
investigación es determinista.

**Qué gana.** Lo que le tomó un día a tres personas, en minutos. Y por la
[Ley 3](#leyes-de-producto): la auditora **narra y correlaciona**, no dictamina — el
veredicto sigue siendo de la matemática.

## Lenore-copiloto de configuración

**Qué es.** Las ~20 perillas de la política traducidas a lenguaje humano, con
sugerencias de valores y la explicación de qué cambia cada una.

**Por qué se aplazó.** Es v2 de Lenore, y hoy no hay suficientes contratos
configurados como para que el ahorro se note.

**Qué lo desbloquea.** Más gente configurando contratos. Emparenta con el
[gesto explícito para borrar](#gesto-explícito-para-borrar-la-hora-de-cierre): las dos
salen del mismo problema, que la política es densa y no se explica sola.

## Lenore-detección de deriva

**Qué es.** *"Esta ruta cambió de comportamiento el día X, y coincide con el cambio
Y."* Detección de que algo se movió, sin que nadie tenga que sospecharlo primero.

**Por qué se aplazó.** Necesita historia de configuración y una línea base de
comportamiento por ruta; ninguna de las dos existe todavía.

**Qué lo desbloquea.** La huella histórica de la
[jerarquía de señales](#identificación-que-se-explica) — esa línea base es la misma.

**Por qué duele no tenerla.** Riveras 9 se degradó a lo largo de dos semanas y nadie lo
vio hasta que alguien contó los rojos a mano.

**Dónde encaja.** Es la superficie de la capa 3 del
[loop de aprendizaje](#el-loop-de-aprendizaje-de-la-operación) — la que informa sin
corregir. Detectar la deriva es la mitad; la otra mitad es que la propuesta llegue a
quien puede aprobarla.

## Lenore-copiloto general en J-Staff

**Qué es.** Preguntas en lenguaje natural sobre el dominio de quien pregunta, leyendo
hechos sellados.

**Por qué se aplazó.** Es la superficie más amplia y la que más fácil rompe la
[Ley 3](#leyes-de-producto): una respuesta bien redactada se lee como dictamen. Va al
final, cuando las caras acotadas —auditora, narradora, vigía— hayan asentado dónde
está la línea.

**Qué lo desbloquea.** Que las otras caras de Lenore estén en producción y probadas.

## Modo pasajero

**Qué es.** Verificación **por llegada de personas**, no por camino recorrido. El
producto que responde "¿llegó la gente?" en vez de "¿fue por donde debía?".

**Por qué se aplazó.** Es otro producto, no otra perilla.

**Advertencia que no se puede perder.** La perilla `destino_only` de `routeStrictness`
**está reservada para esto y no se usa como estabilizador**. Ponerla para que un
contrato deje de salir rojo es apagar la verificación de ruta y llamarlo otra cosa.

**Qué lo desbloquea.** El descriptor del viaje de
[Identificación que se explica](#identificación-que-se-explica): las paradas detectadas
son puntos de abordaje inferidos, y eso habilita el modo pasajero **sin registrar
pasajeros**. Conecta con jrz-pass y con ausentismo anticipado.

---

# 4 · Deuda técnica y datos — sin horizonte fijo

## El ledger debe colgar del hecho

**Qué es.** Que `ledger_entries` tenga una referencia directa al hecho que produjo,
para poder leer las mediciones de una corrida sin adivinar cuál fue.

**Por qué se aplazó.** Hoy `ledger_entries` tiene `serviceOccurrenceId`, `tripId` y
`createdAt`, pero **no** `factId`. Tras una re-verificación hay varias entradas
`verificacion_automatica` para la misma ocurrencia, y la única forma de emparejar es
por fecha contra el `materializedAt` vigente. Es frágil, y ya muerde:
`apps/web/src/lib/autopsia.ts` toma la **primera** entrada que encuentra, sin
emparejar — para una herramienta interna de análisis pasa, para una cara cliente no.
Son **121 587 filas**, así que la migración no es gratis.

En v1 el Cierre del turno empareja por fecha y, cuando no puede hacerlo con certeza,
**no muestra el número**: dice "medición no disponible". Un hueco honesto antes que
una cifra de la corrida equivocada.

**Qué lo desbloquea.** La primera pantalla de cara cliente que dependa del ledger
para algo que no tolere un hueco.

**Dónde toca.** `packages/db/src/schema/index.ts` — `ledgerEntries`;
`getLedgerForOccurrence` en `packages/db/src/repositories/index.ts`;
`packages/db/src/ledger-pairing.ts`; `apps/web/src/lib/autopsia.ts`.

## Migración B

**Qué es.** Corregir `ledger_entries.actor_user_id` — pasar la columna de `uuid` a
`text` y separar el actor en dos columnas, según `docs/marco-limpio/Ficha-Pieza1-Historia-De-Hechos.md`.

**Por qué se aplazó.** La Migración A (crear `compliance_fact_history`) era la que
desbloqueaba la Pieza 1 y ya entró. La B corrige el tipo del identificador de actor,
y hoy ese identificador viaja vacío: hasta que exista auth-rbac el sistema sabe que
fue una persona pero no cuál, y la firma honesta es el rol.

**Qué lo desbloquea.** Auth-rbac. Cuando haya identidad real que guardar, el tipo de
la columna empieza a importar.

**Dónde toca.** `ledger_entries`. Sin `ALTER TABLE` en `compliance_facts`, sin quitar
constraints.

## Datos sintéticos en producción

**Qué es.** Poder sembrar datos de demostración en el ambiente productivo sin
contaminar hechos reales.

**Por qué se aplazó.** Pendiente de definición. Hoy el seed tiene candado explícito
que exige una `SEED_DATABASE_URL` distinta de la de producción, y ese candado es
deliberado — cualquier trabajo aquí tiene que respetarlo o reemplazarlo por algo más
fuerte, nunca debilitarlo.

**Lo que ya está adentro.** **21 IMEIs con huella de siembra** viven en producción.
Hay que **cuantificar cuánto pesan antes de confiar en el Tablero**: una métrica
global que los incluya no es una métrica, es una mezcla.

**Qué lo desbloquea.** Una separación clara entre cuenta de demostración y cuenta
real que el motor entienda, no solo la UI. La bandera `is_demo` ya existe y ya filtra
en J-Staff y en `/api/salud`; falta que el motor y las métricas la respeten.

## Contratos demo sin corredor propio

**Qué es.** PRUEBA REAL y Honeywell MX07 juzgan con el default clavado en código,
porque su política no trae corredor propio.

**Por qué se aplazó.** Están archivados como demo y ya no ensucian la vista. Pero
**siguen siendo juzgados**, y el Marco es explícito: el valor que gobierna es siempre
el de la política del contrato, nunca el del código.

**Qué lo desbloquea.** Decidir si un contrato demo debe juzgarse del todo. Si la
respuesta es sí, necesita política completa como cualquier otro.

## 64 hechos pre-12-jul sin umbral en el snapshot

**Qué es.** 64 hechos sellados antes del 12 de julio de 2026 no guardan umbrales en
`contract_policy_snapshot`.

**Por qué se aplazó.** Son anteriores a que el snapshot guardara la política completa.
No se pueden reconstruir sin inventar, y **inventar el umbral que los juzgó sería
falsificar el expediente**.

**Qué lo desbloquea.** Nada los arregla. Lo que hace falta es que **cualquier pantalla
que los muestre diga que no tienen umbral registrado**, en vez de mostrar el default de
hoy como si hubiera sido el de entonces.

**Dónde toca.** `compliance_facts.contract_policy_snapshot`.

## 3 de 4 contratos activos sin `timeZone`

**Qué es.** Medido el 2026-07-28 sobre el carrier real: de sus 4 contratos activos,
**solo 1 trae `timeZone` en su política** (`America/Ciudad_Juarez`). Los otros 3 caen
al default del despliegue.

**Por qué se aplazó.** Hoy no muerde: todos operan en la misma zona, así que el default
acierta por accidente. Muerde el día que exista un contrato en otra zona — y entonces
muerde en silencio, porque un hecho sellado con el reloj equivocado se ve idéntico a
uno correcto.

**Qué lo desbloquea.** El primer contrato fuera de Ciudad Juárez. Antes de ese día hay
que decidir si `timeZone` se vuelve obligatorio en la política o si el default se
declara explícitamente en cada contrato al crearlo.

**Mientras tanto, la regla.** Toda pantalla que muestre una hora **escribe de qué reloj
es**. La [vista de flota](#vista-de-flota-del-carrier) la aplica: usa el reloj del
despliegue —porque es del carrier, no de un contrato— y lo dice en pantalla. Una hora
desnuda es una hora que el lector interpreta con su propio reloj.

**Dónde toca.** `service_contracts.policy`; `apps/web/src/lib/date-range.ts` y
`local-time.ts`, que ya advierten en comentarios cuáles call sites deben pasar
`contract.policy.timeZone`.

## Retención de Neon

**Qué es.** Política de cuánto tiempo se conserva la telemetría cruda y qué se hace
cuando vence.

**Por qué se aplazó.** Pendiente de definición. El costo crece con `telemetry_points`
y `evidence_points`, que son las tablas que más filas acumulan — **51 830 puntos por
día** solo del carrier real, medido el 27 de julio de 2026.

**Qué lo desbloquea.** Decidir el mínimo que la evidencia tiene que sostener. Un hecho
sellado no depende de los puntos crudos para seguir siendo válido, pero el expediente
sí los usa para dibujar el recorrido: borrar puntos vacía mapas de hechos que siguen
vigentes. Esa es la tensión que hay que resolver antes de fijar la política.

**Aparte, la historia de Neon.** La retención de historia del plan actual es de **1
día**, y eso es corto para producción: un problema que se nota el martes ya no se
puede mirar como estaba el lunes.

## El vigilante se apaga tras 60 días de repo inactivo

**Qué es.** GitHub deshabilita los workflows programados cuando un repositorio pasa 60
días sin actividad. Avisa por correo antes de hacerlo.

**Por qué se anota.** Porque es **exactamente la clase de fallo del que huimos**: el
vigilante se apaga en silencio y su silencio se lee como salud. La
[Ley 4](#leyes-de-producto) resolvió que el vigilante no comparta componentes con lo
vigilado, pero no que sea inmortal.

**Qué lo desbloquea.** Un segundo vigilante que vigile al vigilante, o un canal que
confirme *"sigo vivo"* en vez de solo gritar cuando algo falla. La Fase 0 no lo cubre
a propósito.

**Dónde toca.** `.github/workflows/salud.yml`.

## `apps/web` no tiene corredor de pruebas

**Qué es.** `apps/web/package.json` no declara script `test` ni depende de vitest, pero
el repositorio contiene dos archivos de prueba dentro de la app:
`src/lib/autopsia.test.ts` y `src/lib/date-range.test.ts`. **Nunca corren**, y son los
**únicos dos errores de `tsc --noEmit`** que quedan en el repo — no encuentran el módulo
`vitest`.

**Por qué es peor que un descuido.** Un archivo de prueba que existe y no corre es peor
que no tener pruebas: da la impresión de que algo está cubierto cuando no lo está. Y los
errores permanentes de `tsc` entrenan a ignorar la salida del compilador, que es
justamente donde aparecerían los errores reales.

**Por qué se aplazó.** Configurar vitest en una app de Next con React 19 y Tailwind 4 no
es una línea, y arrastra decisiones —entorno jsdom o node, cómo se resuelven los alias
`@/`— que merecen su propio rato.

**Mientras tanto, la regla que se está siguiendo.** Toda lógica que valga la pena probar
vive en un paquete, no en la app. La ventana y la zona horaria del
[recorrido de la flota](#vista-de-flota-del-carrier) se pusieron en `@jtel/services` por
esto, no por gusto: ahí sí se prueban.

**Qué lo desbloquea.** Que haga falta lógica en la app que no se pueda sacar a un
paquete. Ese día se configura vitest o se borran los dos archivos huérfanos — lo que no
puede seguir es el estado actual, que finge cobertura.

**Dónde toca.** `apps/web/package.json`; `apps/web/src/lib/autopsia.test.ts`;
`apps/web/src/lib/date-range.test.ts`.

## Migrar `autopsia.ts` al emparejamiento nuevo

**Qué es.** Que `apps/web/src/lib/autopsia.ts` deje de tomar la primera entrada del
ledger y use `pairLedgerEntryWithFact`, que ya empareja con tolerancia y sabe decir
cuándo no puede.

**Por qué se aplazó.** Es herramienta interna de análisis, no cara cliente. El error
que comete —leer la corrida equivocada tras una re-verificación— lo ve alguien que
sabe interpretarlo.

**Qué lo desbloquea.** El PR #87, hoy en pausa, que trae el emparejamiento.

**Dónde toca.** `apps/web/src/lib/autopsia.ts`; `packages/db/src/ledger-pairing.ts`.

## Los 15 pendientes del 28-jul se quedan pendientes

**Qué es.** Una decisión tomada, anotada aquí para que no se vuelva a abrir.

**Qué se decidió.** Los **15 hechos en `pendiente_evidencia` del 28 de julio se quedan
así**. Una simulación mostró que re-juzgarlos los convertiría a los 15 en
`no_cumplido` (A entre 3.4% y 49.2%) — o sea, convertiría un honesto *"no sabemos"* en
una acusación irreversible contra el carrier, y por la [Ley 1](#leyes-de-producto) eso
está prohibido: la observación de ese día fue insuficiente, no el servicio.

Los **14 rojos del 28 también se quedan quietos.** Re-juzgarlos no cambia el resultado
y sí mete una versión extra en la historia del sello, ensuciando el expediente sin
ganar nada.

**Qué lo desbloquea.** Nada. Es un estado honesto y así se queda.
