import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Ligar y desligar transportistas de una concesión.
 *
 * **Es el eslabón que abre el universo de unidades asignables.** El circuito
 * pertenece a la concesión; quién lo puede correr lo dice esta liga. Sin ella,
 * la pantalla del circuito no tiene de dónde escoger una unidad, y ese fue
 * exactamente el hueco: la tabla existía desde la 0025 y nada escribía en ella.
 *
 * Va por formulario y redirección, como el resto de esta pantalla: no necesita
 * JavaScript para funcionar.
 */
export async function POST(request: Request, ctx: { params: Promise<{ accountId: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { accountId } = await ctx.params;
  const form = await request.formData();
  const accion = String(form.get("accion") ?? "ligar");
  const volver = (mensaje: string, esError = false) =>
    NextResponse.redirect(
      new URL(
        `/jstaff/circuitos?${esError ? "error" : "ok"}=${encodeURIComponent(mensaje)}`,
        request.url,
      ),
      303,
    );

  const repos = getRepos();

  if (accion === "terminar") {
    const ligaId = String(form.get("ligaId") ?? "");
    if (!ligaId) return volver("Falta qué liga terminar", true);
    const terminada = await repos.circuits.unlinkCarrierFromConcession(ligaId);
    if (!terminada) return volver("Esa liga no existe o ya estaba terminada", true);
    return volver("Transportista desligado de la concesión");
  }

  const carrierAccountId = String(form.get("carrierAccountId") ?? "");
  if (!carrierAccountId) return volver("Falta qué transportista ligar", true);

  const carrier = await repos.accounts.findById(carrierAccountId);
  if (!carrier || carrier.type !== "carrier") {
    return volver("Esa cuenta no es un transportista", true);
  }

  await repos.circuits.linkCarrierToConcession(accountId, carrierAccountId);
  return volver(`${carrier.name} ya puede correr circuitos de esta concesión`);
}
