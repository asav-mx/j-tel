import Link from "next/link";
import type { ExpedienteContrato } from "@/lib/expediente-contrato-data";

/**
 * El expediente del contrato — **una sola vista para las dos partes.**
 *
 * Es el documento de la relación, y una relación no tiene dos versiones. Que
 * cliente y carrier compartan este componente no es ahorro de código: es la ley
 * §3 de la ficha hecha estructura. Si mañana alguien quisiera esconderle algo a
 * una de las partes tendría que partir el componente, y eso se ve en un diff.
 *
 * La única diferencia entre caras es **dónde vive** y si aparece la puerta a la
 * Oficina — el cliente configura, el transportista no (ley 5). La política que
 * los dos leen es la misma.
 */

const MONO = "font-[family-name:var(--fuente-mono)]";
const SECCION = `mb-2 ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]`;

export function ExpedienteContratoView({
  d,
  enlace,
  rutaHref,
  hermanoHref,
}: {
  d: ExpedienteContrato;
  /** Envuelve una ruta con el contexto de cuenta de la cara que llama. */
  enlace: (ruta: string) => string;
  /** A dónde abre una ruta del alcance, o `null` si esa cara no la tiene. */
  rutaHref: ((routeId: string) => string) | null;
  hermanoHref: (contractId: string) => string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
            {d.contrato.nombre}
          </h1>
          <span className={`${MONO} text-[11px] tabular-nums text-[var(--acero)]`}>
            {d.partes.map((p) => p.nombre).join(" ↔ ")}
          </span>
          {d.hermanos.total > 1 ? (
            <span className={`ml-auto ${MONO} flex items-center gap-3 text-[11px] tabular-nums text-[var(--tenue)]`}>
              {d.hermanos.anterior ? (
                <Link
                  href={hermanoHref(d.hermanos.anterior.id)}
                  className="hover:text-[var(--azul)] hover:underline"
                >
                  ‹ {d.hermanos.anterior.nombre}
                </Link>
              ) : null}
              <span>
                {d.hermanos.indice} de {d.hermanos.total}
              </span>
              {d.hermanos.siguiente ? (
                <Link
                  href={hermanoHref(d.hermanos.siguiente.id)}
                  className="hover:text-[var(--azul)] hover:underline"
                >
                  {d.hermanos.siguiente.nombre} ›
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
        {d.sitio ? (
          <p className={`mt-1 ${MONO} text-[11px] text-[var(--tenue)]`}>{d.sitio}</p>
        ) : null}
      </header>

      {/* ── La relación ───────────────────────────────────────────────────── */}
      <section aria-labelledby="relacion">
        <h2 id="relacion" className={SECCION}>
          La relación
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
              <dd className={`mt-1 ${MONO} text-sm tabular-nums text-[var(--acero)]`}>{x.valor}</dd>
              {x.lectura ? (
                <p
                  className={`mt-1 text-[10px] leading-relaxed ${
                    /* El vencimiento es un aviso del sistema, no un veredicto:
                       ámbar como aviso, jamás rojo. */
                    x.lectura === "vencido" ? "text-[var(--ambar)]" : "text-[var(--tenue)]"
                  }`}
                >
                  {x.lectura}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      </section>

      {/* ── Qué cubre ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="alcance">
        <h2 id="alcance" className={SECCION}>
          Qué cubre
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--linea)]">
                {["Ruta", "Turnos", "Servicios al día"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-2.5 ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)] ${
                      i === 2 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--linea-tenue)]">
              {d.alcance.rutas.map((r) => (
                <tr key={r.routeId} className="transition-colors hover:bg-[var(--hover)]">
                  <td className="px-4 py-2 text-[var(--texto)]">
                    {/* Cada cosa del alcance enlaza a su propia identidad. */}
                    {rutaHref ? (
                      <Link
                        href={rutaHref(r.routeId)}
                        className="hover:text-[var(--azul)] hover:underline"
                      >
                        {r.nombre}
                      </Link>
                    ) : (
                      r.nombre
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--tenue)]">{r.turnos.join(" · ")}</td>
                  <td className={`px-4 py-2 text-right ${MONO} tabular-nums text-[var(--acero)]`}>
                    {r.perfiles}
                  </td>
                </tr>
              ))}
              {d.alcance.rutas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-[11px] text-[var(--tenue)]">
                    Este contrato todavía no tiene servicios configurados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {d.alcance.geocercas.length > 0 ? (
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--tenue)]">
            Destinos:{" "}
            <span className="text-[var(--acero)]">
              {d.alcance.geocercas.map((g) => g.nombre).join(" · ")}
            </span>
          </p>
        ) : null}
      </section>

      {/* ── La puerta a la Oficina. Una puerta, no una copia. ─────────────── */}
      <section aria-labelledby="politica">
        <h2 id="politica" className={SECCION}>
          La política
        </h2>
        <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-4">
          <p className="max-w-3xl text-[12px] leading-relaxed text-[var(--tenue)]">
            Las reglas con las que se juzga cada servicio —tolerancia, corredor, anticipación,
            motivos excusables— viven en un solo lugar y este expediente no las copia.
            {d.puertaOficina ? (
              <>
                {" "}
                <Link
                  href={enlace(d.puertaOficina)}
                  className="text-[var(--azul)] hover:underline"
                >
                  Abrir la Oficina del contrato
                </Link>
                .
              </>
            ) : (
              // Ley 5: el auditado no edita el veredicto ni las reglas.
              " La configura el cliente; aquí se lee su historia."
            )}
          </p>

          <div className="mt-3 border-t border-[var(--linea)] pt-3">
            <p className={`${MONO} text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]`}>
              Historia de la política
            </p>
            {d.historia.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {d.historia.map((v) => (
                  <li key={v.id} className="text-[11.5px] text-[var(--texto)]">
                    <span className={`${MONO} tabular-nums text-[var(--acero)]`}>{v.cuando}</span>
                    {v.quien ? (
                      <span className="ml-2 text-[var(--tenue)]">· {v.quien}</span>
                    ) : null}
                    {v.motivo ? <span className="ml-2 text-[var(--tenue)]">· {v.motivo}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              /* Cero versiones no es "no sé": es que no ha cambiado. */
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--tenue)]">
                {d.sinHistoria}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── El bloque reservado por la compuerta ──────────────────────────── */}
      <section aria-labelledby="cumplimiento">
        <h2 id="cumplimiento" className={SECCION}>
          Cumplimiento del contrato
        </h2>
        <div className="rounded-xl border border-dashed border-[var(--linea)] px-4 py-6">
          <p className="mx-auto max-w-2xl text-center text-[11.5px] leading-relaxed text-[var(--tenue)]">
            {d.compuerta}
          </p>
        </div>
      </section>

      {/* ── Ausencias declaradas ──────────────────────────────────────────── */}
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

      <p className="max-w-3xl text-[11px] leading-relaxed text-[var(--tenue)]">
        Las dos partes ven este expediente con el mismo contenido. Si algo tuviera que ocultarse
        de una de ellas, no pertenece aquí.
      </p>
    </div>
  );
}
