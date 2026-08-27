-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0025 · concesión · circuito · parada — para pegar en Neon
--
-- ADITIVA: un valor de enum, un enum nuevo y siete tablas nuevas. Nada
-- del código que corre hoy conoce nada de esto, así que se aplica
-- antes de desplegar la pantalla.
--
-- Va entera en una transacción. `ALTER TYPE ... ADD VALUE` sí puede ir
-- dentro de una transacción desde Postgres 12 mientras el valor nuevo
-- no se USE en la misma transacción — y aquí no se usa. Probado contra
-- la base de pruebas.
--
-- Marcha atrás: packages/db/drizzle/0025_concesion_circuito_parada.reversa.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Correr solo esto y anotar. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tablas,
       (SELECT count(*) FROM accounts)                                             AS cuentas,
       (SELECT count(*) FROM compliance_facts)                                     AS hechos,
       (SELECT count(*) FROM live_positions)                                       AS posiciones_vivas,
       'concesion' = ANY(enum_range(NULL::account_type)::text[])                    AS ya_existe_el_tipo,
       to_regclass('public.circuits') IS NOT NULL                                   AS ya_existen_las_tablas;

-- Las dos últimas deben salir FALSE. `posiciones_vivas` es la del recolector y
-- puede moverse sola entre una foto y otra: no es un dato que esta migración toque.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. De aquí al COMMIT, todo junto.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'concesion';
DO $$ BEGIN
  CREATE TYPE sentido_circuito AS ENUM ('ida', 'vuelta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS concession_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  legal_name         TEXT NOT NULL,
  -- El número de concesión que otorga la autoridad, cuando existe. Opcional a
  -- propósito: un concesionario invitado puede entrar antes de formalizar, y
  -- el historial acumulado es justo lo que después vuelve valioso formalizar.
  numero_concesion   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS concession_carriers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  carrier_account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to               TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS concession_carriers_concession_idx ON concession_carriers (concession_account_id, valid_to);
CREATE INDEX IF NOT EXISTS concession_carriers_carrier_idx ON concession_carriers (carrier_account_id, valid_to);
CREATE TABLE IF NOT EXISTS circuits (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                          TEXT NOT NULL,
  -- Lo que va en la URL pública y en el QR impreso. Único, y no se cambia
  -- después de mandar imprimir letreros.
  public_slug                   TEXT NOT NULL UNIQUE,
  declared_frequency_minutes    INTEGER NOT NULL DEFAULT 20,
  stale_after_seconds           INTEGER NOT NULL DEFAULT 180,
  arrival_range_floor_seconds   INTEGER NOT NULL DEFAULT 180,
  service_start_local           TIME NOT NULL DEFAULT '05:00',
  service_end_local             TIME NOT NULL DEFAULT '23:00',
  time_zone                     TEXT NOT NULL DEFAULT 'America/Ciudad_Juarez',
  active                        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circuits_frecuencia_positiva CHECK (declared_frequency_minutes > 0),
  CONSTRAINT circuits_umbral_positivo     CHECK (stale_after_seconds > 0),
  CONSTRAINT circuits_piso_positivo       CHECK (arrival_range_floor_seconds > 0)
);
CREATE INDEX IF NOT EXISTS circuits_concession_idx ON circuits (concession_account_id, active);
CREATE TABLE IF NOT EXISTS circuit_paths (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id         UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  sentido            sentido_circuito NOT NULL,
  -- [[lon, lat], ...] en el orden del recorrido. Se guarda tal cual para que la
  -- geometría punto-a-segmento lea el trazado sin reconstruirlo.
  coordinates        JSONB NOT NULL,
  point_count        INTEGER NOT NULL,
  length_meters      DOUBLE PRECISION NOT NULL,
  -- De qué capa del KML salió, según la escogió un humano en la pantalla.
  -- Se guarda para poder auditar la decisión, NUNCA para tomarla por nombre.
  source_layer_name  TEXT,
  source_file_name   TEXT,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circuit_paths_un_sentido UNIQUE (circuit_id, sentido),
  CONSTRAINT circuit_paths_minimo_dos_puntos CHECK (point_count >= 2)
);
CREATE TABLE IF NOT EXISTS circuit_stops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id   UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  -- Lo que abre la app situada en esta parada. **Va impreso en un letrero de
  -- lámina atornillado a un poste.** Por eso vive en la IDENTIDAD y no en la
  -- versión: si la parada se mueve media cuadra, el letrero sigue siendo el
  -- mismo letrero y su QR tiene que seguir funcionando.
  qr_slug      TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Retirar una parada tampoco borra: se marca y deja de publicarse.
  retired_at   TIMESTAMPTZ
);
COMMENT ON TABLE circuit_stops IS
  'IDENTIDAD de una parada: lo que el QR impreso señala. Su nombre y su posición viven en circuit_stop_versions y cambian con vigencia. Las paradas son REFERENCIAS CON NOMBRE, no la unidad de cálculo: la llegada se calcula proyectando la unidad sobre el trazado.';
