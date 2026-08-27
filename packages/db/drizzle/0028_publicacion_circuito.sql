-- Interruptor de publicación del circuito — ADITIVA, una sola columna.
--
-- Se aplica DESPUÉS de la 0027. No toca ninguna fila existente y nada del
-- código que corre hoy la lee.
--
-- ## Qué resuelve
--
-- Un circuito se arma por partes: primero existe, después su trazado, después
-- sus paradas, después las unidades que lo corren. Durante todo ese rato hay
-- que poder probar el endpoint con datos de verdad **sin que el circuito
-- aparezca en la app del pasajero**.
--
-- `NULL` = no publicado. Un circuito no publicado **no existe para el endpoint
-- público**: contesta lo mismo que un slug inventado. Es la misma forma que ya
-- tiene la asignación de unidad — fuera de asignación, una unidad no se
-- publica— y evita lo único que no se puede hacer aquí: pedir login en una app
-- pública, que contradice su diseño entero.
--
-- ## Por qué NO se reusa `circuits.active`
--
-- Existe desde la 0025 y hoy no lo lee nadie: se selecciona en `listAllCircuits`
-- y nunca se filtra por él. Aun así no sirve, por dos razones independientes.
--
-- Tiene `DEFAULT TRUE`, así que reusarlo publicaría el circuito que ya está en
-- producción en el instante mismo en que el endpoint salga — exactamente lo que
-- este interruptor existe para impedir. Y significa otra cosa: `active` es dado
-- de baja, no invisible al pasajero. Un circuito puede estar vivo y sin publicar
-- durante días, que es el caso normal mientras se arma. Meter dos conceptos en
-- una columna es cómo se pierde uno de los dos.
--
-- ## Por qué marca de tiempo y no booleano
--
-- «Publicado desde cuándo» sale gratis, y encaja con el resto de este modelo,
-- donde la vigencia se guarda en vez de deducirse: las versiones de parada, la
-- liga concesión-transportista y la asignación de unidad ya llevan la suya.

ALTER TABLE circuits ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS circuits_publicados_idx
  ON circuits (public_slug) WHERE published_at IS NOT NULL;
--> statement-breakpoint
COMMENT ON COLUMN circuits.published_at IS
  'Desde cuándo el circuito es visible para la app del pasajero. NULL = creado pero no publicado: el endpoint público contesta como si el slug no existiera. No confundir con `active`, que es dado de baja.';
