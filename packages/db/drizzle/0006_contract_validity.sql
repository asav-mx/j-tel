ALTER TABLE "service_contracts" ADD COLUMN "valid_from" date;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD COLUMN "valid_to" date;--> statement-breakpoint
UPDATE "service_contracts"
SET
  "valid_from" = (timezone('UTC', "created_at"))::date,
  "valid_to" = ((timezone('UTC', "created_at"))::date + interval '1 year')::date
WHERE "valid_from" IS NULL OR "valid_to" IS NULL;--> statement-breakpoint
ALTER TABLE "service_contracts" ALTER COLUMN "valid_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_contracts" ALTER COLUMN "valid_to" SET NOT NULL;