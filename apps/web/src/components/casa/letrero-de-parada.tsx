import { encode } from "uqr";
import {
  CORRECCION_DEL_LETRERO,
  direccionDelLetrero,
  direccionDelLetreroEnPalabras,
} from "@jtel/domain";
import { CaraDeLaRuta, TinoDeLaLamina } from "@/components/casa/ontoy-impreso";

/**
 * **La hoja que se imprime, se plastifica y se atornilla a un poste.**
 *
 * Es el uso **1b** de `Ontoy QR.dc.html` del skill `ontoy-design`: tarjeta Hueso,
 * banda del color de la ruta, Tino, «¿Cuándo pasa? Escanea.», el código en un
 * recuadro blanco redondeado con los módulos en **puntitos** carbón, las tres
 * esquinas como **ojos redondeados** que miran al centro, la cara de la ruta en
 * medio, la dirección escrita y el pie «Sin cuenta y sin descargar nada».
 *
 * Es la única pantalla del producto cuyo destino no es una pantalla, y eso decide
 * su forma: fondo claro fijo —una piel oscura en papel es un cartucho de tinta—,
 * medidas en centímetros y no en píxeles, y **nada del transportista**: ni su
 * nombre ni su logo. El color de la ruta sí va —es identidad, no estado (8.8c)—
 * y **siempre con su nombre**, en la banda, en Tino y en la placa.
 *
 * ## Los puntitos SÍ cuestan lectura, y el tamaño no lo compra
 *
 * Medido sobre **este render**, no sobre una plantilla: se recorta el código de
 * la captura y se reduce a la resolución que una cámara de teléfono entrega a un
 * metro, con menos contraste, desenfoque y ruido; 25 tiradas por celda,
 * decodificando con jsQR — el mismo lector que trae el validador.
 *
 * A 13 cm, y qué fracción de las tiradas lee:
 *
 * | | prev. 1920 (4.9 px/cuadrito) | prev. 1280 (3.3) | prev. 960 (2.5) |
 * |---|---|---|---|
 * | cuadritos, buena luz | 100 % | 100 % | 100 % |
 * | cuadritos, poca luz | 100 % | 100 % | 92 % |
 * | **puntitos, buena luz** | 100 % | 56 % | **0 %** |
 * | **puntitos, poca luz** | 100 % | 32 % | **0 %** |
 *
 * **Y agrandarlo no arregla la columna de en medio:** a 15 y 17 cm los cuadritos
 * siguen al 100 % en todo, y los puntitos siguen entre 80 % y 100 % arriba y
 * flojos abajo. Una primera medición con una plantilla sintética dijo que 3 cm
 * más igualaban los dos dibujos; el render real dice que no, y manda el render.
 *
 * O sea: **con los puntitos hace falta un teléfono que le dé al código unos 5
 * píxeles por cuadrito.** Con los cuadritos alcanza con 2.5.
 *
 * ⚠ **Lo que esta medición NO es:** tres teléfonos frente a un poste. Es un
 * modelo con un solo decodificador, y los de los teléfonos reales (VisionKit de
 * Apple, ML Kit de Google) son bastante más tolerantes con los códigos
 * estilizados que jsQR — hay miles de QR de marca con puntitos que sí escanean.
 * Además sus celdas rebotan: el muestreo de la cámara hace *aliasing* contra la
 * rejilla de puntitos, y a un tamaño lee y al siguiente no. Sirve para decir que
 * **los puntitos piden más resolución que los cuadritos**, y cuánto más; no para
 * fijar un porcentaje.
 *
 * ## El interruptor, para que la decisión sea de una línea
 *
 * `MODULOS` elige entre el dibujo del diseño y el que más margen aguanta. Está
 * aquí y no repartido por el archivo justamente para eso.
 *
 * ## Por qué H
 *
 * No es «para aguantar la cara del centro»: ésa tapa el 24 % del lado y le quita
 * el ~6 % de los cuadritos, y eso lo sobrevive hasta M. H es para **la calle** —
 * con cuatro calcomanías o rayones simulados, M lee el 25 % de las veces y H el
 * 85 %.
 *
 * ## Por qué un solo `<path>` para los puntitos
 *
 * Son ~1 100 cuadritos. Con un `<circle>` por puntito, una hoja de 40 paradas
 * serían decenas de miles de nodos y el navegador se arrodilla justo cuando
 * alguien le da a imprimir.
 */

/**
 * Cómo se dibujan los módulos.
 *
 * `"puntitos"` es el diseño 1b aprobado. `"cuadritos"` es el del letrero viejo,
 * que aguanta teléfonos peores — ver la tabla de arriba. Cambiar esta línea
 * cambia el letrero completo y nada más.
 */
const MODULOS: "puntitos" | "cuadritos" = "puntitos";

