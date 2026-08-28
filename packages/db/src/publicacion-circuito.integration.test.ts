import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, livePositions } from "../src/index.js";

/*
 * El interruptor de publicación y la cadena que alimenta al endpoint público.
 *
 * Escriben, así que van contra `DATABASE_URL_TEST` —rama desechable— y nunca
 * contra producción.
 *
 * ⚠ Requiere las migraciones 0027 y 0028 aplicadas en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error("[publicacion-circuito] DATABASE_URL_TEST no está definida.");
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[publicacion-circuito] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `p${Date.now().toString(36)}`;

let concesionId = "";
let carrierId = "";
let circuitoId = "";
let slug = "";
let unidadConAparato = "";
let unidadSinAparato = "";
let imeiDeLaPrueba = "";

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA`,
  });
  concesionId = cuenta.id;

  const carrier = await repos.accounts.create({
    type: "carrier",
    name: `Transportista ${marca}`,
    slug: `transportista-${marca}`,
  });
  carrierId = carrier.id;
  await repos.circuits.linkCarrierToConcession(concesionId, carrierId);

  slug = `circuito-${marca}`;
  const circuito = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: slug,
    // Explícita: desde la 0031 la frecuencia ya no tiene default, y esta prueba
    // comprueba que despublicar NO borra los datos del circuito. Para eso el
    // dato tiene que haber sido puesto por alguien.
    declaredFrequencyMinutes: 20,
  });
  circuitoId = circuito.id;

  unidadConAparato = (await repos.fleet.createUnit(carrierId, `U-${marca}-con`)).id;
  unidadSinAparato = (await repos.fleet.createUnit(carrierId, `U-${marca}-sin`)).id;

  // La unidad con aparato: alta del aparato, asignación vigente y su posición.
  imeiDeLaPrueba = `imei-${marca}`;
  const aparato = await repos.fleet.createDevice(carrierId, imeiDeLaPrueba, `GPS ${marca}`);
  await repos.fleet.assignDevice(unidadConAparato, aparato.id);

  await repos.livePositions.upsertMany([
    {
      imei: imeiDeLaPrueba,
      carrierAccountId: carrierId,
      deviceId: aparato.id,
      // NULL a propósito: es lo que escribe el recolector de verdad.
      unitId: null,
      latitude: 31.71,
      longitude: -106.45,
      heading: 0,
      recordedAt: new Date(),
    },
  ]);

  await repos.circuits.assignUnit({ circuitId: circuitoId, unitId: unidadConAparato, carrierAccountId: carrierId });
  await repos.circuits.assignUnit({ circuitId: circuitoId, unitId: unidadSinAparato, carrierAccountId: carrierId });
});

afterAll(async () => {
  await db.delete(livePositions).where(eq(livePositions.imei, imeiDeLaPrueba));
  await db.delete(accounts).where(inArray(accounts.id, [concesionId, carrierId].filter(Boolean)));
});

describe("el circuito nace sin publicar", () => {
  it("recién creado no lo ve el endpoint público", async () => {
    expect(await repos.circuits.getPublishedCircuitBySlug(slug)).toBeNull();
    // Y sin embargo existe: la pantalla interna sí lo encuentra.
    expect(await repos.circuits.getCircuit(circuitoId)).not.toBeNull();
  });

  it("un slug no publicado y un slug inventado son indistinguibles para el endpoint", async () => {
    const noPublicado = await repos.circuits.getPublishedCircuitBySlug(slug);
    const inventado = await repos.circuits.getPublishedCircuitBySlug(`no-existe-${marca}`);
    expect(noPublicado).toBe(inventado); // los dos null
  });
});

describe("el interruptor", () => {
  it("prender lo hace visible; apagar lo devuelve a invisible sin borrar nada", async () => {
    const prendido = await repos.circuits.setCircuitPublished(circuitoId, true);
    expect(prendido?.publishedAt).toBeInstanceOf(Date);
    expect(await repos.circuits.getPublishedCircuitBySlug(slug)).not.toBeNull();

    const apagado = await repos.circuits.setCircuitPublished(circuitoId, false);
    expect(apagado?.publishedAt).toBeNull();
    expect(await repos.circuits.getPublishedCircuitBySlug(slug)).toBeNull();

    // Apagar no tocó nada más del circuito.
    expect(apagado?.name).toBe(`Circuito ${marca}`);
    expect(apagado?.publicSlug).toBe(slug);
    expect(apagado?.declaredFrequencyMinutes).toBe(20);

    // Y las asignaciones siguen ahí: despublicar no desasigna.
    expect(await repos.circuits.listActiveAssignments(circuitoId)).toHaveLength(2);
  });

  it("no confunde publicación con `active`, que nace en true", async () => {
    const circuito = await repos.circuits.getCircuit(circuitoId);
    expect(circuito?.active).toBe(true);
    expect(circuito?.publishedAt).toBeNull();
    // Si el interruptor fuera `active`, este circuito estaría publicado por existir.
  });
});

describe("de dónde saca las posiciones el endpoint", () => {
  it("las une por el APARATO, no por `unit_id`, que el recolector deja vacío", async () => {
    const posiciones = await repos.circuits.listLivePositionsForCircuit(circuitoId);

    // La fila de posición tiene unit_id NULL — como en producción, 78 de 78.
    const [fila] = await db
      .select()
      .from(livePositions)
      .where(eq(livePositions.imei, imeiDeLaPrueba));
    expect(fila.unitId).toBeNull();

    // Y aun así la unidad sale, con su posición. Ésta es la prueba de que la
    // cadena asignación → aparato vigente → posición es la correcta: unir por
    // `unit_id` habría devuelto cero aquí, con todo bien configurado.
    expect(posiciones).toHaveLength(1);
    expect(posiciones[0].unitId).toBe(unidadConAparato);
    expect(posiciones[0].latitude).toBeCloseTo(31.71, 5);
  });

  it("una unidad asignada pero sin aparato no aparece — no hay dónde decir que está", async () => {
    const posiciones = await repos.circuits.listLivePositionsForCircuit(circuitoId);
    expect(posiciones.some((p) => p.unitId === unidadSinAparato)).toBe(false);
  });

  it("una unidad que deja de correr el circuito desaparece de las posiciones", async () => {
    const vigentes = await repos.circuits.listActiveAssignments(circuitoId);
    const suya = vigentes.find((a) => a.unitId === unidadConAparato);
    await repos.circuits.endAssignment(suya!.id, "prueba de que el filtro muerde");

    expect(await repos.circuits.listLivePositionsForCircuit(circuitoId)).toHaveLength(0);

    // Se vuelve a asignar para no dejar el estado a medias.
    await repos.circuits.assignUnit({
      circuitId: circuitoId,
      unitId: unidadConAparato,
      carrierAccountId: carrierId,
    });
  });

  it("devuelve el `recordedAt` crudo: quién está fresco lo decide el umbral del circuito", async () => {
    const [p] = await repos.circuits.listLivePositionsForCircuit(circuitoId);
    expect(p.recordedAt).toBeInstanceOf(Date);
  });
});
