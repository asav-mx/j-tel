-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0037: la marca de lectura del archivador, por aparato
--
-- SE APLICA DESPUÉS DE LA 0036.
--
-- ⚠ LA MIGRACIÓN VA ANTES DEL MERGE, igual que la 0036.
--   El archivador nuevo lee y escribe `telemetry_archive_marks` en cada
--   corrida. Desplegado contra una base sin la tabla, cada corrida del cron
--   truena al leer las marcas y NO ARCHIVA NADA — y eso es evidencia que no
--   entra. Al revés no pasa nada: el código de hoy no conoce la tabla.
--
--   1. PASO 1 · antes, de lectura.
--   2. PASO 2 · la migración.
--   3. PASO 3 · comprobarla.
--   4. Mergear y desplegar el PR.
--   5. PASO 4 · después de la primera corrida del archivador (cada 10 min).
--
-- El camino de regreso está al final.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
--
-- Antes de nada, desde la terminal:
--
--   pnpm --filter @jtel/db verificar-solo-lectura
--
-- Tiene que decir «heredará lo que se cree después». Esta migración CREA una
-- tabla, y sin privilegios por omisión el usuario de solo lectura no la ve y
-- el PASO 3 y el PASO 4 salen ciegos.
--
-- La tabla no debe existir todavía, y conviene dejar anotado dónde está la
-- marca de cada cuenta: es desde donde van a arrancar sus aparatos.
-- ───────────────────────────────────────────────────────────────────

SELECT to_regclass('public.telemetry_archive_marks') AS tabla_ya_existe;

SELECT a.name, a.slug, w.last_recorded_at AS marca_de_la_cuenta
  FROM telemetry_watermarks w
  JOIN accounts a ON a.id = w.carrier_account_id
 ORDER BY a.name;

-- LO QUE DEBES VER:
--   tabla_ya_existe   (null)
--   una fila por cuenta con marca. Anota las horas.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · LA MIGRACIÓN. Con el usuario dueño. Sin BEGIN: cada sentencia sola.
--
-- Es la 0037 tal cual. Aditiva e idempotente: correrla dos veces no hace
-- nada la segunda (ensayado en la desechable el 15 sep 2026).
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telemetry_archive_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  imei text NOT NULL,
  read_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_archive_marks_carrier_imei_idx
  ON telemetry_archive_marks (carrier_account_id, imei);

COMMENT ON TABLE telemetry_archive_marks IS
  'Hasta que hora ya se le pregunto al proveedor GPS por cada aparato, y contesto. La escribe solo el archivador, y solo avanza (0037).';
COMMENT ON COLUMN telemetry_archive_marks.read_until IS
  'Fin de la ultima ventana leida con exito para este aparato. No es su ultimo punto: una ventana leida sin puntos tambien cuenta (0037).';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · COMPROBAR. Con el usuario de solo lectura.
--
-- Que exista, que esté vacía, y que el usuario de solo lectura la pueda leer
-- (si los permisos por omisión no la cubren, el guion de lectura no la ve).
-- ───────────────────────────────────────────────────────────────────

SELECT count(*) AS marcas FROM telemetry_archive_marks;

SELECT indexname FROM pg_indexes WHERE tablename = 'telemetry_archive_marks' ORDER BY 1;

-- LO QUE DEBES VER:
--   marcas     0
--   indexname  telemetry_archive_marks_carrier_imei_idx
--              telemetry_archive_marks_pkey
--
-- Si el SELECT da `permission denied`, falta el GRANT al usuario de solo
-- lectura: `GRANT SELECT ON telemetry_archive_marks TO jtel_readonly;` con el
-- dueño. NO se sigue al merge sin poder leerla: el PASO 4 es de lectura.


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · DESPUÉS DE LA PRIMERA CORRIDA. Con el usuario de solo lectura.
--
-- Una marca por cada aparato que el proveedor conoce. Los aparatos que no
-- están en Compás (los de Umbrella dados de baja) NO deben tener marca: al
-- proveedor no se le pregunta por ellos.
-- ───────────────────────────────────────────────────────────────────

SELECT a.name,
       count(m.*)                                   AS aparatos_con_marca,
       min(m.read_until)                            AS la_mas_atrasada,
       max(m.read_until)                            AS la_mas_adelantada,
       w.last_recorded_at                           AS marca_de_la_cuenta
  FROM accounts a
  LEFT JOIN telemetry_archive_marks m ON m.carrier_account_id = a.id
  LEFT JOIN telemetry_watermarks w    ON w.carrier_account_id = a.id
 WHERE a.type = 'carrier'
 GROUP BY a.name, w.last_recorded_at
 ORDER BY a.name;

-- LO QUE DEBES VER, en cada cuenta de Compás:
--   aparatos_con_marca  = los aparatos de la cuenta que están en Compás
--   la_mas_adelantada   ≈ la hora de la corrida
--   la_mas_atrasada     ≈ la hora de la corrida, salvo un aparato que no
--                         contestó: ése se queda en la marca de la cuenta del
--                         PASO 1 y se retoma en la corrida siguiente.
--
-- Y el resumen de la corrida en los registros de Vercel (`[cron/archive]`)
-- trae, por cuenta, `aparatos: { alDia, fallidos, sinTerminar, atrasados,
-- fueraDelProveedor }`.


-- ═══════════════════════════════════════════════════════════════════
-- CAMINO DE REGRESO
--
-- 1. Revertir el PR y desplegar. El archivador viejo no conoce la tabla.
-- 2. Sólo después, si se quiere quitar la tabla, la reversa de la 0037:
--
--      DROP TABLE IF EXISTS telemetry_archive_marks;
--
--    No borra ningún punto. Se pierde sólo hasta dónde se leyó cada aparato,
--    y el archivador viejo vuelve a su marca por cuenta.
-- ═══════════════════════════════════════════════════════════════════
