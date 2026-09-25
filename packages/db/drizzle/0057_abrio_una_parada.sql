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
-- ⚠ **RESTRICT y no CASCADE, en las DOS tablas de aperturas.** Es lo que
-- observó ASAV al revisar, y tenía razón: la primera versión de esta migración
-- puso CASCADE en `stop_opens.stop_id` copiando el patrón de `circuit_opens` y
-- de `circuit_stop_versions`, sin pesar el argumento que sí aplica aquí.
--
-- **Una apertura no se puede recalcular.** Es un evento observado, no un
-- derivado: si se borra, no hay de dónde volver a sacarlo, y el hueco que deja
-- se lee como «nadie abrió» (§D en su forma de alcance). CASCADE convierte un
-- borrado —que ya es una anomalía— en la destrucción silenciosa de la única
-- medición que tenemos de uso.
--
-- Y borrar **ya no es la forma de quitar una parada**: `circuit_stops` tiene
-- `retired_at` desde su primer día, y hoy **no existe ningún camino que borre
-- una parada** — ni un método del repositorio, ni una pantalla de J-Staff; sólo
-- los guiones de escenario. RESTRICT no le quita a nadie una operación
-- legítima: cierra la ilegítima, igual que la 0055 con el circuito.
--
-- `circuit_opens` se endereza en la misma migración **para que las dos sean
-- coherentes**: dejar una CASCADE y la otra RESTRICT sería peor que las dos
-- iguales, porque nadie podría decir cuál es la regla.
--
-- Lo que esto ROMPE, dicho antes de que pase: las limpiezas que borran cuentas
-- o circuitos con aperturas registradas tienen que borrar las aperturas
-- primero. Son sólo guiones de escenario y `afterAll` de pruebas —ninguna
-- pantalla borra cuentas ni circuitos—, y ya están corregidos en este PR. Es el
-- mismo costo que pagó la 0055 y por la misma razón.
--
-- Salvo por ese ALTER, es ADITIVA: una tabla nueva, ninguna fila existente se
-- toca, y ninguna consulta de hoy cambia de resultado.
--
-- La huella es `huellaDeAperturaDeParada`, que lleva la palabra `parada` DENTRO
-- del mensaje del HMAC: así una huella de parada no puede coincidir con una de
-- circuito aunque los identificadores fueran iguales. Rota cada día, igual que
-- la otra y por lo mismo: de aquí no sale «cuántos volvieron».

CREATE TABLE IF NOT EXISTS stop_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- La parada ESTABLE, no su versión: una parada que cambia de nombre sigue
  -- siendo la misma y su serie no se parte en dos.
  stop_id uuid NOT NULL REFERENCES circuit_stops(id) ON DELETE RESTRICT,
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

--> statement-breakpoint
COMMENT ON CONSTRAINT stop_opens_stop_id_fkey ON stop_opens IS
  'RESTRICT y no CASCADE: una apertura es un evento observado y no se puede recalcular. Para quitar una parada se retira (retired_at), que es la única forma que existe; borrarla no lo es.';

--> statement-breakpoint
-- `circuit_opens`, a la misma regla. ⚠ Se sueltan los DOS nombres posibles: la
-- 0055 enseñó que el nombre depende de si la tabla nació con SQL a mano o con
-- Drizzle, y escribir sólo uno deja la tabla con dos referencias al mismo padre
-- —una RESTRICT y otra CASCADE— sin que nada falle. En la rama desechable el
-- nombre vigente es `circuit_opens_circuit_id_fkey`, comprobado contra
-- `pg_constraint`.
ALTER TABLE circuit_opens
  DROP CONSTRAINT IF EXISTS circuit_opens_circuit_id_fkey;
--> statement-breakpoint
ALTER TABLE circuit_opens
  DROP CONSTRAINT IF EXISTS circuit_opens_circuit_id_circuits_id_fk;
--> statement-breakpoint
ALTER TABLE circuit_opens
  ADD CONSTRAINT circuit_opens_circuit_id_fkey
  FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE RESTRICT;
--> statement-breakpoint
COMMENT ON CONSTRAINT circuit_opens_circuit_id_fkey ON circuit_opens IS
  'RESTRICT y no CASCADE (0057): una apertura es un evento observado y no se puede recalcular. Para dejar de dar un circuito se despublica (published_at = NULL), que no borra nada.';
