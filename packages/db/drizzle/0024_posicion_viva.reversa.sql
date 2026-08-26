-- MARCHA ATRÁS de la 0024 · posición viva.
--
-- Seguro de correr: la 0024 es aditiva y nada del código viejo conoce ninguna
-- de las dos cosas que borra. Deshacerla no pierde un solo dato del histórico
-- —`telemetry_points` no se toca— porque `live_positions` no es memoria: es la
-- última posición conocida, y se vuelve a llenar sola en el primer minuto de
-- recolector.
--
-- **Lo único que sí se pierde es la configuración de cadencia por carrier.**
-- Si algún carrier ya tenía un valor distinto de 30, anótalo antes de correr
-- esto:
--
--   SELECT a.name, cp.gps_poll_seconds
--     FROM carrier_profiles cp JOIN accounts a ON a.id = cp.account_id
--    WHERE cp.gps_poll_seconds <> 30;
--
-- ANTES de correrla: quitar el cron `/api/cron/collect` de `apps/web/vercel.json`
-- y desplegar, o revertir el despliegue. Si el recolector sigue vivo y la tabla
-- ya no existe, cada minuto va a fallar entero.

DROP INDEX IF EXISTS live_positions_carrier_recorded_idx;
--> statement-breakpoint
DROP TABLE IF EXISTS live_positions;
--> statement-breakpoint
ALTER TABLE carrier_profiles DROP COLUMN IF EXISTS gps_poll_seconds;
