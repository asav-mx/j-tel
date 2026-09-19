import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { contractPolicySchema } from "@jtel/domain";
import {
  accounts,
  complianceFactHistory,
  complianceFacts,
  contractVerificationEvents,
  createDb,
  createRepositories,
  geofences,
  plants,
  routeShifts,
  routes,
  serviceContracts,
  serviceOccurrences,
  serviceProfiles,
  shifts,
  trips,
} from "../src/index.js";

/*
 * La pausa de la verificación (0041), contra base de verdad.
 *
 * ESCRIBE: va contra `DATABASE_URL_TEST` —la rama desechable— y nunca contra
 * producción. Lo que se ejerce aquí no se puede con dobles: la SQL de la cola
 * del motor, el borrado dentro de la transacción de la pausa, que la
 * generación no invente lo que cae en pausa, y los triggers de la 0041.
 *
 * ⚠ Requiere la migración 0041 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) throw new Error("[pausa] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) throw new Error("[pausa] DATABASE_URL_TEST es producción: estas pruebas escriben.");

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `t${Date.now().toString(36)}`;
const DIA = 86_400_000;
const AHORA = new Date();
/** Medianoche UTC de hace `n` días más seis horas: medianoche en Juárez (UTC-6 en septiembre). */
const hace = (n: number, hh = 0) => new Date(Date.UTC(AHORA.getUTCFullYear(), AHORA.getUTCMonth(), AHORA.getUTCDate()) - n * DIA + (6 + hh) * 3_600_000);
const fecha = (d: Date) => new Date(d.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);

const ids = { carrier: "", cliente: "", contrato: "", perfil: "", rs: "" };
const occ: Record<string, string> = {};
const PAUSA_DESDE = hace(14);

async function ocurrencia(nombre: string, dia: Date, extra: { hecho?: "cumplido" | "pendiente_evidencia"; historia?: boolean; indisponible?: boolean } = {}) {
  const deadline = new Date(dia.getTime() + 12 * 3_600_000 + 45 * 60_000);
  const [o] = await db
    .insert(serviceOccurrences)
    .values({
      serviceProfileId: ids.perfil,
      contractId: ids.contrato,
      routeShiftId: ids.rs,
      serviceDate: fecha(dia),
      expectedDeadline: deadline,
      expectedGeofenceId: geocerca,
    })
    .returning({ id: serviceOccurrences.id });
  const [t] = await db
    .insert(trips)
    .values({
      serviceOccurrenceId: o!.id,
      evidenceWindowStart: new Date(deadline.getTime() - 3_600_000),
      evidenceWindowEnd: new Date(deadline.getTime() + 1_800_000),
      evidenceStatus: extra.indisponible ? "indisponible" : "disponible",
    })
    .returning({ id: trips.id });
  if (extra.hecho) {
    await db.insert(complianceFacts).values({
      serviceOccurrenceId: o!.id,
      tripId: t!.id,
      expectedDeadline: deadline,
      expectedGeofenceId: geocerca,
      status: extra.hecho,
      routeStrictnessApplied: "destino_only",
      contractPolicySnapshot: POLITICA as never,
    });
  }
  if (extra.historia) {
    await db.insert(complianceFactHistory).values({
      serviceOccurrenceId: o!.id,
      status: "pendiente_evidencia",
      factSnapshot: {},
      actorKind: "test",
    });
  }
  occ[nombre] = o!.id;
}

// Validada como se guarda en la base: con los valores por omisión que la generación usa.
const POLITICA = contractPolicySchema.parse({ toleranceMinutes: 5, routeStrictness: "destino_only", timeZone: "America/Ciudad_Juarez" });
let geocerca = "";

