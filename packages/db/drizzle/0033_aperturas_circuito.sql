-- El contador anónimo de aperturas de la app del pasajero.
--
-- Se aplica DESPUÉS de la 0032. **Puramente aditiva**: una tabla nueva. No
-- toca ninguna existente, no escribe en ninguna fila, y no roza el camino de
-- ingestión —`telemetry_points`, `live_positions`, el recolector ni el
-- archivador—, que está congelado hasta el 11.
--
-- ## Qué contesta, y qué NO puede contestar
--
-- Una fila = **un aparato distinguible que abrió esta ruta ese día**.
--
-- Lo que no puede contestar, por construcción y no por falta de trabajo:
--
--   · **Cuántos volvieron.** La huella lleva el día adentro, así que la de
--     mañana no se parece a la de hoy y no hay forma de ligar un aparato entre
--     días. Medir regresos sería otro producto, con su propio consentimiento,
--     y no una puerta trasera de éste.
--   · **Cuántas personas.** Detrás de un NAT móvil —el caso normal en Juárez,
--     no la excepción, según el `Procedimiento-Firewall-Publico`— media colonia
--     sale con la misma IP. Esto SUBCUENTA a propósito, y el rótulo del
--     expediente lo dice en vez de presentar el número como pasajeros.
--   · **Quién.** La huella es HMAC con la llave del servidor y sale truncada;
--     sin la llave no se recalcula, y con ella tampoco se invierte.
--
-- ## Nada se guarda en el teléfono
--
-- Ni cookie, ni `localStorage`, ni identificador que viaje. La huella la deriva
-- el servidor de lo que la petición ya trae. Por eso la deduplicación tiene que
-- vivir aquí: el aparato no recuerda nada, así que la base es la única que
-- puede saber que ésta es la segunda apertura del mismo día.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué el ÚNICO va sobre (circuito, día, huella)
-- ══════════════════════════════════════════════════════════════════════
--
-- Es lo que convierte «contar filas» en una definición en vez de una esperanza.
-- Sin él, dos peticiones simultáneas del mismo aparato —dos pestañas, un
-- reintento de red— producirían dos filas y el conteo diría dos aparatos donde
-- hubo uno. La deduplicación no se puede dejar en el código que inserta: entre
-- el SELECT y el INSERT cabe la otra petición.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué se guarda `open_count` si no se enseña
-- ══════════════════════════════════════════════════════════════════════
--
-- Porque es el detector, no un dato de reserva.
--
-- El `Procedimiento-Firewall-Publico` dejó escrito que el límite de tasa **no
-- protege contra un raspado lento y distribuido**. Contra eso, la única señal
-- que queda es la DISTANCIA entre el crudo y el número de filas: un guion que
-- infla las aperturas sin traer aparatos distintos mueve `open_count` y deja
-- quieto el conteo de filas, y eso se ve desde aquí.
--
-- Enseñar el crudo como uso sería exactamente el error que este contador vino a
-- evitar. Guardarlo y callarlo es lo contrario: la pantalla enseña lo que se
-- sostiene, y el instrumento conserva con qué dudar de sí mismo.

CREATE TABLE IF NOT EXISTS circuit_opens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id     UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  local_date     DATE NOT NULL,
  fingerprint    TEXT NOT NULL,
  open_count     INTEGER NOT NULL DEFAULT 1,
  first_open_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_open_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- El candado de la deduplicación. Ver el encabezado: sin esto, «contar filas»
-- deja de ser una definición.
CREATE UNIQUE INDEX IF NOT EXISTS circuit_opens_un_dia
  ON circuit_opens (circuit_id, local_date, fingerprint);
--> statement-breakpoint

-- Por donde entra el resumen del expediente: un circuito, los últimos días.
CREATE INDEX IF NOT EXISTS circuit_opens_resumen_idx
  ON circuit_opens (circuit_id, local_date);
--> statement-breakpoint

COMMENT ON TABLE circuit_opens IS
  'Contador anonimo de aperturas de la app del pasajero. Una fila = un aparato distinguible que abrio esa ruta ese dia. La huella rota cada dia, asi que NO se puede ligar un aparato entre dias: de aqui no sale "cuantos volvieron". Y subcuenta a proposito: detras de un NAT movil varios telefonos comparten huella.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_opens.local_date IS
  'El dia CIVIL DEL CIRCUITO, no el del servidor: es la misma fecha con la que rota la huella.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_opens.fingerprint IS
  'HMAC(llave del servidor; ip + agente + dia + circuito), truncado. Rota cada dia. No se guarda nada en el telefono del pasajero.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_opens.open_count IS
  'El crudo: cuantas veces se abrio desde esa huella ese dia. NO SE ENSENA. Es el detector de raspado: la distancia entre el crudo y el numero de filas es la unica senal contra un raspado lento y distribuido, que el limite de tasa no cubre.';
