import { notFound } from "next/navigation";
import { getRepos } from "@/lib/db";
import { VistaPasajero, type Forma } from "@/components/vista-pasajero";

export const dynamic = "force-dynamic";

/**
 * La vista del pasajero.
 *
 * La forma del circuito —trazado y paradas— se sirve desde el servidor en el
 * primer render, así que **el mapa dibuja el recorrido sin esperar una segunda
 * petición**. En un teléfono de gama baja con red lenta eso es la diferencia
 * entre ver la ruta al segundo o al cuarto.
 *
 * Lo vivo sí se pide desde el navegador, porque cambia cada quince segundos y
 * no tiene sentido congelarlo en el HTML.
 */
export default async function CircuitoPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repos = getRepos();

  // La misma puerta de siempre: sin publicar, no existe.
  const circuito = await repos.circuits.getPublishedCircuitBySlug(slug);
  if (!circuito) notFound();

  const [trazados, paradas] = await Promise.all([
    repos.circuits.getPaths(circuito.id),
    repos.circuits.listStopsVigentes(circuito.id),
  ]);

  const forma: Forma = {
    circuito_id: circuito.publicSlug,
    nombre: circuito.name,
    frecuencia_declarada_min: circuito.declaredFrequencyMinutes,
    color_hex: circuito.colorHex,
    piso_rango_seg: circuito.arrivalRangeFloorSeconds,
    dato_viejo_seg: circuito.staleAfterSeconds,
    velocidad_declarada_kmh: circuito.avgSpeedKmh,
    horario: {
      inicio: circuito.serviceStartLocal,
      fin: circuito.serviceEndLocal,
      zona: circuito.timeZone,
    },
    trazados: trazados.map((t) => ({
      sentido: t.sentido,
      coordenadas: t.coordinates as Array<[number, number]>,
      largo_m: Math.round(t.lengthMeters),
    })),
    paradas: paradas.map((p) => ({
      id: p.qrSlug,
      nombre: p.name,
      orden: p.orden,
      sentido: p.sentido,
      lat: p.latitude,
      lon: p.longitude,
    })),
  };

  return <VistaPasajero forma={forma} />;
}
