/**
 * Los glifos — la forma carga el estado.
 *
 * Del skill `jtel-diseno`: **el color nunca carga el significado solo.** Un
 * daltónico, una pantalla mala, o el sol de Juárez a las siete de la mañana
 * bastan para que el color desaparezca. La forma sobrevive a todo eso.
 *
 * ## Tres familias de sujetos, que no se cruzan — la del sello, y una de marcas
 *
 * Cada cosa tiene su silueta base, para que ninguna forma de una se confunda
 * con la de otra cuando aparecen juntas —y en el cuarto de Expedientes aparecen
 * juntas—:
 *
 *   UNIDADES — se mueven: flechas y círculos
 *   · en movimiento  flecha llena, **rotada al rumbo real**
 *   · detenida       círculo lleno — presente, sin dirección
 *   · sin señal      círculo hueco — presente pero callada; pide esperar
 *   · en destino     anillo punteado — está, pero ya no se le mira
 *   · sin transmitir flecha hueca — la silueta de lo que había; es DESCONECTADO
 *   · sin dispositivo flecha hueca **punteada** — ni siquiera hubo con qué
 *                    transmitir (decisión 7 del cuarto de Compás, 16 sep 2026)
 *
 *   DISPOSITIVOS — se instalan: cuadros
 *   · en unidad      cuadro lleno — instalado y hablando
 *   · en bodega      cuadro hueco — existe, espera camión
 *   · desconectado   cuadro cortado — montado, y más de 24 h callado
 *   · de baja        cuadro tachado — su historia queda, él ya no cuenta
 *
 *   PAPELES — se vencen: hojas con la esquina doblada
 *   · vencido         hoja hueca tachada con una diagonal
 *   · por vencer      hoja a medio llenar, en diagonal
 *   · falta           contorno punteado
 *   · falta la fecha  hoja hueca de trazo continuo
 *   · falta la regla  hoja hueca con el doblez lleno, en tenue
 *   · vigente         hoja llena, en tenue
 *   · sin vencimiento hoja llena con una raya hueca, en tenue
 *
 *   SELLOS — el veredicto de un hecho: hexágonos (Vernier V1, 18 sep 2026)
 *   · cumplido          hexágono lleno, en `--sello-ok`
 *   · pendiente         hexágono de contorno punteado, en tinta
 *   · no cumplido       hexágono hueco tachado con una diagonal, en `--ladrillo`
 *   La forma carga el estado; el color acompaña. `--sello-ok` y `--ladrillo`
 *   son exclusivos de esta familia. El timing (temprano, a tiempo, tarde) NO
 *   lleva glifo: el hexágono es del veredicto, y el timing va en palabras.
 *
 *   MARCAS DE LA TRAZA — no son sujetos: «aquí la medición se interrumpe»
 *   · hueco          círculo hueco — nadie midió (la misma forma que SIN SEÑAL)
 *   · salto          rombo hueco — se midió, pero los dos puntos se contradicen
 *
 * Cuadros ratificados en el boceto de «las dos familias»; hojas el 16 de
 * septiembre de 2026 (boceto y prototipo del PR D); SIN SEÑAL el mismo día.
 *
 * `en-destino` lo produce la detección en vivo de Flota en vivo (C2): servicio
 * especial vigente y última posición dentro de un destino (Marco 7.7).
 */

export type EstadoGlifo =
  // Unidades
  | "en-movimiento"
  | "detenida"
  | "sin-senal"
  | "en-destino"
  | "sin-transmitir"
  | "sin-dispositivo"
  // Dispositivos
  | "dispositivo-en-unidad"
  | "dispositivo-en-bodega"
  | "dispositivo-desconectado"
  | "dispositivo-de-baja"
  // Papeles
  | "papel-vencido"
  | "papel-por-vencer"
  | "papel-falta"
  | "papel-falta-la-fecha"
  | "papel-falta-la-regla"
  | "papel-vigente"
  | "papel-sin-vencimiento"
  // Sellos: el veredicto de un hecho
  | "sello-cumplido"
  | "sello-pendiente"
  | "sello-no-cumplido"
  // Marcas de la traza (no son sujetos)
  | "salto";

