import { ServiceDetailView } from "@/components/service-detail-view";
import { UnitShell } from "@/components/unit-shell";
import { loadServiceDetail } from "@/lib/service-detail-data";
import { getRepos } from "@/lib/db";
import { withAccount } from "@/lib/account-context";
import {
  unitComplianceHref,
  unitContratosHref,
} from "@/lib/unit-routes";
import type { OperationalUnit } from "@jtel/domain";
import { exigirRecurso } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function ClienteServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // «No existe» y «no es tuyo» contestan la misma 404.
  await exigirRecurso(() => getRepos().procedencia.deServicio(id));

  const sp = searchParams ? await searchParams : undefined;
  const accountSlug = typeof sp?.account === "string" ? sp.account : undefined;
  const data = await loadServiceDetail(id, { showEnforcement: true });

  // El recurso manda; `?account=` solo sobrevive como respaldo para pintar.
  const slug = data.clientSlug ?? accountSlug ?? undefined;
  const repos = getRepos();

  let unit: OperationalUnit | null = null;
  if (data.plantGroupId) {
    const group = await repos.clients.getPlantGroupById(data.plantGroupId);
    if (group) {
      const plants = await repos.clients.getPlantsForAccount(group.clientAccountId);
      unit = {
        kind: "plant_group",
        id: group.id,
        name: group.name,
        memberPlants: plants
          .filter((p) => p.plantGroupId === group.id)
          .map((p) => ({ id: p.id, name: p.name, code: p.code })),
      };
    }
  } else if (data.plantId) {
    const plant = await repos.clients.getPlantById(data.plantId);
    if (plant) {
      unit = {
        kind: "plant",
        id: plant.id,
        name: plant.name,
        code: plant.code,
      };
    }
  }

  const client = {
    slug: slug ?? data.clientSlug ?? "cliente",
    name: data.clientName,
  };

  const complianceHref = unit
    ? unitComplianceHref(unit, client.slug)
    : withAccount("/cliente/cumplimiento", client.slug);
  const contratosHref = unit
    ? unitContratosHref(unit, client.slug)
    : withAccount("/cliente/configuracion/contratos", client.slug);

  const detalle = (
    <ServiceDetailView
      data={data}
      backHref={complianceHref}
      backLabel="← Volver a cumplimiento"
      contractHref={contratosHref}
      contractLabel={`Ver contrato: ${data.contractName}`}
    />
  );

  /*
   * Sin unidad operativa resuelta no hay navegación que dibujar —el marco vive
   * de la unidad— pero el expediente sí se puede leer. Se sirve suelto en vez
   * de esconderlo: es el mismo criterio que ya seguía esta pantalla.
   */
  if (!unit) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">{detalle}</div>
      </main>
    );
  }

  return (
    <UnitShell client={client} unit={unit} title={`Servicio ${data.serviceDate}`}>
      {detalle}
    </UnitShell>
  );
}
