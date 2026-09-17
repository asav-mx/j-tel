import { describe, expect, it } from "vitest";
import { ventanaDelDia, type PuntoTraza, type Ventana } from "@jtel/domain";
import {
  cortarPorModalidad,
  lugaresDelPunto,
  recorridoPorVentana,
  visitasALugares,
  type Lugar,
  type Modalidad,
} from "./recorrido-del-dia.js";

/*
 * El día del prototipo aprobado (cuarto de Compás, 16 sep 2026), en Juárez:
 * la 10254 sale de la base 05:30, pierde señal 05:38–06:01, llega a Planta 47
 * 06:08 y sale 06:52.
 */
const cuadro = (lat: number, lng: number, lado = 0.004) => [
  { lat, lng },
  { lat, lng: lng + lado },
  { lat: lat + lado, lng: lng + lado },
  { lat: lat + lado, lng },
];

const BASE: Lugar = { id: "base", nombre: "Base", rol: "base", poligono: cuadro(31.7, -106.5) };
const PLANTA: Lugar = { id: "p47", nombre: "Planta 47", rol: "destino", poligono: cuadro(31.75, -106.4) };

const DENTRO_BASE = { lat: 31.702, lng: -106.498 };
const DENTRO_PLANTA = { lat: 31.752, lng: -106.398 };
const AFUERA = { lat: 31.72, lng: -106.45 };

/** 2026-09-14 completo — el día del prototipo, como ventana. */
const VENTANA_PROTOTIPO = ventanaDelDia("2026-09-14");

const instante = (fechaIso: string, hhmm: string) => new Date(`${fechaIso}T${hhmm}:00-06:00`);
const hora = (hhmm: string) => instante("2026-09-14", hhmm);
const p = (hhmm: string, donde: { lat: number; lng: number }, speed = 40): PuntoTraza => ({
  ...donde,
  at: hora(hhmm),
  speed,
});

/** Una serie de puntos cada 2 min en un mismo lugar, de `desde` a `hasta` inclusive, un mismo día. */
function serie(desde: string, hasta: string, donde: { lat: number; lng: number }): PuntoTraza[] {
  const salida: PuntoTraza[] = [];
  for (let t = hora(desde).getTime(); t <= hora(hasta).getTime(); t += 2 * 60_000) {
    salida.push({ ...donde, at: new Date(t), speed: 30 });
  }
  return salida;
}

const DIA_PROTOTIPO: PuntoTraza[] = [
  ...serie("05:26", "05:30", DENTRO_BASE),
  ...serie("05:32", "05:38", AFUERA),
  // hueco 05:38 → 06:01 (23 min)
  p("06:01", AFUERA),
  ...serie("06:03", "06:07", AFUERA).map((q) => ({ ...q, at: new Date(q.at.getTime() - 60_000) })),
  ...serie("06:08", "06:50", DENTRO_PLANTA),
  ...serie("06:52", "07:00", AFUERA),
];

describe("lugaresDelPunto", () => {
  it("contesta todos los lugares que contienen el punto, y ninguno afuera", () => {
    const encimado: Lugar = { id: "caseta", nombre: "Caseta", rol: "caseta", poligono: cuadro(31.751, -106.399, 0.002) };
    expect(lugaresDelPunto(DENTRO_PLANTA, [BASE, PLANTA, encimado]).map((l) => l.id)).toEqual(["p47", "caseta"]);
    expect(lugaresDelPunto(AFUERA, [BASE, PLANTA])).toEqual([]);
  });

  it("un polígono de menos de tres vértices no contiene nada", () => {
    const linea: Lugar = { id: "x", nombre: "x", rol: "otro", poligono: cuadro(31.75, -106.4).slice(0, 2) };
    expect(lugaresDelPunto(DENTRO_PLANTA, [linea])).toEqual([]);
  });
});

