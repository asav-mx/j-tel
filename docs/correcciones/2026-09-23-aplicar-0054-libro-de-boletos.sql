-- ═══════════════════════════════════════════════════════════════════
-- Runbook · aplicar la 0054 (el libro de boletos y el registro de lectores)
--
-- Se corre en el editor de Neon, un PASO a la vez. ADITIVA: cuatro tablas
-- nuevas, vacías, y un trigger que sólo alcanza a dos de ellas. No toca
-- ninguna fila de ninguna tabla que ya exista.
--
-- ⚠ **EN PRODUCCIÓN, NO ANTES DEL 29 DE SEPTIEMBRE** (la misma raya que la
-- 0053, ASAV 22-sep): la semana de la calibración con camiones va sin piezas
-- nuevas cerca.
--
-- Se corre DOS veces, cada una en su rama de Neon:
--   1. En la rama de PRUEBA (la de DATABASE_URL_TEST) — la corre Claude.
--      Hecho el 23-sep-2026: 27 sentencias, sin error.
--   2. En PRODUCCIÓN, del 29 en adelante — la corre Asav.
--
-- Requisito: la 0053 ya aplicada (PASO 0 lo comprueba).
--
-- ⚠ **ANTES DE DESPLEGAR EL CÓDIGO.** La API relacional de Drizzle pide TODAS
-- las columnas declaradas: el código nuevo contra una base sin estas tablas
-- revienta en la ruta de sincronización (la lección de la 0016). Al revés no
-- pasa nada: la base con tablas vacías y el código viejo se ignoran.
--
-- ⚠ **LA REVERSA DE ÉSTA SÍ BORRA DATOS.** Los quemados que entregaron los
-- lectores no están en ningún otro lado —el aparato borra su jornada al
-- sincronizar—. El PASO 6 cuenta las filas para que quien la deshaga lo sepa
-- antes de correrla.
-- ═══════════════════════════════════════════════════════════════════


-- PASO 0 · Comprobar el punto de partida. NO ESCRIBE.
-- Esperado:
--   tabla_0053 = 1   (la 0053 ya está)
--   libro      = 0   (ninguna de las cuatro nuevas existe todavía)
--   funcion    = 0
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'circuit_leg_times') AS tabla_0053,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name IN ('validators', 'validator_assignments', 'validator_syncs', 'ticket_operations')) AS libro,
  (SELECT count(*) FROM pg_proc WHERE proname = 'rechazar_cambio_en_el_libro') AS funcion;


