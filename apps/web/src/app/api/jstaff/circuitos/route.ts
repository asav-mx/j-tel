import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Alta de un circuito.
 *
 * **Un campo vacío no se manda, y ésa es toda la política del alta.** La base
 * pone su valor de origen, el expediente lo enseña como tal y ahí se ajusta con
 * su explicación al lado. Rellenar aquí un número que nadie escribió sería
 * guardarlo como si alguien lo hubiera decidido — que es exactamente lo que
 * costó la frecuencia.
 *
 * Nada de esto pide desplegar: son campos del circuito y se editan después.
 */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const concesion = String(form.get("concesionAccountId") ?? "").trim();
  const nombre = String(form.get("nombre") ?? "").trim();
  const slug = String(form.get("publicSlug") ?? "").trim().toLowerCase();

  const volver = (msg: string) =>
    NextResponse.redirect(
      new URL(`/jstaff/circuitos?error=${encodeURIComponent(msg)}`, request.url),
      303,
    );

  if (!concesion) return volver("Escoge la concesión");
  if (!nombre) return volver("Falta el nombre del circuito");
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
    return volver("El slug público solo admite minúsculas, números y guiones");
  }

  /**
   * Vacío = **no se manda la columna**, y la base pone su valor de origen.
   *
   * La versión anterior traía `(campo, porDefecto)` y escribía el default de
   * todas formas. Se lee igual en la base —el mismo 180— y no es lo mismo: un
   * valor escrito por el alta es indistinguible de uno que alguien decidió, y
   * en la pantalla del expediente eso vuelve imposible decir de dónde salió.
   */
  const opcional = (campo: string, { entero = true }: { entero?: boolean } = {}) => {
    const crudo = String(form.get(campo) ?? "").trim();
    if (!crudo) return undefined;
    const v = Number(crudo);
    if (!Number.isFinite(v) || v <= 0) return undefined;
    return entero ? Math.round(v) : v;
  };

  /*
   * La frecuencia NO admite valor sugerido, a diferencia de las demás perillas.
   *
   * Las otras son umbrales del instrumento: hay un valor razonable y heredarlo
   * no afirma nada de cara al pasajero. La frecuencia sí — la app la dice en voz
   * alta, «cada 20 minutos», con la autoridad del sistema detrás. Un valor
   * sugerido aquí vuelve indistinguible «lo declaró el concesionario» de «nadie
   * lo escribió», y la app afirmaría la cadencia igual en los dos casos.
   *
   * Ese default vivía en dos lugares: en la columna —lo quitó la `0031`— y
   * **prellenado en este formulario, donde sobrevivió**. Un circuito dado de
   * alta sin borrar ese 20 declaraba una cadencia que nadie declaró.
   */
  const frecuencia = opcional("frecuenciaMin") ?? null;

  const hora = (campo: string) => {
    const v = String(form.get(campo) ?? "").trim();
    return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : undefined;
  };

  try {
    const creado = await getRepos().circuits.createCircuit({
      concessionAccountId: concesion,
      name: nombre,
      publicSlug: slug,
      declaredFrequencyMinutes: frecuencia,
      staleAfterSeconds: opcional("frescuraSeg"),
      arrivalRangeFloorSeconds: opcional("pisoRangoSeg"),
      stopSnapToleranceMeters: opcional("pegadoParadasM"),
      corridorToleranceMeters: opcional("corredorEnRutaM"),
      serviceConfidenceMinutes: opcional("confianzaMin"),
      avgSpeedKmh: opcional("velocidadKmh", { entero: false }),
      serviceStartLocal: hora("horaInicio"),
      serviceEndLocal: hora("horaFin"),
    });
    // Directo al expediente: dar de alta y quedarse en la lista obliga a buscar
    // lo que uno acaba de crear.
    return NextResponse.redirect(new URL(`/jstaff/circuitos/${creado.id}`, request.url), 303);
  } catch {
    return volver("Ya existe un circuito con ese slug público");
  }
}
