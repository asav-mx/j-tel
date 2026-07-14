import { resolveCampusUnitPage } from "@/lib/unit-context";
import { MonitoreoUnitView } from "@/views/monitoreo-unit";

export const dynamic = "force-dynamic";

export default async function CampusMonitoreoPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const ctx = await resolveCampusUnitPage(groupId, searchParams);
  return <MonitoreoUnitView ctx={ctx} searchParams={searchParams} />;
}
