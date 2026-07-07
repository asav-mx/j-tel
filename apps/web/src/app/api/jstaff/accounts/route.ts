import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const type = String(formData.get("type") ?? "client") as "client" | "carrier";

  if (!name || !slug) {
    return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });
  }

  const repos = getRepos();
  const account = await repos.accounts.create({
    type,
    name,
    slug,
    isDemo: true,
  });

  if (type === "carrier") {
    await repos.carriers.createProfile(account.id, name);
  } else {
    await repos.clients.createProfile(account.id, name);
  }

  return NextResponse.redirect(new URL("/jstaff/cuentas", request.url));
}
