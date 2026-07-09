CREATE TYPE "public"."client_carrier_authorization_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "client_carrier_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"status" "client_carrier_authorization_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "client_carrier_authorizations" ADD CONSTRAINT "client_carrier_authorizations_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_carrier_authorizations" ADD CONSTRAINT "client_carrier_authorizations_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_carrier_auth_unique_idx" ON "client_carrier_authorizations" USING btree ("client_account_id","carrier_account_id");--> statement-breakpoint
CREATE INDEX "client_carrier_auth_client_idx" ON "client_carrier_authorizations" USING btree ("client_account_id");--> statement-breakpoint
INSERT INTO "client_carrier_authorizations" ("client_account_id", "carrier_account_id", "status")
SELECT DISTINCT "client_account_id", "carrier_account_id", 'active'::"client_carrier_authorization_status"
FROM "service_contracts"
ON CONFLICT ("client_account_id", "carrier_account_id") DO NOTHING;
