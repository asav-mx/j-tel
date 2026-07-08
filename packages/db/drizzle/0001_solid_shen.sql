ALTER TABLE "carrier_profiles" ADD COLUMN "gps_provider" text DEFAULT 'umbrella' NOT NULL;--> statement-breakpoint
ALTER TABLE "carrier_profiles" ADD COLUMN "gps_base_url" text;