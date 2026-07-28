import { describe, it, expect } from "vitest";
import {
  construirCenso,
  instanteZonificado,
  ventanaLocal,
  SALTO_GPS_KMH,
  type EntradaCenso,
  type PuntoObservado,
  type UnidadDeFlota,
} from "./recorrido.js";

const desde = new Date("2026-07-27T11:00:00.000Z");
const hasta = new Date("2026-07-27T17:00:00.000Z");

const unidad = (id: string, label = id): UnidadDeFlota => ({
  id,
  label,
  plateNumber: null,
});

/** Puntos cada `cadaSegundos`, todos en el mismo lugar salvo que se diga. */
function serie(
  unitId: string,
  imei: string,
  n: number,
  cadaSegundos: number,
  inicio = desde,
  lat = 31.7,
  lng = -106.4,
): PuntoObservado[] {
  return Array.from({ length: n }, (_, i) => ({
    unitId,
    imei,
    recordedAt: new Date(inicio.getTime() + i * cadaSegundos * 1000),
    latitude: lat,
    longitude: lng,
  }));
}

const entrada = (over: Partial<EntradaCenso> = {}): EntradaCenso => ({
  ventana: { desde, hasta },
  unidades: [unidad("u1")],
  puntos: serie("u1", "i1", 10, 40),
  ultimoDatoPorUnidad: new Map(),
  ...over,
});

const fila = (c: ReturnType<typeof construirCenso>, unitId: string) =>
  c.filas.find((f) => f.unitId === unitId)!;

describe("las tres categorías", () => {
  it("reportó, dejó de reportar y nunca reportó se cuentan por separado", () => {
    const c = construirCenso(
      entrada({
        unidades: [unidad("u1"), unidad("u2"), unidad("u3")],
        puntos: serie("u1", "i1", 5, 40),
        ultimoDatoPorUnidad: new Map([["u2", new Date("2026-07-25T21:16:00.000Z")]]),
      }),
    );

    expect(c.activas).toBe(3);
    expect(c.reportaron).toBe(1);
    expect(c.dejaronDeReportar).toBe(1);
    expect(c.nuncaReportaron).toBe(1);

    expect(fila(c, "u1").categoria).toBe("reporto");
    expect(fila(c, "u2").categoria).toBe("dejo_de_reportar");
    expect(fila(c, "u3").categoria).toBe("nunca_reporto");
  });

  it("la muda con fecha la trae; la invisible la deja en null", () => {
    const ultimo = new Date("2026-07-25T21:16:00.000Z");
    const c = construirCenso(
      entrada({
        unidades: [unidad("u2"), unidad("u3")],
        puntos: [],
        ultimoDatoPorUnidad: new Map([["u2", ultimo]]),
      }),
    );
    expect(fila(c, "u2").ultimoDatoConocido).toEqual(ultimo);
    expect(fila(c, "u3").ultimoDatoConocido).toBeNull();
  });

  it("NINGUNA unidad activa se omite, reporte o no", () => {
    const c = construirCenso(
      entrada({
        unidades: Array.from({ length: 82 }, (_, i) => unidad(`u${i}`)),
        puntos: Array.from({ length: 50 }, (_, i) => serie(`u${i}`, `i${i}`, 3, 40)).flat(),
      }),
    );
    // El caso real del 2026-07-28: 82 activas, 50 reportaron, 32 mudas.
    expect(c.filas).toHaveLength(82);
    expect(c.activas).toBe(82);
    expect(c.reportaron).toBe(50);
    expect(c.dejaronDeReportar + c.nuncaReportaron).toBe(32);
  });
});

