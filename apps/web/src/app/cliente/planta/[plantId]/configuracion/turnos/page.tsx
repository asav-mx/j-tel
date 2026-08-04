import { resolvePlantUnitPage } from "@/lib/unit-context";
import { TurnosUnitView } from "@/views/turnos-unit";
import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // Va en la PÁGINA y no solo en el layout: un redirect de layout no
  // impide que la hija se renderice, y su payload viaja igual.
  await exigirRecurso(() => getRepos().procedencia.dePlanta(plantId));

  const ctx = await resolvePlantUnitPage(plantId, searchParams);
  return <TurnosUnitView ctx={ctx} searchParams={searchParams} />;
}
