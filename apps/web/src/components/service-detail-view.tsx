import { Card, StatusBadge } from "@/components/ui";
import { ServiceEvidenceMap } from "@/components/service-evidence-map";
import type { ServiceDetailData } from "@/lib/service-detail-data";

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
}: {
  data: ServiceDetailData;
  backHref: string;
  backLabel: string;
  contractHref?: string;
  contractLabel?: string;
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={data.status} />
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
              <dt className="text-[var(--muted)]">Ventana GPS</dt>
              <dd className="text-right">
                {data.evidenceWindowStart && data.evidenceWindowEnd
                  ? `${formatDateTime(data.evidenceWindowStart)} → ${formatDateTime(data.evidenceWindowEnd)}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Márgenes</dt>
              <dd>
                {data.evidenceMarginBeforeMinutes != null &&
                data.evidenceMarginAfterMinutes != null
                  ? `−${data.evidenceMarginBeforeMinutes} / +${data.evidenceMarginAfterMinutes} min`
                  : "—"}
              </dd>
            </div>
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
              <dt className="text-[var(--muted)]">GPS unidad</dt>
              <dd className="text-right">
                {data.evidenceFirstAt && data.evidenceLastAt
                  ? `${formatDateTime(data.evidenceFirstAt)} → ${formatDateTime(data.evidenceLastAt)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6">
        <Card title={`Evidencia GPS (${data.pointCount} puntos)`}>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Estado de ingesta: {data.evidenceStatus ?? "—"}
            {data.pointCount === 0
              ? " · Aún no hay puntos de la unidad observada en este viaje."
              : " · Línea verde = recorrido de la unidad observada; área azul = geocerca; punto amarillo = llegada."}
          </p>
          <ServiceEvidenceMap
            points={data.mapPoints}
            geofence={data.geofencePolygon}
            arrival={data.arrivalPoint}
          />
        </Card>
      </div>

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
