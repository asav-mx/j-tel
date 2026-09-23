"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/**
 * El QR del pase, dibujado aquí mismo.
 *
 * **Corrección de errores M, no L.** Con L el código sale de 51 cuadritos de
 * lado y con M de 59 — cuadritos más chicos—, pero M aguanta que se pierda un
 * 15 % del código y L sólo un 7 %. Lo que de verdad rompe una lectura en un
 * camión no es el tamaño: es **un reflejo sobre la pantalla del teléfono**, y
 * eso es justo lo que la corrección de errores arregla. A 59 cuadritos en la
 * caja de 216 px, cada uno mide 3.7 px, muy por encima de donde una cámara
 * empieza a dudar.
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
