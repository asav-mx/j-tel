import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { isEncryptionConfigured } from "@jtel/db";

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/carrier/gps", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = String(formData.get("carrierSlug") ?? "").trim();
  const provider = String(formData.get("provider") ?? "umbrella").trim() || "umbrella";
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const baseUrl = String(formData.get("baseUrl") ?? "").trim() || null;

  // Sobrescribir credenciales de GPS deja a un carrier sin ingesta, así que
  // esta puerta se cierra en la primera tanda aunque no sea de J-Staff.
  const g = await exigir(
    request,
    { tipo: "carrier-o-jstaff", slug: carrierSlug },
    { redirigirA: "/carrier/gps" },
  );
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier || carrier.type !== "carrier") {
    const url = new URL("/carrier/gps", request.url);
    url.searchParams.set("error", "Carrier no encontrado.");
    return NextResponse.redirect(url, 303);
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
