-- Módulo de choferes — las dos capas del Plan-Choferes. ADITIVA.
--
-- La decisión de la que todo lo demás depende: **los datos personales y la
-- historia viven separados a propósito.** Si fueran una sola cosa, borrar a un
-- chofer que se fue destruiría el acta de los servicios que cubrió; y
-- conservarlo todo para siempre violaría la protección de datos. La única
-- salida es que el hecho conserve el nombre congelado y las credenciales vivan
-- aparte, purgables.
--
-- Tres piezas:
--
-- 1. `drivers` — la identidad estable, NO purgable, y SIN un solo dato
--    personal. Es el ancla a la que se cuelgan asignaciones y hechos. El
--    identificador lo genera J-Telemetry: un número de nómina del transportista
--    puede repetirse, cambiar de dueño o morir con el sistema que lo emitió, y
--    nada de eso puede arrastrar la historia de un servicio sellado.
--
-- 2. `driver_credentials` — el expediente vivo, PURGABLE. Todo el dato personal
--    está aquí y solo aquí, en su propia tabla, para que purgarlo sea borrar
--    una fila y no editar columnas de media base. Alta mínima: nombre y
--    licencia; lo demás se llena después.
--
-- 3. Dos columnas en `compliance_facts` — el chofer CONGELADO dentro del hecho.
--    El nombre es texto plano, no una referencia: es la única forma de que la
--    historia sobreviva a la purga. `declared_driver_id` es comodidad para
--    enlazar mientras el chofer exista y por eso se anula al borrarlo; el
--    nombre nunca se anula.
--
-- Sin backfill, y no por pereza: no existe de dónde sacarlo. `jrz_pass_driver_id`
-- en `units` viene del sistema anterior y NO es la base de este módulo —
-- rellenar con él inventaría declaraciones que nadie hizo. Los hechos ya
-- sellados se quedan con el chofer nulo, que es la verdad: nadie lo declaró.
--
-- NADA del motor cambia con esta migración. Las columnas nacen nulas y nadie
-- las escribe todavía: sellar con el chofer declarado toca el camino del
-- árbitro y va aparte, con aprobación explícita.
--
-- Se aplica en UNA transacción (no lleva CONCURRENTLY).

CREATE TABLE "drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "carrier_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  -- La baja MARCA, no borra: los hechos que cubrió siguen siendo suyos.
  "deactivated_at" timestamptz,
  -- Deja constancia de que se purgó, sin conservar lo purgado.
  "credentials_purged_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX drivers_carrier_idx ON "drivers" ("carrier_account_id");
--> statement-breakpoint

CREATE TABLE "driver_credentials" (
  -- PK = FK: un expediente por chofer, y se va con él.
  "driver_id" uuid PRIMARY KEY REFERENCES "drivers"("id") ON DELETE cascade,
  -- Alta mínima. Lo único obligatorio.
  "full_name" text NOT NULL,
  "license_number" text NOT NULL,
  -- Todo lo de abajo es opcional a propósito: el transportista tiene que poder
  -- registrar a alguien en treinta segundos el día que lo contrata.
  "license_expires_on" date,
  "phone" text,
  "emergency_contact_name" text,
  "emergency_contact_phone" text,
  "photo_url" text,
  -- El número que el transportista ya usa. Comodidad suya, purgable como todo
  -- lo de esta tabla, y JAMÁS una llave.
  "carrier_payroll_number" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Un solo tipo de registro, no varios: `valid_to` nulo = fija; con rango = por
-- periodo. Las excepciones se SUPERPONEN y no cierran la fija — si el titular
-- falta un día y otro lo cubre, esa cobertura es un registro por periodo encima
-- de la fija, que no se cancela ni se parte. Por eso no hay columna de "tipo":
-- el rango ya lo dice, y quien lee resuelve por especificidad (el rango más
-- angosto que cubre el día gana). El modelo de cerrar-y-reabrir se descartó:
-- genera huecos y confusión sobre quién era titular.
CREATE TABLE "driver_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE cascade,
  "route_shift_id" uuid NOT NULL REFERENCES "route_shifts"("id") ON DELETE cascade,
  "valid_from" date NOT NULL,
  -- Nulo = fija, sin fecha de fin.
  "valid_to" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT driver_assignments_rango_valido CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);
--> statement-breakpoint
CREATE INDEX driver_assignments_driver_idx ON "driver_assignments" ("driver_id");
--> statement-breakpoint
CREATE INDEX driver_assignments_route_shift_idx ON "driver_assignments" ("route_shift_id", "valid_from");
--> statement-breakpoint

-- El chofer congelado dentro del hecho. Nulas en todo lo ya sellado.
ALTER TABLE "compliance_facts" ADD COLUMN "declared_driver_name" text;
--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD COLUMN "declared_driver_id" uuid REFERENCES "drivers"("id") ON DELETE set null;
