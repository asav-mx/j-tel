import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuitUnitAssignments } from "../src/index.js";

/*
 * La asignación de unidad a circuito, contra base de verdad.
 *
 * Estas pruebas ESCRIBEN, así que van contra `DATABASE_URL_TEST` —una rama
 * desechable de Neon— y nunca contra producción. El candado de abajo es el
 * mismo de `integration.test.ts` y falla antes de conectarse.
 *
 * Lo que se ejerce aquí no se puede ejercer con dobles: el índice único parcial
 * `circuit_unit_assignments_una_vigente` vive en la base, y una prueba en
 * memoria lo daría por bueno sin haberlo tocado. Es justo la garantía que hace
 * que una unidad no se publique en dos circuitos.
 *
 * ⚠ Requiere la migración 0027 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[asignacion-circuito] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[asignacion-circuito] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const DATABASE_URL = TEST_URL;
const db = createDb(DATABASE_URL);
const repos = createRepositories(db);

// Sufijo propio para que dos corridas no choquen en los slugs únicos.
const marca = `t${Date.now().toString(36)}`;

let concesionId = "";
let carrierId = "";
let carrierAjenoId = "";
let circuitoA = "";
let circuitoB = "";
let unidad1 = "";
let unidad2 = "";
let unidadAjena = "";

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

  // Un carrier que NO está ligado a la concesión: sirve para comprobar que su
  // flota no aparece como asignable.
  const ajeno = await repos.accounts.create({
    type: "carrier",
    name: `Ajeno ${marca}`,
    slug: `ajeno-${marca}`,
  });
  carrierAjenoId = ajeno.id;

  await repos.circuits.linkCarrierToConcession(concesionId, carrierId);

  const a = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito A ${marca}`,
    publicSlug: `circuito-a-${marca}`,
  });
  circuitoA = a.id;
  const b = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito B ${marca}`,
    publicSlug: `circuito-b-${marca}`,
  });
  circuitoB = b.id;

  unidad1 = (await repos.fleet.createUnit(carrierId, `U-${marca}-1`, `AAA-${marca}`)).id;
  unidad2 = (await repos.fleet.createUnit(carrierId, `U-${marca}-2`)).id;
  unidadAjena = (await repos.fleet.createUnit(carrierAjenoId, `X-${marca}`)).id;
});

afterAll(async () => {
  // Borrar las cuentas arrastra en cascada circuitos, unidades, asignaciones y
  // la liga con la concesión.
  await db
    .delete(accounts)
    .where(inArray(accounts.id, [concesionId, carrierId, carrierAjenoId].filter(Boolean)));
});

describe("candado: una sola asignación vigente por unidad", () => {
  it("rechaza una segunda asignación abierta de la misma unidad", async () => {
    await repos.circuits.assignUnit({
      circuitId: circuitoA,
      unitId: unidad2,
      carrierAccountId: carrierId,
    });

    // Insert directo, saltándose el repositorio: es la única forma de comprobar
    // que quien defiende es la BASE y no el código que la llama.
    let error: unknown = null;
    try {
      await db.insert(circuitUnitAssignments).values({
        circuitId: circuitoB,
        unitId: unidad2,
        carrierAccountId: carrierId,
      });
    } catch (e) {
      error = e;
    }

    /*
     * Se comprueba QUÉ falló, no que falló.
     *
     * Drizzle envuelve el error de Postgres en un «Failed query: …», así que
     * un `toThrow()` genérico —o uno contra ese texto— pasaría igual si el
     * insert hubiera reventado por una llave foránea o por una columna
     * faltante. Sería la trampa de siempre: correcto como prueba, falso como
     * afirmación. El nombre del índice y el 23505 son lo único que acredita
     * que quien rechazó fue el candado.
     */
    const causa = (error as { cause?: { code?: string; constraint_name?: string } })?.cause;
    expect(causa?.code).toBe("23505");
    expect(causa?.constraint_name).toBe("circuit_unit_assignments_una_vigente");
  });
});

