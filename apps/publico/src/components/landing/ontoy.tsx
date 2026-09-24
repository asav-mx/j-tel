import type { Ref } from "react";

/*
 * Ontoy dibujado, y el wordmark con sus ojos.
 *
 * Los dos salen de la landing aprobada (`Ontoy-Landing/index.html` del #552) y
 * de la hoja maestra del sistema de diseño. **No se dibujan formas nuevas**: los
 * objetos del universo viven allá y se copian de allá.
 *
 * Reglas del personaje que este archivo cumple y que no se negocian:
 *
 *  - **El naranja es sólo de Ontoy.** Ninguna otra pieza del sistema lo lleva.
 *  - Dos ojos blancos con pupila carbón, manos y pies flotantes.
 *  - La versión original va **sin boca**. La boca sólo aparece en las
 *    reacciones — y la cara del ícono, que es «¡ya viene!», es una de ellas.
 *  - **La mirada es señal**: al frente te habla a ti, arriba es «¡ya viene!»,
 *    cerrados es que no hay dato. Nunca es decoración.
 *
 * ## Los dibujos no se mueven solos
 *
 * Aquí sólo está la forma. Quien la hace parpadear y mirar es `ojos-vivos.ts`,
 * que escribe los atributos por referencia — de ahí los `ref` y las clases
 * `ojo-blanco` y `ojo-pupila`, que son el contrato entre el dibujo y el bucle.
 * Un dibujo sin `ref` se queda quieto y **se ve bien igual**: es exactamente lo
 * que ve quien pide `prefers-reduced-motion`.
 */

/**
 * La cara de Ontoy — la del ícono de la app: «¡ya viene!», con la boca abierta.
 *
 * Es la que va dentro de la pastilla de la etiqueta y la que ocupa el lugar del
 * 3D mientras éste no ha cargado: **Ontoy en 2D es lo primero que se ve,
 * siempre** (decisión de ASAV, 24-sep), y lo único que se ve en los niveles
 * medio y bajo.
 */
export function CaraDeOntoy({
  className,
  titulo,
  ojoIzq,
  ojoDer,
}: {
  className?: string;
  titulo?: string;
  ojoIzq?: Ref<SVGGElement>;
  ojoDer?: Ref<SVGGElement>;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {/* Los pies, flotantes: no tocan el cuerpo. */}
      <ellipse cx="44" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
      <ellipse cx="76" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
      {/* El cuerpo: un blob con forma de piedra. */}
      <path
        d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
        fill="var(--ontoy)"
      />
      {/* Los ojos. Sin `ref` se quedan mirando arriba: «¡ya viene!». */}
      <g ref={ojoIzq}>
        <ellipse
          className="ojo-blanco"
          cx="50"
          cy="50"
          rx="12"
          ry="12"
          fill="var(--ojo)"
        />
        <ellipse
          className="ojo-pupila"
          cx="51"
          cy="45"
          rx="6"
          ry="6"
          fill="var(--pupila)"
        />
      </g>
      <g ref={ojoDer}>
        <ellipse
          className="ojo-blanco"
          cx="76"
          cy="48"
          rx="12"
          ry="12"
          fill="var(--ojo)"
        />
        <ellipse
          className="ojo-pupila"
          cx="77"
          cy="43"
          rx="6"
          ry="6"
          fill="var(--pupila)"
        />
      </g>
      {/* La boca abierta. Sólo la llevan las reacciones, y ésta es una. */}
      <ellipse cx="63" cy="75" rx="5" ry="6" fill="var(--pupila)" />
      {/* Las manos, también flotantes. */}
      <circle cx="12" cy="58" r="6" fill="var(--ontoy)" />
      <circle cx="110" cy="54" r="6" fill="var(--ontoy)" />
    </svg>
  );
}

/** Dónde está el centro de cada ojo de Ontoy dentro de su `viewBox`. */
export const OJOS_DE_ONTOY = {
  izq: { centro: { x: 50, y: 50 }, blancoR: 12, pupilaR: 6, alcance: 4.5 },
  der: { centro: { x: 76, y: 48 }, blancoR: 12, pupilaR: 6, alcance: 4.5 },
} as const;

/**
 * El wordmark gigante del hero: **¿Ontoy?** con las dos «o» convertidas en
 * ojos.
 *
 * Es el chiste de la marca: el nombre *es* la cara. Las dos «o» se dibujan de
 * distinto tamaño porque en la letra también lo son —la segunda es la
 * minúscula—, y dibujarlas iguales delataría que son piezas pegadas.
 *
 * El `aria-label` lleva el nombre completo con sus signos: para quien lo oye,
 * las «o» dibujadas no existen.
 */
export function WordmarkConOjos({
  className,
  ojoA,
  ojoB,
  interactivo,
}: {
  className?: string;
  ojoA?: Ref<SVGGElement>;
  ojoB?: Ref<SVGGElement>;
  /** Si se puede tocar para que parpadee. Falso con `reduced-motion`. */
  interactivo?: boolean;
}) {
  return (
    <div
      className={className}
      role="img"
      aria-label="¿Ontoy?"
      title={interactivo ? "Parpadea" : undefined}
      style={interactivo ? { cursor: "pointer" } : undefined}
    >
      <span aria-hidden="true">¿</span>
      <OjoDelWordmark ref={ojoA} tamano="0.72em" blancoR={30} pupilaR={14} />
      <span aria-hidden="true">nt</span>
      <OjoDelWordmark ref={ojoB} tamano="0.55em" blancoR={25} pupilaR={12} />
      <span aria-hidden="true">y?</span>
    </div>
  );
}

/** Lo que `ojos-vivos` necesita saber de cada «o» del wordmark. */
export const OJOS_DEL_WORDMARK = {
  a: { blancoR: 30, pupilaR: 14, alcance: 12 },
  b: { blancoR: 25, pupilaR: 12, alcance: 10 },
} as const;

/** Una «o» del wordmark: disco carbón, el blanco del ojo y la pupila. */
function OjoDelWordmark({
  ref,
  tamano,
  blancoR,
  pupilaR,
}: {
  ref?: Ref<SVGGElement>;
  tamano: string;
  blancoR: number;
  pupilaR: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: tamano,
        height: tamano,
        margin: "0 .012em 0 .03em",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <circle cx="50" cy="50" r="48" fill="var(--carbon)" />
        <g ref={ref}>
          <ellipse
            className="ojo-blanco"
            cx="50"
            cy="50"
            rx={blancoR}
            ry={blancoR}
            fill="var(--ojo)"
          />
          <ellipse
            className="ojo-pupila"
            cx="54"
            cy="47"
            rx={pupilaR}
            ry={pupilaR}
            fill="var(--carbon)"
          />
        </g>
      </svg>
    </span>
  );
}
