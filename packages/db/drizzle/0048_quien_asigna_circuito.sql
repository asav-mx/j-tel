-- Quién abrió y quién cerró una asignación de unidad a circuito — ADITIVA.
--
-- Se aplica DESPUÉS de la 0047 y **ANTES de desplegar el código** que la lee:
-- la API relacional de Drizzle pide todas las columnas declaradas, y el código
-- nuevo contra una base sin ellas revienta al leer asignaciones (la lección de
-- la 0016). Al revés no pasa nada.
--
-- ## Por qué ahora
--
-- Hasta hoy sólo J-Staff asignaba unidades a un circuito, y «quién» no hacía
-- falta: era J-Staff. Desde la ficha de huecos de asignar (21-sep) el carrier
-- asigna las suyas, y puede JALAR su camión de un circuito de otra concesión
-- (decisión de Asav, §4). Ese cierre lo ve la otra concesión en su historial, y
-- sin autor es un camión que se fue sin que nadie sepa quién lo movió. El
-- motivo ya existía (0027); faltaba el quién.
--
-- La misma forma que `device_assignments` en la 0039: id de usuario en texto,
-- quién abrió se escribe al abrir, quién cerró al cerrar. Nulas en todo lo de
-- antes: escribirles un autor ahora sería inventarlo. Null dice la verdad:
-- «no quedó registrado».

ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS asignada_por text;
--> statement-breakpoint
ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS cerrada_por text;
--> statement-breakpoint
COMMENT ON COLUMN circuit_unit_assignments.asignada_por IS
  'Id de usuario que abrio la asignacion. Nulo en lo anterior a la 0048.';
--> statement-breakpoint
COMMENT ON COLUMN circuit_unit_assignments.cerrada_por IS
  'Id de usuario que la cerro: al soltar o al reasignar la unidad a otro circuito. Nulo en lo anterior a la 0048 o si la cerro un guion.';
