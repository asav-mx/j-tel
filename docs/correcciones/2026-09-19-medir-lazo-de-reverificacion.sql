-- ═══════════════════════════════════════════════════════════════════
-- Medir el lazo de re-verificación (diagnóstico del 19-sep-2026)
--
-- TODA ESTA HOJA ES DE LECTURA. Seis pasos, ninguno escribe. Se corre con el
--   usuario de SOLO LECTURA. No borra una sola entrada del ledger: son
--   hechos, y son la evidencia del diagnóstico.
--
-- Para qué sirve: son los mismos números de
-- `docs/Diagnostico-Reverificacion-Infinita-2026-09-19.md`. Se corren ANTES y
-- DESPUÉS del arreglo, y la diferencia es la prueba de que el arreglo sirvió.
-- Un arreglo que no mueve estos números no arregló nada.
--
-- ⚠ Los pasos 1, 2 y 5 recorren `ledger_entries` entera (4.5 millones de
-- filas, sin índice por fecha ni por acción). Tardan segundos, no minutos, y
-- no bloquean nada — pero no son gratis. Correr uno a la vez.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · La forma del ledger, por acción. El tamaño del problema.
--
-- Lo sano son 3 o 4 entradas por servicio. Todo lo que pase de ahí en
-- `verificacion_automatica` es el lazo.
-- ───────────────────────────────────────────────────────────────────

SELECT action                                                       AS accion,
       count(*)                                                     AS entradas,
       count(DISTINCT service_occurrence_id)                        AS servicios,
       round(count(*)::numeric
             / nullif(count(DISTINCT service_occurrence_id), 0), 1) AS por_servicio,
       min(created_at)                                              AS primera,
       max(created_at)                                              AS ultima
FROM ledger_entries
WHERE created_at >= now() - interval '30 days'
GROUP BY action
ORDER BY entradas DESC;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · Los peores servicios, con el estado que los mantiene en la cola.
--
-- Las dos columnas que importan son `veredicto` y `evidencia`: la pareja
-- `pendiente_evidencia` + `indisponible` es, literalmente, la condición de
-- reingreso a la cola. Mientras siga así, el servicio vuelve cada minuto.
-- ───────────────────────────────────────────────────────────────────

WITH top AS (
  SELECT service_occurrence_id AS oc,
         count(*)      AS entradas,
         min(created_at) AS primera,
         max(created_at) AS ultima
  FROM ledger_entries
  WHERE action = 'verificacion_automatica'
    AND created_at >= now() - interval '30 days'
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 10
)
SELECT t.entradas, t.primera, t.ultima,
       cf.status                    AS veredicto,
       tr.evidence_status           AS evidencia,
       tr.evidence_window_end       AS fin_de_ventana,
       round(extract(epoch FROM (now() - tr.evidence_window_end)) / 86400) AS dias_desde_la_ventana,
       a.slug                       AS cliente,
       ca.slug                      AS transportista
FROM top t
JOIN service_occurrences o ON o.id = t.oc
JOIN service_contracts sc  ON sc.id = o.contract_id
JOIN accounts a            ON a.id = sc.client_account_id
JOIN accounts ca           ON ca.id = sc.carrier_account_id
LEFT JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
LEFT JOIN trips tr            ON tr.service_occurrence_id = o.id
ORDER BY t.entradas DESC;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · El freno: ¿puede engancharse hoy?
--
-- El motor retira un servicio de la cola si lleva ≥30 intentos Y se cumple una
-- de dos razones. Este paso mide las dos.
--
--   · `horizonte_de_memoria` es lo que mira la primera razón: el primer punto
--     de telemetría del transportista, de cualquier origen. Si es viejo, esa
--     razón NO puede dispararse para nada reciente.
--   · `ya_pasaron_los_14_dias` es la segunda razón.
--
-- Si las dos columnas salen en cero, el freno no puede actuar y el lazo sigue.
-- ───────────────────────────────────────────────────────────────────

WITH horizonte AS (
  SELECT carrier_account_id, min(recorded_at) AS primer_punto
  FROM telemetry_points
  GROUP BY carrier_account_id
),
atorados AS (
  SELECT sc.carrier_account_id, tr.evidence_window_end
  FROM compliance_facts cf
  JOIN trips tr              ON tr.service_occurrence_id = cf.service_occurrence_id
  JOIN service_occurrences o ON o.id = cf.service_occurrence_id
  JOIN service_contracts sc  ON sc.id = o.contract_id
  WHERE cf.status = 'pendiente_evidencia'
    AND tr.evidence_status = 'indisponible'
)
SELECT ca.slug                    AS transportista,
       h.primer_punto             AS horizonte_de_memoria,
       count(a.evidence_window_end)                                          AS atorados,
       count(*) FILTER (WHERE a.evidence_window_end < h.primer_punto)        AS caben_por_horizonte
