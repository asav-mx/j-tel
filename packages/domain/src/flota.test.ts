import { describe, expect, it } from "vitest";
import {
  DESCONECTADO_HORAS,
  GRUPOS_DE_DISPOSITIVO,
  VELOCIDAD_DETENIDA_KMH,
  clasificarFlota,
  estaDesconectado,
  estadoDeUnidad,
  grupoDeUnidad,
  gruposDeUnidad,
  ultimaSenalDe,
  unirDispositivosConUnidades,
  type AsignacionDeFlota,
  type DispositivoDeFlota,
} from "./flota.js";
import { SIN_SENAL_MINUTOS } from "./senal.js";

const AHORA = new Date("2026-09-15T18:00:00Z");
const MIN = 60_000;
const HORA = 60 * MIN;
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

const dispositivo = (id: string, extra: Partial<DispositivoDeFlota> = {}): DispositivoDeFlota => ({
  id,
  imei: `imei-${id}`,
  label: `TK-FTC927-${id}`,
  retiredAt: null,
  retiredReason: null,
  ...extra,
});

const asignacion = (unitId: string, deviceId: string, extra: Partial<AsignacionDeFlota> = {}): AsignacionDeFlota => ({
  unitId,
  deviceId,
  validFrom: hace(30 * 24 * HORA),
  validTo: null,
  ...extra,
});

describe("los números, y que no se muevan sin querer", () => {
  it("detenida por debajo de 5 km/h, desconectado a las 24 h, señal vieja a los 15 min", () => {
    expect(VELOCIDAD_DETENIDA_KMH).toBe(5);
    expect(DESCONECTADO_HORAS).toBe(24);
    expect(SIN_SENAL_MINUTOS).toBe(15);
  });
});

describe("ultimaSenalDe · lo más reciente entre la posición viva y el archivo", () => {
  it("gana la viva cuando es más nueva, con velocidad y rumbo", () => {
    const s = ultimaSenalDe({ imei: "x", recordedAt: hace(1 * MIN), speed: 42.7, heading: 90 }, hace(10 * MIN));
    expect(s).toEqual({ at: hace(1 * MIN), speed: 42.7, heading: 90 });
  });

  it("gana el archivo cuando llegó más lejos, y entonces no hay velocidad que afirmar", () => {
    const s = ultimaSenalDe({ imei: "x", recordedAt: hace(2 * HORA), speed: 42.7, heading: 90 }, hace(10 * MIN));
    expect(s).toEqual({ at: hace(10 * MIN), speed: null, heading: null });
  });

  it("sólo archivo no es «nunca reportó»", () => {
    expect(ultimaSenalDe(undefined, hace(3 * HORA))?.at).toEqual(hace(3 * HORA));
  });

  it("ni viva ni archivo: nunca reportó", () => {
    expect(ultimaSenalDe(undefined, undefined)).toBeNull();
  });
});

describe("unirDispositivosConUnidades · por asignación vigente", () => {
  it("une por la asignación vigente e ignora las cerradas y las futuras", () => {
    const u = unirDispositivosConUnidades(
      [dispositivo("1"), dispositivo("2"), dispositivo("3")],
      [
        asignacion("u1", "1"),
        asignacion("u2", "2", { validTo: hace(1 * HORA) }), // soltado
        asignacion("u3", "3", { validFrom: new Date(AHORA.getTime() + HORA) }), // todavía no
      ],
      AHORA,
    );
    expect(u.unidadPorDispositivo.get("1")?.unidadId).toBe("u1");
    expect(u.unidadPorDispositivo.has("2")).toBe(false);
    expect(u.unidadPorDispositivo.has("3")).toBe(false);
  });

  it("un dispositivo de baja con asignación abierta no le da estado a su unidad, y se dice", () => {
    const u = unirDispositivosConUnidades(
      [dispositivo("1", { retiredAt: hace(24 * HORA), retiredReason: "roto" })],
      [asignacion("u1", "1")],
      AHORA,
    );
    expect(u.dispositivosPorUnidad.has("u1")).toBe(false);
    expect(u.anomalias.dispositivosDeBajaMontados).toEqual([{ dispositivoId: "1", unidadId: "u1" }]);
  });

  it("dos dispositivos en una unidad, o uno en dos unidades, son anomalías que se nombran", () => {
    const u = unirDispositivosConUnidades(
      [dispositivo("1"), dispositivo("2")],
      [
        asignacion("u1", "1"),
        asignacion("u1", "2"),
        asignacion("u2", "2", { validFrom: hace(1 * HORA) }),
      ],
      AHORA,
    );
    expect(u.anomalias.unidadesConVariosDispositivos).toEqual([{ unidadId: "u1", dispositivoIds: ["1", "2"] }]);
    expect(u.anomalias.dispositivosEnVariasUnidades).toEqual([{ dispositivoId: "2", unidadIds: ["u1", "u2"] }]);
    // Con dos, el dispositivo va con la declaración más reciente.
    expect(u.unidadPorDispositivo.get("2")?.unidadId).toBe("u2");
  });

  it("una asignación a un dispositivo de otra cuenta no entra a esta flota", () => {
    const u = unirDispositivosConUnidades([dispositivo("1")], [asignacion("u1", "ajeno")], AHORA);
    expect(u.dispositivosPorUnidad.size).toBe(0);
  });
});

