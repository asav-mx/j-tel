import Link from "next/link";
import { AppNav } from "@/components/ui";
import { CLASES_DE_FLOTA, EjeDeFranja, LeyendaTira, TiraDia } from "@/components/tira-dia";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { cargarFlota, type FilaDeFlota } from "@/lib/historial-data";
import { hhMm, resolverPeriodo } from "@/lib/historial-periodo";
import { REGLAS_POR_DEFECTO, SALTO_GPS_KMH } from "@/lib/historial-unidad";
import { duracion, fechaDeIso, relojCorto } from "@/lib/formato-tiempo";
import { JTTEL_TZ } from "@/lib/local-time";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * Historial de flota — qué hizo cada unidad, del propio carrier.
 *
 * La pregunta que esta pantalla existe para contestar es la que el carrier hoy
 * no puede: "¿qué hizo mi flota el martes?". Antes de esto solo había el
 * inventario de altas y el cumplimiento que el cliente ve — nada que contara
 * la operación propia.
 *
 * Tres cosas la gobiernan:
 *
 *  1. Es superficie de carrier y de nadie más. Todo cuelga de la cuenta
 *     resuelta por tipo, y ningún cliente tiene ruta hasta aquí.
 *  2. No emite veredictos. No consulta hechos sellados, no sabe qué ruta
 *     debía hacerse, y por eso no usa verde, ámbar ni rojo.
 *  3. No hay recorte de geocerca: el carrier ve su propia operación completa.
 *     Lo que se recorta es lo que VA HACIA EL CLIENTE, y de ahí no sale nada.
 */

const num = "font-[family-name:var(--fuente-mono)] tabular-nums";
const mono = "font-[family-name:var(--fuente-mono)]";

type Orden = "unidad" | "menos_dato";

function ordenar(filas: FilaDeFlota[], orden: Orden): FilaDeFlota[] {
  const copia = [...filas];
  if (orden === "menos_dato") {
    // Las que menos se observaron, primero: son las que piden explicación.
    return copia.sort(
      (a, b) =>
        b.resumen.minutosSinDato - a.resumen.minutosSinDato ||
        a.unidad.label.localeCompare(b.unidad.label, "es"),
    );
  }
  return copia.sort((a, b) => a.unidad.label.localeCompare(b.unidad.label, "es", { numeric: true }));
}

