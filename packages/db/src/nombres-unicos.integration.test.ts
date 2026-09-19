import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, devices, units } from "../src/index.js";

/*
 * Ningún nombre repetido en una cuenta (C4-e, 0040), contra base de verdad.
 *
 * ESCRIBEN: van contra `DATABASE_URL_TEST`, una rama desechable de Neon, nunca
 * contra producción. El candado de abajo es el mismo de las otras suites.
 *
 * El código revisa el choque antes y lo dice en palabras
 * (`choqueDeIdentidad`, `acciones-unidad.ts`). Aquí se prueba la otra mitad:
 * que **la base lo rechaza aunque alguien se salte el código** —el alta vieja
 * de /carrier/flota/alta, que sigue viva hasta C4-d, o dos altas a la vez—.
 * Eso no se puede probar con dobles: vive en los índices.
 *
 * ⚠ Requiere la migración 0040 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[nombres-unicos] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[nombres-unicos] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `n${Date.now().toString(36)}`;
let serie = 0;
const imei = () => `8${Date.now().toString().slice(-10)}${String(++serie).padStart(4, "0")}`;

let carrierId = "";
let ajenoId = "";

beforeAll(async () => {
  carrierId = (await repos.accounts.create({ type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` })).id;
  ajenoId = (await repos.accounts.create({ type: "carrier", name: `Ajeno ${marca}`, slug: `ajeno-${marca}` })).id;
});

afterAll(async () => {
  // Borrar las cuentas arrastra sus unidades y dispositivos.
  await db.delete(accounts).where(inArray(accounts.id, [carrierId, ajenoId].filter(Boolean)));
});

/** El índice que rechazó la escritura, o null si pasó. */
async function candado(escritura: () => Promise<unknown>): Promise<string | null> {
  try {
    await escritura();
    return null;
  } catch (e) {
    const x = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
    expect(x.code ?? x.cause?.code).toBe("23505");
    return x.constraint_name ?? x.cause?.constraint_name ?? "?";
  }
}

describe("unidades: el nombre no se repite en la cuenta", () => {
  it("la segunda 2101 la rechaza la base, aunque venga con espacios o en otra caja", async () => {
    await repos.fleet.darDeAltaUnidad({ carrierAccountId: carrierId, label: "2101", plateNumber: null, vin: null });
    for (const otra of ["2101", " 2101 ", "2101 "]) {
      expect(await candado(() => repos.fleet.createUnit(carrierId, otra))).toBe("units_nombre_unico_por_cuenta");
    }
    await repos.fleet.darDeAltaUnidad({ carrierAccountId: carrierId, label: "AB 1", plateNumber: null, vin: null });
    expect(await candado(() => repos.fleet.createUnit(carrierId, "ab  1"))).toBe("units_nombre_unico_por_cuenta");
  });

  it("el mismo nombre en otra cuenta sí se puede: es único por cuenta", async () => {
    expect(await candado(() => repos.fleet.createUnit(ajenoId, "2101"))).toBeNull();
  });

  it("renombrar una unidad al nombre de otra también lo rechaza la base", async () => {
    const otra = await repos.fleet.darDeAltaUnidad({ carrierAccountId: carrierId, label: "2102", plateNumber: null, vin: null });
    expect(await candado(() => repos.fleet.corregirUnidad(carrierId, otra.id, { label: "2101", plateNumber: null, vin: null }))).toBe(
      "units_nombre_unico_por_cuenta",
    );
  });
});

describe("unidades: el VIN no se repite en la cuenta, y sin VIN no compite", () => {
  it("dos unidades con el mismo VIN en la cuenta: la base rechaza la segunda", async () => {
    await repos.fleet.darDeAltaUnidad({ carrierAccountId: carrierId, label: "V1", plateNumber: null, vin: "1HGCM82633A004352" });
    expect(
      await candado(() =>
        repos.fleet.darDeAltaUnidad({ carrierAccountId: carrierId, label: "V2", plateNumber: null, vin: "1HGCM82633A004352" }),
      ),
    ).toBe("units_vin_unico_por_cuenta");
  });

  it("el mismo VIN en otra cuenta sí se puede, y muchas unidades sin VIN también", async () => {
    expect(
      await candado(() =>
        repos.fleet.darDeAltaUnidad({ carrierAccountId: ajenoId, label: "V1", plateNumber: null, vin: "1HGCM82633A004352" }),
      ),
    ).toBeNull();
    const sinVin = await db.select().from(units).where(eq(units.carrierAccountId, carrierId));
    expect(sinVin.filter((u) => u.vin === null).length).toBeGreaterThan(2);
  });

  it("corregir la placa sin tocar el nombre no choca consigo misma", async () => {
    const [u] = await db.select().from(units).where(and(eq(units.carrierAccountId, carrierId), eq(units.label, "2102")));
    expect(await candado(() => repos.fleet.corregirUnidad(carrierId, u!.id, { label: "2102", plateNumber: "XYZ-1", vin: null }))).toBeNull();
  });
});

describe("dispositivos: el nombre no se repite entre los que están en servicio", () => {
  it("dos en servicio con el mismo nombre: la base rechaza el segundo", async () => {
    await repos.fleet.createDevice(carrierId, imei(), "GPS-7");
    expect(await candado(() => repos.fleet.createDevice(carrierId, imei(), " gps-7 "))).toBe("devices_nombre_unico_en_servicio");
  });

  it("uno de baja no compite: su nombre ya es historia (los 77 «umbrella»)", async () => {
    const viejo = await repos.fleet.createDevice(carrierId, imei(), "umbrella");
    await db.update(devices).set({ retiredAt: new Date(), retiredReason: "prueba" }).where(eq(devices.id, viejo.id));
    expect(await candado(() => repos.fleet.createDevice(carrierId, imei(), "umbrella"))).toBeNull();
    const otroDeBaja = await repos.fleet.createDevice(carrierId, imei(), "umbrella-2");
    await db.update(devices).set({ retiredAt: new Date(), retiredReason: "prueba" }).where(eq(devices.id, otroDeBaja.id));
    await db.update(devices).set({ label: "umbrella" }).where(eq(devices.id, otroDeBaja.id));
  });

  it("sin nombre no compite", async () => {
    expect(await candado(() => repos.fleet.createDevice(carrierId, imei()))).toBeNull();
    expect(await candado(() => repos.fleet.createDevice(carrierId, imei()))).toBeNull();
  });
});
