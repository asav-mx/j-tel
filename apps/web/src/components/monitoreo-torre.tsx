"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MonitoreoPayload, MonitoreoRoute } from "@/lib/monitoreo-data";
import { SIN_SENAL_MINUTOS } from "@/lib/monitoreo-umbrales";
import { formatearDuracion } from "@/lib/local-time";
import { MonitoreoMapa } from "@/components/monitoreo-map";

/**
 * La torre — Monitoreo en vuelo (Ficha-Monitoreo.md §2 a §4).
 *
 * La ley que gobierna esta pantalla entera: **la torre muestra lo que está
 * pasando, no lo que se resolvió**. De ahí sale la consecuencia dura del skill
 * de que aquí no aparezca ningún color de veredicto — ni verde ni rojo — y el
 * ámbar solo como aviso del sistema, nunca como falta. Todo lo demás es acero,
 * que es el color de lo medido.
 *
 * Una unidad que llegó a las 06:40 se lee "Llegó 06:40", jamás "cumplió": el
 * árbitro todavía no juzga, y una pantalla que se adelante contradice al
 * producto que la sostiene.
 */

const REFRESH_MS = 45_000;

/**
 * Concordancia de número. Existe como función y no escrita a mano en cada
 * frase porque "1 rutas" ya se coló una vez a producción: una plantilla que
 * interpola el conteo y deja el plural fijo falla siempre en el caso de uno.
 */
function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "hace 3 min" — y por debajo del minuto no se finge precisión que no hay. */
function antiguedad(minutos: number): string {
  return minutos < 1 ? "hace menos de 1 min" : `hace ${formatearDuracion(minutos)}`;
}

