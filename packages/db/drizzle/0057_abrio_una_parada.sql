-- 0057 · «Abrió una parada» — un contador aparte, no una columna del otro
--
-- Hasta el #592, tocar una parada en el mapa ABRÍA LA RUTA ENTERA, así que ese
-- gesto caía en `circuit_opens`. Desde que la hoja de la parada se abre encima
-- del mapa —que es lo que el pasajero hace todo el tiempo— la ruta ya no se
-- abre, y aquel contador dejó de ver el gesto más común de la app.
--
-- Decisión de ASAV, 25-sep-2026: **que cuente, pero como lo que es.** Un
-- contador propio, «abrió una parada», y el viejo de «abrió una ruta» intacto.
--
-- ⚠ **POR QUÉ UNA TABLA Y NO UNA COLUMNA `stop_id` EN `circuit_opens`.**
-- Con una columna nullable, toda consulta que hoy cuenta filas —las que ya
-- existen y las que alguien escriba mañana— empezaría a sumar aperturas de
-- parada dentro de «abrió una ruta», salvo que se acuerde de filtrar. Dos
-- poblaciones que miden cosas distintas no se separan con la disciplina de
-- quien consulta. Se separan con dos tablas.
--
-- Puramente ADITIVA: una tabla nueva, ninguna fila existente se toca, y ninguna
-- consulta de hoy cambia de resultado.
--
-- La huella es `huellaDeAperturaDeParada`, que lleva la palabra `parada` DENTRO
-- del mensaje del HMAC: así una huella de parada no puede coincidir con una de
-- circuito aunque los identificadores fueran iguales. Rota cada día, igual que
-- la otra y por lo mismo: de aquí no sale «cuántos volvieron».

CREATE TABLE IF NOT EXISTS stop_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- La parada ESTABLE, no su versión: una parada que cambia de nombre sigue
  -- siendo la misma y su serie no se parte en dos.
  stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  fingerprint text NOT NULL,
  -- El crudo: se guarda y NO se enseña. Es el detector contra el raspado lento
  -- y distribuido, que el límite de tasa no cubre — la distancia entre el crudo
  -- y el número de filas es la única señal que queda.
  open_count integer NOT NULL DEFAULT 1,
  first_open_at timestamptz NOT NULL DEFAULT now(),
  last_open_at timestamptz NOT NULL DEFAULT now()
);

-- La deduplicación vive EN LA BASE y no en el código que inserta: es lo que
-- hace que dos peticiones simultáneas del mismo aparato no produzcan dos filas,
-- y lo que convierte «contar filas» en una definición y no en una esperanza.
CREATE UNIQUE INDEX IF NOT EXISTS stop_opens_un_dia
  ON stop_opens (stop_id, local_date, fingerprint);

CREATE INDEX IF NOT EXISTS stop_opens_resumen_idx
  ON stop_opens (stop_id, local_date);
