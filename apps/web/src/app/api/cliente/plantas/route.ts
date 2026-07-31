import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/** Genera un código corto y estable a partir del nombre: "Planta Norte 2" → "PLANTA-NORTE-2" */
function codify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function backToPlantas(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/plantas", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();

  // Ancla de todo lo que sigue: las comprobaciones de pertenencia que esta
  // ruta ya hacía comparaban contra el cliente que decía el cuerpo.
  const g = await exigir(request, { tipo: "cliente", slug: clientSlug }, { redirigirA: "/cliente" });
  if (!g.ok) return g.respuesta;
  const action = String(formData.get("action") ?? "plant");

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);

  if (!client || client.type !== "client") {
    const url = new URL("/cliente/plantas", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "group") {
    const name = String(formData.get("groupName") ?? "").trim();
    if (!name) {
      return backToPlantas(request, client.slug, {
        error: "El nombre del grupo es obligatorio.",
      });
    }
    await repos.clients.createPlantGroup(client.id, name);
    return backToPlantas(request, client.slug, { created: "grupo" });
  }

  if (action === "update") {
    const plantId = String(formData.get("plantId") ?? "").trim();
    const plant = plantId ? await repos.clients.getPlantById(plantId) : null;
    if (!plant || plant.clientAccountId !== client.id) {
      return backToPlantas(request, client.slug, { error: "Planta no encontrada." });
    }

    const name = String(formData.get("name") ?? "").trim();
    const rawGroup = String(formData.get("plantGroupId") ?? "").trim();
    const plantGroupId = rawGroup.length > 0 ? rawGroup : null;

    await repos.clients.updatePlant(plantId, client.id, {
      name: name || plant.name,
      plantGroupId,
    });

    return backToPlantas(request, client.slug, { created: "actualizada" });
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return backToPlantas(request, client.slug, {
      error: "El nombre de la planta es obligatorio.",
    });
  }

  const code = codify(String(formData.get("code") ?? "").trim() || name);
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

  const rawGroup = String(formData.get("plantGroupId") ?? "").trim();
  const plantGroupId = rawGroup.length > 0 ? rawGroup : undefined;

  await repos.clients.createPlant({
    clientAccountId: client.id,
    name,
    code,
    plantGroupId,
  });

  return backToPlantas(request, client.slug, { created: "planta" });
}
