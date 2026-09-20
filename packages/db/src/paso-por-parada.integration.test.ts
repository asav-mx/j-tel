import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  accounts,
  telemetryPoints,
  circuitStopPasses,
} from "../src/index.js";

/*
 * El detector de pasos por parada, contra base de verdad y DATOS SEMBRADOS —
 * no contra la captura real de Oasis–Centro, que Asav todavía no hace (pidió
 * expresamente construir sin esperarla, 20-sep).
 *
 * ESCRIBEN, así que van contra `DATABASE_URL_TEST` — una rama desechable de
 * Neon — y nunca contra producción. Mismo candado que el resto de la casa.
 *
 * ⚠ Requiere las migraciones 0025–0045 aplicadas en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[paso-por-parada] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[paso-por-parada] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `pp${Date.now().toString(36)}`;

/*
 * El trazado sembrado: una recta de ~1 km sobre Juárez — no hace falta un
 * trazado real para probar la geometría, sólo uno con longitud y dirección
 * conocidas, como ya hace `franja-horaria.test.ts` con las horas.
 */
const TRAZADO: Array<[number, number]> = [
  [-106.46, 31.72],
  [-106.4515, 31.72], // ~803 m más al este, en el paralelo 31.72 (~93.5 m por 0.001° de lon)
];

/** Un punto sobre el trazado, a X metros del inicio, avanzando hacia el este. */
function puntoSobreElTrazado(metros: number): { lat: number; lon: number } {
  const metrosPorGradoLon = 111_412.84 * Math.cos((31.72 * Math.PI) / 180);
  return { lat: 31.72, lon: -106.46 + metros / metrosPorGradoLon };
}

