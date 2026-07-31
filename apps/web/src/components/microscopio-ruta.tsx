/**
 * El dibujo del microscopio: trazado contratado, corredor a escala, recorrido
 * real y el tramo que la ventana nunca alcanzó a ver.
 *
 * No es un mapa: es un instrumento. No hay calles porque la pregunta no es
 * "¿por dónde?" sino "¿qué relación hay entre lo contratado, la tolerancia y
 * lo que se observó?". Sin mosaicos de fondo el dibujo se lee igual en un
 * PDF, en una captura y sin red.
 *
 * El corredor se dibuja engrosando la polilínea, que es literalmente la
 * definición del motor ("todo punto a ≤ R del trazado"). Por eso los metros
 * de tolerancia se ven como metros, y por eso hay barra de escala: un ancho
 * sin escala al lado es decoración.
 */

import {
  proyectar,
  trazo,
  poligono,
  adelgazar,
  type Punto,
  type TramoDeRuta,
} from "@/lib/diagnostico-geometria";

const ANCHO = 900;
const ALTO = 460;
const MARGEN = 26;

export type MicroscopioRutaProps = {
  waypoints: readonly Punto[];
  tramo: TramoDeRuta;
  geocerca: readonly Punto[];
  /** Traza de la candidata decisiva, ya cortada en la llegada. */
  recorrido: readonly Punto[];
  /** Trazas de las demás candidatas evaluadas, ya acotadas por quien llama. */
  otrosRecorridos: ReadonlyArray<{ clave: string; puntos: readonly Punto[] }>;
  /** Cuántas trazas más se evaluaron y no se dibujaron. Se declara, no se calla. */
  otrosOmitidos: number;
  corredorMetros: number;
};

/** Distancia redonda que quepa cerca de 130 px, para la barra de escala. */
function escalaBonita(metrosPorPx: number): { metros: number; px: number } {
  const objetivo = 130 * metrosPorPx;
  const candidatos = [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000];
  const metros = candidatos.find((c) => c >= objetivo) ?? candidatos[candidatos.length - 1]!;
  return { metros, px: metros / metrosPorPx };
}

