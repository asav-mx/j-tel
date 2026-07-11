# Diseño integral — Verificación honesta

Repo: asav-mx/j-tel · Stack: Next.js + Leaflet + Postgres (Neon) + TypeScript · Monorepo pnpm/Turbo con apps/web, apps/worker, packages/{db, verification, gps-umbrella, services} y docs/marco-limpio como fuente de verdad del dominio.




TL;DR (los 3 puntos que decidirlo todo)


El problema no es que los viajes no se cumplan; es que el sistema confunde "no pude verificar" con "no se cumplió". Los 18 de 27 "no cumplido" son falsos negativos producidos por tres fallas que se suman: (a) huecos en la memoria GPS propia (el archivador de Umbrella se atora por el límite de 10 consultas/min, 300/hora; un hueco de 83 min atribuyó una unidad a la ruta equivocada), (b) el algoritmo de coincidencia (matching) es unidireccional —premia que la ruta esté cubierta pero no castiga que el GPS se haya ido por toda la ciudad— y (c) rutas que comparten avenidas confunden la atribución (98% con Sierra Vista vs. 45% con Riberas 9). La palanca #1 es medir la cobertura de evidencia ANTES de emitir cualquier veredicto, y la #2 es pasar a cobertura bidireccional.
"Jornada" debe ser una VISTA derivada (una consulta que agrupa), NO una entidad nueva del modelo de datos. El modelo actual (contrato → perfil de servicio → ocurrencia → hecho de cumplimiento) ya contiene todo lo necesario; crear una tabla jornada duplicaría verdad y violaría la ley "esperado y observado nunca se mezclan".
El mapa de contraste debe tener 2 capas (rutas KML esperadas vs. recorridos GPS reales), color por turno/ruta, toggles y filtro por unidad para evitar el "spaghetti visual". Leaflet + LayerGroups basta para arrancar; deck.gl TripsLayer o Kepler.gl es la ruta de migración razonable solo si hace falta animar decenas de trayectorias en el tiempo.



Key Findings (lo esencial, con nombres y números)


