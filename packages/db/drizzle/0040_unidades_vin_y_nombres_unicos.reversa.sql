-- MARCHA ATRÁS de la 0040 · VIN de la unidad y nombres únicos por cuenta.
--
-- ⚠ Se pierde el VIN de cada unidad. Compruébalo antes:
--   SELECT count(*) FROM units WHERE vin IS NOT NULL;
-- Si hay VINs capturados desde la pantalla, anota la lista antes de correr esto.
--
-- Los nombres NO se tocan. Lo que se pierde es la garantía de la base de que no
-- se repitan; el código lo sigue revisando.
--
-- Primero hay que regresar el código: el código de la 0040 lee `units.vin`.

DROP INDEX IF EXISTS devices_nombre_unico_en_servicio;
--> statement-breakpoint
DROP INDEX IF EXISTS units_vin_unico_por_cuenta;
--> statement-breakpoint
DROP INDEX IF EXISTS units_nombre_unico_por_cuenta;
--> statement-breakpoint
ALTER TABLE units DROP COLUMN IF EXISTS vin;
