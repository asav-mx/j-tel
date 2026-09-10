-- Las credenciales GPS del carrier dejan de llamarse Umbrella.
--
-- Se aplica DESPUÉS de la 0033. **No crea ni borra datos**: son dos
-- `ALTER TABLE ... RENAME COLUMN`. Ningún valor cambia, ninguna fila se toca.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué el nombre importaba
-- ══════════════════════════════════════════════════════════════════════
--
-- `carrier_profiles.gps_provider` existe desde el día uno y ya decía que el
-- proveedor es una variable del carrier. Pero las dos columnas que guardan la
-- credencial se llamaban `umbrella_user_id` y `umbrella_password_encrypted`,
-- así que el esquema afirmaba dos cosas contradictorias: que el proveedor es
-- configurable, y que la credencial es de Umbrella.
--
-- Mientras hubo un solo proveedor eso no costó nada. Con el segundo entrando
-- —Traccar, por el corte de Umbrella del 5 de septiembre de 2026— el nombre
-- pasa a mentir en cada lectura: un carrier con `gps_provider = 'traccar'`
-- tendría su token guardado en una columna que dice Umbrella.
--
-- Es §D del Marco en el esquema en vez de en una pantalla: el valor es
-- correcto y lo falso lo pone el rótulo. Y el costo de arreglarlo sube con
-- cada mes que pasa, porque cada lectura nueva hereda el nombre viejo.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué RENAME y no columnas nuevas con copia
-- ══════════════════════════════════════════════════════════════════════
--
-- Porque la contraseña está CIFRADA, y copiar un secreto lo deja escrito en
-- dos lugares hasta que alguien se acuerde de borrar el viejo. Un `RENAME` no
-- duplica nada: el valor no se lee, no se descifra y no se vuelve a escribir.
--
-- El precio es que **no es compatible hacia atrás**: el código viejo pidiendo
-- `umbrella_user_id` deja de encontrar la columna. Por eso se aplica junto al
-- despliegue y no antes — ver la hoja en `docs/correcciones/`.
--
-- ══════════════════════════════════════════════════════════════════════
-- Lo que este renombre NO toca, a propósito
-- ══════════════════════════════════════════════════════════════════════
--
-- Las variables de ambiente `UMBRELLA_GPS_USERID` y `UMBRELLA_GPS_PASSWORD`,
-- que son el respaldo global de transición. Ésas sí son de Umbrella: son la
-- credencial de UN proveedor concreto, no el lugar donde vive la credencial
-- de un carrier cualquiera. Renombrarlas exige tocar el ambiente de Vercel y
-- es otro trabajo, con su propio riesgo de dejar el sistema sin credencial.

ALTER TABLE carrier_profiles RENAME COLUMN umbrella_user_id TO gps_user_id;
--> statement-breakpoint

ALTER TABLE carrier_profiles RENAME COLUMN umbrella_password_encrypted TO gps_password_encrypted;
--> statement-breakpoint

COMMENT ON COLUMN carrier_profiles.gps_user_id IS
  'Usuario o identidad con la que se entra al proveedor GPS de ESTE carrier. Cual proveedor lo dice gps_provider. Se llamaba umbrella_user_id hasta la 0034, y el nombre mentia en cuanto entro el segundo proveedor.';
--> statement-breakpoint

COMMENT ON COLUMN carrier_profiles.gps_password_encrypted IS
  'Secreto del proveedor GPS de ESTE carrier, cifrado. Para Umbrella es la contrasena; para Traccar puede ser la contrasena o un token de cuenta. Se descifra solo en getGpsCredentials.';
--> statement-breakpoint

COMMENT ON COLUMN carrier_profiles.gps_provider IS
  'Que proveedor GPS usa este carrier: umbrella, traccar. Gobierna buildProvider. El recolector y el archivador pasan los dos por aqui, asi que cambiar esta columna cambia de donde sale la evidencia de ese carrier.';
