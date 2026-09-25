import { encode } from "uqr";
import { CORRECCION_DEL_LETRERO, direccionDelLetrero } from "@jtel/domain";
import { CaraDeLaRuta } from "@/components/casa/ontoy-impreso";

/**
 * **El código impreso de una parada**, en SVG y con la cara de su ruta al
 * centro — el dibujo 1b.
 *
 * Vive aquí y no dentro de una de las dos hojas que lo usan porque **es el
 * mismo código en las dos**: el letrero de carta y la lámina de 40×60 imprimen
 * el mismo QR, del mismo `qr_slug`, con la misma corrección. Copiarlo para la
 * lámina habría creado el sitio donde, el día que alguien cambie el dibujo, una
 * de las dos se quede atrás — y las dos se atornillan a un poste.
 *
 * **Es vectorial a propósito.** `<path>` y `<rect>`, ningún pixel: así el PDF
 * sale vectorial y la imprenta lo escala al tamaño que sea sin que el código
 * pierda un filo. Un QR rasterizado a 40 cm es un QR que se lee peor cuanto más
 * grande se imprime, que es justo al revés de lo que se busca.
 */

/** Cuántos cuadritos de margen blanco. Debajo de 4 el lector empieza a fallar. */
const ZONA_TRANQUILA = 4;

/** El radio del puntito, en cuadritos. */
const RADIO_DEL_PUNTITO = 0.44;

/** Cuánto del lado tapa la cara del centro. */
const CARA_TAPA_DEL_LADO = 0.24;

/** Cuánto se corre la pupila de cada esquina hacia el centro, en cuadritos. */
const LAS_ESQUINAS_MIRAN = 0.35;

export type FormaDeLosModulos = "puntitos" | "cuadritos";
export type FormaDeLasEsquinas = "ojos" | "normales";

export function CodigoQrImpreso({
  parada,
  ruta,
  sitio,
  modulos = "puntitos",
  esquinasComo = "ojos",
  className,
}: {
  parada: { nombre: string; qrSlug: string };
  ruta: { colorHex: string };
  sitio?: string;
  modulos?: FormaDeLosModulos;
  esquinasComo?: FormaDeLasEsquinas;
  className?: string;
}) {
  const nombreDeLaParada = parada.nombre;
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
  const conPuntitos = modulos === "puntitos";
  const conOjos = esquinasComo === "ojos";
  const r = RADIO_DEL_PUNTITO;
  let trazo = "";
  for (let f = 0; f < size; f++) {
    for (let c = 0; c < size; c++) {
      if (!data[f]?.[c] || enLaCara(f, c)) continue;
      // con ojos, las esquinas se dibujan aparte; sin ojos, con sus propios módulos
      if (conOjos && enEsquina(f, c)) continue;
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
      <svg
        className={className}
        viewBox={`0 0 ${lado} ${lado}`}
        role="img"
        aria-label={`Código para abrir la parada ${nombreDeLaParada}`}
      >
        <rect width={lado} height={lado} fill="#ffffff" />
        <path d={trazo} fill="#2A2E37" />

        {conOjos &&
          esquinas.map((e) => (
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
  );
}
