import { describe, expect, it } from "vitest";
import {
  intervaloMedianoMinutos,
  intervalosEntrePasadas,
  pasadasPorElPunto,
  serieSobreTrazado,
  vueltasSobreLaSerie,
  HUECO_QUE_ROMPE_MINUTOS,
  type PuntoDelDia,
  type TrazadoParaMedir,
} from "./comportamiento.js";

/*
 * Una avenida recta de poniente a oriente sobre lat 31.70. 0.02° de longitud a
 * esta latitud son ~1 890 m, así que el trazado mide eso y la fracción es
 * proporcional a la longitud.
 */
const AVENIDA: TrazadoParaMedir = {
  sentido: "ida",
  coordenadas: [
    [-106.4200, 31.7000],
    [-106.4100, 31.7000],
    [-106.4000, 31.7000],
  ],
};

const T0 = new Date("2026-09-03T12:00:00Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

/** Un punto sobre la avenida, a la fracción pedida del recorrido. */
const enFraccion = (f: number, minuto: number): PuntoDelDia => ({
  lat: 31.7,
  lon: -106.42 + 0.02 * f,
  recordedAt: min(minuto),
});

/** Un recorrido completo, de la fracción 0 a la 1, en `pasos` muestras. */
function recorrido(desdeMinuto: number, duracionMin: number, pasos = 11): PuntoDelDia[] {
  return Array.from({ length: pasos }, (_, i) =>
    enFraccion(i / (pasos - 1), desdeMinuto + (duracionMin * i) / (pasos - 1)),
  );
}

describe("serieSobreTrazado", () => {
  it("proyecta y ordena por tiempo, aunque lleguen revueltos", () => {
    // Desordenados a propósito: una consulta puede devolver como quiera, y una
    // serie desordenada convertiría cada salto en una vuelta.
    const puntos = [enFraccion(0.8, 30), enFraccion(0.2, 10), enFraccion(0.5, 20)];
    const s = serieSobreTrazado(puntos, AVENIDA, 150);

    expect(s.muestras.map((m) => Math.round(m.fraccion * 10))).toEqual([2, 5, 8]);
    expect(s.muestras[0].en.getTime()).toBeLessThan(s.muestras[1].en.getTime());
  });

  it("LO QUE CAE FUERA DEL CORREDOR SE CUENTA, no se tira en silencio", () => {
    /*
     * Un reporte que descarta puntos y no lo dice afirma sobre el día entero lo
     * que sólo vale para la parte que miró. La pantalla tiene que poder decir
     * sobre cuánto está hablando.
     */
    const puntos = [
      enFraccion(0.2, 10),
      { lat: 31.7300, lon: -106.41, recordedAt: min(15) }, // ~3.3 km al norte
      enFraccion(0.6, 20),
    ];
    const s = serieSobreTrazado(puntos, AVENIDA, 150);

    expect(s.muestras).toHaveLength(2);
    expect(s.fueraDelCorredor).toBe(1);
  });

  it("sin puntos no inventa una serie", () => {
    const s = serieSobreTrazado([], AVENIDA, 150);
    expect(s.muestras).toEqual([]);
    expect(s.fueraDelCorredor).toBe(0);
  });
});

describe("vueltasSobreLaSerie", () => {
  it("cuenta una pasada completa, con sus dos horas reales", () => {
    const s = serieSobreTrazado(recorrido(0, 40), AVENIDA, 150);
    const v = vueltasSobreLaSerie(s);

    expect(v.vueltas).toHaveLength(1);
    expect(v.vueltas[0].minutos).toBeCloseTo(36, 0); // de la fracción .1 a la .9
    expect(v.enCurso).toBe(false);
  });

  it("tres recorridos son tres vueltas", () => {
    const puntos = [...recorrido(0, 40), ...recorrido(50, 40), ...recorrido(100, 40)];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));
    expect(v.vueltas).toHaveLength(3);
  });

  it("MEDIA VUELTA NO ES UNA VUELTA — se enuncia como en curso", () => {
    // Arranca y llega a la mitad: el corte la agarró a medio camino.
    const puntos = recorrido(0, 40).filter((_, i) => i <= 5);
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));

    expect(v.vueltas).toHaveLength(0);
    expect(v.enCurso).toBe(true);
  });

  it("EL TEMBLOR DEL GPS NO REINICIA la vuelta", () => {
    /*
     * Un fix puede caer atrás del anterior sin que el camión haya dado marcha
     * atrás. Si un retroceso chico reiniciara, un día entero contaría cero.
     */
    const puntos = [
      enFraccion(0.05, 0),
      enFraccion(0.3, 5),
      enFraccion(0.28, 6), // retrocede ~2%: ruido
      enFraccion(0.6, 12),
      enFraccion(0.58, 13),
      enFraccion(0.95, 20),
    ];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));
    expect(v.vueltas).toHaveLength(1);
  });

  it("un retroceso GRANDE sí reinicia: la unidad volvió al principio", () => {
    const puntos = [
      enFraccion(0.05, 0),
      enFraccion(0.6, 10),
      enFraccion(0.05, 20), // se regresó a la terminal sin terminar
      enFraccion(0.95, 30),
    ];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));

    // La primera no se completó; la segunda sí, y empieza en el minuto 20.
    expect(v.vueltas).toHaveLength(1);
    expect(v.vueltas[0].desde.getTime()).toBe(min(20).getTime());
  });

  it("NO SE CUENTA POR DISTANCIA ACUMULADA: un camión meciéndose no da vueltas", () => {
    /*
     * Si el conteo sumara avance, un camión atorado en un semáforo sumaría
     * vueltas sin salir de la cuadra. Aquí no se cuenta ninguna.
     */
    const puntos = Array.from({ length: 40 }, (_, i) =>
      enFraccion(0.5 + (i % 2 === 0 ? 0.01 : -0.01), i),
    );
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));
    expect(v.vueltas).toHaveLength(0);
  });

  it("UN HUECO GRANDE NO SE COSE: dos pedazos no son una vuelta", () => {
    /*
     * El defecto que salió mirando el reporte contra datos reales: una unidad
     * cerca del inicio a las 05:00 y cerca del final a las 13:00 producía «1
     * vuelta · 8 h 20 min». Ninguna vuelta de veinticuatro kilómetros dura ocho
     * horas — lo de en medio fue una unidad estacionada, fuera de la ruta o sin
     * señal, y unir los dos pedazos rellena ese hueco con la autoridad de un
     * dato medido. Es la §E del Marco.
     */
    const puntos = [enFraccion(0.05, 0), enFraccion(0.95, 500)];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));

    expect(v.vueltas).toHaveLength(0);
    // Y tampoco se queda «en curso»: el arranque quedó demasiado atrás.
    expect(v.enCurso).toBe(false);
  });

  it("un hueco chico NO rompe: el GPS se calla un minuto y la vuelta sigue", () => {
    const puntos = [enFraccion(0.05, 0), enFraccion(0.5, 12), enFraccion(0.95, 24)];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));
    expect(v.vueltas).toHaveLength(1);
    expect(v.vueltas[0].minutos).toBe(24);
  });

  it("el umbral del hueco entra por parámetro, como los demás", () => {
    // Por encima del valor de origen, y por debajo del que se le pasa.
    expect(HUECO_QUE_ROMPE_MINUTOS).toBe(15);
    const puntos = [enFraccion(0.05, 0), enFraccion(0.95, 40)];
    expect(vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150)).vueltas).toHaveLength(0);
    expect(
      vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150), {
        huecoQueRompeMinutos: 60,
      }).vueltas,
    ).toHaveLength(1);
  });

  it("LA QUE NO SE VIO ARRANCAR NO SE CUENTA, y ése es el punto", () => {
    /*
     * Empieza a verse a media avenida: el sistema no la observó completar el
     * recorrido, así que no hay vuelta que afirmar. Es un conteo de vueltas
     * OBSERVADAS, y la pantalla tiene que rotularlo así.
     */
    const puntos = [enFraccion(0.5, 0), enFraccion(0.95, 20)];
    const v = vueltasSobreLaSerie(serieSobreTrazado(puntos, AVENIDA, 150));
    expect(v.vueltas).toHaveLength(0);
    expect(v.enCurso).toBe(false);
  });
});

