-- Reversa de la 0055 · devuelve la cascada
--
-- Devolver esto **vuelve a permitir** que borrar un circuito se lleve sus
-- paradas, y con ellas cada QR impreso de ese circuito. No se revierte «por si
-- acaso»: sólo si la restricción está bloqueando una operación legítima, y
-- entonces lo que hay que arreglar es esa operación.

ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_fkey;
--> statement-breakpoint
ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_circuits_id_fk;
--> statement-breakpoint
ALTER TABLE circuit_stops
  ADD CONSTRAINT circuit_stops_circuit_id_fkey
  FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE CASCADE;
