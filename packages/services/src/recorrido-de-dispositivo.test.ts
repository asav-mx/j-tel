import { describe, expect, it } from "vitest";
import { ventanaDelDia, type PuntoTraza } from "@jtel/domain";
import {
  cargarRecorridoDeDispositivo,
  etapasDeLaVentana,
  type AsignacionDelDispositivo,
} from "./recorrido-de-dispositivo.js";

/* Un plano en metros alrededor de Juárez. */
const ORIGEN = { lat: 31.72, lng: -106.45 };
const M_POR_GRADO_LNG = 111_320 * Math.cos((ORIGEN.lat * Math.PI) / 180);
const m = (este: number, norte: number) => ({ lat: ORIGEN.lat + norte / 111_320, lng: ORIGEN.lng + este / M_POR_GRADO_LNG });
const hora = (hhmm: string, dia = "16") => new Date(`2026-09-${dia}T${hhmm}:00-06:00`);
const minuto = (desde: string, n: number) => new Date(hora(desde).getTime() + n * 60_000);
const hhmm = (d: Date) =>
  d.toLocaleTimeString("es-MX", { timeZone: "America/Ciudad_Juarez", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const VENTANA = ventanaDelDia("2026-09-16");

const PLANTA = [m(5000, -100), m(5400, -100), m(5400, 100), m(5000, 100)];

/** Un tramo de `n` minutos al oriente, un punto por minuto, desde `este` metros. */
function tramo(desde: string, n: number, este = 0): PuntoTraza[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ ...m(este + i * 100, 0), at: minuto(desde, i), speed: 36 }));
}

const EN_10254: AsignacionDelDispositivo = {
  unitId: "u54",
  etiqueta: "10254",
  desde: hora("09:00", "10"),
  hasta: hora("07:42"),
  asignadaPor: null,
  cerradaPor: "user_ana",
  motivoCierre: "Falla de alimentación, a taller",
};
const EN_10261: AsignacionDelDispositivo = {
  unitId: "u61",
  etiqueta: "10261",
  desde: hora("11:10"),
  hasta: null,
  asignadaPor: "user_ana",
  cerradaPor: null,
  motivoCierre: null,
};

/*
 * El día del prototipo:
 *   05:20–06:20  en la 10254
 *   07:42        la sueltan (a taller)
 *   08:05–08:35  reporta sin unidad: bodega
 *   11:10        la montan en la 10261
 *   11:24–12:24  en la 10261, llega a Planta 47 (destino) a media hora
 */
const DIA: PuntoTraza[] = [...tramo("05:20", 60), ...tramo("08:05", 30), ...tramo("11:24", 60)];

const resumen = (etapas: ReturnType<typeof etapasDeLaVentana>) =>
  etapas.map((e) => [e.tipoFinal, hhmm(e.desde), hhmm(e.hasta), e.puntos.length]);

describe("etapasDeLaVentana · la ventana partida por las asignaciones de esta cuenta", () => {
  it("dos unidades con bodega de por medio: tres etapas que cubren la ventana sin encimarse", () => {
    const etapas = etapasDeLaVentana(VENTANA, [EN_10254, EN_10261], DIA);
    expect(resumen(etapas)).toEqual([
      ["unidad", "00:00", "07:42", 61],
      ["bodega", "07:42", "11:10", 31],
      ["unidad", "11:10", "23:59", 61],
    ]);
    expect(etapas.reduce((n, e) => n + e.puntos.length, 0)).toBe(DIA.length);
  });

  it("un punto en el instante exacto del cambio es de la etapa que empieza, y de ninguna otra", () => {
    const justo = [{ ...m(0, 0), at: hora("07:42"), speed: 0 }];
    const etapas = etapasDeLaVentana(VENTANA, [EN_10254, EN_10261], justo);
    expect(etapas.map((e) => e.puntos.length)).toEqual([0, 1, 0]);
  });

  it("sin unidad y sin un solo punto no se llama bodega: puede haber estado en otra cuenta", () => {
    const sinBodega = DIA.filter((p) => hhmm(p.at) < "07:00" || hhmm(p.at) >= "11:00");
    expect(resumen(etapasDeLaVentana(VENTANA, [EN_10254, EN_10261], sinBodega)).map((e) => e[0])).toEqual([
      "unidad",
      "sin_unidad_sin_puntos",
      "unidad",
    ]);
  });

  it("un dispositivo que nunca tuvo unidad ni puntos en esta cuenta: una sola etapa, la ventana entera", () => {
    expect(resumen(etapasDeLaVentana(VENTANA, [], []))).toEqual([["sin_unidad_sin_puntos", "00:00", "23:59", 0]]);
  });

  it("una unidad asignada toda la ventana sin puntos sigue siendo su unidad: montado no es bodega", () => {
    expect(resumen(etapasDeLaVentana(VENTANA, [{ ...EN_10254, hasta: null }], []))).toEqual([["unidad", "00:00", "23:59", 0]]);
  });

  it("de una unidad a otra sin pasar por bodega: dos etapas pegadas", () => {
    const moverlo = [{ ...EN_10254, hasta: hora("11:10") }, EN_10261];
    expect(resumen(etapasDeLaVentana(VENTANA, moverlo, DIA)).map((e) => e.slice(0, 3))).toEqual([
      ["unidad", "00:00", "11:10"],
      ["unidad", "11:10", "23:59"],
    ]);
  });
});

