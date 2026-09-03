import { describe, expect, it } from "vitest";
import {
  CAMINATA_METROS,
  circuitoQueSirve,
  tramoDelTrazado,
  type TrazadoParaBuscar,
} from "./buscador.js";
import { largoDeTrazado } from "./trazado.js";

/*
 * Geometría de prueba, a la latitud de Juárez (31.70), donde 0.001° de longitud
 * ≈ 95 m y 0.001° de latitud ≈ 111 m.
 *
 * Dos calles paralelas de sentido único, que es la forma real del circuito 1:
 * la ida y la vuelta NO son el mismo trazado invertido.
 */
const IDA: TrazadoParaBuscar = {
  sentido: "ida",
  // De poniente a oriente sobre lat 31.7000. ~1 890 m.
  coordenadas: [
    [-106.4200, 31.7000],
    [-106.4100, 31.7000],
    [-106.4000, 31.7000],
  ],
};

const VUELTA: TrazadoParaBuscar = {
  sentido: "vuelta",
  // De oriente a poniente, una cuadra al sur (~111 m).
  coordenadas: [
    [-106.4000, 31.6990],
    [-106.4100, 31.6990],
    [-106.4200, 31.6990],
  ],
};

const CIRCUITO = [IDA, VUELTA];

/** Sobre la calle de ida, a 11 m de ella. */
const sobreLaIda = (lon: number) => ({ lat: 31.7001, lon });

describe("circuitoQueSirve — cuando sí sirve", () => {
  it("dos puntos sobre la ruta y en orden: dice por dónde subir y dónde bajar", () => {
    const r = circuitoQueSirve(sobreLaIda(-106.418), sobreLaIda(-106.404), CIRCUITO);

    expect(r.sirve).toBe(true);
    if (!r.sirve) return;
    expect(r.sentido).toBe("ida");
    // 0.014° de longitud a esta latitud ≈ 1 325 m.
    expect(r.recorridoMetros).toBeGreaterThan(1200);
    expect(r.recorridoMetros).toBeLessThan(1450);
    // Los dos extremos quedan a menos de una cuadra: se pegan a la calle de ida.
    expect(r.subir.caminataMetros).toBeLessThan(20);
    expect(r.bajar.caminataMetros).toBeLessThan(20);
    expect(r.bajar.avanceMetros).toBeGreaterThan(r.subir.avanceMetros);
  });

  it("EL MISMO PAR AL REVÉS sale por la vuelta, no por la ida", () => {
    // Es la mitad de la pregunta: una ruta que pasa cerca de los dos puntos
    // pero en el sentido contrario no lleva a nadie. Aquí la vuelta sí los pasa
    // en orden, y está una cuadra al sur — dentro de lo que se camina.
    const r = circuitoQueSirve(sobreLaIda(-106.404), sobreLaIda(-106.418), CIRCUITO);

    expect(r.sirve).toBe(true);
    if (!r.sirve) return;
    expect(r.sentido).toBe("vuelta");
    // Se cruza la calle: ~111 m de una acera a la otra.
    expect(r.subir.caminataMetros).toBeGreaterThan(80);
    expect(r.subir.caminataMetros).toBeLessThan(140);
  });

  it("con los dos sentidos sirviendo, gana el recorrido a bordo más corto", () => {
    /*
     * Un circuito que cierra: la «vuelta» rodea por el sur y también pasa por
     * los dos puntos en orden, dando la vuelta entera. No proponerle al
     * pasajero los kilómetros de más es la única razón de este desempate.
     */
    const RODEO: TrazadoParaBuscar = {
      sentido: "vuelta",
      coordenadas: [
        [-106.4200, 31.7000],
        [-106.4200, 31.6800],
        [-106.4000, 31.6800],
        [-106.4000, 31.7000],
      ],
    };

    const r = circuitoQueSirve(
      sobreLaIda(-106.418),
      sobreLaIda(-106.4035),
      [IDA, RODEO],
      600, // umbral holgado: lo que se prueba aquí es el desempate, no el umbral
    );

    expect(r.sirve).toBe(true);
    if (!r.sirve) return;
    expect(r.sentido).toBe("ida");
    expect(r.recorridoMetros).toBeLessThan(1500);
  });
});