FROM horizonte h
JOIN accounts ca ON ca.id = h.carrier_account_id
LEFT JOIN atorados a ON a.carrier_account_id = h.carrier_account_id
GROUP BY ca.slug, h.primer_punto
ORDER BY 3 DESC;

-- La segunda razón, y el tamaño de la cola de hoy.
SELECT count(*)                                                             AS en_estado_de_reintento,
       count(*) FILTER (WHERE tr.evidence_window_end < now() - interval '14 days') AS ya_pasaron_los_14_dias,
       min(tr.evidence_window_end)                                          AS ventana_mas_vieja,
       max(tr.evidence_window_end)                                          AS ventana_mas_nueva
FROM compliance_facts cf
JOIN trips tr ON tr.service_occurrence_id = cf.service_occurrence_id
WHERE cf.status = 'pendiente_evidencia'
  AND tr.evidence_status = 'indisponible';


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · ¿El freno ha actuado alguna vez?
--
-- Cero renglones, o una fecha vieja y nada después, significa que la regla
-- existe y no se engancha. Medido el 19-sep: 5 entradas, todas del 3 de agosto.
-- ───────────────────────────────────────────────────────────────────

SELECT date_trunc('day', created_at) AS dia,
       count(*)                      AS retiros,
       count(DISTINCT service_occurrence_id) AS servicios
FROM ledger_entries
WHERE action = 'sin_evidencia_posible'
GROUP BY 1
ORDER BY 1;


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · La carrera: ¿dos pasadas del cron sobre el mismo servicio?
--
-- La predicción del diagnóstico: si el fallo viene de dos pasadas encimadas,
-- CADA fallo tiene un sello exitoso del MISMO servicio a segundos de
-- distancia. Si el fallo fuera del dato del servicio, estaría solo.
--
-- Medido el 19-sep: 100 % de los fallos, a 0.0 s de distancia promedio.
-- ───────────────────────────────────────────────────────────────────

WITH fallos AS (
  SELECT id, service_occurrence_id AS oc, created_at
  FROM ledger_entries
  WHERE action = 'verificacion_fallida'
    AND created_at >= now() - interval '3 days'
)
SELECT count(*)                                                        AS fallos,
       count(*) FILTER (WHERE vecina.dt <= 20)                         AS con_sello_del_mismo_servicio_a_20s,
       round(avg(vecina.dt)::numeric, 1)                               AS segundos_al_sello_mas_cercano
FROM fallos f
LEFT JOIN LATERAL (
  SELECT min(abs(extract(epoch FROM (v.created_at - f.created_at)))) AS dt
  FROM ledger_entries v
  WHERE v.service_occurrence_id = f.oc
    AND v.action = 'verificacion_automatica'
    AND v.created_at BETWEEN f.created_at - interval '2 minutes'
                         AND f.created_at + interval '2 minutes'
) vecina ON true;

-- Y el encimamiento visto de frente: sellos consecutivos del mismo servicio.
-- El cron dispara cada 60 s; todo lo que salga por debajo de eso son dos
-- pasadas vivas a la vez.
WITH v AS (
  SELECT service_occurrence_id,
         created_at,
         lag(created_at) OVER (PARTITION BY service_occurrence_id ORDER BY created_at) AS anterior
  FROM ledger_entries
  WHERE action = 'verificacion_automatica'
    AND created_at >= now() - interval '2 days'
)
SELECT count(*)                                                                   AS parejas,
       count(*) FILTER (WHERE extract(epoch FROM (created_at - anterior)) < 45)    AS a_menos_de_45s,
       round(percentile_disc(0.5) WITHIN GROUP (
         ORDER BY extract(epoch FROM (created_at - anterior)))::numeric)           AS mediana_segundos,
       round(min(extract(epoch FROM (created_at - anterior)))::numeric)            AS minimo_segundos
FROM v
WHERE anterior IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────
-- PASO 6 · Qué error, exactamente, y cuándo fue el último.
--
-- El `catch` del motor guarda el mensaje en el ledger a propósito — la verdad
-- sale del estado de la base, no del valor que devolvió la corrida.
-- ───────────────────────────────────────────────────────────────────

SELECT left(coalesce(s->'details'->>'error', '(sin texto)'), 120) AS error,
       count(*)                              AS veces,
       count(DISTINCT service_occurrence_id) AS servicios,
       min(le.created_at)                    AS primera,
       max(le.created_at)                    AS ultima
FROM ledger_entries le,
     LATERAL jsonb_array_elements(le.steps) s
WHERE le.action = 'verificacion_fallida'
  AND le.created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY veces DESC
LIMIT 10;
