import { describe, expect, it } from "vitest";
import type { Vivo } from "./forma";
import { dichoDeOntoy, dichoDelRenglon, edadAlDia, elegirLectura } from "./lectura-de-la-guardada";

/*
 * **SIN SEÑAL, INICIO NO HABLA EN PRESENTE** (auditoría del 25-sep).
 *
 * Con la red caída, la tarjeta de «Tu próximo camión» seguía diciendo «Tu
 * Zaragoza–Centro viene a 1 parada» con la última respuesta, y el encabezado
 * decía «Sin señal ahorita» encima. Estas pruebas se caen si la escalera vuelve
 * a poner una lectura en presente por delante de la red caída.
 */

const vivo = { estado: "en_vivo", abre_a: "05:00", arranca_el: null, rango_activo: false, promesa: null, unidades: [] } as unknown as Vivo;
const fresca = { paradas: 1, unidad: "2120", antiguedadSeg: 20, fresca: true };
const vieja = { paradas: 4, unidad: "2087", antiguedadSeg: 540, fresca: false };
const enMinutos = { rango: { minimo: 0, maximo: 5 }, unidad: "2120", antiguedadSeg: 20 } as never;

describe("sin señal, lo último que supimos", () => {
  it("con una unidad fresca de antes de la caída: pasado, no presente", () => {
    const l = elegirLectura({ error: true, cargando: false, vivo, proxima: null, porParadas: [fresca] });
    expect(l).toEqual({ tipo: "lo-ultimo", paradas: 1, unidad: "2120", edadSeg: 20 });

    const d = dichoDeOntoy(l, "Zaragoza–Centro");
    expect(d.pose).toBe("sin-red");
    expect(d.dicho).toBe("Sin señal");
    expect(d.apoyo).toBe("Lo último que supimos: la 2120 iba a 1 parada, posición de hace 20 s.");
    expect(`${d.dicho} ${d.apoyo}`).not.toMatch(/\bviene\b/);
  });

  it("con los minutos prendidos tampoco: un rango de una posición vieja es de hace rato", () => {
    const l = elegirLectura({ error: true, cargando: false, vivo, proxima: enMinutos, porParadas: [fresca] });
    expect(l.tipo).toBe("lo-ultimo");
  });

  it("si lo único que había era una unidad vieja, también se dice como lo último", () => {
    expect(elegirLectura({ error: true, cargando: false, vivo, proxima: null, porParadas: [vieja] })).toEqual({
      tipo: "lo-ultimo",
      paradas: 4,
      unidad: "2087",
      edadSeg: 540,
    });
  });

  it("sin nada que se supiera antes, sólo «sin señal»", () => {
    expect(elegirLectura({ error: true, cargando: false, vivo, proxima: null, porParadas: [] })).toEqual({ tipo: "sin-red" });
  });

  it("el renglón no lleva cifra grande: el número grande se lee como de ahorita", () => {
    const r = dichoDelRenglon({ tipo: "lo-ultimo", paradas: 1, unidad: "2120", edadSeg: 20 });
    expect(r.grande).toBeNull();
    expect(r.chico).toBe("sin señal · la 2120 iba a 1 parada · hace 20 s");
  });
});

describe("con señal, la escalera de siempre", () => {
  it("una unidad fresca se dice en presente", () => {
    expect(elegirLectura({ error: false, cargando: false, vivo, proxima: null, porParadas: [fresca, vieja] }).tipo).toBe("paradas");
  });

  it("los minutos, si están prendidos, van antes que las paradas", () => {
    expect(elegirLectura({ error: false, cargando: false, vivo, proxima: enMinutos, porParadas: [fresca] }).tipo).toBe("rango");
  });

  it("sólo una unidad vieja: «no veo tu ruta», con lo último que se vio", () => {
    expect(elegirLectura({ error: false, cargando: false, vivo, proxima: null, porParadas: [vieja] }).tipo).toBe("vieja");
  });
});

describe("la edad de un dato que dejó de llegar sigue creciendo", () => {
  const recibido = Date.parse("2026-09-26T04:00:00Z");

  it("se le suma lo que lleva la red caída", () => {
    expect(edadAlDia(20, recibido, recibido + 10 * 60_000)).toBe(620);
  });

  it("y la frase lo dice: no se queda en «hace 1 min»", () => {
    const edad = edadAlDia(20, recibido, recibido + 10 * 60_000);
    expect(dichoDeOntoy({ tipo: "lo-ultimo", paradas: 1, unidad: "2120", edadSeg: edad }, "X").apoyo).toContain("hace 10 min");
  });

  it("sin respuesta anterior, o con el reloj hacia atrás, no inventa", () => {
    expect(edadAlDia(20, null, recibido)).toBe(20);
    expect(edadAlDia(20, recibido, recibido - 5_000)).toBe(20);
  });
});
