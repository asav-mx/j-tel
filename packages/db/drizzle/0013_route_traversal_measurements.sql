-- Aditiva: tabla nueva, ninguna columna existente se toca. Se puede aplicar
-- antes del deploy del código sin romper nada — hasta que el motor empiece a
-- escribirla, queda vacía y la ventana se dimensiona con la geometría del KML.
--
-- Guarda cuánto duró de verdad cada recorrido de una ruta×turno. Es medición,
-- no veredicto: se escribe haya cumplido o no el servicio.

CREATE TABLE "route_traversal_measurements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_shift_id" uuid NOT NULL REFERENCES "route_shifts"("id") ON DELETE cascade,
  "service_occurrence_id" uuid NOT NULL UNIQUE REFERENCES "service_occurrences"("id") ON DELETE cascade,
  "service_date" date NOT NULL,
  "kml_version_id" uuid REFERENCES "route_kml_versions"("id") ON DELETE set null,
  "duration_minutes" double precision NOT NULL,
  "lower_bound" boolean DEFAULT false NOT NULL,
  "points_in_corridor" integer DEFAULT 0 NOT NULL,
  "unit_id" uuid REFERENCES "units"("id") ON DELETE set null,
  "measured_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "route_traversal_route_shift_date_idx" ON "route_traversal_measurements" ("route_shift_id", "service_date");
