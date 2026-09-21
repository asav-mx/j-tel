/**
 * El ritmo prometido — **la referencia, y no es una unidad** (9.2e).
 *
 * ## Por qué no tiene silueta de camión
 *
 * El prototipo v6 la dibujaba con la misma silueta de una unidad, en otro tono.
 * El skill lo prohíbe en una línea —«si dos estados comparten forma y se
 * distinguen sólo por color, está mal»— y la 9.2e lo prohíbe en otra: la
 * referencia **no es una unidad** y ninguna pantalla la cuenta como camión. A
 * un vistazo, con el sol de Juárez de frente, el tono desaparece y quedan dos
 * camiones donde hay uno. Así que tiene forma propia, y la forma dice qué es:
 * **un corchete hueco**, que es como se anota una medición y no como se dibuja
 * un vehículo.
 *
 * ## Por qué es un TRAMO y no un punto
 *
 * Su posición sale del tiempo de vuelta medido entre paradas contiguas. Dentro
 * de un tramo se interpola —entre dos tiempos medidos, lo más fino que la
 * evidencia permite—, pero **no se afirma un punto**: pintar una marca precisa
 * diría que se sabe el metro exacto, y eso es completar lo que falta (1.E). El
 * corchete abarca el tramo entero y el caret dice por dónde va dentro de él.
 */
export function MarcaDeRitmo({
  desdePct,
  hastaPct,
  fraccion,
  entre,
}: {
  desdePct: number;
  hastaPct: number;
  /** Qué parte del tramo lleva, de 0 a 1. */
  fraccion: number;
  /** Los nombres de las dos paradas que lo encierran, para poder decirlo. */
  entre: [string, string];
}) {
  const ancho = Math.max(0.5, hastaPct - desdePct);
  const caret = desdePct + ancho * Math.min(1, Math.max(0, fraccion));
  return (
    <span
      className="pointer-events-none absolute top-0 h-[18px]"
      style={{ left: `${desdePct}%`, width: `${ancho}%` }}
      role="img"
      aria-label={`Ritmo prometido: entre ${entre[0]} y ${entre[1]}`}
    >
      {/* El corchete: dos patas y un travesaño, hueco. Nada que se pueda leer como vehículo. */}
      <span className="absolute inset-x-0 top-2 h-px bg-[var(--tenue)]" />
      <span className="absolute left-0 top-1 h-[9px] w-px bg-[var(--tenue)]" />
      <span className="absolute right-0 top-1 h-[9px] w-px bg-[var(--tenue)]" />
      <svg
        viewBox="0 0 10 8"
        aria-hidden="true"
        className="absolute top-0 h-2 w-2.5 -translate-x-1/2"
        style={{ left: `${((caret - desdePct) / ancho) * 100}%` }}
      >
        <path d="M5 7 L1 1 L9 1 Z" fill="none" stroke="var(--tenue)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** El riel donde vive la referencia: su propio carril, arriba de la vía (9.2e). */
export function RielDelRitmo({ children, vacio }: { children?: React.ReactNode; vacio?: string }) {
  return (
    <>
      <span className="absolute right-0 top-[15px] text-[9px] uppercase tracking-[0.14em] text-[var(--tenue)]">
        Ritmo prometido
      </span>
      <span className="absolute inset-x-0 top-[30px] h-[22px] rounded-md bg-[var(--roce)]" />
      <span className="absolute inset-x-0 top-[32px] block h-[18px]">{children}</span>
      {vacio && (
        <span className="absolute left-0 top-[35px] text-[10px] text-[var(--tenue)]">{vacio}</span>
      )}
    </>
  );
}
