import { describe, expect, it } from "vitest";
import { armarJornada, type EntradaDeJornada, type PasoDeJornada } from "./jornada.js";
import type { PuntoTraza } from "./huecos.js";

/*
 * La jornada contra un circuito de juguete: una recta sobre el ecuador de
 * ~4 km con cinco paradas cada ~1 km. Umbral de silencio 180 s, corredor
 * 150 m, 3 min fuera para contar salida. El reloj en minutos desde T0.
 */
const T0 = new Date("2026-09-20T12:00:00Z").getTime();
const t = (min: number) => new Date(T0 + min * 60_000);
const LON = [0, 0.009, 0.018, 0.027, 0.036];
const IDA: Array<[number, number]> = [
  [0, 0],
  [0.036, 0],
];

const PARADAS = LON.map((lon, i) => ({ stopId: `p${i + 1}`, nombre: `P${i + 1}`, sentido: null, lat: 0, lon }));

/** Puntos cada 30 s, en línea recta de (lat, lon) a (lat2, lon2). */
function puntos(desde: number, hasta: number, de: [number, number], a: [number, number]): PuntoTraza[] {
  const salida: PuntoTraza[] = [];
  const pasos = Math.round((hasta - desde) * 2);
  for (let i = 0; i <= pasos; i += 1) {
    const f = pasos === 0 ? 0 : i / pasos;
    salida.push({ lat: de[0] + (a[0] - de[0]) * f, lng: de[1] + (a[1] - de[1]) * f, at: t(desde + i / 2), speed: 20 });
  }
  return salida;
}
const enRuta = (desde: number, hasta: number, lon0: number, lon1: number) => puntos(desde, hasta, [0, lon0], [0, lon1]);
/** ~1.1 km al norte del trazado: fuera de cualquier tolerancia. */
const fuera = (desde: number, hasta: number) => puntos(desde, hasta, [0.01, 0.02], [0.01, 0.02]);

const paso = (n: number, min: number, sentido: "ida" | "vuelta" = "ida"): PasoDeJornada => ({
  stopId: `p${n}`,
  sentido,
  pasoDesde: t(min),
  pasoHasta: t(min + 0.3),
});

function jornada(e: Partial<EntradaDeJornada> & { puntos: PuntoTraza[]; pasos: PasoDeJornada[] }) {
  return armarJornada({
    ventana: { desde: t(0), hasta: t(120) },
    paradas: PARADAS,
    trazados: [
      { sentido: "ida", coordinates: IDA },
      { sentido: "vuelta", coordinates: [...IDA].reverse() },
    ],
    medidoHasta: t(120),
    silencioSegundos: 180,
    corredorMetros: 150,
    ...e,
  });
}

describe("armarJornada · la vuelta, clasificada sólo con lo medido", () => {
  it("con pasos por todas las paradas, en orden, es completa", () => {
    const j = jornada({
      puntos: enRuta(-10, 120, 0, 0.036),
      pasos: [paso(1, 1), paso(2, 30), paso(3, 60), paso(4, 90), paso(5, 115)],
    });
    expect(j.vueltas).toHaveLength(1);
    expect(j.vueltas[0]!).toMatchObject({ estado: "completa", faltan: [] });
  });

  it("LA LEY: una vuelta cuyo final cae en un silencio NUNCA sale incompleta — aunque antes haya salido del corredor", () => {
    /*
     * Pasa P1–P3, se sale del corredor 5 min (medido) y luego calla 40 min.
     * La salida es real, pero lo que pasó con P4 y P5 cae en el silencio: no
     * se sabe si regresó y las hizo. Ante la duda, SIN DATOS.
     */
    const j = jornada({
      puntos: [...enRuta(-5, 25, 0, 0.02), ...fuera(25, 30), ...enRuta(70, 120, 0.036, 0.036)],
      pasos: [paso(1, 1), paso(2, 10), paso(3, 20)],
    });
    expect(j.salidas).toHaveLength(1);
    expect(j.salidas[0]!.termina).toBe("silencio");
    expect(j.vueltas[0]!.estado).toBe("sin_datos");
    expect(j.vueltas[0]!.estado).not.toBe("incompleta");
    expect(j.vueltas[0]!.faltan[0]!).toMatchObject({ donde: "final", causa: { tipo: "sin_datos" } });
  });

  it("faltan las del final y hay una salida medida que lo explica → incompleta · salió del corredor en ‹parada›", () => {
    const j = jornada({
      puntos: [...enRuta(-5, 22, 0, 0.02), ...fuera(22, 120)],
      pasos: [paso(1, 1), paso(2, 10), paso(3, 20)],
    });
    const v = j.vueltas[0]!;
    expect(v.estado).toBe("incompleta");
    expect(v.faltan[0]!).toMatchObject({
      donde: "final",
      paradas: [{ nombre: "P4" }, { nombre: "P5" }],
      causa: { tipo: "salio_del_corredor", nombre: "P3" },
    });
  });

  it("faltan las del principio y venía de fuera del corredor → entró al corredor en ‹parada›, no «salió»", () => {
    const j = jornada({
      puntos: [...fuera(-10, 10), ...enRuta(10.5, 120, 0.018, 0.036)],
      pasos: [paso(3, 12), paso(4, 40), paso(5, 70)],
    });
    const v = j.vueltas[0]!;
    expect(v.estado).toBe("incompleta");
    expect(v.faltan[0]!).toMatchObject({
      donde: "principio",
      paradas: [{ nombre: "P1" }, { nombre: "P2" }],
      causa: { tipo: "entro_al_corredor", nombre: "P3" },
    });
  });

  it("sin causa medida —en el corredor y con señal— se listan las paradas sin adjetivo", () => {
    const j = jornada({
      puntos: enRuta(-5, 120, 0, 0.036),
      pasos: [paso(1, 1), paso(2, 30), paso(4, 90), paso(5, 115)],
    });
    const v = j.vueltas[0]!;
    expect(v.estado).toBe("paradas_sin_paso");
    expect(v.faltan).toEqual([
      expect.objectContaining({ donde: "medio", paradas: [{ stopId: "p3", nombre: "P3" }], causa: { tipo: "sin_causa_medida" } }),
    ]);
  });

  it("la misma regla en medio: un silencio entre dos pasos es SIN DATOS", () => {
    const j = jornada({
      puntos: [...enRuta(-5, 35, 0, 0.012), ...enRuta(80, 120, 0.03, 0.036)],
      pasos: [paso(1, 1), paso(2, 30), paso(4, 90), paso(5, 115)],
    });
    expect(j.vueltas[0]!.estado).toBe("sin_datos");
    expect(j.vueltas[0]!.faltan[0]!).toMatchObject({ donde: "medio", causa: { tipo: "sin_datos" } });
  });

  it("después de lo que el detector ya procesó, «todavía no se mide» — no «sin paso»", () => {
    const j = jornada({
      puntos: enRuta(-5, 120, 0, 0.036),
      pasos: [paso(1, 1), paso(2, 10), paso(3, 20)],
      medidoHasta: t(25),
    });
    expect(j.vueltas[0]!.estado).toBe("todavia_no_se_mide");
    expect(j.vueltas[0]!.faltan[0]!.causa).toEqual({ tipo: "todavia_no_se_mide" });
  });

  it("sin nada procesado todavía, tampoco se afirma que faltó algo", () => {
    const j = jornada({ puntos: enRuta(-5, 120, 0, 0.036), pasos: [paso(3, 60)], medidoHasta: null });
    expect(j.vueltas[0]!.estado).toBe("todavia_no_se_mide");
  });
});