describe("recorridoPorVentana · el día del prototipo (el día como caso de ventana)", () => {
  const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: DIA_PROTOTIPO, lugares: [BASE, PLANTA] });

  it("parte la traza en el hueco de 23 min, y sólo ahí", () => {
    expect(r.tramos).toHaveLength(2);
    expect(r.huecos).toHaveLength(1);
    expect(r.huecos[0]!.desde).toEqual(hora("05:38"));
    expect(r.huecos[0]!.hasta).toEqual(hora("06:01"));
    expect(r.huecos[0]!.minutos).toBe(23);
  });

  it("la base: el día empezó adentro, así que no se vio llegar; sí se vio salir", () => {
    const base = r.visitas.find((v) => v.lugar.id === "base")!;
    expect(base.entradaObservada).toBe(false);
    expect(base.ultimoAdentro).toEqual(hora("05:30"));
    expect(base.salida).toEqual(hora("05:32"));
  });

  it("Planta 47: llegó 06:08 (primer punto adentro) y salió 06:52 (primer punto afuera)", () => {
    const planta = r.visitas.find((v) => v.lugar.id === "p47")!;
    expect(planta.entrada).toEqual(hora("06:08"));
    expect(planta.entradaObservada).toBe(true);
    expect(planta.ultimoAdentro).toEqual(hora("06:50"));
    expect(planta.salida).toEqual(hora("06:52"));
  });

  it("las visitas salen en orden de entrada", () => {
    expect(r.visitas.map((v) => v.lugar.id)).toEqual(["base", "p47"]);
  });

  it("el tiempo con señal es la suma de los tramos, sin el hueco", () => {
    // 05:26–05:38 = 12 min, 06:01–07:00 = 59 min.
    expect(r.cifras.minutosConSenal).toBe(71);
    expect(r.cifras.huecos).toBe(1);
    expect(r.cifras.puntos).toBe(DIA_PROTOTIPO.length);
  });

  it("no depende del orden en que llegan los puntos", () => {
    const revuelto = [...DIA_PROTOTIPO].reverse();
    expect(
      recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: revuelto, lugares: [BASE, PLANTA] }),
    ).toEqual(r);
  });
});

describe("visitasALugares · casos del borde", () => {
  it("un hueco adentro parte la visita: no se sabe si se quedó", () => {
    const puntos = [p("06:00", AFUERA), p("06:02", DENTRO_PLANTA), p("06:40", DENTRO_PLANTA), p("06:42", AFUERA)];
    const v = visitasALugares(puntos, [PLANTA]);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ entrada: hora("06:02"), entradaObservada: true, salida: null });
    expect(v[1]).toMatchObject({ entrada: hora("06:40"), entradaObservada: false, salida: hora("06:42") });
  });

  it("reaparecer adentro después de un hueco no es «llegó»", () => {
    const puntos = [p("06:00", AFUERA), p("06:30", DENTRO_PLANTA)];
    const [v] = visitasALugares(puntos, [PLANTA]);
    expect(v!.entradaObservada).toBe(false);
  });

  it("el día termina adentro: no hay salida", () => {
    const [v] = visitasALugares([p("06:00", AFUERA), p("06:02", DENTRO_PLANTA)], [PLANTA]);
    expect(v!.salida).toBeNull();
  });

  it("exactamente 15 min no es hueco (el umbral es exclusivo, como SIN SEÑAL)", () => {
    const [v] = visitasALugares([p("06:00", AFUERA), p("06:15", DENTRO_PLANTA)], [PLANTA]);
    expect(v!.entradaObservada).toBe(true);
    const [w] = visitasALugares([p("06:00", AFUERA), p("06:16", DENTRO_PLANTA)], [PLANTA]);
    expect(w!.entradaObservada).toBe(false);
  });

  it("sin lugares o sin puntos no hay visitas", () => {
    expect(visitasALugares([], [PLANTA])).toEqual([]);
    expect(visitasALugares([p("06:00", DENTRO_PLANTA)], [])).toEqual([]);
  });
});

