-- ═══════════════════════════════════════════════════════════════════
-- Medir hasta dónde llegó Oasis–Centro en producción (eslabón 1 del arranque)
--
-- TODA ESTA HOJA ES DE LECTURA. Son SELECT contra el catálogo de Postgres y
--   contra las tablas de la 0025–0033. No escribe nada, no crea nada, no
--   bloquea nada. Se puede correr con el usuario de SOLO LECTURA.
--
-- Por qué existe: el plan del arranque afirma cinco cosas sobre este circuito
-- —que no tiene paradas, que le falta la tabla por franja, que no está
-- publicado, que no tiene unidades y que el color no existe como dato— y
-- **ninguna de las cinco se puede contestar desde el repo**. El repo dice qué
-- columnas hay; sólo la base dice qué se capturó. Lo que se responda aquí
-- decide qué se construye antes del martes 22.
--
-- Cómo correrla: **un PASO a la vez**, en orden, y de cada uno pega el
-- resultado completo en el chat — incluidos los ceros y los NULL. Un paso que
-- devuelve cero renglones es una respuesta, no un error.
--
-- Ninguna sentencia de esta hoja falla a propósito. Si alguna truena, el
-- mensaje ES el hallazgo: quiere decir que esta base no tiene esa columna, y
-- eso hay que saberlo antes de escribir la pantalla que la usa.
--
-- El circuito: se busca por nombre parecido a «Oasis», y el PASO 1 lista
-- TODOS los circuitos de la base para que se vea al lado el `corredor-prueba`
-- —que es laboratorio de transporte especial, NO una ruta— y cualquier otro
-- que se haya dado de alta sin que esté anotado.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 0 · ¿Esta base tiene la cadena 0025–0033 aplicada?
--
-- Producción no tiene la bitácora del migrador (`__drizzle_migrations` no
-- existe ahí), así que la pregunta se hace POR EL EFECTO: ¿están las columnas
-- y las tablas que esas migraciones crean? Va primero porque si algo de aquí
-- sale «FALTA», los pasos siguientes tronarían y el diagnóstico sería otro.
-- ───────────────────────────────────────────────────────────────────

SELECT 'tabla ' || t.nombre AS objeto,
       CASE WHEN to_regclass('public.' || t.nombre) IS NULL THEN 'FALTA' ELSE 'está' END AS estado
FROM (VALUES ('circuits'), ('circuit_paths'), ('circuit_stops'),
             ('circuit_stop_versions'), ('circuit_unit_assignments'),
             ('concession_profiles'), ('concession_carriers'), ('circuit_opens')) AS t(nombre)
UNION ALL
SELECT 'circuits.' || c.nombre,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema = 'public' AND table_name = 'circuits'
                            AND column_name = c.nombre)
            THEN 'está' ELSE 'FALTA' END
FROM (VALUES ('stop_snap_tolerance_meters'),   -- 0026
             ('published_at'),                 -- 0028
             ('avg_speed_kmh'), ('color_hex'), -- 0029
             ('corridor_tolerance_meters'),    -- 0030
             ('service_confidence_minutes'), ('arrival_range_enabled_at'), -- 0031
             ('service_launch_date')) AS c(nombre) -- 0032
ORDER BY 1;


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · Todos los circuitos, con su identidad y TODO lo que declaran.
--
-- Contesta de un golpe: si está publicado, si tiene color escogido o el de
-- fábrica, qué frecuencia declara, cuándo arranca y si el rango de llegada
-- está encendido. La columna `color` dice además si alguien lo escogió: el
-- default de la 0029 es '#7C5CE0', así que ese valor exacto significa «nadie
-- lo tocó», no «no existe».
-- ───────────────────────────────────────────────────────────────────