/** Cómo se lee cada forma en voz alta, para quien no ve la pantalla. */
const EN_PALABRAS: Record<EstadoGlifo, string> = {
  "en-movimiento": "En movimiento",
  detenida: "Detenida",
  "sin-senal": "Sin señal",
  "en-destino": "En destino",
  "sin-transmitir": "Sin transmitir",
  "sin-dispositivo": "Sin dispositivo",
  "dispositivo-en-unidad": "En unidad",
  "dispositivo-en-bodega": "En bodega",
  "dispositivo-desconectado": "Desconectado",
  "dispositivo-de-baja": "De baja",
  "papel-vencido": "Vencido",
  "papel-por-vencer": "Por vencer",
  "papel-falta": "Falta",
  "papel-falta-la-fecha": "Falta la fecha",
  "papel-falta-la-regla": "Falta la regla",
  "papel-vigente": "Vigente",
  "papel-sin-vencimiento": "Sin vencimiento",
  "sello-cumplido": "Cumplido",
  "sello-pendiente": "Pendiente de evidencia",
  "sello-no-cumplido": "No cumplido",
  salto: "Salto del GPS",
};

/**
 * El color de cada forma, que nunca es lo único que la distingue.
 *
 * - **Cobre** sólo donde hay vida: la unidad que se mueve, el dispositivo que
 *   habla.
 * - **Tinta** en los papeles que piden hacer algo: el ojo tiene que ir ahí.
 * - **Tenue** en todo lo demás, y a 60 % lo que ya se apagó.
 * - **Los sellos** con sus colores exclusivos: `--sello-ok` el cumplido,
 *   `--ladrillo` el no cumplido, tinta el pendiente. Ninguno es cobre: nada
 *   sellado está vivo.
 */
function tintaDe(estado: EstadoGlifo): { color: string; opacidad: number } {
  switch (estado) {
    case "sello-cumplido":
      return { color: "var(--sello-ok)", opacidad: 1 };
    case "sello-pendiente":
      return { color: "var(--tinta)", opacidad: 1 };
    case "sello-no-cumplido":
      return { color: "var(--ladrillo)", opacidad: 1 };
    case "en-movimiento":
    case "dispositivo-en-unidad":
      return { color: "var(--senal)", opacidad: 1 };
    case "papel-vencido":
    case "papel-por-vencer":
    case "papel-falta":
    case "papel-falta-la-fecha":
      return { color: "var(--tinta)", opacidad: 1 };
    case "sin-transmitir":
    case "sin-dispositivo":
    case "dispositivo-desconectado":
    case "dispositivo-de-baja":
      return { color: "var(--tenue)", opacidad: 0.6 };
    default:
      return { color: "var(--tenue)", opacidad: 1 };
  }
}

/** La hoja, en una caja de 40: vertical, con la esquina superior derecha doblada. */
const HOJA = "M13 6 H24 L31 13 V32 A2 2 0 0 1 29 34 H13 A2 2 0 0 1 11 32 V8 A2 2 0 0 1 13 6 Z";
const DOBLEZ = "M24 6 V13 H31";
/** El hexágono del sello, en una caja de 24, con los lados de arriba y abajo planos. */
const HEXAGONO = "20.5,12 16.25,19.36 7.75,19.36 3.5,12 7.75,4.64 16.25,4.64";

