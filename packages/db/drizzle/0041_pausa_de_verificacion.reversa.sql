-- MARCHA ATRÁS de la 0041 · pausa de la verificación.
--
-- ⚠ Se pierde la historia de pausas y reanudaciones. Compruébalo antes:
--   SELECT c.name, e.tipo, e.vale_desde, e.motivo, e.registrado_at
--     FROM contract_verification_events e JOIN service_contracts c ON c.id = e.contract_id
--    ORDER BY c.name, e.vale_desde;
-- Si hay eventos, anota la lista antes de correr esto.
--
-- ⚠ Lo que la pausa borró (ocurrencias sin hecho dentro de la pausa) NO vuelve:
-- quitar la tabla no regenera nada. Al quitarla, la verificación de todos los
-- contratos vuelve a correr normal, y la renovación genera de hoy en adelante.
--
-- Primero hay que regresar el código: el código de la 0041 lee esta tabla.

DROP TRIGGER IF EXISTS cve_sin_edicion ON contract_verification_events;
--> statement-breakpoint
DROP TRIGGER IF EXISTS cve_secuencia ON contract_verification_events;
--> statement-breakpoint
DROP FUNCTION IF EXISTS cve_rechazar_edicion();
--> statement-breakpoint
DROP FUNCTION IF EXISTS cve_revisar_secuencia();
--> statement-breakpoint
DROP TABLE IF EXISTS contract_verification_events;
