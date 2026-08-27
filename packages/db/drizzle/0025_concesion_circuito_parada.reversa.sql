-- MARCHA ATRÁS de la 0025 · concesión · circuito · parada.
--
-- Seguro mientras no exista una concesión dada de alta. Si ya hay circuitos con
-- su trazado y sus paradas, esto BORRA ese trabajo: el KML subido, las paradas
-- picadas en el mapa y su historial de versiones. Compruébalo antes:
--
--   SELECT (SELECT count(*) FROM circuits) AS circuitos,
--          (SELECT count(*) FROM circuit_stops) AS paradas,
--          (SELECT count(*) FROM circuit_stop_versions) AS versiones;
--
-- El valor `concesion` del enum `account_type` NO se quita: Postgres no permite
-- eliminar valores de un enum, y dejarlo no molesta a nadie. Si quedaran cuentas
-- de ese tipo, bórralas antes o el DROP de las tablas las deja huérfanas de
-- perfil.

DROP TABLE IF EXISTS circuit_unit_assignments;
--> statement-breakpoint
DROP TABLE IF EXISTS circuit_stop_versions;
--> statement-breakpoint
DROP TABLE IF EXISTS circuit_stops;
--> statement-breakpoint
DROP TABLE IF EXISTS circuit_paths;
--> statement-breakpoint
DROP TABLE IF EXISTS circuits;
--> statement-breakpoint
DROP TABLE IF EXISTS concession_carriers;
--> statement-breakpoint
DROP TABLE IF EXISTS concession_profiles;
--> statement-breakpoint
DROP TYPE IF EXISTS sentido_circuito;
