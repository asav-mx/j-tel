-- Reconciliación · dónde el transportista pone su versión — ADITIVA.
--
-- Se aplica DESPUÉS de la 0021. Una tabla nueva y su enum. Sin tocar ninguna
-- tabla existente, sin backfill, en transacción, sin CONCURRENTLY.
--
-- ## Qué resuelve
--
-- Hoy el árbitro dice «no pude» y ahí se acaba. El transportista mira una
-- acusación que **el sistema mismo admite no poder sostener** y no puede aportar
-- una sola cosa: ni qué unidad fue, ni que el GPS venía fallando, ni un cierre
-- vial, ni la bitácora del chofer.
--
-- Medido el 13 de agosto de 2026: **1 326 hechos sellados**, de los cuales
-- **608 `no_cumplido` sin unidad acreditada** y **154 `pendiente_evidencia`**.
-- Ninguno tiene dónde poner la versión del auditado.
--
-- Ficha: `docs/marco-limpio/Ficha-Reconciliacion.md`.
--
-- ## Las dos leyes que la forma de esta tabla hace cumplir
--
-- **1 · El transportista agrega CONTEXTO. Nunca cambia su veredicto.**
--
-- Por eso esta tabla **no tiene una sola columna que pueda alterar un hecho**:
-- no referencia `compliance_facts`, no guarda estado de cumplimiento, no toca
-- `observed_unit_id`. Cuelga de la OCURRENCIA, que es el servicio, no el
-- veredicto. Si algún día alguien quiere que una aportación mueva el resultado,
-- **va a tener que escribir una migración nueva y mirarse en el espejo** — que
-- es exactamente la fricción que se busca. Si el auditado pudiera cambiar su
-- calificación, J-Tel deja de ser árbitro.
--
-- **2 · La planta decide si eso mueve algo.**
--
-- De ahí `estado` y las tres columnas de resolución. El sistema **no arbitra**
-- la reconciliación: la registra, la enruta y deja constancia de quién decidió
-- qué y cuándo. ⚠ Y `resuelta` NO significa «aceptada»: significa que la planta
-- contestó. Qué consecuencia tiene eso es enforcement, y está sin decidir.
--
-- ## Lo que NO lleva, y por qué
--
-- · **Ningún borrado.** Retirar una aportación es un ESTADO (`retirada`), no un
--   DELETE: lo que se dijo se dijo, y una reconciliación que se puede borrar no
--   sirve para reconciliar nada. Sin `ON DELETE CASCADE` hacia arriba tampoco:
--   si se borra la ocurrencia, la aportación cae con ella y eso sí es correcto.
-- · **Ningún catálogo de motivos propio.** `motivo` guarda el código del
--   excusable que **la política del contrato ya define** —hoy 6 en un contrato y
--   5 en el otro—, y se valida contra ella al escribir, no aquí. Un catálogo en
--   la base sería un segundo lugar donde vive la misma lista, y las dos se
--   separarían el primer mes.
-- · **Ninguna columna de archivo binario.** `adjuntos` guarda referencias; dónde
--   viven los archivos es otra decisión y otra migración.
--
-- ## Por qué tabla nueva y no `occurrence_ground_truth`
--
-- Aquélla guarda el veredicto del **OPERADOR** —J-Staff etiquetando dudosos— y
-- ésta la versión del **TRANSPORTISTA**. Misma forma, otra voz. Meterlas en la
-- misma tabla sería C20 otra vez: dos cosas distintas con un nombre que las
-- suma, y cualquier conteo futuro las mezclaría sin avisar.
--
-- ## Foto de ANTES — 2026-08-13, con jtel_readonly
--
--   hechos sellados ....................... 1326
--   ocurrencias ........................... 2468
--   occurrence_ground_truth (otra voz) .... 5
--   tablas en public ...................... 42
--   carrier_aportaciones existe ........... false
--
-- ## Verificación DESPUÉS — con jtel_readonly, no con el dueño
--
--   -- 1. La tabla quedó como se pidió.
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='carrier_aportaciones'
--    ORDER BY ordinal_position;
--
--   -- 2. Y NO tiene forma de tocar un veredicto: cero referencias a
--   --    compliance_facts. Si algún día esto devuelve una fila, la ley 1 se
--   --    rompió en una migración.
--   SELECT count(*) AS referencias_a_hechos
--     FROM information_schema.constraint_column_usage ccu
--     JOIN information_schema.table_constraints tc
--       ON tc.constraint_name = ccu.constraint_name
--    WHERE tc.table_name = 'carrier_aportaciones'
--      AND tc.constraint_type = 'FOREIGN KEY'
--      AND ccu.table_name = 'compliance_facts';
--   -- Espera: 0
--
--   -- 3. Los conteos no se movieron. Una aditiva que mueve un conteo no lo es.
--   SELECT (SELECT count(*) FROM compliance_facts)     AS hechos,       -- 1326
--          (SELECT count(*) FROM service_occurrences)  AS ocurrencias,  -- 2468
--          (SELECT count(*) FROM information_schema.tables
--            WHERE table_schema='public')              AS tablas;       -- 43
--
--   -- 4. Nace vacía. No hay backfill que valga: nadie aportó nada todavía.
--   SELECT count(*) AS aportaciones FROM carrier_aportaciones;  -- 0
--
--   -- 5. Que el usuario de solo lectura la vea (hereda, pero se comprueba).
--   SELECT has_table_privilege('jtel_readonly','public.carrier_aportaciones','SELECT');

CREATE TYPE "aportacion_estado" AS ENUM ('enviada', 'vista', 'resuelta', 'retirada');
--> statement-breakpoint
CREATE TABLE "carrier_aportaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Cuelga del SERVICIO, no del veredicto. Ver ley 1 en el encabezado.
  "service_occurrence_id" uuid NOT NULL
    REFERENCES "service_occurrences"("id") ON DELETE cascade,
  "carrier_account_id" uuid NOT NULL
    REFERENCES "accounts"("id") ON DELETE cascade,
  -- Código del excusable que la política del contrato ya define. Nullable: se
  -- puede aportar contexto sin que ninguno de la lista aplique.
  "motivo" text,
  "nota" text,
  -- La unidad que el TRANSPORTISTA dice que fue. No acredita nada: es su dicho.
  "declared_unit_id" uuid REFERENCES "units"("id") ON DELETE set null,
  -- Referencias a archivos. Dónde viven es otra decisión y otra migración.
  "adjuntos" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "estado" "aportacion_estado" NOT NULL DEFAULT 'enviada',
  -- Quién firma. Sin firma no sirve para reconciliar nada.
  "actor_kind" text NOT NULL,
  "actor_id" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  -- La respuesta de la planta. `resuelta` = contestó, NO = aceptó.
  "resuelta_por_kind" text,
  "resuelta_por_id" text,
  "resuelta_at" timestamptz,
  "resolucion_nota" text
);
--> statement-breakpoint
CREATE INDEX "carrier_aportaciones_occurrence_idx"
  ON "carrier_aportaciones" ("service_occurrence_id", "created_at");
--> statement-breakpoint
CREATE INDEX "carrier_aportaciones_carrier_idx"
  ON "carrier_aportaciones" ("carrier_account_id", "estado");
--> statement-breakpoint
COMMENT ON TABLE "carrier_aportaciones" IS
  'La version del transportista sobre un servicio. Agrega CONTEXTO y nunca cambia un veredicto: no referencia compliance_facts a proposito. Retirar es un estado, no un DELETE.';
