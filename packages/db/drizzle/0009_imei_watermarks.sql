CREATE TABLE "telemetry_imei_watermarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"imei" text NOT NULL,
	"last_recorded_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telemetry_imei_watermarks" ADD CONSTRAINT "telemetry_imei_watermarks_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "telemetry_imei_watermarks_carrier_imei_idx" ON "telemetry_imei_watermarks" USING btree ("carrier_account_id","imei");
