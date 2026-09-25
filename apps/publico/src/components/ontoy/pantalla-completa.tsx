import Link from "next/link";
import { Ontoy, type PoseDeOntoy } from "@/components/ontoy/ontoy-muneco";

/**
 * **Una pantalla de estado completo** — vacío, sin red, 404.
 *
 * El §G del estándar la describe entera, y las cuatro partes son las cuatro y
 * en ese orden: Ontoy de 128–160 px al centro, **una** línea de titular, **una**
 * de ayuda, y **un** solo botón.
 *
 * ## Por qué un solo botón, dicho aquí para que no se pierda
 *
 * Una pantalla completa aparece cuando el pasajero ya se topó con algo que no
 * esperaba. Dos salidas en ese momento son una decisión más que tomar; la 8.10
 * pide **una salida**, no un menú. Si hiciera falta una segunda, lo que falta no
 * es un botón: es que esta pantalla no debería ser completa.
 *
 * ## Y por qué no lleva «Reintentar» por omisión
 *
 * Porque reintentar sólo tiene sentido si algo se puede reintentar. En un 404 no
 * hay nada que volver a pedir —la liga no existe— y un botón que no puede
 * funcionar enseña a desconfiar del resto.
 */
export function PantallaCompleta({
  pose,
  titular,
  ayuda,
  boton,
  adorno,
}: {
  pose: PoseDeOntoy;
  /** Una línea. Si necesita dos frases, la segunda es la ayuda. */
  titular: string;
  ayuda: string;
  boton: { texto: string; a: string };
  /** Un dibujo debajo de Ontoy, cuando la pantalla tiene uno propio. */
  adorno?: React.ReactNode;
}) {
  return (
    <main className="ontoy-completa">
      <Ontoy pose={pose} tamano={128} />
      {adorno}
      <h1 className="ontoy-completa-titular">{titular}</h1>
      <p className="ontoy-completa-ayuda">{ayuda}</p>
      <Link className="ontoy-boton ontoy-boton-principal" href={boton.a}>
        {boton.texto}
      </Link>
    </main>
  );
}

/**
 * **La calle sin salida** del 404 — carbón con sus rayas, y el tope al final.
 *
 * Copiada del handoff. Es el único adorno de este tipo en la app y va **debajo
 * de Ontoy**, no detrás: el dibujo explica el titular —«esta calle no lleva a
 * ningún lado»— en vez de decorarlo.
 */
export function CalleSinSalida() {
  return (
    <svg
      className="ontoy-completa-calle"
      viewBox="0 0 280 28"
      width="240"
      height="24"
      aria-hidden="true"
    >
      <rect x="0" y="4" width="252" height="20" rx="4" fill="#2A2E37" />
      {[14, 46, 78, 110, 142, 174, 206].map((x) => (
        <rect key={x} x={x} y="12" width="18" height="4" rx="2" fill="#F7F3EC" />
      ))}
      {/* El tope: lo que hace que sea «sin salida» y no sólo «una calle». */}
      <rect x="258" y="0" width="14" height="28" rx="4" fill="#F2C14E" />
    </svg>
  );
}
