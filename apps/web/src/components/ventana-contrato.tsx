import { distribucion, type HechoParaLectura, margenEnMinutos } from "@/lib/contrato-lectura";

/**
 * La ventana del turno, dibujada a escala, con las llegadas reales encima.
 *
 * Las cuatro reglas de tiempo son números sueltos en un formulario y una sola
 * figura en la cabeza de quien opera. Dibujarlas juntas es lo que deja ver de
 * un golpe si la hora que se declaró es la hora a la que de verdad se llega —
 * el error que no produce ningún mensaje y sí trescientos veredictos falsos.
 *
 * Los colores: las zonas usan los tres del resultado porque literalmente son
 * las zonas de resultado —lo que cae ahí sale cumplido, tarde o no cumplido—,
 * y la distribución de llegadas va en acero porque es medición.
 */

const ALTO = 168;

export type ZonasDeVentana = {
  /** Minutos antes de la hora límite en que abre la observación. */
  abreMinAntes: number;
  toleranciaMin: number;
  graciaMin: number;
  margenDespuesMin: number;
};

function reglaEnPorcentaje(minuto: number, desde: number, hasta: number): number {
  const total = hasta - desde;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((minuto - desde) / total) * 100));
}

export function VentanaContrato({
  zonas,
  hechos,
  horaLimite,
}: {
  zonas: ZonasDeVentana;
  hechos: HechoParaLectura[];
  /** La hora límite escrita, para rotular el eje. */
  horaLimite: string | null;
}) {
  // El eje va de la apertura de la ventana a su cierre, en minutos relativos a
  // la hora límite (que es el cero).
  const desde = -zonas.abreMinAntes;
  const hasta = zonas.graciaMin + zonas.margenDespuesMin;
  const pct = (m: number) => reglaEnPorcentaje(m, desde, hasta);

  const finTolerancia = zonas.toleranciaMin;
  const finGracia = zonas.graciaMin;

  const margenes = hechos
    .map(margenEnMinutos)
    .filter((m): m is number => m !== null)
    .filter((m) => m >= desde && m <= hasta);
  const dist = distribucion(margenes);

  // Histograma en cubetas sobre el mismo eje: cada barra es cuántas llegadas
  // cayeron en ese pedazo de la ventana.
  const CUBETAS = 48;
  const cubetas = new Array(CUBETAS).fill(0);
  for (const m of margenes) {
    const i = Math.min(CUBETAS - 1, Math.floor((pct(m) / 100) * CUBETAS));
    cubetas[i]++;
  }
  const pico = Math.max(1, ...cubetas);

  const mono = "font-[family-name:var(--fuente-mono)]";

  return (
    <div className="border border-[var(--linea)] bg-[var(--panel)] p-5">
      <svg
        viewBox={`0 0 1000 ${ALTO}`}
        role="img"
        aria-label={`Ventana del turno: abre ${zonas.abreMinAntes} minutos antes de la hora límite, tolerancia de ${zonas.toleranciaMin} minutos y cierre ${hasta} minutos después.`}
        className="block h-auto w-full"
      >
        {/* Zonas de resultado. Son zonas de veredicto, por eso llevan sus colores. */}
        <rect x="0" y="34" width={`${pct(0)}%`} height="30" fill="rgba(52,199,123,.13)" />
        <rect
          x={`${pct(0)}%`}
          y="34"
          width={`${pct(finTolerancia) - pct(0)}%`}
          height="30"
          fill="rgba(52,199,123,.22)"
        />
        <rect
          x={`${pct(finTolerancia)}%`}
          y="34"
          width={`${pct(finGracia) - pct(finTolerancia)}%`}
          height="30"
          fill="rgba(227,168,31,.16)"
        />
        <rect
          x={`${pct(finGracia)}%`}
          y="34"
          width={`${100 - pct(finGracia)}%`}
          height="30"
          fill="rgba(229,72,77,.14)"
        />

        <line x1="0" y1="64" x2="1000" y2="64" stroke="rgba(255,255,255,.14)" strokeWidth="1" />

        {/* La hora límite: la marca más fuerte de la figura. */}
        <line
          x1={`${pct(0)}%`}
          y1="22"
          x2={`${pct(0)}%`}
          y2="76"
          stroke="var(--acero)"
          strokeWidth="2"
        />
        {[finTolerancia, finGracia].map((m) => (
          <line
            key={m}
            x1={`${pct(m)}%`}
            y1="30"
            x2={`${pct(m)}%`}
            y2="70"
            stroke="rgba(255,255,255,.2)"
            strokeWidth="1"
          />
        ))}

        <text
          x={`${pct(0)}%`}
          y="16"
          textAnchor="middle"
          fill="var(--acero)"
          fontFamily="var(--fuente-mono)"
          fontSize="10"
          letterSpacing="1.6"
        >
          HORA LÍMITE{horaLimite ? ` ${horaLimite}` : ""}
        </text>

        <text x="6" y="28" fill="var(--verde)" fontFamily="var(--fuente-mono)" fontSize="10" opacity=".85">
          CUMPLE
        </text>
        {finGracia > finTolerancia ? (
          <text
            x={`${(pct(finTolerancia) + pct(finGracia)) / 2}%`}
            y="28"
            textAnchor="middle"
            fill="var(--ambar)"
            fontFamily="var(--fuente-mono)"
            fontSize="9.5"
            opacity=".9"
          >
            TARDE
          </text>
        ) : null}
        <text
          x="994"
          y="28"
          textAnchor="end"
          fill="var(--rojo)"
          fontFamily="var(--fuente-mono)"
          fontSize="10"
          opacity=".9"
        >
          NO CUMPLE
        </text>

        {/* Eje en minutos relativos a la hora límite. */}
        <text x="4" y="88" fill="var(--tenue)" fontFamily="var(--fuente-mono)" fontSize="10">
          −{zonas.abreMinAntes} min
        </text>
        <text
          x={`${pct(0)}%`}
          y="88"
          textAnchor="middle"
          fill="var(--texto)"
          fontFamily="var(--fuente-mono)"
          fontSize="10"
        >
          0
        </text>
        <text
          x="996"
          y="88"
          textAnchor="end"
          fill="var(--tenue)"
          fontFamily="var(--fuente-mono)"
          fontSize="10"
        >
          +{hasta} min
        </text>

        {/* Las llegadas reales, en acero: esto es medición, no juicio. */}
        {margenes.length > 0 ? (
          <>
            <text x="4" y="112" fill="var(--tenue)" fontFamily="var(--fuente-mono)" fontSize="9.5" letterSpacing="1.2">
              LLEGADAS OBSERVADAS
            </text>
            {cubetas.map((c, i) =>
              c === 0 ? null : (
                <rect
                  key={i}
                  x={`${(i / CUBETAS) * 100}%`}
                  y={ALTO - 8 - (c / pico) * 38}
                  width={`${100 / CUBETAS - 0.25}%`}
                  height={(c / pico) * 38}
                  fill="var(--acero)"
                  opacity=".5"
                  rx="1"
                />
              ),
            )}
            <line
              x1={`${pct(0)}%`}
              y1={ALTO - 50}
              x2={`${pct(0)}%`}
              y2={ALTO - 6}
              stroke="var(--acero)"
              strokeWidth="2"
            />
          </>
        ) : (
          <text x="4" y="128" fill="var(--tenue)" fontFamily="var(--fuente-mono)" fontSize="10">
            Sin llegadas observadas en el periodo — no hay distribución que dibujar.
          </text>
        )}
      </svg>

      <div className="mt-4 grid gap-4 border-t border-[var(--linea)] pt-4 sm:grid-cols-4">
        <PieDeVentana
          titulo="Abre la observación"
          valor={`${zonas.abreMinAntes} min antes`}
          lectura="empieza a mirarse la telemetría"
        />
        <PieDeVentana
          titulo="Sigue contando a tiempo"
          valor={`${zonas.toleranciaMin} min después`}
          lectura={zonas.toleranciaMin === 0 ? "sin colchón: llegar tarde es tarde" : "el colchón de puntualidad"}
        />
        <PieDeVentana
          titulo="Se espera antes de dictar"
          valor={`${zonas.graciaMin} min`}
          lectura="una llegada rezagada aún se registra"
        />
        <PieDeVentana
          titulo="Cierra la observación"
          valor={`${hasta} min después`}
          lectura={`espera ${zonas.graciaMin} + margen ${zonas.margenDespuesMin}`}
        />
      </div>

      {dist ? (
        <p className={`mt-4 border-t border-[var(--linea)] pt-3 text-[11.5px] text-[var(--tenue)] ${mono}`}>
          Las llegadas observadas del periodo caen entre{" "}
          <span className="text-[var(--acero)]">{formatoMargen(dist.minimo)}</span> y{" "}
          <span className="text-[var(--acero)]">{formatoMargen(dist.maximo)}</span> de la hora
          límite; la mediana, en{" "}
          <span className="text-[var(--texto)]">{formatoMargen(dist.mediana)}</span>.{" "}
          {dist.n} servicio{dist.n === 1 ? "" : "s"} con llegada observada.
        </p>
      ) : null}
    </div>
  );
}

/** Un delta se escribe como delta: `12 min antes`, nunca `−12:00`. */
export function formatoMargen(minutos: number): string {
  const abs = Math.abs(minutos);
  const texto =
    abs >= 60
      ? `${Math.floor(abs / 60)} h ${Math.round(abs % 60)} min`
      : `${Math.round(abs * 10) / 10} min`;
  if (Math.abs(minutos) < 0.5) return "justo en la hora límite";
  return minutos < 0 ? `${texto} antes` : `${texto} después`;
}

function PieDeVentana({
  titulo,
  valor,
  lectura,
}: {
  titulo: string;
  valor: string;
  lectura: string;
}) {
  const mono = "font-[family-name:var(--fuente-mono)]";
  return (
    <div>
      <div className={`mb-1 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
        {titulo}
      </div>
      <div className={`text-[14px] text-[var(--acero)] tabular-nums ${mono}`}>{valor}</div>
      <div className={`mt-1 text-[10.5px] text-[var(--tenue)] ${mono}`}>{lectura}</div>
    </div>
  );
}
