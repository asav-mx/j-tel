import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createServiceProfileSchema } from "@jtel/domain";

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/configuracion/servicios", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const action = String(formData.get("action") ?? "create").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente/configuracion/servicios", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "generar") {
    const profileId = String(formData.get("profileId") ?? "").trim();
    const fromDate = String(formData.get("fromDate") ?? "").trim();
    const toDate = String(formData.get("toDate") ?? "").trim();
    if (!profileId || !fromDate || !toDate) {
      return back(request, client.slug, { error: "Elige perfil y rango de fechas." });
    }
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return back(request, client.slug, { error: "Rango de fechas inválido." });
    }
    try {
      const createdIds = await repos.occurrences.generateForProfile(profileId, from, to);
      return back(request, client.slug, { created: "generado", n: String(createdIds.length) });
    } catch {
      return back(request, client.slug, { error: "No se pudieron generar las ocurrencias." });
    }
  }

  // action === "create"
  const name = String(formData.get("name") ?? "").trim();
  const contractId = String(formData.get("contractId") ?? "").trim();
  const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
  const geofenceId = String(formData.get("geofenceId") ?? "").trim();
  const referenceUnitIdRaw = String(formData.get("referenceUnitId") ?? "").trim();
  const possibleUnitIdsRaw = formData.getAll("possibleUnitIds").map((u) => String(u));
  const activeDays = formData
    .getAll("activeDays")
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const contract = contractId ? await repos.contracts.findById(contractId) : null;
  if (!contract || contract.clientAccountId !== client.id) {
    return back(request, client.slug, { error: "Contrato no encontrado." });
  }

  // Las unidades deben pertenecer al carrier del contrato.
  const carrierUnits = await repos.fleet.getUnitsForCarrier(contract.carrierAccountId);
  const carrierUnitIds = new Set(carrierUnits.map((u) => u.id));
  const possibleUnitIds = possibleUnitIdsRaw.filter((id) => carrierUnitIds.has(id));
  const referenceUnitId =
    referenceUnitIdRaw && carrierUnitIds.has(referenceUnitIdRaw) ? referenceUnitIdRaw : undefined;

  const payload = {
    contractId,
    routeShiftId,
    geofenceId,
    name,
    possibleUnitIds,
    ...(referenceUnitId ? { referenceUnitId } : {}),
    activeDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5],
  };

  const parsed = createServiceProfileSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return back(request, client.slug, {
      error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
    });
  }

  await repos.profiles.create(parsed.data);
  return back(request, client.slug, { created: "perfil" });
}
