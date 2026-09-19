"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Glifo } from "@/components/casa/glifo";
import { Pieza } from "@/components/casa/pieza";
import { Aviso, AvisoDePausa, BarraDePeriodo, borde, foco, titular, type EstadoActual } from "@/components/casa/recorrido-playback";
import { usePlayback } from "@/components/casa/use-playback";
import type { LugarDelRecorrido, Marcador } from "@/components/casa/mapa-recorrido";
import { edad } from "@/lib/casa/expedientes";
import type { Puerta } from "@/lib/casa/dispositivos";
import {
  acotar,
  diaCorto,
  duracion,
  glifoDePausa,
  hhmm,
  hhmmss,
  nombreDePausa,
  posicionEn,
  rutaDelRecorrido,
  sello,
  siguienteVelocidad,
  tiempoConSenal,
  type Periodo,
} from "@/lib/casa/recorrido";
import {
  duracionDeHuecos,
  horasDeEtapa,
  huecosDelDispositivo,
  nombreDeEtapa,
  pausasDelDispositivo,
  pedazosDelDispositivo,
  peticionDelRecorridoDeDispositivo,
  quienDeEtapa,
  reglaDeEtapa,
  rutaDeRecorridoDeDispositivo,
  saltosDelDispositivo,
  textoDelCambio,
  type EtapaJson,
  type PausaDelDispositivo,
  type PedazoDeEtapa,
  type RecorridoDeDispositivoJson,
} from "@/lib/casa/recorrido-dispositivo";

const MapaRecorrido = dynamic(() => import("@/components/casa/mapa-recorrido").then((m) => m.MapaRecorrido), {
  ssr: false,
});

/**
 * Ver ‹dispositivo› → Recorridos y playback (prototipo aprobado por ASAV, 17 sep 2026).
 *
 * Una sola traza del dispositivo, partida en etapas por unidad. Lo mismo que el
 * recorrido de la unidad —periodo, cinta, acotar, avisos—, con cuatro cosas suyas:
 *
 *   · el playback **se detiene en cada cambio** de etapa, igual que en un
 *     hueco, y dice quién lo montó o lo soltó y por qué;
 *   · lo medido **en bodega** va punteado, sin unidad, y nada lo corta;
 *   · los kilómetros van **por etapa**, y el total dice «del dispositivo» (§D);
 *   · un tramo **sin unidad y sin puntos en esta cuenta** se nombra con su
 *     alcance: no es un hueco (el hueco es «se calló») ni es bodega (no se sabe).
 */