CREATE TABLE IF NOT EXISTS circuit_stop_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id      UUID NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  orden        INTEGER NOT NULL,
  -- NULL = sirve en los dos sentidos.
  sentido      sentido_circuito,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  -- Vigencia. Mover o renombrar una parada NO sobrescribe: cierra la versión
  -- anterior con su valid_to y abre una nueva. Misma forma que la política del
  -- contrato y las variantes de trazado: cambia hacia adelante, el pasado no se
  -- reescribe, y el pasajero siempre ve la vigente.
  valid_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to     TIMESTAMPTZ,
  -- Por qué cambió, cuando quien la movió se molesta en decirlo. Sirve al
  -- historial de la concesión: "obra en la avenida", "calle cerrada".
  motivo       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS circuit_stop_versions_stop_idx ON circuit_stop_versions (stop_id, valid_to);
-- Una sola versión vigente por parada. Es la garantía de que "la parada 7 de
-- hoy" nunca sea ambigua, y la hace la base, no el código de turno.
CREATE UNIQUE INDEX IF NOT EXISTS circuit_stop_versions_una_vigente
  ON circuit_stop_versions (stop_id) WHERE valid_to IS NULL;
CREATE TABLE IF NOT EXISTS circuit_unit_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id          UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  unit_id             UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  carrier_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS circuit_unit_assignments_circuit_idx ON circuit_unit_assignments (circuit_id, valid_to);
CREATE INDEX IF NOT EXISTS circuit_unit_assignments_unit_idx ON circuit_unit_assignments (unit_id, valid_to);
COMMENT ON TABLE circuit_unit_assignments IS
  'Qué unidad corre qué circuito y bajo qué carrier. Para el pasajero es invisible; para el sistema es la puerta de entrada de los concesionarios invitados, y el filtro que decide qué unidades se publican.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · Las siete tablas quedaron. Debe dar 7.
SELECT count(*) AS tablas_nuevas FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN
 ('concession_profiles','concession_carriers','circuits','circuit_paths',
  'circuit_stops','circuit_stop_versions','circuit_unit_assignments');

-- 3.2 · El tipo de cuenta nuevo existe. Debe incluir 'concesion'.
SELECT enum_range(NULL::account_type)::text AS tipos_de_cuenta;

-- 3.3 · Los tres campos del circuito traen su default. Debe dar TRUE.
SELECT (SELECT column_default FROM information_schema.columns
         WHERE table_name='circuits' AND column_name='declared_frequency_minutes')  LIKE '%20%'
   AND (SELECT column_default FROM information_schema.columns
         WHERE table_name='circuits' AND column_name='stale_after_seconds')         LIKE '%180%'
   AND (SELECT column_default FROM information_schema.columns
         WHERE table_name='circuits' AND column_name='arrival_range_floor_seconds') LIKE '%180%'
  AS defaults_del_circuito_1;

-- 3.4 · Una parada no puede tener dos versiones vigentes. Debe dar TRUE.
SELECT EXISTS (SELECT 1 FROM pg_indexes
                WHERE tablename='circuit_stop_versions'
                  AND indexname='circuit_stop_versions_una_vigente') AS una_sola_vigente;

-- 3.5 · Nada se movió. Comparar con la foto del paso 1.
--       `tablas` sube en 7. `cuentas` y `hechos` idénticos.
--       `posiciones_vivas` puede haber cambiado: la llena el recolector cada minuto.
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tablas,
       (SELECT count(*) FROM accounts)                                             AS cuentas,
       (SELECT count(*) FROM compliance_facts)                                     AS hechos;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si todo cuadró:
COMMIT;
-- Si no:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────
