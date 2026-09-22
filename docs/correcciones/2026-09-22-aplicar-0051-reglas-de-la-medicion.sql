-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0051 (las reglas de la medición, con quién y por qué)
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- de A4b. ADITIVA: una columna con default, dos validaciones y una tabla
-- nueva vacía. No cambia el valor de ninguna fila existente.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST) — la corre Claude.
--   2. En PRODUCCIÓN — la corre Asav.
--
-- Requisito: la 0050 ya aplicada (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado:
--   frecuencia_vieja = 0      (la 0050 ya borró la columna)
--   columna_0051 = 0          (todavía no existe)
--   tabla_0051 = 0            (todavía no existe)
--   tolerancias_invalidas = 0 (si sale más de 0, PARAR y avisar: la
--                              validación del PASO 2 fallaría. Se anotan con
--                              la consulta de abajo antes de seguir.)
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'declared_frequency_minutes') AS frecuencia_vieja,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'corridor_exit_minutes')      AS columna_0051,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'circuit_rule_changes')                                    AS tabla_0051,
  (SELECT count(*) FROM circuits
    WHERE NOT (arrival_tolerance_pct > 0 AND arrival_tolerance_pct <= 100))     AS tolerancias_invalidas;

-- (Sólo si tolerancias_invalidas > 0. NO ESCRIBE.)
-- SELECT id, name, arrival_tolerance_pct FROM circuits
--   WHERE NOT (arrival_tolerance_pct > 0 AND arrival_tolerance_pct <= 100);


-- PASO 1 · La columna de los minutos fuera del corredor. Nace en 3 para todos:
-- el mismo número que el código usaba como constante.
ALTER TABLE circuits ADD COLUMN IF NOT EXISTS corridor_exit_minutes integer NOT NULL DEFAULT 3;


-- PASO 2 · Las dos validaciones.
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_minutos_fuera_positivos;
ALTER TABLE circuits ADD CONSTRAINT circuits_minutos_fuera_positivos CHECK (corridor_exit_minutes > 0);
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_valida;
ALTER TABLE circuits ADD CONSTRAINT circuits_tolerancia_llegada_valida CHECK (arrival_tolerance_pct > 0 AND arrival_tolerance_pct <= 100);


-- PASO 3 · La tabla del registro, vacía.
CREATE TABLE IF NOT EXISTS circuit_rule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  regla text NOT NULL,
  valor_antes text,
  valor_despues text,
  motivo text NOT NULL,
  cambiado_por text NOT NULL,
  cambiado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_rule_changes_motivo CHECK (length(btrim(motivo)) > 0)
);
CREATE INDEX IF NOT EXISTS circuit_rule_changes_circuito_idx ON circuit_rule_changes (circuit_id, cambiado_en);


-- PASO 4 · Documentar en el catálogo.
COMMENT ON COLUMN circuits.corridor_exit_minutes IS
  'Minutos seguidos fuera del corredor que cuentan como salida en la jornada (0051). Menos es el brinco del GPS.';
COMMENT ON TABLE circuit_rule_changes IS
  'Quien cambio que regla de la medicion de un circuito, cuando, de que valor a cual y por que (0051). El antes se lee de la base.';


-- PASO 5 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: columna_0051 = 1, tabla_0051 = 1, validaciones = 2,
--           distintos_de_3 = 0 (todos nacen en 3), cambios = 0 (vacía).
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'corridor_exit_minutes')      AS columna_0051,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'circuit_rule_changes')                                    AS tabla_0051,
  (SELECT count(*) FROM pg_constraint
    WHERE conname IN ('circuits_minutos_fuera_positivos', 'circuits_tolerancia_llegada_valida')) AS validaciones,
  (SELECT count(*) FROM circuits WHERE corridor_exit_minutes <> 3)                AS distintos_de_3,
  (SELECT count(*) FROM circuit_rule_changes)                                     AS cambios;


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (se pierde el registro desde que se aplicó y el valor de los
-- minutos de cada circuito; anótalos antes):
--   DROP TABLE IF EXISTS circuit_rule_changes;
--   ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_valida;
--   ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_minutos_fuera_positivos;
--   ALTER TABLE circuits DROP COLUMN IF EXISTS corridor_exit_minutes;
-- ───────────────────────────────────────────────────────────────────
