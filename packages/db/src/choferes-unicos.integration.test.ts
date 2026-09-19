import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  accounts,
  documentTypes,
  documentVersions,
  documents,
  driverCredentials,
  drivers,
  markets,
} from "../src/index.js";

/*
 * El chofer tiene un solo nombre y una sola licencia por cuenta (Choferes V1,
 * 0042), contra base de verdad.
 *
 * ESCRIBEN: van contra `DATABASE_URL_TEST`, una rama desechable de Neon, nunca
 * contra producción. El candado de abajo es el mismo de las otras suites.
 *
 * El código revisa el choque antes y lo dice en palabras (`choqueDeChofer`,
 * `acciones-chofer.ts`). Aquí se prueba la otra mitad: que **la base lo
 * rechaza aunque alguien se salte el código**, y que el alta es **todo o nada**
 * —el chofer, sus credenciales y su «Licencia» nacen juntos—.
 *
 * ⚠ Requiere la migración 0042 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[choferes-unicos] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[choferes-unicos] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `ch${Date.now().toString(36)}`;
const ACTOR = { kind: "prueba", id: marca };

let carrierId = "";
let ajenoId = "";
let mercadoId = "";
let licenciaId = "";

/** El código Postgres de un rechazo, venga directo o envuelto por el driver. */
function codigo(e: unknown): string | undefined {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}

async function credencialCruda(carrier: string, nombre: string, licencia: string) {
  const [chofer] = await db.insert(drivers).values({ carrierAccountId: carrier }).returning();
  await db.insert(driverCredentials).values({ driverId: chofer!.id, carrierAccountId: carrier, fullName: nombre, licenseNumber: licencia });
  return chofer!.id;
}

