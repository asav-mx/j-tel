import { cargarCatalogo, type TipoDelCatalogo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { Encabezado, Titular, Vacio } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { faltantesEnPalabras, reglaEnPalabras, rutasDelCatalogo } from "@/lib/casa/regla";

export const dynamic = "force-dynamic";

/**
 * El catálogo de documentos de un mercado — J-Staff (D2).
 *
 * Un tipo, una pieza. **Sin glifo**: un tipo del catálogo no es un papel, no
 * vence ni falta; una hoja afirmaría un estado que no tiene. El número es el de
 * sus días de aviso; el apoyo, la regla en una frase, o lo que le falta.
 */
export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const sp = await searchParams;
  const catalogo = await cargarCatalogo(getRepos(), { marketId: typeof sp.mercado === "string" ? sp.mercado : null });

  const grupo = (titulo: string, tipos: TipoDelCatalogo[]) => {
    const completas = tipos.filter((t) => t.faltan.length === 0).length;
    return (
      <section className="flex flex-col gap-2.5" aria-label={titulo}>
        <Encabezado izquierda={`${titulo} · ${tipos.length}`} derecha={`${completas} con regla completa`} />
        {tipos.length === 0 && <Vacio>Este mercado no tiene tipos de este sujeto</Vacio>}
        {tipos.map((t) => {
          const completa = t.faltan.length === 0;
          const frase = reglaEnPalabras(t.regla);
          return (
            <Pieza
              key={t.id}
              nombre={t.nombre}
              apoyo={completa ? frase : t.regla ? `${frase} · falta ${faltantesEnPalabras(t.faltan)}` : "sin regla"}
              dato={t.regla?.vence === true && t.regla.diasDeAviso !== null ? `${t.regla.diasDeAviso} d` : "—"}
              etiqueta={!completa ? (t.regla ? "incompleta" : "sin regla") : t.regla?.vence ? "de aviso" : "no vence"}
              edad={null}
              ficha={rutasDelCatalogo.tipo(t.id)}
            />
          );
        })}
      </section>
    );
  };

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Cuentas y demos" }, { nombre: "Catálogo de documentos" }]} />
        <Titular nombre="Catálogo de documentos" bajo="La ley de cada mercado · la carga J-Staff" />

        {catalogo.mercados.length > 1 && (
          <form method="get" className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="mercado" data-medida className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--tenue)]">
              Mercado
            </label>
            <select
              id="mercado"
              name="mercado"
              defaultValue={catalogo.mercado?.id ?? ""}
              className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3 py-2 text-[14px] text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]"
            >
              {!catalogo.mercado && <option value="">Elige un mercado</option>}
              {catalogo.mercados.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · {m.clave} · {m.cuentas === 1 ? "1 cuenta" : `${m.cuentas} cuentas`}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-[var(--linea)] px-3 py-2 text-[14px] hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
            >
              Ver
            </button>
          </form>
        )}

        {catalogo.mercados.length === 0 && <Vacio>No hay mercados todavía</Vacio>}
        {catalogo.mercado ? (
          <>
            {catalogo.mercados.length === 1 && (
              <p data-medida className="text-[12px] text-[var(--tenue)]">
                Mercado: {catalogo.mercado.nombre} · {catalogo.mercado.clave} ·{" "}
                {catalogo.mercado.cuentas === 1 ? "1 cuenta" : `${catalogo.mercado.cuentas} cuentas`}
              </p>
            )}
            {grupo("Papeles de unidad", catalogo.unidad)}
            {grupo("Papeles de chofer", catalogo.chofer)}
          </>
        ) : (
          catalogo.mercados.length > 1 && <Vacio>Elige un mercado para ver su catálogo</Vacio>
        )}
      </div>
    </Marco>
  );
}
