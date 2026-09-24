import { encode } from "uqr";
import { direccionDelLetrero, direccionDelLetreroEnPalabras } from "@jtel/domain";

/**
 * **La hoja que se imprime, se plastifica y se atornilla a un poste.**
 *
 * Es la única pantalla del producto cuyo destino no es una pantalla. Todo lo
 * que decide su forma sale de ahí:
 *
 * - **El QR ocupa 8 cm de lado como mínimo.** No es estética: es la distancia
 *   desde la que engancha. Un QR de 8 cm se lee de pie, a un metro del poste,
 *   sin acercar la cara; uno de 4 obliga a arrimarse, y quien espera el camión
 *   con bolsas en la mano no se arrima.
 * - **Corrección de errores M, no L.** Aguanta que se pierda un 15 % del
 *   código en vez de un 7 %. Lo que rompe la lectura de una lámina en la calle
 *   no es el tamaño: es el sol de frente, una calcomanía encima y el polvo.
 * - **La dirección también escrita**, debajo. Para quien no trae cámara, no
 *   sabe escanear o tiene la pantalla rota. Sin `https://`: nadie lo teclea.
 * - **Nada del transportista.** Ni su nombre, ni su color, ni su logo. La
 *   plataforma no se viste de ninguno, y un letrero es lo más público que
 *   tiene. El color de la ruta sí va —es identidad, no estado (8.8c)— y
 *   **siempre con su nombre al lado**: el color solo no dice nada a quien no
 *   distingue colores.
 *
 * ## Por qué en blanco y negro, y con fondo blanco fijo
 *
 * El QR se lee por contraste, no por tema. Esta hoja **no tiene piel oscura**:
 * se imprime, y una piel oscura en papel es un cartucho de tinta y un código
 * que no engancha.
 *
 * ## Por qué un solo `<path>`
 *
 * Un QR de este tamaño son ~4 000 cuadritos. Con `<rect>` por cuadrito, una
 * hoja de 40 paradas serían 160 000 nodos y el navegador se arrodilla justo
 * cuando alguien le da a imprimir.
 */
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
  const { size, data } = encode(direccion, { ecc: "M" });
  let trazo = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y]?.[x]) trazo += `M${x} ${y}h1v1h-1z`;
    }
  }

  return (
    <section className="letrero">
      <p className="letrero-marca">Ontoy</p>

      <h1 className="letrero-parada">{parada.nombre}</h1>

      {/* El color es identidad, y nunca va solo: el nombre lo acompaña siempre. */}
      <p className="letrero-ruta">
        <span className="letrero-punto" style={{ background: ruta.colorHex }} aria-hidden="true" />
        Ruta {ruta.nombre}
      </p>

      <svg
        className="letrero-qr"
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Código para abrir la parada ${parada.nombre}`}
      >
        <rect width={size} height={size} fill="#ffffff" />
        <path d={trazo} fill="#000000" />
      </svg>

      <p className="letrero-invita">Escanea para ver cuándo pasa tu camión</p>
      <p className="letrero-direccion">{direccionDelLetreroEnPalabras(parada.qrSlug, sitio)}</p>
    </section>
  );
}
