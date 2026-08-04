/**
 * Por dónde se entra al microscopio: elegir el servicio a diagnosticar.
 *
 * El orden no es cronológico a propósito. Un diagnóstico se abre para
 * entender un problema, así que primero va lo que quedó en contra o sin
 * resolver, y los cumplidos hasta abajo. La lista es una fila de espera de
 * casos, no un archivo.
 */

import Link from "next/link";
import { AppNav } from "@/components/ui";
import { getRepos } from "@/lib/db";
import { listarParaDiagnostico } from "@/lib/diagnostico-data";
import { addDaysIso, isIsoDate, todayIso } from "@/lib/date-range";
import { fechaDeIsoSinAnio } from "@/lib/formato-tiempo";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

const DIAS_POR_DEFECTO = 7;

export default async function IndiceDeDiagnosticoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // La comprobación va cerca del dato: un layout no se re-renderiza
  // al navegar entre rutas hermanas, así que como única guardia es frágil.
  await exigirEnPagina({ tipo: "jstaff" });

  const sp = searchParams ? await searchParams : undefined;
  const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const repos = getRepos();
  const clientes = await repos.accounts.listByType("client");
  const contratos = (
    await Promise.all(clientes.map((c) => repos.contracts.findForClient(c.id)))
  ).flat();

  const contratoId = primero(sp?.contrato) ?? contratos[0]?.id ?? null;
  const hastaCrudo = primero(sp?.hasta);
  const desdeCrudo = primero(sp?.desde);
  const hasta = isIsoDate(hastaCrudo) ? hastaCrudo : todayIso();
  const desde = isIsoDate(desdeCrudo) ? desdeCrudo : addDaysIso(hasta, -DIAS_POR_DEFECTO);

  const lista = contratoId
    ? await listarParaDiagnostico({ contractId: contratoId, desde, hasta })
    : null;
  const filas = lista?.filas ?? [];

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <AppNav
          title="Diagnóstico del motor"
          links={[
            { href: "/jstaff", label: "← Panel" },
            { href: "/jstaff/verificacion", label: "Salud y recall" },
          ]}
        />

        <p className="rounded-sm border border-dashed border-[var(--azul)]/45 px-4 py-2.5 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--azul)]">
          Superficie interna. Abre un servicio para ver qué midió el árbitro y por qué
          decidió lo que decidió.
        </p>

        <form method="get" className="grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]">
          <label className="block">
            <span className="text-[var(--tenue)]">Contrato</span>
            <select
              name="contrato"
              defaultValue={contratoId ?? ""}
              className="mt-1 w-full rounded-sm border border-[var(--linea)] bg-[var(--fondo)] px-3 py-2 text-[var(--texto)]"
            >
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[var(--tenue)]">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="mt-1 w-full rounded-sm border border-[var(--linea)] bg-[var(--fondo)] px-3 py-2 font-[family-name:var(--fuente-mono)] text-[var(--texto)]"
            />
          </label>
          <label className="block">
            <span className="text-[var(--tenue)]">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="mt-1 w-full rounded-sm border border-[var(--linea)] bg-[var(--fondo)] px-3 py-2 font-[family-name:var(--fuente-mono)] text-[var(--texto)]"
            />
          </label>
          <button
            type="submit"
            className="mt-6 h-fit rounded-sm border border-[var(--azul)] px-4 py-2 font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--azul)]"
          >
            Ver
          </button>
        </form>

        {contratoId == null ? (
          <p className="text-sm text-[var(--tenue)]">No hay contratos que diagnosticar.</p>
        ) : (
          <>
            <p className="font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--tenue)]">
              {lista!.conteos.total} servicios · {lista!.conteos.noCumplido} no cumplido ·{" "}
              {lista!.conteos.pendiente} pendiente · {lista!.conteos.cumplido} cumplido
              {lista!.omitidos > 0 && (
                // El tope se dice. Un conteo del periodo junto a una lista
                // recortada, sin avisar, se lee como si la lista fuera todo.
                <> · se listan los primeros {filas.length}, faltan {lista!.omitidos}</>
              )}
            </p>

            <ul className="divide-y divide-[var(--linea)] border-y border-[var(--linea)]">
              {filas.map((f) => (
                <li key={f.occurrenceId}>
                  <Link
                    href={`/jstaff/diagnostico/${f.occurrenceId}`}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 hover:bg-[var(--panel)]"
                  >
                    <span className="w-28 font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--tenue)]">
                      {fechaDeIsoSinAnio(f.fecha)}
                    </span>
                    <span className="flex-1 text-[13px] text-[var(--texto)]">
                      {f.ruta} · {f.turno}
                    </span>
                    <span className="w-44 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--tenue)]">
                      {etiquetaDeEstado(f.estado)}
                      {f.timing ? ` · ${f.timing}` : ""}
                    </span>
                    <span className="w-20 text-right font-[family-name:var(--fuente-mono)] text-[11.5px] tabular-nums text-[var(--acero)]">
                      {f.matchPct == null ? "—" : `${f.matchPct.toFixed(1)}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {filas.length === 0 && (
              <p className="text-sm text-[var(--tenue)]">
                Sin servicios en ese periodo para este contrato.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * El estado, escrito. En texto y no en color: la lista es de navegación, no
 * de veredictos, y los tres colores se guardan para donde se emite el hecho.
 */
function etiquetaDeEstado(estado: string): string {
  switch (estado) {
    case "cumplido":
      return "cumplido";
    case "no_cumplido":
      return "no cumplido";
    case "pendiente_evidencia":
      return "pendiente por evidencia";
    default:
      return "sin hecho sellado";
  }
}
