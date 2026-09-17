-- MARCHA ATRÁS de la 0039 · acciones de dispositivo.
--
-- ⚠ Se pierde quién asignó, quién cerró, por qué se cerró cada asignación,
-- quién dio cada baja y el consecutivo de cada dispositivo. Compruébalo antes:
--   SELECT count(*) FROM device_assignments
--    WHERE asignada_por IS NOT NULL OR cerrada_por IS NOT NULL OR motivo_cierre IS NOT NULL;
--   SELECT count(*) FROM devices WHERE retired_by IS NOT NULL OR consecutivo IS NOT NULL;
-- Si hay filas escritas desde la pantalla, anota la lista antes de correr esto.
--
-- Los nombres (`label`) NO se tocan: el nombre de un dispositivo sobrevive a la
-- marcha atrás. Lo que se pierde es la garantía de que el siguiente no repita
-- número — al volver a aplicar la 0039 el relleno lo recalcula desde el nombre.
--
-- Primero hay que regresar el código: el código de la 0039 lee estas columnas.

DROP INDEX IF EXISTS device_assignments_unidad_una_vigente;
--> statement-breakpoint
DROP INDEX IF EXISTS device_assignments_dispositivo_una_vigente;
--> statement-breakpoint
DROP SEQUENCE IF EXISTS devices_consecutivo_seq;
--> statement-breakpoint
DROP INDEX IF EXISTS devices_consecutivo_unico;
--> statement-breakpoint
ALTER TABLE devices DROP COLUMN IF EXISTS consecutivo;
--> statement-breakpoint
ALTER TABLE devices DROP COLUMN IF EXISTS retired_by;
--> statement-breakpoint
ALTER TABLE device_assignments DROP COLUMN IF EXISTS motivo_cierre;
--> statement-breakpoint
ALTER TABLE device_assignments DROP COLUMN IF EXISTS cerrada_por;
--> statement-breakpoint
ALTER TABLE device_assignments DROP COLUMN IF EXISTS asignada_por;
