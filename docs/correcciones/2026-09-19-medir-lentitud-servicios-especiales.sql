-- ═══════════════════════════════════════════════════════════════════
-- Medir la lentitud de Servicios especiales (Vernier V1, #445)
--
-- TODA ESTA HOJA ES DE LECTURA. Se corre con el usuario de SOLO LECTURA.
--   EXPLAIN ANALYZE sí ejecuta cada consulta —así mide lo que tarda de
--   verdad—, pero son SELECT: no escriben nada. Ninguna sentencia de esta
--   hoja falla a propósito.
--
-- Por qué existe: el cronómetro (#427) dice que al abrir la lista el 97–99 %
-- del tiempo se va en «datos» (3.7 a 12.7 s el 19 sep), no en la guardia, ni
-- en dibujar, ni en precargas. «Datos» junta cuatro consultas y el cronómetro
-- no las separa. Esta hoja las mide una por una, con el SQL EXACTO que la
-- pantalla manda (sacado del registro de consultas de Drizzle, no reescrito).
--
-- Cómo correrla: una sentencia a la vez. De cada PASO pega el resultado
-- completo (el plan entero, todas las líneas) en el chat.
--
-- La cuenta: todas las consultas usan la cuenta de `slug = 'juarez-bus'`. Si
-- abriste Servicios especiales con otra cuenta, cambia el slug en cada paso
-- (el PASO 1 te dice cuáles tienen hechos este mes).
--
-- Dos diferencias con lo que manda la pantalla, dichas para que nadie las
-- confunda con el problema:
--   · la pantalla manda el id de la cuenta como parámetro; aquí va como
--     `(SELECT id FROM accounts WHERE slug = …)`. Para una igualdad por id el
--     plan es el mismo;
--   · el PASO 5 manda la lista de ocurrencias como subconsulta; la pantalla la
--     manda como lista de ids (`IN ($1, $2, …)`). Lo caro de esa consulta es
--     lo que hace por cada renglón, no cómo los encuentra.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · Qué cuentas tienen algo que medir, y el tamaño de lo que se lee.
-- ───────────────────────────────────────────────────────────────────

SELECT a.slug,
       count(f.id) FILTER (WHERE f.expected_deadline >= '2026-09-01 06:00:00+00') AS hechos_este_mes,
       count(f.id) FILTER (WHERE f.expected_deadline >= '2026-09-18 06:00:00+00'
                             AND f.expected_deadline <  '2026-09-19 06:00:00+00') AS hechos_ayer_18_sep
  FROM accounts a
  JOIN service_contracts c ON c.carrier_account_id = a.id AND c.status <> 'draft'
  JOIN service_occurrences o ON o.contract_id = c.id
  LEFT JOIN compliance_facts f ON f.service_occurrence_id = o.id
 GROUP BY a.slug
 ORDER BY hechos_este_mes DESC;

-- LO QUE DEBES VER: una fila por transportista con contrato. Si la de
-- juarez-bus no es la que abriste, usa el slug de la tuya en los pasos que siguen.


-- 1b. El tamaño de lo que la consulta del ledger abre (PASO 5).
SELECT count(*)                                  AS entradas_que_sellan_este_mes,
       round(avg(pg_column_size(le.steps)))      AS bytes_promedio_por_entrada,
       max(pg_column_size(le.steps))             AS bytes_maximo,
       count(DISTINCT le.service_occurrence_id)  AS ocurrencias_con_entrada
  FROM ledger_entries le
  JOIN service_occurrences o ON o.id = le.service_occurrence_id
  JOIN service_contracts c   ON c.id = o.contract_id
 WHERE c.carrier_account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
   AND le.action IN ('verificacion_automatica', 'eliminacion_candidatas')
   AND o.expected_deadline >= '2026-09-01 06:00:00+00';

-- 1c. El tamaño de la historia de sellos y sus índices (PASO 4 la consulta por renglón).
SELECT (SELECT count(*) FROM compliance_fact_history) AS filas_en_historia,
       (SELECT string_agg(indexname, ', ') FROM pg_indexes
         WHERE tablename = 'compliance_fact_history')  AS indices_de_historia;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · Los contratos de la cuenta (la pantalla la manda DOS veces).
-- ───────────────────────────────────────────────────────────────────

EXPLAIN (ANALYZE, BUFFERS)
select "id", "name", "policy" ->> 'timeZone' from "service_contracts" where ("service_contracts"."carrier_account_id" = (SELECT id FROM accounts WHERE slug = 'juarez-bus') and "service_contracts"."status" <> 'draft') order by "service_contracts"."name" asc, "service_contracts"."created_at" asc;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · La zona del mercado (también va DOS veces).
-- ───────────────────────────────────────────────────────────────────

EXPLAIN (ANALYZE, BUFFERS)
select "markets"."time_zone" from "accounts" inner join "markets" on "markets"."id" = "accounts"."market_id" where "accounts"."id" = (SELECT id FROM accounts WHERE slug = 'juarez-bus') limit 1;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Las ocurrencias selladas. Dos ventanas: «Ayer» (la que abre por
--          omisión) y «Este mes» (la más grande).
-- ───────────────────────────────────────────────────────────────────

-- 4a. Ayer (jue 18 sep en Juárez).
EXPLAIN (ANALYZE, BUFFERS)
select "service_occurrences"."id", "service_occurrences"."service_date", "service_contracts"."id", "service_contracts"."name", "routes"."name", "shifts"."id", "shifts"."name", "compliance_facts"."status", "compliance_facts"."timing", "compliance_facts"."observed_arrival_at", "compliance_facts"."expected_deadline", "compliance_facts"."contract_policy_snapshot" -> 'toleranceMinutes', "compliance_facts"."late_excusable", "compliance_facts"."excusable_reason", "units"."label", "compliance_facts"."materialized_at", EXISTS (SELECT 1 FROM "compliance_fact_history" h WHERE h.service_occurrence_id = "service_occurrences"."id") from "compliance_facts" inner join "service_occurrences" on "service_occurrences"."id" = "compliance_facts"."service_occurrence_id" inner join "service_contracts" on "service_contracts"."id" = "service_occurrences"."contract_id" inner join "route_shifts" on "route_shifts"."id" = "service_occurrences"."route_shift_id" inner join "routes" on "routes"."id" = "route_shifts"."route_id" inner join "shifts" on "shifts"."id" = "route_shifts"."shift_id" left join "units" on "units"."id" = "compliance_facts"."observed_unit_id" where ("service_contracts"."carrier_account_id" = (SELECT id FROM accounts WHERE slug = 'juarez-bus') and "compliance_facts"."expected_deadline" >= '2026-09-18 06:00:00+00' and "compliance_facts"."expected_deadline" <= '2026-09-19 05:59:59.999+00') order by "service_occurrences"."service_date" desc, "compliance_facts"."expected_deadline" asc;

-- 4b. Este mes (del 1 sep a hoy).
EXPLAIN (ANALYZE, BUFFERS)
select "service_occurrences"."id", "service_occurrences"."service_date", "service_contracts"."id", "service_contracts"."name", "routes"."name", "shifts"."id", "shifts"."name", "compliance_facts"."status", "compliance_facts"."timing", "compliance_facts"."observed_arrival_at", "compliance_facts"."expected_deadline", "compliance_facts"."contract_policy_snapshot" -> 'toleranceMinutes', "compliance_facts"."late_excusable", "compliance_facts"."excusable_reason", "units"."label", "compliance_facts"."materialized_at", EXISTS (SELECT 1 FROM "compliance_fact_history" h WHERE h.service_occurrence_id = "service_occurrences"."id") from "compliance_facts" inner join "service_occurrences" on "service_occurrences"."id" = "compliance_facts"."service_occurrence_id" inner join "service_contracts" on "service_contracts"."id" = "service_occurrences"."contract_id" inner join "route_shifts" on "route_shifts"."id" = "service_occurrences"."route_shift_id" inner join "routes" on "routes"."id" = "route_shifts"."route_id" inner join "shifts" on "shifts"."id" = "route_shifts"."shift_id" left join "units" on "units"."id" = "compliance_facts"."observed_unit_id" where ("service_contracts"."carrier_account_id" = (SELECT id FROM accounts WHERE slug = 'juarez-bus') and "compliance_facts"."expected_deadline" >= '2026-09-01 06:00:00+00' and "compliance_facts"."expected_deadline" <= now()) order by "service_occurrences"."service_date" desc, "compliance_facts"."expected_deadline" asc;


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · Los pasos del ledger de esas ocurrencias. Mismas dos ventanas.
-- ───────────────────────────────────────────────────────────────────

-- 5a. Ayer.
EXPLAIN (ANALYZE, BUFFERS)
select "service_occurrence_id", "action", "created_at", EXISTS (SELECT 1 FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'evidencia' AND s->>'result' = 'indisponible'), (SELECT s FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'decision' LIMIT 1), (SELECT s FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'cobertura_evidencia' LIMIT 1) from "ledger_entries" where ("ledger_entries"."service_occurrence_id" in (
  select o.id from compliance_facts f join service_occurrences o on o.id = f.service_occurrence_id join service_contracts c on c.id = o.contract_id
   where c.carrier_account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
     and f.expected_deadline >= '2026-09-18 06:00:00+00' and f.expected_deadline <= '2026-09-19 05:59:59.999+00'
) and "ledger_entries"."action" in ('verificacion_automatica', 'eliminacion_candidatas'));

-- 5b. Este mes.
EXPLAIN (ANALYZE, BUFFERS)
select "service_occurrence_id", "action", "created_at", EXISTS (SELECT 1 FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'evidencia' AND s->>'result' = 'indisponible'), (SELECT s FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'decision' LIMIT 1), (SELECT s FROM jsonb_array_elements("steps") s WHERE s->>'step' = 'cobertura_evidencia' LIMIT 1) from "ledger_entries" where ("ledger_entries"."service_occurrence_id" in (
  select o.id from compliance_facts f join service_occurrences o on o.id = f.service_occurrence_id join service_contracts c on c.id = o.contract_id
   where c.carrier_account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
     and f.expected_deadline >= '2026-09-01 06:00:00+00' and f.expected_deadline <= now()
) and "ledger_entries"."action" in ('verificacion_automatica', 'eliminacion_candidatas'));

-- LO QUE DEBES VER en cada EXPLAIN: al final, «Execution Time: … ms». Ése es
-- el número. Arriba, el plan: pégalo entero, que ahí se ve en qué renglón se
-- va el tiempo (y «Buffers: … read=» dice cuánto se leyó de disco).
