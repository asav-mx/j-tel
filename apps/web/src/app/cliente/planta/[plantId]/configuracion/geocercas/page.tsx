import { resolvePlantUnitPage } from "@/lib/unit-context";
import { GeocercasUnitView } from "@/views/geocercas-unit";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const ctx = await resolvePlantUnitPage(plantId, searchParams);
  return <GeocercasUnitView ctx={ctx} searchParams={searchParams} />;
}