SELECT c.name                                    AS circuito,
       c.public_slug                             AS slug,
       a.slug                                    AS concesion,
       c.active                                  AS activo,
       c.published_at                            AS publicado_desde,
       CASE WHEN c.published_at IS NULL THEN 'NO PUBLICADO' ELSE 'publicado' END AS para_el_pasajero,
       c.service_launch_date                     AS arranca_el,
       c.declared_frequency_minutes              AS frecuencia_min,
       CASE WHEN c.declared_frequency_minutes IS NULL
            THEN 'sin declarar' ELSE 'declarada' END AS la_promesa,
       c.color_hex                               AS color,
       CASE WHEN c.color_hex = '#7C5CE0' THEN 'el de fábrica (nadie lo escogió)'
            ELSE 'escogido' END                  AS el_color_es,
       c.service_start_local                     AS abre,
       c.service_end_local                       AS cierra,
       c.time_zone                               AS zona,
       c.avg_speed_kmh                           AS velocidad_kmh,
       c.arrival_range_enabled_at                AS rango_encendido_desde,
       c.stale_after_seconds                     AS dato_viejo_seg,
       c.arrival_range_floor_seconds             AS piso_rango_seg,
       c.stop_snap_tolerance_meters              AS pegado_m,
       c.corridor_tolerance_meters               AS corredor_m,
       c.service_confidence_minutes              AS confianza_min,
       c.created_at                              AS dado_de_alta,
       c.updated_at                              AS tocado_por_ultima_vez,
       c.id                                      AS circuito_id
FROM circuits c
JOIN accounts a ON a.id = c.concession_account_id
ORDER BY c.created_at;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · El trazado de cada circuito, por sentido.
--
-- Comprueba contra la medición del 26 de agosto: ida 661 puntos / 20.83 km,
-- vuelta 456 / 16.44 km, de las capas «Indicaciones». Si los números no
-- cuadran, lo que está cargado NO es lo que el plan da por medido.
-- ───────────────────────────────────────────────────────────────────

SELECT c.name                              AS circuito,
       p.sentido,
       p.point_count                       AS puntos,
       round(p.length_meters::numeric / 1000, 2) AS km,
       p.source_layer_name                 AS capa_del_kml,
       p.source_file_name                  AS archivo,
       p.uploaded_at                       AS subido
FROM circuit_paths p
JOIN circuits c ON c.id = p.circuit_id
ORDER BY c.name, p.sentido;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · Cuántas paradas tiene cada circuito. LA PREGUNTA DEL ESLABÓN 1.
--
-- Se cuentan tres cosas distintas y no se mezclan: identidades (el letrero
-- del poste), las que siguen vivas, y las que tienen versión vigente. Una
-- parada sin versión vigente es una parada retirada o a medio capturar, y
-- cuenta como hueco, no como parada.
-- ───────────────────────────────────────────────────────────────────

-- `DISTINCT` en las dos primeras cuentas y no es adorno: una parada con tres
-- versiones trae tres renglones del JOIN, y sin él una sola parada movida dos
-- veces se reportaría como tres paradas. La cifra saldría correcta como suma
-- y falsa como respuesta.
SELECT c.name                                                      AS circuito,
       count(DISTINCT s.id)                                        AS paradas_en_total,
       count(DISTINCT s.id) FILTER (WHERE s.retired_at IS NULL)    AS no_retiradas,
       count(v.id) FILTER (WHERE v.valid_to IS NULL)               AS con_version_vigente,
       count(v.id) FILTER (WHERE v.valid_to IS NULL AND v.sentido IS NULL)     AS sirven_los_dos_sentidos,
       count(v.id) FILTER (WHERE v.valid_to IS NULL AND v.sentido = 'ida')     AS solo_ida,
       count(v.id) FILTER (WHERE v.valid_to IS NULL AND v.sentido = 'vuelta')  AS solo_vuelta,
       min(s.created_at)                                           AS la_primera,
       max(s.created_at)                                           AS la_ultima
