import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepos } from "@/lib/db";
import { Ontoy } from "@/components/ontoy/ontoy";
import { ciudadPublicada } from "@/lib/ontoy/ciudad";

export const dynamic = "force-dynamic";

/**
 * **La puerta del letrero.** `/p/‹qr_slug›` es lo que lleva adentro cada QR
 * atornillado a un poste.
 *
 * ## Por qué esta dirección, y por qué no cambia nunca
 *
 * Es la única pieza de Ontoy que **se imprime en lámina**. Lo impreso no se
 * corrige: el día que esta ruta cambie de forma, cada letrero de la calle se
 * vuelve un callejón. Por eso es corta —un QR con menos puntos engancha más
 * rápido, y quien escanea está parado en la banqueta—, va en el dominio de la
 * plataforma y **no lleva el nombre de ningún transportista**.
 *
 * El `qr_slug` vive en la **identidad** de la parada y no en su versión (0025):
 * si la parada se mueve media cuadra o le cambian el nombre, el letrero sigue
 * sirviendo.
 *
 * ## Los cuatro casos, y ninguno es un 404 mudo
 *
 * | Lo que hay | Lo que contesta |
 * |---|---|
 * | Parada vigente de circuito publicado | Ontoy abierto **en su hoja** |
 * | Parada retirada, circuito publicado | «Ya no está en servicio», con su ruta |
 * | Circuito no publicado | Lo mismo que un slug inventado (8.4) |
 * | Slug que no existe | Lo mismo |
 *
 * Los dos últimos se contestan **igual a propósito**: lo no publicado no existe
 * para la app, y distinguirlo de un slug inventado sería decir que existe.
 *
 * ## La visita no identifica a nadie (8.7)
 *
 * Sin cookie, sin registro de quién escaneó, sin pedir ubicación ni cuenta para
 * abrir. Lo único que se cuenta es la apertura anónima de la ruta, con la misma
 * regla que ya existe — la pone `Ontoy`, no esta puerta.
 */
export default async function PuertaDelLetrero({
  params,
}: {
  params: Promise<{ qrSlug: string }>;
}) {
  const { qrSlug } = await params;
  const parada = await getRepos().circuits.paradaPublicaPorQrSlug(qrSlug);

  /* `null` es el slug inventado Y el circuito sin publicar: la misma pantalla. */
  if (!parada) notFound();

  if (parada.situacion === "retirada") {
    return (
      <main className="puerta">
        <h1>Esta parada ya no está en servicio</h1>
        <p>
          El letrero sigue en el poste, pero la parada se retiró de la ruta{" "}
          <strong>{parada.ruta.nombre}</strong>. Los camiones de esa ruta siguen pasando por sus
          demás paradas.
        </p>
        <ul>
          <li>
            <Link href={`/?ruta=${encodeURIComponent(parada.ruta.slug)}`}>
              Ver la ruta {parada.ruta.nombre}
            </Link>
          </li>
          <li>
            <Link href="/">Ver todas las rutas</Link>
          </li>
        </ul>
      </main>
    );
  }

  const ciudad = await ciudadPublicada();

  return (
    <Ontoy
      rutas={ciudad.rutas}
      estados={ciudad.estados}
      vigenteHasta={ciudad.vigenteHasta}
      rutaInicial={parada.ruta.slug}
      paradaInicial={parada.qrSlug}
    />
  );
}