describe("recorridoPorVentana · kilómetros", () => {
  it("no suma la distancia de un hueco: ese camino no se midió", () => {
    // ~5 km en línea recta entre los dos puntos, con 30 min sin señal.
    const ventana: Ventana = { desde: hora("06:00"), hasta: hora("06:30") };
    const r = recorridoPorVentana({ ventana, puntos: [p("06:00", DENTRO_BASE), p("06:30", AFUERA)], lugares: [] });
    expect(r.tramos).toHaveLength(2);
    expect(r.cifras.kmMedidos).toBe(0);
  });

  it("suma dentro del tramo y descarta el salto imposible del equipo", () => {
    const ventana: Ventana = { desde: hora("06:00"), hasta: hora("06:11") };
    const r = recorridoPorVentana({
      ventana,
      puntos: [
        p("06:00", DENTRO_BASE),
        p("06:10", AFUERA), // ~5 km en 10 min: posible
        p("06:11", DENTRO_PLANTA), // ~5 km en 1 min: 300+ km/h, salto
      ],
      lugares: [],
    });
    expect(r.cifras.kmMedidos).toBeGreaterThan(4.9);
    expect(r.cifras.kmMedidos).toBeLessThan(5.1);
    expect(r.cifras.saltosDescartados).toBe(1);
  });

  it("una ventana sin puntos es un periodo vacío, no un error", () => {
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: [], lugares: [BASE] });
    expect(r).toEqual({
      tramos: [],
      huecos: [],
      visitas: [],
      cifras: { puntos: 0, kmMedidos: 0, saltosDescartados: 0, minutosConSenal: 0, huecos: 0 },
    });
  });
});

