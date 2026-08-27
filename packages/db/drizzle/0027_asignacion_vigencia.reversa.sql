-- MARCHA ATRÁS de la 0027.
--
-- Quita el candado y la columna del motivo. La vigencia —`valid_from` /
-- `valid_to`— es de la 0025 y no se toca aquí: revertir esto NO convierte la
-- asignación en algo que se pisa.
--
-- Lo que sí se pierde: los motivos escritos y la garantía de una sola vigente
-- por unidad. Anótalos antes, porque no vuelven:
--
--   SELECT unit_id, circuit_id, valid_from, valid_to, motivo
--     FROM circuit_unit_assignments WHERE motivo IS NOT NULL;
--
-- Y ojo al volver a aplicar la 0027 después: si mientras tanto se abrieron dos
-- asignaciones de la misma unidad, el índice único ya no se deja crear.

DROP INDEX IF EXISTS circuit_unit_assignments_una_vigente;
--> statement-breakpoint
ALTER TABLE circuit_unit_assignments DROP COLUMN IF EXISTS motivo;
