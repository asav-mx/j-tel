import { promesaEnPalabras } from "@jtel/domain";
import type { PromesaAhora } from "@jtel/domain";

/** La firma, escrita una vez: la misma que la hoja de parada y los avisos. */
export const FIRMA_DE_LA_CONCESION = "según la concesión";

/**
 * **La frecuencia, con quién la dijo** — «Pasa cada 12 min · según la
 * concesión», como el diseño (auditoría del 25-sep: Inicio la decía sin firma y
 * la hoja del Mapa con ella; la misma promesa, dicha de dos formas).
 *
 * **Se firma sólo lo que la concesión declaró** (`estado: "declarada"`): es la
 * regla del #377 —el rótulo sigue la fuente, no el estado— que la hoja ya
 * aplicaba. «Esta ruta no publica cada cuánto pasa» es una frase nuestra sobre
 * un hueco; firmarla le atribuiría a la concesión justo lo que no dijo.
 *
 * La hoja de parada no usa esto: pone la firma en su propio renglón, con su
 * estilo, y con la misma condición (`promesaDeclarada`).
 */
export function promesaFirmada(promesa: PromesaAhora | null, sentido: "ida" | "vuelta" | null): string | null {
  const texto = promesaEnPalabras(promesa, sentido);
  if (!texto) return null;
  return promesa?.estado === "declarada" ? `${texto} · ${FIRMA_DE_LA_CONCESION}` : texto;
}
