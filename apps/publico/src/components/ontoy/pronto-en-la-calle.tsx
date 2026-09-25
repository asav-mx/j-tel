"use client";

import { arranqueLargo } from "@/lib/fecha-arranque";

/**
 * **«Pronto me verás en la calle»** — lo que enseña una ruta que todavía no
 * arranca (`por_arrancar`, el escalón de arriba de la escalera, #373).
 *
 * ## Las dos cosas que esta pieza NO dice, y son la mitad del diseño
 *
 * **No dice la frecuencia.** Una ruta que no ha salido no tiene cada-cuánto que
 * prometer: «pasa cada 15 min» sobre un servicio que abre en seis días es una
 * promesa sobre algo que nadie ha medido ni operado. El handoff lo pide con
 * todas sus letras —«y **sin frecuencia**»— y es la misma ley de siempre.
 *
 * **No dice una hora de apertura.** Eso es de `fuera_de_horario`, que es otro
 * estado: uno abre hoy más tarde, el otro no ha abierto nunca.
 *
 * ## La fecha va en palabras, y eso arregla algo que estaba a la vista
 *
 * La app enseñaba **la fecha cruda de la base** — «Arranca el 2026-10-01»— en
 * cuatro pantallas. `lib/fecha-arranque.ts` existe desde el #373 justamente
 * para esto, con su prueba y su trampa documentada (`Date.UTC` no rechaza un
 * día imposible, lo desborda), y **nadie lo llamaba**.
 *
 * Si la fecha no se puede leer, `arranqueLargo` devuelve `null` y la frase no
 * se dibuja: el titular se queda solo. Un «Arranca el null» es peor que un
 * titular sin fecha.
 */
export function ProntoEnLaCalle({
  color,
  ruta,
  arrancaEl,
}: {
  /** El color de la ruta, del dato. Pinta a Cami, que es de la ruta. */
  color: string;
  /** El número o nombre corto de la ruta, para el letrero de Cami. */
  ruta: string;
  /** `service_launch_date`, tal como baja: un día civil, sin hora. */
  arrancaEl: string | null;
}) {
  const cuando = arrancaEl ? arranqueLargo(arrancaEl) : null;

  return (
    <div className="ontoy-pronto">
      <CamiDeFrente color={color} ruta={ruta} />
      <div className="ontoy-pronto-dicho">
        <p className="ontoy-pronto-titular">Pronto me verás en la calle.</p>
        {cuando && (
          <p className="ontoy-pronto-cuando">
            Arranca el <b>{cuando}</b>.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * **Cami de frente**, copiado del handoff (`App Mapa.dc.html`).
 *
 * De frente y no desde arriba porque aquí **te está hablando a ti** — la mirada
 * es señal (§1c): al frente es «te habla», de lado sería «de allá viene», y de
 * allá no viene nada todavía.
 *
 * Sin boca: es la versión original. La boca sólo aparece en las reacciones, y
 * ésta no es una reacción a un dato — es un estado.
 */
function CamiDeFrente({ color, ruta }: { color: string; ruta: string }) {
  return (
    <svg
      className="ontoy-pronto-cami"
      viewBox="0 0 120 120"
      width="84"
      height="84"
      role="img"
      aria-label={`Camión de la ruta ${ruta}`}
    >
      <rect x="32" y="90" width="14" height="12" rx="4" fill="#2A2E37" />
      <rect x="74" y="90" width="14" height="12" rx="4" fill="#2A2E37" />
      <rect x="26" y="14" width="68" height="80" rx="16" fill={color} />
      <rect x="40" y="19" width="40" height="13" rx="4" fill="#F7F3EC" />
      {/*
       * **El letrero va en blanco si el nombre no cabe, y eso es lo correcto.**
       *
       * El dibujo del handoff lleva el número de la ruta —«23»— en un hueco de
       * 40 px. Las rutas de aquí se llaman «Tecnológico–Norte», y recortarlo
       * daba «Tecn»: cuatro letras que no son el nombre de nada y que el
       * pasajero no puede cotejar con ningún camión.
       *
       * Así que sólo se pone cuando cabe entero. Un camión que todavía no sale
       * **no tiene su letrero puesto**, que es exactamente lo que se está
       * diciendo — y el nombre de la ruta ya está arriba, en la hoja.
       */}
      {ruta.length <= 4 && (
        <text x="60" y="29" textAnchor="middle" fill="#2A2E37" className="ontoy-pronto-letrero">
          {ruta}
        </text>
      )}
      <rect x="32" y="36" width="56" height="30" rx="10" fill="#2A2E37" />
      <ellipse cx="49" cy="51" rx="9.5" ry="7" fill="#fff" />
      <ellipse cx="71" cy="51" rx="9.5" ry="7" fill="#fff" />
      <ellipse cx="49" cy="51" rx="4.4" ry="4.6" fill="#2A2E37" />
      <ellipse cx="71" cy="51" rx="4.4" ry="4.6" fill="#2A2E37" />
      <circle cx="42" cy="80" r="5" fill="#F7F3EC" />
      <circle cx="78" cy="80" r="5" fill="#F7F3EC" />
      <circle cx="14" cy="66" r="6" fill={color} />
      <circle cx="106" cy="66" r="6" fill={color} />
    </svg>
  );
}
