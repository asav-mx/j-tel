-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0047 (marcador del orquestador de pasos) en Neon
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- del orquestador. ADITIVA: una tabla nueva. No toca ninguna fila existente.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST) — la necesitan las
--      pruebas de integración del orquestador. Ahí ya deben estar la 0045 y
--      la 0046 (las pide también la comparación de pasos).
--   2. En PRODUCCIÓN.
--
-- Requisito: la 0045 y la 0046 ya aplicadas (PASO 0 lo comprueba).
-- ═══════════════════════════════════════════════════════════════════

-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado: circuit_stop_passes = 1, arrival_tolerance_pct = 1,
--           circuit_detection_marks = 0 (todavía no existe).
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'circuit_stop_passes')                      AS tabla_0045,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'circuits' AND column_name = 'arrival_tolerance_pct') AS columna_0046,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name = 'circuit_detection_marks')                 AS tabla_0047;


-- PASO 1 · La tabla.
CREATE TABLE IF NOT EXISTS circuit_detection_marks (
  circuit_id        UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  unit_id           UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  detector_version  TEXT NOT NULL,
  last_ping_at      TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circuit_id, unit_id, detector_version)
);


-- PASO 2 · Documentar en el catálogo.
COMMENT ON TABLE circuit_detection_marks IS
  'Hasta que ping consumio el orquestador del detector, por circuito, unidad y version. last_ping_at es el recorded_at del ultimo ping usado, no la hora de la ronda: asi el par de pings que cruza el borde de una ventana se detecta una vez, ni perdido ni repetido.';
COMMENT ON COLUMN circuit_detection_marks.detector_version IS
  'Parte de la llave: subir la version arranca limpio sin borrar la anterior.';


-- PASO 3 · Comprobar el efecto. NO ESCRIBE.
SELECT table_name FROM information_schema.tables WHERE table_name = 'circuit_detection_marks';
SELECT count(*) AS filas FROM circuit_detection_marks;  -- 0, recién creada.


-- ───────────────────────────────────────────────────────────────────
-- REVERSA (sólo si hace falta deshacer; la tabla queda vacía hasta que el
-- cron corra, así que no se pierde nada de valor):
--   DROP TABLE IF EXISTS circuit_detection_marks;
-- ───────────────────────────────────────────────────────────────────