describe("estadoDeUnidad", () => {
  const montado = (id = "1", desde = hace(30 * 24 * HORA)) => [{ dispositivo: dispositivo(id), desde }];
  const senales = (at: Date, speed: number | null, heading: number | null = 135) =>
    new Map([["imei-1", { at, speed, heading }]]);

  it("sin dispositivo vigente: SIN DISPOSITIVO, y no se le inventa estado", () => {
    const e = estadoDeUnidad({ dispositivos: [], senalPorImei: new Map() }, AHORA);
    expect(e).toEqual({ tipo: "sin_dispositivo" });
    expect(grupoDeUnidad(e)).toBe("sin_dispositivo");
  });

  it("señal de hace 14 s a 42.7 km/h: EN LÍNEA, en movimiento, con su rumbo", () => {
    const e = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(14_000), 42.7) }, AHORA);
    expect(e).toMatchObject({ tipo: "en_linea", postura: "en_movimiento", rumbo: 135, velocidadKmh: 42.7 });
    expect(grupoDeUnidad(e)).toBe("en_linea");
  });

  it("a 4.9 km/h está detenida y no afirma rumbo; a 5 ya se mueve", () => {
    const detenida = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(MIN), 4.9) }, AHORA);
    expect(detenida).toMatchObject({ tipo: "en_linea", postura: "detenida", rumbo: null });
    const mueve = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(MIN), 5) }, AHORA);
    expect(mueve).toMatchObject({ postura: "en_movimiento" });
  });

  it("señal fresca sin velocidad (vino del archivo): en línea, sin afirmar movimiento ni reposo", () => {
    const e = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(MIN), null, null) }, AHORA);
    expect(e).toMatchObject({ tipo: "en_linea", postura: "sin_velocidad", rumbo: null });
  });

  it("el corte de en línea es 15 min exactos", () => {
    const justo = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(15 * MIN), 0) }, AHORA);
    expect(justo.tipo).toBe("en_linea");
    const pasado = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(15 * MIN + 1), 0) }, AHORA);
    expect(pasado.tipo).toBe("callada");
  });

  it("callada 3.8 h: su grupo NO está decidido y la función no lo inventa", () => {
    const e = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(3.8 * HORA), 0) }, AHORA);
    expect(e.tipo).toBe("callada");
    expect(grupoDeUnidad(e)).toBeNull();
  });

  it("más de 24 h sin señal: DESCONECTADO", () => {
    const e = estadoDeUnidad({ dispositivos: montado(), senalPorImei: senales(hace(24 * HORA + 1), 0) }, AHORA);
    expect(e).toMatchObject({ tipo: "desconectado", ultimaSenalAt: hace(24 * HORA + 1) });
    expect(grupoDeUnidad(e)).toBe("desconectado");
  });

  it("montada hace 10 días y nunca reportó: DESCONECTADO", () => {
    const e = estadoDeUnidad({ dispositivos: montado("1", hace(10 * 24 * HORA)), senalPorImei: new Map() }, AHORA);
    expect(e).toEqual({ tipo: "desconectado", dispositivoId: "1", ultimaSenalAt: null });
  });

  it("montada hace 2 h y nunca reportó: todavía no tuvo un día para reportar, no está desconectada", () => {
    const e = estadoDeUnidad({ dispositivos: montado("1", hace(2 * HORA)), senalPorImei: new Map() }, AHORA);
    expect(e.tipo).toBe("callada");
  });

  it("con una llegada sellada vigente: EN DESTINO, con la hora de llegada y sin edad", () => {
    const e = estadoDeUnidad(
      { dispositivos: montado(), senalPorImei: senales(hace(MIN), 30), llegadaVigenteAt: hace(40 * MIN) },
      AHORA,
    );
    expect(e).toEqual({ tipo: "en_destino", dispositivoId: "1", llegadaAt: hace(40 * MIN) });
    expect(grupoDeUnidad(e)).toBe("en_destino");
  });

  it("con dos dispositivos, manda el de señal más reciente", () => {
    const e = estadoDeUnidad(
      {
        dispositivos: [
          { dispositivo: dispositivo("1"), desde: hace(30 * 24 * HORA) },
          { dispositivo: dispositivo("2"), desde: hace(30 * 24 * HORA) },
        ],
        senalPorImei: new Map([
          ["imei-1", { at: hace(3 * 24 * HORA), speed: 0, heading: 0 }],
          ["imei-2", { at: hace(MIN), speed: 20, heading: 10 }],
        ]),
      },
      AHORA,
    );
    expect(e).toMatchObject({ tipo: "en_linea", dispositivoId: "2" });
  });
});

