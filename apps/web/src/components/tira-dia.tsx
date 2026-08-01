import { posicionEnFranja, type ClaseSegmento } from "@/lib/historial-unidad";
import { type ClaseDeFlota } from "@/lib/historial-flota";
import { relojCorto } from "@/lib/formato-tiempo";

/**
 * La tira de una franja, dibujada a escala.
 *
 * Los tres colores de resultado NO aparecen aquí, y es deliberado. Todo lo que
 * la tira dibuja es observación —se movió, no se movió, no se sabe— y el skill
 * es tajante: los estados operativos van en acero y tenue; verde, ámbar y rojo
 * son solo de los resultados.
 *
 * El mockup pintaba "sin señal" en ámbar. No se siguió: ámbar significa
 * "pendiente por evidencia" y pintarlo aquí haría que un hueco a media tarde
 * —que no le importa a nadie— se leyera igual que un servicio que no se pudo
 * afirmar. El hueco se dibuja como lo que es: ausencia. Cuando ese hueco sí
 * tumbó un servicio, el ámbar aparece en el chip del servicio, que es donde
 * corresponde.
 *
 * La misma tira sirve a dos resoluciones: la flota dibuja dos clases
 * (observado / sin dato) porque a cincuenta y nueve renglones el matiz no se
 * lee, y la unidad dibuja las tres. Es un solo componente y no dos parecidos:
 * el dibujo es el mismo, lo que cambia es cuánto puede afirmar la pantalla.
 */

export type ClaseDeTira = ClaseSegmento | ClaseDeFlota;

export type TramoDibujable = {
  clase: ClaseDeTira;
  desde: Date;
  hasta: Date;
};

export type Franja = { desde: Date; hasta: Date };

const RAYADO_HUECO =
  "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(113,128,143,.35) 3px, rgba(113,128,143,.35) 4.5px)";

function estiloDeSegmento(clase: ClaseDeTira): React.CSSProperties {
  if (clase === "en_movimiento" || clase === "observado") return { background: "var(--acero)" };
  if (clase === "detenida") return { background: "rgba(122,156,184,.30)" };
  return { background: RAYADO_HUECO, boxShadow: "inset 0 0 0 1px rgba(113,128,143,.25)" };
}

export const ETIQUETA_CLASE: Record<ClaseDeTira, string> = {
  en_movimiento: "En movimiento",
  detenida: "Detenida",
  observado: "Con dato",
  sin_dato: "Sin dato",
};

/** Las tres clases de la vista de unidad. */
export const CLASES_DE_UNIDAD = ["en_movimiento", "detenida", "sin_dato"] as const;
/** Las dos de la vista de flota. */
export const CLASES_DE_FLOTA = ["observado", "sin_dato"] as const;

/** La leyenda va junto a la tira: una tira sin leyenda es un código de colores. */
export function LeyendaTira({
  clases = CLASES_DE_UNIDAD,
}: {
  clases?: readonly ClaseDeTira[];
}) {
  return (
    <div className="flex flex-wrap gap-4 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
      {clases.map((clase) => (
        <span key={clase} className="flex items-center gap-2">
          <i
            aria-hidden
            className="block h-2.5 w-3.5 rounded-[1px]"
            style={estiloDeSegmento(clase)}
          />
          {ETIQUETA_CLASE[clase]}
        </span>
      ))}
    </div>
  );
}

export type MarcaEnTira = {
  instante: Date;
  /** Qué es la marca. Va al título accesible, no como texto encimado. */
  etiqueta: string;
};

export function TiraDia({
  franja,
  segmentos,
  marcas = [],
  alto = "h-5",
}: {
  franja: Franja;
  segmentos: readonly TramoDibujable[];
  marcas?: MarcaEnTira[];
  alto?: string;
}) {
  return (
    <div className={`relative w-full rounded-[2px] bg-[var(--hover)] ${alto}`}>
      {segmentos.map((s, i) => {
        const izquierda = posicionEnFranja(s.desde, franja.desde, franja.hasta);
        const derecha = posicionEnFranja(s.hasta, franja.desde, franja.hasta);
        return (
          <span
            key={`${s.clase}-${i}`}
            className="absolute top-0 bottom-0 rounded-[1px]"
            style={{
              left: `${izquierda}%`,
              width: `${Math.max(derecha - izquierda, 0.15)}%`,
              ...estiloDeSegmento(s.clase),
            }}
            title={`${ETIQUETA_CLASE[s.clase]} · ${relojCorto(s.desde)} a ${relojCorto(s.hasta)}`}
          />
        );
      })}

      {marcas.map((m, i) => (
        <span
          key={`marca-${i}`}
          className="absolute -top-1 -bottom-1 w-px bg-[var(--linea-fuerte)]"
          style={{ left: `${posicionEnFranja(m.instante, franja.desde, franja.hasta)}%` }}
          title={m.etiqueta}
        />
      ))}
    </div>
  );
}

/** El eje de horas de la franja. Cinco marcas: los extremos y los tercios. */
export function EjeDeFranja({ franja: dia }: { franja: Franja }) {
  const total = dia.hasta.getTime() - dia.desde.getTime();
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    porcentaje: f * 100,
    hora: relojCorto(new Date(dia.desde.getTime() + total * f)),
  }));

  return (
    <div className="relative mb-1.5 h-4 font-[family-name:var(--fuente-mono)] text-[9.5px] tabular-nums text-[var(--tenue)]">
      {marcas.map((m) => (
        <span
          key={m.porcentaje}
          className="absolute -translate-x-1/2"
          style={{
            left: `${m.porcentaje}%`,
            transform:
              m.porcentaje === 0
                ? "none"
                : m.porcentaje === 100
                  ? "translateX(-100%)"
                  : undefined,
          }}
        >
          {m.hora}
        </span>
      ))}
    </div>
  );
}
