import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { JTTEL_TZ, localDateIso } from "@/lib/local-time";
import { construirCenso, ventanaLocal, SALTO_GPS_KMH } from "@jtel/services";

export const dynamic = "force-dynamic";

/**
 * Recorrido de la flota — observación pura de lo propio.
 *
 * El carrier ve TODAS sus unidades sobre una ventana de tiempo, sin depender
 * del match ni de las ocurrencias. Cero veredicto: esta pantalla no sabe qué
 * es un cumplido, y por eso no usa verde, ámbar ni rojo en ningún lado.
 *
 * PR 1 de 3: el censo y la medición por unidad. El mapa viene en el 2.
 */

const HORA_POR_DEFECTO_DESDE = 5 * 60; // 05:00 local
const HORA_POR_DEFECTO_HASTA = 11 * 60; // 11:00 local

function minutosDeHhMm(raw: string | string[] | undefined, porDefecto: number): number {
  if (typeof raw !== "string") return porDefecto;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return porDefecto;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return porDefecto;
  return h * 60 + min;
}

function hhMm(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fechaValida(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/** Hora del reloj del despliegue. La zona SIEMPRE se escribe en pantalla. */
function reloj(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: JTTEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Fecha completa. En contexto de evidencia no se abrevia. */
function fechaCompleta(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: JTTEL_TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Categorías del censo. Son estados de observación, no veredictos: van en
 * acero y tenue. El anillo azul de "nunca reportó" marca aviso del sistema —
 * es configuración incompleta, no un resultado de la operación.
 */
const CATEGORIA = {
  reporto: {
    etiqueta: "Reportó",
    clase: "bg-[var(--acero)]/15 text-[var(--acero)]",
  },
  dejo_de_reportar: {
    etiqueta: "Dejó de reportar",
    clase: "bg-white/5 text-[var(--tenue)]",
  },
  nunca_reporto: {
    etiqueta: "Nunca ha reportado",
    clase: "bg-white/5 text-[var(--tenue)] ring-1 ring-[var(--azul)]/50",
  },
} as const;

const num = "font-[var(--fuente-mono)] tabular-nums text-[var(--acero)]";
const sinDato = <span className="text-[var(--tenue)]">sin dato</span>;

export default async function CarrierRecorridoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin datos de carrier. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const fecha = fechaValida(sp?.fecha) ?? localDateIso(new Date(), JTTEL_TZ);
  const minDesde = minutosDeHhMm(sp?.desde, HORA_POR_DEFECTO_DESDE);
  const minHasta = minutosDeHhMm(sp?.hasta, HORA_POR_DEFECTO_HASTA);
  const ventana = ventanaLocal(fecha, minDesde, minHasta, JTTEL_TZ);

  const repos = getRepos();

  // Las dos consultas no dependen entre sí: en paralelo, no en fila.
  const [todasLasUnidades, puntos, marcas] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.telemetry.getForCarrierWindow(carrier.id, ventana.desde, ventana.hasta),
    repos.telemetry.listWatermarks(),
  ]);

  const unidades = todasLasUnidades
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, label: u.label, plateNumber: u.plateNumber }));

  const observados = puntos
    .filter((p): p is typeof p & { unitId: string } => Boolean(p.unitId))
    .map((p) => ({
      unitId: p.unitId,
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      recordedAt: p.recordedAt,
    }));

  // La consulta del último dato conocido barre la tabla entera (462 ms
  // medidos). Solo hace falta si hay unidades mudas, así que se salta cuando
  // toda la flota reportó.
  const conDatoEnVentana = new Set(observados.map((p) => p.unitId));
  const hayMudas = unidades.some((u) => !conDatoEnVentana.has(u.id));
  const ultimoDatoPorUnidad = hayMudas
    ? await repos.telemetry.getLastPointPerUnit(carrier.id)
    : new Map<string, Date>();

  const censo = construirCenso({
    ventana: { desde: ventana.desde, hasta: ventana.hasta },
    unidades,
    puntos: observados,
    ultimoDatoPorUnidad,
  });

  // El archivador puede ir atrás de la ventana. Sin decirlo, un hueco de
  // archivado se lee como un hueco de operación — el error del 28 de julio.
  const marca = marcas.find((m) => m.carrierAccountId === carrier.id);
  const ventanaAunSeLlena = marca ? marca.lastRecordedAt < ventana.hasta : true;

  const href = (o: { fecha?: string; desde?: string; hasta?: string }) => {
    const p = new URLSearchParams();
    p.set("fecha", o.fecha ?? fecha);
    p.set("desde", o.desde ?? hhMm(minDesde));
    p.set("hasta", o.hasta ?? hhMm(minHasta));
    return withAccount(`/carrier/recorrido?${p.toString()}`, carrier.slug);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title={`Recorrido — ${carrier.name}`}
          links={[
            { href: withAccount("/carrier", carrier.slug), label: "Panel" },
            { href: withAccount("/carrier/flota", carrier.slug), label: "Flota" },
            { href: withAccount("/carrier/gps", carrier.slug), label: "Proveedor GPS" },
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "Cumplimiento contractual",
            },
          ]}
        />

        <p className="mb-6 text-sm text-[var(--muted)]">
          Todas tus unidades sobre una ventana de tiempo, tal como las reportó el GPS.
          Esta pantalla <span className="text-white">no emite ningún veredicto</span>: no
          consulta hechos sellados ni sabe qué ruta debía hacerse. Es tu flota, y solo la
          tuya.
        </p>

        <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
          {carrier.slug ? <input type="hidden" name="account" value={carrier.slug} /> : null}
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            Fecha
            <input
              type="date"
              name="fecha"
              defaultValue={fecha}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            Desde
            <input
              type="time"
              name="desde"
              defaultValue={hhMm(minDesde)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            Hasta
            <input
              type="time"
              name="hasta"
              defaultValue={hhMm(minHasta)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm text-black"
          >
            Ver
          </button>
          <a
            href={href({ desde: "22:00", hasta: "06:00" })}
            className="rounded-full border border-white/10 px-3 py-1 text-sm hover:border-[var(--azul)]"
          >
            Turno de noche
          </a>
          <a
            href={href({ desde: "00:00", hasta: "00:00" })}
            className="rounded-full border border-white/10 px-3 py-1 text-sm hover:border-[var(--azul)]"
          >
            Día completo
          </a>
        </form>

        <p className="mb-6 text-xs text-[var(--tenue)]">
          Ventana: {fechaCompleta(ventana.desde)}, de {reloj(ventana.desde)} a{" "}
          {reloj(ventana.hasta)} — {duracion(censo.ventana.minutos)}.{" "}
          {ventana.cruzaMedianoche ? "Cruza medianoche y termina al día siguiente. " : ""}
          Todas las horas de esta pantalla están en el reloj de{" "}
          <span className="text-[var(--acero)]">{JTTEL_TZ}</span>.
        </p>

        {ventanaAunSeLlena ? (
          <div className="mb-6 rounded-xl border border-[var(--azul)]/40 bg-[var(--azul)]/10 p-4 text-sm">
            <span className="text-[var(--azul)]">Aviso del sistema.</span> Esta ventana
            todavía se está llenando: el archivador va{" "}
            {marca ? (
              <>
                al {fechaCompleta(marca.lastRecordedAt)}, {reloj(marca.lastRecordedAt)}
              </>
            ) : (
              "sin marca de agua registrada"
            )}
            , antes del final de la ventana. Los huecos que veas aquí pueden ser de
            archivado y no de operación.
          </div>
        ) : null}

        <div className="mb-6">
          <Card title="Censo de la flota">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className={`text-3xl ${num}`}>{censo.activas}</div>
                <div className="text-xs text-[var(--muted)]">unidades activas</div>
              </div>
              <div>
                <div className={`text-3xl ${num}`}>{censo.reportaron}</div>
                <div className="text-xs text-[var(--muted)]">reportaron en la ventana</div>
              </div>
              <div>
                <div className={`text-3xl ${num}`}>{censo.dejaronDeReportar}</div>
                <div className="text-xs text-[var(--muted)]">dejaron de reportar</div>
              </div>
              <div>
                <div className={`text-3xl ${num}`}>{censo.nuncaReportaron}</div>
                <div className="text-xs text-[var(--muted)]">nunca han reportado</div>
              </div>
            </div>

            {censo.nuncaReportaron > 0 ? (
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-[var(--muted)]">
                <span className="text-white">
                  {censo.nuncaReportaron}{" "}
                  {censo.nuncaReportaron === 1 ? "unidad activa" : "unidades activas"} sin un
                  solo punto en toda su historia.
                </span>{" "}
                Si alguna hace una ruta, el sistema no ve nada — y eso no es una falla de la
                verificación, es una unidad que nunca llegó a estar conectada.
              </p>
            ) : null}
          </Card>
        </div>

        <Card title={`Por unidad (${censo.filas.length})`}>
          {censo.filas.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Este carrier no tiene unidades activas registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-[var(--muted)]">
                    <th className="pb-2 pr-4 font-medium">Unidad</th>
                    <th className="pb-2 pr-4 font-medium">Estado</th>
                    <th className="pb-2 pr-4 text-right font-medium">Puntos</th>
                    <th className="pb-2 pr-4 text-right font-medium">Ping mediano</th>
                    <th className="pb-2 pr-4 text-right font-medium">Km aprox.</th>
                    <th className="pb-2 pr-4 font-medium">Primer dato</th>
                    <th className="pb-2 font-medium">Último dato</th>
                  </tr>
                </thead>
                <tbody>
                  {censo.filas.map((f) => (
                    <tr key={f.unitId} className="border-b border-white/5">
                      <td className="py-2 pr-4">
                        <div className="text-white">{f.label}</div>
                        {f.plateNumber ? (
                          <div className="text-xs text-[var(--tenue)]">{f.plateNumber}</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${CATEGORIA[f.categoria].clase}`}
                        >
                          {CATEGORIA[f.categoria].etiqueta}
                        </span>
                        {f.equipos > 1 ? (
                          <div className="mt-1 text-xs text-[var(--tenue)]">
                            {f.equipos} equipos GPS
                          </div>
                        ) : null}
                      </td>
                      <td className={`py-2 pr-4 text-right ${num}`}>
                        {f.categoria === "reporto" ? f.puntos : "—"}
                      </td>
                      <td className={`py-2 pr-4 text-right ${num}`}>
                        {f.intervaloMedianoSegundos != null
                          ? `${f.intervaloMedianoSegundos.toFixed(1)} s`
                          : "—"}
                      </td>
                      <td className={`py-2 pr-4 text-right ${num}`}>
                        {f.kmAproximados != null ? f.kmAproximados.toFixed(2) : "—"}
                        {f.saltosDescartados > 0 ? (
                          <div className="text-xs text-[var(--tenue)]">
                            {f.saltosDescartados}{" "}
                            {f.saltosDescartados === 1 ? "salto" : "saltos"} descartado
                            {f.saltosDescartados === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-[var(--tenue)]">
                        {f.primerDato ? reloj(f.primerDato) : sinDato}
                      </td>
                      <td className="py-2 text-[var(--tenue)]">
                        {f.ultimoDato ? (
                          reloj(f.ultimoDato)
                        ) : f.ultimoDatoConocido ? (
                          <span title="Fuera de esta ventana">
                            {fechaCompleta(f.ultimoDatoConocido)}, {reloj(f.ultimoDatoConocido)}
                          </span>
                        ) : (
                          sinDato
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 border-t border-white/10 pt-4 text-xs text-[var(--muted)]">
            <span className="text-[var(--tenue)]">Ping mediano</span> es el tiempo típico
            entre dos lecturas consecutivas del equipo con más puntos de esa unidad — mide
            con qué resolución se pudo observar, no cómo se manejó. Los{" "}
            <span className="text-[var(--tenue)]">kilómetros son aproximados</span>: los
            tramos con velocidad implícita mayor a {SALTO_GPS_KMH} km/h se descartan por ser saltos
            del equipo, y cada descarte deja un hueco en la suma.
          </p>
        </Card>
      </div>
    </main>
  );
}
