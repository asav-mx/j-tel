import { getRepos } from "@/lib/db";
import { formStr, slugify } from "@/lib/form";
import { redirectWithParams } from "@/lib/redirect";

function backToPlantas(request: Request, slug: string, params: Record<string, string>) {
  return redirectWithParams(request, "/cliente/plantas", { account: slug, ...params });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = formStr(formData, "clientSlug");
  const action = String(formData.get("action") ?? "plant");

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);

  if (!client || client.type !== "client") {
    return redirectWithParams(request, "/cliente/plantas", { error: "Cliente no encontrado." });
  }

  if (action === "group") {
    const name = formStr(formData, "groupName");
    if (!name) {
      return backToPlantas(request, client.slug, {
        error: "El nombre del grupo es obligatorio.",
      });
    }
    await repos.clients.createPlantGroup(client.id, name);
    return backToPlantas(request, client.slug, { created: "grupo" });
  }

  if (action === "update") {
    const plantId = formStr(formData, "plantId");
    const plant = plantId ? await repos.clients.getPlantById(plantId) : null;
    if (!plant || plant.clientAccountId !== client.id) {
      return backToPlantas(request, client.slug, { error: "Planta no encontrada." });
    }

    const name = formStr(formData, "name");
    const rawGroup = formStr(formData, "plantGroupId");
    const plantGroupId = rawGroup.length > 0 ? rawGroup : null;

    await repos.clients.updatePlant(plantId, client.id, {
      name: name || plant.name,
      plantGroupId,
    });

    return backToPlantas(request, client.slug, { created: "actualizada" });
  }

  const name = formStr(formData, "name");
  if (!name) {
    return backToPlantas(request, client.slug, {
      error: "El nombre de la planta es obligatorio.",
    });
  }

  const code = slugify(formStr(formData, "code") || name, { upper: true, maxLen: 40 });
  if (!code) {
    return backToPlantas(request, client.slug, {
      error: "El nombre de la planta debe tener letras o números.",
    });
  }

  const existing = await repos.clients.findPlantByCode(client.id, code);
  if (existing) {
    return backToPlantas(request, client.slug, {
      error: `Ya existe una planta con el código "${code}" (${existing.name}).`,
    });
  }

  const rawGroup = formStr(formData, "plantGroupId");
  const plantGroupId = rawGroup.length > 0 ? rawGroup : undefined;

  await repos.clients.createPlant({
    clientAccountId: client.id,
    name,
    code,
    plantGroupId,
  });

  return backToPlantas(request, client.slug, { created: "planta" });
}
