-- Reversa de la 0057 · quita el contador de aperturas de parada
--
-- ⚠ **Esto SÍ borra**, y lo que se pierde NO se puede recalcular: las aperturas
-- son un evento, no un derivado. Un día sin filas después de revertir se leería
-- como «nadie abrió ninguna parada», que es la §D en su forma de alcance sobre
-- el número con el que se decide si la app se está usando.
--
-- Nada más depende de esta tabla: la 0057 es aditiva y ninguna consulta previa
-- la mira. Revertirla no desbloquea nada — sólo apaga el contador.

DROP INDEX IF EXISTS stop_opens_resumen_idx;
DROP INDEX IF EXISTS stop_opens_un_dia;
DROP TABLE IF EXISTS stop_opens;

-- Y `circuit_opens` vuelve a CASCADE, que es como estaba antes de la 0057.
-- ⚠ Revertir esto **reabre** la puerta por la que un borrado se lleva aperturas
-- que no se pueden recalcular.
ALTER TABLE circuit_opens
  DROP CONSTRAINT IF EXISTS circuit_opens_circuit_id_fkey;
ALTER TABLE circuit_opens
  ADD CONSTRAINT circuit_opens_circuit_id_fkey
  FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE CASCADE;
