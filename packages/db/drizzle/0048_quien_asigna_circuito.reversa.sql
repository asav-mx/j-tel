-- Reversa de la 0048. Se pierde el autor de lo asignado desde entonces.
ALTER TABLE circuit_unit_assignments DROP COLUMN IF EXISTS cerrada_por;
ALTER TABLE circuit_unit_assignments DROP COLUMN IF EXISTS asignada_por;
