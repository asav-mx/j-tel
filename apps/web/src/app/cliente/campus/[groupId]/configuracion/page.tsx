import { resolveCampusUnitPage } from "@/lib/unit-context";
import { UnitConfigHub } from "@/views/unit-config-hub";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const ctx = await resolveCampusUnitPage(groupId, searchParams);
  return <UnitConfigHub ctx={ctx} searchParams={searchParams} />;
}
