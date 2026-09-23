import type { BoletoSellado } from "@jtel/domain/boleto";

/**
 * El pase del pasajero, sin pantalla — Ontoy 3.0 · PR P2
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * **Nada de aquí cobra.** Los viajes se emiten en el propio teléfono con la
 * llave de laboratorio y se compran con dinero de mentira. No hay procesador,
 * no hay banco, no hay cuenta. La valla de `scripts/verificar-sin-cobro.mjs`
 * está para que siga así.
 *
 * ## Los tres estados de un boleto, y por qué son tres
 *
 * El teléfono **no se entera** de si el lector lo aceptó: el validador está sin
 * red y no le habla al celular. Entonces un boleto enseñado queda en el aire
 * hasta que alguien sincronice.
 *
 * - `sin_usar` — comprado y nunca enseñado.
 * - `en_uso` — se enseñó al lector. **No se sabe si pasó.**
 * - `confirmado` — la sincronización dijo que se cobró. Hasta el P3 no hay con
 *   qué llegar aquí, y eso está bien: el estado existe y se queda vacío.
 *
 * Asav decidió esto el 23-sep-2026 sobre tres opciones. Quemar al mostrar le
 * cobraría al pasajero un error del lector —cámara sucia y perdiste el viaje—.
 * No quemar dejaría el pase mintiendo hacia arriba e invitaría a colarse sin
 * querer. La tercera es la única que **no afirma lo que no comprobó**, que es
 * la ley de la casa en todo lo demás: el número baja, y el renglón dice que
 * falta confirmarlo.
 *
 * De ahí sale una regla que parece un detalle y no lo es: **enseñar el pase dos
 * veces no gasta dos viajes.** Si el lector no te dejó subir y lo vuelves a
 * enseñar, vuelve el mismo boleto, no el siguiente.
 */

/** La tarifa la fija el gobierno del estado. Ontoy sólo la muestra, atribuida. */
export const TARIFA_MXN = 13;

/** Lo que se puede comprar. Sin descuento: la tarifa no es nuestra. */
export const PAQUETES: ReadonlyArray<{ viajes: number; apodo: string }> = [
  { viajes: 1, apodo: "viaje por viaje, para hoy" },
  { viajes: 5, apodo: "la semana corta" },
  { viajes: 10, apodo: "quincena de ida y vuelta" },
];

export const precioDe = (viajes: number): number => viajes * TARIFA_MXN;

export type EstadoDeBoleto = "sin_usar" | "en_uso" | "confirmado";

export interface BoletoDelTelefono {
  readonly sellado: BoletoSellado;
  /** La privada del portador, en hex. **Vive sólo en este teléfono.** */
  readonly portadorPrivada: string;
  readonly estado: EstadoDeBoleto;
  /** Cuándo se enseñó al lector, si se enseñó. */
  readonly mostrado?: number;
}

export interface Movimiento {
  readonly cuando: number;
  readonly que: string;
  /** Viajes que entran (+) o salen (−). */
  readonly cambio: number;
  /** Un viaje enseñado que nadie ha confirmado todavía. */
  readonly porConfirmar?: boolean;
}

export interface Pase {
  readonly boletos: readonly BoletoDelTelefono[];
  readonly movimientos: readonly Movimiento[];
  /** Al portador, o ligado a una cuenta. La cuenta es opcional (8.14). */
  readonly cuenta: string | null;
}

export const PASE_VACIO: Pase = { boletos: [], movimientos: [], cuenta: null };

/**
 * Los viajes que el pase puede afirmar que tiene. **No cuenta los enseñados**:
 * ésos ya no son tuyos del todo, y sumarlos sería la mentira hacia arriba.
 */
export const viajesDisponibles = (pase: Pase): number =>
  pase.boletos.filter((b) => b.estado === "sin_usar").length;

/** Los enseñados que nadie confirmó. Se dicen aparte, nunca se esconden. */
export const viajesPorConfirmar = (pase: Pase): number =>
  pase.boletos.filter((b) => b.estado === "en_uso").length;

/**
 * Cuál se enseña ahora.
 *
 * **Primero el que ya estaba en el aire.** Si el lector no te dejó subir y
 * vuelves a enseñar el pase, tiene que volver el mismo boleto: gastar el
 * siguiente te cobraría dos viajes por un camión. Sólo si no hay ninguno en el
 * aire se toma uno sin usar.
 */
export function boletoParaMostrar(pase: Pase): BoletoDelTelefono | null {
  return (
    pase.boletos.find((b) => b.estado === "en_uso") ??
    pase.boletos.find((b) => b.estado === "sin_usar") ??
    null
  );
}

/**
 * Marca un boleto como enseñado y deja el renglón por confirmar.
 *
 * **El renglón no dice la ruta ni la unidad, porque el teléfono no las sabe.**
 * No hay canal del validador al celular: sólo consta que enseñaste el pase.
 * Escribir «Oasis–Centro · unidad 2120» aquí sería inventar el camión al que te
 * subiste. Esos datos los pone la sincronización, cuando exista, y entonces el
 * renglón deja de estar por confirmar.
 */
export function marcarMostrado(pase: Pase, folio: string, ahora: number): Pase {
  const boleto = pase.boletos.find((b) => b.sellado.cuerpo.folio === folio);
  if (!boleto || boleto.estado !== "sin_usar") return pase;
  return {
    ...pase,
    boletos: pase.boletos.map((b) =>
      b.sellado.cuerpo.folio === folio ? { ...b, estado: "en_uso" as const, mostrado: ahora } : b,
    ),
    movimientos: [
      { cuando: ahora, que: "Viaje", cambio: -1, porConfirmar: true },
      ...pase.movimientos,
    ],
  };
}

/** Los viajes comprados entran al pase, con su renglón. */
export function agregarCompra(
  pase: Pase,
  boletos: readonly BoletoDelTelefono[],
  ahora: number,
): Pase {
  const cuantos = boletos.length;
  return {
    ...pase,
    boletos: [...pase.boletos, ...boletos],
    movimientos: [
      {
        cuando: ahora,
        que: `Compra · ${cuantos} viaje${cuantos === 1 ? "" : "s"} (simulada)`,
        cambio: cuantos,
      },
      ...pase.movimientos,
    ],
  };
}

/**
 * El folio como se lee en voz alta: en bloques, para que quepa dictarlo.
 *
 * Es la vía alterna cuando la cámara no puede —la dicta el pasajero y la teclea
 * el chofer—, así que va en dígitos: un teclado de camión no tiene letras.
 * **Esa vía no rota**, y por eso no protege contra una captura como sí lo hace
 * el QR; qué tan acotada debe ir se decide en el P3, con el dato de cada cuánto
 * sincronizan los lectores.
 */
export function codigoParaDictar(folio: string): string {
  const digitos = folio.replace(/\D/g, "").padStart(8, "0").slice(-8);
  return `${digitos.slice(0, 4)} ${digitos.slice(4)}`;
}
