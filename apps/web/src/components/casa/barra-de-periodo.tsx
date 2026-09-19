"use client";

import { useEffect, useState } from "react";
import { JTTEL_TZ } from "@jtel/domain";
import {
  atajosDeTiempo,
  diaCorto,
  diaQueContiene,
  etiquetaDelPeriodo,
  hhmm,
  instanteDelPanel,
  mover,
  panelDe,
  type Periodo,
} from "@/lib/casa/periodo";

/**
 * La barra de la ventana de tiempo — ‹ el periodo › y su panel de atajos.
 *
 * Nació dentro de Recorridos y playback (C3) y es pieza compartida desde el 18
 * sep 2026: Servicios especiales (Vernier) usa la misma, con la misma palabra
 * para el mismo periodo (decisión 7 de Asav). Lo propio de cada pantalla queda
 * afuera: C3 pide su recorrido al elegir; Vernier cambia la dirección.
 *
 * Los atajos son exactos: Hoy · Ayer · Esta semana · Este mes. «Esta semana»
 * arranca el lunes 00:00 de `zona`.
 */

export const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" } as const;
export const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--senal)]";
export const borde = "border border-[var(--linea)] bg-[var(--pieza)]";

type ServiciosJson =
  | { reservada: false }
  | {
      reservada: true;
      dia: string;
      servicios: Array<{ nombre: string; modalidad: "especial" | "circuito"; desde: string; hasta: string }>;
      circuitosSinHorario: string[];
    };

/* ─── La barra del periodo y su panel ───────────────────────────────────── */

