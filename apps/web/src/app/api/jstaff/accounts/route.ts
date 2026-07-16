import { getRepos } from "@/lib/db";
import { formStr, slugify } from "@/lib/form";
import { redirectWithParams } from "@/lib/redirect";

function backToForm(request: Request, params: Record<string, string>) {
  return redirectWithParams(request, "/jstaff/cuentas", params);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = formStr(formData, "name");
  const rawType = String(formData.get("type") ?? "client");
  const type = rawType === "carrier" ? "carrier" : "client";

  if (!name) {
    return backToForm(request, { error: "El nombre es obligatorio." });
  }

  const slug = slugify(formStr(formData, "slug") || name);
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
