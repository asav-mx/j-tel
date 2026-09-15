-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0036 y dar de baja los 82 aparatos de Umbrella
--
-- SE APLICA DESPUÉS DE LA 0035.
--
-- ⚠ EL ORDEN ES AL REVÉS QUE EN LA 0035: LA MIGRACIÓN VA ANTES DEL MERGE.
--   El código nuevo lee `devices.retired_at` con la API relacional de
--   Drizzle, que pide TODAS las columnas. Desplegado contra una base sin la
--   columna, revienta en cada pantalla que lee aparatos (la lección de la
--   0016). La migración es aditiva: el código de hoy la ignora sin problema.
--
--   1. PASO 1 · antes, de lectura.
--   2. PASO 2 · la migración.
--   3. PASO 3 · comprobarla, en otra transacción (trampa del enum, 0025).
--   4. Mergear y desplegar el PR. Nada cambia todavía: nadie tiene baja.
--   5. PASO 4 · la baja de los 82, en una transacción que cuenta.
--   6. PASO 5 · comprobar que la alarma quedó en cero.
--
-- El camino de regreso está al final.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
--
-- El criterio de la baja, escrito una sola vez y usado igual en el PASO 4:
-- aparatos de Juárez Bus cuyo ÚLTIMO punto archivado es anterior al corte de
-- Umbrella (5 sep 2026, 15:20:04Z el último) y que no tienen posición en vivo
-- después del corte. Los 2 de Compás quedan fuera solos: tienen datos de
-- después.
-- ───────────────────────────────────────────────────────────────────

WITH ultimos AS (
  SELECT d.id, d.imei, d.label, max(t.recorded_at) AS ultimo_punto
    FROM devices d
    JOIN accounts a ON a.id = d.carrier_account_id
    JOIN telemetry_points t ON t.imei = d.imei
   WHERE a.slug = 'juarez-bus'
   GROUP BY d.id, d.imei, d.label
)
SELECT
  (SELECT count(*) FROM devices d JOIN accounts a ON a.id = d.carrier_account_id
    WHERE a.slug = 'juarez-bus')                                          AS aparatos_juarez_bus,
  count(*) FILTER (WHERE ultimo_punto < '2026-09-05T16:00:00Z'
    AND NOT EXISTS (SELECT 1 FROM live_positions lp
                     WHERE lp.imei = ultimos.imei
                       AND lp.recorded_at >= '2026-09-05T16:00:00Z'))    AS se_dan_de_baja,
  count(*) FILTER (WHERE ultimo_punto >= '2026-09-05T16:00:00Z')          AS siguen_en_servicio
FROM ultimos;

-- LO QUE DEBES VER (14 sep 2026):
--   aparatos_juarez_bus  84
--   se_dan_de_baja       82
--   siguen_en_servicio    2   <- los FTC927 de Compás
--
-- Si `se_dan_de_baja` no es 82, PARA: la flota cambió desde que se escribió
-- esta hoja y la lista hay que revisarla antes de marcar nada.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Sin BEGIN: cada sentencia sola.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_reason text;

DO $$ BEGIN
  ALTER TABLE devices ADD CONSTRAINT devices_baja_con_motivo
    CHECK ((retired_at IS NULL) = (retired_reason IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN devices.retired_at IS
  'Cuando el aparato salio de servicio. La fila no se borra: sus puntos, asignaciones y veredictos siguen apuntando aqui. Va junto con retired_reason (0036).';
COMMENT ON COLUMN devices.retired_reason IS
  'Por que salio de servicio, en palabras de quien lo dio de baja. Obligatorio si hay retired_at (0036).';

ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_de_baja_transmite';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · COMPROBAR. Ya fuera de la transacción del PASO 2.
-- ───────────────────────────────────────────────────────────────────

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name IN ('retired_at', 'retired_reason')) AS columnas,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'devices_baja_con_motivo')    AS candado_motivo,
  (SELECT count(*) FROM devices WHERE retired_at IS NOT NULL)                       AS ya_de_baja,
  'aparato_de_baja_transmite' = ANY (enum_range(NULL::ingest_alert_kind)::text[])   AS tipo_de_aviso;

