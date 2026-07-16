import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";
import { redirectWithParams } from "@/lib/redirect";

function back(request: Request, params: Record<string, string>) {
  return redirectWithParams(request, "/jstaff/comercial", params, { skipEmpty: true });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const action = formStr(formData, "action", "authorize");
  const clientSlug = formStr(formData, "clientSlug");
  const carrierAccountId = formStr(formData, "carrierAccountId");
  const notes = formStr(formData, "notes");

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
