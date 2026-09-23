"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Glifo } from "@/components/casa/glifo";
import { MarcaDeRitmo, RielDelRitmo } from "@/components/casa/torre/ritmo";
import {
  enElTramo,
  glifoDeLaUnidad,
  porcentajeDeParada,
  porcentajeEnElCarril,
  textoDeEspera,
  type AbscisaDeParada,
} from "@/lib/casa/torre";
import type { ReferenciaDeRitmo, Sentido } from "@jtel/domain";
import { esperasDelCarril } from "@/lib/casa/espera-del-carril";
import { rotulosQueCaben, type RotuloMedido } from "@/lib/casa/rotulos-del-carril";
import { duracionEnPalabras } from "@/lib/casa/torre";
import type { EsperaDeParada, UnidadEnLaTorre } from "@jtel/services";

/**
 * Un carril del radar: la vía de un sentido, con sus paradas abajo, sus
 * unidades encima y el riel del ritmo arriba.
 *
 * **Las paradas van parejas y todo lo demás se coloca por tramo** (ver
 * `lib/casa/torre.ts`): el radar es un esquema, como el plano de un metro, y lo
 * que afirma —«va entre estas dos, más o menos por aquí»— es exactamente lo que
 * la medición sostiene.
 */
export function Carril({
  sentido,
  rotulo,
  abscisas,
  unidades,
  esperas,
  ritmo,
  porQueSinRitmo,
  edadDe,
  seleccion,
  alTocar,
}: {
  sentido: Sentido;
  rotulo: string;
  abscisas: AbscisaDeParada[];
  unidades: UnidadEnLaTorre[];
  esperas: EsperaDeParada[];
  ritmo: { referencias: ReferenciaDeRitmo[] } | null;
  /** Por qué el carril va vacío, cuando va vacío. 9.2e: se declara, no se calla. */
  porQueSinRitmo: string | null;
  edadDe: (u: UnidadEnLaTorre) => string;
  seleccion: string | null;
  alTocar: (id: string) => void;
}) {
  const cuantas = abscisas.length;
  const indiceDe = new Map(abscisas.map((a, i) => [a.stopId, i]));

  /*
   * Qué parada lleva reloj propio y qué se dice una sola vez, en
   * `lib/casa/espera-del-carril.ts`. Sin pasadas hoy no hay diecisiete paradas
   * atrasadas: hay un circuito parado, y eso se afirma una vez.
   */
  const { conReloj, sinPasada } = esperasDelCarril(esperas, sentido);

  /*
   * El raleo necesita **el ancho que mide cada nombre dibujado**, no una
   * suposición: la primera versión usaba un hueco constante y la captura la
   * desmintió —el carril daba 79 px por parada, la regla dijo «caben todas», y
   * «Fraccionamiento Praderas del Sur Segunda Etapa» mide 250—.
   *
   * Así que se dibujan todos, se miden, y se decide. Un cuadro de más al
   * montar y al cambiar el ancho; ninguno después.
   */
  const marco = useRef<HTMLDivElement | null>(null);
  const rotulos = useRef<Array<HTMLSpanElement | null>>([]);
  const [medidos, setMedidos] = useState<RotuloMedido[]>([]);

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => {
      const base = el.getBoundingClientRect();
      setMedidos(
        abscisas.map((_, i) => {
          const r = rotulos.current[i]?.getBoundingClientRect();
          return r ? { centroPx: r.left + r.width / 2 - base.left, anchoPx: r.width } : { centroPx: 0, anchoPx: 0 };
        }),
      );
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
    // `abscisas` entra por longitud: su identidad cambia en cada sondeo y
    // volver a medir cada 15 s no aporta nada.
  }, [abscisas.length]);

  /* Nunca se ralean: la seleccionada y las que se pasaron de su rango (9.2b). */
  const forzados = new Set<number>();
  abscisas.forEach((p, i) => {
    if (seleccion === `parada:${p.stopId}:${sentido}`) forzados.add(i);
    if (conReloj.get(p.stopId)?.estado === "atrasada") forzados.add(i);
  });
  const conRotulo = rotulosQueCaben(
    medidos.length === cuantas ? medidos : abscisas.map(() => ({ centroPx: 0, anchoPx: 0 })),
    forzados,
  );

  return (
    <div ref={marco} className="relative h-[178px]">
      <div className="absolute left-0 top-0 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--tenue)]">
        {rotulo}
        {sinPasada && (
          /*
           * EL HECHO DEL CIRCUITO, dicho UNA vez.
           *
           * Antes esto salía como el reloj de cada parada: diecisiete números
           * idénticos, todos en cobre, que se leían como diecisiete mediciones
           * independientes. Es una sola, y aquí se dice una sola vez, con la
           * cuenta de a cuántas paradas les toca.
           *
           * **Va en cobre a propósito**, y es la única cosa de la torre que lo
           * lleva sin ser una parada: el cobre marca el reloj que corre frente
           * a quien mira Y pide algo, y un circuito parado desde la apertura es
           * exactamente eso. La ley que se respeta es la otra —que el cobre no
           * se reparta entre todas las paradas—, y se respeta: es UNA línea.
           */
          <span data-medida className="normal-case tracking-normal text-[10.5px] font-semibold text-[var(--senal)]">
            {sinPasada.cuantas === sinPasada.deCuantas
              ? "Hoy no ha pasado nadie"
              : `Sin pasada hoy en ${sinPasada.cuantas} de ${sinPasada.deCuantas} paradas`}
            {" · "}
            {duracionEnPalabras(sinPasada.minutos)} desde la apertura
          </span>
        )}
      </div>

      <RielDelRitmo
        vacio={
          porQueSinRitmo ??
          (ritmo && ritmo.referencias.length === 0 ? "sin referencias en este momento" : undefined)
        }
      >
        {ritmo?.referencias.map((r, i) => {
          const de = indiceDe.get(r.entre.deStopId);
          const a = indiceDe.get(r.entre.aStopId);
          if (de === undefined || a === undefined) return null;
          return (
            <MarcaDeRitmo
              key={`${r.entre.deStopId}-${i}`}
              desdePct={porcentajeDeParada(Math.min(de, a), cuantas)}
              hastaPct={porcentajeDeParada(Math.max(de, a), cuantas)}
              fraccion={r.fraccionDelTramo}
              entre={[abscisas[de]!.nombre, abscisas[a]!.nombre]}
            />
          );
        })}
      </RielDelRitmo>

      <span className="absolute inset-x-0 top-[94px] h-0.5 bg-[var(--linea)]" />

      {abscisas.map((p, i) => {
        const espera = conReloj.get(p.stopId);
        const vencida = espera?.estado === "atrasada";
        const sel = seleccion === `parada:${p.stopId}:${sentido}`;
        return (
          <div key={p.stopId} className="absolute top-0 h-full w-0" style={{ left: `${porcentajeDeParada(i, cuantas)}%` }}>
            <button
              type="button"
              onClick={() => alTocar(`parada:${p.stopId}:${sentido}`)}
              className="absolute -left-10 top-[84px] h-16 w-20 cursor-pointer rounded-lg border-0 bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              aria-label={`Parada ${p.nombre}${vencida ? ", la espera se pasó del rango" : ""}`}
            />
            <span
              className={`pointer-events-none absolute top-[86px] ${vencida ? "-left-[1.5px] w-[3px] bg-[var(--tinta)]" : "-left-px w-0.5 bg-[var(--tenue)]"} h-[18px]`}
            />
            {/*
              El nombre se ralea, NUNCA se acorta: es dato del circuito. La que
              se queda sin rótulo conserva su tique y su zona de toque, y al
              tocarla su detalle lo dice completo.
            */}
            {/*
              Siempre MONTADO, para poder medirlo; escondido cuando no le tocó
              rótulo. `visibility` y no `display`, porque un `display:none` no
              tiene ancho y la medición se volvería circular.
              El nombre se ralea, NUNCA se acorta: la parada conserva su tique y
              su zona de toque, y al tocarla su detalle lo dice completo.
            */}
            <span
              ref={(el) => {
                rotulos.current[i] = el;
              }}
              aria-hidden={!conRotulo.has(i)}
              className={`pointer-events-none absolute top-[110px] left-0 -translate-x-1/2 whitespace-nowrap text-[10.5px] ${conRotulo.has(i) ? "" : "invisible"} ${sel || vencida ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}
            >
              {p.nombre}
            </span>
            {espera && (
              <span
                data-medida
                /*
                 * El cobre, y sólo aquí: es el único reloj de la torre que
                 * cambia frente a quien la mira Y pide algo. Dentro del rango
                 * también corre, pero no pide nada, así que se queda en tenue —
                 * si todo corriera en cobre, el cobre dejaría de significar.
                 * La orilla no la carga el color sola: el tique engorda y pasa
                 * a tinta, y el nombre se pone en negrita.
                 */
                className={`pointer-events-none absolute top-[126px] left-0 -translate-x-1/2 whitespace-nowrap text-[11px] ${vencida ? "text-[var(--senal)]" : "text-[var(--tenue)]"}`}
              >
                {textoDeEspera(espera)}
              </span>
            )}
          </div>
        );
      })}

      {unidades.map((u) => {
        const tramo = u.sobreElCorredor ? enElTramo(u.sobreElCorredor.avanceMetros, abscisas) : null;
        if (!tramo) return null;
        const sel = seleccion === `unidad:${u.unitId}`;
        return (
          <div
            key={u.unitId}
            className="absolute top-0 h-full w-0"
            style={{ left: `${porcentajeEnElCarril(tramo, cuantas)}%` }}
          >
            <button
              type="button"
              onClick={() => alTocar(`unidad:${u.unitId}`)}
              className="absolute -left-6 top-14 h-14 w-12 cursor-pointer rounded-[10px] border-0 bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              aria-label={`Unidad ${u.unitLabel}`}
            />
            <span
              className="pointer-events-none absolute top-[58px] left-0 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold text-[var(--tinta)]"
              style={{ fontFamily: "var(--letra-titular)" }}
            >
              {u.unitLabel}
            </span>
            <span
              data-medida
              className="pointer-events-none absolute top-[72px] left-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--tenue)]"
            >
              {edadDe(u)}
            </span>
            <span
              className={`pointer-events-none absolute top-[84px] left-0 -translate-x-1/2 rounded-lg ${sel ? "ring-2 ring-[var(--tinta)]" : ""}`}
            >
              <Glifo estado={glifoDeLaUnidad(u)} rumbo={u.rumboGrados ?? 0} tamano={22} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
