import { NextResponse } from "next/server";
import { TTL_SEGUNDOS, unidadesDeLaRuta } from "@/lib/unidades-de-la-ruta";
import { rutasPedidas } from "@/lib/rutas-pedidas";
import { CABECERAS_DE_ENSAYO, CABECERA_DE_LA_LLAVE, llaveDeEnsayoValida } from "@/lib/ensayo";
import { estadosDeEnsayo } from "@/lib/ontoy/ciudad";

/**
 * **La puerta de ensayo** — `/api/circuitos/en-vivo`, para el teléfono que trae
 * la llave: las mismas rutas pedidas y el mismo cuerpo, con la fecha de
 * arranque dada por cumplida (`lib/ensayo.ts`).
 *
 * - **Dirección aparte**, no una bandera dentro de la pública: la pública se
 *   comparte 15 s en el CDN, y ésta no se guarda en ningún lado
 *   (`CABECERAS_DE_ENSAYO`, en TODAS sus respuestas, también en el 404).
 * - **Bajo `/api/circuitos/`** a propósito: es el prefijo de la regla del
 *   firewall, y un teléfono de ensayo sondea igual que cualquiera.
 * - **Y bajo `en-vivo`**: el service worker ya trata todo lo que contenga
 *   `/api/circuitos/en-vivo` como vivo, así que tampoco lo guarda el teléfono.
 * - **Sin llave, llave mala o llave apagada: el mismo 404**, sin cuerpo que los
 *   distinga.
 * - Trae además **la situación de todas las rutas publicadas** vista con la
 *   llave, para que la lista de Inicio no diga «Arranca el 1 oct» junto a un
 *   camión en vivo de la misma ruta.
 */
export async function GET(request: Request) {
  if (!llaveDeEnsayoValida(request.headers.get(CABECERA_DE_LA_LLAVE))) {
    return new NextResponse(null, { status: 404, headers: CABECERAS_DE_ENSAYO });
  }

  const pedidas = rutasPedidas(new URL(request.url).searchParams.get("rutas"));
  if (!pedidas.ok) {
    return NextResponse.json({ error: pedidas.error }, { status: 400, headers: CABECERAS_DE_ENSAYO });
  }

  const ahora = new Date();
  const [cuerpos, estados] = await Promise.all([
    Promise.all(pedidas.rutas.map((slug) => unidadesDeLaRuta(slug, ahora, { ensayo: true }))),
    estadosDeEnsayo(ahora),
  ]);
  const rutas: Record<string, NonNullable<(typeof cuerpos)[number]>> = {};
  pedidas.rutas.forEach((slug, i) => {
    const c = cuerpos[i];
    if (c) rutas[slug] = c;
  });

  return NextResponse.json(
    { generado_en: ahora.toISOString(), ttl_seg: TTL_SEGUNDOS, ensayo: true, rutas, estados },
    { headers: CABECERAS_DE_ENSAYO },
  );
}
