import { describe, it, expect } from "vitest";
import {
  abscisasDeParadas,
  enElTramo,
  escalaDelInstrumento,
  glifoDeLaUnidad,
  laPromesaPide,
  palabraDeLaPromesa,
  porcentajeDeParada,
  porcentajeEnElCarril,
  porQueSinDatos,
  queDibujaLaTorre,
  textoDelInstrumentoVacio,
  textoDeEspera,
  textoDelIntervalo,
  textoDeReferencia,
} from "./torre";
import type { EsperaDeParada, PromesaDeUnidad, Referencia, UnidadEnLaTorre } from "@jtel/services";

/*
 * La aritmética del radar. Lo que estas pruebas defienden es que el dibujo no
 * afirme lo que la medición no sostiene: que la aguja sea el rango y no un
 * punto, que toparse se vea, que un `null` no se dibuje como cero.
 */

/** Una recta sobre el ecuador: 0.009° de longitud ≈ 1 002 m. */
const TRAZADO: Array<[number, number]> = [
  [0, 0],
  [0.009, 0],
];
const M_POR_GRADO = 111_412.84;

const banda = (frecuenciaMin: number, toleranciaPct: number): Referencia => ({
  frecuenciaMin,
  desdeMin: frecuenciaMin * (1 - toleranciaPct / 100),
  hastaMin: frecuenciaMin * (1 + toleranciaPct / 100),
});

describe("escalaDelInstrumento — el eje va de 0 a dos veces la frecuencia", () => {
  it("con ±50 % la banda queda centrada, del 25 al 75 %", () => {
    const e = escalaDelInstrumento(banda(10, 50), null);
    expect(e.bandaDesdePct).toBeCloseTo(25, 6);
    expect(e.bandaHastaPct).toBeCloseTo(75, 6);
  });

  it("una tolerancia más estrecha encoge la banda, y se ve", () => {
    const e = escalaDelInstrumento(banda(10, 20), null);
    expect(e.bandaDesdePct).toBeCloseTo(40, 6);
    expect(e.bandaHastaPct).toBeCloseTo(60, 6);
  });

  it("LA AGUJA ES EL RANGO, no un punto: un paso ancho da una aguja ancha", () => {
    // Un hueco del GPS de 4 minutos: el paso se midió con menos filo, y se ve.
    const fina = escalaDelInstrumento(banda(10, 50), { desdeMin: 9.9, hastaMin: 10.1 });
    const ancha = escalaDelInstrumento(banda(10, 50), { desdeMin: 8, hastaMin: 12 });
    expect(fina.agujaHastaPct - fina.agujaDesdePct).toBeCloseTo(1, 6);
    expect(ancha.agujaHastaPct - ancha.agujaDesdePct).toBeCloseTo(20, 6);
  });

  it("un intervalo enorme topa en la orilla y lo dice, en vez de estirar el eje", () => {
    // 90 min contra una banda de 5–15: estirar el eje aplastaría la banda hasta
    // volverla invisible justo el día que más importa mirarla.
    const e = escalaDelInstrumento(banda(10, 50), { desdeMin: 90, hastaMin: 91 });
    expect(e.agujaDesdePct).toBe(100);
    expect(e.topada).toBe(true);
    // Y la banda sigue donde estaba: no se movió para acomodar al atípico.
    expect(e.bandaDesdePct).toBeCloseTo(25, 6);
  });

  it("sin intervalo no hay aguja, y no se dibuja una en el cero", () => {
    const e = escalaDelInstrumento(banda(10, 50), null);
    expect(e.agujaDesdePct).toBe(0);
    expect(e.agujaHastaPct).toBe(0);
    expect(e.topada).toBe(false);
  });
});

describe("textoDelIntervalo — es un rango, y sólo se escribe como uno cuando lo es", () => {
  it("los dos extremos en el mismo minuto se escriben como un número", () => {
    expect(textoDelIntervalo({ desdeMin: 9.2, hastaMin: 9.4 })).toBe("9 min");
  });

  it("dos minutos distintos se escriben los dos: el instrumento no inventa la hora del paso", () => {
    expect(textoDelIntervalo({ desdeMin: 9.2, hastaMin: 10.4 })).toBe("9–10 min");
  });

  it("sin intervalo, un hueco declarado y nunca un cero", () => {
    expect(textoDelIntervalo(null)).toBe("—");
  });
});

