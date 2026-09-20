-- Reversa de la 0045.
--
-- Pierde todos los pasos detectados hasta ahora. No pierde nada más: no toca
-- telemetry_points, circuit_stops ni circuit_stop_versions.

DROP TABLE IF EXISTS circuit_stop_passes;
