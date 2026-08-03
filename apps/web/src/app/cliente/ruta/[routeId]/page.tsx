import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { RutaTrazadoMapa } from "@/components/ruta-trazado-mapa";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { DIAS_DEL_PERIODO, loadExpedienteRuta } from "@/lib/expediente-ruta-data";

export const dynamic = "force-dynamic";

/**
 * Expediente de la ruta — *¿qué se acordó recorrer, y cómo se ha comportado?*
 *
 * Cara cliente. **Nada de la unidad ni del chofer**: una ruta la cubren
 * distintas unidades, y eso es operación interna del transportista.
 *
 * Los tres colores de veredicto aparecen en dos lugares y solo dos: los
 * cuadritos del periodo y el chip de cada servicio, que son resultados
 * sellados. Toda medición —km, corredor, tolerancia, cobertura— va en acero.
 */

const MONO = "font-[family-name:var(--fuente-mono)]";
const SECCION = `mb-2 ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]`;

/** El color de un día: el peor resultado NO manda — manda si hubo falta. */
function claseDeDia(d: {
  cumplidos: number;
  noCumplidos: number;
  pendientes: number;
  sinSellar: number;
}): string {
  if (d.noCumplidos > 0) return "bg-[var(--t-rojo)] border-[var(--b-rojo)]";
  if (d.pendientes > 0) return "bg-[var(--t-ambar)] border-[var(--b-ambar)]";
  if (d.cumplidos > 0) return "bg-[var(--t-verde)] border-[var(--b-verde)]";
  return "bg-transparent border-[var(--linea)]";
}

