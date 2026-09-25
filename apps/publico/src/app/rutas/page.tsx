import { Ontoy } from "@/components/ontoy/ontoy";
import { ciudadPublicada } from "@/lib/ontoy/ciudad";

export const dynamic = "force-dynamic";

/**
 * La puerta de Ontoy — **abre en la ciudad**, no en un circuito (8.8).
 *
 * Hasta hoy pedía un slug: con un circuito publicado redirigía a él y con varios
 * los listaba por nombre. La Pieza 8 pide otra cosa: dos vistas, Rutas y Mapa,
 * sobre la ciudad entera, porque «la estructura es de la app de la ciudad, no de
 * una cuenta: el pasajero no elige carrier, elige ruta».
 *
 * La carga de la ciudad vive en `lib/ontoy/ciudad.ts`: desde el QR de las
 * paradas hay **dos puertas** a la misma app, y dos copias serían dos formas de
 * dejar de coincidir.
 */
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pedida = (await searchParams).ruta;
  const ciudad = await ciudadPublicada();

  return (
    <Ontoy
      rutas={ciudad.rutas}
      estados={ciudad.estados}
      vigenteHasta={ciudad.vigenteHasta}
      rutaInicial={typeof pedida === "string" ? pedida : null}
      paradaInicial={null}
    />
  );
}
