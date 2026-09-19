import { describe, expect, it } from "vitest";
import { corregirUnidad, darDeAltaUnidad, nombreDeDispositivoEnUso } from "./acciones-unidad.js";

type Unidad = { id: string; carrier: string; label: string; vin: string | null; plateNumber: string | null };

/** Repos falsos: sólo lo que las acciones tocan, con registro de escrituras. */
function repos(unidades: Unidad[], opciones: { choque?: string } = {}) {
  const escrituras: Array<[string, unknown]> = [];
  const r = {
    fleet: {
      identidadesDeUnidades: async (carrier: string) =>
        unidades.filter((u) => u.carrier === carrier).map(({ id, label, vin }) => ({ id, label, vin })),
      darDeAltaUnidad: async (datos: { label: string }) => {
        if (opciones.choque) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: opciones.choque });
        escrituras.push(["alta", datos]);
        return { id: "nueva", label: datos.label };
      },
      corregirUnidad: async (carrier: string, unitId: string, datos: { label: string }) => {
        escrituras.push(["corregir", { carrier, unitId, ...datos }]);
        const u = unidades.find((x) => x.id === unitId && x.carrier === carrier);
        return u ? { id: u.id, label: datos.label } : null;
      },
      getDevicesForCarrier: async (carrier: string) =>
        [
          { carrier: "jb", label: "TK-FTC927-004", retiredAt: null },
          { carrier: "jb", label: "umbrella", retiredAt: new Date("2026-09-15") },
        ].filter((d) => d.carrier === carrier),
    },
  };
  return { repos: r as never, escrituras };
}

const JUAREZ_BUS: Unidad[] = [
  { id: "u-2101", carrier: "jb", label: "2101", vin: null, plateNumber: null },
  { id: "u-10254", carrier: "jb", label: "10254", vin: "1HGCM82633A004352", plateNumber: "ABC-123" },
  // Otra cuenta, con una 2101 propia y un VIN que ya existe en juarez-bus.
  { id: "u-otra", carrier: "otra", label: "2102", vin: "3N1AB7AP5KY000001", plateNumber: null },
];

describe("dar de alta una unidad", () => {
  it("otra 2101 en juarez-bus se rechaza, en palabras y sin escribir nada", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await darDeAltaUnidad(r, { carrierId: "jb", nombre: " 2101 ", placa: "", vin: "" });
    expect(res).toEqual({ ok: false, error: "nombre_repetido", mensaje: "Ya hay una unidad 2101 en esta cuenta." });
    expect(escrituras).toEqual([]);
  });

  it("el mismo nombre en OTRA cuenta no choca: el nombre es único por cuenta", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    expect((await darDeAltaUnidad(r, { carrierId: "otra", nombre: "2101", placa: "", vin: "" })).ok).toBe(true);
  });

  it("un VIN de otra cuenta tampoco choca, y el aviso nunca la nombra", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    const res = await darDeAltaUnidad(r, { carrierId: "jb", nombre: "2103", placa: "", vin: "3N1AB7AP5KY000001" });
    expect(res.ok).toBe(true);
  });

  it("un VIN que ya es de otra unidad de la cuenta sí choca", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    const res = await darDeAltaUnidad(r, { carrierId: "jb", nombre: "2103", placa: "", vin: "1hgcm8263 3a004352" });
    expect(res).toMatchObject({ ok: false, error: "vin_repetido" });
  });

  it("lo capturado se guarda limpio: placa en mayúsculas, VIN normalizado", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    await darDeAltaUnidad(r, { carrierId: "jb", nombre: "  2103 ", placa: "abc 999", vin: "3n1ab7ap5-ky000002" });
    expect(escrituras).toEqual([
      ["alta", { carrierAccountId: "jb", label: "2103", plateNumber: "ABC 999", vin: "3N1AB7AP5KY000002" }],
    ]);
  });

  it("si dos altas corren a la vez, el candado de la base lo dice en las mismas palabras", async () => {
    const { repos: r } = repos(JUAREZ_BUS, { choque: "units_nombre_unico_por_cuenta" });
    const res = await darDeAltaUnidad(r, { carrierId: "jb", nombre: "2104", placa: "", vin: "" });
    expect(res).toEqual({ ok: false, error: "nombre_repetido", mensaje: "Ya hay una unidad 2104 en esta cuenta." });
  });
});

describe("corregir una unidad", () => {
  it("corregir la placa de la 2101 sin tocar su nombre no choca consigo misma", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await corregirUnidad(r, { carrierId: "jb", unitId: "u-2101", nombre: "2101", placa: "xyz-1", vin: "" });
    expect(res).toEqual({ ok: true, unitId: "u-2101", nombre: "2101" });
    expect(escrituras[0]).toEqual(["corregir", { carrier: "jb", unitId: "u-2101", label: "2101", plateNumber: "XYZ-1", vin: null }]);
  });

  it("renombrarla al nombre de otra unidad de la cuenta se rechaza", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await corregirUnidad(r, { carrierId: "jb", unitId: "u-2101", nombre: "10254", placa: "", vin: "" });
    expect(res).toMatchObject({ ok: false, error: "nombre_repetido" });
    expect(escrituras).toEqual([]);
  });

  it("una unidad de otra cuenta responde igual que una que no existe (el muro)", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await corregirUnidad(r, { carrierId: "jb", unitId: "u-otra", nombre: "X", placa: "", vin: "" });
    expect(res).toEqual({ ok: false, error: "unidad_no_encontrada", mensaje: "Esa unidad no es de esta cuenta." });
    expect(escrituras).toEqual([]);
  });
});

describe("el nombre de un dispositivo en el alta vieja", () => {
  it("uno en servicio con ese nombre lo ocupa; uno de baja no", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    expect(await nombreDeDispositivoEnUso(r, "jb", " tk-ftc927-004 ")).toBe(true);
    expect(await nombreDeDispositivoEnUso(r, "jb", "umbrella")).toBe(false);
    expect(await nombreDeDispositivoEnUso(r, "otra", "TK-FTC927-004")).toBe(false);
    expect(await nombreDeDispositivoEnUso(r, "jb", "")).toBe(false);
  });
});
