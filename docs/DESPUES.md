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

## Índice

| Entrada | Horizonte |
|---|---|
| [Planta 47 casi no produce cumplidos](#planta-47-casi-no-produce-cumplidos) | **PRIORIDAD 1 — justo después de Cierre del turno** |
| [Historia del sello en Cierre del turno](#historia-del-sello-en-cierre-del-turno) | v1.1 |
| [Medición honesta de kilómetros con brincos de GPS](#medición-honesta-de-kilómetros-con-brincos-de-gps) | v1.1 |
| [El ledger debe colgar del hecho](#el-ledger-debe-colgar-del-hecho) | Cuando una cara cliente dependa del ledger |
| [Compuerta per-candidata](#compuerta-per-candidata) | Por definir |
| [Migración B](#migración-b) | Cuando exista auth-rbac |
| [Datos sintéticos en producción](#datos-sintéticos-en-producción) | Por definir |
| [Lenore — el copiloto](#lenore--el-copiloto) | Línea de producto propia |
| [Retención de Neon](#retención-de-neon) | Por definir |

---

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
aunque el servicio se haya prestado. Si es cierto, el caso es exactamente el de
`docs/Ficha-Handoff-Variantes-Trazado.md`: derivar variantes de trazado a partir de
trazas reales en vez de exigir que el KML cargado sea el único camino válido.

Sostiene la hipótesis, sin probarla: el corredor de ese contrato cambió a media
corrida (hay hechos sellados con `120 m / 50 %` y otros con `120 m / 60 %`), lo que
sugiere que alguien ya estaba moviendo perillas buscando que cuadrara.

**Por qué se aplazó.** Es terreno del motor —la lógica del árbitro y la métrica de
ruta—, así que entra bajo parada obligatoria. Y no se puede resolver desde el código:
necesita a la Planta para confirmar qué camino recorren realmente las unidades. Sin
ese dato, cualquier ajuste de umbral es adivinar.

**Qué lo desbloquea.** Cierre del turno primero. Después, sesión con la Planta para
contrastar trazas reales contra los KML cargados.

**Dónde toca.** `route_kml_versions.waypoints`; la métrica de corredor en
`packages/verification/src`; `docs/Ficha-Handoff-Variantes-Trazado.md`.

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

## El ledger debe colgar del hecho

**Qué es.** Que `ledger_entries` tenga una referencia directa al hecho que produjo,
para poder leer las mediciones de una corrida sin adivinar cuál fue.

**Por qué se aplazó.** Hoy `ledger_entries` tiene `serviceOccurrenceId`, `tripId` y
`createdAt`, pero **no** `factId`. Tras una re-verificación hay varias entradas
`verificacion_automatica` para la misma ocurrencia, y la única forma de emparejar es
por fecha contra el `materializedAt` vigente. Es frágil, y ya muerde:
`apps/web/src/lib/autopsia.ts` toma la **primera** entrada que encuentra, sin
emparejar — para una herramienta interna de análisis pasa, para una cara cliente no.

En v1 el Cierre del turno empareja por fecha y, cuando no puede hacerlo con certeza,
**no muestra el número**: dice "medición no disponible". Un hueco honesto antes que
una cifra de la corrida equivocada.

**Qué lo desbloquea.** La primera pantalla de cara cliente que dependa del ledger
para algo que no tolere un hueco.

**Dónde toca.** `packages/db/src/schema/index.ts` — `ledgerEntries`;
`getLedgerForTrip` en `packages/db/src/repositories/index.ts`;
`apps/web/src/lib/autopsia.ts`.

## Compuerta per-candidata

**Qué es.** Una compuerta que se evalúe por unidad candidata y no una sola vez para
todo el servicio.

**Por qué se aplazó.** Pendiente de definición. Anotada aquí para no perderla.

**Qué lo desbloquea.** Definir el alcance: qué decide la compuerta, con qué entradas
y quién la ve. No se construye hasta que exista esa definición escrita.

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

**Qué lo desbloquea.** Una separación clara entre cuenta de demostración y cuenta
real que el motor entienda, no solo la UI.

## Lenore — el copiloto

**Qué es.** Línea de producto propia. J-Tel es el juez: espera a que el viaje termine
y dicta resultado. Lenore es el copiloto: ve el viaje mientras ocurre y avisa antes de
que truene. De cara al cliente en ambas cuentas, no herramienta interna. Definida en
`docs/Mapa-Producto-J-Telemetry.md`, sección 7.

**Por qué se aplazó.** Es un producto aparte, no una pantalla de J-Telemetry. Mezclarla
con el árbitro confunde las dos promesas: una afirma sobre el pasado y está sellada, la
otra anticipa el futuro y no puede estarlo.

**Qué lo desbloquea.** Nombre comercial final y sesión de diseño propia. Dos superficies
distintas, no una con permisos apagados.

## Retención de Neon

**Qué es.** Política de cuánto tiempo se conserva la telemetría cruda y qué se hace
cuando vence.

**Por qué se aplazó.** Pendiente de definición. El costo crece con `telemetry_points`
y `evidence_points`, que son las tablas que más filas acumulan.

**Qué lo desbloquea.** Decidir el mínimo que la evidencia tiene que sostener. Un hecho
sellado no depende de los puntos crudos para seguir siendo válido, pero el expediente
sí los usa para dibujar el recorrido: borrar puntos vacía mapas de hechos que siguen
vigentes. Esa es la tensión que hay que resolver antes de fijar la política.
