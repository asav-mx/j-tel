import { describe, it, expect } from "vitest";
import {
  avanceSobreTrazado,
  velocidadDelCorredor,
  permisoDeRango,
  rangoDeLlegada,
  proximaLlegada,
  type PermisoDeRango,
  type RangoDeLlegada,
} from "./llegada.js";

/* Una avenida recta de norte a sur. Cada 0.01° de latitud son ~1.11 km. */
const AVENIDA: Array<[number, number]> = [
  [-106.45, 31.70],
  [-106.45, 31.72],
  [-106.45, 31.74],
];

describe("avance sobre el trazado", () => {
  it("mide cuánto lleva recorrido y a qué distancia del trazado está", () => {
    const a = avanceSobreTrazado({ lat: 31.71, lon: -106.45 }, AVENIDA, 150);
    expect(a).not.toBeNull();
    expect(a!.avanceMetros).toBeGreaterThan(1000);
    expect(a!.avanceMetros).toBeLessThan(1200);
    expect(a!.distanciaMetros).toBeLessThan(1);
  });

  it("fuera del corredor devuelve null: ahí no se puede afirmar nada", () => {
    const lejos = { lat: 31.71, lon: -106.48 }; // ~2.8 km
    expect(avanceSobreTrazado(lejos, AVENIDA, 150)).toBeNull();
  });

  it("el corredor es parámetro, no una constante escondida", () => {
    const aMediaCuadra = { lat: 31.71, lon: -106.4512 }; // ~114 m
    expect(avanceSobreTrazado(aMediaCuadra, AVENIDA, 150)).not.toBeNull();
    expect(avanceSobreTrazado(aMediaCuadra, AVENIDA, 50)).toBeNull();
  });
});

describe("velocidad del corredor", () => {
  it("sin muestras usa la declarada, y lo dice", () => {
    expect(velocidadDelCorredor(20.5, [])).toEqual({ kmh: 20.5, origen: "declarada" });
  });

  it("con una sola muestra todavía usa la declarada", () => {
    const una = [{ metros: 200, segundos: 30 }];
    expect(velocidadDelCorredor(20.5, una).origen).toBe("declarada");
  });

  it("con dos muestras buenas usa lo medido", () => {
    // 200 m en 30 s = 24 km/h.
    const muestras = [
      { metros: 200, segundos: 30 },
      { metros: 200, segundos: 30 },
    ];
    const v = velocidadDelCorredor(20.5, muestras);
    expect(v.origen).toBe("medida");
    expect(v.kmh).toBeCloseTo(24, 1);
  });

  it("descarta el temblor del GPS: veinte metros en cinco segundos no es un camión", () => {
    const temblor = [
      { metros: 20, segundos: 5 },
      { metros: 25, segundos: 6 },
    ];
    // Ninguna pasa el mínimo de tiempo ni de metros, así que no hay medición.
    expect(velocidadDelCorredor(20.5, temblor).origen).toBe("declarada");
  });

  it("descarta velocidades imposibles para un camión urbano", () => {
    const salto = [
      { metros: 5000, segundos: 30 }, // 600 km/h
      { metros: 4000, segundos: 25 },
    ];
    expect(velocidadDelCorredor(20.5, salto).origen).toBe("declarada");
  });

  it("usa la mediana: un camión atorado no arrastra a los demás", () => {
    const muestras = [
      { metros: 200, segundos: 30 }, // 24 km/h
      { metros: 210, segundos: 30 }, // 25.2
      { metros: 35, segundos: 60 }, // 2.1 — atorado en un semáforo largo
    ];
    const v = velocidadDelCorredor(20.5, muestras);
    expect(v.origen).toBe("medida");
    // La mediana es 24, no el promedio (17.1) que el atorado habría jalado.
    expect(v.kmh).toBeCloseTo(24, 1);
  });
});

// A 20.5 km/h se recorren 5.694 m/s. Mil metros son ~176 s.
const VEL = 20.5;
const PISO = 180;

/** El permiso de un circuito calibrado, sobre una posición fresca. */
const permiso = (velocidadKmh = VEL, pisoSegundos = PISO): PermisoDeRango =>
  permisoDeRango({ rangoActivo: true, posicionFresca: true, velocidadKmh, pisoSegundos })!;

