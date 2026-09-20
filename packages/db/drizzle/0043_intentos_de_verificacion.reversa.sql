-- Reversa de la 0043.
--
-- Quitar las tres columnas pierde el conteo de intentos y sus dos fechas. No
-- pierde historia: los 4.16 millones de entradas del ledger de las que salió
-- el relleno siguen intactas, porque la 0043 no borró ninguna.
--
-- Lo que sí se pierde es lo que el motor haya contado DESPUÉS de dejar de
-- escribir una entrada por intento. Si esta reversa se corre con el motor ya
-- arreglado, ese tramo no se puede reconstruir del ledger.

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_intentos_no_negativos;
--> statement-breakpoint
ALTER TABLE trips DROP COLUMN IF EXISTS ultimo_intento_at;
--> statement-breakpoint
ALTER TABLE trips DROP COLUMN IF EXISTS primer_intento_at;
--> statement-breakpoint
ALTER TABLE trips DROP COLUMN IF EXISTS intentos_de_verificacion;
