import { getRepos } from "@/lib/db";
import { resolveAccountByType } from "@/lib/account-context";
import { plantHref } from "@/lib/navigation";
import { notFound, redirect } from "next/navigation";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/** Compatibilidad: /cliente/planta-MX07 → /cliente/planta/{uuid} */
export default async function LegacyPlantaRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Antes de resolver nada: esta ruta busca una planta por código, y eso ya es
  // leer la base. Sin sesión no se llega a preguntar.
  await exigirSesion();

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
