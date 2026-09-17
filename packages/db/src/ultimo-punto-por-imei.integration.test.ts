import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb, createRepositories, accounts, telemetryPoints } from "../src/index.js";
import { consultaUltimoPuntoPorImei } from "./ultimo-punto-por-imei.js";

/*
 * `ultimoPuntoPorImei` contra base de verdad.
 *
 * Estas pruebas ESCRIBEN, así que van contra `DATABASE_URL_TEST` —una rama
 * desechable de Neon— y nunca contra producción. El candado de abajo es el
 * mismo de `integration.test.ts` y falla antes de conectarse.
 *
 * Por qué contra base y no con dobles: el arreglo es la forma del SQL
 * (`unnest` + `LATERAL … LIMIT 1`), y un doble en memoria daría por buena
 * cualquier consulta. Lo que hay que probar es que esa forma, ejecutada por
 * Postgres, contesta lo mismo que contestaba el `max() … GROUP BY` de antes:
 * el más reciente de cada IMEI, sin importar el orden de inserción ni a qué
 * cuenta se archivó, y nada para los IMEIs sin historia.
 *
 * La velocidad no se prueba aquí —una rama de prueba con cien filas no tiene
 * nada que barrer—; se mide con `pnpm --filter @jtel/db medir-ultimo-punto-por-imei`.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[ultimo-punto-por-imei] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[ultimo-punto-por-imei] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `t${Date.now().toString(36)}`;
// IMEIs propios de esta corrida: el índice único (imei, recorded_at) es global.
const base = String(Date.now()).slice(-12);
const IMEI_A = `9${base}01`;
const IMEI_B = `9${base}02`;
const IMEI_SIN_HISTORIA = `9${base}03`;

let carrierId = "";
let otroCarrierId = "";

const t = (iso: string) => new Date(iso);

beforeAll(async () => {
  carrierId = (
    await repos.accounts.create({ type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` })
  ).id;
  otroCarrierId = (
    await repos.accounts.create({ type: "carrier", name: `Otro ${marca}`, slug: `otro-${marca}` })
  ).id;

  const punto = (carrier: string, imei: string, recordedAt: Date) => ({
    carrierAccountId: carrier,
    imei,
    latitude: 31.7,
    longitude: -106.4,
    recordedAt,
    source: "prueba",
  });

  // Insertados fuera de orden a propósito: el más reciente no es el último en
  // entrar, así que una consulta que dependiera del orden físico fallaría.
  await db.insert(telemetryPoints).values([
    punto(carrierId, IMEI_A, t("2026-09-10T08:00:00Z")),
    punto(carrierId, IMEI_A, t("2026-09-12T17:30:00Z")),
    punto(carrierId, IMEI_A, t("2026-09-11T09:00:00Z")),
    punto(carrierId, IMEI_B, t("2026-09-01T06:00:00Z")),
    // El más reciente de B se archivó en OTRA cuenta (el dispositivo cambió de
    // dueño): la última señal es la del dispositivo, no la de la cuenta.
    punto(otroCarrierId, IMEI_B, t("2026-09-14T22:15:00Z")),
  ]);
});

afterAll(async () => {
  // Borrar las cuentas arrastra en cascada sus puntos.
  await db.delete(accounts).where(inArray(accounts.id, [carrierId, otroCarrierId].filter(Boolean)));
});

describe("ultimoPuntoPorImei", () => {
  it("devuelve el punto más reciente de cada IMEI, sin importar orden de inserción ni cuenta", async () => {
    const r = await repos.telemetry.ultimoPuntoPorImei([IMEI_A, IMEI_B]);
    expect(r.get(IMEI_A)?.toISOString()).toBe("2026-09-12T17:30:00.000Z");
    expect(r.get(IMEI_B)?.toISOString()).toBe("2026-09-14T22:15:00.000Z");
    expect(r.get(IMEI_A)).toBeInstanceOf(Date);
  });

  it("un IMEI sin historia no aparece — «nunca reportó» es ausencia, no una fecha", async () => {
    const r = await repos.telemetry.ultimoPuntoPorImei([IMEI_A, IMEI_SIN_HISTORIA]);
    expect(r.has(IMEI_SIN_HISTORIA)).toBe(false);
    expect(r.size).toBe(1);
  });

  it("una lista vacía no consulta y devuelve un mapa vacío", async () => {
    expect((await repos.telemetry.ultimoPuntoPorImei([])).size).toBe(0);
  });

  it("un IMEI repetido en la lista no duplica ni rompe", async () => {
    const r = await repos.telemetry.ultimoPuntoPorImei([IMEI_A, IMEI_A, IMEI_B]);
    expect(r.size).toBe(2);
    expect(r.get(IMEI_A)?.toISOString()).toBe("2026-09-12T17:30:00.000Z");
  });

  it("contesta lo mismo que la forma vieja (max … GROUP BY)", async () => {
    const imeis = [IMEI_A, IMEI_B, IMEI_SIN_HISTORIA];
    const vieja = await db
      .select({ imei: telemetryPoints.imei, ultimo: sql<string>`max(${telemetryPoints.recordedAt})` })
      .from(telemetryPoints)
      .where(inArray(telemetryPoints.imei, imeis))
      .groupBy(telemetryPoints.imei);
    const nueva = await db.execute<{ imei: string; ultimo: Date | string }>(consultaUltimoPuntoPorImei(imeis));
    const aMapa = (filas: Iterable<{ imei: string; ultimo: Date | string }>) =>
      Object.fromEntries([...filas].map((f) => [f.imei, new Date(f.ultimo).toISOString()]));
    expect(aMapa(nueva)).toEqual(aMapa(vieja));
  });

  it("getForImeisDeCuenta: los puntos que el IMEI dejó en otra cuenta no se leen (el muro, no el IMEI)", async () => {
    const desde = t("2026-08-01T00:00:00Z");
    const hasta = t("2026-09-30T00:00:00Z");
    const deCarrier = await repos.telemetry.getForImeisDeCuenta(carrierId, [IMEI_B], desde, hasta);
    expect(deCarrier.map((p) => p.recordedAt.toISOString())).toEqual(["2026-09-01T06:00:00.000Z"]);
    const delOtro = await repos.telemetry.getForImeisDeCuenta(otroCarrierId, [IMEI_B], desde, hasta);
    expect(delOtro.map((p) => p.recordedAt.toISOString())).toEqual(["2026-09-14T22:15:00.000Z"]);
    // Y la lectura sin muro, la que queda para el motor, sí trae los dos.
    expect(await repos.telemetry.getForImeis([IMEI_B], desde, hasta)).toHaveLength(2);
  });

  it("la base de prueba tiene los puntos donde la prueba cree", async () => {
    // Guarda contra un falso verde: si el insert no hubiera llegado, las
    // pruebas de arriba de «no aparece» pasarían por la razón equivocada.
    const filas = await db.select().from(telemetryPoints).where(eq(telemetryPoints.imei, IMEI_A));
    expect(filas).toHaveLength(3);
  });
});