beforeAll(async () => {
  const [c, cl] = await db
    .insert(accounts)
    .values([
      { type: "carrier", name: `Carrier ${marca}`, slug: `carrier-${marca}` },
      { type: "client", name: `Cliente ${marca}`, slug: `cliente-${marca}` },
    ])
    .returning({ id: accounts.id });
  ids.carrier = c!.id;
  ids.cliente = cl!.id;
  const [p] = await db.insert(plants).values({ clientAccountId: ids.cliente, name: `Planta ${marca}`, code: `P-${marca}` }).returning({ id: plants.id });
  const [g] = await db
    .insert(geofences)
    .values({ ownerType: "plant", ownerPlantId: p!.id, role: "destino", name: "Destino", polygon: [{ lat: 31.7, lng: -106.4 }, { lat: 31.71, lng: -106.4 }, { lat: 31.71, lng: -106.39 }] })
    .returning({ id: geofences.id });
  geocerca = g!.id;
  const [k] = await db
    .insert(serviceContracts)
    .values({ carrierAccountId: ids.carrier, clientAccountId: ids.cliente, plantId: p!.id, name: `Contrato ${marca}`, status: "active", validFrom: "2026-01-01", validTo: "2027-12-31", policy: POLITICA as never })
    .returning({ id: serviceContracts.id });
  ids.contrato = k!.id;
  const [r] = await db.insert(routes).values({ clientAccountId: ids.cliente, plantId: p!.id, name: "R-1" }).returning({ id: routes.id });
  const [s] = await db.insert(shifts).values({ clientAccountId: ids.cliente, plantId: p!.id, name: "T1", startTime: "07:00" }).returning({ id: shifts.id });
  const [rs] = await db.insert(routeShifts).values({ clientAccountId: ids.cliente, plantId: p!.id, routeId: r!.id, shiftId: s!.id }).returning({ id: routeShifts.id });
  ids.rs = rs!.id;
  const [pf] = await db
    .insert(serviceProfiles)
    .values({ contractId: ids.contrato, routeShiftId: ids.rs, geofenceId: geocerca, name: "R-1 · T1", code: `PF-${marca}`, activeDays: [0, 1, 2, 3, 4, 5, 6] })
    .returning({ id: serviceProfiles.id });
  ids.perfil = pf!.id;

  await ocurrencia("pendienteViejo", hace(18), { hecho: "pendiente_evidencia", indisponible: true });
  await ocurrencia("sinHechoAntes", hace(16));
  await ocurrencia("sinHechoEnPausa", hace(12));
  await ocurrencia("selladoEnPausa", hace(10), { hecho: "cumplido" });
  await ocurrencia("conHistoriaEnPausa", hace(8), { historia: true });
  await ocurrencia("futura", hace(-6));
});

afterAll(async () => {
  await db.delete(complianceFactHistory).where(inArray(complianceFactHistory.serviceOccurrenceId, Object.values(occ)));
  await db.delete(serviceOccurrences).where(eq(serviceOccurrences.contractId, ids.contrato));
  await db.delete(accounts).where(inArray(accounts.id, [ids.carrier, ids.cliente]));
});

const enCola = async (ahora = new Date()) =>
  new Set((await repos.occurrences.findPendingVerification(ahora)).map((r) => r.occurrence.id).filter((id) => Object.values(occ).includes(id)));

/** Drizzle envuelve el error de la base; el mensaje del trigger viaja en `cause`. */
const mensajeDeLaBase = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no falló";
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } };
    return `${err.cause?.message ?? ""} ${err.message ?? ""}`;
  }
};

