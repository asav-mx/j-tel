import { describe, it, expect } from "vitest";
import {
  recuperacionTardia,
  HORAS_PARA_LLAMARLO_TARDIO,
  FILAS_QUE_CABIAN_ANTES_DEL_LOTEO,
} from "./recuperacion-tardia.js";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

const CABIAN = FILAS_QUE_CABIAN_ANTES_DEL_LOTEO;

describe("recuperacionTardia", () => {
  it("el caso real: Honeywell, 35 días tarde, 12 000 puntos que no cabían", () => {
    const plazo = new Date("2026-06-30T12:20:00Z");
    const marca = recuperacionTardia({
      esPrimerVeredicto: true,
      plazo,
      selladoEn: new Date(plazo.getTime() + 35 * DIA),
      puntosDeEvidencia: 11_856,
      filasQueCabianEnUnaSentencia: CABIAN,
    });

    expect(marca).not.toBeNull();
    expect(marca!.causa).toBe("escritura_no_cabia_en_una_sentencia");
    expect(marca!.diasDeRetraso).toBe(35);
    // La explicación tiene que servirle a quien no vio el código.
    expect(marca!.explicacion).toContain("35 días");
    expect(marca!.explicacion).toContain("11,856");
    expect(marca!.explicacion).toContain("evidencia completa");
  });

  it("un re-juicio tardío NO es una recuperación: ya tenía veredicto", () => {
    const plazo = new Date("2026-06-30T12:20:00Z");
    expect(
      recuperacionTardia({
        esPrimerVeredicto: false,
        plazo,
        selladoEn: new Date(plazo.getTime() + 35 * DIA),
        puntosDeEvidencia: 11_856,
        filasQueCabianEnUnaSentencia: CABIAN,
      }),
    ).toBeNull();
  });

  it("el sellado normal no se marca", () => {
    const plazo = new Date("2026-08-03T12:20:00Z");
    expect(
      recuperacionTardia({
        esPrimerVeredicto: true,
        plazo,
        selladoEn: new Date(plazo.getTime() + 20 * 60_000),
        puntosDeEvidencia: 4_000,
        filasQueCabianEnUnaSentencia: CABIAN,
      }),
    ).toBeNull();
  });

  it("un corte pasajero tampoco: el umbral deja fuera lo que se recupera solo", () => {
    const plazo = new Date("2026-08-01T12:20:00Z");
    expect(
      recuperacionTardia({
        esPrimerVeredicto: true,
        plazo,
        selladoEn: new Date(plazo.getTime() + HORAS_PARA_LLAMARLO_TARDIO * HORA),
        puntosDeEvidencia: 4_000,
        filasQueCabianEnUnaSentencia: CABIAN,
      }),
    ).toBeNull();
  });

  it("tarde con pocos puntos: se dice que no se sabe, no se inventa la causa", () => {
    const plazo = new Date("2026-06-30T12:20:00Z");
    const marca = recuperacionTardia({
      esPrimerVeredicto: true,
      plazo,
      selladoEn: new Date(plazo.getTime() + 10 * DIA),
      puntosDeEvidencia: 120,
      filasQueCabianEnUnaSentencia: CABIAN,
    });

    expect(marca).not.toBeNull();
    expect(marca!.causa).toBe("no_determinada");
    expect(marca!.explicacion).toContain("no");
    // No debe afirmar la causa que no puede comprobar.
    expect(marca!.explicacion).not.toContain("rechazaba");
  });

  it("justo en el borde de lo que cabía, no se culpa a la escritura", () => {
    const plazo = new Date("2026-06-30T12:20:00Z");
    const marca = recuperacionTardia({
      esPrimerVeredicto: true,
      plazo,
      selladoEn: new Date(plazo.getTime() + 10 * DIA),
      puntosDeEvidencia: CABIAN,
      filasQueCabianEnUnaSentencia: CABIAN,
    });
    expect(marca!.causa).toBe("no_determinada");
  });
});
