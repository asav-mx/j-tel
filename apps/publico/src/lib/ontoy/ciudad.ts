import { enHorarioDeServicio, yaArrancoElServicio } from "@jtel/domain/publico";
import { proximaFronteraDeLoPublicado } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { promesaConSusFronteras } from "@/lib/promesa";
import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";

/**
 * El nombre de la app, **de configuración y nunca del código**
 * (`NEXT_PUBLIC_APP_NOMBRE=Ontoy`). El mismo que titula la pestaña y nombra la
 * app instalada. Esta app sirve a cualquier concesionario invitado, y hornear un
 * nombre convertiría el alta del siguiente en un despliegue.
 */
export const NOMBRE_DE_LA_APP = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

export interface CiudadPublicada {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /** Hasta cuándo vale lo que dice la lista (ISO); en ese instante se vuelve a pedir. */
  vigenteHasta: string | null;
}

/**
 * **La ciudad publicada**: lo que Ontoy enseña, sea por dónde se entre.
 *
 * Vivía dentro de la portada. Sale aquí porque desde el QR de las paradas hay
 * **dos puertas** a la misma app —`/` y `/p/‹qr_slug›`— y dos copias de esta
 * carga serían dos formas de dejar de coincidir: una ciudad que se ve distinta
 * según por dónde entraste es exactamente el tipo de mentira que el Marco
 * prohíbe.
 *
 * ## Sólo lo publicado
 *
 * `listPublishedCircuits` ya filtra por el interruptor (8.4). La vista previa
 * no entra: existe para mirar UNA ruta nombrándola, no para colarse a la
 * portada.
 *
 * ## Por qué el horario se resuelve en el servidor
 *
 * La escalera de estados la resuelve el servidor y la pantalla lee (8.9). Y hay
 * una razón técnica que empuja igual: `@jtel/domain/publico` usa `node:crypto`
 * y no puede cargarse en el navegador.
 */
export async function ciudadPublicada(): Promise<CiudadPublicada> {
  const publicados = await getRepos().circuits.listPublishedCircuits();
  const ahora = new Date();

  const rutas: RutaDeLaCiudad[] = [];
  const estados: EstadoDeRuta[] = [];
  /*
   * Hasta cuándo vale lo que esta lista dice: la frontera más cercana entre
   * todas las rutas (una franja que empieza o termina, un servicio que abre o
   * cierra, la medianoche). La lista se arma UNA vez; el teléfono la vuelve a
   * pedir justo entonces, para no seguir diciendo la promesa de una franja que
   * ya terminó.
   */
  let vigenteHasta: Date | null = null;

  for (const c of publicados) {
    const circuito = await getRepos().circuits.getPublishedCircuitBySlug(c.publicSlug);
    if (!circuito) continue;
    const trazados = await getRepos().circuits.getPaths(circuito.id);
    const { promesa, horas } = await promesaConSusFronteras(circuito.id, ahora, c.timeZone);
    const frontera = proximaFronteraDeLoPublicado(
      [...horas, c.serviceStartLocal, c.serviceEndLocal],
      ahora,
      c.timeZone,
    );
    if (!vigenteHasta || frontera < vigenteHasta) vigenteHasta = frontera;

    rutas.push({
      circuito_id: c.publicSlug,
      nombre: c.name,
      color_hex: c.colorHex,
      promesa,
      horario: { inicio: c.serviceStartLocal, fin: c.serviceEndLocal, zona: c.timeZone },
      arranca_el: c.serviceLaunchDate,
      trazados: trazados.map((t) => ({
        sentido: t.sentido as Sentido,
        coordenadas: t.coordinates as Array<[number, number]>,
        largo_m: Math.round(t.lengthMeters),
      })),
    });

    const arranco = yaArrancoElServicio(ahora, c.serviceLaunchDate, c.timeZone);
    const abierto = enHorarioDeServicio(ahora, c.serviceStartLocal, c.serviceEndLocal, c.timeZone);
    estados.push({
      circuito_id: c.publicSlug,
      situacion: !arranco ? "por_arrancar" : abierto ? "abierto" : "cerrado",
      abre_a: c.serviceStartLocal.slice(0, 5),
      arranca_el: c.serviceLaunchDate,
    });
  }

  return { rutas, estados, vigenteHasta: vigenteHasta?.toISOString() ?? null };
}
