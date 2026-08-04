import { CarrierShell } from "@/components/unit-shell";
import { resolveAccountByType } from "@/lib/account-context";
import { loadMonitoreoCarrier, SIN_PROGRAMADOS } from "@/lib/monitoreo-carrier-data";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Monitoreo — la sala de control del transportista.
 *
 * Todo en acero: aquí no hay un solo veredicto. El resultado se emite al
 * cierre, y pintar verde o rojo antes de eso sería la pantalla adelantándose al
 * árbitro. El ámbar aparece únicamente en la zona de lo evitable, como aviso
 * del sistema — nunca como falta del transportista.
 *
 * El orden manda: lo que cierra primero va primero. Eso es lo que ningún
 * monitorista humano podía dar — él veía la pantalla, el sistema ve el reloj de
 * todos los contratos a la vez.
 */
export default async function CarrierMonitoreoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de transportista. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const data = await loadMonitoreoCarrier(carrier);

  return (
    <CarrierShell carrier={carrier} title={`${carrier.name} — Monitoreo`}>
      <header>
        <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
          {data.titular}
        </h1>
        <p className="mt-1 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
          {data.fecha} · corte {data.horaCorte} · {data.alcance}
        </p>
      </header>

      {/* La leyenda permanente. Nunca dice "veredicto": vocabulario congelado. */}
      <div className="flex items-center gap-2.5 rounded-sm border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--acero)] motion-safe:animate-pulse"
        />
        <p className="text-[11px] leading-relaxed text-[var(--acero)]">
          Vista en vivo, todos tus contratos. El resultado se emite al cierre.
        </p>
      </div>

      {data.estado === "sin_programados" ? (
        /* Sin servicios programados NO es "todo en orden". Confundirlas le
           diría al transportista que está cumpliendo cuando no hay nada que
           cumplir — la misma distinción de la tira de catorce días. */
        <div className="rounded-xl border border-dashed border-[var(--linea)] p-10 text-center">
          <p className="font-[family-name:var(--fuente-archivo)] text-lg text-[var(--texto)]">
            {SIN_PROGRAMADOS.encabezado}
          </p>
          {data.proximoTurno ? (
            <p className="mt-2 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
              {data.proximoTurno}
            </p>
          ) : null}
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-[var(--tenue)]">
            {SIN_PROGRAMADOS.nota}
          </p>
        </div>
      ) : (
        <>
          {/* Lo que todavía se puede evitar — el corazón, y el lugar del vigía. */}
          <section aria-labelledby="evitable">
            <h2
              id="evitable"
              className="mb-2 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]"
            >
              Lo que todavía se puede evitar
            </h2>
            {data.evitables.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-[var(--b-ambar)] bg-[var(--panel)]">
                <ul className="divide-y divide-[var(--linea-tenue)]">
                  {data.evitables.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                      {e.cliente ? (
                        <span className="rounded-sm border border-[var(--linea-fuerte)] px-1.5 py-0.5 font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--tenue)]">
                          {e.cliente}
                        </span>
                      ) : null}
                      <span className="text-sm text-[var(--texto)]">{e.afirmacion}</span>
                      {/* Todo número con su lectura al lado. */}
                      <span className="font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums text-[var(--acero)]">
                        {e.evidencia}
                      </span>
                      {/* Ámbar solo para la cuenta regresiva: es lo que todavía
                          se puede evitar. Una medición va en acero. */}
                      <span
                        className={`ml-auto font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums ${
                          e.tipoDato === "cuenta_regresiva"
                            ? "text-[var(--ambar)]"
                            : "text-[var(--acero)]"
                        }`}
                      >
                        {e.dato}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* La consecuencia, una sola vez para el bloque — y con el
                    límite declarado, en vez de insinuar un vínculo que el
                    sistema no puede afirmar en vivo. */}
                {data.consecuencia ? (
                  <p className="border-t border-[var(--linea)] bg-[var(--t-ambar)] px-4 py-2.5 text-[11px] leading-relaxed text-[var(--tenue)]">
                    {data.consecuencia}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--linea)] px-4 py-6">
                <p className="text-[11px] leading-relaxed text-[var(--tenue)]">{data.sinEvitables}</p>
              </div>
            )}
          </section>

          {/* La banda. Acero, y lo suyo marcado. */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.banda.map((b) => (
              <div
                key={b.etiqueta}
                className={`rounded-xl border bg-[var(--panel)] px-4 py-3 ${
                  b.propio ? "border-[var(--b-acero)]" : "border-[var(--linea)]"
                }`}
              >
                <dt className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.11em] text-[var(--tenue)]">
                  {b.etiqueta}
                </dt>
                <dd className="mt-1 font-[family-name:var(--fuente-mono)] text-lg tabular-nums text-[var(--acero)]">
                  {b.valor}
                </dd>
                {b.propio ? (
                  <p className="mt-1 text-[10px] text-[var(--tenue)]">solo tú ves esto</p>
                ) : null}
              </div>
            ))}
          </dl>

          {/* La lista, por urgencia: lo que cierra primero va primero. */}
          <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <caption className="sr-only">Servicios del día, ordenados por cuál cierra primero</caption>
              <thead>
                <tr className="border-b border-[var(--linea)]">
                  {["Ruta", "Cliente", "Turno", "Cierra", "Falta"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-3 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)] ${
                        i >= 3 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--linea-tenue)]">
                {data.servicios.map((s) => (
                  <tr key={s.ocurrenciaId} className="transition-colors hover:bg-[var(--hover)]">
                    <td className="px-4 py-2.5 text-[var(--texto)]">{s.ruta}</td>
                    <td className="px-4 py-2.5 text-[var(--tenue)]">{s.cliente}</td>
                    <td className="px-4 py-2.5 text-[var(--tenue)]">{s.turno}</td>
                    <td className="px-4 py-2.5 text-right font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--acero)]">
                      {s.cierreHora}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-[family-name:var(--fuente-mono)] tabular-nums ${
                        s.cerrado
                          ? "text-[var(--tenue)]"
                          : s.minutosParaCierre <= 0
                            ? "text-[var(--ambar)]"
                            : "text-[var(--acero)]"
                      }`}
                    >
                      {s.cerrado
                        ? "cerrado"
                        : s.minutosParaCierre <= 0
                          ? `${Math.abs(s.minutosParaCierre)} min pasados`
                          : `${s.minutosParaCierre} min`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Los renglones que la auditoría dejó fuera. Ninguno en silencio. */}
      <section aria-labelledby="ausentes">
        <h2
          id="ausentes"
          className="mb-2 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]"
        >
          Lo que esta sala todavía no puede decirte
        </h2>
        <dl className="max-w-3xl space-y-2">
          {data.ausentes.map((a) => (
            <div key={a.titulo} className="text-[11px] leading-relaxed">
              <dt className="inline font-[family-name:var(--fuente-mono)] uppercase tracking-[0.08em] text-[var(--tenue)]">
                {a.titulo}
              </dt>
              <dd className="inline text-[var(--tenue)]"> — {a.razon}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="max-w-3xl text-[11px] leading-relaxed text-[var(--tenue)]">
        Para ver hacia atrás, abre el Workbench. Nada de esta pantalla llega a los clientes.
      </p>
    </CarrierShell>
  );
}
