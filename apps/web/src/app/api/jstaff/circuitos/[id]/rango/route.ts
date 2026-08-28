import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Prende y apaga el **rango de llegada** del circuito.
 *
 * Hermano del interruptor de publicación, y apagado por defecto por una razón
 * concreta: un circuito recién dado de alta arranca con `avg_speed_kmh` en una
 * mediana medida sobre **otra** flota. Enseñar un minuto estimado con esa
 * velocidad es presentar una suposición como medición.
 *
 * Apagado, el circuito **no se esconde**: el pasajero sigue viendo el camión
 * moverse en el mapa, que es verdad observada. Lo único que se calla es el
 * número de minutos. Se prende cuando la velocidad ya se calibró contra la
 * calle.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const form = await request.formData();
  const activar = String(form.get("activar") ?? "") === "si";

  const volver = (params: Record<string, string>) => {
    const url = new URL(`/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const circuito = await getRepos().circuits.setArrivalRangeEnabled(id, activar);
  if (!circuito) return volver({ error: "No existe ese circuito" });

  return volver({
    ok: activar
      ? "Rango de llegada encendido. La app ya muestra el tiempo estimado"
      : "Rango apagado. La app muestra el camión en el mapa, sin tiempo estimado",
  });
}
