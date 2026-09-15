-- La baja de un aparato: fecha y motivo, sin borrar la fila. ADITIVA.
--
-- Se aplica DESPUÉS de la 0035 y **ANTES de desplegar el código** que la lee.
-- El orden importa al revés que en la 0035: la API relacional de Drizzle pide
-- TODAS las columnas de la tabla, así que el código nuevo contra una base sin
-- `retired_at` revienta en cada pantalla que lee aparatos — la lección de la
-- 0016. Al revés no pasa nada: el código de hoy no conoce las columnas y las
-- ignora.
--
-- No toca ninguna fila. Dar de baja los 82 aparatos de Umbrella es una hoja
-- aparte en `docs/correcciones/`, que se corre después, con su lista.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué baja y no borrado
-- ══════════════════════════════════════════════════════════════════════
--
-- Un aparato que trajo datos es historia. Borrarlo arrastra en cascada sus
-- `device_assignments` y deja en null el `device_id` de `telemetry_points`,
-- `evidence_points` y `live_positions`: los veredictos ya sellados perderían
-- de qué aparato vino su evidencia. La baja dice sólo que ya no está en
-- servicio, y el motor lo sigue leyendo para juzgar lo de antes de la baja.
--
-- Lo que nunca fue historia —los GPS inventados por el seed— se borró, no se
-- dio de baja. Ésa fue la regla del 14 de septiembre de 2026.
--
-- ⚠ TRAMPA CONOCIDA (0025): el valor nuevo del enum no se puede usar ni leer
-- en la transacción donde se agrega. La comprobación va después, en la hoja.

ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_at timestamptz;
--> statement-breakpoint
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_reason text;
--> statement-breakpoint

-- Las dos juntas o ninguna: una baja sin motivo, o un motivo sin baja, no se
-- puede escribir.
DO $$ BEGIN
  ALTER TABLE devices ADD CONSTRAINT devices_baja_con_motivo
    CHECK ((retired_at IS NULL) = (retired_reason IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

COMMENT ON COLUMN devices.retired_at IS
  'Cuando el aparato salio de servicio. La fila no se borra: sus puntos, asignaciones y veredictos siguen apuntando aqui. Va junto con retired_reason (0036).';
--> statement-breakpoint
COMMENT ON COLUMN devices.retired_reason IS
  'Por que salio de servicio, en palabras de quien lo dio de baja. Obligatorio si hay retired_at (0036).';
--> statement-breakpoint

ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_de_baja_transmite';
