import type { ResultadoDelLector } from "@jtel/domain/validador";

/**
 * Qué dice el panel del lector cuando un pase pasa.
 *
 * Vive aparte de la pantalla, y con prueba, por un error que estuvo escrito:
 * el panel decía **«firma verificada en el aparato»** también cuando el viaje
 * había entrado por **código dictado**, que es justo la vía donde **no hay
 * ninguna firma que verificar**. Compilaba, se veía bien y afirmaba algo falso
 * — la trampa exacta del Marco §D: el dato correcto (el folio) al lado de una
 * afirmación que no lo es.
 *
 * Por eso la frase se arma aquí: para que una prueba pueda exigir que la vía
 * dictada **nunca** diga que verificó nada.
 */
export function detalleDeUnPaseBueno(
  resultado: Extract<ResultadoDelLector, { pasa: true }>,
): string {
  if (resultado.via === "codigo_dictado") {
    return resultado.conSenal
      ? "Sin firma que verificar: queda un reclamo marcado, se coteja al sincronizar."
      : "Sin firma que verificar, y sin señal: queda un reclamo marcado para cotejar al volver la red.";
  }
  return resultado.conSenal
    ? "Firma verificada en el aparato."
    : "Firma verificada en el aparato. Sin señal: guardado, se concilia al volver la red.";
}

/** El título, que dice por dónde entró sin que haya que leer el detalle. */
export const tituloDeUnPaseBueno = (
  resultado: Extract<ResultadoDelLector, { pasa: true }>,
): string => (resultado.via === "codigo_dictado" ? "Válido · por código dictado" : "Válido");
