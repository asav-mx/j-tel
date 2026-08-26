-- Posición viva · el camino propio de la app pública — ADITIVA.
--
-- Se aplica DESPUÉS de la 0023. Una tabla nueva y una columna nueva en
-- `carrier_profiles`. Sin tocar datos existentes, sin backfill, en transacción,
-- sin CONCURRENTLY.
--
-- Plan: `docs/PLAN.md` §4, Tramo JB — Juárez Bus público.
--
-- ## Qué resuelve
--
-- La app del pasajero no puede leer `telemetry_points`. Esa tabla la llena el
-- archivador, que corre `*/10 * * * *`, y eso mete un retraso propio —medido el
-- 26 de agosto de 2026 sobre 2 596 410 puntos: mediana 6.09 min, p90 10.18,
-- p99 12.84— que es exactamente la posición congelada que el Tramo JB prohíbe.
--
-- Umbrella entrega un fix por unidad cada ~1 min (p90 y p99: 2 min, medido el
-- mismo día sobre 2 045 165 huecos en horario de servicio). El retraso no es del
-- proveedor: es nuestro, y se quita con un camino propio.
--
-- Esta tabla es ese camino: UNA fila por aparato, siempre la última posición
-- conocida. No es un histórico —ése sigue siendo `telemetry_points`— y por eso
-- no crece: se sobrescribe.
--
-- ## Por qué la posición no puede retroceder
--
-- El `where` del `on conflict` es la pieza importante. El recolector hace varios
-- sondeos por minuto, y un sondeo lento puede llegar DESPUÉS de otro más nuevo.
-- Sin esa condición, el sondeo atrasado pisaría la posición buena con una vieja
-- y el pasajero vería al camión brincar hacia atrás.
--
-- Con ella, un sondeo tardío simplemente no hace nada. **Escribir dos veces sale
-- igual que escribir una, y en desorden sale igual que en orden.**
--
-- ## La cadencia es un campo, no una constante
--
-- `gps_poll_seconds` vive en el perfil del carrier porque el sondeo es contra SU
-- proveedor con SUS credenciales. Un concesionario que mañana opere con otro
-- proveedor y otra cadencia se ajusta desde la pantalla que ya existe, sin
-- desplegar. 30 segundos es el valor de hoy para Umbrella, no una ley.

BEGIN;

ALTER TABLE carrier_profiles
  ADD COLUMN IF NOT EXISTS gps_poll_seconds INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN carrier_profiles.gps_poll_seconds IS
  'Cada cuántos segundos se sondea al proveedor GPS de este carrier. Configurable por carrier; nunca constante en el código.';

CREATE TABLE IF NOT EXISTS live_positions (
  imei                TEXT PRIMARY KEY,
  carrier_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id           UUID REFERENCES devices(id) ON DELETE SET NULL,
  unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  speed               DOUBLE PRECISION,
  heading             DOUBLE PRECISION,
  -- Cuándo el aparato tomó el fix. De aquí sale la antigüedad que decide si el
  -- dato está fresco. NUNCA se calcula con el reloj del teléfono del pasajero.
  recorded_at         TIMESTAMPTZ NOT NULL,
  -- Cuándo lo recogimos nosotros. La resta contra `recorded_at` es el retraso
  -- de nuestro propio camino, y es lo que hay que vigilar para que no se
  -- convierta en otro archivador.
  collected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE live_positions IS
  'Última posición conocida por aparato. Camino propio de la app pública: no es histórico y no crece. El histórico vive en telemetry_points.';

-- Lectura de la app: dame las unidades de este carrier con dato reciente.
CREATE INDEX IF NOT EXISTS live_positions_carrier_recorded_idx
  ON live_positions (carrier_account_id, recorded_at DESC);

COMMIT;
