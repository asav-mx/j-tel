import { describe, expect, it } from "vitest";
import {
  armarActaDelHecho,
  cotejarContorno,
  huellaDeLaEvidencia,
  type PuntoParaLaHuella,
} from "./acta-del-hecho.js";

const P = (t: string, lat = 31.74, lon = -106.47): PuntoParaLaHuella => ({
  recordedAt: new Date(t),
  latitude: lat,
  longitude: lon,
});

const PUNTOS = [
  P("2026-09-23T18:00:00Z", 31.74, -106.47),
  P("2026-09-23T18:00:30Z", 31.741, -106.471),
  P("2026-09-23T18:01:00Z", 31.742, -106.472),
];

const ENTRADA = {
  ventana: { desde: new Date("2026-09-23T17:45:00Z"), hasta: new Date("2026-09-23T18:15:00Z") },
  unidadObservada: { economico: "2120", placas: "ABC-123" },
  unidadDeReferencia: { economico: "2120", placas: "ABC-123" },
  nombres: {
    perfil: "Oasis-Centro · 06:00",
    contrato: "Contrato de ejemplo",
    planta: "Planta 47",
    cliente: "Cliente de ejemplo",
    transportista: "Juárez Bus",
  },
  estadoDelViaje: "cerrado",
  puntos: PUNTOS,
};

describe("el acta congela lo que el expediente enseña", () => {
  it("guarda la ventana, las unidades y los nombres como TEXTO", () => {
    const a = armarActaDelHecho(ENTRADA);
    expect(a.ventana).toEqual({
      desde: "2026-09-23T17:45:00.000Z",
      hasta: "2026-09-23T18:15:00.000Z",
    });
    expect(a.unidades.observada).toEqual({ economico: "2120", placas: "ABC-123" });
    expect(a.nombres.planta).toBe("Planta 47");
    expect(a.viaje.estado).toBe("cerrado");
  });

  /* Un hueco legítimo se guarda como hueco, no se rellena. */
  it("lo que no había se queda en null", () => {
    const a = armarActaDelHecho({
      ...ENTRADA,
      unidadObservada: null,
      nombres: { perfil: "P" },
      estadoDelViaje: null,
    });
    expect(a.unidades.observada).toBeNull();
    expect(a.nombres.planta).toBeNull();
    expect(a.nombres.transportista).toBeNull();
    expect(a.viaje.estado).toBeNull();
  });

  it("el contorno cuenta los puntos y dice de cuándo a cuándo", () => {
    const a = armarActaDelHecho(ENTRADA);
    expect(a.evidencia.puntos).toBe(3);
    expect(a.evidencia.desde).toBe("2026-09-23T18:00:00.000Z");
    expect(a.evidencia.hasta).toBe("2026-09-23T18:01:00.000Z");
    expect(a.evidencia.huella).toMatch(/^sha256:[0-9a-f]{32}$/);
  });

  it("sin puntos no inventa extremos", () => {
    const a = armarActaDelHecho({ ...ENTRADA, puntos: [] });
    expect(a.evidencia).toMatchObject({ puntos: 0, desde: null, hasta: null });
  });
});

describe("la huella: cambia si cambian, y NO si no cambian", () => {
  /*
   * El orden en que la base devuelve los puntos no es una propiedad de la
   * evidencia. Si la huella dependiera de él, la alarma sonaría sola.
   */
  it("el orden de lectura no la mueve", () => {
    const alReves = [...PUNTOS].reverse();
    expect(huellaDeLaEvidencia(alReves)).toBe(huellaDeLaEvidencia(PUNTOS));
  });

  /*
   * Sin fijar decimales, la misma latitud escrita por dos caminos —31.74 y
   * 31.740000000000002— daría huellas distintas y el expediente gritaría por
   * un redondeo del punto flotante.
   */
  it("un redondeo por debajo del centímetro no la mueve", () => {
    const casiIgual = [
      P("2026-09-23T18:00:00Z", 31.7400000000001, -106.47),
      PUNTOS[1]!,
      PUNTOS[2]!,
    ];
    expect(huellaDeLaEvidencia(casiIgual)).toBe(huellaDeLaEvidencia(PUNTOS));
  });

  it("mover un punto de lugar SÍ la mueve", () => {
    const movido = [P("2026-09-23T18:00:00Z", 31.75, -106.47), PUNTOS[1]!, PUNTOS[2]!];
    expect(huellaDeLaEvidencia(movido)).not.toBe(huellaDeLaEvidencia(PUNTOS));
  });

  it("cambiarle la hora a un punto SÍ la mueve", () => {
    const otraHora = [P("2026-09-23T18:00:05Z"), PUNTOS[1]!, PUNTOS[2]!];
    expect(huellaDeLaEvidencia(otraHora)).not.toBe(huellaDeLaEvidencia(PUNTOS));
  });

  it("quitar un punto SÍ la mueve", () => {
    expect(huellaDeLaEvidencia(PUNTOS.slice(0, 2))).not.toBe(huellaDeLaEvidencia(PUNTOS));
  });

  it("sin puntos la huella existe igual, y es la misma siempre", () => {
    expect(huellaDeLaEvidencia([])).toBe(huellaDeLaEvidencia([]));
  });
});

describe("cotejar el contorno: poder DECIR que ya no cuadra", () => {
  const acta = armarActaDelHecho(ENTRADA);

  it("con los mismos puntos, cuadra", () => {
    expect(cotejarContorno(acta, PUNTOS)).toEqual({ que: "cuadra" });
  });

  /*
   * Ésta es la razón de existir del contorno. Antes, alguien borraba un punto
   * y el expediente enseñaba lo de hoy sin decir una palabra.
   */
  it("si faltan puntos, lo dice con los dos números", () => {
    const r = cotejarContorno(acta, PUNTOS.slice(0, 2));
    expect(r.que).toBe("no_cuadra");
    if (r.que !== "no_cuadra") return;
    expect(r.motivo).toContain("3 puntos");
    expect(r.motivo).toContain("hoy hay 2");
  });

  it("si son los mismos en número pero otro punto cambió, también lo dice", () => {
    const movido = [P("2026-09-23T18:00:00Z", 31.99, -106.47), PUNTOS[1]!, PUNTOS[2]!];
    const r = cotejarContorno(acta, movido);
    expect(r.que).toBe("no_cuadra");
    if (r.que !== "no_cuadra") return;
    expect(r.motivo).toContain("no los mismos");
  });

  /*
   * `sin_acta` NO es «cuadra». Un hecho de antes del acta no se puede
   * preguntar, y pintar ese hueco como un visto bueno es la trampa que
   * `candidatasSnapshot` ya cerró distinguiendo `null` de `[]`.
   */
  it("un hecho sin acta no dice «cuadra»: dice que no se puede preguntar", () => {
    expect(cotejarContorno(null, PUNTOS)).toEqual({ que: "sin_acta" });
    expect(cotejarContorno(undefined, [])).toEqual({ que: "sin_acta" });
  });
});
