-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0034 · las credenciales GPS dejan de llamarse Umbrella
--
-- SE APLICA DESPUÉS DE LA 0033.
--
-- ✓ NO CREA NI BORRA DATOS. Son dos `RENAME COLUMN`. Ningún valor se
--   lee, se descifra ni se reescribe. El secreto cifrado se queda
--   exactamente donde está, con otro nombre encima.
--
-- ⚠ NO ES COMPATIBLE HACIA ATRÁS, y ésta es la diferencia con la 0032
--   y la 0033. Aquéllas eran aditivas: el código viejo seguía
--   funcionando con la columna nueva puesta. Ésta NO — en cuanto se
--   renombra, el código viejo pide `umbrella_user_id`, no la
--   encuentra, y `getGpsCredentials` empieza a devolver null.
--
--   Qué pasa entonces, para que nadie lo descubra en vivo: el
--   recolector y el archivador caen al respaldo por variables de
--   ambiente (`UMBRELLA_GPS_USERID`), que hoy apunta a una cuenta
--   revocada. O sea la ingesta no truena: se queda callada. Hoy eso
--   ya es el estado real —Umbrella cortó el 5 de septiembre— así que
--   la ventana de daño es cero. **En cualquier otro momento no lo
--   sería.**
--
-- ⚠ POR ESO SE APLICA JUNTO AL DESPLIEGUE, no antes. El orden es:
--      1. mergear y desplegar el código de este PR
--      2. correr el PASO 2 de esta hoja
--   Si se corre al revés, el hueco entre los dos es tiempo sin
--   credencial.
--
-- ⚠ TODAS LAS COMPROBACIONES SON DE LECTURA.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='carrier_profiles' AND column_name='umbrella_user_id')      AS nombre_viejo,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='carrier_profiles' AND column_name='gps_user_id')           AS ya_esta_la_0034,
  (SELECT count(*) FROM carrier_profiles)                                               AS perfiles,
  (SELECT count(*) FROM carrier_profiles WHERE umbrella_user_id IS NOT NULL)            AS con_usuario,
  (SELECT count(*) FROM carrier_profiles WHERE umbrella_password_encrypted IS NOT NULL) AS con_secreto;

-- LO QUE DEBES VER:
--   nombre_viejo     TRUE
--   ya_esta_la_0034  FALSE   <- TRUE = ya aplicada, salta al PASO 3
--
-- ANOTA `perfiles`, `con_usuario` y `con_secreto`. Son los tres
-- números que el PASO 3 tiene que devolver IDÉNTICOS. Un renombre que
-- mueva cualquiera de los tres no es un renombre.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Las dos juntas, en una sola transacción.
--
-- Van juntas a propósito: dejar una renombrada y la otra no produce
-- un perfil con usuario nuevo y secreto viejo, y `getGpsCredentials`
-- exige los dos. A medias es peor que sin empezar.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE carrier_profiles RENAME COLUMN umbrella_user_id TO gps_user_id;

ALTER TABLE carrier_profiles RENAME COLUMN umbrella_password_encrypted TO gps_password_encrypted;

COMMENT ON COLUMN carrier_profiles.gps_user_id IS
  'Usuario o identidad con la que se entra al proveedor GPS de ESTE carrier. Cual proveedor lo dice gps_provider. Se llamaba umbrella_user_id hasta la 0034, y el nombre mentia en cuanto entro el segundo proveedor.';

COMMENT ON COLUMN carrier_profiles.gps_password_encrypted IS
  'Secreto del proveedor GPS de ESTE carrier, cifrado. Para Umbrella es la contrasena; para Traccar puede ser la contrasena o un token de cuenta. Se descifra solo en getGpsCredentials.';

COMMENT ON COLUMN carrier_profiles.gps_provider IS
  'Que proveedor GPS usa este carrier: umbrella, traccar. Gobierna buildProvider. El recolector y el archivador pasan los dos por aqui, asi que cambiar esta columna cambia de donde sale la evidencia de ese carrier.';

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='carrier_profiles' AND column_name='umbrella_user_id')  AS quedo_el_viejo,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_name='carrier_profiles' AND column_name='gps_user_id')       AS esta_el_nuevo,
  (SELECT count(*) FROM carrier_profiles)                                           AS perfiles,
  (SELECT count(*) FROM carrier_profiles WHERE gps_user_id IS NOT NULL)             AS con_usuario,
  (SELECT count(*) FROM carrier_profiles WHERE gps_password_encrypted IS NOT NULL)  AS con_secreto;

-- LO QUE DEBES VER:
--   quedo_el_viejo   FALSE
--   esta_el_nuevo    TRUE
--   perfiles, con_usuario, con_secreto  ->  IDÉNTICOS a tu PASO 1.
--
-- Si `con_secreto` bajó, PARA. No lo arregles con la marcha atrás sin
-- mirar antes: un renombre no puede perder valores, así que un número
-- distinto significa que pasó otra cosa al mismo tiempo.


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Que el secreto siga sirviendo, no sólo que exista.
--
-- Contar filas no prueba que el cifrado sobrevivió. Esto tampoco lo
-- prueba del todo —descifrar necesita la llave, que no vive en la
-- base— pero sí descarta el modo de falla que importa: que el valor
-- se haya truncado o reescrito.
-- ───────────────────────────────────────────────────────────────────

SELECT account_id,
       length(gps_password_encrypted) AS largo_del_secreto,
       gps_provider
  FROM carrier_profiles
 WHERE gps_password_encrypted IS NOT NULL;

-- El largo tiene que ser el mismo que antes del PASO 2. Si quieres la
-- comparación exacta, corre esta misma consulta con el nombre viejo
-- ANTES de aplicar y guarda el número.
--
-- La comprobación de verdad es la de arriba en la app: con el código
-- desplegado, `verificar-solo-lectura` y una corrida del recolector
-- tienen que resolver credencial. Hoy va a fallar igual por la cuenta
-- revocada de Umbrella, y ése es OTRO fallo — el mensaje lo distingue:
-- "No se obtuvo token" es credencial rechazada por el proveedor;
-- credencial ausente ni siquiera llega a pedir token.
