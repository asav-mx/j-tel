import { getRepos } from "@/lib/db";
import { resolveAccountByType } from "@/lib/account-context";
import type { OperationalScope, OperationalUnit } from "@jtel/domain";
import { notFound, redirect } from "next/navigation";
import { campusHref, plantHref } from "./unit-routes";

export type UnitPageContext = {
  client: { id: string; slug: string; name: string };
  unit: OperationalUnit;
  scope: OperationalScope;
};

export async function resolvePlantUnitPage(
  plantId: string,
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
): Promise<UnitPageContext> {
  const repos = getRepos();
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant) notFound();

  const client = await resolveAccountByType("client", searchParams);
  if (!client || client.id !== plant.clientAccountId) notFound();

  if (plant.plantGroupId) {
    redirect(campusHref(plant.plantGroupId, client.slug));
  }

  const unit: OperationalUnit = {
    kind: "plant",
    id: plant.id,
    name: plant.name,
    code: plant.code,
  };

  return {
    client,
    unit,
    scope: { kind: "plant", plantId: plant.id },
  };
}

export async function resolveCampusUnitPage(
  groupId: string,
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
): Promise<UnitPageContext> {
  const repos = getRepos();
  const group = await repos.clients.getPlantGroupById(groupId);
  if (!group) notFound();

  const client = await resolveAccountByType("client", searchParams);
  if (!client || client.id !== group.clientAccountId) notFound();

  const plants = await repos.clients.getPlantsForAccount(client.id);
  const memberPlants = plants
    .filter((p) => p.plantGroupId === group.id)
    .map((p) => ({ id: p.id, name: p.name, code: p.code }));

  const unit: OperationalUnit = {
    kind: "plant_group",
    id: group.id,
    name: group.name,
    memberPlants,
  };

  return {
    client,
    unit,
    scope: { kind: "plant_group", plantGroupId: group.id },
  };
}

/** Planta miembro de campus: vista limitada con enlace al campus. */
export async function resolvePlantMemberPage(
  plantId: string,
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
) {
  const repos = getRepos();
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant) notFound();

  const client = await resolveAccountByType("client", searchParams);
  if (!client || client.id !== plant.clientAccountId) notFound();

  if (!plant.plantGroupId) {
    return { kind: "independent" as const, ...(await resolvePlantUnitPage(plantId, searchParams)) };
  }

  const group = await repos.clients.getPlantGroupById(plant.plantGroupId);
  if (!group) notFound();

  return {
    kind: "member" as const,
    client,
    plant,
    campus: group,
    campusHref: campusHref(group.id, client.slug),
  };
}
