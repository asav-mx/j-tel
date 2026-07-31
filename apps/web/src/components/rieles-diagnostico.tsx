/**
 * Los dos rieles de la ventana de observación.
 *
 * Son dos preguntas distintas y por eso son dos dibujos distintos:
 *
 *  - **Sobre la ruta** — de todo el trazado, ¿desde dónde miró el sistema?
 *    Esto es lo que hoy no se puede ver, y es lo que explica los casos donde
 *    el camión maneja bien y el número sale bajo.
 *  - **Sobre el tiempo** — dentro de la ventana, ¿cuándo hubo señal y cuándo
 *    no, y dónde cae la hora límite?
 *
 * La ausencia se dibuja rayada, nunca en ámbar: un hueco de señal no es un
 * veredicto ni una consecuencia, es una pregunta sin responder (ley 7).
 */

import {
  huecosDeSenal,
  posicionEnVentana,
  type TramoDeRuta,
} from "@/lib/diagnostico-geometria";
import { duracion, margen, reloj, relojCorto } from "@/lib/formato-tiempo";

// ---------------------------------------------------------------------------
// Riel sobre la ruta
// ---------------------------------------------------------------------------

export function RielDeRuta({
  tramo,
  toleranciaOrigen,
}: {
  tramo: TramoDeRuta;
  /** Fracción de arranque de ruta que el contrato tolera perder (0–1). */
  toleranciaOrigen: number | null;
}) {
  const pctFuera = tramo.fraccionInicio * 100;
  const pctTolerancia = toleranciaOrigen == null ? null : toleranciaOrigen * 100;
  const excede = pctTolerancia != null && pctFuera > pctTolerancia + 1e-9;

  return (
    <div>
      <svg
        viewBox="0 0 1000 78"
        className="block w-full"
        role="img"
        aria-label={`De ${tramo.kmTotales.toFixed(1)} kilómetros de ruta, el sistema observó desde el ${pctFuera.toFixed(1)}% en adelante`}
      >
        <defs>
          <pattern
            id="riel-rayado"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--tenue)" strokeWidth="1.4" />
          </pattern>
        </defs>

        {/* La ruta entera */}
        <rect x="0" y="26" width="1000" height="22" fill="var(--acero)" fillOpacity="0.14" />
        {/* Lo que sí se observó */}
        <rect
          x={tramo.fraccionInicio * 1000}
          y="26"
          width={(1 - tramo.fraccionInicio) * 1000}
          height="22"
          fill="var(--acero)"
          fillOpacity="0.34"
        />
        {/* Lo que quedó fuera */}
        {tramo.fraccionInicio > 0 && (
          <>
            <rect
              x="0"
              y="26"
              width={tramo.fraccionInicio * 1000}
              height="22"
              fill="url(#riel-rayado)"
              fillOpacity="0.4"
            />
            <line
              x1={tramo.fraccionInicio * 1000}
              y1="18"
              x2={tramo.fraccionInicio * 1000}
              y2="56"
              stroke="var(--acero)"
              strokeWidth="1.6"
            />
          </>
        )}

        {/* El umbral del contrato: cuánto arranque se tolera perder */}
        {pctTolerancia != null && (
          <g>
            <line
              x1={pctTolerancia * 10}
              y1="20"
              x2={pctTolerancia * 10}
              y2="54"
              stroke="var(--azul)"
              strokeWidth="1.4"
              strokeDasharray="3 3"
            />
            <text
              x={pctTolerancia * 10 + 6}
              y="68"
              fontFamily="var(--fuente-mono)"
              fontSize="11"
              fill="var(--azul)"
            >
              tolerado {pctTolerancia.toFixed(1)}%
            </text>
          </g>
        )}

        <g fontFamily="var(--fuente-mono)" fontSize="11" fill="var(--tenue)">
          <text x="0" y="18">origen · 0 km</text>
          <text x="1000" y="18" textAnchor="end">
            destino · {tramo.kmTotales.toFixed(1)} km
          </text>
          {tramo.fraccionInicio > 0 && (
            <text
              x={Math.min(tramo.fraccionInicio * 1000 + 6, 860)}
              y="18"
              fill="var(--acero)"
            >
              aquí empezó la observación
            </text>
          )}
        </g>
      </svg>

      <p className="mt-2 font-[family-name:var(--fuente-mono)] text-[13px] text-[var(--texto)]">
        {tramo.fraccionInicio <= 0 ? (
          <>
            El sistema observó la ruta desde el origen · {tramo.kmTotales.toFixed(1)} km completos.
          </>
        ) : (
          <>
            <span className="text-[var(--tenue)]">Sin observar:</span>{" "}
            {tramo.kmFuera.toFixed(1)} km de {tramo.kmTotales.toFixed(1)} km ·{" "}
            {pctFuera.toFixed(1)}% inicial
            {pctTolerancia != null && (
              <>
                {" "}
                <span className="text-[var(--tenue)]">·</span> el contrato tolera hasta{" "}
                {pctTolerancia.toFixed(1)}%{" "}
                <span className="text-[var(--tenue)]">
                  {excede ? "— lo excede" : "— dentro de lo tolerado"}
                </span>
              </>
            )}
          </>
        )}
      </p>
      {/* La advertencia solo donde aplica: colgarla también cuando se observó
          la ruta entera declara un límite que este servicio no tiene. */}
      {tramo.fraccionInicio > 0 && (
        <p className="mt-1 max-w-3xl text-[12px] text-[var(--tenue)]">
          Lo que este riel dice: sobre qué parte del trazado hubo evidencia. Lo que no
          responde: si el tramo sin observar se recorrió o no — desde aquí, un arranque
          que la ventana no alcanzó y un arranque que nunca ocurrió se ven idénticos.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Riel sobre el tiempo
// ---------------------------------------------------------------------------

export function RielDeVentana({
  ventana,
  deadline,
  toleranciaMinutos,
  instantes,
  llegada,
  huecoMinimoMinutos,
  candidata,
}: {
  ventana: { desde: Date; hasta: Date };
  deadline: Date;
  toleranciaMinutos: number;
  /** Instantes de los puntos GPS de la candidata decisiva, en ms. */
  instantes: readonly number[];
  llegada: Date | null;
  /** A partir de cuántos minutos sin señal se dibuja hueco. Del contrato. */
  huecoMinimoMinutos: number;
  /** De quién es la señal que se está dibujando. */
  candidata: string | null;
}) {
  const v = { desdeMs: ventana.desde.getTime(), hastaMs: ventana.hasta.getTime() };
  const largoMin = (v.hastaMs - v.desdeMs) / 60_000;
  const x = (ms: number) => posicionEnVentana(ms, v) * 1000;

  /*
   * Los silencios se miden hasta la llegada, no hasta que cierra la ventana.
   *
   * La evidencia se corta en la geocerca (ley 4), así que después de llegar no
   * hay puntos POR DISEÑO. Medir hasta el cierre convertiría ese corte en un
   * hueco de señal inventado — y en un servicio que llegó temprano sería el
   * hueco más grande de la pantalla, señalando una falla de GPS que no existe.
   */
  const finDeObservacionMs = llegada
    ? Math.min(llegada.getTime(), v.hastaMs)
    : v.hastaMs;
  const observado = { desdeMs: v.desdeMs, hastaMs: finDeObservacionMs };
  const huecos = huecosDeSenal(instantes, observado, huecoMinimoMinutos);
  const primero = instantes.length > 0 ? Math.min(...instantes) : null;
  const ultimo = instantes.length > 0 ? Math.max(...instantes) : null;

  const tolMs = toleranciaMinutos * 60_000;
  const bandaDesde = x(deadline.getTime() - tolMs);
  const bandaHasta = x(deadline.getTime() + tolMs);

  return (
    <div>
      <svg
        viewBox="0 0 1000 92"
        className="block w-full"
        role="img"
        aria-label={`Ventana de observación de ${duracion(largoMin)}, con ${huecos.length} huecos de señal`}
      >
        <defs>
          <pattern
            id="riel-hueco"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--tenue)" strokeWidth="1.4" />
          </pattern>
        </defs>

        {/* La ventana: lo que el motor tuvo permiso de mirar */}
        <rect x="0" y="30" width="1000" height="24" fill="var(--acero)" fillOpacity="0.3" />

        {/* Los silencios */}
        {huecos.map((h) => (
          <rect
            key={h.desdeMs}
            x={x(h.desdeMs)}
            y="30"
            width={Math.max(x(h.hastaMs) - x(h.desdeMs), 1)}
            height="24"
            fill="url(#riel-hueco)"
            fillOpacity="0.55"
          />
        ))}

        {/* Hora límite con su tolerancia */}
        <rect
          x={bandaDesde}
          y="24"
          width={Math.max(bandaHasta - bandaDesde, 1)}
          height="36"
          fill="var(--azul)"
          fillOpacity="0.12"
        />
        <line
          x1={x(deadline.getTime())}
          y1="20"
          x2={x(deadline.getTime())}
          y2="64"
          stroke="var(--azul)"
          strokeWidth="1.6"
        />
        <text
          x={Math.min(x(deadline.getTime()) + 6, 830)}
          y="16"
          fontFamily="var(--fuente-mono)"
          fontSize="11"
          fill="var(--azul)"
        >
          hora límite {relojCorto(deadline)} ± {duracion(toleranciaMinutos)}
        </text>

        {/* Primer y último punto observados */}
        {primero != null && (
          <>
            <circle cx={x(primero)} cy="42" r="4" fill="var(--acero)" />
            <text
              x={x(primero)}
              y="78"
              fontFamily="var(--fuente-mono)"
              fontSize="11"
              fill="var(--acero)"
              textAnchor={x(primero) > 850 ? "end" : "start"}
            >
              1er punto {relojCorto(new Date(primero))}
            </text>
          </>
        )}
        {ultimo != null && ultimo !== primero && (
          <circle cx={x(ultimo)} cy="42" r="4" fill="none" stroke="var(--acero)" strokeWidth="1.6" />
        )}

        {/* La llegada: donde se corta la evidencia. Lo de después no es
            silencio, es frontera — y por eso no se raya. */}
        {llegada && finDeObservacionMs < v.hastaMs && (
          <>
            <rect
              x={x(finDeObservacionMs)}
              y="30"
              width={Math.max(1000 - x(finDeObservacionMs), 1)}
              height="24"
              fill="var(--fondo)"
              fillOpacity="0.75"
            />
            <text
              x={Math.min(x(finDeObservacionMs) + 6, 700)}
              y="47"
              fontFamily="var(--fuente-mono)"
              fontSize="10.5"
              fill="var(--tenue)"
            >
              la evidencia se corta en la llegada
            </text>
          </>
        )}
        {llegada && (
          <line
            x1={x(llegada.getTime())}
            y1="22"
            x2={x(llegada.getTime())}
            y2="62"
            stroke="var(--acero)"
            strokeWidth="1.6"
          />
        )}

        <g fontFamily="var(--fuente-mono)" fontSize="11" fill="var(--tenue)">
          <text x="0" y="16">abre {relojCorto(ventana.desde)}</text>
          <text x="1000" y="16" textAnchor="end">
            cierra {relojCorto(ventana.hasta)}
          </text>
          <text x="1000" y="78" textAnchor="end">
            {duracion(largoMin)} de ventana
          </text>
        </g>
      </svg>

      <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
        <Dato etiqueta="Ventana">
          {reloj(ventana.desde)} → {reloj(ventana.hasta)} · {duracion(largoMin)}
        </Dato>
        <Dato etiqueta="Primer punto">
          {primero == null
            ? "ninguno en la ventana"
            : `${reloj(new Date(primero))} · ${duracion((primero - v.desdeMs) / 60_000)} después de abrir`}
        </Dato>
        <Dato etiqueta="Hora límite">
          {reloj(deadline)} · tolerancia {duracion(toleranciaMinutos)}
        </Dato>
        <Dato etiqueta="Llegada observada">
          {llegada ? `${reloj(llegada)} · ${margen(llegada, deadline)}` : "no se registró llegada"}
        </Dato>
        <Dato etiqueta="Puntos de esta candidata">{instantes.length}</Dato>
        <Dato etiqueta="Silencios de esta candidata">
          {huecos.length === 0
            ? `ninguno mayor a ${duracion(huecoMinimoMinutos)}`
            : `${huecos.length} · el mayor de ${duracion(Math.max(...huecos.map((h) => h.minutos)))}`}
          {llegada && finDeObservacionMs < v.hastaMs && (
            <span className="text-[var(--tenue)]"> · medidos hasta la llegada</span>
          )}
        </Dato>
      </dl>

      {/*
        Dos números que suenan al mismo se miden distinto, y confundirlos manda
        a buscar un bug que no existe: este riel es de UNA candidata sobre la
        ventana de evidencia; la cobertura sellada es de la mejor candidata
        sobre la ventana de contención, que es otro tramo de tiempo.
      */}
      <p className="mt-3 max-w-3xl text-[12px] text-[var(--tenue)]">
        Este riel dibuja la señal de{" "}
        {candidata ? (
          <span className="font-[family-name:var(--fuente-mono)]">{candidata}</span>
        ) : (
          "la candidata decisiva"
        )}{" "}
        dentro de la ventana de evidencia. No es la misma cuenta que la cobertura de
        arriba: esa la midió el motor sobre la ventana de contención y con la candidata
        de mejor señal, que puede ser otra. Cuando los dos números no coincidan, es por
        eso.
      </p>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--linea)] py-1">
      <dt className="text-[var(--tenue)]">{etiqueta}</dt>
      <dd className="ml-auto font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--texto)]">
        {children}
      </dd>
    </div>
  );
}
