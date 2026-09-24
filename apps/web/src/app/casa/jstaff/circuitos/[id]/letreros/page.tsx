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
 * ## Sí se imprime de un circuito sin publicar, con su aviso
 *
 * **Decisión de ASAV, 23-sep-2026, que voltea la del punto 6 de la ficha.**
 * Antes esta pantalla no enseñaba hojas de un circuito sin publicar: un letrero
 * que no abre nada es una promesa falsa. El argumento sigue siendo cierto y no
 * alcanzaba, porque le faltaba el calendario: **imprimir, plastificar, repartir
 * y atornillar toma días.** Exigir la publicación antes de imprimir obliga a
 * publicar el circuito —y por lo tanto a prometerle algo a un pasajero— días
 * antes de que haya un solo letrero en un poste.
 *
 * Así que se imprime, y el aviso va **en la pantalla**, donde lo lee quien
 * manda a la impresora y todavía puede decidir. La lámina sale igual.
 *
 * **Lo que NO cambia es lo que contesta el código** mientras el circuito siga
 * sin publicar: `/p/‹qr_slug›` dice «Este letrero todavía no está activo», el
 * mismo texto exacto que un código inventado. Lo no publicado no existe para la
 * app (8.4), y distinguirlo de un slug inventado sería confirmar que existe.
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
        {!circuito.publishedAt && (
          /* En tinta y con su frase, sin cobre: un aviso no es un dato vivo. Y no
             bloquea — imprimir, repartir y pegar toma días. */
          <p role="status" className="mt-4 rounded-lg border border-[var(--linea)] p-3 text-[15px]">
            <span className="font-semibold">«{circuito.name}» todavía no está publicado.</span>{" "}
            Se imprime igual, porque imprimir, repartir y atornillar toma días. Pero hasta que lo
            publiques, un teléfono que escanee estos códigos va a leer «Este letrero todavía no
            está activo» — el mismo texto que un código inventado, para no revelar que la ruta
            existe.
          </p>
        )}
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
