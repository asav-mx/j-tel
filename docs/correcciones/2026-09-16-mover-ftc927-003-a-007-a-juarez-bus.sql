-- ═══════════════════════════════════════════════════════════════════
-- Mover TK-FTC927-003 a 007 de la cuenta ASAV a Juárez Bus
-- 16 de septiembre de 2026
--
-- Para instalar 7 FTC927 en unidades de Juárez Bus. El 001 y el 008 ya son de
-- Juárez Bus; del 003 al 007 siguen en ASAV, y desde Juárez Bus la pantalla de
-- asignación ni los ve (sólo lista los dispositivos de la misma cuenta). El 002
-- se queda en ASAV, en el Jeep, y NO se toca.
--
-- No hay pantalla ni código que cambie la cuenta de un dispositivo: por eso es
-- una hoja. Y NO se resuelve dando de alta otra vez el IMEI en Juárez Bus: la
-- base lo permite (la unicidad es por cuenta), pero el mismo IMEI en dos cuentas
-- deja de escribirse en `live_positions`, abre `imei_en_dos_cuentas`, y el
-- archivador puede guardar sus puntos en ASAV y sin unidad.
--
-- ── La ley: Marco 6.14 ──────────────────────────────────────────────
-- «Un IMEI, una fila. Cambiar de carrier mueve la fila, no crea otra. Al
-- moverse, se cierra su asignación de unidad, porque el camión era del carrier
-- anterior.» Hoy ninguno de los cinco está montado (leído el 16 sep 2026), así
-- que se espera cerrar 0 asignaciones; la hoja las cierra igual, por ley.
--
-- ── Lo que NO se mueve, a propósito ─────────────────────────────────
-- - Los `telemetry_points` que estos aparatos mandaron mientras eran de ASAV
--   se quedan en ASAV. Fueron pruebas de esa cuenta; mover el pasado sería
--   reescribir historia.
-- - `live_positions` se corrige sola: el recolector reescribe la cuenta en la
--   siguiente señal (upsert por IMEI).
-- - Las marcas del archivador son por (cuenta, IMEI): en Juárez Bus cada uno
--   arranca desde la marca de la cuenta; las de ASAV quedan sin uso.
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura).
--   PASO 2 · mover (usuario dueño), dentro de BEGIN; COMMIT sólo si cuadra.
--   PASO 3 · después, de lectura.
--   Luego: confirmar el 005 en Traccar, instalar, y asignar EL MISMO DÍA.
--
-- Ensayada el 16 sep 2026 en la rama desechable, dentro de una transacción con
-- ROLLBACK y con el escenario sembrado ahí mismo: los cinco en ASAV, uno montado.
-- Movió 5 y cerró 1. Con uno de los IMEI ya en Juárez Bus, la guarda lo dejó
-- en ASAV y movió 4.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT d.label,
       d.imei,
       a.name                              AS cuenta,
       d.retired_at IS NOT NULL            AS de_baja,
       (SELECT u.label FROM device_assignments da JOIN units u ON u.id = da.unit_id
         WHERE da.device_id = d.id AND da.valid_to IS NULL LIMIT 1) AS montado_en
  FROM devices d
  JOIN accounts a ON a.id = d.carrier_account_id
 WHERE d.label LIKE 'TK-FTC927-%'
 ORDER BY d.label;

-- LO QUE DEBES VER (así estaba el 16 sep 2026):
--   TK-FTC927-001  …7409            Juárez Bus  false  (null)
--   TK-FTC927-002  860693089187232  ASAV    false  Jeep
--   TK-FTC927-003  860693086784395  ASAV    false  (null)
--   TK-FTC927-004  860693086787513  ASAV    false  (null)
--   TK-FTC927-005  860573080592335  ASAV    false  (null)
--   TK-FTC927-006  860693089234208  ASAV    false  (null)
--   TK-FTC927-007  860693086788891  ASAV    false  (null)
--   TK-FTC927-008  860693082402380  Juárez Bus  false  (null)

-- Que ninguno de los cinco IMEI exista ya en Juárez Bus (ni dado de baja):
SELECT count(*) AS ya_en_juarez_bus
  FROM devices d JOIN accounts a ON a.id = d.carrier_account_id
 WHERE a.slug = 'juarez-bus'
   AND d.imei IN ('860693086784395', '860693086787513', '860573080592335',
                  '860693089234208', '860693086788891');

-- LO QUE DEBES VER: 0. Si no es 0, NO sigas: hay una fila repetida que resolver antes.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · MOVER. Con el usuario dueño.
--
-- Una sola sentencia mueve las cinco filas y cierra sus asignaciones abiertas:
-- o pasa todo, o nada. Las guardas van DENTRO del WHERE: mismo IMEI, mismo
-- nombre, cuenta de origen ASAV, sin baja, y que el IMEI no exista ya en
-- Juárez Bus. Revisa los dos números ANTES del COMMIT.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