describe("circuitoQueSirve — cuando no sirve, y por qué", () => {
  it("el destino queda lejos del recorrido, y lo dice con su número", () => {
    // ~2.2 km al norte de la ruta.
    const r = circuitoQueSirve(sobreLaIda(-106.418), { lat: 31.7200, lon: -106.404 }, CIRCUITO);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("lejos_de_donde_vas");
    expect(r.caminataDeDondeEstasMetros).toBeLessThan(20);
    expect(r.caminataDeDondeVasMetros).toBeGreaterThan(2000);
  });

  it("el pasajero queda lejos del recorrido, aunque su destino esté encima", () => {
    const r = circuitoQueSirve({ lat: 31.7200, lon: -106.418 }, sobreLaIda(-106.404), CIRCUITO);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("lejos_de_donde_estas");
    expect(r.caminataDeDondeEstasMetros).toBeGreaterThan(2000);
    expect(r.caminataDeDondeVasMetros).toBeLessThan(20);
  });

  it("los dos lejos es un motivo propio: no se disfraza de uno de los otros", () => {
    const r = circuitoQueSirve(
      { lat: 31.7200, lon: -106.418 },
      { lat: 31.7200, lon: -106.404 },
      CIRCUITO,
    );

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("los_dos_lejos");
  });

  it("NO SE INVENTA LA VUELTA: con un solo sentido, al revés no sirve", () => {
    /*
     * El caso que protege la ley del tramo. Un circuito puede tener cargado un
     * solo trazado, y deducir el otro invirtiéndolo daría una respuesta que
     * nadie midió: en el circuito 1 la ida y la vuelta miden 20.83 y 16.44 km
     * por los sentidos únicos del Centro.
     *
     * Se contesta «en ese orden no», que es lo que el sistema sí sabe: los dos
     * puntos están sobre la ruta, y el camión pasa primero por el destino.
     */
    const r = circuitoQueSirve(sobreLaIda(-106.404), sobreLaIda(-106.418), [IDA]);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("en_ese_orden_no");
    // Y aun así reporta lo medido: los dos están a un paso de la ruta.
    expect(r.caminataDeDondeEstasMetros).toBeLessThan(20);
    expect(r.caminataDeDondeVasMetros).toBeLessThan(20);
  });

  it("«en ese orden no» gana a una falla de distancia: afirma más y es cierto", () => {
    /*
     * La ida pasa por los dos puntos en el orden equivocado; la vuelta queda
     * lejísimos. Contestar «queda lejos» sería decir menos de lo que se sabe.
     */
    const VUELTA_LEJOS: TrazadoParaBuscar = {
      sentido: "vuelta",
      coordenadas: [
        [-106.4000, 31.6500],
        [-106.4200, 31.6500],
      ],
    };

    const r = circuitoQueSirve(sobreLaIda(-106.404), sobreLaIda(-106.418), [IDA, VUELTA_LEJOS]);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("en_ese_orden_no");
  });

  it("un viaje más corto que la caminata se dice, en vez de proponer un camión", () => {
    // 0.0003° de longitud ≈ 28 m sobre el recorrido.
    const r = circuitoQueSirve(sobreLaIda(-106.4040), sobreLaIda(-106.4037), CIRCUITO);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("mejor_camina");
  });

  it("un trazado de menos de dos puntos no es un recorrido, y no se mide", () => {
    const r = circuitoQueSirve(sobreLaIda(-106.418), sobreLaIda(-106.404), [
      { sentido: "ida", coordenadas: [[-106.41, 31.7]] },
    ]);

    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.motivo).toBe("los_dos_lejos");
    // Sin nada medido, no se inventa un número: va en nulo.
    expect(r.caminataDeDondeEstasMetros).toBeNull();
    expect(r.caminataDeDondeVasMetros).toBeNull();
  });

  it("sin trazados no se afirma nada", () => {
    const r = circuitoQueSirve(sobreLaIda(-106.418), sobreLaIda(-106.404), []);
    expect(r.sirve).toBe(false);
    if (r.sirve) return;
    expect(r.caminataDeDondeEstasMetros).toBeNull();
  });
});

