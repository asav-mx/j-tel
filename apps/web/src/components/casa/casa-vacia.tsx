import type { Casa } from "@/lib/casa/casas";

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

      <p className="mt-5 text-[15px] leading-relaxed text-[var(--tenue)]">
        Ésta es la pregunta que responde esta casa. Todavía no hay ningún cuarto
        construido detrás de ella, así que el menú está vacío a propósito: un
        lugar aparece el día que su pantalla existe, no antes.
      </p>
    </div>
  );
}
