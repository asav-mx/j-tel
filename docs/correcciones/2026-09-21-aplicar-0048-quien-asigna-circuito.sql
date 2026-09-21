-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0048 (quién asigna y quién suelta en un circuito)
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- «el carrier asigna sus unidades». ADITIVA: dos columnas nulas. No toca
-- ninguna fila existente.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST).
--   2. En PRODUCCIÓN — la corre Asav.
--
-- Requisito: la 0047 ya aplicada (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado: tabla_0047 = 1, columnas_0048 = 0 (todavía no existen).
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'circuit_detection_marks')                        AS tabla_0047,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuit_unit_assignments'
      AND column_name IN ('asignada_por', 'cerrada_por'))                AS columnas_0048;


-- PASO 1 · Las columnas.
ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS asignada_por text;
ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS cerrada_por text;


-- PASO 2 · Documentar en el catálogo.
COMMENT ON COLUMN circuit_unit_assignments.asignada_por IS
  'Id de usuario que abrio la asignacion. Nulo en lo anterior a la 0048.';
COMMENT ON COLUMN circuit_unit_assignments.cerrada_por IS
  'Id de usuario que la cerro: al soltar o al reasignar la unidad a otro circuito. Nulo en lo anterior a la 0048 o si la cerro un guion.';


-- PASO 3 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: columnas_0048 = 2, y con_autor = 0 (lo de antes queda nulo).
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuit_unit_assignments'
      AND column_name IN ('asignada_por', 'cerrada_por'))                AS columnas_0048,
  (SELECT count(*) FROM circuit_unit_assignments
    WHERE asignada_por IS NOT NULL OR cerrada_por IS NOT NULL)          AS con_autor;


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (se pierde el autor de lo asignado desde que se aplicó):
--   ALTER TABLE circuit_unit_assignments DROP COLUMN IF EXISTS cerrada_por;
--   ALTER TABLE circuit_unit_assignments DROP COLUMN IF EXISTS asignada_por;
-- ───────────────────────────────────────────────────────────────────