El umbral de 500 m es demasiado grande y solo mide media verdad. La industria de map-matching (empatar GPS contra calles) usa radios mucho menores: la API de Map Matching de Valhalla/Meili limita el search_radius a 100 m máximo y fija el ruido GPS sigma_z en 4.07 m (o 5.0). Cita textual de la doc de Valhalla: "Apply a search_radius to specify the search radius (in meters)... The maximum search radius is 100 meters." Con 500 m, un camión que pasa por una avenida vecina "toca" puntos de una ruta que no sirvió. Valhalla
El algoritmo estándar del mundo real es el Hidden Markov Model de Newson & Krumm (2009), "Hidden Markov Map Matching Through Noise and Sparseness" (ACM SIGSPATIAL GIS '09, pp. 336–343; DOI 10.1145/1653771.1653818). Es el estándar de facto (≈819 citas en ACM) y la base de Valhalla/Meili, OSRM y Open Traffic Reporter. Sus dos perillas: sigma_z = 4.07 m (derivado por Newson-Krumm de la desviación absoluta mediana de su dataset) y beta = 3 (penaliza rutas poco directas/serpenteantes). Fuente confirmatoria (Mapzen/Open Traffic Reporter): "Newson and Krumm (2009) derive σz from the median absolute deviation over their dataset, arriving at a value of 4.07... We have adopted a β of 3 as our default parameter value." Mapzen
Existe un estándar numérico para "a tiempo" que J-Telemetry puede adoptar como default configurable: 1 minuto antes a 5 minutos después. Es la ventana dominante en transporte público (LA Metro, TriMet-Portland, Metro Transit-Minneapolis, TTC-Toronto) y es incluso ley en el Reino Unido: los Traffic Commissioners fijan que "95% of services should depart from the Timing Points within the bracket of up to 1 minute early and up to 5 minutes late." Variantes: SFMTA usa 1 antes/4 después (más estricto); WMATA-DC usa 2 antes/7 después (más laxo). Para J-Telemetry: tolerancia por defecto configurable por contrato, típicamente 0 antes / N después del deadline de turno. Publishing Service + 2
El corredor de adherencia a ruta en flotas ronda 100–200 m, y es configurable, no fijo. La patente US 10,648,823 describe un geocerca automática "allowing a deviation of up to 100 meters in any direction"; el proveedor de telemetría AVLView usa "more than 200 metres" para disparar alerta de desvío en transporte escolar. Samsara, Geotab y Verizon Connect ofrecen esto como umbral configurable por el usuario, no como default publicado. usptoAvlview
La "verdad de campo" (ground truth) de hoy es un activo, no un dato anecdótico. Como el operador SABE que hoy se cumple el 100%, cada "no cumplido" que el sistema emita hoy es, por definición, un falso negativo medible. Eso convierte al día de hoy en un conjunto de validación para calibrar el verificador con métricas de recall (sensibilidad).



Details

1. Mejores prácticas de map-matching y atribución ruta–vehículo

Glosario de una línea (el dueño no es desarrollador):


Map-matching: empatar puntos GPS con la calle o ruta real que el vehículo recorrió.
Trayectoria: la línea de migas de pan que dejó el GPS de una unidad en el tiempo.
Corredor: una franja (buffer) de X metros a cada lado de la ruta KML; "dentro del corredor" = "sobre la ruta".


Los algoritmos que usan los profesionales (Samsara, Geotab, Verizon Connect, Motive; y en transporte público los sistemas AVL/GTFS):


HMM de Newson-Krumm — el estándar. Piensa la ruta como la secuencia más probable de segmentos de calle dado el rosario de puntos GPS ruidosos. Dos probabilidades: emisión (¿qué tan cerca cae el GPS del segmento? gobernada por sigma_z = 4.07 m) y transición (¿es físicamente razonable saltar del segmento A al B? gobernada por beta = 3, que castiga rutas serpenteantes). Es robusto ante ruido y muestreo espaciado —exactamente los problemas de J-Telemetry. Microsoft
Distancia de Fréchet ("distancia de la correa del perro") — introducida algorítmicamente por Alt y Godau (1992/1995); es simétrica y respeta el orden de los puntos. Definición: "a measure of similarity between curves that takes into account the location and ordering of the points along the curves." Ideal para responder: ¿el recorrido tuvo la misma forma Y la misma secuencia que la ruta esperada? Wikipedia
Distancia de Hausdorff — mide el máximo desajuste entre dos conjuntos de puntos, pero ignora el orden temporal. Su versión dirigida (one-sided) es asimétrica; la bidireccional toma el máximo de las dos direcciones. Advertencia clave (Wikipedia, Fréchet): "It is possible for two curves to have small Hausdorff distance but large Fréchet distance" — por eso Fréchet es preferible cuando importan forma y secuencia. El algoritmo actual de J-Telemetry es, en esencia, una Hausdorff dirigida a medias: solo mide una de las dos direcciones. HandWiki
Dynamic Time Warping (DTW) — alinea dos series de distinta longitud "estirando" el tiempo; tolera muestreo GPS irregular. Útil como medida secundaria de forma.


El corazón del arreglo: cobertura BIDIRECCIONAL. Hoy J-Telemetry mide una sola cosa:


(A) Cobertura de ruta = % de puntos del KML que tuvieron un GPS cerca. (Alto = "la ruta fue recorrida".)


Falta la otra mitad:


(B) Precisión de corredor = % de puntos GPS de esa unidad que cayeron dentro del corredor de la ruta. (Bajo = "el GPS anduvo por fuera, esta unidad probablemente no es la de esta ruta".)


Un match honesto exige A alto Y B alto. El caso Sierra Vista (98%) vs. Riberas 9 (45%) se resuelve solo cuando se agrega B: la unidad que "dio 98%" con Sierra Vista tendría B alto solo en la ruta que realmente sirvió.

Desambiguar rutas que comparten avenidas (el problema de Sierra Vista / Riberas 9): tres técnicas, en orden de potencia:


Ponderar segmentos discriminantes (analogía TF-IDF). En búsqueda de texto, TF-IDF le da poco peso a palabras comunes ("el", "de") y mucho a palabras raras. Igual aquí: un tramo de avenida por el que pasan 10 rutas tiene poco poder discriminante; los primeros kilómetros dentro de la colonia (únicos de cada ruta) tienen mucho. Se pondera cada segmento por su rareza entre las 27 rutas. Esto existe en la literatura de clustering de trayectorias sobre redes viales, con la fórmula TF-IDF aplicada literalmente a segmentos.
Orden/secuencia de waypoints. No basta con tocar los puntos; hay que tocarlos en el orden correcto. Aquí entra Fréchet o DTW.
Dirección/sentido del recorrido. Dos rutas que comparten una avenida a menudo la recorren en sentidos opuestos o a distinta hora; el vector de avance desambigua.


Manejo de huecos y muestreo irregular: el HMM ya tolera espaciado; Valhalla usa breakage_distance = 2000 m (si dos lecturas sucesivas están más lejos que eso, no asume conectividad) e interpolation_distance = 10 m. Para J-Telemetry lo crítico no es interpolar sino declarar el hueco (ver sección 5). github


2. El concepto de "jornada": ¿entidad o vista?

Recomendación firme: VISTA derivada (agregación), NO entidad del modelo.

Una "jornada" = un turno (p. ej. Primer Turno 06:00) + una fecha (10 jul) + todos los perfiles de servicio ligados a ese turno + sus veredictos + el mapa de contraste. En transporte público, GTFS ya distingue conceptos análogos: "service day" (día operativo, que puede pasar de medianoche con horas tipo 25:30:00), "block" (el trabajo de un vehículo) y "run"/"paddle" (el trabajo de un conductor). Lección importante de GTFS: estos son agrupaciones lógicas / de presentación, no entidades que dupliquen los hechos. El propio comité de GTFS debatió años si "run" debía ser entidad y concluyó que es sobre todo información operativa que no debe inflar el modelo.

Por qué vista y no tabla, con el modelo actual (contrato → perfil → ocurrencia → hecho):

CriterioJornada como VISTA (recomendado)Jornada como ENTIDAD (no recomendado)Fuente de verdadUna sola: los hechos ya guardadosSe duplica: hay que sincronizar tabla jornada con hechosLey "verdad se calcula una vez y se guarda"Se respeta: la vista solo LEE hechosRiesgo de recálculo o desincronizaciónLey "esperado y observado nunca se mezclan"Se respeta: la vista los yuxtapone sin fundirlosTentación de guardar campos mezcladosCambios de turno/tolerancia (forward-only)Automático: la vista refleja los hechos vigentesHay que reescribir filas → riesgo de reescribir pasadoCosto de implementaciónBajo: un endpoint + una query con GROUP BY turno, fechaAlto: migración, escrituras, jobs de mantenimiento

Implementación concreta: un endpoint GET /api/jornada?turno=T1&fecha=2026-07-10 que devuelve el conjunto de ocurrencias de ese turno+fecha con sus hechos (veredicto + ledger interno), más los KML de las rutas y las trayectorias GPS de la ventana. En la UI, apps/web renderiza "Primer Turno · 10 de julio" como una sola pantalla navegable con sus 14 rutas, sus veredictos y el mapa de contraste. Cero cambios de esquema.


3. Diseño del mapa de contraste (esperado vs. observado, por capas)

Traducción del pedido textual del dueño ("un mapa agregado de todas las rutas... y otra con lo que hicieron todas las unidades... y contrastarlas visualmente"):

Las dos capas base (LayerGroups de Leaflet):


Capa A — ESPERADO: todas las rutas KML del turno, como polilíneas. Color por ruta (paleta categórica de ~12–15 colores distinguibles; reciclar con patrón de guiones si hay más). Grosor medio, opacidad ~0.9.
Capa B — OBSERVADO: los recorridos GPS reales de toda la flota (82 unidades) en la ventana del turno. Polilíneas más delgadas, mismo color que la ruta a la que el sistema las atribuyó (para leer el match de un vistazo), opacidad ~0.5.


Controles (todos en el panel de capas):


Toggle por capa (Esperado / Observado) y por turno (T1 / T2 / TB) usando L.control.layers con overlayGroups.
Filtro por unidad (IMEI): dropdown que aísla una sola trayectoria GPS. Recordar la ley del dueño: la unidad se identifica por IMEI del GPS, que es intercambiable; no es la identidad del camión.
Filtro por veredicto: ver solo las rutas en no_cumplido o pendiente_evidencia.
Slider de opacidad de la capa Observado.


Cómo evitar el "spaghetti visual" (decenas de trayectorias):


Color por ruta/turno, no aleatorio — verde=cumplido, ámbar=pendiente_evidencia, rojo=no_cumplido como capa de estado; color categórico por ruta como capa de identidad.
Filtro por unidad — la herramienta más efectiva; una trayectoria a la vez.
Offset de líneas superpuestas — en Leaflet requiere el plugin leaflet-polylineoffset o Turf.js; en MapLibre/deck.gl es nativo (line-offset). Desplaza 2–6 px las líneas que comparten calle para que se vean paralelas.
Heatmap de cobertura — en vez de 82 líneas, un mapa de calor de densidad de puntos GPS para ver "por dónde de verdad pasó la flota".
Small multiples — una mini-cuadrícula de mapas, uno por ruta, para comparación lado a lado.


Leaflet vs. migración: Leaflet + LayerGroups + control de capas + (opcional) leaflet.heat cubre el 90% del caso y ya está en el stack. Solo migrar si se necesita animación temporal de decenas de trayectorias (ver el "playback" de un turno): ahí entran deck.gl TripsLayer (paths animados con getTimestamps, trailLength, currentTime; integrable en React/Next.js) o Kepler.gl (Trip layer que consume GeoJSON con coordenadas [lon, lat, alt, timestamp] y trae control de animación y dual-map view listos). deck.gl se puede montar como overlay sobre Leaflet o reemplazar el mapa.


4. Manejo de falsos negativos y calibración con ground truth

(a) Cobertura de evidencia como PRECONDICIÓN del veredicto. Antes de decidir cumplido/no_cumplido, el motor (packages/verification) debe calcular la cobertura de evidencia de la ventana del servicio:


¿Hay puntos GPS en la ventana [deadline − duración_máx_ruta − tolerancia, deadline + tolerancia]?
¿Cuántos minutos sin puntos (gaps) hay dentro de esa ventana? ¿Cuál es el hueco máximo continuo?
Regla dura (ya alineada con las leyes del producto): si la cobertura de evidencia es insuficiente, el veredicto honesto es pendiente_evidencia, jamás no_cumplido. SIN EVIDENCIA ≠ INCUMPLIMIENTO.
Umbral inicial sugerido (configurable por contrato): declarar no_cumplido solo si cobertura temporal ≥ 80% de la ventana y hueco máximo continuo ≤ 10 min. Si no, pendiente_evidencia.


(b) Backfill con proveedor de rate limits estrictos (Umbrella: 10/min, 300/hora). El apps/worker y packages/gps-umbrella deben implementar:


Cola con limitador de tasa (token bucket) fijado 10–20% por debajo del límite del proveedor (≈8 consultas/min efectivas) para no chocar contra 429.
Backoff exponencial con jitter ante 429/503: esperar 1s, 2s, 4s, 8s… con aleatoriedad. AWS demostró que "Full Jitter" —random(0, min(cap, base·2^intento))— reduce >50% las llamadas totales frente al backoff sin jitter. Honrar el header Retry-After si viene, y poner tope al tiempo de espera.
Watermarks (marcas de agua): guardar por IMEI el timestamp del último punto archivado; el backfill pide solo lo que falta desde el watermark (relleno dirigido), no todo.
Detección de gaps + relleno dirigido: un job que escanea la memoria propia buscando huecos > umbral y encola específicamente esas ventanas.
Procesar por lotes en las ventanas de deadline (donde la evidencia importa), no distribuido al azar.


(c) Alarma cuando el archivador se cae en silencio. El hueco de 83 minutos ocurrió porque nadie supo que el archivador se atoró. Instrumentar:


Heartbeat / dead-man's switch: si no entran puntos nuevos de la flota en X minutos durante horario operativo, alertar.
Dashboard de salud de ingesta: puntos/min por IMEI, tasa de 429, profundidad de cola, edad del watermark más viejo.
Alerta previa al deadline: "el turno T1 cierra en 20 min y 6 unidades no tienen datos en la última hora" → da chance de backfill antes de congelar la verdad.


(d) Plan de calibración gradual con ground truth. Como hoy el cumplimiento real es 100%, cada no_cumplido es un falso negativo medible. Métricas (aplicando precision/recall a la verificación):


Recall del verificador = de todos los servicios que SÍ se cumplieron, ¿qué fracción marcó como cumplido? Hoy: 9/27 ≈ 33% → malísimo. Meta: >95%.
Tratar pendiente_evidencia aparte: no cuenta como error de veredicto, cuenta como brecha de datos (métrica separada de cobertura).
Estrategia de umbrales: empezar permisivo (tolerancias amplias, umbral de match de corredor bajo) para no generar falsos no_cumplido, y apretar los umbrales conforme la cobertura de datos mejora, midiendo en cada paso que el recall no baje. Esto es exactamente el threshold tuning de clasificación: subir el umbral reduce falsos positivos pero sube falsos negativos; con datos incompletos hay que priorizar recall.



Recommendations (pasos concretos, priorizados, con criterios de "listo")

Escritos para entregarse a un asistente de código (Cursor). Cada fase tiene un Definition of Done (DoD) medible.

Fase 0 — Instrumentar la verdad de campo y la salud de datos (1 semana)


Registrar el ground truth diario del operador (hoy: 100% cumplido) como tabla de validación separada del ledger.
Dashboard de salud de ingesta + heartbeat del archivador con alerta.
DoD: existe una alerta que dispara si la ingesta se detiene > 15 min en horario operativo; el equipo puede ver recall del verificador contra el ground truth del día.


Fase 1 — Cobertura de evidencia como precondición (1–2 semanas) · máxima prioridad


En packages/verification, calcular por ocurrencia: cobertura temporal de la ventana y hueco máximo continuo.
Regla: no_cumplido solo si cobertura ≥ 80% y hueco ≤ 10 min (ambos configurables por contrato); si no, pendiente_evidencia.
Guardar el detalle en el ledger interno; al cliente solo salen los 3 veredictos.
DoD: en el día de ground truth 100%, cero servicios en no_cumplido por causa de huecos; los que no se puedan verificar caen en pendiente_evidencia. Recall (sobre servicios con evidencia suficiente) > 90%.


Fase 2 — Coincidencia bidireccional + bajar el corredor (2 semanas)


Añadir la métrica B (precisión de corredor) = % de puntos GPS dentro del corredor de la ruta.
Bajar el corredor de 500 m a un rango configurable 100–150 m (default 120 m); un match exige A ≥ umbral Y B ≥ umbral.
DoD: el caso Sierra Vista/Riberas 9 se atribuye a una sola ruta; en el día de ground truth, ninguna unidad se atribuye a dos rutas por compartir avenida.


Fase 3 — Desambiguación por segmentos discriminantes (2–3 semanas)


Precalcular pesos tipo TF-IDF por segmento sobre las 27 rutas del campus (segmento raro = peso alto).
Score de match = suma ponderada; validar orden de waypoints con Fréchet (o DTW) y usar dirección de avance como desempate.
Mantener la asignación exclusiva por ventana operativa traslapada (ya implementada) y la política "perdedor con hueco → pendiente_evidencia".
DoD: en un lote histórico etiquetado por el operador, la atribución unidad→ruta acierta > 95% cuando la evidencia es suficiente.


Fase 4 — Vista "Jornada" + Mapa de contraste (2–3 semanas)


Endpoint GET /api/jornada?turno&fecha (agregación, sin nueva tabla).
Pantalla de jornada con las 2 capas Leaflet (Esperado/Observado), toggles, filtro por unidad y por veredicto, opacidad, y offset de líneas superpuestas.
DoD: el dueño abre "Primer Turno · 10 jul" y ve sus 14 rutas, veredictos y el contraste esperado-vs-real sin buscar servicio por servicio.


Fase 5 — Backfill robusto y calibración continua (continuo)


Cola con token bucket (~8/min), backoff con jitter, watermarks, detección de gaps y relleno dirigido en apps/worker.
Rutina semanal: comparar veredictos vs. ground truth, ajustar umbrales apretándolos si el recall se mantiene > 95%.
DoD: la tasa de pendiente_evidencia por huecos cae mes a mes; el recall se mantiene > 95% mientras se aprietan tolerancias.


Umbrales que cambian las decisiones (semáforos):


Si recall < 90% tras Fase 1 → el problema no es solo evidencia; auditar el matching antes de seguir.
Si pendiente_evidencia > 20% de forma sostenida → el cuello de botella es la ingesta (rate limits), priorizar Fase 5 sobre Fase 3.
Si al bajar el corredor a 120 m sube el recall pero baja la atribución correcta → subir peso de segmentos discriminantes (Fase 3) antes de apretar más.



Caveats (honestidad epistémica)


Los umbrales concretos (corredor 100–200 m, ventana 1-antes/5-después, gap ≤ 10 min) son valores de referencia de la industria, NO estándares universales. Corredor 100 m viene de la patente US 10,648,823 y 200 m de AVLView (un proveedor); la ventana on-time viene de agencias de transporte público y de la ley británica. Deben quedar configurables por contrato, nunca hardcodeados —tal como exigen las leyes del producto.
sigma_z = 4.07 y beta = 3 son defaults de Newson-Krumm/Valhalla pensados para map-matching contra red de calles completa. J-Telemetry no necesita el HMM completo para empezar (el problema es atribución ruta-vehículo, no reconstrucción de calles); la cobertura bidireccional + TF-IDF de segmentos + Fréchet resuelve el caso con menos complejidad. El HMM es una mejora futura si se quiere reconstruir el recorrido calle por calle.
Samsara/Geotab/Verizon Connect exponen la adherencia a ruta como umbral configurable por el usuario, no publican un buffer fijo por defecto; por eso J-Telemetry no puede "copiar un número" y debe calibrarlo contra su propio ground truth.
La verdad de campo "100% se cumple" es la afirmación del operador, no una medición independiente. Es válida como conjunto de validación inicial, pero conviene registrar excepciones reales (un viaje que de verdad no se dio) en cuanto ocurran, para que el conjunto de validación no quede sesgado hacia "todo se cumple siempre".
El offset de polilíneas en Leaflet requiere plugin externo (leaflet-polylineoffset o Turf.js); es nativo en MapLibre/deck.gl. Si el spaghetti visual se vuelve el mayor dolor, ese es un argumento concreto a favor de migrar la capa de visualización.
