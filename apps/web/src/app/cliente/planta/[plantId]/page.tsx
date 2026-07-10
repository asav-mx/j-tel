import { resolvePlantUnitPage } from "@/lib/unit-context";
import { UnitDashboard } from "@/components/unit-dashboard";

export const dynamic = "force-dynamic";

export default async function PlantaDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const ctx = await resolvePlantUnitPage(plantId, searchParams);
  return <UnitDashboard ctx={ctx} />;
}
