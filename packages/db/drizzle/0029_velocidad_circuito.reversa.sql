-- MARCHA ATRÁS de la 0029.
--
-- ⚠ Sin esta columna **la app del pasajero no puede dar un rango de llegada**:
-- se queda solo con la frecuencia declarada. No revienta —esa caída ya está
-- construida y es honesta— pero el producto pierde su respuesta principal.
--
-- Anota las velocidades calibradas antes, porque no vuelven:
--
--   SELECT name, avg_speed_kmh FROM circuits WHERE avg_speed_kmh <> 20.5;

ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_color_valido;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS color_hex;
--> statement-breakpoint
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_velocidad_positiva;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS avg_speed_kmh;
