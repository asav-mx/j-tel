import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import {
  LetreroDeParada,
  type FormaDeLasEsquinas,
  type FormaDeLosModulos,
} from "@/components/casa/letrero-de-parada";

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
 * ## `?modulos=cuadritos`, para decidir con teléfonos y no con una simulación
 *
 * El diseño 1b lleva los módulos en **puntitos**, y medirlo dice que piden más
 * resolución de cámara que los cuadrados. Cuánto más, lo dice una simulación —y
 * una simulación no decide esto, lo decide un teléfono frente a un poste—. Así
 * que esta pantalla saca **las dos versiones de la misma parada** para poder
 * imprimirlas y probarlas el mismo día (ASAV, 24-sep).
 *
 * **Las tres esquinas van redondeadas en las dos:** son la firma del diseño y no
 * están en discusión. Lo único que cambia es la forma de los módulos de datos.
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
  const modulos: FormaDeLosModulos = sp.modulos === "cuadritos" ? "cuadritos" : "puntitos";
  const esquinasComo: FormaDeLasEsquinas = sp.esquinas === "normales" ? "normales" : "ojos";
  const vuelta = `/casa/jstaff/circuitos/${id}`;
  /*
   * Las tres hojas que hay que imprimir para poder decidir con teléfonos. Son
   * tres y no dos porque los ojos redondeados y los puntitos cuestan por
   * separado, y con dos hojas no se sabría cuál de los dos estorba.
   */
  const VARIANTES: { etiqueta: string; modulos: FormaDeLosModulos; esquinas: FormaDeLasEsquinas }[] = [
    { etiqueta: "puntitos + ojos (el diseño 1b)", modulos: "puntitos", esquinas: "ojos" },
    { etiqueta: "cuadrados + ojos", modulos: "cuadritos", esquinas: "ojos" },
    { etiqueta: "cuadrados + esquinas normales", modulos: "cuadritos", esquinas: "normales" },
  ];
  const liga = (v: { modulos: FormaDeLosModulos; esquinas: FormaDeLasEsquinas }) => {
    const q = new URLSearchParams();
    if (unaSola) q.set("parada", unaSola);
    if (v.modulos === "cuadritos") q.set("modulos", "cuadritos");
    if (v.esquinas === "normales") q.set("esquinas", "normales");
    const cola = q.toString();
    return `/casa/jstaff/circuitos/${id}/letreros${cola ? `?${cola}` : ""}`;
  };

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
          la página: el código mide <strong>13 cm</strong> de lado a propósito, y encogerlo le
          quita el metro de distancia desde el que engancha.
        </p>
        <div className="mt-3 rounded-lg border border-[var(--linea)] p-3 text-[15px]">
          <p className="font-semibold">
            Esta hoja:{" "}
            {VARIANTES.find((v) => v.modulos === modulos && v.esquinas === esquinasComo)?.etiqueta}
          </p>
          <p className="mt-1">
            Imprime <strong>las tres</strong> de la misma parada y pruébalas con teléfonos. Son tres
            y no dos porque los puntitos y los ojos redondeados cuestan por separado: con dos hojas
            no se sabría cuál de los dos estorba.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {VARIANTES.map((v) => {
              const esta = v.modulos === modulos && v.esquinas === esquinasComo;
              return (
                <li key={v.etiqueta}>
                  {esta ? (
                    <span className="text-[var(--tenue)]">{v.etiqueta} — es la que estás viendo</span>
                  ) : (
                    <Link href={liga(v)} className="underline underline-offset-2">
                      {v.etiqueta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
          modulos={modulos}
          esquinasComo={esquinasComo}
        />
      ))}
    </main>
  );
}
