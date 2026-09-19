"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Glifo, type EstadoGlifo } from "@/components/casa/glifo";
import { usePlayback } from "@/components/casa/use-playback";
import { edad, rutas } from "@/lib/casa/expedientes";
import type { LugarDelRecorrido, Marcador } from "@/components/casa/mapa-recorrido";
import {
  acotar,
  atajosDeTiempo,
  diaCorto,
  diaQueContiene,
  duracion,
  etiquetaDelPeriodo,
  hhmm,
  hhmmss,
  instanteDelPanel,
  mover,
  panelDe,
  glifoDePausa,
  nombreDePausa,
  pausasEntre,
  pedazosDe,
  peticionDelRecorrido,
  posicionEn,
  rutaDelRecorrido,
  sello,
  siguienteVelocidad,
  tiempoConSenal,
  vacioDe,
  type AsignacionDeLaUnidad,
  type Pausa,
  type Pedazo,
  type Periodo,
  type RecorridoJson,
} from "@/lib/casa/recorrido";

// Leaflet toca `window` al importarse: el mapa sólo existe en el navegador.
const MapaRecorrido = dynamic(() => import("@/components/casa/mapa-recorrido").then((m) => m.MapaRecorrido), {
  ssr: false,
});

/** El estado de la unidad ahora, leído por la página: es lo único en cobre. */
export type EstadoActual = { glifo: EstadoGlifo; rumbo: number; palabra: string; atIso: string; vivo: boolean };

type ServiciosJson =
  | { reservada: false }
  | {
      reservada: true;
      dia: string;
      servicios: Array<{ nombre: string; modalidad: "especial" | "circuito"; desde: string; hasta: string }>;
      circuitosSinHorario: string[];
    };

export const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" } as const;
export const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--senal)]";
export const borde = "border border-[var(--linea)] bg-[var(--pieza)]";

/**
 * Recorridos y playback (ficha C3, prototipo v5).
 *
 * La pantalla **no recalcula la traza**: pide el periodo a `/api/casa/recorrido`
 * y dibuja lo que llega. Decide sólo lo suyo: qué periodo pedir, dónde va el
 * marcador, dónde se detiene y qué dice cuando se detiene.
 *
 * **No emite veredicto** (decisión 13). Lo declarado por un contrato o una
 * concesión sólo fija la ventana; lo que se dibuja es medido.
 */
