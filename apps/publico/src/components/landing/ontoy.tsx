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
 */

/**
 * La cara de Ontoy — la del ícono de la app: «¡ya viene!», con la boca abierta.
 *
 * Es la que va dentro de la pastilla de la etiqueta y la que se queda en el
 * hueco del hero mientras no haya 3D (nivel bajo de rendimiento, §15).
 */
export function CaraDeOntoy({ className, titulo }: { className?: string; titulo?: string }) {
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
      {/* Los ojos, mirando arriba: «¡ya viene!». */}
      <circle cx="50" cy="50" r="12" fill="var(--ojo)" />
      <circle cx="76" cy="48" r="12" fill="var(--ojo)" />
      <circle cx="51" cy="45" r="6" fill="var(--pupila)" />
      <circle cx="77" cy="43" r="6" fill="var(--pupila)" />
      {/* La boca abierta. Sólo la llevan las reacciones, y ésta es una. */}
      <ellipse cx="63" cy="75" rx="5" ry="6" fill="var(--pupila)" />
      {/* Las manos, también flotantes. */}
      <circle cx="12" cy="58" r="6" fill="var(--ontoy)" />
      <circle cx="110" cy="54" r="6" fill="var(--ontoy)" />
    </svg>
  );
}

/**
 * El wordmark gigante del hero: **¿Ontoy?** con las dos «o» convertidas en
 * ojos.
 *
 * Es el chiste de la marca y por eso ocupa el lugar que ocupa: el nombre *es*
 * la cara. Las dos «o» se dibujan de distinto tamaño porque en la letra también
 * lo son — la segunda es más chica —, y si se dibujaran iguales se notaría que
 * son piezas pegadas.
 *
 * Aquí miran **al frente**, que en el vocabulario del universo es «te habla a
 * ti». El parpadeo y el seguir el cursor llegan con el resto del movimiento del
 * hero; lo que no cambia nunca es que la mirada signifique algo.
 *
 * El `aria-label` lleva el nombre completo con sus signos: para quien lo oye,
 * las «o» dibujadas no existen.
 */
export function WordmarkConOjos({ className }: { className?: string }) {
  return (
    <div className={className} role="img" aria-label="¿Ontoy?">
      <span aria-hidden="true">¿</span>
      <Ojo tamano="0.72em" radio={30} pupila={14} />
      <span aria-hidden="true">nt</span>
      <Ojo tamano="0.55em" radio={25} pupila={12} />
      <span aria-hidden="true">y?</span>
    </div>
  );
}

/** Una «o» del wordmark: disco carbón, blanco del ojo y pupila. */
function Ojo({ tamano, radio, pupila }: { tamano: string; radio: number; pupila: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "block", width: tamano, height: tamano, margin: "0 .012em 0 .03em" }}
    >
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
        <circle cx="50" cy="50" r="48" fill="var(--carbon)" />
        <ellipse cx="50" cy="50" rx={radio} ry={radio} fill="var(--ojo)" />
        <ellipse cx="50" cy="50" rx={pupila} ry={pupila} fill="var(--carbon)" />
      </svg>
    </span>
  );
}
