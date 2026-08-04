import { CarrierShell } from "@/components/unit-shell";
import { WorkbenchLienzo } from "@/components/workbench-lienzo";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { JTTEL_TZ } from "@jtel/domain";
import { colorDeIdentidad } from "@/lib/colores-identidad";
import { loadWorkbench, MAX_UNIDADES, type ServicioEnRango } from "@/lib/workbench-data";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Workbench — el instrumento de análisis y de defensa del transportista.
 *
 * Monitoreo mira el ahora; esta pantalla mira hacia atrás. El corte es por
 * tiempo y no por objeto: cualquier pregunta sobre el pasado vive aquí, sobre
 * el mismo lienzo, con el contexto ya cargado según por dónde se entró.
 *
 * **Todo en acero.** Los tres colores de veredicto aparecen en un solo lugar —
 * la lista de servicios, donde sí hay un resultado sellado que nombrar— y el
 * ámbar del mapa marca lo que quedó sin ver, nunca una falta.
 */
export default async function CarrierWorkbenchPage({
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

  const sp = searchParams ? await searchParams : undefined;
  const data = await loadWorkbench(carrier, sp);

  const seleccionadas = new Set(data.unidades.map((u) => u.unitId));

  /** Arma un enlace conservando la composición y cambiando una sola cosa. */
  const href = (cambio: {
    unidades?: string[];
    desde?: string;
    hasta?: string;
    servicio?: string | null;
  }) => {
    const q = new URLSearchParams();
    for (const id of cambio.unidades ?? [...seleccionadas]) q.append("unidad", id);
    q.set("desde", cambio.desde ?? data.rango.desde);
    q.set("hasta", cambio.hasta ?? data.rango.hasta);
    const servicio =
      cambio.servicio === null
        ? null
        : (cambio.servicio ?? data.servicioAbierto?.ocurrenciaId ?? null);
    if (servicio) q.set("servicio", servicio);
    if (data.paradaUmbralMinutos !== 5) q.set("parada", String(data.paradaUmbralMinutos));
    return withAccount(`/carrier/recorrido?${q.toString()}`, carrier.slug);
  };

  const disputables = data.servicios.filter(
    (s) => s.resultado === "no_cumplido" || s.resultado === "pendiente",
  );

  return (
    <CarrierShell carrier={carrier} title={`${carrier.name} — Workbench`}>
      <header>
        <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
          {data.titular}
        </h1>
        <p className="mt-1 font-[family-name:var(--fuente-mono)] text-xs tabular-nums text-[var(--tenue)]">
          {data.subtitulo}
          {data.alcance ? ` · ${data.alcance}` : null}
        </p>
      </header>

      {/* ── La barra de composición: DOS campos, no más ────────────────────
          Toda la programabilidad de la v1. Está pensada para que agregar una
          dimensión después sea agregar un campo, no rehacer la pantalla. */}
      <section
        aria-labelledby="composicion"
        className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-4"
      >
        <h2 id="composicion" className="sr-only">
          Composición del lienzo
        </h2>

        <div className="grid gap-4 min-[820px]:grid-cols-[1fr_auto]">
          <div>
            <p className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]">
              Quién
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {data.unidades.map((u) => (
                <a
                  key={u.unitId}
                  href={href({ unidades: [...seleccionadas].filter((id) => id !== u.unitId) })}
                  className="flex items-center gap-1.5 rounded-sm border border-[var(--linea-fuerte)] px-2 py-0.5 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--texto)] transition-colors hover:border-[var(--azul)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
                  aria-label={`Quitar ${u.label} del lienzo`}
                >
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-[1px]"
                    style={{ backgroundColor: colorDeIdentidad(u.colorIndex) }}
                  />
                  {u.label}
                  <span className="text-[var(--tenue)]">×</span>
                </a>
              ))}
              {data.unidades.length === 0 ? (
                <span className="text-[11px] text-[var(--tenue)]">
                  Ninguna unidad en el lienzo.
                </span>
              ) : null}
            </div>

            {/* Agregar unidad. La lista dice cuántos puntos reportó cada una en
                el rango: elegir a ciegas entre ochenta y dos unidades no es
                elegir, y una unidad muda no es una unidad quieta. */}
            {data.unidades.length < MAX_UNIDADES ? (
              <details className="mt-2">
                <summary className="w-fit cursor-pointer rounded-sm border border-dashed border-[var(--linea)] px-2 py-0.5 text-[11px] text-[var(--tenue)] hover:border-[var(--azul)]">
                  Agregar unidad
                </summary>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-sm border border-[var(--linea)]">
                  <ul className="divide-y divide-[var(--linea-tenue)]">
                    {data.candidatas
                      .filter((c) => !seleccionadas.has(c.id))
                      .map((c) => (
                        <li key={c.id}>
                          <a
                            href={href({ unidades: [...seleccionadas, c.id] })}
                            className="flex items-baseline justify-between gap-3 px-2.5 py-1.5 text-[12px] transition-colors hover:bg-[var(--hover)]"
                          >
                            <span className="text-[var(--texto)]">
                              {c.label}
                              {c.plateNumber ? (
                                <span className="ml-1.5 text-[10px] text-[var(--tenue)]">
                                  {c.plateNumber}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums ${
                                c.puntos > 0 ? "text-[var(--acero)]" : "text-[var(--tenue)]"
                              }`}
                            >
                              {c.puntos > 0
                                ? `${c.puntos.toLocaleString("es-MX")} puntos`
                                : "sin dato en el rango"}
                            </span>
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </div>

          <form method="GET" className="flex flex-wrap items-end gap-2">
            {carrier.slug ? <input type="hidden" name="account" value={carrier.slug} /> : null}
            {[...seleccionadas].map((id) => (
              <input key={id} type="hidden" name="unidad" value={id} />
            ))}
            <div>
              <p className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]">
                Cuándo
              </p>
              <div className="mt-1.5 flex items-end gap-2">
                <label className="flex flex-col gap-1 text-[10px] text-[var(--tenue)]">
                  Desde
                  <input
                    type="date"
                    name="desde"
                    defaultValue={data.rango.desde}
                    className="rounded-sm border border-[var(--linea)] bg-transparent px-2 py-1 font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--texto)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-[var(--tenue)]">
                  Hasta
                  <input
                    type="date"
                    name="hasta"
                    defaultValue={data.rango.hasta}
                    className="rounded-sm border border-[var(--linea)] bg-transparent px-2 py-1 font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--texto)]"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-sm border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-1.5 text-[12px] text-[var(--acero)] transition-colors hover:border-[var(--azul)]"
                >
                  Ver
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Ningún tope en silencio. */}
        {data.limites.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-[var(--linea)] pt-2.5">
            {data.limites.map((l) => (
              <li key={l} className="text-[10.5px] leading-relaxed text-[var(--tenue)]">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* La ventana de un servicio abierta: se dice cuál, y se puede soltar. */}
      {data.servicioAbierto ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-2">
          <span className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.11em] text-[var(--acero)]">
            Servicio abierto
          </span>
          <span className="text-[12px] text-[var(--texto)]">
            {data.servicioAbierto.ruta} · {data.servicioAbierto.turno} ·{" "}
            {data.servicioAbierto.cliente}
          </span>
          <span className="font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums text-[var(--acero)]">
            cierre {data.servicioAbierto.cierre}
          </span>
          {/* Un `no_cumplido` NUNCA tiene unidad acreditada. Decirlo es la
              diferencia entre "no fue nadie" y "el árbitro no acreditó a
              nadie" — y esa diferencia es justo lo que se viene a disputar. */}
          {data.servicioAbierto.unidadAcreditada ? (
            <span className="font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--acero)]">
              unidad acreditada {data.servicioAbierto.unidadAcreditada.label}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--tenue)]">
              El árbitro no acreditó ninguna unidad en este servicio. Elige tú cuál enseñar.
            </span>
          )}
          <a
            href={href({ servicio: null })}
            className="ml-auto text-[11px] text-[var(--azul)] hover:underline"
          >
            Salir de la ventana
          </a>
        </div>
      ) : null}

      {/* ── El lienzo ─────────────────────────────────────────────────────── */}
      <WorkbenchLienzo data={data} />

      {/* ── Las medidas del rango. Todas en acero, cada una con su lectura. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.medidas.map((m) => (
          <div
            key={m.etiqueta}
            className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] px-4 py-3"
          >
            <dt className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.11em] text-[var(--tenue)]">
              {m.etiqueta}
            </dt>
            <dd className="mt-1 font-[family-name:var(--fuente-mono)] text-lg tabular-nums text-[var(--acero)]">
              {m.valor}
            </dd>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--tenue)]">{m.lectura}</p>
          </div>
        ))}
      </dl>

      {/* ── El bloque de defensa, declarado y no implícito ────────────────── */}
      <section
        aria-labelledby="defensa"
        className="rounded-xl border border-[var(--b-acero)] bg-[var(--panel)] p-4"
      >
        <h2
          id="defensa"
          className="font-[family-name:var(--fuente-archivo)] text-base text-[var(--texto)]"
        >
          Cuando un cliente dispute un servicio, esta es la pantalla.
        </h2>
        <p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-[var(--tenue)]">
          Abre el servicio y el lienzo se ajusta a la ventana que miró el árbitro, con la traza
          completa —sin simplificar— y el trazado contratado encima. Lo que se ve aquí es lo
          medido; interpretarlo es tuyo.
        </p>

        {disputables.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--linea-tenue)] rounded-sm border border-[var(--linea)]">
            {disputables.slice(0, 8).map((s) => (
              <li key={s.ocurrenciaId}>
                <a
                  href={href({ servicio: s.ocurrenciaId, desde: s.fecha, hasta: s.fecha })}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 transition-colors hover:bg-[var(--hover)]"
                >
                  <ChipResultado resultado={s.resultado} />
                  <span className="text-[12.5px] text-[var(--texto)]">{s.ruta}</span>
                  <span className="text-[11px] text-[var(--tenue)]">
                    {s.turno} · {s.cliente}
                  </span>
                  <span className="ml-auto font-[family-name:var(--fuente-mono)] text-[11px] tabular-nums text-[var(--acero)]">
                    cierre {s.cierre}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-sm border border-dashed border-[var(--linea)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--tenue)]">
            Ningún servicio del rango quedó como no cumplido ni pendiente por evidencia. Si te
            disputan uno que sí cumplió, ábrelo desde la lista de abajo.
          </p>
        )}

        {disputables.length > 8 ? (
          <p className="mt-2 font-[family-name:var(--fuente-mono)] text-[10.5px] tabular-nums text-[var(--tenue)]">
            Se listan 8 de {disputables.length}. Acota el rango para ver el resto.
          </p>
        ) : null}
      </section>

      {/* ── Los servicios del rango ───────────────────────────────────────── */}
      {data.servicios.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Servicios del rango</caption>
            <thead>
              <tr className="border-b border-[var(--linea)]">
                {["Fecha", "Ruta", "Cliente", "Resultado", "Unidad acreditada", "Cierre"].map(
                  (h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-3 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)] ${
                        i === 5 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--linea-tenue)]">
              {data.servicios.slice(0, 60).map((s) => (
                <tr key={s.ocurrenciaId} className="transition-colors hover:bg-[var(--hover)]">
                  <td className="px-4 py-2.5 font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--tenue)]">
                    {s.fecha}
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={href({ servicio: s.ocurrenciaId, desde: s.fecha, hasta: s.fecha })}
                      className="text-[var(--texto)] hover:text-[var(--azul)] hover:underline"
                    >
                      {s.ruta}
                    </a>
                    <span className="ml-1.5 text-[11px] text-[var(--tenue)]">{s.turno}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--tenue)]">{s.cliente}</td>
                  <td className="px-4 py-2.5">
                    <ChipResultado resultado={s.resultado} />
                  </td>
                  <td className="px-4 py-2.5 font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--acero)]">
                    {s.unidadAcreditada ? (
                      s.unidadAcreditada.label
                    ) : (
                      <span className="text-[var(--tenue)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--acero)]">
                    {s.cierre}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── Lo que este instrumento todavía no hace, con su razón ─────────── */}
      <section aria-labelledby="ausentes">
        <h2
          id="ausentes"
          className="mb-2 font-[family-name:var(--fuente-mono)] text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]"
        >
          Lo que este instrumento todavía no hace
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
        Todas las horas de esta pantalla están en el reloj de{" "}
        <span className="text-[var(--acero)]">{JTTEL_TZ}</span>. Para el ahora, ve a Monitoreo.
        Nada de esta pantalla llega a los clientes.
      </p>
    </CarrierShell>
  );
}


/**
 * El chip de resultado: impresión con borde, no pastilla de color.
 *
 * Es el único lugar de la pantalla donde aparece un color de veredicto, y
 * aparece porque aquí sí hay un resultado sellado que nombrar. Lo que todavía
 * no se selló va en acero: no tiene resultado, y pintarlo de cualquier color
 * sería la pantalla adelantándose al árbitro.
 */
function ChipResultado({ resultado }: { resultado: ServicioEnRango["resultado"] }) {
  const estilo =
    resultado === "cumplido"
      ? "text-[var(--verde)] bg-[var(--t-verde)] border-[var(--b-verde)]"
      : resultado === "no_cumplido"
        ? "text-[var(--rojo)] bg-[var(--t-rojo)] border-[var(--b-rojo)]"
        : resultado === "pendiente"
          ? "text-[var(--ambar)] bg-[var(--t-ambar)] border-[var(--b-ambar)]"
          : "text-[var(--tenue)] border-[var(--linea)]";
  const texto =
    resultado === "cumplido"
      ? "Cumplido"
      : resultado === "no_cumplido"
        ? "No cumplido"
        : resultado === "pendiente"
          ? "Pendiente por evidencia"
          : "Sin sellar";
  return (
    <span
      className={`inline-block rounded-[2px] border px-2 py-[2px] font-[family-name:var(--fuente-mono)] text-[9.5px] font-medium uppercase tracking-[0.13em] ${estilo}`}
    >
      {texto}
    </span>
  );
}