export function MicroscopioRuta({
  waypoints,
  tramo,
  geocerca,
  recorrido,
  otrosRecorridos,
  otrosOmitidos,
  corredorMetros,
}: MicroscopioRutaProps) {
  const proy = proyectar(
    [waypoints, geocerca, recorrido, ...otrosRecorridos.map((o) => o.puntos)],
    { ancho: ANCHO, alto: ALTO, margen: MARGEN },
  );

  if (!proy || waypoints.length < 2) {
    return (
      <p className="font-[family-name:var(--fuente-mono)] text-sm text-[var(--tenue)]">
        Sin trazado que dibujar: esta ruta no tiene KML vigente a la fecha del servicio.
      </p>
    );
  }

  const anchoBanda = (2 * corredorMetros) / proy.metrosPorPx;
  const conRim = anchoBanda >= 6;
  const anchoInterior = Math.max(anchoBanda - 2.4, 0.5);

  const rutaCompleta = trazo(adelgazar(waypoints, 1400), proy);
  const rutaFuera = tramo.fuera.length >= 2 ? trazo(adelgazar(tramo.fuera, 700), proy) : "";
  const trazaDecisiva = trazo(adelgazar(recorrido, 900), proy);

  const origen = proy.px(waypoints[0]!);
  const destino = proy.px(waypoints[waypoints.length - 1]!);
  const primerPunto = recorrido.length > 0 ? proy.px(recorrido[0]!) : null;
  const ultimoPunto =
    recorrido.length > 1 ? proy.px(recorrido[recorrido.length - 1]!) : null;

  const escala = escalaBonita(proy.metrosPorPx);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="block w-full rounded-sm border border-[var(--linea)] bg-[var(--panel)]"
        role="img"
        aria-label={`Trazado contratado con corredor de ${corredorMetros.toFixed(0)} metros, recorrido real y el ${(tramo.fraccionInicio * 100).toFixed(1)}% inicial de la ruta sin observación`}
      >
        <defs>
          {/* La ausencia se dibuja como ausencia: rayado, no color de veredicto.
              Un tramo no observado no es un fallo — es una pregunta sin responder. */}
          <pattern
            id="mr-rayado-fuera"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--tenue)" strokeWidth="1.6" />
          </pattern>
          <pattern id="mr-rejilla" width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M45 0 L0 0 0 45" fill="none" stroke="var(--rejilla)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={ANCHO} height={ALTO} fill="url(#mr-rejilla)" />

        {/* — El corredor, a escala — */}
        <path
          d={rutaCompleta}
          fill="none"
          stroke="var(--acero)"
          strokeOpacity={conRim ? 0.3 : 0.16}
          strokeWidth={anchoBanda}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {conRim && (
          <>
            <path
              d={rutaCompleta}
              fill="none"
              stroke="var(--panel)"
              strokeWidth={anchoInterior}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={rutaCompleta}
              fill="none"
              stroke="var(--acero)"
              strokeOpacity={0.07}
              strokeWidth={anchoInterior}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* — El tramo que la ventana no alcanzó a ver — */}
        {rutaFuera && (
          <>
            <path
              d={rutaFuera}
              fill="none"
              stroke="url(#mr-rayado-fuera)"
              strokeOpacity={0.5}
              strokeWidth={anchoBanda}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={rutaFuera}
              fill="none"
              stroke="var(--tenue)"
              strokeWidth={2.4}
              strokeDasharray="2 5"
              strokeLinecap="round"
            />
          </>
        )}

        {/* — El trazado contratado: la línea de la que se habla — */}
        <path
          d={rutaCompleta}
          fill="none"
          stroke="var(--acero)"
          strokeOpacity={0.62}
          strokeWidth={1.4}
          strokeDasharray="9 6"
        />

        {/* — La geocerca: frontera de la evidencia — */}
        {geocerca.length >= 3 && (
          <path
            d={poligono(geocerca, proy)}
            fill="var(--acero)"
            fillOpacity={0.06}
            stroke="var(--acero)"
            strokeOpacity={0.45}
            strokeWidth={1.2}
          />
        )}

        {/* — Las demás candidatas: se ven, pero no compiten por la mirada — */}
        {otrosRecorridos.map((o) => {
          const d = trazo(adelgazar(o.puntos, 400), proy);
          return d ? (
            <path
              key={o.clave}
              d={d}
              fill="none"
              stroke="var(--tenue)"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          ) : null;
        })}

        {/* — El recorrido real de la candidata decisiva — */}
        {trazaDecisiva && (
          <path
            d={trazaDecisiva}
            fill="none"
            stroke="var(--acero)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* — Marcas — */}
        <g fontFamily="var(--fuente-mono)" fontSize="10.5" fill="var(--tenue)">
          <circle cx={origen.x} cy={origen.y} r="4" fill="none" stroke="var(--tenue)" strokeWidth="1.4" />
          <text x={origen.x + 8} y={origen.y - 6}>origen del trazado</text>

          <g stroke="var(--acero)" strokeWidth="1.4">
            <line x1={destino.x - 6} y1={destino.y} x2={destino.x + 6} y2={destino.y} />
            <line x1={destino.x} y1={destino.y - 6} x2={destino.x} y2={destino.y + 6} />
          </g>
          <text x={destino.x + 9} y={destino.y + 14} fill="var(--acero)">destino</text>

          {primerPunto && (
            <>
              <circle cx={primerPunto.x} cy={primerPunto.y} r="3.5" fill="var(--azul)" />
              <text x={primerPunto.x + 8} y={primerPunto.y + 14} fill="var(--azul)">
                primer punto observado
              </text>
            </>
          )}
          {ultimoPunto && (
            <circle
              cx={ultimoPunto.x}
              cy={ultimoPunto.y}
              r="3.5"
              fill="none"
              stroke="var(--azul)"
              strokeWidth="1.6"
            />
          )}
        </g>

        {/* — Barra de escala: sin ella, un ancho de corredor no significa nada — */}
        <g
          transform={`translate(${MARGEN} ${ALTO - 16})`}
          fontFamily="var(--fuente-mono)"
          fontSize="10.5"
          fill="var(--tenue)"
        >
          <line x1="0" y1="0" x2={escala.px} y2="0" stroke="var(--tenue)" strokeWidth="1.2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--tenue)" strokeWidth="1.2" />
          <line x1={escala.px} y1="-4" x2={escala.px} y2="4" stroke="var(--tenue)" strokeWidth="1.2" />
          <text x={escala.px + 8} y="4">
            {escala.metros >= 1000
              ? `${(escala.metros / 1000).toFixed(escala.metros % 1000 === 0 ? 0 : 1)} km`
              : `${escala.metros} m`}
          </text>
        </g>
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
        <Leyenda muestra={<span className="inline-block h-3 w-6 rounded-[1px] border border-[var(--acero)]/45 bg-[var(--acero)]/10" />}>
          corredor · {corredorMetros.toFixed(0)} m a cada lado
        </Leyenda>
        {/* La escala declarada: si la banda se ve delgada, es porque a esta
            escala 120 m son delgados. El instrumento no exagera la tolerancia. */}
        <span className="text-[var(--tenue)]">1 px ≈ {proy.metrosPorPx.toFixed(0)} m</span>
        <Leyenda muestra={<span className="inline-block h-0 w-6 border-t border-dashed border-[var(--acero)]" />}>
          trazado contratado
        </Leyenda>
        <Leyenda muestra={<span className="inline-block h-0 w-6 border-t-2 border-[var(--acero)]" />}>
          recorrido real
        </Leyenda>
        {geocerca.length >= 3 && (
          <Leyenda muestra={<span className="inline-block h-3 w-4 border border-[var(--acero)]/45 bg-[var(--acero)]/10" />}>
            geocerca del contrato
          </Leyenda>
        )}
        {tramo.fuera.length >= 2 && (
          <Leyenda muestra={<span className="inline-block h-0 w-6 border-t-2 border-dotted border-[var(--tenue)]" />}>
            sin observación · {tramo.kmFuera.toFixed(1)} km
          </Leyenda>
        )}
        {otrosRecorridos.length > 0 && (
          <Leyenda muestra={<span className="inline-block h-0 w-6 border-t border-[var(--tenue)]" />}>
            otras candidatas · {otrosRecorridos.length}
            {otrosOmitidos > 0 && ` de ${otrosRecorridos.length + otrosOmitidos}`}
          </Leyenda>
        )}
        {otrosOmitidos > 0 && (
          <span className="text-[var(--tenue)]">
            {otrosOmitidos} trazas más no se dibujan · quedaron más abajo en el orden del
            motor y encimadas taparían el trazado
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function Leyenda({ muestra, children }: { muestra: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {muestra}
      {children}
    </span>
  );
}
