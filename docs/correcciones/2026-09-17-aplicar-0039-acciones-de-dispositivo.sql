-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0039 · acciones de dispositivo (C4-a)
--
-- SE APLICA DESPUÉS DE LA 0038 Y ANTES DE MERGEAR EL PR.
--   El código nuevo lee columnas nuevas de `devices` y `device_assignments`
--   con la API relacional de Drizzle, que pide TODAS las columnas declaradas.
--   Desplegado contra una base sin ellas, revienta en cada pantalla que lee
--   dispositivos (la lección de la 0016). La migración es aditiva: el código de
--   hoy —el alta vieja incluida— la ignora sin problema.
--
-- Qué hace (el detalle está en packages/db/drizzle/0039_acciones_de_dispositivo.sql):
--   · quién asignó, quién cerró y por qué, en cada asignación;
--   · quién dio cada baja;
--   · los candados: un dispositivo en una sola unidad, una unidad con un solo
--     dispositivo;
--   · el consecutivo global del nombre (Marco 6.3), rellenado desde los nombres
--     TK-FTC927-001 a -008, para que el siguiente sea el 009.
--
-- Sin enums: todo va en una sola transacción.
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura). Decide si se sigue.
--   PASO 2 · la migración (usuario dueño), dentro de BEGIN; COMMIT sólo si cuadra.
--   PASO 3 · después, de lectura.
--   Luego: mergear el PR.
--
-- Ensayada el 17 sep 2026 en la rama desechable: 0 duplicados, 3 índices
-- creados, y las 8 pruebas de `acciones-dispositivo.integration.test.ts` en
-- verde contra ella. La desechable no tiene los FTC927, así que el relleno del
-- consecutivo se comprobó aparte: `TK-FTC927-008` da 8, y con 8 la secuencia
-- entrega 9.
--
-- Todas las verificaciones son de LECTURA: ninguna sentencia de esta hoja
-- falla a propósito (la regla de la consola de Neon, Procedimiento-Migraciones).
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

-- 1a. Los candados fallan si ya hay dos asignaciones vigentes del mismo
--     dispositivo o de la misma unidad. Se cuentan, no se suponen.
SELECT
  (SELECT count(*) FROM (SELECT device_id FROM device_assignments
                          WHERE valid_to IS NULL GROUP BY device_id HAVING count(*) > 1) x) AS dispositivos_en_dos_unidades,
  (SELECT count(*) FROM (SELECT unit_id FROM device_assignments
                          WHERE valid_to IS NULL GROUP BY unit_id HAVING count(*) > 1) x)   AS unidades_con_dos_dispositivos,
  to_regclass('public.devices_consecutivo_seq') IS NOT NULL                                  AS ya_aplicada,
  (SELECT count(*) FROM devices)                                                             AS dispositivos,
  (SELECT count(*) FROM device_assignments)                                                  AS asignaciones;

-- LO QUE DEBES VER:
--   dispositivos_en_dos_unidades   0
--   unidades_con_dos_dispositivos  0
--   ya_aplicada                    false
--   dispositivos / asignaciones    anótalos: son la foto de «antes».
--
-- Si alguno de los dos primeros no es 0, PARA. Hay que ver cuáles son y
-- cerrarlos con una hoja propia antes de aplicar; la migración fallaría a la
-- mitad y no dejaría nada, pero tampoco sirve reintentarla.


-- 1b. Qué número va a recibir cada FTC927. Todo dispositivo de Compás tiene que
--     salir con número; uno con nombre raro (un espacio, otra forma) saldría
--     en null, su número quedaría libre y el sistema podría repetirlo.
SELECT d.label,
       a.slug                                                     AS cuenta,
       substring(d.label FROM '^TK-FTC927-([0-9]+)$')::integer    AS recibira_consecutivo
  FROM devices d
  JOIN accounts a ON a.id = d.carrier_account_id
 WHERE d.label ILIKE '%FTC927%'
 ORDER BY d.label;

-- LO QUE DEBES VER: 8 renglones, TK-FTC927-001 a -008, cada uno con su número
-- del 1 al 8 y ninguno en null. El 002 en asav, los demás en juarez-bus.
-- Si hay un null o un número repetido, PARA y pásame el resultado.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño.
--
-- ⚠ NO PEGUES LA HOJA ENTERA. Corre del BEGIN hasta el SELECT de
--   comprobación, mira los números, y sólo entonces escribe tú el COMMIT o el
--   ROLLBACK. Por eso van comentados abajo.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS asignada_por text;
ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS cerrada_por text;
ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS motivo_cierre text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_by text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS consecutivo integer;

