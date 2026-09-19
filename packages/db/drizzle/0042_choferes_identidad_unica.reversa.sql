-- MARCHA ATRÁS de la 0042 · nombre y licencia únicos por cuenta en los choferes.
--
-- No se pierde ningún dato del chofer: la cuenta de cada credencial sigue en
-- `drivers`. Lo que se pierde es la garantía de la base de que nombre y
-- licencia no se repitan; el código lo sigue revisando.
--
-- Primero hay que regresar el código: el código de la 0042 lee y escribe
-- `driver_credentials.carrier_account_id`.

DROP INDEX IF EXISTS driver_credentials_licencia_unica_por_cuenta;
--> statement-breakpoint
DROP INDEX IF EXISTS driver_credentials_nombre_unico_por_cuenta;
--> statement-breakpoint
ALTER TABLE driver_credentials DROP CONSTRAINT IF EXISTS driver_credentials_de_su_cuenta;
--> statement-breakpoint
ALTER TABLE driver_credentials DROP COLUMN IF EXISTS carrier_account_id;
