import { describe, expect, it } from "vitest";
import {
  diasCiviles,
  estadoDePapel,
  fechaDeVencimientoAGuardar,
  parteDe,
  peorEstado,
  resumirPapeles,
  vencimientoCalculado,
  type ReglaDeTipo,
  type VersionDeFoja,
} from "./expediente.js";

const HOY = "2026-09-16";

const regla = (r: Partial<ReglaDeTipo> = {}): ReglaDeTipo => ({
  obligatorio: true,
  vence: true,
  diasDeAviso: 30,
  periodicidadMeses: null,
  ...r,
});

const foja = (venceEl: string | null, extra: Partial<VersionDeFoja> = {}): VersionDeFoja => ({
  folio: "88213",
  emitidoEl: null,
  venceEl,
  venceCalculado: false,
  ...extra,
});

describe("los tres estados de una parte", () => {
  it("con datos cuando hay algo, vacía cuando no", () => {
    expect(parteDe("ETD-41-92")).toEqual({ estado: "con_datos", valor: "ETD-41-92" });
    expect(parteDe(null)).toEqual({ estado: "vacia" });
    expect(parteDe([])).toEqual({ estado: "vacia" });
    expect(parteDe("   ")).toEqual({ estado: "vacia" });
  });
});

describe("la vigencia, con la regla completa", () => {
  it("vence dentro de sus días de aviso: por vencer", () => {
    expect(estadoDePapel({ regla: regla(), foja: foja("2026-09-28"), hoy: HOY })).toEqual({
      estado: "por_vencer",
      venceEl: "2026-09-28",
      diasRestantes: 12,
    });
  });

  it("vence después de sus días de aviso: vigente", () => {
    expect(estadoDePapel({ regla: regla(), foja: foja("2027-04-18"), hoy: HOY }).estado).toBe("vigente");
  });

  it("el borde de los días de aviso ya es por vencer", () => {
    expect(estadoDePapel({ regla: regla({ diasDeAviso: 12 }), foja: foja("2026-09-28"), hoy: HOY }).estado).toBe(
      "por_vencer",
    );
    expect(estadoDePapel({ regla: regla({ diasDeAviso: 11 }), foja: foja("2026-09-28"), hoy: HOY }).estado).toBe(
      "vigente",
    );
  });

  it("los días de aviso son de cada tipo: 60 para un permiso, 1 para una verificación", () => {
    const venceEnVeinte = foja("2026-10-06");
    expect(estadoDePapel({ regla: regla({ diasDeAviso: 60 }), foja: venceEnVeinte, hoy: HOY }).estado).toBe("por_vencer");
    expect(estadoDePapel({ regla: regla({ diasDeAviso: 1 }), foja: venceEnVeinte, hoy: HOY }).estado).toBe("vigente");
  });

  it("el día del vencimiento todavía es vigente; al día siguiente, vencido", () => {
    expect(estadoDePapel({ regla: regla({ diasDeAviso: 0 }), foja: foja(HOY), hoy: HOY }).estado).toBe("por_vencer");
    expect(estadoDePapel({ regla: regla(), foja: foja("2026-09-15"), hoy: HOY })).toEqual({
      estado: "vencido",
      venceEl: "2026-09-15",
      diasVencido: 1,
    });
  });

  it("un tipo que no vence", () => {
    expect(estadoDePapel({ regla: regla({ vence: false, diasDeAviso: null }), foja: foja(null), hoy: HOY }).estado).toBe(
      "sin_vencimiento",
    );
  });

  it("obligatorio sin foja: falta; opcional sin foja: no capturado", () => {
    expect(estadoDePapel({ regla: regla(), foja: null, hoy: HOY }).estado).toBe("falta");
    expect(estadoDePapel({ regla: regla({ obligatorio: false }), foja: null, hoy: HOY }).estado).toBe("no_capturado");
  });

  it("vence pero la foja no trae fecha: falta la fecha, que es hueco de captura", () => {
    expect(estadoDePapel({ regla: regla(), foja: foja(null), hoy: HOY }).estado).toBe("falta_la_fecha");
  });
});

describe("sin regla, no se supone nada (ficha §5.4)", () => {
  it("sin foja y sin saber si es obligatorio: falta la regla, no «falta»", () => {
    expect(estadoDePapel({ regla: null, foja: null, hoy: HOY })).toEqual({
      estado: "falta_la_regla",
      falta: "obligatorio",
      venceEl: null,
      diasRestantes: null,
    });
  });

  it("con fecha futura y sin saber si vence: falta la regla, pero con sus días", () => {
    expect(estadoDePapel({ regla: null, foja: foja("2026-09-28"), hoy: HOY })).toEqual({
      estado: "falta_la_regla",
      falta: "vence",
      venceEl: "2026-09-28",
      diasRestantes: 12,
    });
  });

  it("sin días de aviso: ni vigente ni por vencer", () => {
    const e = estadoDePapel({ regla: regla({ diasDeAviso: null }), foja: foja("2027-04-18"), hoy: HOY });
    expect(e.estado).toBe("falta_la_regla");
    expect(e).toMatchObject({ falta: "dias_de_aviso" });
  });

  it("una fecha que ya pasó es vencido aunque no haya regla: lo dice el papel", () => {
    expect(estadoDePapel({ regla: null, foja: foja("2026-09-01"), hoy: HOY }).estado).toBe("vencido");
  });
});