describe("textoDeReferencia — todo número lleva su banda al lado (9.3b)", () => {
  it("dice el rango en minutos", () => {
    expect(textoDeReferencia(banda(10, 50))).toBe("rango 5–15");
  });
  it("sin banda no inventa una", () => {
    expect(textoDeReferencia(null)).toBe("");
  });
});

describe("textoDeEspera — el único reloj que corre frente a quien mira", () => {
  const espera = (minutos: number | null, estado: EsperaDeParada["estado"]): EsperaDeParada =>
    ({ minutos, estado }) as EsperaDeParada;

  it("dentro del rango va en minutos: no pide nada, no necesita segundos", () => {
    expect(textoDeEspera(espera(4.7, "en_rango"))).toBe("4 min");
  });

  it("PASADA LA ORILLA se le agregan los segundos: es una alarma que crece", () => {
    expect(textoDeEspera(espera(19.1, "atrasada"))).toBe("19m 06s");
  });

  it("sin espera que medir, un hueco declarado", () => {
    expect(textoDeEspera(espera(null, "sin_datos"))).toBe("—");
  });
});

describe("abscisasDeParadas — el orden lo manda el trazado, no lo capturado", () => {
  const parada = (stopId: string, lonGrados: number) => ({
    stopId,
    nombre: stopId,
    lat: 0,
    lon: lonGrados,
    sentido: "ida" as const,
  });

  it("ordena por dónde caen sobre el trazado", () => {
    const a = abscisasDeParadas([parada("c", 0.006), parada("a", 0.001), parada("b", 0.003)], TRAZADO, "ida");
    expect(a.map((x) => x.stopId)).toEqual(["a", "b", "c"]);
    expect(a[0]!.avanceMetros).toBeCloseTo(0.001 * M_POR_GRADO, 0);
  });

  it("una parada que sirve los dos sentidos entra en los dos", () => {
    const ambos = [{ stopId: "x", nombre: "X", lat: 0, lon: 0.002, sentido: null }];
    expect(abscisasDeParadas(ambos, TRAZADO, "ida")).toHaveLength(1);
    expect(abscisasDeParadas(ambos, TRAZADO, "vuelta")).toHaveLength(1);
  });

  it("sin trazado no hay dónde colocarlas, y no se inventa un orden", () => {
    expect(abscisasDeParadas([parada("a", 0.001)], null, "ida")).toEqual([]);
  });
});

describe("enElTramo — todo se coloca por tramo, nunca por metros sobre el carril", () => {
  const abscisas = [
    { stopId: "a", nombre: "A", avanceMetros: 0 },
    { stopId: "b", nombre: "B", avanceMetros: 100 },
    { stopId: "c", nombre: "C", avanceMetros: 400 },
  ];

  it("a media distancia entre dos paradas, media fracción de ESE tramo", () => {
    expect(enElTramo(50, abscisas)).toEqual({ desdeIndice: 0, fraccion: 0.5 });
    // Y en el tramo largo, la misma distancia es una fracción mucho menor: es
    // lo que el reparto parejo por metros borraría.
    expect(enElTramo(250, abscisas)).toEqual({ desdeIndice: 1, fraccion: 0.5 });
  });

  it("antes de la primera parada NO se sale del carril: se pega al arranque", () => {
    // Un camión que el GPS ve 40 m antes de la primera parada está en la ruta;
    // dibujarlo fuera del dibujo sería esconderlo.
    expect(enElTramo(-40, abscisas)).toEqual({ desdeIndice: 0, fraccion: 0 });
  });

  it("después de la última se pega al final, sin desbordarse", () => {
    expect(enElTramo(9999, abscisas)).toEqual({ desdeIndice: 1, fraccion: 1 });
  });

  it("con menos de dos paradas no hay tramo, y se dice con null", () => {
    expect(enElTramo(10, [abscisas[0]!])).toBeNull();
  });
});

