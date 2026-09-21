"use client";

import Link from "next/link";
import { palabraDeLaPromesa, textoDelIntervalo, textoDeReferencia } from "@/lib/casa/torre";
import type { PasoMedido } from "@jtel/services";

/** La hora del rango de un paso, en la zona del circuito. */
function horaDelRango(p: PasoMedido, zona: string): string {
  const hhmmss = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: zona,
    }).format(d);
  return `${hhmmss(p.pasoDesde)}–${hhmmss(p.pasoHasta)}`;
}

/** Cómo se dice en pantalla el veredicto de UN paso (9.3b, minúsculas en la fila). */
function palabraDelPaso(p: PasoMedido): string {
  if (p.motivo === "a_caballo") return "a caballo del rango · no concluye";
  if (p.motivo === "sin_promesa") return "sin promesa en esa franja";
  return palabraDeLaPromesa({ estado: p.estado, motivo: p.motivo, intervalo: null, referencia: null, medidoEn: null })
    .toLowerCase();
}

/**
 * El detalle — los últimos pasos de una unidad, o las últimas pasadas por una
 * parada. **No mide nada**: son los mismos pasos ya medidos de los que salió el
 * estado de arriba, proyectados.
 *
 * Cada renglón lleva **el rango de hora** (los dos pings que encierran el
 * cruce, nunca un instante), su intervalo y su palabra. Y arriba, una sola vez,
 * contra qué se comparó — porque el 9.3b pide la referencia al lado del número
 * y repetirla en cada renglón sería el muro de texto que el skill prohíbe.
 */
export function Detalle({
  titulo,
  apoyo,
  ficha,
  fichaTexto,
  sub,
  pasos,
  zona,
  nota,
  alCerrar,
}: {
  titulo: string;
  apoyo: string;
  ficha?: string;
  fichaTexto?: string;
  sub: string;
  pasos: PasoMedido[];
  zona: string;
  nota?: string;
  alCerrar: () => void;
}) {
  return (
    <section
      aria-live="polite"
      className="mt-3 rounded-2xl border border-[var(--tinta)] bg-[var(--pieza)] px-[18px] py-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-[20px] font-bold" style={{ fontFamily: "var(--letra-titular)" }}>
            {titulo}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">{apoyo}</div>
        </div>
        <div className="ml-auto flex items-center gap-3.5">
          {ficha && (
            <Link
              href={ficha}
              className="whitespace-nowrap border-b border-[var(--linea)] pb-0.5 text-[12px] text-[var(--tenue)]"
            >
              {fichaTexto} →
            </Link>
          )}
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar detalle"
            className="h-7 w-7 flex-none cursor-pointer rounded-lg border border-[var(--linea)] bg-transparent text-[13px] text-[var(--tenue)]"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]">
        {pasos.length > 0 ? "Últimos pasos medidos" : "Sin pasos medidos todavía"}
      </div>
      <div className="mb-2 text-[11px] leading-snug text-[var(--tenue)]">{sub}</div>

      {pasos.map((p) => (
        <div
          key={`${p.stopId}-${p.pasoDesde.toISOString()}`}
          className="flex flex-wrap items-baseline gap-x-3.5 border-t border-[var(--linea)] py-[7px]"
        >
          <span className="min-w-[150px] text-[13px] leading-tight">
            {p.nombreDeLaParada} · {p.sentido}
          </span>
          <span data-medida className="text-[12.5px] text-[var(--tenue)]">
            {horaDelRango(p, zona)}
          </span>
          <span data-medida className="ml-auto text-[12.5px] font-medium">
            {textoDelIntervalo(p.intervalo)}
            {p.referencia && (
              <span className="ml-1.5 font-normal text-[var(--tenue)]">· {textoDeReferencia(p.referencia)}</span>
            )}
          </span>
          <span
            className={`min-w-[130px] text-right text-[10px] uppercase tracking-[0.12em] ${
              p.estado === "adelantada" || p.estado === "atrasada"
                ? "font-semibold text-[var(--tinta)]"
                : "text-[var(--tenue)]"
            }`}
          >
            {palabraDelPaso(p)}
          </span>
        </div>
      ))}

      {nota && <div className="mt-2.5 text-[12px] leading-relaxed text-[var(--tenue)]">{nota}</div>}
    </section>
  );
}
