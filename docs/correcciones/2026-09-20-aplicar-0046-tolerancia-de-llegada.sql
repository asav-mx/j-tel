-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0046 (tolerancia de llegada) en Neon
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR de
-- la comparación. ADITIVA: una sola columna en `circuits`. No toca ninguna
-- fila existente en su valor — nace en 50 (±50 %) para todos los circuitos.
-- ═══════════════════════════════════════════════════════════════════

-- PASO 1 · La columna.
ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS arrival_tolerance_pct DOUBLE PRECISION NOT NULL DEFAULT 50;

-- PASO 2 · El candado.
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_positiva;
ALTER TABLE circuits
  ADD CONSTRAINT circuits_tolerancia_llegada_positiva CHECK (arrival_tolerance_pct > 0);

-- PASO 3 · Documentar.
COMMENT ON COLUMN circuits.arrival_tolerance_pct IS
  'Cuanto se perdona alrededor del intervalo esperado, como PORCENTAJE de la frecuencia prometida (50 = +-50%), al juzgar un paso contra la promesa por franja (Marco 9.2). Por circuito, nunca escondida en el codigo. Nace ancha (50) a proposito.';

-- PASO 4 · Comprobar. NO ESCRIBE.
SELECT public_slug, arrival_tolerance_pct FROM circuits ORDER BY name;
