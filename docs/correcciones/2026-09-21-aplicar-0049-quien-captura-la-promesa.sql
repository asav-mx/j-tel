-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0049 (quién capturó cada versión de la promesa)
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- «quién capturó la promesa». ADITIVA: una columna nula. No toca ninguna
-- fila existente.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST).
--   2. En PRODUCCIÓN — la corre Asav.
--
-- Requisito: la 0048 ya aplicada (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado: columnas_0048 = 2, columna_0049 = 0 (todavía no existe).
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuit_unit_assignments'
      AND column_name IN ('asignada_por', 'cerrada_por'))                AS columnas_0048,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuit_promise_tables'
      AND column_name = 'capturada_por')                                 AS columna_0049;


-- PASO 1 · La columna.
ALTER TABLE circuit_promise_tables ADD COLUMN IF NOT EXISTS capturada_por text;


-- PASO 2 · Documentar en el catálogo.
COMMENT ON COLUMN circuit_promise_tables.capturada_por IS
  'Id de usuario que capturo esta version de la promesa. Quien la cerro es quien capturo la siguiente. Nulo en lo anterior a la 0049.';


-- PASO 3 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: columna_0049 = 1, y con_autor = 0 (lo de antes queda nulo).
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuit_promise_tables'
      AND column_name = 'capturada_por')                                 AS columna_0049,
  (SELECT count(*) FROM circuit_promise_tables WHERE capturada_por IS NOT NULL) AS con_autor;


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (se pierde el autor de lo capturado desde que se aplicó):
--   ALTER TABLE circuit_promise_tables DROP COLUMN IF EXISTS capturada_por;
-- ───────────────────────────────────────────────────────────────────
