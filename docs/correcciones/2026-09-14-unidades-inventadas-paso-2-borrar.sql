-- ═══════════════════════════════════════════════════════════════════
-- Unidades inventadas — PASO 2 de 2: borrar las unidades
-- 14 de septiembre de 2026 · ver 2026-09-14-unidades-inventadas.md
--
-- IRREVERSIBLE. Correr solo después de que el paso 1 hizo COMMIT.
--
-- Borrar una unidad arrastra en cascada sus asignaciones (incluida la que
-- el paso 1 cerró) y deja en NULL la unidad de sus puntos de telemetría.
-- Eso es lo buscado: el aparato sí estuvo ahí, la unidad nunca existió.
--
-- Las guardas viajan DENTRO del WHERE. Una unidad solo se borra si:
--   · sigue con el mismo nombre y en la misma cuenta,
--   · tiene exactamente UNA asignación en su vida, y ya está cerrada
--     (si el paso 1 no corrió, no se borra nada),
--   · nada más la nombra: ni perfiles, ni ocurrencias, ni evidencia, ni
--     hechos, ni circuitos, ni aportaciones, ni verdad de campo, ni
--     mediciones, ni combustible, ni mantenimiento.
-- La telemetría es la única dependencia permitida, y se cuenta antes.
--
-- Revisa los números de la verificación ANTES de hacer COMMIT.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Antes de borrar: cuántos puntos van a quedar sin unidad.
-- Al escribir esto eran 14 (12 del GPS 003 y 2 del 004).
SELECT count(*) AS puntos_que_quedan_sin_unidad
FROM telemetry_points tp
JOIN units u ON u.id = tp.unit_id AND u.carrier_account_id = tp.carrier_account_id
WHERE u.id IN (
  'bae8d00a-015c-4fdc-8299-47a989053b5d', '105a26a3-da7d-4630-b10d-e99fc231519e',
  '804fa214-bfcb-49de-b713-dae511fd7226', '0919eddb-ce98-4261-a50d-19d915e1043e',
  '3c3ce446-2d16-411e-ad05-a6c49d861e2c', 'f9d0cdb2-c9b8-413e-8213-f1a15ff76072'
);
-- esperado: 14

WITH lista(unit_id, unidad, cuenta) AS (VALUES
  ('bae8d00a-015c-4fdc-8299-47a989053b5d'::uuid, 'PRUEBA-ESCRITORIO',           'Juárez Bus'),
  ('105a26a3-da7d-4630-b10d-e99fc231519e'::uuid, 'Ejemplo para: TK-FTC927-002', 'ASAV'),
  ('804fa214-bfcb-49de-b713-dae511fd7226'::uuid, 'TK-FTC927-003',               'ASAV'),
  ('0919eddb-ce98-4261-a50d-19d915e1043e'::uuid, 'TK-FTC927-005',               'ASAV'),
  ('3c3ce446-2d16-411e-ad05-a6c49d861e2c'::uuid, 'TK-FTC927-005',               'ASAV'),
  ('f9d0cdb2-c9b8-413e-8213-f1a15ff76072'::uuid, 'TK-FTC927-007',               'ASAV')
),
borradas AS (
  DELETE FROM units u
  USING lista l, accounts a
  WHERE u.id = l.unit_id AND u.label = l.unidad
    AND a.id = u.carrier_account_id AND a.name = l.cuenta
    -- una sola asignación en su vida, y cerrada
    AND (SELECT count(*) FROM device_assignments WHERE unit_id = u.id) = 1
    AND NOT EXISTS (SELECT 1 FROM device_assignments WHERE unit_id = u.id AND valid_to IS NULL)
    -- nada más la nombra
    AND NOT EXISTS (SELECT 1 FROM service_profiles              WHERE reference_unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM service_profile_units         WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM service_occurrences           WHERE reference_unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM evidence_points               WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM compliance_facts              WHERE reference_unit_id = u.id OR observed_unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM circuit_unit_assignments      WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM carrier_aportaciones          WHERE declared_unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM occurrence_ground_truth       WHERE operator_unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM route_traversal_measurements  WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM fuel_records                  WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM maintenance_records           WHERE unit_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM live_positions                WHERE unit_id = u.id)
  RETURNING u.id
)
SELECT (SELECT count(*) FROM borradas) AS borradas;
-- esperado: borradas = 6

-- Verificación, dentro de la misma transacción
SELECT
  (SELECT count(*) FROM units WHERE id IN (
     'bae8d00a-015c-4fdc-8299-47a989053b5d', '105a26a3-da7d-4630-b10d-e99fc231519e',
     '804fa214-bfcb-49de-b713-dae511fd7226', '0919eddb-ce98-4261-a50d-19d915e1043e',
     '3c3ce446-2d16-411e-ad05-a6c49d861e2c', 'f9d0cdb2-c9b8-413e-8213-f1a15ff76072'
   )) AS inventadas_que_quedan,
  (SELECT count(*) FROM units
     WHERE id = '9e138e45-a481-4c64-8e90-60d24d838ddf' AND label = 'Jeep') AS jeep;
-- esperado: inventadas_que_quedan = 0, jeep = 1

-- Si los cuatro números cuadran (14, 6, 0, 1):
COMMIT;
-- Si no:
-- ROLLBACK;
