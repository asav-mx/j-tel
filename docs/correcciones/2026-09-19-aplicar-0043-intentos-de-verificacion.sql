-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0043 (intentos de verificación) en producción
--
-- Se corre en el editor de Neon, **un PASO a la vez**, ANTES de mergear el PR
-- del lazo. Es la regla de la casa: migración primero, merge después.
--
-- ⚠ ESTA HOJA SÍ ESCRIBE. Es la única de este frente que lo hace, y lo que
--    escribe es aditivo: tres columnas nuevas y un relleno que las llena.
--    **NO BORRA NINGUNA ENTRADA DEL LEDGER.** Los 4 163 318 renglones se
--    quedan donde están: son hechos, y son la evidencia del diagnóstico.
--    Lo que hace el PASO 3 es LEERLOS para que la verdad que contienen
--    —cuántas veces se intentó, desde cuándo y hasta cuándo— siga estando
--    después de que el motor deje de escribirlos.
--
-- Qué hace falta antes: nada. La 0043 no depende de despliegue y el código
-- viejo no conoce estas columnas, así que se puede aplicar con el motor
-- corriendo.
--
-- Después de aplicarla se mergea el PR. Y con el PR desplegado, la hoja de
-- medición `2026-09-19-medir-lazo-de-reverificacion.sql` tiene que enseñar
-- otros números: ésa es la prueba de que sirvió.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 0 · El antes, para poder comparar. NO ESCRIBE.
--
-- Guarda estos tres números: son contra los que se va a medir el arreglo.
-- ───────────────────────────────────────────────────────────────────

SELECT (SELECT count(*) FROM ledger_entries
         WHERE action = 'verificacion_automatica')                AS sellos_en_total,
       (SELECT count(*) FROM ledger_entries
         WHERE action = 'verificacion_automatica'
           AND created_at >= now() - interval '24 hours')         AS sellos_ultimas_24h,
       (SELECT count(*) FROM compliance_facts cf
          JOIN trips tr ON tr.service_occurrence_id = cf.service_occurrence_id
         WHERE cf.status = 'pendiente_evidencia'
           AND tr.evidence_status = 'indisponible')               AS atorados_en_la_cola;


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · Las tres columnas. Aditivo, nadie las lee todavía.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE trips ADD COLUMN IF NOT EXISTS intentos_de_verificacion INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS primer_intento_at TIMESTAMPTZ;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS ultimo_intento_at TIMESTAMPTZ;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · El candado: un contador de intentos no puede ser negativo.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_intentos_no_negativos;

ALTER TABLE trips ADD CONSTRAINT trips_intentos_no_negativos
  CHECK (intentos_de_verificacion >= 0);


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · El relleno. LEE el ledger, no lo toca.
--
-- Tarda unos segundos: recorre `ledger_entries` entera una vez. No bloquea
-- lecturas y el motor puede seguir corriendo mientras.
--
-- Se cuentan las DOS acciones que sellan —la pasada de eliminación escribe la
-- misma carga con otro nombre— para no perder los intentos de esos servicios.
-- ───────────────────────────────────────────────────────────────────

UPDATE trips t
   SET intentos_de_verificacion = x.intentos,
       primer_intento_at        = x.primero,
       ultimo_intento_at        = x.ultimo
  FROM (
    SELECT trip_id,
           count(*)        AS intentos,
           min(created_at) AS primero,
           max(created_at) AS ultimo
      FROM ledger_entries
     WHERE action IN ('verificacion_automatica', 'eliminacion_candidatas')
     GROUP BY trip_id
  ) x
 WHERE t.id = x.trip_id;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Comprobar el efecto. NO ESCRIBE.
--
-- `el_peor` tiene que parecerse a las 17 637 del diagnóstico, y
-- `entradas_de_ledger` tiene que seguir igual que en el PASO 0: el relleno
-- copia, no mueve.
-- ───────────────────────────────────────────────────────────────────

SELECT count(*)                                              AS viajes,
       count(*) FILTER (WHERE intentos_de_verificacion > 0)  AS con_intentos,
       max(intentos_de_verificacion)                         AS el_peor,
       min(primer_intento_at)                                AS el_primer_intento_de_todos,
       max(ultimo_intento_at)                                AS el_ultimo
FROM trips;

-- El ledger sigue intacto: este número debe ser IDÉNTICO al del PASO 0.
SELECT count(*) AS entradas_de_ledger
FROM ledger_entries
WHERE action = 'verificacion_automatica';


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · Los peores, con su cuenta ya como estado.
--
-- Es la misma verdad que vivía en 17 637 renglones, ahora en uno.
-- ───────────────────────────────────────────────────────────────────

SELECT ca.slug                    AS transportista,
       o.service_date             AS fecha_del_servicio,
       tr.intentos_de_verificacion AS intentos,
       tr.primer_intento_at       AS desde,
       tr.ultimo_intento_at       AS hasta,
       cf.status                  AS veredicto,
       tr.evidence_status         AS evidencia
FROM trips tr
JOIN service_occurrences o ON o.id = tr.service_occurrence_id
JOIN service_contracts sc  ON sc.id = o.contract_id
JOIN accounts ca           ON ca.id = sc.carrier_account_id
LEFT JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
ORDER BY tr.intentos_de_verificacion DESC
LIMIT 10;
