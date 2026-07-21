-- Variantes de trazado (multi-KML) por ruta.
--
-- Distinción clave (no confundir):
--   • VARIANTE = caminos alternos que COEXISTEN como válidos hoy
--     (ej. Riveras-B por MEX-45 o por la Panamericana).
--     Cada variante tiene nombre y estado (activa / legacy).
--   • VERSIÓN  = la historia temporal de UNA variante (route_kml_versions).
--     El trazado cambió → versión nueva; se juzga cada servicio con la
--     versión vigente en su fecha.
--
-- Migración: los trazados existentes se convierten en variante "Principal".

-- 1. Enums
CREATE TYPE "public"."variant_status" AS ENUM ('activa', 'legacy');
CREATE TYPE "public"."variant_origin" AS ENUM ('manual', 'promovida_de_viaje');

-- 2. Catálogo de variantes
CREATE TABLE "route_kml_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" "variant_status" NOT NULL DEFAULT 'activa',
  "origin" "variant_origin" NOT NULL DEFAULT 'manual',
  "origin_trip_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "route_kml_variants"
  ADD CONSTRAINT "route_kml_variants_route_id_routes_id_fk"
  FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "route_kml_variants"
  ADD CONSTRAINT "route_kml_variants_origin_trip_id_trips_id_fk"
  FOREIGN KEY ("origin_trip_id") REFERENCES "public"."trips"("id")
  ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "route_kml_variants_route_name_idx"
  ON "route_kml_variants" USING btree ("route_id", "name");

-- 3. Agregar variant_id a route_kml_versions (nullable para la migración de datos)
ALTER TABLE "route_kml_versions"
  ADD COLUMN "variant_id" uuid;

ALTER TABLE "route_kml_versions"
  ADD CONSTRAINT "route_kml_versions_variant_id_route_kml_variants_id_fk"
  FOREIGN KEY ("variant_id") REFERENCES "public"."route_kml_variants"("id")
  ON DELETE cascade ON UPDATE no action;

-- 4. Migración de datos: para cada ruta que tiene KML, crear variante "Principal"
--    y vincular las versiones existentes.
INSERT INTO "route_kml_variants" ("route_id", "name", "status", "origin")
  SELECT DISTINCT "route_id", 'Principal', 'activa', 'manual'
  FROM "route_kml_versions";

UPDATE "route_kml_versions" v
  SET "variant_id" = var."id"
  FROM "route_kml_variants" var
  WHERE var."route_id" = v."route_id"
    AND var."name" = 'Principal';

-- 5. Agregar served_variant_id a compliance_facts (nullable, hechos viejos quedan NULL)
ALTER TABLE "compliance_facts"
  ADD COLUMN "served_variant_id" uuid;

ALTER TABLE "compliance_facts"
  ADD CONSTRAINT "compliance_facts_served_variant_id_route_kml_variants_id_fk"
  FOREIGN KEY ("served_variant_id") REFERENCES "public"."route_kml_variants"("id")
  ON DELETE set null ON UPDATE no action;
