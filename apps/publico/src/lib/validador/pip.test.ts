import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * **El pip.** Este archivo no tenía pruebas, y es lo único del lector en lo que
 * el chofer confía **sin mirar**: va manejando y sólo oye. Si el sonido deja de
 * distinguir un sí de un no, nadie se entera mirando la pantalla — y un pasajero
 * con un boleto rechazado se sube igual.
 *
 * Aquí no hay navegador, así que se pone un `AudioContext` de mentira que
 * anota lo que le piden. Lo que se comprueba no es el timbre: es que **los dos
 * veredictos suenan distinto**, y que sin sonido el lector sigue sirviendo.
 */

interface TonoPedido {
  frecuencia: number;
  empieza: number;
  para: number;
}

let pedidos: TonoPedido[] = [];
let contextosCreados = 0;
let alCrear: (() => void) | null = null;

class OsciladorFalso {
  type = "";
  frequency = { value: 0 };
  private empieza = 0;
  connect(destino: unknown) {
    return destino as { connect: (d: unknown) => unknown };
  }
  start(t: number) {
    this.empieza = t;
  }
  stop(t: number) {
    pedidos.push({ frecuencia: this.frequency.value, empieza: this.empieza, para: t });
  }
}

class ContextoFalso {
  currentTime = 0;
  destination = {};
  constructor() {
    contextosCreados += 1;
    alCrear?.();
  }
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return new OsciladorFalso();
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (destino: unknown) => destino,
    };
  }
}

async function cargarElPip() {
  vi.resetModules();
  (globalThis as { AudioContext?: unknown }).AudioContext = ContextoFalso;
  return import("./pip");
}

beforeEach(() => {
  pedidos = [];
  contextosCreados = 0;
  alCrear = null;
});

describe("el pip sale del aparato del camión", () => {
  /*
   * El navegador no deja sonar hasta que alguien toca la pantalla. Si el pip
   * intentara sonar antes de ese gesto, el primer boleto del día pasaría en
   * silencio — el peor momento posible para que el chofer no oiga nada.
   */
  it("sin el gesto de encender, no suena y no revienta", async () => {
    const { pip } = await cargarElPip();
    expect(() => pip(true)).not.toThrow();
    expect(pedidos).toEqual([]);
  });

  it("encender abre el contexto una sola vez, aunque se toque de más", async () => {
    const { despertarElSonido } = await cargarElPip();
    despertarElSonido();
    despertarElSonido();
    despertarElSonido();
    expect(contextosCreados).toBe(1);
  });

  /*
   * Lo que esta prueba protege es la regla de diseño: **se distinguen sin
   * mirar**. Uno corto y agudo si pasa; dos graves si no.
   */
  it("un boleto bueno suena una vez", async () => {
    const { despertarElSonido, pip } = await cargarElPip();
    despertarElSonido();
    pip(true);
    expect(pedidos.length).toBe(1);
  });

  it("uno rechazado suena dos veces, y separadas", async () => {
    const { despertarElSonido, pip } = await cargarElPip();
    despertarElSonido();
    pip(false);
    expect(pedidos.length).toBe(2);
    /* El segundo empieza después de que el primero terminó: se oyen dos, no uno largo. */
    expect(pedidos[1]!.empieza).toBeGreaterThan(pedidos[0]!.para - 0.05);
  });

  it("el sí es agudo y el no es grave: no se confunden de oído", async () => {
    const { despertarElSonido, pip } = await cargarElPip();
    despertarElSonido();
    pip(true);
    const [si] = pedidos;
    pedidos = [];
    pip(false);
    const [no] = pedidos;
    /* Más de una octava de distancia: ni un altavoz malo los junta. */
    expect(si!.frecuencia).toBeGreaterThan(no!.frecuencia * 2);
  });

  it("el sí es corto: no estorba al siguiente pasajero", async () => {
    const { despertarElSonido, pip } = await cargarElPip();
    despertarElSonido();
    pip(true);
    expect(pedidos[0]!.para - pedidos[0]!.empieza).toBeLessThan(0.25);
  });

  /*
   * Un teléfono sin audio disponible no puede tumbar el lector: queda el
   * semáforo, que es la otra mitad del veredicto.
   */
  it("si el aparato no da sonido, el lector sigue sirviendo", async () => {
    const { despertarElSonido, pip } = await cargarElPip();
    alCrear = () => {
      throw new Error("sin audio");
    };
    expect(() => despertarElSonido()).not.toThrow();
    expect(() => pip(true)).not.toThrow();
    expect(() => pip(false)).not.toThrow();
  });
});
