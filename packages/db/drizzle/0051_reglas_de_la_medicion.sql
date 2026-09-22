-- Las reglas de la medición de un circuito, con quién, cuándo y por qué — ADITIVA (A4b).
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide todas las columnas declaradas, y el código nuevo contra una base
-- sin `corridor_exit_minutes` revienta al leer el circuito (la lección de la
-- 0016). Al revés no pasa nada.
--
-- ## Qué agrega
--
-- 1. `circuits.corridor_exit_minutes`: los minutos seguidos fuera del corredor
--    que cuentan como salida en la jornada. Nace en 3 para TODOS — el mismo
--    número que el código usaba como constante —, así que ninguna jornada
--    cambia al aplicarla.
-- 2. `circuit_rule_changes`: un renglón por cada regla que cambie de aquí en
--    adelante, con su valor de antes (leído de la base), el de después, el
--    motivo (obligatorio también aquí), quién y cuándo. Vacía al nacer: nada de
--    lo anterior tiene autor, y escribírselo sería inventarlo.
-- 3. La validación que le faltaba a `arrival_tolerance_pct` (mayor que 0, hasta
--    100): hoy sólo se movía con SQL y la base no la cuidaba. Desde A4b tiene
--    escritura desde la pantalla.
--
-- Aprobado por Asav el 21-sep-2026 (A4b, antes de la calibración con camiones).

ALTER TABLE circuits ADD COLUMN IF NOT EXISTS corridor_exit_minutes integer NOT NULL DEFAULT 3;
--> statement-breakpoint
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_minutos_fuera_positivos;
--> statement-breakpoint
ALTER TABLE circuits ADD CONSTRAINT circuits_minutos_fuera_positivos CHECK (corridor_exit_minutes > 0);
--> statement-breakpoint
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_valida;
--> statement-breakpoint
ALTER TABLE circuits ADD CONSTRAINT circuits_tolerancia_llegada_valida CHECK (arrival_tolerance_pct > 0 AND arrival_tolerance_pct <= 100);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS circuit_rule_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  regla text NOT NULL,
  valor_antes text,
  valor_despues text,
  motivo text NOT NULL,
  cambiado_por text NOT NULL,
  cambiado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_rule_changes_motivo CHECK (length(btrim(motivo)) > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_rule_changes_circuito_idx ON circuit_rule_changes (circuit_id, cambiado_en);
--> statement-breakpoint
COMMENT ON COLUMN circuits.corridor_exit_minutes IS
  'Minutos seguidos fuera del corredor que cuentan como salida en la jornada (0051). Menos es el brinco del GPS.';
--> statement-breakpoint
COMMENT ON TABLE circuit_rule_changes IS
  'Quien cambio que regla de la medicion de un circuito, cuando, de que valor a cual y por que (0051). El antes se lee de la base.';
