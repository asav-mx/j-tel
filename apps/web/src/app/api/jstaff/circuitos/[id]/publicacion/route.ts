import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Prende y apaga la publicación del circuito.
 *
 * Un circuito **no publicado no existe para el endpoint público**: contesta lo
 * mismo que un slug inventado. Eso es lo que permite armarlo por partes
 * —trazado, paradas, unidades— y probar el endpoint con datos reales sin que
 * aparezca en la app del pasajero, sin pedir login en una app pública, que
 * contradiría su diseño entero.
 *
 * **No comprueba que el circuito esté "listo".** Publicar sin trazado es
 * legítimo: el endpoint contesta igual, con `sentido: null` en cada unidad. Lo
 * que le falta se enuncia en la pantalla; decidir es de quien opera.
 *
 * Apagar no borra nada: el trazado, las paradas y las asignaciones se quedan
 * donde estaban, y volver a prender no pide rehacer nada.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const form = await request.formData();
  const publicar = String(form.get("publicar") ?? "") === "si";

  const volver = (params: Record<string, string>) => {
    const url = new URL(`/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const circuito = await getRepos().circuits.setCircuitPublished(id, publicar);
  if (!circuito) return volver({ error: "No existe ese circuito" });

  return volver({
    ok: publicar
      ? `Publicado. El circuito ya responde en /circuitos/${circuito.publicSlug}/unidades`
      : "Despublicado. El circuito dejó de existir para la app del pasajero",
  });
}