describe("intervalo mediano", () => {
  it("pings parejos dan el intervalo exacto", () => {
    const c = construirCenso(entrada({ puntos: serie("u1", "i1", 10, 40) }));
    expect(fila(c, "u1").intervaloMedianoSegundos).toBe(40);
  });

  it("un hueco largo NO arrastra la mediana como sí arrastraría el promedio", () => {
    // Nueve intervalos de 40 s y uno de una hora. Promedio ≈ 356 s; mediana 40.
    const base = serie("u1", "i1", 10, 40);
    base.push({
      ...base[9]!,
      recordedAt: new Date(base[9]!.recordedAt.getTime() + 3_600_000),
    });
    const c = construirCenso(entrada({ puntos: base }));
    expect(fila(c, "u1").intervaloMedianoSegundos).toBe(40);
  });

  it("con un solo punto no hay intervalo, y se dice null en vez de cero", () => {
    const c = construirCenso(entrada({ puntos: serie("u1", "i1", 1, 40) }));
    expect(fila(c, "u1").puntos).toBe(1);
    expect(fila(c, "u1").intervaloMedianoSegundos).toBeNull();
    expect(fila(c, "u1").kmAproximados).toBeNull();
  });

  it("distingue la densidad sana del 27 de la delgada del 28", () => {
    const sana = construirCenso(entrada({ puntos: serie("u1", "i1", 100, 40) }));
    const delgada = construirCenso(entrada({ puntos: serie("u1", "i1", 100, 73) }));
    expect(fila(sana, "u1").intervaloMedianoSegundos).toBe(40);
    expect(fila(delgada, "u1").intervaloMedianoSegundos).toBe(73);
  });
});

describe("dos equipos en una unidad", () => {
  it("cuenta los puntos de los dos pero mide la densidad del que más reportó", () => {
    // i1 cada 40 s; i2 cada 40 s pero desfasado 20 s. Intercalados darían 20 s
    // de intervalo — una densidad que ninguno de los dos equipos tuvo.
    const c = construirCenso(
      entrada({
        puntos: [
          ...serie("u1", "i1", 10, 40),
          ...serie("u1", "i2", 4, 40, new Date(desde.getTime() + 20_000)),
        ],
      }),
    );
    expect(fila(c, "u1").puntos).toBe(14);
    expect(fila(c, "u1").equipos).toBe(2);
    expect(fila(c, "u1").intervaloMedianoSegundos).toBe(40);
  });
});

describe("kilómetros aproximados", () => {
  it("suma el recorrido real", () => {
    // Dos puntos a ~1 km, un minuto aparte: 60 km/h, movimiento legítimo.
    const puntos: PuntoObservado[] = [
      { unitId: "u1", imei: "i1", recordedAt: desde, latitude: 31.7, longitude: -106.4 },
      {
        unitId: "u1",
        imei: "i1",
        recordedAt: new Date(desde.getTime() + 60_000),
        latitude: 31.709,
        longitude: -106.4,
      },
    ];
    const c = construirCenso(entrada({ puntos }));
    expect(fila(c, "u1").kmAproximados).toBeCloseTo(1.0, 1);
    expect(fila(c, "u1").saltosDescartados).toBe(0);
  });

  it("descarta el salto imposible y lo declara en vez de esconderlo", () => {
    // ~111 km en un minuto = 6 660 km/h. Muy por encima del umbral.
    const puntos: PuntoObservado[] = [
      { unitId: "u1", imei: "i1", recordedAt: desde, latitude: 31.7, longitude: -106.4 },
      {
        unitId: "u1",
        imei: "i1",
        recordedAt: new Date(desde.getTime() + 60_000),
        latitude: 32.7,
        longitude: -106.4,
      },
    ];
    const c = construirCenso(entrada({ puntos }));
    expect(fila(c, "u1").kmAproximados).toBe(0);
    expect(fila(c, "u1").saltosDescartados).toBe(1);
    expect(SALTO_GPS_KMH).toBe(300);
  });

  it("dos lecturas del mismo instante no son tramo ni salto", () => {
    const puntos: PuntoObservado[] = [
      { unitId: "u1", imei: "i1", recordedAt: desde, latitude: 31.7, longitude: -106.4 },
      { unitId: "u1", imei: "i1", recordedAt: desde, latitude: 31.8, longitude: -106.4 },
    ];
    const c = construirCenso(entrada({ puntos }));
    expect(fila(c, "u1").kmAproximados).toBe(0);
    expect(fila(c, "u1").saltosDescartados).toBe(0);
  });
});

