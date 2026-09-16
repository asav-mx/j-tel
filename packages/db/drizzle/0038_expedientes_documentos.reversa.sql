-- MARCHA ATRÁS de la 0038 · la familia de documentos del expediente.
--
-- ⚠ Borra TODOS los papeles capturados, sus versiones, las reglas cargadas y
-- los mercados, y deja a todas las cuentas sin mercado. Compruébalo antes:
--   SELECT (SELECT count(*) FROM documents)            AS fojas,
--          (SELECT count(*) FROM document_versions)    AS versiones,
--          (SELECT count(*) FROM document_type_rules)  AS reglas,
--          (SELECT count(*) FROM accounts WHERE market_id IS NOT NULL) AS cuentas_con_mercado;
-- Si algo no es cero, eso es captura de alguien: respáldalo antes de correr esto.
--
-- Primero hay que regresar el código: el código de la 0038 declara
-- `accounts.market_id`, y la API relacional la pide en cada lectura de cuentas.

DROP TABLE IF EXISTS document_versions;
--> statement-breakpoint
DROP TABLE IF EXISTS documents;
--> statement-breakpoint
DROP TABLE IF EXISTS document_type_rules;
--> statement-breakpoint
DROP TABLE IF EXISTS document_types;
--> statement-breakpoint
DROP FUNCTION IF EXISTS rechazar_edicion_en_sitio();
--> statement-breakpoint
DROP INDEX IF EXISTS drivers_id_cuenta_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS units_id_cuenta_idx;
--> statement-breakpoint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_mercado_solo_carrier;
--> statement-breakpoint
ALTER TABLE accounts DROP COLUMN IF EXISTS market_id;
--> statement-breakpoint
DROP TABLE IF EXISTS markets;
