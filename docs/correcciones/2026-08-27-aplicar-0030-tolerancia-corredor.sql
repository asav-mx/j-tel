-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0030 · tolerancia del corredor — Neon
--
-- SE APLICA DESPUÉS DE LA 0029. Agrega UNA columna.
--
-- ADITIVA y sin riesgo: una columna con default sobre una tabla de dos
-- renglones. Ningún dato se mueve.
--
-- Marcha atrás: packages/db/drizzle/0030_tolerancia_corredor.reversa.sql
--
-- ⚠ SE APLICA ANTES DE MERGEAR EL CÓDIGO QUE LA NECESITA.
--   El endpoint público lee `corridorToleranceMeters`. Aditiva primero,
--   despliegue después: al revés es el hueco del 2 de agosto.
--
-- ⚠ TODAS LAS COMPROBACIONES DE ESTE RUNBOOK SON DE LECTURA.
--   La consola SQL de Neon aborta la transacción en la primera
--   sentencia que falla, así que aquí no va ninguna prueba negativa.
--   Que el CHECK muerde se comprueba contra la base de PRUEBAS, en
--   packages/db/src/circuits-constraints.integration.test.ts.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='avg_speed_kmh')             AS esta_la_0029,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='corridor_tolerance_meters') AS ya_esta_la_0030,
       (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- `esta_la_0029` TRUE · `ya_esta_la_0030` FALSE.
-- Anota `circuitos`, `hechos` y `ocurrencias`: son la foto de "antes".


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Todo esto junto, en una sola corrida.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS corridor_tolerance_meters DOUBLE PRECISION NOT NULL DEFAULT 150;

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_corredor_positivo;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_corredor_positivo CHECK (corridor_tolerance_meters > 0);

COMMENT ON COLUMN circuits.corridor_tolerance_meters IS
  'A cuantos metros del trazado deja de poderse afirmar que una unidad va en la ruta. Mas alla de esto NO se publica al pasajero: es la misma ley que el dato viejo. No confundir con stop_snap_tolerance_meters, que es para colocar una parada a mano y por eso es mucho mas estrecha.';

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='circuits'
   AND column_name IN ('corridor_tolerance_meters','stop_snap_tolerance_meters')
 ORDER BY column_name;

-- Las DOS columnas, y con valores distintos: 150 la del corredor, 25 la del
-- pegado. Que se vean juntas es a propósito — son dos conceptos, no uno.

SELECT conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conrelid='circuits'::regclass AND conname='circuits_corredor_positivo';

SELECT public_slug, corridor_tolerance_meters, stop_snap_tolerance_meters
  FROM circuits ORDER BY public_slug;

-- Los dos circuitos con 150 en la del corredor. `corredor-prueba` conserva sus
-- 120 en la de pegado, que es otra cosa y no se toca.

SELECT (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- Idénticos a la foto del PASO 1. Una migración aditiva que mueve un conteo no
-- es aditiva.