WITH lista(imei, label) AS (VALUES
  ('860693086784395', 'TK-FTC927-003'),
  ('860693086787513', 'TK-FTC927-004'),
  ('860573080592335', 'TK-FTC927-005'),
  ('860693089234208', 'TK-FTC927-006'),
  ('860693086788891', 'TK-FTC927-007')
),
destino AS (
  SELECT id FROM accounts WHERE slug = 'juarez-bus' AND type = 'carrier'
),
aparatos AS (
  SELECT d.id
    FROM devices d
    JOIN lista l    ON l.imei = d.imei AND l.label = d.label
    JOIN accounts o ON o.id = d.carrier_account_id AND o.slug = 'asav'
   WHERE d.retired_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM devices otro, destino
                      WHERE otro.imei = d.imei AND otro.carrier_account_id = destino.id)
),
cerradas AS (
  UPDATE device_assignments
     SET valid_to = now()
   WHERE device_id IN (SELECT id FROM aparatos)
     AND valid_to IS NULL
  RETURNING id
),
movidos AS (
  UPDATE devices
     SET carrier_account_id = (SELECT id FROM destino)
   WHERE id IN (SELECT id FROM aparatos)
  RETURNING label
)
SELECT (SELECT count(*) FROM movidos)  AS movidos,
       (SELECT count(*) FROM cerradas) AS asignaciones_cerradas;

-- LO QUE DEBES VER: movidos = 5, asignaciones_cerradas = 0.
--
-- Si cuadra:
COMMIT;
-- Si no (por ejemplo movidos < 5 porque alguno ya se había movido o cambió de
-- nombre), en lugar del COMMIT:
-- ROLLBACK;
-- y vuelve al PASO 1 para ver cuál no pasó la guarda.


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT d.label, a.name AS cuenta,
       (SELECT u.label FROM device_assignments da JOIN units u ON u.id = da.unit_id
         WHERE da.device_id = d.id AND da.valid_to IS NULL LIMIT 1) AS montado_en
  FROM devices d
  JOIN accounts a ON a.id = d.carrier_account_id
 WHERE d.label LIKE 'TK-FTC927-%'
 ORDER BY d.label;

-- LO QUE DEBES VER:
--   001, 003, 004, 005, 006, 007, 008  →  Juárez Bus, sin montar
--   002                                →  ASAV, Jeep

SELECT a.name, count(*) AS dispositivos_sin_baja
  FROM devices d JOIN accounts a ON a.id = d.carrier_account_id
 WHERE d.retired_at IS NULL AND a.type = 'carrier'
 GROUP BY a.name ORDER BY a.name;

-- LO QUE DEBES VER: ASAV 1 (el Jeep) · Juárez Bus 7.
--
-- Ahora sí, desde /carrier/flota/alta (formulario «Asignar») aparecen los siete.


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · DESPUÉS DE INSTALAR Y ASIGNAR. Con el usuario de solo lectura.
--
-- La prueba de que llegan a la unidad no es `live_positions` (ésa no guarda
-- unidad): son los puntos archivados con `unit_id`. El archivador corre cada
-- 10 minutos.
-- ───────────────────────────────────────────────────────────────────

SELECT d.label,
       u.label                 AS unidad,
       max(tp.recorded_at)     AS ultimo_punto_con_unidad,
       count(tp.*)             AS puntos_con_unidad
  FROM devices d
  JOIN accounts a ON a.id = d.carrier_account_id AND a.slug = 'juarez-bus'
  LEFT JOIN device_assignments da ON da.device_id = d.id AND da.valid_to IS NULL
  LEFT JOIN units u ON u.id = da.unit_id
  LEFT JOIN telemetry_points tp ON tp.imei = d.imei AND tp.unit_id = u.id
 WHERE d.label LIKE 'TK-FTC927-%'
 GROUP BY d.label, u.label
 ORDER BY d.label;

-- LO QUE DEBES VER: cada uno con su unidad y puntos con unidad después de la
-- instalación. Uno montado y en 0 después de 20 min con el camión encendido:
-- revisar Traccar (paso A2 de docs/Lista-Alta-Aparatos-Compas.md).


-- ═══════════════════════════════════════════════════════════════════
-- CAMINO DE REGRESO (sólo si todavía NO se asignó ninguno a una unidad)
--
-- BEGIN;
-- UPDATE devices
--    SET carrier_account_id = (SELECT id FROM accounts WHERE slug = 'asav')
--  WHERE imei IN ('860693086784395', '860693086787513', '860573080592335',
--                 '860693089234208', '860693086788891')
--    AND carrier_account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
--    AND NOT EXISTS (SELECT 1 FROM device_assignments da
--                     WHERE da.device_id = devices.id AND da.valid_to IS NULL);
-- -- esperado: UPDATE 5
-- COMMIT;
--
-- Si ya se asignaron, primero hay que soltarlos: ésa es otra hoja (6.14 otra vez).
-- ═══════════════════════════════════════════════════════════════════
