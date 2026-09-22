-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0052 (los avisos de la concesión al pasajero)
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- 4a de Ontoy 2.0. ADITIVA: una tabla nueva, vacía. No toca ninguna fila
-- existente ni ninguna otra tabla.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST) — la corre Claude.
--   2. En PRODUCCIÓN — la corre Asav.
--
-- Requisito: la 0051 ya aplicada (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado:
--   tabla_0051 = 1           (la 0051 ya está)
--   tabla_0052 = 0           (todavía no existe)
--   slugs_reservados = 0     (ningún circuito se llama «en-vivo» ni
--                             «paradas-de-la-ciudad». Si sale más de 0,
--                             PARAR y avisar: ese circuito ya está tapado
--                             en Ontoy desde el PR 3b, y hay que renombrarlo
--                             antes de seguir.)
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_rule_changes') AS tabla_0051,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_notices')      AS tabla_0052,
  (SELECT count(*) FROM circuits WHERE public_slug IN ('en-vivo', 'paradas-de-la-ciudad'))  AS slugs_reservados;


-- PASO 1 · La tabla de los avisos, vacía.
CREATE TABLE IF NOT EXISTS circuit_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  detalle text,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,
  capturado_por text NOT NULL,
  capturado_en timestamptz NOT NULL DEFAULT now(),
  retirado_en timestamptz,
  retirado_por text,
  motivo_retiro text,
  CONSTRAINT circuit_notices_titulo CHECK (length(btrim(titulo)) BETWEEN 1 AND 80),
  CONSTRAINT circuit_notices_detalle CHECK (detalle IS NULL OR length(detalle) <= 280),
  CONSTRAINT circuit_notices_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
  CONSTRAINT circuit_notices_retiro CHECK (
    (retirado_en IS NULL AND retirado_por IS NULL AND motivo_retiro IS NULL)
    OR (retirado_en IS NOT NULL AND retirado_por IS NOT NULL AND length(btrim(coalesce(motivo_retiro, ''))) > 0)
  )
);


-- PASO 2 · El índice.
CREATE INDEX IF NOT EXISTS circuit_notices_circuito_idx ON circuit_notices (circuit_id, vigente_desde);


-- PASO 3 · Documentar en el catálogo.
COMMENT ON TABLE circuit_notices IS
  'Avisos de la concesion al pasajero, por circuito (0052, Marco 8.13b). Firmados; no se editan: se retiran con motivo.';


-- PASO 4 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: tabla_0052 = 1, validaciones = 4, indice = 1, avisos = 0 (vacía).
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_notices')     AS tabla_0052,
  (SELECT count(*) FROM pg_constraint
    WHERE conname IN ('circuit_notices_titulo', 'circuit_notices_detalle',
                      'circuit_notices_vigencia', 'circuit_notices_retiro'))              AS validaciones,
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'circuit_notices_circuito_idx')      AS indice,
  (SELECT count(*) FROM circuit_notices)                                                  AS avisos;


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (se pierden todos los avisos y su historia; anótalos antes con
-- SELECT * FROM circuit_notices ORDER BY capturado_en;):
--   DROP TABLE IF EXISTS circuit_notices;
-- ───────────────────────────────────────────────────────────────────
