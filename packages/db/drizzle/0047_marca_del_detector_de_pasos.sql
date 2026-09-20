-- El marcador del orquestador del detector de pasos — ADITIVA, una tabla.
--
-- Se aplica DESPUÉS de la 0046. No toca ninguna fila existente. Nada del
-- código que corre hoy conoce nada de esto.
--
-- ## Qué guarda
--
-- Por (circuito, unidad, versión del detector): el `recorded_at` del ÚLTIMO
-- PING CONSUMIDO. No la hora de la ronda.
--
-- Un cruce es el par de pings consecutivos que lo encierran. Con el marcador en
-- la hora de la ronda, el par (último ping de una ventana, primer ping de la
-- siguiente) no cae en ninguna de las dos y el cruce se pierde sin decirlo.
-- Con el marcador en el último ping, la ventana siguiente arranca EN ese ping
-- (inclusive): el par se detecta una vez, ni perdido ni repetido.
--
-- ## Por qué la versión va en la llave
--
-- Subir `detector_version` arranca limpio sin borrar nada de lo anterior: los
-- pasos apilan por esa misma versión (0045), y con ella se re-corre sin pisar.
--
-- ## Lo que NO es
--
-- No es `telemetry_watermarks` (recolector) ni `telemetry_imei_watermarks`
-- (relleno). Compartir marcador es como el relleno le brincaba ventanas al
-- archivador (lección del 15-sep).
--
-- La tolerancia de corredor NO se agrega aquí: ya existe como
-- `circuits.corridor_tolerance_meters` (0030, DEFAULT 150) y el detector usa
-- ésa — la misma que decide si la app pública dibuja al camión «en ruta».

CREATE TABLE IF NOT EXISTS circuit_detection_marks (
  circuit_id        UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  unit_id           UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  detector_version  TEXT NOT NULL,
  last_ping_at      TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circuit_id, unit_id, detector_version)
);
--> statement-breakpoint
COMMENT ON TABLE circuit_detection_marks IS
  'Hasta que ping consumio el orquestador del detector, por circuito, unidad y version. last_ping_at es el recorded_at del ultimo ping usado, no la hora de la ronda: asi el par de pings que cruza el borde de una ventana se detecta una vez, ni perdido ni repetido.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_detection_marks.detector_version IS
  'Parte de la llave: subir la version arranca limpio sin borrar la anterior.';
