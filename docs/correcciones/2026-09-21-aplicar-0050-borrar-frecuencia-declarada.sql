-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0050 (borrar circuits.declared_frequency_minutes)
--
-- ⚠ DESTRUCTIVA, y con el ORDEN AL REVÉS de las aditivas:
--   1. Mergear el PR «borrar la frecuencia declarada».
--   2. Esperar a que Vercel despliegue main (web Y publico) — el código
--      desplegado ya no declara la columna.
--   3. ENTONCES correr esto, un PASO a la vez, en el editor de Neon.
--
-- Si se corre ANTES del despliegue, cada consulta a `circuits` del código
-- viejo revienta (Drizzle pide la columna que ya no existe).
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST).
--   2. En PRODUCCIÓN — la corre Asav.
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar que no se pierde nada. NO ESCRIBE.
-- Esperado: columna = 1, con_valor = 0.
-- ⛔ Si con_valor > 0: PARAR. Ese número lo declaró alguien; se captura como
--    franja en /jstaff/circuitos/‹id› (sección 2b) antes de borrar. El PASO 0b
--    dice cuáles.
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'declared_frequency_minutes') AS columna,
  (SELECT count(*) FROM circuits WHERE declared_frequency_minutes IS NOT NULL)   AS con_valor;

-- Leído el 21 sep 2026:
--   · PRODUCCIÓN: 2 circuitos, con_valor = 0. Nada que capturar.
--   · PRUEBA: con_valor = 1 — «Circuito de muestra — Oriente» (29 ago), resto de
--     una prueba vieja, sin concesionario real detrás. Ahí se puede seguir: el
--     alto del PASO 0 protege a PRODUCCIÓN.
--
-- PASO 0b · (sólo si con_valor > 0) Cuáles, para capturarlos como franja. NO ESCRIBE.
-- SELECT id, name, declared_frequency_minutes FROM circuits
--  WHERE declared_frequency_minutes IS NOT NULL;


-- PASO 1 · Borrar la columna (su CHECK se va con ella).
ALTER TABLE circuits DROP COLUMN IF EXISTS declared_frequency_minutes;


-- PASO 2 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: columna = 0, check = 0.
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'declared_frequency_minutes') AS columna,
  (SELECT count(*) FROM information_schema.table_constraints
    WHERE table_name = 'circuits' AND constraint_name = 'circuits_frecuencia_positiva') AS check_;


-- PASO 3 · Que la app siga contestando: abrir Ontoy (la lista de rutas) y
-- /jstaff/circuitos. Si alguna truena con «column … does not exist», el
-- despliegue no había terminado: correr la REVERSA de abajo y avisar.


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (la columna vuelve VACÍA; lo que tenía no se recupera):
--   ALTER TABLE circuits ADD COLUMN IF NOT EXISTS declared_frequency_minutes integer;
--   ALTER TABLE circuits ADD CONSTRAINT circuits_frecuencia_positiva
--     CHECK (declared_frequency_minutes > 0);
-- ───────────────────────────────────────────────────────────────────