UPDATE devices
   SET consecutivo = substring(label FROM '^TK-FTC927-([0-9]+)$')::integer
 WHERE label ~ '^TK-FTC927-[0-9]+$'
   AND consecutivo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devices_consecutivo_unico ON devices (consecutivo);

CREATE SEQUENCE IF NOT EXISTS devices_consecutivo_seq AS integer MINVALUE 1;

SELECT setval(
  'devices_consecutivo_seq',
  COALESCE((SELECT max(consecutivo) FROM devices), 1),
  (SELECT max(consecutivo) FROM devices) IS NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_dispositivo_una_vigente
  ON device_assignments (device_id) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_unidad_una_vigente
  ON device_assignments (unit_id) WHERE valid_to IS NULL;

COMMENT ON COLUMN device_assignments.asignada_por IS
  'Quien asigno el dispositivo a la unidad (id de usuario). Nulo en lo anterior a la 0039: no quedo registrado.';
COMMENT ON COLUMN device_assignments.cerrada_por IS
  'Quien cerro la asignacion: al soltar, al reasignar o al dar de baja (id de usuario). Nulo si la cerro un guion o si es anterior a la 0039.';
COMMENT ON COLUMN device_assignments.motivo_cierre IS
  'Por que termino la asignacion. Lo escribe quien suelta; lo escribe el sistema cuando la cierra otra accion (reasignar, baja). Se escribe al cerrar, no al abrir (0039).';
COMMENT ON COLUMN devices.retired_by IS
  'Quien dio de baja el dispositivo (id de usuario). Nulo en las bajas hechas por hoja SQL (0039).';
COMMENT ON COLUMN devices.consecutivo IS
  'El consecutivo global del nombre (Marco 6.3): se asigna una vez con devices_consecutivo_seq y nunca se reutiliza. Nulo en los dispositivos que no nacieron con nombre generado (0039).';

-- Comprobación, todavía dentro de la transacción:
SELECT
  (SELECT count(*) FROM devices WHERE consecutivo IS NOT NULL)            AS con_consecutivo,
  (SELECT max(consecutivo) FROM devices)                                  AS mayor,
  (SELECT count(*) FROM pg_indexes
    WHERE indexname IN ('devices_consecutivo_unico',
                        'device_assignments_dispositivo_una_vigente',
                        'device_assignments_unidad_una_vigente'))         AS indices,
  (SELECT count(*) FROM devices)                                          AS dispositivos,
  (SELECT count(*) FROM device_assignments)                               AS asignaciones;

-- LO QUE DEBES VER:
--   con_consecutivo 8 · mayor 8 · indices 3
--   dispositivos y asignaciones: los MISMOS números del PASO 1a.
--
-- Si cuadra, escribe:   COMMIT;
-- Si no, escribe:       ROLLBACK;   y pásame los números.
--
-- COMMIT;
-- ROLLBACK;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura, ya con el COMMIT hecho.
-- ───────────────────────────────────────────────────────────────────

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE (table_name = 'device_assignments' AND column_name IN ('asignada_por', 'cerrada_por', 'motivo_cierre'))
       OR (table_name = 'devices' AND column_name IN ('retired_by', 'consecutivo')))  AS columnas,
  (SELECT count(*) FROM pg_indexes
    WHERE indexname IN ('devices_consecutivo_unico',
                        'device_assignments_dispositivo_una_vigente',
                        'device_assignments_unidad_una_vigente'))                     AS indices,
  (SELECT last_value FROM devices_consecutivo_seq)                                    AS secuencia,
  (SELECT is_called FROM devices_consecutivo_seq)                                     AS secuencia_usada,
  (SELECT count(*) FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid
    WHERE NOT x.indisvalid)                                                           AS indices_invalidos;

-- LO QUE DEBES VER:
--   columnas 5 · indices 3 · secuencia 8 · secuencia_usada true · indices_invalidos 0
--   (secuencia 8 con secuencia_usada true quiere decir: el siguiente es el 9.)
--
-- Y la foto de «antes» sin moverse:
SELECT (SELECT count(*) FROM devices) AS dispositivos,
       (SELECT count(*) FROM device_assignments) AS asignaciones;


-- ───────────────────────────────────────────────────────────────────
-- EL CAMINO DE REGRESO
--
-- packages/db/drizzle/0039_acciones_de_dispositivo.reversa.sql — primero se
-- regresa el código, después se corre la reversa. Lee su encabezado: pierde
-- quién y por qué de todo lo que la pantalla haya escrito.
-- ───────────────────────────────────────────────────────────────────
