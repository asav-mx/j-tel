import { describe, expect, it } from "vitest";
import { cargarFlotaCompas, cargarFlotaEnVivo, enDestinoAhora } from "./flota-compas.js";
import type { Lugar } from "./recorrido-del-dia.js";

const AHORA = new Date("2026-09-15T18:00:00Z");
const MIN = 60_000;

/** Repos falsos: sólo lo que el cargador toca. */
function repos(opciones: { inactiva?: boolean } = {}) {
  const pedidosDeArchivo: string[][] = [];
  const r = {
    fleet: {
      getUnitsForCarrier: async () => [
        { id: "u1", label: "10254", active: true },
        { id: "u2", label: "10301", active: !opciones.inactiva },
      ],
      getDevicesForCarrier: async () => [
        { id: "d1", imei: "111", label: "TK-FTC927-001", retiredAt: null, retiredReason: null },
        { id: "d2", imei: "222", label: null, retiredAt: null, retiredReason: null },
      ],
      getActiveAssignmentsForCarrier: async () => [
        { unitId: "u1", deviceId: "d1", validFrom: new Date("2026-09-01T00:00:00Z"), validTo: null },
      ],
    },
    livePositions: {
      listForCarrier: async () => [
        { imei: "111", recordedAt: new Date(AHORA.getTime() - 14_000), speed: 42.7, heading: 90 },
      ],
    },
    occurrences: { especialesVigentesDeCarrier: async () => [] },
    geofences: { lugaresDeCarrier: async () => [] },
    telemetry: {
      ultimoPuntoPorImei: async (imeis: string[]) => {
        pedidosDeArchivo.push(imeis);
        return new Map([["222", new Date(AHORA.getTime() - 30 * MIN)]]);
      },
    },
  };
  return { repos: r as never, pedidosDeArchivo };
}

describe("cargarFlotaCompas", () => {
  it("junta las filas y clasifica: u1 en línea, u2 sin dispositivo, d2 en bodega con su señal archivada", async () => {
    const f = repos();
    const flota = await cargarFlotaCompas(f.repos, "c1", AHORA);
    expect(flota.unidades.map((u) => [u.unidad.label, u.grupo])).toEqual([
      ["10254", "en_linea"],
      ["10301", "sin_dispositivo"],
    ]);
    expect(flota.dispositivos.find((d) => d.dispositivo.id === "d2")?.estado).toEqual({
      grupo: "en_bodega",
      ultimaSenalAt: new Date(AHORA.getTime() - 30 * MIN),
    });
    // El archivo se consulta por los IMEI de la cuenta, todos juntos.
    expect(f.pedidosDeArchivo).toEqual([["111", "222"]]);
  });

  it("una unidad inactiva no entra a la flota, y se cuenta para que no desaparezca en silencio", async () => {
    const flota = await cargarFlotaCompas(repos({ inactiva: true }).repos, "c1", AHORA);
    expect(flota.unidades.map((u) => u.unidad.id)).toEqual(["u1"]);
    expect(flota.unidadesInactivas).toBe(1);
  });
});

/*
 * EN DESTINO (C2). Planta 47 como un cuadro en Juárez; la unidad 6284 da un
 * turno especial con ventana 05:30–07:30 y llega 06:08.
 */
const PLANTA: Lugar = {
  id: "p47",
  nombre: "Planta 47",
  rol: "destino",
  poligono: [
    { lat: 31.75, lng: -106.4 },
    { lat: 31.75, lng: -106.396 },
    { lat: 31.754, lng: -106.396 },
    { lat: 31.754, lng: -106.4 },
  ],
};
const BASE: Lugar = { ...PLANTA, id: "base", nombre: "Base", rol: "base" };
const ADENTRO = { lat: 31.752, lng: -106.398 };
const AFUERA = { lat: 31.72, lng: -106.45 };
const T = (hhmm: string) => new Date(`2026-09-15T${hhmm}:00-06:00`);
const pt = (hhmm: string, donde: { lat: number; lng: number }) => ({ ...donde, at: T(hhmm), speed: 20 });

describe("enDestinoAhora", () => {
  it("último punto adentro: en destino desde el primer punto adentro", () => {
    const d = enDestinoAhora([pt("06:00", AFUERA), pt("06:08", ADENTRO), pt("06:20", ADENTRO)].reverse(), [PLANTA]);
    expect(d).toEqual({
      lugarId: "p47",
      lugarNombre: "Planta 47",
      llegadaAt: T("06:08"),
      entradaObservada: true,
      punto: ADENTRO,
    });
  });

  it("ya salió: no está en destino", () => {
    expect(enDestinoAhora([pt("06:08", ADENTRO), pt("06:12", AFUERA)], [PLANTA])).toBeNull();
  });

  it("una base no es destino", () => {
    expect(enDestinoAhora([pt("06:00", AFUERA), pt("06:08", ADENTRO)], [BASE])).toBeNull();
  });

  it("reapareció adentro después de un hueco: en destino, sin entrada observada", () => {
    const d = enDestinoAhora([pt("05:40", AFUERA), pt("06:30", ADENTRO)], [PLANTA]);
    expect(d).toMatchObject({ llegadaAt: T("06:30"), entradaObservada: false });
  });
});

