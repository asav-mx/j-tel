import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";
import { redirectWithParams } from "@/lib/redirect";
import { isEncryptionConfigured } from "@jtel/db";

function back(request: Request, slug: string, params: Record<string, string>) {
  return redirectWithParams(request, "/carrier/gps", { account: slug, ...params });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = formStr(formData, "carrierSlug");
  const provider = formStr(formData, "provider", "umbrella") || "umbrella";
  const userId = formStr(formData, "userId");
  const password = String(formData.get("password") ?? "");
  const baseUrl = formStr(formData, "baseUrl") || null;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier || carrier.type !== "carrier") {
    return redirectWithParams(request, "/carrier/gps", { error: "Carrier no encontrado." });
  }

  if (!isEncryptionConfigured()) {
    return back(request, carrier.slug, {
      error:
        "Falta configurar la llave de cifrado (JTEL_SECRET_KEY) en el servidor. Avísale al equipo de J-Tel.",
    });
  }

  if (!userId) {
    return back(request, carrier.slug, { error: "El usuario del proveedor es obligatorio." });
  }

  const existing = await repos.carriers.getGpsCredentials(carrier.id);
  if (!password && !existing) {
    return back(request, carrier.slug, {
      error: "La contraseña es obligatoria la primera vez.",
    });
  }

  await repos.carriers.saveGpsCredentials(carrier.id, {
    provider,
    userId,
    password: password || undefined,
    baseUrl,
  });

  return back(request, carrier.slug, { saved: "1" });
}
