import { describe, expect, it } from "vitest";
import {
  SALTO_GPS_KMH,
  SIN_SENAL_MINUTOS,
  TOLERANCIA_POR_GRADO,
  paradas as paradasDeLaTraza,
  type GradoDeTrazo,
  type PuntoTraza,
  type Ventana,
} from "@jtel/domain";
import { cortarPorModalidad, recorridoPorVentana, type Lugar } from "./recorrido-del-dia.js";
import { modalidadDesdeEspeciales, trazoParaDibujar } from "./recorrido-servido.js";

/**
 * La prueba guardiana de «una traza rota se dibuja rota» (Pieza 1 §E).
 *
 * El 18 de septiembre de 2026 se revisó con datos de producción si el mapa de
 * Recorridos y playback unía los huecos con una recta: 516 recorridos, 154
 * huecos, 456 mil segmentos dibujados, **cero** cruces. Lo que estaba bien se
 * protege aquí para que siga bien. Y el mismo día se agregó el salto del GPS
 * como corte: una recta de 10 km en un minuto afirma un camino que nadie
 * recorrió.
 *
 * Corre la MISMA cadena que sirve la pantalla —`recorridoPorVentana` →
 * `cortarPorModalidad` → `trazoParaDibujar`, en los cuatro grados de
 * simplificación— sobre trazas armadas para romperse, y exige tres cosas:
 *
 *   1. **Ningún segmento dibujado encierra un corte.** Nunca un par de puntos
 *      seguidos del mismo tramo con `a ≤ corte.desde` y `b ≥ corte.hasta`.
 *   2. **Cada corte es un corte.** Un tramo termina en `corte.desde` y el
 *      siguiente empieza en `corte.hasta`: sus dos extremos se conservan.
 *   3. **Ningún punto se pierde por el salto.** Los dos puntos de un salto se
 *      siguen dibujando; lo único que se niega es la línea entre ellos.
 */

const T0 = Date.parse("2026-09-18T12:00:00.000Z");
const VENTANA: Ventana = { desde: new Date(T0 - 3_600_000), hasta: new Date(T0 + 24 * 3_600_000) };
const SIN_LUGARES: Lugar[] = [];

/** Generador determinista: la misma semilla, la misma traza, el mismo resultado. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** ~111 m por milésima de grado de latitud: suficiente para armar distancias. */
const GRADOS_POR_KM = 1 / 111;

/**
 * Una traza que se rompe a propósito: camina hacia el norte a 30–50 km/h con
 * un punto cada 5–60 s, y de vez en cuando mete un hueco (20 min–3 h, a veces
 * sin moverse, como un camión estacionado) o un salto (un punto fantasma a
 * 5–15 km, o un brinco que no regresa).
 */
function trazaRota(semilla: number): PuntoTraza[] {
  const r = azar(semilla);
  const puntos: PuntoTraza[] = [];
  let t = T0;
  let lat = 31.69;
  const lng = -106.42;
  for (let i = 0; i < 400; i += 1) {
    const dado = r();
    if (dado < 0.03) {
      // Hueco: a veces estacionado (sin moverse), a veces se movió en silencio.
      t += (20 + r() * 160) * 60_000;
      if (r() < 0.5) lat += (2 + r() * 10) * GRADOS_POR_KM;
    } else if (dado < 0.05) {
      // Salto con regreso: un fantasma lejos, y de vuelta al camino.
      t += 30_000;
      puntos.push({ lat: lat + (5 + r() * 10) * GRADOS_POR_KM, lng, at: new Date(t), speed: 40 });
      t += 30_000;
    } else if (dado < 0.06) {
      // Salto sin regreso: el equipo se reubica de golpe.
      t += 60_000;
      lat += (8 + r() * 10) * GRADOS_POR_KM;
    } else {
      const seg = 5 + r() * 55;
      t += seg * 1000;
      lat += ((30 + r() * 20) * (seg / 3600)) * GRADOS_POR_KM;
    }
    puntos.push({ lat, lng, at: new Date(t), speed: 40 });
  }
  return puntos;
}

function dibujar(puntos: PuntoTraza[], grado: GradoDeTrazo) {
  const recorrido = recorridoPorVentana({ ventana: VENTANA, puntos, lugares: SIN_LUGARES });
  const cortada = cortarPorModalidad(recorrido, modalidadDesdeEspeciales([]));
  const paradas = paradasDeLaTraza(recorrido.tramos.flat(), { minMinutos: 10, umbralHuecoMinutos: SIN_SENAL_MINUTOS });
  const dibujo = trazoParaDibujar({ recorrido, cortada, paradas, toleranciaMetros: TOLERANCIA_POR_GRADO[grado] });
  return { recorrido, tramos: dibujo.tramos };
}

type Corte = { desde: Date; hasta: Date; que: string };

function segmentosQueCruzan(tramos: PuntoTraza[][], cortes: Corte[]): string[] {
  const malos: string[] = [];
  for (const c of cortes) {
    for (const tramo of tramos) {
      for (let i = 1; i < tramo.length; i += 1) {
        if (tramo[i - 1]!.at.getTime() <= c.desde.getTime() && tramo[i]!.at.getTime() >= c.hasta.getTime()) {
          malos.push(`${c.que} ${c.desde.toISOString()}→${c.hasta.toISOString()}`);
        }
      }
    }
  }
  return malos;
}

