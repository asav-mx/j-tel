import { describe, expect, it } from "vitest";
import {
  acotar,
  atajosDeTiempo,
  diaQueContiene,
  duracion,
  etiquetaDelPeriodo,
  incluyeAhora,
  instanteDelPanel,
  mover,
  panelDe,
  pausasEntre,
  pedazosDe,
  periodoDeLaDireccion,
  peticionDelRecorrido,
  posicionEn,
  recorridoHasta,
  rumbo,
  rutaDelRecorrido,
  sello,
  siguienteVelocidad,
  vacioDe,
  velocidadAuto,
  type Pedazo,
  type RecorridoJson,
} from "./recorrido";

/** Instantes en Juárez (UTC-6 en septiembre). */
const j = (s: string) => Date.parse(`${s}-06:00`);
const LEIDA = j("2026-09-15T18:04:47");

function pedazo(desde: string, minutos: number, cada = 1): Pedazo {
  const t0 = j(desde);
  const puntos = Array.from({ length: Math.floor(minutos / cada) + 1 }, (_, i) => ({
    lat: 31.7 + i * 0.001,
    lng: -106.4,
    t: t0 + i * cada * 60_000,
    v: 40,
  }));
  return { puntos, t0: puntos[0]!.t, t1: puntos[puntos.length - 1]!.t };
}

describe("la ventana", () => {
  it("atajos: Hoy, Ayer, Últimos 7 días y Este mes, en el día civil de Juárez", () => {
    const a = atajosDeTiempo(LEIDA);
    expect(a.map((x) => x.nombre)).toEqual(["Hoy", "Ayer", "Últimos 7 días", "Este mes"]);
    expect(a[0]!.periodo).toEqual({ desde: j("2026-09-15T00:00:00"), hasta: LEIDA });
    expect(a[1]!.periodo).toEqual({ desde: j("2026-09-14T00:00:00"), hasta: j("2026-09-15T00:00:00") - 1 });
    expect(a[2]!.periodo.desde).toBe(j("2026-09-09T00:00:00"));
    expect(a[3]!.periodo.desde).toBe(j("2026-09-01T00:00:00"));
  });

  it("a las 23:30 de Juárez «hoy» sigue siendo hoy aunque en UTC ya sea mañana", () => {
    const noche = j("2026-09-15T23:30:00");
    expect(atajosDeTiempo(noche)[0]!.periodo.desde).toBe(j("2026-09-15T00:00:00"));
  });

  it("las flechas mueven el tamaño de la ventana vigente: un día entero salta un día; un turno, un turno", () => {
    const ayer = atajosDeTiempo(LEIDA)[1]!.periodo;
    expect(mover(ayer, -1)).toEqual({ desde: j("2026-09-13T00:00:00"), hasta: j("2026-09-14T00:00:00") - 1 });
    const turno = { desde: j("2026-09-14T22:00:00"), hasta: j("2026-09-15T06:00:00") };
    expect(mover(turno, 1)).toEqual({ desde: j("2026-09-15T06:00:00") + 1, hasta: j("2026-09-15T14:00:00") + 1 });
  });

  it("quitar el acote regresa al día que contiene el inicio", () => {
    expect(diaQueContiene(j("2026-09-14T10:18:30"))).toEqual({ desde: j("2026-09-14T00:00:00"), hasta: j("2026-09-15T00:00:00") - 1 });
  });

  it("el panel habla en la zona: fecha y hora de ida y vuelta", () => {
    expect(instanteDelPanel("2026-09-14", "06:00")).toBe(j("2026-09-14T06:00:00"));
    expect(panelDe(j("2026-09-14T22:05:00"))).toEqual({ fecha: "2026-09-14", hora: "22:05" });
    expect(instanteDelPanel("", "06:00")).toBeNull();
  });

  it("la brocha acota a lo arrastrado; lo que no llega a 20 s no acota — busca", () => {
    const p = pedazo("2026-09-14T06:00:00", 60);
    expect(acotar(p, 0.5, 0.25)).toEqual({ desde: j("2026-09-14T06:15:00"), hasta: j("2026-09-14T06:30:00") });
    expect(acotar(p, 0.5, 0.504)).toBeNull();
  });

  it("incluye el ahora sólo si llega hasta la lectura", () => {
    expect(incluyeAhora({ desde: j("2026-09-15T00:00:00"), hasta: LEIDA }, LEIDA)).toBe(true);
    expect(incluyeAhora(atajosDeTiempo(LEIDA)[1]!.periodo, LEIDA)).toBe(false);
  });

  it("la dirección arrastra la cuenta, y una dirección sin ventana es «Hoy»", () => {
    const p = { desde: j("2026-09-14T06:00:00"), hasta: j("2026-09-14T14:00:00") };
    expect(rutaDelRecorrido("u1", p, "juarez-bus")).toBe(
      "/casa/transportista/expedientes/unidad/u1/recorrido?desde=2026-09-14T12%3A00%3A00.000Z&hasta=2026-09-14T20%3A00%3A00.000Z&account=juarez-bus",
    );
    expect(rutaDelRecorrido("u1", p, null)).not.toContain("account");
    expect(periodoDeLaDireccion(undefined, undefined, LEIDA)).toEqual(atajosDeTiempo(LEIDA)[0]!.periodo);
    expect(periodoDeLaDireccion("2026-09-14T12:00:00.000Z", "basura", LEIDA)).toEqual(atajosDeTiempo(LEIDA)[0]!.periodo);
  });

  it("la petición lleva el grado escrito, para que lo cerrado pueda guardarse", () => {
    const dia = new URL(`https://x${peticionDelRecorrido("jb", "u1", atajosDeTiempo(LEIDA)[1]!.periodo)}`);
    expect(dia.searchParams.get("grado")).toBe("0");
    const semana = new URL(`https://x${peticionDelRecorrido("jb", "u1", atajosDeTiempo(LEIDA)[2]!.periodo)}`);
    expect(semana.searchParams.get("grado")).toBe("1");
  });
});