export function RecorridoDispositivoPlayback({
  slug,
  cuentaEnRuta,
  puerta,
  dispositivo,
  periodoInicial,
  leidaIso,
  estadoActual,
  lugares,
}: {
  slug: string;
  cuentaEnRuta: string | null;
  /** Por dónde se llegó a Ver ‹dispositivo›: se conserva al mover la ventana. */
  puerta: Puerta;
  dispositivo: { id: string; nombre: string };
  periodoInicial: Periodo;
  leidaIso: string;
  estadoActual: EstadoActual | null;
  lugares: LugarDelRecorrido[];
}) {
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
  const elegir = useCallback((p: Periodo, opciones: { acotado?: boolean } = {}) => {
    setPeriodo(p);
    setAcotado(opciones.acotado ?? false);
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", rutaDeRecorridoDeDispositivo(dispositivo.id, periodo, cuentaEnRuta, puerta));
  }, [periodo, dispositivo.id, cuentaEnRuta, puerta]);

  /* ── El dato ── */
  const [datos, setDatos] = useState<{ r: RecorridoDeDispositivoJson; leida: number; clave: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    const url = peticionDelRecorridoDeDispositivo(slug, dispositivo.id, periodo);
    setLeyendo(true);
    setFallo(false);
    fetch(url, { signal: control.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as RecorridoDeDispositivoJson;
        setDatos({ r, leida: Date.now() + desfase.current, clave: url });
        setLeyendo(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setFallo(true);
        setLeyendo(false);
      });
    return () => control.abort();
  }, [slug, dispositivo.id, periodo, intento]);

  const pedazos = useMemo(() => (datos ? pedazosDelDispositivo(datos.r) : []), [datos]);
  const pausas = useMemo(() => (datos ? pausasDelDispositivo(pedazos, datos.r) : []), [datos, pedazos]);
  const huecos = useMemo(() => (datos ? huecosDelDispositivo(datos.r) : []), [datos]);
  const saltos = useMemo(() => (datos ? saltosDelDispositivo(datos.r) : []), [datos]);
  const cambios = useMemo(
    () =>
      pausas.flatMap((p, i) => {
        if (p.tipo !== "cambio") return [];
        const q = pedazos[i + 1]!.puntos[0]!;
        return [{ lat: q.lat, lng: q.lng, aBodega: datos?.r.etapas[p.entra]?.tipo === "bodega" }];
      }),
    [pausas, pedazos, datos],
  );
  const lugaresVisitados = useMemo(() => {
    if (!datos) return [];
    const ids = new Set(
      datos.r.etapas.flatMap((e) => (e.tipo === "sin_unidad_sin_puntos" ? [] : [...e.visitas, ...e.ocultos].map((v) => v.lugar.id))),
    );
    return lugares.filter((l) => ids.has(l.id));
  }, [datos, lugares]);

  /* ── El playback ── */
  const { seg, t, tocando, alto, velManual, setVelManual, velAuto, tocar, continuar, reiniciar, buscar, textoPlay } =
    usePlayback(pedazos, periodo, datos?.leida ?? 0);

  const pedazo = pedazos[seg];
  const pos = pedazo ? posicionEn(pedazo, t) : null;
  const pausa = alto?.tipo === "pausa" ? pausas[alto.indice] : undefined;
  const marcador: Marcador | null = pos
    ? alto?.tipo === "ahora"
      ? { lat: pos.lat, lng: pos.lng, glifo: estadoActual?.glifo ?? "dispositivo-en-unidad", rumbo: 0, tinta: "senal" }
      : pausa && pausa.tipo !== "cambio"
        ? { lat: pos.lat, lng: pos.lng, glifo: glifoDePausa(pausa), rumbo: 0, tinta: "tinta" }
        : { lat: pos.lat, lng: pos.lng, glifo: "en-movimiento", rumbo: pos.rumbo, tinta: "tinta" }
    : null;
  const ultimoPunto = pedazos.length ? pedazos[pedazos.length - 1]!.t1 : null;
  const leida = datos?.leida ?? Date.parse(leidaIso);
  const etapaAhora = pedazo && datos ? datos.r.etapas[pedazo.etapa] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] leading-tight max-sm:text-[26px]" style={{ ...titular, fontWeight: 800 }}>
            Ver {dispositivo.nombre}
          </h1>
          <p className="mt-0.5 font-medium text-[var(--tenue)]">Recorridos y playback</p>
        </div>
        {estadoActual && (
          <div className={`flex items-center gap-2 rounded-[10px] px-3 py-[7px] ${borde}`}>
            <Glifo estado={estadoActual.glifo} tamano={14} tinta={estadoActual.vivo ? "senal" : undefined} />
            <span data-medida className={`text-[13px] ${estadoActual.vivo ? "text-[var(--senal)]" : "text-[var(--tenue)]"}`}>
              {edad(new Date(estadoActual.atIso), new Date(reloj))}
            </span>
            <span className="text-[11.5px] text-[var(--tenue)]">{estadoActual.palabra} · ahora</span>
          </div>
        )}
      </header>

      <BarraDePeriodo periodo={periodo} acotado={acotado} leida={leida} reloj={reloj} leyendo={leyendo} slug={slug} elegir={elegir} />

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
            huecos={huecos}
            saltos={saltos}
            cambios={cambios}
            lugares={lugaresVisitados}
            progreso={{ seg, t }}
            marcador={marcador}
          />
        )}
        {datos && pedazos.length === 0 && <VentanaVacia r={datos.r} />}
        {datos && pausa && alto?.tipo === "pausa" && pedazos[alto.indice + 1] && (
          <AvisoDelDispositivo r={datos.r} pausa={pausa} continuaEn={pedazos[alto.indice + 1]!.t0} alContinuar={continuar} />
        )}
        {alto?.tipo === "fin" && ultimoPunto !== null && (
          <Aviso titulo="Fin del periodo" rango={`Último punto medido · ${sello(ultimoPunto)}`} accion="Volver a empezar" alTocar={reiniciar} />
        )}
        {alto?.tipo === "ahora" && ultimoPunto !== null && (
          <Aviso
            glifo={<Glifo estado={estadoActual?.glifo ?? "dispositivo-en-unidad"} tamano={16} tinta="senal" />}
            titulo="Alcanzaste el ahora"
            rango={
              <>
                último punto <span className="text-[var(--senal)]">{edad(new Date(ultimoPunto), new Date(reloj))}</span>
                {estadoActual ? ` · ${estadoActual.palabra}` : ""}
              </>
            }
            porque="Esto ya no es grabación: es el dispositivo en este momento."
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
            {etapaAhora && etapaAhora.tipo !== "sin_unidad_sin_puntos" && (
              <div className="mt-1 flex items-center gap-2 sm:justify-end">
                <Glifo estado={etapaAhora.tipo === "unidad" ? "dispositivo-en-unidad" : "dispositivo-en-bodega"} tamano={14} tinta="tinta" />
                <span className="text-[15px]" style={titular}>
                  {etapaAhora.tipo === "unidad" ? `en ${etapaAhora.unidad.etiqueta}` : "en bodega"}
                </span>
                {etapaAhora.tipo === "bodega" && <span className="text-[12px] text-[var(--tenue)]">· sin unidad</span>}
              </div>
            )}
          </div>
        </div>
        {datos && (
          <CintaDeEtapas
            r={datos.r}
            pedazos={pedazos}
            pausas={pausas}
            seg={seg}
            t={t}
            buscar={buscar}
            acotarA={(p) => elegir(p, { acotado: true })}
          />
        )}
      </section>

      {datos && <Etapas r={datos.r} cuentaEnRuta={cuentaEnRuta} />}
      {datos && <Visitas r={datos.r} />}
    </div>
  );
}

