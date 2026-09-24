import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { armarActaDelHecho, cotejarContorno, type ContractPolicy } from "@jtel/domain";
import { createDb, createRepositories, serviceOccurrences, trips } from "../src/index.js";

/*
 * **El acta sobrevive al viaje por `jsonb`** — C24, Tramo 4.
 *
 * Lo que aquí se prueba no es la forma del acta —eso ya lo fija
 * `acta-del-hecho.test.ts`, sin base— sino que **lo que se guarda es lo que se
 * lee**. Es la comprobación que faltó cuando la memoria de quemados salía `{}`
 * de `JSON.stringify` sin decir nada: un objeto que no sobrevive al ida y
 * vuelta se ve idéntico en el código y vacío en la base.
 *
 * Escribe, así que va contra `DATABASE_URL_TEST` —rama desechable— y nunca
 * contra producción.
 *
 * ⚠ Requiere la 0056 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) throw new Error("[acta] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[acta] DATABASE_URL_TEST es producción. Esta prueba escribe.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const POLICY: ContractPolicy = {
  toleranceMinutes: 5,
  verificationGraceMinutes: 15,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
} as ContractPolicy;

const PUNTOS = [
  { recordedAt: new Date("2099-02-10T07:10:00Z"), latitude: 31.74, longitude: -106.47 },
  { recordedAt: new Date("2099-02-10T07:10:30Z"), latitude: 31.741, longitude: -106.471 },
  { recordedAt: new Date("2099-02-10T07:11:00Z"), latitude: 31.742, longitude: -106.472 },
];

const ACTA = armarActaDelHecho({
  ventana: { desde: new Date("2099-02-10T07:00:00Z"), hasta: new Date("2099-02-10T09:00:00Z") },
  unidadObservada: { economico: "2120", placas: "ABC-123" },
  unidadDeReferencia: { economico: "2101", placas: null },
  nombres: {
    perfil: "Perfil de prueba",
    contrato: "Contrato de prueba",
    planta: "Planta 47",
    cliente: "Cliente de prueba",
    transportista: "Juárez Bus",
  },
  estadoDelViaje: "en_espera",
  puntos: PUNTOS,
});

const creadas: string[] = [];

afterAll(async () => {
  for (const id of creadas) {
    await repos.compliance.deleteFactForOccurrence(id);
    await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, id));
  }
});

/** Una ocurrencia con su viaje, muy lejos del horizonte para no estorbar. */
async function terreno(serviceDate: string) {
  const tecma = await repos.accounts.findBySlug("tecma");
  if (!tecma) return null;
  const perfiles = await repos.profiles.findForClient(tecma.id);
  const profile = perfiles[0];
  if (!profile) return null;

  const viejo = await db.query.serviceOccurrences.findFirst({
    where: (o, { and, eq: e }) => and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
  });
  if (viejo) {
    await repos.compliance.deleteFactForOccurrence(viejo.id);
    await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, viejo.id));
  }

  const deadline = new Date(`${serviceDate}T08:00:00Z`);
  const [occ] = await db
    .insert(serviceOccurrences)
    .values({
      serviceProfileId: profile.id,
      contractId: profile.contractId,
      routeShiftId: profile.routeShiftId,
      serviceDate,
      expectedDeadline: deadline,
      expectedGeofenceId: profile.geofenceId,
    })
    .returning();
  if (!occ) return null;
  creadas.push(occ.id);

  const [trip] = await db
    .insert(trips)
    .values({
      serviceOccurrenceId: occ.id,
      evidenceWindowStart: new Date(`${serviceDate}T07:00:00Z`),
      evidenceWindowEnd: new Date(`${serviceDate}T09:00:00Z`),
      evidenceStatus: "en_espera",
    })
    .returning();
  if (!trip) return null;

  return { profile, occ, trip, deadline };
}

const sellar = (t: NonNullable<Awaited<ReturnType<typeof terreno>>>, acta: typeof ACTA | null) =>
  repos.compliance.saveFact({
    serviceOccurrenceId: t.occ.id,
    tripId: t.trip.id,
    expectedDeadline: t.deadline,
    expectedGeofenceId: t.profile.geofenceId,
    status: "no_cumplido",
    lateExcusable: false,
    routeStrictnessApplied: "destino_only",
    contractPolicySnapshot: POLICY,
    ...(acta ? { actaSnapshot: acta } : {}),
  });

describe("el acta viaja entera por jsonb", () => {
  it("lo que se guarda es lo que se lee — las cinco familias", async () => {
    const t = await terreno("2099-02-10");
    if (!t) return;
    await sellar(t, ACTA);

    /* Se relee por el MISMO camino que usa el expediente. */
    const leido = (await repos.occurrences.findById(t.occ.id))?.complianceFact;
    expect(leido?.actaSnapshot).toEqual(ACTA);
    expect(Object.keys(leido!.actaSnapshot!).sort()).toEqual([
      "evidencia",
      "nombres",
      "unidades",
      "ventana",
      "viaje",
    ]);
  });

  it("las placas y los nombres vuelven como TEXTO, no como referencias", async () => {
    const t = await terreno("2099-02-11");
    if (!t) return;
    await sellar(t, ACTA);

    const a = (await repos.occurrences.findById(t.occ.id))?.complianceFact?.actaSnapshot;
    expect(a?.unidades.observada).toEqual({ economico: "2120", placas: "ABC-123" });
    /* Un hueco legítimo vuelve como hueco. */
    expect(a?.unidades.referencia?.placas).toBeNull();
    expect(a?.nombres.planta).toBe("Planta 47");
  });

  /*
   * La razón de existir del contorno: que el cotejo siga funcionando DESPUÉS
   * del viaje por la base. Si la huella se transformara al guardarse, esto
   * diría «no cuadra» con la misma evidencia.
   */
  it("la huella guardada sigue cotejando contra los mismos puntos", async () => {
    const t = await terreno("2099-02-12");
    if (!t) return;
    await sellar(t, ACTA);

    const a = (await repos.occurrences.findById(t.occ.id))?.complianceFact?.actaSnapshot ?? null;
    expect(cotejarContorno(a, PUNTOS)).toEqual({ que: "cuadra" });
    expect(cotejarContorno(a, PUNTOS.slice(0, 2)).que).toBe("no_cuadra");
  });

  /*
   * Los 2 593 hechos anteriores. El NULL es un dato: significa «se selló antes
   * de que el acta existiera», y es lo único que permite saberlo.
   */
  it("un hecho sellado sin acta se queda en null, no en un objeto vacío", async () => {
    const t = await terreno("2099-02-13");
    if (!t) return;
    await sellar(t, null);

    const leido = (await repos.occurrences.findById(t.occ.id))?.complianceFact;
    expect(leido?.actaSnapshot ?? null).toBeNull();
    expect(cotejarContorno(leido?.actaSnapshot ?? null, PUNTOS)).toEqual({ que: "sin_acta" });
  });
});
