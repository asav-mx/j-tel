import { describe, expect, it, vi } from "vitest";
import { cotejar, repartir, sincronizarAvisos } from "./cotejo-compas.js";

const JB = "cuenta-juarez-bus";
const ASAV = "cuenta-asav";
const OTRA = "cuenta-con-umbrella";

describe("repartir · el muro entre clientes", () => {
  it("cada IMEI va a la cuenta que la tabla de J-Tel dice, y a ninguna otra", () => {
    const r = repartir(
      [
        { id: "d1", imei: "111", carrierAccountId: JB },
        { id: "d2", imei: "222", carrierAccountId: ASAV },
      ],
      new Set([JB, ASAV]),
    );
    expect(r.porImei.get("111")).toEqual({ id: "d1", carrierAccountId: JB });
    expect(r.porImei.get("222")).toEqual({ id: "d2", carrierAccountId: ASAV });
  });

  it("un aparato de una cuenta con otro proveedor NO se reparte desde Compás", () => {
    const r = repartir([{ id: "d1", imei: "111", carrierAccountId: OTRA }], new Set([JB]));
    expect(r.porImei.has("111")).toBe(false);
  });

  it("un IMEI en dos cuentas no se le da a ninguna: adivinar el dueño rompería el muro", () => {
    const r = repartir(
      [
        { id: "d1", imei: "111", carrierAccountId: JB },
        { id: "d2", imei: "111", carrierAccountId: ASAV },
      ],
      new Set([JB, ASAV]),
    );
    expect(r.porImei.has("111")).toBe(false);
    expect(r.enDosCuentas).toEqual([{ imei: "111", cuentas: [ASAV, JB].sort() }]);
  });

  it("dos filas del mismo IMEI en la MISMA cuenta no son doble dueño", () => {
    const r = repartir(
      [
        { id: "d1", imei: "111", carrierAccountId: JB },
        { id: "d2", imei: "111", carrierAccountId: JB },
      ],
      new Set([JB]),
    );
    expect(r.enDosCuentas).toEqual([]);
    expect(r.porImei.get("111")?.carrierAccountId).toBe(JB);
  });

  it("un aparato sin IMEI no se reparte ni truena", () => {
    const r = repartir([{ id: "d1", imei: null, carrierAccountId: JB }], new Set([JB]));
    expect(r.porImei.size).toBe(0);
  });
});

describe("cotejar · las huellas", () => {
  it("el caso del 14 de septiembre: en Compás, y su cuenta lee de otro proveedor", () => {
    const c = cotejar(
      ["860693089187232", "860693086784395"],
      [
        { id: "d3", imei: "860693089187232", carrierAccountId: ASAV },
        { id: "d4", imei: "860693086784395", carrierAccountId: ASAV },
      ],
      new Set([JB]), // asav todavía no está en Compás
    );
    expect(c.otroProveedor.map((x) => x.imei)).toEqual(["860693086784395", "860693089187232"]);
    expect(c.sinDueno).toEqual([]);
    expect(c.fueraDeCompas).toEqual([]);
  });

  it("sin dueño: configurado y dado de alta en el servidor, pero no en J-Tel", () => {
    const c = cotejar(["860693086787513"], [], new Set([ASAV]));
    expect(c.sinDueno).toEqual([{ imei: "860693086787513" }]);
  });

  it("fuera de Compás: es de una cuenta en Compás y el servidor no lo tiene", () => {
    const c = cotejar(
      [],
      [{ id: "d1", imei: "860693082402390", carrierAccountId: JB }],
      new Set([JB]),
    );
    expect(c.fueraDeCompas).toEqual([{ imei: "860693082402390", carrierAccountId: JB }]);
  });

  it("un aparato de una cuenta con otro proveedor que Compás no tiene NO es huella: no se espera ahí", () => {
    const c = cotejar([], [{ id: "d1", imei: "111", carrierAccountId: OTRA }], new Set([JB]));
    expect(c).toEqual({ sinDueno: [], otroProveedor: [], fueraDeCompas: [], enDosCuentas: [], deBajaTransmite: [] });
  });

  it("todo en orden: ninguna huella", () => {
    const c = cotejar(
      ["111", "222"],
      [
        { id: "d1", imei: "111", carrierAccountId: JB },
        { id: "d2", imei: "222", carrierAccountId: ASAV },
      ],
      new Set([JB, ASAV]),
    );
    expect(c).toEqual({ sinDueno: [], otroProveedor: [], fueraDeCompas: [], enDosCuentas: [], deBajaTransmite: [] });
  });

  it("un IMEI en dos cuentas se cuenta UNA vez, como doble dueño, y no además en otra huella", () => {
    const c = cotejar(
      ["111"],
      [
        { id: "d1", imei: "111", carrierAccountId: JB },
        { id: "d2", imei: "111", carrierAccountId: OTRA },
      ],
      new Set([JB]),
    );
    expect(c.enDosCuentas).toHaveLength(1);
    expect(c.sinDueno).toEqual([]);
    expect(c.otroProveedor).toEqual([]);
    expect(c.fueraDeCompas).toEqual([]);
  });
});

