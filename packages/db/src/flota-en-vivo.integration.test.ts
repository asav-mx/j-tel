import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  accounts,
  geofences,
  plants,
  routes,
  routeShifts,
  serviceContracts,
  serviceOccurrences,
  serviceProfiles,
  serviceProfileUnits,
  shifts,
  trips,
  units,
} from "../src/index.js";

/*
 * Las dos lecturas de Flota en vivo (C2), contra base de verdad.
 *
 * Estas pruebas ESCRIBEN, así que van contra `DATABASE_URL_TEST` —una rama
 * desechable de Neon— y nunca contra producción. Mismo candado que las demás.
 *
 * Por qué contra base: las dos son SQL con uniones y filtros que un doble en
 * memoria daría por buenos sin haberlos tocado.
 *
 *   · `especialesVigentesDeCarrier` — Marco 7.7: especial = unidad posible de
 *     un perfil con ocurrencia cuya VENTANA (la de `trips`, la del motor)
 *     incluye ahora; sólo contrato activo y cliente real.
 *   · `lugaresDeCarrier` — decisión 1: las geocercas propias del carrier y las
 *     de las plantas de sus contratos; no las de un contrato en borrador.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[flota-en-vivo] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[flota-en-vivo] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `t${Date.now().toString(36)}`;

const AHORA = new Date("2026-09-16T12:41:00Z"); // 06:41 en Juárez
const min = (n: number) => new Date(AHORA.getTime() + n * 60_000);
const cuadro = [
  { lat: 31.75, lng: -106.4 },
  { lat: 31.75, lng: -106.396 },
  { lat: 31.754, lng: -106.396 },
  { lat: 31.754, lng: -106.4 },
];

const ids = { cuentas: [] as string[] };
let carrierId = "";
let unidadEspecial = "";
let unidadVentanaCerrada = "";
let unidadClienteDemo = "";
let unidadContratoSuspendido = "";
let destinoId = "";
let baseId = "";
let destinoBorradorId = "";

async function montarContrato(opciones: {
  cliente: string;
  status: "active" | "draft" | "suspended";
  unidad: string;
  ventana: [Date, Date];
  sufijo: string;
}) {
  const [planta] = await db
    .insert(plants)
    .values({ clientAccountId: opciones.cliente, name: `Planta ${opciones.sufijo}`, code: `P-${marca}-${opciones.sufijo}` })
    .returning();
  const [cerca] = await db
    .insert(geofences)
    .values({
      ownerType: "plant",
      ownerPlantId: planta!.id,
      role: "destino",
      name: `Destino ${opciones.sufijo} ${marca}`,
      polygon: cuadro,
    })
    .returning();
  const [contrato] = await db
    .insert(serviceContracts)
    .values({
      carrierAccountId: carrierId,
      clientAccountId: opciones.cliente,
      plantId: planta!.id,
      name: `Contrato ${opciones.sufijo} ${marca}`,
      status: opciones.status,
      validFrom: "2026-01-01",
      validTo: "2027-12-31",
      policy: {} as never,
    })
    .returning();
  const [ruta] = await db
    .insert(routes)
    .values({ clientAccountId: opciones.cliente, plantId: planta!.id, name: `Ruta ${opciones.sufijo}` })
    .returning();
  const [turno] = await db
    .insert(shifts)
    .values({ clientAccountId: opciones.cliente, plantId: planta!.id, name: `Turno ${opciones.sufijo}`, startTime: "07:00" })
    .returning();
  const [rs] = await db
    .insert(routeShifts)
    .values({ clientAccountId: opciones.cliente, plantId: planta!.id, routeId: ruta!.id, shiftId: turno!.id })
    .returning();
  const [perfil] = await db
    .insert(serviceProfiles)
    .values({
      contractId: contrato!.id,
      routeShiftId: rs!.id,
      geofenceId: cerca!.id,
      name: `Perfil ${opciones.sufijo}`,
      code: `PF-${marca}-${opciones.sufijo}`,
    })
    .returning();
  await db.insert(serviceProfileUnits).values({ serviceProfileId: perfil!.id, unitId: opciones.unidad });
  const [ocurrencia] = await db
    .insert(serviceOccurrences)
    .values({
      serviceProfileId: perfil!.id,
      contractId: contrato!.id,
      routeShiftId: rs!.id,
      serviceDate: "2026-09-16",
      expectedDeadline: min(4),
      expectedGeofenceId: cerca!.id,
    })
    .returning();
  await db.insert(trips).values({
    serviceOccurrenceId: ocurrencia!.id,
    evidenceWindowStart: opciones.ventana[0],
    evidenceWindowEnd: opciones.ventana[1],
  });
  return { destinoId: cerca!.id, ocurrenciaId: ocurrencia!.id };
}

beforeAll(async () => {
  const carrier = await repos.accounts.create({ type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` });
  const cliente = await repos.accounts.create({ type: "client", name: `Cliente ${marca}`, slug: `cliente-${marca}` });
  const clienteDemo = await repos.accounts.create({
    type: "client",
    name: `Demo ${marca}`,
    slug: `demo-${marca}`,
    isDemo: true,
  });
  carrierId = carrier.id;
  ids.cuentas.push(carrier.id, cliente.id, clienteDemo.id);

  const unidad = async (label: string) =>
    (await db.insert(units).values({ carrierAccountId: carrierId, label: `${label}-${marca}` }).returning())[0]!.id;
  unidadEspecial = await unidad("6284");
  unidadVentanaCerrada = await unidad("9385");
  unidadClienteDemo = await unidad("7001");
  unidadContratoSuspendido = await unidad("7002");

  // Vigente ahora: ventana 05:30–07:30 alrededor de las 06:41.
  destinoId = (await montarContrato({ cliente: cliente.id, status: "active", unidad: unidadEspecial, ventana: [min(-71), min(49)], sufijo: "a" })).destinoId;
  // La ventana ya cerró hace 10 min: no es servicio vigente.
  await montarContrato({ cliente: cliente.id, status: "active", unidad: unidadVentanaCerrada, ventana: [min(-120), min(-10)], sufijo: "b" });
  // Cliente de ejemplo: no se sella, no hay qué proteger.
  await montarContrato({ cliente: clienteDemo.id, status: "active", unidad: unidadClienteDemo, ventana: [min(-30), min(30)], sufijo: "c" });
  // Contrato suspendido: tampoco.
  await montarContrato({ cliente: cliente.id, status: "suspended", unidad: unidadContratoSuspendido, ventana: [min(-30), min(30)], sufijo: "d" });
  // Un contrato en borrador: su geocerca no es de la flota todavía.
  destinoBorradorId = (await montarContrato({ cliente: cliente.id, status: "draft", unidad: unidadEspecial, ventana: [min(-600), min(-500)], sufijo: "e" })).destinoId;

  const [base] = await db
    .insert(geofences)
    .values({ ownerType: "carrier", ownerCarrierAccountId: carrierId, role: "base", name: `Base ${marca}`, polygon: cuadro })
    .returning();
  baseId = base!.id;
});

afterAll(async () => {
  // Las cuentas arrastran en cascada plantas, geocercas, contratos, perfiles, ocurrencias, viajes y unidades.
  if (ids.cuentas.length) await db.delete(accounts).where(inArray(accounts.id, ids.cuentas));
});

describe("especialesVigentesDeCarrier (Marco 7.7)", () => {
  it("sólo la unidad con ocurrencia cuya ventana incluye ahora, de contrato activo y cliente real", async () => {
    const filas = await repos.occurrences.especialesVigentesDeCarrier(carrierId, AHORA);
    expect(filas.map((f) => f.unitId)).toEqual([unidadEspecial]);
    expect(filas[0]).toMatchObject({ expectedGeofenceId: destinoId, ventanaDesde: min(-71), ventanaHasta: min(49) });
  });

  it("los bordes de la ventana cuentan: en su último instante sigue vigente, un minuto después no", async () => {
    expect((await repos.occurrences.especialesVigentesDeCarrier(carrierId, min(49))).map((f) => f.unitId)).toEqual([unidadEspecial]);
    expect(await repos.occurrences.especialesVigentesDeCarrier(carrierId, min(50))).toEqual([]);
  });

  it("de otro carrier no ve nada", async () => {
    expect(await repos.occurrences.especialesVigentesDeCarrier(ids.cuentas[1]!, AHORA)).toEqual([]);
  });
});

describe("lugaresDeCarrier (decisión 1)", () => {
  it("las propias del carrier y las de las plantas de sus contratos; no las de un contrato en borrador", async () => {
    const lugares = await repos.geofences.lugaresDeCarrier(carrierId);
    const idsDeLugares = lugares.map((l) => l.id);
    expect(idsDeLugares).toContain(destinoId);
    expect(idsDeLugares).toContain(baseId);
    expect(idsDeLugares).not.toContain(destinoBorradorId);
    expect(lugares.find((l) => l.id === baseId)).toMatchObject({ role: "base", polygon: cuadro });
    // a, b, c, d (activos, demo y suspendido siguen siendo contratos, no borradores) + la base.
    expect(lugares).toHaveLength(5);
  });
});
