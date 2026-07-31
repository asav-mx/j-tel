import type { LecturaDeUmbral } from "@/lib/contrato-lectura";
import { ETIQUETA_DECIDE, type Perilla } from "@/lib/perillas-contrato";

/**
 * Una perilla del contrato: el campo, lo que hace, y su consecuencia.
 *
 * La regla de esta pantalla es que ningún número aparezca solo. Un campo que
 * dice "Umbral match KML — métrica A (%)" con un 60 adentro no configura nada:
 * obliga al usuario a adivinar, y de las adivinanzas salen los veredictos
 * falsos. Aquí cada campo trae qué hace, hacia dónde mueve el resultado, y —
 * cuando hay hechos suficientes— dónde vive su operación real respecto a él.
 *
 * Colores: nada de esto es un veredicto. La medición va en acero y los avisos
 * del sistema en azul; verde, ámbar y rojo no entran a un formulario.
 */

const mono = "font-[family-name:var(--fuente-mono)]";

export function PerillaCampo({
  perilla,
  lectura,
  children,
}: {
  perilla: Perilla;
  /** Dónde vive la operación real respecto a este umbral, si se pudo medir. */
  lectura?: LecturaDeUmbral | null;
  /** El control de entrada. Lo arma la página: aquí no vive lógica de forma. */
  children: React.ReactNode;
}) {
  const decide = ETIQUETA_DECIDE[perilla.decide];
  const tieneDireccion = Boolean(perilla.siLaSubes && perilla.siLaBajas);

  return (
    <div className="border-t border-[var(--linea)] py-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium text-[var(--texto)]">{perilla.nombre}</h3>
        <span
          className={`rounded-[2px] border px-2 pt-[3px] pb-[2px] text-[9.5px] font-medium tracking-[.12em] uppercase ${mono} ${
            perilla.decide === "arbitro"
              ? "border-[var(--acero)]/60 text-[var(--acero)]"
              : "border-white/15 text-[var(--tenue)]"
          }`}
          title={decide.explica}
        >
          {decide.texto}
        </span>
      </div>

      <p className="mt-1.5 max-w-[68ch] text-[13.5px] text-[var(--tenue)]">{perilla.queHace}</p>

      <div className="mt-3 max-w-2xl">{children}</div>

      <p className={`mt-2 text-[11px] text-[var(--tenue)] ${mono}`}>
        Si nadie la toca: {perilla.porDefecto}
        {perilla.opcional ? " · se puede dejar sin configurar" : ""}
      </p>

      {tieneDireccion ? (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
          <div>
            <dt className={`text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
              Si la subes
            </dt>
            <dd className="mt-0.5 text-[var(--tenue)]">{perilla.siLaSubes}</dd>
          </div>
          <div>
            <dt className={`text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
              Si la bajas
            </dt>
            <dd className="mt-0.5 text-[var(--tenue)]">{perilla.siLaBajas}</dd>
          </div>
        </dl>
      ) : null}

      {perilla.riesgo ? (
        <p className="mt-3 max-w-[70ch] border-l-2 border-[var(--azul)] py-0.5 pl-3 text-[12.5px] text-[var(--tenue)]">
          <span className="text-[var(--azul)]">Cuidado con esta.</span> {perilla.riesgo}
        </p>
      ) : null}

      {lectura ? <LecturaDeOperacion lectura={lectura} /> : null}
    </div>
  );
}

/**
 * Dónde vive la operación real respecto al umbral que se está configurando.
 *
 * Es la mitad que convierte un formulario en un instrumento: el usuario no
 * tiene que imaginar si 60% es mucho o poco, lo ve contra sus propios números.
 */
function LecturaDeOperacion({ lectura }: { lectura: LecturaDeUmbral }) {
  const { distribucion: d, umbral, margenMediana, alFilo, debajo, holgura } = lectura;

  const pos = (v: number) => {
    const lo = Math.min(d.minimo, umbral) - 4;
    const hi = Math.max(d.maximo, umbral) + 4;
    return ((v - lo) / Math.max(1, hi - lo)) * 100;
  };

  const frase =
    holgura === "amplia"
      ? `Tu operación vive ${Math.abs(margenMediana).toFixed(1)} puntos arriba del umbral — margen amplio.`
      : holgura === "justa"
        ? alFilo === 1
          ? "El rango real toca el umbral: 1 servicio quedó a menos de 2 puntos o debajo."
          : `El rango real toca el umbral: ${alFilo} servicios quedaron a menos de 2 puntos o debajo.`
        : `La mediana de tu operación está ${Math.abs(margenMediana).toFixed(1)} puntos DEBAJO del umbral. Este número no describe esta operación.`;

  return (
    <div className="mt-4 border border-[var(--linea)] bg-black/20 px-4 pt-3 pb-3.5">
      <div className={`mb-3 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
        Tu operación medida
      </div>

      <div className="relative h-8">
        <span className="absolute top-4 right-0 left-0 h-[3px] rounded-sm bg-white/[.07]" />
        <span
          className="absolute top-[13px] h-[7px] rounded-sm bg-[var(--acero)]/30"
          style={{ left: `${pos(d.minimo)}%`, width: `${pos(d.maximo) - pos(d.minimo)}%` }}
        />
        <span
          className="absolute top-[9px] h-[15px] w-[2px] bg-[var(--acero)]"
          style={{ left: `${pos(d.mediana)}%` }}
        />
        <span
          className={`absolute top-[6px] text-[9.5px] ${mono} -translate-x-1/2 text-[var(--acero)]`}
          style={{ left: `${pos(d.mediana)}%`, top: 24 }}
        >
          mediana {d.mediana.toFixed(1)}%
        </span>
        {/* El umbral es un aviso del sistema, no un veredicto: va en azul. */}
        <span
          className="absolute top-[2px] bottom-[10px] w-[2px] bg-[var(--azul)]"
          style={{ left: `${pos(umbral)}%` }}
        />
        <span
          className={`absolute -top-[2px] text-[9.5px] ${mono} -translate-x-1/2 text-[var(--azul)]`}
          style={{ left: `${pos(umbral)}%` }}
        >
          umbral {umbral.toFixed(1)}%
        </span>
      </div>

      <div
        className={`mt-3 flex flex-wrap justify-between gap-3 border-t border-white/[.05] pt-2.5 text-[11.5px] ${mono} text-[var(--tenue)]`}
      >
        <span className={holgura === "amplia" ? "text-[var(--tenue)]" : "text-[var(--texto)]"}>
          {frase}
        </span>
        <span>
          rango {d.minimo.toFixed(1)}% – {d.maximo.toFixed(1)}% · {d.n} servicios
          {debajo > 0 ? ` · ${debajo} debajo` : ""}
        </span>
      </div>
    </div>
  );
}
