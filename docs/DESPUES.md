# DESPUÉS — lo que aplazamos a propósito

> **Este archivo es el backlog, y solo el backlog. Sin orden y sin fechas.**
>
> Desde el 3 de agosto de 2026 el orden vive **únicamente** en
> [`docs/PLAN.md`](PLAN.md): qué se construye, en qué secuencia y qué desbloquea
> qué. Aquí solo vive **qué falta y por qué se aplazó**.
>
> Los tres documentos vivos son el `Marco-Limpio-J-Telemetry-MAESTRO.md` (la
> ley), `PLAN.md` (el orden) y este (el backlog). Ninguno más.

Backlog de J-Telemetry. Aquí vive todo lo que se decidió **no** construir todavía,
con la razón por la que se aplazó y qué tiene que pasar para retomarlo.

No es una lista de deseos ni un tablero de tareas. Una entrada entra aquí solo
cuando alguien decidió aplazar algo concreto, y sale cuando se construye.

**El Marco Maestro manda sobre este archivo.** Si una entrada choca con
`docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md`, gana el Marco.

**Este archivo dice qué falta; `PLAN.md` dice por dónde se empieza.**
Una entrada de aquí no lleva prioridad escrita a propósito — el orden vive allá,
en tramos con su compuerta. Si buscas qué construir hoy, esa es la lectura;
esta es la que te dice por qué esa entrada existe y qué la desbloquea.

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

**Excepción, la sección 5.** Los trámites y las decisiones de producto **no son entradas
de construcción**: no se desbloquean escribiendo código, así que no llevan las cuatro
líneas. Van en tablas, cada renglón apuntando a la entrada que espera por él.

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

> **Leyenda:** 🔴 riesgo real · 🟡 importante · 🟢 deuda · 🤝 trámite de Asav · ⏸ bloqueado

### 1 · v1 — en construcción ahora

