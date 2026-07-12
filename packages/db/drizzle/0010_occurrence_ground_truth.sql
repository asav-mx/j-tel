CREATE TYPE "public"."occurrence_gt_verdict" AS ENUM('cumplido', 'no_hecho');
--> statement-breakpoint
CREATE TABLE "occurrence_ground_truth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"operator_verdict" "occurrence_gt_verdict" NOT NULL,
	"operator_unit_id" uuid,
	"primary_cause" text,
	"notes" text,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "occurrence_ground_truth" ADD CONSTRAINT "occurrence_ground_truth_occurrence_id_service_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."service_occurrences"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "occurrence_ground_truth" ADD CONSTRAINT "occurrence_ground_truth_operator_unit_id_units_id_fk" FOREIGN KEY ("operator_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "occurrence_ground_truth_occurrence_idx" ON "occurrence_ground_truth" USING btree ("occurrence_id");