export function MonitoreoTorre({
  initial,
  query,
  forzado = false,
}: {
  initial: MonitoreoPayload;
  /** Query string para /api/monitoreo (account, fecha, turno, groupId|plantId). */
  query: string;
  /**
   * El usuario pidió una fecha o un turno concretos. La leyenda no puede decir
   * "vista en vivo" de un turno que ya cerró, y el punto no pulsa porque no
   * hay nada moviéndose que mirar.
   */
  forzado?: boolean;
}) {
  const [data, setData] = useState<MonitoreoPayload>(initial);
  const [pausado, setPausado] = useState(forzado);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitoreo?${query}`, { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as MonitoreoPayload);
    } catch {
      // Silencioso: el siguiente ciclo reintenta.
    }
  }, [query]);

  useEffect(() => {
    if (pausado) return;
    const id = setInterval(() => void refrescar(), REFRESH_MS);
    return () => clearInterval(id);
  }, [refrescar, pausado]);

  return (
    <div className="space-y-5">
      <Leyenda
        actualizado={data.generatedAt}
        pausado={pausado}
        forzado={forzado}
        onPausar={setPausado}
        onRefrescar={() => void refrescar()}
      />
      <Banda data={data} />
      <MonitoreoMapa routes={data.routes} />
      <Lista data={data} />
      <TiraLlegadas routes={data.routes} />
    </div>
  );
}

/* ── §2 · La leyenda permanente ─────────────────────────────────────────────
   Siempre visible, nunca como nota al pie: es la frontera del producto dicha
   en voz alta. El punto pulsa porque la vista está viva; el movimiento aquí es
   continuidad, no adorno, y no toca ningún resultado. */

function Leyenda({
  actualizado,
  pausado,
  forzado,
  onPausar,
  onRefrescar,
}: {
  actualizado: string;
  pausado: boolean;
  forzado: boolean;
  onPausar: (v: boolean) => void;
  onRefrescar: () => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border px-4 py-2.5 ${
        forzado
          ? "border-[var(--linea)] bg-[var(--panel2)]"
          : "border-[var(--b-acero)] bg-[var(--t-acero)]"
      }`}
    >
      <span className="relative flex h-2 w-2 flex-none" aria-hidden="true">
        {pausado || forzado ? null : (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--acero)] opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            forzado ? "bg-[var(--tenue)]" : "bg-[var(--acero)]"
          }`}
        />
      </span>
      <p className="text-[13px] text-[var(--texto)]">
        {forzado
          ? "Turno consultado. El resultado se emite al cierre."
          : "Vista en vivo. El resultado se emite al cierre."}
      </p>
      <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-[var(--tenue)] tabular-nums">
        <span>Actualizado {actualizado}</span>
        <button
          type="button"
          onClick={onRefrescar}
          className="cursor-pointer rounded-sm border border-[var(--linea)] px-2 py-0.5 transition-colors hover:bg-[var(--hover)] hover:text-[var(--texto)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
        >
          Actualizar
        </button>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={pausado}
            onChange={(e) => onPausar(e.target.checked)}
            className="cursor-pointer accent-[var(--acero)]"
          />
          Pausar
        </label>
      </span>
    </div>
  );
}

/* ── §3.2 · La banda de estado ──────────────────────────────────────────────
   Cinco cifras, todas en acero. El ámbar aparece únicamente en "sin señal", y
   como aviso del sistema: que una unidad se haya callado no dice nada sobre si
   el servicio se cumplió. */

function cortar(routes: MonitoreoRoute[]) {
  const vivas = routes.filter((r) => r.state !== "cerrado");
  const llegaron = vivas.filter((r) => r.state === "llego");
  const enRuta = vivas.filter((r) => r.matchedUnitId && r.state !== "llego");
  const sinUnidad = vivas.filter((r) => !r.matchedUnitId);
  const sinSenal = vivas.filter(
    (r) => r.signalAgeMinutes !== null && r.signalAgeMinutes >= SIN_SENAL_MINUTOS,
  );
  const selladas = routes.filter((r) => r.state === "cerrado");

  const pendientes = vivas.filter((r) => r.state !== "llego");
  const faltan = pendientes.map((r) => r.minutesToDeadline);
  const proximoDeadline = faltan.length > 0 ? Math.min(...faltan) : null;

  return { vivas, llegaron, enRuta, sinUnidad, sinSenal, selladas, proximoDeadline };
}

function Banda({ data }: { data: MonitoreoPayload }) {
  const c = useMemo(() => cortar(data.routes), [data.routes]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[var(--linea)] bg-[var(--linea)] min-[720px]:grid-cols-5">
        <Cifra
          valor={String(c.enRuta.length)}
          lectura={`de ${data.routes.length} del turno`}
          etiqueta="En ruta"
        />
        <Cifra
          valor={String(c.llegaron.length)}
          lectura={`de ${data.routes.length} del turno`}
          etiqueta="Ya llegaron"
        />
        <Cifra
          valor={String(c.sinUnidad.length)}
          lectura="sin unidad asociada todavía"
          etiqueta="Sin salir"
          apoyo={c.sinUnidad.map((r) => r.profileCode)}
        />
        <Cifra
          valor={String(c.sinSenal.length)}
          lectura={`sin punto GPS hace ${SIN_SENAL_MINUTOS} min o más`}
          etiqueta="Sin señal"
          aviso={c.sinSenal.length > 0}
          apoyo={c.sinSenal.map(
            (r) => `${r.matchedUnitLabel ?? r.profileCode} · ${r.signalAgeMinutes} min`,
          )}
        />
        <Cifra
          valor={
            c.proximoDeadline === null
              ? "—"
              : c.proximoDeadline >= 0
                ? formatearDuracion(c.proximoDeadline)
                : formatearDuracion(-c.proximoDeadline)
          }
          lectura={
            c.proximoDeadline === null
              ? "nada pendiente por llegar"
              : c.proximoDeadline >= 0
                ? "hasta el deadline más próximo"
                : "desde que venció el deadline más próximo"
          }
          etiqueta={
            c.proximoDeadline !== null && c.proximoDeadline < 0
              ? "Deadline vencido"
              : "Falta para el deadline"
          }
          /* Cinco cifras en una rejilla de dos columnas dejan un hueco al
             final; la quinta lo ocupa en vez de dejar una celda muerta. */
          ancha
        />
      </div>

      {/* Los servicios ya sellados no son una sexta cifra: un hecho congelado
          pudo salir `no_cumplido`, y contarlo entre las llegadas afirmaría lo
          que el árbitro no dijo. Va como dato del sistema, en acero. */}
      {c.selladas.length > 0 ? (
        <p className="mt-2 font-mono text-[11px] text-[var(--tenue)] tabular-nums">
          {plural(c.selladas.length, "servicio de este turno ya está", "servicios de este turno ya están")}{" "}
          {c.selladas.length === 1 ? "verificado y sellado" : "verificados y sellados"}. Su
          resultado vive en el expediente, no en la torre.
        </p>
      ) : null}
    </div>
  );
}

function Cifra({
  valor,
  lectura,
  etiqueta,
  apoyo,
  aviso = false,
  ancha = false,
}: {
  valor: string;
  /** El dato nunca va solo: esta es su lectura. */
  lectura: string;
  etiqueta: string;
  /** Los afectados, nombrados — es lo prevenible de la pantalla. */
  apoyo?: string[];
  aviso?: boolean;
  ancha?: boolean;
}) {
  const color = aviso ? "text-[var(--ambar)]" : "text-[var(--acero)]";
  return (
    <div
      className={`bg-[var(--panel)] px-4 py-3 ${ancha ? "col-span-2 min-[720px]:col-span-1" : ""}`}
    >
      <p className="font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase">
        {etiqueta}
      </p>
      <p
        className={`mt-1.5 font-[family-name:var(--fuente-archivo)] text-[26px] leading-none font-semibold tabular-nums ${color}`}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--tenue)]">{lectura}</p>
      {apoyo && apoyo.length > 0 ? (
        <p className="mt-1 font-mono text-[10px] leading-snug break-words text-[var(--tenue)] tabular-nums">
          {apoyo.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/* ── §3.4 · La lista del turno ──────────────────────────────────────────────
   El turno COMPLETO, no solo lo que falta: las que llegaron arriba y marcadas,
   luego lo que sigue en camino, luego lo que no ha salido, y al final lo ya
   sellado. Sin columna de llegada estimada: la ETA no existe todavía, y una
   hora inventada sobre señal vieja es justo lo que la ficha proscribe. */

function grupo(r: MonitoreoRoute): number {
  if (r.state === "cerrado") return 3;
  if (r.state === "llego") return 0;
  return r.matchedUnitId ? 1 : 2;
}

function Lista({ data }: { data: MonitoreoPayload }) {
  const orden = useMemo(
    () =>
      [...data.routes].sort(
        (a, b) => grupo(a) - grupo(b) || a.minutesToDeadline - b.minutesToDeadline,
      ),
    [data.routes],
  );

  if (orden.length === 0) {
    return (
      <p className="rounded-sm border border-[var(--linea)] px-4 py-6 text-center text-[13px] text-[var(--tenue)]">
        Este turno no tiene rutas programadas.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-[var(--linea)]">
        {orden.map((r, i) => (
          <Renglon
            key={r.occurrenceId}
            r={r}
            accountSlug={data.accountSlug}
            primero={i === 0}
          />
        ))}
      </div>

      {/* §4 · Por qué las unidades dicen "probable". */}
      <p className="mt-2 text-[11px] leading-snug text-[var(--tenue)]">
        El sistema infiere qué unidad cubre cada ruta a partir de su recorrido, y esa
        asociación se afina conforme avanza el turno. Se confirma al cierre.
      </p>
    </div>
  );
}

function Renglon({
  r,
  accountSlug,
  primero,
}: {
  r: MonitoreoRoute;
  accountSlug: string;
  primero: boolean;
}) {
  const sinSenal =
    r.signalAgeMinutes !== null && r.signalAgeMinutes >= SIN_SENAL_MINUTOS;
  const cerrado = r.state === "cerrado";

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-[12px] transition-colors hover:bg-[var(--hover)] ${
        primero ? "" : "border-t border-[var(--linea-tenue)]"
      } ${cerrado ? "bg-[var(--rayado)]" : ""}`}
    >
      <Senal r={r} sinSenal={sinSenal} />

      <span className="flex-none font-mono text-[12px] text-[var(--texto)]">
        {r.profileCode}
      </span>
      {/* El nombre largo se esconde en angosto: truncado a tres letras no
          informa, y el código de ruta de al lado ya identifica el servicio. */}
      <span className="hidden min-w-0 flex-1 truncate text-[var(--tenue)] min-[560px]:block">
        {r.profileName}
      </span>

      {/* Unidad con su etiqueta de certeza. En las cerradas la unidad viene del
          hecho congelado y NO lleva etiqueta: `confirmada` es palabra del acta. */}
      {r.matchedUnitLabel ? (
        <span className="flex-none font-mono text-[var(--texto)]">
          {r.matchedUnitLabel}
          {r.certeza === "probable" ? (
            <span className="ml-1.5 font-mono text-[10px] tracking-[0.1em] text-[var(--tenue)] uppercase">
              probable
            </span>
          ) : null}
        </span>
      ) : (
        <span className="flex-none text-[var(--tenue)]">
          {cerrado ? "Sin unidad acreditada" : "Sin unidad asociada todavía"}
        </span>
      )}

      {/* Medición: lo que falta de camino y qué tan fresca es la señal.
          Sin `flex-none`: en angosto la frase completa no cabe, y fija se
          recortaba contra el borde en vez de pasar al siguiente renglón. */}
      <span className="min-w-0 font-mono text-[11px] text-[var(--tenue)] tabular-nums">
        {r.remainingKm !== null ? `${r.remainingKm.toFixed(1)} km por recorrer` : null}
        {r.remainingKm !== null && r.signalAgeMinutes !== null ? " · " : null}
        {r.signalAgeMinutes !== null ? (
          <span className={sinSenal ? "text-[var(--ambar)]" : undefined}>
            señal {antiguedad(r.signalAgeMinutes)}
            {r.lastSignalAt ? ` (${r.lastSignalAt})` : ""}
          </span>
        ) : null}
      </span>

      {/* Llegada medida, nunca un veredicto. */}
      {r.arrivalAt ? (
        <span className="flex-none rounded-sm border border-[var(--b-acero)] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[var(--acero)] tabular-nums">
          Llegó {r.arrivalAt}
        </span>
      ) : (
        <span className="flex-none font-mono text-[11px] text-[var(--tenue)] tabular-nums">
          deadline {r.expectedDeadline}
        </span>
      )}

      {cerrado ? (
        <a
          href={`/cliente/servicio/${r.occurrenceId}?account=${encodeURIComponent(accountSlug)}`}
          className="flex-none text-[11px] text-[var(--azul)] transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
        >
          Expediente →
        </a>
      ) : null}

      {r.alertReason ? (
        <p className="w-full font-mono text-[10px] text-[var(--tenue)]">{r.alertReason}</p>
      ) : null}
    </div>
  );
}

