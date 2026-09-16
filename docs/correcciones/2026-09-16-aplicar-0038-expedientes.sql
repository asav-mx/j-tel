-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0038: la familia de documentos del expediente
--
-- SE APLICA DESPUÉS DE LA 0037 (aplicada: el 16 sep 2026 producción ya tiene
-- `telemetry_archive_marks`).
--
-- ⚠ LA MIGRACIÓN VA ANTES DEL MERGE.
--   El código del PR declara `accounts.market_id`, y la API relacional de
--   Drizzle pide TODAS las columnas de `accounts` en cada lectura de cuentas.
--   Desplegado contra una base sin la columna, toda pantalla que lea cuentas
--   devuelve 500 — la caída del 2 de agosto con la 0016. Al revés no pasa nada:
--   el código de hoy no conoce nada de esto.
--
--   1. PASO 1 · antes, de lectura.
--   2. PASO 2 · la migración.
--   3. PASO 3 · comprobarla, de lectura.
--   4. Mergear y desplegar el PR.
--
-- No hay PASO 4: ningún código de este PR escribe todavía. La primera escritura
-- llega con la pantalla (PR D) y la del catálogo (PR D2).
--
-- Ensayada en la rama desechable el 16 sep 2026, sentencia por sentencia y sin
-- BEGIN, igual que aquí: pasó entera, y una segunda corrida no cambió nada.
--
-- El camino de regreso está al final.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
--
-- Antes de nada, desde la terminal:
--
--   pnpm --filter @jtel/db verificar-solo-lectura
--
-- Tiene que decir «heredará lo que se cree después»: esta migración CREA cinco
-- tablas, y sin eso el PASO 3 sale ciego. (El 16 sep 2026 lo decía.)
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.markets')             AS markets,
       to_regclass('public.document_types')      AS tipos,
       to_regclass('public.document_type_rules') AS reglas,
       to_regclass('public.documents')           AS fojas,
       to_regclass('public.document_versions')   AS versiones,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_name = 'accounts' AND column_name = 'market_id') AS columna_market_id;

SELECT (SELECT count(*) FROM accounts)          AS cuentas,
       (SELECT count(*) FROM units)             AS unidades,
       (SELECT count(*) FROM drivers)           AS choferes,
       (SELECT count(*) FROM compliance_facts)  AS hechos,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public')         AS tablas;

-- LO QUE DEBES VER:
--   las cinco tablas     (null)
--   columna_market_id    0
--   y los conteos: ANÓTALOS. Son la evidencia de que la migración no movió
--   datos. El 16 sep 2026 había 53 tablas.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño. Sin BEGIN: cada sentencia sola.
--
-- Es la 0038 tal cual. Aditiva e idempotente: si algo falla a la mitad, se
-- corrige y se vuelve a correr desde el principio sin daño.
--
-- ⚠ Dos sentencias crean una FUNCIÓN y un DO con `$…$`. Pégalas enteras: la
--   consola de Neon las toma como una sola sentencia.
--
-- Los dos índices únicos de `units` y `drivers` son normales, sin
-- CONCURRENTLY: `units` tiene ~80 filas y `drivers` está vacía.
-- ───────────────────────────────────────────────────────────────────

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

CREATE UNIQUE INDEX IF NOT EXISTS markets_lugar_idx
  ON markets (country_code, state_code, (coalesce(municipality, '')));

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS market_id uuid REFERENCES markets(id) ON DELETE RESTRICT;

