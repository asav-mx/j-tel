-- La promesa por franja horaria (Marco 9.1c) — ADITIVA, dos tablas y un enum.
--
-- Se aplica DESPUÉS de la 0043. No toca `circuits.declared_frequency_minutes`
-- —ese número suelto se queda como la promesa de respaldo cuando no hay
-- franjas—, ni ninguna fila existente. Nada del código que corre hoy conoce
-- nada de esto.
--
-- Tres decisiones de Asav, 20-sep-2026:
--
-- 1. LA PROMESA ES UN CONJUNTO, no una franja suelta. `circuit_promise_tables`
--    lleva la vigencia; `circuit_promise_bands` no la lleva. Corregir UNA
--    franja cierra la tabla entera y abre otra completa: «la promesa del 12
--    de octubre» nunca es una mezcla de dos versiones.
--
-- 2. DISTINGUE DÍA: entre semana, sábado o domingo — nunca los siete. Es el
--    tipo `tipo_de_dia_circuito`. Los festivos no entran: son un calendario,
--    y un calendario es otra pieza.
--
-- 3. EL HORARIO DE SERVICIO MANDA. Una franja fuera de
--    `circuits.service_start_local`/`service_end_local` se rechaza al
--    capturar, con su razón — nunca en silencio. Esto cruza tablas, así que
--    no es un CHECK de esta migración: lo decide `franjaDentroDelHorario` en
--    `@jtel/domain` antes de insertar. Un hueco del horario que ninguna
--    franja cubra es «sin promesa declarada» para ese tramo
--    (`promesaEnInstante`); no se rellena con la franja vecina.
--
-- ## Nace con vigencia, no sobrescribiendo
--
-- Es el mismo defecto que ya está anotado como pendiente con nombre en el
-- plan («la historia del horario de servicio de los circuitos — hoy se
-- sobrescribe»): esta tabla nueva NO lo hereda. Cambiar la promesa cierra la
-- vigente (`valid_to`) y abre una nueva; el candado de abajo impide dos
-- vigentes a la vez, igual que ya hace la base con las paradas y las
-- asignaciones de unidad.
--
-- ⚠ TRAMPA CONOCIDA (ver 0025): un valor nuevo de enum no se puede usar ni
-- leer con `enum_range` en la misma transacción donde se agrega. Aquí no
-- aplica: `tipo_de_dia_circuito` es un tipo enteramente nuevo, no un valor
-- agregado a uno existente, así que se puede usar de inmediato.

DO $$ BEGIN
  CREATE TYPE tipo_de_dia_circuito AS ENUM ('entre_semana', 'sabado', 'domingo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS circuit_promise_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id  UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to    TIMESTAMPTZ,
  -- Por qué TERMINÓ esta versión. Se escribe al cerrar, igual que el motivo
  -- de las paradas y de las asignaciones de unidad.
  motivo      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_promise_tables_circuit_idx
  ON circuit_promise_tables (circuit_id, valid_to);
--> statement-breakpoint
-- Una sola tabla de promesa vigente por circuito. Sin esto, dos filas
-- abiertas a la vez volverían ambigua «la promesa vigente hoy» — exactamente
-- lo que 9.1c existe para que nunca lo sea.
CREATE UNIQUE INDEX IF NOT EXISTS circuit_promise_tables_una_vigente
  ON circuit_promise_tables (circuit_id) WHERE valid_to IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS circuit_promise_bands (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_table_id   UUID NOT NULL REFERENCES circuit_promise_tables(id) ON DELETE CASCADE,
  dia_tipo           tipo_de_dia_circuito NOT NULL,
  -- NULL = promete igual en los dos sentidos.
  sentido            sentido_circuito,
  desde_local        TIME NOT NULL,
  hasta_local        TIME NOT NULL,
  frequency_minutes  INTEGER NOT NULL,
  CONSTRAINT circuit_promise_bands_frecuencia_positiva CHECK (frequency_minutes > 0),
  -- La franja NO cruza medianoche — simplificación de esta primera versión.
  -- Una franja nocturna real se declara como dos. Ver `franjaDentroDelHorario`
  -- en @jtel/domain.
  CONSTRAINT circuit_promise_bands_no_cruza_medianoche CHECK (desde_local < hasta_local)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_promise_bands_table_idx
  ON circuit_promise_bands (promise_table_id);
--> statement-breakpoint
COMMENT ON TABLE circuit_promise_tables IS
  'Una versión completa de la promesa de un circuito, por franja horaria (Marco 9.1c). La vigencia vive AQUI y no en circuit_promise_bands: la promesa se lee como conjunto, nunca como una franja suelta mezclada con otra version. Cambiar una franja cierra esta fila y abre otra completa.';
--> statement-breakpoint
COMMENT ON TABLE circuit_promise_bands IS
  'Una franja de una version de la promesa: cada N minutos, de tal hora a tal hora, tal tipo de dia, tal sentido. No lleva vigencia propia. El horario de servicio del circuito manda: una franja fuera de el se rechaza al capturar (fuera de esta migracion, en @jtel/domain), y un hueco del horario sin franja es "sin promesa declarada", nunca relleno con la vecina.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_promise_bands.dia_tipo IS
  'Entre semana, sabado o domingo -- nunca los siete dias. Los festivos no entran: son un calendario, y un calendario es otra pieza.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_promise_bands.sentido IS
  'NULL = promete igual en los dos sentidos.';