export default async function CarrierHistorialPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const sp = searchParams ? await searchParams : undefined;
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-6xl">
          <AppNav title="Historial de flota" links={[{ href: "/carrier", label: "← Panel" }]} />
          <p className="text-sm text-[var(--tenue)]">
            Sin datos de carrier. Crea una cuenta en J-Staff → Cuentas.
          </p>
        </div>
      </main>
    );
  }

  // La flota mira UN día a la vez: cincuenta tiras por siete días no se leen.
  // La profundidad de días vive en la vista de la unidad.
  const periodo = resolverPeriodo(sp, { maxDias: 1 });
  const busqueda = typeof sp?.q === "string" ? sp.q.trim() : "";
  const orden: Orden = sp?.orden === "menos_dato" ? "menos_dato" : "unidad";

  const todas = await cargarFlota({ carrierAccountId: carrier.id, periodo });

  const termino = busqueda.toLowerCase();
  const filas = ordenar(
    termino
      ? todas.filter(
          (f) =>
            f.unidad.label.toLowerCase().includes(termino) ||
            (f.unidad.plateNumber ?? "").toLowerCase().includes(termino),
        )
      : todas,
    orden,
  );

  const conDato = todas.filter((f) => f.resumen.puntos > 0).length;
  const kmFlota = todas.reduce((t, f) => t + f.resumen.kmAproximados, 0);
  const huecosFlota = todas.reduce((t, f) => t + f.resumen.huecos, 0);

  const href = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("fecha", periodo.fechaHasta);
    p.set("horaDesde", hhMm(periodo.minutosDesde));
    p.set("horaHasta", hhMm(periodo.minutosHasta));
    if (busqueda) p.set("q", busqueda);
    if (orden !== "unidad") p.set("orden", orden);
    for (const [k, v] of Object.entries(cambios)) p.set(k, v);
    return withAccount(`/carrier/historial?${p.toString()}`, carrier.slug);
  };

  const franjaCompleta = periodo.minutosDesde === 0 && periodo.minutosHasta === 0;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title={`Historial de flota — ${carrier.name}`}
          links={[
            { href: withAccount("/carrier", carrier.slug), label: "Panel" },
            { href: withAccount("/carrier/recorrido", carrier.slug), label: "Recorrido" },
            { href: withAccount("/carrier/flota", carrier.slug), label: "Alta de flota" },
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "Cumplimiento contractual",
            },
          ]}
        />

        <p className="mb-2 text-2xl" style={{ fontFamily: "var(--fuente-archivo)", fontWeight: 700 }}>
          {fechaDeIso(periodo.fechaHasta)} — {todas.length}{" "}
          {todas.length === 1 ? "unidad" : "unidades"} en tu flota.
        </p>
        <p className="mb-6 max-w-[70ch] text-sm text-[var(--tenue)]">
          Lo que hizo cada unidad, tal como lo reportó su GPS.{" "}
          <span className="text-[var(--texto)]">
            Esta pantalla no emite ningún resultado
          </span>{" "}
          — no consulta hechos sellados ni sabe qué ruta debía hacerse. Es tu operación, y solo
          la tuya: ningún cliente tiene acceso a esta superficie.
        </p>

        <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
          {carrier.slug ? <input type="hidden" name="account" value={carrier.slug} /> : null}
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Día
            <input
              type="date"
              name="fecha"
              defaultValue={periodo.fechaHasta}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Desde
            <input
              type="time"
              name="horaDesde"
              defaultValue={hhMm(periodo.minutosDesde)}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Hasta
            <input
              type="time"
              name="horaHasta"
              defaultValue={hhMm(periodo.minutosHasta)}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Buscar unidad
            <input
              type="search"
              name="q"
              defaultValue={busqueda}
              placeholder="Número económico o placa"
              className="w-56 rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] placeholder:text-[var(--tenue)]"
            />
          </label>
          {orden !== "unidad" ? <input type="hidden" name="orden" value={orden} /> : null}
          <button
            type="submit"
            className="rounded-lg border border-[var(--azul)] px-4 py-1.5 text-sm text-[var(--azul)] hover:bg-[var(--azul)]/10"
          >
            Ver
          </button>
        </form>

        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Link href={href({ horaDesde: "00:00", horaHasta: "00:00" })} className={atajo(franjaCompleta)}>
            Día completo
          </Link>
          <Link href={href({ horaDesde: "05:00", horaHasta: "11:00" })} className={atajo(false)}>
            Mañana · 05:00 a 11:00
          </Link>
          <Link href={href({ horaDesde: "22:00", horaHasta: "06:00" })} className={atajo(false)}>
            Noche · 22:00 a 06:00
          </Link>
          <Link
            href={href({ orden: orden === "unidad" ? "menos_dato" : "unidad" })}
            className={atajo(orden === "menos_dato")}
          >
            {orden === "menos_dato" ? "Orden: menos dato primero" : "Orden: por unidad"}
          </Link>
        </div>

        <p className={`mb-6 text-xs text-[var(--tenue)] ${mono}`}>
          Franja: {fechaDeIso(periodo.fechaHasta)}, de {relojCorto(periodo.desde)} a{" "}
          {relojCorto(periodo.hasta)} — {duracion((periodo.hasta.getTime() - periodo.desde.getTime()) / 60_000)}.
          {periodo.cruzaMedianoche ? " Cruza medianoche y cierra al día siguiente." : ""} Todas las
          horas están en el reloj de <span className="text-[var(--acero)]">{JTTEL_TZ}</span>.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-px border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-4">
          <Vital
            titulo="Unidades con dato"
            valor={`${conDato}`}
            lectura={`de ${todas.length} en la flota`}
          />
          <Vital
            titulo="Rodado de la flota"
            valor={`${kmFlota.toFixed(1)} km`}
            lectura="aproximado · saltos descartados"
          />
          <Vital
            titulo="Huecos de dato"
            valor={`${huecosFlota}`}
            lectura={`silencios de más de ${REGLAS_POR_DEFECTO.huecoMinutos} min`}
          />
          <Vital
            titulo="Unidades sin un punto"
            valor={`${todas.length - conDato}`}
            lectura="en toda la franja"
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={`text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
            El día de la flota — cada unidad, su franja
          </h2>
          {/* Dos clases aquí: a este alto de renglón, la diferencia entre
              moverse y estar detenida no se distingue. Las tres viven en la
              vista de la unidad, que es donde sí se pueden leer. */}
          <LeyendaTira clases={CLASES_DE_FLOTA} />
        </div>

        <div className="border border-[var(--linea)] bg-[var(--panel)] p-4">
          {filas.length === 0 ? (
            <p className="text-sm text-[var(--tenue)]">
              {termino
                ? `Ninguna unidad coincide con "${busqueda}". La flota tiene ${todas.length}.`
                : "Este carrier no tiene unidades registradas. Se dan de alta en Alta de flota."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(120px,150px)_1fr] gap-3 sm:grid-cols-[minmax(120px,150px)_1fr_150px]">
                <span />
                {/* El eje sale del periodo, no de la primera fila: todas las
                    tiras comparten franja, y colgarlo de una fila lo rompía
                    cuando la búsqueda no dejaba ninguna. */}
                <EjeDeFranja franja={periodo} />
                <span className="hidden sm:block" />
              </div>

              {filas.map(({ unidad, resumen, tira }) => (
                <Link
                  key={unidad.id}
                  href={withAccount(
                    `/carrier/historial/${unidad.id}?desde=${periodo.fechaDesde}&hasta=${periodo.fechaHasta}&horaDesde=${hhMm(periodo.minutosDesde)}&horaHasta=${hhMm(periodo.minutosHasta)}`,
                    carrier.slug,
                  )}
                  className="grid grid-cols-[minmax(120px,150px)_1fr] items-center gap-3 border-t border-[var(--linea-tenue)] py-2 hover:bg-[var(--hover)] focus-visible:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-[var(--azul)] sm:grid-cols-[minmax(120px,150px)_1fr_150px]"
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-[12.5px] text-[var(--texto)] ${mono}`}>
                      {unidad.label}
                    </span>
                    <span className={`block truncate text-[10px] text-[var(--tenue)] ${mono}`}>
                      {unidad.plateNumber ?? "sin placa"}
                      {unidad.activa ? "" : " · dada de baja"}
                    </span>
                  </span>

                  <TiraDia franja={periodo} segmentos={tira} />

                  <span
                    className={`hidden text-right text-[11.5px] text-[var(--tenue)] sm:block ${num}`}
                  >
                    {resumen.puntos === 0 ? (
                      <span className="text-[var(--tenue)]">sin un punto</span>
                    ) : (
                      <>
                        <span className="text-[var(--acero)]">
                          {resumen.kmAproximados.toFixed(1)} km
                        </span>{" "}
                        aprox.
                        <br />
                        {resumen.huecos > 0
                          ? `${resumen.huecos} ${resumen.huecos === 1 ? "hueco" : "huecos"} · máx ${duracion(resumen.huecoMayorMinutos ?? 0)}`
                          : "sin huecos"}
                      </>
                    )}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>

        <p className="mt-4 max-w-[80ch] border-t border-[var(--linea)] pt-4 text-xs text-[var(--tenue)]">
          <span className="text-[var(--texto)]">Cómo se lee la tira.</span> Un silencio de más de{" "}
          <span className={num}>{REGLAS_POR_DEFECTO.huecoMinutos} min</span> entre dos lecturas es
          un hueco: no dice que la unidad estuviera apagada, dice que no hay nada que afirmar de
          ese rato. Aquí la tira solo distingue{" "}
          <span className="text-[var(--texto)]">con dato</span> de{" "}
          <span className="text-[var(--texto)]">sin dato</span> — a {todas.length} renglones el
          matiz entre moverse y estar detenida no se alcanza a leer, y dibujarlo sería teatro.
          Abre una unidad para ver sus tres clases, con el detalle de dónde se paró y cuánto. Los
          kilómetros son <span className="text-[var(--texto)]">aproximados</span>: los tramos con
          velocidad implícita mayor a <span className={num}>{SALTO_GPS_KMH} km/h</span> se
          descartan por ser saltos del equipo, y cada descarte deja un hueco en la suma.
        </p>
      </div>
    </main>
  );
}

function atajo(activo: boolean): string {
  return `rounded-full border px-3 py-1 ${
    activo
      ? "border-[var(--azul)] text-[var(--azul)]"
      : "border-[var(--linea)] text-[var(--tenue)] hover:border-[var(--azul)] hover:text-[var(--texto)]"
  }`;
}

function Vital({
  titulo,
  valor,
  lectura,
}: {
  titulo: string;
  valor: string;
  lectura: string;
}) {
  return (
    <div className="bg-[var(--panel)] p-4">
      <div
        className={`mb-2 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}
      >
        {titulo}
      </div>
      <div
        className="text-2xl leading-none text-[var(--acero)] tabular-nums"
        style={{ fontFamily: "var(--fuente-archivo)", fontWeight: 700 }}
      >
        {valor}
      </div>
      <div className={`mt-1.5 text-[11px] text-[var(--tenue)] ${mono}`}>{lectura}</div>
    </div>
  );
}
