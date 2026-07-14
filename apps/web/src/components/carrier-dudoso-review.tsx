"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import {
  CarrierCandidateCompareMap,
  type CandidateTrack,
} from "@/components/carrier-candidate-compare-map";
import { CarrierDudosoLabelForm } from "@/components/carrier-dudoso-label-form";
import type { UnitSuggestion } from "@/lib/carrier-unit-suggestions";
import {
  clipTrackToRoute,
  downsampleMapPoints,
  type NamedGeofence,
} from "@/lib/map-evidence";

type TrackSource = {
  unitId: string;
  label: string;
  color: string;
  /** Trazo ya cortado en entrada a geocerca (si aplica). */
  points: Array<{ lat: number; lng: number; at: string }>;
  entry?: CandidateTrack["entry"];
};

export function CarrierDudosoReview({
  occurrenceId,
  accountSlug,
  units,
  suggestions,
  trackSources,
  kmlWaypoints,
  geofences,
  existing,
  calibrationWindowLabel,
}: {
  occurrenceId: string;
  accountSlug: string;
  units: Array<{ id: string; label: string }>;
  suggestions: UnitSuggestion[];
  trackSources: TrackSource[];
  kmlWaypoints: Array<{ lat: number; lng: number }>;
  geofences: NamedGeofence[];
  existing?: {
    verdict: "cumplido" | "no_hecho";
    unitId: string | null;
    notes: string | null;
  } | null;
  /** Ej. "10:40 → 12:40 (vista extendida…)" */
  calibrationWindowLabel: string;
}) {
  const [focusUnitId, setFocusUnitId] = useState<string | null>(
    existing?.unitId ?? suggestions[0]?.unitId ?? null,
  );
  const [fullRoute, setFullRoute] = useState(false);

  const tracks: CandidateTrack[] = useMemo(() => {
    return trackSources.map((src) => {
      const clipped = fullRoute
        ? src.points
        : clipTrackToRoute(src.points, kmlWaypoints);
      return {
        unitId: src.unitId,
        label: src.label,
        color: src.color,
        points: downsampleMapPoints(clipped, 350),
        entry: src.entry,
      };
    });
  }, [trackSources, kmlWaypoints, fullRoute]);

  const trackCount = tracks.filter((t) => t.points.length >= 2).length;

  return (
    <div className="space-y-6">
      <Card title="Comparar sugerencias vs ruta esperada">
        <p className="mb-2 text-sm text-amber-100/90">
          Vista extendida de calibración — no afecta el veredicto. Ventana:{" "}
          {calibrationWindowLabel}.
        </p>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Morado punteado = KML esperado. Polígonos con nombre = geocercas destino de
          contratos de este carrier. Colores = GPS de sugerencias. Toca una sugerencia
          para resaltarla.
          {trackCount === 0
            ? " · Aún no hay trazos GPS para estas unidades en la ventana."
            : ` · ${trackCount} historial${trackCount === 1 ? "" : "es"} con puntos.`}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFullRoute((v) => !v)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
          >
            {fullRoute ? "Ver solo cerca del KML" : "Recorrido completo"}
          </button>
          <span className="text-xs text-[var(--muted)]">
            {fullRoute
              ? "Mostrando trazo entero (hasta entrada a geocerca)."
              : "Mostrando trazo recortado al corredor KML."}
          </span>
        </div>

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
                {t.entry ? ` · → ${t.entry.geofenceName}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        <CarrierCandidateCompareMap
          kmlWaypoints={kmlWaypoints}
          geofences={geofences}
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