describe("la pausa, contra la base", () => {
  it("antes de pausar, la cola trae lo vencido sin hecho y el pendiente con GPS indisponible", async () => {
    const cola = await enCola();
    expect(cola).toEqual(new Set([occ.pendienteViejo, occ.sinHechoAntes, occ.sinHechoEnPausa, occ.conHistoriaEnPausa]));
  });

  it("la vista previa cuenta sin escribir", async () => {
    const v = await repos.pausas.vistaPrevia(ids.contrato, PAUSA_DESDE);
    expect(v).toMatchObject({ seBorran: 2, seQuedanSinSellar: 1, selladosNoSeTocan: 1, pendientesSeCongelan: 1 });
    expect(await db.select().from(contractVerificationEvents).where(eq(contractVerificationEvents.contractId, ids.contrato))).toEqual([]);
  });

  it("pausar borra sólo lo que nunca fue hecho, en la misma transacción que el evento", async () => {
    const { borradas } = await repos.pausas.pausar(ids.contrato, {
      valeDesde: PAUSA_DESDE,
      motivo: "Sin telemetría: el proveedor anterior se desconectó",
      actor: { kind: "human", id: "user_prueba" },
    });
    expect(borradas).toBe(2);
    const quedan = new Set(
      (await db.select({ id: serviceOccurrences.id }).from(serviceOccurrences).where(eq(serviceOccurrences.contractId, ids.contrato))).map((r) => r.id),
    );
    expect(quedan).toEqual(new Set([occ.pendienteViejo, occ.sinHechoAntes, occ.selladoEnPausa, occ.conHistoriaEnPausa]));
    // Lo sellado no se toca.
    const [f] = await db.select({ status: complianceFacts.status }).from(complianceFacts).where(eq(complianceFacts.serviceOccurrenceId, occ.selladoEnPausa!));
    expect(f?.status).toBe("cumplido");
  });

  it("con el contrato en pausa, nada suyo entra a la cola —tampoco lo de antes— y se cuenta", async () => {
    expect(await enCola()).toEqual(new Set());
    expect(await repos.occurrences.contarVencidasEnPausa(AHORA)).toBeGreaterThanOrEqual(3);
  });

  it("la generación no inventa nada dentro de la pausa", async () => {
    const { createdIds } = await repos.occurrences.generateForProfile(ids.perfil, hace(20), hace(-3));
    const creadas = await db
      .select({ deadline: serviceOccurrences.expectedDeadline })
      .from(serviceOccurrences)
      .where(inArray(serviceOccurrences.id, createdIds.length ? createdIds : ["00000000-0000-0000-0000-000000000000"]));
    expect(creadas.length).toBeGreaterThan(0);
    for (const c of creadas) expect(c.deadline.getTime()).toBeLessThan(PAUSA_DESDE.getTime());
    await db.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, createdIds));
  });

  it("la base sostiene la secuencia: no se pausa lo pausado, no se edita, no se agenda al futuro", async () => {
    expect(
      await mensajeDeLaBase(
        db.insert(contractVerificationEvents).values({ contractId: ids.contrato, tipo: "pausa", valeDesde: hace(1), motivo: "otra", actorKind: "test" }),
      ),
    ).toMatch(/alternan/);
    expect(
      await mensajeDeLaBase(db.update(contractVerificationEvents).set({ motivo: "cambiado" }).where(eq(contractVerificationEvents.contractId, ids.contrato))),
    ).toMatch(/no se editan/);
    expect(
      await mensajeDeLaBase(
        db.insert(contractVerificationEvents).values({ contractId: ids.contrato, tipo: "reanudacion", valeDesde: new Date(Date.now() + 3 * DIA), actorKind: "test" }),
      ),
    ).toMatch(/cve_no_futura/);
  });

  it("al reanudar, lo de antes vuelve a la cola; lo que cae en la pausa, no, y no se genera hacia atrás", async () => {
    await repos.pausas.reanudar(ids.contrato, { kind: "human", id: "user_prueba" }, new Date());
    const cola = await enCola();
    expect(cola).toEqual(new Set([occ.pendienteViejo, occ.sinHechoAntes]));
    const { createdIds } = await repos.occurrences.generateForProfile(ids.perfil, hace(20), hace(1));
    const creadas = await db.select({ deadline: serviceOccurrences.expectedDeadline }).from(serviceOccurrences).where(
      inArray(serviceOccurrences.id, createdIds.length ? createdIds : ["00000000-0000-0000-0000-000000000000"]),
    );
    for (const c of creadas) expect(c.deadline.getTime()).toBeLessThan(PAUSA_DESDE.getTime());
    await db.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, createdIds));
  });

  it("la llave del motor dice por qué", async () => {
    expect(await repos.pausas.motivoDePausa(ids.contrato, hace(12, 12), AHORA)).toBe("ocurrencia_en_pausa");
    expect(await repos.pausas.motivoDePausa(ids.contrato, hace(16, 12), AHORA)).toBeNull();
  });
});
