import Link from "next/link";
import { CarrierShell } from "@/components/unit-shell";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadInicioCarrier } from "@/lib/inicio-carrier-data";

export const dynamic = "force-dynamic";

/**
 * Inicio del transportista — lo que necesita atención hoy.
 *
 * La bandeja manda: es lo que el usuario vino a ver. Los widgets acompañan y
 * nunca la superan — si crecen más que ella, la pantalla se vuelve el tablero
 * de monitoreo que el producto existe para eliminar.
 *
 * Sin cifras de cumplimiento: esas esperan a Ola 3 y su espacio va declarado,
 * no escondido.
 */
export default async function CarrierInicioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de transportista. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const data = await loadInicioCarrier(carrier);

  const tono = {
    acero: { marca: "bg-[var(--t-acero2)] text-[var(--acero)]", borde: "border-[var(--b-acero)]" },
    ambar: { marca: "bg-[var(--t-ambar)] text-[var(--ambar)]", borde: "border-[var(--b-ambar)]" },
    rojo: { marca: "bg-[var(--t-rojo)] text-[var(--rojo)]", borde: "border-[var(--b-rojo)]" },
  } as const;

  return (
    <CarrierShell carrier={carrier} title={`${data.nombre} — Inicio`}>
      <header>
        <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
          {data.titular}
        </h1>
        <p className="mt-1 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
          {data.contexto}
        </p>
      </header>

      {/* La bandeja — la zona dominante. */}
      <section className="rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--linea)] px-5 py-3">
          <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
            Bandeja
          </h2>
          <span className="font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
            {data.bandeja.length} abierto{data.bandeja.length === 1 ? "" : "s"}
          </span>
        </div>

        {data.bandeja.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--tenue)]">
            Nada abierto. Cuando algo necesite tu atención, aparece aquí.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--linea-tenue)]">
            {data.bandeja.map((r) => (
              <li key={r.clave} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded-sm border font-[family-name:var(--fuente-mono)] text-sm tabular-nums ${tono[r.tono].marca} ${tono[r.tono].borde}`}
                >
                  {r.cifra}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--texto)]">{r.afirmacion}</p>
                  <p className="mt-0.5 font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums text-[var(--tenue)]">
                    {r.detalle}
                  </p>
                </div>
                {r.accion ? (
                  <Link
                    href={r.accion.href}
                    className="shrink-0 rounded-sm border border-[var(--linea-fuerte)] px-3 py-1.5 text-xs text-[var(--azul)] transition-colors hover:bg-[var(--hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--azul)]"
                  >
                    {r.accion.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Los widgets — acompañan, nunca dominan. */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5">
          <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
            Flota
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Unidades", data.flota.unidades],
                ["Rastreadores", data.flota.conRastreador],
                ["Sin reportar", data.flota.mudas],
                ["Nunca reportaron", data.flota.nuncaReportaron],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="text-[10.5px] text-[var(--tenue)]">{etiqueta}</dt>
                <dd className="font-[family-name:var(--fuente-mono)] text-xl tabular-nums text-[var(--acero)]">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--tenue)]">
            &quot;Nunca reportaron&quot; y &quot;sin reportar&quot; son cosas distintas: la primera
            es un alta sin rastreador funcionando, la segunda un rastreador que se calló.
          </p>
          <Link
            href={withAccount("/carrier/flota", carrier.slug)}
            className="mt-3 inline-block text-xs text-[var(--azul)] hover:underline"
          >
            Ver unidades →
          </Link>
        </section>

        <section className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-5">
          <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
            Mis clientes
          </h2>
          {data.clientes.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--tenue)]">
              Sin contratos activos. El cliente los crea en su configuración.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {data.clientes.map((c) => (
                <li key={c.contratoId} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--texto)]">{c.cliente}</span>
                    <span className="block truncate text-[11px] text-[var(--tenue)]">
                      {c.sitio}
                    </span>
                  </span>
                  <Link
                    href={c.href}
                    className="shrink-0 font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums text-[var(--azul)] hover:underline"
                  >
                    {c.pendientes} pendiente{c.pendientes === 1 ? "" : "s"} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Lo que espera a otro módulo. Se ve, se entiende, no se entra. */}
      <section className="rounded-xl border border-dashed border-[var(--linea)] p-5">
        <h2 className="font-[family-name:var(--fuente-mono)] text-[10.5px] uppercase tracking-[0.11em] text-[var(--tenue)]">
          Reservado
        </h2>
        <ul className="mt-3 space-y-3">
          {data.reservados.map((r) => (
            <li key={r.titulo}>
              <p className="text-sm text-[var(--tenue)]">{r.titulo}</p>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-[var(--tenue)] opacity-80">
                {r.razon}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </CarrierShell>
  );
}
