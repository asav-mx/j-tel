import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, telemetryPoints } from "@jtel/db";
import { compararPasosDeParada } from "./comparar-pasos-por-parada.js";

/*
 * La comparación banda contra banda, contra base de verdad y DATOS SEMBRADOS
 * — decisiones de Asav del 20-sep: la ventana se ancla al paso ANTERIOR, la
 * tolerancia es porcentaje de la frecuencia, y el primer paso del día se
 * compara contra la apertura declarada.
 *
 * ESCRIBEN, así que van contra `DATABASE_URL_TEST` — una rama desechable de
 * Neon — y nunca contra producción. Mismo candado que el resto de la casa.
 *
 * ⚠ Requiere las migraciones 0025–0046 aplicadas en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[comparar-pasos-por-parada] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[comparar-pasos-por-parada] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `cp${Date.now().toString(36)}`;

const TRAZADO: Array<[number, number]> = [
  [-106.46, 31.72],
  [-106.4515, 31.72],
];

function puntoSobreElTrazado(metros: number): { lat: number; lon: number } {
  const metrosPorGradoLon = 111_412.84 * Math.cos((31.72 * Math.PI) / 180);
  return { lat: 31.72, lon: -106.46 + metros / metrosPorGradoLon };
}

let concesionId = "";
let carrierId = "";
let circuitoId = "";
let unidadId = "";
let stopId = "";
let base = new Date();
const idsDePuntosSembrados: string[] = [];

/*
 * El horario y las fechas se anclan a HOY (no a un día fijo del calendario):
 * la comparación necesita que "hoy" en la zona del circuito sea el mismo día
 * civil que los pasos sembrados, o el primer paso del día se compararía
 * contra la apertura del día equivocado. Se arma con new Date() más un
 * desplazamiento de horas, y se limpia todo al final.
 */
beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA de CV`,
  });
  concesionId = cuenta.id;

  const carrier = await repos.accounts.create({
    type: "carrier",
    name: `Transportista ${marca}`,
    slug: `transportista-${marca}`,
  });
  carrierId = carrier.id;

  const circuito = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
    corridorToleranceMeters: 150,
    serviceStartLocal: "05:00",
    serviceEndLocal: "23:00",
    timeZone: "America/Ciudad_Juarez",
    arrivalTolerancePct: 50,
  });
  circuitoId = circuito!.id;

  await repos.circuits.upsertPath({
    circuitId: circuitoId,
    sentido: "ida",
    coordinates: TRAZADO,
    pointCount: TRAZADO.length,
    lengthMeters: 803,
  });

  const stop = await repos.circuits.createStop({
    circuitId: circuitoId,
    qrSlug: `stop-${marca}`,
    name: "Parada única",
    orden: 1,
    latitude: 31.72,
    longitude: puntoSobreElTrazado(400).lon,
  });
  stopId = stop.identidad.id;

  const promesa = await repos.circuits.savePromiseTable(circuitoId, [
    { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 },
    { diaTipo: "sabado", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 },
    { diaTipo: "domingo", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 },
  ]);
  expect(promesa.ok).toBe(true);

  unidadId = (await repos.fleet.createUnit(carrierId, `U-${marca}`)).id;

  /*
   * Tres pasadas por la parada, todas hoy, dentro de la franja de las 6-9
   * cada 10 min:
   *   1) las 06:03 — el primer paso del día, contra la apertura de las 05:00.
   *      Ancla 05:00 + 10 = 05:10, ±50% = [05:05, 05:15]. 06:03 cae ENTERO
   *      fuera → se_agujero (el camión sí anda, pero muy tarde para ser "el
   *      primero esperado a los 10 min de abrir" — es la consecuencia
   *      correcta de anclar al ancla real, no de forzar el ejemplo).
   *   2) las 06:13 — 10 min después de la 1: ventana [06:08, 06:18] → sostuvo.
   *   3) las 06:35 — 22 min después de la 2: ventana [06:18, 06:28] entera
   *      antes → se_agujero.
   */
  const ahoraLocal = new Date();
  base = new Date(
    Date.UTC(ahoraLocal.getUTCFullYear(), ahoraLocal.getUTCMonth(), ahoraLocal.getUTCDate(), 12, 3, 0),
  ); // ~06:03 en Juárez (UTC-6), cualquier fecha en que corra esta prueba.

  const minutosDeCadaPunto = [0, 1, 10, 11, 32, 33];
  for (const m of minutosDeCadaPunto) {
    const { lat, lon } = puntoSobreElTrazado(m % 2 === 0 ? 300 : 500); // antes/después de la parada (400 m)
    const [fila] = await db
      .insert(telemetryPoints)
      .values({
        carrierAccountId: carrierId,
        unitId: unidadId,
        imei: `imei-${marca}`,
        latitude: lat,
        longitude: lon,
        recordedAt: new Date(base.getTime() + m * 60_000),
        source: "traccar",
      })
      .returning();
    idsDePuntosSembrados.push(fila!.id);
  }
});

afterAll(async () => {
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.id, idsDePuntosSembrados));
  await db.delete(accounts).where(inArray(accounts.id, [concesionId, carrierId].filter(Boolean)));
});

describe("compararPasosDeParada · contra datos sembrados", () => {
  it("el primero del día contra la apertura, y los siguientes contra el anterior", async () => {
    await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date(base.getTime() - 30 * 60_000),
      hasta: new Date(base.getTime() + 60 * 60_000),
      detectorVersion: "v1-comparacion",
    });

    const resultados = await compararPasosDeParada(repos, {
      circuitId: circuitoId,
      stopId,
      sentido: "ida",
      detectorVersion: "v1-comparacion",
    });

    expect(resultados).toHaveLength(3);
    expect(resultados[0]!.veredicto).toBe("se_agujero"); // contra la apertura, muy tarde.
    expect(resultados[1]!.veredicto).toBe("sostuvo"); // 10 min después del anterior.
    expect(resultados[2]!.veredicto).toBe("se_agujero"); // 22 min después, fuera de ±50% de 10.
  });
});
