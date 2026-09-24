import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { LetreroDeParada } from "@/components/casa/letrero-de-parada";

export const dynamic = "force-dynamic";

/**
 * **Los letreros de un circuito**, listos para imprimir.
 *
 * Sin `?parada=`, saca **una hoja por parada vigente**, una por página. Con
 * `?parada=‹qr_slug›`, saca sólo ésa — que es el «Imprimir letrero» de un
 * renglón de la lista.
 *
 * ## Sólo de circuitos publicados
 *
 * Un letrero pegado en la calle que no abre nada es **una promesa falsa**, y
 * quien la lee está parado esperando un camión. Mientras el circuito no esté
 * publicado esta pantalla no enseña hojas: dice por qué y ofrece el camino de
 * vuelta al expediente, donde vive el interruptor.
 *
 * Es la misma frontera que respeta Ontoy al resolver el QR (`/p/‹qr_slug›`): lo
 * no publicado no existe para la app (8.4). Si aquí se pudiera imprimir, la
 * lámina saldría de la impresora prometiendo algo que el servidor niega.
 *
 * ## Sólo las vigentes
 *
 * Una parada retirada no se reimprime. Su letrero viejo, el que ya está en el
 * poste, **sigue funcionando** y dice que la parada salió de servicio — eso lo
 * contesta Ontoy, no esta pantalla.
 */
export default async function LetrerosDelCircuito({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const unaSola = typeof sp.parada === "string" ? sp.parada : null;
  const vuelta = `/casa/jstaff/circuitos/${id}`;

  if (!circuito.publishedAt) {
    return (
      <main className="mx-auto max-w-[21.59cm] px-4 py-10">
        <h1 className="text-[22px] font-semibold">Todavía no se imprime</h1>
        <p className="mt-3 text-[15px] text-[var(--tenue)]">
          «{circuito.name}» no está publicado. Un letrero atornillado a un poste que no abre nada
          es una promesa falsa: quien lo escanea está parado esperando el camión. Publica el
          circuito y vuelve.
        </p>
        <p className="mt-6">
          <Link href={vuelta} className="underline underline-offset-2">
            Volver a {circuito.name}
          </Link>
        </p>
      </main>
    );
  }

  const paradas = await repos.circuits.listStopsVigentes(id);
  const aImprimir = unaSola ? paradas.filter((p) => p.qrSlug === unaSola) : paradas;

  if (aImprimir.length === 0) {
    return (
      <main className="mx-auto max-w-[21.59cm] px-4 py-10">
        <h1 className="text-[22px] font-semibold">No hay nada que imprimir</h1>
        <p className="mt-3 text-[15px] text-[var(--tenue)]">
          {unaSola
            ? "Esa parada no está entre las vigentes de este circuito."
            : "Este circuito todavía no tiene paradas capturadas."}
        </p>
        <p className="mt-6">
          <Link href={vuelta} className="underline underline-offset-2">
            Volver a {circuito.name}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      {/* Lo único que no se imprime: el rótulo y la salida. */}
      <div className="solo-pantalla px-4 pt-8">
        <h1 className="text-[22px] font-semibold">
          {aImprimir.length === 1
            ? `Letrero de ${aImprimir[0]!.name}`
            : `${aImprimir.length} letreros de ${circuito.name}`}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--tenue)]">
          Una hoja por parada, tamaño carta. Imprime con el navegador (⌘P) al 100 %, sin ajustar a
          la página: el código mide 9 cm de lado a propósito, y encogerlo le quita el metro de
          distancia desde el que engancha.
        </p>
        <p className="mt-4">
          <Link href={vuelta} className="underline underline-offset-2">
            Volver a {circuito.name}
          </Link>
        </p>
      </div>

      {aImprimir.map((p) => (
        <LetreroDeParada
          key={p.qrSlug}
          parada={{ nombre: p.name, qrSlug: p.qrSlug }}
          ruta={{ nombre: circuito.name, colorHex: circuito.colorHex }}
        />
      ))}
    </main>
  );
}
