-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0053 (el resumen de los recorridos por tramo)
--
-- Se corre en el editor de Neon, un PASO a la vez. ADITIVA: una tabla
-- nueva, vacía. No toca ninguna fila ni ninguna otra tabla.
--
-- ⚠ **EN PRODUCCIÓN, NO ANTES DEL 29 DE SEPTIEMBRE** (ASAV, 22-sep): la
-- semana de la calibración con camiones va sin piezas nuevas cerca.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST) — la corre Claude.
--   2. En PRODUCCIÓN, del 29 en adelante — la corre Asav.
--
-- Requisito: la 0052 ya aplicada (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado:
--   tabla_0052 = 1        (la 0052 ya está)
--   tabla_0053 = 0        (todavía no existe)
--   enum_sentido = 1      (el tipo que usa la tabla nueva ya existe)
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_notices')   AS tabla_0052,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_leg_times') AS tabla_0053,
  (SELECT count(*) FROM pg_type WHERE typname = 'sentido_circuito')                       AS enum_sentido;


-- PASO 1 · La tabla del resumen, vacía. Sin unidad y sin transportista, a
-- propósito: lo que no se guarda no se puede filtrar (9.14).
CREATE TABLE IF NOT EXISTS circuit_leg_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  sentido sentido_circuito NOT NULL,
  de_stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  a_stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  travesias integer NOT NULL,
  desde_seg integer NOT NULL,
  mediana_seg integer NOT NULL,
  hasta_seg integer NOT NULL,
  ventana_desde timestamptz NOT NULL,
  ventana_hasta timestamptz NOT NULL,
  detector_version text NOT NULL,
  calculado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_leg_times_travesias CHECK (travesias > 0),
  CONSTRAINT circuit_leg_times_rango CHECK (desde_seg >= 0 AND desde_seg <= mediana_seg AND mediana_seg <= hasta_seg),
  CONSTRAINT circuit_leg_times_ventana CHECK (ventana_hasta > ventana_desde),
  CONSTRAINT circuit_leg_times_paradas_distintas CHECK (de_stop_id <> a_stop_id)
);


-- PASO 2 · Un solo renglón por tramo (el cron lo reemplaza), y el índice de lectura.
CREATE UNIQUE INDEX IF NOT EXISTS circuit_leg_times_un_tramo_idx ON circuit_leg_times (circuit_id, sentido, de_stop_id, a_stop_id);
CREATE INDEX IF NOT EXISTS circuit_leg_times_circuito_idx ON circuit_leg_times (circuit_id, sentido);


-- PASO 3 · Documentar en el catálogo.
COMMENT ON TABLE circuit_leg_times IS
  'Recorridos por tramo de un circuito, agregados (0053, Marco 8.16.5). Los escribe el cron; sin unidad ni transportista a proposito.';


-- PASO 4 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: tabla_0053 = 1, validaciones = 4, indices = 2, tramos = 0 (vacía).
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_leg_times') AS tabla_0053,
  (SELECT count(*) FROM pg_constraint
    WHERE conname IN ('circuit_leg_times_travesias', 'circuit_leg_times_rango',
                      'circuit_leg_times_ventana', 'circuit_leg_times_paradas_distintas')) AS validaciones,
  (SELECT count(*) FROM pg_indexes
    WHERE indexname IN ('circuit_leg_times_un_tramo_idx', 'circuit_leg_times_circuito_idx')) AS indices,
  (SELECT count(*) FROM circuit_leg_times)                                                AS tramos;


-- ───────────────────────────────────────────────────────────────────
-- REVERSA: se pierde el resumen, y el cron lo vuelve a calcular de los pasos
-- en su siguiente corrida. El planeador se queda sin totales mientras tanto.
--   DROP TABLE IF EXISTS circuit_leg_times;
-- ───────────────────────────────────────────────────────────────────
