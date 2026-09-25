"use client";

/**
 * **Ontoy**, el protagonista — el mensajero de estado de cada pantalla.
 *
 * ## Las dos reglas que lo gobiernan, y no son de estilo
 *
 * **Uno por pantalla, como máximo, y sólo si dice algo** (estándar, regla 1).
 * No es decoración ni relleno: aparece para decir un estado, una respuesta o un
 * «no sé». Dos Ontoys en una pantalla es uno de los dos sobrando.
 *
 * **La mirada es señal** (handoff §1c). Cada pose afirma algo distinto, así que
 * escogerla es una decisión de contenido y no de dibujo:
 *
 * | Pose | Qué dice |
 * |---|---|
 * | `al-frente` | te habla a ti — una pregunta o una bienvenida |
 * | `sin-dato` | abajo, boca en línea: buscando, o no sé |
 * | `sin-red` | abajo, boca ondulada: se cayó la red |
 * | `dormido` | ojos cerrados: cerrado, o de noche |
 * | `contento` | sonrisa: llegó, o lo lograste |
 * | `triste` | boca hacia abajo: no encontré nada — y enseguida propone otra cosa |
 * | `al-otro-lado` | las dos pupilas corridas: se va, o esto no lleva a ningún lado |
 * | `con-boleto` | enseña su boleto, mirándolo: lo que todavía no se puede hacer, dicho sin alarma |
 * | `mirando-arriba` | las pupilas arriba: ya viene — está viendo llegar tu camión |
 *
 * ## De dónde salen los dibujos
 *
 * `al-frente`, `sin-dato` y `contento` están **copiados** del handoff
 * (`App Inicio.dc.html` del #562: `O-frente`, `O-sindato`, `O-sonrisa`).
 * `con-boleto` también: es `s-ontoy-boleto` de `App Pase y Lector.dc.html`
 * (4-pase/03), con las manos sosteniendo el boleto en vez de flotar a los lados.
 *
 * **`sin-red`, `dormido`, `triste`, `al-otro-lado` y `mirando-arriba` no venían dibujados**,
 * y se arman aquí con la misma construcción y las reglas escritas del skill
 * —«sin red: abajo con boca ondulada», «cerrado o de noche: ojos cerrados con
 * zzz»—. Se dice con todas sus letras porque **es la única parte de esta pieza
 * que no está copiada**: si el paquete de diseño los trae algún día, éstos se
 * reemplazan por los suyos.
 *
 * El cuerpo es el mismo en todas: lo que cambia son los ojos y la boca, que
 * es justamente lo que `prefers-reduced-motion` deja cambiar.
 */

const NARANJA = "#F6A15B";
const CARBON = "#2A2E37";
const BLANCO = "#ffffff";
/* El papel del boleto: el `#F7F3EC` del símbolo del diseño. */
const PAPEL = "#F7F3EC";

export type PoseDeOntoy =
  | "al-frente"
  | "sin-dato"
  | "sin-red"
  | "dormido"
  | "contento"
  | "triste"
  | "al-otro-lado"
  | "con-boleto"
  | "mirando-arriba";

/** Qué lee en voz alta un lector de pantalla. La pose es información, no adorno. */
const DICHO: Record<PoseDeOntoy, string> = {
  "al-frente": "Ontoy, de frente",
  "sin-dato": "Ontoy, sin dato",
  "sin-red": "Ontoy, sin señal",
  dormido: "Ontoy, dormido",
  contento: "Ontoy, contento",
  triste: "Ontoy, triste",
  "al-otro-lado": "Ontoy, mirando al otro lado",
  "con-boleto": "Ontoy con su boleto",
  "mirando-arriba": "Ontoy, mirando llegar tu camión",
};

export function Ontoy({
  pose = "al-frente",
  tamano = 96,
}: {
  pose?: PoseDeOntoy;
  /**
   * 40–64 en línea con un dato · 96–128 de mensajero · hasta 160 en una pantalla
   * vacía o de noche (estándar, «tamaños de personaje»).
   */
  tamano?: number;
}) {
  return (
    <svg
      className="ontoy-muneco"
      viewBox="0 0 120 120"
      width={tamano}
      height={tamano}
      role="img"
      aria-label={DICHO[pose]}
    >
      {/* El cuerpo: pies y manos flotantes, sin unir al cuerpo. */}
      <ellipse cx="44" cy="96" rx="9" ry="6" fill={NARANJA} />
      <ellipse cx="76" cy="96" rx="9" ry="6" fill={NARANJA} />
      <path
        d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
        fill={NARANJA}
      />
      {pose !== "con-boleto" && (
        <>
          <circle cx="14" cy="80" r="6" fill={NARANJA} />
          <circle cx="108" cy="78" r="6" fill={NARANJA} />
        </>
      )}

      <Cara pose={pose} />
      {pose === "con-boleto" && <Boleto />}
    </svg>
  );
}

