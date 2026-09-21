import { enHorarioDeServicio, yaArrancoElServicio } from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { promesaDelCircuito } from "@/lib/promesa";
import { Ontoy } from "@/components/ontoy/ontoy";
import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { EstadoDeRuta } from "@/components/ontoy/vista-rutas";

export const dynamic = "force-dynamic";

/**
 * El nombre de la app, **de configuración y nunca del código**
 * (`NEXT_PUBLIC_APP_NOMBRE=Ontoy`). El mismo que titula la pestaña y nombra la
 * app instalada. Esta app sirve a cualquier concesionario invitado, y hornear un
 * nombre convertiría el alta del siguiente en un despliegue.
 */
const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

/**
 * La puerta de Ontoy — **abre en la ciudad**, no en un circuito (8.8).
 *
 * Hasta hoy pedía un slug: con un circuito publicado redirigía a él y con varios
 * los listaba por nombre. La Pieza 8 pide otra cosa: dos vistas, Rutas y Mapa,
 * sobre la ciudad entera, porque «la estructura es de la app de la ciudad, no de
 * una cuenta: el pasajero no elige carrier, elige ruta».
 *
 * ## Por qué el horario se resuelve AQUÍ
 *
 * La escalera de estados la resuelve el servidor y la pantalla lee (8.9). Y hay
 * una razón técnica que empuja en el mismo sentido: `@jtel/domain/publico` usa
 * `node:crypto` y no puede cargarse en el navegador. Resolverlo aquí evita las
 * dos cosas que salen mal — una segunda definición del horario en el teléfono, y
 * un build roto.
 *
 * ## Sólo lo publicado
 *
 * `listPublishedCircuits` ya filtra por el interruptor de publicación (8.4). La
 * vista previa **no entra aquí**: existe para mirar UNA ruta nombrándola, no
 * para colarse a la portada.
 */
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pedida = (await searchParams).ruta;
  const publicados = await getRepos().circuits.listPublishedCircuits();
  const ahora = new Date();

  const rutas: RutaDeLaCiudad[] = [];
  const estados: EstadoDeRuta[] = [];

  for (const c of publicados) {
    const circuito = await getRepos().circuits.getPublishedCircuitBySlug(c.publicSlug);
    if (!circuito) continue;
    const trazados = await getRepos().circuits.getPaths(circuito.id);

    rutas.push({
      circuito_id: c.publicSlug,
      nombre: c.name,
      color_hex: c.colorHex,
      promesa: await promesaDelCircuito(circuito.id, ahora, c.timeZone),
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

  return (
    <Ontoy
      nombre={NOMBRE}
      rutas={rutas}
      estados={estados}
      rutaInicial={typeof pedida === "string" ? pedida : null}
    />
  );
}
