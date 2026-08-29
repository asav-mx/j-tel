import { describe, it, expect } from "vitest";
import {
  idPublicoDelDia,
  fechaLocalDelCircuito,
  enHorarioDeServicio,
  antiguedadSegundos,
  esFresco,
  sentidoDeLaUnidad,
  type TrazadoDeSentido,
  vaSobreElCircuito,
  estadoDelCircuito,
  medirUnidad,
  type MedidaDeUnidad,
} from "./publico.js";

const LLAVE = "llave-de-prueba-no-es-la-de-produccion";
const JUAREZ = "America/Ciudad_Juarez";

describe("id público del día", () => {
  it("es estable dentro del mismo día — la app puede animar el mismo camión", () => {
    const a = idPublicoDelDia("unidad-1", "2026-08-27", LLAVE);
    const b = idPublicoDelDia("unidad-1", "2026-08-27", LLAVE);
    expect(a).toBe(b);
  });

  it("cambia al día siguiente — nadie arma el historial de un camión raspando el endpoint", () => {
    const hoy = idPublicoDelDia("unidad-1", "2026-08-27", LLAVE);
    const manana = idPublicoDelDia("unidad-1", "2026-08-28", LLAVE);
    expect(manana).not.toBe(hoy);
  });

  it("no deja ver el identificador interno de la unidad", () => {
    const id = idPublicoDelDia("5cc6dc22-dc23-4467-afbd-2a91123fe0cf", "2026-08-27", LLAVE);
    expect(id).not.toContain("5cc6dc22");
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("sin la llave no se puede recalcular: dos llaves dan dos identidades", () => {
    const conUna = idPublicoDelDia("unidad-1", "2026-08-27", LLAVE);
    const conOtra = idPublicoDelDia("unidad-1", "2026-08-27", "otra-llave");
    expect(conOtra).not.toBe(conUna);
  });

  it("se niega a trabajar sin llave en vez de producir un id falsamente opaco", () => {
    expect(() => idPublicoDelDia("unidad-1", "2026-08-27", "")).toThrow(/llave/i);
  });

  it("la fecha que lo hace rotar es la del circuito, no la de UTC", () => {
    // 05:30 UTC del día 28 son todavía las 23:30 del 27 en Juárez. Si el
    // identificador rotara en UTC, cambiaría a media noche de operación.
    const instante = new Date("2026-08-28T05:30:00.000Z");
    expect(fechaLocalDelCircuito(instante, JUAREZ)).toBe("2026-08-27");
    expect(fechaLocalDelCircuito(instante, "UTC")).toBe("2026-08-28");
  });
});

describe("horario de servicio", () => {
  // 13:00 UTC = 07:00 en Juárez (UTC-6).
  const manana = new Date("2026-08-27T13:00:00.000Z");
  // 07:00 UTC = 01:00 en Juárez.
  const madrugada = new Date("2026-08-27T07:00:00.000Z");

  it("ventana normal: dentro y fuera", () => {
    expect(enHorarioDeServicio(manana, "05:00", "23:00", JUAREZ)).toBe(true);
    expect(enHorarioDeServicio(madrugada, "05:00", "23:00", JUAREZ)).toBe(false);
  });

  it("aguanta los segundos con que Postgres devuelve un `time`", () => {
    expect(enHorarioDeServicio(manana, "05:00:00", "23:00:00", JUAREZ)).toBe(true);
  });

  it("ventana que cruza la medianoche: la 01:00 SÍ es horario de un nocturno", () => {
    // Con una comparación ingenua esto daría false toda la noche, justo cuando corre.
    expect(enHorarioDeServicio(madrugada, "22:00", "06:00", JUAREZ)).toBe(true);
    expect(enHorarioDeServicio(manana, "22:00", "06:00", JUAREZ)).toBe(false);
  });

  it("inicio igual a fin es servicio de 24 horas, no una ventana vacía", () => {
    expect(enHorarioDeServicio(manana, "00:00", "00:00", JUAREZ)).toBe(true);
    expect(enHorarioDeServicio(madrugada, "00:00", "00:00", JUAREZ)).toBe(true);
  });

  it("la zona es la del circuito: el mismo instante cae dentro o fuera según dónde corra", () => {
    expect(enHorarioDeServicio(madrugada, "05:00", "23:00", JUAREZ)).toBe(false);
    expect(enHorarioDeServicio(madrugada, "05:00", "23:00", "UTC")).toBe(true);
  });
});

describe("frescura", () => {
  const ahora = new Date("2026-08-27T12:00:00.000Z");

  it("la antigüedad la calcula el servidor, en segundos", () => {
    expect(antiguedadSegundos(new Date("2026-08-27T11:58:00.000Z"), ahora)).toBe(120);
  });

  it("un fix del futuro no produce antigüedad negativa", () => {
    expect(antiguedadSegundos(new Date("2026-08-27T12:00:30.000Z"), ahora)).toBe(0);
  });

  it("el umbral es el del circuito, no una constante", () => {
    // 121 s es la mediana medida en producción: fresco con 180, viejo con 120.
    expect(esFresco(121, 180)).toBe(true);
    expect(esFresco(121, 120)).toBe(false);
  });

  it("justo en el umbral ya no está fresco — el borde se decide, no se deja al azar", () => {
    expect(esFresco(180, 180)).toBe(false);
    expect(esFresco(179, 180)).toBe(true);
  });
});

describe("sentido de la unidad", () => {
  /*
   * Dos trazados sobre la misma avenida, en sentidos opuestos. Es el caso
   * difícil de verdad: sobre un tramo compartido la POSICIÓN no distingue nada
   * y lo único que distingue es hacia dónde apunta el camión.
   */
  const haciaElNorte: Array<[number, number]> = [
    [-106.45, 31.70],
    [-106.45, 31.72],
    [-106.45, 31.74],
  ];
  const haciaElSur: Array<[number, number]> = [
    [-106.45, 31.74],
    [-106.45, 31.72],
    [-106.45, 31.70],
  ];
  const ambos: TrazadoDeSentido[] = [
    { sentido: "ida", coordinates: haciaElNorte },
    { sentido: "vuelta", coordinates: haciaElSur },
  ];
  const sobreLaRuta = { lat: 31.71, lon: -106.45 };

  it("apuntando al norte sobre un tramo compartido, es la ida", () => {
    expect(sentidoDeLaUnidad(sobreLaRuta, 0, ambos)).toBe("ida");
  });

  it("apuntando al sur sobre el mismo tramo, es la vuelta", () => {
    expect(sentidoDeLaUnidad(sobreLaRuta, 180, ambos)).toBe("vuelta");
  });

  it("sin rumbo no se afirma nada, aunque la posición esté encima del trazado", () => {
    expect(sentidoDeLaUnidad(sobreLaRuta, null, ambos)).toBeNull();
  });

  it("sin trazados no se afirma nada — publicar sin KML es legítimo", () => {
    expect(sentidoDeLaUnidad(sobreLaRuta, 0, [])).toBeNull();
  });

  it("de lado, sin ganarle claro a ninguno de los dos, es null y no una moneda al aire", () => {
    // Rumbo al este: 90° de los dos sentidos. Ninguno explica mejor lo que se ve.
    expect(sentidoDeLaUnidad(sobreLaRuta, 90, ambos)).toBeNull();
  });

  it("fuera del corredor no se afirma nada, por bien que apunte", () => {
    const lejos = { lat: 31.71, lon: -106.48 }; // ~2.8 km de la ruta
    expect(sentidoDeLaUnidad(lejos, 0, ambos)).toBeNull();
  });

  it("con un solo trazado se afirma si va con él, y no si va contra él", () => {
    const soloIda: TrazadoDeSentido[] = [{ sentido: "ida", coordinates: haciaElNorte }];
    expect(sentidoDeLaUnidad(sobreLaRuta, 5, soloIda)).toBe("ida");
    // Va en contra: no hay trazado de vuelta que nombrar, así que no se inventa.
    expect(sentidoDeLaUnidad(sobreLaRuta, 185, soloIda)).toBeNull();
  });

  it("el corredor es parámetro: el mismo punto entra o no según cuánto se acepte", () => {
    const aMediaCuadra = { lat: 31.71, lon: -106.4512 }; // ~114 m
    expect(sentidoDeLaUnidad(aMediaCuadra, 0, ambos)).toBe("ida");
    expect(sentidoDeLaUnidad(aMediaCuadra, 0, ambos, 50)).toBeNull();
  });
});

describe("vaSobreElCircuito", () => {
  /* Un tramo recto de ~1 km sobre la misma latitud. */
  const trazados = [
    { sentido: "ida" as const, coordinates: [[-106.45, 31.71], [-106.44, 31.71]] as Array<[number, number]> },
  ];

  it("sobre el trazado, va", () => {
    expect(vaSobreElCircuito({ lat: 31.71, lon: -106.445 }, trazados, 150)).toBe(true);
  });

  it("a media cuadra de una avenida ancha, sigue yendo", () => {
    // ~55 m al norte del tramo: el caso que motiva los 150 m por defecto.
    expect(vaSobreElCircuito({ lat: 31.7105, lon: -106.445 }, trazados, 150)).toBe(true);
  });

  it("a nueve kilómetros, no va — y es el caso real que lo motivó", () => {
    expect(vaSobreElCircuito({ lat: 31.63, lon: -106.445 }, trazados, 150)).toBe(false);
  });

  it("el corte es el que se le pasa, no una constante escondida", () => {
    const punto = { lat: 31.7105, lon: -106.445 }; // ~55 m
    expect(vaSobreElCircuito(punto, trazados, 25)).toBe(false);
    expect(vaSobreElCircuito(punto, trazados, 150)).toBe(true);
  });

  it("sin trazados no se puede afirmar nada: false", () => {
    expect(vaSobreElCircuito({ lat: 31.71, lon: -106.445 }, [], 150)).toBe(false);
  });

  it("basta con ir sobre UN sentido", () => {
    const dos = [
      { sentido: "ida" as const, coordinates: [[-106.45, 31.71], [-106.44, 31.71]] as Array<[number, number]> },
      { sentido: "vuelta" as const, coordinates: [[-106.35, 31.61], [-106.34, 31.61]] as Array<[number, number]> },
    ];
    expect(vaSobreElCircuito({ lat: 31.61, lon: -106.345 }, dos, 150)).toBe(true);
  });
});

describe("medirUnidad · la clasificación que leen las dos caras", () => {
  /* Un tramo recto de avenida, para que la distancia sea la única variable. */
  const trazados: TrazadoDeSentido[] = [
    {
      sentido: "ida",
      coordinates: [
        [-106.45, 31.71],
        [-106.44, 31.71],
      ],
    },
  ];
  const ahora = new Date("2026-08-27T12:00:00.000Z");
  const umbrales = {
    ahora,
    trazados,
    corredorMetros: 150,
    frescuraSegundos: 180,
    confianzaSegundos: 900,
  };
  /** Una unidad sobre la avenida, con `hace` segundos de antigüedad. */
  const sobreLaRuta = (hace: number) =>
    medirUnidad(
      { lat: 31.71, lon: -106.445, recordedAt: new Date(ahora.getTime() - hace * 1000) },
      umbrales,
    );
  /** La misma unidad, a nueve kilómetros del trazado. */
  const enElPatio = (hace: number) =>
    medirUnidad(
      { lat: 31.63, lon: -106.445, recordedAt: new Date(ahora.getTime() - hace * 1000) },
      umbrales,
    );

  it("fresca y en el corredor: en ruta", () => {
    const m = sobreLaRuta(30);
    expect(m.enCorredor).toBe(true);
    expect(m.fresco).toBe(true);
    expect(m.enRuta).toBe(true);
  });

  it("EL TÚNEL: en el corredor pero vieja — ya no está en ruta, y sigue contando", () => {
    const m = sobreLaRuta(600);
    expect(m.enRuta).toBe(false);
    expect(m.enCorredor).toBe(true);
    expect(m.dentroDeConfianza).toBe(true);
  });

  it("EL CAMIÓN DEL PATIO: fresquísimo y fuera del corredor NO está en ruta", () => {
    const m = enElPatio(1);
    expect(m.fresco).toBe(true);
    expect(m.enCorredor).toBe(false);
    expect(m.enRuta).toBe(false);
  });

  it("pasada la ventana de confianza deja de sostener nada", () => {
    expect(sobreLaRuta(1200).dentroDeConfianza).toBe(false);
  });

  it("los umbrales son los que se le pasan, no constantes escondidas", () => {
    const hace300 = { lat: 31.71, lon: -106.445, recordedAt: new Date(ahora.getTime() - 300_000) };
    expect(medirUnidad(hace300, umbrales).fresco).toBe(false);
    expect(medirUnidad(hace300, { ...umbrales, frescuraSegundos: 600 }).fresco).toBe(true);
    expect(medirUnidad(hace300, { ...umbrales, confianzaSegundos: 120 }).dentroDeConfianza).toBe(
      false,
    );
    /* Y el corredor: los 150 m no viven dentro de la función. */
    const aMedioCuadra = { lat: 31.7105, lon: -106.445, recordedAt: ahora };
    expect(medirUnidad(aMedioCuadra, umbrales).enCorredor).toBe(true);
    expect(medirUnidad(aMedioCuadra, { ...umbrales, corredorMetros: 25 }).enCorredor).toBe(false);
  });
});

describe("estadoDelCircuito · la escalera", () => {
  const base = { enHorario: true };
  /** En el corredor, con la frescura ya resuelta por `medirUnidad`. */
  const enCorredor = (antiguedadSeg: number, fresco: boolean, dentroDeConfianza = true): MedidaDeUnidad => ({
    enCorredor: true,
    antiguedadSeg,
    fresco,
    dentroDeConfianza,
    enRuta: fresco,
  });
  /** Fuera del corredor: por fresca que esté, no está en ruta. */
  const fuera = (antiguedadSeg: number): MedidaDeUnidad => ({
    enCorredor: false,
    antiguedadSeg,
    fresco: true,
    dentroDeConfianza: true,
    enRuta: false,
  });

  it("fuera de horario gana sobre todo lo demás, incluso con una unidad encima", () => {
    expect(
      estadoDelCircuito({ ...base, enHorario: false, unidades: [enCorredor(5, true)] }),
    ).toBe("fuera_de_horario");
  });

  it("una en ruta: en vivo", () => {
    expect(estadoDelCircuito({ ...base, unidades: [enCorredor(30, true)] })).toBe("en_vivo");
  });

  it("vieja para en vivo pero dentro de la confianza: por horario", () => {
    expect(estadoDelCircuito({ ...base, unidades: [enCorredor(600, false)] })).toBe("por_horario");
  });

  it("pasada la confianza: sin evidencia", () => {
    expect(estadoDelCircuito({ ...base, unidades: [enCorredor(1200, false, false)] })).toBe(
      "sin_evidencia",
    );
  });

  it("sin ninguna observación: sin evidencia, nunca por horario", () => {
    expect(estadoDelCircuito({ ...base, unidades: [] })).toBe("sin_evidencia");
  });

  it("EL CAMIÓN DEL PATIO: fresquísimo pero fuera del corredor no sostiene nada", () => {
    /*
     * Reporta cada segundo desde el patio. Si la escalera no exigiera corredor,
     * mantendría la ruta «por horario» toda la noche prometiendo una cadencia
     * que nadie está dando. Es el caso que decidió la regla.
     */
    expect(estadoDelCircuito({ ...base, unidades: [fuera(1)] })).toBe("sin_evidencia");
    expect(estadoDelCircuito({ ...base, unidades: [fuera(1), fuera(2), fuera(3)] })).toBe(
      "sin_evidencia",
    );
  });

  it("EL TÚNEL: la vio la ruta hace rato, y eso sí cuenta", () => {
    expect(estadoDelCircuito({ ...base, unidades: [enCorredor(800, false)] })).toBe("por_horario");
  });

  it("basta UNA en ruta entre muchas viejas para estar en vivo", () => {
    expect(
      estadoDelCircuito({
        ...base,
        unidades: [enCorredor(5000, false, false), enCorredor(60, true), enCorredor(4000, false, false)],
      }),
    ).toBe("en_vivo");
  });

  it("una fuera del corredor no descalifica a la que sí va en ruta", () => {
    expect(estadoDelCircuito({ ...base, unidades: [fuera(1), enCorredor(60, true)] })).toBe(
      "en_vivo",
    );
  });

  it("el orden es el de la escalera: horario antes que evidencia", () => {
    // Cerrado y con un camión fresco encima de la ruta —el que regresa al
    // patio— sigue siendo «fuera de horario». No hay servicio que anunciar.
    expect(
      estadoDelCircuito({ ...base, enHorario: false, unidades: [enCorredor(1, true)] }),
    ).toBe("fuera_de_horario");
  });

  it("«en vivo» es literalmente «hay alguna EN RUTA» — la misma cifra del operador", () => {
    /*
     * Es la prueba que sostiene el acuerdo entre las dos caras: el «3 de 5» del
     * concesionario cuenta `enRuta`, y el `en_vivo` del pasajero pregunta si
     * ese conteo es mayor que cero. Si alguien cambiara una de las dos, esto
     * se rompe aquí y no en producción.
     */
    const plan = [enCorredor(60, true), enCorredor(900, false), fuera(1), fuera(2), fuera(3)];
    expect(plan.filter((u) => u.enRuta).length).toBe(1);
    expect(estadoDelCircuito({ ...base, unidades: plan })).toBe("en_vivo");

    const sinNinguna = plan.filter((u) => !u.enRuta);
    expect(sinNinguna.filter((u) => u.enRuta).length).toBe(0);
    expect(estadoDelCircuito({ ...base, unidades: sinNinguna })).toBe("por_horario");
  });
});
