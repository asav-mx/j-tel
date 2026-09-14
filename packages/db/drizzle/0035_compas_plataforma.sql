-- Compás como conexión de plataforma, y los cuatro avisos del cotejo. ADITIVA.
--
-- Se aplica DESPUÉS de la 0034. No crea tablas, no borra datos y **no toca
-- ninguna fila**: cambia el valor por omisión de una columna y agrega cuatro
-- valores a un enum. Se puede aplicar antes o después de desplegar — ver la
-- hoja en `docs/correcciones/` para el orden completo, que sí incluye pasar las
-- dos cuentas de hoy a Compás.
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué cambia el valor por omisión
-- ══════════════════════════════════════════════════════════════════════
--
-- Hasta aquí una cuenta nueva nacía con `gps_provider = 'umbrella'`. Umbrella
-- cortó el 5 de septiembre de 2026 y es definitivo. El 14 de septiembre se creó
-- la cuenta asav para los aparatos de prueba: transmitían a Compás y J-Tel los
-- buscaba en Umbrella, sin un solo error visible. Costó una tarde encontrarlo.
--
-- `compas` significa «la conexión de plataforma»: Compás es el servidor de
-- J-Tel, así que su credencial vive en el ambiente y no en cada cuenta. Otro
-- proveedor sigue siendo posible —`traccar` con credencial propia, o
-- `umbrella`—; lo que cambia es con qué nace una cuenta.
--
-- El código ya escribe `compas` explícito al crear el perfil, así que el orden
-- entre desplegar y aplicar esto no deja cuentas ciegas. Esto es para que la
-- base no afirme otra cosa.
--
-- ══════════════════════════════════════════════════════════════════════
-- Los cuatro avisos
-- ══════════════════════════════════════════════════════════════════════
--
-- En cada minuto, el recolector compara lo que Compás conoce contra la tabla de
-- aparatos de J-Tel, y abre un aviso por cada desacuerdo:
--
--   aparato_sin_dueno        transmite a Compás y no es de ninguna cuenta
--   aparato_otro_proveedor   está en Compás, pero su cuenta lee de otro lado
--                            (el caso de asav)
--   aparato_fuera_de_compas  es de una cuenta en Compás, y Compás no lo tiene
--   imei_en_dos_cuentas      el mismo IMEI en dos cuentas: no se escribe en
--                            ninguna hasta que se aclare
--
-- ⚠ TRAMPA CONOCIDA (0025, 26 de agosto de 2026): un valor nuevo de enum NO SE
-- PUEDE USAR —ni leer con `enum_range`— en la transacción donde se agrega.
-- Postgres responde 55P04. Este archivo sólo los agrega. La comprobación va
-- DESPUÉS del COMMIT, en la hoja de `docs/correcciones/`.

ALTER TABLE carrier_profiles ALTER COLUMN gps_provider SET DEFAULT 'compas';
--> statement-breakpoint

COMMENT ON COLUMN carrier_profiles.gps_provider IS
  'Que proveedor GPS usa este carrier. compas: la conexion de plataforma a Compas, el Traccar de J-Tel, sin credencial en la cuenta (por omision desde la 0035). traccar: un Traccar ajeno con credencial propia. umbrella: el de antes del corte del 5 sep 2026.';
--> statement-breakpoint

ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_sin_dueno';
--> statement-breakpoint
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_otro_proveedor';
--> statement-breakpoint
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'aparato_fuera_de_compas';
--> statement-breakpoint
ALTER TYPE ingest_alert_kind ADD VALUE IF NOT EXISTS 'imei_en_dos_cuentas';
