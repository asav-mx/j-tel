import { describe, expect, it } from "vitest";
import type { PuntoTraza } from "@jtel/domain";
import { lugaresDelPunto, recorridoDelDia, visitasALugares, type Lugar } from "./recorrido-del-dia.js";

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

const hora = (hhmm: string) => new Date(`2026-09-14T${hhmm}:00-06:00`);
const p = (hhmm: string, donde: { lat: number; lng: number }, speed = 40): PuntoTraza => ({
  ...donde,
  at: hora(hhmm),
  speed,
});

/** Una serie de puntos cada 2 min en un mismo lugar, de `desde` a `hasta` inclusive. */
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

describe("recorridoDelDia · el día del prototipo", () => {
  const r = recorridoDelDia({ puntos: DIA_PROTOTIPO, lugares: [BASE, PLANTA] });

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
    expect(recorridoDelDia({ puntos: revuelto, lugares: [BASE, PLANTA] })).toEqual(r);
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

describe("recorridoDelDia · kilómetros", () => {
  it("no suma la distancia de un hueco: ese camino no se midió", () => {
    // ~5 km en línea recta entre los dos puntos, con 30 min sin señal.
    const r = recorridoDelDia({ puntos: [p("06:00", DENTRO_BASE), p("06:30", AFUERA)], lugares: [] });
    expect(r.tramos).toHaveLength(2);
    expect(r.cifras.kmMedidos).toBe(0);
  });

  it("suma dentro del tramo y descarta el salto imposible del equipo", () => {
    const r = recorridoDelDia({
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

  it("un día sin puntos es un día vacío, no un error", () => {
    const r = recorridoDelDia({ puntos: [], lugares: [BASE] });
    expect(r).toEqual({
      tramos: [],
      huecos: [],
      visitas: [],
      cifras: { puntos: 0, kmMedidos: 0, saltosDescartados: 0, minutosConSenal: 0, huecos: 0 },
    });
  });
});
