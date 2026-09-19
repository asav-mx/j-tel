-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0042 · nombre y licencia únicos por cuenta en los choferes
-- (Choferes V1)
--
-- SE APLICA DESPUÉS DE LA 0041 Y ANTES DE MERGEAR EL PR.
--   El código nuevo lee y escribe `driver_credentials.carrier_account_id` con la
--   API relacional de Drizzle, que pide TODAS las columnas declaradas.
--   Desplegado contra una base sin ella, revienta en cada pantalla que lee
--   choferes (la lección de la 0016). La migración es aditiva: el código de hoy
--   la ignora sin problema.
--
-- Qué hace (el detalle está en packages/db/drizzle/0042_choferes_identidad_unica.sql):
--   · `driver_credentials.carrier_account_id`, copiada de `drivers` y atada a
--     la cuenta de su chofer con una llave compuesta;
--   · ningún nombre de chofer repetido en una cuenta (sin mayúsculas, sin
--     espacios a los lados, los de en medio contados como uno);
--   · ninguna licencia repetida en una cuenta (sin mayúsculas, sin espacios ni
--     guiones).
--   Los dos candados valen entre los choferes ACTIVOS: los que tienen
--   credenciales. La baja las purga.
--
-- Sin enums: todo va en una sola transacción.
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura). Decide si se sigue.
--   PASO 2 · la migración (usuario dueño), dentro de BEGIN; COMMIT sólo si cuadra.
--   PASO 3 · después, de lectura.
--   Luego: mergear el PR.
--
-- En producción, medido por Asav el 19 sep 2026: 0 choferes. No hay nada que
-- copiar ni duplicados posibles; los números del PASO 1 deberían ser ceros.
--
-- Todas las verificaciones son de LECTURA: ninguna sentencia de esta hoja
-- falla a propósito (la regla de la consola de Neon, Procedimiento-Migraciones).
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT
  (SELECT count(*) FROM drivers)                                                        AS choferes,
  (SELECT count(*) FROM driver_credentials)                                             AS credenciales,
  (SELECT count(*) FROM (SELECT 1 FROM driver_credentials c JOIN drivers d ON d.id = c.driver_id
                          GROUP BY d.carrier_account_id, regexp_replace(lower(btrim(c.full_name)), '\s+', ' ', 'g')
                          HAVING count(*) > 1) x)                                        AS nombres_repetidos,
  (SELECT count(*) FROM (SELECT 1 FROM driver_credentials c JOIN drivers d ON d.id = c.driver_id
                          GROUP BY d.carrier_account_id, upper(regexp_replace(c.license_number, '[\s-]+', '', 'g'))
                          HAVING count(*) > 1) x)                                        AS licencias_repetidas,
  (SELECT count(*) FROM drivers d JOIN driver_credentials c ON c.driver_id = d.id
    WHERE d.deactivated_at IS NOT NULL)                                                 AS de_baja_con_credenciales,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'driver_credentials' AND column_name = 'carrier_account_id') AS ya_aplicada;

-- LO QUE DEBES VER:
--   choferes · credenciales        0 · 0   (en producción, al 19 sep 2026)
--   nombres_repetidos              0
--   licencias_repetidas            0
--   de_baja_con_credenciales       0
--   ya_aplicada                    false
--
-- Si nombres_repetidos o licencias_repetidas no son 0, PARA: los índices
-- únicos fallarían. Si de_baja_con_credenciales no es 0, también: un chofer de
-- baja con credenciales ocuparía su nombre y su licencia, y la baja todavía no
-- existe para purgarlo. En los dos casos pásame el resultado.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE driver_credentials ADD COLUMN IF NOT EXISTS carrier_account_id uuid;

UPDATE driver_credentials c
   SET carrier_account_id = d.carrier_account_id
  FROM drivers d
 WHERE d.id = c.driver_id AND c.carrier_account_id IS NULL;

ALTER TABLE driver_credentials ALTER COLUMN carrier_account_id SET NOT NULL;

ALTER TABLE driver_credentials
  ADD CONSTRAINT driver_credentials_de_su_cuenta FOREIGN KEY (driver_id, carrier_account_id)
  REFERENCES drivers (id, carrier_account_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS driver_credentials_nombre_unico_por_cuenta
  ON driver_credentials (carrier_account_id, (regexp_replace(lower(btrim(full_name)), '\s+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS driver_credentials_licencia_unica_por_cuenta
  ON driver_credentials (carrier_account_id, (upper(regexp_replace(license_number, '[\s-]+', '', 'g'))));

COMMENT ON COLUMN driver_credentials.carrier_account_id IS
  'La cuenta del chofer, copiada de drivers y atada con llave compuesta: hace posibles los candados de nombre y licencia unicos por cuenta (0042).';

-- Antes de COMMIT, dentro de la misma transacción:
SELECT
  (SELECT count(*) FROM pg_indexes
    WHERE indexname IN ('driver_credentials_nombre_unico_por_cuenta',
                        'driver_credentials_licencia_unica_por_cuenta'))                 AS indices,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'driver_credentials_de_su_cuenta') AS llave,
  (SELECT count(*) FROM driver_credentials WHERE carrier_account_id IS NULL)             AS sin_cuenta,
  (SELECT count(*) FROM drivers)                                                         AS choferes,
  (SELECT count(*) FROM driver_credentials)                                              AS credenciales;

-- LO QUE DEBES VER:
--   indices        2
--   llave          1
--   sin_cuenta     0
--   choferes · credenciales   los mismos números del PASO 1.
--
-- Si cuadra:     COMMIT;
-- Si no cuadra:  ROLLBACK;  y pásame el resultado.

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

-- 3a. La columna la ve también el usuario de lectura (las verificaciones corren con él).
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'driver_credentials' AND column_name = 'carrier_account_id';
-- LO QUE DEBES VER: carrier_account_id · uuid · NO

-- 3b. Los dos candados, con su definición.
SELECT indexname, indexdef FROM pg_indexes
 WHERE indexname IN ('driver_credentials_nombre_unico_por_cuenta', 'driver_credentials_licencia_unica_por_cuenta')
 ORDER BY indexname;
-- LO QUE DEBES VER: 2 renglones, UNIQUE, uno con regexp_replace(lower(btrim(full_name)) …
-- y otro con upper(regexp_replace(license_number …