let concesionId = "";
let carrierId = "";
let circuitoId = "";
let unidadId = "";
let stopA = { stopId: "", stopVersionId: "" };
let stopB = { stopId: "", stopVersionId: "" };
const imeiSembrado = `imei-${marca}`;
const idsDePuntosSembrados: string[] = [];

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
  });
  circuitoId = circuito!.id;

  await repos.circuits.upsertPath({
    circuitId: circuitoId,
    sentido: "ida",
    coordinates: TRAZADO,
    pointCount: TRAZADO.length,
    lengthMeters: 803,
  });

  const a = await repos.circuits.createStop({
    circuitId: circuitoId,
    qrSlug: `stop-a-${marca}`,
    name: "Parada A",
    orden: 1,
    latitude: 31.72,
    longitude: puntoSobreElTrazado(200).lon,
  });
  stopA = { stopId: a.identidad.id, stopVersionId: a.version.id };

  const b = await repos.circuits.createStop({
    circuitId: circuitoId,
    qrSlug: `stop-b-${marca}`,
    name: "Parada B",
    orden: 2,
    latitude: 31.72,
    longitude: puntoSobreElTrazado(600).lon,
  });
  stopB = { stopId: b.identidad.id, stopVersionId: b.version.id };

  unidadId = (await repos.fleet.createUnit(carrierId, `U-${marca}`)).id;

  /*
   * El recorrido sembrado, con la trampa a propósito: un hueco de 40 minutos
   * entre el km 100 y el km 700 — que se traga la Parada A (200 m) Y la
   * Parada B (600 m) en un solo intervalo. Es la prueba central del Marco:
   * el cruce no se las salta, aunque el hueco sea enorme.
   */
  const base = new Date("2026-09-20T13:00:00Z"); // 07:00 local Juárez, entre semana.
  const puntosASembrar = [
    { metros: 0, minutos: 0 },
    { metros: 100, minutos: 1 },
    { metros: 700, minutos: 41 }, // el hueco de 40 minutos.
    { metros: 803, minutos: 42 },
  ];

  for (const p of puntosASembrar) {
    const { lat, lon } = puntoSobreElTrazado(p.metros);
    const [fila] = await db
      .insert(telemetryPoints)
      .values({
        carrierAccountId: carrierId,
        unitId: unidadId,
        imei: imeiSembrado,
        latitude: lat,
        longitude: lon,
        recordedAt: new Date(base.getTime() + p.minutos * 60_000),
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

describe("detectarYGuardar · el detector completo, contra datos sembrados", () => {
  it("detecta las dos paradas aunque un solo hueco de 40 min se las trague enteras", async () => {
    const guardados = await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2026-09-20T12:59:00Z"),
      hasta: new Date("2026-09-20T13:50:00Z"),
      detectorVersion: "v1-cruce",
    });

    expect(guardados).toHaveLength(2);

    const porParada = new Map(guardados.map((g) => [g.stopId, g]));
    const pasoA = porParada.get(stopA.stopId)!;
    const pasoB = porParada.get(stopB.stopId)!;

    expect(pasoA).toBeDefined();
    expect(pasoB).toBeDefined();

    // Las dos vienen del MISMO intervalo — el del hueco de 40 min — porque
    // las dos caen entre el punto de los 100 m y el de los 700 m.
    expect(pasoA.pasoDesde).toEqual(new Date("2026-09-20T13:01:00Z"));
    expect(pasoA.pasoHasta).toEqual(new Date("2026-09-20T13:41:00Z"));
    expect(pasoA.huecoSegundos).toBe(40 * 60);
    expect(pasoB.pasoDesde).toEqual(pasoA.pasoDesde);
    expect(pasoB.pasoHasta).toEqual(pasoA.pasoHasta);

    expect(pasoA.stopVersionId).toBe(stopA.stopVersionId);
    expect(pasoA.detectorVersion).toBe("v1-cruce");
    expect(pasoA.pingPrevioId).not.toBeNull();
    expect(pasoA.pingSiguienteId).not.toBeNull();
  });

  it("listarPasosDeParada devuelve lo guardado, ordenado por paso_desde", async () => {
    const pasos = await repos.pasosPorParada.listarPasosDeParada(stopA.stopId);
    expect(pasos.length).toBeGreaterThanOrEqual(1);
    expect(pasos[0]!.stopId).toBe(stopA.stopId);
  });

  it("apilar, no pisar: una segunda corrida con otra detectorVersion no borra la primera", async () => {
    const antes = await repos.pasosPorParada.listarPasosDeParada(stopA.stopId);

    await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2026-09-20T12:59:00Z"),
      hasta: new Date("2026-09-20T13:50:00Z"),
      detectorVersion: "v2-corregido",
    });

    const despues = await repos.pasosPorParada.listarPasosDeParada(stopA.stopId);
    expect(despues.length).toBe(antes.length + 1);
    expect(despues.map((p) => p.detectorVersion).sort()).toEqual(["v1-cruce", "v2-corregido"]);

    // limpieza de lo que insertó esta prueba, para no ensuciar la corrida anterior
    await db.delete(circuitStopPasses).where(eq(circuitStopPasses.detectorVersion, "v2-corregido"));
  });

  it("una ventana sin ningún punto no detecta nada, y no truena", async () => {
    const guardados = await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2020-01-01T00:00:00Z"),
      hasta: new Date("2020-01-01T01:00:00Z"),
      detectorVersion: "v1-cruce",
    });
    expect(guardados).toHaveLength(0);
  });

  it("el CHECK de la base rechaza un rango invertido (paso_hasta < paso_desde)", async () => {
    await expect(
      db.insert(circuitStopPasses).values({
        circuitId: circuitoId,
        stopId: stopA.stopId,
        stopVersionId: stopA.stopVersionId,
        unitId: unidadId,
        sentido: "ida",
        pasoDesde: new Date("2026-09-20T13:10:00Z"),
        pasoHasta: new Date("2026-09-20T13:00:00Z"),
        huecoSegundos: -600,
        detectorVersion: "prueba-del-check",
      }),
    ).rejects.toThrow();
  });
});
