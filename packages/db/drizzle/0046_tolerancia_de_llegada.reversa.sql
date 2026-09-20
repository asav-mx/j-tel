-- Reversa de la 0046.
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_positiva;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS arrival_tolerance_pct;