/** Repositorio falso de avisos, con memoria, para ver lo que se escribe. */
function avisosFalsos(opciones: { createFalla?: string } = {}) {
  const filas: Array<{
    kind: string;
    message: string;
    metadata: Record<string, unknown>;
    resolvedAt: Date | null;
  }> = [];
  const create = vi.fn(async (d: { kind: string; message: string; metadata?: Record<string, unknown> }) => {
    if (opciones.createFalla) throw new Error(opciones.createFalla);
    const fila = { kind: d.kind, message: d.message, metadata: d.metadata ?? {}, resolvedAt: null };
    filas.push(fila);
    return fila;
  });
  return {
    filas,
    create,
    abiertas: () => filas.filter((f) => !f.resolvedAt),
    repos: {
      ingestAlerts: {
        findOpenByKind: async (kind: string) => filas.find((f) => f.kind === kind && !f.resolvedAt),
        resolveOpen: async (kind: string) => {
          for (const f of filas) if (f.kind === kind && !f.resolvedAt) f.resolvedAt = new Date();
        },
        create,
      },
    } as never,
  };
}

const nombres = new Map([
  [JB, "Juárez Bus"],
  [ASAV, "asav"],
]);
const vacio = { sinDueno: [], otroProveedor: [], fueraDeCompas: [], enDosCuentas: [], deBajaTransmite: [] };

describe("sincronizarAvisos · escribe sólo cuando algo cambia", () => {
  it("abre un aviso por huella, con los IMEIs y la cuenta en el texto", async () => {
    const f = avisosFalsos();
    const r = await sincronizarAvisos(
      f.repos,
      { ...vacio, otroProveedor: [{ imei: "860693089187232", carrierAccountId: ASAV }] },
      nombres,
    );
    expect(r.avisosAbiertos).toBe(1);
    expect(f.abiertas()).toHaveLength(1);
    expect(f.abiertas()[0]!.kind).toBe("aparato_otro_proveedor");
    expect(f.abiertas()[0]!.message).toContain("asav: 860693089187232");
  });

  it("corre cada minuto: la misma huella una hora después NO abre otro aviso", async () => {
    const f = avisosFalsos();
    const cotejo = { ...vacio, sinDueno: [{ imei: "860693086787513" }] };
    await sincronizarAvisos(f.repos, cotejo, nombres);
    for (let i = 0; i < 60; i++) await sincronizarAvisos(f.repos, cotejo, nombres);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.filas).toHaveLength(1);
  });

  it("un aparato nuevo en la huella reemplaza el aviso: se cierra el viejo y abre uno con la lista nueva", async () => {
    const f = avisosFalsos();
    await sincronizarAvisos(f.repos, { ...vacio, sinDueno: [{ imei: "111" }] }, nombres);
    const r = await sincronizarAvisos(
      f.repos,
      { ...vacio, sinDueno: [{ imei: "111" }, { imei: "222" }] },
      nombres,
    );
    expect(r).toMatchObject({ avisosAbiertos: 1, avisosCerrados: 1 });
    expect(f.abiertas()).toHaveLength(1);
    expect(f.abiertas()[0]!.message).toContain("111, 222");
  });

  it("cuando la huella desaparece, el aviso se cierra solo", async () => {
    const f = avisosFalsos();
    await sincronizarAvisos(f.repos, { ...vacio, sinDueno: [{ imei: "111" }] }, nombres);
    const r = await sincronizarAvisos(f.repos, vacio, nombres);
    expect(r.avisosCerrados).toBe(1);
    expect(f.abiertas()).toHaveLength(0);
  });

  it("una lista larga se acota en el mensaje, y entera en metadata", async () => {
    const f = avisosFalsos();
    const muchos = Array.from({ length: 85 }, (_, i) => ({
      imei: String(100 + i),
      carrierAccountId: JB,
    }));
    await sincronizarAvisos(f.repos, { ...vacio, fueraDeCompas: muchos }, nombres);
    const aviso = f.abiertas()[0]!;
    expect(aviso.message).toContain("85 aparatos");
    expect(aviso.message).toContain("y 75 más");
    expect((aviso.metadata.aparatos as unknown[]).length).toBe(85);
  });

  it("si la base no conoce los tipos nuevos (0035 sin aplicar), no lanza: el error sale en el resumen", async () => {
    const f = avisosFalsos({
      createFalla: 'invalid input value for enum ingest_alert_kind: "aparato_sin_dueno"',
    });
    const r = await sincronizarAvisos(f.repos, { ...vacio, sinDueno: [{ imei: "111" }] }, nombres);
    expect(r.error).toContain("ingest_alert_kind");
    expect(r.sinDueno).toBe(1);
  });
});

