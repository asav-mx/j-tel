import type { Sentido } from "@/lib/ontoy/forma";

/**
 * Las paradas de TODA la ciudad, para que el teléfono escoja las cercanas.
 *
 * ## Qué lleva, y qué no (decisión de ASAV, 22-sep)
 *
 * **Sólo lo del primer cajón del 9.14 — lo público —, y de eso sólo lo que
 * hace falta para decir «esta parada está cerca de ti»:**
 *
 * - por ruta: su identificador público (el slug de su dirección), su nombre y
 *   su color;
 * - por parada: su identificador público (el slug de su QR), su ruta, su
 *   nombre, su sentido y su posición.
 *
 * **Cero mediciones:** ni unidades, ni pasos, ni tiempos, ni velocidades, ni
 * transportista, ni concesión, ni ningún identificador interno. Todo eso ya se
 * ve ruta por ruta en el mapa o no sale nunca; aquí sólo viaja lo público,
 * junto. La posición y el sentido van porque sin ellos el teléfono no puede
 * calcular cuáles quedan cerca.
 *
 * El objeto se ARMA campo por campo, a propósito, y no se esparce la fila: la
 * fila de la base trae el uuid de la parada y el de su versión, y un `...fila`
 * los mandaría a la calle el día que alguien agregue una columna. La prueba
 * (`paradas-de-la-ciudad.test.ts`) se cae si sale un campo de más.
 *
 * La petición que la trae **no lleva nada del pasajero**: es un GET sin
 * parámetros, igual para todos. La ubicación se cruza con la lista en el
 * teléfono (`lib/ontoy/rutas-cerca.ts`).
 */

export interface RutaDeLaLista {
  id: string;
  nombre: string;
  color_hex: string;
}

export interface ParadaDeLaCiudad {
  id: string;
  ruta: string;
  nombre: string;
  /** `null`: la parada sirve a los dos sentidos. */
  sentido: Sentido | null;
  lat: number;
  lon: number;
}

export interface ParadasDeLaCiudad {
  rutas: RutaDeLaLista[];
  paradas: ParadaDeLaCiudad[];
}

/** Lo mínimo del repositorio que esto necesita. */
export interface FuenteDeParadas {
  listPublishedCircuits(): Promise<Array<{ publicSlug: string }>>;
  getPublishedCircuitBySlug(
    slug: string,
  ): Promise<{ id: string; publicSlug: string; name: string; colorHex: string } | null>;
  listStopsVigentes(circuitId: string): Promise<
    Array<{ qrSlug: string; name: string; sentido: string | null; latitude: number; longitude: number }>
  >;
}

export async function paradasDeLaCiudad(fuente: FuenteDeParadas): Promise<ParadasDeLaCiudad> {
  const publicados = await fuente.listPublishedCircuits();
  const rutas: RutaDeLaLista[] = [];
  const paradas: ParadaDeLaCiudad[] = [];

  for (const { publicSlug } of publicados) {
    // La misma puerta que la portada: lo no publicado no existe (8.4).
    const circuito = await fuente.getPublishedCircuitBySlug(publicSlug);
    if (!circuito) continue;

    rutas.push({ id: circuito.publicSlug, nombre: circuito.name, color_hex: circuito.colorHex });

    for (const p of await fuente.listStopsVigentes(circuito.id)) {
      paradas.push({
        id: p.qrSlug,
        ruta: circuito.publicSlug,
        nombre: p.name,
        sentido: p.sentido === "ida" || p.sentido === "vuelta" ? p.sentido : null,
        lat: p.latitude,
        lon: p.longitude,
      });
    }
  }

  return { rutas, paradas };
}
