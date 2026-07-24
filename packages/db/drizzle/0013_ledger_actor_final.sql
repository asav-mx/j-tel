-- Migración B: tightening — va DESPUÉS del deploy del código.
-- En este punto todas las entradas nuevas de ledger ya tienen actor_kind;
-- las anteriores reciben la etiqueta 'system:legacy'.

UPDATE "ledger_entries" SET "actor_kind" = 'system:legacy' WHERE "actor_kind" IS NULL;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "actor_kind" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP COLUMN "actor_user_id";
