-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0040 · VIN de la unidad y nombres únicos por cuenta (C4-e)
--
-- SE APLICA DESPUÉS DE LA 0039 Y ANTES DE MERGEAR EL PR.
--   El código nuevo lee `units.vin` con la API relacional de Drizzle, que pide
--   TODAS las columnas declaradas. Desplegado contra una base sin ella, revienta
--   en cada pantalla que lee unidades (la lección de la 0016). La migración es
--   aditiva: el código de hoy la ignora sin problema.
--
-- Qué hace (el detalle está en packages/db/drizzle/0040_unidades_vin_y_nombres_unicos.sql):
--   · `units.vin`, opcional;
--   · ningún nombre de unidad repetido en una cuenta (sin mayúsculas, sin
--     espacios a los lados, los de en medio contados como uno);
--   · ningún VIN repetido en una cuenta;
--   · ningún nombre repetido entre los dispositivos EN SERVICIO de una cuenta.
--
-- Sin enums: todo va en una sola transacción.
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura). Decide si se sigue.
--   PASO 2 · la migración (usuario dueño), dentro de BEGIN; COMMIT sólo si cuadra.
--   PASO 3 · después, de lectura.
--   Luego: mergear el PR.
--
-- Ensayada el 18 sep 2026 en la rama desechable: 0 duplicados, 3 índices y la
-- columna creados, y las 9 pruebas de `nombres-unicos.integration.test.ts`
-- (más las 9 de `acciones-dispositivo`) en verde contra ella. En producción,
-- leído el mismo día: la única unidad repetida era la 2101 de juarez-bus, y ya
-- se corrigió (`corregir-2101-duplicada.ts`); los 77 dispositivos «umbrella»
-- de juarez-bus comparten nombre pero están de baja, y el candado de
-- dispositivos sólo mira los que están en servicio.
--
-- Todas las verificaciones son de LECTURA: ninguna sentencia de esta hoja
-- falla a propósito (la regla de la consola de Neon, Procedimiento-Migraciones).
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT
  (SELECT count(*) FROM (SELECT 1 FROM units
                          GROUP BY carrier_account_id, regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')
                          HAVING count(*) > 1) x)                                        AS unidades_con_nombre_repetido,
  (SELECT count(*) FROM (SELECT 1 FROM devices
                          WHERE label IS NOT NULL AND retired_at IS NULL
                          GROUP BY carrier_account_id, regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')
                          HAVING count(*) > 1) x)                                        AS dispositivos_en_servicio_repetidos,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name = 'units' AND column_name = 'vin')                           AS ya_aplicada,
  (SELECT count(*) FROM units)                                                           AS unidades,
  (SELECT count(*) FROM devices)                                                         AS dispositivos;

-- LO QUE DEBES VER:
--   unidades_con_nombre_repetido         0
--   dispositivos_en_servicio_repetidos   0
--   ya_aplicada                          false
--   unidades / dispositivos              anótalos: son la foto de «antes».
--
-- Si alguno de los dos primeros no es 0, PARA. Esta consulta dice cuáles:
--
--   SELECT a.slug, u.label, count(*) FROM units u JOIN accounts a ON a.id = u.carrier_account_id
--    GROUP BY a.slug, u.carrier_account_id, u.label,
--             regexp_replace(lower(btrim(u.label)), '\s+', ' ', 'g')
--   HAVING count(*) > 1;
--
-- La migración fallaría a la mitad y no dejaría nada, pero tampoco sirve
-- reintentarla: el duplicado se corrige primero, con su propia hoja.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE units ADD COLUMN IF NOT EXISTS vin text;

CREATE UNIQUE INDEX IF NOT EXISTS units_nombre_unico_por_cuenta
  ON units (carrier_account_id, (regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS units_vin_unico_por_cuenta
  ON units (carrier_account_id, vin) WHERE vin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devices_nombre_unico_en_servicio
  ON devices (carrier_account_id, (regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')))
  WHERE label IS NOT NULL AND retired_at IS NULL;

COMMENT ON COLUMN units.vin IS
  'Numero de identificacion vehicular (VIN), normalizado: mayusculas, sin espacios ni guiones, 17 caracteres. Opcional. Unico por cuenta, no en la plataforma (0040).';

-- Antes de COMMIT, dentro de la misma transacción:
SELECT
  (SELECT count(*) FROM pg_indexes
    WHERE indexname IN ('units_nombre_unico_por_cuenta', 'units_vin_unico_por_cuenta',
                        'devices_nombre_unico_en_servicio'))                              AS indices,
  (SELECT count(*) FROM units WHERE vin IS NOT NULL)                                      AS unidades_con_vin,
  (SELECT count(*) FROM units)                                                            AS unidades,
  (SELECT count(*) FROM devices)                                                          AS dispositivos;

-- LO QUE DEBES VER:
--   indices            3
--   unidades_con_vin   0   (nadie lo ha capturado todavía)
--   unidades / dispositivos   los mismos números del PASO 1.
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
 WHERE table_name = 'units' AND column_name = 'vin';
-- LO QUE DEBES VER: vin · text · YES

-- 3b. Los tres candados, con su definición.
SELECT indexname, indexdef FROM pg_indexes
 WHERE indexname IN ('units_nombre_unico_por_cuenta', 'units_vin_unico_por_cuenta', 'devices_nombre_unico_en_servicio')
 ORDER BY indexname;
-- LO QUE DEBES VER: 3 renglones, UNIQUE, con la expresión regexp_replace(lower(btrim(label)) …
-- y el WHERE de cada uno.
