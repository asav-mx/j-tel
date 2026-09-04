import Link from "next/link";
import { getRepos } from "@/lib/db";
import { Buscador, type CircuitoParaBuscador } from "@/components/buscador";
import { salidaDelBuscador } from "@/lib/salida-del-buscador";

export const dynamic = "force-dynamic";

/**
 * «¿A dónde vas?» — la pantalla que contesta si alguna ruta publicada te sirve.
 *
 * ## Sólo lo publicado, y por la puerta de siempre
 *
 * Se listan los circuitos publicados y se piden sus trazados y sus paradas. Un
 * circuito sin publicar **no aparece aquí tampoco** — sería la puerta lateral
 * por la que se asomaría una ruta que todavía no existe para nadie. Y no se
 * abre la vista previa: aquélla existe para mirar UN circuito nombrándolo, no
 * para meterlo a una lista.
 *
 * ## Por qué la forma se sirve desde el servidor
 *
 * Igual que en `/c/[slug]`: el mapa dibuja la cobertura en el primer render, sin
 * esperar una segunda petición. En un teléfono de gama baja con red lenta eso es
 * la diferencia entre ver el mapa al segundo o al cuarto.
 *
 * ⚠ **Y aquí está el límite que conviene tener escrito.** El trazado va a
 * resolución completa —el circuito 1 son 1 117 pares de coordenadas, ~25 KB que
 * comprimen a ~8— porque a resolución burda corta esquinas y la medición cae en
 * el lugar equivocado. Con los circuitos de hoy eso es barato. **Con veinte deja
 * de serlo**, y la salida no es simplificar esta copia —dos geometrías del mismo
 * circuito acaban usándose la equivocada, que es la divergencia del
 * `CORREDOR_METROS` otra vez— sino servir una geometría de dibujo aparte, por su
 * propio camino, inalcanzable desde cualquier cálculo.
 *
 * ## La salida
 *
 * `?desde=<slug>` es de dónde llegó el pasajero, y lo pone la liga de la vista
 * de la ruta. **Se coteja aquí contra lo publicado**, en el mismo lugar que ya
 * tiene la lista: sin cotejo, una liga armada a mano produciría un botón que
 * dice «Volver a la ruta» y aterriza en un 404.
 */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const desde = typeof sp?.desde === "string" ? sp.desde : null;
  const repos = getRepos();
  const publicados = await repos.circuits.listPublishedCircuits();

  const circuitos: CircuitoParaBuscador[] = (
    await Promise.all(
      publicados.map(async ({ publicSlug }) => {
        const circuito = await repos.circuits.getPublishedCircuitBySlug(publicSlug);
        if (!circuito) return null;
        const [trazados, paradas] = await Promise.all([
          repos.circuits.getPaths(circuito.id),
          repos.circuits.listStopsVigentes(circuito.id),
        ]);
        return {
          slug: circuito.publicSlug,
          nombre: circuito.name,
          color_hex: circuito.colorHex,
          trazados: trazados.map((t) => ({
            sentido: t.sentido,
            coordenadas: t.coordinates as Array<[number, number]>,
          })),
          paradas: paradas.map((p) => ({
            id: p.qrSlug,
            nombre: p.name,
            lat: p.latitude,
            lon: p.longitude,
          })),
        } satisfies CircuitoParaBuscador;
      }),
    )
  ).filter((c): c is CircuitoParaBuscador => c !== null);

  if (circuitos.length === 0) {
    /*
     * Sin rutas publicadas no hay nada que buscar, y **no se finge un buscador
     * vacío**: un campo de texto que nunca encuentra nada se lee como una app
     * rota, no como una app que todavía no cubre la ciudad.
     */
    return (
      <main className="puerta">
        <p className="marca">{process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público"}</p>
        <h1>Todavía no hay rutas publicadas</h1>
        <p>En cuanto haya una, aquí vas a poder ver si te sirve. Estamos creciendo.</p>
        <ul>
          <li>
            <Link href="/">Volver al inicio</Link>
          </li>
        </ul>
      </main>
    );
  }

  return (
    <Buscador
      circuitos={circuitos}
      salida={salidaDelBuscador(desde, circuitos.map((c) => c.slug))}
    />
  );
}
