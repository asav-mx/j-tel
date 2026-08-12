import type { Metadata } from "next";
import localFont from "next/font/local";
import "./landing-global.css";

/**
 * El landing carga su propio peso de Archivo (800) y no lo comparte con el
 * producto. Es deliberado: el skill j-telemetry-ui declara al landing la única
 * excepción del lenguaje de producto, y un peso de titular de portada no tiene
 * por qué estar disponible dentro de una pantalla que muestra resultados.
 *
 * **Comparte el archivo con el producto y aun así no comparte el peso.** El
 * `.woff2` es el mismo —Google sirve la Archivo variable COMPLETA sin importar
 * qué pesos se le pidan; el archivo de `wght@600;700` y el de `wght@600;700;800`
 * salieron con el mismo hash—, pero esta declaración abre el rango 700–800 y la
 * del producto abre 600–700. **La separación sigue siendo real: vive en el
 * rango declarado, no en el archivo.**
 */
const archivoTitular = localFont({
  src: [{ path: "../fuentes/archivo-variable.woff2", weight: "700 800", style: "normal" }],
  display: "swap",
  variable: "--fuente-titular-cargada",
});

export const metadata: Metadata = {
  title: "J-Telemetry — Toda la operación, verificada",
  description:
    "Arbitraje automático de cumplimiento de transporte de personal. Determina si el servicio contratado se cumplió cruzando la telemetría contra el contrato, y sella el resultado para las dos partes.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={archivoTitular.variable}>{children}</div>;
}
