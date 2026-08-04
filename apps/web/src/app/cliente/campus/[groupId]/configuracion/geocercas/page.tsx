import { resolveCampusUnitPage } from "@/lib/unit-context";
import { GeocercasUnitView } from "@/views/geocercas-unit";
import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // Va en la PÁGINA y no solo en el layout: un redirect de layout no
  // impide que la hija se renderice, y su payload viaja igual.
  await exigirRecurso("cliente", () => getRepos().procedencia.deCampus(groupId));

  const ctx = await resolveCampusUnitPage(groupId, searchParams);
  return <GeocercasUnitView ctx={ctx} searchParams={searchParams} />;
}
