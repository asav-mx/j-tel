import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, telemetryPoints } from "@jtel/db";
import { ResumenDeRecorridosService } from "./resumen-de-recorridos.js";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/*
 * El resumen de recorridos (0053; 8.16.5) contra la rama desechable: de pasos
 * de verdad a la tabla que lee el pasajero, y lo que ESA tabla NO tiene.
 *
 * ⚠ Requiere la 0053 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) throw new Error("[resumen-de-recorridos] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[resumen-de-recorridos] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `rc${Date.now().toString(36)}`;

let concesionId = "";
let carrierId = "";
let circuitoId = "";
let unidadId = "";
const paradas: Array<{ id: string; versionId: string; qrSlug: string }> = [];
const puntos: string[] = [];
const T0 = new Date(Date.now() - 3 * 86_400_000);

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA`,
  });
  concesionId = cuenta.id;
  carrierId = (await repos.accounts.create({ name: `Carrier ${marca}`, slug: `carrier-${marca}`, type: "carrier" })).id;

  const circuito = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
  });
  circuitoId = circuito!.id;
  await repos.circuits.setCircuitPublished(circuitoId, true);

  for (const [i, nombre] of ["A", "B"].entries()) {
    const stop = await repos.circuits.createStop({
      circuitId: circuitoId,
      qrSlug: `${marca}-${nombre.toLowerCase()}`,
      name: `Parada ${nombre}`,
      orden: i + 1,
      latitude: 31.72 + i * 0.01,
      longitude: -106.45,
      sentido: "ida",
    });
    paradas.push({ id: stop.identidad.id, versionId: stop.version.id, qrSlug: `${marca}-${nombre.toLowerCase()}` });
  }

  unidadId = (await repos.fleet.createUnit(carrierId, `U-${marca}`)).id;

  // Dos pings de mentira, sólo para que los pasos tengan a qué colgar su evidencia.
  for (const m of [0, 1]) {
    const [fila] = await db
      .insert(telemetryPoints)
      .values({
        carrierAccountId: carrierId,
        unitId: unidadId,
        imei: `imei-${marca}`,
        latitude: 31.72,
        longitude: -106.45,
        recordedAt: new Date(T0.getTime() + m * 60_000),
        source: "traccar",
      })
      .returning();
    puntos.push(fila!.id);
  }

  // Diez travesías A→B de 300 s: la del medio, atorada 30 min, para ver que no estira el techo.
  for (let i = 0; i < 10; i++) {
    const arranque = T0.getTime() + i * 3_600_000;
    const duracion = i === 5 ? 1_800_000 : 300_000;
    await repos.pasosPorParada.guardarPasos(
      [
        {
          stopId: paradas[0]!.id,
          stopVersionId: paradas[0]!.versionId,
          pasoDesde: new Date(arranque),
          pasoHasta: new Date(arranque + 20_000),
          huecoSegundos: 20,
          pingPrevioId: puntos[0]!,
          pingSiguienteId: puntos[1]!,
        },
        {
          stopId: paradas[1]!.id,
          stopVersionId: paradas[1]!.versionId,
          pasoDesde: new Date(arranque + 20_000 + duracion),
          pasoHasta: new Date(arranque + 40_000 + duracion),
          huecoSegundos: 20,
          pingPrevioId: puntos[0]!,
          pingSiguienteId: puntos[1]!,
        },
      ],
      { circuitId: circuitoId, unitId: unidadId, sentido: "ida", detectorVersion: VERSION_DEL_DETECTOR },
    );
  }
});

afterAll(async () => {
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.id, puntos));
  await db.delete(accounts).where(inArray(accounts.id, [concesionId, carrierId].filter(Boolean)));
});

const mios = async () => (await repos.circuits.recorridosPublicados()).filter((r) => r.ruta === `circuito-${marca}`);

describe("de los pasos del detector al resumen que lee el pasajero", () => {
  it("una corrida escribe el tramo, con sus travesías y su rango", async () => {
    const ronda = await new ResumenDeRecorridosService(repos).correr();
    expect(ronda.pasos).toBeGreaterThanOrEqual(20);
    const filas = await mios();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      sentido: "ida",
      de: paradas[0]!.qrSlug,
      a: paradas[1]!.qrSlug,
      travesias: 10,
    });
    expect(filas[0]!.desdeSeg).toBe(300);
    // La travesía atorada de 30 min no estira el techo publicado (p75).
    expect(filas[0]!.hastaSeg).toBeLessThan(600);
  });

  it("dos corridas no duplican el tramo: reemplaza, no acumula", async () => {
    await new ResumenDeRecorridosService(repos).correr();
    await new ResumenDeRecorridosService(repos).correr();
    expect(await mios()).toHaveLength(1);
  });

  it("lo que el pasajero recibe no trae unidad ni transportista: la tabla no los tiene", async () => {
    const filas = await mios();
    expect(Object.keys(filas[0]!).sort()).toEqual([
      "a",
      "de",
      "desdeSeg",
      "hastaSeg",
      "medianaSeg",
      "ruta",
      "sentido",
      "travesias",
      "ventanaHasta",
    ]);
    expect(JSON.stringify(filas)).not.toMatch(new RegExp(`${unidadId}|${carrierId}`));
  });

  it("simular no escribe: si se borra el resumen, sigue vacío", async () => {
    await repos.circuits.guardarRecorridos(circuitoId, []);
    const ronda = await new ResumenDeRecorridosService(repos).correr({ simular: true });
    expect(ronda.tramos).toBe(1);
    expect(ronda.escritos).toBe(0);
    expect(await mios()).toEqual([]);
  });
});