export default async function ExpedienteRutaPage({
  params,
  searchParams,
}: {
  params: Promise<{ routeId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { routeId } = await params;
  const cliente = await resolveAccountByType("client", searchParams);
  if (!cliente) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const d = await loadExpedienteRuta(cliente, routeId);
  if (!d) notFound();

  const enlace = (ruta: string) => withAccount(ruta, cliente.slug);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AppNav
          title={`Ruta — ${d.ruta.nombre}`}
          links={[
            { href: enlace("/cliente"), label: "Inicio" },
            { href: enlace("/cliente/configuracion/rutas"), label: "Rutas y turnos" },
          ]}
        />

        <header>
          <nav className={`${MONO} text-[10.5px] text-[var(--tenue)]`} aria-label="Migas">
            <Link
              href={enlace("/cliente/configuracion/rutas")}
              className="hover:text-[var(--azul)] hover:underline"
            >
              Rutas y turnos
            </Link>
            <span aria-hidden> › </span>
            <span className="text-[var(--texto)]">{d.ruta.nombre}</span>
          </nav>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
              {d.ruta.nombre}
            </h1>
            <span className={`ml-auto ${MONO} flex items-center gap-3 text-[11px] tabular-nums text-[var(--tenue)]`}>
              {d.hermanas.anterior ? (
                <Link
                  href={enlace(`/cliente/ruta/${d.hermanas.anterior.id}`)}
                  className="hover:text-[var(--azul)] hover:underline"
                >
                  ‹ {d.hermanas.anterior.nombre}
                </Link>
              ) : null}
              <span>
                {d.hermanas.indice} de {d.hermanas.total}
              </span>
              {d.hermanas.siguiente ? (
                <Link
                  href={enlace(`/cliente/ruta/${d.hermanas.siguiente.id}`)}
                  className="hover:text-[var(--azul)] hover:underline"
                >
                  {d.hermanas.siguiente.nombre} ›
                </Link>
              ) : null}
            </span>
          </div>
        </header>

        {/* ── Identidad ─────────────────────────────────────────────────── */}
        <section aria-labelledby="identidad">
          <h2 id="identidad" className={SECCION}>
            Qué es esta ruta
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {d.identidad.map((x) => (
              <div
                key={x.etiqueta}
                className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] px-4 py-3"
              >
                <dt className={`${MONO} text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]`}>
                  {x.etiqueta}
                </dt>
                <dd
                  className={`mt-1 ${MONO} text-sm tabular-nums ${
                    x.valor.startsWith("sin ") ? "text-[var(--tenue)]" : "text-[var(--acero)]"
                  }`}
                >
                  {x.valor}
                </dd>
                {x.lectura ? (
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--tenue)]">{x.lectura}</p>
                ) : null}
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--tenue)]">
            La configuración vigente · cambiarla no reescribe hechos pasados.
          </p>
        </section>

        {/* ── El trazado contratado ─────────────────────────────────────── */}
        <section aria-labelledby="trazado">
          <h2 id="trazado" className={SECCION}>
            El trazado contratado
          </h2>
          <RutaTrazadoMapa
            puntos={d.trazado.puntos}
            corredorMetros={d.trazado.corredorMetros}
            geocercas={d.geocercas}
          />
        </section>

        {/* ── El bloque reservado por la compuerta. NO se esconde. ──────── */}
        <section aria-labelledby="metricas">
          <h2 id="metricas" className={SECCION}>
            Cumplimiento, margen y cobertura del periodo
          </h2>
          <div className="rounded-xl border border-dashed border-[var(--linea)] px-4 py-6">
            <p className="mx-auto max-w-2xl text-center text-[11.5px] leading-relaxed text-[var(--tenue)]">
              {d.compuerta}
            </p>
          </div>
        </section>

        {/* ── El periodo día por día ────────────────────────────────────── */}
        <section aria-labelledby="periodo">
          <h2 id="periodo" className={SECCION}>
            Los últimos {DIAS_DEL_PERIODO} días
          </h2>
          {d.dias.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {d.dias.map((dia) => (
                  <span
                    key={dia.fecha}
                    className={`h-7 w-7 rounded-[2px] border ${claseDeDia(dia)}`}
                    /* Un día mixto conserva sus cifras: colapsarlo al peor
                       resultado borraría la magnitud, que es lo que la tira
                       existe para comparar (§D, eje REDUCCIÓN). */
                    title={`${dia.fecha} · ${dia.cumplidos} cumplidos · ${dia.noCumplidos} no cumplidos · ${dia.pendientes} pendientes${dia.sinSellar > 0 ? ` · ${dia.sinSellar} sin sellar` : ""}`}
                  />
                ))}
              </div>
              <p className={`mt-2 ${MONO} text-[10.5px] tabular-nums text-[var(--tenue)]`}>
                Un cuadro por día con servicios. El color marca si hubo una falta, no cuántas —
                pasa el cursor para ver las cifras del día.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--linea)] px-4 py-4 text-[11px] text-[var(--tenue)]">
              Esta ruta no tiene servicios programados en el periodo.
            </p>
          )}
        </section>

        {/* ── Últimos servicios ─────────────────────────────────────────── */}
        <section aria-labelledby="servicios">
          <h2 id="servicios" className={SECCION}>
            Últimos servicios
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--linea)]">
                  {["Fecha", "Turno", "Cierre", "Llegada", "Motivo medido", "Resultado"].map(
                    (h) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-4 py-2.5 text-left ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--linea-tenue)]">
                {d.servicios.map((s) => (
                  <tr key={s.ocurrenciaId} className="transition-colors hover:bg-[var(--hover)]">
                    <td className={`px-4 py-2 ${MONO} tabular-nums text-[var(--tenue)]`}>
                      <Link
                        href={enlace(`/cliente/servicio/${s.ocurrenciaId}`)}
                        className="hover:text-[var(--azul)] hover:underline"
                      >
                        {s.fecha}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-[var(--texto)]">{s.turno}</td>
                    <td className={`px-4 py-2 ${MONO} tabular-nums text-[var(--acero)]`}>
                      {s.cierre}
                    </td>
                    <td className={`px-4 py-2 ${MONO} tabular-nums text-[var(--acero)]`}>
                      {s.llegada ?? <span className="text-[var(--tenue)]">—</span>}
                    </td>
                    <td className={`px-4 py-2 ${MONO} text-[11px] text-[var(--acero)]`}>
                      {s.motivo ?? <span className="text-[var(--tenue)]">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-[2px] border px-2 py-[2px] ${MONO} text-[9.5px] font-medium uppercase tracking-[0.13em] ${
                          s.resultado === "cumplido"
                            ? "border-[var(--b-verde)] bg-[var(--t-verde)] text-[var(--verde)]"
                            : s.resultado === "no_cumplido"
                              ? "border-[var(--b-rojo)] bg-[var(--t-rojo)] text-[var(--rojo)]"
                              : s.resultado === "pendiente"
                                ? "border-[var(--b-ambar)] bg-[var(--t-ambar)] text-[var(--ambar)]"
                                : "border-[var(--linea)] text-[var(--tenue)]"
                        }`}
                      >
                        {s.resultado === "cumplido"
                          ? "Cumplido"
                          : s.resultado === "no_cumplido"
                            ? "No cumplido"
                            : s.resultado === "pendiente"
                              ? "Pendiente por evidencia"
                              : "Sin sellar"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Ausencias declaradas ──────────────────────────────────────── */}
        <section aria-labelledby="ausentes">
          <h2 id="ausentes" className={SECCION}>
            Lo que este expediente todavía no muestra
          </h2>
          <dl className="max-w-3xl space-y-2">
            {d.ausentes.map((a) => (
              <div key={a.titulo} className="text-[11px] leading-relaxed">
                <dt className={`inline ${MONO} uppercase tracking-[0.08em] text-[var(--tenue)]`}>
                  {a.titulo}
                </dt>
                <dd className="inline text-[var(--tenue)]"> — {a.razon}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