describe("estaDesconectado · 24 h desde la última señal o desde el montaje", () => {
  it("salió de bodega hace 2 h con su última señal de hace una semana: no está desconectado", () => {
    expect(estaDesconectado(hace(7 * 24 * HORA), hace(2 * HORA), AHORA)).toBe(false);
  });
  it("montado hace un mes, última señal hace 25 h: desconectado", () => {
    expect(estaDesconectado(hace(25 * HORA), hace(30 * 24 * HORA), AHORA)).toBe(true);
  });
});

describe("gruposDeUnidad · sin contrato, EN DESTINO no existe", () => {
  it("con contrato, los cuatro en su orden", () => {
    expect(gruposDeUnidad({ tieneContrato: true })).toEqual(["en_linea", "en_destino", "desconectado", "sin_dispositivo"]);
  });
  it("sin contrato, el grupo no aparece — no es un grupo vacío", () => {
    expect(gruposDeUnidad({ tieneContrato: false })).toEqual(["en_linea", "desconectado", "sin_dispositivo"]);
  });
  it("los del inventario, en su orden", () => {
    expect([...GRUPOS_DE_DISPOSITIVO]).toEqual(["en_unidad", "en_bodega", "desconectado", "de_baja"]);
  });
});

describe("clasificarFlota · el inventario (Marco 6.6)", () => {
  const flota = () =>
    clasificarFlota({
      ahora: AHORA,
      unidades: [
        { id: "u1", label: "10254" },
        { id: "u2", label: "10301" },
      ],
      dispositivos: [
        dispositivo("montado"),
        dispositivo("bodega-callado"),
        dispositivo("desconectado"),
        dispositivo("baja", { retiredAt: hace(10 * 24 * HORA), retiredReason: "Umbrella, sin datos desde el 5 sep" }),
      ],
      asignaciones: [asignacion("u1", "montado"), asignacion("u2", "desconectado")],
      posicionesVivas: [
        { imei: "imei-montado", recordedAt: hace(14_000), speed: 42.7, heading: 90 },
        { imei: "imei-desconectado", recordedAt: hace(3 * 24 * HORA), speed: 0, heading: 0 },
      ],
      ultimoArchivadoPorImei: new Map([["imei-bodega-callado", hace(5 * 24 * HORA)]]),
    });

  const grupoDe = (id: string) => flota().dispositivos.find((d) => d.dispositivo.id === id)!.estado;

  it("montado y reportando: EN UNIDAD, con su unidad", () => {
    expect(grupoDe("montado")).toMatchObject({ grupo: "en_unidad", unidadId: "u1", ultimaSenalAt: hace(14_000) });
  });

  it("en bodega callado 5 días: EN BODEGA, sin acusarlo — en caja apagado es lo normal", () => {
    expect(grupoDe("bodega-callado")).toEqual({ grupo: "en_bodega", ultimaSenalAt: hace(5 * 24 * HORA) });
  });

  it("montado y 3 días sin señal: DESCONECTADO", () => {
    expect(grupoDe("desconectado")).toMatchObject({ grupo: "desconectado", unidadId: "u2" });
  });

  it("de baja: DE BAJA con fecha y motivo, aunque nunca haya reportado", () => {
    expect(grupoDe("baja")).toMatchObject({ grupo: "de_baja", retiredReason: "Umbrella, sin datos desde el 5 sep" });
  });

  it("sin fuente de llegadas, ninguna unidad sale en destino", () => {
    expect(flota().unidades.map((u) => u.estado.tipo)).toEqual(["en_linea", "desconectado"]);
  });
});
