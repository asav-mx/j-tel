-- Los avisos de la concesión al pasajero, por circuito — ADITIVA (Ontoy 2.0, PR 4a).
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide todas las columnas declaradas, y el código nuevo contra una base
-- sin esta tabla revienta al leer los avisos (la lección de la 0016). Al revés
-- no pasa nada.
--
-- ## Qué agrega
--
-- `circuit_notices`: un renglón por aviso que J-Staff captura en el expediente
-- del circuito, de parte de la concesión (Marco 8.13b: «fechado y atribuido»;
-- el pasajero lee «según la concesión»). Vacía al nacer.
--
-- - **Firmado:** quién lo capturó y cuándo (`capturado_por`, `capturado_en`).
-- - **Vigencia:** desde cuándo vale y, si se sabe, hasta cuándo.
-- - **No se edita: se retira**, con motivo y firmado. Así queda la historia de
--   qué se le dijo al pasajero y cuándo. Los tres campos del retiro van juntos
--   o no va ninguno (CHECK).
-- - Título corto (1–80) y detalle opcional (hasta 280): cabe en la pantalla de
--   un teléfono y no se vuelve un letrero.
--
-- Aprobado por Asav el 22-sep-2026 (PR 4 de Ontoy 2.0, partido en 4a y 4b).

CREATE TABLE IF NOT EXISTS circuit_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  detalle text,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  vigente_hasta timestamptz,
  capturado_por text NOT NULL,
  capturado_en timestamptz NOT NULL DEFAULT now(),
  retirado_en timestamptz,
  retirado_por text,
  motivo_retiro text,
  CONSTRAINT circuit_notices_titulo CHECK (length(btrim(titulo)) BETWEEN 1 AND 80),
  CONSTRAINT circuit_notices_detalle CHECK (detalle IS NULL OR length(detalle) <= 280),
  CONSTRAINT circuit_notices_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde),
  CONSTRAINT circuit_notices_retiro CHECK (
    (retirado_en IS NULL AND retirado_por IS NULL AND motivo_retiro IS NULL)
    OR (retirado_en IS NOT NULL AND retirado_por IS NOT NULL AND length(btrim(coalesce(motivo_retiro, ''))) > 0)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_notices_circuito_idx ON circuit_notices (circuit_id, vigente_desde);
--> statement-breakpoint
COMMENT ON TABLE circuit_notices IS
  'Avisos de la concesion al pasajero, por circuito (0052, Marco 8.13b). Firmados; no se editan: se retiran con motivo.';
