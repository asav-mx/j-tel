# J-Telemetry — Plan de v1

**Corte: 30 de julio de 2026 (tercera versión, fin del día).** Reemplaza las dos
anteriores del mismo día.

Cambió por tres cosas: **el defecto del árbitro quedó arreglado de raíz y en
producción**, entraron cuatro piezas nuevas, y apareció un frente que no
existía — la política como acuerdo entre las partes.

`DESPUES.md` es el backlog (qué hay que hacer, con su razón).
**Este documento es el orden** (en qué secuencia, y qué desbloquea qué).
El `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre los dos.

**`Plan-Camino-a-v1.md` es el camino** (qué se hace primero, y por qué ese y no
otro). Este documento dice en qué ola vive cada cosa; aquel dice por dónde se
empieza mañana. Cuando los dos hablen de lo mismo, gana el camino: está fechado
más tarde y verificado contra el repo.

---

## 0. Cómo se usa este plan

| Quién | Qué hace |
|---|---|
| **Asav** | Decide producto, hace las llamadas que solo él puede hacer, mergea los PR. **No necesita recordar el plan** — lo lee aquí. |
| **El chat de arquitectura** | Sostiene el mapa. Valida contra el Marco. Redacta los recados. |
| **Carril A** | Motor, paquetes (`packages/*`) y base de datos. Tramo rojo. |
| **Carril B** | Web (`apps/web`). Tramo verde salvo aviso. |

**La frontera entre carriles es de carpetas, no de temas:** A vive en
`packages/` y en la base; B vive en `apps/web`. Es lo único que impide que se
pisen trabajando a la vez. Cuando una tarea cruza la frontera, se parte en dos
PR coordinados — nunca uno solo cruzando.

**Regla de tramos:**
- **Verde (corre largo):** no toca datos reales, no escribe en producción, no
  cambia cómo juzga el motor.
- **Rojo (corta corto, con verificación entre tramos):** escribe en la base
  real, toca un veredicto sellado, o cambia la lógica del árbitro.

**Regla de scripts:** lo que produce un número que decide algo grave **es
evidencia** — se guarda en el repo, versionado y reproducible.

**Regla de medición:** cada hallazgo tiene derecho a **una** medición y a un
arreglo. Medir tres veces sin construir es no avanzar.

**La prueba de producto vs. caso de uso:** *"¿esto tendría sentido para una
planta en Bogotá cuyas rutas nunca hemos visto?"* Si sí — producto. Si solo
tiene sentido por una ruta específica — caso de uso, y va mal.
**Planta 47 es el laboratorio, no el paciente.**

---

## 1. La meta que define el fin de v1

> **≥90% de servicios correctamente resueltos** contra verdad de campo,
> **sostenido dos semanas**, con **cero acusaciones sin evidencia**.

**Segunda condición, no negociable:** ninguna cara de cliente accesible sin
autenticación.

---

## 2. El defecto del árbitro — CERRADO el 30 de julio

Queda escrito porque explica por qué los números de Planta 47 se ven como se ven,
y por qué van a cambiar.

### Qué pasaba

El motor abría una ventana de observación fija (105–115 min) para mirar el GPS,
pero muchas rutas **tardan más que eso**. No observaba el arranque de la ruta y
luego calificaba contra el trazado **completo**, incluyendo el tramo que nunca
miró.

| Dato | Valor |
|---|---:|
| Rutas medidas (Tecma 47 + Campus Santos Dumont) | 48 |
| Rutas matemáticamente condenadas | **16** |
| Acusaciones imposibles de aprobar por construcción | **194 de 439 (44%)** |
| Duración real de las rutas | 42–370 min |

**No eran los mapas ni el carrier.** En Huertas-B el 96% de los puntos GPS caen
a menos de 150 m del trazado (mediana 60 m): la unidad hacía la ruta bien.

Violaba la Ley 1: un problema de observación se convertía en acusación. Y lo
agravaba un segundo defecto — el motor reportaba "cobertura 100%" porque medía
qué tan bien vio *su ventana*, no si su ventana cubría *la ruta*.

### Cómo quedó arreglado (los cuatro, en producción)

1. **PR #108** — si la ventana no cubrió el origen de la ruta →
   `pendiente_evidencia`, nunca `no_cumplido`.
2. **PR #113** — el match se califica sobre el **tramo observable**, no contra el
   KML completo. El umbral de cumplimiento no se tocó.
3. **PR #115** — la ventana **se dimensiona con la ruta**: largo del trazado +
   p90 de la historia real. Sin el argumento nuevo, el comportamiento es idéntico
   al de antes (con prueba).
4. **PR #115** — al sellar cada hecho **se mide y se guarda cuánto duró el
   recorrido** (tabla `route_traversal_measurements`). El sistema aprende cuánto
   dura cada ruta en vez de que alguien lo adivine.

**Bug encontrado de regalo:** el día del cambio de horario la ventana quedaba en
**ancho cero** — el motor ciego el día entero. Y en otro caso el ancho dependía
de **en qué máquina corriera el proceso**, misma familia del bug que corrió 294
hechos. Los dos blindados con prueba.

**Consecuencia visible:** de aquí en adelante, rutas largas que salían
`no_cumplido` van a salir `cumplido` o `pendiente_evidencia`. **Es lo correcto y
es el punto del arreglo** — pero es un cambio notorio en los números.

---

## 3. Los dos candados

**Candado 1 — la identificación confiable manda sobre las pantallas de juicio.**
Una sola señal frágil (el match contra el KML) hace dos trabajos: identificar
quién hizo la ruta y juzgar si cumplió. Cuando falla, se pierden las dos.

**Candado 2 — `auth-rbac` cierra antes del primer login real.**
Una planta jamás ve otra planta. No bloquea construir; bloquea enseñar. **Y
ahora bloquea algo más:** el acuerdo de dos partes sobre la política (§6) no
puede existir sin que el carrier tenga llave.

---

## 4. Las olas

### Ola 0 — cerrada

Cierre del turno · Pendiente por evidencia · PLAN-v1 · lista congelada de las
300 · Turno B de Planta 47 corregido · **el arreglo del árbitro completo (§2)**.

---

### Ola 1 — construir sobre hechos sellados

**Entregado el 30 de julio:**

| Pieza | PR |
|---|---|
| Pendiente por evidencia (cara planta) | #104 |
| Arreglo del árbitro, cuatro piezas | #108 · #113 · #115 |
| Landing público en `/landing` | #112 |
| Historial de flota del carrier | #114 |
| Oficina del contrato (configuración) | #116 |
| Índice `(carrier, unit, recorded_at)` | #117 |

**En vuelo:** tablero de diagnóstico (Carril B).

**Falta:**

- **1.a — La política como acuerdo vivo** (frente nuevo, ver §6). Historia de la
  política y referencia de cláusula entran aquí; la aprobación de dos partes
  queda anclada a `auth-rbac`.
- **1.b — Plomería de operación.** Bitácora `cron_runs` · **entrega real de
  alertas** (que lleguen, no que se pinten) · semáforo de J-Staff.
  **Bloqueado sin resolver destinatarios:** hoy no hay forma de resolver "todos
  los usuarios con rol X en el contrato Y" — el email vive en Clerk (no en la
  base), `userMemberships` no está ligado a `service_contracts`, y `canal.ts`
  solo manda a una lista fija por variable de entorno. El contenido de los
  correos ya está definido (`Ficha-Correos-y-Alertas.md`, #143); falta a quién
  mandárselos. No urgente esta semana, pero sin esto 1.b no cierra.
- **1.c — `historia-del-sello`** (componente; falta la columna de causa).
- **1.d — Arranca `auth-rbac`.**
- **1.e — Higiene:** credenciales de un solo lugar · base de práctica desechable.
- **1.f — Tareas de base** (ver §7).

---

### Ola 2 — el árbitro confiable (la obra grande)

**Aquí vive el 90%.**

**2.a — Identificación por capas.** Señales independientes que **acumulan
confianza**; ninguna condena sola:

1. **Llegada a geocerca** — la más robusta, ya existe
2. **Corredor** — banda configurable, tolerante al temblor del GPS
3. **Match fino** — solo con densidad y observación suficientes
4. **Huella histórica** contra viajes ya aceptados
5. **Patrón de paradas** — dónde se detiene el camión **de forma repetida** a lo
   largo de muchos días. Los semáforos son azarosos; las paradas de recolección
   son constantes. **No requiere identificar pasajeros.**
6. **Rol declarado del coordinador** — opcional siempre

**2.b — El juicio cambia de pregunta.** De *"¿siguió el dibujo?"* a **"¿recogió
donde debía y llegó cuando debía?"**, con el trazado como calificador
configurable.

**2.c — Compuerta de densidad.** Umbral derivado de la geometría, no adivinado.

**2.d — Juzgar sin KML fino.** Geocerca + corredor + paradas, con el trazado
opcional. **Sí es v1**: sin ello el producto no sirve para su mercado (§8).

**2.e — El árbitro tiene que distinguir una cuenta de prueba de una real.
PRIORIDAD ALTA.**

Hoy no lo hace, y está medido: **73 hechos sellados sobre cuentas marcadas como
demo**, indistinguibles en forma de los 829 vinculantes. `accounts.isDemo` está
bien puesta y el motor no la lee en ningún punto — se consulta en dos lugares,
los dos para listar cuentas en la interfaz. `serviceContracts.status` tiene
`demo` en su enum justo para esto, y el seed escribió `active` en los contratos
que creó.

**Por qué va aquí y no en una lista de pendientes sueltos:** un veredicto es
vinculante porque alguien declaró la operación sobre la que se juzga. Un motor
que sella sobre datos que nadie declaró produce la forma completa de un
veredicto —sello, política congelada, razón escrita, expediente— hueca por
dentro, y el auditado no puede distinguirla. **Un rojo así pasa la compuerta de
salida sin hacer ruido:** tiene expediente, tiene evidencia y tiene razón
escrita. Es exactamente la clase de falla que el ≥90% existe para atrapar, y la
única que el propio número no ve.

Lo que hay que decidir está en la ficha:
`docs/marco-limpio/Ficha-Diagnostico-Datos-No-Declarados.md` — si el motor se
niega a sellar sobre cuentas demo o sella marcando el hecho, dónde vive esa
marca (tiene que viajar **dentro** del hecho, como la política congelada), qué
se hace con los 73 ya sellados, y quién puede poner una cuenta en `active`.

**2.f — La geocerca tiene que viajar congelada dentro del hecho.**

**Corrección:** la primera versión de este punto decía que 333 servicios se
habían acusado contra una geocerca equivocada. **Era falso y se retiró** — el
árbitro juzgó contra el destino correcto; lo que estaba mal era la lectura de
un campo. El registro del error queda en la ficha.

Lo que sí quedó, y es de otra clase: **el árbitro juzga contra la geocerca viva
del perfil, que es configuración editable, y el campo que sí se congela dentro
del hecho —`expected_geofence_id`— no es el que se usa.** Las dos mitades de la
ley del hecho congelado están cruzadas: lo que se congela no se usa, y lo que se
usa no se congela. Medido: **546 ocurrencias** donde los dos valores difieren.

Por qué importa: `contract_policy_snapshot` viaja dentro del hecho justo para
que el auditado reconstruya con qué regla se le juzgó. **La geocerca no**, y es
la frontera de la evidencia (Ley 4), no un parámetro menor. Hoy una edición de
configuración cambia en silencio cómo se re-verifica un servicio de hace tres
semanas — lo mismo que la ficha del expediente ya prohibió para el radio.

Lo que hay que decidir está en la ficha:
`docs/marco-limpio/Ficha-Diagnostico-Geocerca-No-Congelada.md` — si el polígono
se congela dentro del hecho, qué pasa con el campo huérfano que hoy engaña, y
cómo se re-verifica un hecho viejo sin aplicarle la configuración de hoy.

**2.g — La identificación unidad↔ruta no existe en vivo.**

Salió de construir Monitoreo, y es la cuarta hermana de esta misma familia. La
sala de control del transportista **no puede decir qué unidad cubre qué ruta
mientras el turno corre**: la identificación se resuelve al cierre, cuando el
árbitro evalúa candidatas contra el trazado. Antes de eso no hay respuesta.

Lo que eso cuesta hoy se ve en la pantalla: una unidad callada y un servicio por
cerrar no se pueden ligar, y la sala tiene que decirlo — *"J-Telemetry todavía
no puede decir en vivo cuál cubre cuál, así que la relación la pones tú"*. Es la
línea honesta, y también la confesión de que el producto todavía no reemplaza
al monitorista en el momento en que más falta hace: **cuando algo se puede
evitar.**

Va aquí y no en una lista aparte porque es el mismo problema que el 2.e y el
2.f visto desde otro lado: el árbitro sabe identificar, pero solo mirando hacia
atrás. Cuando se le entre a esta familia, las cuatro se piensan juntas.

**Lo que NO se hace ahora:** perseguirlo desde la pantalla. Inferir en vivo con
menos evidencia produciría una atribución probable presentada como declarada —
que es exactamente lo que el skill prohíbe (*"lo inferido no se presenta como
declarado"*) y lo que la torre del cliente ya resuelve marcando `probable`.

**Compuerta de salida:** **≥90% sostenido dos semanas**, cero rojos sin
expediente, ningún hecho sellado sobre una cuenta que nadie declaró, **y ningún
hecho cuya frontera de evidencia viva fuera de él.**

---

### Ola 3 — ver y explicar (cara cliente)

`expediente-carrier` / `expediente-dos-recortes` · `cumplimiento` +
`preventivo-jtel` · `mapa-instrumento` · `vista-de-ruta` · Pieza 2 + Tablero de
calibración · módulo de choferes.

---

### Ola 4 — vendible

`auth-rbac` cerrado · **Lenore v1** · J-Staff altas y demos · pase de UI final.

**Compuerta de salida:** un cliente nuevo se da de alta, entra con su usuario, ve
solo lo suyo, y el ≥90% se sostiene. **Eso es v1 en producción.**

---

## 5. Las 300 — congeladas, pero ya se pueden descongelar

Se congelaron porque el número no era reproducible **y** porque la ventana estaba
rota al medir. **La segunda razón ya no existe: el árbitro está arreglado.**

**Lo que falta antes de re-verificar:** correr la simulación otra vez con el motor
honesto (ventana derivada + match sobre lo observable) y comparar contra el
91/209/0 que se midió con la ventana rota. **Ese número va a subir**, y esta vez
por verdad, no por maquillaje.

La ficha `docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md` sigue vigente
en su procedimiento y sus guardas; solo cambia **cuándo**.

**Dato que espera explicación:** la pantalla de configuración encontró que **319
de 336 servicios de Planta 47 se resolvieron sin ver una sola llegada**, y declara
honestamente que no puede distinguir entre hora mal declarada, ventana angosta o
unidades que no reportan. Con el árbitro arreglado, ese número debería moverse
mucho — es la primera prueba de que el arreglo sirvió.

**Antes de buscarle una cuarta causa, hay que saber qué datos se están
midiendo.** Se propuso aquí una — "la geocerca ciega" — y se retiró: su
evidencia resultó ser una cuenta sembrada por `db:seed` contra producción, no
una operación declarada. La geocerca de ese caso es una constante escrita a mano
en el script, no algo que alguien dibujó.

Lo que sí salió de ahí, y pesa más para esta ola: **el árbitro no distingue una
cuenta de demostración de una real.** `accounts.isDemo` está puesta y ningún
punto del motor la lee; `serviceContracts.status` tiene `demo` en su enum y el
seed escribe `active`. Hay **73 hechos sellados sobre cuentas demo**,
indistinguibles de los vinculantes. Un `no_cumplido` así pasa la compuerta de
salida sin ruido: tiene expediente, evidencia y razón escrita.
Ver `docs/marco-limpio/Ficha-Diagnostico-Datos-No-Declarados.md`.

---

## 6. La política como acuerdo vivo — FRENTE NUEVO

Apareció el 30 de julio al construir la oficina del contrato. Son tres piezas que
van juntas.

### El problema

Hoy la política de un contrato **se sobrescribe al editarse**. La versión
anterior se pierde: no hay registro de qué decía antes, ni de quién la cambió, ni
de cuándo.

Compárese con los hechos: cada veredicto guarda su historia completa, con firma y
motivo, y nunca se borra nada. **La política —que es la ley con la que se
juzga— no tiene nada de eso.**

Y el landing promete que *"cada regla puede citar su cláusula"*. **No existe
ningún campo de cláusula en el esquema.** Es una promesa de venta sin respaldo, y
el Marco la pide: la referencia contractual vive dentro del objeto de política y
se congela con cada hecho.

### Las tres piezas

**1. Historia de la política — Ola 1.**
Cada edición queda: qué cambió, quién, cuándo, qué decía antes. Nada se pierde.
Es barato y es de lo que **se vuelve imposible de reconstruir hacia atrás** —
cada día sin ella pierde ediciones para siempre.

**2. Referencia de cláusula por regla — Ola 1.**
Que cada tolerancia pueda citar el papel que la respalda. Cierra la promesa del
landing y le da al veredicto con qué defenderse ante un cliente que reclama.

**3. Acuerdo de las partes — anclado a `auth-rbac`.**
Un cambio de política no es una edición: **es una propuesta**. Misma forma que la
promoción de variantes de trazado — la operación propone, el humano dispone.

**Configurable por contrato desde J-Staff**, y esto es decisión de producto de
Asav: hay contratos donde la planta se reserva el derecho de modificar a su
criterio. Lo que **nunca** es opcional es que exista **método de comunicación**:
el carrier se entera del cambio, siempre, aunque no tenga que aprobarlo.

**Cuidado que no se toca:** el acuerdo **jamás reescribe el pasado**. La
propuesta entra en vigor **desde una fecha**; todo lo sellado antes conserva la
política con la que se juzgó. Eso ya funciona (cada hecho congela su foto); lo
que falta es el circuito de aprobación arriba.

**Por qué importa más de lo que parece:** una tolerancia que la planta cambia
sola, sin que el carrier lo sepa, **cambia las reglas del juego a media
partida**. Eso rompe al árbitro ante el auditado, que es lo único que lo hace
creíble.

---

## 7. Tareas de base pendientes (Carril A)

**1. El migrador huérfano — riesgo activo.**
El repo tiene un migrador de Drizzle que **nunca se ha usado en producción**: no
existe su tabla de bitácora. Si alguien corre `pnpm db:migrate` contra
producción, el migrador ve una base virgen e intenta aplicar las catorce
migraciones desde la 0000 contra una base con 37 tablas y 846 hechos. **Revienta
—y deja su bitácora a medio escribir.**

Desde la 0003 las migraciones se vienen aplicando **a mano**, con SQL directo.
Ese es el procedimiento real y no está documentado. **Cualquiera que siga el
README le apunta a producción un comando que falla.**

Salida recomendada: **adoptar el SQL a mano como procedimiento oficial y
documentarlo** (más seguro que intentar darle bitácora inicial al migrador sobre
una base viva).

**2. El historial de flota es lento por la app, no por la base.**
Medido: la base contesta en **14 ms**; los **3.5 s** se van transportando 58 000
puntos por la red y materializándolos en JavaScript. El índice #117 no lo arregla
porque **ninguna consulta filtra por unidad en SQL** — la app pide la ventana
completa del carrier y filtra en memoria.

El arreglo real: **una agregación en SQL que devuelva el día ya resumido**, en vez
de 58 000 puntos crudos. **Cruza la frontera de carriles** (consulta en
`@jtel/db`, llamada desde `apps/web`), así que van dos PR coordinados.

El índice #117 **sí sirve y se queda**: la consulta que existe para servir pasó de
8.3 ms a 0.4 ms, y `getLastPointPerUnit` se hizo el doble de rápida sola. Era el
requisito previo.

**3. `MAX_DIAS = 3` se fijó con números no reproducibles.** Re-medir después del
arreglo de la agregación, no antes.

**4. `maxRouteDurationMinutes`, fijo en 60.** Un segundo "cuánto dura una ruta"
sin derivar, que gobierna la ventana de exclusividad y la de cobertura. Hoy no
causa falsos negativos. Tarea propia — no mezclar con otro cambio de motor.

---

## 8. El mercado — por qué "sin KML fino" es requisito

**La mayoría de las plantas no tienen sus rutas bien definidas.** Viven en la
cabeza de los carriers y se transmiten de boca en boca cuando una planta cambia
de proveedor. La informalidad de los datos es **el estado normal del mercado**.

Consecuencia: **un árbitro que exige trazados perfectos está peleado con su
propio mercado.** El que juzga honestamente con lo que hay —y de paso formaliza
lo informal— atiende el dolor de frente. Esa es la cuña de venta.

---

## 9. Las decisiones que solo Asav puede tomar

| # | Decisión | Cuándo | Estado |
|---|---|---|---|
| 1 | Turno B de Planta 47 | Ola 0 | ✅ resuelta |
| 2 | Regla de cierre del pendiente por evidencia (planta + legal) | Ola 1 | Pendiente — hoy en modo demo |
| 3 | Re-verificación de las 300 | Ahora se puede (§5) | Pendiente de simulación nueva |
| 4 | ¿`jornada-instrumento` quedó superseded por Cierre del turno? | Ola 3 | Por confirmar |
| 5 | Cómo se le cuenta a Tecma que su número cambia | Antes de re-verificar | Pendiente |
| 6 | Qué contratos permiten que la planta modifique sin acuerdo (§6) | Con `auth-rbac` | Pendiente |

---

## 10. Fuera de v1 — por decisión

| Qué | Por qué | A dónde |
|---|---|---|
| **Quejas** | Circuito completo | Después de v1 |
| **Descubrimiento y promoción de caminos con su UI** | La mitad motor sí entra a v1 (§4, 2.d) | **v1.1 — candidato a subir** |
| **Ficha 4 — incidentes** | Circuito carrier ↔ planta | Después de v1 |
| **Enforcement** | Primero el árbitro confiable | Después del ≥90% |
| **Map matching** (red de calles) | Como **capa de aprendizaje y explicación**, no de juicio: entender la operación en calles y hacer a Lenore más humana. No arregla "no vimos media ruta" | v1.1 |
| **Expediente de pasajero / modo pasajero** | Requiere hardware. **Las paradas se infieren del GPS sin identificar personas** (§4, capa 5) | Futuro (jrz-pass) |

---

## 11. Reglas de trabajo

- **Una rama por tarea. Todo por PR. El merge lo hace Asav.** Nunca directo a `main`.
- **Nunca mergear sin el check en verde**, y revisar "Files changed".
- **Antes de afirmar, verificar.** Simular antes de escribir sobre datos vivos.
- **Las pruebas deben fallar contra código roto** antes de contar como cobertura.
- **El código nunca conoce nombres.** Todo genérico.
- **Cuando un carril cambia un esquema que el otro usa, se avisa antes.** El 30
  de julio salvó a la oficina del contrato de nacer con seis perillas de menos.
- **`jrz-drone-os` congelada** — fuente de datos históricos, jamás de código.

---

## 12. Las leyes de producto

1. **Un problema de observación jamás se convierte en veredicto.**
2. **Todo `no_cumplido` carga su evidencia y su porqué medido.**
3. **La matemática decide, la AI explica.**
4. **Tres estados y nada más.** "Tarde" es motivo, no estado.
5. **El hecho se calcula una vez y se congela.** Solo cambia por re-verificación
   explícita y auditada, con firma y motivo.
6. **La geocerca es la frontera de la evidencia.**
7. **El cliente jamás ve la operación interna del carrier.**
8. **Todo umbral es configurable por contrato.**
9. **El vigilante no comparte nada con lo vigilado.**
10. **Nunca rotar credenciales sin redesplegar en el mismo movimiento.**
11. **La política cambia hacia adelante y nunca reescribe el pasado.**

---

## 13. El loop de aprendizaje

Declarado → observado → divergencia sostenida → propuesta → **aprobación
humana** → la configuración aprende.

- **La planta APRUEBA lo normativo** — qué cuenta como cumplido.
- **El carrier SEÑALA lo factual** — cuándo medimos mal.
- **El árbitro no calibra nada. Aplica.**

**La trampa:** no se pueden calibrar umbrales contra la operación que se juzga.
Afinar hasta que todo pase convierte al árbitro en decorado.

**Corolario:** ampliar la ventana de observación **NO es calibrar**. Medir cuánto
dura una ruta es un hecho; el umbral de cumplimiento no se toca. La diferencia
entre corregir un instrumento y aflojar un estándar es la línea que separa un
árbitro de un adorno.

---

*Se actualiza cuando una ola cierra su compuerta o cuando una decisión de §9 se
resuelve. No se edita para acomodar prisa.*
