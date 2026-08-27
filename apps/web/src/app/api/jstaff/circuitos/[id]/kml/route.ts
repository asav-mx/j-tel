import { NextResponse } from "next/server";
import { analizarKmlDeCircuito } from "@jtel/domain";
import { exigir } from "@/lib/guardia-api";

export const maxDuration = 60;

/**
 * Lee un KML y devuelve sus capas con las medidas de cada una.
 *
 * **No guarda nada y no escoge nada.** Solo entrega lo que hace falta para que
 * una persona decida cuál capa es ida y cuál vuelta, viendo enfrente cuántos
 * puntos trae, qué largo tiene y de cuánto es su hueco máximo. El archivo de un
 * concesionario invitado va a venir con las convenciones de quien se lo dibujó,
 * así que elegir por nombre de capa sería adivinar.
 */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const archivo = form.get("kml");
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo KML" }, { status: 400 });
  }
  if (archivo.size > 10_000_000) {
    return NextResponse.json({ error: "El archivo pasa de 10 MB" }, { status: 413 });
  }

  const texto = await archivo.text();
  const analisis = analizarKmlDeCircuito(texto);

  // Las coordenadas completas no viajan en la lista: un KML de circuito trae
  // miles de vértices por capa y la pantalla solo necesita las medidas para
  // decidir. El trazado se manda al guardar, ya con la capa elegida.
  return NextResponse.json({
    archivo: archivo.name,
    capas: analisis.capas.map((c, indice) => ({
      indice,
      nombre: c.nombre,
      carpeta: c.carpeta,
      puntos: c.puntos,
      largoMetros: Math.round(c.largoMetros),
      espaciadoMedianoMetros: Math.round(c.espaciadoMedianoMetros),
      huecoMaximoMetros: Math.round(c.huecoMaximoMetros),
      inicio: c.inicio,
      fin: c.fin,
      coordenadas: c.coordenadas,
    })),
    puntos: analisis.puntos,
    avisos: analisis.avisos,
  });
}
