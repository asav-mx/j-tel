"use client";

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
  const esperaDe = new Map(esperas.filter((e) => e.sentido === sentido).map((e) => [e.stopId, e]));

  return (
    <div className="relative h-[178px]">
      <div className="absolute left-0 top-0 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--tenue)]">
        {rotulo}
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
        const espera = esperaDe.get(p.stopId);
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
            <span
              className={`pointer-events-none absolute top-[110px] left-0 -translate-x-1/2 whitespace-nowrap text-[10.5px] ${sel || vencida ? "font-semibold text-[var(--tinta)]" : "text-[var(--tenue)]"}`}
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
