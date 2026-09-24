import { encode } from "uqr";
import {
  CORRECCION_DEL_LETRERO,
  direccionDelLetrero,
  direccionDelLetreroEnPalabras,
} from "@jtel/domain";
import { OntoyDelCodigo, TinoDeLaLamina } from "@/components/casa/ontoy-impreso";

/**
 * **La hoja que se imprime, se plastifica y se atornilla a un poste.**
 *
 * Es la única pantalla del producto cuyo destino no es una pantalla. Todo lo
 * que decide su forma sale de ahí:
 *
 * - **El QR ocupa 9 cm de lado**, y la ficha pide 8 de mínimo — un mínimo no es
 *   una medida de diseño. Es la distancia desde la que engancha: un QR de 9 cm
 *   se lee de pie, a un metro del poste, sin acercar la cara; uno de 4 obliga a
 *   arrimarse, y quien espera el camión con bolsas en la mano no se arrima.
 * - **Corrección de errores H.** Ver abajo: está medido.
 * - **La dirección también escrita**, debajo. Para quien no trae cámara, no
 *   sabe escanear o tiene la pantalla rota. Sin `https://`: nadie lo teclea.
 * - **Nada del transportista.** Ni su nombre, ni su logo. La plataforma no se
 *   viste de ninguno, y un letrero es lo más público que tiene. El color de la
 *   ruta sí va —es identidad, no estado (8.8c)— y **siempre con su nombre**: el
 *   color solo no dice nada a quien no distingue colores. Va en la banda de
 *   arriba y en la cabeza de Tino.
 *
 * ## El diseño es el 1b de «Ontoy QR», y no una versión libre de él
 *
 * Banda del color de la ruta, Tino a la izquierda, «¿Cuándo pasa? Escanea.»,
 * módulos carbón sobre blanco, Ontoy al centro, la marca abajo. Sale del skill
 * `ontoy-design`, hoja `Ontoy QR.dc.html`, uso 1b — aprobado el 23-sep-2026.
 *
 * ## Por qué H, con el número
 *
 * La razón que trae la hoja de diseño —«corrección alta, por eso aguanta a Ontoy
 * en el centro»— **no es la que manda, y se midió**: un disco centrado que tapa
 * el 22 % del lado le quita el **4 % de los cuadritos**, y eso lo sobrevive
 * hasta la corrección M. Ontoy en el centro no es el riesgo.
 *
 * Lo que H compra es **la calle**. Simulando calcomanías y rayones (manchas de
 * 3×3 cuadritos, 40 tiradas por nivel, decodificado con jsQR, que es el mismo
 * lector que trae la app):
 *
 * | Manchas | Lee con M | Lee con H |
 * |---|---|---|
 * | 3 | 68 % | 93 % |
 * | 4 | **25 %** | **85 %** |
 * | 6 | 3 % | 75 % |
 * | 8 | 0 % | 65 % |
 *
 * Con cuatro estorbos, M falla tres de cada cuatro veces y H lee cinco de cada
 * seis. Eso es lo que decide si una lámina sigue sirviendo en un año.
 *
 * **Lo que H cuesta, dicho también:** más cuadritos en los mismos 9 cm. Con un
 * `qr_slug` corto, 33 en vez de 29 —2.20 mm por cuadrito en vez de 2.43—. Es
 * una razón más para que los slugs sigan siendo cortos, que es lo que el dominio
 * ya argumenta.
 *
 * ## Por qué en blanco y negro, y con fondo blanco fijo
 *
 * El QR se lee por contraste, no por tema. Esta hoja **no tiene piel oscura**:
 * se imprime, y una piel oscura en papel es un cartucho de tinta y un código
 * que no engancha. Los módulos van en **carbón sobre blanco** y nunca en naranja
 * ni en el color de la ruta: muchos teléfonos no los leen.
 *
 * ## Por qué un solo `<path>`
 *
 * Un QR de este tamaño son ~1 100 cuadritos. Con `<rect>` por cuadrito, una
 * hoja de 40 paradas serían decenas de miles de nodos y el navegador se
 * arrodilla justo cuando alguien le da a imprimir.
 */

/** Cuánto del lado del código tapa Ontoy. Medido: a 22 % le quita el 4 % de los cuadritos. */
const ONTOY_TAPA_DEL_LADO = 0.22;

export function LetreroDeParada({
  parada,
  ruta,
  sitio,
}: {
  parada: { nombre: string; qrSlug: string };
  ruta: { nombre: string; colorHex: string };
  /** De dónde cuelga la dirección impresa. Se pasa para poder probar contra un preview. */
  sitio?: string;
}) {
  const direccion = direccionDelLetrero(parada.qrSlug, sitio);
  const { size, data } = encode(direccion, { ecc: CORRECCION_DEL_LETRERO });
  let trazo = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y]?.[x]) trazo += `M${x} ${y}h1v1h-1z`;
    }
  }
  /* El hueco de Ontoy: blanco, para que no quede un cuadrito negro asomando
     bajo su silueta. Va en cuadritos completos — un borde a medio cuadrito es
     lo que el lector lee como ruido. */
  const hueco = Math.round(size * ONTOY_TAPA_DEL_LADO);
  const desde = Math.round((size - hueco) / 2);

  return (
    <section className="letrero">
      {/* La banda: el color de la ruta, a sangre en la orilla de arriba. */}
      <div className="letrero-banda" style={{ background: ruta.colorHex }} aria-hidden="true" />

      <div className="letrero-cuerpo">
        <div className="letrero-encabezado">
          <TinoDeLaLamina ruta={ruta.nombre} colorHex={ruta.colorHex} />
          <div className="letrero-dicho">
            <h1 className="letrero-pregunta">¿Cuándo pasa? Escanea.</h1>
            {/* El color nunca va solo: la placa lleva el nombre de la ruta. */}
            <p className="letrero-ruta">
              <span className="letrero-placa">{ruta.nombre}</span>
              <span className="letrero-parada">{parada.nombre}</span>
            </p>
          </div>
        </div>

        <div className="letrero-codigo">
          <svg
            className="letrero-qr"
            viewBox={`0 0 ${size} ${size}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`Código para abrir la parada ${parada.nombre}`}
          >
            <rect width={size} height={size} fill="#ffffff" />
            <path d={trazo} fill="#2A2E37" />
            <rect x={desde} y={desde} width={hueco} height={hueco} fill="#ffffff" />
          </svg>
          <OntoyDelCodigo />
        </div>

        <p className="letrero-direccion">{direccionDelLetreroEnPalabras(parada.qrSlug, sitio)}</p>
        <p className="letrero-marca">¿Ontoy?</p>
      </div>
    </section>
  );
}