describe("el permiso para afirmar un tiempo", () => {
  /*
   * Las dos condiciones que gobiernan el permiso son las dos que se olvidaron
   * en cuatro de los cinco sitios que podían fabricar un minuto. Aquí quedan
   * en un solo lugar, y cada una con su prueba.
   */

  it("con el interruptor del circuito apagado no hay permiso", () => {
    expect(
      permisoDeRango({
        rangoActivo: false,
        posicionFresca: true,
        velocidadKmh: VEL,
        pisoSegundos: PISO,
      }),
    ).toBeNull();
  });

  it("desde una posición vieja no hay permiso, aunque el interruptor esté prendido", () => {
    /*
     * Éste es el defecto que sobrevivía a encender el rango: el hilo de paradas
     * calculaba desde camiones que la propia app pintaba grises con «hace N
     * min». Un camión que perdió señal no se fue a ningún lado —por eso se
     * sigue dibujando—, pero de dónde está AHORA no se sabe nada.
     */
    expect(
      permisoDeRango({
        rangoActivo: true,
        posicionFresca: false,
        velocidadKmh: VEL,
        pisoSegundos: PISO,
      }),
    ).toBeNull();
  });

  it("una velocidad de cero no divide entre cero: tampoco hay permiso", () => {
    expect(
      permisoDeRango({
        rangoActivo: true,
        posicionFresca: true,
        velocidadKmh: 0,
        pisoSegundos: PISO,
      }),
    ).toBeNull();
  });

  it("con las dos condiciones cumplidas, el permiso lleva la velocidad adentro", () => {
    const p = permisoDeRango({
      rangoActivo: true,
      posicionFresca: true,
      velocidadKmh: VEL,
      pisoSegundos: PISO,
    });
    expect(p).not.toBeNull();
    expect(p!.velocidadKmh).toBe(VEL);
    expect(p!.pisoSegundos).toBe(PISO);
  });
});

describe("la valla: fabricar un minuto sin permiso no COMPILA", () => {
  /*
   * Esto no es una prueba de comportamiento — no hay valor que comparar. Es la
   * demostración de la valla, y se lee al revés que una prueba normal.
   *
   * Cada `@ts-expect-error` de abajo exige que la línea siguiente FALLE al
   * compilar. Si alguien vuelve a ensanchar la firma para aceptar una velocidad
   * suelta, o afloja `PermisoDeRango` a un objeto cualquiera, esas líneas
   * empiezan a compilar — y entonces `tsc` falla con «Unused '@ts-expect-error'
   * directive». La valla se queja cuando DEJA de hacer falta, que es lo único
   * que la distingue de una convención con otro nombre.
   *
   * Corre en `pnpm --filter @jtel/domain build`: el tsconfig del paquete
   * incluye todo `src`, y eso alcanza a este archivo.
   */

  /*
   * Las tres de abajo se DECLARAN y nunca se llaman, y eso es del diseño.
   *
   * Una llamada ilegal no produce un valor equivocado que comparar: produce un
   * error de compilación. Ejecutarlas sólo mediría qué hace JavaScript con
   * basura —desestructurar un `null` truena, desestructurar un número da
   * `NaN`—, que no es lo que se está protegiendo. Viven en el archivo de
   * pruebas porque es donde se leen junto a lo que protegen, y quien las
   * comprueba es `tsc`.
   */

  /** La firma vieja: la velocidad suelta, por donde entraron las cuatro fugas. */
  // @ts-expect-error — un número crudo no es permiso.
  const conNumeroCrudo = () => rangoDeLlegada(0, 1000, VEL, PISO);

  /** El permiso a mano: le falta la marca, que ningún literal puede escribir. */
  // @ts-expect-error — `PermisoDeRango` no se construye desde afuera.
  const conPermisoInventado: () => PermisoDeRango = () => ({
    velocidadKmh: VEL,
    pisoSegundos: PISO,
  });

  /**
   * El permiso sin revisar. `permisoDeRango` devuelve `PermisoDeRango | null`,
   * así que olvidar el `if (!p) return` deja de compilar — ésa es la mitad que
   * convierte «hay que acordarse» en «no se puede olvidar».
   */
  const sinRevisarElNulo = (p: PermisoDeRango | null) =>
    // @ts-expect-error — falta descartar el `null`.
    rangoDeLlegada(0, 1000, p);

  it("las tres formas de fabricar un minuto sin permiso no compilan", () => {
    /*
     * Que este `it` pase no prueba nada por sí solo — las funciones ni se
     * llaman. Lo que prueba la valla es que `pnpm --filter @jtel/domain build`
     * termina en cero CON las tres directivas puestas: si alguna dejara de
     * hacer falta, `tsc` fallaría con «Unused '@ts-expect-error' directive».
     * Se nombran aquí para que ningún linter las borre por no usarse.
     */
    expect([conNumeroCrudo, conPermisoInventado, sinRevisarElNulo]).toHaveLength(3);
  });

  it("y la forma correcta sí compila y sí da un rango", () => {
    /*
     * El control positivo, y no sobra: sin él, renombrar `rangoDeLlegada`
     * dejaría las tres directivas de arriba «usadas» por el error equivocado
     * —función inexistente— y la valla pasaría sin comprobar nada.
     */
    expect(rangoDeLlegada(0, 1000, permiso())).not.toBeNull();
  });
});

