import Link from "next/link";
import { notFound } from "next/navigation";
import { CarrierShell } from "@/components/unit-shell";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadExpedienteUnidad, MESES_DEL_EXPEDIENTE } from "@/lib/expediente-unidad-data";

export const dynamic = "force-dynamic";

/**
 * Expediente de la unidad — *¿cómo se ha portado este camión?*
 *
 * **La unidad no tiene resultado propio.** Los tres colores de veredicto
 * aparecen en un solo lugar de esta pantalla: el chip de los servicios que el
 * árbitro selló, donde sí hay un resultado que nombrar. Todo lo demás —huecos,
 * puntos, periodos de rastreador— es observación, y va en acero.
 *
 * **Los datos se enuncian sin sujeto** (regla de voz de la ficha): en la cara
 * del transportista no se escribe "declarado por el transportista". Se escribe
 * "configuración y datos de alta".
 */

const MONO = "font-[family-name:var(--fuente-mono)]";
const ETIQUETA = `${MONO} text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]`;
const SECCION = `mb-2 ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]`;

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default async function ExpedienteUnidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { unitId } = await params;
  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de transportista. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const d = await loadExpedienteUnidad(carrier, unitId);
  if (!d) notFound();

  const enlace = (ruta: string) => withAccount(ruta, carrier.slug);

  return (
    <CarrierShell carrier={carrier} title={`${carrier.name} — ${d.unidad.label}`}>
      {/* ── Cabecera: migas, titular, hermanas con el conteo de flota ────── */}
      <header>
        <nav className={`${MONO} text-[10.5px] text-[var(--tenue)]`} aria-label="Migas">
          <Link href={enlace("/carrier/flota")} className="hover:text-[var(--azul)] hover:underline">
            Unidades
          </Link>
          <span aria-hidden> › </span>
          <span className="text-[var(--texto)]">{d.unidad.label}</span>
        </nav>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-[family-name:var(--fuente-archivo)] text-2xl font-semibold text-[var(--texto)]">
            {d.unidad.label}
          </h1>
          {d.unidad.plateNumber ? (
            <span className={`${MONO} text-sm text-[var(--acero)]`}>{d.unidad.plateNumber}</span>
          ) : null}

          <span className={`ml-auto ${MONO} flex items-center gap-3 text-[11px] tabular-nums text-[var(--tenue)]`}>
            {d.hermanas.anterior ? (
              <Link
                href={enlace(`/carrier/flota/${d.hermanas.anterior.id}`)}
                className="hover:text-[var(--azul)] hover:underline"
              >
                ← {d.hermanas.anterior.label}
              </Link>
            ) : null}
            <span>
              {d.hermanas.indice} de {d.hermanas.total}
            </span>
            {d.hermanas.siguiente ? (
              <Link
                href={enlace(`/carrier/flota/${d.hermanas.siguiente.id}`)}
                className="hover:text-[var(--azul)] hover:underline"
              >
                {d.hermanas.siguiente.label} →
              </Link>
            ) : null}
          </span>
        </div>
      </header>

      {/* ── Identidad: configuración y datos de alta ─────────────────────── */}
      <section aria-labelledby="identidad">
        <h2 id="identidad" className={SECCION}>
          Configuración y datos de alta
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.identidad.map((x) => (
            <div
              key={x.etiqueta}
              className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] px-4 py-3"
            >
              <dt className={ETIQUETA}>{x.etiqueta}</dt>
              {/* Acero es para lo medido. Un renglón que dice "sin capturar"
                  no es una medición, y pintarlo igual lo haría pasar por una. */}
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
          {d.kilometraje ? (
            <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] px-4 py-3">
              <dt className={ETIQUETA}>Kilometraje</dt>
              <dd className={`mt-1 ${MONO} text-sm tabular-nums text-[var(--acero)]`}>
                {d.kilometraje.valor.toLocaleString("es-MX")} km
              </dd>
              {/* Jamás como kilometraje de hoy: entre esa carga y ahora el
                  camión siguió rodando. */}
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--tenue)]">
                {d.kilometraje.lectura}
              </p>
            </div>
          ) : null}
        </dl>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--tenue)]">
          No se capturan todavía: {d.identidadAusente.join(" · ")}. Los renglones no se dibujan
          vacíos ni se rellenan con supuestos.
        </p>
      </section>

      {/* ── Salud de la señal: la sección más valiosa ────────────────────── */}
      <section aria-labelledby="salud">
        <h2 id="salud" className={SECCION}>
          Salud de la señal
        </h2>

        <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-4">
          {d.salud.barras.length > 0 ? (
            <>
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {d.salud.barras.map((b) => (
                  <div key={b.mes} className="flex min-w-[64px] flex-1 flex-col items-center gap-1">
                    <span className={`${MONO} text-[11px] tabular-nums text-[var(--acero)]`}>
                      {b.huecos}
                    </span>
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-sm bg-[var(--t-acero2)]"
                        style={{ height: `${Math.max(2, b.proporcion * 100)}%` }}
                        /* Acero: es medición, no veredicto. Un hueco de señal
                           no es un incumplimiento — sin evidencia nunca lo es. */
                        title={`${b.huecos} huecos · ${duracion(b.minutosSinVer)} sin ver`}
                      />
                    </div>
                    {/* La línea del cambio de rastreador, cuando lo hay. */}
                    {b.cambioDeRastreador ? (
                      <span className={`${MONO} text-[9px] uppercase tracking-[0.08em] text-[var(--azul)]`}>
                        cambio de equipo
                      </span>
                    ) : null}
                    <span className={`${MONO} text-[9.5px] text-[var(--tenue)]`}>{b.etiqueta}</span>
                  </div>
                ))}
              </div>

              <p className={`mt-3 border-t border-[var(--linea)] pt-3 ${MONO} text-[11px] tabular-nums text-[var(--acero)]`}>
                {d.salud.totalHuecos} {d.salud.totalHuecos === 1 ? "hueco" : "huecos"}{" "}
                {d.periodoCubierto} · {duracion(d.salud.totalMinutos)} sin ver · peor mes{" "}
                {d.salud.maximoHuecos}
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-[var(--tenue)]">
              Sin puntos archivados para esta unidad en el periodo.
            </p>
          )}

          {/* La lectura declarada, o por qué no la hay. Una sección que calla
              deja a quien mira suponiendo que el sistema no supo, en vez de que
              no había qué decir. */}
          {d.salud.lectura ? (
            <p className="mt-3 rounded-sm border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-2 text-[12px] leading-relaxed text-[var(--texto)]">
              {d.salud.lectura}
            </p>
          ) : d.salud.sinLectura ? (
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--tenue)]">
              {d.salud.sinLectura}
            </p>
          ) : null}

          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--tenue)]">
            {d.alcanceArchivo}
          </p>
        </div>
      </section>

      {/* ── Rastreadores con sus periodos ────────────────────────────────── */}
      <section aria-labelledby="rastreadores">
        <h2 id="rastreadores" className={SECCION}>
          Rastreadores que ha traído
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--linea)]">
                {["Equipo", "Desde", "Hasta"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-2.5 text-left ${MONO} text-[10.5px] font-medium uppercase tracking-[0.11em] text-[var(--tenue)]`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--linea-tenue)]">
              {d.rastreadores.map((r) => (
                <tr key={`${r.imei}-${r.desde}`}>
                  <td className={`px-4 py-2 ${MONO} text-[12px] text-[var(--texto)]`}>
                    {r.etiqueta ?? r.imei}
                    {r.etiqueta ? (
                      <span className="ml-2 text-[10px] text-[var(--tenue)]">{r.imei}</span>
                    ) : null}
                  </td>
                  <td className={`px-4 py-2 ${MONO} tabular-nums text-[var(--acero)]`}>{r.desde}</td>
                  <td className={`px-4 py-2 ${MONO} tabular-nums text-[var(--tenue)]`}>
                    {/* Estado operativo: acero y tenue, nunca verde. */}
                    {r.hasta ?? "sigue instalado"}
                  </td>
                </tr>
              ))}
              {d.rastreadores.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-[11px] text-[var(--tenue)]">
                    Esta unidad no tiene ningún rastreador asignado, así que el sistema no la ve.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 max-w-3xl text-[10.5px] leading-relaxed text-[var(--tenue)]">
          El rastreador no es la identidad de la unidad: si se cambia el aparato, la historia del
          camión sigue siendo una sola.
        </p>
      </section>

      {/* ── Servicios que cubrió ─────────────────────────────────────────── */}
      <section aria-labelledby="servicios">
        <h2 id="servicios" className={SECCION}>
          Servicios que cubrió
        </h2>
        <p className={`mb-2 ${MONO} text-[11px] tabular-nums text-[var(--acero)]`}>
          {d.serviciosCubiertos.total}{" "}
          {d.serviciosCubiertos.total === 1 ? "servicio acreditado" : "servicios acreditados"} en los
          últimos {MESES_DEL_EXPEDIENTE} meses · {d.serviciosCubiertos.cumplidos}{" "}
          {d.serviciosCubiertos.cumplidos === 1 ? "cumplido" : "cumplidos"} ·{" "}
          {d.serviciosCubiertos.pendientes} pendientes por evidencia
        </p>

        {d.ultimosServicios.length > 0 ? (
          <ul className="divide-y divide-[var(--linea-tenue)] rounded-xl border border-[var(--linea)] bg-[var(--panel)]">
            {d.ultimosServicios.map((s) => (
              <li key={s.ocurrenciaId}>
                <Link
                  href={enlace(`/carrier/servicio/${s.ocurrenciaId}`)}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-[var(--hover)]"
                >
                  <span className={`${MONO} text-[11px] tabular-nums text-[var(--tenue)]`}>
                    {s.fecha}
                  </span>
                  <span className="text-[12.5px] text-[var(--texto)]">{s.ruta}</span>
                  <span className="text-[11px] text-[var(--tenue)]">{s.turno}</span>
                  <span
                    className={`ml-auto inline-block rounded-[2px] border px-2 py-[2px] ${MONO} text-[9.5px] font-medium uppercase tracking-[0.13em] ${
                      s.resultado === "cumplido"
                        ? "border-[var(--b-verde)] bg-[var(--t-verde)] text-[var(--verde)]"
                        : s.resultado === "no_cumplido"
                          ? "border-[var(--b-rojo)] bg-[var(--t-rojo)] text-[var(--rojo)]"
                          : "border-[var(--b-ambar)] bg-[var(--t-ambar)] text-[var(--ambar)]"
                    }`}
                  >
                    {s.resultado === "cumplido"
                      ? "Cumplido"
                      : s.resultado === "no_cumplido"
                        ? "No cumplido"
                        : "Pendiente por evidencia"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--linea)] px-4 py-3 text-[11px] leading-relaxed text-[var(--tenue)]">
            El árbitro no ha acreditado a esta unidad en ningún servicio del periodo. Eso no dice
            que no haya trabajado: dice que ningún servicio contratado se le acreditó.
          </p>
        )}
      </section>

      {/* ── Taller y diésel: lo poco que hay, sin fingir que es más ──────── */}
      <div className="grid gap-4 min-[900px]:grid-cols-2">
        <section aria-labelledby="taller">
          <h2 id="taller" className={SECCION}>
            Taller
          </h2>
          <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-4">
            {d.taller.length > 0 ? (
              <ul className="space-y-2">
                {d.taller.map((m, i) => (
                  <li key={i} className="text-[12px] text-[var(--texto)]">
                    {m.descripcion}
                    <span className={`ml-2 ${MONO} text-[10.5px] tabular-nums text-[var(--tenue)]`}>
                      {m.estado} · {m.completado ?? m.programado ?? "sin fecha"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-[12px] text-[var(--texto)]">{d.tallerVacio!.titulo}</p>
                {/* La distinción que separa un dato faltante de una acusación. */}
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--tenue)]">
                  {d.tallerVacio!.nota}
                </p>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="diesel">
          <h2 id="diesel" className={SECCION}>
            Diésel
          </h2>
          <div className="rounded-xl border border-[var(--linea)] bg-[var(--panel)] p-4">
            {d.diesel.length > 0 ? (
              <ul className="space-y-2">
                {d.diesel.map((f, i) => (
                  <li key={i} className={`${MONO} text-[12px] tabular-nums text-[var(--acero)]`}>
                    {f.fecha} · {f.litros} L
                    {f.odometro != null ? ` · ${f.odometro.toLocaleString("es-MX")} km` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-[12px] text-[var(--texto)]">{d.dieselVacio!.titulo}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--tenue)]">
                  {d.dieselVacio!.nota}
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Bloques reservados, cada uno con su razón ────────────────────── */}
      <section aria-labelledby="reservados">
        <h2 id="reservados" className={SECCION}>
          Lo que este expediente todavía no muestra
        </h2>
        <dl className="max-w-3xl space-y-2">
          {d.reservados.map((r) => (
            <div key={r.titulo} className="text-[11px] leading-relaxed">
              <dt className={`inline ${MONO} uppercase tracking-[0.08em] text-[var(--tenue)]`}>
                {r.titulo}
              </dt>
              <dd className="inline text-[var(--tenue)]"> — {r.razon}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--tenue)]">
        <Link
          href={enlace(`/carrier/historial/${d.unidad.id}`)}
          className="text-[var(--azul)] hover:underline"
        >
          Ver su día a día
        </Link>
        <Link
          href={enlace(`/carrier/recorrido?unidad=${d.unidad.id}`)}
          className="text-[var(--azul)] hover:underline"
        >
          Abrirla en el Workbench
        </Link>
        <span className="ml-auto">Nada de esta pantalla llega a los clientes.</span>
      </p>
    </CarrierShell>
  );
}
