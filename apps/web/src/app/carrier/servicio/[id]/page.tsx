import { NavBar } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { loadServiceDetail } from "@/lib/service-detail-data";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

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

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
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
      </div>
    </main>
  );
}
