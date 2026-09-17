import { describe, expect, it } from "vitest";
import {
  asignarDispositivo,
  darDeAltaDispositivo,
  darDeBajaDispositivo,
  soltarDispositivo,
} from "./acciones-dispositivo.js";

const AHORA = new Date("2026-09-17T15:00:00Z");
const IMEI_REAL = "860693082402380";

interface Estado {
  dispositivos: Array<{ id: string; carrier: string; retiredAt: Date | null }>;
  unidades: Array<{ id: string; carrier: string; active: boolean }>;
  vigentes: Map<string, string>; // deviceId → unitId
}

/** Repos falsos: sólo lo que las acciones tocan, con registro de escrituras. */
function repos(estado: Estado, opciones: { choqueAlAsignar?: boolean; altaResponde?: unknown } = {}) {
  const escrituras: Array<[string, ...unknown[]]> = [];
  const r = {
    expedientes: {
      dispositivoDeCuenta: async (carrier: string, id: string) =>
        estado.dispositivos.find((d) => d.id === id && d.carrier === carrier) ?? null,
      unidadDeCuenta: async (carrier: string, id: string) =>
        estado.unidades.find((u) => u.id === id && u.carrier === carrier) ?? null,
      asignacionesDeDispositivo: async (_carrier: string, id: string) => {
        const u = estado.vigentes.get(id);
        return u ? [{ unitId: u, etiqueta: u, desde: new Date(0), hasta: null }] : [];
      },
    },
    fleet: {
      darDeAltaDispositivo: async (datos: unknown) => {
        escrituras.push(["alta", datos]);
        return opciones.altaResponde ?? { ok: true, dispositivo: { id: "nuevo", label: "TK-FTC927-009" } };
      },
      asignacionesDeUnidad: async (unitId: string) =>
        [...estado.vigentes].filter(([, u]) => u === unitId).map(([deviceId]) => ({ deviceId, hasta: null })),
      assignDevice: async (...args: unknown[]) => {
        if (opciones.choqueAlAsignar) throw Object.assign(new Error("duplicate key"), { code: "23505" });
        escrituras.push(["asignar", ...args]);
      },
      soltarDispositivo: async (id: string, datos: unknown) => {
        escrituras.push(["soltar", id, datos]);
        const u = estado.vigentes.get(id);
        return u ? { unitId: u } : null;
      },
      darDeBajaDispositivo: async (id: string, datos: unknown) => {
        escrituras.push(["baja", id, datos]);
        const u = estado.vigentes.get(id);
        return { dispositivo: { id }, soltada: u ? { unitId: u } : null };
      },
    },
  };
  return { repos: r as never, escrituras };
}

function flota(): Estado {
  return {
    dispositivos: [
      { id: "d-bodega", carrier: "jb", retiredAt: null },
      { id: "d-montado", carrier: "jb", retiredAt: null },
      { id: "d-baja", carrier: "jb", retiredAt: new Date("2026-09-15T00:00:00Z") },
      { id: "d-ajeno", carrier: "otro", retiredAt: null },
    ],
    unidades: [
      { id: "u-10254", carrier: "jb", active: true },
      { id: "u-inactiva", carrier: "jb", active: false },
      { id: "u-ajena", carrier: "otro", active: true },
    ],
    vigentes: new Map([["d-montado", "u-10254"]]),
  };
}

describe("darDeAltaDispositivo", () => {
  it("valida el IMEI antes de pedir número: un dígito mal tecleado no gasta consecutivo", async () => {
    const f = repos(flota());
    const r = await darDeAltaDispositivo(f.repos, { carrierId: "jb", imeiCapturado: "860693082402381", prefijo: "TK-FTC927" });
    expect(r).toMatchObject({ ok: false, error: "imei_invalido" });
    expect(f.escrituras).toEqual([]);
  });

  it("normaliza lo copiado de la etiqueta y devuelve el nombre generado", async () => {
    const f = repos(flota());
    const r = await darDeAltaDispositivo(f.repos, {
      carrierId: "jb",
      imeiCapturado: "8606 9308 2402 380",
      prefijo: "TK-FTC927",
    });
    expect(r).toEqual({ ok: true, deviceId: "nuevo", nombre: "TK-FTC927-009" });
    expect(f.escrituras).toEqual([["alta", { carrierAccountId: "jb", imei: IMEI_REAL, prefijo: "TK-FTC927" }]]);
  });

  it("un modelo fuera del catálogo no se nombra", async () => {
    const r = await darDeAltaDispositivo(repos(flota()).repos, { carrierId: "jb", imeiCapturado: IMEI_REAL, prefijo: "TK-X" });
    expect(r).toMatchObject({ ok: false, error: "modelo_desconocido" });
  });

  it("un IMEI de otra cuenta se dice en palabras y manda a J-Tel, sin nombrar la cuenta", async () => {
    const f = repos(flota(), { altaResponde: { ok: false, error: "imei_en_otra_cuenta" } });
    const r = await darDeAltaDispositivo(f.repos, { carrierId: "jb", imeiCapturado: IMEI_REAL, prefijo: "TK-FTC927" });
    expect(r).toMatchObject({ ok: false, error: "imei_en_otra_cuenta" });
    if (!r.ok) expect(r.mensaje).toContain("J-Tel");
  });
});

