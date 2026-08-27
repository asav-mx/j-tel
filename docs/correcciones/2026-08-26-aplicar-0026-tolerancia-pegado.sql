-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0026 · tolerancia de pegado de paradas — para pegar en Neon
--
-- SE APLICA DESPUÉS DE LA 0025. Si la 0025 no está, esto falla con
-- «relation "circuits" does not exist», que es la señal correcta.
--
-- ADITIVA: una columna con default sobre una tabla que todavía no
-- tiene filas en producción. Nada que migrar, nada que respaldar.
--
-- Marcha atrás: packages/db/drizzle/0026_tolerancia_pegado.reversa.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.circuits') IS NOT NULL                      AS existe_la_0025,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits'
                  AND column_name='stop_snap_tolerance_meters')        AS ya_esta_aplicada,
       (SELECT count(*) FROM circuits)                                 AS circuitos;

-- `existe_la_0025` debe ser TRUE y `ya_esta_aplicada` FALSE.
-- Anota `circuitos`: al terminar tiene que ser el mismo número.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS stop_snap_tolerance_meters DOUBLE PRECISION NOT NULL DEFAULT 25;

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_tolerancia_positiva;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_tolerancia_positiva CHECK (stop_snap_tolerance_meters > 0);

COMMENT ON COLUMN circuits.stop_snap_tolerance_meters IS
  'A partir de cuántos metros del trazado el pegado de una parada deja de ser obvio y la pantalla avisa, ofreciendo soltarlo. Por circuito: una calle del Centro y una avenida no admiten el mismo margen.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · La columna quedó con su tipo, su NOT NULL y su default. TRUE.
SELECT data_type = 'double precision'
   AND is_nullable = 'NO'
   AND column_default LIKE '%25%'  AS columna_ok
  FROM information_schema.columns
 WHERE table_name='circuits' AND column_name='stop_snap_tolerance_meters';

-- 3.2 · El CHECK existe. Debe dar 1.
SELECT count(*) AS check_puesto
  FROM information_schema.table_constraints
 WHERE table_name='circuits' AND constraint_name='circuits_tolerancia_positiva';

-- 3.3 · Ningún circuito quedó sin tolerancia utilizable. Debe dar 0.
SELECT count(*) AS circuitos_sin_tolerancia
  FROM circuits
 WHERE stop_snap_tolerance_meters IS NULL OR stop_snap_tolerance_meters <= 0;

-- 3.4 · El número de circuitos no se movió. Comparar con el paso 1.
SELECT count(*) AS circuitos FROM circuits;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si todo cuadró:
COMMIT;
-- Si no:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────