describe("reasignar cierra, no pisa", () => {
  it("mueve la unidad de circuito conservando la historia de la anterior", async () => {
    const primera = await repos.circuits.assignUnit({
      circuitId: circuitoA,
      unitId: unidad1,
      carrierAccountId: carrierId,
    });
    expect(primera.cerrada).toBeNull();

    const segunda = await repos.circuits.assignUnit({
      circuitId: circuitoB,
      unitId: unidad1,
      carrierAccountId: carrierId,
      motivoDelCierre: "Reasignada al Circuito B",
    });

    // La anterior se cerró, y se cerró LA QUE ERA.
    expect(segunda.cerrada?.id).toBe(primera.abierta.id);
    expect(segunda.cerrada?.circuitId).toBe(circuitoA);
    expect(segunda.cerrada?.validTo).not.toBeNull();
    expect(segunda.cerrada?.motivo).toBe("Reasignada al Circuito B");

    // El pasado no se reescribió: la fila vieja conserva su validFrom.
    expect(segunda.cerrada?.validFrom.getTime()).toBe(primera.abierta.validFrom.getTime());

    // Y la unidad quedó corriendo el nuevo, una sola vez.
    const vigentesB = await repos.circuits.listActiveAssignments(circuitoB);
    expect(vigentesB.filter((a) => a.unitId === unidad1)).toHaveLength(1);
    const vigentesA = await repos.circuits.listActiveAssignments(circuitoA);
    expect(vigentesA.some((a) => a.unitId === unidad1)).toBe(false);
  });
});

describe("terminar no borra", () => {
  it("cierra con motivo, la saca de lo vigente y la deja en la historia", async () => {
    const { abierta } = await repos.circuits.assignUnit({
      circuitId: circuitoA,
      unitId: unidad1,
      carrierAccountId: carrierId,
    });

    const terminada = await repos.circuits.endAssignment(abierta.id, "se fue a maquila");
    expect(terminada?.validTo).not.toBeNull();
    expect(terminada?.motivo).toBe("se fue a maquila");

    // Fuera del filtro que publica: esto es lo que decide qué ve el pasajero.
    const vigentes = await repos.circuits.listActiveAssignments(circuitoA);
    expect(vigentes.some((a) => a.id === abierta.id)).toBe(false);

    // Y sigue existiendo, con su motivo, en la lista completa.
    const todas = await repos.circuits.listAssignments(circuitoA);
    const enHistoria = todas.find((a) => a.id === abierta.id);
    expect(enHistoria?.motivo).toBe("se fue a maquila");
    expect(enHistoria?.unitLabel).toBe(`U-${marca}-1`);

    // La fila sigue en la tabla: cerrar no es borrar.
    const enTabla = await db
      .select()
      .from(circuitUnitAssignments)
      .where(eq(circuitUnitAssignments.id, abierta.id));
    expect(enTabla).toHaveLength(1);
  });

  it("no vuelve a cerrar una asignación ya terminada", async () => {
    const { abierta } = await repos.circuits.assignUnit({
      circuitId: circuitoA,
      unitId: unidad1,
      carrierAccountId: carrierId,
    });
    await repos.circuits.endAssignment(abierta.id, "primera vez");
    const segunda = await repos.circuits.endAssignment(abierta.id, "segunda vez");
    expect(segunda).toBeNull();

    // El motivo original no se pisó.
    const [fila] = await db
      .select()
      .from(circuitUnitAssignments)
      .where(eq(circuitUnitAssignments.id, abierta.id));
    expect(fila.motivo).toBe("primera vez");
  });
});

describe("universo de unidades asignables", () => {
  it("son las del transportista ligado, y dice cuál viene ocupada", async () => {
    const asignables = await repos.circuits.listUnidadesAsignables(concesionId);
    const ids = asignables.map((u) => u.unitId);

    expect(ids).toContain(unidad1);
    expect(ids).toContain(unidad2);
    // La flota de un carrier sin liga vigente no entra al universo. No es un
    // filtro de pantalla: la consulta nunca la trae.
    expect(ids).not.toContain(unidadAjena);

    // unidad2 quedó corriendo el Circuito A desde la primera prueba.
    const ocupada = asignables.find((u) => u.unitId === unidad2);
    expect(ocupada?.ocupadaEnCircuitoId).toBe(circuitoA);
    expect(ocupada?.ocupadaEnCircuito).toBe(`Circuito A ${marca}`);
  });

  it("al desligar al transportista, sus unidades dejan de ser asignables", async () => {
    const ligas = await repos.circuits.listConcessionCarriers(concesionId);
    const vigente = ligas.find((l) => !l.validTo && l.carrierAccountId === carrierId);
    expect(vigente).toBeDefined();

    await repos.circuits.unlinkCarrierFromConcession(vigente!.id);

    const asignables = await repos.circuits.listUnidadesAsignables(concesionId);
    expect(asignables).toHaveLength(0);

    // Desligar NO cierra las asignaciones vigentes: decidir su motivo y su hora
    // es del despachador, no de un efecto colateral.
    const vigentesA = await repos.circuits.listActiveAssignments(circuitoA);
    expect(vigentesA.some((a) => a.unitId === unidad2)).toBe(true);

    // Se vuelve a ligar para no dejar el estado a medias si alguien agrega
    // pruebas después de ésta.
    await repos.circuits.linkCarrierToConcession(concesionId, carrierId);
  });
});