export function Glifo({
  estado,
  /**
   * El rumbo real en grados, 0 = norte, creciendo al este. Sólo lo usa la
   * flecha llena: girar un círculo no dice nada, y girar la flecha hueca
   * afirmaría un rumbo que ya nadie está observando.
   */
  rumbo = 0,
  tamano = 18,
  tinta,
}: {
  estado: EstadoGlifo;
  rumbo?: number;
  tamano?: number;
  /**
   * La tinta, cuando el color no lo pone el estado sino el tiempo: el marcador
   * del playback va en `tinta` porque es recuerdo, y sólo al alcanzar el ahora
   * pasa a `senal` (ficha C3, decisión 6). La forma sigue siendo del estado.
   */
  tinta?: "tinta" | "senal";
}) {
  const propia = tintaDe(estado);
  const { color, opacidad } = tinta ? { color: `var(--${tinta})`, opacidad: 1 } : propia;
  const familia = estado.startsWith("papel-") || estado.startsWith("dispositivo-") ? 40 : 24;
  // Un id por instancia para el recorte de «por vencer»: dos glifos en la misma
  // página con el mismo id se pisarían el recorte.
  const recorte = `hoja-${estado}-${Math.round(rumbo)}-${tamano}`;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox={`0 0 ${familia} ${familia}`}
      role="img"
      aria-label={EN_PALABRAS[estado]}
      style={{ color, opacity: opacidad }}
    >
      {/* ── Unidades ── */}
      {estado === "en-movimiento" && (
        <path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="currentColor" transform={`rotate(${rumbo} 12 12)`} />
      )}
      {estado === "detenida" && <circle cx="12" cy="12" r="7" fill="currentColor" />}
      {estado === "sin-senal" && (
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
      {estado === "en-destino" && (
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      )}
      {(estado === "sin-transmitir" || estado === "sin-dispositivo") && (
        <path
          d="M12 2 L20 21 L12 16.5 L4 21 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeDasharray={estado === "sin-dispositivo" ? "2 2" : undefined}
        />
      )}

      {/* ── Sellos (Vernier V1, 18 sep 2026) ── */}
      {estado === "sello-cumplido" && <polygon points={HEXAGONO} fill="currentColor" />}
      {estado === "sello-pendiente" && (
        <polygon
          points={HEXAGONO}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3.2 2.6"
          strokeLinejoin="round"
        />
      )}
      {estado === "sello-no-cumplido" && (
        <>
          <polygon points={HEXAGONO} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <line x1="5.8" y1="18.4" x2="18.2" y2="5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* ── Marcas de la traza (ratificadas el 18 sep 2026) ──
          El salto del GPS: dos puntos medidos que se contradicen. Rombo hueco,
          una forma que ninguna familia de sujetos usa: no es un estado de la
          unidad (ella sí transmitía) ni un silencio (eso es el círculo hueco
          del hueco, que aquí se dibuja con `sin-senal`). */}
      {estado === "salto" && (
        <path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      )}

      {/* ── Dispositivos ── */}
      {estado === "dispositivo-en-unidad" && <rect x="10" y="10" width="20" height="20" rx="3.5" fill="currentColor" />}
      {estado === "dispositivo-en-bodega" && (
        <rect x="10.5" y="10.5" width="19" height="19" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      )}
      {estado === "dispositivo-desconectado" && (
        <>
          <path d="M13.5 10.5 h13 a3.5 3.5 0 0 1 3.5 3.5 v5.5 h-20 v-5.5 a3.5 3.5 0 0 1 3.5-3.5 Z" fill="currentColor" />
          <path
            d="M10.5 23.5 h19 v2.5 a3.5 3.5 0 0 1 -3.5 3.5 h-12 a3.5 3.5 0 0 1 -3.5-3.5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
        </>
      )}
      {estado === "dispositivo-de-baja" && (
        <>
          <rect x="10.5" y="10.5" width="19" height="19" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="13" y1="13" x2="27" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="27" y1="13" x2="13" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}

      {/* ── Papeles ── */}
      {(estado === "papel-vencido" || estado === "papel-por-vencer" || estado === "papel-falta-la-fecha") && (
        <>
          {estado === "papel-por-vencer" && (
            <>
              <defs>
                <clipPath id={recorte}>
                  <path d={HOJA} />
                </clipPath>
              </defs>
              <polygon points="11,34 31,17 31,34" fill="currentColor" clipPath={`url(#${recorte})`} />
            </>
          )}
          <path d={HOJA} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d={DOBLEZ} fill="none" stroke="currentColor" strokeWidth="1.8" />
          {estado === "papel-vencido" && (
            <line x1="14" y1="17" x2="28" y2="31" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          )}
        </>
      )}
      {estado === "papel-falta" && (
        <path d={HOJA} fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="3.4 3" strokeLinejoin="round" />
      )}
      {estado === "papel-falta-la-regla" && (
        /* El doblez es más grande que en las otras hojas a propósito: con el de
           tamaño normal, a 22 px se distinguía de «falta la fecha» sólo por el
           color. Medido en las capturas del PR D, 16 sep 2026. */
        <>
          <path
            d="M13 6 H20 L31 17 V32 A2 2 0 0 1 29 34 H13 A2 2 0 0 1 11 32 V8 A2 2 0 0 1 13 6 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M20 6 V17 H31 Z" fill="currentColor" />
        </>
      )}
      {(estado === "papel-vigente" || estado === "papel-sin-vencimiento") && (
        <>
          <path d={HOJA} fill="currentColor" />
          <path d={DOBLEZ} fill="none" stroke="var(--pieza)" strokeWidth="1.8" />
          {estado === "papel-sin-vencimiento" && <rect x="14" y="20.5" width="14" height="4" rx="1" fill="var(--pieza)" />}
        </>
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