export function RecorridoPlayback({
  slug,
  cuentaEnRuta,
  unidad,
  periodoInicial,
  leidaIso,
  estadoActual,
  asignaciones,
  lugares,
}: {
  slug: string;
  cuentaEnRuta: string | null;
  unidad: { id: string; nombre: string };
  periodoInicial: Periodo;
  leidaIso: string;
  estadoActual: EstadoActual | null;
  asignaciones: AsignacionDeLaUnidad[];
  lugares: LugarDelRecorrido[];
}) {
  /* ── El reloj: el del servidor, corregido, para que la edad no dependa del teléfono ── */
  const desfase = useRef(0);
  const [reloj, setReloj] = useState(() => Date.parse(leidaIso));
  useEffect(() => {
    desfase.current = Date.parse(leidaIso) - Date.now();
    const t = setInterval(() => setReloj(Date.now() + desfase.current), 1000);
    return () => clearInterval(t);
  }, [leidaIso]);

  /* ── El periodo ── */
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial);
  const [acotado, setAcotado] = useState(false);
  const [deServicio, setDeServicio] = useState(false);
  const elegir = useCallback((p: Periodo, opciones: { acotado?: boolean; deServicio?: boolean } = {}) => {
    setPeriodo(p);
    setAcotado(opciones.acotado ?? false);
    setDeServicio(opciones.deServicio ?? false);
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", rutaDelRecorrido(unidad.id, periodo, cuentaEnRuta));
  }, [periodo, unidad.id, cuentaEnRuta]);

  /* ── El dato ── */
  const [datos, setDatos] = useState<{ r: RecorridoJson; leida: number; clave: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    const url = peticionDelRecorrido(slug, unidad.id, periodo);
    setLeyendo(true);
    setFallo(false);
    fetch(url, { signal: control.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as RecorridoJson;
        setDatos({ r, leida: Date.now() + desfase.current, clave: url });
        setLeyendo(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setFallo(true);
        setLeyendo(false);
      });
    return () => control.abort();
  }, [slug, unidad.id, periodo, intento]);

  const pedazos = useMemo(() => (datos ? pedazosDe(datos.r) : []), [datos]);
  const pausas = useMemo(() => (datos ? pausasEntre(pedazos, datos.r) : []), [datos, pedazos]);
  const lugaresVisitados = useMemo(() => {
    if (!datos) return [];
    const ids = new Set([...datos.r.visitas.map((v) => v.lugar.id), ...datos.r.ocultos.map((o) => o.lugar.id)]);
    return lugares.filter((l) => ids.has(l.id));
  }, [datos, lugares]);

  /* ── El playback ── */
  const { seg, t, tocando, alto, velManual, setVelManual, velAuto, tocar, continuar, reiniciar, buscar, textoPlay } =
    usePlayback(pedazos, periodo, datos?.leida ?? 0);

  /* ── El marcador ── */
  const pedazo = pedazos[seg];
  const pos = pedazo ? posicionEn(pedazo, t) : null;
  const pausa = alto?.tipo === "pausa" ? pausas[alto.indice] : undefined;
  const marcador: Marcador | null = pos
    ? alto?.tipo === "ahora"
      ? { lat: pos.lat, lng: pos.lng, glifo: estadoActual?.glifo ?? "detenida", rumbo: estadoActual?.rumbo ?? 0, tinta: "senal" }
      : pausa
        ? { lat: pos.lat, lng: pos.lng, glifo: glifoDePausa(pausa), rumbo: 0, tinta: "tinta" }
        : { lat: pos.lat, lng: pos.lng, glifo: "en-movimiento", rumbo: pos.rumbo, tinta: "tinta" }
    : null;

  const ultimoPunto = pedazos.length ? pedazos[pedazos.length - 1]!.t1 : null;

  const leida = datos?.leida ?? Date.parse(leidaIso);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] leading-tight max-sm:text-[26px]" style={{ ...titular, fontWeight: 800 }}>
            Ver {unidad.nombre}
          </h1>
          <p className="mt-0.5 font-medium text-[var(--tenue)]">Recorridos y playback</p>
        </div>
        {estadoActual && (
          <div className={`flex items-center gap-2 rounded-[10px] px-3 py-[7px] ${borde}`}>
            <Glifo estado={estadoActual.glifo} rumbo={estadoActual.rumbo} tamano={14} />
            <span data-medida className={`text-[13px] ${estadoActual.vivo ? "text-[var(--senal)]" : "text-[var(--tenue)]"}`}>
              {edad(new Date(estadoActual.atIso), new Date(reloj))}
            </span>
            <span className="text-[11.5px] text-[var(--tenue)]">{estadoActual.palabra.toLowerCase()} · ahora</span>
          </div>
        )}
      </header>

      <BarraDePeriodo
        periodo={periodo}
        acotado={acotado}
        leida={leida}
        reloj={reloj}
        leyendo={leyendo}
        slug={slug}
        unitId={unidad.id}
        elegir={elegir}
      />

      {fallo && (
        <p role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--tinta)] px-4 py-3 text-[14px]">
          No se pudo leer este periodo.
          <button type="button" onClick={() => setIntento((n) => n + 1)} className={`cursor-pointer font-semibold ${foco}`}>
            Reintentar
          </button>
        </p>
      )}

      {datos && <Cifras r={datos.r} />}

      <div className={`relative h-[clamp(320px,58vw,620px)] overflow-hidden rounded-[14px] ${borde}`}>
        {datos && (
          <MapaRecorrido
            clave={datos.clave}
            pedazos={pedazos}
            huecos={datos.r.huecos}
            saltos={datos.r.saltos}
            lugares={lugaresVisitados}
            progreso={{ seg, t }}
            marcador={marcador}
          />
        )}
        {datos && pedazos.length === 0 && (
          <VentanaVacia r={datos.r} periodo={periodo} deServicio={deServicio} asignaciones={asignaciones} cuentaEnRuta={cuentaEnRuta} />
        )}
        {pausa && alto?.tipo === "pausa" && pedazos[alto.indice + 1] && (
          <AvisoDePausa pausa={pausa} continuaEn={pedazos[alto.indice + 1]!.t0} alContinuar={continuar} />
        )}
        {alto?.tipo === "fin" && ultimoPunto !== null && (
          <Aviso titulo="Fin del periodo" rango={`Último punto medido · ${sello(ultimoPunto)}`} accion="Volver a empezar" alTocar={reiniciar} />
        )}
        {alto?.tipo === "ahora" && ultimoPunto !== null && (
          <Aviso
            glifo={<Glifo estado={estadoActual?.glifo ?? "detenida"} rumbo={estadoActual?.rumbo ?? 0} tamano={16} tinta="senal" />}
            titulo="Alcanzaste el ahora"
            rango={
              <>
                último punto <span className="text-[var(--senal)]">{edad(new Date(ultimoPunto), new Date(reloj))}</span>
                {estadoActual ? ` · ${estadoActual.palabra.toLowerCase()}` : ""}
              </>
            }
            porque="Esto ya no es grabación: es la unidad en este momento."
            accion="Volver a empezar"
            alTocar={reiniciar}
          />
        )}
      </div>

      <section aria-label="Playback" className={`mt-3 rounded-[14px] px-4 py-3.5 ${borde}`}>
        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={tocar}
            disabled={pedazos.length === 0}
            className={`min-w-[128px] cursor-pointer rounded-[10px] bg-[var(--tinta)] px-[18px] py-2.5 text-[14.5px] font-semibold text-[var(--papel)] disabled:cursor-default disabled:opacity-40 ${foco}`}
          >
            {textoPlay}
          </button>
          <button
            type="button"
            title="Velocidad de reproducción"
            onClick={() => setVelManual((v) => siguienteVelocidad(v))}
            className={`cursor-pointer rounded-[10px] border border-[var(--linea)] px-[13px] py-[9px] text-[13px] text-[var(--tenue)] ${foco}`}
            data-medida
          >
            {velManual === null ? `auto ×${velAuto}` : `×${velManual}`}
          </button>
          <div className="text-right max-sm:w-full max-sm:text-left sm:ml-auto">
            <div data-medida className="text-[22px] font-medium">
              {pos ? hhmmss(t) : "--:--:--"}
            </div>
            <div className="text-[11.5px] text-[var(--tenue)]">{pos ? diaCorto(t) : ""}</div>
            <div data-medida className={`text-[13px] ${tocando ? "text-[var(--senal)]" : "text-[var(--tenue)]"}`}>
              {pos ? Math.round(pos.v) : 0} km/h
            </div>
          </div>
        </div>
        <Cinta pedazos={pedazos} pausas={pausas} seg={seg} t={t} buscar={buscar} acotarA={(p) => elegir(p, { acotado: true })} />
      </section>

      {datos && <Visitas r={datos.r} />}
    </div>
  );
}

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
}: {
  periodo: Periodo;
  acotado: boolean;
  leida: number;
  reloj: number;
  leyendo: boolean;
  slug: string;
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
          {etiquetaDelPeriodo(periodo, leida)}
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
            Acotado a {hhmm(periodo.desde)}–{hhmm(periodo.hasta)}
          </span>
          <button
            type="button"
            onClick={() => elegir(diaQueContiene(periodo.desde))}
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
  cerrar,
  elegir,
}: {
  periodo: Periodo;
  reloj: number;
  slug: string;
  unitId?: string;
  cerrar: () => void;
  elegir: (p: Periodo, o?: { deServicio?: boolean }) => void;
}) {
  const [desde, setDesde] = useState(() => panelDe(periodo.desde));
  const [hasta, setHasta] = useState(() => panelDe(periodo.hasta));
  const dia = panelDe(periodo.desde).fecha;
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
    const a = instanteDelPanel(desde.fecha, desde.hora);
    const z = instanteDelPanel(hasta.fecha, hasta.hora);
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
        {atajosDeTiempo(reloj).map((a) => (
          <button key={a.nombre} type="button" className={opcion} onClick={() => elegir(a.periodo)}>
            {a.nombre}
          </button>
        ))}
      </div>

      {servicios?.reservada && (
        <div>
          <h3 className={`${subtitulo} mt-4`}>Servicios de esta unidad · {diaCorto(periodo.desde)}</h3>
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
                    {hhmm(a)}–{hhmm(z)} · {s.modalidad}
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

/* ─── Las cifras ────────────────────────────────────────────────────────── */

const Cifras = memo(function Cifras({ r }: { r: RecorridoJson }) {
  const tHuecos = r.huecos.reduce((n, h) => n + (Date.parse(h.hasta) - Date.parse(h.desde)), 0);
  const tramos = r.cifras.puntos > 0 ? r.cifras.huecos + 1 : 0;
  const cifras: Array<[string, string]> = [
    [`${r.cifras.kmMedidos.toFixed(1)} km`, "recorridos"],
    [r.cifras.minutosConSenal > 0 ? duracion(r.cifras.minutosConSenal * 60_000) : "0", "con señal"],
    [r.cifras.huecos > 0 ? `${r.cifras.huecos} · ${duracion(tHuecos)}` : "0", "huecos · duración"],
    [String(tramos), tramos === 1 ? "tramo medido" : "tramos medidos"],
    // Sólo cuando los hay: cero saltos no es un dato que alguien mire.
    ...(r.saltos.length > 0 ? [[String(r.saltos.length), r.saltos.length === 1 ? "salto del GPS" : "saltos del GPS"] as [string, string]] : []),
  ];
  return (
    <div className="mb-3.5 flex flex-wrap items-stretch gap-2.5">
      {cifras.map(([n, e]) => (
        <div key={e} className={`min-w-[118px] rounded-[10px] px-4 py-2.5 ${borde}`}>
          <div data-medida className="text-[19px] font-medium">
            {n}
          </div>
          <div className="mt-px text-[11.5px] text-[var(--tenue)]">{e}</div>
        </div>
      ))}
      {r.simplificado && (
        <div className="flex max-w-[220px] items-center gap-2 rounded-[10px] border border-dashed border-[var(--linea)] px-3.5 py-2.5 text-[12px] leading-snug text-[var(--tenue)]">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none">
            <polyline points="1,12 6,6 10,9 15,3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Trazo simplificado para dibujarse · acota para el detalle completo</span>
        </div>
      )}
    </div>
  );
});

/* ─── Los avisos sobre el mapa ──────────────────────────────────────────── */

export function Aviso({
  glifo,
  titulo,
  rango,
  porque,
  accion,
  alTocar,
}: {
  glifo?: React.ReactNode;
  titulo: string;
  rango: React.ReactNode;
  porque?: string;
  accion: string;
  alTocar: () => void;
}) {
  return (
    <div
      role="status"
      className={`absolute bottom-[18px] left-1/2 z-[800] w-[min(410px,calc(100%-32px))] -translate-x-1/2 rounded-xl px-[18px] py-3.5 shadow-[0_6px_24px_rgba(0,0,0,.10)] ${borde}`}
    >
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        {glifo}
        {titulo}
      </div>
      <div data-medida className="mt-1.5 text-[13px]">
        {rango}
      </div>
      {porque && <div className="mt-1 text-[12.5px] text-[var(--tenue)]">{porque}</div>}
      <button
        type="button"
        onClick={alTocar}
        className={`mt-3 w-full cursor-pointer rounded-[9px] bg-[var(--tinta)] px-3 py-[9px] text-center text-[14px] font-semibold text-[var(--papel)] ${foco}`}
      >
        {accion}
      </button>
    </div>
  );
}

export function AvisoDePausa({ pausa, continuaEn, alContinuar }: { pausa: Pausa; continuaEn: number; alContinuar: () => void }) {
  if (pausa.tipo === "salto") {
    return (
      <Aviso
        glifo={<Glifo estado="salto" tamano={16} tinta="tinta" />}
        titulo="Salto del GPS"
        rango={`${sello(pausa.desde)} → ${sello(pausa.hasta)} · ${pausa.km.toFixed(1)} km en ${duracion(pausa.hasta - pausa.desde)}`}
        porque="La línea no se dibuja: los dos puntos se midieron, pero ningún camión recorre eso en ese tiempo."
        accion={`Continuar en ${hhmm(continuaEn)}`}
        alTocar={alContinuar}
      />
    );
  }
  if (pausa.tipo === "hueco") {
    return (
      <Aviso
        glifo={<Glifo estado="sin-senal" tamano={16} tinta="tinta" />}
        titulo="Sin señal"
        rango={`${sello(pausa.desde)} → ${sello(pausa.hasta)} · ${duracion(pausa.hasta - pausa.desde)}`}
        porque="La línea no se dibuja: nadie la midió."
        accion={`Continuar en ${hhmm(continuaEn)}`}
        alTocar={alContinuar}
      />
    );
  }
  return (
    <Aviso
      glifo={<Glifo estado="en-destino" tamano={16} tinta="tinta" />}
      titulo={`En ${pausa.lugar}`}
      rango={`${pausa.entradaObservada ? "llegó" : "adentro desde"} ${sello(pausa.desde)} → ${
        pausa.salidaObservada ? "salió" : "último punto adentro"
      } ${sello(pausa.hasta)} · ${duracion(pausa.hasta - pausa.desde)}`}
      porque="Adentro de un destino de servicio especial la línea no se dibuja: ahí manda el sello."
      accion={`Continuar en ${hhmm(continuaEn)}`}
      alTocar={alContinuar}
    />
  );
}

/* ─── La ventana vacía (regla 11) ───────────────────────────────────────── */

function VentanaVacia({
  r,
  periodo,
  deServicio,
  asignaciones,
  cuentaEnRuta,
}: {
  r: RecorridoJson;
  periodo: Periodo;
  deServicio: boolean;
  asignaciones: AsignacionDeLaUnidad[];
  cuentaEnRuta: string | null;
}) {
  // Hubo puntos, pero todos cayeron adentro de un destino de especial: se midió, no se dibuja.
  if (r.puntosMedidos > 0) {
    const lugar = r.ocultos[0]?.lugar.nombre;
    return (
      <div className="absolute inset-0 z-[700] grid place-items-center p-6 text-center">
        <div className={`rounded-xl px-5 py-4 ${borde}`}>
          <div className="text-[19px]" style={titular}>
            Todo el periodo, adentro {lugar ? `de ${lugar}` : "de un destino"}
          </div>
          <div className="mt-1.5 text-[13.5px] text-[var(--tenue)]">
            Hubo puntos medidos, pero adentro de un destino de servicio especial la línea no se dibuja.
          </div>
        </div>
      </div>
    );
  }
  const vacio = vacioDe(periodo, asignaciones);
  return (
    <div className="absolute inset-0 z-[700] grid place-items-center p-6 text-center">
      <div className={`max-w-[460px] rounded-xl px-5 py-4 ${borde}`}>
        <div className="text-[19px]" style={titular}>
          Sin recorrido en este periodo
        </div>
        <div className="mt-1.5 text-[13.5px] text-[var(--tenue)]">
          No hay puntos medidos entre esas dos horas.
          <br />
          No es una falla: es que no se observó nada.
        </div>
        {deServicio && (
          <div className="mt-2.5 text-[13.5px]">Durante la ventana del servicio, la unidad no fue medida en ningún lado.</div>
        )}
        <div className="mt-2.5 text-[13px]">
          {vacio.tipo === "sin_dispositivo" && "Esta unidad no traía dispositivo en ese periodo: no hay con qué saber qué hizo."}
          {vacio.tipo !== "sin_dispositivo" &&
            vacio.dispositivos.map((d) => (
              <span key={d.deviceId} className="block">
                {vacio.tipo === "no_reporto"
                  ? `Traía ${d.etiqueta} y no reportó en este periodo. `
                  : `${d.etiqueta} sí reportó fuera de este periodo · último punto ${sello(d.ultimoPunto!)}. Acota o amplía para verlo. `}
                <Link
                  href={rutas.dispositivo(d.deviceId, cuentaEnRuta)}
                  className={`font-semibold underline decoration-[var(--linea)] underline-offset-4 ${foco}`}
                >
                  Ver {d.etiqueta}
                </Link>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ─── La cinta de pedazos ───────────────────────────────────────────────── */

function Cinta({
  pedazos,
  pausas,
  seg,
  t,
  buscar,
  acotarA,
}: {
  pedazos: Pedazo[];
  pausas: Pausa[];
  seg: number;
  t: number;
  buscar: (i: number, t: number) => void;
  acotarA: (p: Periodo) => void;
}) {
  const total = tiempoConSenal(pedazos) || 1;
  const [brocha, setBrocha] = useState<{ i: number; a: number; b: number } | null>(null);
  const inicio = useRef<{ x: number; i: number; a: number } | null>(null);

  const fraccion = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
  };

  return (
    <>
      <div className="mt-3.5 flex h-9 select-none items-stretch">
        {pedazos.map((p, i) => {
          const lleno = i < seg ? 1 : i > seg ? 0 : (t - p.t0) / (p.t1 - p.t0 || 1);
          const pausa = i > 0 ? pausas[i - 1] : undefined;
          return (
            <div key={`${p.t0}-${i}`} className="contents">
              {pausa && (
                <div
                  className="grid w-7 flex-none place-items-center"
                  title={nombreDePausa(pausa)}
                >
                  <Glifo estado={glifoDePausa(pausa)} tamano={14} />
                </div>
              )}
              <button
                type="button"
                aria-label={`Tramo ${i + 1}, ${hhmm(p.t0)} a ${hhmm(p.t1)}`}
                className={`relative cursor-ew-resize touch-none overflow-hidden rounded-md bg-[var(--linea)] ${foco}`}
                style={{ flexGrow: (p.t1 - p.t0) / total, flexBasis: 0, minWidth: 4 }}
                onPointerDown={(ev) => {
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  const a = fraccion(ev);
                  inicio.current = { x: ev.clientX, i, a };
                  setBrocha({ i, a, b: a });
                }}
                onPointerMove={(ev) => {
                  if (inicio.current?.i !== i) return;
                  const b = fraccion(ev);
                  setBrocha({ i, a: inicio.current.a, b });
                }}
                onPointerUp={(ev) => {
                  const ini = inicio.current;
                  inicio.current = null;
                  setBrocha(null);
                  if (!ini || ini.i !== i) return;
                  const b = fraccion(ev);
                  const arrastro = Math.abs(ev.clientX - ini.x) > 6;
                  const acotado = arrastro ? acotar(p, ini.a, b) : null;
                  if (acotado) acotarA(acotado);
                  else buscar(i, p.t0 + b * (p.t1 - p.t0));
                }}
                onPointerCancel={() => {
                  inicio.current = null;
                  setBrocha(null);
                }}
                onKeyDown={(ev) => {
                  const paso = (p.t1 - p.t0) / 20;
                  if (ev.key === "ArrowRight") buscar(i, (i === seg ? t : p.t0) + paso);
                  if (ev.key === "ArrowLeft") buscar(i, (i === seg ? t : p.t0) - paso);
                }}
              >
                <span className="pointer-events-none absolute inset-y-0 left-0 bg-[var(--tinta)]" style={{ width: `${lleno * 100}%` }} />
                {brocha?.i === i && (
                  <span
                    className="pointer-events-none absolute inset-y-0 bg-[var(--senal)] opacity-[.32]"
                    style={{ left: `${Math.min(brocha.a, brocha.b) * 100}%`, width: `${Math.abs(brocha.b - brocha.a) * 100}%` }}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2.5">
        <span data-medida className="text-[11px] text-[var(--tenue)]">
          {pedazos.length ? sello(pedazos[0]!.t0) : ""}
        </span>
        <span className="text-[11.5px] text-[var(--tenue)]">Arrastra sobre un tramo para acotar a esas horas</span>
        <span data-medida className="text-[11px] text-[var(--tenue)]">
          {pedazos.length ? sello(pedazos[pedazos.length - 1]!.t1) : ""}
        </span>
      </div>
    </>
  );
}

/* ─── Las visitas ───────────────────────────────────────────────────────── */

const Visitas = memo(function Visitas({ r }: { r: RecorridoJson }) {
  const cortadas = new Set(r.ocultos.map((o) => `${o.lugar.id}-${o.desde}`));
  return (
    <section className="mt-[18px]" aria-label="Visitas a lugares">
      <h2 className="mb-2 text-[17px]" style={titular}>
        Visitas a lugares
      </h2>
      {r.visitas.length === 0 && (
        <div className={`rounded-xl px-4 py-3 ${borde}`}>
          <span data-medida className="text-[13px] text-[var(--tenue)]">
            Ninguna en este periodo
          </span>
        </div>
      )}
      {r.visitas.map((v) => {
        const cortada = cortadas.has(`${v.lugar.id}-${v.entrada}`);
        const regla =
          v.lugar.rol !== "destino"
            ? `rol ${v.lugar.rol}: la traza no se corta`
            : cortada
              ? "destino de servicio especial: la traza se corta"
              : "destino sin servicio especial en ese momento: la traza no se corta";
        return (
          <div key={`${v.lugar.id}-${v.entrada}`} className={`mb-2 flex flex-wrap items-baseline gap-3.5 rounded-xl px-4 py-3 ${borde}`}>
            <span className="text-[16px]" style={titular}>
              {v.lugar.nombre}
            </span>
            <span data-medida className="text-[13px] text-[var(--tenue)]">
              {v.entradaObservada ? "" : "adentro desde "}
              {sello(Date.parse(v.entrada))} → {v.salida ? sello(Date.parse(v.salida)) : `${sello(Date.parse(v.ultimoAdentro))} · sin salida vista`}
            </span>
            <span className="ml-auto text-[12px] text-[var(--tenue)]">{regla}</span>
          </div>
        );
      })}
    </section>
  );
});
