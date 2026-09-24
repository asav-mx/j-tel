import { CaraDeOntoy } from "../ontoy";

/**
 * **«La pregunta de siempre»** — tres bocadillos, y el tercero es Ontoy.
 *
 * Es la sección que explica el producto sin explicar nada: tú preguntas si ya
 * pasó tu camión, la tiendita no puede saberlo, y Ontoy sí.
 *
 * ## Qué cambió del diseño, y por qué
 *
 * **«Viene a 3 min» dice ahora «Viene a 3 paradas».** Mientras la velocidad del
 * corredor no esté calibrada la app no da minutos (8.9b), y «llega en 2 min»
 * está en la lista de lo que no entra en la versión 1. Una portada que los
 * diera en un bocadillo prometería lo que la app no hace — y dejarlos aquí
 * mientras la placa de Tino cuenta paradas sería peor: la misma pantalla
 * diciendo dos cosas.
 *
 * **La pregunta es genérica: «¿Ya pasó tu camión?»** El diseño preguntaba por
 * la 51. La portada no enseña una ruta real —eso sería vestir la plataforma de
 * transportista—, y en un bocadillo que pretende ser lo que cualquiera dice en
 * una parada, el número sobra: nadie pregunta por el número de otro.
 *
 * Los personajes del bocadillo sí son del universo, porque ahí son dibujo: el
 * pasajero, la tiendita y Ontoy.
 */
export function LaPreguntaDeSiempre() {
  return (
    <section className="landing-caja landing-pregunta">
      <p className="landing-rotulo">La pregunta de siempre</p>
      <div className="landing-bocadillos">
        <Bocadillo quien="Tú, en la parada" dibujo={<Pasajero />}>
          ¿Ya pasó tu camión?
        </Bocadillo>
        <Bocadillo quien="La tiendita" dibujo={<Tiendita />}>
          Uy, ¿quién sabe? Hace rato pasó una…
        </Bocadillo>
        {/* El de Ontoy va en carbón: es el único de los tres que sabe. */}
        <Bocadillo quien="Ontoy" dibujo={<CaraDeOntoy />} destacado>
          Viene a 3 paradas. Sal con calma.
        </Bocadillo>
      </div>
    </section>
  );
}

function Bocadillo({
  children,
  quien,
  dibujo,
  destacado,
}: {
  children: React.ReactNode;
  quien: string;
  dibujo: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <div className="landing-bocadillo">
      <p className={destacado ? "landing-globo landing-globo-ontoy" : "landing-globo"}>
        {children}
      </p>
      <span className="landing-quien">
        {dibujo}
        {quien}
      </span>
    </div>
  );
}

/** El pasajero del universo: azul noche, nunca color de ruta — no es de una ruta. */
function Pasajero() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <rect x="18" y="18" width="24" height="30" rx="12" fill="var(--pasajero)" />
      <circle cx="24" cy="30" r="4.6" fill="var(--ojo)" />
      <circle cx="35" cy="30" r="4.6" fill="var(--ojo)" />
      <circle cx="22.6" cy="30" r="2.4" fill="var(--pupila)" />
      <circle cx="33.6" cy="30" r="2.4" fill="var(--pupila)" />
      <circle cx="11" cy="38" r="4.6" fill="var(--pasajero)" />
      <circle cx="49" cy="38" r="4.6" fill="var(--pasajero)" />
    </svg>
  );
}

/** La tiendita: objeto del barrio, así que colores de barrio y jamás naranja. */
function Tiendita() {
  return (
    <svg viewBox="0 0 60 56" aria-hidden="true">
      <rect x="4" y="16" width="52" height="38" rx="3" fill="var(--maiz)" />
      <rect x="4" y="16" width="52" height="8" fill="var(--rosa)" />
      <rect x="8" y="6" width="44" height="10" rx="3" fill="var(--carbon)" />
      <rect x="10" y="30" width="18" height="14" rx="3" fill="var(--carbon)" />
      <rect x="34" y="30" width="12" height="24" rx="2" fill="var(--carbon)" />
      <circle cx="15" cy="37" r="3.2" fill="var(--ojo)" />
      <circle cx="23" cy="37" r="3.2" fill="var(--ojo)" />
      <circle cx="16" cy="38.4" r="1.8" fill="var(--pupila)" />
      <circle cx="24" cy="38.4" r="1.8" fill="var(--pupila)" />
    </svg>
  );
}
