-- Migración A: aditiva — va ANTES del deploy del código.
-- Agrega compliance_fact_history y las columnas de actor en ledger (nullable).
-- actor_user_id se conserva; se elimina en Migración B después del deploy.

CREATE TABLE "compliance_fact_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_occurrence_id" uuid NOT NULL,
  "status" text NOT NULL,
  "timing" text,
  "fact_snapshot" jsonb NOT NULL,
  "replaced_by_fact_id" uuid REFERENCES "compliance_facts"("id") ON DELETE set null,
  "actor_kind" text NOT NULL,
  "actor_id" text,
  "replaced_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX cfh_occurrence_idx ON "compliance_fact_history" ("service_occurrence_id");
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "actor_kind" text;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "actor_id" text;
