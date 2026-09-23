"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/**
 * El QR del pase, dibujado aquí mismo.
 *
 * **Corrección de errores M, no L.** Con L el código sale de 63 cuadritos de
 * lado y con M de 67 — cuatro más—, pero M aguanta que se pierda un 15 % del
 * código y L sólo un 7 %. Lo que de verdad rompe una lectura en un camión no es
 * el tamaño: es **un reflejo sobre la pantalla del teléfono**, y eso es justo lo
 * que la corrección de errores arregla. A 67 cuadritos en la caja de 216 px,
 * cada uno medía 3.2 px. La caja creció a ~335 px el 23-sep-2026 y cada cuadrito
 * pasa a ~5 px — no por estética: lo que decide si el lector engancha son los
 * píxeles que le llegan a SU cámara, y ésos salen de qué tan grande se enseña
 * esto. Ver `lib/validador/encuadre.ts`.
 *
 * ✎ 23-sep-2026: este comentario decía 51 y 59 cuadritos, y 3.7 px. Estaba mal:
 * la medición se hizo con un texto de puras mayúsculas, que un QR codifica a
 * 5.5 bits por carácter en modo alfanumérico, mientras que nuestro base64url
 * lleva minúsculas y cae a modo byte, con 8. Medido con la carga real, el
 * empaque baja el código de 91 cuadritos a 67 —no de 81 a 59—, así que la
 * ganancia es mayor de lo que decía y el costo de elegir M, menor.
 *
 * Un solo `<path>` y no 1 700 `<rect>`: el navegador de un teléfono barato
 * agradece el árbol chico, y esto se redibuja cada 5 segundos.
 */
export function CodigoQr({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const { lado, trazo } = useMemo(() => {
    const { size, data } = encode(texto, { ecc: "M" });
    let d = "";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[y]?.[x]) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { lado: size, trazo: d };
  }, [texto]);

  return (
    <svg
      className="ontoy-qr-svg"
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={etiqueta}
    >
      {/* El QR se lee por contraste, no por tema: el fondo es blanco en las dos
          pieles, y por eso su caja también lo es. */}
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={trazo} fill="#111111" />
    </svg>
  );
}