describe("cargarRecorridoDeDispositivo · lo que se sirve", () => {
  function repos(opciones: { deOtraCuenta?: boolean; puntos?: PuntoTraza[] } = {}) {
    const lecturas: string[] = [];
    const r = {
      expedientes: {
        dispositivoDeCuenta: async (cuenta: string, id: string) =>
          opciones.deOtraCuenta ? null : { id, carrierAccountId: cuenta, imei: "350000000000003", label: "TK-FTC927-003" },
        asignacionesDeDispositivo: async (cuenta: string) => {
          lecturas.push(`asignaciones:${cuenta}`);
          return [EN_10254, EN_10261];
        },
      },
      telemetry: {
        getForImeisDeCuenta: async (cuenta: string, imeis: string[]) => {
          lecturas.push(`puntos:${cuenta}:${imeis.join(",")}`);
          return (opciones.puntos ?? DIA).map((q) => ({
            imei: "350000000000003",
            latitude: q.lat,
            longitude: q.lng,
            speed: q.speed,
            recordedAt: q.at,
          }));
        },
        getArchiveMarks: async () => new Map([["350000000000003", new Date("2026-09-18T00:00:00Z")]]),
      },
      geofences: {
        lugaresDeCarrier: async () => [{ id: "p47", name: "Planta 47", role: "destino", polygon: PLANTA }],
      },
      occurrences: {
        // Sólo la 10261 da un especial, que cubre el día entero.
        especialesDeUnidadEnVentana: async (_c: string, unitId: string, desde: Date, hasta: Date) => {
          lecturas.push(`especiales:${unitId}:${hhmm(desde)}-${hhmm(hasta)}`);
          return unitId === "u61" ? [{ ventanaDesde: hora("00:00"), ventanaHasta: hora("23:59") }] : [];
        },
      },
    };
    return { repos: r as never, lecturas };
  }
  const AHORA = new Date("2026-09-18T18:00:00Z");
  const pedir = (r = repos()) =>
    cargarRecorridoDeDispositivo(r.repos, { carrierAccountId: "c1", deviceId: "d3", ventana: VENTANA, grado: 0, ahora: AHORA });

  it("el dispositivo de otra cuenta no existe desde aquí, y no se lee nada más", async () => {
    const r = repos({ deOtraCuenta: true });
    expect(await pedir(r)).toBeNull();
    expect(r.lecturas).toEqual([]);
  });

  it("lee puntos y asignaciones con la cuenta: el muro va en la consulta", async () => {
    const r = repos();
    await pedir(r);
    expect(r.lecturas).toContain("puntos:c1:350000000000003");
    expect(r.lecturas).toContain("asignaciones:c1");
  });

  it("cada etapa de unidad se corta con los especiales de SU unidad, leídos en SUS horas; la bodega no pregunta", async () => {
    const r = repos();
    const s = (await pedir(r))!;
    expect(r.lecturas.filter((l) => l.startsWith("especiales")).sort()).toEqual(["especiales:u54:00:00-07:42", "especiales:u61:11:10-23:59"]);
    const [a, b, c] = s.etapas;
    expect([a!.tipo, b!.tipo, c!.tipo]).toEqual(["unidad", "bodega", "unidad"]);
    // La 10254 y la bodega pasan por Planta 47 y no se cortan; la 10261 sí.
    expect(a!.tipo === "unidad" && a!.ocultos).toEqual([]);
    expect(b!.tipo === "bodega" && b!.ocultos).toEqual([]);
    expect(c!.tipo === "unidad" && c!.ocultos.map((o) => o.lugar.nombre)).toEqual(["Planta 47"]);
    expect(c!.tipo === "unidad" && c!.especiales).toBe(1);
  });

  it("las cifras del dispositivo son la suma de sus etapas", async () => {
    const s = (await pedir())!;
    const conCifras = s.etapas.flatMap((e) => (e.tipo === "sin_unidad_sin_puntos" ? [] : [e.cifras]));
    expect(s.cifras.kmMedidos).toBeCloseTo(conCifras.reduce((n, c) => n + c.kmMedidos, 0), 6);
    expect(s.cifras.minutosConSenal).toBe(conCifras.reduce((n, c) => n + c.minutosConSenal, 0));
    expect(s.cifras.puntos).toBe(DIA.length);
    expect(s.unidades).toBe(2);
  });

  it("el tiempo entre etapas es un cambio, no un hueco", async () => {
    const s = (await pedir())!;
    expect(s.cifras.huecos).toBe(0);
  });

  it("quién la soltó y por qué van en la etapa que se cerró dentro de la ventana; la vigente no inventa cierre", async () => {
    const s = (await pedir())!;
    const [a, , c] = s.etapas;
    expect(a).toMatchObject({ cerradaPor: "user_ana", motivoCierre: "Falla de alimentación, a taller" });
    expect(c).toMatchObject({ asignadaPor: "user_ana", cerradaPor: null, motivoCierre: null });
  });

  it("un cierre que cae después de la ventana no se cuenta en ella", async () => {
    const ayer = ventanaDelDia("2026-09-15");
    const s = (await cargarRecorridoDeDispositivo(repos().repos, {
      carrierAccountId: "c1",
      deviceId: "d3",
      ventana: ayer,
      grado: 0,
      ahora: AHORA,
    }))!;
    expect(s.etapas[0]).toMatchObject({ tipo: "unidad", cerradaPor: null, motivoCierre: null });
  });

  it("ventana pasada con el archivador al corriente del aparato: cerrada", async () => {
    expect((await pedir())!.cerrada).toBe(true);
  });
});
