-- La familia de documentos del expediente: mercados, su catálogo y las fojas. ADITIVA.
--
-- Se aplica ANTES de desplegar el código que la lee. La API relacional de
-- Drizzle pide TODAS las columnas de `accounts`, y el código nuevo declara
-- `accounts.market_id`: desplegado contra una base sin esa columna, toda
-- pantalla que lea cuentas revienta (la lección de la 0016). Al revés no pasa
-- nada: el código de hoy no conoce nada de esto.
--
-- Gobierna: Marco, Pieza 6 §H (6.30–6.33) y `docs/Ficha-Expedientes.md`,
-- ratificada por ASAV el 16 de septiembre de 2026.
--
-- ══════════════════════════════════════════════════════════════════════
-- Lo que crea
-- ══════════════════════════════════════════════════════════════════════
--
--   markets                 país + estado + municipio opcional, con su zona
--                           horaria: el «hoy» de un vencimiento es el del
--                           mercado, no UTC (ficha §4).
--   accounts.market_id      a qué mercado pertenece una cuenta de carrier.
--   document_types          el catálogo de un mercado: qué papeles existen.
--   document_type_rules     la regla de cada tipo, versionada: obligatorio,
--                           vence, días de aviso, periodicidad. Una fila por
--                           versión; la vigente es la más reciente.
--   documents               la foja: un papel de una unidad o de un chofer.
--                           Renovar crea una foja nueva.
--   document_versions       las versiones de una foja: folio y fechas.
--                           Corregir crea una versión nueva.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué así
-- ══════════════════════════════════════════════════════════════════════
--
-- **El catálogo es dato, no código** (ficha §5): cada mercado define el suyo,
-- como cada contrato define su tolerancia, y se edita desde la pantalla (6.18).
--
-- **Chihuahua nace con sus siete nombres y SIN reglas.** Obligatorio, vence,
-- días de aviso y periodicidad los carga ASAV desde la pantalla. Mientras un
-- tipo no tenga regla, la lectura dice «falta la regla» y no supone nada
-- (ficha §5.4).
--
-- **El mercado es estatal: MX · Chihuahua, sin municipio** (ASAV, 16 sep 2026).
-- El transporte de personal es competencia del Estado —permiso de la Secretaría
-- estatal, GPS obligatorio por ley estatal—; el municipio sólo regula tránsito.
-- El mismo catálogo sirve para los 67 municipios. Un papel puramente municipal
-- se agrega después como excepción.
--
-- **Su zona horaria es la de Ciudad Juárez**, como ratificó la ficha §4, aunque
-- el resto del estado usa `America/Chihuahua` (una hora de diferencia parte del
-- año). Hoy todas las cuentas operan en Juárez. Si llega un carrier de otra zona
-- del estado, la zona pasa a la cuenta: es otra migración y otra decisión.
--
-- **Nada se edita en sitio.** Las reglas, las fojas y sus versiones rechazan el
-- UPDATE con un trigger: corregir es agregar. El DELETE sí se permite, a
-- propósito: lo necesitan la purga de un chofer dado de baja (Plan-Choferes) y
-- el borrado en cascada de una cuenta de ejemplo.
--
-- **El muro entre cuentas se sostiene en la base.** Una foja apunta a su
-- unidad o a su chofer junto con su cuenta, con una llave foránea compuesta: no
-- se puede escribir el papel de la cuenta A sobre la unidad de la cuenta B. Para
-- eso se agrega un índice único (id, carrier_account_id) a `units` y a `drivers`
-- — redundante con su llave primaria, y chico: `units` tiene ~100 filas y
-- `drivers` está vacía, así que no hace falta CONCURRENTLY.
--
-- **Las llaves hacia la unidad y el chofer no borran en cascada.** Borrar una
-- unidad con papeles falla (6.15: lo que tuvo historia no se borra). Borrar la
-- CUENTA entera sí arrastra todo, porque la cascada desde `accounts` quita las
-- fojas en la misma sentencia antes de que se revise la llave.
--
-- No toca ninguna fila existente. Agrega un mercado y siete tipos.

CREATE TABLE IF NOT EXISTS markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  state_code text NOT NULL,
  municipality text,
  name text NOT NULL,
  time_zone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT markets_pais_iso CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT markets_estado_con_clave CHECK (state_code ~ '^[A-Z0-9]{1,3}$'),
  CONSTRAINT markets_municipio_no_vacio CHECK (municipality IS NULL OR btrim(municipality) <> '')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS markets_lugar_idx
  ON markets (country_code, state_code, (coalesce(municipality, '')));
--> statement-breakpoint

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES markets(id) ON DELETE RESTRICT;
--> statement-breakpoint

