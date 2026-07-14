import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * J-Staff: purga UN perfil + ocurrencias (cascada).
 * Confirmación: código exacto del perfil + frase "PURGAR".
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const profileId = String(formData.get("profileId") ?? "").trim();
  const confirmar = String(formData.get("confirmar") ?? "").trim();
  const frase = String(formData.get("frase") ?? "").trim();

  if (!profileId) {
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent("Falta el perfil."), request.url),
    );
  }

  const repos = getRepos();
  const profile = await repos.profiles.findById(profileId);
  if (!profile) {
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent("Perfil no encontrado."), request.url),
    );
  }

  if (confirmar !== profile.code) {
    return NextResponse.redirect(
      new URL(
        "/jstaff/soporte?error=" +
          encodeURIComponent(
            `Confirmación incorrecta. Escribe exactamente el código del perfil: ${profile.code}`,
          ),
        request.url,
      ),
    );
  }

  if (frase !== "PURGAR") {
    return NextResponse.redirect(
      new URL(
        "/jstaff/soporte?error=" +
          encodeURIComponent('Falta confirmar con la palabra exacta "PURGAR" (mayúsculas).'),
        request.url,
      ),
    );
  }

  try {
    const result = await repos.profiles.purgeProfileById(profileId);
    const qs = new URLSearchParams({
      purge_one: "ok",
      code: result.profileCode,
      name: result.profileName,
      occs: String(result.occurrencesDeleted),
      geofence: result.geofenceDeleted ? "1" : "0",
    });
    return NextResponse.redirect(new URL(`/jstaff/soporte?${qs.toString()}`, request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al purgar perfil";
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent(msg), request.url),
    );
  }
}
