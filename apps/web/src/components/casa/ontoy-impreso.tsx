import { etiquetaCortaDeLaRuta } from "@jtel/domain";

/**
 * **Tino y Ontoy, sólo para lo que se imprime.**
 *
 * ## Por qué hay caritas en un archivo de J-Staff
 *
 * La frontera de la identidad de Ontoy dice que **J-Staff, la planta y el
 * carrier no llevan caritas**: el universo vive del lado del pasajero, en lo
 * impreso de la calle y en redes. Esto no la rompe — la respeta por los pelos y
 * conviene decir por qué, para que nadie lo tome como permiso.
 *
 * El letrero de una parada **es calle**. Que se genere desde una pantalla de
 * J-Staff es un accidente de dónde está la impresora: el objeto que sale es una
 * lámina atornillada a un poste, y la lee un pasajero. Por eso estos dos dibujos
 * viven aquí y **no se usan en ninguna otra pantalla de la casa**. Si algún día
 * alguien quiere a Tino en un expediente, la respuesta es no.
 *
 * ## De dónde salen
 *
 * Copiados del skill `ontoy-design` (`Ontoy QR.dc.html`, símbolos `L-paradito` y
 * `L-ontoy`), que es la hoja aprobada. No se dibujó nada nuevo: la regla del
 * sistema de diseño es que los objetos del mundo se copian de la hoja maestra y
 * no se inventan.
 */

/** El carbón y el naranja, de `tokens/colors.css`. Aquí no se inventa un hex. */
const CARBON = "#2A2E37";
const NARANJA_DE_ONTOY = "#F6A15B";

/**
 * **Tino**, la parada oficial: un poste con su cabeza del color de la ruta.
 *
 * ## Su placa lleva el nombre de la ruta y NO lleva minutos
 *
 * El dibujo aprobado trae la placa con «51 · 3′». Los minutos **no pueden ir en
 * una lámina**: son dato vivo, y una hoja impresa no los puede medir. Un «3′»
 * atornillado a un poste sería la afirmación falsa más literal que este producto
 * puede cometer — un número correcto el día que se imprimió, mintiendo para
 * siempre a alguien que está esperando de verdad.
 *
 * Así que la placa se queda con lo único que un papel puede sostener: **qué ruta
 * es**. Los minutos los dice la app, que es la que los mide, y para eso está el
 * código.
 *
 * Y lleva **el nombre si cabe, o sus iniciales si no**
 * (`etiquetaCortaDeLaRuta`). El primer intento lo apretaba al ancho de la placa
 * con `textLength`, y con «Oasis – Parroquia Santa Teresa de Jesús» salió una
 * mancha gris — se vio en la primera captura. No se pierde nada: el nombre
 * completo va en la placa carbón de al lado, en el mismo letrero.
 */
export function TinoDeLaLamina({ ruta, colorHex }: { ruta: string; colorHex: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className="letrero-tino"
      style={{ color: colorHex }}
      role="img"
      aria-label={`Parada de la ruta ${ruta}`}
    >
      {/* El poste y su base: carbón, nunca del color de la ruta. */}
      <rect x="57" y="36" width="6" height="72" fill={CARBON} />
      <rect x="46" y="106" width="28" height="7" rx="3.5" fill={CARBON} />
      {/* La cabeza y las manos toman el color de la ruta (`currentColor`). */}
      <circle cx="60" cy="38" r="26" fill="currentColor" />
      <circle cx="31" cy="83" r="6" fill="currentColor" />
      <circle cx="89" cy="83" r="6" fill="currentColor" />
      {/* Dos ojos blancos con pupila carbón, como todos los personajes. */}
      <circle cx="51" cy="36" r="7.5" fill="#fff" />
      <circle cx="69" cy="36" r="7.5" fill="#fff" />
      <circle cx="51" cy="36" r="4" fill={CARBON} />
      <circle cx="69" cy="36" r="4" fill={CARBON} />
      {/* Su placa: carbón con texto blanco. Su etiqueta corta, nunca minutos. */}
      <rect x="31" y="70" width="58" height="26" rx="6.5" fill={CARBON} />
      <text
        x="60"
        y="87"
        textAnchor="middle"
        fill="#fff"
        style={{ font: "800 13px var(--letra-titular), sans-serif" }}
      >
        {etiquetaCortaDeLaRuta(ruta)}
      </text>
    </svg>
  );
}

/**
 * **Ontoy**, para el centro del código.
 *
 * Va sin su celular y sin boca —la versión original— porque a este tamaño la
 * boca abierta se lee como un borrón, y porque lo que hace ahí es firmar el
 * código, no reaccionar a nada.
 *
 * **Medido, no supuesto:** tapando el 22 % del lado del código, Ontoy le quita
 * un **4 % de los cuadritos**. La corrección H aguanta hasta cerca del 30 %, así
 * que el logo no es de dónde viene el riesgo de este letrero — ver la nota de
 * `letrero-de-parada.tsx`.
 */
export function OntoyDelCodigo() {
  return (
    <svg viewBox="0 0 120 120" className="letrero-ontoy" aria-hidden="true">
      <ellipse cx="44" cy="96" rx="9" ry="6" fill={NARANJA_DE_ONTOY} />
      <ellipse cx="76" cy="96" rx="9" ry="6" fill={NARANJA_DE_ONTOY} />
      <path
        d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
        fill={NARANJA_DE_ONTOY}
      />
      <circle cx="14" cy="80" r="6" fill={NARANJA_DE_ONTOY} />
      <circle cx="108" cy="78" r="6" fill={NARANJA_DE_ONTOY} />
      <circle cx="50" cy="52" r="11" fill="#fff" />
      <circle cx="76" cy="50" r="11" fill="#fff" />
      <circle cx="50" cy="52" r="6" fill={CARBON} />
      <circle cx="76" cy="50" r="6" fill={CARBON} />
    </svg>
  );
}
