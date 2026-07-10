import { resolveCampusUnitPage } from "@/lib/unit-context";
import { ServiciosUnitView } from "@/views/servicios-unit";

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
  return <ServiciosUnitView ctx={ctx} searchParams={searchParams} />;
}
