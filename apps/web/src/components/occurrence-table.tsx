import { computeEnforcement } from "@jtel/domain";
import { StatusBadge } from "@/components/ui";
import { withAccount } from "@/lib/account-context";

export type OccurrenceRow = {
  id: string;
  serviceDate: string;
  profileName: string;
  plantLabel: string;
  carrierLabel: string;
  clientLabel: string;
  status: string | null | undefined;
  enforcementLabel: string;
  detailHref: string;
};

type OccurrenceInput = {
  id: string;
  serviceDate: string;
  profile?: { name?: string | null } | null;
  complianceFact?: {
    status: "cumplido" | "no_cumplido" | "pendiente_evidencia";
    timing?: "temprano" | "a_tiempo" | "tarde" | null;
    lateExcusable: boolean;
    contractPolicySnapshot: import("@jtel/domain").ContractPolicy;
  } | null;
  contract?: {
    plant?: { name: string; code: string } | null;
    plantGroup?: { name: string } | null;
    carrier?: { name: string } | null;
    client?: { name: string } | null;
  } | null;
};

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
  const enforcement =
    fact
      ? computeEnforcement(
          fact.status,
          fact.timing ?? null,
          fact.lateExcusable,
          fact.contractPolicySnapshot,
        ).filter((e) => e.applies)
      : [];

  const plant = occ.contract?.plant;
  const plantGroup = occ.contract?.plantGroup;

  return {
    id: occ.id,
    serviceDate: occ.serviceDate,
    profileName: occ.profile?.name ?? "—",
    plantLabel: plant
      ? `${plant.name} (${plant.code})`
      : plantGroup
        ? `Grupo: ${plantGroup.name}`
        : "—",
    carrierLabel: showCarrier ? (occ.contract?.carrier?.name ?? "—") : "—",
    clientLabel: showClient ? (occ.contract?.client?.name ?? "—") : "—",
    status: fact?.status,
    enforcementLabel: enforcement[0]?.description ?? "—",
    detailHref: withAccount(`${detailPath}/${occ.id}`, accountSlug),
  };
}

export function OccurrenceTable({
  rows,
  showClient = false,
  showCarrier = true,
  showPlant = true,
  showEnforcement = true,
}: {
  rows: OccurrenceRow[];
  showClient?: boolean;
  showCarrier?: boolean;
  showPlant?: boolean;
  showEnforcement?: boolean;
}) {
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
            {showEnforcement ? <th className="py-2 pr-4">Enforcement</th> : null}
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
              <td className="py-3 pr-4">{row.profileName}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={row.status} />
              </td>
              {showEnforcement ? (
                <td className="py-3 pr-4 text-xs text-[var(--muted)]">{row.enforcementLabel}</td>
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
