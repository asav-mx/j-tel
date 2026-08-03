# Anexo de Estado — J-Telemetry

**Qué es esto:** una foto del estado del producto para no cargar las decisiones en la cabeza. Cuelga del Marco Maestro (no lo reemplaza). El Marco sigue siendo la fuente de verdad de las leyes; esto solo registra dónde estamos, qué se decidió y qué falta. Se actualiza cuando cambie algo grande.

**Fecha de este corte:** 23 de julio de 2026 (PRs #53–#65 mergeados a `main`; el generador de ocurrencias — los tres tramos del reloj — cerrado y en producción; auditoría de verificación 21–23 jul completada; 0 PRs abiertos en el remoto).

---

## 1. Decisiones tomadas (candidatas a volverse ley del Marco)

Estas ya se decidieron y se están aplicando. Cuando haya calma, valorar cuáles suben a las Piezas del Marco como leyes formales.

- **Margen de evidencia después del deadline = 45 min** (contrato Campus Santos Dumont). Sube la ventana en la que el réferi *busca* la llegada, sin aflojar el veredicto. Una unidad que llega tarde sigue siendo `no_cumplido` si excede la tolerancia; lo único que cambia es que ahora la llegada tardía **se ve** en vez de quedar ciega. Perilla por contrato, no código.
  - *Ancla Marco:* "Cada contrato define su tolerancia… y qué tan estricto se mide la ruta" (Pieza 3). "Sin evidencia ≠ no se cumplió" (Pieza 1-C).

- **Jerarquía de gravedad operativa** (para enforcement, NO para el veredicto):
  1. **No servir la ruta = pecado capital.** Deja trabajadores sin llegar al trabajo. Penalización mayor, puede exceder el valor del servicio (el carrier acaba debiendo). Raro (~2–3% de los viajes).
  2. **Servir tarde = falta menor.** La gente llegó, con retraso. Penalización suave / descuento.
  - Esta jerarquía se refleja en **pago y enforcement**, nunca en el veredicto. El veredicto solo dice cumplió / no cumplió / sin evidencia.

- **Motivo del `no_cumplido` sí se muestra a cliente y planta.** La línea "Llegada tarde (+N min, unidad X)" vs. "Sin servicio detectado" se lee del hecho congelado, nunca se recalcula. Es justicia informativa: un rojo pelón castiga de más; el motivo dice la verdad completa.
  - *Ancla Marco:* "Todos leen este mismo hecho" (Pieza 1-A, Hecho de cumplimiento).

- **Razonamiento interno del carrier jamás sale de J-Staff.** Candidatas evaluadas, geocercas de otros contratos, sugerencias de calibración, y las cubetas de la autopsia: todo eso es interno. El cliente/planta nunca lo ve.
  - *Ancla Marco:* "El cliente jamás ve la operación interna del carrier" (Pieza 4, leyes).

- **Empalme y variante son inferencias, no hechos probados.** El conteo agregado en J-Staff sí (sirve para diagnóstico y para negociar con el cliente). La etiqueta individual pegada a un servicio, solo con confirmación humana — nunca por sospecha automática, para no romper la confianza del veredicto.

- **La autopsia es herramienta de diagnóstico interna (J-Staff), no producto de cara al cliente.** Se corre cuando hay un pico raro de rojos, se lee el diagnóstico, se ajusta la perilla correcta, y se guarda. No es un tablero de uso diario.

- **Todas las tolerancias y umbrales son configurables por contrato, nunca hardcodeados.** La UI guarda el acuerdo; no lo decide. Quien configura es quien paga (la planta), nunca el auditado (el carrier). Los cambios de política aplican solo hacia adelante; jamás reescriben hechos congelados.
  - *Ancla Marco:* "La verdad se calcula una vez y se guarda" (Pieza 1-C).


- **El motivo se muestra a PLANTA y CARRIER, no al cliente corporativo.** (Decidido 20 jul, tarde.) El cliente ve el agregado de todas sus plantas; el detalle por servicio lo ahogaría en ruido. La operación del servicio corresponde a planta y carrier. ✅ Construido (PR #47).

- **El margen de evidencia NO se extiende más allá de 60/45 por privacidad del chofer.** Si faltan puntos al inicio del trazo, casi siempre es arranque en frío del dispositivo GPS — extender la ventana no inventa puntos. La métrica A en 60% ya tolera inicios incompletos. Además, algunas unidades duermen en casa del chofer: el réferi no tiene por qué ver eso. El trazo dibujado se recorta al corredor KML y la evidencia a la ventana; esas fronteras se quedan.

- **J-Tel son DOS productos sobre un cimiento (recordatorio de Pieza 1-C):** el árbitro de cumplimiento (construido) y la plataforma de flota del carrier (casi sin construir). En el producto de flota, el carrier SÍ ve su flota todo el día, huecos incluidos — son sus datos, su cuenta. El tope de ventana es ley del árbitro, no del dueño viéndose a sí mismo. Única frontera que aplica en ambos: jamás ver otras cuentas.


- **Un perfil de ruta = UN destino + N variantes de trazado.** El destino sigue siendo la identidad intocable; los caminos para llegar pueden ser varios. El motor evalúa contra todas las variantes `activas` y la unidad cumple si sirve por CUALQUIERA. El hecho registra cuál variante sirvió. Resuelve tráfico/accidentes/obras sin aflojar el veredicto. ✅ Construido (21 jul).
  - **Variante ≠ versión.** Variante = caminos que coexisten hoy. Versión = historia temporal de una variante. No confundir.
  - **Las variantes NO se descubren solas** — se registran a propósito: subiendo KML (ya existe) o promoviendo un trazo real ejecutado (Ficha 3, pendiente). Ambas vías son válidas y el catálogo guarda el `origen` de cada una.
  - **Quién aprueba importa:** un trazo ejecutado es evidencia de lo que pasó, no permiso de que sea válido. La promoción va acompañada de aprobación de la planta (quien paga define qué caminos valen). Si el carrier pudiera promover sus propios desvíos, se rompería la confianza del veredicto.

- **Toggle "Permitir destino alterno" ELIMINADO** (21 jul). Ningún contrato lo tenía activo (los 4 en `false`, los 484 hechos también), así que impacto cero. Basura peligrosa fuera del sistema.


- **Zona horaria configurable por contrato** (21 jul). Vive en la política del contrato, default Juárez. `JTTEL_TZ` pasa a ser default del despliegue, no fuente de verdad. Regla: si hay contrato en foco, se usa su zona; en vistas multi-contrato (J-Staff, corporativo) se usa la zona del despliegue. Los hechos congelados se muestran con la zona ACTUAL del contrato (para que una tabla se vea en un solo reloj). ✅ Construido.
  - **El bug de fondo que resolvió:** el sistema calculaba "qué día es hoy" en UTC. Entre las 18:00 y medianoche hora de Juárez, devolvía el día siguiente — los turnos vespertinos podían caer en el día equivocado en filtros y reportes.

- **El cliente jamás ve la operación interna del carrier — se aplicó en serio** (21 jul). Cuando un servicio no tiene unidad observada, la cara cliente/planta ya NO ve el GPS de flota. Ve KML + geocerca + un mensaje honesto ("el sistema no identificó una unidad sirviendo esta ruta en la ventana"). La bitácora técnica (ledger) también quedó oculta a la cara cliente — decisión aprobada. ✅ Construido.

- **Tres categorías de unidad, no una** (decisión de Asav, 21 jul). Distinción clave para la confidencialidad:
  1. **Unidad observada** — la que de verdad sirvió una ruta de ESA planta. La planta SÍ la ve, en vivo e histórico. Es la verdad operativa y parte del servicio que paga.
  2. **Catálogo declarado** — las unidades que el carrier asigna a ese contrato (placas, seguros, documentación legal). La planta SÍ lo ve, pero es *declarativo*: el carrier puede servir con unidades distintas cualquier día. Sirve para inspecciones y cumplimiento legal, no para saber quién anduvo hoy.
  3. **Inventario completo del carrier** — todas sus unidades. La planta NUNCA lo ve.
  - El vehículo del catálogo declarado YA EXISTE en el esquema (`possibleUnits` del perfil de servicio) pero está vacío. Reutilizarlo, no inventar otro.
  - *Ancla Marco:* "la unidad observada es la verdad; la de referencia es sólo plan".

---

## 2. Hallazgo clave de la sesión

**Autopsia de los 55 `no_cumplido` del Campus Santos Dumont, semana 13–17 jul (135 servicios: 80 cumplido, 55 no cumplido, 0 pendiente):**

| Cubeta | Cantidad | % |
|--------|----------|---|
| Llegada fuera de ventana (tarde real) | 36 | 65% |
| Empalme (una unidad, dos rutas) | 14 | 25% |
| Variante (mismo destino, otra calle) | 5 | 9% |
| Sin servicio detectado | 0 | 0% |
| Hueco de datos | 0 | 0% |
| Basura de GPS (brinco) | 0 | 0% |

**Lectura:** el motor mide bien. Cobertura al 100%, cero servicios fantasma, cero fallas de GPS. **El problema es 100% operativo: el carrier llega tarde y consolida rutas (empalmes).** El réferi está haciendo su trabajo — decir la verdad incómoda. No hubo que aflojar ningún umbral; se diagnosticó la causa real con datos.

**Bandera de salud confirmada:** `sinCoberturaStep0Insuficiente = 0` → ningún `no_cumplido` se coló sin pasar la precondición de cobertura. La precondición está sana.


### Hallazgo del 21 jul — los dos rojos tercos son GENUINOS

Riberas 9 y Haciendas I (21 jul, turno 1) se investigaron a fondo: **cero unidades sirvieron esas rutas**. Ni las ocupadas ni las libres se acercaron. Registrar una variante no los arreglaría — el servicio simplemente no se prestó. **El réferi tenía razón.** Buena señal: el motor no inventa falsos negativos ahí.

**Firma del empalme geográfico (patrón útil):** unidad 9375 en Haciendas dio **A=81% pero B=43%**. Traducción: tocó la mayoría de los puntos de Haciendas pero la mayor parte de su recorrido fue por otro lado — iba haciendo una ruta más larga (ganó Sierra Vista ese día) y pasó de refilón. **A alto + B bajo = empalme, no variante.** Usar este patrón para distinguirlos y como munición en la plática con Tecma.

**Recordatorio de qué miden A y B:** A = ¿pasaste por los puntos de la ruta? (cobertura). B = ¿te saliste del camino? (precisión). Se cumple solo si pasan las dos.

### Validación end-to-end del multi-variante (21 jul)

Prueba con SIERRA-VISTA-I: con una variante daba cumplido A=81%; al registrar una segunda variante extraída del trazo real, dio **cumplido A=100% B=100%**, `servedVariantId` persistido, y el ledger mostró ambas variantes evaluadas con sus scores. Desempate determinista funcionando. Regresión cero confirmada (14 servicios, 12/2, idéntico a antes de la migración).

---

## 3. Estado del trabajo en curso

- **PR #46 — Autopsia de no_cumplidos (reporte de solo lectura):** ✅ mergeado a `main` el 20 jul. Endpoint J-Staff `/api/jstaff/autopsia-no-cumplidos`. Solo lectura; no toca `saveFact`, no llama a Umbrella. Incluye TODO de seguridad anotado (ver deuda 1 abajo).
- **PR #47 — Motivo bajo el chip `no_cumplido`:** ✅ mergeado a `main` el 20 jul. La línea "Llegada tarde (+N min, unidad X)" / "Sin servicio detectado en la ventana" aparece en lista y detalle, caras de planta/campus y carrier. Cliente corporativo intacto. Reutiliza `noCumplidoDetailLine`; cero cambios al motor.
- **Tarea 3 (contexto "llegada fuera de ventana" en el ledger):** ✅ viva en el motor desde antes. Anota la llegada tardía sin cambiar el veredicto.
- **Variantes de trazado (multi-KML):** ✅ mergeado el 21 jul. Migración 0011 aplicada: 50 variantes "Principal" creadas, 50/50 versiones vinculadas. Motor evalúa multi-variante. UI mínima de catálogo en J-Staff. Toggle de destino alterno eliminado de 15 archivos.
- **Zona horaria (PR mergeado 21 jul):** timeZone en política del contrato, un solo reloj, display consistente. Regresión verificada: 54 hechos en 2 días, 0 cambios.
  - **Impacto en rebate — CERRADO (22 jul):** el corrimiento de fechas llegó al conteo que alimenta `computeMonthlyRebate`, pero el impacto monetario fue 0 porque ningún contrato tenía `rebate_escalonado` activo. Sin reportes guardados ni exportados con datos corridos. El Tramo 2 de la ficha de arreglo protege el cálculo hacia adelante si alguna vez se activa un contrato con rebate escalonado.
- **Fuga de flota en cara cliente (PR mergeado 21 jul):** cerrada en detalle de servicio y jornada. Ledger oculto a cara cliente.
- **Fuga de inventario de flota:** ✅ mergeado a `main` el 22 jul en dos PRs desde la misma rama — PR #52 el código, PR #53 los docs. La fuga real estaba en `jornada-data.ts`: `unitMap` se llenaba con TODA la flota del carrier → ahora filtrado a unidades observadas únicamente. `monitoreo-data.ts` ya filtraba la respuesta (`usedUnits`); se añadió label de unidades cerradas y se documentó la separación interna/respuesta. `service-detail-data.ts` auditado: no era fuga (Tarea D). Punto de parada NO activado — la ficha permite cargar flota completa internamente para el emparejamiento en vivo. Regresión cero: compare-verify-dry sobre 27 rutas × 2 días → 0 cambios de veredicto.
- **Guarda de integridad en `deleteBeyondHorizon` (PR #62, mergeado):** el recorte de la ventana rodante ya **nunca borra una ocurrencia que tenga hecho**, sin importar `TRIM_DAYS`. Un hecho congelado es evidencia; el mantenimiento del horizonte no puede pisarlo. La guarda protege por diseño, no por casualidad.
- **Limpieza de nombres de cliente en scripts de diagnóstico (PR #60, mergeado):** se eliminó un bloque de debug hardcodeado en `reverify-day` y se exige `CONTRACT` explícito en las herramientas de diagnóstico. Ningún script de diagnóstico asume un cliente por default.
- **Skill de UI al repo (PR #59, mergeado):** `j-telemetry-ui` — el lenguaje visual y las reglas de interfaz — vive ahora en el repo como skill. Cualquier pantalla, componente, correo o vista que un humano vea dentro de J-Telemetry pasa por él.
- **Confirmado con evidencia: ningún cambio de código de estos dos días movió un veredicto.** `compare-verify-dry` con día de control sobre las 27 rutas × varios días → 0 cambios de veredicto en todos los PRs (fuga de inventario, un-solo-reloj, generador). Los hechos congelados quedaron intactos; los fixes tocaron vistas, límites y generación, nunca el árbitro.
- **Herramienta de trabajo:** ahora con **Devin** (Claude Code), no Cursor. Reglas escritas en las fichas (Devin obedece lo escrito): una rama por tarea, todo por PR, merge a `main` solo por Asav.

---

## 3b. Nudos cerrados en la auditoría del 20 jul (para no cargarlos)

- **Seguimiento condicionado → CERRADO como innecesario.** Los datos de la autopsia lo mataron: el margen de 45 + Tarea 3 capturaron las 36 llegadas tardías completas, cero "sin rastro". No resuelve ningún problema real; construirlo sería peso muerto. Se archiva.
- **Etiqueta de defensa del carrier → CERRADO como ya-resuelto.** El flujo de etiquetado ya existe para todo rojo sin unidad (empalmes/variantes incluidos). Los tardíos quedarán identificados con unidad+hora tras la Ficha 1. Todo rojo tiene identificación o canal de defensa. Pendiente evaporado.
- **Encadenamiento del PR viejo de Cursor → VERIFICADO cerrado.** El código tiene "una sola ronda: no realimentar" en la pasada de eliminación. El fix entró.
- **Toggle "Permitir destino alterno" → MARCADO PARA ELIMINAR (basura peligrosa).** Contradice la ley "el destino es la identidad de la ruta". Permitiría que una unidad que fue a otro lado cuente como cumplida — puerta trasera que mata la confianza del veredicto. Herencia de intentos pasados. Se elimina de la política del contrato en la próxima ficha de motor. NO confundir con variantes de trazado (mismo destino, otra calle — eso sí es válido).

**Notas de obsolescencia:**
- `docs/Ficha-Handoff-Evidencia-Llegada.md` — su Tarea 4 dice "carrier y cliente"; QUEDA SUPERSEDED por la decisión del 20 jul (planta y carrier, cliente NO) y por el PR #47 ya mergeado. Ponerle nota "SUPERSEDED — ver Anexo" arriba para que Devin no siga la instrucción vieja.
- **PRs zombis → CERRADOS.** Se cerraron sin merge **nueve** PRs zombis (ramas viejas de Cursor que ya no aplicaban). **El remoto queda con 0 PRs abiertos.** Quedan ramas viejas colgadas en el remoto (sin PR asociado) — candidatas a borrar.

---

## 3c. La saga del reloj — tres tramos (CERRADA)

El bug que más frentes tocó en estos dos días. Cerrado en su totalidad con los PRs #56, #58, #61 y #65. Se documenta completo porque es el arquetipo del error que **no debe volver** — y la sección 7 fija la regla que lo evita.

**Síntoma visible:** la Torre (Monitoreo) mostraba **0 rutas** donde el Historial reportaba 14. Un turno entero desaparecía de la vista en vivo. La primera hipótesis (`pickActiveShift` devolviendo un `shiftId` que no cuadraba con las ocurrencias) **quedó descartada**: el diagnóstico #56 confirmó la causa real.

**Causa raíz (una sola, con muchas caras):** el sistema construía fechas civiles como `new Date(`${fecha}T00:00:00`)` **sin `Z`**. Sin la `Z`, el runtime interpreta ese instante en la zona **local** del proceso. En Vercel (UTC) `T00:00:00` es medianoche UTC, pero la lógica que decidía "qué día es hoy" y qué rango consultar terminaba corrida un día en las horas peligrosas (tarde/noche de Juárez), y las vistas y el generador leían/escribían el día equivocado. El mismo error, sembrado en varios lugares.

**Los tres tramos (los de la Ficha de Arreglo Un Solo Reloj — misma causa, tres capas):**
1. **Tramo 1 — La torre (PR #58).** `monitoreo-data.ts` consultaba el día en UTC; se reemplazó la construcción manual de `Date` por `dayForDateQuery`. Aquí murió el síntoma de la Torre con 0 rutas. (Diagnóstico previo: #56.)
2. **Tramo 2 — Las pantallas (PR #61, parada obligatoria).** Las vistas del ledger y filtros por día leían con el mismo `Date` sin `Z`; migradas a `dayForDateQuery`. Un solo reloj en el display: los hechos congelados se muestran con la zona actual del contrato.
3. **Tramo 3 — Generación de ocurrencias (PR #65, Opus, parada dura).** `generateForProfile` iteraba el calendario con aritmética de `Date` dependiente del runtime TZ; ahora usa `civilDatesInRange` (strings civiles puras) para las fechas de servicio y `addDaysIso` para el horizonte, y `renewRollingWindow` calcula "hoy" civil. El generador quedó sobre **un solo calendario**. (Era el tramo peligroso: podía haber creado ocurrencias con `service_date` corrido — se verificó que no quedaron datos torcidos.)

**Ventana de exposición:** durante **9 días (13–22 jul)**, la cara de Cumplimiento pudo mostrar el **día anterior** en filtros y reportes en las horas peligrosas. **Impacto monetario: $0** — ningún contrato tenía `rebate_escalonado` activo, así que ningún cálculo de rebate ni reporte exportado salió con datos corridos. El corrimiento fue de *display y de rango de consulta*, nunca de un hecho congelado (la verdad se calcula una vez y se guarda; los hechos no se recalcularon).

**Estado:** los tres tramos en producción. La deuda residual (fronteras de `generateForProfile`/`renewRollingWindow` que aún reciben/construyen `Date`) queda anotada en la sección 4-B, punto 9 — el núcleo de aritmética civil ya es puro; faltan los bordes.

---

## 4. Pendientes grandes (camino a v1), priorizados

Estos son los frentes abiertos. NO se construyen todos ahora — se vuelven fichas una por una cuando les toque. Orden sugerido:

### Columna A — Determinar bien la verdad (seguir el hilo de hoy)
1. ~~**Motivo bajo el chip rojo**~~ ✅ **HECHO (PR #47, 20 jul).** Planta y carrier ven el motivo; cliente corporativo no (decisión de Asav).
2. **Cara del carrier — etiqueta de defensa sobre `no_cumplido`:** hoy la etiqueta de calibración solo existe para dudosos sin unidad. Extenderla: que el carrier pueda etiquetar también un `no_cumplido` ("sí se hizo, fue la unidad X") — alimenta calibración/ledger, **nunca cambia el veredicto**. La línea de motivo (PR #47) ya le muestra su verdad; falta el canal de respuesta.
   - **Producto de flota del carrier (torre + gestión, todo el día):** proyecto mayor aparte — la segunda cara del Marco (Pieza 1-C). Ver flota completa incluso fuera de ventanas de servicio, lo programable del servicio. Merece su propia sesión de diseño y ficha madre. Sin fecha aún.
3. **Decisiones de contrato pendientes con Tecma** (decisión de negocio, no código): ¿el empalme cuenta como servido? ¿tolerancia de tardíos? Se capturan en las perillas del contrato. Usar el reporte agregado de la autopsia como evidencia en esa plática.

   **Motor guarda los tardíos (Ficha 1 — decidida 20 jul, por construir):** cuando un `no_cumplido` fue "tarde de verdad" (Sabor A: sirvió la ruta según la política vigente pero fuera de tiempo), el motor debe guardar `observedUnitId` + `observedArrivalAt` + `observedRouteMatchPct`. Hoy los tira porque solo los persiste si el veredicto es `cumplido` — por eso los 55 salen "sin servicio" en pantalla aunque 36 fueron tardíos. Toca `saveFact` → ficha con parada obligatoria, Opus. El %match se guarda como REGISTRO, jamás para cambiar el veredicto. Solo aplica hacia adelante; los 55 viejos requieren re-verificación J-Staff a petición de Asav.

   **Variantes de trazado — multi-KML por perfil (Ficha 2 — diseño acordado 20 jul, por construir):** un perfil de ruta = UN destino (identidad, intocable) + N trazados KML aceptados. El motor evalúa contra todos y toma el mejor match; si cualquiera pasa A∧B → `cumplido`, y el hecho registra cuál variante sirvió. Resuelve tráfico/accidentes/clima sin mentir ni aflojar el veredicto. Los sentidos (entrada/salida) caben en el mismo molde después. Cambio grande de motor → parada obligatoria, Opus, por fases. **La variante NO va a `pendiente_evidencia`** (eso es "falta GPS"; aquí sí sabes qué pasó) ni a "cumplido parcial" (no existe). Va a verde o rojo según qué defina el contrato como "servir la ruta".

   **Aprobación de variantes por la planta (Ficha 3 — diseño acordado 20 jul, por construir):** en vez de que la planta revise cada servicio desviado, aprueba el CATÁLOGO de trazados una vez. El sistema detecta el patrón ("Riveras-B llega por otra calle en N servicios"), lo propone con mapa, la planta acepta → el KML entra al catálogo del perfil → de ahí en adelante automático. Control donde debe (quien paga define qué caminos valen), trabajo de una vez, no diario. Política hacia adelante; no reverdea hechos viejos. UI, depende de la Ficha 2.
4. **Seguimiento condicionado** (congelado, esperando datos): si el margen de 45 min no captura suficientes llegadas tardías, evaluar seguir midiendo a la unidad que demostró arrancar la ruta (arranque de KML + dirección coherente), con tope duro = duración máx. de ruta. Toca el árbitro → ficha con parada obligatoria. **No construir hasta que los datos lo justifiquen.**

5. **~4% de los hechos congelados no son reproducibles por el motor actual (hallazgo auditoría 23 jul — SIN INVESTIGAR):** En el compare-verify-dry de 21, 22 y 23 jul, cada fecha muestra exactamente 1 de 27 servicios donde el motor hoy dice `no_cumplido` (`unit=— A=— B=—`) pero el hecho guardado dice `cumplido`. Hipótesis: el motor de dry-run usa el KML/geocerca ACTUAL, no el que estaba vigente cuando se generó el veredicto original. Si la geocerca o el trazado de esa ruta se actualizó después de la verificación, el motor hoy no encuentra candidatas donde antes sí las encontró — el hecho congelado y el motor divergen por diferencia de estado del catálogo, no por bug de código. **Relevante para Ficha 4 (defensa del carrier):** si el carrier impugna un `no_cumplido`, el sistema no puede reproducir fielmente la evaluación del día D con los datos del día D. **Y bloquea cualquier asistente que explique veredictos:** un copiloto que "explica por qué salió rojo" leyendo el motor de hoy daría una explicación que no corresponde al hecho sellado — mentiría sin querer. Mientras el motor no pueda reproducir el estado del catálogo del día D, ningún asistente puede narrar el porqué de un veredicto viejo. No investigado, no bloqueante para la operación de hoy. Requiere ficha aparte con aprobación explícita.

6. **Planta 47 — el motor está sano; los KMLs no corresponden al recorrido real (hallazgo, ref. `Ficha-Diagnostico-Identificacion-Unidad.md`):** la 47 identifica y resuelve unidades bien, y las unidades sí llegan a la geocerca de la planta. Lo que falla es el **match de ruta (métrica A / cobertura del KML)**: ninguna unidad cubre el KML importado por encima del umbral → todo cae en `no_cumplido` (99 servicios), y por diseño un `no_cumplido` nunca acredita unidad ("Unidad observada: —"). **No es bug de código, no es ruta borrada, no es perfil huérfano** (geocerca de 24 puntos válida, 21 perfiles con KML vigente de 67–192 waypoints). Es que **los KMLs importados el 14-jul no coinciden geométricamente con el recorrido real de los camiones**. El arreglo es de datos (re-importar/corregir trazados), no de motor. Ficha con parada; no tocar el árbitro.

### Columna B — Infraestructura para producción (deuda estructural)
Esto no bloquea el diagnóstico de hoy, pero SÍ bloquea salir a producción con clientes reales. Ya está **diseñado en la Pieza 4 del Marco**; falta construirlo.

1. **Autenticación / login — DEUDA CRÍTICA.** Hoy J-Telemetry no tiene puerta de entrada: ningún endpoint verifica quién entra; todo corre con un usuario de prueba fijo (`tecma_admin`). Existe `getJStaffMemberships()` en el código pero nadie la invoca. El endpoint de la autopsia quedó con un TODO de seguridad visible. **Aplica a TODOS los endpoints y páginas, no solo la autopsia.** Nada de esto sale a un cliente real sin login.
2. **Autorización por rol × alcance:** que cada cara vea solo lo suyo, en código. Conecta directo con las leyes de confidencialidad. El Marco ya define los roles (Pieza 4); falta implementarlos.
3. **UI de producto v1:** la interfaz actual está bien para pruebas internas, no para cliente. Acabado sobre el motor que ya funciona.
4. **Guardas del catálogo de variantes (deuda del 21 jul):** el sistema permite dejar una ruta con CERO variantes activas (pasó con Riberas 9 al probar el toggle legacy). Debe impedirlo o advertir claramente — un clic no debe poder aflojar al réferi sin avisar. Además la lista de variantes es una lista plana enorme para 27 rutas × turnos: incómoda, necesita agrupación/búsqueda.
5. **Tests corriendo dos veces (deuda de higiene, 21 jul):** el sistema de pruebas corre tanto la versión fuente como una copia compilada vieja en `dist/`. Eso mostró fallos fantasma dos veces en un día. Configurar que solo corra la versión fuente.
6. **Smart quotes rompen el build:** las comillas tipográficas (U+201C/U+201D) que a veces se cuelan al escribir código hacen fallar el build de producción con "Unexpected character". Ya pasó una vez. Quedan dos archivos con ese carácter en texto (inofensivo hoy): `monitoreo-unit.tsx` y `jornada-unit.tsx`.
7. **Historial/Monitoreo — mapa espagueti:** el mapa del historial del turno dibuja las 14+ rutas encimadas y queda ilegible. Ya tiene filtros de Unidad/Veredicto; el arreglo probable es de *defaults* (una ruta a la vez, filtro activado de inicio, u opacidad menor), no de arquitectura. Deuda de UI anotada el 20 jul para no olvidarla.
8. ~~**Discrepancia Monitoreo / Historial — 0 rutas en torre**~~ ✅ **CERRADO** por la saga del reloj (ver 3c). La causa no era `pickActiveShift`: era la fecha civil construida sin `Z` e interpretada en UTC. Los frentes de vistas (#58, #61) y de generación (#65) lo cerraron. La Torre vuelve a mostrar las rutas del turno.

9. **`renewRollingWindow` y `generateForProfile` aún intercambian objetos `Date` en las fronteras donde deberían pasar fechas civiles como string (deuda residual de la saga del reloj):** el núcleo ya es aritmética civil pura (`civilDatesInRange`, `addDaysIso`, "hoy" civil) tras #65, pero los **bordes** siguen en `Date`: `generateForProfile` recibe `fromDate: Date, toDate: Date` y clampa el rango del contrato con `new Date(`${validFrom}T00:00:00`)` **sin `Z`** ([index.ts:1899-1900](packages/db/src/repositories/index.ts#L1899-L1900)); el seed también llama pasando `Date`. Correcto en UTC (Vercel), frágil fuera. Deuda de diseño — no urgente, no tocar sin ficha. La regla de la sección 7 (funciones civiles canónicas) es lo que cierra este flanco cuando se toque.

10. **Horas de turno guardadas en UTC por parche manual, no por diseño (hallazgo 23 jul, TRAMPA LATENTE):** las horas de turno en producción quedaron en UTC por un parche manual, pero el formulario de alta dice "ej. 07:00" **sin avisar en qué zona**. El próximo turno que alguien dé de alta escribiendo "07:00" va a quedar **6 horas corrido** respecto a los existentes. Además el seed tiene las horas en hora de **Juárez** — inconsistente con producción. Hay que decidir y hacer explícita la zona del formulario (y alinear seed ↔ producción) antes de que se cree un turno nuevo. Ficha aparte.

11. **`computeExpectedDeadline` funciona por compensación, no por corrección (hallazgo 23 jul — NO TOCAR SIN FICHA):** el cálculo de deadline hoy da el resultado correcto porque **compensa** un desfase previo, no porque la aritmética esté limpia. Arreglarlo "bien" movería **todos** los deadlines de golpe — y con ellos, potencialmente, veredictos hacia adelante. Es deuda que solo se toca con ficha, parada obligatoria y medición de regresión. No es un fix de una línea.

12. **No hay base de datos local — los tests de integración pasan por omisión, no por verificación (hallazgo 23 jul):** sin BD local, la suite de integración no ejecuta contra datos reales; **pasa porque se salta**, no porque verifique. Da una señal verde falsa. Cualquier afirmación de "los tests pasan" para lógica que toca la BD no es evidencia hasta que haya una BD de integración corriendo de verdad. Relacionado con la deuda de higiene del punto 5 (tests corriendo dos veces).

13. **El detalle numérico bajo el chip rojo se perdió (hallazgo 24 jul):** `noCumplidoDetailLine` calcula minutos de retraso a partir de `observedArrivalAt` y `expectedDeadline`, pero `service-detail-data.ts` los entrega **ya formateados como texto** — no se les puede restar nada. El cálculo falla en silencio y siempre cae al label genérico ("Llegada tarde (unidad X)") en vez de "Llegada tarde (+N min, unidad X)". Introducido por `1c9181b` (PR #50, 21 jul); degrada la feature del PR #47 (20 jul). **Causa de fondo:** el cargador formatea todo a texto, así que nada río abajo puede calcular. **El valor que se muestra y el valor con el que se calcula son dos cosas distintas — el cargador debe entregar ambos.** Arreglo: que `service-detail-data.ts` exponga también los valores crudos (ISO o `Date`) para cálculo, además de los strings de despliegue. Ficha aparte.

---

## 5. Horizonte estratégico (confirmado contra el Marco)

Frentes mayores que no son fichas de "camino a v1" sino líneas de dirección del producto. Cada uno se contrastó contra el Marco antes de anotarlo.

- **Propiedad de los datos — ya es ley del Marco.** El Marco lo declara literal: *"La data procesada de la operación es de la empresa (la plataforma) y así se estipula en el contrato."* No es aspiración; es la base legal del archivo propio.
  - **Fase 1 corriendo:** el archivador ya corre **cada 10 min** llenando `telemetry_points` con `carrierAccountId`, `deviceId`, `unitId` y `source` por punto. Estamos construyendo el activo de datos propio, punto por punto.
  - **Pendiente — fase 2:** que el **verificador lea del archivo propio** (`telemetry_points`) en vez de Umbrella en vivo. Cuando eso pase, dejamos de depender de un tercero para reproducir la verdad, y la reproducibilidad del día D (ver 4-A punto 5) deja de ser un problema estructural.

- **Lenore — el copiloto en vivo. Línea de producto propia, no una feature.** Vive **arriba** de la operación (predice y avisa), mientras el árbitro vive **después** de ella (juzga con hechos sellados). Alcance: proyección de llegada tarde, no-show anticipado, sugerencia de unidad cercana para el coordinador, y alertas auditables ("te avisamos 14 veces, 11 se salvaron").
  - **Orden:** va **después de `auth-rbac`** (Columna B). Sin login ni roles, un copiloto no puede respetar fronteras.
  - **Regla dura, sin excepción:** **la alerta jamás toca el veredicto.** Lenore opera y avisa; el juez sella la verdad. Son dos planos que no se cruzan. (Ver también sección 7, regla de AI/asistentes.)
  - **Semilla para Lenore:** cuando se toque el archivador, dejar `telemetry_points` **cómoda para consultas de "últimos 15 minutos"** (índices/orden por tiempo). El copiloto vive de la ventana reciente; que la consulta salga barata desde el diseño.

- **Pasajeros identificables = datos personales (LFPDPPP).** Cualquier feature que identifique pasajeros cruza la ley de protección de datos. **Conteos anónimos primero**; identidad solo con diseño legal explícito (consentimiento, propósito, contrato). No se cuela por conveniencia de producto.

---

## 6. Cómo usar este anexo

- **Cuando termines una pieza:** táchala aquí y, si generó una ley nueva, súbela al Marco.
- **Cuando arranques una ficha para Devin:** que la ficha referencie este anexo y el Marco, no la memoria del chat.
- **Regla que no cambia:** lo que no está escrito (en el Marco o en una ficha), para Devin no existe. Este anexo es para ti; las fichas son para Devin.

## 7. Reglas de trabajo aprendidas

1. **Una rama, un PR.** Dos PRs desde la misma rama hacen imposible saber qué ya entró a `main` y cuál sigue pendiente. Si necesitas separar código de docs, hazlo en ramas distintas.
2. **Antes de mergear, revisar la pestaña "Files changed".** El título no es evidencia. Si el PR promete código y sólo trae documentos, algo se quedó fuera. No mergear hasta que los archivos cambiados sean los esperados.
3. **Un solo frente mergea a `main` a la vez.** El otro construye en su rama y espera turno. Dos frentes mergeando en paralelo hacen imposible saber qué versión de la verdad quedó.
4. **Trabajo que toca la lógica del árbitro o del catálogo pasa por validación contra el Marco antes de mergear** — aunque venga del frente de diseño. El Marco es la ley; ninguna cara de UI ni conveniencia de producto la afloja.
5. **Un test que pasa con el código roto no es una guarda.** Se prueba primero contra la versión rota: si pasa igual, no está midiendo nada. (Corolario vigente: sin BD local, la suite de integración pasa por omisión — ver 4-B punto 12.)
6. **AI / asistentes: nunca en el veredicto.** Leen hechos sellados y **explican**; no juzgan. Cada afirmación de un asistente debe poder señalar el hecho de donde salió. Respetan las mismas fronteras de confidencialidad que las pantallas (el cliente jamás ve la operación interna del carrier). Se consulta sobre datos propios; **no se entrenan modelos con ellos.**

**Regla de fechas civiles (la que evita que la saga del reloj vuelva en un sexto lugar):**

Para toda fecha civil (YYYY-MM-DD) se usan las tres funciones canónicas de `@jtel/domain`, **nunca** se construye un `Date` a mano ni se convierte de ida y vuelta:

- **`dayForDateQuery(fechaIso): Date`** — string civil → `Date` anclado a mediodía UTC, para armar consultas por día a la BD.
- **`civilDatesInRange(fromIso, toIso, activeDays): string[]`** — itera fechas civiles en un rango filtrando por día de la semana, todo en strings; nunca cruza cambio de día.
- **`addDaysIso(fechaIso, days): string`** — aritmética de días puramente UTC (`setUTCDate`), cero `setHours`, cero dependencia del runtime TZ.

Todas anclan **mediodía UTC** para que `getUTCDay()`/el string salgan del mismo calendario en cualquier zona entre UTC-12 y UTC+12. **Nunca** `new Date(`${fecha}T00:00:00`)` sin `Z`: esa es exactamente la firma del bug (se interpreta en la zona local del proceso). Esto no es nota histórica — es la regla que se aplica cada vez que se toca una fecha civil.

7. **El valor que se muestra y el valor con el que se calcula son dos cosas distintas.** Una capa de datos que formatea todo a texto rompe cualquier cálculo río abajo — nada que reciba un string puede restarle minutos a otro string. Cada dato que necesite tanto mostrarse como calcularse expone dos versiones: el string de despliegue y el valor crudo (ISO / `Date`) para cálculo. No son lo mismo; no deben serlo. (Patrón violado en PR #50 — ver Columna B punto 13.)
