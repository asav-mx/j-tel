-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0024 · posición viva — para pegar en Neon
--
-- ADITIVA: una tabla nueva y una columna nueva con default. Nada del
-- código que corre hoy conoce ninguna de las dos, así que esto se
-- aplica ANTES de desplegar el recolector, no después.
--
-- Va entera en una transacción. Si los números de la verificación no
-- cuadran, ROLLBACK y no queda nada.
--
-- Marcha atrás: packages/db/drizzle/0024_posicion_viva.reversa.sql
-- Migración versionada: packages/db/drizzle/0024_posicion_viva.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Correr esto SOLO y anotar los números.
-- Idealmente con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.live_positions') IS NOT NULL      AS ya_existe_la_tabla,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='carrier_profiles'
                  AND column_name='gps_poll_seconds')        AS ya_existe_la_columna,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public')                        AS tablas,
       (SELECT count(*) FROM compliance_facts)               AS hechos,
       (SELECT count(*) FROM service_occurrences)            AS ocurrencias,
       (SELECT count(*) FROM telemetry_points)               AS puntos,
       (SELECT count(*) FROM carrier_profiles)               AS perfiles_carrier;

-- Las dos primeras columnas deben salir FALSE. Si salen true, la migración ya
-- está aplicada y no hay nada que hacer.
-- Anota: tablas, hechos, ocurrencias, puntos, perfiles_carrier.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. De aquí al COMMIT, todo junto.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE carrier_profiles
  ADD COLUMN IF NOT EXISTS gps_poll_seconds INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN carrier_profiles.gps_poll_seconds IS
  'Cada cuántos segundos se sondea al proveedor GPS de este carrier. Configurable por carrier; nunca constante en el código.';

CREATE TABLE IF NOT EXISTS live_positions (
  imei                TEXT PRIMARY KEY,
  carrier_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id           UUID REFERENCES devices(id) ON DELETE SET NULL,
  unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  speed               DOUBLE PRECISION,
  heading             DOUBLE PRECISION,
  recorded_at         TIMESTAMPTZ NOT NULL,
  collected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE live_positions IS
  'Última posición conocida por aparato. Camino propio de la app pública: no es histórico y no crece. El histórico vive en telemetry_points.';

CREATE INDEX IF NOT EXISTS live_positions_carrier_recorded_idx
  ON live_positions (carrier_account_id, recorded_at DESC);


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, todavía DENTRO de la transacción.
-- Los cuatro renglones tienen que dar TRUE / cuadrar antes del COMMIT.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · La estructura quedó como se pidió: 11 columnas, y las tres claves.
SELECT (SELECT count(*) FROM information_schema.columns
         WHERE table_name='live_positions')                     = 11   AS columnas_ok,
       (SELECT count(*) FROM pg_indexes
         WHERE tablename='live_positions')                      = 2    AS indices_ok,
       (SELECT is_nullable FROM information_schema.columns
         WHERE table_name='carrier_profiles'
           AND column_name='gps_poll_seconds')                  = 'NO' AS cadencia_not_null,
       (SELECT column_default FROM information_schema.columns
         WHERE table_name='carrier_profiles'
           AND column_name='gps_poll_seconds')             LIKE '%30%' AS cadencia_default_30;

-- 3.2 · Ningún dato se movió. Comparar UNO A UNO con la foto del paso 1.
--       `tablas` sube exactamente en 1. Los demás son idénticos.
SELECT (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public')            AS tablas,
       (SELECT count(*) FROM compliance_facts)   AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias,
       (SELECT count(*) FROM telemetry_points)   AS puntos,
       (SELECT count(*) FROM carrier_profiles)   AS perfiles_carrier;

-- 3.3 · Todo carrier existente quedó con cadencia utilizable. Debe dar 0.
SELECT count(*) AS carriers_sin_cadencia
  FROM carrier_profiles
 WHERE gps_poll_seconds IS NULL OR gps_poll_seconds < 1;

-- 3.4 · La garantía de no-retroceso funciona en ESTA base, no solo en pruebas.
--       Cuatro sentencias SUELTAS, no una sola con CTEs: dos escrituras a la
--       misma llave dentro de un mismo comando las rechaza Postgres con
--       «ON CONFLICT DO UPDATE cannot affect row a second time». Probado.

-- 3.4a · Escribe una posición de prueba.
INSERT INTO live_positions (imei, carrier_account_id, latitude, longitude, recorded_at)
SELECT '__prueba_0024__', id, 31.70, -106.40, '2026-01-01T12:00:00Z'::timestamptz
  FROM accounts WHERE type = 'carrier' LIMIT 1;
-- Debe decir INSERT 0 1.

-- 3.4b · Intenta pisarla con un fix MÁS VIEJO. Debe decir INSERT 0 0.
INSERT INTO live_positions (imei, carrier_account_id, latitude, longitude, recorded_at)
SELECT '__prueba_0024__', id, 31.60, -106.40, '2026-01-01T11:59:00Z'::timestamptz
  FROM accounts WHERE type = 'carrier' LIMIT 1
ON CONFLICT (imei) DO UPDATE
   SET latitude = excluded.latitude, recorded_at = excluded.recorded_at
 WHERE live_positions.recorded_at < excluded.recorded_at;

-- 3.4c · La posición sigue siendo la buena. Debe dar TRUE.
SELECT latitude = 31.70 AS posicion_intacta
  FROM live_positions WHERE imei = '__prueba_0024__';

-- 3.4d · Limpia.
DELETE FROM live_positions WHERE imei = '__prueba_0024__';

-- 3.5 · No quedó basura de la prueba. Debe dar 0.
SELECT count(*) AS sobras_de_prueba
  FROM live_positions WHERE imei = '__prueba_0024__';


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si TODO cuadró:
COMMIT;
-- Si algo no cuadró:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────