describe("porcentajes del carril — las paradas van parejas, como un plano de metro", () => {
  it("la primera y la última respetan el margen y no se pegan al borde", () => {
    expect(porcentajeDeParada(0, 4)).toBeCloseTo(3, 6);
    expect(porcentajeDeParada(3, 4)).toBeCloseTo(97, 6);
  });

  it("una unidad a media fracción cae a media distancia entre sus dos marcas", () => {
    const a = porcentajeDeParada(1, 4);
    const b = porcentajeDeParada(2, 4);
    expect(porcentajeEnElCarril({ desdeIndice: 1, fraccion: 0.5 }, 4)).toBeCloseTo((a + b) / 2, 6);
  });
});

describe("glifoDeLaUnidad — la forma sale de la situación, no de la promesa", () => {
  const unidad = (p: Partial<UnidadEnLaTorre>): UnidadEnLaTorre =>
    ({ situacion: "en_ruta", ultimaPosicion: { antiguedadSeg: 5 }, velocidadKmh: 40, ...p }) as UnidadEnLaTorre;

  it("sin una sola posición: la silueta de lo que había, vacía", () => {
    expect(glifoDeLaUnidad(unidad({ ultimaPosicion: null }))).toBe("sin-transmitir");
  });

  it("sin señal fresca: círculo hueco, y sigue en su última posición conocida", () => {
    expect(glifoDeLaUnidad(unidad({ situacion: "sin_senal" }))).toBe("sin-senal");
  });

  it("andando: flecha llena", () => {
    expect(glifoDeLaUnidad(unidad({ velocidadKmh: 41.6 }))).toBe("en-movimiento");
  });

  it("VELOCIDAD NULA NO ES CERO: sin ese dato no se afirma movimiento, pero tampoco se niega", () => {
    // El aparato no la reporta. Se dibuja el círculo —«presente, sin dirección»—
    // en vez de una flecha que afirmaría un rumbo que nadie observó.
    expect(glifoDeLaUnidad(unidad({ velocidadKmh: null }))).toBe("detenida");
  });

  it("un GPS quieto oscila: por debajo de 1 km/h es detenida, no en movimiento", () => {
    expect(glifoDeLaUnidad(unidad({ velocidadKmh: 0.4 }))).toBe("detenida");
  });

  it("una unidad ATRASADA que se mueve sigue dibujándose en movimiento", () => {
    // Los dos ejes: si la forma dijera «atrasada», un camión detenido y uno
    // atrasado compartirían silueta.
    expect(glifoDeLaUnidad(unidad({ velocidadKmh: 30 }))).toBe("en-movimiento");
  });
});

