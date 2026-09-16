import Link from "next/link";
import { ALCANCE_SIN_CUARTOS, menuDe, type Casa } from "@/lib/casa/casas";

/**
 * Lo que se ve en una casa que todavía no tiene cuartos.
 *
 * El mapa prohíbe dibujar cuartos imaginarios: «un mapa con cuartos imaginarios
 * miente igual que una pantalla con botones que no existen» (6.19). Así que
 * mientras ninguna pantalla haya aterrizado, la casa no lista nada — y lo dice
 * en voz alta, que es distinto de quedarse en blanco.
 *
 * Es deliberadamente sobria y se va a borrar. En cuanto un cuarto entre a esta
 * casa, deja de aparecer sola: el menú se enciende y la puerta pasa a ser el
 * primer lugar construido.
 */
export function CasaVacia({ casa }: { casa: Casa }) {
  const puerta = casa.grupos[0]?.lugares[0]?.nombre ?? "su puerta";
  const construidos = menuDe(casa, ALCANCE_SIN_CUARTOS).flatMap((grupo) => grupo.lugares);
  return (
    <div className="mx-auto max-w-xl py-16">
      <p
        data-medida
        className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--tenue)]"
      >
        Casa {casa.nombre}
      </p>

      <h1
        className="mt-3 text-[26px] leading-tight"
        style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {casa.pregunta}
      </h1>

      {construidos.length === 0 ? (
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--tenue)]">
          Ésta es la pregunta que responde esta casa. Todavía no hay ningún cuarto
          construido detrás de ella, así que el menú está vacío a propósito: un
          lugar aparece el día que su pantalla existe, no antes.
        </p>
      ) : (
        /* Con cuartos construidos, la casa ya no está vacía y no lo dice. Lo que
           falta es su puerta: se nombra, y se liga a lo que sí existe. */
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--tenue)]">
          Ésta es la pregunta que responde esta casa, y la responde {puerta}, que
          todavía no se construye. Lo que ya existe:{" "}
          {construidos.map((lugar, i) => (
            <span key={lugar.nombre}>
              {i > 0 && ", "}
              <Link
                href={lugar.ruta!}
                className="cursor-pointer text-[var(--tinta)] underline decoration-[var(--linea)] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                {lugar.nombre}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
