import { NavBar } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { loadServiceDetail } from "@/lib/service-detail-data";
import { withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function ClienteServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const accountSlug = typeof sp?.account === "string" ? sp.account : undefined;
  const data = await loadServiceDetail(id, { showEnforcement: true });

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <NavBar
          title={`Servicio ${data.serviceDate}`}
          links={[{ href: withAccount("/cliente/cumplimiento", accountSlug), label: "← Cumplimiento" }]}
        />
        <ServiceDetailView
          data={data}
          backHref={withAccount("/cliente/cumplimiento", accountSlug)}
          backLabel="← Volver a cumplimiento"
        />
      </div>
    </main>
  );
}
