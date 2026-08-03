import { describe, expect, it } from "vitest";
import {
  construirSaludSenal,
  mesDeInstante,
  nombreDeMes,
  type MesDeSenal,
  type PeriodoDeRastreador,
} from "./salud-senal";

const TZ = "America/Ciudad_Juarez";

const mes = (mes: string, huecos: number, minutos = huecos * 40): MesDeSenal => ({
  mes,
  huecos,
  minutosSinVer: minutos,
  puntos: 40_000,
});

const equipo = (imei: string, desde: string, hasta?: string): PeriodoDeRastreador => ({
  imei,
  etiqueta: null,
  desde: new Date(desde),
  hasta: hasta ? new Date(hasta) : null,
});

describe("mesDeInstante", () => {
  it("corta el mes en el reloj de la operación, no en UTC", () => {
    // 2026-08-01T04:00Z son las 22:00 del 31 de julio en Juárez. En UTC este
    // instante es de agosto; para quien opera es de julio, y el expediente
    // habla su idioma.
    expect(mesDeInstante(new Date("2026-08-01T04:00:00Z"), TZ)).toBe("2026-07");
    expect(mesDeInstante(new Date("2026-08-01T04:00:00Z"), "UTC")).toBe("2026-08");
  });
});

describe("nombreDeMes", () => {
  it("escribe el mes para leerse", () => {
    expect(nombreDeMes("2026-07")).toBe("julio 2026");
  });
});

describe("construirSaludSenal", () => {
  it("sin cambio de rastreador NO inventa una lectura, y dice por qué", () => {
    // El caso de esta flota entera: 82 unidades, 82 asignaciones, ninguna
    // cerrada. No hay antes ni después que comparar.
    const r = construirSaludSenal({
      meses: [mes("2026-06", 4), mes("2026-07", 9), mes("2026-08", 2)],
      rastreadores: [equipo("A", "2026-01-10T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.lectura).toBeNull();
    expect(r.sinLectura).toContain("el mismo rastreador desde su alta");
  });

  it("con el patrón que la ficha describe, declara que el aparato no es", () => {
    const r = construirSaludSenal({
      meses: [
        mes("2026-03", 10),
        mes("2026-04", 12),
        mes("2026-05", 11),
        mes("2026-06", 13),
      ],
      rastreadores: [
        equipo("VIEJO", "2026-01-01T00:00:00Z", "2026-05-04T00:00:00Z"),
        equipo("NUEVO", "2026-05-04T12:00:00Z"),
      ],
      timeZone: TZ,
    });
    expect(r.lectura).toContain("no movió los huecos");
    expect(r.lectura).toContain("El problema no es el aparato");
    expect(r.sinLectura).toBeNull();
  });

  it("si el cambio SÍ sirvió, lo dice — no solo el caso que conviene", () => {
    const r = construirSaludSenal({
      meses: [mes("2026-03", 12), mes("2026-04", 14), mes("2026-05", 2), mes("2026-06", 1)],
      rastreadores: [
        equipo("VIEJO", "2026-01-01T00:00:00Z", "2026-05-02T00:00:00Z"),
        equipo("NUEVO", "2026-05-02T12:00:00Z"),
      ],
      timeZone: TZ,
    });
    expect(r.lectura).toContain("bajó los huecos");
  });

  it("no declara nada con un solo mes de cada lado", () => {
    // Un mes flojo por cualquier otra razón se leería como efecto del cambio.
    const r = construirSaludSenal({
      meses: [mes("2026-04", 12), mes("2026-05", 2)],
      rastreadores: [
        equipo("VIEJO", "2026-01-01T00:00:00Z", "2026-05-02T00:00:00Z"),
        equipo("NUEVO", "2026-05-02T12:00:00Z"),
      ],
      timeZone: TZ,
    });
    expect(r.lectura).toBeNull();
    expect(r.sinLectura).toContain("2 meses de cada lado");
  });

  it("la PRIMERA instalación no es un cambio: es el alta", () => {
    const r = construirSaludSenal({
      meses: [mes("2026-05", 3), mes("2026-06", 3), mes("2026-07", 3), mes("2026-08", 3)],
      rastreadores: [equipo("UNICO", "2026-05-10T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.barras.some((b) => b.cambioDeRastreador)).toBe(false);
  });

  it("la barra se escala contra el peor mes, no contra un máximo inventado", () => {
    const r = construirSaludSenal({
      meses: [mes("2026-06", 5), mes("2026-07", 10)],
      rastreadores: [equipo("A", "2026-01-01T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.maximoHuecos).toBe(10);
    expect(r.barras[0]!.proporcion).toBe(0.5);
    expect(r.barras[1]!.proporcion).toBe(1);
  });

  it("un mes sin huecos no divide entre cero", () => {
    const r = construirSaludSenal({
      meses: [mes("2026-06", 0, 0), mes("2026-07", 0, 0)],
      rastreadores: [equipo("A", "2026-01-01T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.maximoHuecos).toBe(0);
    expect(r.barras.every((b) => b.proporcion === 0)).toBe(true);
    expect(r.totalHuecos).toBe(0);
  });

  it("una unidad sin un solo punto lo dice, en vez de dibujar cero", () => {
    const r = construirSaludSenal({
      meses: [],
      rastreadores: [equipo("A", "2026-01-01T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.barras).toHaveLength(0);
    expect(r.sinLectura).toContain("no tiene un solo punto");
  });

  it("suma los totales del periodo sin perder ningún mes", () => {
    const r = construirSaludSenal({
      meses: [mes("2026-06", 4, 100), mes("2026-07", 9, 300), mes("2026-08", 2, 50)],
      rastreadores: [equipo("A", "2026-01-01T00:00:00Z")],
      timeZone: TZ,
    });
    expect(r.totalHuecos).toBe(15);
    expect(r.totalMinutos).toBe(450);
  });
});
