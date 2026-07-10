import { resolveCampusUnitPage } from "@/lib/unit-context";
import { ContratosUnitView } from "@/views/contratos-unit";

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
  return <ContratosUnitView ctx={ctx} searchParams={searchParams} />;
}