describe("recorridoPorVentana · turno nocturno cruza medianoche (16-sep-2026, decisión 1)", () => {
  it("señal continua toda la noche: la medianoche no parte nada", () => {
    const ventana: Ventana = { desde: instante("2026-09-13", "22:00"), hasta: instante("2026-09-14", "06:00") };
    const puntos: PuntoTraza[] = [];
    for (
      let t = ventana.desde.getTime();
      t <= ventana.hasta.getTime();
      t += 2 * 60_000
    ) {
      puntos.push({ ...AFUERA, at: new Date(t), speed: 35 });
    }
    const r = recorridoPorVentana({ ventana, puntos, lugares: [] });
    expect(r.tramos).toHaveLength(1);
    expect(r.huecos).toHaveLength(0);
    expect(r.cifras.puntos).toBe(puntos.length);
    expect(r.cifras.minutosConSenal).toBe(480); // 22:00 → 06:00, 8 horas.
  });

  it("un hueco real que cruza medianoche se detecta entero, no partido en dos a las 00:00", () => {
    const ventana: Ventana = { desde: instante("2026-09-13", "22:00"), hasta: instante("2026-09-14", "06:00") };
    const puntos: PuntoTraza[] = [
      { ...AFUERA, at: instante("2026-09-13", "23:50"), speed: 35 },
      // 20 min sin señal, cruzando la medianoche.
      { ...AFUERA, at: instante("2026-09-14", "00:10"), speed: 35 },
    ];
    const r = recorridoPorVentana({ ventana, puntos, lugares: [] });
    expect(r.tramos).toHaveLength(2);
    expect(r.huecos).toHaveLength(1);
    expect(r.huecos[0]!.desde).toEqual(instante("2026-09-13", "23:50"));
    expect(r.huecos[0]!.hasta).toEqual(instante("2026-09-14", "00:10"));
    expect(r.huecos[0]!.minutos).toBe(20);
  });

  it("una visita con señal continua a través de la medianoche es una sola visita", () => {
    // Llega a Planta 47 a las 23:50, sigue adentro reportando cada 5 min, sale 00:14.
    const ventana: Ventana = { desde: instante("2026-09-13", "22:00"), hasta: instante("2026-09-14", "06:00") };
    const puntos: PuntoTraza[] = [
      { ...AFUERA, at: instante("2026-09-13", "23:46"), speed: 35 },
      { ...DENTRO_PLANTA, at: instante("2026-09-13", "23:50"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-13", "23:55"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-14", "00:00"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-14", "00:05"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-14", "00:10"), speed: 0 },
      { ...AFUERA, at: instante("2026-09-14", "00:14"), speed: 35 },
    ];
    const r = recorridoPorVentana({ ventana, puntos, lugares: [PLANTA] });
    expect(r.visitas).toHaveLength(1);
    expect(r.visitas[0]).toMatchObject({
      entrada: instante("2026-09-13", "23:50"),
      entradaObservada: true,
      ultimoAdentro: instante("2026-09-14", "00:10"),
      salida: instante("2026-09-14", "00:14"),
    });
  });

  it("especial en turno nocturno: el corte en destino cruza la medianoche como un solo oculto", () => {
    const ventana: Ventana = { desde: instante("2026-09-13", "22:00"), hasta: instante("2026-09-14", "06:00") };
    const puntos: PuntoTraza[] = [
      { ...AFUERA, at: instante("2026-09-13", "23:46"), speed: 35 },
      { ...DENTRO_PLANTA, at: instante("2026-09-13", "23:50"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-14", "00:00"), speed: 0 },
      { ...DENTRO_PLANTA, at: instante("2026-09-14", "00:10"), speed: 0 },
      { ...AFUERA, at: instante("2026-09-14", "00:14"), speed: 35 },
    ];
    const c = cortarPorModalidad(recorridoPorVentana({ ventana, puntos, lugares: [PLANTA] }), () => "especial");
    expect(c.ocultos).toEqual([
      {
        lugar: PLANTA,
        desde: instante("2026-09-13", "23:50"),
        entradaObservada: true,
        hasta: instante("2026-09-14", "00:14"),
        salidaObservada: true,
      },
    ]);
    expect(c.tramos.map((t) => t.map((q) => q.at))).toEqual([
      [instante("2026-09-13", "23:46"), instante("2026-09-13", "23:50")],
      [instante("2026-09-14", "00:14")],
    ]);
  });
});

describe("recorridoPorVentana · ventana acotada a minutos", () => {
  const dispersos: PuntoTraza[] = [
    p("06:00", AFUERA),
    p("06:05", AFUERA),
    p("06:10", AFUERA),
    p("06:15", AFUERA),
    p("06:20", AFUERA),
  ];

  it("descarta lo que cae fuera de la ventana, aunque venga en los puntos", () => {
    const ventana: Ventana = { desde: hora("06:05"), hasta: hora("06:15") };
    const r = recorridoPorVentana({ ventana, puntos: dispersos, lugares: [] });
    expect(r.cifras.puntos).toBe(3);
    expect(r.tramos).toHaveLength(1);
    expect(r.tramos[0]!.map((q) => q.at)).toEqual([hora("06:05"), hora("06:10"), hora("06:15")]);
  });

  it("los dos extremos de la ventana son inclusive; un punto 1 ms afuera no cuenta", () => {
    const ventana: Ventana = { desde: hora("06:05"), hasta: hora("06:15") };
    const puntos: PuntoTraza[] = [
      { ...AFUERA, at: new Date(ventana.desde.getTime() - 1), speed: 40 },
      { ...AFUERA, at: ventana.desde, speed: 40 },
      { ...AFUERA, at: ventana.hasta, speed: 40 },
      { ...AFUERA, at: new Date(ventana.hasta.getTime() + 1), speed: 40 },
    ];
    const r = recorridoPorVentana({ ventana, puntos, lugares: [] });
    expect(r.cifras.puntos).toBe(2);
    expect(r.tramos[0]!.map((q) => q.at)).toEqual([ventana.desde, ventana.hasta]);
  });
});

describe("cortarPorModalidad · Marco 7.4", () => {
  const horas = (tramos: PuntoTraza[][]) =>
    tramos.map((t) =>
      [t[0]!, t[t.length - 1]!].map((q) =>
        q.at.toLocaleTimeString("es-MX", { timeZone: "America/Ciudad_Juarez", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      ),
    );
  const siempre = (m: Modalidad) => () => m;

  it("especial: el día del prototipo se corta en Planta 47 — línea hasta 06:08, nada adentro, sigue 06:52", () => {
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: DIA_PROTOTIPO, lugares: [BASE, PLANTA] });
    const c = cortarPorModalidad(r, siempre("especial"));
    expect(horas(c.tramos)).toEqual([
      ["05:26", "05:38"],
      ["06:01", "06:08"],
      ["06:52", "07:00"],
    ]);
    expect(c.ocultos).toEqual([
      { lugar: PLANTA, desde: hora("06:08"), entradaObservada: true, hasta: hora("06:52"), salidaObservada: true },
    ]);
    // Ningún punto dibujado cae adentro de la planta después de la llegada.
    const dibujados = c.tramos.flat().filter((q) => lugaresDelPunto(q, [PLANTA]).length > 0);
    expect(dibujados.map((q) => q.at)).toEqual([hora("06:08")]);
  });

  it("especial: la base no corta — sólo el rol destino", () => {
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: DIA_PROTOTIPO, lugares: [BASE] });
    const c = cortarPorModalidad(r, siempre("especial"));
    expect(c.ocultos).toEqual([]);
    expect(c.tramos).toBe(r.tramos);
  });

  it("circuito: la misma geocerca de destino no corta (7.6)", () => {
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: DIA_PROTOTIPO, lugares: [BASE, PLANTA] });
    const c = cortarPorModalidad(r, siempre("circuito"));
    expect(c.ocultos).toEqual([]);
    expect(c.tramos).toEqual(r.tramos);
  });

  it("la 101: especial en la mañana corta, circuito en la tarde no — misma unidad, misma geocerca", () => {
    const puntos = [
      ...serie("06:00", "06:04", AFUERA),
      ...serie("06:06", "06:20", DENTRO_PLANTA),
      ...serie("06:22", "06:30", AFUERA),
      ...serie("15:00", "15:04", AFUERA),
      ...serie("15:06", "15:10", DENTRO_PLANTA),
      ...serie("15:12", "15:20", AFUERA),
    ];
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos, lugares: [PLANTA] });
    // El servicio vigente: turno especial hasta mediodía, circuito después.
    const modalidadEn = (t: Date): Modalidad => (t < hora("12:00") ? "especial" : "circuito");
    const c = cortarPorModalidad(r, modalidadEn);
    expect(c.ocultos.map((o) => o.desde)).toEqual([hora("06:06")]);
    expect(horas(c.tramos)).toEqual([
      ["06:00", "06:06"],
      ["06:22", "06:30"],
      ["15:00", "15:20"],
    ]);
  });

  it("si no se vio entrar, no queda punto de llegada: se oculta todo lo de adentro", () => {
    const puntos = [...serie("06:00", "06:10", DENTRO_PLANTA), ...serie("06:12", "06:20", AFUERA)];
    const c = cortarPorModalidad(
      recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos, lugares: [PLANTA] }),
      siempre("especial"),
    );
    expect(c.ocultos[0]).toMatchObject({ entradaObservada: false, salidaObservada: true, hasta: hora("06:12") });
    expect(horas(c.tramos)).toEqual([["06:12", "06:20"]]);
  });

  it("si no se vio salir, lo oculto llega hasta el último punto adentro", () => {
    const puntos = [...serie("06:00", "06:04", AFUERA), ...serie("06:06", "06:30", DENTRO_PLANTA)];
    const c = cortarPorModalidad(
      recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos, lugares: [PLANTA] }),
      siempre("especial"),
    );
    expect(c.ocultos[0]).toMatchObject({ salidaObservada: false, hasta: hora("06:30") });
    expect(horas(c.tramos)).toEqual([["06:00", "06:06"]]);
  });

  it("la modalidad se pregunta a la hora de entrada de cada visita, no una vez por día", () => {
    const preguntas: Date[] = [];
    const r = recorridoPorVentana({ ventana: VENTANA_PROTOTIPO, puntos: DIA_PROTOTIPO, lugares: [BASE, PLANTA] });
    cortarPorModalidad(r, (t) => {
      preguntas.push(t);
      return "especial";
    });
    expect(preguntas).toEqual([hora("06:08")]);
  });
});