/**
 * La baja de los 82 de Umbrella (0036).
 *
 * Sin esto, `aparato_fuera_de_compas` listaba a los muertos para siempre, y el
 * aparato real que faltara se perdía en la lista.
 */
describe("cotejar · los dados de baja", () => {
  const CORTE = new Date("2026-09-05T15:20:04Z");
  const BAJA = new Date("2026-09-15T12:00:00Z");
  const umbrella = { id: "d-u", imei: "861412043038798", carrierAccountId: JB, retiredAt: BAJA };

  it("un aparato dado de baja NO cuenta como fuera de Compás", () => {
    const c = cotejar([], [umbrella], new Set([JB]));
    expect(c.fueraDeCompas).toEqual([]);
  });

  it("pero uno activo de la misma cuenta sí, y es el que tiene que verse", () => {
    const c = cotejar(
      [],
      [umbrella, { id: "d-real", imei: "860693000000001", carrierAccountId: JB }],
      new Set([JB]),
    );
    expect(c.fueraDeCompas).toEqual([{ imei: "860693000000001", carrierAccountId: JB }]);
  });

  it("si vuelve a transmitir DESPUÉS de la baja, lo dice su propia huella", () => {
    const despues = new Date("2026-09-20T08:00:00Z");
    const c = cotejar([umbrella.imei], [umbrella], new Set([JB]), new Map([[umbrella.imei, despues]]));
    expect(c.deBajaTransmite).toEqual([{ imei: umbrella.imei, carrierAccountId: JB }]);
    // Y no se cuenta además como sin dueño: tiene dueño, está fuera de servicio.
    expect(c.sinDueno).toEqual([]);
  });

  it("una posición de ANTES de la baja no suena: es la última que dejó, no una nueva", () => {
    const c = cotejar([umbrella.imei], [umbrella], new Set([JB]), new Map([[umbrella.imei, CORTE]]));
    expect(c.deBajaTransmite).toEqual([]);
    expect(c.sinDueno).toEqual([]);
  });

  it("su posición no se reparte en vivo: está fuera de servicio", () => {
    const r = repartir([umbrella], new Set([JB]));
    expect(r.porImei.has(umbrella.imei)).toBe(false);
  });

  it("de baja en una cuenta y activo en otra no es doble dueño: cambió de manos", () => {
    const r = repartir(
      [umbrella, { id: "d-nuevo", imei: umbrella.imei, carrierAccountId: ASAV }],
      new Set([JB, ASAV]),
    );
    expect(r.enDosCuentas).toEqual([]);
    expect(r.porImei.get(umbrella.imei)?.carrierAccountId).toBe(ASAV);
  });
});