/**
 * La señal de estado. Estados operativos en acero y tenue — verde, ámbar y
 * rojo jamás marcan un estado operativo. El único ámbar es "sin señal", que es
 * aviso del sistema.
 */
function Senal({ r, sinSenal }: { r: MonitoreoRoute; sinSenal: boolean }) {
  const cerrado = r.state === "cerrado";
  const llego = r.state === "llego";
  const enMovimiento = Boolean(r.matchedUnitId) && !llego && !cerrado;

  const clase = sinSenal
    ? "border-[var(--ambar)] bg-[var(--t-ambar)]"
    : cerrado
      ? "border-[var(--linea-fuerte)]"
      : llego
        ? "border-[var(--acero)] bg-[var(--acero)]"
        : enMovimiento
          ? "border-[var(--acero)] bg-[var(--t-acero2)]"
          : "border-[var(--linea-fuerte)]";

  // La llegada es cuadrada y lo demás redondo: la forma distingue el estado
  // sin depender del color, que aquí es todo acero. Se elige una clase o la
  // otra en vez de encimarlas — dos `rounded-*` juntas las resuelve el orden
  // de la hoja, no el orden en que se escriben.
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 flex-none border ${llego ? "rounded-[1px]" : "rounded-full"} ${clase}`}
    />
  );
}

/* ── §3.5 · La tira de llegadas contra el deadline ──────────────────────────
   Un punto por llegada REAL, medida al entrar a la geocerca. Las unidades en
   camino no aparecen: proyectar su llegada exige una ETA que todavía no
   existe, y la ficha prohíbe horas calculadas sobre datos que no la sostienen.
   Los puntos van en acero, incluidos los que caen dentro de la holgura: pintar
   la holgura de ámbar metería una lectura de tardanza en una pantalla donde
   nada se ha juzgado. */

function TiraLlegadas({ routes }: { routes: MonitoreoRoute[] }) {
  const llegadas = useMemo(
    () =>
      routes.filter(
        (r): r is MonitoreoRoute & { arrivalDeltaMinutes: number } =>
          r.state === "llego" && r.arrivalDeltaMinutes !== null,
      ),
    [routes],
  );

  const enCamino = routes.filter(
    (r) => r.state !== "cerrado" && r.state !== "llego" && r.matchedUnitId,
  ).length;

  if (llegadas.length === 0) {
    return enCamino > 0 ? (
      <p className="text-[11px] leading-snug text-[var(--tenue)]">
        Todavía no hay llegadas medidas en este turno.{" "}
        {plural(enCamino, "unidad en camino aparecerá", "unidades en camino aparecerán")} en
        la tira al entrar a su geocerca de destino.
      </p>
    ) : null;
  }

  const holgura = Math.max(...llegadas.map((r) => r.graceMinutes));
  const deltas = llegadas.map((r) => r.arrivalDeltaMinutes);
  const desde = Math.min(-30, Math.min(...deltas) - 5);
  const hasta = Math.max(holgura + 10, Math.max(...deltas) + 5);
  const pos = (min: number) => ((min - desde) / (hasta - desde)) * 100;

  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase">
        Llegadas contra su deadline
      </p>

      <div className="relative mt-3 h-16">
        {/* Banda de holgura: del deadline al final de la tolerancia del contrato. */}
        <div
          className="absolute top-0 bottom-6 bg-[var(--t-acero)]"
          style={{ left: `${pos(0)}%`, width: `${pos(holgura) - pos(0)}%` }}
          aria-hidden="true"
        />
        {/* La marca del deadline. */}
        <div
          className="absolute top-0 bottom-6 w-px bg-[var(--linea-fuerte)]"
          style={{ left: `${pos(0)}%` }}
          aria-hidden="true"
        />
        {/* La pista. */}
        <div
          className="absolute right-0 bottom-6 left-0 h-px bg-[var(--linea)]"
          aria-hidden="true"
        />

        {llegadas.map((r) => (
          <span
            key={r.occurrenceId}
            title={`${r.profileCode} · llegó ${r.arrivalAt} · deadline ${r.expectedDeadline} · ${
              r.arrivalDeltaMinutes <= 0
                ? `${formatearDuracion(-r.arrivalDeltaMinutes)} antes`
                : `${formatearDuracion(r.arrivalDeltaMinutes)} después`
            }`}
            className="absolute bottom-[21px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[var(--acero)] bg-[var(--t-acero2)]"
            style={{ left: `${pos(r.arrivalDeltaMinutes)}%` }}
          />
        ))}

        {/* La escala: sin ella los puntos son posiciones sin unidad. */}
        <span className="absolute bottom-0 left-0 font-mono text-[10px] whitespace-nowrap text-[var(--tenue)] tabular-nums">
          {-desde} min antes
        </span>
        <span
          className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-[var(--tenue)] tabular-nums"
          style={{ left: `${pos(0)}%` }}
        >
          deadline
        </span>
        {/* La holgura NO lleva etiqueta sobre la pista: cae pegada a la del
            deadline y en angosto se encima. Su valor va en la lectura de
            abajo, que es donde se puede leer completo. */}
      </div>

      <p className="mt-1 text-[11px] leading-snug text-[var(--tenue)]">
        {plural(llegadas.length, "llegada medida", "llegadas medidas")} al entrar a la
        geocerca de destino. La banda sombreada es la holgura del contrato: +{holgura} min
        después del deadline. Lo medido no es lo sellado: el resultado se emite al cierre.
        {enCamino > 0
          ? ` ${plural(enCamino, "unidad en camino aparecerá", "unidades en camino aparecerán")} aquí cuando llegue${enCamino === 1 ? "" : "n"}.`
          : ""}
      </p>
    </div>
  );
}