-- PASO 1 · Los lectores. Concepto propio, no `devices`: un lector no tiene
-- IMEI, no transmite a Compás, y un camión trae GPS y lector a la vez — el
-- candado `device_assignments_unidad_una_vigente` (0039) no lo permitiría.
-- Misma ley 6.5: baja con fecha y motivo, la fila no se borra.
CREATE TABLE IF NOT EXISTS validators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  llave_publica text NOT NULL,
  consecutivo integer NOT NULL,
  label text NOT NULL,
  alta_en timestamptz NOT NULL DEFAULT now(),
  alta_por text,
  baja_en timestamptz,
  baja_motivo text,
  baja_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validators_llave_publica_hex CHECK (llave_publica ~ '^[0-9a-f]{64}$'),
  CONSTRAINT validators_baja_con_motivo CHECK ((baja_en IS NULL) = (baja_motivo IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS validators_llave_publica_unica ON validators (llave_publica);
CREATE UNIQUE INDEX IF NOT EXISTS validators_consecutivo_unico ON validators (consecutivo);
CREATE SEQUENCE IF NOT EXISTS validators_consecutivo_seq AS integer MINVALUE 1;


-- PASO 2 · Lector ↔ unidad, con vigencia. Esto SÍ cae en cascada: es plan,
-- como `circuit_unit_assignments`, no es el libro.
CREATE TABLE IF NOT EXISTS validator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id uuid NOT NULL REFERENCES validators(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  asignada_por text,
  cerrada_por text,
  motivo_cierre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS validator_assignments_lector_una_vigente
  ON validator_assignments (validator_id) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS validator_assignments_unidad_una_vigente
  ON validator_assignments (unit_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS validator_assignments_lector_idx
  ON validator_assignments (validator_id, valid_from);
CREATE INDEX IF NOT EXISTS validator_assignments_unidad_idx
  ON validator_assignments (unit_id, valid_from);


-- PASO 3 · Las entregas del lector, traiga o no traiga quemados: el latido de
-- un camión vacío es una entrega de cero renglones.
CREATE TABLE IF NOT EXISTS validator_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id uuid NOT NULL REFERENCES validators(id) ON DELETE RESTRICT,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL,
  renglones_enviados integer NOT NULL DEFAULT 0,
  renglones_nuevos integer NOT NULL DEFAULT 0,
  renglones_rechazados integer NOT NULL DEFAULT 0,
  firma text,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT validator_syncs_resultado CHECK (
    resultado IN ('aceptado', 'aceptado_con_rechazos', 'rechazado_firma', 'rechazado_lector_de_baja')
  ),
  CONSTRAINT validator_syncs_conteos CHECK (
    renglones_enviados >= 0
    AND renglones_nuevos >= 0
    AND renglones_rechazados >= 0
    AND renglones_nuevos + renglones_rechazados <= renglones_enviados
  )
);

CREATE INDEX IF NOT EXISTS validator_syncs_lector_idx ON validator_syncs (validator_id, recibido_en);


-- PASO 4 · El libro. Las referencias van DIRECTO a `units` y `circuits`, con
-- RESTRICT: `circuit_unit_assignments` cae en cascada, y colgar de ella haría
-- que borrar un circuito se llevara viajes quemados.
--
-- Consecuencia deliberada: una unidad con viajes en el libro ya no se puede
-- borrar, ni la cuenta que la contiene.
CREATE TABLE IF NOT EXISTS ticket_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  folio text NOT NULL,
  validator_id uuid REFERENCES validators(id) ON DELETE RESTRICT,
  unidad_asignada_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  circuito_asignado_id uuid REFERENCES circuits(id) ON DELETE RESTRICT,
  con_senal boolean,
  firma_del_boleto text,
  quemado_en timestamptz,
  dia_del_lector date,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  paso_del_lector uuid,
  sync_id uuid REFERENCES validator_syncs(id) ON DELETE RESTRICT,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ticket_operations_kind CHECK (
    kind IN ('emitido', 'quemado', 'reclamo_dictado', 'doble_uso_detectado', 'conciliado')
  ),
  CONSTRAINT ticket_operations_del_lector_completo CHECK (
    kind NOT IN ('quemado', 'reclamo_dictado')
    OR (validator_id IS NOT NULL AND paso_del_lector IS NOT NULL
        AND quemado_en IS NOT NULL AND dia_del_lector IS NOT NULL
        AND con_senal IS NOT NULL AND sync_id IS NOT NULL)
  ),
  CONSTRAINT ticket_operations_quemado_con_firma CHECK (
    kind <> 'quemado' OR firma_del_boleto IS NOT NULL
  ),
  CONSTRAINT ticket_operations_reclamo_sin_firma CHECK (
    kind <> 'reclamo_dictado' OR firma_del_boleto IS NULL
  ),
  CONSTRAINT ticket_operations_hallazgo_sin_lector CHECK (
    kind <> 'doble_uso_detectado'
    OR (validator_id IS NULL AND paso_del_lector IS NULL AND firma_del_boleto IS NULL)
  )
);

-- Por LECTOR y PASO, nunca por folio a secas: por folio, el segundo lector que
-- quema el mismo boleto se vería como un reenvío y el doble uso desaparecería.
CREATE UNIQUE INDEX IF NOT EXISTS ticket_operations_paso_unico
  ON ticket_operations (validator_id, paso_del_lector) WHERE paso_del_lector IS NOT NULL;
CREATE INDEX IF NOT EXISTS ticket_operations_folio_idx ON ticket_operations (folio, kind);
CREATE INDEX IF NOT EXISTS ticket_operations_lector_idx
  ON ticket_operations (validator_id, recibido_en);


-- PASO 5 · Lo que la base no deja hacer. Un trigger y no un permiso: el
-- permiso no alcanza al dueño de la tabla, y el dueño es quien corre estas
-- hojas. TRUNCATE lleva el suyo porque no dispara triggers de renglón.
CREATE FUNCTION rechazar_cambio_en_el_libro() RETURNS trigger AS $libro$
BEGIN
  RAISE EXCEPTION
    'El libro de boletos no se edita ni se borra (0054): % sobre % esta prohibido.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'JT054';
END;
$libro$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_operations_sin_cambios
  BEFORE UPDATE OR DELETE ON "ticket_operations"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_en_el_libro();
CREATE TRIGGER ticket_operations_sin_truncar
  BEFORE TRUNCATE ON "ticket_operations"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_en_el_libro();
CREATE TRIGGER validator_syncs_sin_cambios
  BEFORE UPDATE OR DELETE ON "validator_syncs"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_en_el_libro();
CREATE TRIGGER validator_syncs_sin_truncar
  BEFORE TRUNCATE ON "validator_syncs"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_en_el_libro();

COMMENT ON TABLE validators IS
  'Los lectores del camion (0054, Ontoy 3.0 P3.5). Concepto propio, no devices: un lector no tiene IMEI ni transmite a Compas, y un camion trae GPS y lector a la vez. Misma ley 6.5: baja con fecha y motivo, la fila no se borra.';
COMMENT ON COLUMN validators.llave_publica IS
  'La publica Ed25519 del lector, en hex. Con la privada, que no sale del aparato, firma sus lotes. La baja la revoca en el instante: un lote firmado por un lector de baja se rechaza y queda su renglon en validator_syncs.';
COMMENT ON TABLE validator_assignments IS
  'Lector en unidad, con vigencia (0054). Espejo de device_assignments; un lector en una unidad y una unidad con un lector a la vez. Es PLAN y cae en cascada, al contrario del libro.';
COMMENT ON TABLE validator_syncs IS
  'Cada vez que un lector habla, traiga o no quemados (0054). El latido de un camion vacio es una entrega de cero renglones. Inmutable: aqui queda el intento de un lector dado de baja.';
COMMENT ON TABLE ticket_operations IS
  'El libro de operaciones de boletos de Ontoy (0054). Solo INSERT: un trigger rechaza UPDATE, DELETE y TRUNCATE. No es ledger_entries, que es la bitacora del arbitro y cuelga de trip y occurrence. Guarda lo observado; no decide a quien le toca el dinero (Pieza 10, 8.14).';
COMMENT ON COLUMN ticket_operations.circuito_asignado_id IS
  'El circuito que el PLAN le asignaba a la unidad al momento del quemado (circuit_unit_assignments). NO es el circuito recorrido: ese se deriva del GPS y no vive aqui. Null es no consta.';
COMMENT ON COLUMN ticket_operations.quemado_en IS
  'La hora del reloj del LECTOR, que sin red puede venir corrida. La hora que consta es recibido_en, la del servidor.';


-- PASO 6 · Comprobar el efecto. NO ESCRIBE.
-- Esperado: tablas = 4, indices = 9, triggers = 4, funcion = 1,
--           validaciones = 9, renglones = 0 (el libro nace vacío).
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name IN ('validators', 'validator_assignments', 'validator_syncs', 'ticket_operations')) AS tablas,
  (SELECT count(*) FROM pg_indexes WHERE indexname IN (
      'validators_llave_publica_unica', 'validators_consecutivo_unico',
      'validator_assignments_lector_una_vigente', 'validator_assignments_unidad_una_vigente',
      'validator_assignments_lector_idx', 'validator_assignments_unidad_idx',
      'validator_syncs_lector_idx', 'ticket_operations_paso_unico',
      'ticket_operations_folio_idx')) AS indices,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN (
      'ticket_operations_sin_cambios', 'ticket_operations_sin_truncar',
      'validator_syncs_sin_cambios', 'validator_syncs_sin_truncar')) AS triggers,
  (SELECT count(*) FROM pg_proc WHERE proname = 'rechazar_cambio_en_el_libro') AS funcion,
  (SELECT count(*) FROM pg_constraint WHERE conname IN (
      'validators_llave_publica_hex', 'validators_baja_con_motivo',
      'validator_syncs_resultado', 'validator_syncs_conteos',
      'ticket_operations_kind', 'ticket_operations_del_lector_completo',
      'ticket_operations_quemado_con_firma', 'ticket_operations_reclamo_sin_firma',
      'ticket_operations_hallazgo_sin_lector')) AS validaciones,
  (SELECT count(*) FROM ticket_operations) AS renglones;


