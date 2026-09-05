-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0033 · el contador anónimo de aperturas — Neon
--
-- SE APLICA DESPUÉS DE LA 0032.
--
-- ✓ ES PURAMENTE ADITIVA. Una tabla nueva. No toca ninguna existente y
--   no escribe en ninguna fila.
--
-- ✓ NO ROZA EL CAMINO DE INGESTIÓN. Ni `telemetry_points`, ni
--   `live_positions`, ni el recolector, ni el archivador. Congelado
--   hasta el 11 y sigue congelado.
--
-- ⚠ SE APLICA ANTES DE MERGEAR EL CÓDIGO QUE LA NECESITA. Sin la
--   tabla, el expediente del circuito truena al leer el resumen. La
--   app del pasajero NO: la apertura se escribe sin bloquear la
--   pantalla, así que un fallo ahí no se le ve al pasajero — pero no
--   se cuenta nada.
--
-- ⚠ TODAS LAS COMPROBACIONES SON DE LECTURA.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='service_launch_date') AS esta_la_0032,
       EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_name='circuit_opens')                                  AS ya_esta_la_0033,
       (SELECT count(*) FROM circuits)         AS circuitos,
       (SELECT count(*) FROM compliance_facts) AS hechos;

-- LO QUE DEBES VER:
--   esta_la_0032     TRUE
--   ya_esta_la_0033  FALSE   <- TRUE = ya aplicada, salta al PASO 3
-- Anota `circuitos` y `hechos`. La comparación que vale es TU paso 1
-- contra TU paso 3.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Todo junto, en una sola corrida.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS circuit_opens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id     UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  local_date     DATE NOT NULL,
  fingerprint    TEXT NOT NULL,
  open_count     INTEGER NOT NULL DEFAULT 1,
  first_open_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_open_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS circuit_opens_un_dia
  ON circuit_opens (circuit_id, local_date, fingerprint);

CREATE INDEX IF NOT EXISTS circuit_opens_resumen_idx
  ON circuit_opens (circuit_id, local_date);

COMMENT ON TABLE circuit_opens IS
  'Contador anonimo de aperturas de la app del pasajero. Una fila = un aparato distinguible que abrio esa ruta ese dia. La huella rota cada dia, asi que NO se puede ligar un aparato entre dias: de aqui no sale "cuantos volvieron". Y subcuenta a proposito: detras de un NAT movil varios telefonos comparten huella.';

COMMENT ON COLUMN circuit_opens.local_date IS
  'El dia CIVIL DEL CIRCUITO, no el del servidor: es la misma fecha con la que rota la huella.';

COMMENT ON COLUMN circuit_opens.fingerprint IS
  'HMAC(llave del servidor; ip + agente + dia + circuito), truncado. Rota cada dia. No se guarda nada en el telefono del pasajero.';

COMMENT ON COLUMN circuit_opens.open_count IS
  'El crudo: cuantas veces se abrio desde esa huella ese dia. NO SE ENSENA. Es el detector de raspado: la distancia entre el crudo y el numero de filas es la unica senal contra un raspado lento y distribuido, que el limite de tasa no cubre.';

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='circuit_opens'
 ORDER BY ordinal_position;

-- LO QUE DEBES VER: siete columnas, `open_count` con default 1, y
-- `local_date` de tipo date (no timestamp: es un día civil, no un
-- instante).

SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename='circuit_opens' ORDER BY indexname;

-- LO QUE DEBES VER: el PRIMARY KEY, `circuit_opens_resumen_idx`, y
-- `circuit_opens_un_dia` **UNIQUE** sobre (circuit_id, local_date,
-- fingerprint). El UNIQUE es el que convierte «contar filas» en una
-- definición: sin él, dos peticiones simultáneas del mismo aparato
-- producen dos filas y el conteo dice dos donde hubo uno.

SELECT count(*) AS aperturas FROM circuit_opens;

-- Cero: la tabla nace vacía y se llena sola cuando alguien abra la app.

SELECT (SELECT count(*) FROM circuits)         AS circuitos,
       (SELECT count(*) FROM compliance_facts) AS hechos;

-- Idénticos a tu PASO 1 — esta migración no toca nada existente.