FROM circuits c
LEFT JOIN circuit_stops s ON s.circuit_id = c.id
LEFT JOIN circuit_stop_versions v ON v.stop_id = s.id
GROUP BY c.name
ORDER BY c.name;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Las paradas una por una, como quedarían publicadas.
--
-- Si el PASO 3 dio cero, este paso devuelve cero renglones y eso cierra la
-- pregunta. Si dio algo, aquí se ve si están bien capturadas: nombre de
-- verdad o el «Parada N» con que nacen, orden sin huecos ni repetidos, y el
-- QR que iría impreso en la lámina.
-- ───────────────────────────────────────────────────────────────────

SELECT c.name        AS circuito,
       v.orden,
       v.name         AS parada,
       CASE WHEN v.name ~ '^Parada [0-9]+$' THEN 'sin nombrar (nació así)' ELSE 'nombrada' END AS el_nombre,
       coalesce(v.sentido::text, 'los dos') AS sentido,
       round(v.latitude::numeric, 6)  AS lat,
       round(v.longitude::numeric, 6) AS lon,
       s.qr_slug      AS qr,
       v.valid_from   AS vigente_desde,
       v.motivo,
       s.retired_at   AS retirada_el
FROM circuit_stops s
JOIN circuits c ON c.id = s.circuit_id
LEFT JOIN circuit_stop_versions v ON v.stop_id = s.id AND v.valid_to IS NULL
ORDER BY c.name, v.orden NULLS LAST;


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · ¿El orden se puede usar? Repetidos y huecos.
--
-- El orden es lo que arma el hilo de paradas en la app. Un orden repetido o
-- con huecos no truena nada: dibuja mal y en silencio. La base no lo impide,
-- así que se mide.
-- ───────────────────────────────────────────────────────────────────

SELECT c.name                                  AS circuito,
       count(*)                                AS paradas_vigentes,
       count(DISTINCT v.orden)                 AS ordenes_distintos,
       CASE WHEN count(*) = count(DISTINCT v.orden) THEN 'sin repetidos' ELSE 'HAY REPETIDOS' END AS repetidos,
       min(v.orden)                            AS orden_minimo,
       max(v.orden)                            AS orden_maximo,
       CASE WHEN count(*) = 0 THEN 'no aplica'
            WHEN max(v.orden) - min(v.orden) + 1 = count(*) THEN 'sin huecos'
            ELSE 'HAY HUECOS' END              AS huecos
FROM circuit_stop_versions v
JOIN circuit_stops s ON s.id = v.stop_id
JOIN circuits c ON c.id = s.circuit_id
WHERE v.valid_to IS NULL
GROUP BY c.name
ORDER BY c.name;


-- ───────────────────────────────────────────────────────────────────
-- PASO 6 · Qué unidades corren cada circuito, y si de verdad reportan.
--
-- Asignada no es lo mismo que rodando. La última columna sale de
-- `live_positions`, que es lo último que se recibió de cada aparato: una
-- unidad asignada cuyo último punto es de hace días no va a aparecer en la
-- app del pasajero ningún día de prueba.
-- ───────────────────────────────────────────────────────────────────

SELECT c.name                          AS circuito,
       u.label                         AS unidad,
       ca.slug                         AS carrier,
       ua.valid_from                   AS asignada_desde,
       ua.valid_to                     AS cerrada_el,
       CASE WHEN ua.valid_to IS NULL THEN 'vigente' ELSE 'cerrada' END AS asignacion,
       ua.motivo,
       lp.imei                         AS aparato,
       lp.recorded_at                  AS ultimo_punto,
       CASE WHEN lp.recorded_at IS NULL THEN 'nunca ha reportado'
            ELSE date_trunc('minute', now() - lp.recorded_at)::text || ' sin reportar' END AS frescura
