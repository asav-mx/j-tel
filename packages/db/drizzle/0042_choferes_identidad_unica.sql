-- El chofer tiene un solo nombre y una sola licencia por cuenta (Choferes V1).
-- ADITIVA.
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide TODAS las columnas declaradas, y el código nuevo contra una base
-- sin `driver_credentials.carrier_account_id` revienta en cada pantalla que lee
-- choferes (la lección de la 0016). Al revés no pasa nada: el código de hoy
-- ignora la columna.
--
-- Sin enums: todo corre en una sola transacción. El runbook está en
-- docs/correcciones/2026-09-19-aplicar-0042-choferes-identidad-unica.sql, con la
-- lectura de ANTES que decide si se puede aplicar.
--
-- ══════════════════════════════════════════════════════════════════════
-- 1. La cuenta en las credenciales (decisión de Asav, 19 sep 2026)
-- ══════════════════════════════════════════════════════════════════════
--
-- Un índice único no puede cruzar tablas, y «único por cuenta» necesita la
-- cuenta junto al nombre. Se copia de `drivers` y una llave compuesta la ata:
-- la credencial de un chofer no puede decir que es de otra cuenta. Es la misma
-- llave que sostiene el muro de los papeles (0038, `drivers_id_cuenta_idx`).
--
-- Las credenciales siguen siendo la Capa 2, PURGABLE (Plan-Choferes): la
-- columna nueva no es dato personal, y se va con la fila.
--
-- ══════════════════════════════════════════════════════════════════════
-- 2. Ningún nombre ni licencia repetidos entre los choferes activos
-- ══════════════════════════════════════════════════════════════════════
--
-- «Activos» son los que tienen credenciales: la baja las purga (Plan-Choferes
-- 6.5), así que un chofer de baja ya no ocupa su nombre ni su licencia. La baja
-- todavía no existe, y su ficha tiene que purgar en el mismo acto; mientras un
-- chofer de baja conservara credenciales, seguiría ocupándolos.
--
-- «El mismo nombre» es la regla de las unidades (0040): sin mayúsculas, sin
-- espacios a los lados y con los de en medio contados como uno. «La misma
-- licencia» es sin mayúsculas, sin espacios ni guiones: «CHIH-123 45» y
-- «chih12345» son la misma. Las dos expresiones son las de `nombreComparable` y
-- `licenciaComparable` en @jtel/domain; si una cambia, la otra también.
--
-- ⚠ LOS ÍNDICES ÚNICOS FALLAN SI YA HAY DUPLICADOS. El PASO 1 del runbook los
-- cuenta, y si no es cero se para.
--
-- Sin CONCURRENTLY: `driver_credentials` es chica y sólo la escriben humanos.

ALTER TABLE driver_credentials ADD COLUMN IF NOT EXISTS carrier_account_id uuid;
--> statement-breakpoint

UPDATE driver_credentials c
   SET carrier_account_id = d.carrier_account_id
  FROM drivers d
 WHERE d.id = c.driver_id AND c.carrier_account_id IS NULL;
--> statement-breakpoint

ALTER TABLE driver_credentials ALTER COLUMN carrier_account_id SET NOT NULL;
--> statement-breakpoint

ALTER TABLE driver_credentials
  ADD CONSTRAINT driver_credentials_de_su_cuenta FOREIGN KEY (driver_id, carrier_account_id)
  REFERENCES drivers (id, carrier_account_id) ON DELETE CASCADE;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS driver_credentials_nombre_unico_por_cuenta
  ON driver_credentials (carrier_account_id, (regexp_replace(lower(btrim(full_name)), '\s+', ' ', 'g')));
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS driver_credentials_licencia_unica_por_cuenta
  ON driver_credentials (carrier_account_id, (upper(regexp_replace(license_number, '[\s-]+', '', 'g'))));
--> statement-breakpoint

COMMENT ON COLUMN driver_credentials.carrier_account_id IS
  'La cuenta del chofer, copiada de drivers y atada con llave compuesta: hace posibles los candados de nombre y licencia unicos por cuenta (0042).';