function reposDeDestino(opciones: { especial: boolean }) {
  const pedidosDePuntos: Array<{ imeis: string[]; desde: Date }> = [];
  const ahora = T("06:41");
  const r = {
    fleet: {
      getUnitsForCarrier: async () => [
        { id: "u6284", label: "6284", active: true },
        { id: "u9385", label: "9385", active: true },
      ],
      getDevicesForCarrier: async () => [
        { id: "d1", imei: "111", label: null, retiredAt: null, retiredReason: null },
        { id: "d2", imei: "222", label: null, retiredAt: null, retiredReason: null },
      ],
      getActiveAssignmentsForCarrier: async () => [
        { unitId: "u6284", deviceId: "d1", validFrom: T("00:00"), validTo: null },
        { unitId: "u9385", deviceId: "d2", validFrom: T("00:00"), validTo: null },
      ],
    },
    livePositions: {
      // Las dos están adentro de Planta 47 ahora mismo.
      listForCarrier: async () => [
        { imei: "111", recordedAt: T("06:40"), speed: 0, heading: null, latitude: ADENTRO.lat, longitude: ADENTRO.lng },
        { imei: "222", recordedAt: T("06:40"), speed: 18, heading: 90, latitude: ADENTRO.lat, longitude: ADENTRO.lng },
      ],
    },
    occurrences: {
      // Sólo la 6284 da un servicio especial; la 9385 va en circuito o sin servicio.
      especialesVigentesDeCarrier: async () =>
        opciones.especial
          ? [{ unitId: "u6284", occurrenceId: "o1", expectedGeofenceId: "p47", ventanaDesde: T("05:30"), ventanaHasta: T("07:30") }]
          : [],
    },
    geofences: {
      lugaresDeCarrier: async () => [{ id: "p47", name: "Planta 47", role: "destino", polygon: PLANTA.poligono }],
    },
    telemetry: {
      ultimoPuntoPorImei: async () => new Map<string, Date>(),
      getForImeis: async (imeis: string[], desde: Date) => {
        pedidosDePuntos.push({ imeis, desde });
        return [
          { imei: "111", recordedAt: T("06:00"), speed: 30, latitude: AFUERA.lat, longitude: AFUERA.lng },
          { imei: "111", recordedAt: T("06:08"), speed: 12, latitude: ADENTRO.lat, longitude: ADENTRO.lng },
          // El archivo llega cada 10 min: el último archivado va unos minutos detrás de la viva.
          { imei: "111", recordedAt: T("06:20"), speed: 0, latitude: ADENTRO.lat, longitude: ADENTRO.lng },
          { imei: "111", recordedAt: T("06:31"), speed: 0, latitude: ADENTRO.lat, longitude: ADENTRO.lng },
        ];
      },
    },
  };
  return { repos: r as never, pedidosDePuntos, ahora };
}

describe("cargarFlotaEnVivo · EN DESTINO sólo con servicio especial (Marco 7.7)", () => {
  it("la 6284 (especial) está EN DESTINO desde 06:08; la 9385, en la misma planta, sigue EN LÍNEA", async () => {
    const f = reposDeDestino({ especial: true });
    const flota = await cargarFlotaEnVivo(f.repos, "c1", f.ahora);
    const de = (label: string) => flota.unidades.find((u) => u.unidad.label === label)!;
    expect(de("6284").estado).toMatchObject({
      tipo: "en_destino",
      destino: { lugarNombre: "Planta 47", llegadaAt: T("06:08"), entradaObservada: true },
    });
    expect(de("9385").grupo).toBe("en_linea");
    // Los puntos se piden sólo de la unidad con servicio especial, desde su ventana.
    expect(f.pedidosDePuntos).toEqual([{ imeis: ["111"], desde: T("05:30") }]);
    // En el mapa, la de destino va en su punto de llegada.
    expect(flota.posicionPorUnidad.get("u6284")).toEqual(ADENTRO);
    expect(flota.lugares.map((l) => l.nombre)).toEqual(["Planta 47"]);
  });

  it("sin servicio especial vigente no hay EN DESTINO ni se piden puntos", async () => {
    const f = reposDeDestino({ especial: false });
    const flota = await cargarFlotaEnVivo(f.repos, "c1", f.ahora);
    expect(flota.unidades.every((u) => u.grupo === "en_linea")).toBe(true);
    expect(f.pedidosDePuntos).toEqual([]);
  });
});
