import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { complianceHref } from "@/lib/navigation";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlantaPage({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const accountSlug = typeof sp?.account === "string" ? sp.account : undefined;
  const repos = getRepos();
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant) notFound();

  const client = accountSlug
    ? await repos.accounts.findBySlug(accountSlug)
    : await repos.accounts.findById(plant.clientAccountId);

  if (!client || client.type !== "client") notFound();

  const occurrences = await repos.occurrences.findForPlant(plantId);
  const rows = occurrences
    .slice(0, 40)
    .map((occ) => toOccurrenceRow(occ, "/cliente/servicio", client.slug, { showPlant: false }));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title={`${plant.name} (${plant.code})`}
          links={[
            { href: withAccount("/cliente", client.slug), label: "← Panel" },
            { href: complianceHref(client.slug, plantId), label: "Cumplimiento" },
            { href: withAccount("/cliente/plantas", client.slug), label: "Plantas" },
          ]}
        />

        <p className="mb-6 text-sm text-[var(--muted)]">
          Cliente: {client.name} · Alcance: solo esta planta.
        </p>

        <Card title="Servicios de la planta">
          <OccurrenceTable rows={rows} showPlant={false} showCarrier />
        </Card>
      </div>
    </main>
  );
}
