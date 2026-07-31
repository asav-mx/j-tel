import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/** Convierte cualquier nombre en un slug válido: "Mi Empresa S.A." → "mi-empresa-sa" */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function backToForm(request: Request, params: Record<string, string>) {
  const url = new URL("/jstaff/cuentas", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  // 303 fuerza GET después de un POST de formulario
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: "/jstaff/cuentas" });
  if (!g.ok) return g.respuesta;

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const rawType = String(formData.get("type") ?? "client");
  const type = rawType === "carrier" ? "carrier" : "client";

  if (!name) {
    return backToForm(request, { error: "El nombre es obligatorio." });
  }

  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  if (!slug) {
    return backToForm(request, {
      error: "El nombre debe contener letras o números.",
    });
  }

  const repos = getRepos();

  const existing = await repos.accounts.findBySlug(slug);
  if (existing) {
    return backToForm(request, {
      error: `Ya existe una cuenta con el identificador "${slug}" (${existing.name}). Usa otro nombre.`,
    });
  }

  const account = await repos.accounts.create({ type, name, slug });

  if (type === "carrier") {
    await repos.carriers.createProfile(account.id, name);
  } else {
    await repos.clients.createProfile(account.id, name);
  }

  return backToForm(request, { created: account.slug });
}
