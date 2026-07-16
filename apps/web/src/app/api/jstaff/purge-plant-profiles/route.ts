import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * J-Staff: purga perfiles + ocurrencias (cascada) de una planta.
 * No borra el contrato ni la planta. Limpia geocercas huérfanas de esa planta.
 *
 * Confirmación: código de planta exacto + frase "PURGAR".
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const plantId = formStr(formData, "plantId");
  const confirmar = formStr(formData, "confirmar");

  if (!plantId) {
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent("Falta la planta."), request.url),
    );
  }

  const repos = getRepos();
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant) {
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent("Planta no encontrada."), request.url),
    );
  }

  if (confirmar !== plant.code) {
    return NextResponse.redirect(
      new URL(
        "/jstaff/soporte?error=" +
          encodeURIComponent(
            `Confirmación incorrecta. Escribe exactamente el código de planta: ${plant.code}`,
          ),
        request.url,
      ),
    );
  }

  const frase = formStr(formData, "frase");
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
    const result = await repos.profiles.purgePlantProfiles(plantId);
    const qs = new URLSearchParams({
      purge: "ok",
      plant: result.plantCode,
      profiles: String(result.profilesDeleted),
      occs: String(result.occurrencesDeleted),
      geofences: String(result.geofencesDeleted),
    });
    return NextResponse.redirect(new URL(`/jstaff/soporte?${qs.toString()}`, request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al purgar";
    return NextResponse.redirect(
      new URL("/jstaff/soporte?error=" + encodeURIComponent(msg), request.url),
    );
  }
}
