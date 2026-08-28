import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { circuitoParaLaApp } from "@/lib/vista-previa";

/**
 * La FORMA del circuito: su configuración, sus dos trazados y sus paradas.
 *
 * **Separado del endpoint de unidades a propósito, y es la decisión de
 * rendimiento más importante de la app.** El trazado del circuito 1 son 1 117
 * pares de coordenadas —661 de ida y 456 de vuelta—: unos 25 KB que comprimen a
 * ~8. Si viajara con cada sondeo, un pasajero con la app abierta veinte minutos
 * lo pagaría ochenta veces, en un teléfono con datos contados.
 *
 * Separado, **la forma baja una vez y se queda en el teléfono**, y lo que se
 * repite cada quince segundos es el payload chico de unidades.
 *
 * Por eso también el caché es largo: un trazado cambia cuando alguien sube otro
 * KML, y una parada cuando alguien la mueve media cuadra. Cinco minutos de TTL
 * con una hora de revalidación es generoso para eso y ahorra el 95% de las
 * bajadas.
 *
 * Mismas prohibiciones que el otro endpoint: ni identificadores internos, ni
 * nada del transportista o la concesión. El circuito se nombra por su slug.
 */

const TTL_SEGUNDOS = 300;
const REVALIDAR_SEGUNDOS = 3600;

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  // La misma puerta que el endpoint de unidades: un circuito no publicado no
  // existe, y contesta igual que un slug inventado.
  const visible = await circuitoParaLaApp(slug);
  if (!visible) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }
  const { circuito } = visible;

  const [trazados, paradas] = await Promise.all([
    getRepos().circuits.getPaths(circuito.id),
    getRepos().circuits.listStopsVigentes(circuito.id),
  ]);

  return NextResponse.json(
    {
      circuito_id: circuito.publicSlug,
      nombre: circuito.name,
      frecuencia_declarada_min: circuito.declaredFrequencyMinutes,
      color_hex: circuito.colorHex,
      /* Los tres números que la app necesita para calcular sin inventar nada. */
      piso_rango_seg: circuito.arrivalRangeFloorSeconds,
      dato_viejo_seg: circuito.staleAfterSeconds,
      /*
       * La MISMA tolerancia con la que el servidor decidió qué publicar. Iba
       * clavada en 150 dentro del componente, y coincidía con la columna por
       * casualidad: el día que alguien moviera la columna, el servidor
       * publicaría un camión que el teléfono descartaría para calcular el
       * rango, sin que nada lo dijera. Es la divergencia silenciosa que ya
       * costó caro cuando la geocerca congelada en el hecho y la que usaba el
       * motor para juzgar se separaron.
       */
      corredor_m: circuito.corridorToleranceMeters,
      velocidad_declarada_kmh: circuito.avgSpeedKmh,
      horario: {
        inicio: circuito.serviceStartLocal,
        fin: circuito.serviceEndLocal,
        zona: circuito.timeZone,
      },
      trazados: trazados.map((t) => ({
        sentido: t.sentido,
        // [[lon, lat], ...] en el orden del recorrido, a resolución completa.
        // NO se simplifica: a resolución burda el trazado corta esquinas, y
        // entonces la proyección del pasajero cae en el lugar equivocado y el
        // rango miente. Lo que se ahorraría en KB se pagaría en metros.
        coordenadas: t.coordinates,
        largo_m: Math.round(t.lengthMeters),
      })),
      paradas: paradas.map((p) => ({
        // El slug del QR, que es la identidad pública de la parada.
        id: p.qrSlug,
        nombre: p.name,
        orden: p.orden,
        sentido: p.sentido,
        lat: p.latitude,
        lon: p.longitude,
      })),
    },
    {
      headers: {
        "cache-control": `public, s-maxage=${TTL_SEGUNDOS}, stale-while-revalidate=${REVALIDAR_SEGUNDOS}`,
      },
    },
  );
}
