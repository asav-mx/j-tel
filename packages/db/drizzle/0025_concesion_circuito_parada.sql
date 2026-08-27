-- Concesión · circuito · parada — la estructura del transporte concesionado. ADITIVA.
--
-- Se aplica DESPUÉS de la 0024. Un valor de enum, cinco tablas nuevas y un
-- enum nuevo. No toca ninguna tabla existente, no mueve un solo dato, y nada
-- del código que corre hoy conoce nada de esto. Se puede aplicar antes de
-- desplegar.
--
-- Plan: `docs/PLAN.md` §4, Tramo JB — Juárez Bus público.
--
-- ## La concesión NO es tabla propia
--
-- Es un `accounts` de tipo `concesion`, con su perfil al lado, igual que
-- carrier y client. Así hereda membresías, alcance y ledger sin duplicar
-- expediente, y la relación muchos-a-muchos con carriers cae sobre lo que ya
-- existe en vez de inventar un universo paralelo.
--
-- ## El circuito pertenece a la CONCESIÓN, no al carrier
--
-- Quién lo opera hoy lo dice `circuit_unit_assignments`, que es además la
-- puerta de entrada de los concesionarios invitados: cada uno registra su
-- concesión, sus circuitos, y qué carriers los corren. No se construye
-- "multi-concesionario": se construye la relación correcta y el multi sale solo.
--
-- ## Ida y vuelta no son espejo
--
-- Medido en el KML del circuito 1 el 26 de agosto de 2026: ida 20.83 km,
-- regreso 16.44 km. Por los sentidos únicos del Centro son caminos distintos,
-- así que cada sentido guarda su propio trazado y el sentido NUNCA se calcula
-- invirtiendo el otro.
--
-- ## Los tres campos del circuito, y por qué son campos
--
-- Frecuencia declarada, umbral de dato viejo y piso del rango de llegada viven
-- aquí, por circuito, con default. Si mañana un concesionario opera con otra
-- frecuencia o su corredor exige otro umbral, se ajusta desde la pantalla sin
-- desplegar. Los defaults son los del circuito 1: 20 min, 3 min, ±3 min.
--
-- La frecuencia va en MINUTOS porque es una promesa pública en minutos. Los dos
-- umbrales van en SEGUNDOS porque la prueba de campo de los días 11–13 puede
-- pedir afinarlos por debajo del minuto, y no quiero una migración para eso.

ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'concesion';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE sentido_circuito AS ENUM ('ida', 'vuelta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS concession_carriers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concession_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  carrier_account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to               TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS concession_carriers_concession_idx ON concession_carriers (concession_account_id, valid_to);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS concession_carriers_carrier_idx ON concession_carriers (carrier_account_id, valid_to);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuits_concession_idx ON circuits (concession_account_id, active);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
COMMENT ON TABLE circuit_stops IS
  'IDENTIDAD de una parada: lo que el QR impreso señala. Su nombre y su posición viven en circuit_stop_versions y cambian con vigencia. Las paradas son REFERENCIAS CON NOMBRE, no la unidad de cálculo: la llegada se calcula proyectando la unidad sobre el trazado.';
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_stop_versions_stop_idx ON circuit_stop_versions (stop_id, valid_to);
--> statement-breakpoint
-- Una sola versión vigente por parada. Es la garantía de que "la parada 7 de
-- hoy" nunca sea ambigua, y la hace la base, no el código de turno.
CREATE UNIQUE INDEX IF NOT EXISTS circuit_stop_versions_una_vigente
  ON circuit_stop_versions (stop_id) WHERE valid_to IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS circuit_unit_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id          UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  unit_id             UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  carrier_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_unit_assignments_circuit_idx ON circuit_unit_assignments (circuit_id, valid_to);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_unit_assignments_unit_idx ON circuit_unit_assignments (unit_id, valid_to);
--> statement-breakpoint
COMMENT ON TABLE circuit_unit_assignments IS
  'Qué unidad corre qué circuito y bajo qué carrier. Para el pasajero es invisible; para el sistema es la puerta de entrada de los concesionarios invitados, y el filtro que decide qué unidades se publican.';
