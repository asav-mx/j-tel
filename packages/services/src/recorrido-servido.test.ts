import { describe, expect, it } from "vitest";
import { TOLERANCIA_POR_GRADO, ventanaDelDia, type GradoDeTrazo, type PuntoTraza } from "@jtel/domain";
import {
  cargarRecorridoDeUnidad,
  modalidadDesdeEspeciales,
  trazoParaDibujar,
  ventanaCerrada,
} from "./recorrido-servido.js";
import { cortarPorModalidad, lugaresDelPunto, recorridoPorVentana, type Lugar } from "./recorrido-del-dia.js";
import { paradas } from "@jtel/domain";

/* Un plano en metros alrededor de Juárez. */
const ORIGEN = { lat: 31.72, lng: -106.45 };
const M_POR_GRADO_LNG = 111_320 * Math.cos((ORIGEN.lat * Math.PI) / 180);
const m = (este: number, norte: number) => ({
  lat: ORIGEN.lat + norte / 111_320,
  lng: ORIGEN.lng + este / M_POR_GRADO_LNG,
});
const hora = (hhmm: string) => new Date(`2026-09-14T${hhmm}:00-06:00`);
const minuto = (desde: string, n: number) => new Date(hora(desde).getTime() + n * 60_000);
const hhmm = (d: Date) =>
  d.toLocaleTimeString("es-MX", { timeZone: "America/Ciudad_Juarez", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const PLANTA: Lugar = {
  id: "p47",
  nombre: "Planta 47",
  rol: "destino",
  poligono: [m(2000, 1950), m(2200, 1950), m(2200, 2450), m(2000, 2450)],
};

/*
 * Un día con todo lo que la simplificación podría romper, un punto por minuto:
 *   06:00–06:30  3 km al oriente
 *   06:31–06:39  regresa 900 m por la misma calle
 *   06:40–06:49  parada larga (velocidad 0, temblor de 1 m)
 *   06:50–07:08  2 km al norte, hacia Planta 47
 *   07:09–07:20  adentro de Planta 47 — especial 07:00–07:30, así que se corta
 *   07:21–07:40  sale y sigue al norte
 *   07:40–08:10  hueco de 30 min
 *   08:10–08:40  3 km al oriente
 */
function diaCompleto(): PuntoTraza[] {
  const puntos: PuntoTraza[] = [];
  const pon = (at: Date, este: number, norte: number, speed: number) => puntos.push({ ...m(este, norte), at, speed });
  for (let i = 0; i <= 30; i += 1) pon(minuto("06:00", i), i * 100, 0, 40);
  for (let i = 1; i <= 9; i += 1) pon(minuto("06:30", i), 3000 - i * 100, 0, 40);
  for (let i = 0; i <= 9; i += 1) pon(minuto("06:40", i), 2100 + Math.sin(i), Math.cos(i), 0);
  for (let i = 0; i <= 18; i += 1) pon(minuto("06:50", i), 2100, 100 + i * 100, 40);
  for (let i = 0; i <= 11; i += 1) pon(minuto("07:09", i), 2100, 2000 + i * 40, 3);
  for (let i = 0; i <= 19; i += 1) pon(minuto("07:21", i), 2100, 2500 + i * 100, 40);
  for (let i = 0; i <= 30; i += 1) pon(minuto("08:10", i), 2100 + i * 100, 4400, 40);
  return puntos;
}

const VENTANA = ventanaDelDia("2026-09-14");
const ESPECIAL = [{ ventanaDesde: hora("07:00"), ventanaHasta: hora("07:30") }];

function dibujar(grado: GradoDeTrazo) {
  const recorrido = recorridoPorVentana({ ventana: VENTANA, puntos: diaCompleto(), lugares: [PLANTA] });
  const cortada = cortarPorModalidad(recorrido, modalidadDesdeEspeciales(ESPECIAL));
  const lasParadas = paradas(recorrido.tramos.flat(), { minMinutos: 5, umbralHuecoMinutos: 15 });
  return {
    recorrido,
    cortada,
    lasParadas,
    dibujo: trazoParaDibujar({ recorrido, cortada, paradas: lasParadas, toleranciaMetros: TOLERANCIA_POR_GRADO[grado] }),
  };
}

const GRADOS: GradoDeTrazo[] = [0, 1, 2, 3];

describe("trazoParaDibujar · los intocables sobreviven cualquier grado (regla 9)", () => {
  it("el escenario tiene lo que dice tener", () => {
    const { recorrido, cortada, lasParadas } = dibujar(0);
    expect(recorrido.huecos.map((h) => [hhmm(h.desde), hhmm(h.hasta)])).toEqual([["07:40", "08:10"]]);
    expect(lasParadas.map((p) => [hhmm(p.desde), hhmm(p.hasta)])).toEqual([["06:40", "06:49"]]);
    expect(cortada.ocultos.map((o) => [hhmm(o.desde), hhmm(o.hasta)])).toEqual([["07:09", "07:21"]]);
  });

  for (const grado of GRADOS) {
    it(`grado ${grado} (${TOLERANCIA_POR_GRADO[grado]} m): puntas de tramo, extremos del hueco, llegada, salida y parada`, () => {
      const { dibujo } = dibujar(grado);
      const horas = new Set(dibujo.tramos.flat().map((q) => hhmm(q.at)));
      for (const h of ["06:00", "06:40", "06:49", "07:09", "07:21", "07:40", "08:10", "08:40"]) {
        expect(horas, `falta ${h}`).toContain(h);
      }
    });

    it(`grado ${grado}: el regreso por la misma calle sigue dibujado`, () => {
      const { dibujo } = dibujar(grado);
      const vuelta = dibujo.tramos.flat().find((q) => hhmm(q.at) === "06:30");
      expect(vuelta).toBeDefined();
    });

    it(`grado ${grado}: nada se dibuja adentro de la planta después de la llegada`, () => {
      const { dibujo } = dibujar(grado);
      const adentro = dibujo.tramos.flat().filter((q) => lugaresDelPunto(q, [PLANTA]).length > 0);
      expect(adentro.map((q) => hhmm(q.at))).toEqual(["07:09"]);
    });
  }

  it("la prueba muerde: sin intocables, el grado 3 sí se come la parada y la llegada", () => {
    const { dibujo, cortada } = dibujar(3);
    expect(dibujo.simplificado).toBe(true);
    const sinIntocables = trazoParaDibujar({
      recorrido: { huecos: [], visitas: [] },
      cortada,
      paradas: [],
      toleranciaMetros: TOLERANCIA_POR_GRADO[3],
    });
    const horas = new Set(sinIntocables.tramos.flat().map((q) => hhmm(q.at)));
    expect(horas.has("06:40") && horas.has("06:49")).toBe(false);
  });

  it("grado 0 es el detalle: no quita nada y no dice que simplificó", () => {
    const { dibujo, cortada } = dibujar(0);
    expect(dibujo.simplificado).toBe(false);
    expect(dibujo.tramos).toEqual(cortada.tramos);
    expect(dibujo.puntosDibujados).toBe(dibujo.puntosAntes);
  });

  it("el grado 3 sí simplifica, y lo declara", () => {
    const { dibujo } = dibujar(3);
    expect(dibujo.simplificado).toBe(true);
    expect(dibujo.puntosDibujados).toBeLessThan(dibujo.puntosAntes / 3);
  });
});

describe("modalidadDesdeEspeciales · Pieza 7", () => {
  const en = modalidadDesdeEspeciales(ESPECIAL);
  it("especial dentro de la ventana del servicio, bordes incluidos; fuera no hay servicio declarado", () => {
    expect(en(hora("07:00"))).toBe("especial");
    expect(en(hora("07:30"))).toBe("especial");
    expect(en(new Date(hora("07:30").getTime() + 1))).toBeNull();
    expect(en(hora("06:59"))).toBeNull();
  });
  it("sin servicios, nada corta", () => {
    expect(modalidadDesdeEspeciales([])(hora("07:15"))).toBeNull();
  });
});

describe("ventanaCerrada · regla 10, con los puntos que llegan tarde", () => {
  // 16 sep 00:30 en Juárez.
  const AHORA = new Date("2026-09-16T06:30:00Z");
  const AYER = ventanaDelDia("2026-09-15");
  const base = { ahora: AHORA, timeZone: "America/Ciudad_Juarez" };

  it("una ventana que toca hoy nunca está cerrada, aunque el archivador vaya al día", () => {
    const hoy = ventanaDelDia("2026-09-16");
    expect(ventanaCerrada({ ...base, ventana: hoy, imeis: ["111"], marcas: new Map([["111", AHORA]]) })).toBe(false);
    const hastaMedianoche = { desde: AYER.desde, hasta: hoy.desde };
    expect(ventanaCerrada({ ...base, ventana: hastaMedianoche, imeis: [], marcas: new Map() })).toBe(false);
  });

  it("ayer, con el archivador ya pasado del fin de la ventana: cerrada", () => {
    expect(ventanaCerrada({ ...base, ventana: AYER, imeis: ["111"], marcas: new Map([["111", AHORA]]) })).toBe(true);
  });

  it("ayer, pero el archivador de un dispositivo aún no llega al fin: abierta — le pueden llegar puntos", () => {
    const atrasada = new Date(AYER.hasta.getTime() - 60_000);
    const marcas = new Map([["111", AHORA], ["222", atrasada]]);
    expect(ventanaCerrada({ ...base, ventana: AYER, imeis: ["111", "222"], marcas })).toBe(false);
  });

  it("un dispositivo sin marca por aparato: ante la duda, abierta", () => {
    expect(ventanaCerrada({ ...base, ventana: AYER, imeis: ["333"], marcas: new Map() })).toBe(false);
  });

  it("ayer y sin dispositivo en la ventana: no hay de dónde llegar puntos, cerrada", () => {
    expect(ventanaCerrada({ ...base, ventana: AYER, imeis: [], marcas: new Map() })).toBe(true);
  });

  it("«hoy» es el día civil de la zona, no el de UTC", () => {
    // A las 00:30 de Juárez ya es 16 en los dos relojes; a las 23:30 del 15 en Juárez ya es 16 en UTC.
    const noche = new Date("2026-09-16T05:30:00Z"); // 15 sep 23:30 en Juárez
    expect(ventanaCerrada({ ahora: noche, timeZone: "America/Ciudad_Juarez", ventana: AYER, imeis: [], marcas: new Map() })).toBe(false);
  });
});

describe("cargarRecorridoDeUnidad · lo que se sirve", () => {
  function repos(opciones: { unidades?: Array<{ id: string; label: string }> } = {}) {
    const lecturas: string[] = [];
    const r = {
      fleet: {
        getUnitsForCarrier: async () => opciones.unidades ?? [{ id: "u1", label: "10254" }],
        asignacionesDeUnidad: async () => [
          { deviceId: "d0", imei: "999", etiqueta: "TK-VIEJO", desde: new Date("2026-08-01T00:00:00Z"), hasta: new Date("2026-09-01T00:00:00Z") },
          { deviceId: "d1", imei: "111", etiqueta: "TK-FTC927-001", desde: new Date("2026-09-01T00:00:00Z"), hasta: null },
        ],
      },
      telemetry: {
        getForUnitWindow: async (_c: string, _u: string, desde: Date, hasta: Date) => {
          lecturas.push(`${desde.toISOString()}→${hasta.toISOString()}`);
          return diaCompleto().map((q) => ({
            unitId: "u1",
            imei: "111",
            latitude: q.lat,
            longitude: q.lng,
            speed: q.speed,
            recordedAt: q.at,
          }));
        },
        getArchiveMarks: async () => new Map([["111", new Date("2026-09-16T00:00:00Z")]]),
      },
      geofences: {
        lugaresDeCarrier: async () => [{ id: "p47", name: "Planta 47", role: "destino", polygon: PLANTA.poligono }],
      },
      occurrences: { especialesDeUnidadEnVentana: async () => ESPECIAL },
    };
    return { repos: r as never, lecturas };
  }
  const AHORA = new Date("2026-09-16T18:00:00Z");
  const pedir = (grado: GradoDeTrazo, r = repos()) =>
    cargarRecorridoDeUnidad(r.repos, { carrierAccountId: "c1", unitId: "u1", ventana: VENTANA, grado, ahora: AHORA });

  it("la unidad de otro carrier no existe desde aquí, y no se lee su telemetría", async () => {
    const r = repos({ unidades: [{ id: "otra", label: "X" }] });
    expect(await pedir(0, r)).toBeNull();
    expect(r.lecturas).toEqual([]);
  });

  it("lee exactamente la ventana pedida", async () => {
    const r = repos();
    await pedir(0, r);
    expect(r.lecturas).toEqual([`${VENTANA.desde.toISOString()}→${VENTANA.hasta.toISOString()}`]);
  });

  it("las cifras son de la evidencia completa: no cambian con el grado", async () => {
    const detalle = (await pedir(0))!;
    const burdo = (await pedir(3))!;
    expect(burdo.cifras).toEqual(detalle.cifras);
    expect(burdo.puntosMedidos).toBe(detalle.puntosMedidos);
    expect(burdo.puntosDibujados).toBeLessThan(detalle.puntosDibujados);
    expect([detalle.simplificado, burdo.simplificado]).toEqual([false, true]);
    expect([detalle.toleranciaMetros, burdo.toleranciaMetros]).toEqual([0, 40]);
  });

  it("aplica el corte del especial y lo dice con sus horas; los lugares van sin polígono", async () => {
    const s = (await pedir(2))!;
    expect(s.ocultos).toHaveLength(1);
    expect(s.ocultos[0]).toMatchObject({ lugar: { id: "p47", nombre: "Planta 47", rol: "destino" }, desde: hora("07:09"), hasta: hora("07:21") });
    expect(s.ocultos[0]!.lugar).not.toHaveProperty("poligono");
    expect(s.visitas[0]!.lugar).not.toHaveProperty("poligono");
  });

  it("los dispositivos son los que la unidad traía en la ventana, no todos los que ha tenido", async () => {
    const s = (await pedir(0))!;
    expect(s.dispositivos.map((d) => d.etiqueta)).toEqual(["TK-FTC927-001"]);
  });

  it("ventana de hace dos días con el archivador al corriente: cerrada; declara umbral de parada", async () => {
    const s = (await pedir(0))!;
    expect(s.cerrada).toBe(true);
    expect(s.paradaMinutos).toBe(5);
    expect(s.paradas).toHaveLength(1);
    expect(s.unidad).toEqual({ id: "u1", etiqueta: "10254" });
  });
});