describe("asignarDispositivo", () => {
  const base = { carrierId: "jb", por: "user_1", ahora: AHORA };

  it("de bodega a una unidad ocupada: escribe con la hora de ahora y quién, y dice cuál quedó en bodega", async () => {
    const f = repos(flota());
    const r = await asignarDispositivo(f.repos, { ...base, deviceId: "d-bodega", unitId: "u-10254" });
    expect(r).toEqual({ ok: true, unidadAnteriorId: null, dispositivoDesplazadoId: "d-montado" });
    expect(f.escrituras).toEqual([["asignar", "u-10254", "d-bodega", AHORA, "user_1"]]);
  });

  it("de una unidad a otra libre: dice de dónde salió y no desplaza a nadie", async () => {
    const f = repos({
      ...flota(),
      unidades: [...flota().unidades, { id: "u-10301", carrier: "jb", active: true }],
    });
    const r = await asignarDispositivo(f.repos, { ...base, deviceId: "d-montado", unitId: "u-10301" });
    expect(r).toEqual({ ok: true, unidadAnteriorId: "u-10254", dispositivoDesplazadoId: null });
  });

  it("un id de otra cuenta responde igual que uno inexistente, y no escribe", async () => {
    const f = repos(flota());
    expect(await asignarDispositivo(f.repos, { ...base, deviceId: "d-ajeno", unitId: "u-10254" })).toMatchObject({
      ok: false,
      error: "dispositivo_no_encontrado",
    });
    expect(await asignarDispositivo(f.repos, { ...base, deviceId: "d-bodega", unitId: "u-ajena" })).toMatchObject({
      ok: false,
      error: "unidad_no_encontrada",
    });
    expect(f.escrituras).toEqual([]);
  });

  it("de baja, a unidad inactiva o donde ya está: no escribe", async () => {
    const f = repos(flota());
    expect(await asignarDispositivo(f.repos, { ...base, deviceId: "d-baja", unitId: "u-10254" })).toMatchObject({
      error: "dispositivo_de_baja",
    });
    expect(await asignarDispositivo(f.repos, { ...base, deviceId: "d-bodega", unitId: "u-inactiva" })).toMatchObject({
      error: "unidad_inactiva",
    });
    expect(await asignarDispositivo(f.repos, { ...base, deviceId: "d-montado", unitId: "u-10254" })).toMatchObject({
      error: "ya_asignado_ahi",
    });
    expect(f.escrituras).toEqual([]);
  });

  it("si el candado de la base rechaza, se dice que alguien cambió al mismo tiempo", async () => {
    const f = repos(flota(), { choqueAlAsignar: true });
    const r = await asignarDispositivo(f.repos, { ...base, deviceId: "d-bodega", unitId: "u-10254" });
    expect(r).toMatchObject({ ok: false, error: "cambio_simultaneo" });
  });
});

describe("soltarDispositivo", () => {
  const base = { carrierId: "jb", por: "user_1", ahora: AHORA };

  it("pide motivo antes de leer nada", async () => {
    const f = repos(flota());
    const r = await soltarDispositivo(f.repos, { ...base, deviceId: "d-montado", motivo: "  " });
    expect(r).toMatchObject({ ok: false, error: "motivo_vacio", mensaje: "Escribe el motivo." });
    expect(f.escrituras).toEqual([]);
  });

  it("suelta lo montado con quién, cuándo y el motivo limpio", async () => {
    const f = repos(flota());
    const r = await soltarDispositivo(f.repos, { ...base, deviceId: "d-montado", motivo: " la unidad entró a taller " });
    expect(r).toEqual({ ok: true, unidadId: "u-10254" });
    expect(f.escrituras).toEqual([
      ["soltar", "d-montado", { at: AHORA, por: "user_1", motivo: "la unidad entró a taller" }],
    ]);
  });

  it("uno en bodega no tiene nada que soltar", async () => {
    const f = repos(flota());
    expect(await soltarDispositivo(f.repos, { ...base, deviceId: "d-bodega", motivo: "x" })).toMatchObject({
      error: "no_esta_montado",
    });
    expect(f.escrituras).toEqual([]);
  });
});

describe("darDeBajaDispositivo", () => {
  const base = { carrierId: "jb", por: "user_1", ahora: AHORA };

  it("montado: la baja lo suelta y lo dice", async () => {
    const r = await darDeBajaDispositivo(repos(flota()).repos, { ...base, deviceId: "d-montado", motivo: "se quemó" });
    expect(r).toEqual({ ok: true, unidadSoltadaId: "u-10254" });
  });

  it("dos veces no", async () => {
    const f = repos(flota());
    expect(await darDeBajaDispositivo(f.repos, { ...base, deviceId: "d-baja", motivo: "otra vez" })).toMatchObject({
      error: "ya_de_baja",
    });
    expect(f.escrituras).toEqual([]);
  });

  it("sin motivo no hay baja (6.5)", async () => {
    expect(await darDeBajaDispositivo(repos(flota()).repos, { ...base, deviceId: "d-bodega", motivo: "" })).toMatchObject({
      error: "motivo_vacio",
    });
  });
});
