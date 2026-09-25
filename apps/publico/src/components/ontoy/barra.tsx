"use client";

import { GlifoCasa, GlifoIra, GlifoMapa, GlifoPase } from "@/components/ontoy/glifos";

/**
 * La barra de Ontoy — **Inicio · Mapa · Ir a · Pase** (8.8, 22-sep).
 *
 * Cada ícono lleva su palabra: un ícono solo obliga a adivinar, y en una app que
 * se usa en la calle, de prisa y a veces por primera vez, adivinar es perder el
 * camión. Siempre visible: es la salida de cualquier pantalla (8.10).
 *
 * ## Con los objetos del universo (app-v1, 25-sep)
 *
 * Los íconos son los del diseño —la casita, el mapa, Ontoy de gorrito y el
 * pase, todos con ojos—, no íconos de línea genéricos. La palabra va en tipo
 * oración («Inicio», no «INICIO»).
 *
 * El lugar activo se marca con **forma y peso**, no sólo con color: la pastilla
 * llena (carbón de día, hueso de noche), el glifo en la tinta contraria y la
 * palabra en 700. Y **regla 2b**: el activo mira al frente y los demás voltean
 * las pupilas 0.9 px hacia él — la barra entera señala dónde estás.
 */

export type Lugar = "inicio" | "mapa" | "ira" | "pase";

const LUGARES: Array<{ id: Lugar; palabra: string; Glifo: React.ComponentType<{ tamano?: number }> }> = [
  { id: "inicio", palabra: "Inicio", Glifo: GlifoCasa },
  { id: "mapa", palabra: "Mapa", Glifo: GlifoMapa },
  { id: "ira", palabra: "Ir a", Glifo: GlifoIra },
  { id: "pase", palabra: "Pase", Glifo: GlifoPase },
];

/** Hacia dónde mira un lugar que no es el activo: hacia el activo. */
export function miradaHacia(i: number, activo: number): string {
  if (i === activo) return "0px";
  return activo > i ? "0.9px" : "-0.9px";
}

export function Barra({ activo, alIr }: { activo: Lugar; alIr: (l: Lugar) => void }) {
  const iActivo = LUGARES.findIndex((l) => l.id === activo);
  return (
    <nav className="ontoy-barra" aria-label="Secciones">
      {LUGARES.map(({ id, palabra, Glifo }, i) => (
        <button
          key={id}
          type="button"
          className="ontoy-barra-lugar"
          aria-current={activo === id ? "page" : undefined}
          onClick={() => alIr(id)}
          style={{ ["--mx" as string]: miradaHacia(i, iActivo) }}
        >
          <span className="ontoy-barra-pastilla" aria-hidden="true">
            <Glifo />
          </span>
          <span className="ontoy-barra-palabra">{palabra}</span>
        </button>
      ))}
    </nav>
  );
}
