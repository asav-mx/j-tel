-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0027 · motivo y candado de la asignación — para pegar en Neon
--
-- SE APLICA DESPUÉS DE LA 0025. Si `circuit_unit_assignments` no está,
-- esto falla con «relation does not exist», que es la señal correcta.
--
-- ADITIVA: una columna sin NOT NULL y un índice único parcial.
--
-- ⚠ LO ÚNICO QUE PUEDE REVENTAR AQUÍ es el índice único, y solo si ya
--   existen dos asignaciones abiertas de la misma unidad. El PASO 1 lo
--   comprueba. No se aplica sin haberlo corrido.
--
-- Marcha atrás: packages/db/drizzle/0027_asignacion_vigencia.reversa.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.circuit_unit_assignments') IS NOT NULL      AS existe_la_0025,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuit_unit_assignments'
                  AND column_name='motivo')                            AS ya_esta_aplicada,
       (SELECT count(*) FROM circuit_unit_assignments)                 AS asignaciones,
       (SELECT count(*) FROM circuit_unit_assignments
         WHERE valid_to IS NULL)                                       AS vigentes;

-- `existe_la_0025` debe ser TRUE y `ya_esta_aplicada` FALSE.
-- Anota `asignaciones`: al terminar tiene que ser el mismo número.

-- 1.2 · LA COMPROBACIÓN QUE DECIDE. Debe devolver CERO filas.
--
-- Si devuelve alguna, el índice del paso 2 va a fallar. NO forzarlo y NO
-- borrar filas para que quepa: cada duplicado es una unidad publicándose
-- en dos circuitos, y hay que decidir a mano cuál asignación se cierra y
-- con qué motivo antes de volver aquí.
SELECT unit_id, count(*) AS abiertas
  FROM circuit_unit_assignments
 WHERE valid_to IS NULL
 GROUP BY unit_id
HAVING count(*) > 1;


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS motivo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS circuit_unit_assignments_una_vigente
  ON circuit_unit_assignments (unit_id) WHERE valid_to IS NULL;

COMMENT ON COLUMN circuit_unit_assignments.motivo IS
  'Por qué TERMINÓ la asignación, cuando quien la cerró se molesta en decirlo. Se escribe al cerrar, no al abrir. Alimenta el historial de la concesión.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · La columna existe y admite nulos (el motivo es opcional). TRUE.
SELECT data_type = 'text' AND is_nullable = 'YES'  AS columna_ok
  FROM information_schema.columns
 WHERE table_name='circuit_unit_assignments' AND column_name='motivo';

-- 3.2 · El índice existe, es ÚNICO y es PARCIAL. Los tres, o no sirve:
--       un índice único sin el WHERE prohibiría el historial entero.
SELECT indisunique                            AS es_unico,
       indpred IS NOT NULL                    AS es_parcial,
       pg_get_expr(indpred, indrelid)         AS condicion
  FROM pg_index
 WHERE indexrelid = 'circuit_unit_assignments_una_vigente'::regclass;

-- `es_unico` TRUE, `es_parcial` TRUE, y `condicion` debe decir
-- «valid_to IS NULL». Si `es_parcial` sale FALSE, ROLLBACK: quedaría
-- prohibido cerrar y reabrir la asignación de una unidad.

-- 3.3 · El candado muerde de verdad. Esto DEBE fallar con
--       «duplicate key value violates unique constraint». Si pasa sin
--       error, el índice no está haciendo su trabajo — ROLLBACK.
--
--       Va en su propio SAVEPOINT para que el fallo esperado no tire la
--       transacción entera.
SAVEPOINT probar_candado;

INSERT INTO circuit_unit_assignments (circuit_id, unit_id, carrier_account_id)
SELECT circuit_id, unit_id, carrier_account_id
  FROM circuit_unit_assignments
 WHERE valid_to IS NULL
 LIMIT 1;

-- Si la tabla está vacía, el INSERT no inserta nada y no prueba nada:
-- ahí el candado se prueba contra DATABASE_URL_TEST, no aquí.
ROLLBACK TO SAVEPOINT probar_candado;

-- 3.4 · El número de asignaciones no se movió. Comparar con el paso 1.
SELECT count(*) AS asignaciones,
       count(*) FILTER (WHERE valid_to IS NULL) AS vigentes
  FROM circuit_unit_assignments;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si todo cuadró:
COMMIT;
-- Si no:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────
