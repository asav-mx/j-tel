import { describe, expect, it } from "vitest";
import { paradasEnPalabras, paradasHastaLaParada, dondeCaeLaParada } from "@/lib/ontoy/llegadas";
import type { Forma, Sentido, UnidadViva, Vivo } from "@/lib/ontoy/forma";

/*
 * «A N paradas» en Ontoy (8.9b): sale de la posición real y del orden de las
 * paradas, sin ninguna velocidad. Una calle recta de sur a norte, paradas cada
 * ~1.1 km, la del pasajero es la última.
 */

const LON = -106.45;
const TRAZADO: Array<[number, number]> = [
  [LON, 31.7],
  [LON, 31.75],
];
const parada = (id: string, lat: number, sentido: Sentido | null = "ida") => ({ id, nombre: id, orden: 0, sentido, lat, lon: LON });

const FORMA: Forma = {
  circuito_id: "r",
  nombre: "R",
  color_hex: "#000",
  piso_rango_seg: 60,
  dato_viejo_seg: 180,
  corredor_m: 150,
  velocidad_declarada_kmh: 20,
  horario: { inicio: "05:00", fin: "23:00", zona: "America/Ciudad_Juarez" },
  trazados: [{ sentido: "ida", coordenadas: TRAZADO, largo_m: 5560 }],
  paradas: [
    parada("a", 31.71),
    parada("b", 31.72, null), // sirve a los dos sentidos: cuenta
    parada("solo-vuelta", 31.725, "vuelta"), // no cuenta en ida
    parada("c", 31.73),
    parada("mia", 31.74),
  ],
};

const unidad = (economico: string, lat: number, o: Partial<UnidadViva> = {}): UnidadViva => ({
  economico,
  lat,
  lon: LON,
  rumbo: 0,
  sentido: "ida",
  antiguedad_seg: 20,
  fresco: true,
  ...o,
});

const vivo = (unidades: UnidadViva[]): Vivo => ({
  estado: "en_vivo",
  abre_a: "05:00",
  arranca_el: null,
  rango_activo: false,
  promesa: null as unknown as Vivo["promesa"],
  unidades,
  generado_en: "2026-09-22T12:00:00Z",
});

const trazadoPorSentido = new Map<Sentido, Array<[number, number]>>([["ida", TRAZADO]]);
const destino = { avanceMetros: dondeCaeLaParada(FORMA.paradas[4]!, TRAZADO, 150)!, sentido: "ida" as const };
const contar = (us: UnidadViva[]) => paradasHastaLaParada(destino, { forma: FORMA, vivo: vivo(us), trazadoPorSentido });

describe("a N paradas", () => {
  it("cuenta las paradas de ese sentido (y las de los dos), incluida la tuya", () => {
    // Entre 31.705 y la tuya: a, b, c, mia. «solo-vuelta» no cuenta.
    expect(contar([unidad("2120", 31.705)])).toMatchObject([{ paradas: 4, unidad: "2120", fresca: true }]);
  });

  it("«a 1 parada» cuando la siguiente es la tuya", () => {
    expect(contar([unidad("2120", 31.735)])[0]!.paradas).toBe(1);
    expect(paradasEnPalabras(1)).toBe("a 1 parada");
    expect(paradasEnPalabras(3)).toBe("a 3 paradas");
  });

  it("la que ya pasó, la del otro sentido y la que va fuera del corredor no cuentan", () => {
    expect(
      contar([
        unidad("pasó", 31.745),
        unidad("vuelta", 31.705, { sentido: "vuelta" }),
        unidad("fuera", 31.705, { lon: LON + 0.01 }),
      ]),
    ).toEqual([]);
  });

  it("la vieja también se cuenta —en pasado, lo dice la pantalla— y va después de las frescas", () => {
    const r = contar([unidad("vieja", 31.735, { fresco: false, antiguedad_seg: 360 }), unidad("fresca", 31.705)]);
    expect(r.map((x) => [x.unidad, x.fresca, x.paradas])).toEqual([
      ["fresca", true, 4],
      ["vieja", false, 1],
    ]);
  });

  it("no usa ninguna velocidad: con la declarada en cero cuenta igual", () => {
    const forma = { ...FORMA, velocidad_declarada_kmh: 0 };
    expect(paradasHastaLaParada(destino, { forma, vivo: vivo([unidad("2120", 31.705)]), trazadoPorSentido })[0]!.paradas).toBe(4);
  });
});