FROM circuit_unit_assignments ua
JOIN circuits c  ON c.id = ua.circuit_id
JOIN units u     ON u.id = ua.unit_id
JOIN accounts ca ON ca.id = ua.carrier_account_id
LEFT JOIN live_positions lp ON lp.unit_id = u.id
ORDER BY c.name, ua.valid_to NULLS FIRST, u.label;


-- ───────────────────────────────────────────────────────────────────
-- PASO 7 · ¿Existe en algún lado la tabla de horario por franja (9.1c)?
--
-- El repo dice que no: la promesa vive en `circuits.declared_frequency_minutes`
-- y es UN número para todo el día. Esto lo comprueba contra la base por si
-- alguien creó algo a mano. Cero renglones = confirmado que no existe, y
-- entonces la tabla por franja es tabla nueva, migración nueva.
-- ───────────────────────────────────────────────────────────────────

SELECT table_name AS tabla, column_name AS columna
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name ILIKE '%franja%' OR table_name ILIKE '%horario%'
       OR table_name ILIKE '%schedule%' OR table_name ILIKE '%band%'
       OR column_name ILIKE '%franja%')
ORDER BY table_name, ordinal_position;


-- ───────────────────────────────────────────────────────────────────
-- PASO 8 · ¿Alguien ha abierto la app de estos circuitos?
--
-- El contador anónimo de la 0033. Subcuenta a propósito (detrás de un NAT
-- móvil varios teléfonos comparten huella), así que un número chico no es
-- «nadie»; un cero sí es «nadie», o que el circuito no está publicado.
-- ───────────────────────────────────────────────────────────────────

-- `count(o.id)` y no `count(*)`: con LEFT JOIN, un circuito sin una sola
-- apertura devuelve un renglón vacío y `count(*)` lo cuenta como un día.
-- Diría «1 día con aperturas, 0 aperturas» de una ruta que nadie ha abierto.
SELECT c.name                       AS circuito,
       count(o.id)                  AS dias_con_aperturas,
       coalesce(sum(o.open_count), 0) AS aperturas_crudas,
       max(o.last_open_at)          AS la_ultima
FROM circuits c
LEFT JOIN circuit_opens o ON o.circuit_id = c.id
GROUP BY c.name
ORDER BY c.name;


-- ───────────────────────────────────────────────────────────────────
-- PASO 9 · ¿La concesión tiene transportista ligado? EL QUE FALTABA.
--
-- Agregado el 19-sep, después de ensayar la captura en la desechable: el
-- selector «Asignar una unidad» NO lista todas las unidades. Lista las
-- unidades activas de los transportistas ligados a ESTA concesión por un
-- `concession_carriers` con `valid_to` nulo. Sin esa liga el selector sale
-- vacío, la pantalla no explica por qué, y no hay forma de asignar nada.
--
-- Medido: con la liga, el selector trae las unidades y la asignación entra;
-- sin la liga, cero.
--
-- Si `unidades_asignables` sale en 0 para Oasis–Centro, eso —y no las
-- paradas— es lo primero que hay que arreglar el lunes.
-- ───────────────────────────────────────────────────────────────────

SELECT c.name                                   AS circuito,
       a.slug                                   AS concesion,
       count(cc.id) FILTER (WHERE cc.valid_to IS NULL) AS transportistas_ligados,
       coalesce(string_agg(DISTINCT ca.slug, ', ') FILTER (WHERE cc.valid_to IS NULL), '—') AS cuales,
       (SELECT count(*) FROM concession_carriers cc2
          JOIN units u ON u.carrier_account_id = cc2.carrier_account_id
         WHERE cc2.concession_account_id = a.id
           AND cc2.valid_to IS NULL
           AND u.active)                        AS unidades_asignables
FROM circuits c
JOIN accounts a ON a.id = c.concession_account_id
LEFT JOIN concession_carriers cc ON cc.concession_account_id = a.id
LEFT JOIN accounts ca ON ca.id = cc.carrier_account_id
GROUP BY c.name, a.slug, a.id
ORDER BY c.name;