describe("el intervalo observado", () => {
  const serieDe = (puntos: PuntoDelDia[]) => serieSobreTrazado(puntos, AVENIDA, 150);

  it("detecta el CRUCE del punto, no la cercanía", () => {
    /*
     * Un camión detenido justo en el punto de control produce muchas muestras
     * cerca de él. Tomar «la más cercana» contaría varias pasadas de un solo
     * camión parado.
     */
    const quieto = [
      enFraccion(0.49, 0),
      enFraccion(0.495, 1),
      enFraccion(0.51, 2),
      enFraccion(0.505, 3),
      enFraccion(0.515, 4),
    ];
    const p = pasadasPorElPunto([{ unidad: "A", serie: serieDe(quieto) }], 0.5);
    expect(p).toHaveLength(1);
  });

  it("ordena las pasadas de todas las unidades por hora, no por unidad", () => {
    const p = pasadasPorElPunto(
      [
        { unidad: "A", serie: serieDe([enFraccion(0.4, 0), enFraccion(0.6, 30)]) },
        { unidad: "B", serie: serieDe([enFraccion(0.4, 5), enFraccion(0.6, 10)]) },
      ],
      0.5,
    );
    expect(p.map((x) => x.unidad)).toEqual(["B", "A"]);
  });

  it("el intervalo sale de DOS HORAS REALES, sin velocidad de por medio", () => {
    const p = pasadasPorElPunto(
      [
        { unidad: "A", serie: serieDe([enFraccion(0.4, 0), enFraccion(0.6, 10)]) },
        { unidad: "B", serie: serieDe([enFraccion(0.4, 25), enFraccion(0.6, 32)]) },
      ],
      0.5,
    );
    const i = intervalosEntrePasadas(p);
    expect(i).toHaveLength(1);
    expect(i[0].minutos).toBe(22);
    expect(i[0].anterior.unidad).toBe("A");
    expect(i[0].siguiente.unidad).toBe("B");
  });

  it("CON UNA SOLA PASADA NO HAY INTERVALO, y el hueco va en nulo", () => {
    /*
     * Un cero ahí diría que los camiones pasan pegados. Con uno solo no hay
     * nada que medir, y eso se dibuja como hueco.
     */
    const p = pasadasPorElPunto(
      [{ unidad: "A", serie: serieDe([enFraccion(0.4, 0), enFraccion(0.6, 10)]) }],
      0.5,
    );
    expect(intervalosEntrePasadas(p)).toEqual([]);
    expect(intervaloMedianoMinutos([])).toBeNull();
  });

  it("MEDIANA Y NO PROMEDIO: la unidad que se fue al taller no describe el día", () => {
    const pasadas = [0, 20, 40, 60, 300].map((m, i) => ({ unidad: `U${i}`, en: min(m) }));
    const intervalos = intervalosEntrePasadas(pasadas);

    // Intervalos: 20, 20, 20, 240. El promedio da 75; la mediana, 20.
    const promedio = intervalos.reduce((a, b) => a + b.minutos, 0) / intervalos.length;
    expect(promedio).toBeGreaterThan(70);
    expect(intervaloMedianoMinutos(intervalos)).toBe(20);
  });
});
