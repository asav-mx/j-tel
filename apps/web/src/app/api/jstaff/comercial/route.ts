import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/jstaff/comercial", request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: "/jstaff/comercial" });
  if (!g.ok) return g.respuesta;

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "authorize").trim();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const carrierAccountId = String(formData.get("carrierAccountId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const repos = getRepos();
  const client = clientSlug ? await repos.accounts.findBySlug(clientSlug) : null;
  if (!client || client.type !== "client") {
    return back(request, { error: "Cliente no válido." });
  }

  const carrier = carrierAccountId ? await repos.accounts.findById(carrierAccountId) : null;
  if (!carrier || carrier.type !== "carrier") {
    return back(request, { client: client.slug, error: "Carrier no válido." });
  }

  if (action === "suspend") {
    await repos.commercial.suspend(client.id, carrier.id);
    return back(request, { client: client.slug, updated: "suspendido" });
  }

  await repos.commercial.authorize({
    clientAccountId: client.id,
    carrierAccountId: carrier.id,
    notes: notes || undefined,
  });
  return back(request, { client: client.slug, updated: "autorizado" });
}