describe("cómo se dice", () => {
  it("el periodo en su botón, como el prototipo v5 (con el calendario real: el 15 sep 2026 es martes)", () => {
    expect(etiquetaDelPeriodo(atajosDeTiempo(LEIDA)[0]!.periodo, LEIDA)).toBe("mar 15 sep · hasta ahora");
    expect(etiquetaDelPeriodo(atajosDeTiempo(LEIDA)[1]!.periodo, LEIDA)).toBe("lun 14 sep · todo el día");
    expect(etiquetaDelPeriodo({ desde: j("2026-09-14T06:00:00"), hasta: j("2026-09-14T14:00:00") }, LEIDA)).toBe(
      "lun 14 sep · 06:00–14:00",
    );
    expect(etiquetaDelPeriodo({ desde: j("2026-09-14T22:00:00"), hasta: j("2026-09-15T06:00:00") }, LEIDA)).toBe(
      "lun 14 sep 22:00 → mar 15 sep 06:00",
    );
    expect(etiquetaDelPeriodo(atajosDeTiempo(LEIDA)[2]!.periodo, LEIDA)).toBe("mié 9 sep 00:00 → mar 15 sep 18:04 (ahora)");
  });

  it("sello y duración, sin redondeos con «~»", () => {
    expect(sello(j("2026-09-13T10:18:30"))).toBe("dom 13 sep 10:18:30");
    expect(duracion(41 * 60_000 + 40_000)).toBe("41:40");
    expect(duracion(2 * 3_600_000 + 5 * 60_000)).toBe("2 h 05 min");
    expect(duracion(12_000)).toBe("12 s");
  });
});

describe("el playback", () => {
  it("velocidad automática: el tiempo medido en unos 90 s, mínimo ×1", () => {
    // 3 h medidas → 10 800 s / 90 = ×120
    expect(velocidadAuto([pedazo("2026-09-14T06:00:00", 90), pedazo("2026-09-14T09:00:00", 90)])).toBe(120);
    expect(velocidadAuto([pedazo("2026-09-14T06:00:00", 1)])).toBe(1);
    expect(velocidadAuto([])).toBe(1);
  });

  it("el botón de velocidad cicla auto → ×30 → ×60 → ×180 → ×600 → auto", () => {
    const vistas: Array<number | null> = [null];
    for (let i = 0; i < 5; i += 1) vistas.push(siguienteVelocidad(vistas.at(-1)!));
    expect(vistas).toEqual([null, 30, 60, 180, 600, null]);
  });

  it("el marcador se interpola dentro del tramo y nunca sale de él", () => {
    const p = pedazo("2026-09-14T06:00:00", 10);
    const medio = posicionEn(p, p.t0 + 30_000);
    expect(medio.lat).toBeCloseTo(31.7005, 6);
    expect(posicionEn(p, p.t1 + 3_600_000).lat).toBeCloseTo(p.puntos.at(-1)!.lat, 9);
    expect(posicionEn(p, p.t0 - 3_600_000).lat).toBeCloseTo(p.puntos[0]!.lat, 9);
  });

  it("la línea hecha crece con el tiempo, y termina en el último punto medido", () => {
    const p = pedazo("2026-09-14T06:00:00", 10);
    expect(recorridoHasta(p, p.t0)).toEqual([]);
    expect(recorridoHasta(p, p.t0 + 90_000)).toHaveLength(3);
    expect(recorridoHasta(p, p.t1)).toHaveLength(p.puntos.length);
  });

  it("rumbo: 0 al norte, 90 al este", () => {
    expect(rumbo({ lat: 31.7, lng: -106.4 }, { lat: 31.71, lng: -106.4 })).toBeCloseTo(0, 6);
    expect(rumbo({ lat: 31.7, lng: -106.4 }, { lat: 31.7, lng: -106.39 })).toBeCloseTo(90, 6);
  });
});

