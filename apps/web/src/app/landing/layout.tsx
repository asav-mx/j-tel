import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./landing-global.css";

/**
 * El landing carga su propio peso de Archivo (800) y no lo comparte con el
 * producto. Es deliberado: el skill j-telemetry-ui declara al landing la única
 * excepción del lenguaje de producto, y un peso de titular de portada no tiene
 * por qué estar disponible dentro de una pantalla que muestra resultados.
 */
const archivoTitular = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
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
