import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuitUnitAssignments } from "../src/index.js";

/*
 * La matriz del muro de ESCRITURA: el carrier asigna y suelta sus unidades en
 * un circuito (ficha de huecos de «asignar unidad», PR 2, 21 sep 2026).
 *
 * Dos carriers ligados a la MISMA concesión, corriendo el MISMO circuito, y
 * ninguno puede asignar, soltar ni leer la unidad del otro. Más un tercero sin
 * liga, una fila que no cuadra (asignación de un carrier sobre la unidad de
 * otro) y una segunda concesión para jalar un camión entre concesiones (§4).
 *
 * La valla estática (`guardia-asignar-circuito.test.ts`) exige las cerraduras en
 * el código; esto mide que, puestas, muerden contra base de verdad.
 *
 * ESCRIBE, así que va contra `DATABASE_URL_TEST` —la rama desechable— y nunca
 * contra producción. ⚠ Requiere la 0048 aplicada en esa rama.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[asignacion-carrier] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[asignacion-carrier] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `m${Date.now().toString(36)}`;

const ids = {
  concesion: "",
  concesionOtra: "",
  a: "",
  b: "",
  sinLiga: "",
  ligadoSinUnidades: "",
  circuito: "",
  circuitoOtraConcesion: "",
  a1: "",
  a2: "",
  b1: "",
  x1: "",
};
let ligaDelLigadoSinUnidades = "";

beforeAll(async () => {
  ids.concesion = (
    await repos.circuits.createConcession({ name: `C ${marca}`, slug: `c-${marca}`, legalName: `C ${marca}` })
  ).cuenta.id;
  ids.concesionOtra = (
    await repos.circuits.createConcession({ name: `C2 ${marca}`, slug: `c2-${marca}`, legalName: `C2 ${marca}` })
  ).cuenta.id;

  const carrier = async (n: string) =>
    (await repos.accounts.create({ type: "carrier", name: `${n} ${marca}`, slug: `${n}-${marca}` })).id;
  ids.a = await carrier("a");
  ids.b = await carrier("b");
  ids.sinLiga = await carrier("x");
  ids.ligadoSinUnidades = await carrier("d");

  await repos.circuits.linkCarrierToConcession(ids.concesion, ids.a);
  await repos.circuits.linkCarrierToConcession(ids.concesion, ids.b);
  await repos.circuits.linkCarrierToConcession(ids.concesionOtra, ids.a);
  ligaDelLigadoSinUnidades = (await repos.circuits.linkCarrierToConcession(ids.concesion, ids.ligadoSinUnidades)).id;

  ids.circuito = (
    await repos.circuits.createCircuit({ concessionAccountId: ids.concesion, name: `K ${marca}`, publicSlug: `k-${marca}` })
  ).id;
  ids.circuitoOtraConcesion = (
    await repos.circuits.createCircuit({
      concessionAccountId: ids.concesionOtra,
      name: `L ${marca}`,
      publicSlug: `l-${marca}`,
    })
  ).id;

  ids.a1 = (await repos.fleet.createUnit(ids.a, `A1-${marca}`)).id;
  ids.a2 = (await repos.fleet.createUnit(ids.a, `A2-${marca}`)).id;
  ids.b1 = (await repos.fleet.createUnit(ids.b, `B1-${marca}`)).id;
  ids.x1 = (await repos.fleet.createUnit(ids.sinLiga, `X1-${marca}`)).id;
});

afterAll(async () => {
  const cuentas = [ids.concesion, ids.concesionOtra, ids.a, ids.b, ids.sinLiga, ids.ligadoSinUnidades].filter(Boolean);
  await db.delete(accounts).where(inArray(accounts.id, cuentas));
});

const vigenteDe = async (unitId: string) =>
  (
    await db
      .select()
      .from(circuitUnitAssignments)
      .where(and(eq(circuitUnitAssignments.unitId, unitId), isNull(circuitUnitAssignments.validTo)))
  )[0] ?? null;

describe("el universo asignable: la unidad es suya y la concesión de ESTE circuito lo liga", () => {
  it("A sólo ve sus unidades — nunca la de B, aunque corran la misma concesión", async () => {
    const u = await repos.circuits.listUnidadesAsignablesDelCarrier(ids.a, ids.circuito);
    expect(u.map((x) => x.unitId).sort()).toEqual([ids.a1, ids.a2].sort());
  });

  it("un carrier sin liga con la concesión no puede asignar nada ahí", async () => {
    expect(await repos.circuits.listUnidadesAsignablesDelCarrier(ids.sinLiga, ids.circuito)).toEqual([]);
  });

  it("la liga es con la concesión del circuito, no con «alguna»: B no asigna en la otra concesión", async () => {
    expect(await repos.circuits.listUnidadesAsignablesDelCarrier(ids.b, ids.circuitoOtraConcesion)).toEqual([]);
  });
});

describe("la tercera entrada de lectura: la liga vigente", () => {
  it("un carrier ligado sin unidades ve el circuito (para poder asignar la primera)", async () => {
    expect(await repos.circuits.getCircuitVisibleParaCuenta(ids.ligadoSinUnidades, ids.circuito)).not.toBeNull();
    const lista = await repos.circuits.listarCircuitosVisiblesParaCuenta(ids.ligadoSinUnidades);
    const k = lista.find((c) => c.id === ids.circuito);
    expect(k).toBeDefined();
    // La pieza no puede decir «corres unidades aquí» de un circuito donde no corre nada.
    expect(k!.correUnidadesHoy).toBe(false);
  });

  it("un carrier sin liga no lo ve: para él no existe", async () => {
    expect(await repos.circuits.getCircuitVisibleParaCuenta(ids.sinLiga, ids.circuito)).toBeNull();
  });

  it("terminada la liga, sin unidades que hayan corrido ahí, deja de verlo", async () => {
    await repos.circuits.unlinkCarrierFromConcession(ligaDelLigadoSinUnidades);
    expect(await repos.circuits.getCircuitVisibleParaCuenta(ids.ligadoSinUnidades, ids.circuito)).toBeNull();
  });
});

describe("dos carriers en el mismo circuito: ninguno toca lo del otro", () => {
  let asigA1 = "";
  let asigB1 = "";

  it("cada uno asigna la suya, firmada por quien actuó", async () => {
    asigA1 = (
      await repos.circuits.assignUnit({
        circuitId: ids.circuito,
        unitId: ids.a1,
        carrierAccountId: ids.a,
        actorId: "user_a",
      })
    ).abierta.id;
    asigB1 = (
      await repos.circuits.assignUnit({
        circuitId: ids.circuito,
        unitId: ids.b1,
        carrierAccountId: ids.b,
        actorId: "user_b",
      })
    ).abierta.id;
    expect((await vigenteDe(ids.a1))?.asignadaPor).toBe("user_a");
    expect((await vigenteDe(ids.b1))?.asignadaPor).toBe("user_b");
  });

  it("cada uno lee sólo las suyas", async () => {
    const deA = await repos.circuits.listAsignacionesDeCuenta(ids.a, ids.circuito);
    const deB = await repos.circuits.listAsignacionesDeCuenta(ids.b, ids.circuito);
    expect(deA.map((x) => x.unitId)).toEqual([ids.a1]);
    expect(deB.map((x) => x.unitId)).toEqual([ids.b1]);
  });

  it("A no suelta la de B aunque tenga su id — y la de B sigue corriendo", async () => {
    expect(await repos.circuits.soltarAsignacionDeCuenta(ids.a, ids.circuito, asigB1, "intento", "user_a")).toBeNull();
    expect((await vigenteDe(ids.b1))?.id).toBe(asigB1);
  });

  it("B no suelta la suya desde otro circuito", async () => {
    expect(
      await repos.circuits.soltarAsignacionDeCuenta(ids.b, ids.circuitoOtraConcesion, asigB1, "x", "user_b"),
    ).toBeNull();
    expect((await vigenteDe(ids.b1))?.id).toBe(asigB1);
  });

  it("A suelta la suya: evento con fecha, motivo y autor — la fila se queda", async () => {
    const cerrada = await repos.circuits.soltarAsignacionDeCuenta(ids.a, ids.circuito, asigA1, "entró a taller", "user_a2");
    expect(cerrada).toMatchObject({ id: asigA1, motivo: "entró a taller", cerradaPor: "user_a2" });
    expect(cerrada!.validTo).toBeInstanceOf(Date);
    expect(await vigenteDe(ids.a1)).toBeNull();
    const historia = await repos.circuits.listAsignacionesDeCuenta(ids.a, ids.circuito);
    expect(historia.map((x) => x.id)).toContain(asigA1);
  });

  it("soltar dos veces no vuelve a escribir", async () => {
    expect(await repos.circuits.soltarAsignacionDeCuenta(ids.a, ids.circuito, asigA1, "otra", "user_a")).toBeNull();
  });
});

describe("una fila que no cuadra no le abre nada a nadie", () => {
  it("una asignación a nombre de A sobre la unidad de B: A ni la lee ni la suelta", async () => {
    // Directo a la tabla: el repositorio nunca la escribiría. Es la convención
    // rota que las dos cerraduras juntas existen para aguantar.
    await db
      .update(circuitUnitAssignments)
      .set({ validTo: new Date() })
      .where(and(eq(circuitUnitAssignments.unitId, ids.b1), isNull(circuitUnitAssignments.validTo)));
    const [rara] = await db
      .insert(circuitUnitAssignments)
      .values({ circuitId: ids.circuito, unitId: ids.b1, carrierAccountId: ids.a })
      .returning();

    const deA = await repos.circuits.listAsignacionesDeCuenta(ids.a, ids.circuito);
    expect(deA.map((x) => x.id)).not.toContain(rara.id);
    expect(await repos.circuits.soltarAsignacionDeCuenta(ids.a, ids.circuito, rara.id, "x", "user_a")).toBeNull();
    // Y B tampoco: la asignación no la hizo él.
    expect(await repos.circuits.soltarAsignacionDeCuenta(ids.b, ids.circuito, rara.id, "x", "user_b")).toBeNull();
    expect((await vigenteDe(ids.b1))?.id).toBe(rara.id);
  });
});

describe("jalar un camión de otra concesión (§4): el cierre lleva quién y motivo", () => {
  it("A2 corría L (otra concesión); asignarlo a K cierra L con autor y motivo", async () => {
    const enL = await repos.circuits.assignUnit({
      circuitId: ids.circuitoOtraConcesion,
      unitId: ids.a2,
      carrierAccountId: ids.a,
      actorId: "user_a",
    });

    const universo = await repos.circuits.listUnidadesAsignablesDelCarrier(ids.a, ids.circuito);
    const a2 = universo.find((u) => u.unitId === ids.a2)!;
    // Lo que la pantalla enseña ANTES de confirmar.
    expect(a2.ocupadaEnCircuitoId).toBe(ids.circuitoOtraConcesion);
    expect(a2.ocupadaEnCircuito).toBe(`L ${marca}`);

    const { cerrada } = await repos.circuits.assignUnit({
      circuitId: ids.circuito,
      unitId: ids.a2,
      carrierAccountId: ids.a,
      motivoDelCierre: `Reasignada a K ${marca}`,
      actorId: "user_a3",
    });
    expect(cerrada).toMatchObject({
      id: enL.abierta.id,
      circuitId: ids.circuitoOtraConcesion,
      motivo: `Reasignada a K ${marca}`,
      cerradaPor: "user_a3",
    });
    expect((await vigenteDe(ids.a2))?.circuitId).toBe(ids.circuito);
  });
});
