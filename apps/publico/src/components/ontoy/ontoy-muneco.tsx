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
 *
 * ## De dónde salen los dibujos
 *
 * `al-frente`, `sin-dato` y `contento` están **copiados** del handoff
 * (`App Inicio.dc.html` del #562: `O-frente`, `O-sindato`, `O-sonrisa`).
 *
 * **`sin-red`, `dormido`, `triste` y `al-otro-lado` no venían dibujados**, y se arman aquí con la misma
 * construcción y las reglas escritas del skill —«sin red: abajo con boca
 * ondulada», «cerrado o de noche: ojos cerrados con zzz»—. Se dice con todas
 * sus letras porque **es la única parte de esta pieza que no está copiada**: si
 * el paquete de diseño los trae algún día, éstos se reemplazan por los suyos.
 *
 * El cuerpo es el mismo en las cinco: lo que cambia son los ojos y la boca, que
 * es justamente lo que `prefers-reduced-motion` deja cambiar.
 */

const NARANJA = "#F6A15B";
const CARBON = "#2A2E37";
const BLANCO = "#ffffff";

export type PoseDeOntoy = "al-frente" | "sin-dato" | "sin-red" | "dormido" | "contento" | "triste" | "al-otro-lado";

/** Qué lee en voz alta un lector de pantalla. La pose es información, no adorno. */
const DICHO: Record<PoseDeOntoy, string> = {
  "al-frente": "Ontoy, de frente",
  "sin-dato": "Ontoy, sin dato",
  "sin-red": "Ontoy, sin señal",
  dormido: "Ontoy, dormido",
  contento: "Ontoy, contento",
  triste: "Ontoy, triste",
  "al-otro-lado": "Ontoy, mirando al otro lado",
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
      <circle cx="14" cy="80" r="6" fill={NARANJA} />
      <circle cx="108" cy="78" r="6" fill={NARANJA} />

      <Cara pose={pose} />
    </svg>
  );
}

function Cara({ pose }: { pose: PoseDeOntoy }) {
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

  return (
    <>
      <circle cx="50" cy="52" r="11" fill={BLANCO} />
      <circle cx="76" cy="50" r="11" fill={BLANCO} />
      <circle cx={50 + alLado} cy={mirandoAbajo ? 57 : 52} r="6" fill={CARBON} />
      <circle cx={76 + alLado} cy={mirandoAbajo ? 55 : 50} r="6" fill={CARBON} />

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
