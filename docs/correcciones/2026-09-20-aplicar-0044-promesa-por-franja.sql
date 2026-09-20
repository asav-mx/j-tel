-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0044 (promesa por franja horaria, Marco 9.1c) en Neon
--
-- Se corre en el editor de Neon, un PASO a la vez, ANTES de mergear el PR de
-- la franja. Es la regla de la casa: migración primero, merge después.
--
-- ADITIVA. Dos tablas nuevas y un enum nuevo. No toca
-- `circuits.declared_frequency_minutes` ni ninguna fila existente. Nada del
-- código que corre hoy conoce nada de esto: se puede aplicar con el sitio
-- corriendo, sin desplegar antes.
-- ═══════════════════════════════════════════════════════════════════


-- PASO 1 · El tipo de día.
DO $$ BEGIN
  CREATE TYPE tipo_de_dia_circuito AS ENUM ('entre_semana', 'sabado', 'domingo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- PASO 2 · La tabla que agrupa — aquí vive la vigencia.
CREATE TABLE IF NOT EXISTS circuit_promise_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id  UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to    TIMESTAMPTZ,
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- PASO 3 · El índice y el candado de «una vigente por circuito».
CREATE INDEX IF NOT EXISTS circuit_promise_tables_circuit_idx
  ON circuit_promise_tables (circuit_id, valid_to);

CREATE UNIQUE INDEX IF NOT EXISTS circuit_promise_tables_una_vigente
  ON circuit_promise_tables (circuit_id) WHERE valid_to IS NULL;


-- PASO 4 · Las franjas. Sin vigencia propia — la de la tabla es la que cuenta.
CREATE TABLE IF NOT EXISTS circuit_promise_bands (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_table_id   UUID NOT NULL REFERENCES circuit_promise_tables(id) ON DELETE CASCADE,
  dia_tipo           tipo_de_dia_circuito NOT NULL,
  sentido            sentido_circuito,
  desde_local        TIME NOT NULL,
  hasta_local        TIME NOT NULL,
  frequency_minutes  INTEGER NOT NULL,
  CONSTRAINT circuit_promise_bands_frecuencia_positiva CHECK (frequency_minutes > 0),
  CONSTRAINT circuit_promise_bands_no_cruza_medianoche CHECK (desde_local < hasta_local)
);

CREATE INDEX IF NOT EXISTS circuit_promise_bands_table_idx
  ON circuit_promise_bands (promise_table_id);


-- PASO 5 · Documentar en el catálogo, para quien mire la base sin el repo al lado.
COMMENT ON TABLE circuit_promise_tables IS
  'Una versión completa de la promesa de un circuito, por franja horaria (Marco 9.1c). La vigencia vive AQUI y no en circuit_promise_bands: la promesa se lee como conjunto, nunca como una franja suelta mezclada con otra version.';
COMMENT ON TABLE circuit_promise_bands IS
  'Una franja de una version de la promesa. No lleva vigencia propia. El horario de servicio del circuito manda: una franja fuera de el se rechaza al capturar (en @jtel/domain), y un hueco del horario sin franja es "sin promesa declarada".';
COMMENT ON COLUMN circuit_promise_bands.dia_tipo IS
  'Entre semana, sabado o domingo -- nunca los siete dias.';
COMMENT ON COLUMN circuit_promise_bands.sentido IS
  'NULL = promete igual en los dos sentidos.';


-- PASO 6 · Comprobar el efecto. NO ESCRIBE.
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('circuit_promise_tables', 'circuit_promise_bands');

SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
 WHERE t.typname = 'tipo_de_dia_circuito' ORDER BY e.enumsortorder;
