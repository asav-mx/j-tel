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
--      PASO 5 salió bien, y mejor a la mañana siguiente: es el único
--      paso que no se regresa con un UPDATE.
--
-- El camino de REGRESO está al final de la hoja, paso por paso y en
-- orden inverso. Léelo antes de empezar.
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


-- ═══════════════════════════════════════════════════════════════════
-- EL CAMINO DE REGRESO
--
-- Se regresa en ORDEN INVERSO y sólo hasta donde haga falta. La regla
-- que no se rompe: **no regresar el código (R1) con cuentas en
-- `compas`**. El código viejo no conoce ese valor: el recolector
-- fallaría con «Proveedor GPS no soportado todavía: compas» y el
-- archivador se saltaría a esas cuentas. Primero R4, luego R1.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- SI EL PASO 5 NO SALE — primero saber cuál de tres casos es.
--
-- ⚠ «el 1 y el 2 siguen actualizándose» NO sirve de prueba: un FTC927
-- quieto en un escritorio deja de mandar posiciones nuevas, así que su
-- `recorded_at` se congela aunque todo funcione. La prueba es el
-- resumen del cron: Vercel → proyecto j-tel-web → Logs, filtrar por
-- `/api/cron/collect`, abrir una invocación de después del PASO 4.
--
--   CASO A · `compas.ok` es false, o el cron responde 503.
--            La pasada no está leyendo. `compas.sondeos[0].error` dice
--            por qué: si nombra COMPAS_GPS_*, faltan las variables o no
--            entraron al despliegue; si dice 401, la contraseña está
--            mal. → **R4 de inmediato** (Juárez Bus vuelve a leer con
--            su credencial), y después se corrige con calma.
--
--   CASO B · `compas.ok` es true, pero el 3 y el 4 no aparecen.
--            La pasada sí funciona y el problema es de esos dos
--            aparatos. **No se regresa nada.** Mira `compas.cotejo`:
--              · si los cuenta en `fueraDeCompas`: el IMEI de J-Tel no
--                coincide con el de Compás, o el usuario del repo no
--                los ve;
--              · si no aparecen en ninguna huella: Compás los tiene y
--                no trae posición válida de ellos — están bajo techo o
--                sin satélites. Sácalos al cielo.
--
--   CASO C · posiciones bien, pero `compas.cotejo.error` trae texto.
--            Los avisos no se escriben; casi siempre es la 0035 sin
--            aplicar (PASO 2). **No se regresa nada**: la ingesta está
--            sana, sólo falta la vigilancia.
--
-- Si no sabes cuál es, R4 siempre es seguro mientras no hayas corrido
-- el PASO 6: deja todo exactamente como estaba esta mañana.
-- ───────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────
-- R6 · Regresar el PASO 6 (la credencial borrada de Juárez Bus).
--
-- Es el único que no es un UPDATE: el secreto ya no existe en la base
-- y hay que volver a cifrarlo desde el servidor. Sólo hace falta si
-- después vas a correr R4, porque una cuenta en `compas` no lo lee.
-- No lo corras a mano: pídelo, y se escribe con `saveGpsCredentials`
-- leyendo la contraseña de /opt/traccar/.repopass, sin que pase por la
-- pantalla ni por la conversación.
-- ───────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────
-- R4 · Regresar el PASO 4. Deja las dos cuentas como esta mañana.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

UPDATE carrier_profiles SET gps_provider = 'traccar'
 WHERE account_id = (SELECT id FROM accounts WHERE slug = 'juarez-bus')
   AND gps_password_encrypted IS NOT NULL;
-- DEBE decir UPDATE 1. Si dice UPDATE 0, ya corriste el PASO 6:
-- ROLLBACK; y primero R6.

UPDATE carrier_profiles SET gps_provider = 'umbrella'
 WHERE account_id = (SELECT id FROM accounts WHERE slug = 'asav');
-- DEBE decir UPDATE 1.

COMMIT;

-- Comprueba corriendo otra vez el PASO 1: tiene que salir IDÉNTICO a lo
-- que anotaste antes de empezar. Al minuto siguiente el recolector ya
-- lee a Juárez Bus por su camino de antes.


-- ───────────────────────────────────────────────────────────────────
-- R2 · Regresar la migración. Casi nunca hace falta: es aditiva y el
-- código viejo funciona con ella puesta.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE carrier_profiles ALTER COLUMN gps_provider SET DEFAULT 'umbrella';

-- Los cuatro tipos de aviso NO se quitan: Postgres no borra valores de
-- un enum, y dejarlos no estorba. Los avisos ya abiertos se cierran:

UPDATE ingest_alerts SET resolved_at = now()
 WHERE resolved_at IS NULL
   AND kind::text IN ('aparato_sin_dueno', 'aparato_otro_proveedor',
                      'aparato_fuera_de_compas', 'imei_en_dos_cuentas');


-- ───────────────────────────────────────────────────────────────────
-- R1 · Regresar el código. SÓLO después de R4.
--
-- Vercel → j-tel-web → Deployments → el despliegue de producción de
-- antes del merge → «Instant Rollback». Es inmediato y no toca la base.
-- Después, revertir el PR en GitHub para que el siguiente merge no lo
-- vuelva a subir.
--
-- Una cuenta creada en J-Staff entre R1 y el despliegue siguiente nace
-- con el valor por omisión de la base: `compas` si la 0035 sigue
-- puesta, y el código viejo no la sabe leer. No crees cuentas en ese
-- rato, o corre también R2.
-- ───────────────────────────────────────────────────────────────────
