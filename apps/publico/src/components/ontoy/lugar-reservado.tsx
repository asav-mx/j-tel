"use client";

/**
 * Un lugar de la barra que todavía no existe, dicho así (8.8).
 *
 * **Ir a** espera al planeador (PR 5, revisado contra la 8.16); **Pase**, a la
 * cartera de pago (8.14, Ontoy 3.0). Ninguno finge: dice qué va a vivir ahí, que
 * llega después, y ofrece lo que sí sirve hoy. No es un callejón (8.10): la
 * barra sigue abajo y el botón lleva al Mapa.
 */
export function LugarReservado({
  titulo,
  children,
  alIrAlMapa,
}: {
  titulo: string;
  children: React.ReactNode;
  alIrAlMapa: () => void;
}) {
  return (
    <div className="ontoy-vista">
      <section className="ontoy-reservado">
        <h2 className="ontoy-reservado-titulo">{titulo}</h2>
        <div className="ontoy-reservado-texto">{children}</div>
        <button type="button" className="ontoy-boton" onClick={alIrAlMapa}>
          Ver las rutas en el Mapa
        </button>
      </section>
    </div>
  );
}