-- Sólo una cuenta de carrier tiene mercado: el catálogo es de papeles del
-- transportista. Una planta o una concesión con mercado sería una afirmación
-- que nada usa.
DO $$ BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_mercado_solo_carrier
    CHECK (market_id IS NULL OR type = 'carrier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  clave text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_types_sujeto CHECK (subject IN ('unidad', 'chofer')),
  CONSTRAINT document_types_clave CHECK (clave ~ '^[a-z0-9_]+$')
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS document_types_mercado_clave_idx
  ON document_types (market_id, subject, clave);
--> statement-breakpoint

-- Cada columna de la regla es nullable a propósito: NULL es «todavía no se
-- carga», y la lectura lo dice en vez de suponer. Los CHECK impiden las
-- combinaciones que no significan nada: días de aviso o periodicidad para un
-- papel del que no se sabe si vence, o que no vence.
CREATE TABLE IF NOT EXISTS document_type_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
  required boolean,
  expires boolean,
  warning_days integer,
  periodicity_months integer,
  actor_kind text NOT NULL,
  actor_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_type_rules_aviso CHECK (warning_days IS NULL OR (warning_days >= 0 AND expires IS TRUE)),
  CONSTRAINT document_type_rules_periodicidad CHECK (periodicity_months IS NULL OR (periodicity_months > 0 AND expires IS TRUE))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS document_type_rules_tipo_idx
  ON document_type_rules (document_type_id, created_at DESC);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS units_id_cuenta_idx ON units (id, carrier_account_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS drivers_id_cuenta_idx ON drivers (id, carrier_account_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
  unit_id uuid,
  driver_id uuid,
  actor_kind text NOT NULL,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_un_sujeto CHECK ((unit_id IS NULL) <> (driver_id IS NULL)),
  CONSTRAINT documents_unidad_de_su_cuenta FOREIGN KEY (unit_id, carrier_account_id)
    REFERENCES units (id, carrier_account_id),
  CONSTRAINT documents_chofer_de_su_cuenta FOREIGN KEY (driver_id, carrier_account_id)
    REFERENCES drivers (id, carrier_account_id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS documents_unidad_idx
  ON documents (unit_id, document_type_id, created_at DESC) WHERE unit_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS documents_chofer_idx
  ON documents (driver_id, document_type_id, created_at DESC) WHERE driver_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS documents_cuenta_idx ON documents (carrier_account_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folio text,
  issued_on date,
  expires_on date,
  expiry_calculated boolean NOT NULL DEFAULT false,
  actor_kind text NOT NULL,
  actor_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_calculada_con_fechas CHECK (NOT expiry_calculated OR (expires_on IS NOT NULL AND issued_on IS NOT NULL)),
  CONSTRAINT document_versions_fechas_en_orden CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS document_versions_foja_idx
  ON document_versions (document_id, created_at DESC);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION rechazar_edicion_en_sitio() RETURNS trigger AS $rechazar$
BEGIN
  RAISE EXCEPTION 'La tabla % no se edita en sitio: corregir es agregar una version nueva (0038).', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$rechazar$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS document_type_rules_sin_edicion ON document_type_rules;
--> statement-breakpoint
CREATE TRIGGER document_type_rules_sin_edicion
  BEFORE UPDATE ON document_type_rules
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();
--> statement-breakpoint

DROP TRIGGER IF EXISTS documents_sin_edicion ON documents;
--> statement-breakpoint
CREATE TRIGGER documents_sin_edicion
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();
--> statement-breakpoint

DROP TRIGGER IF EXISTS document_versions_sin_edicion ON document_versions;
--> statement-breakpoint
CREATE TRIGGER document_versions_sin_edicion
  BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();
--> statement-breakpoint

COMMENT ON TABLE markets IS
  'Un mercado: pais + estado + municipio opcional. Cada uno define su catalogo de documentos, porque cada ley local es distinta (0038).';
--> statement-breakpoint
COMMENT ON COLUMN markets.time_zone IS
  'Zona horaria IANA del mercado. El dia de un vencimiento se cuenta en esta hora, no en UTC (0038).';
--> statement-breakpoint
COMMENT ON COLUMN accounts.market_id IS
  'El mercado de una cuenta de carrier: decide que catalogo de documentos le aplica. Solo carriers (0038).';
--> statement-breakpoint
COMMENT ON TABLE document_type_rules IS
  'La regla de un tipo de documento, versionada. La vigente es la mas reciente. NULL es todavia no cargada. No se edita: se agrega (0038).';
--> statement-breakpoint
COMMENT ON TABLE documents IS
  'Una foja del expediente: un papel de una unidad o de un chofer. Renovar crea una foja nueva. No se edita (0038).';
--> statement-breakpoint
COMMENT ON TABLE document_versions IS
  'Las versiones de una foja. Corregir crea una version nueva; la vigente es la mas reciente. No se edita (0038).';
--> statement-breakpoint

INSERT INTO markets (country_code, state_code, municipality, name, time_zone)
VALUES ('MX', 'CHH', NULL, 'Chihuahua', 'America/Ciudad_Juarez')
ON CONFLICT (country_code, state_code, (coalesce(municipality, ''))) DO NOTHING;
--> statement-breakpoint

INSERT INTO document_types (market_id, subject, clave, name)
SELECT m.id, t.subject, t.clave, t.name
  FROM markets m
 CROSS JOIN (VALUES
   ('unidad', 'poliza_de_seguro',            'Póliza de seguro'),
   ('unidad', 'tarjeta_de_circulacion',      'Tarjeta de circulación'),
   ('unidad', 'permiso_transporte_personal', 'Permiso de transporte de personal'),
   ('unidad', 'verificacion_vehicular',      'Verificación vehicular'),
   ('chofer', 'licencia',                    'Licencia'),
   ('chofer', 'examen_medico',               'Examen médico'),
   ('chofer', 'antidoping',                  'Antidoping')
 ) AS t(subject, clave, name)
 WHERE m.country_code = 'MX' AND m.state_code = 'CHH' AND m.municipality IS NULL
ON CONFLICT (market_id, subject, clave) DO NOTHING;
