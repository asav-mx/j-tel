import { describe, it, expect, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  serviceOccurrences,
  trips,
  complianceFacts,
} from "../src/index.js";
import { contractPolicySchema, type ContractPolicy } from "@jtel/domain";

/*
 * La carrera de `saveFact`, escrita contra la base.
 *
 * ESTO NO SE PUEDE PROBAR CON UN DOBLE. El defecto vive en una garantía de la
 * base —`service_occurrence_id` es único— y en cómo `onConflictDoNothing`
 * responde cuando esa garantía se activa: devolviendo cero filas. Un mock
 * devuelve lo que el autor del mock crea, que es exactamente lo que hizo falta
 * comprobar durante 13 702 fallos.
 *
 * Escriben, así que van contra `DATABASE_URL_TEST` —rama desechable— y nunca
 * contra producción.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error("[carrera-savefact] DATABASE_URL_TEST no está definida.");
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[carrera-savefact] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const POLICY: ContractPolicy = contractPolicySchema.parse({
  toleranceMinutes: 10,
  verificationGraceMinutes: 30,
  routeStrictness: "destino_only",
});

const creadas: string[] = [];

/** Una ocurrencia con su viaje, colgada del primer perfil que haya. */
async function ocurrenciaDePrueba(serviceDate: string, deadlineIso: string) {
  const tecma = await repos.accounts.findBySlug("tecma");
  if (!tecma) throw new Error("Cuenta tecma no encontrada en la rama de prueba");
  const perfiles = await repos.profiles.findForClient(tecma.id);
  const perfil = perfiles[0];
  if (!perfil) throw new Error("Sin perfiles en la rama de prueba");

  const deadline = new Date(deadlineIso);
  const [occ] = await db
    .insert(serviceOccurrences)
    .values({
      serviceProfileId: perfil.id,
      contractId: perfil.contractId,
      routeShiftId: perfil.routeShiftId,
      serviceDate,
      expectedDeadline: deadline,
      expectedGeofenceId: perfil.geofenceId,
    })
    .returning();
  if (!occ) throw new Error("No se pudo insertar la ocurrencia");
  creadas.push(occ.id);

  const [trip] = await db
    .insert(trips)
    .values({
      serviceOccurrenceId: occ.id,
      evidenceWindowStart: new Date(deadline.getTime() - 60 * 60 * 1000),
      evidenceWindowEnd: new Date(deadline.getTime() + 30 * 60 * 1000),
      evidenceStatus: "en_espera",
    })
    .returning();
  if (!trip) throw new Error("No se pudo insertar el viaje");

  return { occ, trip, deadline, geofenceId: perfil.geofenceId };
}

function hechoDe(
  base: Awaited<ReturnType<typeof ocurrenciaDePrueba>>,
  status: "cumplido" | "no_cumplido" | "pendiente_evidencia",
) {
  return {
    serviceOccurrenceId: base.occ.id,
    tripId: base.trip.id,
    expectedDeadline: base.deadline,
    expectedGeofenceId: base.geofenceId,
    referenceUnitId: null,
    observedUnitId: null,
    observedArrivalAt: null,
    observedRouteMatchPct: null,
    servedVariantId: null,
    status,
    timing: null,
    lateExcusable: false,
    excusableReason: null,
    routeStrictnessApplied: "destino_only" as const,
    contractPolicySnapshot: POLICY,
  };
}

afterAll(async () => {
  if (creadas.length > 0) {
    await db.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, creadas));
  }
});

describe("saveFact cuando dos pasadas del cron chocan", () => {
  it("devuelve el hecho que ganó en vez de un undefined disfrazado", async () => {
    const base = await ocurrenciaDePrueba("2099-06-01", "2099-06-01T08:00:00Z");

    const primero = await repos.compliance.saveFact(hechoDe(base, "pendiente_evidencia"));
    expect(primero.status).toBe("pendiente_evidencia");

    // La segunda pasada: misma ocurrencia, la fila ya está. Antes de este
    // arreglo, `onConflictDoNothing` no devolvía nada, el `!` lo dejaba pasar,
    // y quien llamaba moría leyendo `.status`.
    const segundo = await repos.compliance.saveFact(hechoDe(base, "no_cumplido"));

    expect(segundo).toBeDefined();
    expect(segundo.id).toBe(primero.id);
    // La prueba de verdad: esta lectura es la que reventaba.
    expect(segundo.status).toBe("pendiente_evidencia");
  });

  it("deja UNA sola fila aunque las dos pasadas corran a la vez", async () => {
    const base = await ocurrenciaDePrueba("2099-06-02", "2099-06-02T08:00:00Z");

    const [a, b] = await Promise.all([
      repos.compliance.saveFact(hechoDe(base, "pendiente_evidencia")),
      repos.compliance.saveFact(hechoDe(base, "pendiente_evidencia")),
    ]);

    expect(a.id).toBe(b.id);

    const filas = await db
      .select()
      .from(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, base.occ.id));
    expect(filas).toHaveLength(1);
  });

  it("el hecho que ganó NO se pisa con el de la pasada que perdió", async () => {
    const base = await ocurrenciaDePrueba("2099-06-03", "2099-06-03T08:00:00Z");

    await repos.compliance.saveFact(hechoDe(base, "cumplido"));
    await repos.compliance.saveFact(hechoDe(base, "no_cumplido"));

    const [fila] = await db
      .select()
      .from(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, base.occ.id));

    /*
     * Importa que sea `cumplido`: el conflicto NO es una puerta de escritura.
     * Si esto se volviera un upsert, la pasada perdedora reescribiría un hecho
     * ya sellado —y con él las fotos de candidatas y densidad, que por diseño
     * sólo entran en el INSERT y cuyo `null` significa «nunca se midió».
     */
    expect(fila?.status).toBe("cumplido");
  });
});
