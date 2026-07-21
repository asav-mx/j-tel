Anexo de Estado — J-Telemetry

Qué es esto: una foto del estado del producto para no cargar las decisiones en la cabeza. Cuelga del Marco Maestro (no lo reemplaza). El Marco sigue siendo la fuente de verdad de las leyes; esto solo registra dónde estamos, qué se decidió y qué falta. Se actualiza cuando cambie algo grande.

Fecha de este corte: 20 de julio de 2026 (actualizado por la noche: PRs #46 y #47 mergeados; auditoría de nudos).

1. Decisiones tomadas (candidatas a volverse ley del Marco)

Estas ya se decidieron y se están aplicando. Cuando haya calma, valorar cuáles suben a las Piezas del Marco como leyes formales.

Margen de evidencia después del deadline = 45 min (contrato Campus Santos Dumont). Sube la ventana en la que el réferi busca la llegada, sin aflojar el veredicto. Una unidad que llega tarde sigue siendo no_cumplido si excede la tolerancia; lo único que cambia es que ahora la llegada tardía se ve en vez de quedar ciega. Perilla por contrato, no código.
Ancla Marco: "Cada contrato define su tolerancia… y qué tan estricto se mide la ruta" (Pieza 3). "Sin evidencia ≠ no se cumplió" (Pieza 1-C).
Jerarquía de gravedad operativa (para enforcement, NO para el veredicto):
No servir la ruta = pecado capital. Deja trabajadores sin llegar al trabajo. Penalización mayor, puede exceder el valor del servicio (el carrier acaba debiendo). Raro (~2–3% de los viajes).
Servir tarde = falta menor. La gente llegó, con retraso. Penalización suave / descuento.
Esta jerarquía se refleja en pago y enforcement, nunca en el veredicto. El veredicto solo dice cumplió / no cumplió / sin evidencia.
Motivo del no_cumplido sí se muestra a cliente y planta. La línea "Llegada tarde (+N min, unidad X)" vs. "Sin servicio detectado" se lee del hecho congelado, nunca se recalcula. Es justicia informativa: un rojo pelón castiga de más; el motivo dice la verdad completa.
Ancla Marco: "Todos leen este mismo hecho" (Pieza 1-A, Hecho de cumplimiento).
Razonamiento interno del carrier jamás sale de J-Staff. Candidatas evaluadas, geocercas de otros contratos, sugerencias de calibración, y las cubetas de la autopsia: todo eso es interno. El cliente/planta nunca lo ve.
Ancla Marco: "El cliente jamás ve la operación interna del carrier" (Pieza 4, leyes).
Empalme y variante son inferencias, no hechos probados. El conteo agregado en J-Staff sí (sirve para diagnóstico y para negociar con el cliente). La etiqueta individual pegada a un servicio, solo con confirmación humana — nunca por sospecha automática, para no romper la confianza del veredicto.
La autopsia es herramienta de diagnóstico interna (J-Staff), no producto de cara al cliente. Se corre cuando hay un pico raro de rojos, se lee el diagnóstico, se ajusta la perilla correcta, y se guarda. No es un tablero de uso diario.
Todas las tolerancias y umbrales son configurables por contrato, nunca hardcodeados. La UI guarda el acuerdo; no lo decide. Quien configura es quien paga (la planta), nunca el auditado (el carrier). Los cambios de política aplican solo hacia adelante; jamás reescriben hechos congelados.
Ancla Marco: "La verdad se calcula una vez y se guarda" (Pieza 1-C).
El motivo se muestra a PLANTA y CARRIER, no al cliente corporativo. (Decidido 20 jul, tarde.) El cliente ve el agregado de todas sus plantas; el detalle por servicio lo ahogaría en ruido. La operación del servicio corresponde a planta y carrier. ✅ Construido (PR #47).
El margen de evidencia NO se extiende más allá de 60/45 por privacidad del chofer. Si faltan puntos al inicio del trazo, casi siempre es arranque en frío del dispositivo GPS — extender la ventana no inventa puntos. La métrica A en 60% ya tolera inicios incompletos. Además, algunas unidades duermen en casa del chofer: el réferi no tiene por qué ver eso. El trazo dibujado se recorta al corredor KML y la evidencia a la ventana; esas fronteras se quedan.
J-Tel son DOS productos sobre un cimiento (recordatorio de Pieza 1-C): el árbitro de cumplimiento (construido) y la plataforma de flota del carrier (casi sin construir). En el producto de flota, el carrier SÍ ve su flota todo el día, huecos incluidos — son sus datos, su cuenta. El tope de ventana es ley del árbitro, no del dueño viéndose a sí mismo. Única frontera que aplica en ambos: jamás ver otras cuentas.
2. Hallazgo clave de la sesión

Autopsia de los 55 no_cumplido del Campus Santos Dumont, semana 13–17 jul (135 servicios: 80 cumplido, 55 no cumplido, 0 pendiente):

Cubeta	Cantidad	%
Llegada fuera de ventana (tarde real)	36	65%
Empalme (una unidad, dos rutas)	14	25%
Variante (mismo destino, otra calle)	5	9%
Sin servicio detectado	0	0%
Hueco de datos	0	0%
Basura de GPS (brinco)	0	0%

Lectura: el motor mide bien. Cobertura al 100%, cero servicios fantasma, cero fallas de GPS. El problema es 100% operativo: el carrier llega tarde y consolida rutas (empalmes). El réferi está haciendo su trabajo — decir la verdad incómoda. No hubo que aflojar ningún umbral; se diagnosticó la causa real con datos.

Bandera de salud confirmada: sinCoberturaStep0Insuficiente = 0 → ningún no_cumplido se coló sin pasar la precondición de cobertura. La precondición está sana.

3. Estado del trabajo en curso
PR #46 — Autopsia de no_cumplidos (reporte de solo lectura): ✅ mergeado a main el 20 jul. Endpoint J-Staff /api/jstaff/autopsia-no-cumplidos. Solo lectura; no toca saveFact, no llama a Umbrella. Incluye TODO de seguridad anotado (ver deuda 1 abajo).
PR #47 — Motivo bajo el chip no_cumplido: ✅ mergeado a main el 20 jul. La línea "Llegada tarde (+N min, unidad X)" / "Sin servicio detectado en la ventana" aparece en lista y detalle, caras de planta/campus y carrier. Cliente corporativo intacto. Reutiliza noCumplidoDetailLine; cero cambios al motor.
Tarea 3 (contexto "llegada fuera de ventana" en el ledger): ✅ viva en el motor desde antes. Anota la llegada tardía sin cambiar el veredicto.
Herramienta de trabajo: ahora con Devin (Claude Code), no Cursor. Reglas escritas en las fichas (Devin obedece lo escrito): una rama por tarea, todo por PR, merge a main solo por Asav.
3b. Nudos cerrados en la auditoría del 20 jul (para no cargarlos)
Seguimiento condicionado → CERRADO como innecesario. Los datos de la autopsia lo mataron: el margen de 45 + Tarea 3 capturaron las 36 llegadas tardías completas, cero "sin rastro". No resuelve ningún problema real; construirlo sería peso muerto. Se archiva.
Etiqueta de defensa del carrier → CERRADO como ya-resuelto. El flujo de etiquetado ya existe para todo rojo sin unidad (empalmes/variantes incluidos). Los tardíos quedarán identificados con unidad+hora tras la Ficha 1. Todo rojo tiene identificación o canal de defensa. Pendiente evaporado.
Encadenamiento del PR viejo de Cursor → VERIFICADO cerrado. El código tiene "una sola ronda: no realimentar" en la pasada de eliminación. El fix entró.
Toggle "Permitir destino alterno" → MARCADO PARA ELIMINAR (basura peligrosa). Contradice la ley "el destino es la identidad de la ruta". Permitiría que una unidad que fue a otro lado cuente como cumplida — puerta trasera que mata la confianza del veredicto. Herencia de intentos pasados. Se elimina de la política del contrato en la próxima ficha de motor. NO confundir con variantes de trazado (mismo destino, otra calle — eso sí es válido).

Notas de obsolescencia:

docs/Ficha-Handoff-Evidencia-Llegada.md — su Tarea 4 dice "carrier y cliente"; QUEDA SUPERSEDED por la decisión del 20 jul (planta y carrier, cliente NO) y por el PR #47 ya mergeado. Ponerle nota "SUPERSEDED — ver Anexo" arriba para que Devin no siga la instrucción vieja.
~6 PRs zombis abiertos en GitHub (ramas viejas de Cursor). Revisar y cerrar sin merge los que ya no apliquen. No urge, pero anotado para no confundir a Devin.
4. Pendientes grandes (camino a v1), priorizados

Estos son los frentes abiertos. NO se construyen todos ahora — se vuelven fichas una por una cuando les toque. Orden sugerido:

Columna A — Determinar bien la verdad (seguir el hilo de hoy)
Motivo bajo el chip rojo ✅ HECHO (PR #47, 20 jul). Planta y carrier ven el motivo; cliente corporativo no (decisión de Asav).
Cara del carrier — etiqueta de defensa sobre no_cumplido: hoy la etiqueta de calibración solo existe para dudosos sin unidad. Extenderla: que el carrier pueda etiquetar también un no_cumplido ("sí se hizo, fue la unidad X") — alimenta calibración/ledger, nunca cambia el veredicto. La línea de motivo (PR #47) ya le muestra su verdad; falta el canal de respuesta.
Producto de flota del carrier (torre + gestión, todo el día): proyecto mayor aparte — la segunda cara del Marco (Pieza 1-C). Ver flota completa incluso fuera de ventanas de servicio, lo programable del servicio. Merece su propia sesión de diseño y ficha madre. Sin fecha aún.
Decisiones de contrato pendientes con Tecma (decisión de negocio, no código): ¿el empalme cuenta como servido? ¿tolerancia de tardíos? Se capturan en las perillas del contrato. Usar el reporte agregado de la autopsia como evidencia en esa plática. Motor guarda los tardíos (Ficha 1 — decidida 20 jul, por construir): cuando un no_cumplido fue "tarde de verdad" (Sabor A: sirvió la ruta según la política vigente pero fuera de tiempo), el motor debe guardar observedUnitId + observedArrivalAt + observedRouteMatchPct. Hoy los tira porque solo los persiste si el veredicto es cumplido — por eso los 55 salen "sin servicio" en pantalla aunque 36 fueron tardíos. Toca saveFact → ficha con parada obligatoria, Opus. El %match se guarda como REGISTRO, jamás para cambiar el veredicto. Solo aplica hacia adelante; los 55 viejos requieren re-verificación J-Staff a petición de Asav. Variantes de trazado — multi-KML por perfil (Ficha 2 — diseño acordado 20 jul, por construir): un perfil de ruta = UN destino (identidad, intocable) + N trazados KML aceptados. El motor evalúa contra todos y toma el mejor match; si cualquiera pasa A∧B → cumplido, y el hecho registra cuál variante sirvió. Resuelve tráfico/accidentes/clima sin mentir ni aflojar el veredicto. Los sentidos (entrada/salida) caben en el mismo molde después. Cambio grande de motor → parada obligatoria, Opus, por fases. La variante NO va a pendiente_evidencia (eso es "falta GPS"; aquí sí sabes qué pasó) ni a "cumplido parcial" (no existe). Va a verde o rojo según qué defina el contrato como "servir la ruta". Aprobación de variantes por la planta (Ficha 3 — diseño acordado 20 jul, por construir): en vez de que la planta revise cada servicio desviado, aprueba el CATÁLOGO de trazados una vez. El sistema detecta el patrón ("Riveras-B llega por otra calle en N servicios"), lo propone con mapa, la planta acepta → el KML entra al catálogo del perfil → de ahí en adelante automático. Control donde debe (quien paga define qué caminos valen), trabajo de una vez, no diario. Política hacia adelante; no reverdea hechos viejos. UI, depende de la Ficha 2.
Seguimiento condicionado (congelado, esperando datos): si el margen de 45 min no captura suficientes llegadas tardías, evaluar seguir midiendo a la unidad que demostró arrancar la ruta (arranque de KML + dirección coherente), con tope duro = duración máx. de ruta. Toca el árbitro → ficha con parada obligatoria. No construir hasta que los datos lo justifiquen.
Columna B — Infraestructura para producción (deuda estructural)

Esto no bloquea el diagnóstico de hoy, pero SÍ bloquea salir a producción con clientes reales. Ya está diseñado en la Pieza 4 del Marco; falta construirlo.

Autenticación / login — DEUDA CRÍTICA. Hoy J-Telemetry no tiene puerta de entrada: ningún endpoint verifica quién entra; todo corre con un usuario de prueba fijo (tecma_admin). Existe getJStaffMemberships() en el código pero nadie la invoca. El endpoint de la autopsia quedó con un TODO de seguridad visible. Aplica a TODOS los endpoints y páginas, no solo la autopsia. Nada de esto sale a un cliente real sin login.
Autorización por rol × alcance: que cada cara vea solo lo suyo, en código. Conecta directo con las leyes de confidencialidad. El Marco ya define los roles (Pieza 4); falta implementarlos.
UI de producto v1: la interfaz actual está bien para pruebas internas, no para cliente. Acabado sobre el motor que ya funciona.
Historial/Monitoreo — mapa espagueti: el mapa del historial del turno dibuja las 14+ rutas encimadas y queda ilegible. Ya tiene filtros de Unidad/Veredicto; el arreglo probable es de defaults (una ruta a la vez, filtro activado de inicio, u opacidad menor), no de arquitectura. Deuda de UI anotada el 20 jul para no olvidarla.
5. Cómo usar este anexo
Cuando termines una pieza: táchala aquí y, si generó una ley nueva, súbela al Marco.
Cuando arranques una ficha para Devin: que la ficha referencie este anexo y el Marco, no la memoria del chat.
Regla que no cambia: lo que no está escrito (en el Marco o en una ficha), para Devin no existe. Este anexo es para ti; las fichas son para Devin.
