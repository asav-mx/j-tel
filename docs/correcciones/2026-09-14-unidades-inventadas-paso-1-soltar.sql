-- ═══════════════════════════════════════════════════════════════════
-- Unidades inventadas — PASO 1 de 2: soltar los GPS
-- 14 de septiembre de 2026 · ver 2026-09-14-unidades-inventadas.md
--
-- Cierra la vigencia (valid_to = now()) de las seis asignaciones abiertas
-- que ponen un FTC927 sobre una unidad que no es vehículo. No borra nada:
-- el historial de asignación queda, y se puede revertir.
--
-- Las guardas viajan DENTRO del WHERE: la unidad tiene que seguir teniendo
-- el mismo nombre, en la misma cuenta, con el mismo aparato puesto. Si algo
-- cambió entre escribir esto y pegarlo, esa fila no se toca y el conteo lo
-- delata. El Jeep (TK-FTC927-002) no está en la lista y no se toca.
--
-- Revisa los tres números de la verificación ANTES de hacer COMMIT.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

WITH lista(unit_id, unidad, cuenta, imei) AS (VALUES
  ('bae8d00a-015c-4fdc-8299-47a989053b5d'::uuid, 'PRUEBA-ESCRITORIO',           'Juárez Bus', '860693082402380'), -- FTC927 (Prueba), futuro 008
  ('105a26a3-da7d-4630-b10d-e99fc231519e'::uuid, 'Ejemplo para: TK-FTC927-002', 'ASAV',       '860693086784395'), -- TK-FTC927-003
  ('804fa214-bfcb-49de-b713-dae511fd7226'::uuid, 'TK-FTC927-003',               'ASAV',       '860693086787513'), -- TK-FTC927-004
  ('0919eddb-ce98-4261-a50d-19d915e1043e'::uuid, 'TK-FTC927-005',               'ASAV',       '860573080592335'), -- TK-FTC927-005
  ('3c3ce446-2d16-411e-ad05-a6c49d861e2c'::uuid, 'TK-FTC927-005',               'ASAV',       '860693089234208'), -- TK-FTC927-006
  ('f9d0cdb2-c9b8-413e-8213-f1a15ff76072'::uuid, 'TK-FTC927-007',               'ASAV',       '860693086788891')  -- TK-FTC927-007
),
soltadas AS (
  UPDATE device_assignments da
  SET valid_to = now()
  FROM lista l, units u, devices d, accounts a
  WHERE da.unit_id = l.unit_id
    AND da.valid_to IS NULL
    AND u.id = da.unit_id AND u.label = l.unidad
    AND a.id = u.carrier_account_id AND a.name = l.cuenta
    AND d.id = da.device_id AND d.imei = l.imei
  RETURNING da.id
)
SELECT
  (SELECT count(*) FROM soltadas) AS soltadas;
-- esperado: soltadas = 6

-- Verificación, dentro de la misma transacción
SELECT
  (SELECT count(*) FROM device_assignments
     WHERE valid_to IS NULL
       AND unit_id IN (
         'bae8d00a-015c-4fdc-8299-47a989053b5d', '105a26a3-da7d-4630-b10d-e99fc231519e',
         '804fa214-bfcb-49de-b713-dae511fd7226', '0919eddb-ce98-4261-a50d-19d915e1043e',
         '3c3ce446-2d16-411e-ad05-a6c49d861e2c', 'f9d0cdb2-c9b8-413e-8213-f1a15ff76072'
       )) AS abiertas_en_inventadas,
  (SELECT count(*) FROM device_assignments da
     JOIN units u ON u.id = da.unit_id
     JOIN devices d ON d.id = da.device_id
     WHERE da.valid_to IS NULL
       AND u.id = '9e138e45-a481-4c64-8e90-60d24d838ddf' AND u.label = 'Jeep'
       AND d.imei = '860693089187232') AS jeep_con_su_gps;
-- esperado: abiertas_en_inventadas = 0, jeep_con_su_gps = 1

-- Si los tres números cuadran (6, 0, 1):
COMMIT;
-- Si no:
-- ROLLBACK;
