import { resolvePlantUnitPage } from "@/lib/unit-context";
import { UnitConfigHub } from "@/views/unit-config-hub";

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
  return <UnitConfigHub ctx={ctx} searchParams={searchParams} />;
}
