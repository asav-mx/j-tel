import type { EstadoServicio } from "@jtel/services";
import type { HistoriaSello, LecturaVersion, VersionSello } from "@/lib/historia-sello";
import { instanteSellado, margen, duracion } from "@/lib/formato-tiempo";
import { JTTEL_TZ } from "@/lib/local-time";

/**
 * La historia del sello — la marca, y el cajón con las versiones.
 *
 * Un resultado se calcula una vez y se congela. Cuando de verdad se verifica
 * de nuevo, el expediente lo cuenta en vez de esconderlo, y distingue dos
 * cosas que nunca deben verse igual:
 *
 *  - **Alguien lo pidió** → azul, con la causa y la firma. Una decisión se ve.
 *  - **El sistema cuadró solo** → gris, en la misma línea del sello, sin
 *    alarma. Se registra, no se grita: nadie decidió nada.
 *
 * El eje NO es humano contra máquina — es decidió contra mantuvo. Un script
 * que corre un operador a mano es nombre de proceso con intención de decisión,
 * y va en azul. La clasificación llega resuelta desde `historia-sello.ts`;
 * aquí no se deduce nada del nombre del actor.
 *
 * Ninguna versión se borra jamás: la anterior queda tachada pero legible,
 * porque un expediente que sirve de evidencia conserva sus versiones.
 */

const ETIQUETA_ESTADO: Record<string, string> = {
  cumplido: "Cumplido",
  no_cumplido: "No cumplido",
  pendiente_evidencia: "Pendiente por evidencia",
};

const ETIQUETA_TIMING: Record<string, string> = {
  temprano: "temprano",
  a_tiempo: "a tiempo",
  tarde: "tarde",
};

