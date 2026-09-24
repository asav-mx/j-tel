import { enHorarioDeServicio, yaArrancoElServicio } from "./publico.js";

/**
 * **Quién debería estar hablando.**
 *
 * Nace del incidente #470 (23-sep-2026). El vigilante gritó tres días seguidos
 * —veinte comentarios en un issue— por una flota que estaba **estacionada y
 * apagada**. La regla de entonces era «ningún carrier real sin dato en 20
 * minutos», y con ella un camión en el patio es una emergencia.
 *
 * Un vigilante que grita cuando no pasa nada enseña a no mirarlo, y ése es
 * exactamente el fallo que este repo ya pagó dos veces por el otro lado: el
 * heartbeat que cayó con lo que vigilaba, y el que detectaba sin poder avisar.
 * Un tercero que avisa de más termina en el mismo lugar.
 *
 * ## La regla, en una frase
 *
 * **Sólo se espera oír a una unidad que tiene aparato montado, está asignada a
 * un circuito publicado, y el circuito está en su horario de servicio.** Si
 * ninguna cumple las tres, no hay nada que vigilar: la flota duerme, y eso se
 * dice sin gritar.
 *
 * Las tres condiciones son las que el producto ya usa para prometerle algo a
 * un pasajero. Si no le prometemos nada, tampoco tenemos por qué esperar dato.
 *
 * ## Por qué el horario sale del circuito y no de una constante
 *
 * Antes era «lunes a sábado, 05:00 a 22:00», escrito a mano. Cada circuito
 * tiene el suyo, con su zona, y ya gobierna lo que Ontoy le dice al pasajero.
 * Dos definiciones del mismo horario se separan el primer mes, y la que manda
 * tiene que ser la que el pasajero ve.
 */

/** Una unidad de la que el producto espera oír algo, y qué tan callada está. */
export interface UnidadEsperada {
  /** El número económico — el que trae pintado el camión. */
  readonly unidad: string;
  readonly carrier: string;
  readonly circuito: string;
  /** El horario del circuito, tal como gobierna lo que ve el pasajero. */
  readonly abre: string;
  readonly cierra: string;
  readonly zona: string;
  /** `null` si el circuito ya opera. */
  readonly arrancaEl: string | null;
  /**
   * Minutos desde su último punto. `null` = **nunca ha hablado**, que no es lo
   * mismo que «hace mucho» y no se colapsa con él.
   */
  readonly minutosSinHablar: number | null;
}

/** ¿Se espera oír a esta unidad **ahora**? */
export function seEsperaAhora(u: UnidadEsperada, ahora: Date): boolean {
  if (!yaArrancoElServicio(ahora, u.arrancaEl, u.zona)) return false;
  return enHorarioDeServicio(ahora, u.abre, u.cierra, u.zona);
}

export type VeredictoDeLaFlota =
  /** Nadie debería estar hablando ahora. **No es una alarma.** */
  | { readonly que: "dormida"; readonly montadas: number }
  /** Todas las que se esperan están al día. */
  | { readonly que: "al_dia"; readonly hablando: number }
  /** Alguna que debería hablar, calla. **Esto sí es alarma.** */
  | {
      readonly que: "calla";
      readonly callan: readonly UnidadEsperada[];
      readonly hablando: number;
    };

/**
 * El veredicto de la flota.
 *
 * `montadas` son las unidades que cumplen las dos condiciones estables
 * —aparato montado y circuito publicado— aunque ahora estén fuera de horario.
 * Se reporta para que «dormida» pueda decir de cuántas habla y no se confunda
 * con «no hay ninguna configurada», que es otro problema y se ve igual.
 */
export function veredictoDeLaFlota(
  unidades: readonly UnidadEsperada[],
  ahora: Date,
  umbralMinutos: number,
): VeredictoDeLaFlota {
  const enTurno = unidades.filter((u) => seEsperaAhora(u, ahora));
  if (enTurno.length === 0) return { que: "dormida", montadas: unidades.length };

  const callan = enTurno.filter(
    (u) => u.minutosSinHablar === null || u.minutosSinHablar > umbralMinutos,
  );
  const hablando = enTurno.length - callan.length;
  return callan.length === 0 ? { que: "al_dia", hablando } : { que: "calla", callan, hablando };
}

/**
 * El veredicto en palabras — **y que la frase diga lo que pasó.**
 *
 * La lectura vieja decía «dato de GPS más nuevo hace 68.7 h» cuando el dato más
 * nuevo tenía 0.3 h: lo que medía era el peor carrier, no el dato más nuevo.
 * Número correcto, oración falsa. Aquí la oración nombra **qué unidad**, **de
 * qué circuito** y **desde cuándo**, que es lo que alguien necesita para ir a
 * ver el camión.
 */
export function palabrasDeLaFlota(v: VeredictoDeLaFlota): string {
  if (v.que === "dormida") {
    return v.montadas === 0
      ? "ninguna unidad con aparato corre un circuito publicado"
      : `fuera de horario de servicio · ${v.montadas === 1 ? "1 unidad montada" : `${v.montadas} unidades montadas`}, ninguna en turno`;
  }
  if (v.que === "al_dia") {
    return `${v.hablando === 1 ? "1 unidad en turno" : `${v.hablando} unidades en turno`}, todas al día`;
  }
  const detalle = v.callan
    .slice(0, 3)
    .map((u) => {
      const desde =
        u.minutosSinHablar === null
          ? "nunca ha hablado"
          : u.minutosSinHablar < 90
            ? `calla hace ${Math.round(u.minutosSinHablar)} min`
            : `calla hace ${(u.minutosSinHablar / 60).toFixed(1)} h`;
      return `${u.unidad} (${u.circuito}) ${desde}`;
    })
    .join(" · ");
  const resto = v.callan.length > 3 ? ` y ${v.callan.length - 3} más` : "";
  return `${detalle}${resto}`;
}