/**
 * El boleto que Ontoy enseña, con las manos encima — copiado de `s-ontoy-boleto`.
 * Es un QR **de dibujo**: no codifica nada, y por eso no sale en ninguna pantalla
 * donde un QR de verdad pudiera confundirse con él.
 */
function Boleto() {
  return (
    <>
      <rect x="70" y="64" width="42" height="42" rx="6" fill={PAPEL} stroke={CARBON} strokeWidth="2.5" />
      <rect x="76" y="70" width="10" height="10" rx="1.5" fill={CARBON} />
      <rect x="96" y="70" width="10" height="10" rx="1.5" fill={CARBON} />
      <rect x="76" y="90" width="10" height="10" rx="1.5" fill={CARBON} />
      <rect x="89" y="72" width="4" height="4" fill={CARBON} />
      <rect x="89" y="83" width="5" height="5" fill={CARBON} />
      <rect x="98" y="86" width="4" height="4" fill={CARBON} />
      <rect x="96" y="95" width="6" height="5" fill={CARBON} />
      <rect x="89" y="94" width="4" height="4" fill={CARBON} />
      <circle cx="70" cy="98" r="6" fill={NARANJA} />
      <circle cx="112" cy="72" r="6" fill={NARANJA} />
    </>
  );
}

function Cara({ pose }: { pose: PoseDeOntoy }) {
  if (pose === "con-boleto") {
    /* Mira su boleto: las pupilas abajo y a la derecha, y una sonrisa chica. */
    return (
      <>
        <circle cx="50" cy="52" r="11" fill={BLANCO} />
        <circle cx="76" cy="50" r="11" fill={BLANCO} />
        <circle cx="53" cy="56" r="6" fill={CARBON} />
        <circle cx="79" cy="54" r="6" fill={CARBON} />
        <path d="M44 74 q8 7 16 0" fill="none" stroke={CARBON} strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }

  if (pose === "dormido") {
    /*
     * Ojos cerrados: dos arcos, no dos puntos. Y sus «z», que es lo que
     * distingue «duerme» de «parpadeó» — la regla del skill los pide juntos.
     */
    return (
      <>
        <path d="M41 52 q9 7 18 0" fill="none" stroke={CARBON} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M67 50 q9 7 18 0" fill="none" stroke={CARBON} strokeWidth="3.6" strokeLinecap="round" />
        <text x="96" y="34" className="ontoy-muneco-z" fill={CARBON}>
          z
        </text>
        <text x="108" y="22" className="ontoy-muneco-z chica" fill={CARBON}>
          z
        </text>
      </>
    );
  }

  /* Los ojos blancos con pupila carbón: los cinco personajes los comparten. */
  const mirandoAbajo = pose === "sin-dato" || pose === "sin-red" || pose === "triste";
  /*
   * Las dos pupilas corridas al mismo lado. «Al otro lado» es la señal de «se
   * va» del §1c, y aquí dice lo que la pantalla dice: esto no lleva a donde
   * ibas. Corridas las DOS —no una— porque una sola es un guiño, que es otra
   * cosa.
   */
  const alLado = pose === "al-otro-lado" ? 3.5 : 0;
  /*
   * «Mirando arriba» (ASAV, 25-sep): la llegada en vivo de «Tu próximo camión».
   * Las pupilas suben lo mismo que bajan en «sin dato»: es su espejo — no
   * busca, ve venir.
   */
  const alto = mirandoAbajo ? 5 : pose === "mirando-arriba" ? -4 : 0;

  return (
    <>
      <circle cx="50" cy="52" r="11" fill={BLANCO} />
      <circle cx="76" cy="50" r="11" fill={BLANCO} />
      <circle cx={50 + alLado} cy={52 + alto} r="6" fill={CARBON} />
      <circle cx={76 + alLado} cy={50 + alto} r="6" fill={CARBON} />

      {pose === "sin-dato" && (
        /* Boca en línea: paciente, sin saber. */
        <path d="M56 77 h14" stroke={CARBON} strokeWidth="3.6" strokeLinecap="round" />
      )}
      {pose === "sin-red" && (
        /* Boca ondulada: confundido. No es alarma — es «no me llega». */
        <path
          d="M52 76 q4.5 -5 9 0 t9 0"
          fill="none"
          stroke={CARBON}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      )}
      {pose === "triste" && (
        /*
         * **Triste suave, y la palabra «suave» es la regla.** El estándar pide
         * que una búsqueda sin resultados «proponga otra cosa enseguida»: esto
         * no es un error ni una alarma, es un «no lo encontré». La boca baja
         * poco —la misma curva de la sonrisa, volteada— y nada se pone rojo.
         */
        <path d="M54 78 q9 -8 18 0" fill="none" stroke={CARBON} strokeWidth="3.6" strokeLinecap="round" />
      )}
      {pose === "contento" && (
        <path d="M54 72 q9 8 18 0" fill="none" stroke={CARBON} strokeWidth="3.6" strokeLinecap="round" />
      )}
      {/* `al-frente` va SIN boca: es la versión original (handoff §1). */}
    </>
  );
}
