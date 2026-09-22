-- El resumen de los recorridos por tramo, para el planeador de Ontoy — ADITIVA (PR 5a).
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide todas las columnas declaradas (la lección de la 0016).
--
-- ## Qué agrega
--
-- `circuit_leg_times`: un renglón por tramo publicable de un circuito — de una
-- parada a la SIGUIENTE, en un sentido — con lo que tarda, agregado sobre los
-- últimos días. Lo escribe el cron `/api/cron/recorridos`; lo lee la app del
-- pasajero. Vacía al nacer.
--
-- ## Por qué existe esta tabla y no una consulta a los pasos
--
-- Los pasos del detector viven detrás del muro de cuenta (9.14): la concesión ve
-- los de su circuito, el carrier los de sus unidades, y nadie más. El pasajero
-- no tiene cuenta. Con esta tabla, **el camino público nunca toca esa evidencia**:
-- lee un agregado ya calculado (decisión de ASAV, 22-sep, camino B).
--
-- **Sin unidad y sin transportista, a propósito:** lo que no se guarda no se
-- puede filtrar. Publicar el recorrido agregado de un circuito lo autoriza la
-- 8.16.5; la comparación entre transportistas sigue reservada (9.14).
--
-- Aprobado por Asav el 22-sep-2026. **No se corre en producción antes del 29**:
-- la semana del 28 va sin piezas nuevas cerca de la calibración.

CREATE TABLE IF NOT EXISTS circuit_leg_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  sentido sentido_circuito NOT NULL,
  de_stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  a_stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  travesias integer NOT NULL,
  desde_seg integer NOT NULL,
  mediana_seg integer NOT NULL,
  hasta_seg integer NOT NULL,
  ventana_desde timestamptz NOT NULL,
  ventana_hasta timestamptz NOT NULL,
  detector_version text NOT NULL,
  calculado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT circuit_leg_times_travesias CHECK (travesias > 0),
  CONSTRAINT circuit_leg_times_rango CHECK (desde_seg >= 0 AND desde_seg <= mediana_seg AND mediana_seg <= hasta_seg),
  CONSTRAINT circuit_leg_times_ventana CHECK (ventana_hasta > ventana_desde),
  CONSTRAINT circuit_leg_times_paradas_distintas CHECK (de_stop_id <> a_stop_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS circuit_leg_times_un_tramo_idx ON circuit_leg_times (circuit_id, sentido, de_stop_id, a_stop_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuit_leg_times_circuito_idx ON circuit_leg_times (circuit_id, sentido);
--> statement-breakpoint
COMMENT ON TABLE circuit_leg_times IS
  'Recorridos por tramo de un circuito, agregados (0053, Marco 8.16.5). Los escribe el cron; sin unidad ni transportista a proposito.';
