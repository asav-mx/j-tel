-- Historia de la política del contrato — ADITIVA, va antes del deploy del código.
--
-- Hoy `updatePolicy` sobrescribe `service_contracts.policy` y la versión
-- anterior se pierde. Los hechos sí guardan su historia (compliance_fact_history,
-- migración 0012); la política, que es la ley con la que se juzga, no tenía nada.
--
-- Una fila por EDICIÓN, con las dos fotos. Guardar el "después" además del
-- "antes" es redundante a propósito: hace cada fila verdadera por sí sola y
-- permite detectar un hueco en la cadena —si el `after` de una fila no coincide
-- con el `before` de la siguiente, alguien escribió la política sin registrar—
-- en vez de dibujar una historia falsa.
--
-- NADA del motor lee esta tabla. Cada hecho sigue congelando su propio
-- contract_policy_snapshot; esto es registro hacia adelante, no ley.
--
-- Sin backfill a propósito: los contratos que ya existen no tienen historia
-- previa, y rellenarla inventaría un actor y una fecha. La pantalla dice desde
-- cuándo hay registro.
--
-- Se aplica en UNA transacción (no lleva CONCURRENTLY).

CREATE TABLE "contract_policy_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contract_id" uuid NOT NULL REFERENCES "service_contracts"("id") ON DELETE cascade,
  "policy_before" jsonb NOT NULL,
  "policy_after" jsonb NOT NULL,
  -- Quién editó. Hasta que exista auth-rbac el sistema sabe que fue una
  -- persona pero no cuál: actor_id viaja vacío y la firma honesta es el rol.
  "actor_kind" text NOT NULL,
  "actor_id" text,
  -- Por qué. Opcional: no bloquea guardar, pero cuando está, vale más que el qué.
  "note" text,
  "changed_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX cph_contract_idx ON "contract_policy_history" ("contract_id", "changed_at" DESC);