describe("orden de las filas", () => {
  it("primero las que reportaron, luego las mudas con fecha, al final las invisibles", () => {
    const c = construirCenso(
      entrada({
        unidades: [unidad("u3", "C"), unidad("u2", "B"), unidad("u1", "A")],
        puntos: serie("u1", "i1", 3, 40),
        ultimoDatoPorUnidad: new Map([["u2", new Date("2026-07-25T21:16:00.000Z")]]),
      }),
    );
    expect(c.filas.map((f) => f.unitId)).toEqual(["u1", "u2", "u3"]);
  });

  it("entre las mudas, la que calló más recientemente va arriba", () => {
    const c = construirCenso(
      entrada({
        unidades: [unidad("u1", "A"), unidad("u2", "B")],
        puntos: [],
        ultimoDatoPorUnidad: new Map([
          ["u1", new Date("2026-07-22T22:42:00.000Z")],
          ["u2", new Date("2026-07-25T21:16:00.000Z")],
        ]),
      }),
    );
    expect(c.filas.map((f) => f.unitId)).toEqual(["u2", "u1"]);
  });
});

describe("la ventana", () => {
  it("reporta su duración en minutos", () => {
    const c = construirCenso(entrada());
    expect(c.ventana.minutos).toBe(360);
  });

  it("una ventana que cruza medianoche mide bien", () => {
    const noche = {
      desde: new Date("2026-07-27T22:00:00.000Z"),
      hasta: new Date("2026-07-28T06:00:00.000Z"),
    };
    const c = construirCenso(entrada({ ventana: noche, puntos: [] }));
    expect(c.ventana.minutos).toBe(480);
  });
});

describe("la ventana en su zona", () => {
  const JRZ = "America/Ciudad_Juarez";

  it("las 05:00 de Juárez en julio son las 11:00 UTC", () => {
    // Juárez en verano va a UTC-6.
    expect(instanteZonificado("2026-07-27", 5 * 60, JRZ).toISOString()).toBe(
      "2026-07-27T11:00:00.000Z",
    );
  });

  it("una ventana normal no cruza medianoche", () => {
    const v = ventanaLocal("2026-07-27", 5 * 60, 11 * 60, JRZ);
    expect(v.cruzaMedianoche).toBe(false);
    expect(v.desde.toISOString()).toBe("2026-07-27T11:00:00.000Z");
    expect(v.hasta.toISOString()).toBe("2026-07-27T17:00:00.000Z");
  });

  it("22:00 a 06:00 termina al día siguiente, no da una ventana negativa", () => {
    const v = ventanaLocal("2026-07-27", 22 * 60, 6 * 60, JRZ);
    expect(v.cruzaMedianoche).toBe(true);
    expect(v.hasta.getTime() - v.desde.getTime()).toBe(8 * 3_600_000);
    expect(v.desde.toISOString()).toBe("2026-07-28T04:00:00.000Z");
    expect(v.hasta.toISOString()).toBe("2026-07-28T12:00:00.000Z");
  });

  it("horas iguales se leen como día completo, no como ventana de cero", () => {
    const v = ventanaLocal("2026-07-27", 0, 0, JRZ);
    expect(v.hasta.getTime() - v.desde.getTime()).toBe(24 * 3_600_000);
  });

  it("el cambio de horario no desfasa la ventana", () => {
    // Ciudad Juárez es municipio fronterizo: sigue el calendario de Estados
    // Unidos, no el mexicano. En 2026 adelanta el reloj el 8 de marzo y lo
    // atrasa el 1 de noviembre. Antes va a UTC-7; en medio, a UTC-6.
    expect(instanteZonificado("2026-03-07", 12 * 60, JRZ).toISOString()).toBe(
      "2026-03-07T19:00:00.000Z",
    );
    expect(instanteZonificado("2026-03-09", 12 * 60, JRZ).toISOString()).toBe(
      "2026-03-09T18:00:00.000Z",
    );
    expect(instanteZonificado("2026-11-02", 12 * 60, JRZ).toISOString()).toBe(
      "2026-11-02T19:00:00.000Z",
    );
  });

  it("no depende de la zona en que corra el proceso", () => {
    // Todo pasa por Intl con la zona explícita: el reloj del servidor no entra.
    const a = instanteZonificado("2026-07-27", 5 * 60, JRZ);
    const b = instanteZonificado("2026-07-27", 5 * 60, "America/Ciudad_Juarez");
    expect(a.getTime()).toBe(b.getTime());
  });
});

describe("flota vacía", () => {
  it("sin unidades activas no inventa nada", () => {
    const c = construirCenso(entrada({ unidades: [], puntos: [] }));
    expect(c.activas).toBe(0);
    expect(c.filas).toEqual([]);
    expect(c.reportaron).toBe(0);
  });
});
