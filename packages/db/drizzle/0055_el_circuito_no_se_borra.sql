-- 0055 · El circuito no se borra: sus paradas están atornilladas a un poste
--
-- `circuit_stops.circuit_id` nació con ON DELETE CASCADE (0025), que para casi
-- todo el resto del producto es lo correcto: borrar el padre se lleva lo suyo.
-- Aquí no lo es, y por una razón que no está en la base de datos sino en la
-- calle: **cada parada tiene un letrero de lámina atornillado a un poste**, y
-- ese letrero no se entera de que alguien borró un renglón. Un DELETE de un
-- circuito convertiría en callejón cada QR impreso de ese circuito, sin aviso,
-- sin rastro y sin forma de deshacerlo.
--
-- Hoy **ninguna pantalla borra un circuito**: sólo lo hacen los guiones de los
-- escenarios de prueba con `--limpiar`. Esta migración no cierra una fuga
-- abierta: cierra la puerta por la que entraría el día que alguien agregue un
-- botón «Eliminar» sin pensar en la lámina — o el día que alguien corra un
-- DELETE a mano contra la base.
--
-- **Por qué RESTRICT y no un `retired_at` en `circuits`.** Las dos cosas se
-- pueden querer, y no son la misma:
--
--   · RESTRICT es **la base diciendo que no**. Vale contra `psql`, contra un
--     guion de una sola vez y contra la pantalla que todavía no existe. Es una
--     línea y no cambia ninguna consulta.
--   · Un `retired_at` en el circuito es **producto**: qué significa retirar un
--     circuito, qué pasa con sus unidades asignadas, qué ve el pasajero, y
--     tocaría cada consulta que hoy lista circuitos. Eso es una ficha, no una
--     migración.
--
-- Se hace RESTRICT ahora porque es la última línea y cuesta una línea. Si Asav
-- quiere además que un circuito se pueda retirar, eso entra por su ficha y esta
-- restricción **sigue valiendo debajo**: retirar no borra.
--
-- Lo que esto ROMPE, dicho antes de que pase: los tres guiones de escenario que
-- limpian con `DELETE FROM circuits` ahora tienen que borrar sus paradas
-- primero. Ya están corregidos en el mismo PR. Es el mismo costo que ya pagó el
-- libro de boletos por sus referencias sin cascada, y por la misma razón.

-- ⚠ **El nombre de la restricción no es el que Drizzle pondría.** La 0025 creó
-- esta tabla con SQL a mano (`REFERENCES circuits(id)` dentro del CREATE TABLE),
-- así que quien la nombró fue Postgres: `circuit_stops_circuit_id_fkey`, y no
-- `circuit_stops_circuit_id_circuits_id_fk`. Escribir el nombre de Drizzle no
-- falla —el `IF EXISTS` se lo traga con un NOTICE— y deja la tabla con **dos**
-- referencias al mismo circuito, una RESTRICT y otra CASCADE. Se encontró
-- aplicando esto de verdad contra la rama desechable; leyendo el archivo no se
-- veía. Se sueltan los dos nombres, por si alguna base trae el otro.
ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_fkey;
--> statement-breakpoint
ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_circuits_id_fk;
--> statement-breakpoint
ALTER TABLE circuit_stops
  ADD CONSTRAINT circuit_stops_circuit_id_fkey
  FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE RESTRICT;
--> statement-breakpoint
COMMENT ON CONSTRAINT circuit_stops_circuit_id_fkey ON circuit_stops IS
  'RESTRICT y no CASCADE: cada parada tiene un letrero de lámina atornillado a un poste, y borrar el circuito convertiría cada QR impreso en un callejón sin aviso ni rastro. Para dejar de dar un circuito se despublica (published_at = NULL), que lo quita de la app al instante y no borra nada.';
