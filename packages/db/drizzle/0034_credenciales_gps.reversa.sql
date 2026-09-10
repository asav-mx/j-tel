-- Marcha atrás de la 0034.
--
-- Devuelve las dos columnas a su nombre anterior. **No se pierde ningún dato**:
-- la 0034 no lee, no descifra y no escribe valores — sólo renombra. Ésta
-- tampoco.
--
-- ⚠ EL ORDEN IMPORTA, y al revés que al aplicar. El código nuevo pide
--   `gps_user_id`; con las columnas revertidas y el código nuevo desplegado,
--   `getGpsCredentials` devuelve null para todo carrier, el recolector y el
--   archivador se quedan sin credencial y la ingesta se detiene en silencio
--   —sin error de compilación, porque el nombre viejo no existe en el código—.
--
--   Primero se revierte el DESPLIEGUE, después la base.
--
-- Antes de correr esto, comprueba que hay algo que revertir:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'carrier_profiles'
--      AND column_name IN ('gps_user_id', 'gps_password_encrypted',
--                          'umbrella_user_id', 'umbrella_password_encrypted');

ALTER TABLE carrier_profiles RENAME COLUMN gps_user_id TO umbrella_user_id;
--> statement-breakpoint

ALTER TABLE carrier_profiles RENAME COLUMN gps_password_encrypted TO umbrella_password_encrypted;
