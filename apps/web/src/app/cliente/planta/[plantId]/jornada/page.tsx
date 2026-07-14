import { resolvePlantUnitPage } from "@/lib/unit-context";
import { JornadaUnitView } from "@/views/jornada-unit";

export const dynamic = "force-dynamic";

export default async function PlantJornadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const ctx = await resolvePlantUnitPage(plantId, searchParams);
  return <JornadaUnitView ctx={ctx} searchParams={searchParams} />;
}
