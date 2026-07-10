import { resolvePlantUnitPage } from "@/lib/unit-context";
import { ContratosUnitView } from "@/views/contratos-unit";

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
  return <ContratosUnitView ctx={ctx} searchParams={searchParams} />;
}
