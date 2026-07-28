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

---

## Índice

### 1 · v1 — en construcción ahora

| Entrada | Estado |
|---|---|
| [Meta del demo](#meta-del-demo) | La cifra que hay que sostener |
| [Vista de flota del carrier](#vista-de-flota-del-carrier) | **PRIORIDAD 1 — en curso** |
| [Compuerta de densidad de observación](#compuerta-de-densidad-de-observación) | Diseño aprobado, sin construir |
| [Identificación que se explica](#identificación-que-se-explica) | El corazón de v1 |
| [Expediente del no cumplido](#expediente-del-no-cumplido) | Consecuencia de la Ley 2 |
| [Lenore v1 — vigía y narradora](#lenore-v1--vigía-y-narradora) | Entra en el demo |
| [El vigilante vive dentro de lo vigilado](#el-vigilante-vive-dentro-de-lo-vigilado) | Fase 0 — parcialmente construido |
| [Planta 47 casi no produce cumplidos](#planta-47-casi-no-produce-cumplidos) | Requiere sesión con la Planta |
| [Pendientes puntuales de v1](#pendientes-puntuales-de-v1) | En cola |

### 2 · v1.1 — inmediatamente después del demo

| Entrada | Horizonte |
|---|---|
| [Historia de cambios de configuración](#historia-de-cambios-de-configuración) | **Antes del segundo cliente** |
| [La versión del motor en el hecho](#la-versión-del-motor-en-el-hecho) | v1.1 |
| [Historia del sello en Cierre del turno](#historia-del-sello-en-cierre-del-turno) | v1.1 |
| [Medición honesta de kilómetros con brincos de GPS](#medición-honesta-de-kilómetros-con-brincos-de-gps) | v1.1 |
| [Compuerta per-candidata](#compuerta-per-candidata) | v1.1 |
| [Gesto explícito para borrar la hora de cierre](#gesto-explícito-para-borrar-la-hora-de-cierre) | Si más gente configura contratos |
| [Distinguir "sin hora de cierre" de "no configurado"](#distinguir-sin-hora-de-cierre-de-no-configurado) | v1.1 |

### 3 · v2 — línea Lenore completa

| Entrada | Horizonte |
|---|---|
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

**Hipótesis a verificar — NO está medida.** Que los KML cargados no correspondan a
las rutas que las unidades recorren de verdad, así que la métrica de corredor falla
aunque el servicio se haya prestado.

**Qué la sostiene, sin probarla.** Dos cosas. La primera, que el corredor de ese
contrato cambió a media corrida (hay hechos sellados con `120 m / 50%` y otros con
`120 m / 60%`), lo que sugiere que alguien ya estaba moviendo perillas buscando que
cuadrara. La segunda, nueva del forense del 28 de julio: en Riveras 9 los días rojos
fallan por **corredor** con densidad sana —B entre 22.6% y 38.2%, contra 96.4% el día
verde—, que es exactamente la firma de "la unidad fue por otro camino". Es la misma
forma del problema, en otro contrato. **No prueba nada sobre Planta 47**; sube la
apuesta.

**Por qué sigue aplazado.** No se puede resolver desde el código: necesita a la Planta
para confirmar qué camino recorren realmente las unidades. Sin ese dato, cualquier
ajuste de umbral es adivinar — y el forense del 28 ya demostró que mover umbrales no
salva nada cuando lo que falla es el corredor.

**Qué lo desbloquea.** La [vista de flota](#vista-de-flota-del-carrier) —que permite
ver los trazos reales sin depender del match— y después una sesión con la Planta para
contrastarlos contra los KML cargados. El
[diff estructural](#identificación-que-se-explica) convierte esa sesión en números en
vez de impresiones.

**Por qué no puede quedarse afuera de v1.** Con 285 hechos al 99.6% de no cumplido, la
[meta del demo](#meta-del-demo) es inalcanzable mientras este contrato siga así.

**Dónde toca.** `route_kml_versions.waypoints`; la métrica de corredor en
`packages/verification/src`; `docs/Ficha-Handoff-Variantes-Trazado.md`.

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