describe("las pausas entre pedazos", () => {
  const recorrido = (ocultos: RecorridoJson["ocultos"]): RecorridoJson =>
    ({
      tramos: [
        [
          { lat: 1, lng: 1, at: "2026-09-14T12:00:00.000Z", speed: 30 },
          { lat: 1, lng: 1, at: "2026-09-14T12:09:00.000Z", speed: 0 },
        ],
        [
          { lat: 1, lng: 1, at: "2026-09-14T12:21:00.000Z", speed: 0 },
          { lat: 1, lng: 1, at: "2026-09-14T12:30:00.000Z", speed: 30 },
        ],
      ],
      ocultos,
    }) as RecorridoJson;

  it("sin tramo oculto entre dos pedazos, la pausa es un hueco: nadie midió", () => {
    const r = recorrido([]);
    expect(pausasEntre(pedazosDe(r), r)).toEqual([
      { tipo: "hueco", desde: Date.parse("2026-09-14T12:09:00.000Z"), hasta: Date.parse("2026-09-14T12:21:00.000Z") },
    ]);
  });

  it("con el destino de un especial entre los dos, la pausa es el destino — se midió, no se dibuja", () => {
    const r = recorrido([
      { lugar: { id: "p", nombre: "Planta", rol: "destino" }, desde: "2026-09-14T12:09:00.000Z", entradaObservada: true, hasta: "2026-09-14T12:21:00.000Z", salidaObservada: true },
    ]);
    expect(pausasEntre(pedazosDe(r), r)[0]).toMatchObject({ tipo: "destino", lugar: "Planta" });
  });

  it("un tramo vacío no se vuelve pedazo", () => {
    expect(pedazosDe({ tramos: [[]] } as unknown as RecorridoJson)).toEqual([]);
  });
});

describe("la ventana vacía (regla 11): dice qué se pudo medir, no si trabajó", () => {
  const dia = { desde: j("2026-09-14T00:00:00"), hasta: j("2026-09-15T00:00:00") - 1 };
  const disp = (o: Partial<Parameters<typeof vacioDe>[1][number]>) => ({
    deviceId: "d1",
    etiqueta: "TK-001",
    desde: j("2026-09-01T00:00:00"),
    hasta: null,
    ultimoPunto: null,
    ...o,
  });

  it("sin dispositivo asignado en ese periodo", () => {
    expect(vacioDe(dia, [])).toEqual({ tipo: "sin_dispositivo" });
    expect(vacioDe(dia, [disp({ desde: j("2026-09-20T00:00:00") })])).toEqual({ tipo: "sin_dispositivo" });
    expect(vacioDe(dia, [disp({ hasta: j("2026-09-10T00:00:00") })])).toEqual({ tipo: "sin_dispositivo" });
  });

  it("con dispositivo que nunca ha reportado", () => {
    expect(vacioDe(dia, [disp({})]).tipo).toBe("no_reporto");
  });

  it("con dispositivo que sí reportó fuera de la ventana: acota o amplía para verlo", () => {
    expect(vacioDe(dia, [disp({ ultimoPunto: j("2026-09-15T10:00:00") })]).tipo).toBe("reporto_fuera");
    expect(vacioDe(dia, [disp({ ultimoPunto: j("2026-09-12T10:00:00") })]).tipo).toBe("reporto_fuera");
  });
});
