-- MARCHA ATRÁS de la 0026.
--
-- Sin riesgo: quita una columna con default que solo usa la pantalla de paradas.
-- Se pierde la tolerancia si algún circuito la tenía distinta de 25. Anótalas:
--
--   SELECT name, stop_snap_tolerance_meters FROM circuits
--    WHERE stop_snap_tolerance_meters <> 25;

ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_positiva;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS stop_snap_tolerance_meters;
