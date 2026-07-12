import { NavBar, Card } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { CarrierDudosoLabelForm } from "@/components/carrier-dudoso-label-form";
import { loadServiceDetail } from "@/lib/service-detail-data";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CarrierServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin carrier.</p>
      </main>
    );
  }

  const data = await loadServiceDetail(id, {
    carrierAccountId: carrier.id,
    showEnforcement: false,
  });

  const repos = getRepos();
  const units = await repos.fleet.getUnitsForCarrier(carrier.id);
  const unitOptions = units.map((u) => ({
    id: u.id,
    label: `${u.label}${u.plateNumber ? ` (${u.plateNumber})` : ""}`,
  }));
  const existingGt = await repos.occurrenceGroundTruth.findByOccurrence(id);
  const showLabelForm = data.status === "no_cumplido";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <NavBar
          title={`Servicio ${data.serviceDate} — ${data.clientName}`}
          links={[
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "← Cumplimiento",
            },
          ]}
        />
        <ServiceDetailView
          data={data}
          backHref={withAccount("/carrier/cumplimiento", carrier.slug)}
          backLabel="← Volver a cumplimiento"
        />

        {showLabelForm ? (
          <Card title="Etiqueta de calibración (carrier)">
            <CarrierDudosoLabelForm
              occurrenceId={id}
              accountSlug={carrier.slug}
              units={unitOptions}
              existing={
                existingGt
                  ? {
                      verdict: existingGt.operatorVerdict,
                      unitId: existingGt.operatorUnitId,
                      notes: existingGt.notes,
                    }
                  : null
              }
            />
          </Card>
        ) : null}
      </div>
    </main>
  );
}