beforeAll(async () => {
  const [mercado] = await db
    .insert(markets)
    // La clave del estado es de 1 a 3 letras o números (0038); el país «ZZ» no choca con ningún mercado de verdad.
    .values({ countryCode: "ZZ", stateCode: marca.slice(-3).toUpperCase(), name: `Mercado ${marca}`, timeZone: "America/Ciudad_Juarez" })
    .returning();
  mercadoId = mercado!.id;
  const [tipo] = await db.insert(documentTypes).values({ marketId: mercadoId, subject: "chofer", clave: "licencia", name: "Licencia" }).returning();
  licenciaId = tipo!.id;
  carrierId = (await repos.accounts.create({ type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` })).id;
  ajenoId = (await repos.accounts.create({ type: "carrier", name: `Ajeno ${marca}`, slug: `ajeno-${marca}` })).id;
  await db.update(accounts).set({ marketId: mercadoId }).where(inArray(accounts.id, [carrierId, ajenoId]));
});

afterAll(async () => {
  // Borrar las cuentas arrastra choferes, credenciales y papeles; luego el catálogo.
  await db.delete(accounts).where(inArray(accounts.id, [carrierId, ajenoId]));
  await db.delete(documentTypes).where(eq(documentTypes.marketId, mercadoId));
  await db.delete(markets).where(eq(markets.id, mercadoId));
});

describe("el candado de la base (0042)", () => {
  it("rechaza un nombre repetido en la cuenta, sin mayúsculas ni espacios de más", async () => {
    await credencialCruda(carrierId, "Ramón Medina", "CHIH-1");
    await expect(credencialCruda(carrierId, "  ramón   MEDINA ", "CHIH-2")).rejects.toSatisfy((e) => codigo(e) === "23505");
  });

  it("rechaza una licencia repetida en la cuenta, sin guiones, espacios ni mayúsculas", async () => {
    await credencialCruda(carrierId, "Ana Ruiz", "CHIH-555 01");
    await expect(credencialCruda(carrierId, "Otra Persona", "chih55501")).rejects.toSatisfy((e) => codigo(e) === "23505");
  });

  it("el mismo nombre y la misma licencia en OTRA cuenta sí caben: son únicos por cuenta", async () => {
    await expect(credencialCruda(ajenoId, "Ramón Medina", "CHIH-1")).resolves.toBeTypeOf("string");
  });

  it("una credencial no puede decir que es de otra cuenta que su chofer (llave compuesta)", async () => {
    const [chofer] = await db.insert(drivers).values({ carrierAccountId: carrierId }).returning();
    await expect(
      db.insert(driverCredentials).values({ driverId: chofer!.id, carrierAccountId: ajenoId, fullName: "Cruzado", licenseNumber: "X-9" }),
    ).rejects.toSatisfy((e) => codigo(e) === "23503");
  });
});

describe("el alta del chofer es todo o nada", () => {
  it("nace con su «Licencia»: el número de folio y el vencimiento como papel, no en las credenciales", async () => {
    const chofer = await repos.expedientes.darDeAltaChofer({
      carrierAccountId: carrierId,
      nombre: "Luis Soto",
      licencia: "CHIH-777",
      papelDeLicencia: { documentTypeId: licenciaId, venceEl: "2027-03-31" },
      actor: ACTOR,
    });
    const [cred] = await db.select().from(driverCredentials).where(eq(driverCredentials.driverId, chofer.id));
    expect(cred).toMatchObject({ fullName: "Luis Soto", licenseNumber: "CHIH-777", licenseExpiresOn: null, carrierAccountId: carrierId });
    const fojas = await repos.expedientes.fojasDeSujeto(carrierId, { choferId: chofer.id });
    expect(fojas).toHaveLength(1);
    expect(fojas[0]!.versiones[0]).toMatchObject({ folio: "CHIH-777", expiresOn: "2027-03-31" });
  });

  it("si el papel no se puede capturar, el chofer tampoco nace", async () => {
    const antes = await db.select().from(drivers).where(eq(drivers.carrierAccountId, carrierId));
    // Un tipo de papel que no es del catálogo: la captura falla dentro de la transacción.
    await expect(
      repos.expedientes.darDeAltaChofer({
        carrierAccountId: carrierId,
        nombre: "Nadie Nace",
        licencia: "CHIH-000",
        papelDeLicencia: { documentTypeId: "00000000-0000-4000-8000-000000000000", venceEl: null },
        actor: ACTOR,
      }),
    ).rejects.toThrow();
    const despues = await db.select().from(drivers).where(eq(drivers.carrierAccountId, carrierId));
    expect(despues).toHaveLength(antes.length);
    const [sinNacer] = await db.select().from(driverCredentials).where(and(eq(driverCredentials.carrierAccountId, carrierId), eq(driverCredentials.fullName, "Nadie Nace")));
    expect(sinNacer).toBeUndefined();
  });

  it("corregir el número corrige también el folio de su «Licencia», con una versión nueva y las mismas fechas", async () => {
    const chofer = await repos.expedientes.darDeAltaChofer({
      carrierAccountId: carrierId,
      nombre: "Mara Gil",
      licencia: "CHIH-100",
      papelDeLicencia: { documentTypeId: licenciaId, venceEl: "2027-01-15" },
      actor: ACTOR,
    });
    const fila = await repos.expedientes.corregirChofer(carrierId, chofer.id, { nombre: "Mara Gil", licencia: "CHIH-101" }, { documentTypeId: licenciaId }, ACTOR);
    expect(fila).toMatchObject({ licenseNumber: "CHIH-101" });
    const [foja] = await db.select().from(documents).where(eq(documents.driverId, chofer.id));
    const versiones = await db.select().from(documentVersions).where(eq(documentVersions.documentId, foja!.id));
    expect(versiones.map((v) => v.folio).sort()).toEqual(["CHIH-100", "CHIH-101"]);
    expect(versiones.every((v) => v.expiresOn === "2027-01-15")).toBe(true);
  });

  it("un chofer de otra cuenta no se corrige desde ésta", async () => {
    const ajeno = await credencialCruda(ajenoId, "Del Otro Lado", "OTRA-1");
    expect(await repos.expedientes.corregirChofer(carrierId, ajeno, { nombre: "X", licencia: "Y" }, null, ACTOR)).toBeNull();
  });
});
