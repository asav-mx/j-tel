import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Alta de un circuito.
 *
 * Los tres campos llegan del formulario con los defaults del circuito 1 ya
 * puestos, pero se mandan como valores: son campos, no constantes, y el día que
 * un concesionario opere con otra frecuencia se cambian aquí sin desplegar.
 */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const concesion = String(form.get("concesionAccountId") ?? "").trim();
  const nombre = String(form.get("nombre") ?? "").trim();
  const slug = String(form.get("publicSlug") ?? "").trim().toLowerCase();

  const volver = (msg: string) =>
    NextResponse.redirect(new URL(`/jstaff/circuitos?error=${encodeURIComponent(msg)}`, request.url), 303);

  if (!concesion) return volver("Escoge la concesión");
  if (!nombre) return volver("Falta el nombre del circuito");
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
    return volver("El slug público solo admite minúsculas, números y guiones");
  }

  const numero = (campo: string, porDefecto: number) => {
    const v = Number(form.get(campo));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : porDefecto;
  };

  /*
   * La frecuencia NO lleva default, a diferencia de las demás perillas.
   *
   * Las otras son umbrales del instrumento: hay un valor razonable y heredarlo
   * no afirma nada de cara al pasajero. La frecuencia sí — la app la dice en
   * voz alta, «cada 20 minutos», con la autoridad del sistema detrás. Un
   * default aquí volvía indistinguible «lo declaró el concesionario» de «nadie
   * lo escribió», y la app afirmaba la cadencia igual en los dos casos.
   *
   * Sin valor capturado se guarda vacío, y la app dice que hay servicio sin
   * tiempo estimado.
   */
  const frecuencia = (() => {
    const crudo = String(form.get("frecuenciaMin") ?? "").trim();
    if (!crudo) return null;
    const v = Number(crudo);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  })();

  try {
    const creado = await getRepos().circuits.createCircuit({
      concessionAccountId: concesion,
      name: nombre,
      publicSlug: slug,
      declaredFrequencyMinutes: frecuencia,
      staleAfterSeconds: numero("umbralSeg", 180),
      arrivalRangeFloorSeconds: numero("pisoSeg", 180),
      stopSnapToleranceMeters: numero("toleranciaM", 25),
      serviceStartLocal: String(form.get("horaInicio") ?? "05:00"),
      serviceEndLocal: String(form.get("horaFin") ?? "23:00"),
    });
    // Directo al editor: dar de alta y quedarse en la lista obliga a buscar lo
    // que uno acaba de crear.
    return NextResponse.redirect(new URL(`/jstaff/circuitos/${creado.id}`, request.url), 303);
  } catch {
    return volver("Ya existe un circuito con ese slug público");
  }
}
