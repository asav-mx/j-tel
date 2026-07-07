CREATE TYPE "public"."account_type" AS ENUM('carrier', 'client', 'jstaff');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('cumplido', 'no_cumplido', 'pendiente_evidencia');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('draft', 'demo', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('disponible', 'parcial', 'en_espera', 'indisponible');--> statement-breakpoint
CREATE TYPE "public"."geofence_owner_type" AS ENUM('plant', 'carrier');--> statement-breakpoint
CREATE TYPE "public"."geofence_role" AS ENUM('destino', 'base', 'caseta', 'otro');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('pendiente', 'en_progreso', 'completada', 'requiere_accion');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('programado', 'en_progreso', 'completado', 'vencido');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('tarde', 'sin_evidencia', 'reporte_listo', 'requiere_revision', 'inspeccion');--> statement-breakpoint
CREATE TYPE "public"."route_strictness" AS ENUM('destino_only', 'kml_full');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('global', 'account', 'plant', 'plant_group', 'contract', 'fleet');--> statement-breakpoint
CREATE TYPE "public"."timing_status" AS ENUM('temprano', 'a_tiempo', 'tarde');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "account_type" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"clerk_org_id" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "carrier_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"umbrella_user_id" text,
	"umbrella_password_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carrier_profiles_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_occurrence_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"expected_deadline" timestamp with time zone NOT NULL,
	"expected_geofence_id" uuid NOT NULL,
	"reference_unit_id" uuid,
	"observed_unit_id" uuid,
	"observed_arrival_at" timestamp with time zone,
	"observed_route_match_pct" double precision,
	"status" "compliance_status" NOT NULL,
	"timing" "timing_status",
	"late_excusable" boolean DEFAULT false NOT NULL,
	"excusable_reason" text,
	"route_strictness_applied" "route_strictness" NOT NULL,
	"contract_policy_snapshot" jsonb NOT NULL,
	"materialized_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_facts_service_occurrence_id_unique" UNIQUE("service_occurrence_id")
);
--> statement-breakpoint
CREATE TABLE "demo_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"imei" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"device_id" uuid,
	"unit_id" uuid,
	"imei" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed" double precision,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"liters" double precision NOT NULL,
	"cost" double precision,
	"odometer_km" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "geofence_owner_type" NOT NULL,
	"owner_plant_id" uuid,
	"owner_carrier_account_id" uuid,
	"role" "geofence_role" NOT NULL,
	"name" text NOT NULL,
	"polygon" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"plant_id" uuid NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"status" "inspection_status" DEFAULT 'pendiente' NOT NULL,
	"notes" text,
	"inspected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"service_occurrence_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" "maintenance_status" DEFAULT 'programado' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plant_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"plant_group_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_shift_kml_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_shift_id" uuid NOT NULL,
	"kml_content" text NOT NULL,
	"waypoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"deadline_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"plant_id" uuid,
	"plant_group_id" uuid,
	"name" text NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"policy" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_profile_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"route_shift_id" uuid NOT NULL,
	"kml_version_id" uuid,
	"service_date" date NOT NULL,
	"expected_deadline" timestamp with time zone NOT NULL,
	"expected_geofence_id" uuid NOT NULL,
	"reference_unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_profile_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_profile_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"route_shift_id" uuid NOT NULL,
	"geofence_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reference_unit_id" uuid,
	"active_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_occurrence_id" uuid NOT NULL,
	"evidence_window_start" timestamp with time zone NOT NULL,
	"evidence_window_end" timestamp with time zone NOT NULL,
	"evidence_status" "evidence_status" DEFAULT 'en_espera' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_service_occurrence_id_unique" UNIQUE("service_occurrence_id")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_account_id" uuid NOT NULL,
	"label" text NOT NULL,
	"plate_number" text,
	"jrz_pass_driver_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carrier_profiles" ADD CONSTRAINT "carrier_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD CONSTRAINT "compliance_facts_service_occurrence_id_service_occurrences_id_fk" FOREIGN KEY ("service_occurrence_id") REFERENCES "public"."service_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD CONSTRAINT "compliance_facts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD CONSTRAINT "compliance_facts_expected_geofence_id_geofences_id_fk" FOREIGN KEY ("expected_geofence_id") REFERENCES "public"."geofences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD CONSTRAINT "compliance_facts_reference_unit_id_units_id_fk" FOREIGN KEY ("reference_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_facts" ADD CONSTRAINT "compliance_facts_observed_unit_id_units_id_fk" FOREIGN KEY ("observed_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_points" ADD CONSTRAINT "evidence_points_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_points" ADD CONSTRAINT "evidence_points_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_points" ADD CONSTRAINT "evidence_points_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_owner_plant_id_plants_id_fk" FOREIGN KEY ("owner_plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_owner_carrier_account_id_accounts_id_fk" FOREIGN KEY ("owner_carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_service_occurrence_id_service_occurrences_id_fk" FOREIGN KEY ("service_occurrence_id") REFERENCES "public"."service_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_groups" ADD CONSTRAINT "plant_groups_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shift_kml_versions" ADD CONSTRAINT "route_shift_kml_versions_route_shift_id_route_shifts_id_fk" FOREIGN KEY ("route_shift_id") REFERENCES "public"."route_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD CONSTRAINT "route_shifts_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD CONSTRAINT "route_shifts_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD CONSTRAINT "route_shifts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_service_profile_id_service_profiles_id_fk" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_route_shift_id_route_shifts_id_fk" FOREIGN KEY ("route_shift_id") REFERENCES "public"."route_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_kml_version_id_route_shift_kml_versions_id_fk" FOREIGN KEY ("kml_version_id") REFERENCES "public"."route_shift_kml_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_expected_geofence_id_geofences_id_fk" FOREIGN KEY ("expected_geofence_id") REFERENCES "public"."geofences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_reference_unit_id_units_id_fk" FOREIGN KEY ("reference_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profile_units" ADD CONSTRAINT "service_profile_units_service_profile_id_service_profiles_id_fk" FOREIGN KEY ("service_profile_id") REFERENCES "public"."service_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profile_units" ADD CONSTRAINT "service_profile_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_route_shift_id_route_shifts_id_fk" FOREIGN KEY ("route_shift_id") REFERENCES "public"."route_shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_geofence_id_geofences_id_fk" FOREIGN KEY ("geofence_id") REFERENCES "public"."geofences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_profiles" ADD CONSTRAINT "service_profiles_reference_unit_id_units_id_fk" FOREIGN KEY ("reference_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_client_account_id_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_service_occurrence_id_service_occurrences_id_fk" FOREIGN KEY ("service_occurrence_id") REFERENCES "public"."service_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_carrier_account_id_accounts_id_fk" FOREIGN KEY ("carrier_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_assignments_unit_valid_idx" ON "device_assignments" USING btree ("unit_id","valid_from");--> statement-breakpoint
CREATE INDEX "device_assignments_device_valid_idx" ON "device_assignments" USING btree ("device_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_carrier_imei_idx" ON "devices" USING btree ("carrier_account_id","imei");--> statement-breakpoint
CREATE INDEX "evidence_points_trip_idx" ON "evidence_points" USING btree ("trip_id","recorded_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_trip_idx" ON "ledger_entries" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_occurrence_idx" ON "ledger_entries" USING btree ("service_occurrence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "route_shifts_unique_idx" ON "route_shifts" USING btree ("route_id","shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_occurrences_unique_idx" ON "service_occurrences" USING btree ("service_profile_id","service_date");--> statement-breakpoint
CREATE INDEX "service_occurrences_deadline_idx" ON "service_occurrences" USING btree ("expected_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "service_profile_units_unique_idx" ON "service_profile_units" USING btree ("service_profile_id","unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_memberships_unique_idx" ON "user_memberships" USING btree ("account_id","clerk_user_id","role","scope_type","scope_id");