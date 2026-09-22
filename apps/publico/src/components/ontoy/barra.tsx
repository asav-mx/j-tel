"use client";

/**
 * La barra de Ontoy — **Inicio · Mapa · Ir a · Pase** (8.8, 22-sep).
 *
 * Cada ícono lleva su palabra: un ícono solo obliga a adivinar, y en una app que
 * se usa en la calle, de prisa y a veces por primera vez, adivinar es perder el
 * camión. Siempre visible: es la salida de cualquier pantalla (8.10).
 *
 * El lugar activo se marca con **forma y peso** —la pastilla de fondo y el trazo
 * más grueso—, no sólo con color.
 */

export type Lugar = "inicio" | "mapa" | "ira" | "pase";

const LUGARES: Array<{ id: Lugar; palabra: string; icono: React.ReactNode }> = [
  {
    id: "inicio",
    palabra: "Inicio",
    icono: <path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6h-6v6H4.5a.5.5 0 0 1-.5-.5z" />,
  },
  {
    id: "mapa",
    palabra: "Mapa",
    icono: (
      <>
        <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </>
    ),
  },
  {
    id: "ira",
    palabra: "Ir a",
    icono: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
  },
  {
    id: "pase",
    palabra: "Pase",
    icono: (
      <>
        <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
        <path d="M3.5 10.5h17M7 15h4" />
      </>
    ),
  },
];

export function Barra({ activo, alIr }: { activo: Lugar; alIr: (l: Lugar) => void }) {
  return (
    <nav className="ontoy-barra" aria-label="Secciones">
      {LUGARES.map((l) => (
        <button
          key={l.id}
          type="button"
          className="ontoy-barra-lugar"
          aria-current={activo === l.id ? "page" : undefined}
          onClick={() => alIr(l.id)}
        >
          <span className="ontoy-barra-pastilla" aria-hidden="true">
            <svg viewBox="0 0 24 24">{l.icono}</svg>
          </span>
          <span className="ontoy-barra-palabra">{l.palabra}</span>
        </button>
      ))}
    </nav>
  );
}