describe("las palabras de pantalla (9.3b)", () => {
  const promesa = (p: Partial<PromesaDeUnidad>): PromesaDeUnidad =>
    ({ estado: "en_rango", motivo: null, intervalo: null, referencia: null, medidoEn: null, ...p }) as PromesaDeUnidad;

  it("las cuatro palabras, y el guion de lo que no aplica", () => {
    expect(palabraDeLaPromesa(promesa({ estado: "en_rango" }))).toBe("EN RANGO");
    expect(palabraDeLaPromesa(promesa({ estado: "adelantada" }))).toBe("ADELANTADA");
    expect(palabraDeLaPromesa(promesa({ estado: "atrasada" }))).toBe("ATRASADA");
    expect(palabraDeLaPromesa(promesa({ estado: "sin_datos" }))).toBe("SIN DATOS");
    expect(palabraDeLaPromesa(promesa({ estado: "no_aplica" }))).toBe("—");
  });

  it("sólo adelantada y atrasada piden algo: SIN DATOS no manda a perseguir nada", () => {
    expect(laPromesaPide(promesa({ estado: "adelantada" }))).toBe(true);
    expect(laPromesaPide(promesa({ estado: "atrasada" }))).toBe(true);
    expect(laPromesaPide(promesa({ estado: "sin_datos" }))).toBe(false);
    expect(laPromesaPide(promesa({ estado: "en_rango" }))).toBe(false);
    expect(laPromesaPide(promesa({ estado: "no_aplica" }))).toBe(false);
  });

  it("SIN_PROMESA NO sale por unidad: es hueco del circuito y se dice una vez arriba", () => {
    // Repetirlo en cuatro piezas manda al operador a buscar cuatro problemas
    // donde hay uno, y donde no se arregla.
    expect(porQueSinDatos(promesa({ estado: "sin_datos", motivo: "sin_promesa" }))).toBeNull();
  });

  it("EL INSTRUMENTO NO DICE «sin pasos que medir» de un camión que tiene pasos", () => {
    /*
     * El defecto que enseñó la primera captura, y que ninguna prueba de tipos
     * iba a encontrar: fuera de horario la promesa es `no_aplica`, la palabra
     * de arriba decía «—» —correcto— y el instrumento de abajo decía «sin pasos
     * que medir» de una unidad con quince pasos medidos. Dato correcto arriba,
     * afirmación falsa abajo (Marco §D).
     *
     * `null` = no se dibuja: lo que no aplica no se muestra, ni vacío.
     */
    expect(textoDelInstrumentoVacio(promesa({ estado: "no_aplica" }))).toBeNull();
  });

  it("cada hueco del instrumento se nombra por lo que es", () => {
    expect(textoDelInstrumentoVacio(promesa({ estado: "sin_datos", motivo: "sin_pasos" }))).toBe(
      "sin pasos que medir",
    );
    expect(textoDelInstrumentoVacio(promesa({ estado: "sin_datos", motivo: "sin_promesa" }))).toContain(
      "sin promesa capturada",
    );
    expect(textoDelInstrumentoVacio(promesa({ estado: "sin_datos", motivo: "flujo_incompleto" }))).toContain(
      "flujo incompleto",
    );
  });

  it("los otros tres motivos sí se dicen donde están", () => {
    expect(porQueSinDatos(promesa({ motivo: "sin_pasos" }))).toBe("sin pasos que medir");
    expect(porQueSinDatos(promesa({ motivo: "a_caballo" }))).toContain("no concluye");
    expect(porQueSinDatos(promesa({ motivo: "flujo_incompleto" }))).toContain("más de un transportista");
  });
});

describe("queDibujaLaTorre · la caja vacía es sólo cuando no hay nada que dibujar", () => {
  const p = (id: string, m: number) => ({ stopId: id, nombre: id, avanceMetros: m });

  it("sin paradas capturadas: la caja lo dice", () => {
    expect(queDibujaLaTorre({ ida: [], vuelta: [] }, 0, 3)).toMatchObject({
      tipo: "vacia",
      titulo: "Sin paradas capturadas",
    });
  });

  it("con paradas fuera del trazado NO dice «sin unidades asignadas», aunque tenga unidades", () => {
    const r = queDibujaLaTorre({ ida: [], vuelta: [] }, 4, 2);
    expect(r.tipo).toBe("vacia");
    if (r.tipo === "vacia") expect(r.titulo).not.toMatch(/unidades/i);
  });

  it("un sentido con una sola parada no alcanza para un carril", () => {
    expect(queDibujaLaTorre({ ida: [p("a", 0)], vuelta: [] }, 1, 1).tipo).toBe("vacia");
  });

  it("con paradas y SIN unidades asignadas se dibuja el radar, y lo declara", () => {
    expect(queDibujaLaTorre({ ida: [p("a", 0), p("b", 500)], vuelta: [] }, 2, 0)).toEqual({
      tipo: "radar",
      sentidos: ["ida"],
      sinUnidadesAsignadas: true,
    });
  });

  it("sólo entran los sentidos que tienen carril", () => {
    const r = queDibujaLaTorre({ ida: [p("a", 0)], vuelta: [p("c", 0), p("d", 900)] }, 3, 2);
    expect(r).toEqual({ tipo: "radar", sentidos: ["vuelta"], sinUnidadesAsignadas: false });
  });
});
