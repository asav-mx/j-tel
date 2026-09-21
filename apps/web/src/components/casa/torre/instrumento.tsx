import { escalaDelInstrumento, textoDeReferencia } from "@/lib/casa/torre";
import type { Referencia } from "@jtel/services";

/**
 * El instrumento de ritmo — el intervalo contra su banda (9.3b).
 *
 * **El eje va de 0 a dos veces la frecuencia prometida**, así que la banda cae
 * centrada y con «cada 10 min» se lee 5–15 en el medio. Sus dos orillas van
 * rotuladas y la leyenda dice de qué son los minutos: es una regla de medición,
 * no un mapa, y sin rótulos alguien lo leería como avance sobre la ruta.
 *
 * **La aguja es el intervalo entero, no una raya.** El paso es un rango —los
 * dos pings que encierran el cruce— y clavar una raya en su centro fingiría una
 * hora que el instrumento no conoce. Con una medición fina la aguja sale de un
 * pelo; con un hueco largo del GPS sale ancha, y esa anchura dice que se midió
 * con menos filo.
 *
 * `izquierda = pocos minutos`, siempre: adelantada a la izquierda, atrasada a
 * la derecha.
 */
export function Instrumento({
  referencia,
  intervalo,
  vacio,
}: {
  referencia: Referencia | null;
  intervalo: { desdeMin: number; hastaMin: number } | null;
  /** Qué decir cuando no hay banda: «sin pasos que medir», «sin promesa», … */
  vacio?: string;
}) {
  if (!referencia) {
    return (
      <div className="relative mt-3 h-9" role="img" aria-label={vacio ?? "Sin ritmo que medir"}>
        <span className="absolute inset-x-0 top-[9px] h-0.5 bg-[var(--linea)]" />
        <span className="absolute inset-x-[27%] top-1 h-3 rounded-md border border-dashed border-[var(--linea)]" />
        <span className="absolute left-1/2 top-[23px] -translate-x-1/2 whitespace-nowrap text-[8.5px] uppercase tracking-[0.1em] text-[var(--tenue)]">
          {vacio ?? "sin pasos que medir"}
        </span>
      </div>
    );
  }

  const e = escalaDelInstrumento(referencia, intervalo);
  const anchoAguja = Math.max(0.8, e.agujaHastaPct - e.agujaDesdePct);

  return (
    <div
      className="relative mt-3 h-9"
      role="img"
      aria-label={`Intervalo contra la banda de la franja, ${textoDeReferencia(referencia)} minutos`}
    >
      <span className="absolute inset-x-0 top-[9px] h-0.5 bg-[var(--linea)]" />
      <span
        className="absolute top-1 h-3 rounded-md border border-[var(--linea)] bg-[var(--roce)]"
        style={{ left: `${e.bandaDesdePct}%`, right: `${100 - e.bandaHastaPct}%` }}
      />
      {intervalo && (
        <span
          className="absolute top-0 h-5 rounded-sm bg-[var(--tinta)]"
          style={{ left: `${e.agujaDesdePct}%`, width: `${anchoAguja}%` }}
        />
      )}
      <span
        data-medida
        className="absolute top-[22px] -translate-x-1/2 text-[9.5px] text-[var(--tenue)]"
        style={{ left: `${e.bandaDesdePct}%` }}
      >
        {Math.round(referencia.desdeMin)}
      </span>
      <span
        data-medida
        className="absolute top-[22px] -translate-x-1/2 text-[9.5px] text-[var(--tenue)]"
        style={{ left: `${e.bandaHastaPct}%` }}
      >
        {Math.round(referencia.hastaMin)}
      </span>
      <span className="absolute left-1/2 top-[23px] -translate-x-1/2 whitespace-nowrap text-[8.5px] uppercase tracking-[0.1em] text-[var(--tenue)]">
        min entre pasos
      </span>
    </div>
  );
}
