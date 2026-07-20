import { StatusBadge } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import { noCumplidoDetailLine } from "@/lib/no-cumplido-motivo";

export type OccurrenceRow = {
  id: string;
  serviceDate: string;
  profileName: string;
  profileCode: string | null;
  plantLabel: string;
  carrierLabel: string;
  clientLabel: string;
  status: string | null | undefined;
  timing: string | null | undefined;
  observedUnitLabel: string;
  /** Línea de motivo bajo el chip no_cumplido (solo lectura del hecho). */
  motivo: string | null;
  detailHref: string;
};

type OccurrenceInput = {
  id: string;
  serviceDate: string;
  expectedDeadline?: Date | null;
  profile?: { name?: string | null; code?: string | null } | null;
  complianceFact?: {
    status: "cumplido" | "no_cumplido" | "pendiente_evidencia";
    timing?: "temprano" | "a_tiempo" | "tarde" | null;
    observedUnitId?: string | null;
    observedArrivalAt?: Date | null;
    observedUnit?: { label?: string | null; plateNumber?: string | null } | null;
  } | null;
  contract?: {
    plant?: { name: string; code: string } | null;
    plantGroup?: { name: string } | null;
    carrier?: { name: string } | null;
    client?: { name: string } | null;
  } | null;
};

function formatObservedUnit(
  fact: OccurrenceInput["complianceFact"],
): string {
  if (!fact) return "—";
  const unit = fact.observedUnit;
  if (!unit?.label) return "—";
  return unit.plateNumber ? `${unit.label} · ${unit.plateNumber}` : unit.label;
}

export function toOccurrenceRow(
  occ: OccurrenceInput,
  detailPath: string,
  accountSlug?: string | null,
  options: { showClient?: boolean; showCarrier?: boolean; showPlant?: boolean } = {},
): OccurrenceRow {
  const showClient = options.showClient ?? false;
  const showCarrier = options.showCarrier ?? true;
  const showPlant = options.showPlant ?? true;

  const fact = occ.complianceFact;
  const plant = occ.contract?.plant;
  const plantGroup = occ.contract?.plantGroup;

  return {
    id: occ.id,
    serviceDate: occ.serviceDate,
    profileName: occ.profile?.name ?? "—",
    profileCode: occ.profile?.code ?? null,
    plantLabel: plant
      ? `${plant.name} (${plant.code})`
      : plantGroup
        ? `Grupo: ${plantGroup.name}`
        : "—",
    carrierLabel: showCarrier ? (occ.contract?.carrier?.name ?? "—") : "—",
    clientLabel: showClient ? (occ.contract?.client?.name ?? "—") : "—",
    status: fact?.status,
    timing: fact?.timing ?? null,
    observedUnitLabel: formatObservedUnit(fact),
    motivo: noCumplidoDetailLine({
      status: fact?.status,
      timing: fact?.timing,
      observedUnitId: fact?.observedUnitId,
      observedArrivalAt: fact?.observedArrivalAt,
      expectedDeadline: occ.expectedDeadline,
      observedUnitLabel: formatObservedUnit(fact),
    }),
    detailHref: withAccount(`${detailPath}/${occ.id}`, accountSlug),
  };
}

export function OccurrenceTable({
  rows,
  showClient = false,
  showCarrier = true,
  showPlant = true,
  showEnforcement,
  showObservedUnit,
  showMotivo = false,
}: {
  rows: OccurrenceRow[];
  showClient?: boolean;
  showCarrier?: boolean;
  showPlant?: boolean;
  /** @deprecated alias de showObservedUnit */
  showEnforcement?: boolean;
  showObservedUnit?: boolean;
  /** Mostrar línea de motivo bajo el chip no_cumplido (planta y carrier). */
  showMotivo?: boolean;
}) {
  const showUnit = showObservedUnit ?? showEnforcement ?? true;
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Sin servicios en este alcance.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[var(--muted)]">
            <th className="py-2 pr-4">Fecha</th>
            {showPlant ? <th className="py-2 pr-4">Planta</th> : null}
            {showClient ? <th className="py-2 pr-4">Cliente</th> : null}
            {showCarrier ? <th className="py-2 pr-4">Carrier</th> : null}
            <th className="py-2 pr-4">Servicio</th>
            <th className="py-2 pr-4">Estado</th>
            {showUnit ? <th className="py-2 pr-4">Unidad observada</th> : null}
            <th className="py-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-white/5">
              <td className="py-3 pr-4">{row.serviceDate}</td>
              {showPlant ? <td className="py-3 pr-4">{row.plantLabel}</td> : null}
              {showClient ? <td className="py-3 pr-4">{row.clientLabel}</td> : null}
              {showCarrier ? <td className="py-3 pr-4">{row.carrierLabel}</td> : null}
              <td className="py-3 pr-4">
                {row.profileCode ? (
                  <span className="mr-2 font-mono text-xs text-[var(--accent)]">{row.profileCode}</span>
                ) : null}
                {row.profileName}
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={row.status} timing={row.timing} />
                {showMotivo && row.motivo ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">{row.motivo}</p>
                ) : null}
              </td>
              {showUnit ? (
                <td className="py-3 pr-4 text-sm">{row.observedUnitLabel}</td>
              ) : null}
              <td className="py-3">
                <a href={row.detailHref} className="text-[var(--accent)]">
                  Ver
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
