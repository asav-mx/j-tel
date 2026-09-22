"use client";

import { useState } from "react";

/**
 * Las vueltas de una jornada, y los pasos de una al tocarla (PR C de la ficha
 * de Circuitos, 22-sep-2026). Todas las palabras llegan hechas del servidor
 * (`lib/casa/jornada.ts`); aquí sólo se abre y se cierra.
 *
 * - El estado de la vuelta con el vocabulario de la 9.3c. Completa va en tenue;
 *   lo demás pide mirarlo y va en tinta. **Sin cobre**: es recuerdo.
 * - Cada paso con su hora y **el intervalo del SERVICIO en esa parada**,
 *   contra el paso anterior de cualquier unidad — nunca como veredicto de esta
 *   unidad (ASAV, 22-sep).
 */

export interface PasoEnPantalla {
  clave: string;
  parada: string;
  hora: string;
  intervalo: string | null;
  cifra: string | null;
  contra: string | null;
}

export interface VueltaEnPantalla {
  clave: string;
  numero: number;
  sentido: string;
  desde: string;
  hasta: string;
  pasos: string;
  estado: string;
  completa: boolean;
  faltan: string[];
  detalle: PasoEnPantalla[];
}

export function VueltasDeLaJornada({ vueltas }: { vueltas: VueltaEnPantalla[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (vueltas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px] text-[var(--tenue)]">
        Sin vueltas medidas este día.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {vueltas.map((v) => {
        const abre = abierta === v.clave;
        return (
          <div key={v.clave} className={`rounded-[12px] border bg-[var(--pieza)] ${abre ? "border-[var(--tinta)]" : "border-[var(--linea)]"}`}>
            <button
              type="button"
              aria-expanded={abre}
              onClick={() => setAbierta(abre ? null : v.clave)}
              className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
            >
              <span data-medida className="text-[12px] text-[var(--tenue)]">
                V{v.numero}
              </span>
              <span className="text-[15px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
                {v.sentido}
              </span>
              <span data-medida className="text-[13px] text-[var(--tenue)]">
                {v.desde} → {v.hasta} · {v.pasos}
              </span>
              <span className={`ml-auto text-[13px] ${v.completa ? "text-[var(--tenue)]" : "font-semibold"}`}>{v.estado}</span>
              {v.faltan.length > 0 && (
                <span className="w-full text-[12.5px] text-[var(--tenue)]">{v.faltan.join(" · ")}</span>
              )}
            </button>
            {abre && (
              <ol className="flex flex-col border-t border-[var(--linea)] px-4 py-2" aria-label={`Pasos de la vuelta ${v.numero}`}>
                {v.detalle.map((p) => (
                  <li key={p.clave} className="flex flex-wrap items-baseline gap-x-3 border-b border-[var(--linea)] py-2 text-[13px] last:border-b-0">
                    <span className="min-w-[140px] font-semibold">{p.parada}</span>
                    <span data-medida>{p.hora}</span>
                    {p.intervalo && (
                      <span className="text-[var(--tenue)]">
                        {p.intervalo}
                        {p.cifra ? (
                          <>
                            {" · "}
                            <span data-medida>{p.cifra}</span>
                          </>
                        ) : null}
                        {p.contra ? ` · ${p.contra}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
