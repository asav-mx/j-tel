import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { ChipResultado } from "@/components/chip-resultado";
import { EjeDeFranja, ETIQUETA_CLASE, LeyendaTira, TiraDia } from "@/components/tira-dia";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";
import {
  cargarDiasDeUnidad,
  cargarServiciosDeUnidad,
  type ServicioDeUnidad,
} from "@/lib/historial-data";
import { hhMm, MAX_DIAS, resolverPeriodo } from "@/lib/historial-periodo";
import { REGLAS_POR_DEFECTO, SALTO_GPS_KMH, type DiaDeUnidad } from "@/lib/historial-unidad";
import {
  duracion,
  fechaDeIso,
  fechaDeIsoSinAnio,
  margen,
  reloj,
  relojCorto,
} from "@/lib/formato-tiempo";
import { JTTEL_TZ } from "@/lib/local-time";

export const dynamic = "force-dynamic";

/**
 * El día de UNA unidad, de cerca — y hasta una semana hacia atrás.
 *
 * Mismo idioma que la flota, una altura más abajo: la flota son N tiras, la
 * unidad es una tira por día con su detalle abierto debajo.
 *
 * Aquí sí aparecen los tres colores de resultado, pero solo en un lugar: el
 * chip de los servicios que el árbitro selló. La tira y los segmentos siguen
 * siendo observación, y siguen en acero.
 */

const num = "font-[family-name:var(--fuente-mono)] tabular-nums";
const mono = "font-[family-name:var(--fuente-mono)]";

