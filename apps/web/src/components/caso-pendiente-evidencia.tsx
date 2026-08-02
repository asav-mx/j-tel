import { formatearDuracion, type Cobertura } from "@jtel/services";
import type { CausaPendiente } from "@/lib/causa-pendiente";

/**
 * Piezas visuales del caso "pendiente por evidencia" — compartidas entre
 * Cierre del turno y la bandeja de Pendiente por evidencia, para que las dos
 * pantallas hablen exactamente el mismo idioma y no diverjan con el tiempo.
 *
 * Cada pieza es deliberadamente chica: lo que difiere entre las dos pantallas
 * (el contexto del "sujeto", el texto cuando no hay cobertura, las acciones)
 * se queda en cada vista. Lo que es idéntico vive aquí una sola vez.
 */

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function soloHora(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * El riel izquierdo: la cifra que resume por qué este servicio quedó sin juzgar.
 *
 * **La cifra sigue a la causa.** Encabezaba siempre con el silencio más largo,
 * y eso desorienta en los tres casos de cada cuatro que no fallan por huecos:
 * un "8 s" gigante junto a un servicio con 100% de cobertura hace pensar que
 * ocho segundos tumbaron el resultado.
 */
export function rielPendiente(caso: {
  causa: CausaPendiente;
  cobertura: Cobertura;
  hueco: { minutos: number } | null;
  fraccionObservada: number | null;
  puntos: number;
}): { cifra: string; sub: string } {
  switch (caso.causa) {
    case "sin_evidencia":
      return { cifra: "0", sub: "Puntos recibidos" };
    case "cobertura_insuficiente":
      return {
        cifra: caso.cobertura.disponible ? pct(caso.cobertura.pct) : "—",
        sub: "Señal de la ventana",
      };
    case "observacion_insuficiente":
      return {
        cifra:
          caso.fraccionObservada != null
            ? `${((1 - caso.fraccionObservada) * 100).toFixed(1)}%`
            : "—",
        sub: "De la ruta se alcanzó a ver",
      };
    case "llegada_sin_atribucion":
      /*
       * Sin cifra, a propósito. La que explicaría este caso —cuánto del
       * trazado recorrió la unidad que llegó— no se persiste: el motor solo
       * guarda `observedRouteMatchPct` cuando acreditó el servicio. El conteo
       * de puntos sí existe, pero un "5566" gigante es un número correcto que
       * no dice nada de por qué no se pudo atribuir.
       */
      return { cifra: "—", sub: "Sin ruta atribuible" };
    default:
      return {
        cifra: caso.hueco ? formatearDuracion(caso.hueco.minutos) : "—",
        sub: "El silencio más largo",
      };
  }
}

/**
 * Lo que dejó a este servicio sin resultado, dicho como el motor lo registró.
 *
 * Antes decía siempre "No hubo suficiente señal... la ventana quedó a oscuras",
 * para las cuatro causas. En 39 de 54 casos de una planta real la cobertura
 * había pasado el umbral con holgura: la frase acusaba de perder señal a quien
 * no la perdió. El motor guarda la causa en el ledger; aquí solo se transcribe.
 *
 * Ninguna de las cuatro reparte culpa: describen qué no se pudo observar, no de
 * quién fue.
 */
export function AfirmacionPendiente({
  causa,
  hueco,
  fraccionObservada,
  tz,
}: {
  causa: CausaPendiente;
  hueco: { desdeEn: string; hastaEn: string } | null;
  fraccionObservada: number | null;
  tz: string;
}) {
  switch (causa) {
    case "sin_evidencia":
      return <>No llegó un solo punto de telemetría en toda la ventana del servicio.</>;

    case "cobertura_insuficiente":
      return (
        <>
          La señal no alcanzó el mínimo que el contrato pide para emitir un resultado
          {hueco ? (
            <>
              . El silencio más largo fue de{" "}
              <em className="text-[var(--ambar)] not-italic">
                {soloHora(hueco.desdeEn, tz)} a {soloHora(hueco.hastaEn, tz)}
              </em>
            </>
          ) : null}
          .
        </>
      );

    case "observacion_insuficiente":
      return (
        <>
          La ventana de observación no alcanzó a cubrir el arranque de la ruta
          {fraccionObservada != null ? (
            <>
              : el primer punto útil apareció ya entrado{" "}
              <em className="text-[var(--ambar)] not-italic">
                {(fraccionObservada * 100).toFixed(1)}%
              </em>{" "}
              del trazado
            </>
          ) : null}
          . No se juzga un recorrido que no se vio empezar.
        </>
      );

    case "llegada_sin_atribucion":
      return (
        <>
          Una unidad llegó a la geocerca, pero su recorrido no alcanza el mínimo de ninguna ruta
          contratada — no hay a qué servicio acreditárselo.
        </>
      );

    default:
      return (
        <>
          El árbitro no pudo emitir un resultado, y el registro de esta verificación no conserva la
          causa.
        </>
      );
  }
}

/** La medida de cobertura, o el texto honesto de por qué no hay una. */
export function MedidaCobertura({
  cobertura,
  textoNoDisponible,
}: {
  cobertura: Cobertura;
  textoNoDisponible: string;
}) {
  if (!cobertura.disponible) {
    return <span>{textoNoDisponible}</span>;
  }
  return (
    <>
      <span>
        Evidencia de la ventana <b className="font-medium text-[var(--acero)]">{pct(cobertura.pct)}</b>
      </span>
      <span>
        mínimo del contrato{" "}
        <b className="font-medium text-[var(--texto)]">{pct(cobertura.minimoPct)}</b>
      </span>
      {cobertura.mayorHuecoMinutos != null ? (
        <span>
          Hueco máximo{" "}
          <b className="font-medium text-[var(--acero)]">
            {formatearDuracion(cobertura.mayorHuecoMinutos)}
          </b>
          {cobertura.huecoMaximoPermitido != null ? (
            <>
              {" · permitido "}
              <b className="font-medium text-[var(--texto)]">
                {formatearDuracion(cobertura.huecoMaximoPermitido)}
              </b>
            </>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

/**
 * La barra de cobertura contra el umbral del contrato.
 *
 * **El reparto de color es todo el punto.** Lo observado va en acero porque es
 * medición; lo que faltó para llegar al mínimo va en ámbar rayado porque esa
 * carencia es la razón del estado; y la línea del umbral va en ámbar porque
 * marca la exigencia del contrato.
 *
 * Pintar la barra completa de ámbar —que es lo que sale solo si uno piensa
 * "esta pantalla es ámbar"— confundiría el dato con el fallo. La cobertura no
 * es un veredicto: es lo que el instrumento alcanzó a ver.
 */
export function BarraCobertura({ cobertura }: { cobertura: Cobertura }) {
  if (!cobertura.disponible) return null;
  const observado = Math.max(0, Math.min(100, cobertura.pct));
  const umbral = Math.max(0, Math.min(100, cobertura.minimoPct));
  const falto = Math.max(0, umbral - observado);

  return (
    <div className="mt-3">
      <div
        className="relative h-[18px] w-full overflow-hidden rounded-[2px] border border-[var(--linea)] bg-[var(--panel2)]"
        role="img"
        aria-label={`Señal observada ${pct(observado)} de un mínimo de ${pct(umbral)} que pide el contrato.`}
      >
        <span
          className="absolute inset-y-0 left-0 bg-[var(--acero)]"
          style={{ width: `${observado}%` }}
        />
        {falto > 0 ? (
          <span
            className="absolute inset-y-0"
            style={{
              left: `${observado}%`,
              width: `${falto}%`,
              /* Rayado, no sólido: es una ausencia, y una ausencia no se pinta llena. */
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--t-ambar) 0 5px, transparent 5px 10px)",
            }}
          />
        ) : null}
        <span
          className="absolute inset-y-0 w-[2px] bg-[var(--ambar)]"
          style={{ left: `calc(${umbral}% - 1px)` }}
        />
      </div>
      <div
        className={`mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] tracking-[.06em] text-[var(--tenue)] uppercase`}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-[7px] w-[14px] rounded-[1px] bg-[var(--acero)]" />
          señal observada {pct(observado)}
        </span>
        {falto > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-[7px] w-[14px] rounded-[1px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, var(--ambar) 0 3px, transparent 3px 6px)",
              }}
            />
            lo que faltó para poder juzgar {pct(falto)}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[2px] bg-[var(--ambar)]" />
          mínimo del contrato {pct(umbral)}
        </span>
      </div>
    </div>
  );
}

/**
 * La ventana del servicio vista en el tiempo, no en total.
 *
 * Es el mismo servicio que describe la barra de arriba, contado de otra forma —
 * y por eso vale la pena: en el porcentaje, señal débil pareja y dos apagones
 * grandes se ven idénticos. Aquí no. Y apuntan a causas distintas: un equipo
 * que reporta mal todo el trayecto no es lo mismo que una unidad que cruzó dos
 * zonas sin cobertura.
 *
 * Los tramos llegan calculados con la misma tolerancia de hueco que usó el
 * motor, así que la tira y el porcentaje nunca se contradicen.
 */
export function TiraVentana({
  tramos,
  desdeEn,
  hastaEn,
  tz,
}: {
  tramos: Array<{ desdePct: number; hastaPct: number; conSenal: boolean }>;
  desdeEn: string | null;
  hastaEn: string | null;
  tz: string;
}) {
  if (tramos.length === 0 || !desdeEn || !hastaEn) return null;

  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[10.5px] tracking-[.12em] text-[var(--tenue)] uppercase">
        La ventana del servicio · dónde hubo señal y dónde no
      </div>
      <div
        className="relative h-[14px] w-full overflow-hidden rounded-[2px] border border-[var(--linea)] bg-[var(--panel2)]"
        role="img"
        aria-label="Tramos de la ventana con señal y sin señal, del inicio de la observación a la hora límite."
      >
        {tramos.map((t, i) => (
          <span
            key={i}
            className="absolute inset-y-0"
            style={{
              left: `${t.desdePct}%`,
              width: `${Math.max(0, t.hastaPct - t.desdePct)}%`,
              ...(t.conSenal
                ? { background: "var(--acero)" }
                : {
                    backgroundImage:
                      "repeating-linear-gradient(90deg, var(--ambar) 0 2px, transparent 2px 6px)",
                  }),
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10.5px] text-[var(--tenue)]">
        <span className="tabular-nums">{soloHora(desdeEn, tz)}</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tracking-[.06em] uppercase">
          <span className="flex items-center gap-1.5">
            <span className="h-[7px] w-[14px] rounded-[1px] bg-[var(--acero)]" />
            con señal
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-[7px] w-[14px] rounded-[1px]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, var(--ambar) 0 2px, transparent 2px 6px)",
              }}
            />
            apagón
          </span>
        </span>
        <span className="tabular-nums">{soloHora(hastaEn, tz)}</span>
      </div>
    </div>
  );
}

/**
 * La última señal recibida y a qué distancia del destino quedó.
 *
 * No dice de quién es la causa —ni del carrier ni del equipo—: dice dónde
 * dejamos de ver. Es un hecho observable, y la ficha es explícita en que esta
 * pantalla no reparte culpa.
 */
export function UltimaSenal({
  ultima,
  tz,
}: {
  ultima: { en: string; distanciaKmAlDestino: number | null } | null;
  tz: string;
}) {
  if (!ultima) return null;
  return (
    <span>
      Última señal <b className="font-medium text-[var(--acero)]">{soloHora(ultima.en, tz)}</b>
      {ultima.distanciaKmAlDestino != null ? (
        <>
          {" · a "}
          <b className="font-medium text-[var(--acero)]">
            {ultima.distanciaKmAlDestino.toFixed(1)} km
          </b>
          {" del destino"}
        </>
      ) : null}
    </span>
  );
}

/**
 * La nota no dice "el sistema no vio la unidad".
 *
 * Lo decía, y en el caso más común de la bandeja —una unidad llegó pero su
 * recorrido no se pudo atribuir a ninguna ruta— es falso: sí se vio una unidad.
 * La nota quedaba contradiciendo a la afirmación que tiene justo encima.
 *
 * Lo que sí vale para las cuatro causas es lo otro: no se afirma lo que no se
 * pudo medir.
 */
export function NotaHonestaPendiente() {
  return (
    <p className="mb-3 max-w-[58ch] border-l-2 border-[var(--azul)] py-0.5 pl-3.5 text-[14.5px]">
      No cuenta como incumplimiento — el sistema no afirma lo que no alcanzó a medir. Tampoco
      cuenta como cumplido.
      <span className="mt-1 block font-mono text-[12.5px] text-[var(--tenue)]">
        Si el archivo recupera los puntos, procede verificar de nuevo
      </span>
    </p>
  );
}
