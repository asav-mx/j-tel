/**
 * Las cuatro medidas del árbitro, cada una con su umbral al lado.
 *
 * Ninguna se pinta de verde, ámbar o rojo. Esos tres colores son del veredicto
 * y de nada más: una medida que pasa o no pasa su umbral no es un veredicto,
 * es una pieza del razonamiento. Que pase o no se lee por POSICIÓN — dónde
 * cae la marca respecto de la raya del umbral — y eso se entiende de un
 * vistazo sin depender del color, que además es lo que hace que la figura
 * siga funcionando impresa o para quien no distingue colores.
 */

import type { Medida } from "@/lib/diagnostico-lectura";

function valorEscrito(m: Medida): string {
  if (m.valor == null) return "—";
  return m.unidad === "pct" ? `${m.valor.toFixed(1)}%` : `${m.valor.toFixed(3)} km`;
}

function umbralEscrito(m: Medida): string {
  if (m.umbral == null) return "sin umbral en la política congelada";
  const cifra = m.unidad === "pct" ? `${m.umbral.toFixed(1)}%` : `${m.umbral.toFixed(3)} km`;
  return m.direccion === "mayor_mejor" ? `umbral ${cifra} mínimo` : `umbral ${cifra} máximo`;
}

function posicion(valor: number, m: Medida): number {
  const { min, max } = m.escala;
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (valor - min) / (max - min)));
}

export function MedidasDelMotor({
  medidas,
  decisiva,
}: {
  medidas: readonly Medida[];
  /** Cómo presentar la candidata de la que salen estas cifras. */
  decisiva: { clave: string; papel: "gano" | "mas_cercana" } | null;
}) {
  return (
    <section>
      <p className="mb-5 text-[13px] text-[var(--tenue)]">
        {decisiva == null ? (
          <>Sin candidata evaluada en el ledger: no hay medición que leer.</>
        ) : decisiva.papel === "gano" ? (
          <>
            Medidas de{" "}
            <span className="font-[family-name:var(--fuente-mono)] text-[var(--texto)]">
              {decisiva.clave}
            </span>
            , la candidata que el motor acreditó.
          </>
        ) : (
          <>
            Ninguna candidata acreditó. Estas son las medidas de{" "}
            <span className="font-[family-name:var(--fuente-mono)] text-[var(--texto)]">
              {decisiva.clave}
            </span>
            , la que quedó más arriba en el orden del motor — la que más se acercó, no
            la que sirvió.
          </>
        )}
      </p>

      <div className="grid gap-px overflow-hidden rounded-sm border border-[var(--linea)] bg-[var(--linea)] sm:grid-cols-2">
        {medidas.map((m) => (
          <FichaDeMedida key={m.clave} medida={m} />
        ))}
      </div>
    </section>
  );
}

function FichaDeMedida({ medida: m }: { medida: Medida }) {
  const xValor = m.valor == null ? null : posicion(m.valor, m) * 100;
  const xUmbral = m.umbral == null ? null : posicion(m.umbral, m) * 100;

  const lectura =
    m.pasa == null
      ? "sin lectura"
      : m.pasa
        ? m.direccion === "mayor_mejor"
          ? "por arriba del umbral"
          : "por dentro del máximo"
        : m.direccion === "mayor_mejor"
          ? "por debajo del umbral"
          : "por encima del máximo";

  return (
    <div className="bg-[var(--panel)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-[family-name:var(--fuente-archivo)] text-[15px] font-semibold text-[var(--texto)]">
          {m.nombre}
        </h3>
        <span
          className="font-[family-name:var(--fuente-mono)] text-[22px] tabular-nums text-[var(--acero)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {valorEscrito(m)}
        </span>
      </div>

      <p className="mt-1 text-[12px] text-[var(--tenue)]">{m.pregunta}</p>

      {/* El riel: la marca contra la raya del umbral. La posición es la lectura. */}
      <div className="relative mt-4 h-9">
        <div className="absolute inset-x-0 top-3 h-[6px] rounded-[1px] bg-[var(--acero)]/12" />
        {xValor != null && (
          <div
            className="absolute top-3 h-[6px] rounded-[1px] bg-[var(--acero)]/45"
            style={{ left: 0, width: `${xValor}%` }}
          />
        )}
        {xUmbral != null && (
          <>
            <div
              className="absolute top-0 h-[22px] w-px bg-[var(--azul)]"
              style={{ left: `${xUmbral}%` }}
            />
            <span
              className="absolute top-[24px] -translate-x-1/2 whitespace-nowrap font-[family-name:var(--fuente-mono)] text-[10.5px] tabular-nums text-[var(--azul)]"
              style={{
                left: `${Math.min(Math.max(xUmbral, 12), 88)}%`,
              }}
            >
              {m.direccion === "mayor_mejor" ? "mín" : "máx"}{" "}
              {m.unidad === "pct" ? `${m.umbral!.toFixed(1)}%` : `${m.umbral!.toFixed(3)} km`}
            </span>
          </>
        )}
        {xValor != null && (
          <div
            className="absolute top-[1px] h-[10px] w-[10px] -translate-x-1/2 rotate-45 border border-[var(--fondo)] bg-[var(--acero)]"
            style={{ left: `${xValor}%` }}
            aria-hidden
          />
        )}
      </div>

      <p className="mt-5 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--texto)]">
        {valorEscrito(m)} · {umbralEscrito(m)} ·{" "}
        <span className="text-[var(--tenue)]">{lectura}</span>
      </p>
      {m.nota && <p className="mt-1 text-[11.5px] text-[var(--tenue)]">{m.nota}</p>}
    </div>
  );
}
