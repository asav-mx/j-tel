import { Card, StatusBadge } from "@/components/ui";
import { ServiceEvidenceMap } from "@/components/service-evidence-map";
import type { ServiceDetailData } from "@/lib/service-detail-data";
import { noCumplidoDetailLine } from "@/lib/no-cumplido-motivo";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const timingLabels: Record<string, string> = {
  temprano: "Temprano",
  a_tiempo: "A tiempo",
  tarde: "Tarde",
};

export function ServiceDetailView({
  data,
  backHref,
  backLabel,
  contractHref,
  contractLabel,
  hideEvidenceMap = false,
}: {
  data: ServiceDetailData;
  backHref: string;
  backLabel: string;
  contractHref?: string;
  contractLabel?: string;
  /** Carrier dudosos: el mapa de comparación vive fuera. */
  hideEvidenceMap?: boolean;
}) {
  const noCumplidoDetalle = noCumplidoDetailLine({
    status: data.status,
    timing: data.timing,
    observedUnitId: data.observedUnitId,
    observedArrivalAt: data.observedArrivalAt,
    expectedDeadline: data.expectedDeadline,
    observedUnitLabel:
      data.observedUnitLabel && data.observedUnitLabel !== "—"
        ? data.observedUnitLabel
        : null,
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <StatusBadge status={data.status} timing={data.timing} />
          {noCumplidoDetalle ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{noCumplidoDetalle}</p>
          ) : null}
        </div>
        <span className="text-sm text-[var(--muted)]">
          {data.clientName}
          {data.plantName ? ` · ${data.plantName}` : ""} · {data.carrierName}
        </span>
      </div>

      <p className="mb-6 text-sm text-[var(--muted)]">
        {data.profileName} · Deadline {formatDateTime(data.expectedDeadline)}
        {contractHref ? (
          <>
            {" · "}
            <a href={contractHref} className="text-[var(--accent)] hover:underline">
              {contractLabel ?? "Ver contrato"}
            </a>
          </>
        ) : null}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Esperado">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Deadline</dt>
              <dd>{formatDateTime(data.expectedDeadline)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Tolerancia</dt>
              <dd>
                {data.toleranceMinutes != null ? `±${data.toleranceMinutes} min` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Ventana (política)</dt>
              <dd className="text-right">
                {data.policyWindowStart && data.policyWindowEnd
                  ? `${formatDateTime(data.policyWindowStart)} → ${formatDateTime(data.policyWindowEnd)}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Márgenes</dt>
              <dd className="text-right">
                {data.evidenceMarginBeforeMinutes != null
                  ? `−${data.evidenceMarginBeforeMinutes} · gracia ${data.verificationGraceMinutes ?? 0} · después ${data.evidenceMarginAfterMinutes ?? 0}`
                  : "—"}
              </dd>
            </div>
            {data.tripWindowDiffersFromPolicy &&
            data.tripWindowStart &&
            data.tripWindowEnd ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Ventana usada en este viaje</dt>
                <dd className="text-right text-amber-200/90">
                  {formatDateTime(data.tripWindowStart)} → {formatDateTime(data.tripWindowEnd)}
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Congelada al generar el servicio (antes de tu cambio de política).
                  </span>
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Unidad referencia</dt>
              <dd>{data.referenceUnitLabel}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Observado">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Unidad</dt>
              <dd>{data.observedUnitLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Llegada</dt>
              <dd>{formatDateTime(data.observedArrivalAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Puntualidad</dt>
              <dd>{data.timing ? (timingLabels[data.timing] ?? data.timing) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">GPS en ruta</dt>
              <dd className="text-right">
                {data.evidenceFirstAt && data.evidenceLastAt
                  ? `${formatDateTime(data.evidenceFirstAt)} → ${formatDateTime(data.evidenceLastAt)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {!hideEvidenceMap ? (
        <div className="mt-6">
          <Card title={`Evidencia GPS (${data.pointCount} puntos en ruta)`}>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {data.fleetHiddenForClient ? (
                // Cara cliente sin unidad observada: mensaje honesto sin revelar flota.
                <>
                  El sistema no identificó una unidad sirviendo esta ruta en la ventana.
                  Se muestra el trazado esperado y la geocerca destino como referencia.
                </>
              ) : (
                <>
                  Estado de ingesta: {data.evidenceStatus ?? "—"}
                  {data.evidenceMapMode === "trip_fleet"
                    ? " · Sin unidad observada: se muestra la evidencia ingerida del viaje (flota en ventana) para diagnosticar."
                    : null}
                  {data.evidenceMapMode === "observed_unit" &&
                  data.unitPointsInWindow > data.pointCount
                    ? ` · ${data.unitPointsInWindow} pts en ventana del contrato; se muestran solo los del corredor KML / llegada.`
                    : null}
                  {data.pointCount === 0
                    ? data.tripEvidencePointCount === 0
                      ? " · No hay puntos GPS ingeridos en este viaje."
                      : " · Hay puntos ingeridos, pero ninguno queda en el corredor de la ruta / llegada."
                    : " · Verde = GPS observado; morado punteado = KML esperado; azul = geocerca; amarillo = llegada."}
                </>
              )}
            </p>
            <ServiceEvidenceMap
              points={data.mapPoints}
              geofence={data.geofencePolygon}
              arrival={data.arrivalPoint}
              kmlWaypoints={data.kmlWaypoints}
            />
          </Card>
        </div>
      ) : null}

      {data.showEnforcement && data.enforcement.length > 0 ? (
        <div className="mt-6">
          <Card title="Consecuencias (enforcement)">
            <ul className="space-y-2 text-sm">
              {data.enforcement.map((e, i) => (
                <li key={i} className={e.applies ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
                  {e.description}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <details className="mt-6 rounded-xl border border-white/10 bg-[var(--card)] p-5">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--muted)]">
          Bitácora técnica (auditoría)
        </summary>
        <pre className="mt-3 overflow-x-auto text-xs text-[var(--muted)]">
          {JSON.stringify(data.ledger, null, 2)}
        </pre>
      </details>

      <p className="mt-6 flex flex-wrap gap-4">
        <a href={backHref} className="text-sm text-[var(--accent)]">
          {backLabel}
        </a>
        {contractHref ? (
          <a href={contractHref} className="text-sm text-[var(--accent)]">
            {contractLabel ?? "Ver contrato"}
          </a>
        ) : null}
      </p>
    </>
  );
}
