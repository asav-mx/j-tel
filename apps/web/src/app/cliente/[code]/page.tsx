import { getRepos } from "@/lib/db";
import { resolveAccountByType } from "@/lib/account-context";
import { plantHref } from "@/lib/navigation";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Compatibilidad: /cliente/planta-MX07 → /cliente/planta/{uuid} */
export default async function LegacyPlantaRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  if (!code.startsWith("planta-")) notFound();

  const plantCode = code.replace("planta-", "");
  const client = await resolveAccountByType("client", searchParams);
  if (!client) notFound();

  const repos = getRepos();
  const plant = await repos.clients.findPlantByCode(client.id, plantCode);
  if (!plant) notFound();

  redirect(plantHref(plant.id, client.slug));
}
