ALTER TABLE "service_profiles" ADD COLUMN "code" text;
--> statement-breakpoint
UPDATE "service_profiles"
SET "code" = upper(
  trim(both '-' from regexp_replace(coalesce("name", 'SRV'), '[^a-zA-Z0-9]+', '-', 'g'))
);
--> statement-breakpoint
UPDATE "service_profiles" sp
SET "code" = sp."code" || '-' || upper(left(replace(sp."id"::text, '-', ''), 4))
WHERE sp."id" IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY code ORDER BY created_at, id) AS rn
    FROM service_profiles
  ) dups
  WHERE rn > 1
);
--> statement-breakpoint
ALTER TABLE "service_profiles" ALTER COLUMN "code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "service_profiles_code_unique_idx" ON "service_profiles" ("code");
