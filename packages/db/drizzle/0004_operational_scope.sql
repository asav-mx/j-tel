ALTER TYPE "geofence_owner_type" ADD VALUE IF NOT EXISTS 'plant_group';--> statement-breakpoint
ALTER TABLE "routes" ALTER COLUMN "plant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "plant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "plant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "plant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_shifts" ALTER COLUMN "plant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD COLUMN "plant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "route_shifts" ADD CONSTRAINT "route_shifts_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD COLUMN "owner_plant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_owner_plant_group_id_plant_groups_id_fk" FOREIGN KEY ("owner_plant_group_id") REFERENCES "public"."plant_groups"("id") ON DELETE cascade ON UPDATE no action;
