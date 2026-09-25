import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tituloDelQr } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { DescargarPdf } from "@/components/casa/descargar-pdf";
import { LaminaDeParada } from "@/components/casa/lamina-de-parada";
import {
  LetreroDeParada,
  varianteEnElTitulo,
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
 * sin publicar: `/p/‹qr_slug›` dice «Este QR todavía no está activo», el
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
/** Cómo se leen los dos parámetros del dibujo. Una sola lectura para los dos usos. */
function dibujoPedido(sp: Record<string, string | string[] | undefined>) {
  const modulos: FormaDeLosModulos = sp.modulos === "cuadritos" ? "cuadritos" : "puntitos";
  const esquinas: FormaDeLasEsquinas = sp.esquinas === "normales" ? "normales" : "ojos";
  return { modulos, esquinas };
}

/**
 * **Carta o lámina.** Son dos piezas distintas, no dos tamaños de la misma:
 *
 * - **Carta** es la que se imprime en una oficina y se pega hoy.
 * - **Lámina** es la de 40 × 60 cm que va a una imprenta y **se atornilla al
 *   poste**. De ahí que no lleve frecuencia: dura años y la promesa cambia por
 *   franja horaria.
 *
 * Carta sigue siendo lo que sale sin pedir nada, porque es lo que alguien
 * necesita el día que captura un circuito. La lámina se pide.
 *
 * ⚠ **El dibujo del código por omisión NO es el mismo en las dos.** La carta
 * sale con los puntitos del 1b; la lámina, con cuadrados. Está medido en
 * `lamina-de-parada.tsx`: con puntitos, jsQR lee 1 de 5 tamaños; con cuadrados,
 * 5 de 5. La carta se reimprime el mismo día; la lámina se atornilla por años.
 */
type Formato = "carta" | "lamina";

const formatoPedido = (sp: Record<string, string | string[] | undefined>): Formato =>
  sp.formato === "lamina" ? "lamina" : "carta";

/**
 * El circuito y las paradas que toca imprimir.
 *
 * Va envuelto en `cache` porque lo piden **dos** veces en la misma petición: el
 * título de la página (`generateMetadata`) y la página. Sin esto, cada impresión
 * haría las consultas dos veces; y separarlos en dos lecturas distintas sería
 * peor —el filtro de «sólo esta parada» viviría copiado, y el día que cambie, el
 * título dejaría de decir lo que la hoja enseña.
 */
const loQueSeImprime = cache(async (id: string, unaSola: string | null) => {
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return null;
  const paradas = await repos.circuits.listStopsVigentes(id);
  const aImprimir = unaSola ? paradas.filter((p) => p.qrSlug === unaSola) : paradas;
  return { circuito, aImprimir };
});

const laParadaPedida = (sp: Record<string, string | string[] | undefined>) =>
  typeof sp.parada === "string" ? sp.parada : null;

/**
 * **El título de la página, que es el nombre del archivo PDF.**
 *
 * El navegador saca de aquí el nombre que sugiere al guardar y el título que va
 * dentro del PDF. Sin esto heredaba el de toda la casa, y a la imprenta le
 * llegaban dieciocho archivos «JTEL — Verificación de Transporte» indistinguibles.
 *
 * El formato lo decide el dominio (`tituloDelQr`); aquí sólo se junta el dato.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const unaSola = laParadaPedida(sp);
  const datos = await loQueSeImprime(id, unaSola);
  if (!datos || datos.aImprimir.length === 0) return {};
  const { modulos, esquinas } = dibujoPedido(sp);
  return {
    title: tituloDelQr({
      circuito: datos.circuito.name,
      parada: datos.aImprimir.length === 1 ? datos.aImprimir[0]!.name : undefined,
      cuantasParadas: datos.aImprimir.length,
      variante: varianteEnElTitulo(modulos, esquinas),
    }),
  };
}

export default async function LetrerosDelCircuito({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const unaSola = laParadaPedida(sp);
  const datos = await loQueSeImprime(id, unaSola);
  if (!datos) notFound();
  const { circuito, aImprimir } = datos;

  const { modulos, esquinas: esquinasComo } = dibujoPedido(sp);
  const formato = formatoPedido(sp);
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
    if (formato === "lamina") q.set("formato", "lamina");
    const cola = q.toString();
    return `/casa/jstaff/circuitos/${id}/letreros${cola ? `?${cola}` : ""}`;
  };

  if (aImprimir.length === 0) {
    return (
      <main className="mx-auto max-w-[21.59cm] px-4 py-10">
        <h1 className="text-[22px] font-semibold">No hay ningún QR que imprimir</h1>
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
          {formato === "lamina" ? "Láminas" : "QR"}
          {aImprimir.length === 1
            ? ` de ${aImprimir[0]!.name}`
            : `: ${aImprimir.length} de ${circuito.name}`}
        </h1>
        {formato === "lamina" ? (
          <p className="mt-2 text-[15px] text-[var(--tenue)]">
            La <strong>lámina de 40 × 60 cm</strong>, una por parada. Es la que va a la imprenta y{" "}
            <strong>se atornilla al poste</strong>. El PDF sale{" "}
            <strong>vectorial y al tamaño real</strong>: al guardarlo, no uses «ajustar a la
            página». Su código va en <strong>cuadrados</strong> y no en los puntitos del 1b, porque
            medido con jsQR los puntitos se leen en 1 de 5 tamaños y los cuadrados en 5 de 5 — y
            esto dura años.
          </p>
        ) : (
          <p className="mt-2 text-[15px] text-[var(--tenue)]">
            Una hoja por parada, tamaño carta, <strong>una página por parada</strong>. El código mide{" "}
            <strong>13 cm</strong> de lado a propósito: al imprimir va al <strong>100 %</strong>, sin
            «ajustar a la página», porque encogerlo le quita el metro de distancia desde el que
            engancha.
          </p>
        )}

        {/*
          Los dos formatos. No son dos tamaños de lo mismo: la carta se imprime
          en una oficina y se pega hoy; la lámina va a una imprenta, dura años y
          por eso NO lleva frecuencia — la promesa cambia por franja y una lámina
          no se corrige con un despliegue.
        */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[15px]">
          <span className="font-semibold">Formato:</span>
          {(
            [
              { id: "carta", que: "Carta — para imprimir y pegar hoy" },
              { id: "lamina", que: "Lámina 40 × 60 cm — para la imprenta" },
            ] as const
          ).map((f) => {
            const q = new URLSearchParams();
            if (unaSola) q.set("parada", unaSola);
            if (typeof sp.modulos === "string") q.set("modulos", sp.modulos);
            if (esquinasComo === "normales") q.set("esquinas", "normales");
            if (f.id === "lamina") q.set("formato", "lamina");
            const cola = q.toString();
            return f.id === formato ? (
              <span key={f.id} className="text-[var(--tenue)]">
                {f.que} — es el que estás viendo
              </span>
            ) : (
              <Link
                key={f.id}
                href={`/casa/jstaff/circuitos/${id}/letreros${cola ? `?${cola}` : ""}`}
                className="underline underline-offset-2"
              >
                {f.que}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <DescargarPdf que={aImprimir.length === 1 ? "de esta parada" : "de las " + aImprimir.length} />
          <span className="text-[14px] text-[var(--tenue)]">
            Se abre el diálogo de impresión: escoge «Guardar como PDF». Es el archivo que pide la
            imprenta — vectorial, tamaño carta, con la letra incrustada.
          </span>
        </div>
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
            publiques, un teléfono que escanee estos códigos va a leer «Este QR todavía no está
            activo» — el mismo texto que un código inventado, para no revelar que la ruta
            existe.
          </p>
        )}
        <p className="mt-4">
          <Link href={vuelta} className="underline underline-offset-2">
            Volver a {circuito.name}
          </Link>
        </p>
      </div>

      {aImprimir.map((p) =>
        formato === "lamina" ? (
          <LaminaDeParada
            key={p.qrSlug}
            parada={{ nombre: p.name, qrSlug: p.qrSlug }}
            ruta={{ nombre: circuito.name, colorHex: circuito.colorHex }}
            /*
             * Sin `modulos`: la lámina trae su propio valor por omisión
             * —cuadrados, que es el que se lee— y pasarle el de la carta se lo
             * quitaría sin que nadie lo pidiera. Quien quiera otro lo pide con
             * `?modulos=`, y entonces sí llega.
             */
            {...(sp.modulos ? { modulos } : {})}
            esquinasComo={esquinasComo}
          />
        ) : (
          <LetreroDeParada
            key={p.qrSlug}
            parada={{ nombre: p.name, qrSlug: p.qrSlug }}
            ruta={{ nombre: circuito.name, colorHex: circuito.colorHex }}
            modulos={modulos}
            esquinasComo={esquinasComo}
          />
        ),
      )}
    </main>
  );
}