describe("el resumen de una pieza", () => {
  it("el peor estado manda en el glifo", () => {
    expect(
      peorEstado([
        { estado: "vigente", venceEl: "2027-01-01", diasRestantes: 107 },
        { estado: "por_vencer", venceEl: "2026-09-28", diasRestantes: 12 },
        { estado: "vencido", venceEl: "2026-09-13", diasVencido: 3 },
      ]),
    ).toBe("vencido");
  });

  it("un papel sin regla impide decir «al día», aunque no le pida nada al carrier", () => {
    const r = resumirPapeles([
      { estado: "vigente", venceEl: "2027-01-01", diasRestantes: 107 },
      { estado: "falta_la_regla", falta: "dias_de_aviso", venceEl: "2027-01-01", diasRestantes: 107 },
    ]);
    expect(r).toEqual({ pidenAlgo: 0, faltaLaRegla: 1, peor: "falta_la_regla", estaAlDia: false });
  });

  it("sin ningún tipo en el catálogo no se está al día: no hay nada que juzgar", () => {
    expect(resumirPapeles([]).estaAlDia).toBe(false);
  });
});

describe("el vencimiento calculado", () => {
  it("suma meses de calendario", () => {
    expect(vencimientoCalculado("2026-03-15", 6)).toBe("2026-09-15");
    expect(vencimientoCalculado("2026-09-16", 12)).toBe("2027-09-16");
  });

  it("un día que no existe en el mes de llegada se queda en el último día, no se corre de mes", () => {
    expect(vencimientoCalculado("2026-08-31", 6)).toBe("2027-02-28");
    expect(vencimientoCalculado("2027-08-31", 6)).toBe("2028-02-29");
  });

  it("la fecha impresa gana; sin ella se calcula sólo si la regla vence y trae periodicidad", () => {
    const r = regla({ periodicidadMeses: 6 });
    expect(fechaDeVencimientoAGuardar({ venceElImpreso: "2026-12-01", emitidoEl: "2026-06-01", regla: r })).toEqual({
      venceEl: "2026-12-01",
      calculado: false,
    });
    expect(fechaDeVencimientoAGuardar({ venceElImpreso: null, emitidoEl: "2026-06-01", regla: r })).toEqual({
      venceEl: "2026-12-01",
      calculado: true,
    });
    expect(fechaDeVencimientoAGuardar({ venceElImpreso: null, emitidoEl: "2026-06-01", regla: regla() })).toEqual({
      venceEl: null,
      calculado: false,
    });
    expect(fechaDeVencimientoAGuardar({ venceElImpreso: null, emitidoEl: "2026-06-01", regla: null })).toEqual({
      venceEl: null,
      calculado: false,
    });
  });

  it("los días civiles no dependen del cambio de horario", () => {
    expect(diasCiviles("2026-10-31", "2026-11-02")).toBe(2);
    expect(diasCiviles("2026-09-16", "2026-09-15")).toBe(-1);
  });
});

describe("la regla vista desde el catálogo", () => {
  it("qué le falta a una regla", async () => {
    const { faltantesDeRegla } = await import("./expediente.js");
    expect(faltantesDeRegla(null)).toEqual(["obligatorio", "vence"]);
    expect(faltantesDeRegla(regla({ obligatorio: null, diasDeAviso: null }))).toEqual(["obligatorio", "dias_de_aviso"]);
    expect(faltantesDeRegla(regla({ vence: false, diasDeAviso: null }))).toEqual([]);
    expect(faltantesDeRegla(regla())).toEqual([]);
  });

  it("el efecto: antes y después, y cuántos pasan a pedir algo", async () => {
    const { efectoDeRegla } = await import("./expediente.js");
    const fojas = [foja("2026-09-10"), foja("2026-09-28"), foja("2027-06-01"), null, foja("2027-01-01", { venceCalculado: true })];
    const e = efectoDeRegla({ actual: null, propuesta: regla({ periodicidadMeses: 6 }), fojas, hoy: HOY });
    expect(e.antes).toMatchObject({ vencido: 1, falta_la_regla: 4 });
    expect(e.despues).toMatchObject({ vencido: 1, por_vencer: 1, vigente: 2, falta: 1 });
    // El vencido ya pedía algo (lo dice el papel): pasan el por vencer y el que falta.
    expect(e.pasanAPedirAlgo).toBe(2);
    expect(e.dejanDePedirAlgo).toBe(0);
    expect(e.fechasCalculadasConservadas).toBe(1);
  });
});
