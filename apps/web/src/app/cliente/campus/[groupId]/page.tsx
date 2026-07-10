import { resolveCampusUnitPage } from "@/lib/unit-context";
import { UnitDashboard } from "@/components/unit-dashboard";

export const dynamic = "force-dynamic";

export default async function CampusDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const ctx = await resolveCampusUnitPage(groupId, searchParams);
  return <UnitDashboard ctx={ctx} />;
}
