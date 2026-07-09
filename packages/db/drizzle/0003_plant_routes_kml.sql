-- Rutas/turnos por planta; KML en la ruta; deadline calculado desde turno + contrato.

ALTER TABLE "routes" ADD COLUMN "plant_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "plant_id" uuid;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD COLUMN "plant_id" uuid;--> statement-breakpoint

UPDATE "routes" r
SET "plant_id" = (
  SELECT p.id FROM "plants" p
  WHERE p.client_account_id = r.client_account_id
  ORDER BY p.name
  LIMIT 1
);--> statement-breakpoint

UPDATE "shifts" s
SET "plant_id" = (
  SELECT p.id FROM "plants" p
  WHERE p.client_account_id = s.client_account_id
  ORDER BY p.name
  LIMIT 1
);--> statement-breakpoint

UPDATE "route_shifts" rs
SET "plant_id" = (
  SELECT r.plant_id FROM "routes" r WHERE r.id = rs.route_id
);--> statement-breakpoint

ALTER TABLE "routes" ALTER COLUMN "plant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "plant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "route_shifts" ALTER COLUMN "plant_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "routes" ADD CONSTRAINT "routes_plant_id_plants_id_fk"
  FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_plant_id_plants_id_fk"
  FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD CONSTRAINT "route_shifts_plant_id_plants_id_fk"
  FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "route_kml_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL,
  "kml_content" text NOT NULL,
  "waypoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "valid_from" timestamp with time zone NOT NULL,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

INSERT INTO "route_kml_versions" ("id", "route_id", "kml_content", "waypoints", "valid_from", "valid_to", "created_at")
SELECT rskv."id", rs."route_id", rskv."kml_content", rskv."waypoints", rskv."valid_from", rskv."valid_to", rskv."created_at"
FROM "route_shift_kml_versions" rskv
JOIN "route_shifts" rs ON rs."id" = rskv."route_shift_id";--> statement-breakpoint

ALTER TABLE "service_occurrences" DROP CONSTRAINT IF EXISTS "service_occurrences_kml_version_id_route_shift_kml_versions_id_fk";--> statement-breakpoint
ALTER TABLE "route_kml_versions" ADD CONSTRAINT "route_kml_versions_route_id_routes_id_fk"
  FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_occurrences" ADD CONSTRAINT "service_occurrences_kml_version_id_route_kml_versions_id_fk"
  FOREIGN KEY ("kml_version_id") REFERENCES "public"."route_kml_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

DROP TABLE "route_shift_kml_versions";--> statement-breakpoint
ALTER TABLE "route_shifts" DROP COLUMN "deadline_time";