describe("el rango de llegada", () => {
  it("el ancho es exactamente el piso del circuito, ni un segundo más", () => {
    // 3 km, bastante más allá del piso: aquí el ancho se puede afirmar entero.
    // Con 1000 m el estimado es 176 s y el recorte a cero se come parte del
    // lado izquierdo — eso es el caso de abajo, no éste.
    const r = rangoDeLlegada(0, 3000, permiso())!;
    expect(r.hastaSeg - r.estimadoSeg).toBe(PISO);
    expect(r.estimadoSeg - r.desdeSeg).toBe(PISO);
  });

  it("una unidad que YA PASÓ no produce rango", () => {
    // La unidad va en el metro 1500, el pasajero en el 1000.
    expect(rangoDeLlegada(1500, 1000, permiso())).toBeNull();
  });

  it("una unidad detrás sí, con su distancia", () => {
    const r = rangoDeLlegada(500, 1000, permiso())!;
    expect(r.metrosDeDistancia).toBe(500);
    expect(r.estimadoSeg).toBeGreaterThan(0);
  });

  it("el piso nunca deja el rango en negativo", () => {
    const r = rangoDeLlegada(990, 1000, permiso())!;
    expect(r.desdeSeg).toBe(0);
  });

  it("«Llegando» se decide por METROS, no por minutos", () => {
    /*
     * A cuatro cuadras el pasajero levanta la vista y ve el camión. Un umbral
     * en minutos diría «llegando» a un kilómetro cuando el tráfico está lento,
     * y quien salió corriendo a la esquina se queda parado tres minutos.
     */
    expect(rangoDeLlegada(0, 399, permiso())!.llegando).toBe(true);
    expect(rangoDeLlegada(0, 401, permiso())!.llegando).toBe(false);
  });

  it("justo en el borde de los 400 m todavía está llegando", () => {
    expect(rangoDeLlegada(0, 400, permiso())!.llegando).toBe(true);
  });

  it("el umbral es parámetro: con otro número, otro borde", () => {
    expect(rangoDeLlegada(0, 401, permiso(), 600)!.llegando).toBe(true);
    expect(rangoDeLlegada(0, 399, permiso(), 200)!.llegando).toBe(false);
  });

  it("un camión lento y cerca sigue «Llegando», aunque su rango sea ancho", () => {
    // 300 m a 5 km/h son 216 s: en minutos no diría «llegando», y sí se ve.
    const r = rangoDeLlegada(0, 300, permiso(5))!;
    expect(r.llegando).toBe(true);
    expect(r.estimadoSeg).toBeGreaterThan(PISO);
  });

  it("el piso viene del circuito: con otro piso, otro ancho", () => {
    const r = rangoDeLlegada(0, 2000, permiso(VEL, 60))!;
    expect(r.hastaSeg - r.estimadoSeg).toBe(60);
  });
});

describe("la próxima llegada", () => {
  const r = (estimadoSeg: number): RangoDeLlegada => ({
    desdeSeg: Math.max(0, estimadoSeg - 180),
    hastaSeg: estimadoSeg + 180,
    estimadoSeg,
    llegando: estimadoSeg <= 180,
    metrosDeDistancia: estimadoSeg * 6,
  });

  it("sin rangos no hay llegada que enseñar — ahí cae la frecuencia declarada", () => {
    expect(proximaLlegada([])).toBeNull();
  });

  it("es la que llega primero, no la primera de la lista", () => {
    expect(proximaLlegada([r(600), r(120), r(400)])!.estimadoSeg).toBe(120);
  });
});
