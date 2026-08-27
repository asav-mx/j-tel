import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/** Alta de una concesión. Se da desde la pantalla, nunca por SQL a mano. */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const nombre = String(form.get("nombre") ?? "").trim();
  const razonSocial = String(form.get("razonSocial") ?? "").trim() || nombre;
  const numero = String(form.get("numeroConcesion") ?? "").trim();

  if (!nombre) {
    return NextResponse.redirect(new URL("/jstaff/circuitos?error=Falta+el+nombre", request.url), 303);
  }

  const slug = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    await getRepos().circuits.createConcession({
      name: nombre,
      slug,
      legalName: razonSocial,
      numeroConcesion: numero || null,
    });
  } catch {
    // El slug es único: dos concesiones con el mismo nombre chocan, y decirlo
    // es más útil que un 500.
    return NextResponse.redirect(
      new URL(`/jstaff/circuitos?error=Ya+existe+una+cuenta+con+ese+nombre`, request.url),
      303,
    );
  }

  return NextResponse.redirect(new URL("/jstaff/circuitos?ok=Concesión+dada+de+alta", request.url), 303);
}
