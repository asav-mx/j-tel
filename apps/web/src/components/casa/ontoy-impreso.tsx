import { numeroDeLaRuta } from "@jtel/domain";

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
 * ✎ **26-sep-2026 (ASAV): la placa lleva el NÚMERO de la ruta, o no hay
 * placa.** Antes llevaba el nombre si cabía o sus iniciales si no
 * (`etiquetaCortaDeLaRuta`), y la ruta de las 18 láminas salía con «OC» en el
 * pecho de Páris — un identificador que nadie usa, inventado por la función e
 * impreso para años. La regla ya decidida: **nunca iniciales**; la placa carbón
 * es sólo para identificadores cortos que existen (el número de la ruta o de
 * la unidad). Sin número, Páris va sin placa: la ruta la nombra el letrero, con
 * su franja de color y su nombre como texto.
 *
 * `ruta` es el nombre completo: de él sale el número, y el lector de pantalla
 * lo dice entero.
 */
export function TinoDeLaLamina({ ruta, colorHex }: { ruta: string; colorHex: string }) {
  const numero = numeroDeLaRuta(ruta);
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
      {/* Su placa: carbón con texto blanco, y sólo con el número de la ruta. Sin
          número no hay placa: nunca iniciales, nunca minutos. */}
      {numero && (
        <>
          <rect x="31" y="70" width="58" height="26" rx="6.5" fill={CARBON} />
          <text
            x="60"
            y="87"
            textAnchor="middle"
            fill="#fff"
            style={{ font: "800 13px var(--letra-titular), sans-serif" }}
          >
            {numero}
          </text>
        </>
      )}
    </svg>
  );
}

/**
 * **La cara del centro del código**, del color de la ruta.
 *
 * ## Ojo con esto: en el 1b el centro NO es el naranja de Ontoy
 *
 * El §16 del handoff dice «las tres esquinas son ojos que miran a Ontoy, que va
 * en el centro», y es fácil leer eso como que ahí va Ontoy en naranja. Pero el
 * marcado del uso **1b** de `Ontoy QR.dc.html` —el que Asav señaló— pone
 * `<circle r="54" fill="{{ ruta }}">`: un disco **del color de la ruta**. De los
 * cuatro usos del QR, 1b es el único con cara en el centro, y la tiene del color
 * de su ruta.
 *
 * Se siguió el marcado y no la prosa, porque el marcado es el diseño y porque es
 * lo coherente: el letrero de una parada pertenece a una ruta, y todo lo que
 * pertenece a una ruta toma su color. Si se quiere a Ontoy en naranja ahí, es
 * cambiar esta función y nada más.
 *
 * Va **sin boca** —la versión original de todos los personajes— porque a este
 * tamaño la boca se lee como un borrón, y porque lo que hace ahí es firmar el
 * código, no reaccionar a nada.
 */
export function CaraDeLaRuta({ colorHex }: { colorHex: string }) {
  return (
    <>
      <circle cx="60" cy="60" r="54" fill={colorHex} />
      <circle cx="42" cy="52" r="15" fill="#fff" />
      <circle cx="78" cy="52" r="15" fill="#fff" />
      <circle cx="42" cy="52" r="8" fill={CARBON} />
      <circle cx="78" cy="52" r="8" fill={CARBON} />
    </>
  );
}