| Entrada | Estado |
|---|---|
| [Meta del demo](#meta-del-demo) | La cifra que hay que sostener |
| [El deadline depende de dónde corre el generador](#el-deadline-depende-de-dónde-corre-el-generador) | **PRIORIDAD 1 — bug en producción** |
| [Vista de flota del carrier](#vista-de-flota-del-carrier) | **PRIORIDAD 1 — en curso** |
| [Compuerta de densidad de observación](#compuerta-de-densidad-de-observación) | **Piso decidido en 60 s · se mide y se congela (paso 1); falta encenderla (paso 4)** |
| [Identificación que se explica](#identificación-que-se-explica) | El corazón de v1 |
| [Expediente del no cumplido](#expediente-del-no-cumplido) | Consecuencia de la Ley 2 |
| [Lenore v1 — vigía y narradora](#lenore-v1--vigía-y-narradora) | Entra en el demo |
| [El vigilante vive dentro de lo vigilado](#el-vigilante-vive-dentro-de-lo-vigilado) | Fase 0 — parcialmente construido |
| [Planta 47 casi no produce cumplidos](#planta-47-casi-no-produce-cumplidos) | **Diagnóstico cerrado — dos causas medidas** |
| [Turno B de Planta 47: declarado 18:00, operado ~14:00](#turno-b-de-planta-47-declarado-1800-operado-1400) | **Decisión de configuración con la Planta** |
| [El hecho debe bastarse a sí mismo](#el-hecho-debe-bastarse-a-sí-mismo) | **Bloquea a Lenore-narradora** |
| [Cierre del turno](#cierre-del-turno) | **Construida contra el molde aprobado** |
| [Ponderación de la cobertura por valor del tramo](#ponderación-de-la-cobertura-por-valor-del-tramo) | Hipótesis medible, sin caso todavía |
| [Afinar la ventana derivada con el match observable](#afinar-la-ventana-derivada-con-el-match-observable) | **Sube: la deriva se midió y es rápida — arriba de solicitudes y quejas** |
| [Las 300 congeladas — la foto de referencia](#las-300-congeladas--la-foto-de-referencia) | **PR #124 abierto a propósito** |
| [Las tres rutas con falla real](#las-tres-rutas-con-falla-real) | Pide ojo humano sobre el KML |
| [Dirección visual del producto](#dirección-visual-del-producto) | 🔴 **PENDIENTE DE ASAV — bloquea pantallas** |
| [El resto de la cara del producto](#el-resto-de-la-cara-del-producto) | Después de la dirección visual |
| [Pendientes puntuales de v1](#pendientes-puntuales-de-v1) | En cola |

### 2 · v1.1 — inmediatamente después del demo

| Entrada | Horizonte |
|---|---|
| [Historia de cambios de configuración](#historia-de-cambios-de-configuración) | **Antes del segundo cliente** — y ahora también el circuito concesionado |
| [El horario del circuito no tiene estado «sin declarar»](#el-horario-del-circuito-no-tiene-estado-sin-declarar) | 🟢 Se resuelve capturando el horario real — decisión de Asav |
| [Mover, reordenar y dar sentido a las paradas desde la pantalla](#mover-reordenar-y-dar-sentido-a-las-paradas-desde-la-pantalla) | 🟢 Después del 10 de septiembre |
| [La versión del motor en el hecho](#la-versión-del-motor-en-el-hecho) | v1.1 |
| [Historia del sello en Cierre del turno](#historia-del-sello-en-cierre-del-turno) | v1.1 |
| [Medición honesta de kilómetros con brincos de GPS](#medición-honesta-de-kilómetros-con-brincos-de-gps) | v1.1 |
| [Compuerta per-candidata](#compuerta-per-candidata) | v1.1 |
| [Qué pasa si la política cambia con la ventana abierta](#qué-pasa-si-la-política-cambia-con-la-ventana-abierta) | **Al Marco Maestro** |
| [`CRON_SECRET` cae a un secreto publicado](#cron_secret-cae-a-un-secreto-publicado) | ✅ **Cerrado** — código, documentos y rotación |
| [Las páginas no comprueban permisos](#las-páginas-no-comprueban-permisos) | 🔴 **Antes del primer usuario real** |
| [Cerrar el default de identidad heredada](#cerrar-el-default-de-identidad-heredada) | ⏸ Después de la guardia de páginas |
| [El expediente por id sigue abierto](#el-expediente-por-id-sigue-abierto) | 🟡 Con la guardia por alcance |
| [Defaults que fallan abiertos](#defaults-que-fallan-abiertos) | 🟡 La regla, y encadenarla a CI |
| [Lo que falta del candado de auth-rbac](#lo-que-falta-del-candado-de-auth-rbac) | ⏸ 🤝 Bloqueado en el mapeo de Clerk |
| [`/cliente/*` no tiene autenticación](#cliente-no-tiene-autenticación) | **Bloqueante antes del segundo cliente** |
| [El enforcement usa la política de hoy, no la congelada](#el-enforcement-usa-la-política-de-hoy-no-la-congelada) | Antes de encender enforcement |
| [La herramienta de geocercas solo captura círculos](#la-herramienta-de-geocercas-solo-captura-círculos) | Un solo trabajo con el versionado |
| [Gesto explícito para borrar la hora de cierre](#gesto-explícito-para-borrar-la-hora-de-cierre) | Si más gente configura contratos |
| [Distinguir "sin hora de cierre" de "no configurado"](#distinguir-sin-hora-de-cierre-de-no-configurado) | v1.1 |
| [`maxRouteDurationMinutes` fijo en 60](#maxroutedurationminutes-fijo-en-60) | 🟢 Tarea propia, sin mezclar |
| [Reconocer caminos](#reconocer-caminos) | Mitad motor en v1; la otra mitad v1.1 |
| [Map matching como capa de explicación](#map-matching-como-capa-de-explicación) | v1.1 |

### 3 · v2 — línea Lenore completa

| Entrada | Horizonte |
|---|---|
| [El loop de aprendizaje de la operación](#el-loop-de-aprendizaje-de-la-operación) | **Marco — gobierna varias entradas** |
| [Sandbox — el banco de pruebas de la política de rutas](#sandbox--el-banco-de-pruebas-de-la-política-de-rutas) | **Ficha propia — el producto v2** |
| [La política como acuerdo vivo](#la-política-como-acuerdo-vivo) | 1 de 3 piezas hecha (#125) |
| [Lenore — el copiloto](#lenore--el-copiloto) | Línea de producto propia |
| [Lenore-auditora](#lenore-auditora) | **Caso de uso estrella** |
| [Lenore-copiloto de configuración](#lenore-copiloto-de-configuración) | v2 |
| [Lenore-detección de deriva](#lenore-detección-de-deriva) | v2 |
| [Lenore-copiloto general en J-Staff](#lenore-copiloto-general-en-j-staff) | v2 |
| [Modo pasajero](#modo-pasajero) | Producto aparte |
| [Pre-nómina](#pre-nómina) | Futuro — hoy solo se deja el rol |
| [Compartir información entre plantas](#compartir-información-entre-plantas) | Configurable, nunca horneada |

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
| [La contraseña del readonly es la misma que la del dueño](#la-contraseña-del-readonly-es-la-misma-que-la-del-dueño) | 🟡 🤝 Toca producción |
| [La base de pruebas está atrasada](#la-base-de-pruebas-está-atrasada) | ✅ Cerrada el 4 de agosto · eran tres, no una |
| [Las migraciones del repo crean una columna que el código no conoce](#las-migraciones-del-repo-crean-una-columna-que-el-código-no-conoce) | ✅ **Cerrada el 15 de agosto** — la `0018` está aplicada en producción |
| [La `0027`, la `0028` y la `0029` no están en el journal del repo](#la-0027-la-0028-y-la-0029-no-están-en-el-journal-del-repo) | ✅ **Cerrada el 27 de agosto** — al día con la `0030`; la causa sigue viva |
| [`demos/activate` cruza cuentas](#demosactivate-cruza-cuentas) | 🟡 Protegida; falta decidir qué hace |
| [No hay configuración de ESLint](#no-hay-configuración-de-eslint) | 🟢 Junto con el corredor de pruebas |
| ["Consolidación" significa dos cosas](#consolidación-significa-dos-cosas) | 🟢 Renombrar la de política |
| [Los documentos llegan con la codificación rota](#los-documentos-llegan-con-la-codificación-rota) | 🟢 Revisar el traspaso, no el síntoma |
| [Documentación por marcar como superseded](#documentación-por-marcar-como-superseded) | Desbloqueado por el #130 |
| [Los 15 pendientes del 28-jul se quedan pendientes](#los-15-pendientes-del-28-jul-se-quedan-pendientes) | Decidido, no se toca |
| [Dos mapas de producción salen en negro: CARTO ahora exige llave](#dos-mapas-de-producción-salen-en-negro-carto-ahora-exige-llave) | 🟡 Superficie visible rota |

### 5 · Trámites y decisiones abiertas

| Entrada | Dueño |
|---|---|
| [Trámites que solo Asav puede hacer](#trámites-que-solo-asav-puede-hacer) | 🤝 Asav |
| [Decisiones de producto pendientes](#decisiones-de-producto-pendientes) | Producto |
| [El orden recomendado](#el-orden-recomendado) | ⛔ Se movió a `PLAN.md` §4 |

### 6 · Juárez Bus público — frente concesionado

> Frente paralelo, **transporte público concesionado**, no transporte especial. Su
> orden vive en `PLAN.md` §4, «Tramo JB». Aquí solo lo que se aplazó a propósito.
>
> **La regla que gobierna estas entradas: todo lo que se construya hoy tiene que
> dejar estas puertas abiertas sin abrirlas.** Ninguna entra al sprint. Lo que sí
> es obligación del sprint es no cerrarlas — y por eso cada una dice qué del
> diseño de hoy la mantiene viva.

| Entrada | Horizonte |
|---|---|
| [La pantalla de alta se organizó por tablas, no por tarea](#la-pantalla-de-alta-se-organizó-por-tablas-no-por-tarea) | **Candidata alta cuando lleguen las fichas de pantalla del esqueleto** |
| [El mapa de las paradas reales de Juárez](#el-mapa-de-las-paradas-reales-de-juárez) | Frontera post-sprint |
| [Los 30 s del recolector son un límite de la plataforma](#los-30-s-del-recolector-son-un-límite-de-la-plataforma) | Cuando llegue el fierro propio |
| [La velocidad sin calibrar viaja al teléfono con el interruptor apagado](#la-velocidad-sin-calibrar-viaja-al-teléfono-con-el-interruptor-apagado) | Cuando los dos cachés se igualen |
| [El buscador no entiende calle y número](#el-buscador-no-entiende-calle-y-número) | Cuando emparejar direcciones no exija sacar el destino del teléfono |
| [¿Sigue siendo exacta «no se envía a ningún servidor»?](#sigue-siendo-exacta-no-se-envía-a-ningún-servidor) | **Pregunta abierta · después del 10** |
| [El pasajero como usuario](#el-pasajero-como-usuario) | Cuando la app tenga uso real |
| [Sensores más allá del GPS](#sensores-más-allá-del-gps) | Cuando exista la suite del concesionario |
| [Mapas de demanda](#mapas-de-demanda) | Después de los sensores |

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

**Dónde va, al 15 de agosto de 2026 — y la mitad que falta es justo la que la vuelve
compuerta.** Esta entrada decía «diseño aprobado, sin construir» y eso ya no es cierto:

- ✅ **El número está decidido: el piso va en 60 segundos**, por Asav el 13 de agosto,
  y con su razón escrita, que es lo que lo hace defendible: **60 es exactamente el
  intervalo con el que emitían los aparatos de Planta 47 los trece días que causaron
  todo esto**. 45 alcanzaría a 203 servicios y 90 no toca a nadie.
- ✅ **La medición existe y ya viaja dentro del hecho** (paso 1 de las preguntas
  separadas, #312): `medirDensidad` usa **la misma definición que `medir-cadencia`**
  —mediana del hueco entre puntos consecutivos **del mismo aparato**, no puntos÷duración,
  que es un cociente que se mueve por el denominador y ya engañó una vez— y se congela
  en `compliance_facts.densidad_snapshot` (migración `0023`). 🟢 Corriendo en producción:
  **48 de 48 hechos del 14 de agosto la traen**.
- 🔵 **Lo que NO está, y es lo único que la convierte en compuerta: el umbral.** El paso
  del ledger declara **`gobierna: false`** a propósito, y **el piso no existe como perilla
  en ninguna parte** — ni en `contractPolicySchema` ni en el motor. Los 60 segundos son
  hoy una decisión escrita, no un número que el árbitro pueda leer. **Encenderlo es el
  paso 4**, y va después del paso 3.
- 🟢 **Y hay una prueba que vigila justo eso:** la misma geometría con evidencia cada 10 s
  y cada 120 s **da el mismo veredicto**. Si se pone roja sin que nadie encienda el paso 4,
  **la densidad empezó a decidir sin que se decidiera**.

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

**Dónde toca.** ⚠ **Y aquí hay una corrección de la propia entrada: el diseño decía «el
paso `cobertura_evidencia` del ledger», y no aterrizó ahí.** La densidad quedó en un paso
propio, **`densidad_evidencia`**, y en columna propia (`0023`) en vez de dentro de
`candidatas_snapshot` aunque saliera más barato — porque aquél dice «candidatas» y la
densidad es propiedad de la **evidencia**, y un campo cuyo nombre no describe su
contenido es C15 y C20 otra vez. `cobertura_evidencia` sigue existiendo y es **otra
pregunta**: si la evidencia cubrió la ventana.

Lo que queda por tocar es el umbral: `packages/verification/src` —donde hoy
`medirDensidad` mide sin gobernar—, `contractPolicySchema` en `packages/domain/src`, y su
perilla en la pantalla de contratos. **Medición y umbral juntos, como manda el Marco** —
hoy están separados, y ésa es exactamente la mitad que falta.

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

⚠ **La narradora está bloqueada hasta que
[el hecho se baste a sí mismo](#el-hecho-debe-bastarse-a-sí-mismo).** Narrar un veredicto
viejo leyendo el catálogo de hoy es mentir sin querer. Sobre hechos sellados **después**
de esa corrección no hay bloqueo — el problema es del pasado, no del diseño.

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
- **El vigilante externo tiene que empujar al mismo canal.** Hoy no lo hace, y ahí queda
  el agujero: **si Vercel se cae, el correo tampoco sale.** El vigilante de GitHub
  Actions es el único de los dos que sobrevive a ese apagón, así que es el único que
  puede avisar cuando más falta hace. Es la [Ley 4](#leyes-de-producto) llevada hasta el
  canal de salida — de nada sirve un vigilante fuera de la plataforma si su único modo de
  gritar vive dentro. Cierra el agujero del **28 de julio**: 13 horas caído y nadie
  avisado.
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

## El hecho debe bastarse a sí mismo

**Qué es.** Un hecho sellado tendría que contener —o referenciar de forma inmutable—
**todo lo que hizo falta para producirlo**. Hoy no: para explicarse tiene que salir a
buscar cosas del catálogo que pudieron cambiar debajo de él. Ese es el problema
completo, y todos los síntomas sueltos son la misma cosa.

**Por qué sube de categoría.** El Anexo ya registraba el hallazgo del 23 de julio —**~4%
de los hechos congelados no son reproducibles por el motor actual**— y lo marcaba como
relevante para la Ficha 4. No lo habíamos conectado con lo demás. No bloquea solo el
circuito de defensa y la [tasa de acierto de las
disputas](#el-loop-de-aprendizaje-de-la-operación): **bloquea toda la línea Lenore que
narre veredictos pasados, incluida [Lenore-narradora](#lenore-v1--vigía-y-narradora),
que está en v1.** Cita textual del Anexo:

> *"un copiloto que explica por qué salió rojo leyendo el motor de hoy daría una
> explicación que no corresponde al hecho sellado — mentiría sin querer."*

**El inventario de lo que le falta cargar**, medido sobre producción el 2026-07-28:

| Qué | Estado | Medido |
|---|---|---|
| Política del contrato | ✅ **se congela** | `contract_policy_snapshot`, byte a byte |
| Unidad de cada punto de evidencia | ✅ **anclada** | `evidence_points.unit_id`, escrito al anclar |
| Asignación equipo ↔ unidad | ✅ **temporal** | `device_assignments` con `valid_from`/`valid_to`; el motor la resuelve por fecha |
| Versión de trazado usada | 🟡 **referenciada, pero decorativa** | `kml_version_id` poblado en **688 de 744** hechos (92.5%) — **y el motor no la lee**: re-resuelve por fecha con `getKmlVersionForDate` |
| Conjunto de variantes evaluadas | ❌ **no se congela** | `route_kml_variants.status = 'activa'` es bandera de **hoy**, no de entonces. 50 variantes, **las 50 nacidas después del primer sello** |
| Forma de la geocerca | ❌ **no se versiona, y el campo miente** | ver abajo |
| Versión del motor | ❌ | [ya en backlog](#la-versión-del-motor-en-el-hecho) |

**La geocerca es el peor caso, y está medido.** No es solo que no se versione —`geofences`
no tiene tabla de versiones **ni columna `updated_at`**, así que una edición del polígono
no deja rastro de ninguna clase—. Es que **el campo que el hecho guarda no es el que el
motor usó**:

- El motor juzga con `profile.geofence` — la geocerca **vigente** del perfil.
- El hecho registra `occurrence.expectedGeofenceId` — la que se copió **al generar la
  ocurrencia**.

Cuando esos dos difieren, el expediente afirma algo falso. Y difieren:
**294 de los 744 hechos sellados (39.5%) registran una geocerca llamada `VOID`, cuyo
polígono está a 4.22 km de `Tecma Planta 47`**, que es contra la que realmente se
juzgaron. Son todos los hechos de Planta 47.

**Cuidado con la conclusión fácil: los veredictos NO están mal por esto.** Los 294 se
sellaron el 20, 27 y 28 de julio, y el perfil ya apuntaba a `Tecma Planta 47` desde el
15 de julio. El motor usó la geocerca correcta. **Lo que está mal es el registro**, no el
juicio — y por eso es el ejemplo más limpio del problema: quien audite ese expediente
reconstruye con `VOID` y obtiene otra cosa.

De paso queda explicado el mecanismo del ~4%: las 546 ocurrencias de Planta 47 generadas
el 14 de julio se quedaron con `VOID` congelado, y las 189 generadas del 15 en adelante
ya traen `Tecma Planta 47`. Es la [Ley 7](#leyes-de-producto) otra vez — se corrigió la
configuración y las ocurrencias ya generadas no se enteraron.

**La consecuencia que lo hace manejable, y es la buena noticia.** El bloqueo es **solo
para hechos viejos**. En cuanto el hecho se baste a sí mismo, **todo lo sellado de ahí en
adelante es reproducible** y Lenore puede narrarlo sin mentir. No hay que resolver el
pasado para desbloquear el futuro: hay que **marcarlo**, que es la regla de abajo.

**La regla para los hechos que no se puedan reproducir.** El expediente **lo dice**:
*"el catálogo cambió después del sello; esta evaluación no es reproducible"*. No muestra
una reconstrucción falsa, y no calla. Es la misma disciplina que los
[64 hechos sin umbral en el snapshot](#64-hechos-pre-12-jul-sin-umbral-en-el-snapshot):
un hueco declarado antes que un número inventado. Y es la [Ley 1](#leyes-de-producto)
aplicada a la explicación, no al veredicto — si no lo vimos, no lo afirmamos; si no
podemos reconstruirlo, tampoco.

**Qué lo desbloquea.** Nada externo: es trabajo de esquema y de motor, en tres piezas
independientes que se pueden hacer por separado —congelar la geocerca (o versionarla),
congelar el conjunto de variantes evaluadas, y hacer que el motor **lea** la versión de
trazado que el hecho ya referencia en vez de re-resolverla—. Emparenta con
[la herramienta de geocercas](#la-herramienta-de-geocercas-solo-captura-círculos), que
toca el mismo camino de escritura.

**Dónde toca.** `packages/services/src/verification.ts:875` — `const geofence =
profile.geofence!`, y `:1056` — `expectedGeofenceId: occurrence.expectedGeofenceId`;
`getActiveVariantVersionsForDate` en `packages/db/src/repositories/index.ts:706`;
`compliance_facts`; `geofences`; `route_kml_variants.status`.

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

## Afinar la ventana derivada con el match observable

**Qué es.** El #115 conectó la ventana derivada, pero hoy corre con **estimación
geométrica**: `route_traversal_measurements` estaba vacía cuando se midió. Esa tabla
**se llena sola con la operación diaria**, así que lo que falta no es escribir datos, es
esperar historia y afinar contra ella.

**Por qué ahora.** Es la mitad que le falta al arreglo del motor, y hasta que cierre no
se puede sellar nada encima. Medición del **30 de julio de 2026** con el motor arreglado:
**139 / 160 / 1**, contra **91 / 209 / 0** con la ventana rota.

**Lo que el desglose destapó, y es el punto de la entrada.** De ese movimiento, **+50 se
enderezan por el match observable y −2 se caen por la ventana derivada**. Las dos mitades
**no están afinadas entre sí**: una empuja y la otra retiene. Afinar solo una vuelve a
mover el número sin que nadie sepa cuál de las dos lo movió.

**Qué lo desbloquea.** Que `route_traversal_measurements` acumule historia real de la
operación. Es tiempo, no trabajo.

### Ya no es «ola 2»: la deriva se midió, y es rápida — 17 de agosto de 2026

El Acta de Cierre de Bloque C recortó esta entrada con la razón de que «ya estaba en ola
2; ahí sigue». **Eso se sostenía sobre una suposición que ahora está medida y era
optimista.**

Al re-dimensionar la tanda de ventanas desalineadas se contaron dos veces, con el mismo
instrumento y con 17 horas de diferencia:

| | ocurrencias sin sellar | con la ventana desalineada |
|---|---:|---:|
| 16 ago, 00:41 UTC | 1 056 | **278** |
| 17 ago, 17:18 UTC | 1 075 | **475** |

**+197 en 17 horas.** No es error de medición ni población nueva: solo entraron 19
ocurrencias al universo revisado. Lo que creció fue la **desalineación** —
`route_traversal_measurements` suma ~48 filas al día y cada una mueve la derivación de su
ruta×turno, así que ocurrencias que ayer estaban alineadas hoy ya no lo están.

**Lo que eso cambia.** La corrección de la tanda es una foto: lo re-dimensionado hoy
vuelve a desalinearse en días, y mientras tanto el motor sigue sellando ~10 servicios
diarios de esa población. **Cada día que pasa produce hechos juzgados con marco viejo**, y
un hecho sellado no se corrige — se re-verifica, que es D4 y otra firma.

**Y ya costó.** El 17 de agosto, entre que la alerta avisó y la decisión se tomó, sellaron
~5 servicios con ventana desalineada. Se quedan como están: moverlos sería re-verificar.

**Por eso sube.** Deja de ser afinación de precisión y pasa a ser contención de una fuente
activa de hechos malos. Va **arriba de solicitudes y quejas** en el orden de la frontera.

⚠ **Y una precisión de alcance, para que nadie la construya de más.** Esta entrada, tal
como está escrita arriba, es *afinar la derivación*. Lo que la medición vuelve urgente es
algo adyacente y más chico: **que la ventana se vuelva a derivar antes de juzgar, en vez
de quedarse con la que se congeló al crear el viaje**. Las dos se tocan y conviene
decidir si son una pieza o dos **antes** de abrir ninguna — la misma regla del nudo que
gobierna los pasos 3 y 4. El detector ya existe (`revisar-ventanas`) y avisa; lo que no
existe es que alguien actúe sin que un humano pegue SQL.

**El instrumento.** `pnpm --filter @jtel/db corregir-ventanas` (simulacro) y
`ventanas-desalineadas.ts`. Las dos cifras de arriba se pueden volver a sacar cuando sea.

**Y qué desbloquea a su vez.** [Las 300 congeladas](#las-300-congeladas--la-foto-de-referencia),
que no se re-verifican antes que esto.

**Dónde toca.** `route_traversal_measurements`; las perillas de derivación de ventana
—`windowDerivationEnabled`, `routeDurationPercentile`, `routeDurationMinSamples`, con
`routeAvgSpeedKmh` de respaldo—, descritas en `docs/marco-limpio/Despues.md` §2.

## Las 300 congeladas — la foto de referencia

**Qué es.** El **PR #124 está abierto a propósito y sin mergear.** No es un pendiente
olvidado: es la **foto de referencia reproducible** contra la que se mide si el motor
mejoró.

**Por qué no se re-verifica todavía.** Porque
[la ventana derivada y el match observable no están afinados entre sí](#afinar-la-ventana-derivada-con-el-match-observable),
y `route_traversal_measurements` todavía no tiene historia real. **Sellar hoy es sellar
un efecto a medio hornear** — y un sello nuevo mete una versión más en la historia del
hecho, así que re-verificar en falso no es gratis.

**Qué lo desbloquea.** Las dos cosas juntas: la afinación cerrada y la tabla de duraciones
con historia. Y una decisión que no es técnica —
[cómo se le cuenta a Tecma que su número cambia al re-verificar](#decisiones-de-producto-pendientes).

**Dónde toca.** PR #124; `compliance_facts`; `compliance_fact_history`.

## Las tres rutas con falla real

**Qué es.** **Huertas - B, Centro - A y Parajes del Sur - A** fallan **incluso con la
ventana corregida** — alrededor de **43 servicios**. No son residuo de los bugs de reloj:
es el remanente que sobrevive a todos los arreglos de motor hechos hasta hoy.

**El diagnóstico de Huertas, que es el que está medido.** No es la geocerca: **entran
14-15 unidades al destino cada día** y el servicio **sí se da**. Lo que no corresponde es
**el trazado KML contra el camino real.**

**Por qué no se cierra solo.** Requiere que **una persona abra el KML en un visor y lo
compare a ojo** con el recorrido observado. No hay medición automática que lo sustituya
hoy — es justamente el insumo que
[reconocer caminos](#reconocer-caminos) automatizaría más adelante.

**Ojo con no confundirla con su vecina.** `Huertas - B` también aparece en
[Turno B de Planta 47](#turno-b-de-planta-47-declarado-1800-operado-1400), que es un
problema **de hora declarada**. Son dos capas distintas sobre la misma ruta: primero el
reloj, y debajo el trazado.

**Dónde toca.** `route_kml_versions.waypoints`; los perfiles de esas tres rutas; ningún
cambio de motor.

## Dirección visual del producto

**Qué es.** 🔴 **PENDIENTE DE ASAV.** El homescreen del #138 **cumple la ficha** —sin
cifras de juicio, alcance resuelto, seis puertas— **y aun así se ve como un directorio de
texto, no como una plataforma.**

**La causa, y es de la ficha, no de quien la ejecutó.** `Ficha-Cara-De-Producto.md` §2
decidió *"puertas, no tableros"*, que era la decisión correcta y protegía de pintar cifras
que todavía se mueven. Pero **no dijo nada de cómo debe verse.** Se cumplió al pie de la
letra y salió pobre. Una ficha que define qué NO mostrar y calla sobre el registro visual
deja el resultado al azar.

**Por qué ahora, y por qué bloquea.** Va **antes** de seguir construyendo pantallas, o las
siguientes nacen con el mismo problema y hay que rehacerlas todas juntas. Es la única
entrada de este archivo cuyo desbloqueo son tres respuestas, no trabajo.

**Qué lo desbloquea — tres respuestas de Asav, y con ellas una ficha de dirección visual
que el skill `j-telemetry-ui` absorba:**

1. **¿Qué producto le gusta cómo se ve?** Para entender el registro, no para copiarlo.
2. **¿Qué le falta para sentirse plataforma?** ¿Navegación lateral permanente? ¿Tarjetas
   con peso? ¿Que se vea *quién* eres?
3. **¿Las puertas son tarjetas con algo adentro, o enlaces bien hechos?**

**Dónde toca.** `docs/marco-limpio/Ficha-Cara-De-Producto.md` §2 y §5; el skill
`j-telemetry-ui`; el homescreen del #138.

## El resto de la cara del producto

**Qué es.** Lo que sigue del frente, ya fichado en `Ficha-Cara-De-Producto.md` §7:
homescreen de carrier · coherencia visual de J-Staff · pase de coherencia sobre lo
existente · enrutamiento por **subdominios**.

**Por qué se aplazó.** Va **después de [la dirección visual](#dirección-visual-del-producto)**,
por la razón de esa entrada: construir más pantallas antes de resolver el registro visual
es fabricar trabajo que se rehace.

**Los subdominios, aparte y bloqueados.** ⏸ **`j-tel.io` no está comprado.** Se diseñan y
se deja el código listo para que apuntarlos sea configuración y no obra; **no se enciende
nada** hasta que el dominio exista. Ver
[trámites](#trámites-que-solo-asav-puede-hacer).

**La regla que no se rompe.**

> **El subdominio es una puerta, no un permiso.**

Llegar por `portal.j-tel.io` **no convierte a nadie en cliente**. Quién es y qué alcance
tiene lo decide su membresía, siempre. Si esto se invierte se abre el agujero más obvio de
todos —escribir otra URL para ser otra persona— y la guardia sigue siendo la de
`auth-rbac`, sin excepciones por subdominio.

**Dónde toca.** `docs/marco-limpio/Ficha-Cara-De-Producto.md` §4 y §7;
`docs/Brief-Identidad-J-Tel.md` — la única definición escrita de los subdominios, ver
[documentación por marcar como superseded](#documentación-por-marcar-como-superseded).

## Pendientes puntuales de v1

**Anomalía del sello anticipado — verificación pendiente.** Sospecha sin comprobar:
que el motor juzgue en `deadline + gracia` (10 min) mientras la ventana de evidencia
sigue abierta hasta `deadline + gracia + margen` (45 min). Si es cierto, sella con
evidencia incompleta y viola la Ley 1 sin que nadie lo note. **Es solo lectura y hay
que medirlo antes de construir nada encima.**

## Cierre del turno

**Qué es.** El resumen de un turno ya juzgado, construido contra el molde visual
aprobado. **Absorbe el antiguo Historial** —lo que el producto llamaba "la
Jornada"—: el mapa de contraste sigue ahí, pero deja de ser la portada.

**La ley de la pantalla.** Entrega un resultado ya dado; nunca pone al usuario a
trabajarlo. El estado de entrada es el resultado del turno, tranquilo. El detalle
—mapa, tabla de los limpios— es un cajón que se abre por elección.

**El mapa dibuja solo lo que tiene excepción.** Catorce rutas encimadas no son un
mapa, son un espagueti, y eso no se arregla dibujando mejor sino no dibujando lo
que ya está bien. La línea base es el **trazado contratado** coloreado por
resultado —no el recorrido observado—, porque un `no_cumplido` no tiene unidad
acreditada y el mapa se vaciaría justo en las excepciones que importan. El
recorrido real se dibuja encima solo donde el árbitro selló una unidad, cortado en
la llegada.

**Qué NO trae, a propósito.** El bloque de consecuencias —*"el viaje no se paga"*,
*"descuenta bajo la cláusula de tolerancia"*— es enforcement, y está parqueado por
decisión de producto hasta que el árbitro sea confiable. El hueco queda reservado
en la estructura, como el circuito de defensa en el expediente. Ver
[el enforcement usa la política de hoy](#el-enforcement-usa-la-política-de-hoy-no-la-congelada).

Tampoco trae **"excusado"**: `late_excusable` existe en el hecho y está en `false`
en los 744 hechos de la base, porque el flujo que lo alimenta —el carrier reporta
motivo, la planta lo acepta— está fuera de v1. **No se reserva espacio para una
palabra que no va a aparecer.** Lo que sí entra es temprano / a tiempo / tarde,
que existe en los 239 cumplidos.

**Lo que queda pendiente.** El emparejamiento con el ledger falla seguido —ver
[El ledger debe colgar del hecho](#el-ledger-debe-colgar-del-hecho)—, así que la
línea de cobertura del titular va a faltar con frecuencia. La pantalla se diseñó
para sostenerse sin ella.

**Dónde toca.** `packages/services/src/cierre.ts`; `apps/web/src/lib/cierre-data.ts`;
`apps/web/src/views/cierre-unit.tsx`; `apps/web/src/components/cierre-mapa.tsx`;
`/cliente/{planta,campus}/[id]/cierre`.

## Pendientes puntuales de v1 (continuación)

**Sellado del turno.** El PR #87 trajo el emparejamiento con el hecho y ya está en
`main`. Lo que sigue en pausa es **sellar** el turno como acto —no mostrarlo—, que
se retoma cuando el motor de identificación esté estable: sellar un turno con
identificación que no se explica es apilar sobre arena.

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

**Lo que ya entró — #125, en producción.** La **historia de la política** existe y está
viva: es la primera de las tres piezas de
[la política como acuerdo vivo](#la-política-como-acuerdo-vivo). Lo que esta entrada
sigue pidiendo es **el resto del río arriba —KML y perfiles—**, que no tienen historia.
Su tabla `contract_policy_history` era además la que
[le faltaba a la base de pruebas](#la-base-de-pruebas-está-atrasada) — ya no: se aplicó
el 4 de agosto de 2026.

**Qué lo desbloquea.** Nada técnico — es una decisión de prioridad. **Requisito antes
del segundo cliente:** con un solo cliente y una sola persona configurando, la memoria
humana todavía alcanza. Con dos, no.

**Es además prerrequisito de otra cosa más grande.** Sin esta historia, *"la
configuración aprendió"* es indistinguible de *"alguien le movió"*. Ver
[El loop de aprendizaje de la operación](#el-loop-de-aprendizaje-de-la-operación).

**Y ahora también el circuito concesionado — 2 de septiembre de 2026.** El expediente
del circuito (#364) puso a mano, en una pantalla, seis umbrales que antes sólo se
movían con SQL. Nada de lo del circuito deja rastro de quién lo cambió:
`circuits` se sobrescribe y sólo conserva `updated_at`; publicar y prender el tiempo
estimado guardan **cuándo** (`published_at`, `arrival_range_enabled_at`) pero no
**quién**; el trazado se reemplaza. Paradas y asignaciones sí versionan con vigencia y
motivo, y siguen sin actor.

**Lo que ya cuesta, medido en la pantalla:** el expediente enseña «igual al valor de
origen» y **no puede decir «sin ajustar»**, porque un 180 heredado y un 180 tecleado
son indistinguibles en la base. Es el mismo hueco que tenía la frecuencia declarada
antes de la `0031`, y esta entrada es lo único que lo cierra. La Pieza 4 del Marco ya
lo exige —*toda acción sensible queda en el ledger*— y publicar un circuito a una
ciudad entera califica.

**El molde ya existe y es barato:** `shift_history` (`0019`) y
`contract_policy_history` (`0020`) guardan antes/después + `actor_kind` + `actor_id` +
`note` + `changed_at`, y **las escribe un trigger de Postgres, no el código**. Ésa es la
lección de C13, escrita en el esquema: el registro vivía dentro de `updatePolicy` desde
el 31 de julio y la tabla seguía vacía, porque la edición real la hizo un guion con
`UPDATE` crudo. Un trigger alcanza también a los guiones y a la consola de Neon.

**Dónde toca.** `route_kml_versions`, `service_contracts.policy`, `service_profiles`, y
—para el frente concesionado— `circuits`, `circuit_paths`, `circuit_stop_versions`,
`circuit_unit_assignments`.

## El horario del circuito no tiene estado «sin declarar»

**Qué es.** `circuits.service_start_local` y `service_end_local` son `NOT NULL` con
valor de origen 05:00–23:00. La app del pasajero lee ese horario y **se lo atribuye al
concesionario** —«Servicio declarado de 05:00 a 23:00», bajo el rótulo *«declarada por
el concesionario»*— sin poder distinguir si alguien lo capturó o si el circuito nació
así.

**Es el mismo defecto que la frecuencia, un escalón más abajo.** La `0031` le quitó el
`DEFAULT 20` a `declared_frequency_minutes` justo porque «declaró 20» y «no declaró
nada» eran indistinguibles, y la app afirmaba la cadencia igual en los dos casos. El
horario está exactamente ahí, con la diferencia de que **fuera de horario la app sí
afirma**: dice a qué hora abre, y ésa es la única afirmación sin evidencia que se
permite.

**Por qué NO se migra ahora — decisión de Asav, 2 de septiembre de 2026.** Se resuelve
capturando el horario real que declare el concesionario, que es trabajo de días de
sprint y no de esquema. Hacer la columna anulable obliga además a decidir qué dice la
app sin horario, y hoy no hay ningún caso que lo pida: el circuito que sale el 10 va a
tener su horario capturado.

**Qué lo desbloquea.** Un concesionario que **no** declare horario. Mientras todos lo
declaren, la columna anulable resolvería un caso que no existe.

**Dónde toca.** `packages/db/src/schema/index.ts` (`circuits`),
`apps/publico/src/components/vista-pasajero.tsx` (el titular y la frase de
`sin_evidencia`), `apps/web/src/app/jstaff/circuitos/[id]/page.tsx` (sección 2).

## Mover, reordenar y dar sentido a las paradas desde la pantalla

**Qué es.** Arrastrar una parada ya creada a otro punto del trazado, cambiarle el orden,
y decirle si sirve un sentido o los dos.

**Por qué se aplazó — decisión de Asav, 2 de septiembre de 2026: queda fuera hasta
después del 10.** El `PATCH` de la parada **ya soporta las tres** (`lat`/`lon`, `orden`,
`sentido`) y lo que falta es sólo la piel; pero mover pide arrastre sobre el marcador de
Leaflet con su confirmación de pegado, y eso crece un PR que ya iba en 1 662 líneas. Con
el sprint del Tramo JB encima, la parada mal puesta se arregla retirándola y volviéndola
a picar — feo, y suficiente.

**Qué lo desbloquea.** Que pase el 10 de septiembre.

**Dónde toca.** `apps/web/src/components/circuito-editor.tsx` y
`apps/web/src/app/api/jstaff/circuitos/[id]/paradas/[stopId]/route.ts` (que ya está
listo).

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

## `CRON_SECRET` cae a un secreto publicado

> ✅ **CERRADO.** Tres mitades, y las tres están hechas.
>
> **El código, el 2 de agosto de 2026** (Fase 1.a de `Plan-Camino-a-v1.md`). Ya
> no hay respaldo: sin `CRON_SECRET` las siete rutas responden **503 con
> registro**, la comprobación vive en un solo `apps/web/src/lib/guardia-cron.ts`
> y compara en tiempo constante.
>
> **Los documentos, el mismo día.** El valor salió del `README.md` y de esta
> entrada en el mismo commit que quitó el respaldo. Comprobado sobre `main` el 4
> de agosto de 2026: **no aparece en ningún archivo versionado.**
>
> **La rotación, hecha.** El secreto está rotado en Vercel.
>
> **Y lo que queda escrito a propósito:** el valor viejo **sigue en el historial
> de git**, y ahí se queda. No se reescribe historia por esto. Estando rotado,
> ese valor ya no abre nada: es un registro de lo que pasó, no una llave.
> Decisión de Asav, 4 de agosto de 2026.

**Qué era.** 🔴 **Verificado el 1 de agosto de 2026 leyendo el repo.** Las **siete rutas de
cron** traían el mismo respaldo — `process.env.CRON_SECRET` con un valor por omisión fijo
escrito en el código:

`cron/verify` · `cron/archive` · `cron/renew-occurrences` · `cron/ingest-heartbeat` ·
`cron/gap-backfill` · las dos de alertas.

**Y el `README.md` publicaba ese mismo valor** en el `curl` de ejemplo, así que la cadena
que abría las siete se leía en la portada del repositorio.

**Por qué era grave.** Un despliegue sin la variable —entorno nuevo, preview, variable que
no se propagó— queda protegido por **una cadena que cualquiera lee en el repositorio**. Con
ella se dispara verificación y archivado. Y **no hay error ni alerta: la app arranca y se
ve bien.** Fallo abierto y silencioso a la vez, que es la peor combinación posible y la
razón de ser de [la regla de los defaults](#defaults-que-fallan-abiertos).

**Y había dos criterios distintos en el mismo repo.** La comparación era `!==` sobre
cadenas, **no en tiempo constante**, mientras `identidad-dev.ts` ya usaba
`igualEnTiempoConstante`.

**Qué lo desbloquea.** Nada. Media hora de trabajo, riesgo alto, arreglo trivial — es lo
primero de [el orden recomendado](#el-orden-recomendado). El arreglo completo:

- ✅ **Quitar el respaldo.** Sin variable → **503 y registro, nunca 200.**
- ✅ **Extraer a un solo `lib/guardia-cron.ts`** con comparación en tiempo constante. La
  comparación salió a `lib/comparacion-segura.ts`, que ahora usan la guardia y
  `identidad-dev.ts`: un solo criterio, no dos implementaciones del mismo.
- ✅ **Quitar el valor del README.**
- 🤝 **Rotar el secreto en Vercel**, asumiéndolo comprometido — y por la
  [Ley 5](#leyes-de-producto), **redesplegando en el mismo movimiento.** **Pendiente.**

**Dónde toca.** Las siete rutas bajo `apps/web/src/app/api/cron/`; `README.md`;
`lib/guardia-cron.ts` (nuevo); `lib/comparacion-segura.ts` (nuevo);
`identidad-dev.ts`, que dejó de tener su propia copia de la comparación.

## Las páginas no comprueban permisos

**Qué es.** 🔴 Las **26 rutas de API están protegidas**. Las **páginas no**: llaman a
`getRepos()` directo y renderizan, **sin pasar por ninguna guardia**. `middleware.ts` solo
adjunta la sesión; proteger exige `auth.protect()`, deliberadamente ausente.

Confirmado por **dos vías independientes**: una revisión externa y el propio Devin al
cerrar las rutas de API.

**Lo más filoso.** `/jstaff/diagnostico` y `/jstaff/verificacion` muestran el **razonamiento
interno del árbitro**. La ruta de API equivalente (`autopsia-no-cumplidos`) **ya está
protegida y marcada como confidencial**; la pantalla que enseña lo mismo, no.

> Un árbitro cuya cocina es visible para el auditado deja de ser árbitro.

**Por qué se aplazó, y cuándo deja de poder aplazarse.** Hoy **Deployment Protection de
Vercel tapa todo desde afuera**, así que el riesgo es teórico. Se vuelve urgente **el día
que entre el primer usuario real** — porque ese día la puerta de Vercel se abre para que
alguien entre, y al abrirse deja de tapar a los demás.

**Qué lo desbloquea.** Nada técnico. El arreglo es `lib/guardia-pagina.ts`, hermana de
`guardia-api.ts` —**reutilizando `decidir`, no duplicándola**— que en vez de responder HTTP
haga `redirect()`. **Falla cerrado.** Aplicar en `/jstaff`, revisar `/cliente` y
`/carrier`.

**Dónde toca.** `apps/web/src/middleware.ts`; `guardia-api.ts` y su `decidir`; las páginas
bajo `/jstaff`, `/cliente` y `/carrier`;
`docs/marco-limpio/Ficha-Diseno-Permisos.md`.

## Cerrar el default de identidad heredada

**Qué es.** ⏸ Sin sesión, sin `JTEL_DEV_USER` y sin encabezado válido, la identidad cae en
`tecma_admin` — **falla abierto, y además en la cuenta de un cliente real.** En producción
debe dejar de aplicar: **sin identidad, no se entra.**

**Por qué se aplazó, y el orden no es negociable.**

> ⚠ **Va después de [las guardias de página](#las-páginas-no-comprueban-permisos).** Al
> revés, quedamos todos fuera.

Ese default es hoy lo que sostiene el acceso mientras el bypass de desarrollo vive.
Cerrarlo antes de que exista la guardia —y antes del mapeo de Clerk— deja el producto sin
ninguna forma de entrar.

**Qué lo desbloquea.** Las guardias de página cerradas **y** el mapeo de Clerk hecho. Ver
[lo que falta del candado](#lo-que-falta-del-candado-de-auth-rbac).

**Dónde toca.** `identidad-dev.ts`; la variable `JTEL_DEV_USER`.

## El expediente por id sigue abierto

**Qué es.** 🟡 `cliente/servicio/[id]` carga por **id de ocurrencia sin ningún alcance**.
Cualquier id de cualquier cliente renderiza.

**Por qué es entrada aparte y no un caso de la anterior.** Aunque la guardia de páginas
quede cerrada, esta ruta **seguiría entregando datos de otra cuenta a un usuario
legítimamente autenticado**. Es exactamente la diferencia entre *"¿perteneces a la
cuenta?"* y *"¿tu alcance cubre estos datos?"* — ver
[lo que falta del candado](#lo-que-falta-del-candado-de-auth-rbac).

**Qué lo desbloquea.** La guardia por alcance. Mientras tanto, el mismo remiendo que el
resto: Deployment Protection.

**Dónde toca.** `apps/web/src/app/cliente/servicio/[id]`.

## Defaults que fallan abiertos

**Qué es.** 🟡 El patrón del que
[`CRON_SECRET`](#cron_secret-cae-a-un-secreto-publicado) es un caso, no la excepción.
Medido sobre el repo:

| Dónde | Default | Qué causa |
|---|---|---|
| `apps/worker/src/run.ts` | `UMBRELLA_USER_ID` / `UMBRELLA_PASSWORD` (nombres viejos) | **Autentica con `undefined`** — corre y no trae datos |
| `apps/worker/src/run.ts` | `postgresql://...localhost:5432` | El worker de producción apunta a **base local** si falta la variable |
| `lib/umbrella-config.ts` | `""` de usuario y contraseña | Falla contra el GPS; en pantalla se ve como *"no hay datos"* |
| `.env.example` | Pide `UMBRELLA_USER_ID` / `UMBRELLA_PASSWORD` | Nombres viejos, desincronizado con el código |

**La regla que sale de aquí.**

> Si el default de un `process.env` es **un secreto, una credencial, una identidad o una
> URL de base de datos, no lleva default — revienta.**
> Un fallo ruidoso cuesta diez minutos. Uno silencioso cuesta el hallazgo entero.

⚠ **Candidata a ley de producto.** Se anota aquí como regla y queda pendiente de
ratificación, igual que la arista de la [Ley 7](#leyes-de-producto). Es la
[Ley 1](#leyes-de-producto) aplicada a la configuración: **la ausencia de un dato no se lee
como una decisión.**

**El mecanismo ya existe y no se está usando.** `scripts/verificar-env.mjs` sabe exigir
variables y salir con código 1. Lo que falta es que **el código confíe en él** en vez de
traer cada uno su propio paracaídas, y **encadenarlo a CI** para que un despliegue sin
variables *no despliegue*, en vez de desplegar en modo inseguro.

**Ojo con el bug del worker, que es tarea propia.** La fila 1 **cambia comportamiento en
producción** —hoy el worker de GPS autentica con `undefined`—, así que se arregla sola, no
mezclada con el barrido del patrón.

**Qué lo desbloquea.** Nada. Es el tercer paso de
[el orden recomendado](#el-orden-recomendado): la regla que evita que esto se repita.

**Dónde toca.** `apps/worker/src/run.ts`; `lib/umbrella-config.ts`; `.env.example`;
`scripts/verificar-env.mjs`; la configuración de CI.

## Lo que falta del candado de auth-rbac

**Qué es.** El diseño completo ya existe en `docs/marco-limpio/Ficha-Diseno-Permisos.md`.
Esto es lo que **le falta al candado** para cerrar:

- **⏸ 🤝 Mapeo de Clerk (Paso 2).** `clerk_user_id` guarda hoy **cadenas del seed**
  (`tecma_admin`), no los identificadores que emite Clerk. Una sesión real trae **cero
  membresías**. **Bloquea todo lo demás de esta lista.**
- **Guardia por alcance, no por cuenta.** Hoy pregunta *"¿perteneces a la cuenta?"* cuando
  debe preguntar *"¿tu alcance cubre estos datos?"*. Lo marcó el bot en el #134, y aquí
  entra la **regla del campus** (ficha §2.2). Es lo que cierra
  [el expediente por id](#el-expediente-por-id-sigue-abierto).
- **Administración de usuarios.** No existe. Hoy dar de alta a alguien es **trabajo manual
  de J-Staff**, aunque el Marco dice que **el admin corporativo administra los suyos**.
- **Escalación configurable.** Se engancha a la plomería de alertas **ya construida**.
- **Exportar.** No existe. Sale de la ficha §3.2: si Procurement y los roles de escalación
  **no entran a la aplicación**, alguien tiene que poder **sacarles el dato**.

**Por qué se aplazó.** El mapeo de Clerk es 🤝 trámite de Asav, y sin él lo demás no se
puede probar contra una sesión real.

**Mientras el bypass viva, la regla operativa.** `JTEL_DEV_USER=jstaff_admin` en Vercel —ya
está—, y **no iniciar sesión en Clerk** hasta que el mapeo exista. Una sesión real hoy
entra sin membresías y se ve como un usuario sin permisos, no como un error.

**Qué lo desbloquea.** 🤝 [Crear la cuenta en Clerk y sus dos
llaves](#trámites-que-solo-asav-puede-hacer).

**Dónde toca.** `packages/auth-rbac`; `userMemberships.clerk_user_id`;
`docs/marco-limpio/Ficha-Diseno-Permisos.md` §2.2 y §3.2.

## `/cliente/*` no tiene autenticación

**Qué es.** Las rutas de cara al cliente no están protegidas. El único middleware que
las toca (`apps/web/src/middleware.ts`) solo **repara parámetros `?account=` mal
pegados**; no verifica identidad. Cualquiera con la URL ve **cualquier cuenta**
cambiando el parámetro, y `resolveAccountByType` cae a la primera cuenta del tipo
cuando no se pasa ninguno.

**Actualización — 1 de agosto de 2026.** Una parte de esto ya se cerró y conviene no
volver a diagnosticarlo entero: **las 26 rutas de API ya están protegidas**. Lo que
queda abierto es de otra forma y vive en tres entradas propias — las páginas, que
[no comprueban permisos](#las-páginas-no-comprueban-permisos); el
[expediente por id](#el-expediente-por-id-sigue-abierto), que no filtra por alcance; y
[el default de identidad heredada](#cerrar-el-default-de-identidad-heredada), que hace
que la ausencia de sesión caiga en una cuenta real.

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

## La herramienta de geocercas solo captura círculos

**Qué es.** El motor soporta formas arbitrarias —`polygon` es una lista de puntos y la
verificación usa `pointInPolygon`—, pero **la pantalla no deja dibujar**. No hay mapa:
es un formulario con **centro (lat, lng) y radio en metros**, y un consejo de *"en Google
Maps, clic derecho sobre el punto"*. `circlePolygon` genera 24 vértices alrededor del
centro. Por eso todas las geocercas de la base tienen exactamente 24 vértices o 4.

**Y hay una trampa peor que la limitación.** Al editar, la pantalla corre
`inferCircleFromPolygon` —promedia el centro y el radio— y **vuelve a generar un
círculo**. Si alguien metiera un polígono irregular por SQL, **la siguiente edición desde
la pantalla lo redondearía y no habría manera de recuperarlo**: no hay versiones ni
`updated_at`. La forma se perdería en silencio.

**Por qué importa ahora.** Asav necesita **formas irregulares para campus y parques
industriales**, que no son redondos. Un círculo sobre un campus alargado o mete calle
pública adentro o deja andenes afuera; las dos cosas mueven veredictos.

**Es un solo trabajo con el versionado, no dos.** Ambas cosas tocan el mismo camino: la
escritura de la geocerca. Versionar significa que el editor **deje de sobrescribir y
empiece a agregar**; dibujar significa que lo que se agrega puede tener cualquier forma.
Y se necesitan juntas: **una forma irregular editada en sitio es irrecuperable, mientras
que un círculo al menos se puede volver a derivar de centro y radio.** Hacer el dibujo
sin el versionado empeora el problema en vez de arreglarlo. Ver
[El hecho debe bastarse a sí mismo](#el-hecho-debe-bastarse-a-sí-mismo).

**Qué lo desbloquea.** Decisión de prioridad. Leaflet ya está en el proyecto y ya se
dibuja encima de mapas en varias pantallas, así que el editor no parte de cero.

**Dónde toca.** `apps/web/src/views/geocercas-unit.tsx`;
`apps/web/src/app/api/cliente/geocercas/route.ts`; `circlePolygon` e
`inferCircleFromPolygon` en `apps/web/src/lib/geo.ts`; `geofences.polygon`.

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

## `maxRouteDurationMinutes` fijo en 60

**Qué es.** 🟢 Un **segundo *"cuánto dura una ruta"* sin derivar**, clavado en 60 minutos,
que gobierna las **ventanas de exclusividad y de cobertura**.

**Por qué se aplazó.** Hoy **no causa falsos negativos**, así que no compite con lo que sí
está mordiendo. Pero es exactamente la clase de constante que la ventana derivada vino a
eliminar: un número de código donde debería haber una medición.

**Por qué es tarea propia y no se mezcla.** No se toca junto con otro cambio de motor. La
lección es de la entrada de al lado: cuando
[se afinó la ventana derivada](#afinar-la-ventana-derivada-con-el-match-observable), **+50
y −2 se movieron a la vez** y costó trabajo saber cuál mitad había hecho qué. Dos
derivaciones cambiando juntas hacen inatribuible el resultado.

**Qué lo desbloquea.** La misma historia que la otra derivación:
`route_traversal_measurements` con datos reales de la operación.

**Dónde toca.** `maxRouteDurationMinutes` en la política del contrato; las ventanas de
exclusividad y cobertura en `packages/verification/src`.

## Reconocer caminos

**Qué es.** La capacidad de juzgar bien cuando el KML no es fino. **Se parte en dos
mitades con horizontes distintos, y esa partición es el punto de la entrada:**

- **La mitad motor** —juzgar honestamente sin KML fino: **geocerca + corredor + paradas**—
  **es v1**, y vive en la Ola 2.
- **La maquinaria de descubrir y proponer variantes**, con su UI de aprobación, es
  **v1.1**, candidata a subir según lo que muestren las pruebas.

**Por qué importa partirla.** Sin la partición, *"reconocer caminos"* suena a una sola cosa
grande y se aplaza entera — cuando la mitad que arregla veredictos **ya está en v1**.

**Qué gana la segunda mitad.** Es la que convierte
[las tres rutas con falla real](#las-tres-rutas-con-falla-real) de un trabajo de ojo humano
sobre un visor de KML en algo que el sistema propone solo.

**Qué lo desbloquea.** El agrupador de variantes —pieza 3 de
[Identificación que se explica](#identificación-que-se-explica)— y la promoción de
variantes de `docs/Ficha-Handoff-Variantes-Trazado.md`.

## Map matching como capa de explicación

**Qué es.** Interpretar el recorrido observado **en términos de calles**, no de puntos
sueltos. Entra como **capa de aprendizaje y explicación, nunca de juicio.**

**La advertencia que no se puede perder.** **No arregla *"no vimos media ruta"*.** Es
**afinación, no arreglo**. Esperar de aquí una corrección de veredictos es esperar algo que
no va a llegar, y esa confusión es la razón por la que la entrada existe escrita.

**Qué gana.** Entender la operación en términos de calles alimenta el
[descubrimiento de caminos](#reconocer-caminos) y hace **las explicaciones de Lenore mucho
más humanas** — la diferencia entre *"se desvió 4.8 km"* y *"se fue por Tecnológico en vez
de Ejército Nacional"*.

**Por qué se aplazó.** v1.1. Ninguna decisión depende de ella y ningún veredicto la
necesita.

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

## Sandbox — el banco de pruebas de la política de rutas

**Qué es.** Un banco de pruebas donde **la planta rediseña su propia política de rutas
contra el historial real de la operación**, y aprueba el resultado como **versión nueva con
fecha de vigencia**. Es el primer módulo del producto que **no juzga: propone.**

📄 **Ficha propia y completa:** `docs/marco-limpio/Ficha-Concepto-Sandbox.md`.

**Lo que lo hace defendible, y es lo que nadie más puede copiar.** Cualquiera simula rutas
con los tiempos teóricos de un mapa genérico. **Solo J-Telemetry puede simular con los
tiempos que de verdad se hicieron en esos corredores, a esa hora, medidos durante meses.**

**La consecuencia que cambia una prioridad de este archivo.** El **Archivador deja de ser
deuda técnica y se vuelve el combustible del producto v2.** Refuerza la decisión ya tomada
de guardar la telemetría **cruda y completa**, no recortada a lo que el árbitro necesita —
y le pone precio a [la retención de Neon](#retención-de-neon), que es donde esa tensión se
decide de verdad.

**La trampa que la ficha nombra (§7).** Si el Sandbox optimiza con los tiempos del carrier
actual y luego **el contrato se aprieta contra esa propuesta**, el desempeño del auditado
se vuelve el estándar contra el que se le juzga. Es [la trampa de calibración](#la-trampa)
con otra ropa. **El estándar es el deadline del contrato; los tiempos históricos son
insumo de factibilidad, nunca la vara.**

**El insumo nuevo que introduce.** **Puntos de origen del personal — coordenadas agregadas
y conteos, no identidad de pasajeros.** Es dato distinto y **mucho menos invasivo** que el
expediente de pasajero parqueado en [Modo pasajero](#modo-pasajero).

**Por qué se aplazó.** Es v2 y depende de tres cosas que todavía no están: el Archivador
con historia suficiente para tener tiempos por hora del día, `auth-rbac` para saber qué rol
puede aprobar una versión, y el versionado de ruta × turno funcionando de verdad.

**Dónde toca.** `docs/marco-limpio/Ficha-Concepto-Sandbox.md`; `route_traversal_measurements`;
`route_kml_versions`.

## La política como acuerdo vivo

**Qué es.** Que un cambio de política deje de ser una edición unilateral. **Tres piezas,
una ya hecha:**

- ✅ **Historia de la política** — entregada en el **#125, en producción**. Ver
  [Historia de cambios de configuración](#historia-de-cambios-de-configuración).
- **Referencia de cláusula por regla** — **no existe ningún campo de cláusula en el
  esquema.** El Marco la pide: vive **dentro del objeto de política** y **se congela con
  cada hecho**.
- **⏸ Acuerdo de las partes** — un cambio de política **no es una edición, es una
  propuesta**. Misma forma que la promoción de variantes de trazado. **Configurable desde
  J-Staff**, porque hay contratos donde la planta se reserva el derecho de modificar a su
  criterio. **Lo que nunca es opcional es que exista método de comunicación:** el carrier
  se entera siempre, aunque no apruebe.

> El acuerdo **jamás reescribe el pasado.** Entra en vigor desde una fecha.

**Por qué la cláusula pesa más de lo que parece.** **El landing ya promete que *"cada regla
puede citar su cláusula"*, y hoy el esquema no puede cumplirlo.** Es la única entrada de
este archivo que corrige una afirmación **que ya está de cara al público**, no un pendiente
interno.

**Por qué se aplazó.** Está anclada a `auth-rbac`: sin saber quién es cada quién, no hay a
quién pedirle acuerdo ni a quién avisarle. Ver
[lo que falta del candado](#lo-que-falta-del-candado-de-auth-rbac).

**Qué lo desbloquea.** `auth-rbac` cableado, y la decisión de
[qué contratos permiten que la planta modifique sin acuerdo del
carrier](#decisiones-de-producto-pendientes).

**Dónde toca.** `service_contracts.policy` — el objeto de política;
`contract_policy_history`; `compliance_facts.contract_policy_snapshot`.

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

**Precisión — 1 de agosto de 2026.** El **expediente de pasajero** —saber *quién* subió—
**requiere hardware** para registrarlo, así que se va a futuro sin fecha. Lo importante es
lo que eso **no** bloquea: **las paradas se infieren del GPS sin identificar a nadie**
(capa 5 de la identificación por capas), así que **nada de v1 espera a esto**. **`jrz-pass`
queda descartado por ahora.**

## Pre-nómina

**Qué es.** Vincular los viajes verificados con **la nómina del carrier**.

**Por qué se aplazó.** No se diseña hoy. Lo único que se hace ahora es **dejar el rol
creado**, para poder configurarlo después **sin migración**.

**Qué lo desbloquea.** `auth-rbac`, y que exista demanda real de un carrier.

## Compartir información entre plantas

**Qué es.** Una opción en la interfaz para que **dos plantas compartan información aunque
no compartan campus**.

**Por qué se aplazó.** No entra hoy. Y la forma en que entre importa más que la fecha:

> Es **configuración futura, no excepción horneada.**

Una excepción metida en el código para un caso particular rompe la regla del campus de
`Ficha-Diseno-Permisos.md` §2.2 en silencio; una opción configurable la respeta y deja
rastro de quién la activó.

**Qué lo desbloquea.** `auth-rbac` con la guardia por alcance funcionando — ver
[lo que falta del candado](#lo-que-falta-del-candado-de-auth-rbac).

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

**Medido el 2026-07-29, y es peor de lo que sabíamos.** Solo **341 de ~700
ocurrencias tienen una sola entrada de verificación**. El resto acumula varias, y
el caso extremo es una ocurrencia con **126 entradas**. Emparejar por fecha no es
frágil en teoría: falla seguido y en la mayoría de los casos.

| Entradas por ocurrencia | Ocurrencias |
|---|---:|
| 1 — empareja limpio | 341 |
| 2 a 6 | 340 |
| 7 o más | 43 |
| máximo observado | **126** |

**Esto le sube la prioridad.** Ya muerde en una cara de cliente:
[Cierre del turno](#cierre-del-turno) necesita la cobertura que produjo cada sello
y, cuando no puede atribuirla, escribe *"medición de cobertura no disponible"* con
su razón. Es honesto, pero va a aparecer seguido — y el titular de esa pantalla se
tuvo que diseñar para no depender de esa cifra justamente por esto.

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

## La contraseña del readonly es la misma que la del dueño

**Qué es.** 🟡 `jtel_readonly` y `neondb_owner` **comparten la misma contraseña**. Los
`GRANT` del rol de solo lectura **son sólidos** — el problema no está ahí. Está en que
**quien tenga la URL "segura" solo tiene que cambiar el nombre de usuario para escribir.**

**Por qué es la misma familia que el resto de esta sección.** El candado existe, está bien
puesto, y **la llave de al lado lo abre**. Es lo que le pasó a
[`CRON_SECRET`](#cron_secret-cae-a-un-secreto-publicado) —ya cerrado, rotado incluido—:
no falta el mecanismo, falta que el secreto sea secreto. Éste sigue abierto.

**La regla ya está escrita, y eso es lo bueno.** `docs/Procedimiento-Credenciales.md` §
ya dice que **el password de `jtel_readonly` debe ser distinto al del dueño**, y trae el
`ALTER ROLE`. **Lo que falta no es decidir, es ejecutar.**

**Qué lo desbloquea.** 🤝 [Rotar la contraseña del readonly en
producción](#trámites-que-solo-asav-puede-hacer) — y por la
[Ley 5](#leyes-de-producto), **redesplegando en el mismo movimiento**. Toca producción, así
que es de Asav.

**Dónde toca.** `docs/Procedimiento-Credenciales.md`; las variables de conexión en Vercel.

## La base de pruebas está atrasada

> ✅ **Cerrada el 4 de agosto de 2026.** La rama desechable quedó al día y la
> suite de integración corre **23/23** contra ella. El paso «aplicar también a
> `DATABASE_URL_TEST`» ya vive en `docs/Procedimiento-Migraciones.md`, que es lo
> que esta entrada pedía para que no volviera a pasar.
>
> **Eran tres cosas, no una.** Esta entrada solo tenía anotada la primera; las
> otras dos aparecieron comparando el catálogo real contra las migraciones del
> repo, objeto por objeto:
>
> | Faltaba | De dónde |
> |---|---|
> | tabla `contract_policy_history` + índice `cph_contract_idx` | `0015` |
> | valor de enum `evidence_status.'sin_evidencia_posible'` | `0017` |
> | índice `telemetry_points_carrier_unit_recorded_idx` | `0014` |
>
> Foto antes y después: hechos 0, ocurrencias 19, contratos 3 — **sin mover**;
> tablas 40 → 41. Cero índices inválidos. `contract_policy_history` con 0 filas,
> sin backfill, como manda la `0015`.
>
> **Lo que se aprendió, y por eso el hallazgo vale más que el arreglo:** leer la
> bitácora del migrador no sirve para saber si una base está al día — en esa
> rama está vacía porque todo se aplicó a mano, así que diría "cero migraciones"
> y no significaría nada. Se compara contra la base, no contra el papel.

**Qué es.** 🟡 A `DATABASE_URL_TEST` **le falta la migración de `contract_policy_history`**.

**Por qué es peor que una migración pendiente cualquiera.** Es
[la ley de no probar contra producción](#datos-sintéticos-en-producción) mordiéndose la
cola: **la base que existe justamente para no probar contra un cliente vivo no está al
día**, así que la suite o falla o —peor— tienta a correrla contra otra base. Una red de
seguridad desactualizada empuja a saltársela.

**Qué lo desbloquea.** Nada: correr la migración pendiente sobre la base de pruebas y
dejarlo dentro del procedimiento, para que la siguiente no vuelva a quedarse atrás.

**Dónde toca.** `DATABASE_URL_TEST`; `contract_policy_history`;
`docs/Procedimiento-Migraciones.md`.

## Las migraciones del repo crean una columna que el código no conoce

**Qué es.** ✅ **CERRADA el 15 de agosto de 2026: la `0018` está aplicada en producción
y la columna ya no existe.** `ledger_entries.actor_user_id` la creaba la `0000`, el
esquema de Drizzle **no la declara** desde la `0012`, y producción la tuvo de más
durante tres semanas. La `0012` anunció su baja —«se elimina en Migración B después del
deploy»— y esa Migración B nunca se escribió; la `0018` la escribió.

**Por qué se aplazó.** No se aplazó: **fue invisible durante tres semanas.**
`esquema.yml` atrapa la columna que **falta**, no la que **sobra** — levanta una base
solo con las migraciones y comprueba que el esquema del código quepa ahí, y una columna
de más cabe perfectamente. Es
[el hueco del 2 de agosto](#el-paso-que-faltaba-en-este-procedimiento-aplicarla) por el
otro lado — sigue en verde porque una columna de más no molesta, hasta el día que sí.

**Medido el 2026-08-04 con `jtel_readonly`**, nunca con el dueño: `ledger_entries` tiene
**167 372 filas y 0 con `actor_user_id`**. La columna estaba vacía; quien firma es
`actor_kind` (64 661 filas). Ninguna línea de `packages/` ni de `apps/` la nombraba.

**Qué la cerró.** 🤝 Asav aplicó la `0018` a producción. **Comprobado el 15 de agosto de
2026 en solo lectura con `DATABASE_URL_READONLY`:** `ledger_entries` tiene hoy nueve
columnas —`id`, `trip_id`, `service_occurrence_id`, `action`, `steps`, `metadata`,
`created_at`, `actor_kind`, `actor_id`— y **`actor_user_id` no está entre ellas**.

⚠ **Y el límite de esa comprobación, dicho antes que el resultado** —es el mismo que
declara la valla de `verificar-migraciones-aplicadas.ts`—: **se comprobó el EFECTO, no
la ejecución.** Sabemos que la columna no está; **no sabemos por qué camino ni cuándo se
fue**, y esta entrada no lo afirma. Para «¿esta base tiene lo que el código necesita?»
ésa es la respuesta correcta; para «¿quién y cuándo?» no sirve, y no pretende.

**Dónde tocaba.** `packages/db/drizzle/0018_ledger_actor_user_id.sql`;
`docs/Procedimiento-Migraciones.md`. **Hoy la vigila la valla**
(`packages/db/src/verificar-migraciones-aplicadas.ts`, #315), que es lo que impide que
esta clase de hueco vuelva a ser invisible tres semanas — ⚠ **con su propio límite: no
corre en CI**, porque necesita credenciales de las dos bases. Se corre a mano antes de
desplegar.

## La `0027`, la `0028` y la `0029` no están en el journal del repo

**Qué es.** 🟢 Las tres migraciones del Tramo JB —`0027_asignacion_vigencia`,
`0028_publicacion_circuito` y `0029_velocidad_circuito`— tienen su `.sql`, están
declaradas en el esquema de Drizzle y **están aplicadas en producción**, pero
`packages/db/drizzle/meta/_journal.json` **se detiene en la `0026`**. Le faltan las
tres entradas que pide el paso 2 de `docs/Procedimiento-Migraciones.md`.

**Medido el 2026-08-27** contra `origin/main` (d02b729) y contra producción con
`DATABASE_URL_READONLY`: el journal tiene 27 entradas (`idx` 0 a 26); los objetos de
las tres migraciones —`circuit_unit_assignments.motivo`, `circuits.published_at` con
su índice parcial, `circuits.avg_speed_kmh` y `circuits.color_hex`— sí existen en la
base. **La base está bien; el índice del repo es el que miente.**

**Por qué se aplazó.** No se aplazó: **nadie lo vio, y no hay nada que lo vea.**
Es literalmente la falla de la `0017` que el propio procedimiento ya documenta —«se
descubrió que la `0017` nunca se anotó, y nada falló por eso»— repetida tres veces
seguidas.

Y la razón por la que se repite está escrita en el mismo documento: **el migrador no
usa este archivo.** Tampoco lo usa nadie más — se comprobó recorriendo `packages/`,
`apps/`, `.github/` y `scripts/`, y **cero líneas lo leen**. `esquema.yml` aplica los
`.sql` por orden de nombre de archivo (`packages/db/ci/aplicar-migraciones.mjs`), no
por el journal. Un archivo que ninguna máquina lee sólo lo mantiene la disciplina de
quien escribe la migración, y la disciplina falla en silencio: **no hay verde que se
ponga rojo cuando esto pasa.**

**Por qué importa aunque no rompa nada.** Es el índice legible del directorio y la
única lista ordenada de qué migraciones existen. Mientras esté atrasado, cualquiera
que lo consulte para saber en qué número va —al escribir la siguiente, o al comparar
la base de pruebas contra el repo, que es como se descubrieron los tres faltantes del
4 de agosto— lee `0026` y se equivoca de número. Es la misma clase de daño que la
columna que sobra: dos verdades distintas conviviendo sin que nada lo diga.

**Dónde tocaba.** `packages/db/drizzle/meta/_journal.json` — tres entradas con `idx`
27, 28 y 29 y el mismo `tag` que el nombre de cada archivo. **Se puso al día junto con
la `0030`**, que es como se puso al día la `0017` (con la `0018`), para no gastar un PR
en tres líneas de JSON que nadie ejecuta.

✅ **Cerrada el 27 de agosto de 2026.** El journal quedó con **31 entradas para 31
archivos `.sql`**, sin faltantes — comprobado comparando el directorio contra las
entradas, no leyéndolas.

⚠ **Lo que esto NO cierra, y sigue abierto:** ponerlas al día arregló estas tres y
**dejó viva la causa**. Mientras nada lea el archivo, la cuarta vez llegará igual — y
que esta vez se haya puesto al día no es una valla, es que alguien se acordó. La valla
verdadera —un paso que compare los `.sql` del directorio contra las entradas del
journal y falle si difieren— cabe en `esquema.yml`, que ya recorre ese directorio, y
**no está escrita**. La comprobación que se corrió a mano el 27 de agosto es
exactamente la que ese paso automatizaría, y cabe en cinco líneas.

## `demos/activate` cruza cuentas

**Qué es.** 🟡 La ruta **recorre todos los clientes y activa todos sus contratos**,
cruzando cuentas. Busca una plantilla y **no la usa**.

**Por qué se aplazó, y qué falta exactamente.** **Ya está protegida**, así que el riesgo de
acceso está cerrado. Lo que queda abierto **no es seguridad, es producto: qué debe hacer**.
Una ruta que toca todas las cuentas a la vez contradice la pared entre cuentas del Marco
aunque solo la invoque J-Staff, así que no basta con dejarla como está y protegida.

**Qué lo desbloquea.** Una [decisión de producto](#decisiones-de-producto-pendientes) sobre
su alcance: si debe operar sobre una sola cuenta, si debe usar la plantilla que ya busca, o
si debe desaparecer.

**Dónde toca.** `apps/web/src/app/api/demos/activate`.

## No hay configuración de ESLint

**Qué es.** 🟢 **No existe configuración de ESLint en ningún árbol** del monorepo.

**Por qué importa.** La **única red automática que hay hoy es el chequeo de tipos de Next**.
Y esa red ya está rota por otro lado: los [dos archivos de prueba
huérfanos](#appsweb-no-tiene-corredor-de-pruebas) son errores permanentes de
`tsc --noEmit`, que **entrenan a ignorar la salida del compilador**. Sin linter y con el
compilador ruidoso, no queda ninguna comprobación automática en la que confiar.

**Qué lo desbloquea.** Decisión de prioridad. Emparenta con el corredor de pruebas de
`apps/web`: conviene un solo rato para dejar las dos redes puestas, y encadenarlas a CI
junto con [el verificador de variables](#defaults-que-fallan-abiertos).

## "Consolidación" significa dos cosas

**Qué es.** 🟢 La palabra se usa con **dos sentidos distintos, y los dos salen en
pantalla**:

| Sentido | Qué quiere decir | Dónde se ve |
|---|---|---|
| **Política** | *"una unidad cubre varias rutas"* | configuración del contrato |
| **Sello** | *"el sistema cuadró solo"* | historia del sello, expedientes |

**Por qué se anota.** Es vocabulario de cara al usuario, y un término que significa dos
cosas en la misma aplicación produce exactamente la clase de lectura equivocada contra la
que existe el `Diccionario-J-Telemetry.md`.

**Cuál se renombra.** **La de política**, que es la de **menor exposición** — la del sello
ya está en más superficies y en la cabeza de quien opera.

**Dónde toca.** `apps/web/src/app/cliente/contrato/[contractId]/page.tsx` y
`apps/web/src/app/api/cliente/contratos/route.ts` (sentido de política);
`apps/web/src/components/historia-del-sello.tsx` y `apps/web/src/lib/historia-sello.ts`
(sentido de sello); `docs/Diccionario-J-Telemetry.md`, donde el término **todavía no está
definido**.

## Los documentos llegan con la codificación rota

**Qué es.** 🟢 **Cuatro fichas seguidas** llegaron con los acentos rotos — UTF-8 leído como
Latin-1, el clásico `Ã³` en vez de `ó`. Se repara cada vez, a mano.

**Por qué se anota en vez de seguir reparando.** Porque **se repite**, y porque un
documento con la codificación rota es el único defecto de este archivo que **se propaga a
todo lo que se escriba a partir de él**. Cuatro veces seguidas deja de ser accidente y
pasa a ser el proceso de traspaso.

**Qué lo desbloquea.** Revisar **cómo se están pasando** los documentos —qué herramienta
los escribe y con qué codificación los guarda— en vez de arreglar el resultado.

## Documentación por marcar como superseded

**Qué es.** Dos documentos que ya fueron reemplazados y **siguen sin marcarse**:
`Sistema-Diseno-Superficies-Internas.md` y `Brief-Identidad-J-Tel.md`.

**Por qué ya se puede hacer.** Estaba esperando al rescate al skill, **que ya está mergeado
(#130)**. Así que **este ya puede entrar**: el bloqueo desapareció.

**⚠ La trampa, y es la razón de que la entrada exista.** El **Brief contiene la única
definición escrita de los subdominios**, y **esa sigue vigente**. Su encabezado ya lo
señala, pero dejar información viva dentro de un documento marcado como superseded es
pedirle a quien lo lea que distinga cuál párrafo sigue valiendo. **Antes de marcarlo, esa
sección se mueve a un documento vigente** — el candidato natural es
`docs/marco-limpio/Ficha-Cara-De-Producto.md` §4, que ya la cita.

**Dónde toca.** `docs/Sistema-Diseno-Superficies-Internas.md`;
`docs/Brief-Identidad-J-Tel.md`; `docs/marco-limpio/Ficha-Cara-De-Producto.md`.

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

---

# 5 · Trámites y decisiones abiertas

**Esto no es backlog de construcción.** Son los bloqueos que **no se resuelven escribiendo
código**: trámites que solo Asav puede hacer, y decisiones de producto que faltan por
tomar.

Viven aquí porque varias entradas de las secciones anteriores esperan a uno de estos
renglones, y **un bloqueo sin dueño escrito es un bloqueo que nadie recuerda que le toca**.

## Trámites que solo Asav puede hacer

| Qué | Qué desbloquea |
|---|---|
| **Crear cuenta en Clerk** y sus dos llaves | Todo el Paso 2 de [auth-rbac](#lo-que-falta-del-candado-de-auth-rbac) |
| **Comprar `j-tel.io`** | [Los subdominios](#el-resto-de-la-cara-del-producto) |
| **Resend** — verificar dominio, API key y tres variables | Que las alertas **de verdad lleguen** a alguien |
| **Rotar la contraseña del readonly** | [El readonly que puede escribir](#la-contraseña-del-readonly-es-la-misma-que-la-del-dueño) |

**Y una que no es trámite, pero solo Asav la puede dar:** las
[tres respuestas de dirección visual](#dirección-visual-del-producto), que hoy bloquean el
frente de producto entero.

> ⚠ **Las dos rotaciones cargan la [Ley 5](#leyes-de-producto):** nunca rotar credenciales
> sin **redesplegar en el mismo movimiento**. Se aprendió a lo caro el 27–28 de julio —
> trece horas de crones sin acceso y nadie enterado.

## Decisiones de producto pendientes

| # | Decisión | Cuándo |
|---|---|---|
| 1 | [**Dirección visual**](#dirección-visual-del-producto) — qué significa *"tipo plataforma"* | **Ahora** |
| 2 | Regla de cierre del pendiente por evidencia — con la planta y con legal | Hoy corre en modo demo |
| 3 | Qué debe hacer [`demos/activate`](#demosactivate-cruza-cuentas) | Cuando toque |
| 4 | ¿`jornada-instrumento` quedó superseded por [Cierre del turno](#cierre-del-turno)? | Ola 3 |
| 5 | Cómo se le cuenta a Tecma que **su número cambia** al re-verificar | **Antes de** [las 300 congeladas](#las-300-congeladas--la-foto-de-referencia) |
| 6 | Qué contratos permiten que la planta modifique la política **sin acuerdo del carrier** | Con [auth-rbac](#la-política-como-acuerdo-vivo) |

## El orden recomendado

> ⛔ **Se movió.** El orden vive ahora en [`docs/PLAN.md`](PLAN.md) §4, en
> tramos con su compuerta, y es el único lugar donde vive.
>
> Lo que decía aquí —el corte del 1 de agosto de 2026— quedó viejo el 3 de
> agosto: el candado subió a Tramo 1 con evidencia nueva (la portada pública
> nombra a los clientes), `CRON_SECRET` ya se rotó, y el dominio se resolvió.
> Mantener dos órdenes es exactamente lo que este movimiento vino a terminar.
>
> La foto de cómo se veía este orden el 3 de agosto está en
> [`docs/corte-2026-08-03/DESPUES.md`](corte-2026-08-03/DESPUES.md).

---

# 6 · Juárez Bus público — frente concesionado

Lo aplazado del frente del transporte público concesionado. **No es transporte
especial**: no confundir con `Vision-Modo-Pasajero-jid.md`, que es el modo pasajero
de Tecma y las plantas. El orden de este frente vive en [`PLAN.md`](PLAN.md) §4,
en el «Tramo JB».

## El mapa de las paradas reales de Juárez

**Qué es.** Si el sistema mide **dónde se detiene realmente cada unidad** sobre el
trazado —no dónde debería—, en unos meses existe el mapa de las paradas reales de la
ciudad: dónde la gente sube y baja de verdad, con qué frecuencia y a qué horas. Ese
dato no lo tiene nadie, **ni la Dirección de Transporte**.

**Por qué se aplazó.** Porque el sprint de 15 días tiene que sacar unidades a la
calle con app de pasajero, y esto no es necesario para eso. Se anota ahora, y no
después, porque la corrección del día 1 —la app se calcula sobre el trazado, no sobre
paradas, ya que en Juárez el camión se detiene donde el pasajero lo pide— es
exactamente lo que lo vuelve posible: la misma proyección punto-a-segmento que calcula
la llegada sabe también dónde una unidad se quedó quieta. Sale **solo**, del flujo que
ya alimenta la app, sin pedirle nada al pasajero ni instalar nada nuevo.

**Qué lo desbloquea.** Que el Tramo JB cierre con la geometría capaz de producirlo:
posición proyectada sobre el trazado, que ya es la misma que calcula la llegada. Nada
más se necesita del lado del dato. La decisión de construirlo se toma en la frontera
post-sprint.

**Dónde toca.** El recolector a 30–60 s y la tabla de posición actual del Tramo JB;
la geometría punto-a-segmento contra el trazado del circuito. Es además el insumo
natural de las otras dos salidas que el mismo motor ya contempla: el reporte
operativo al concesionario y el **reporte agregado a la autoridad de transporte**,
que es cliente natural a futuro. Y la base para decidir dónde poner letreros que sí
correspondan a la realidad, en vez de heredar los que nadie usa.

## Los 30 s del recolector son un límite de la plataforma

**Qué es.** La cadencia de 30 segundos del recolector —dos sondeos dentro de una
misma invocación del cron— **no es una decisión de producto: es la forma de darle
la vuelta a un límite de la plataforma.** Los crones de Vercel tienen granularidad
de un minuto, y a 60 s la antigüedad p90 queda en 3.0 min, exactamente el umbral de
dato viejo: la app estaría cayendo a frecuencia declarada todo el tiempo. Con dos
sondeos por invocación baja a ~2.5 min y quedan 30 s de margen.

**Por qué se aplazó.** Porque hoy funciona y el sprint tiene que salir. Pero
conviene que quede escrito que es un rodeo, no un diseño: quien lea el recolector
dentro de seis meses tiene que saber que los dos sondeos existen por el cron, no
porque alguien creyera que sondear dos veces es mejor que una.

**Qué lo desbloquea.** El fierro propio. Con equipos que empujan su posición en vez
de que nosotros la vayamos a buscar, **el dato llega solo** y todo esto se vuelve
innecesario: se borran los sondeos, se borra la espera de 30 s dentro de la
invocación, y la frescura deja de depender de con qué frecuencia preguntamos.
Mientras se sondee a un proveedor, la cadencia es un rodeo por definición.

**Dónde toca.** `packages/services/src/collector.ts` (los sondeos por ventana),
`apps/web/vercel.json` (el cron `* * * * *`) y `carrier_profiles.gps_poll_seconds`,
que es lo único que sobreviviría: si un carrier trae fierro propio, su cadencia deja
de importar y esa columna simplemente no se usa para él.

## La pantalla de alta se organizó por tablas, no por tarea

**Qué es.** `/jstaff/circuitos` —el alta del frente concesionado— necesita rediseño
**guiado por tarea, no por tabla**. Hoy cada bloque corresponde a una tabla del
modelo, y quien la usa tiene que reconstruir el proceso en su cabeza.

Los cuatro problemas concretos, levantados por Asav el 26 de agosto de 2026 usando
la pantalla de verdad:

1. El bloque «Concesiones» **mezcla tres cosas**: la lista, el formulario de crear, y
   la liga con el transportista.
2. **La liga concesión–transportista es el paso que abre todo lo demás** —sin ella no
   hay ni una unidad asignable— y aparece como un renglón chiquito, sin decir para
   qué sirve.
3. El formulario de crear circuito **sale debajo de un circuito existente**, así que
   no se lee como «crear otro».
4. **No hay orden de pasos, aunque el proceso sí tiene orden:** concesión → ligar
   transportista → circuito → trazado → unidades.

El síntoma que lo prueba: quien diseñó el modelo entró a la pantalla del circuito y
leyó «ningún transportista ligado a esta concesión tiene unidades activas» sin saber
dónde se arreglaba. **Si el autor del modelo se pierde, la pantalla no está
explicando el modelo: lo está exponiendo.**

**Por qué se aplazó.** Es pantalla interna de J-Staff y el sprint del Tramo JB manda.
Rediseñarla ahora cambiaría horas de sprint por comodidad de un usuario experto que
ya sabe el camino, mientras la app del pasajero —que es la compuerta del tramo— sigue
sin existir. La decisión es de Asav, del mismo día, y es explícita.

**Qué lo desbloquea.** Las fichas de pantalla del esqueleto de navegación. **Entra
como candidata alta entre las primeras**, no al final de la cola: es alta de datos, y
un alta que se malentiende produce datos mal ligados que después hay que deshacer.

**Dónde toca.** `apps/web/src/app/jstaff/circuitos/page.tsx` (la lista, el alta de
concesión, la liga con el transportista y el alta de circuito, hoy en dos `Card`) y
`apps/web/src/app/jstaff/circuitos/[id]/page.tsx` (trazado, paradas, unidades). Las
tablas debajo están bien y **no son el problema** —`accounts` de tipo `concesion`,
`concession_carriers`, `circuits`, `circuit_paths`, `circuit_stops`,
`circuit_unit_assignments`, cada una con su vigencia—: lo que falta es que la
pantalla cuente el proceso que esas tablas ya modelan. Nada del rediseño pide
migración.

## El pasajero como usuario

**Qué es.** El pasajero deja de ser anónimo si quiere: perfil con viajes
guardados, favoritos, alertas propias —«avísame cuando el camión esté a cinco
minutos de mi parada»— y, más adelante, pago. **Opcional siempre:** la app sin
cuenta tiene que seguir sirviendo completa.

**Por qué se aplazó.** Porque nadie crea una cuenta para saber cuándo pasa el
camión. Pedir registro antes de haber dado algo de valor es la forma más rápida
de que la app no se use. La cuenta se agrega **encima** de una app que ya tiene
uso, no debajo de una que todavía no lo tiene.

**Qué lo desbloquea.** Uso real medido: gente escaneando QRs y volviendo. Antes
de eso no hay a quién ofrecerle una cuenta.

**Dónde toca.** Y qué del diseño de hoy la mantiene abierta: el endpoint público
es **de solo lectura y sin estado**, así que una capa autenticada se pone al lado
sin tocarlo. La regla de que **la posición del pasajero se calcula en su teléfono
y el servidor jamás la recibe** tampoco estorba: unos viajes guardados son
origen y destino que él eligió, no un rastro suyo. Y el `qr_slug` de la parada,
que vive en la identidad y no en la versión, ya es una liga estable a la que
colgar una alerta. Nada de esto hay que deshacer para agregar cuentas.

## Sensores más allá del GPS

**Qué es.** Contadores de pasajeros e ingresos por unidad, alimentando la suite
del concesionario: cuánta gente sube, dónde, a qué hora, y cuánto entró.

**Por qué se aplazó.** El sprint saca unidades a la calle con app de pasajero, y
para eso el GPS basta. Un contador es fierro que hay que comprar, instalar y
calibrar por unidad, y eso es camino de meses, no de quince días.

**Qué lo desbloquea.** Que exista la suite del concesionario con algo que
mostrar, y unidades donde valga la pena instalarlo. Probablemente llega junto
con el fierro propio que sustituye a Umbrella.

**Dónde toca.** Y qué lo mantiene abierto: `devices` es un **aparato**, no un
GPS — la identidad de la unidad ya está separada de la del aparato que la
reporta, así que un contador es otro aparato de la misma unidad y no hay que
inventar un modelo nuevo. Y la proyección sobre el trazado
(`proyectarSobreTrazado`) convierte un conteo con hora en **una subida o bajada
en un punto del recorrido**, que es el dato que de verdad vale. Esa función ya
existe y ya se usa para la llegada.

## La velocidad sin calibrar viaja al teléfono con el interruptor apagado

**Qué es.** `velocidad_declarada_kmh` se manda siempre en la forma del circuito
—`apps/publico/src/app/c/[slug]/page.tsx` y el endpoint de forma— esté el
interruptor del rango prendido o apagado. El interruptor vive en el **otro**
endpoint, el de unidades, como `rango_activo`. La forma no lo conoce. La valla
más dura sería no mandar el número: sin velocidad, ningún camino de código puede
fabricar un minuto, ni por descuido ni a propósito.

**Por qué se aplazó — decisión de Asav, 2 de septiembre de 2026.** Los dos
endpoints tienen vidas de caché distintas: la forma vive **300 s** en el CDN y
las unidades **15 s**. Condicionar la forma al interruptor pone las dos mitades
del mismo interruptor a viajar por caminos que se pueden desincronizar hasta
cinco minutos — prender el rango llegaría por unidades en quince segundos y la
velocidad tardaría hasta cinco minutos en llegar, y la app tendría permiso sin
número. **Es la misma divergencia silenciosa del `CORREDOR_METROS = 150` clavado
en el componente**, que ya se pagó una vez en este mismo tramo y otra antes, con
la geocerca congelada en el hecho contra la que usaba el motor para juzgar. No
se paga dos veces por la misma lección.

Lo que se hizo en su lugar es la valla de tipos —`PermisoDeRango`, ver
[`Ficha-Escalera-Estados-Publico.md`](Ficha-Escalera-Estados-Publico.md)—, que
cierra las cuatro fugas conocidas y hace que las nuevas no compilen. Lo que la
valla **no** da es lo que daría no mandar el número: hoy la velocidad sigue en el
teléfono, al alcance de cualquiera que decida dividir a mano en vez de llamar a
`rangoDeLlegada`.

**Qué lo desbloquea.** Que los dos cachés se igualen, y entonces vuelve a ser
buena idea. Dos caminos, cualquiera sirve: que la forma y las unidades compartan
TTL, o que el interruptor viaje por un solo endpoint. El segundo es el que
además borra la pregunta, porque deja de haber dos mitades.

**Dónde toca.** `apps/publico/src/app/api/circuitos/[slug]/route.ts` (el TTL de
300 s y el campo), `apps/publico/src/app/c/[slug]/page.tsx` (la forma servida en
el primer render), `apps/publico/src/components/vista-pasajero.tsx` (que tendría
que saber esperar un permiso sin velocidad) y
`packages/domain/src/llegada.ts` (`permisoDeRango`, que ya es el único lugar por
donde pasaría).

## El buscador no entiende calle y número

**Qué es.** El buscador de «¿a dónde vas?» empareja lo que el pasajero escribe
contra **los nombres de las paradas y de las rutas publicadas**, que es lo que el
sistema conoce. No entiende «Av. Tecnológico 1500» ni «Hospital General», y para
cualquier otro lugar hay que picarlo en el mapa. Entenderlos pide un
geocodificador, y todos viven fuera.

**Por qué se aplazó — decisión de Asav, 2 de septiembre de 2026.** No por costo:
por el dato. Mandar a un tercero lo que el pasajero escribió sería mandarle **su
destino**, y el destino dice de una persona más que su ubicación actual — su
casa, su trabajo, un hospital. La ley de esta app es que nada suyo sale del
teléfono, y un buscador de direcciones la rompería por el dato más íntimo y por
una puerta lateral: la pantalla se vería igual y nadie notaría el viaje de
salida.

**Es la misma forma que la fuga del interruptor del rango.** Ahí la condición
estaba escrita en el titular y faltaba en otros cuatro lugares que también
afirmaban un tiempo; aquí la regla está escrita en la vista de la ruta —«tu
ubicación se usa solo en este teléfono»— y una pantalla nueva podría dejar de
cumplirla sin contradecir ninguna línea existente. Por eso la puerta se cierra
por construcción y no por disciplina: **no hay ninguna petición de red en el
camino de la búsqueda**, así que no hay una que revisar.

**Lo que cuesta hoy, dicho en voz alta.** El límite se declara en la pantalla
—«todavía no entendemos calle y número»— en vez de dejar que el pasajero crea que
escribió mal. Con Oasis–Centro y sus paradas capturadas alcanza; con una ciudad
cubierta, escribir el nombre de un negocio va a ser lo natural y esto se va a
sentir corto.

**Lo que esto NO cierra, y conviene que esté escrito.** La búsqueda no hace
ninguna petición —medido: 21 peticiones en una búsqueda completa, todas al propio
origen salvo los mosaicos, y **cero** con coordenadas o con lo escrito en la
URL—. Pero **los mosaicos del mapa se piden a `tile.openstreetmap.org` por
`z/x/y`**, y cuando hay respuesta el mapa se encuadra al viaje: las teselas que
se piden a partir de ahí describen por dónde va ese viaje, con la precisión de
un mosaico —cientos de metros—. No sale ninguna coordenada del pasajero, y aun
así un tercero ve el rumbo general. Es la misma clase de puerta lateral que esta
entrada existe para cerrar, un escalón más abajo, y lo cerraría servir los
mosaicos desde nuestro propio origen. Se anota sin arreglarlo: la vista de la
ruta ya tenía la misma propiedad desde que existe.

**Qué lo desbloquea.** Que emparejar direcciones se pueda hacer sin que el
destino salga del teléfono. Dos caminos, y cualquiera sirve: un índice de lugares
de la ciudad **servido como la forma del circuito** —baja una vez, se empareja
aquí— o un geocodificador propio dentro de nuestra infraestructura, que deja de
ser un tercero pero sigue viendo el destino y por eso es el peor de los dos.

**Dónde toca.** `apps/publico/src/lib/buscar-lugar.ts` (el emparejamiento, que ya
es el único lugar por donde pasaría), `apps/publico/src/components/buscador.tsx`
(el campo y sus sugerencias) y `apps/publico/src/app/buscar/page.tsx` (que hoy
sirve las paradas de los circuitos publicados y serviría también el índice).

## ¿Sigue siendo exacta «no se envía a ningún servidor»?

**Qué es. Es una pregunta, no una tarea, y se anota como pregunta a propósito.**
La app le dice al pasajero, en dos pantallas, que su ubicación *«se usa solo en
este teléfono. No se envía a ningún servidor»*. La frase describe lo que
**nosotros** hacemos, y por ese lado es cierta y está medida: no hay ninguna
petición que la mande, ni en la vista de la ruta ni en el buscador.

La pregunta es si eso basta para lo que el lector entiende. Los mosaicos del mapa
se piden a `tile.openstreetmap.org` por `z/x/y`, y el mapa se encuadra a lo que el
pasajero está mirando — su ruta, o su viaje. Ninguna coordenada suya viaja, y aun
así un tercero puede inferir la zona con precisión de un mosaico. **Quien lee «no
se envía a ningún servidor» probablemente entiende «nadie afuera puede saber por
dónde ando», y eso es un poco más de lo que la frase sostiene.**

**Por qué es exactamente esta clase de problema.** Es la §D del Marco aplicada a
nuestra propia redacción: el dato es correcto —no mandamos la ubicación— y lo que
puede volverse falso es la afirmación completa que el lector recibe. Igual que un
conteo correcto bajo un rótulo mal elegido. Y conviene notar de qué lado cae: aquí
la promesa es NUESTRA y el que la lee es el pasajero, así que el costo de que sea
demasiado amplia lo paga él.

**Las tres salidas, y ninguna está escogida.** Servir los mosaicos desde nuestro
propio origen, y entonces la frase queda exacta sin tocarla. Precisar la frase
—decir qué es lo que no se envía— a costa de que se lea más técnica, en una
pantalla que se usa parado en la calle. O dejarla como está y escribir por qué se
consideró suficiente, que también es una respuesta siempre que quede el
razonamiento y no el silencio.

**Por qué se aplaza — decisión de Asav, 3 de septiembre de 2026.** El límite es
conocido y está medido; no se arregla antes del 10. Lo que no se aplaza es la
pregunta: se contesta después del 10, y se contesta a propósito en vez de que la
frase siga puesta por inercia.

**Qué lo desbloquea.** Nada técnico. Es una decisión de producto sobre qué
prometemos, y la toma Asav.

**Dónde toca.** `apps/publico/src/components/vista-pasajero.tsx` y
`apps/publico/src/components/buscador.tsx` (las dos copias de la frase, en
`.promesa`), y la capa de mosaicos de los dos mapas si la salida es servirlos
nosotros.

## Mapas de demanda

**Qué es.** Zonas y horarios de demanda real de la ciudad: dónde y cuándo la
gente necesita moverse, medido en vez de supuesto. Base para optimizar
frecuencias y rutas, y el insumo natural para la **autoridad de transporte como
cliente futuro**, que es una de las tres salidas que el Marco ya contempla.

**Por qué se aplazó.** Depende de los sensores, y los sensores dependen del
fierro. Además necesita meses de operación acumulada: un mapa de demanda de dos
semanas no es un mapa, es una anécdota.

**Qué lo desbloquea.** Los contadores instalados y varios meses corriendo. Se
apoya también en [el mapa de las paradas reales](#el-mapa-de-las-paradas-reales-de-juárez),
que sale antes y solo del GPS.

**Dónde toca.** Y qué lo mantiene abierto: el ledger de la concesión acumula
foja por foja desde el día uno —circuitos, carriers operadores, unidades por día
y reportes de comportamiento—, así que **la historia se está guardando aunque
todavía no se lea así**. Esa acumulación es, además, lo que vuelve valioso
formalizar más adelante. Lo único que hay que cuidar en el sprint es no tirar
resolución: la posición viva se sobrescribe a propósito, pero `telemetry_points`
guarda el histórico completo y de ahí sale todo esto.

## Dos mapas de producción salen en negro: CARTO ahora exige llave

**Qué es.** `cierre-mapa.tsx` y `ruta-trazado-mapa.tsx` piden sus mosaicos a
`basemaps.cartocdn.com`, que empezó a exigir llave de API. No fallan: devuelven
**200 con un PNG de 2 KB que dice «API KEY REQUIRED» impreso**, así que el mapa
se ve negro con ese texto repetido y ningún log se queja. Medido el 26 de agosto
de 2026: CARTO 2 228 bytes contra 6 933 de un mosaico real de OSM.

**Por qué se aplazó.** Salió de rebote arreglando el mapa del editor de
circuitos, que tenía el mismo problema. Ése se arregló porque era del sprint;
estos dos son del transporte especial y tocarlos ahora sería meter mano en un
frente pausado sin haberlos mirado en pantalla.

**Qué lo desbloquea.** Nada técnico: es cambiar una URL, como se hizo en
`circuito-editor.tsx`. Solo hace falta decidir el fondo —`monitoreo-map`,
`jornada-contrast-map` y `carrier-candidate-compare-map` ya usan OSM directo y
funcionan— y confirmar en pantalla que se ven bien, porque el diseño de esas dos
asumía fondo oscuro.

**Dónde toca.** `apps/web/src/components/cierre-mapa.tsx:59` y
`apps/web/src/components/ruta-trazado-mapa.tsx:59`. **Nadie lo había reportado**,
que es el dato incómodo: son superficies que alguien debería estar mirando.
