-- El detector de pasos por parada (Marco 9.2 / 9.11) — ADITIVA, una tabla.
--
-- Se aplica DESPUÉS de la 0044. No toca ninguna fila existente. Nada del
-- código que corre hoy conoce nada de esto.
--
-- ## Detección por cruce sobre el trazado, no por radio
--
-- Decisión de Asav, 19-sep-2026, sobre la medición de la cadencia real de los
-- FTC927: los aparatos dan 15–61 m entre puntos con el camión andando —mucho
-- más fino que los 440–810 m de la flota vieja con la que se descartó el
-- radio—, pero los HUECOS de red siguen ahí (hasta 75 horas medidas en un
-- aparato en una semana). El hueco es justo donde está la parada: es donde
-- el camión se detiene. El cruce sobre el trazado no se salta ninguna,
-- porque ocurre entre los dos puntos que encierran el hueco.
--
-- ## El paso es un rango, no un instante
--
-- No hay `passed_at`. El instante en que la unidad "pasó" no existe —el
-- instrumento no lo mide, sólo da dos pings entre los que ocurrió el
-- cruce—, y una columna de instante invitaría a leerlo como si existiera.
-- `paso_desde`/`paso_hasta` son los dos pings; `hueco_segundos` es su ancho.
--
-- ## Nada se sella aquí
--
-- Esta tabla no lleva veredicto. La comparación banda contra banda contra la
-- promesa por franja (0044) se calcula al leer, contra la franja vigente en
-- `paso_desde` — nunca contra la de hoy, y nunca un promedio del día (9.1c).
--
-- ## Apilar, no pisar
--
-- `detector_version` identifica qué corrida produjo cada paso. Si el
-- detector se corrige y se vuelve a correr sobre los mismos días, la
-- corrida nueva NO borra la anterior — es el principio de la casa: los
-- cambios son eventos, no reemplazos.

CREATE TABLE IF NOT EXISTS circuit_stop_passes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id          UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  stop_id             UUID NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  -- La parada COMO ESTABA cuando se detectó, no la vigente de hoy.
  stop_version_id     UUID NOT NULL REFERENCES circuit_stop_versions(id) ON DELETE CASCADE,
  unit_id             UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sentido             sentido_circuito NOT NULL,
  paso_desde          TIMESTAMPTZ NOT NULL,
  paso_hasta          TIMESTAMPTZ NOT NULL,
  hueco_segundos      INTEGER NOT NULL,
  -- `SET NULL`, no `CASCADE`: si un punto se purga del archivo, el hecho de
  -- que la unidad cruzó ahí no debe desaparecer con él.
  ping_previo_id      UUID REFERENCES telemetry_points(id) ON DELETE SET NULL,
  ping_siguiente_id   UUID REFERENCES telemetry_points(id) ON DELETE SET NULL,
  detector_version    TEXT NOT NULL,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circuit_stop_passes_rango_valido CHECK (paso_hasta >= paso_desde)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_stop_passes_stop_idx
  ON circuit_stop_passes (stop_id, paso_desde);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_stop_passes_unit_idx
  ON circuit_stop_passes (unit_id, paso_desde);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_stop_passes_circuit_idx
  ON circuit_stop_passes (circuit_id, paso_desde);
--> statement-breakpoint
COMMENT ON TABLE circuit_stop_passes IS
  'Un cruce de una unidad sobre la abscisa de una parada (Marco 9.2). El paso es un RANGO -- paso_desde/paso_hasta son los dos pings que lo encierran, no un instante inventado. No lleva veredicto: eso se calcula al leer, contra la franja vigente en paso_desde. detector_version permite apilar corridas sin pisar las anteriores.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_stop_passes.stop_version_id IS
  'La parada como estaba cuando se detecto el paso, no la vigente de hoy -- las paradas se mueven.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_stop_passes.hueco_segundos IS
  'El ancho del rango, guardado calculado ademas de derivable: filtrar "pasos con hueco < 1 min" sin esta columna pelea con el plan de la consulta.';
