-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0035 · Compás como conexión de plataforma
--
-- SE APLICA DESPUÉS DE LA 0034.
--
-- La migración en sí es ADITIVA y no toca filas: cambia el valor por
-- omisión de `gps_provider` y agrega cuatro tipos de aviso. Lo que sí
-- toca filas es el PASO 4 y el PASO 6 de esta hoja: pasar las dos
-- cuentas de hoy a Compás, y borrar la copia del secreto del servidor
-- que vive en Juárez Bus. Ésos son a propósito aparte y en orden.
--
-- EL ORDEN COMPLETO, y por qué importa:
--
--   0. En Vercel, Production: COMPAS_GPS_URL, COMPAS_GPS_USERID y
--      COMPAS_GPS_PASSWORD. ANTES del merge, para que el despliegue
--      del merge ya las traiga. Sin ellas, una cuenta en Compás falla
--      con un error que las nombra (no cae a otro proveedor).
--   1. Mergear y desplegar el PR. Hasta aquí NADA cambia de
--      comportamiento: Juárez Bus sigue en `traccar` con su credencial
--      y asav sigue en `umbrella`. Una cuenta NUEVA ya nace en Compás.
--   2. PASO 2 de esta hoja: la migración.
--   3. PASO 3: comprobar el enum, en otra transacción.
--   4. PASO 4: pasar las dos cuentas a Compás. Aquí sí cambia la
--      ingesta: las dos se sondean en una sola pasada.
--   5. PASO 5: comprobar que entran los aparatos 3 y 4 de asav.
--   6. PASO 6: borrar la copia del secreto en Juárez Bus. SÓLO si el
--      PASO 5 salió bien: revertirlo después exige volver a copiar la
--      contraseña desde el servidor.
--
-- ⚠ TRAMPA CONOCIDA (0025): un valor nuevo de enum no se puede usar ni
--   leer en la transacción donde se agrega (55P04). Por eso el PASO 2
--   y el PASO 3 van separados.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT a.slug, p.gps_provider, p.gps_base_url, p.gps_user_id,
       (p.gps_password_encrypted IS NOT NULL) AS tiene_secreto,
       (SELECT count(*) FROM devices d WHERE d.carrier_account_id = a.id) AS aparatos
  FROM carrier_profiles p JOIN accounts a ON a.id = p.account_id
 ORDER BY a.slug;

-- LO QUE DEBES VER (14 de septiembre de 2026):
--   asav        umbrella  —                              —                  false  2 ó 3
--   juarez-bus  traccar   https://compas.j-telemetry.com repo@compas.local  true   87
--
-- Si aparece otra cuenta, anótala: el PASO 4 sólo mueve estas dos.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR LA MIGRACIÓN. Sin BEGIN: cada sentencia sola.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE carrier_profiles ALTER COLUMN gps_provider SET DEFAULT 'compas';

COMMENT ON COLUMN carrier_profiles.gps_provider IS
  'Que proveedor GPS usa este carrier. compas: la conexion de plataforma a Compas, el Traccar de J-Tel, sin credencial en la cuenta (por omision desde la 0035). traccar: un Traccar ajeno con credencial propia. umbrella: el de antes del corte del 5 sep 2026.';

ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_sin_dueno';
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_otro_proveedor';
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_fuera_de_compas';
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'imei_en_dos_cuentas';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · COMPROBAR. Ya fuera de la transacción del PASO 2.
-- ───────────────────────────────────────────────────────────────────

SELECT
  (SELECT column_default FROM information_schema.columns
    WHERE table_name = 'carrier_profiles' AND column_name = 'gps_provider') AS por_omision,
  enum_range(NULL::ingest_alert_kind)                                     AS tipos_de_aviso;

-- LO QUE DEBES VER:
--   por_omision     'compas'::text
--   tipos_de_aviso  los cuatro de antes y los cuatro nuevos, ocho en total


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · PASAR LAS DOS CUENTAS A COMPÁS.
--
-- No borra nada todavía: la credencial de Juárez Bus se queda donde
-- está, sólo deja de leerse. Si algo sale mal, regresar es devolver
-- `gps_provider` a 'traccar' en juarez-bus y a 'umbrella' en asav.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

UPDATE carrier_profiles SET gps_provider = 'compas'
 WHERE account_id IN (SELECT id FROM accounts WHERE slug IN ('juarez-bus', 'asav'));
-- DEBE decir UPDATE 2. Si dice otra cosa: ROLLBACK;

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 5 · COMPROBAR QUE ENTRAN. Dos minutos después del PASO 4, con
-- el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT a.slug, lp.imei, lp.recorded_at, lp.collected_at
  FROM live_positions lp JOIN accounts a ON a.id = lp.carrier_account_id
 WHERE lp.imei IN ('860693082402380', '860573080597409',
                   '860693089187232', '860693086784395', '860693086787513')
 ORDER BY lp.imei;

-- LO QUE DEBES VER:
--   Los aparatos 3 (…187232) y 4 (…784395) con cuenta asav. Aparecen
--   si tienen una posición válida en Compás: un aparato guardado bajo
--   techo desde antes puede tardar hasta que vuelva a ver el cielo.
--   El 1 y el 2 siguen con juarez-bus, igual que antes.
--
-- Y los avisos del cotejo, que se abren en el primer minuto:

SELECT kind, message, created_at FROM ingest_alerts
 WHERE resolved_at IS NULL
   AND kind::text IN ('aparato_sin_dueno', 'aparato_otro_proveedor',
                      'aparato_fuera_de_compas', 'imei_en_dos_cuentas')
 ORDER BY created_at;

-- LO QUE ESPERO VER, y NINGUNO es un error del cotejo:
--   aparato_fuera_de_compas  con los ~85 aparatos viejos de Juárez Bus,
--                            que eran de Umbrella y no están en Compás.
--                            Es verdad: no transmiten. Se cierra solo
--                            conforme se instalen los FTC927 de octubre.
--   aparato_sin_dueno        con el 5.º (…787513) si todavía no se da
--                            de alta en la flota de asav.
--
-- Si NO aparece ningún aviso en cinco minutos, mira el resumen del
-- cron `/api/cron/collect` en los registros de Vercel: `compas.cotejo`
-- dice los conteos, y `compas.cotejo.error` dice por qué no se
-- escribieron.


-- ───────────────────────────────────────────────────────────────────
-- PASO 6 · BORRAR LA COPIA DEL SECRETO DEL SERVIDOR EN JUÁREZ BUS.
--
-- La deuda explícita: el secreto de Compás no debe vivir en una cuenta
-- de cliente más tiempo del necesario. Una cuenta en Compás no lo lee.
--
-- SÓLO si el PASO 5 salió bien.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

UPDATE carrier_profiles
   SET gps_base_url = NULL, gps_user_id = NULL, gps_password_encrypted = NULL
 WHERE account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
   AND gps_provider = 'compas';
-- DEBE decir UPDATE 1. Si dice UPDATE 0, el PASO 4 no quedó: ROLLBACK;

COMMIT;

-- Comprobación final: ninguna cuenta en Compás guarda secreto.
SELECT a.slug, p.gps_provider, (p.gps_password_encrypted IS NOT NULL) AS tiene_secreto
  FROM carrier_profiles p JOIN accounts a ON a.id = p.account_id
 WHERE p.gps_provider = 'compas' AND p.gps_password_encrypted IS NOT NULL;
-- DEBE devolver CERO filas.
