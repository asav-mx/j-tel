/**
 * Los glifos — la forma carga el estado.
 *
 * Del skill `jtel-diseno`: **el color nunca carga el significado solo.** Un
 * daltónico, una pantalla mala, o el sol de Juárez a las siete de la mañana
 * bastan para que el color desaparezca. La forma sobrevive a todo eso.
 *
 * Por eso cada estado tiene su silueta propia, distinguible en blanco y negro:
 *
 *   · en movimiento  flecha llena, **rotada al rumbo real** — la punta dice a
 *                    dónde va; es información, no adorno
 *   · detenida       círculo lleno — presente, pero sin dirección
 *   · en destino     anillo punteado — está, pero ya no se le mira
 *   · sin transmitir flecha hueca — la silueta de lo que había, vacía
 *
 * ⚠ **`en-destino` todavía no tiene quién lo produzca.** La clasificación de la
 * flota (#411) da EN LÍNEA · SIN SEÑAL · DESCONECTADO · SIN DISPOSITIVO, y deja
 * fuera «en destino» hasta que exista la detección en vivo. El glifo está aquí
 * porque el lenguaje lo define, no porque algo lo use: ningún cuarto puede
 * dibujarlo mientras nada sepa calcularlo.
 */

export type EstadoGlifo = "en-movimiento" | "detenida" | "en-destino" | "sin-transmitir";

/** Cómo se lee cada forma en voz alta, para quien no ve la pantalla. */
const EN_PALABRAS: Record<EstadoGlifo, string> = {
  "en-movimiento": "En movimiento",
  detenida: "Detenida",
  "en-destino": "En destino",
  "sin-transmitir": "Sin transmitir",
};

export function Glifo({
  estado,
  /**
   * El rumbo real en grados, 0 = norte, creciendo al este. Sólo lo usa la
   * flecha llena: girar un círculo no dice nada, y girar la flecha hueca
   * afirmaría un rumbo que ya nadie está observando.
   */
  rumbo = 0,
  tamano = 18,
}: {
  estado: EstadoGlifo;
  rumbo?: number;
  tamano?: number;
}) {
  const vivo = estado === "en-movimiento";

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      role="img"
      aria-label={EN_PALABRAS[estado]}
      /* Lo apagado suelta el color y baja de peso: el ojo tiene que ir solo a
         lo que está vivo, sin buscarlo. */
      style={{
        color: vivo ? "var(--senal)" : "var(--tenue)",
        opacity: estado === "sin-transmitir" || estado === "en-destino" ? 0.6 : 1,
      }}
    >
      {estado === "en-movimiento" && (
        <path
          d="M12 2 L20 21 L12 16.5 L4 21 Z"
          fill="currentColor"
          transform={`rotate(${rumbo} 12 12)`}
        />
      )}

      {estado === "detenida" && <circle cx="12" cy="12" r="7" fill="currentColor" />}

      {estado === "en-destino" && (
        <circle
          cx="12"
          cy="12"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      )}

      {estado === "sin-transmitir" && (
        <path
          d="M12 2 L20 21 L12 16.5 L4 21 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * El latido de «en vivo» — el sistema respirando.
 *
 * Es verde y no cobre a propósito: el verde es del latido, no de un veredicto,
 * y el cobre está reservado para el dato que está vivo. Se mueve porque
 * significa algo; si deja de significarlo, se quita el movimiento, no se cambia
 * de color.
 */
export function Latido({ tamano = 8 }: { tamano?: number }) {
  return (
    <span
      data-latido
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: tamano,
        height: tamano,
        borderRadius: "50%",
        background: "var(--vivo)",
      }}
    />
  );
}
