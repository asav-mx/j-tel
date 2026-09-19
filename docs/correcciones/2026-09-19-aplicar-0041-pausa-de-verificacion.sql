-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0041 · la pausa de la verificación de un contrato
--
-- SE APLICA ANTES DE MERGEAR EL PR.
--   El motor nuevo pregunta por esta tabla antes de generar y antes de sellar:
--   desplegado contra una base sin ella, la cola del cron revienta. La
--   migración es aditiva: el código de hoy la ignora sin problema.
--
-- Qué hace (el detalle está en packages/db/drizzle/0041_pausa_de_verificacion.sql):
--   · crea `contract_verification_events`: cada pausa y cada reanudación es un
--     evento con quién, cuándo se registró, desde cuándo vale y por qué;
--   · dos triggers: los eventos se alternan y van hacia adelante, y no se editan.
--
-- NO pausa nada. La pausa del primer uso («Sin telemetría: el proveedor
-- anterior se desconectó», desde el 5 sep) se hace DESPUÉS del merge, desde
-- J-Staff → Cuentas y demos → Contratos, con su vista previa: ahí se ve cuántas
-- ocurrencias sin hecho se borran antes de confirmar.
--
-- Sin enums (la trampa de la 0025): todo va en una sola transacción.
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura). Decide si se sigue.
--   PASO 2 · la migración (usuario dueño), dentro de BEGIN; COMMIT sólo si cuadra.
--   PASO 3 · después, de lectura (usuario de solo lectura).
--   Luego: mergear el PR.
--
-- Ensayada el 19 sep 2026 en la rama desechable: tabla, índice y los dos
-- triggers creados, y las 8 pruebas de `pausa.integration.test.ts` en verde
-- contra ella (la cola, el borrado, la generación y que los triggers muerden).
--
-- Todas las verificaciones son de LECTURA: ninguna sentencia de esta hoja
-- falla a propósito (la regla de la consola de Neon, Procedimiento-Migraciones).
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT
  to_regclass('public.contract_verification_events') IS NOT NULL AS ya_aplicada,
  (SELECT count(*) FROM service_contracts)                        AS contratos,
  (SELECT count(*) FROM service_occurrences)                      AS ocurrencias,
  (SELECT count(*) FROM compliance_facts)                         AS hechos;

-- LO QUE DEBES VER:
--   ya_aplicada   false
--   contratos / ocurrencias / hechos   anótalos: son la foto de «antes».
--   La migración no toca ninguno de los tres; el PASO 3 lo comprueba.
--
-- Si ya_aplicada sale true, PARA: alguien ya la corrió. Salta al PASO 3.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño (neondb_owner).
--   Todo de una vez, desde BEGIN hasta el último SELECT. Si algo falla, la
--   consola se detiene y no hay COMMIT: corre ROLLBACK; y avísame.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS contract_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  tipo text NOT NULL CONSTRAINT cve_tipo_valido CHECK (tipo IN ('pausa', 'reanudacion')),
  vale_desde timestamptz NOT NULL,
  motivo text,
  actor_kind text NOT NULL,
  actor_id text,
  registrado_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cve_pausa_con_motivo CHECK (
    tipo <> 'pausa' OR (motivo IS NOT NULL AND length(btrim(motivo)) BETWEEN 1 AND 160)
  ),
  CONSTRAINT cve_motivo_corto CHECK (motivo IS NULL OR length(motivo) <= 160),
  CONSTRAINT cve_no_futura CHECK (vale_desde <= registrado_at + interval '1 minute')
);

CREATE INDEX IF NOT EXISTS cve_contrato_idx
  ON contract_verification_events (contract_id, vale_desde);

CREATE OR REPLACE FUNCTION cve_revisar_secuencia() RETURNS trigger AS $cve$
DECLARE
  ultimo record;
BEGIN
  PERFORM 1 FROM service_contracts WHERE id = NEW.contract_id FOR UPDATE;
  SELECT tipo, vale_desde INTO ultimo
    FROM contract_verification_events
   WHERE contract_id = NEW.contract_id
   ORDER BY vale_desde DESC, registrado_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.tipo <> 'pausa' THEN
      RAISE EXCEPTION 'No se reanuda una verificación que nunca se pausó (0041).';
    END IF;
  ELSIF ultimo.tipo = NEW.tipo THEN
    RAISE EXCEPTION 'La verificación de este contrato ya está en «%»: los eventos se alternan (0041).', NEW.tipo;
  ELSIF NEW.vale_desde <= ultimo.vale_desde THEN
    RAISE EXCEPTION 'Un evento nuevo tiene que valer después del anterior (0041).';
  END IF;
  RETURN NEW;
END;
$cve$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cve_secuencia ON contract_verification_events;

CREATE TRIGGER cve_secuencia
  BEFORE INSERT ON contract_verification_events
  FOR EACH ROW EXECUTE FUNCTION cve_revisar_secuencia();

CREATE OR REPLACE FUNCTION cve_rechazar_edicion() RETURNS trigger AS $cve$
BEGIN
  RAISE EXCEPTION 'Los eventos de verificación no se editan: corregir es agregar un evento nuevo (0041).';
END;
$cve$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cve_sin_edicion ON contract_verification_events;

CREATE TRIGGER cve_sin_edicion
  BEFORE UPDATE ON contract_verification_events
  FOR EACH ROW EXECUTE FUNCTION cve_rechazar_edicion();

-- 2b. Comprobación, de lectura, antes del COMMIT.
SELECT
  (SELECT count(*) FROM contract_verification_events)                                   AS eventos,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('cve_secuencia', 'cve_sin_edicion')) AS triggers,
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'contract_verification_events'::regclass AND contype = 'c')          AS checks,
  to_regclass('public.cve_contrato_idx') IS NOT NULL                                     AS indice;

-- LO QUE DEBES VER:
--   eventos   0
--   triggers  2
--   checks    4
--   indice    true
-- Si cuadra:
COMMIT;
-- Si no cuadra: ROLLBACK; en lugar del COMMIT, y avísame con lo que salió.


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

-- 3a. El usuario de solo lectura ve la tabla nueva (heredó el permiso de lectura).
SELECT count(*) AS eventos_visibles FROM contract_verification_events;

-- 3b. Nada más cambió.
SELECT
  (SELECT count(*) FROM service_contracts)   AS contratos,
  (SELECT count(*) FROM service_occurrences) AS ocurrencias,
  (SELECT count(*) FROM compliance_facts)    AS hechos;

-- LO QUE DEBES VER:
--   eventos_visibles  0 (y sin error de permiso: si sale «permission denied», el
--                     usuario de solo lectura no heredó la lectura; avísame antes
--                     de mergear, porque las verificaciones de después no la verían)
--   contratos / ocurrencias / hechos   iguales al PASO 1 (las ocurrencias pueden
--                     haber crecido si corrió la renovación diaria entre medias).
--
-- Luego: mergear el PR. Y después, desde J-Staff, la pausa del primer uso.