describe("el umbral de caminata", () => {
  it("entra por parámetro: el mismo par sirve o no según cuánto se camine", () => {
    // Sobre la ida, pero a ~222 m al norte de ella.
    const lejitos = (lon: number) => ({ lat: 31.7020, lon });

    const conHolgura = circuitoQueSirve(lejitos(-106.418), lejitos(-106.404), CIRCUITO, 400);
    const conMano = circuitoQueSirve(lejitos(-106.418), lejitos(-106.404), CIRCUITO, 100);

    expect(conHolgura.sirve).toBe(true);
    expect(conMano.sirve).toBe(false);
  });

  it("el valor de origen es el que se usa cuando nadie pasa uno", () => {
    // Si alguien cambia CAMINATA_METROS, esta prueba lo obliga a mirar el par
    // de arriba: los 222 m de «lejitos» dejan de servir por debajo de eso.
    expect(CAMINATA_METROS).toBe(400);
  });

  it("no se toma prestada la tolerancia del corredor, que hoy vale 150", () => {
    /*
     * `corridor_tolerance_meters` es del instrumento —a qué distancia del
     * trazado un camión sigue en ruta— y vale 150 m de origen. Si algún día
     * alguien las funde, este par de puntos a 222 m deja de servir sin que
     * nadie haya decidido que un pasajero camina menos.
     */
    const lejitos = (lon: number) => ({ lat: 31.7020, lon });
    const r = circuitoQueSirve(lejitos(-106.418), lejitos(-106.404), CIRCUITO, 150);
    expect(r.sirve).toBe(false);
  });
});

describe("tramoDelTrazado", () => {
  /* Una «U»: baja, cruza al oriente, y sube. Cortarla de punta a punta en
     recta la atravesaría por donde el camión nunca pasa. */
  const U: Array<[number, number]> = [
    [-106.4200, 31.7000],
    [-106.4200, 31.6900],
    [-106.4000, 31.6900],
    [-106.4000, 31.7000],
  ];

  it("empieza y termina en los puntos pegados, no en los vértices", () => {
    const t = tramoDelTrazado(U, 500, 1500);
    expect(t.length).toBeGreaterThanOrEqual(2);
    // El primer punto cae a media bajada, no en el vértice de arriba.
    expect(t[0][1]).toBeGreaterThan(31.69);
    expect(t[0][1]).toBeLessThan(31.7);
  });

  it("CONSERVA LOS VÉRTICES DE EN MEDIO: no cruza por donde el camión no pasa", () => {
    /*
     * La §E del Marco aplicada a una línea. De punta a punta, una recta entre
     * los dos extremos de la «U» pasaría por el hueco del centro —terreno que
     * el recorrido no recorre— y se vería más limpia que la verdad.
     */
    const largo = largoDeTrazado(U);
    const t = tramoDelTrazado(U, 10, largo - 10);

    // Los dos vértices del fondo de la U siguen ahí.
    expect(t.some(([, lat]) => Math.abs(lat - 31.69) < 1e-9)).toBe(true);
    expect(t.length).toBeGreaterThan(3);
  });

  it("un tramo sin largo no se dibuja", () => {
    expect(tramoDelTrazado(U, 800, 800)).toEqual([]);
    expect(tramoDelTrazado(U, 900, 400)).toEqual([]);
  });

  it("un trazado de menos de dos puntos no es un recorrido", () => {
    expect(tramoDelTrazado([[-106.41, 31.7]], 0, 100)).toEqual([]);
  });

  it("se corta contra los MISMOS avances que midió la búsqueda", () => {
    /*
     * Es la razón de que esta función viva aquí y no en la pantalla: el tramo
     * que se pinta y el viaje que se afirma salen de los mismos dos números.
     */
    const r = circuitoQueSirve(sobreLaIda(-106.418), sobreLaIda(-106.404), CIRCUITO);
    expect(r.sirve).toBe(true);
    if (!r.sirve) return;

    const t = tramoDelTrazado(IDA.coordenadas, r.subir.avanceMetros, r.bajar.avanceMetros);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t[0][0]).toBeCloseTo(-106.418, 3);
    expect(t[t.length - 1][0]).toBeCloseTo(-106.404, 3);
  });
});
