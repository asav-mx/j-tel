import { describe, expect, it } from "vitest";
import {
  animoDeTino,
  avanzarLaCalle,
  calleNueva,
  LARGO,
  LARGO_DE_UNA_PARADA,
  loQueDiceLaPlaca,
  type EstadoDeLaParada,
} from "./trafico";

/*
 * La calle del hero es ilustración, y casi nada de ella se prueba: que un coche
 * se cambie de carril con gracia no es una afirmación, es un dibujo.
 *
 * **Lo que sí se prueba es lo único que afirma algo: la placa de Tino.** Porque
 * es un número con una unidad delante de un pasajero, y ésa es exactamente la
 * clase de renglón que puede decir la verdad y mentir al mismo tiempo.
 */

const parada = (p: Partial<EstadoDeLaParada> = {}): EstadoDeLaParada => ({
  enLaParada: false,
  llegando: false,
  seTarda: false,
  seAcabaDeIr: false,
  falta: 900,
  ...p,
});

describe("lo que dice la placa de Tino", () => {
  it("NO dice minutos: la versión 1 de Ontoy no los da", () => {
    /*
     * Es la razón de ser de esta prueba. El prototipo traía `1′ 2′ 3′ 4′`, y
     * mientras la velocidad del corredor no esté calibrada la app dice a
     * cuántas paradas viene (8.9b) — «llega en 2 min» está en la lista de lo
     * que NO entra en la versión 1.
     *
     * Se revisan todas las distancias de una vuelta entera, no un par de casos
     * sueltos: lo que se quiere impedir es que un minuto se cuele por CUALQUIER
     * valor, no por los tres que a alguien se le ocurrió escribir.
     */
    for (let falta = 0; falta <= LARGO; falta += 25) {
      const dicho = loQueDiceLaPlaca(parada({ falta }));
      expect(dicho, `con falta=${falta}`).not.toMatch(/′|min/);
    }
  });

  it("escribe la unidad: «a 3» a secas se leería como minutos", () => {
    /*
     * Un número correcto con la unidad equivocada es una afirmación falsa. En
     * la placa de una parada, «a 3» se lee como tres minutos con la misma
     * facilidad que como tres paradas, y quien lo lee no tiene forma de saber
     * cuál de las dos le están diciendo.
     */
    for (let falta = 25; falta <= LARGO; falta += 25) {
      expect(loQueDiceLaPlaca(parada({ falta })), `con falta=${falta}`).toMatch(
        /parada/,
      );
    }
  });

  it("cuenta hacia atrás conforme Cami se acerca", () => {
    const lejos = loQueDiceLaPlaca(
      parada({ falta: LARGO_DE_UNA_PARADA * 3.5 }),
    );
    const cerca = loQueDiceLaPlaca(
      parada({ falta: LARGO_DE_UNA_PARADA * 0.5 }),
    );
    expect(lejos).toBe("a 4 paradas");
    expect(cerca).toBe("a 1 parada");
  });

  it("dice «a 1 parada» en singular, no «a 1 paradas»", () => {
    expect(loQueDiceLaPlaca(parada({ falta: 10 }))).toBe("a 1 parada");
  });

  it("con Cami enfrente dice «¡ya!», y eso no lleva número", () => {
    expect(loQueDiceLaPlaca(parada({ enLaParada: true, falta: 0 }))).toBe(
      "¡ya!",
    );
  });

  it("nunca pasa de cuatro, por lejos que venga", () => {
    expect(loQueDiceLaPlaca(parada({ falta: LARGO * 10 }))).toBe("a 4 paradas");
  });

  it("nunca dice «a 0 paradas»: si no ha llegado, viene a una", () => {
    /*
     * El caso que se cuela solo: con la distancia casi en cero pero Cami
     * todavía en marcha, un redondeo hacia abajo diría «a 0 paradas», que es
     * la forma numérica de decir «ya llegó» cuando no ha llegado.
     */
    for (const falta of [0, 0.4, 1, 5]) {
      expect(loQueDiceLaPlaca(parada({ falta })), `con falta=${falta}`).toBe(
        "a 1 parada",
      );
    }
  });
});

describe("el ánimo de Tino", () => {
  it("se pone contento cuando lo ve venir, cuando lo tiene y cuando acaba de irse", () => {
    expect(animoDeTino(parada({ llegando: true }))).toBe(1);
    expect(animoDeTino(parada({ enLaParada: true }))).toBe(1);
    expect(animoDeTino(parada({ seAcabaDeIr: true }))).toBe(1);
  });

  it("se pone triste cuando se tarda — que es esperar, no una alarma", () => {
    expect(animoDeTino(parada({ seTarda: true }))).toBe(-1);
  });

  it("el resto del tiempo no dice nada", () => {
    expect(animoDeTino(parada())).toBe(0);
  });
});

describe("la calle rueda", () => {
  it("los vehículos avanzan y dan la vuelta sin salirse ni encimarse", () => {
    const calle = calleNueva();
    for (let i = 0; i < 4000; i++) avanzarLaCalle(calle, 1 / 60, i / 60);

    for (const v of calle.vehiculos) {
      expect(Number.isFinite(v.x), "una posición se fue a NaN").toBe(true);
      expect(v.x).toBeLessThanOrEqual(1450);
      expect(v.x).toBeGreaterThan(-LARGO);
      expect(v.v).toBeGreaterThanOrEqual(0);
      expect(v.carril).toBeGreaterThan(-0.2);
      expect(v.carril).toBeLessThan(1.2);
    }
  });

  it("Cami se para en la parada, y no una sola vez", () => {
    const calle = calleNueva();
    let paradas = 0;
    let estabaParado = false;
    for (let i = 0; i < 9000; i++) {
      avanzarLaCalle(calle, 1 / 60, i / 60);
      const parado = calle.esperandoDesde != null;
      if (parado && !estabaParado) paradas++;
      estabaParado = parado;
    }
    expect(
      paradas,
      "Cami tiene que parar varias veces en 150 s",
    ).toBeGreaterThan(1);
  });

  it("la obra se cambia de sitio con el tiempo", () => {
    const calle = calleNueva();
    const sitios = new Set<number>();
    for (let i = 0; i < 12000; i++) {
      avanzarLaCalle(calle, 1 / 60, i / 60);
      sitios.add(calle.obraX);
    }
    expect(
      sitios.size,
      "la obra tiene que aparecer en varios sitios",
    ).toBeGreaterThan(2);
  });

  it("la placa nunca dice minutos, tampoco con la calle rodando de verdad", () => {
    /*
     * Lo de arriba prueba la función suelta. Esto la prueba con las
     * distancias que la simulación produce de verdad, incluida la vuelta
     * completa cuando Cami ya pasó — que es donde el número se vuelve grande y
     * raro.
     */
    const calle = calleNueva();
    for (let i = 0; i < 9000; i++) {
      avanzarLaCalle(calle, 1 / 60, i / 60);
      const dicho = loQueDiceLaPlaca(calle.parada);
      expect(dicho).not.toMatch(/′|min/);
      expect(dicho).toMatch(/^(¡ya!|a [1-4] paradas?)$/);
    }
  });
});