export function BarraDePeriodo({
  periodo,
  acotado,
  leida,
  reloj,
  leyendo,
  slug,
  unitId,
  elegir,
  zona = JTTEL_TZ,
}: {
  periodo: Periodo;
  acotado: boolean;
  leida: number;
  reloj: number;
  leyendo: boolean;
  slug: string;
  /** La zona en que se nombra el periodo y se arman los atajos. C3 usa la del despliegue; Vernier, la de la cuenta. */
  zona?: string;
  /** Sin unidad (Ver ‹dispositivo›) no hay atajos de servicio: los servicios son de una unidad. */
  unitId?: string;
  elegir: (p: Periodo, o?: { acotado?: boolean; deServicio?: boolean }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const flecha = `grid h-[38px] w-[38px] cursor-pointer place-items-center rounded-[10px] text-[16px] text-[var(--tenue)] ${borde} ${foco}`;

  return (
    <div className="relative mb-3 mt-[18px] flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Periodo anterior" className={flecha} onClick={() => elegir(mover(periodo, -1))}>
        ‹
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] px-[15px] py-2.5 ${borde} ${foco}`}
      >
        <span data-medida className="text-[14px]">
          {etiquetaDelPeriodo(periodo, leida, zona)}
        </span>
        <span aria-hidden="true" className="text-[11px] text-[var(--tenue)]">
          ▾
        </span>
      </button>
      <button type="button" aria-label="Periodo siguiente" className={flecha} onClick={() => elegir(mover(periodo, 1))}>
        ›
      </button>
      {acotado && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--senal)] bg-[var(--pieza)] px-3 py-2 text-[12.5px]">
          <span data-medida>
            Acotado a {hhmm(periodo.desde, zona)}–{hhmm(periodo.hasta, zona)}
          </span>
          <button
            type="button"
            onClick={() => elegir(diaQueContiene(periodo.desde, zona))}
            className={`cursor-pointer text-[12.5px] font-semibold text-[var(--senal)] ${foco}`}
          >
            Quitar
          </button>
        </div>
      )}
      {leyendo && (
        <span data-medida className="text-[12px] text-[var(--tenue)]" role="status">
          leyendo…
        </span>
      )}
      {abierto && (
        <PanelDePeriodo
          periodo={periodo}
          reloj={reloj}
          slug={slug}
          unitId={unitId}
          zona={zona}
          cerrar={() => setAbierto(false)}
          elegir={(p, o) => {
            elegir(p, o);
            setAbierto(false);
          }}
        />
      )}
    </div>
  );
}

function PanelDePeriodo({
  periodo,
  reloj,
  slug,
  unitId,
  zona,
  cerrar,
  elegir,
}: {
  periodo: Periodo;
  reloj: number;
  slug: string;
  unitId?: string;
  zona: string;
  cerrar: () => void;
  elegir: (p: Periodo, o?: { deServicio?: boolean }) => void;
}) {
  const [desde, setDesde] = useState(() => panelDe(periodo.desde, zona));
  const [hasta, setHasta] = useState(() => panelDe(periodo.hasta, zona));
  const dia = panelDe(periodo.desde, zona).fecha;
  const [servicios, setServicios] = useState<ServiciosJson | null>(null);

  useEffect(() => {
    if (!unitId) return;
    const control = new AbortController();
    const q = new URLSearchParams({ account: slug, unidad: unitId, dia });
    fetch(`/api/casa/recorrido/servicios?${q}`, { signal: control.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ServiciosJson>) : null))
      .then((s) => setServicios(s))
      .catch(() => undefined);
    return () => control.abort();
  }, [slug, unitId, dia]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [cerrar]);

  const opcion = `cursor-pointer rounded-[9px] border border-[var(--linea)] px-3 py-[7px] text-left text-[13px] ${foco}`;
  const campo = "w-full rounded-lg border border-[var(--linea)] bg-[var(--papel)] px-2.5 py-2 text-[13.5px]";
  const subtitulo = "mb-2 text-[12px] font-semibold text-[var(--tenue)]";
  const aplicar = () => {
    const a = instanteDelPanel(desde.fecha, desde.hora, zona);
    const z = instanteDelPanel(hasta.fecha, hasta.hora, zona);
    if (a !== null && z !== null && z > a) elegir({ desde: a, hasta: z });
    else cerrar();
  };

  return (
    <div
      role="dialog"
      aria-label="Elegir periodo"
      className={`absolute left-0 top-[52px] z-[1000] max-h-[min(74vh,620px)] w-[min(440px,calc(100vw-40px))] overflow-y-auto rounded-[14px] p-4 shadow-[0_10px_34px_rgba(0,0,0,.14)] ${borde}`}
    >
      <h3 className={subtitulo}>Atajos</h3>
      <div className="flex flex-wrap gap-[7px]">
        {atajosDeTiempo(reloj, zona).map((a) => (
          <button key={a.nombre} type="button" className={opcion} onClick={() => elegir(a.periodo)}>
            {a.nombre}
          </button>
        ))}
      </div>

      {servicios?.reservada && (
        <div>
          <h3 className={`${subtitulo} mt-4`}>Servicios de esta unidad · {diaCorto(periodo.desde, zona)}</h3>
          <div className="flex flex-wrap gap-[7px]">
            {servicios.servicios.map((s) => {
              const a = Date.parse(s.desde);
              const z = Date.parse(s.hasta);
              return (
                <button
                  key={`${s.nombre}-${s.desde}`}
                  type="button"
                  className={opcion}
                  onClick={() => elegir({ desde: a, hasta: z }, { deServicio: true })}
                >
                  {s.nombre}
                  <span data-medida className="mt-px block text-[11px] text-[var(--tenue)]">
                    {hhmm(a, zona)}–{hhmm(z, zona)} · {s.modalidad}
                  </span>
                </button>
              );
            })}
            {servicios.servicios.length === 0 && servicios.circuitosSinHorario.length === 0 && (
              <div className="rounded-[9px] border border-dashed border-[var(--linea)] px-3 py-2.5 text-[12.5px] text-[var(--tenue)]">
                Sin servicios declarados este día.
              </div>
            )}
          </div>
          {servicios.circuitosSinHorario.map((nombre) => (
            <p key={nombre} className="mt-2 text-[12px] text-[var(--tenue)]">
              {nombre} · el horario de servicio de ese día no quedó guardado
            </p>
          ))}
          {servicios.servicios.length > 0 && (
            <p className="mt-[7px] text-[11px] text-[var(--tenue)]">
              Ventanas declaradas por el contrato o la concesión, no medidas por el sistema.
            </p>
          )}
        </div>
      )}

      <h3 className={`${subtitulo} mt-4`}>Desde / hasta</h3>
      {(
        [
          ["Desde", desde, setDesde],
          ["Hasta", hasta, setHasta],
        ] as const
      ).map(([nombre, valor, poner]) => (
        <div key={nombre} className="mb-[9px] grid grid-cols-[52px_1fr_auto] items-center gap-2 max-sm:grid-cols-[48px_1fr]">
          <label htmlFor={`fecha-${nombre}`} className="text-[13px] text-[var(--tenue)]">
            {nombre}
          </label>
          <input
            id={`fecha-${nombre}`}
            type="date"
            data-medida
            className={campo}
            value={valor.fecha}
            onChange={(e) => poner({ ...valor, fecha: e.target.value })}
          />
          <input
            type="time"
            step={60}
            aria-label={`Hora ${nombre.toLowerCase()}`}
            data-medida
            className={`${campo} max-sm:col-start-2`}
            value={valor.hora}
            onChange={(e) => poner({ ...valor, hora: e.target.value })}
          />
        </div>
      ))}
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={aplicar}
          className={`flex-1 cursor-pointer rounded-[9px] bg-[var(--tinta)] p-2.5 text-[14px] font-semibold text-[var(--papel)] ${foco}`}
        >
          Ver este periodo
        </button>
        <button
          type="button"
          onClick={cerrar}
          className={`cursor-pointer rounded-[9px] border border-[var(--linea)] px-4 py-2.5 text-[14px] text-[var(--tenue)] ${foco}`}
        >
          Cancelar
        </button>
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-[var(--tenue)]">
        El periodo no se parte en días: un turno que cruza la medianoche se ve completo.
        {unitId && (
          <>
            {" "}
            Los servicios son los de <em>esta</em> unidad ese día, con las horas que se declararon entonces, no las vigentes hoy.
          </>
        )}
      </p>
    </div>
  );
}

