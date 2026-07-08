CREATE TABLE "telemetry_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"device_id" uuid,
	"unit_id" uuid,
	"imei" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'umbrella' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_watermarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"last_recorded_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telemetry_points" ADD CONSTRAINT "telemetry_points_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_points" ADD CONSTRAINT "telemetry_points_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_points" ADD CONSTRAINT "telemetry_points_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_watermarks" ADD CONSTRAINT "telemetry_watermarks_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telemetry_points_imei_recorded_idx" ON "telemetry_points" USING btree ("imei","recorded_at");--> statement-breakpoint
CREATE INDEX "telemetry_points_carrier_recorded_idx" ON "telemetry_points" USING btree ("carrier_account_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "telemetry_watermarks_carrier_idx" ON "telemetry_watermarks" USING btree ("carrier_account_id");