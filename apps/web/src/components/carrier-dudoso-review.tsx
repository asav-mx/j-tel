"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import {
  CarrierCandidateCompareMap,
  type CandidateTrack,
} from "@/components/carrier-candidate-compare-map";
import { CarrierDudosoLabelForm } from "@/components/carrier-dudoso-label-form";
import type { UnitSuggestion } from "@/lib/carrier-unit-suggestions";

export function CarrierDudosoReview({
  occurrenceId,
  accountSlug,
  units,
  suggestions,
  tracks,
  kmlWaypoints,
  geofence,
  existing,
}: {
  occurrenceId: string;
  accountSlug: string;
  units: Array<{ id: string; label: string }>;
  suggestions: UnitSuggestion[];
  tracks: CandidateTrack[];
  kmlWaypoints: Array<{ lat: number; lng: number }>;
  geofence: Array<{ lat: number; lng: number }>;
  existing?: {
    verdict: "cumplido" | "no_hecho";
    unitId: string | null;
    notes: string | null;
  } | null;
}) {
  const [focusUnitId, setFocusUnitId] = useState<string | null>(
    existing?.unitId ?? suggestions[0]?.unitId ?? null,
  );

  const trackCount = tracks.filter((t) => t.points.length >= 2).length;

  return (
    <div className="space-y-6">
      <Card title="Comparar sugerencias vs ruta esperada">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Morado punteado = KML esperado. Colores = GPS de las unidades sugeridas en la
          ventana del viaje. Toca una sugerencia para resaltarla en el mapa.
          {trackCount === 0
            ? " · Aún no hay trazos GPS guardados para estas unidades en este viaje."
            : ` · ${trackCount} historial${trackCount === 1 ? "" : "es"} con puntos.`}
        </p>
        {tracks.length > 0 ? (
          <ul className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-violet-300" />
              KML
            </li>
            {tracks.map((t) => (
              <li key={t.unitId} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-5 rounded-sm"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
                {t.points.length < 2 ? " (sin trazo)" : ""}
              </li>
            ))}
          </ul>
        ) : null}
        <CarrierCandidateCompareMap
          kmlWaypoints={kmlWaypoints}
          geofence={geofence}
          tracks={tracks}
          focusUnitId={focusUnitId}
        />
      </Card>

      <Card title="Etiqueta de calibración (carrier)">
        <CarrierDudosoLabelForm
          occurrenceId={occurrenceId}
          accountSlug={accountSlug}
          units={units}
          suggestions={suggestions}
          existing={existing}
          onUnitFocus={setFocusUnitId}
        />
      </Card>
    </div>
  );
}