DO $$ BEGIN
  ALTER TABLE accounts ADD CONSTRAINT accounts_mercado_solo_carrier
    CHECK (market_id IS NULL OR type = 'carrier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS document_types_mercado_clave_idx
  ON document_types (market_id, subject, clave);

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

CREATE INDEX IF NOT EXISTS document_type_rules_tipo_idx
  ON document_type_rules (document_type_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS units_id_cuenta_idx ON units (id, carrier_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_id_cuenta_idx ON drivers (id, carrier_account_id);

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

CREATE INDEX IF NOT EXISTS documents_unidad_idx
  ON documents (unit_id, document_type_id, created_at DESC) WHERE unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_chofer_idx
  ON documents (driver_id, document_type_id, created_at DESC) WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_cuenta_idx ON documents (carrier_account_id);

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

CREATE INDEX IF NOT EXISTS document_versions_foja_idx
  ON document_versions (document_id, created_at DESC);

CREATE OR REPLACE FUNCTION rechazar_edicion_en_sitio() RETURNS trigger AS $rechazar$
BEGIN
  RAISE EXCEPTION 'La tabla % no se edita en sitio: corregir es agregar una version nueva (0038).', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$rechazar$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_type_rules_sin_edicion ON document_type_rules;
CREATE TRIGGER document_type_rules_sin_edicion
  BEFORE UPDATE ON document_type_rules
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();

DROP TRIGGER IF EXISTS documents_sin_edicion ON documents;
CREATE TRIGGER documents_sin_edicion
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();

DROP TRIGGER IF EXISTS document_versions_sin_edicion ON document_versions;
CREATE TRIGGER document_versions_sin_edicion
  BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION rechazar_edicion_en_sitio();

COMMENT ON TABLE markets IS
  'Un mercado: pais + estado + municipio opcional. Cada uno define su catalogo de documentos, porque cada ley local es distinta (0038).';
COMMENT ON COLUMN markets.time_zone IS
  'Zona horaria IANA del mercado. El dia de un vencimiento se cuenta en esta hora, no en UTC (0038).';
COMMENT ON COLUMN accounts.market_id IS
  'El mercado de una cuenta de carrier: decide que catalogo de documentos le aplica. Solo carriers (0038).';
COMMENT ON TABLE document_type_rules IS
  'La regla de un tipo de documento, versionada. La vigente es la mas reciente. NULL es todavia no cargada. No se edita: se agrega (0038).';
COMMENT ON TABLE documents IS
  'Una foja del expediente: un papel de una unidad o de un chofer. Renovar crea una foja nueva. No se edita (0038).';
COMMENT ON TABLE document_versions IS
  'Las versiones de una foja. Corregir crea una version nueva; la vigente es la mas reciente. No se edita (0038).';

INSERT INTO markets (country_code, state_code, municipality, name, time_zone)
VALUES ('MX', 'CHH', 'Juárez', 'Ciudad Juárez, Chihuahua', 'America/Ciudad_Juarez')
ON CONFLICT (country_code, state_code, (coalesce(municipality, ''))) DO NOTHING;

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
 WHERE m.country_code = 'MX' AND m.state_code = 'CHH' AND m.municipality = 'Juárez'
ON CONFLICT (market_id, subject, clave) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · COMPROBAR. Con el usuario de solo lectura.
--
-- Sólo lecturas. Que los CHECK y los triggers MUERDEN no se prueba aquí
-- —una escritura que falla a propósito tumba la consola de Neon—: lo prueba
-- `packages/db/src/expediente-documentos.integration.test.ts` contra la
-- desechable (19/19 el 16 sep 2026). Aquí se lee que existan y digan lo correcto.
-- ───────────────────────────────────────────────────────────────────

-- 3a. Las tablas, vacías salvo el mercado y su catálogo.
SELECT (SELECT count(*) FROM markets)             AS mercados,
       (SELECT count(*) FROM document_types)      AS tipos,
       (SELECT count(*) FROM document_type_rules) AS reglas,
       (SELECT count(*) FROM documents)           AS fojas,
       (SELECT count(*) FROM document_versions)   AS versiones,
       (SELECT count(*) FROM accounts WHERE market_id IS NOT NULL) AS cuentas_con_mercado;

-- LO QUE DEBES VER:   1 · 7 · 0 · 0 · 0 · 0

-- 3b. El catálogo de Juárez: nombres sin reglas.
SELECT m.name AS mercado, t.subject, t.clave, t.name
  FROM document_types t JOIN markets m ON m.id = t.market_id
 ORDER BY t.subject DESC, t.clave;

-- LO QUE DEBES VER: 4 de unidad (permiso_transporte_personal,
-- poliza_de_seguro, tarjeta_de_circulacion, verificacion_vehicular) y 3 de
-- chofer (antidoping, examen_medico, licencia), todos de «Ciudad Juárez, Chihuahua».

-- 3c. Los candados, leídos.
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conname IN (
   'accounts_mercado_solo_carrier',
   'document_type_rules_aviso', 'document_type_rules_periodicidad',
   'documents_un_sujeto', 'documents_unidad_de_su_cuenta', 'documents_chofer_de_su_cuenta',
   'document_versions_calculada_con_fechas', 'document_versions_fechas_en_orden')
 ORDER BY 1, 2;

-- LO QUE DEBES VER: las 8, y en particular
--   documents_unidad_de_su_cuenta  FOREIGN KEY (unit_id, carrier_account_id) REFERENCES units(id, carrier_account_id)

SELECT tgrelid::regclass AS tabla, tgname
  FROM pg_trigger
 WHERE tgname LIKE '%_sin_edicion' AND NOT tgisinternal
 ORDER BY 1;

-- LO QUE DEBES VER: document_type_rules, documents y document_versions, cada una con su trigger.

-- 3d. Los conteos no se movieron. Compara con el PASO 1.
SELECT (SELECT count(*) FROM accounts)          AS cuentas,
       (SELECT count(*) FROM units)             AS unidades,
       (SELECT count(*) FROM drivers)           AS choferes,
       (SELECT count(*) FROM compliance_facts)  AS hechos,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public')         AS tablas;

-- LO QUE DEBES VER: todo igual que en el PASO 1, salvo tablas = las de antes + 5.
--
-- Si algún SELECT da `permission denied`, falta el GRANT al usuario de solo
-- lectura: `GRANT SELECT ON <tabla> TO jtel_readonly;` con el dueño. NO se sigue
-- al merge sin poder leerlas.


-- ═══════════════════════════════════════════════════════════════════
-- CAMINO DE REGRESO
--
-- 1. Revertir el PR y desplegar. El código de hoy no conoce nada de esto.
-- 2. Sólo después, la reversa: `packages/db/drizzle/0038_expedientes_documentos.reversa.sql`.
--    Mientras nada escriba (antes del PR D) no se pierde nada: ni reglas ni
--    fojas. Después, la reversa lo dice arriba y pide contarlas antes.
-- ═══════════════════════════════════════════════════════════════════
