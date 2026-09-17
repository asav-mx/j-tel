import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createDb, createRepositories, accounts, deviceAssignments, devices } from "../src/index.js";

/*
 * Las acciones sobre un dispositivo (C4), contra base de verdad.
 *
 * ESCRIBEN: van contra `DATABASE_URL_TEST`, una rama desechable de Neon, nunca
 * contra producción. El candado de abajo es el mismo de las otras suites.
 *
 * Lo que se prueba aquí no se puede probar con dobles: los dos índices únicos
 * parciales, la secuencia del consecutivo y que la baja suelte en la misma
 * transacción viven en la base.
 *
 * ⚠ Requiere la migración 0039 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[acciones-dispositivo] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[acciones-dispositivo] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `t${Date.now().toString(36)}`;
/** IMEI de mentira, únicos por corrida. El repositorio no valida el verificador: eso es del dominio. */
let serie = 0;
const imei = () => `9${Date.now().toString().slice(-10)}${String(++serie).padStart(4, "0")}`;

let carrierId = "";
let ajenoId = "";
let unidad1 = "";
let unidad2 = "";

beforeAll(async () => {
  carrierId = (await repos.accounts.create({ type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` })).id;
  ajenoId = (await repos.accounts.create({ type: "carrier", name: `Ajeno ${marca}`, slug: `ajeno-${marca}` })).id;
  unidad1 = (await repos.fleet.createUnit(carrierId, `U-${marca}-1`)).id;
  unidad2 = (await repos.fleet.createUnit(carrierId, `U-${marca}-2`)).id;
});

afterAll(async () => {
  // Borrar las cuentas arrastra unidades, dispositivos y asignaciones.
  await db.delete(accounts).where(inArray(accounts.id, [carrierId, ajenoId].filter(Boolean)));
});

async function alta(cuenta = carrierId, valor = imei()) {
  const r = await repos.fleet.darDeAltaDispositivo({ carrierAccountId: cuenta, imei: valor, prefijo: "TK-FTC927" });
  if (!r.ok) throw new Error(`alta falló: ${r.error}`);
  return r.dispositivo;
}

async function vigentes(where: { deviceId?: string; unitId?: string }) {
  return db
    .select()
    .from(deviceAssignments)
    .where(
      and(
        isNull(deviceAssignments.validTo),
        where.deviceId ? eq(deviceAssignments.deviceId, where.deviceId) : undefined,
        where.unitId ? eq(deviceAssignments.unitId, where.unitId) : undefined,
      ),
    );
}

function causaDe(error: unknown) {
  return (error as { cause?: { code?: string; constraint_name?: string } })?.cause;
}

describe("el alta nombra con el consecutivo global (6.3)", () => {
  it("dos altas seguidas: números consecutivos y el nombre sale de ese número", async () => {
    const a = await alta();
    const b = await alta();
    expect(b.consecutivo).toBe(a.consecutivo! + 1);
    expect(a.label).toBe(`TK-FTC927-${String(a.consecutivo).padStart(3, "0")}`);
  });

  it("un IMEI ya dado de alta: en la misma cuenta o en otra, no crea fila ni gasta número", async () => {
    const valor = imei();
    const primero = await alta(carrierId, valor);

    const misma = await repos.fleet.darDeAltaDispositivo({ carrierAccountId: carrierId, imei: valor, prefijo: "TK-FTC927" });
    expect(misma).toEqual({ ok: false, error: "imei_ya_en_la_cuenta" });
    const otra = await repos.fleet.darDeAltaDispositivo({ carrierAccountId: ajenoId, imei: valor, prefijo: "TK-FTC927" });
    expect(otra).toEqual({ ok: false, error: "imei_en_otra_cuenta" });

    expect(await db.select().from(devices).where(eq(devices.imei, valor))).toHaveLength(1);
    const siguiente = await alta();
    expect(siguiente.consecutivo).toBe(primero.consecutivo! + 1);
  });

  it("el índice único no deja repetir un consecutivo, aunque se escriba a mano", async () => {
    const a = await alta();
    let error: unknown = null;
    try {
      await db.insert(devices).values({ carrierAccountId: carrierId, imei: imei(), consecutivo: a.consecutivo });
    } catch (e) {
      error = e;
    }
    expect(causaDe(error)?.code).toBe("23505");
    expect(causaDe(error)?.constraint_name).toBe("devices_consecutivo_unico");
  });
});

describe("candados: una asignación vigente por dispositivo y por unidad", () => {
  it("la base rechaza un segundo dispositivo abierto en la misma unidad", async () => {
    const unidad = (await repos.fleet.createUnit(carrierId, `U-${marca}-candado-u`)).id;
    const a = await alta();
    const b = await alta();
    await repos.fleet.assignDevice(unidad, a.id, new Date());

    // Insert directo, sin el repositorio: quien defiende tiene que ser la BASE.
    let error: unknown = null;
    try {
      await db.insert(deviceAssignments).values({ unitId: unidad, deviceId: b.id, validFrom: new Date() });
    } catch (e) {
      error = e;
    }
    expect(causaDe(error)?.code).toBe("23505");
    expect(causaDe(error)?.constraint_name).toBe("device_assignments_unidad_una_vigente");
  });

  it("la base rechaza el mismo dispositivo abierto en dos unidades", async () => {
    const u1 = (await repos.fleet.createUnit(carrierId, `U-${marca}-candado-d1`)).id;
    const u2 = (await repos.fleet.createUnit(carrierId, `U-${marca}-candado-d2`)).id;
    const a = await alta();
    await repos.fleet.assignDevice(u1, a.id, new Date());

    let error: unknown = null;
    try {
      await db.insert(deviceAssignments).values({ unitId: u2, deviceId: a.id, validFrom: new Date() });
    } catch (e) {
      error = e;
    }
    expect(causaDe(error)?.code).toBe("23505");
    expect(causaDe(error)?.constraint_name).toBe("device_assignments_dispositivo_una_vigente");
  });
});

describe("asignar cierra lo que estorba, con quién y por qué", () => {
  it("mover un dispositivo a una unidad que ya traía otro: cierra los dos, abre uno", async () => {
    const a = await alta();
    const b = await alta();
    const t1 = new Date(Date.now() - 60_000);
    const t2 = new Date();
    await repos.fleet.assignDevice(unidad1, a.id, t1, "user_instalo");
    await repos.fleet.assignDevice(unidad2, b.id, t1, "user_instalo");

    // El `a` se va a la unidad 2, que traía al `b`.
    await repos.fleet.assignDevice(unidad2, a.id, t2, "user_movio");

    const todasDeA = await db.select().from(deviceAssignments).where(eq(deviceAssignments.deviceId, a.id));
    const cerradaA = todasDeA.find((x) => x.unitId === unidad1)!;
    expect(cerradaA.validTo).toEqual(t2);
    expect(cerradaA.cerradaPor).toBe("user_movio");
    expect(cerradaA.motivoCierre).toBe(`Se asignó a la unidad U-${marca}-2`);

    const [cerradaB] = await db.select().from(deviceAssignments).where(eq(deviceAssignments.deviceId, b.id));
    expect(cerradaB!.motivoCierre).toBe(`La unidad recibió el dispositivo ${a.label}`);

    const abierta = await vigentes({ unitId: unidad2 });
    expect(abierta).toHaveLength(1);
    expect(abierta[0]).toMatchObject({ deviceId: a.id, asignadaPor: "user_movio", cerradaPor: null, motivoCierre: null });
    expect(await vigentes({ unitId: unidad1 })).toHaveLength(0);
  });
});

describe("soltar y dar de baja", () => {
  it("soltar cierra la vigente con quién y motivo; soltar lo suelto devuelve null", async () => {
    const unidad = (await repos.fleet.createUnit(carrierId, `U-${marca}-soltar`)).id;
    const a = await alta();
    await repos.fleet.assignDevice(unidad, a.id, new Date(Date.now() - 60_000));

    const at = new Date();
    const cerrada = await repos.fleet.soltarDispositivo(a.id, { at, por: "user_taller", motivo: "entró a taller" });
    expect(cerrada).toMatchObject({ unitId: unidad, validTo: at, cerradaPor: "user_taller", motivoCierre: "entró a taller" });
    expect(await vigentes({ deviceId: a.id })).toHaveLength(0);

    expect(await repos.fleet.soltarDispositivo(a.id, { at, por: "user_taller", motivo: "otra vez" })).toBeNull();
  });

  it("la historia que lee Ver ‹dispositivo› trae quién abrió, quién cerró y por qué (C4-c)", async () => {
    const unidad = (await repos.fleet.createUnit(carrierId, `U-${marca}-historia`)).id;
    const a = await alta();
    await repos.fleet.assignDevice(unidad, a.id, new Date(Date.now() - 60_000), "user_instalo");
    await repos.fleet.soltarDispositivo(a.id, { at: new Date(), por: "user_taller", motivo: "entró a taller" });

    expect(await repos.expedientes.asignacionesDeDispositivo(carrierId, a.id)).toMatchObject([
      { unitId: unidad, asignadaPor: "user_instalo", cerradaPor: "user_taller", motivoCierre: "entró a taller" },
    ]);
  });

  it("la baja de uno montado lo suelta en la misma escritura, y la segunda baja no pisa el motivo", async () => {
    const unidad = (await repos.fleet.createUnit(carrierId, `U-${marca}-baja`)).id;
    const a = await alta();
    await repos.fleet.assignDevice(unidad, a.id, new Date(Date.now() - 60_000));

    const at = new Date();
    const r = await repos.fleet.darDeBajaDispositivo(a.id, { at, por: "user_admin", motivo: "se quemó" });
    expect(r?.dispositivo).toMatchObject({ retiredAt: at, retiredReason: "se quemó", retiredBy: "user_admin" });
    expect(r?.soltada).toMatchObject({ unitId: unidad, validTo: at, motivoCierre: "Baja del dispositivo: se quemó" });
    expect(await vigentes({ deviceId: a.id })).toHaveLength(0);

    expect(await repos.fleet.darDeBajaDispositivo(a.id, { at: new Date(), por: "otro", motivo: "segunda" })).toBeNull();
    const [fila] = await db.select().from(devices).where(eq(devices.id, a.id));
    expect(fila!.retiredReason).toBe("se quemó");
  });
});
