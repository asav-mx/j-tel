-- Tolerancia de pegado de paradas — ADITIVA, una sola columna.
--
-- Se aplica DESPUÉS de la 0025.
--
-- ## Por qué es columna nueva y no un cambio a la 0025
--
-- La 0025 ya está publicada. Reescribir una migración publicada rompe la única
-- garantía que tienen: que el archivo versionado y lo que corrió contra la base
-- son lo mismo. Aunque la 0025 no estuviera aplicada todavía en producción,
-- editarla dejaría a cualquiera que la haya aplicado con un esquema distinto al
-- del repo y sin forma de saberlo. Aditiva y nueva, siempre.
--
-- ## Qué resuelve
--
-- Al picar una parada en el mapa, el sistema la pega al trazado: la parada está
-- sobre la ruta por definición, y una parada a diez metros del recorrido
-- confunde al pasajero. Pero pegar a la fuerza y en silencio vuelve la pantalla
-- incomprensible — quien edita no entiende qué pasó con su pico.
--
-- Esta columna dice a partir de cuántos metros el pegado deja de ser obvio y
-- hay que avisar. La pantalla muestra dónde quedaría pegada ANTES de confirmar,
-- y pasando esta distancia ofrece soltar el pegado.
--
-- 25 m de default: el ancho de una avenida con camellón en Juárez. No es una
-- ley — una calle del Centro y una avenida no admiten el mismo margen, y por
-- eso es un campo por circuito y no un número en el código.

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS stop_snap_tolerance_meters DOUBLE PRECISION NOT NULL DEFAULT 25;
--> statement-breakpoint
ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_tolerancia_positiva;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_tolerancia_positiva CHECK (stop_snap_tolerance_meters > 0);
--> statement-breakpoint
COMMENT ON COLUMN circuits.stop_snap_tolerance_meters IS
  'A partir de cuántos metros del trazado el pegado de una parada deja de ser obvio y la pantalla avisa, ofreciendo soltarlo. Por circuito: una calle del Centro y una avenida no admiten el mismo margen.';
