import { describe, expect, it } from "vitest";
import { avisosDeTusRutas, deQuienSonLosAvisos, fechaDelAviso, hayAvisosNuevos } from "@/lib/ontoy/avisos";
import { registrarSondeo, TELEFONO_INICIAL } from "@/lib/ontoy/avisos-del-telefono";
import { rutasDeLaConsulta } from "@/lib/ontoy/consulta-de-la-raiz";
import type { Vivo } from "@/lib/ontoy/forma";

const ZONA = "America/Ciudad_Juarez";
const RUTAS = [
  { circuito_id: "zaragoza-centro", nombre: "Zaragoza–Centro", color_hex: "#FFB81C", horario: { zona: ZONA } },
  { circuito_id: "insurgentes", nombre: "Insurgentes", color_hex: "#2EC4B6", horario: { zona: ZONA } },
];
const aviso = (id: string, desde: string) => ({ id, titulo: `Aviso ${id}`, detalle: null, desde, hasta: null });
const vivo = (avisos: ReturnType<typeof aviso>[]) => ({ avisos } as unknown as Vivo);

describe("los avisos en la campana", () => {
  it("juntan los de todas tus rutas, los más nuevos arriba, con su ruta y su color", () => {
    const r = avisosDeTusRutas(
      new Map([
        ["zaragoza-centro", vivo([aviso("a1", "2026-09-22T10:00:00Z")])],
        ["insurgentes", vivo([aviso("b1", "2026-09-22T12:00:00Z")])],
      ]),
      RUTAS,
    );
    expect(r.map((x) => [x.id, x.nombreDeRuta, x.color])).toEqual([
      ["b1", "Insurgentes", "#2EC4B6"],
      ["a1", "Zaragoza–Centro", "#FFB81C"],
    ]);
  });

  it("un aviso retirado desaparece en la siguiente consulta: no hay memoria que lo retenga", () => {
    const antes = avisosDeTusRutas(new Map([["zaragoza-centro", vivo([aviso("a1", "2026-09-22T10:00:00Z")])]]), RUTAS);
    expect(antes).toHaveLength(1);
    // La siguiente respuesta ya no lo trae (el servidor lo quitó al retirarlo: 0052, listAvisosVigentes).
    const despues = avisosDeTusRutas(new Map([["zaragoza-centro", vivo([])]]), RUTAS);
    expect(despues).toEqual([]);
    // Y el punto de la campana se apaga con él, aunque nunca lo hayas visto.
    expect(hayAvisosNuevos(despues, new Set())).toBe(false);
  });

  it("el punto: sólo si hay uno que no has visto", () => {
    const r = avisosDeTusRutas(new Map([["zaragoza-centro", vivo([aviso("a1", "2026-09-22T10:00:00Z")])]]), RUTAS);
    expect(hayAvisosNuevos(r, new Set())).toBe(true);
    expect(hayAvisosNuevos(r, new Set(["a1"]))).toBe(false);
  });

  it("la fecha va en la hora de la ruta: hoy, ayer, o el día", () => {
    const ahora = new Date("2026-09-22T18:00:00Z"); // 12:00 en Juárez
    expect(fechaDelAviso("2026-09-22T12:32:00Z", ZONA, ahora)).toBe("Hoy 6:32");
    expect(fechaDelAviso("2026-09-21T20:20:00Z", ZONA, ahora)).toBe("Ayer 14:20");
    expect(fechaDelAviso("2026-09-15T20:20:00Z", ZONA, ahora)).toMatch(/^15 sep, 14:20$/);
  });
});

describe("los avisos del teléfono (aparte, y sin prender el punto)", () => {
  const t = (min: number) => new Date(Date.UTC(2026, 8, 22, 12, min));

  it("un sondeo fallido suelto es ruido, no un aviso", () => {
    const e = registrarSondeo(TELEFONO_INICIAL, { ok: false, status: null, ahora: t(0) });
    expect(e.avisos).toEqual([]);
  });

  it("un minuto seguido sin respuesta es un aviso, que se cierra con el primer éxito", () => {
    let e = registrarSondeo(TELEFONO_INICIAL, { ok: false, status: null, ahora: t(0) });
    e = registrarSondeo(e, { ok: false, status: null, ahora: t(1) });
    expect(e.avisos).toEqual([{ tipo: "red", desde: t(0).toISOString(), hasta: null }]);
    e = registrarSondeo(e, { ok: true, status: 200, ahora: t(3) });
    expect(e.avisos).toEqual([{ tipo: "red", desde: t(0).toISOString(), hasta: t(3).toISOString() }]);
  });

  it("el 429 se dice una vez por episodio", () => {
    let e = registrarSondeo(TELEFONO_INICIAL, { ok: false, status: 429, ahora: t(0) });
    e = registrarSondeo(e, { ok: false, status: 429, ahora: t(1) });
    expect(e.avisos.filter((a) => a.tipo === "espera")).toHaveLength(1);
    e = registrarSondeo(e, { ok: true, status: 200, ahora: t(2) });
    expect(e.avisos[0]!.hasta).toBe(t(2).toISOString());
  });
});

describe("la consulta única de la raíz", () => {
  it("la ruta abierta va primero y nunca se queda fuera del tope", () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `r${i}`);
    const r = rutasDeLaConsulta(muchas, "abierta");
    expect(r[0]).toBe("abierta");
    expect(r).toHaveLength(8);
  });
  it("sin favoritas y sin ruta abierta, no se pregunta nada", () => {
    expect(rutasDeLaConsulta([], null)).toEqual([]);
  });
  it("una favorita abierta no se repite", () => {
    expect(rutasDeLaConsulta(["a", "b"], "a")).toEqual(["a", "b"]);
  });
});

describe("de quién son los avisos (la línea bajo el título)", () => {
  const de = (ruta: string) => ({ ruta }) as Parameters<typeof deQuienSonLosAvisos>[0][number];
  const guardadas = new Set(["zaragoza-centro"]);

  it("lo del diseño cuando es cierto: todos de tus guardadas", () => {
    expect(deQuienSonLosAvisos([de("zaragoza-centro")], guardadas)).toBe("De tus rutas guardadas");
  });

  it("sin avisos también: el alcance que se consultó incluye tus guardadas", () => {
    expect(deQuienSonLosAvisos([], guardadas)).toBe("De tus rutas guardadas");
  });

  it("un aviso de la ruta abierta que NO guardaste no se llama «de tus guardadas» (§D)", () => {
    expect(deQuienSonLosAvisos([de("zaragoza-centro"), de("insurgentes")], guardadas)).toBe(
      "De tus rutas guardadas y la que estás viendo",
    );
    expect(deQuienSonLosAvisos([de("insurgentes")], guardadas)).toBe("De la ruta que estás viendo");
  });
});
