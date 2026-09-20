-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0045 (pasos por parada, Marco 9.2/9.11) en Neon
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR
-- del detector. ADITIVA: una tabla nueva. No toca ninguna fila existente.
-- ═══════════════════════════════════════════════════════════════════

-- PASO 1 · La tabla.
CREATE TABLE IF NOT EXISTS circuit_stop_passes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id          UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  stop_id             UUID NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  stop_version_id     UUID NOT NULL REFERENCES circuit_stop_versions(id) ON DELETE CASCADE,
  unit_id             UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sentido             sentido_circuito NOT NULL,
  paso_desde          TIMESTAMPTZ NOT NULL,
  paso_hasta          TIMESTAMPTZ NOT NULL,
  hueco_segundos      INTEGER NOT NULL,
  ping_previo_id      UUID REFERENCES telemetry_points(id) ON DELETE SET NULL,
  ping_siguiente_id   UUID REFERENCES telemetry_points(id) ON DELETE SET NULL,
  detector_version    TEXT NOT NULL,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circuit_stop_passes_rango_valido CHECK (paso_hasta >= paso_desde)
);


-- PASO 2 · Los índices.
CREATE INDEX IF NOT EXISTS circuit_stop_passes_stop_idx
  ON circuit_stop_passes (stop_id, paso_desde);
CREATE INDEX IF NOT EXISTS circuit_stop_passes_unit_idx
  ON circuit_stop_passes (unit_id, paso_desde);
CREATE INDEX IF NOT EXISTS circuit_stop_passes_circuit_idx
  ON circuit_stop_passes (circuit_id, paso_desde);


-- PASO 3 · Documentar en el catálogo.
COMMENT ON TABLE circuit_stop_passes IS
  'Un cruce de una unidad sobre la abscisa de una parada (Marco 9.2). El paso es un RANGO -- paso_desde/paso_hasta son los dos pings que lo encierran. No lleva veredicto. detector_version permite apilar corridas sin pisar las anteriores.';
COMMENT ON COLUMN circuit_stop_passes.stop_version_id IS
  'La parada como estaba cuando se detecto el paso, no la vigente de hoy.';


-- PASO 4 · Comprobar el efecto. NO ESCRIBE.
SELECT table_name FROM information_schema.tables WHERE table_name = 'circuit_stop_passes';
SELECT count(*) AS filas FROM circuit_stop_passes;  -- 0, recién creada.
