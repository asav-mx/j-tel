import { addDaysIso } from "@jtel/domain";

/**
 * El resumen de aperturas que enseña el expediente del circuito.
 *
 * Vive fuera del `.tsx` por la razón de siempre —una cifra escrita dentro de un
 * componente no se puede probar sin montar la pantalla— y por una segunda que
 * aquí decide el diseño entero: **la distinción entre un cero y un hueco no la
 * puede hacer una consulta**, y es justo la que vuelve falso el renglón si se
 * pierde.
 *
 * ## Un cero no es un hueco, y los dos se ven igual
 *
 * Un día sin filas significa dos cosas distintas según cuándo sea:
 *
 * - **Después** de que el contador empezó a registrar esta ruta: nadie
 *   distinguible la abrió. Es un cero, y es un dato.
 * - **Antes**: nadie estaba contando. Dibujar «0» ahí afirmaría que nadie abrió
 *   la app cuando lo cierto es que no había instrumento — la §D del Marco en su
 *   forma de alcance, y encima sobre el número con el que se va a decidir si la
 *   app se está usando.
 *
 * Por eso la serie lleva `null` y no cero, y la pantalla lo dibuja como hueco.
 *
 * ## Lo que este archivo NO hace
 *
 * **No cuenta.** Las filas llegan agregadas de la base, donde el índice único
 * es el que define qué es un aparato distinguible.
 *
 * **No enseña el crudo.** `open_count` se guarda y no sale de aquí: es la señal
 * de raspado, no una cifra de uso. Ver el encabezado de la tabla.
 */

/** Cuántos días enseña el expediente. Alcanza para la prueba de campo del 11 al 13. */
export const DIAS_DEL_RESUMEN = 7;

export interface DiaDeAperturas {
  /** Fecha civil del circuito, `AAAA-MM-DD`. */
  fecha: string;
  /**
   * Aparatos distinguibles que abrieron ese día. **`null` = sin registro**: el
   * contador todavía no existía para esta ruta, y eso no es un cero.
   */
  aparatos: number | null;
}

/**
 * **Qué es este número y qué no es.** Va pegado a la cifra, no al pie en chico:
 * las dos advertencias son de la misma clase —el número no vale como personas ni
 * como uso limpio— y separarlas dejaría a la cifra sola con la mitad de su
 * lectura.
 *
 * Las dos están medidas, no supuestas: el NAT lo documenta el
 * `Procedimiento-Firewall-Publico` al justificar por qué la acción es un
 * desafío y no un bloqueo, y el raspado lento lo declara ese mismo archivo como
 * lo que su regla no cubre.
 */
export const LO_QUE_CUENTA =
  "Cuenta aparatos que se pueden distinguir, no personas: varios teléfonos detrás del mismo " +
  "NAT cuentan como uno. Y no separa el raspado del uso.";

/**
 * La serie de los últimos días, del más reciente al más viejo.
 *
 * @param hoyLocal La fecha civil **del circuito**, no la del servidor: es la
 *   misma con la que se guardó cada fila, y con otra los días no cuadran.
 * @param primerDiaConRegistro El primer día que este circuito tiene registrado.
 *   `null` si nunca se registró ninguna apertura, y entonces **la serie entera
 *   es hueco** — que es lo honesto el día que esto se despliega.
 */
export function serieDeAperturas(entrada: {
  hoyLocal: string;
  filas: Array<{ localDate: string; aparatos: number }>;
  primerDiaConRegistro: string | null;
  dias?: number;
}): DiaDeAperturas[] {
  const dias = entrada.dias ?? DIAS_DEL_RESUMEN;
  const porFecha = new Map(entrada.filas.map((f) => [f.localDate, f.aparatos]));

  const serie: DiaDeAperturas[] = [];
  for (let i = 0; i < dias; i += 1) {
    const fecha = addDaysIso(entrada.hoyLocal, -i);
    /*
     * El orden de las dos preguntas importa. Primero «¿ya se contaba?», y sólo
     * después «¿cuántos?»: al revés, un día anterior al contador saldría con
     * cero y se leería como que nadie abrió.
     */
    const seContaba =
      entrada.primerDiaConRegistro !== null && fecha >= entrada.primerDiaConRegistro;
    serie.push({ fecha, aparatos: seContaba ? (porFecha.get(fecha) ?? 0) : null });
  }
  return serie;
}

/**
 * Lo de hoy, para la cifra grande. `null` si hoy todavía no se contaba — y
 * entonces la pantalla dice eso en vez de un cero.
 */
export function aperturasDeHoy(serie: DiaDeAperturas[]): number | null {
  return serie[0]?.aparatos ?? null;
}

/**
 * ¿Hay algo que enseñar? `false` cuando ningún día de la ventana tiene registro.
 *
 * Sirve para que la pantalla diga «todavía no se cuenta» **una vez**, en vez de
 * dibujar siete renglones de huecos que ocupan espacio para no decir nada.
 */
export function hayRegistro(serie: DiaDeAperturas[]): boolean {
  return serie.some((d) => d.aparatos !== null);
}
