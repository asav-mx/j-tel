CREATE TYPE "public"."ingest_alert_kind" AS ENUM('heartbeat_stale', 'watermark_lag', 'archive_error', 'rate_limit');
--> statement-breakpoint
CREATE TABLE "ground_truth_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"expected_all_cumplido" boolean DEFAULT true NOT NULL,
	"declared_cumplido_count" integer,
	"notes" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid,
	"kind" "ingest_alert_kind" NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ground_truth_days" ADD CONSTRAINT "ground_truth_days_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ingest_alerts" ADD CONSTRAINT "ingest_alerts_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ground_truth_days_contract_date_idx" ON "ground_truth_days" USING btree ("contract_id","service_date");
--> statement-breakpoint
CREATE INDEX "ingest_alerts_carrier_created_idx" ON "ingest_alerts" USING btree ("carrier_account_id","created_at");
--> statement-breakpoint
CREATE INDEX "ingest_alerts_unresolved_idx" ON "ingest_alerts" USING btree ("resolved_at");
