-- La pausa de la verificación de un contrato (19 sep 2026).
-- ADITIVA: una tabla nueva, su índice y dos triggers. No toca ninguna tabla que exista.
--
-- Se aplica ANTES de desplegar el código que la lee: el motor nuevo pregunta
-- por esta tabla antes de generar y antes de sellar, y contra una base sin ella
-- revienta la cola del cron. Al revés no pasa nada: el código de hoy la ignora.
--
-- Sin enums (la trampa de la 0025): el tipo de evento es texto con CHECK, y
-- todo corre en una sola transacción. El runbook está en
-- docs/correcciones/2026-09-19-aplicar-0041-pausa-de-verificacion.sql.
--
-- ══════════════════════════════════════════════════════════════════════
-- Qué es
-- ══════════════════════════════════════════════════════════════════════
--
-- Un contrato puede tener su verificación en pausa. **Es un evento, no una
-- palomita** (Asav, 19 sep 2026): quién, cuándo, desde cuándo vale y por qué.
-- Pausar agrega un evento; reanudar agrega otro. Nada se edita: el estado se
-- lee del último evento cuya fecha ya empezó.
--
-- Mientras está en pausa, el motor no genera ocurrencias del contrato ni sella
-- nada de él —tampoco re-sella los pendientes viejos—. Lo ya sellado no se
-- toca. Al reanudar, lo no medido durante la pausa queda sin generar: jamás se
-- inventa hacia atrás.
--
-- Dos fechas, y no son la misma: `vale_desde` (cuándo empezó de verdad la
-- pausa: el 5 de septiembre, el día que la telemetría murió) y `registrado_at`
-- (cuándo alguien lo registró). Igual que las asignaciones de Umbrella se
-- cerraron con la fecha de su baja y no con la del día que se arregló.
--
-- No confundir con `service_contracts.status = 'suspended'`: ésa es una
-- etiqueta comercial que ningún proceso lee (pendiente con nombre).

CREATE TABLE IF NOT EXISTS contract_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  tipo text NOT NULL CONSTRAINT cve_tipo_valido CHECK (tipo IN ('pausa', 'reanudacion')),
  vale_desde timestamptz NOT NULL,
  motivo text,
  actor_kind text NOT NULL,
  actor_id text,
  registrado_at timestamptz NOT NULL DEFAULT now(),
  -- La pausa dice por qué; reanudar es volver a lo normal y no lo exige
  -- (decisión 6 de Asav). El motivo, cuando va, es corto: cabe en una línea.
  CONSTRAINT cve_pausa_con_motivo CHECK (
    tipo <> 'pausa' OR (motivo IS NOT NULL AND length(btrim(motivo)) BETWEEN 1 AND 160)
  ),
  CONSTRAINT cve_motivo_corto CHECK (motivo IS NULL OR length(motivo) <= 160),
  -- Nada se agenda hacia el futuro: una pausa vale desde hoy o desde antes.
  -- Un minuto de holgura para el reloj de quien la registra.
  CONSTRAINT cve_no_futura CHECK (vale_desde <= registrado_at + interval '1 minute')
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cve_contrato_idx
  ON contract_verification_events (contract_id, vale_desde);
--> statement-breakpoint

-- ── Los eventos se alternan y van hacia adelante ─────────────────────
--
-- No se pausa lo pausado ni se reanuda lo que corre, y un evento nuevo no puede
-- valer antes que el anterior: si no, dos pausas se enciman y ya no se sabe qué
-- estaba en pausa cuándo. Un CHECK no ve otras filas; esto sí. El FOR UPDATE
-- sobre el contrato ordena dos registros simultáneos del mismo contrato.

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
--> statement-breakpoint

DROP TRIGGER IF EXISTS cve_secuencia ON contract_verification_events;
--> statement-breakpoint

CREATE TRIGGER cve_secuencia
  BEFORE INSERT ON contract_verification_events
  FOR EACH ROW EXECUTE FUNCTION cve_revisar_secuencia();
--> statement-breakpoint

-- ── No se edita en sitio ─────────────────────────────────────────────
--
-- Corregir una pausa es agregar un evento encima, no reescribir el que había
-- (la misma regla que la 0038). El DELETE no se bloquea: borrar un contrato
-- arrastra sus eventos en cascada.

CREATE OR REPLACE FUNCTION cve_rechazar_edicion() RETURNS trigger AS $cve$
BEGIN
  RAISE EXCEPTION 'Los eventos de verificación no se editan: corregir es agregar un evento nuevo (0041).';
END;
$cve$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS cve_sin_edicion ON contract_verification_events;
--> statement-breakpoint

CREATE TRIGGER cve_sin_edicion
  BEFORE UPDATE ON contract_verification_events
  FOR EACH ROW EXECUTE FUNCTION cve_rechazar_edicion();
