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