function cortesQueNoCortan(tramos: PuntoTraza[][], cortes: Corte[]): string[] {
  return cortes
    .filter((c) => {
      const termina = tramos.findIndex((t) => t.length > 0 && t[t.length - 1]!.at.getTime() === c.desde.getTime());
      const empieza = tramos.findIndex((t) => t.length > 0 && t[0]!.at.getTime() === c.hasta.getTime());
      return termina < 0 || empieza !== termina + 1;
    })
    .map((c) => `${c.que} ${c.desde.toISOString()}→${c.hasta.toISOString()}`);
}

describe("guardia · una traza rota se dibuja rota", () => {
  const semillas = Array.from({ length: 25 }, (_, i) => 1000 + i * 7919);
  const grados: GradoDeTrazo[] = [0, 1, 2, 3];

  it("las trazas de prueba de verdad traen huecos y saltos (guarda contra un falso verde)", () => {
    let huecos = 0;
    let saltos = 0;
    for (const s of semillas) {
      const { recorrido } = dibujar(trazaRota(s), 0);
      huecos += recorrido.huecos.length;
      saltos += recorrido.saltos.length;
    }
    expect(huecos).toBeGreaterThan(50);
    expect(saltos).toBeGreaterThan(50);
  });

  for (const grado of grados) {
    it(`grado ${grado}: ningún segmento dibujado encierra un hueco ni un salto, y cada uno es un corte`, () => {
      for (const s of semillas) {
        const { recorrido, tramos } = dibujar(trazaRota(s), grado);
        const cortes: Corte[] = [
          ...recorrido.huecos.map((h) => ({ desde: h.desde, hasta: h.hasta, que: "hueco" })),
          ...recorrido.saltos.map((x) => ({ desde: x.desde, hasta: x.hasta, que: "salto" })),
        ];
        expect(segmentosQueCruzan(tramos, cortes), `semilla ${s}`).toEqual([]);
        expect(cortesQueNoCortan(tramos, cortes), `semilla ${s}`).toEqual([]);
      }
    });
  }

  it("los dos puntos de cada salto se siguen dibujando: se niega la línea, no el punto", () => {
    for (const s of semillas) {
      const { recorrido, tramos } = dibujar(trazaRota(s), 3);
      const dibujados = new Set(tramos.flat().map((p) => p.at.getTime()));
      for (const x of recorrido.saltos) {
        expect(dibujados.has(x.desde.getTime()), `semilla ${s}`).toBe(true);
        expect(dibujados.has(x.hasta.getTime()), `semilla ${s}`).toBe(true);
      }
    }
  });

  it("el conteo de saltos del dibujo y el de los kilómetros salen de la misma regla", () => {
    for (const s of semillas) {
      const { recorrido } = dibujar(trazaRota(s), 0);
      expect(recorrido.cifras.saltosDescartados, `semilla ${s}`).toBe(recorrido.saltos.length);
    }
  });
});

describe("el salto, caso por caso", () => {
  const p = (seg: number, kmAlNorte: number): PuntoTraza => ({
    lat: 31.69 + kmAlNorte * GRADOS_POR_KM,
    lng: -106.42,
    at: new Date(T0 + seg * 1000),
    speed: 40,
  });

  it("un fantasma a 10 km por un minuto: tres tramos, y los tres puntos siguen ahí", () => {
    // 10 km en 60 s son 600 km/h: dos saltos, ida y vuelta.
    const traza = [p(0, 0), p(30, 0.2), p(90, 10.2), p(150, 0.5), p(180, 0.7)];
    const { recorrido, tramos } = dibujar(traza, 0);
    expect(recorrido.saltos).toHaveLength(2);
    expect(recorrido.saltos[0]!.km).toBeGreaterThan(9.9);
    expect(tramos.map((t) => t.length)).toEqual([2, 1, 2]);
    expect(tramos.flat()).toHaveLength(traza.length);
    expect(recorrido.huecos).toHaveLength(0);
  });

  it("a 299 km/h no es salto; a 301 sí (el umbral es el de los kilómetros)", () => {
    expect(SALTO_GPS_KMH).toBe(300);
    const km = (kmh: number) => (kmh * 60) / 3600; // en un minuto
    expect(dibujar([p(0, 0), p(60, km(299))], 0).recorrido.saltos).toHaveLength(0);
    expect(dibujar([p(0, 0), p(60, km(301))], 0).recorrido.saltos).toHaveLength(1);
  });

  it("un par que ya es hueco no es además salto: el hueco lo corta y lo dice", () => {
    // 100 km en 20 min: imposible, pero ya es silencio de más de 15 min.
    const { recorrido, tramos } = dibujar([p(0, 0), p(20 * 60, 100)], 0);
    expect(recorrido.huecos).toHaveLength(1);
    expect(recorrido.saltos).toHaveLength(0);
    expect(tramos).toHaveLength(2);
  });

  it("durante un salto el equipo sí transmitía: los minutos con señal no bajan", () => {
    const conSalto = dibujar([p(0, 0), p(60, 10), p(120, 10.5)], 0).recorrido;
    const sinSalto = dibujar([p(0, 0), p(60, 0.5), p(120, 1)], 0).recorrido;
    expect(conSalto.cifras.minutosConSenal).toBe(sinSalto.cifras.minutosConSenal);
    expect(conSalto.cifras.huecos).toBe(0);
  });
});
