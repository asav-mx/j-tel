import { formatearDuracion, type Cobertura } from "@jtel/services";

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

/** El riel izquierdo de un caso pendiente: la cifra que resume el hueco. */
export function rielPendiente(hueco: { minutos: number } | null): {
  cifra: string;
  sub: string;
  color: string;
} {
  return {
    cifra: hueco ? formatearDuracion(hueco.minutos) : "—",
    sub: "El silencio más largo",
    color: "var(--ambar)",
  };
}

export function AfirmacionPendiente({
  hueco,
  tz,
}: {
  hueco: { desdeEn: string; hastaEn: string } | null;
  tz: string;
}) {
  return (
    <>
      No hubo suficiente señal para emitir un resultado. La ventana quedó a oscuras
      {hueco ? (
        <>
          {" "}
          de{" "}
          <em className="text-[var(--ambar)] not-italic">
            {soloHora(hueco.desdeEn, tz)} a {soloHora(hueco.hastaEn, tz)}
          </em>
        </>
      ) : null}
      .
    </>
  );
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

export function NotaHonestaPendiente() {
  return (
    <p className="mb-3 max-w-[58ch] border-l-2 border-[var(--azul)] py-0.5 pl-3.5 text-[14.5px]">
      No cuenta como incumplimiento — el sistema no vio la unidad y no afirma lo que no midió.
      Tampoco cuenta como cumplido.
      <span className="mt-1 block font-mono text-[12.5px] text-[var(--tenue)]">
        Si el archivo recupera los puntos, procede verificar de nuevo
      </span>
    </p>
  );
}