function textoEstado(estado: EstadoServicio, timing: string | null): string {
  const base = ETIQUETA_ESTADO[estado ?? ""] ?? "Sin resultado";
  const t = timing ? ETIQUETA_TIMING[timing] : null;
  return t ? `${base} · ${t}` : base;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Una cifra con su lectura al lado — nunca el número solo.
 *
 * El carrier que se defiende necesita ver por cuánto pasó o falló; esa es la
 * mitad que decide si el árbitro le parece justo.
 */
function Lectura({ l, tz }: { l: LecturaVersion; tz: string }) {
  if (l.tipo === "llegada") {
    const llegada = new Date(l.llegadaIso);
    const limite = new Date(l.limiteIso);
    return (
      <>
        Entró a geocerca{" "}
        <b className="font-medium text-[var(--acero)]">{instanteSellado(llegada, tz)}</b> · límite{" "}
        <b className="font-medium text-[var(--texto)]">{instanteSellado(limite, tz)}</b>
        {l.toleranciaMinutos > 0 ? ` (incluye ${duracion(l.toleranciaMinutos)} de tolerancia)` : ""}{" "}
        · <b className="font-medium text-[var(--texto)]">{margen(llegada, limite)}</b>
      </>
    );
  }
  if (l.tipo === "cobertura") {
    return (
      <>
        Cobertura de ruta <b className="font-medium text-[var(--acero)]">{pct(l.medidoPct)}</b>
        {l.umbralPct != null ? (
          <>
            {" · umbral del contrato "}
            <b className="font-medium text-[var(--texto)]">{pct(l.umbralPct)}</b>
          </>
        ) : null}
      </>
    );
  }
  return <>Retraso excusado por el contrato · {l.motivo}</>;
}

/** El chip de una versión anterior: legible, pero tachado. Ya no gobierna. */
function ChipVersion({ v }: { v: VersionSello }) {
  const texto = textoEstado(v.estado, v.timing);

  if (!v.vigente) {
    return (
      <span className="relative inline-block rounded-sm border-[1.5px] border-current px-2.5 pt-[3px] pb-[2px] font-mono text-[10px] font-medium tracking-[0.13em] text-[var(--tenue)] uppercase opacity-75">
        {texto}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-[6%] left-[6%] h-[1.5px] -rotate-[6deg] bg-[var(--tenue)]"
        />
      </span>
    );
  }

  const color =
    v.estado === "cumplido"
      ? { c: "var(--verde)", b: "rgba(52,199,123,.07)" }
      : v.estado === "no_cumplido"
        ? { c: "var(--rojo)", b: "rgba(229,72,77,.07)" }
        : { c: "var(--ambar)", b: "rgba(227,168,31,.07)" };

  return (
    <span
      className="inline-block rounded-sm border-[1.5px] border-current px-2.5 pt-[3px] pb-[2px] font-mono text-[10px] font-medium tracking-[0.13em] uppercase"
      style={{ color: color.c, background: color.b }}
    >
      {texto}
    </span>
  );
}

function Firma({ v }: { v: VersionSello }) {
  const aPeticion = v.firma.intencion === "decision";
  return (
    <span
      className="inline-block rounded-sm border px-2 py-[2.5px] font-mono text-[10px] tracking-[0.1em] uppercase"
      style={
        aPeticion
          ? { color: "var(--azul)", borderColor: "rgba(76,154,224,.45)" }
          : { color: "var(--tenue)", borderColor: "var(--linea)" }
      }
    >
      {v.firma.texto}
    </span>
  );
}

function Version({ v, tz }: { v: VersionSello; tz: string }) {
  return (
    <li className="relative list-none pb-[22px] pl-[22px]">
      <span
        aria-hidden="true"
        className="absolute top-[5px] -left-[4.5px] h-2 w-2 rounded-full"
        style={{ background: v.vigente ? "var(--azul)" : "var(--tenue)" }}
      />
      <p className="mb-[7px] font-mono text-[11px] text-[var(--tenue)]">
        <b className="font-medium text-[var(--texto)]">
          {v.selladoEnIso ? instanteSellado(new Date(v.selladoEnIso), tz) : "Sello no registrado"}
        </b>{" "}
        · {v.vigente ? "vigente" : "anterior"}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ChipVersion v={v} />
        <Firma v={v} />
      </div>
      {v.lectura.length > 0 || v.sinCambio ? (
        <p className="mt-[7px] max-w-[62ch] text-[13.5px] text-[var(--tenue)]">
          {v.lectura.map((l, i) => (
            <span key={i}>
              {i > 0 ? " · " : ""}
              <Lectura l={l} tz={tz} />
            </span>
          ))}
          {v.sinCambio ? (
            <span>
              {v.lectura.length > 0 ? " · " : ""}
              <b className="font-medium text-[var(--texto)]">El resultado no cambió</b> — mismas
              cifras.
            </span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

/**
 * La marca de sellado, con su cajón cuando hubo versiones.
 *
 * `sinVersiones` es la mayoría abrumadora de los servicios: marca gris
 * punteada con su fecha y nada más. El silencio es el mensaje — si no dice
 * más, es que no hubo más.
 */
export function HistoriaDelSello({
  historia,
  timeZone = JTTEL_TZ,
  conCajon = false,
  abiertoPorDefecto = false,
}: {
  historia: HistoriaSello;
  timeZone?: string;
  /**
   * El cajón de versiones solo se despliega en el expediente. En una bandeja
   * de decenas de filas basta la marca y el punto: abrir la cadena completa en
   * cada renglón convierte la lista en ruido.
   */
  conCajon?: boolean;
  abiertoPorDefecto?: boolean;
}) {
  const vigente = historia.versiones[0];
  if (!vigente) return null;

  const hayVersiones = historia.total > 1;
  const aPeticion = historia.ultimaFirma?.intencion === "decision";
  const selladoTexto = vigente.selladoEnIso
    ? instanteSellado(new Date(vigente.selladoEnIso), timeZone)
    : "sello no registrado";

  return (
    <div>
      <span
        className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-dashed px-[11px] py-1.5 font-mono text-[11px] leading-[1.5]"
        style={
          aPeticion
            ? { color: "var(--azul)", borderColor: "rgba(76,154,224,.5)" }
            : { color: "var(--tenue)", borderColor: "rgba(255,255,255,.20)" }
        }
      >
        <span
          aria-hidden="true"
          className="h-[5px] w-[5px] flex-none rounded-full"
          style={{ background: aPeticion ? "var(--azul)" : "var(--tenue)" }}
        />
        {/*
          Verificado de nuevo solo cuando alguien lo pidió. Una consolidación
          mantiene la voz del sello original y se cuelga de la misma línea —
          el sistema lo dice, pero no lo grita.
        */}
        {aPeticion ? "Verificado de nuevo" : "Verificado y sellado"} · {selladoTexto}
        {hayVersiones && historia.ultimaFirma ? ` · ${historia.ultimaFirma.marca}` : ""}
      </span>

      {hayVersiones && conCajon ? (
        <details className="mt-3.5 border-t border-[var(--linea)]" open={abiertoPorDefecto}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5 py-3 font-mono text-[11.5px] text-[var(--azul)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)] [&::-webkit-details-marker]:hidden">
            {/* El caret gira al abrir — movimiento de continuidad, no adorno.
                Se apaga con prefers-reduced-motion. */}
            <span
              aria-hidden="true"
              className="inline-block text-[11px] transition-transform duration-150 motion-reduce:transition-none [details[open]_&]:rotate-90"
            >
              ▸
            </span>
            Historia del sello · {historia.total} versiones
          </summary>
          <ul className="my-1 mb-2.5 ml-[5px] border-l border-[var(--linea)] p-0">
            {historia.versiones.map((v, i) => (
              <Version key={`${v.selladoEnIso ?? "sin-sello"}-${i}`} v={v} tz={timeZone} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * La miniatura — un punto azul junto al chip, dondequiera que un resultado
 * verificado de nuevo aparezca fuera del expediente.
 *
 * Solo se enciende cuando alguien lo pidió. Una consolidación no merece un
 * punto en una tabla de decenas de filas: se registra, no se señala.
 */
export function PuntoHistoriaSello({
  historia,
  className = "flex-none",
}: {
  historia: HistoriaSello;
  /** Para acomodarlo dentro de una celda densa sin duplicar el componente. */
  className?: string;
}) {
  if (historia.total <= 1 || historia.ultimaFirma?.intencion !== "decision") return null;
  const etiqueta = `Verificado de nuevo · ${historia.total} versiones · ${historia.ultimaFirma.texto}`;
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full bg-[var(--azul)] ${className}`}
      title={etiqueta}
      aria-label={etiqueta}
    />
  );
}
