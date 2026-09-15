-- MARCHA ATRÁS de la 0036 · baja de aparatos.
--
-- ⚠ Borra la baja de TODOS los aparatos que la tengan: la fecha y el motivo se
-- pierden, y los 82 de Umbrella vuelven a contar como activos en la flota y en
-- el cotejo. Compruébalo antes:
--   SELECT count(*) FROM devices WHERE retired_at IS NOT NULL;
-- Si hay filas, anota la lista antes de correr esto.
--
-- Primero hay que regresar el código: el código de la 0036 lee estas columnas.
--
-- El valor `aparato_de_baja_transmite` del enum NO se quita: Postgres no borra
-- valores de un enum, y dejarlo no estorba.

ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_baja_con_motivo;
--> statement-breakpoint
ALTER TABLE devices DROP COLUMN IF EXISTS retired_reason;
--> statement-breakpoint
ALTER TABLE devices DROP COLUMN IF EXISTS retired_at;
