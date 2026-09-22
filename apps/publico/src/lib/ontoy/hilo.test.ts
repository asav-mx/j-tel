import { describe, expect, it } from "vitest";
import { armarHilo, haciaDonde, type RenglonDelHilo } from "@/lib/ontoy/hilo";
import type { Forma, Sentido, UnidadViva, Vivo } from "@/lib/ontoy/forma";

/* Una calle recta de sur a norte (ida), paradas cada ~1.1 km. */
const LON = -106.45;
const TRAZADO: Array<[number, number]> = [
  [LON, 31.7],
  [LON, 31.75],
];
const parada = (id: string, lat: number, sentido: Sentido | null = "ida") => ({ id, nombre: id, orden: 0, sentido, lat, lon: LON });

const FORMA: Forma = {
  circuito_id: "r",
  nombre: "R",
  color_hex: "#FFB81C",
  piso_rango_seg: 60,
  dato_viejo_seg: 180,
  corredor_m: 150,
  velocidad_declarada_kmh: 20,
  horario: { inicio: "05:00", fin: "23:00", zona: "America/Ciudad_Juarez" },
  trazados: [{ sentido: "ida", coordenadas: TRAZADO, largo_m: 5560 }],
  paradas: [
    parada("Sur", 31.705),
    parada("Torres", 31.715, null),
    parada("solo-vuelta", 31.72, "vuelta"),
    parada("Ejército", 31.73),
    parada("Centro", 31.745),
  ],
};
const TPS = new Map<Sentido, Array<[number, number]>>([["ida", TRAZADO]]);

const unidad = (economico: string, lat: number, o: Partial<UnidadViva> = {}): UnidadViva => ({
  economico, lat, lon: LON, rumbo: 0, sentido: "ida", antiguedad_seg: 20, fresco: true, ...o,
});
const vivo = (unidades: UnidadViva[], o: Partial<Vivo> = {}): Vivo => ({
  estado: "en_vivo", abre_a: "05:00", arranca_el: null, rango_activo: false,
  promesa: null as unknown as Vivo["promesa"], unidades, generado_en: "2026-09-22T12:00:00Z", ...o,
});

const hilo = (v: Vivo | null, yo: { lat: number; lon: number } | null = null, guardadas: string[] = []) =>
  armarHilo({ forma: FORMA, vivo: v, sentido: "ida", yo, velocidadKmh: 20, trazadoPorSentido: TPS, estaGuardada: (id) => guardadas.includes(id) });

const resumen = (r: RenglonDelHilo[]) =>
  r.map((x) => (x.tipo === "parada" ? `${x.id}:${x.falta ?? "—"}` : x.tipo === "unidad" ? `[${x.economico}${x.fresca ? "" : " vieja"}]` : `AQUÍ:${x.falta ?? "·"}`));

describe("el hilo", () => {
  it("las paradas del sentido (y las de los dos) en orden de paso, con los camiones en su lugar", () => {
    expect(resumen(hilo(vivo([unidad("2120", 31.71)])))).toEqual([
      "Sur:—", // ya pasó: sin número
      "[2120]",
      "Torres:a 1 parada",
      "Ejército:a 2 paradas",
      "Centro:a 3 paradas",
    ]);
  });

  it("calibrada, las paradas dicen minutos", () => {
    const r = hilo(vivo([unidad("2120", 31.71)], { rango_activo: true }));
    const torres = r.find((x) => x.tipo === "parada" && x.id === "Torres");
    expect(torres && torres.tipo === "parada" && torres.falta).toMatch(/min$/);
  });

  it("el camión viejo se dibuja en su lugar, pero no le da número a ninguna parada", () => {
    expect(resumen(hilo(vivo([unidad("2087", 31.71, { fresco: false, antiguedad_seg: 500 })])))).toEqual([
      "Sur:—",
      "[2087 vieja]",
      "Torres:—",
      "Ejército:—",
      "Centro:—",
    ]);
  });

  it("«aquí estás» sin calibración es sólo el punto; calibrada, lleva sus minutos", () => {
    const yo = { lat: 31.738, lon: LON };
    expect(resumen(hilo(vivo([unidad("2120", 31.71)]), yo))).toContain("AQUÍ:·");
    const cal = hilo(vivo([unidad("2120", 31.71)], { rango_activo: true }), yo).find((x) => x.tipo === "aqui");
    expect(cal && cal.tipo === "aqui" && cal.falta).toMatch(/min$/);
  });

  it("«aquí estás» sólo sobre el corredor: lejos de la ruta no aparece", () => {
    expect(hilo(vivo([]), { lat: 31.73, lon: LON + 0.02 }).some((x) => x.tipo === "aqui")).toBe(false);
  });

  it("con la ruta cerrada no se dibujan camiones ni números", () => {
    const r = hilo(vivo([unidad("2120", 31.71)], { estado: "fuera_de_horario" }));
    expect(r.every((x) => x.tipo === "parada" && x.falta === null)).toBe(true);
  });

  it("marca las guardadas", () => {
    const r = hilo(vivo([]), null, ["Ejército"]);
    expect(r.filter((x) => x.tipo === "parada" && x.guardada).map((x) => x.tipo === "parada" && x.id)).toEqual(["Ejército"]);
  });
});

describe("el nombre del sentido", () => {
  it("«hacia ‹última parada›», sacado del circuito", () => {
    expect(haciaDonde(FORMA, "ida", TPS)).toBe("hacia Centro");
  });
  it("sin trazado de ese sentido no inventa: null, y la pantalla dice «Vuelta»", () => {
    expect(haciaDonde(FORMA, "vuelta", TPS)).toBeNull();
  });
});