-- LO QUE DEBES VER:
--   columnas 2 · candado_motivo 1 · ya_de_baja 0 · tipo_de_aviso true
--
-- Ahora sí: mergear y desplegar el PR, y esperar a que termine.


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · LA BAJA DE LOS 82. Con el usuario dueño, después del despliegue.
--
-- Cada aparato lleva en su motivo SU PROPIA fecha de último dato: no todos
-- murieron el día del corte (48 sí; 22 estaban callados desde antes de agosto).
-- Decir «cortó el 5 de septiembre» de uno que no transmitía desde julio sería
-- una afirmación falsa escrita en la fila.
--
-- No toca asignaciones, puntos ni veredictos: sólo dos columnas.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

WITH ultimos AS (
  SELECT d.id, d.imei, max(t.recorded_at) AS ultimo_punto
    FROM devices d
    JOIN accounts a ON a.id = d.carrier_account_id
    JOIN telemetry_points t ON t.imei = d.imei
   WHERE a.slug = 'juarez-bus' AND d.retired_at IS NULL
   GROUP BY d.id, d.imei
),
de_baja AS (
  SELECT id, ultimo_punto FROM ultimos
   WHERE ultimo_punto < '2026-09-05T16:00:00Z'
     AND NOT EXISTS (SELECT 1 FROM live_positions lp
                      WHERE lp.imei = ultimos.imei
                        AND lp.recorded_at >= '2026-09-05T16:00:00Z')
)
UPDATE devices d
   SET retired_at = now(),
       retired_reason = 'Aparato de Umbrella. Umbrella cortó la transmisión el 5 sep 2026; el último dato de este aparato es del '
                        || to_char(de_baja.ultimo_punto AT TIME ZONE 'America/Ciudad_Juarez', 'DD/MM/YYYY')
                        || '.'
  FROM de_baja
 WHERE d.id = de_baja.id;
-- DEBE decir UPDATE 82. Si dice otra cosa: ROLLBACK;

SELECT count(*) AS de_baja,
       count(*) FILTER (WHERE retired_reason LIKE '%5 sep 2026; el último dato de este aparato es del 05/09/2026.') AS murieron_el_dia_del_corte
  FROM devices WHERE retired_at IS NOT NULL;
-- DEBE decir 82 y 48. Si no: ROLLBACK;

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · COMPROBAR QUE LA ALARMA QUEDÓ EN CERO. Dos minutos después.
-- ───────────────────────────────────────────────────────────────────

SELECT kind, left(message, 120) AS mensaje, created_at
  FROM ingest_alerts
 WHERE resolved_at IS NULL
   AND kind::text IN ('aparato_sin_dueno', 'aparato_otro_proveedor', 'aparato_fuera_de_compas',
                      'imei_en_dos_cuentas', 'aparato_de_baja_transmite');

-- LO QUE DEBES VER:
--   aparato_fuera_de_compas   NINGUNA fila: el aviso de los 82 se cerró solo.
--   aparato_sin_dueno         el 5.º (…787513), sólo si todavía no se da de
--                             alta en la flota de asav. Es verdad, no ruido.
--   ninguna otra.


-- ═══════════════════════════════════════════════════════════════════
-- EL CAMINO DE REGRESO — en orden inverso, sólo hasta donde haga falta
-- ═══════════════════════════════════════════════════════════════════

-- R4 · Quitar la baja de los 82. No borra nada; la alarma los vuelve a listar.
BEGIN;
UPDATE devices SET retired_at = NULL, retired_reason = NULL
 WHERE retired_reason LIKE 'Aparato de Umbrella. Umbrella cortó la transmisión el 5 sep 2026;%';
-- DEBE decir UPDATE 82. Si no: ROLLBACK;
COMMIT;

-- R-código · Vercel → Instant Rollback al despliegue anterior. SÓLO si hace
--   falta regresar también la migración; si no, el código nuevo con R4 corrido
--   se comporta como antes.

-- R2 · Regresar la migración: `packages/db/drizzle/0036_baja_de_aparatos.reversa.sql`.
--   SÓLO después de regresar el código: el código de la 0036 lee estas columnas.
