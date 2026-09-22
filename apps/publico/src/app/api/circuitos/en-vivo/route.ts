import { NextResponse } from "next/server";
import { TTL_SEGUNDOS, unidadesDeLaRuta } from "@/lib/unidades-de-la-ruta";
import { rutasPedidas } from "@/lib/rutas-pedidas";

/**
 * Los camiones de **las rutas favoritas del pasajero**, en una sola consulta
 * cada 15 s (Ontoy 2.0, PR 3b; decisión de ASAV, 22-sep).
 *
 * Con cinco favoritas, preguntar ruta por ruta eran veinte peticiones por
 * minuto por teléfono; ésta son cuatro, sin importar cuántas. Menos peticiones
 * que antes, no más — y menos contra el límite del firewall, que comparten
 * todos los teléfonos detrás de la misma IP de la compañía celular.
 *
 * - **Sólo las rutas pedidas**, con tope (`lib/rutas-pedidas.ts`): nunca la
 *   ciudad entera.
 * - **Cada ruta dice lo mismo que su consulta sola**: el cuerpo sale de
 *   `unidadesDeLaRuta`, la misma función. Una ruta no publicada o inventada
 *   **no aparece**, igual que allá contesta 404 sin distinguir.
 * - **Vive bajo `/api/circuitos/`** a propósito: es el prefijo de la regla del
 *   firewall (`docs/Procedimiento-Firewall-Publico.md`), y fuera de él no la
 *   cubriría nada.
 * - **Mismo caché** que la de una ruta: 15 s, sin `stale-while-revalidate`.
 *
 * La petición lleva la lista de rutas y nada más del pasajero: ni ubicación,
 * ni paradas, ni identificador. Está en la declaración de datos.
 */
export async function GET(request: Request) {
  const pedidas = rutasPedidas(new URL(request.url).searchParams.get("rutas"));
  if (!pedidas.ok) return NextResponse.json({ error: pedidas.error }, { status: 400 });

  const ahora = new Date();
  const cuerpos = await Promise.all(pedidas.rutas.map((slug) => unidadesDeLaRuta(slug, ahora)));
  const rutas: Record<string, NonNullable<(typeof cuerpos)[number]>> = {};
  pedidas.rutas.forEach((slug, i) => {
    const c = cuerpos[i];
    if (c) rutas[slug] = c;
  });

  return NextResponse.json(
    { generado_en: ahora.toISOString(), ttl_seg: TTL_SEGUNDOS, rutas },
    { headers: { "cache-control": `public, max-age=0, s-maxage=${TTL_SEGUNDOS}` } },
  );
}
