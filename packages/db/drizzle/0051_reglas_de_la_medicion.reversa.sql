-- Reversa de la 0051. Se pierde el registro de cambios desde que se aplicó, y
-- el valor de corridor_exit_minutes de cada circuito (el código vuelve a la
-- constante 3). Anótalos antes: SELECT id, corridor_exit_minutes FROM circuits
-- WHERE corridor_exit_minutes <> 3; y SELECT * FROM circuit_rule_changes;
DROP TABLE IF EXISTS circuit_rule_changes;
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_tolerancia_llegada_valida;
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_minutos_fuera_positivos;
ALTER TABLE circuits DROP COLUMN IF EXISTS corridor_exit_minutes;
