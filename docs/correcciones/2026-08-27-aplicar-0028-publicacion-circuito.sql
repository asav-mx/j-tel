-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0028 · interruptor de publicación — para pegar en Neon
--
-- SE APLICA DESPUÉS DE LA 0027. Si `circuits` no está, esto falla con
-- «relation does not exist», que es la señal correcta.
--
-- ADITIVA y sin riesgo: una columna que admite nulos, sin default, y un
-- índice parcial. Ninguna fila cambia de valor.
--
-- ⚠ EL EFECTO INTENCIONAL: al terminar, **TODOS los circuitos quedan
--   NO PUBLICADOS** (published_at = NULL). Eso es lo que se busca —
--   nada se vuelve visible sin que alguien lo prenda a propósito—,
--   pero anótalo: si esperabas que el circuito ya existente siguiera
--   como estaba, «como estaba» era «sin concepto de publicación».
--
-- Marcha atrás: packages/db/drizzle/0028_publicacion_circuito.reversa.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.circuits') IS NOT NULL                      AS existe_la_0025,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuit_unit_assignments'
                  AND column_name='motivo')                            AS esta_la_0027,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits'
                  AND column_name='published_at')                      AS ya_esta_aplicada,
       (SELECT count(*) FROM circuits)                                 AS circuitos;

-- `existe_la_0025` TRUE · `esta_la_0027` TRUE · `ya_esta_aplicada` FALSE.
-- Anota `circuitos`: al terminar tiene que ser el mismo número.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS circuits_publicados_idx
  ON circuits (public_slug) WHERE published_at IS NOT NULL;

COMMENT ON COLUMN circuits.published_at IS
  'Desde cuándo el circuito es visible para la app del pasajero. NULL = creado pero no publicado: el endpoint público contesta como si el slug no existiera. No confundir con `active`, que es dado de baja.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · La columna existe, admite nulos y NO tiene default. Los tres.
--       Un default aquí publicaría solo por existir: es el error que esta
--       migración se escribió para no cometer.
SELECT data_type = 'timestamp with time zone'
   AND is_nullable = 'YES'
   AND column_default IS NULL          AS columna_ok
  FROM information_schema.columns
 WHERE table_name='circuits' AND column_name='published_at';

-- 3.2 · Ningún circuito quedó publicado por accidente. DEBE dar 0.
SELECT count(*) AS publicados_por_accidente
  FROM circuits WHERE published_at IS NOT NULL;

-- 3.3 · El índice es PARCIAL. Si sale FALSE no es grave —solo deja de
--       servir al endpoint—, pero es señal de que se pegó otra cosa.
SELECT indpred IS NOT NULL              AS es_parcial,
       pg_get_expr(indpred, indrelid)   AS condicion
  FROM pg_index
 WHERE indexrelid = 'circuits_publicados_idx'::regclass;

-- `condicion` debe decir «published_at IS NOT NULL».

-- 3.4 · El número de circuitos no se movió. Comparar con el paso 1.
SELECT count(*) AS circuitos FROM circuits;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si todo cuadró:
COMMIT;
-- Si no:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────
-- DESPUÉS DEL COMMIT · qué esperar en la pantalla
--
-- El circuito aparece como «No publicado», y el endpoint público
-- contesta 404 para su slug — igual que para un slug inventado. Se
-- prende desde /jstaff/circuitos/<id>, con el interruptor de arriba.
-- ───────────────────────────────────────────────────────────────────
