import { NextResponse } from "next/server";
import { instanteDeCampoLocal, validarAviso } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { destinoDeVuelta } from "@/lib/casa/volver";

/**
 * Captura un **aviso de la concesión al pasajero** (Marco 8.13b; 0052).
 *
 * Sólo J-Staff, de parte de la concesión; en Ontoy se lee «según la concesión»
 * con su fecha. **Firmado con la sesión** — nunca con algo que venga en el
 * formulario. La validación en palabras es la del dominio (`validarAviso`), la
 * misma que usa la vista previa; las fechas se leen en la zona del circuito.
 *
 * Regresa al expediente del circuito en la casa, a la sección de avisos.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const form = await request.formData();
  const volver = (params: Record<string, string>) => {
    const url = new URL(destinoDeVuelta(form) ?? `/casa/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.hash = "avisos";
    return NextResponse.redirect(url, 303);
  };

  if (!g.identidad.userId) return volver({ error: "Inicia sesión: el aviso queda firmado." });
  const circuito = await getRepos().circuits.getCircuit(id);
  if (!circuito) return volver({ error: "No existe ese circuito" });

  const campo = (k: string) => String(form.get(k) ?? "");
  const v = validarAviso(
    {
      titulo: campo("titulo"),
      detalle: campo("detalle"),
      desde: instanteDeCampoLocal(campo("desde"), circuito.timeZone),
      hasta: instanteDeCampoLocal(campo("hasta"), circuito.timeZone),
    },
    new Date(),
  );
  if (!v.ok) return volver({ error: v.error });

  const r = await getRepos().circuits.crearAviso(id, v.aviso, g.identidad.userId);
  if (!r.ok) return volver({ error: r.error === "no_existe" ? "No existe ese circuito" : "Inicia sesión: el aviso queda firmado." });
  return volver({ ok: "Aviso capturado. Ontoy lo enseña en cuanto empieza su vigencia." });
}
