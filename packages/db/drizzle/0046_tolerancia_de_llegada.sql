-- La tolerancia de llegada del circuito — ADITIVA, una sola columna.
--
-- Se aplica DESPUÉS de la 0045.
--
-- ## Qué resuelve
--
-- El detector de pasos (0045) mide; esta columna es lo que permite JUZGAR —
-- decisión de Asav, 20-sep-2026, sobre cómo comparar un paso contra la
-- promesa por franja (0044):
--
--   1. La ventana esperada se ancla al PASO ANTERIOR, no a la hora del
--      reloj: lo que importa es cuánto esperó el pasajero.
--   2. La tolerancia es PORCENTAJE de la frecuencia prometida, no segundos
--      fijos — 2 min sobre «cada 10» es el 20 %; sobre «cada 30» no es nada.
--   3. Por CIRCUITO, nunca escondida en el código.
--
-- ## Por qué nace en 50 (±50 %)
--
-- Ancha a propósito. La primera medición es de un servicio nuevo, y una
-- banda estrecha desde el día uno pintaría todo rojo sin que el servicio
-- hubiera fallado. Se aprieta con semanas medidas — misma lógica que la
-- tolerancia del transporte especial, que tampoco nació ajustada a ciegas.

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS arrival_tolerance_pct DOUBLE PRECISION NOT NULL DEFAULT 50;
--> statement-breakpoint
ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_positiva;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_tolerancia_llegada_positiva CHECK (arrival_tolerance_pct > 0);
--> statement-breakpoint
COMMENT ON COLUMN circuits.arrival_tolerance_pct IS
  'Cuanto se perdona alrededor del intervalo esperado, como PORCENTAJE de la frecuencia prometida (50 = +-50%), al juzgar un paso contra la promesa por franja (Marco 9.2). Por circuito, nunca escondida en el codigo. Nace ancha (50) a proposito: se aprieta con semanas medidas.';