describe("armarJornada · los bordes del día", () => {
  it("un camión encendido antes de abrir SÍ tiene evidencia en la apertura", () => {
    const j = jornada({ puntos: enRuta(-20, 120, 0.018, 0.036), pasos: [paso(3, 5), paso(4, 40), paso(5, 70)] });
    expect(j.vueltas[0]!.faltan[0]!.causa.tipo).toBe("sin_causa_medida");
  });

  it("uno que prende después de abrir no la tiene: SIN DATOS, no «le faltaron paradas»", () => {
    const j = jornada({ puntos: enRuta(4, 120, 0.018, 0.036), pasos: [paso(3, 5), paso(4, 40), paso(5, 70)] });
    expect(j.vueltas[0]!.faltan[0]!.causa.tipo).toBe("sin_datos");
  });
});

describe("armarJornada · vueltas, salidas y silencios", () => {
  it("cambiar de sentido, o regresar a una parada anterior, abre otra vuelta", () => {
    const j = jornada({
      puntos: enRuta(-5, 120, 0, 0.036),
      pasos: [
        paso(1, 1), paso(2, 5), paso(3, 10), paso(4, 15), paso(5, 20),
        paso(5, 25, "vuelta"), paso(4, 30, "vuelta"), paso(3, 35, "vuelta"), paso(2, 40, "vuelta"), paso(1, 45, "vuelta"),
        paso(1, 50), paso(2, 55),
      ],
    });
    expect(j.vueltas.map((v) => [v.sentido, v.pasos.length])).toEqual([
      ["ida", 5],
      ["vuelta", 5],
      ["ida", 2],
    ]);
    expect(j.vueltas.slice(0, 2).every((v) => v.estado === "completa")).toBe(true);
  });

  it("el brinco del GPS —menos de 3 min fuera— no es una salida", () => {
    const j = jornada({
      puntos: [...enRuta(-5, 20, 0, 0.01), ...fuera(20.5, 22), ...enRuta(22.5, 120, 0.01, 0.036)],
      pasos: [paso(1, 1)],
    });
    expect(j.salidas).toEqual([]);
  });

  it("los silencios salen con sus minutos, recortados al día, y los km no cruzan un silencio", () => {
    const conSilencio = jornada({
      puntos: [...enRuta(-10, 30, 0, 0.018), ...enRuta(60, 120, 0.027, 0.036)],
      pasos: [],
    });
    expect(conSilencio.silencios).toEqual([{ desde: t(30), hasta: t(60), minutos: 30 }]);
    expect(conSilencio.cifras.minutosDeSilencio).toBe(30);
    // 1.5 km dentro del día antes del silencio + 1 km después. Reapareció 1 km más
    // adelante, y ese kilómetro NO se cuenta: dentro de un silencio no hay recorrido.
    expect(conSilencio.cifras.kmMedidos).toBeCloseTo(2.5, 1);
  });

  it("la hoja sabe con qué umbrales se cortó", () => {
    const j = jornada({ puntos: [], pasos: [] });
    expect(j.umbrales).toEqual({ silencioSegundos: 180, corredorMetros: 150, minutosFuera: 3 });
  });

  it("no califica ni nombra a nadie: ninguna salida dice cortada, puntaje ni chofer", () => {
    const j = jornada({
      puntos: [...enRuta(-5, 22, 0, 0.02), ...fuera(22, 120)],
      pasos: [paso(1, 1), paso(2, 10), paso(3, 20)],
    });
    expect(JSON.stringify(j)).not.toMatch(/cortad|puntaje|calificaci|chofer|driver/i);
  });
});