export default async function CarrierUnidadHistorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { unitId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Historial de unidad" links={[{ href: "/carrier", label: "← Panel" }]} />
          <p className="text-sm text-[var(--tenue)]">
            Sin datos de carrier. Crea una cuenta en J-Staff → Cuentas.
          </p>
        </div>
      </main>
    );
  }

  // La unidad se busca DENTRO de la flota del carrier resuelto. Un id de otro
  // carrier no encuentra nada: la frontera de cuenta la hace cumplir esto, no
  // un filtro de la vista.
  const repos = getRepos();
  const unidades = await repos.fleet.getUnitsForCarrier(carrier.id);
  const unidad = unidades.find((u) => u.id === unitId);
  if (!unidad) notFound();

  const periodo = resolverPeriodo(sp, { maxDias: MAX_DIAS });

  const [dias, servicios] = await Promise.all([
    cargarDiasDeUnidad({ carrierAccountId: carrier.id, unitId, periodo }),
    cargarServiciosDeUnidad({ carrierAccountId: carrier.id, unitId, periodo }),
  ]);

  const total = {
    km: dias.reduce((t, d) => t + d.kmAproximados, 0),
    saltos: dias.reduce((t, d) => t + d.saltosDescartados, 0),
    movimiento: dias.reduce((t, d) => t + d.minutosEnMovimiento, 0),
    detenida: dias.reduce((t, d) => t + d.minutosDetenida, 0),
    sinDato: dias.reduce((t, d) => t + d.minutosSinDato, 0),
    huecos: dias.reduce((t, d) => t + d.huecos, 0),
    puntos: dias.reduce((t, d) => t + d.puntos, 0),
  };
  const huecoMayor = dias
    .map((d) => d.huecoMayorMinutos)
    .filter((m): m is number => m != null)
    .reduce<number | null>((mayor, m) => (mayor == null || m > mayor ? m : mayor), null);

  const serviciosPorFecha = new Map<string, ServicioDeUnidad[]>();
  for (const s of servicios.deLaUnidad) {
    const lista = serviciosPorFecha.get(s.serviceDate);
    if (lista) lista.push(s);
    else serviciosPorFecha.set(s.serviceDate, [s]);
  }

  const href = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("desde", periodo.fechaDesde);
    p.set("hasta", periodo.fechaHasta);
    p.set("horaDesde", hhMm(periodo.minutosDesde));
    p.set("horaHasta", hhMm(periodo.minutosHasta));
    for (const [k, v] of Object.entries(cambios)) p.set(k, v);
    return withAccount(`/carrier/historial/${unitId}?${p.toString()}`, carrier.slug);
  };

  const unDia = periodo.fechas.length === 1;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title={`Unidad ${unidad.label}`}
          links={[
            {
              href: withAccount("/carrier/historial", carrier.slug),
              label: "← Historial de flota",
            },
            { href: withAccount("/carrier", carrier.slug), label: "Panel" },
          ]}
        />

        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-[var(--tenue)]">
            <span className={`text-[var(--texto)] ${mono}`}>{unidad.plateNumber ?? "sin placa"}</span>
            {unidad.active ? "" : " · unidad dada de baja"} ·{" "}
            {unDia
              ? fechaDeIso(periodo.fechaHasta)
              : `${fechaDeIso(periodo.fechaDesde)} a ${fechaDeIso(periodo.fechaHasta)}`}
          </p>
          <p className={`text-[11px] text-[var(--tenue)] ${mono}`}>
            de {relojCorto(periodo.desde)} a {relojCorto(periodo.hasta)} · reloj de {JTTEL_TZ}
          </p>
        </div>

        <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
          {carrier.slug ? <input type="hidden" name="account" value={carrier.slug} /> : null}
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Del día
            <input
              type="date"
              name="desde"
              defaultValue={periodo.fechaDesde}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            Al día
            <input
              type="date"
              name="hasta"
              defaultValue={periodo.fechaHasta}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            De la hora
            <input
              type="time"
              name="horaDesde"
              defaultValue={hhMm(periodo.minutosDesde)}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tenue)]">
            A la hora
            <input
              type="time"
              name="horaHasta"
              defaultValue={hhMm(periodo.minutosHasta)}
              className="rounded-lg border border-[var(--linea)] bg-black/30 px-3 py-1.5 text-sm text-[var(--texto)] [color-scheme:dark]"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-[var(--azul)] px-4 py-1.5 text-sm text-[var(--azul)] hover:bg-[var(--azul)]/10"
          >
            Ver
          </button>
        </form>

        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          <Link href={href({ desde: periodo.fechaHasta })} className={atajo(unDia)}>
            Solo ese día
          </Link>
          {/*
            El aviso de "tarda unos segundos" se cayó con el motivo que lo
            sostenía: la consulta por unidad dejó el mes en un par de segundos.
            Un atajo que advierte de una espera que ya no ocurre entrena al
            usuario a no creerle a los avisos.
          */}
          <Link
            href={href({ desde: restarDias(periodo.fechaHasta, 6) })}
            className={atajo(periodo.fechas.length === 7)}
          >
            Últimos 7 días
          </Link>
          <Link
            href={href({ desde: restarDias(periodo.fechaHasta, MAX_DIAS - 1) })}
            className={atajo(periodo.fechas.length === MAX_DIAS)}
          >
            Último mes <span className="text-[var(--tenue)]">· {MAX_DIAS} días</span>
          </Link>
          <Link
            href={href({ horaDesde: "00:00", horaHasta: "00:00" })}
            className={atajo(periodo.minutosDesde === 0 && periodo.minutosHasta === 0)}
          >
            Día completo
          </Link>
          <Link href={href({ horaDesde: "05:00", horaHasta: "11:00" })} className={atajo(false)}>
            Mañana · 05:00 a 11:00
          </Link>
        </div>

        {periodo.diasRecortados > 0 ? (
          <div className="mb-6 rounded-xl border border-[var(--azul)]/40 bg-[var(--azul)]/10 p-4 text-sm">
            <span className="text-[var(--azul)]">Aviso del sistema.</span> Pediste{" "}
            <span className={num}>{periodo.diasPedidos} días</span> y se están mostrando los{" "}
            <span className={num}>{periodo.fechas.length}</span> más recientes. El historial se
            consulta de a {MAX_DIAS} días — un mes, que es el rango con el que se audita.
            Para ver más atrás, mueve la fecha de cierre hacia atrás y pide el mes anterior.
          </div>
        ) : null}

        <div className="mb-8 grid grid-cols-2 gap-px border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-4">
          <Vital
            titulo="Rodado del periodo"
            valor={`${total.km.toFixed(1)} km`}
            lectura={
              total.saltos > 0
                ? `aprox. · ${total.saltos} ${total.saltos === 1 ? "salto descartado" : "saltos descartados"}`
                : "aprox. · sin saltos descartados"
            }
          />
          <Vital
            titulo="En movimiento"
            valor={duracion(total.movimiento)}
            lectura={`de ${duracion(total.movimiento + total.detenida)} observadas`}
          />
          <Vital
            titulo="Servicios acreditados"
            valor={`${servicios.deLaUnidad.length}`}
            lectura={
              servicios.deLaUnidad.length === 0
                ? "ninguno en el periodo"
                : `${servicios.deLaUnidad.filter((s) => s.estado === "cumplido").length} cumplidos`
            }
          />
          <Vital
            titulo="Huecos de dato"
            valor={`${total.huecos}`}
            lectura={
              huecoMayor != null
                ? `el mayor, ${duracion(huecoMayor)}`
                : `sin silencios de más de ${REGLAS_POR_DEFECTO.huecoMinutos} min`
            }
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={`text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
            {unDia ? "La franja, de cerca" : `${periodo.fechas.length} días, una tira cada uno`}
          </h2>
          <LeyendaTira />
        </div>

        <div className="mb-2 border border-[var(--linea)] bg-[var(--panel)] p-4">
          <div className="grid grid-cols-[minmax(90px,110px)_1fr] gap-3">
            <span />
            <EjeDeFranja franja={dias[0]!} />
          </div>
          {dias.map((dia) => (
            <div
              key={dia.fecha}
              className="grid grid-cols-[minmax(90px,110px)_1fr] items-center gap-3 border-t border-[var(--linea-tenue)] py-2"
            >
              <span className={`text-[11px] text-[var(--tenue)] ${mono}`}>
                {fechaDeIsoSinAnio(dia.fecha)}
              </span>
              <TiraDia
                franja={dia}
                segmentos={dia.segmentos}
                alto={unDia ? "h-11" : "h-5"}
                marcas={(serviciosPorFecha.get(dia.fecha) ?? [])
                  .filter((s) => s.deadline)
                  .map((s) => ({
                    instante: s.deadline!,
                    etiqueta: `Límite del servicio · ${reloj(s.deadline!)}`,
                  }))}
              />
            </div>
          ))}
        </div>
        <p className={`mb-8 text-[11px] text-[var(--tenue)] ${mono}`}>
          Las rayitas verticales son los límites de los servicios que el árbitro acreditó a esta
          unidad. La tira no recorta en la geocerca: es tu operación completa.
        </p>

        <h2 className={`mb-3 text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
          Servicios del periodo acreditados a esta unidad
        </h2>
        {servicios.deLaUnidad.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--tenue)]">
            Ningún servicio del periodo quedó acreditado a esta unidad.
          </p>
        ) : (
          <div className="mb-4 overflow-x-auto border border-[var(--linea)] bg-[var(--panel)]">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className={`text-left text-[10px] tracking-[.12em] text-[var(--tenue)] uppercase ${mono}`}>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Día</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Servicio</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Resultado</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Llegada y su límite</th>
                  <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {servicios.deLaUnidad.map((s) => (
                  <tr key={s.occurrenceId} className="border-b border-[var(--linea-tenue)]">
                    <td className={`p-3 text-[12px] whitespace-nowrap text-[var(--tenue)] ${mono}`}>
                      {fechaDeIsoSinAnio(s.serviceDate)}
                    </td>
                    <td className="p-3">
                      <span className="text-[var(--texto)]">{s.ruta ?? "Ruta sin nombre"}</span>
                      <span className="block text-[11px] text-[var(--tenue)]">
                        {[s.turno, s.cliente, s.planta].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <ChipResultado estado={s.estado} />
                      {s.estado === "cumplido" && s.timing && s.timing !== "a_tiempo" ? (
                        <span className={`mt-1 block text-[11px] text-[var(--ambar)] ${mono}`}>
                          {s.timing === "tarde" ? "Tarde" : "Temprano"}
                          {s.llegada && s.deadline ? ` · ${margen(s.llegada, s.deadline)}` : ""}
                          {s.lateExcusable ? " · excusable por contrato" : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className={`p-3 text-[12px] whitespace-nowrap text-[var(--tenue)] ${num}`}>
                      {s.llegada ? (
                        <>
                          <span className="text-[var(--acero)]">{reloj(s.llegada)}</span>
                          <span className="block">
                            límite {s.deadline ? reloj(s.deadline) : "—"}
                          </span>
                        </>
                      ) : (
                        <>
                          sin llegada observada
                          <span className="block">
                            límite {s.deadline ? reloj(s.deadline) : "—"}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={withAccount(`/carrier/servicio/${s.occurrenceId}`, carrier.slug)}
                        className="text-[12px] whitespace-nowrap text-[var(--azul)] hover:underline"
                      >
                        Expediente →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {servicios.sinUnidadAcreditada > 0 ? (
          <p className="mb-8 max-w-[74ch] border-l-2 border-[var(--acero)] py-1 pl-4 text-sm text-[var(--tenue)]">
            En el periodo hay{" "}
            <span className={`text-[var(--texto)] ${num}`}>
              {servicios.sinUnidadAcreditada}
            </span>{" "}
            {servicios.sinUnidadAcreditada === 1
              ? "servicio de tus contratos que no está acreditado"
              : "servicios de tus contratos que no están acreditados"}{" "}
            a ninguna unidad — ni a esta ni a otra.{" "}
            <span className="text-[var(--texto)]">No es un hueco de esta pantalla:</span> el
            árbitro solo deja registrada la unidad observada cuando el resultado salió cumplido,
            así que un no cumplido y un pendiente por evidencia nunca nombran unidad. Esos casos
            se atienden en Cumplimiento contractual.
          </p>
        ) : null}

        <h2 className={`mb-3 text-[11px] tracking-[.14em] text-[var(--tenue)] uppercase ${mono}`}>
          Segmento por segmento
        </h2>
        {dias.map((dia, indice) => (
          <TablaDeSegmentos key={dia.fecha} dia={dia} abierto={indice === 0} soloUno={unDia} />
        ))}

        <p className="mt-6 max-w-[80ch] border-t border-[var(--linea)] pt-4 text-xs text-[var(--tenue)]">
          <span className="text-[var(--texto)]">Cómo se lee.</span> Un silencio de más de{" "}
          <span className={num}>{REGLAS_POR_DEFECTO.huecoMinutos} min</span> entre dos lecturas es
          un hueco — no dice que la unidad estuviera apagada ni en patio, dice que de ese rato no
          hay nada que afirmar. Se llama <span className="text-[var(--texto)]">detenida</span> a
          quedarse dentro de <span className={num}>{REGLAS_POR_DEFECTO.radioDetenidaMetros} m</span>{" "}
          por más de <span className={num}>{REGLAS_POR_DEFECTO.detenidaMinutos} min</span>. Los
          kilómetros son <span className="text-[var(--texto)]">aproximados</span>: los tramos con
          velocidad implícita mayor a <span className={num}>{SALTO_GPS_KMH} km/h</span> se
          descartan por ser saltos del equipo. Esta pantalla no emite resultados; los únicos que
          aparecen son los que el árbitro ya había sellado.
        </p>
      </div>
    </main>
  );
}

function TablaDeSegmentos({
  dia,
  abierto,
  soloUno,
}: {
  dia: DiaDeUnidad;
  abierto: boolean;
  soloUno: boolean;
}) {
  const tabla = (
    <div className="overflow-x-auto border border-[var(--linea)] bg-[var(--panel)]">
      {dia.segmentos.length === 0 ? (
        <p className="p-4 text-sm text-[var(--tenue)]">Sin franja observable ese día.</p>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className={`text-left text-[10px] tracking-[.12em] text-[var(--tenue)] uppercase ${mono}`}>
              <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Inicio</th>
              <th className="border-b border-[var(--linea-fuerte)] p-3 font-medium">Segmento</th>
              <th className="border-b border-[var(--linea-fuerte)] p-3 text-right font-medium">Duración</th>
              <th className="border-b border-[var(--linea-fuerte)] p-3 text-right font-medium">Km aprox.</th>
              <th className="border-b border-[var(--linea-fuerte)] p-3 text-right font-medium">Lecturas</th>
            </tr>
          </thead>
          <tbody>
            {dia.segmentos.map((s, i) => (
              <tr key={`${dia.fecha}-${i}`} className="border-b border-[var(--linea-tenue)]">
                <td className={`p-3 text-[12px] whitespace-nowrap text-[var(--tenue)] ${num}`}>
                  {reloj(s.desde)}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-[2px] border-[1.5px] px-2 pt-[2.5px] pb-[1.5px] text-[9.5px] font-medium tracking-[.12em] whitespace-nowrap uppercase ${mono} ${
                      s.clase === "sin_dato"
                        ? "border-[var(--tenue)]/50 text-[var(--tenue)]"
                        : "border-[var(--acero)]/60 text-[var(--acero)]"
                    }`}
                  >
                    {ETIQUETA_CLASE[s.clase]}
                  </span>
                  {s.clase === "sin_dato" ? (
                    <span className="ml-2 text-[11px] text-[var(--tenue)]">
                      no hay nada que afirmar de este rato
                    </span>
                  ) : null}
                  {s.saltosDescartados > 0 ? (
                    <span className="ml-2 text-[11px] text-[var(--tenue)]">
                      {s.saltosDescartados}{" "}
                      {s.saltosDescartados === 1 ? "salto descartado" : "saltos descartados"}
                    </span>
                  ) : null}
                </td>
                <td className={`p-3 text-right text-[12px] whitespace-nowrap text-[var(--acero)] ${num}`}>
                  {duracion(s.minutos)}
                </td>
                <td className={`p-3 text-right text-[12px] text-[var(--acero)] ${num}`}>
                  {s.clase === "sin_dato" ? "—" : s.kmAproximados.toFixed(1)}
                </td>
                <td className={`p-3 text-right text-[12px] text-[var(--tenue)] ${num}`}>
                  {s.clase === "sin_dato" ? "—" : s.puntos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (soloUno) return tabla;

  return (
    <details open={abierto} className="mb-2">
      <summary
        className={`cursor-pointer border border-[var(--linea)] bg-[var(--panel)] p-3 text-[12px] text-[var(--texto)] ${mono}`}
      >
        {fechaDeIso(dia.fecha)} · {duracion(dia.minutosEnMovimiento)} en movimiento ·{" "}
        {dia.kmAproximados.toFixed(1)} km aprox. ·{" "}
        {dia.huecos === 0
          ? "sin huecos"
          : `${dia.huecos} ${dia.huecos === 1 ? "hueco" : "huecos"}`}
      </summary>
      <div className="mt-1">{tabla}</div>
    </details>
  );
}

/** Resta días a una fecha ISO sin salirse del día civil. */
function restarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d!, 12));
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
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
      <div className={`mb-2 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
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