-- PASO 7 · Que los cuatro triggers estén ENCENDIDOS. NO ESCRIBE.
--
-- Un trigger existe y puede estar apagado (`ALTER TABLE ... DISABLE TRIGGER`),
-- y apagado se ve igual en `pg_trigger` si sólo se cuenta. Aquí se mira el
-- estado: `O` es «encendido para el origen», que es lo que hace falta.
--
-- Esperado: cuatro renglones, los cuatro con encendido = 'O' y la función
-- `rechazar_cambio_en_el_libro`.
SELECT t.tgname, t.tgenabled AS encendido, p.proname AS funcion
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
 WHERE t.tgname IN (
   'ticket_operations_sin_cambios', 'ticket_operations_sin_truncar',
   'validator_syncs_sin_cambios', 'validator_syncs_sin_truncar')
 ORDER BY t.tgname;

-- Que además MUERDAN no se prueba aquí: probarlo exige escribir una fila, y
-- una hoja de producción no escribe para probarse. Lo prueba
-- `packages/db/src/libro-de-boletos.integration.test.ts` contra la rama
-- desechable, que intenta UPDATE, DELETE y TRUNCATE y exige que los tres
-- fallen con el código JT054. En la desechable se corrió el 23-sep-2026.


-- ───────────────────────────────────────────────────────────────────
-- REVERSA · ⚠ ESTA SÍ BORRA DATOS.
--
-- Los quemados del libro no están en ningún otro lado: el lector borra su
-- jornada al sincronizar. Antes de correrla, contar qué se va a perder:
--
--   SELECT kind, count(*) FROM ticket_operations GROUP BY kind;
--
-- Con el libro vacío no cuesta nada. Con renglones, cuesta viajes.
--
--   DROP TABLE IF EXISTS ticket_operations;
--   DROP TABLE IF EXISTS validator_syncs;
--   DROP TABLE IF EXISTS validator_assignments;
--   DROP TABLE IF EXISTS validators;
--   DROP SEQUENCE IF EXISTS validators_consecutivo_seq;
--   DROP FUNCTION IF EXISTS rechazar_cambio_en_el_libro();
-- ───────────────────────────────────────────────────────────────────
