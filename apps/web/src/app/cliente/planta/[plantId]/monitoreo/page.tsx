import { resolvePlantUnitPage } from "@/lib/unit-context";
import { MonitoreoUnitView } from "@/views/monitoreo-unit";

export const dynamic = "force-dynamic";

export default async function PlantMonitoreoPage({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const ctx = await resolvePlantUnitPage(plantId, searchParams);
  return <MonitoreoUnitView ctx={ctx} searchParams={searchParams} />;
}
