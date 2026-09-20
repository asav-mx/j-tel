-- ═══════════════════════════════════════════════════════════════════
-- El después: ¿el freno está mordiendo? (20-sep-2026, tras el #463 en prod)
--
-- TODA ESTA HOJA ES DE LECTURA. Cuatro pasos, ninguno escribe. Se corre con
--   el usuario de SOLO LECTURA.
--
-- Contra qué se compara: lo que Asav midió el 19-sep antes del arreglo —
--   4 329 516 entradas de ledger, 2 591 de 2 722 viajes con contador
--   rellenado, y el hallazgo real: el peor no era el del 7-sep, eran los
--   CINCO DE JUNIO en `sin_evidencia_posible` desde julio, con 32 196
--   intentos cada uno — el lazo llevaba ONCE SEMANAS (8-jul → 19-sep), no
--   doce días. Ésos ya los había alcanzado el freno de agosto; los nuevos
--   —los 365 de septiembre, `tecma`/`juarez-bus`— son los que este PASO 1 y
--   PASO 2 tienen que enseñar retirados.
--
-- Las dos preguntas que pidió Asav: cuántos atorados quedan (PASO 1), y que
-- los sellos por hora hayan caído a cero (PASO 2). PASO 3 confirma que el
-- retiro quedó escrito con su ley (3.10b, `ventana_cerrada_vacia`) y no en
-- silencio. PASO 4 es la llave: que ninguna pasada se haya vuelto a encimar.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · Cuántos atorados quedan.
--
-- Antes: 365, con el freno de la regla vieja alcanzando a 0. Después de
-- conectar el freno a `sin_senal` (3.10b), lo esperable es que la mayoría se
-- haya retirado en cuanto cada uno acumuló sus intentos previos, sin esperar
-- los 14 días de respaldo. Que quede alguno no es necesariamente un defecto:
-- puede ser uno cuya ventana el archivador todavía no rebasa
-- (`memoria_no_alcanza`), y ÉSE tiene que seguir en la cola — es paciencia,
-- no falla.
-- ───────────────────────────────────────────────────────────────────

SELECT count(*)                                                             AS en_estado_de_reintento,
       count(*) FILTER (WHERE tr.evidence_window_end < now() - interval '14 days') AS ya_pasaron_los_14_dias,
       min(tr.evidence_window_end)                                          AS ventana_mas_vieja,
       max(tr.evidence_window_end)                                          AS ventana_mas_nueva,
       min(tr.ultimo_intento_at)                                            AS intento_mas_viejo,
       max(tr.ultimo_intento_at)                                            AS intento_mas_nuevo
FROM compliance_facts cf
JOIN trips tr ON tr.service_occurrence_id = cf.service_occurrence_id
WHERE cf.status = 'pendiente_evidencia'
  AND tr.evidence_status = 'indisponible';

-- El detalle, por transportista y por qué siguen ahí.
SELECT ca.slug                        AS transportista,
       count(*)                       AS atorados,
       min(tr.evidence_window_end)    AS ventana_mas_vieja,
       max(tr.intentos_de_verificacion) AS mas_intentos
FROM compliance_facts cf
JOIN trips tr              ON tr.service_occurrence_id = cf.service_occurrence_id
JOIN service_occurrences o ON o.id = cf.service_occurrence_id
JOIN service_contracts sc  ON sc.id = o.contract_id
JOIN accounts ca            ON ca.id = sc.carrier_account_id
WHERE cf.status = 'pendiente_evidencia'
  AND tr.evidence_status = 'indisponible'
GROUP BY ca.slug
ORDER BY atorados DESC;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · Los sellos por hora, ¿cayeron a cero?
--
-- Antes del arreglo: ~21 900 por hora, estable durante días. El motor sólo
-- se detuvo el 19-sep por la pausa de los tres contratos —un accidente, no
-- el arreglo—. Con el arreglo puesto Y esos contratos siguiendo en pausa
-- (Asav no reanuda antes del 21-sep), lo esperable es CERO: no queda
-- ningún servicio pendiente fuera de pausa que valga la pena resellar cada
-- pasada, y lo que sí se sella —servicios nuevos, primer veredicto— no se
-- parece en nada a 21 900/hora.
--
-- Si sale un número intermedio y no cero, no es necesariamente el lazo
-- viejo: puede ser el tráfico normal de servicios nuevos venciendo. El PASO
-- 1 de la hoja del 19-sep (`por_servicio`) distingue las dos cosas: sano es
-- 3-4 entradas por servicio, lazo es miles.
-- ───────────────────────────────────────────────────────────────────

SELECT date_trunc('hour', created_at) AS hora, count(*)::int AS sellos
FROM ledger_entries
WHERE action = 'verificacion_automatica'
  AND created_at >= now() - interval '24 hours'
GROUP BY 1
ORDER BY 1;

-- Y la forma completa desde el momento del despliegue: sano es 3-4
-- entradas por servicio; si algo sigue mal, aquí vuelve a saltar.
SELECT action,
       count(*)                                          AS entradas,
       count(DISTINCT service_occurrence_id)              AS servicios,
       round(count(*)::numeric
             / nullif(count(DISTINCT service_occurrence_id), 0), 1) AS por_servicio
FROM ledger_entries
WHERE created_at >= now() - interval '6 hours'
GROUP BY action
ORDER BY entradas DESC;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · El retiro quedó escrito, con su ley, y no en silencio.
--
-- Antes: `sin_evidencia_posible` sólo tenía las 5 entradas de junio (3-ago).
-- Con el freno replanteado, deberían aparecer entradas NUEVAS —del 20-sep en
-- adelante— con `result = 'ventana_cerrada_vacia'` para los de septiembre.
-- ───────────────────────────────────────────────────────────────────

SELECT date_trunc('day', created_at) AS dia,
       s->0->'result'                AS razon,
       count(*)::int                 AS retiros,
       count(DISTINCT service_occurrence_id)::int AS servicios
FROM ledger_entries,
     LATERAL (SELECT steps AS s) x
WHERE action = 'sin_evidencia_posible'
GROUP BY 1, 2
ORDER BY 1;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · La llave: ¿alguna pasada se volvió a encimar?
--
-- Antes: 41 % de los sellos consecutivos del mismo servicio a menos de 45 s.
-- Con el candado de `pg_try_advisory_lock` en su lugar, esto tiene que ser
-- CERO desde el despliegue: dos pasadas ya no pueden tocar el mismo servicio
-- a la vez, sin importar la cola.
-- ───────────────────────────────────────────────────────────────────

WITH v AS (
  SELECT service_occurrence_id, created_at,
         lag(created_at) OVER (PARTITION BY service_occurrence_id ORDER BY created_at) AS anterior
  FROM ledger_entries
  WHERE action = 'verificacion_automatica'
    AND created_at >= now() - interval '6 hours'
)
SELECT count(*)                                                                AS parejas,
       count(*) FILTER (WHERE extract(epoch FROM (created_at - anterior)) < 45) AS encimadas,
       round(min(extract(epoch FROM (created_at - anterior)))::numeric)         AS minimo_segundos
FROM v
WHERE anterior IS NOT NULL;

-- Y que `saveFact` no vuelva a reventar: cero fallos nuevos de esa firma
-- desde el despliegue.
SELECT count(*)::int AS fallos_desde_el_despliegue
FROM ledger_entries le,
     LATERAL jsonb_array_elements(le.steps) s
WHERE le.action = 'verificacion_fallida'
  AND le.created_at >= now() - interval '6 hours'
  AND (s->'details'->>'error') LIKE '%reading ''status''%';