/* ─── Las cifras: del dispositivo ───────────────────────────────────────── */

const Cifras = memo(function Cifras({ r }: { r: RecorridoDeDispositivoJson }) {
  const cifras: Array<[string, React.ReactNode, string]> = [
    [
      `${r.cifras.kmMedidos.toFixed(1)} km`,
      <>
        recorridos <b className="font-semibold text-[var(--tinta)]">del dispositivo</b>
      </>,
      "km",
    ],
    [r.cifras.minutosConSenal > 0 ? duracion(r.cifras.minutosConSenal * 60_000) : "0", "con señal", "senal"],
    [r.cifras.huecos > 0 ? `${r.cifras.huecos} · ${duracion(duracionDeHuecos(r))}` : "0", "huecos · duración", "huecos"],
    [String(r.unidades), r.unidades === 1 ? "unidad en el periodo" : "unidades en el periodo", "unidades"],
  ];
  // Sólo cuando los hay: cero saltos no es un dato que alguien mire.
  const saltos = saltosDelDispositivo(r).length;
  if (saltos > 0) cifras.push([String(saltos), saltos === 1 ? "salto del GPS" : "saltos del GPS", "saltos"]);
  return (
    <div className="mb-3.5 flex flex-wrap items-stretch gap-2.5">
      {cifras.map(([n, e, k]) => (
        <div key={k} className={`min-w-[118px] rounded-[10px] px-4 py-2.5 ${borde}`}>
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

/* ─── Los avisos ────────────────────────────────────────────────────────── */

function AvisoDelDispositivo({
  r,
  pausa,
  continuaEn,
  alContinuar,
}: {
  r: RecorridoDeDispositivoJson;
  pausa: PausaDelDispositivo;
  continuaEn: number;
  alContinuar: () => void;
}) {
  if (pausa.tipo !== "cambio") return <AvisoDePausa pausa={pausa} continuaEn={continuaEn} alContinuar={alContinuar} />;
  const x = textoDelCambio(r, pausa, continuaEn);
  return (
    <Aviso
      glifo={<Glifo estado={x.entraABodega ? "dispositivo-en-bodega" : "dispositivo-en-unidad"} tamano={16} tinta="tinta" />}
      titulo={x.titulo}
      rango={
        <>
          {x.rango}
          {x.motivo && <span className="mt-0.5 block">{x.motivo}</span>}
        </>
      }
      porque={x.porque}
      accion={x.accion}
      alTocar={alContinuar}
    />
  );
}

function VentanaVacia({ r }: { r: RecorridoDeDispositivoJson }) {
  const todoAdentro = r.puntosMedidos > 0;
  return (
    <div className="absolute inset-0 z-[700] grid place-items-center p-6 text-center">
      <div className={`max-w-[460px] rounded-xl px-5 py-4 ${borde}`}>
        <div className="text-[19px]" style={titular}>
          {todoAdentro ? "Todo el periodo, adentro de un destino" : "Sin recorrido en este periodo"}
        </div>
        <div className="mt-1.5 text-[13.5px] text-[var(--tenue)]">
          {todoAdentro
            ? "Hubo puntos medidos, pero adentro de un destino de servicio especial la línea no se dibuja."
            : "Este dispositivo no dio puntos en esta cuenta entre esas dos horas. Abajo, en qué unidad estuvo."}
        </div>
      </div>
    </div>
  );
}

/* ─── La cinta, agrupada por etapa ──────────────────────────────────────── */

function CintaDeEtapas({
  r,
  pedazos,
  pausas,
  seg,
  t,
  buscar,
  acotarA,
}: {
  r: RecorridoDeDispositivoJson;
  pedazos: PedazoDeEtapa[];
  pausas: PausaDelDispositivo[];
  seg: number;
  t: number;
  buscar: (i: number, t: number) => void;
  acotarA: (p: Periodo) => void;
}) {
  const total = tiempoConSenal(pedazos) || 1;
  const [brocha, setBrocha] = useState<{ i: number; a: number; b: number } | null>(null);
  const inicio = useRef<{ x: number; i: number; a: number } | null>(null);
  const fraccion = (ev: React.PointerEvent<HTMLButtonElement>) => {
    const b = ev.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width));
  };
  const MUESCA = 26;

  return (
    <>
      <div className="mt-3.5 flex select-none items-end">
        {r.etapas.map((etapa, k) => {
          const propios = pedazos.map((p, i) => ({ p, i })).filter((x) => x.p.etapa === k);
          const dur = propios.reduce((n, x) => n + (x.p.t1 - x.p.t0), 0);
          const fijo = Math.max(0, propios.length - 1) * MUESCA + 8;
          const nombre =
            etapa.tipo === "unidad" ? etapa.unidad.etiqueta : etapa.tipo === "bodega" ? "en bodega" : "sin unidad ni puntos";
          const linea =
            etapa.tipo === "unidad"
              ? "border-t-2 border-[var(--tinta)]"
              : etapa.tipo === "bodega"
                ? "border-t-2 border-dotted border-[var(--tinta)]"
                : "border-t-2 border-transparent";
          return (
            <div key={`${etapa.desde}-${k}`} className="contents">
              {k > 0 && (
                <div className="flex w-4 flex-none flex-col items-center self-stretch" title={`Cambio · ${hhmm(Date.parse(etapa.desde))}`}>
                  <span className="w-[1.5px] flex-1 bg-[var(--tinta)] opacity-50" />
                  {etapa.tipo !== "sin_unidad_sin_puntos" && (
                    <span
                      aria-hidden="true"
                      className={`mb-[13px] mt-[3px] block h-2.5 w-2.5 rounded-[2px] ${
                        etapa.tipo === "unidad" ? "bg-[var(--tinta)]" : "border-2 border-[var(--tinta)]"
                      }`}
                    />
                  )}
                  {etapa.tipo === "sin_unidad_sin_puntos" && <span className="mb-[18px] block h-0 w-2.5" />}
                </div>
              )}
              <div
                className="flex min-w-0 flex-col"
                style={dur > 0 ? { flex: `${dur / total} 1 ${fijo}px` } : { flex: `0 0 ${etapa.tipo === "sin_unidad_sin_puntos" ? 96 : 64}px` }}
                title={`${nombreDeEtapa(etapa)} · ${horasDeEtapa(etapa, r.ventana)}`}
              >
                <div
                  className={`flex h-[30px] items-end overflow-hidden px-0.5 pb-[5px] leading-tight ${
                    etapa.tipo === "unidad" ? "text-[13px] text-[var(--tinta)]" : "text-[11px] text-[var(--tenue)]"
                  }`}
                  style={etapa.tipo === "unidad" ? titular : undefined}
                >
                  <span className={etapa.tipo === "sin_unidad_sin_puntos" ? "" : "truncate"}>{nombre}</span>
                </div>
                <div className={`flex h-10 pt-1 ${linea}`}>
                  {propios.length === 0 && (
                    <span className="block flex-1 rounded-md border-[1.5px] border-dotted border-[var(--tenue)]" aria-label={`${nombre}, sin puntos`} />
                  )}
                  {propios.map(({ p, i }, j) => {
                    const lleno = i < seg ? 1 : i > seg ? 0 : (t - p.t0) / (p.t1 - p.t0 || 1);
                    const pausa = j > 0 ? pausas[i - 1] : undefined;
                    const punteado = etapa.tipo === "bodega";
                    return (
                      <div key={`${p.t0}-${i}`} className="contents">
                        {pausa && pausa.tipo !== "cambio" && (
                          <div
                            className="grid w-[26px] flex-none place-items-center"
                            title={nombreDePausa(pausa)}
                          >
                            <Glifo estado={glifoDePausa(pausa)} tamano={14} />
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label={`${nombre}, tramo de ${hhmm(p.t0)} a ${hhmm(p.t1)}`}
                          className={`relative cursor-ew-resize touch-none overflow-hidden rounded-md ${foco}`}
                          style={{
                            // Dentro de su etapa, los tramos llenan el ancho; la etapa ya ocupa su parte del total.
                            flexGrow: p.t1 - p.t0,
                            flexBasis: 0,
                            minWidth: 4,
                            background: punteado
                              ? "repeating-linear-gradient(90deg, var(--linea) 0 4px, transparent 4px 7px)"
                              : "var(--linea)",
                          }}
                          onPointerDown={(ev) => {
                            ev.currentTarget.setPointerCapture(ev.pointerId);
                            const a = fraccion(ev);
                            inicio.current = { x: ev.clientX, i, a };
                            setBrocha({ i, a, b: a });
                          }}
                          onPointerMove={(ev) => {
                            if (inicio.current?.i !== i) return;
                            setBrocha({ i, a: inicio.current.a, b: fraccion(ev) });
                          }}
                          onPointerUp={(ev) => {
                            const ini = inicio.current;
                            inicio.current = null;
                            setBrocha(null);
                            if (!ini || ini.i !== i) return;
                            const b = fraccion(ev);
                            const acotado = Math.abs(ev.clientX - ini.x) > 6 ? acotar(p, ini.a, b) : null;
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
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0"
                            style={{
                              width: `${lleno * 100}%`,
                              background: punteado
                                ? "repeating-linear-gradient(90deg, var(--tinta) 0 4px, transparent 4px 7px)"
                                : "var(--tinta)",
                            }}
                          />
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
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2.5">
        <span data-medida className="text-[11px] text-[var(--tenue)]">
          {sello(Date.parse(r.ventana.desde))}
        </span>
        <span className="text-[11.5px] text-[var(--tenue)]">Arrastra sobre un tramo para acotar a esas horas</span>
        <span data-medida className="text-[11px] text-[var(--tenue)]">
          {sello(Date.parse(r.ventana.hasta))}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--tenue)]">
        <span className="inline-flex items-center gap-1.5">
          <Glifo estado="dispositivo-en-unidad" tamano={11} tinta="tinta" />
          cambio de unidad
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Glifo estado="sin-senal" tamano={13} />
          sin señal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Glifo estado="en-destino" tamano={13} />
          en destino, no se dibuja
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-[11px] w-[22px] rounded-[3px] border-[1.5px] border-dotted border-[var(--tenue)]" />
          sin unidad y sin puntos en esta cuenta
        </span>
      </div>
    </>
  );
}

/* ─── Las etapas ────────────────────────────────────────────────────────── */

const Etapas = memo(function Etapas({ r, cuentaEnRuta }: { r: RecorridoDeDispositivoJson; cuentaEnRuta: string | null }) {
  return (
    <section className="mt-[22px]" aria-label="Pedazos del periodo">
      <h2 className="mb-2.5 text-[17px]" style={titular}>
        Pedazos del periodo
      </h2>
      <div className="flex flex-col gap-2">
        {r.etapas.map((e, i) => (
          <Etapa key={`${e.desde}-${i}`} e={e} i={i} r={r} cuentaEnRuta={cuentaEnRuta} />
        ))}
      </div>
    </section>
  );
});

function Etapa({ e, i, r, cuentaEnRuta }: { e: EtapaJson; i: number; r: RecorridoDeDispositivoJson; cuentaEnRuta: string | null }) {
  const horas = horasDeEtapa(e, r.ventana);
  const quien = quienDeEtapa(r.etapas, i, r.autores);
  const linea = quien && <p className="px-4 text-[12.5px] text-[var(--tenue)]">{quien}</p>;
  if (e.tipo === "sin_unidad_sin_puntos") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3.5">
          <div className="text-[19px] leading-tight" style={titular}>
            Sin unidad y sin puntos en esta cuenta
          </div>
          <div data-medida className="mt-1 text-[13px] text-[var(--tenue)]">
            {horas}
          </div>
        </div>
        {linea}
      </div>
    );
  }
  const km = `${e.cifras.kmMedidos.toFixed(1)} km`;
  const regla = reglaDeEtapa(e);
  return (
    <div className="flex flex-col gap-1.5">
      <Pieza
        nombre={nombreDeEtapa(e)}
        apoyo={horas}
        dato={km}
        etiqueta={e.tipo === "unidad" ? "en esta unidad" : "sin unidad"}
        edad={null}
        ficha={
          e.tipo === "unidad"
            ? rutaDelRecorrido(e.unidad.id, { desde: Date.parse(e.desde), hasta: Date.parse(e.hasta) }, cuentaEnRuta)
            : undefined
        }
      />
      <p className="px-4 text-[12.5px] text-[var(--tenue)]">
        {regla.charAt(0).toUpperCase() + regla.slice(1)}
        {quien ? ` · ${quien.charAt(0).toLowerCase()}${quien.slice(1)}` : ""}
      </p>
    </div>
  );
}

/* ─── Las visitas: cada una dice en qué iba ─────────────────────────────── */

const Visitas = memo(function Visitas({ r }: { r: RecorridoDeDispositivoJson }) {
  const visitas = r.etapas.flatMap((e) =>
    e.tipo === "sin_unidad_sin_puntos"
      ? []
      : e.visitas.map((v) => ({
          v,
          en: e.tipo === "unidad" ? `en ${e.unidad.etiqueta}` : "en bodega",
          cortada: e.ocultos.some((o) => o.lugar.id === v.lugar.id && o.desde === v.entrada),
        })),
  );
  return (
    <section className="mt-[18px]" aria-label="Visitas a lugares">
      <h2 className="mb-2 text-[17px]" style={titular}>
        Visitas a lugares
      </h2>
      {visitas.length === 0 && (
        <div className={`rounded-xl px-4 py-3 ${borde}`}>
          <span data-medida className="text-[13px] text-[var(--tenue)]">
            Ninguna en este periodo
          </span>
        </div>
      )}
      {visitas.map(({ v, en, cortada }) => {
        const regla =
          v.lugar.rol !== "destino"
            ? `rol ${v.lugar.rol}: la traza no se corta`
            : cortada
              ? "destino de servicio especial: la traza se corta"
              : "destino sin servicio especial en ese momento: la traza no se corta";
        return (
          <div key={`${v.lugar.id}-${v.entrada}`} className={`mb-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1 rounded-xl px-4 py-3 ${borde}`}>
            <span className="text-[16px]" style={titular}>
              {v.lugar.nombre}
            </span>
            <span data-medida className="text-[13px] text-[var(--tenue)]">
              {v.entradaObservada ? "" : "adentro desde "}
              {sello(Date.parse(v.entrada))} → {v.salida ? sello(Date.parse(v.salida)) : `${sello(Date.parse(v.ultimoAdentro))} · sin salida vista`}
            </span>
            <span className="text-[13px]">{en}</span>
            <span className="ml-auto text-[12px] text-[var(--tenue)]">{regla}</span>
          </div>
        );
      })}
    </section>
  );
}
);
