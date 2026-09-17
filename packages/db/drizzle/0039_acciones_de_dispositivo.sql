-- Las acciones sobre un dispositivo (C4): quién, por qué, un solo lugar a la
-- vez, y el nombre que genera el sistema. ADITIVA.
--
-- Se aplica DESPUÉS de la 0038 y **ANTES de desplegar el código** que la lee:
-- la API relacional de Drizzle pide TODAS las columnas declaradas, y el código
-- nuevo contra una base sin ellas revienta en cada pantalla que lee
-- dispositivos o asignaciones (la lección de la 0016). Al revés no pasa nada.
--
-- Sin enums: todo corre en una sola transacción. El runbook está en
-- docs/correcciones/2026-09-17-aplicar-0039-acciones-de-dispositivo.sql, con la
-- lectura de ANTES que decide si se puede aplicar.
--
-- ══════════════════════════════════════════════════════════════════════
-- 1. Quién y por qué (decisión de Asav, 16 sep 2026)
-- ══════════════════════════════════════════════════════════════════════
--
-- Hasta hoy una asignación que terminaba no decía quién la cerró ni por qué, y
-- una baja no decía quién la dio. Las columnas nuevas son nulas en todo lo de
-- antes: lo cerraron guiones y hojas SQL, y escribirles un autor ahora sería
-- inventarlo. Null dice la verdad: «no quedó registrado».
--
-- El motivo de la asignación se escribe al CERRAR, como el de
-- `circuit_unit_assignments` (0027): al abrir todavía no hay nada que explicar.
-- Quién la abrió sí se guarda al abrir.
--
-- ══════════════════════════════════════════════════════════════════════
-- 2. Un dispositivo en una unidad, una unidad con un dispositivo
-- ══════════════════════════════════════════════════════════════════════
--
-- `assignDevice` ya cerraba lo abierto antes de abrir, pero sin transacción y
-- sin candado: dos clics simultáneos dejaban dos asignaciones vigentes, y el
-- archivador tomaría cualquiera de las dos para decidir de qué unidad es un
-- punto. La garantía la da la base, no el código de turno — la misma forma que
-- `circuit_unit_assignments_una_vigente`.
--
-- ⚠ LOS ÍNDICES ÚNICOS FALLAN SI YA HAY DUPLICADOS ABIERTOS. La flota los
-- acusa como anomalía (`unirDispositivosConUnidades`), así que no se supone
-- que haya cero: el PASO 1 del runbook los cuenta, y si no es cero se para.
--
-- Sin CONCURRENTLY: `device_assignments` es chica (cientos de filas) y sólo la
-- escriben humanos. El candado de construcción dura milisegundos y no detiene
-- la ingesta, que no escribe esta tabla.
--
-- ══════════════════════════════════════════════════════════════════════
-- 3. El consecutivo global (Marco 6.3)
-- ══════════════════════════════════════════════════════════════════════
--
-- «Marca + modelo + consecutivo global. Se asigna una vez y nunca se reutiliza
-- ni se renumera.» Una secuencia de Postgres es exactamente eso: no retrocede,
-- aunque la inserción que la pidió falle. Un hueco en la numeración es el
-- precio de que nunca se repita, y se paga.
--
-- La columna guarda el número; el nombre (`label`) lo escribe el código con el
-- prefijo del modelo. El índice único es la garantía de que dos dispositivos
-- nunca tengan el mismo número, aunque alguien escriba a mano.
--
-- Los ocho FTC927 de Compás ya se llaman `TK-FTC927-001` a `-008`, con nombre
-- tecleado conforme a 6.3. Se les rellena el número desde su nombre, y la
-- secuencia arranca después del mayor: el siguiente es el 009. Los de Umbrella
-- no tienen nombre de esa forma y se quedan sin número — no nacieron bajo 6.3.

ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS asignada_por text;
--> statement-breakpoint
ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS cerrada_por text;
--> statement-breakpoint
ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS motivo_cierre text;
--> statement-breakpoint
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_by text;
--> statement-breakpoint
ALTER TABLE devices ADD COLUMN IF NOT EXISTS consecutivo integer;
--> statement-breakpoint

UPDATE devices
   SET consecutivo = substring(label FROM '^TK-FTC927-([0-9]+)$')::integer
 WHERE label ~ '^TK-FTC927-[0-9]+$'
   AND consecutivo IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS devices_consecutivo_unico ON devices (consecutivo);
--> statement-breakpoint

CREATE SEQUENCE IF NOT EXISTS devices_consecutivo_seq AS integer MINVALUE 1;
--> statement-breakpoint

-- Con números: el siguiente nextval da max + 1. Sin ninguno: da 1.
SELECT setval(
  'devices_consecutivo_seq',
  COALESCE((SELECT max(consecutivo) FROM devices), 1),
  (SELECT max(consecutivo) FROM devices) IS NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_dispositivo_una_vigente
  ON device_assignments (device_id) WHERE valid_to IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_unidad_una_vigente
  ON device_assignments (unit_id) WHERE valid_to IS NULL;
--> statement-breakpoint

COMMENT ON COLUMN device_assignments.asignada_por IS
  'Quien asigno el dispositivo a la unidad (id de usuario). Nulo en lo anterior a la 0039: no quedo registrado.';
--> statement-breakpoint
COMMENT ON COLUMN device_assignments.cerrada_por IS
  'Quien cerro la asignacion: al soltar, al reasignar o al dar de baja (id de usuario). Nulo si la cerro un guion o si es anterior a la 0039.';
--> statement-breakpoint
COMMENT ON COLUMN device_assignments.motivo_cierre IS
  'Por que termino la asignacion. Lo escribe quien suelta; lo escribe el sistema cuando la cierra otra accion (reasignar, baja). Se escribe al cerrar, no al abrir (0039).';
--> statement-breakpoint
COMMENT ON COLUMN devices.retired_by IS
  'Quien dio de baja el dispositivo (id de usuario). Nulo en las bajas hechas por hoja SQL (0039).';
--> statement-breakpoint
COMMENT ON COLUMN devices.consecutivo IS
  'El consecutivo global del nombre (Marco 6.3): se asigna una vez con devices_consecutivo_seq y nunca se reutiliza. Nulo en los dispositivos que no nacieron con nombre generado (0039).';
