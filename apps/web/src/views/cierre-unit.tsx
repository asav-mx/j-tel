import Link from "next/link";
import { loadCierre, type ServicioDelCierre } from "@/lib/cierre-data";
import { CierreMapa } from "@/components/cierre-mapa";
import { UnitShell } from "@/components/unit-shell";
import { withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";
import type { UnitPageContext } from "@/lib/unit-context";
import { scopeToUnitPath } from "@/lib/unit-routes";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { localDateIso } from "@/lib/local-time";
import { dayForDateQuery } from "@jtel/domain";
import { formatearDuracion } from "@jtel/services";
import {
  AfirmacionPendiente,
  MedidaCobertura,
  NotaHonestaPendiente,
  rielPendiente,
} from "@/components/caso-pendiente-evidencia";
import { ChipResultado as Chip } from "@/components/chip-resultado";
import { HistoriaDelSello, PuntoHistoriaSello } from "@/components/historia-del-sello";

/**
 * Cierre del turno.
 *
 * La ley de la pantalla: entrega un resultado ya dado; nunca pone al usuario a
 * trabajarlo. El estado de entrada es el resultado del turno. El detalle —mapa,
 * tabla de los limpios— se abre por elección, nunca es la portada.
 *
 * Absorbe el antiguo Historial: el selector de fecha muestra el cierre de
 * cualquier turno pasado, y el mapa de contraste sigue aquí.
 */

function parseParam(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = sp?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function soloHora(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const RAZON_COBERTURA: Record<string, string> = {
  no_entry: "no quedó registro de la corrida que produjo este sello",
  ambiguous: "hay varias corridas y ninguna se puede atribuir a este sello sin adivinar",
  out_of_tolerance: "la corrida más cercana está demasiado lejos del sello",
  sin_paso: "la corrida no registró la medición de cobertura",
};

export async function CierreUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const fecha = parseParam(sp, "fecha") ?? localDateIso();
  const turno = parseParam(sp, "turno");

  const repos = getRepos();
  const day = dayForDateQuery(fecha);
  const occs = await repos.occurrences.findForScope(ctx.scope, day, day);

  const shiftById = new Map<string, { id: string; name: string; startTime: string }>();
  for (const o of occs) {
    const s = o.profile?.routeShift?.shift;
    if (s?.id && !shiftById.has(s.id)) {
      shiftById.set(s.id, {
        id: s.id,
        name: s.name,
        startTime: String(s.startTime ?? "").slice(0, 5),
      });
    }
  }
  const turnos = [...shiftById.values()].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );
  const turnoId = turno && shiftById.has(turno) ? turno : (turnos[0]?.id ?? null);

  const cierre = turnoId
    ? await loadCierre({
        scope: ctx.scope,
        accountSlug: ctx.client.slug,
        fecha,
        turnoId,
      })
    : null;

  const basePath = scopeToUnitPath(ctx.scope);
  const unitLabel = operationalUnitLabel(ctx.unit);
  const tz = cierre?.zonaHoraria ?? "America/Ciudad_Juarez";
  const href = (f: string, t: string | null) =>
    withAccount(`${basePath}/cierre?fecha=${f}${t ? `&turno=${t}` : ""}`, ctx.client.slug);

  const dia = (delta: number) => {
    const d = new Date(`${fecha}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };

  return (
    <UnitShell client={ctx.client} unit={ctx.unit} title={`Cierre del turno — ${unitLabel}`}>
      {/* ── Selector: fecha y turno ─────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center rounded-sm border border-[var(--linea-fuerte)]">
          <Link
            href={href(dia(-1), turnoId)}
            aria-label="Día anterior"
            className="px-3 py-2 font-mono text-sm text-[var(--tenue)] transition-colors hover:text-[var(--texto)]"
          >
            ‹
          </Link>
          <span className="border-x border-[var(--linea)] px-3.5 py-2 font-mono text-[13px] whitespace-nowrap text-[var(--texto)]">
            {fecha}
          </span>
          <Link
            href={href(dia(1), turnoId)}
            aria-label="Día siguiente"
            className="px-3 py-2 font-mono text-sm text-[var(--tenue)] transition-colors hover:text-[var(--texto)]"
          >
            ›
          </Link>
        </div>

        {turnos.length > 0 ? (
          <div className="flex overflow-hidden rounded-sm border border-[var(--linea-fuerte)]">
            {turnos.map((t, i) => (
              <Link
                key={t.id}
                href={href(fecha, t.id)}
                aria-current={t.id === turnoId ? "page" : undefined}
                className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                  i > 0 ? "border-l border-[var(--linea-fuerte)]" : ""
                } ${
                  t.id === turnoId
                    ? "bg-[var(--t-acero)] text-[var(--texto)]"
                    : "text-[var(--tenue)] hover:text-[var(--texto)]"
                }`}
              >
                {t.name} <span className="font-mono text-[11px]">{t.startTime}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {!cierre ? (
        <p className="mt-10 text-[15px] text-[var(--tenue)]">
          No hay servicios programados para esta fecha en {unitLabel}.
        </p>
      ) : (
        <>
          {/* ── La tesis de la pantalla ──────────────────────────────── */}
          <h1 className="mt-7 mb-2.5 max-w-[24ch] font-[family-name:var(--fuente-archivo)] text-[clamp(28px,5vw,42px)] leading-[1.02] font-bold tracking-[-0.022em]">
            {cierre.titular}
          </h1>

          <p className="max-w-[62ch] text-[var(--tenue)]">
            {cierre.conteo.total} servicios verificados
            {cierre.ventanasConEvidencia ? (
              <>
                {" · evidencia completa en "}
                <b className="font-mono font-medium text-[var(--texto)]">
                  {cierre.ventanasConEvidencia.suficientes} de{" "}
                  {cierre.ventanasConEvidencia.medidas}
                </b>
                {" ventanas"}
              </>
            ) : null}
            {cierre.deadlineEn ? (
              <>
                {" · deadline "}
                <b className="font-mono font-medium text-[var(--texto)]">
                  {soloHora(cierre.deadlineEn, tz)}
                </b>
              </>
            ) : null}
            {cierre.toleranciaMinutos != null ? (
              <>
                {" · tolerancia "}
                <b className="font-mono font-medium text-[var(--texto)]">
                  {formatearDuracion(cierre.toleranciaMinutos)}
                </b>
              </>
            ) : null}
            {". "}
            <span className="font-mono text-[12px]">reloj: {tz}</span>
          </p>

          <div className="mt-5 flex flex-wrap gap-6 font-mono text-[12px] text-[var(--tenue)]">
            <Conteo n={cierre.conteo.cumplido} color="var(--verde)" texto="cumplidos">
              {cierre.conteo.tarde > 0 ? ` · ${cierre.conteo.tarde} tarde` : null}
            </Conteo>
            <Conteo n={cierre.conteo.no_cumplido} color="var(--rojo)" texto="no cumplido" />
            <Conteo
              n={cierre.conteo.pendiente_evidencia}
              color="var(--ambar)"
              texto="pendiente por evidencia"
            />
            {cierre.conteo.sin_verificar > 0 ? (
              <Conteo
                n={cierre.conteo.sin_verificar}
                color="var(--acero)"
                texto="sin verificar todavía"
              />
            ) : null}
          </div>

          {/* ── El mapa ──────────────────────────────────────────────── */}
          <Seccion titulo="El turno en el mapa — solo lo que te necesita" />
          <CierreMapa excepciones={cierre.excepciones} limpios={cierre.limpios} />

          {/* ── Las excepciones ──────────────────────────────────────── */}
          {cierre.excepciones.length > 0 ? (
            <>
              <Seccion titulo="Lo que te necesita" />
              {cierre.excepciones.map((s) => (
                <Caso key={s.occurrenceId} s={s} tz={tz} slug={ctx.client.slug} />
              ))}
            </>
          ) : null}

          {/* ── El cajón de los limpios ──────────────────────────────── */}
          {cierre.limpios.length > 0 ? (
            <details className="mt-2 border-t border-[var(--linea)]">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-5 text-[15px] text-[var(--tenue)] [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-[11px]">▸</span>
                <span>
                  <b className="font-medium text-[var(--texto)]">
                    {cierre.limpios.length} servicios
                  </b>{" "}
                  cerraron limpio — la tabla con sus medidas
                </span>
              </summary>
              <TablaLimpios servicios={cierre.limpios} tz={tz} />
            </details>
          ) : null}

          <div className="mt-14 border-t border-[var(--linea)] pt-5 font-mono text-[11px] leading-[1.9] text-[var(--tenue)]">
            Cierre del turno · J-Telemetry. Absorbe el antiguo Historial: el selector de fecha
            muestra el cierre de cualquier turno pasado.
            <br />
            Vista derivada de hechos ya sellados — abrirla no verifica de nuevo nada. Las trazas
            cortan en la llegada a geocerca.
          </div>
        </>
      )}
    </UnitShell>
  );
}

function Conteo({
  n,
  color,
  texto,
  children,
}: {
  n: number;
  color: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <span>
      <b
        className="mr-2 align-[-2px] font-[family-name:var(--fuente-archivo)] text-[24px] font-bold tracking-[-0.01em]"
        style={{ color }}
      >
        {n}
      </b>
      {texto}
      {children ? <span className="opacity-70">{children}</span> : null}
    </span>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  return (
    <h2 className="mt-10 mb-3.5 border-b border-[var(--linea)] pb-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--tenue)] uppercase">
      {titulo}
    </h2>
  );
}

/** El riel izquierdo: la cifra que resume el caso, y qué mide. */
function riel(s: ServicioDelCierre, tz: string): { cifra: string; sub: string; color: string } {
  if (s.estado === "no_cumplido") {
    return { cifra: "—", sub: "Sin llegada en la ventana", color: "var(--rojo)" };
  }
  if (s.estado === "pendiente_evidencia") {
    // Ámbar: es la carencia que dejó al servicio sin juzgar, no un veredicto.
    return { ...rielPendiente(s), color: "var(--ambar)" };
  }
  return {
    cifra: soloHora(s.llegadaEn, tz),
    sub: "Llegada medida",
    color: "var(--ambar)",
  };
}

function Caso({ s, tz, slug }: { s: ServicioDelCierre; tz: string; slug: string }) {
  const r = riel(s, tz);

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-[var(--linea)] py-6 sm:grid-cols-[118px_1fr] sm:gap-7">
      <div className="pt-0.5">
        <div
          className="font-[family-name:var(--fuente-archivo)] text-[22px] leading-none font-bold tracking-[-0.015em]"
          style={{ color: r.color }}
        >
          {r.cifra}
        </div>
        <div className="mt-1.5 font-mono text-[10px] leading-[1.5] font-medium tracking-[0.14em] text-[var(--tenue)] uppercase">
          {r.sub}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-2.5 flex flex-wrap items-center gap-3 font-mono text-[10.5px] font-medium tracking-[0.15em] text-[var(--tenue)] uppercase">
          <Chip estado={s.estado} />
          <span>
            {s.profileName}
            {s.unidadLabel ? ` · Unidad ${s.unidadLabel}` : ""}
          </span>
          <PuntoHistoriaSello historia={s.historiaSello} />
        </p>

        <h3 className="mb-3 max-w-[42ch] font-[family-name:var(--fuente-archivo)] text-[19px] leading-[1.24] font-semibold">
          <Afirmacion s={s} tz={tz} />
        </h3>

        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5 border border-[var(--linea)] bg-[var(--panel)] px-3.5 py-2.5 font-mono text-[12px] text-[var(--tenue)]">
          <MedidaCobertura
            cobertura={s.cobertura}
            textoNoDisponible={`Medición de cobertura no disponible — ${
              s.cobertura.disponible
                ? ""
                : (RAZON_COBERTURA[s.cobertura.razon] ?? "no se pudo atribuir a este sello")
            }`}
          />

          {s.matchPct != null ? (
            <span>
              Cobertura de ruta <b className="font-medium text-[var(--acero)]">{pct(s.matchPct)}</b>
              {s.matchUmbralPct != null ? (
                <>
                  {" · umbral "}
                  <b className="font-medium text-[var(--texto)]">{pct(s.matchUmbralPct)}</b>
                </>
              ) : null}
            </span>
          ) : null}

          {s.llegadaEn && s.limiteEn ? (
            <span>
              Entró a geocerca{" "}
              <b className="font-medium text-[var(--acero)]">{soloHora(s.llegadaEn, tz)}</b>
              {" · límite "}
              <b className="font-medium text-[var(--texto)]">{soloHora(s.limiteEn, tz)}</b>
            </span>
          ) : null}
        </div>

        {s.estado === "pendiente_evidencia" ? <NotaHonestaPendiente /> : null}

        {/*
          Aquí va el bloque de consecuencias — enforcement. Parqueado por
          decisión de producto hasta que el árbitro sea confiable: encenderlo
          antes multiplica los errores en vez de corregirlos. El hueco queda
          reservado a propósito, como el circuito de defensa en el expediente.
        */}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={withAccount(`/cliente/servicio/${s.occurrenceId}`, slug)}
            className="inline-block cursor-pointer rounded-sm border border-[var(--acero)] px-3.5 py-2 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--acero)] uppercase transition-colors hover:bg-[var(--hover)]"
          >
            Abrir el expediente
          </Link>
          <HistoriaDelSello historia={s.historiaSello} timeZone={tz} />
        </div>
      </div>
    </div>
  );
}

function Afirmacion({ s, tz }: { s: ServicioDelCierre; tz: string }) {
  if (s.estado === "no_cumplido") {
    const alcanza = s.cobertura.disponible && s.cobertura.pct >= s.cobertura.minimoPct;
    return (
      <>
        Ninguna unidad sirvió la ruta
        {alcanza ? (
          <>
            ,{" "}
            <em className="text-[var(--rojo)] not-italic">y la evidencia alcanza para afirmarlo</em>
          </>
        ) : null}
        .
      </>
    );
  }

  if (s.estado === "pendiente_evidencia") {
    return (
      <AfirmacionPendiente
        causa={s.causa}
        hueco={s.hueco}
        fraccionObservada={s.fraccionObservada}
        tz={tz}
      />
    );
  }

  const fuera =
    s.margenMinutos != null && s.margenMinutos > 0 ? formatearDuracion(s.margenMinutos) : null;
  return (
    <>
      Cumplió la ruta y llegó{" "}
      {fuera ? (
        <em className="text-[var(--ambar)] not-italic">{fuera} fuera de tolerancia</em>
      ) : (
        "dentro de tolerancia"
      )}
      .
    </>
  );
}

function TablaLimpios({ servicios, tz }: { servicios: ServicioDelCierre[]; tz: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="mb-4 w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {["Ruta", "Unidad", "Llegada", "Margen", "Cobertura de ruta"].map((h, i) => (
              <th
                key={h}
                className={`border-b border-[var(--linea-fuerte)] pr-2.5 pb-2 font-mono text-[10px] font-medium tracking-[0.12em] text-[var(--tenue)] uppercase ${
                  i >= 3 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servicios.map((s) => (
            <tr key={s.occurrenceId} className="hover:bg-[var(--hover)]">
              <td className="border-b border-[var(--linea-tenue)] py-2 pr-2.5">
                {s.profileName}
                <PuntoHistoriaSello historia={s.historiaSello} className="ml-2 align-middle" />
              </td>
              <td className="border-b border-[var(--linea-tenue)] py-2 pr-2.5 font-mono text-[12px] whitespace-nowrap text-[var(--tenue)]">
                {s.unidadLabel ?? "—"}
              </td>
              <td className="border-b border-[var(--linea-tenue)] py-2 pr-2.5 font-mono text-[12px] whitespace-nowrap text-[var(--tenue)]">
                {soloHora(s.llegadaEn, tz)}
              </td>
              <td className="border-b border-[var(--linea-tenue)] py-2 pr-2.5 text-right font-mono text-[12px] text-[var(--acero)]">
                {s.margenMinutos == null
                  ? "—"
                  : `${s.margenMinutos < 0 ? "−" : "+"}${formatearDuracion(s.margenMinutos)}`}
              </td>
              <td className="border-b border-[var(--linea-tenue)] py-2 pr-2.5 text-right font-mono text-[12px] text-[var(--acero)]">
                {s.matchPct == null ? "—" : pct(s.matchPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
