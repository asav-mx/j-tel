-- Reversa de la 0044.
--
-- Quitar las dos tablas pierde toda promesa por franja capturada hasta ahora.
-- No pierde nada más: `circuits.declared_frequency_minutes` nunca se tocó, y
-- sigue siendo la promesa de respaldo.

DROP TABLE IF EXISTS circuit_promise_bands;
--> statement-breakpoint
DROP TABLE IF EXISTS circuit_promise_tables;
--> statement-breakpoint
DROP TYPE IF EXISTS tipo_de_dia_circuito;