/** El radio del puntito, en cuadritos. Del diseño 1b. */
const RADIO_DEL_PUNTITO = 0.44;
/** La zona tranquila que el estándar pide, en cuadritos. Del diseño 1b. */
const ZONA_TRANQUILA = 4;
/** Cuánto del lado tapa la cara del centro. Del diseño 1b: 24 %, siempre impar. */
const CARA_TAPA_DEL_LADO = 0.24;
/** Cuánto se corre la pupila de cada esquina hacia el centro, en cuadritos. */
const LAS_ESQUINAS_MIRAN = 0.35;

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
  const { size, data } = encode(direccion, { ecc: CORRECCION_DEL_LETRERO, border: 0 });
  const Q = ZONA_TRANQUILA;
  const lado = size + Q * 2;

  /* El hueco de la cara: impar, para que quede centrado en un cuadrito y no a
     caballo entre dos — un borde a medio cuadrito es lo que el lector lee como
     ruido. */
  let hueco = Math.round(size * CARA_TAPA_DEL_LADO);
  if (hueco % 2 === 0) hueco++;
  const desde = Math.floor((size - hueco) / 2);

  const enEsquina = (f: number, c: number) =>
    (f < 7 && c < 7) || (f < 7 && c >= size - 7) || (f >= size - 7 && c < 7);
  const enLaCara = (f: number, c: number) =>
    f >= desde && f < desde + hueco && c >= desde && c < desde + hueco;

  /* Los puntitos, en un solo `path`: dos arcos por círculo. Las tres esquinas
     quedan fuera — se dibujan como ojos — y el hueco de la cara también. */
  const conPuntitos = MODULOS === "puntitos";
  const r = RADIO_DEL_PUNTITO;
  let trazo = "";
  for (let f = 0; f < size; f++) {
    for (let c = 0; c < size; c++) {
      if (!data[f]?.[c] || enLaCara(f, c)) continue;
      // con cuadritos las esquinas se dibujan solas, con sus propios módulos
      if (conPuntitos && enEsquina(f, c)) continue;
      if (conPuntitos) {
        const x = c + Q + 0.5;
        const y = f + Q + 0.5;
        trazo += `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      } else {
        trazo += `M${c + Q} ${f + Q}h1v1h-1z`;
      }
    }
  }

  /*
   * Las tres esquinas. El anillo va `stroke-width="1"` sobre un cuadrado de 6,
   * así que **cubre de 0 a 7**: el 7×7 completo del patrón de búsqueda, que es
   * lo que el lector usa para encontrar el código. Medirlo de 6 —sin contar el
   * trazo— es el error que hizo que la primera medición dijera que este diseño
   * no se leía nunca.
   */
  const centro = Q + size / 2;
  const esquinas = [
    [Q, Q],
    [Q + size - 7, Q],
    [Q, Q + size - 7],
  ].map(([x, y]) => {
    const px = x! + 3.5;
    const py = y! + 3.5;
    const d = Math.hypot(centro - px, centro - py) || 1;
    return {
      x: x!,
      y: y!,
      // la pupila mira a la cara del centro, que es lo que pide el diseño
      pupilaX: px + ((centro - px) / d) * LAS_ESQUINAS_MIRAN,
      pupilaY: py + ((centro - py) / d) * LAS_ESQUINAS_MIRAN,
    };
  });

  return (
    <section className="letrero">
      <div className="letrero-tarjeta">
        {/* La banda: el color de la ruta, a sangre. Lo que se ve desde lejos. */}
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

          <div className="letrero-caja-del-codigo">
            <svg
              className="letrero-qr"
              viewBox={`0 0 ${lado} ${lado}`}
              role="img"
              aria-label={`Código para abrir la parada ${parada.nombre}`}
            >
              <rect width={lado} height={lado} fill="#ffffff" />
              <path d={trazo} fill="#2A2E37" />

              {conPuntitos && esquinas.map((e) => (
                <g key={`${e.x}-${e.y}`}>
                  <rect
                    x={e.x + 0.5}
                    y={e.y + 0.5}
                    width={6}
                    height={6}
                    rx={2.2}
                    fill="none"
                    stroke="#2A2E37"
                    strokeWidth={1}
                  />
                  <circle cx={e.pupilaX} cy={e.pupilaY} r={1.45} fill="#2A2E37" />
                </g>
              ))}

              {/* El recuadro blanco del hueco, y encima la cara de la ruta. */}
              <rect
                x={Q + desde - 0.3}
                y={Q + desde - 0.3}
                width={hueco + 0.6}
                height={hueco + 0.6}
                rx={1.6}
                fill="#ffffff"
              />
              <g
                transform={`translate(${Q + desde + 0.2} ${Q + desde + 0.2}) scale(${(hueco - 0.4) / 120})`}
              >
                <CaraDeLaRuta colorHex={ruta.colorHex} />
              </g>
            </svg>
          </div>

          <p className="letrero-direccion">{direccionDelLetreroEnPalabras(parada.qrSlug, sitio)}</p>
          <p className="letrero-pie">Sin cuenta y sin descargar nada · ontoy.app</p>
        </div>
      </div>
    </section>
  );
}
