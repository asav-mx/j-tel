import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuits, circuitStops } from "../src/index.js";

/*
 * **El QR de las paradas: los cuatro casos de `/p/‹qr_slug›`.**
 *
 * Lo que se prueba aquí no es una pantalla: es **qué contesta la base cuando
 * alguien escanea una lámina atornillada a un poste**. Esa lámina no se puede
 * corregir, así que los cuatro casos tienen que ser los cuatro, y dos de ellos
 * tienen que contestar exactamente lo mismo a propósito.
 *
 * Escribe, así que va contra `DATABASE_URL_TEST` —rama desechable— y nunca
 * contra producción.
 *
 * ⚠ Requiere la 0055 aplicada en la rama de prueba (la referencia RESTRICT).
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error("[qr-de-parada] DATABASE_URL_TEST no está definida.");
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[qr-de-parada] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `qr${Date.now().toString(36)}`;

let concesionId = "";
let publicadoId = "";
let escondidoId = "";

/** Los slugs, como irían impresos. */
const SLUG_VIGENTE = `${marca}-vigente`;
const SLUG_RETIRADA = `${marca}-retirada`;
const SLUG_DEL_ESCONDIDO = `${marca}-escondida`;
const SLUG_INVENTADO = `${marca}-no-existe`;

let idDeLaRetirada = "";

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA`,
  });
  concesionId = cuenta.id;

  const publicado = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
    colorHex: "#5B3EA6",
  });
  publicadoId = publicado.id;
  await repos.circuits.setCircuitPublished(publicadoId, true);

  const escondido = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito escondido ${marca}`,
    publicSlug: `escondido-${marca}`,
    colorHex: "#2F6F4E",
  });
  escondidoId = escondido.id;
  /* Sin publicar a propósito: nace así. */

  await repos.circuits.createStop({
    circuitId: publicadoId,
    qrSlug: SLUG_VIGENTE,
    name: "Plaza de Armas",
    orden: 1,
    latitude: 31.7274,
    longitude: -106.4849,
  });

  const retirada = await repos.circuits.createStop({
    circuitId: publicadoId,
    qrSlug: SLUG_RETIRADA,
    name: "Hospital viejo",
    orden: 2,
    latitude: 31.718,
    longitude: -106.48,
  });
  idDeLaRetirada = retirada.identidad.id;
  await repos.circuits.retireStop(idDeLaRetirada, "obra en la avenida");

  await repos.circuits.createStop({
    circuitId: escondidoId,
    qrSlug: SLUG_DEL_ESCONDIDO,
    name: "Terminal Norte",
    orden: 1,
    latitude: 31.74,
    longitude: -106.47,
  });
});

afterAll(async () => {
  /* Las paradas ya no caen por cascada (0055): se borran a mano, en este orden. */
  await db.delete(circuitStops).where(inArray(circuitStops.circuitId, [publicadoId, escondidoId]));
  await db.delete(circuits).where(inArray(circuits.id, [publicadoId, escondidoId]));
  await db.delete(accounts).where(eq(accounts.id, concesionId));
});

describe("lo que contesta un QR atornillado a un poste", () => {
  it("parada vigente de circuito publicado: abre, con su nombre y su ruta", async () => {
    const r = await repos.circuits.paradaPublicaPorQrSlug(SLUG_VIGENTE);
    expect(r?.situacion).toBe("vigente");
    expect(r?.nombre).toBe("Plaza de Armas");
    expect(r?.ruta.slug).toBe(`circuito-${marca}`);
    expect(r?.qrSlug).toBe(SLUG_VIGENTE);
  });

  /*
   * El letrero sigue en el poste aunque la parada ya no exista. Quien lo
   * escanea merece saber por qué y qué ruta era — no un 404 mudo.
   */
  it("parada retirada: lo dice, y dice de qué ruta era", async () => {
    const r = await repos.circuits.paradaPublicaPorQrSlug(SLUG_RETIRADA);
    expect(r?.situacion).toBe("retirada");
    expect(r?.ruta.nombre).toBe(`Circuito ${marca}`);
    /* El nombre impreso en la lámina, aunque su versión ya no esté vigente. */
    expect(r?.nombre).toBe("Hospital viejo");
  });

  /*
   * Los dos siguientes contestan LO MISMO a propósito. Lo no publicado no
   * existe para la app (8.4), y distinguirlo de un slug inventado sería decir
   * que existe.
   */
  it("circuito no publicado: contesta igual que un slug inventado", async () => {
    expect(await repos.circuits.paradaPublicaPorQrSlug(SLUG_DEL_ESCONDIDO)).toBeNull();
  });

  it("slug que no existe: lo mismo", async () => {
    expect(await repos.circuits.paradaPublicaPorQrSlug(SLUG_INVENTADO)).toBeNull();
  });

  /*
   * Y la vuelta: publicar el escondido lo hace aparecer, sin tocar la parada.
   * Es la comprobación de que el filtro es la publicación y no otra cosa.
   */
  it("al publicar ese circuito, su parada aparece — el filtro es la publicación", async () => {
    await repos.circuits.setCircuitPublished(escondidoId, true);
    try {
      const r = await repos.circuits.paradaPublicaPorQrSlug(SLUG_DEL_ESCONDIDO);
      expect(r?.situacion).toBe("vigente");
      expect(r?.nombre).toBe("Terminal Norte");
    } finally {
      await repos.circuits.setCircuitPublished(escondidoId, false);
    }
  });
});

/** Drizzle envuelve el error de la base; el mensaje de la restricción va en `cause`. */
const mensajeDeLaBase = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no falló";
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return `${err.cause?.code ?? ""} ${err.cause?.message ?? ""} ${err.message ?? ""}`;
  }
};

describe("la base no deja borrar un circuito con paradas (0055)", () => {
  /*
   * La razón no está en la base: está en la calle. Un DELETE convertiría en
   * callejón cada QR impreso de ese circuito, sin aviso y sin rastro.
   *
   * Se prueba que la base dice que no. Si esto se pusiera verde borrando de
   * verdad, el `afterAll` seguiría limpiando igual: borra las paradas primero.
   */
  it("el DELETE se rechaza, y el circuito sigue ahí con sus paradas", async () => {
    const dijo = await mensajeDeLaBase(db.delete(circuits).where(eq(circuits.id, publicadoId)));
    /* 23503: violación de llave foránea. El nombre de la tabla que la sostiene
       viaja en el mensaje, y es el que dice POR QUÉ no se puede. */
    expect(dijo).toContain("23503");
    expect(dijo).toContain("circuit_stops");

    const quedan = await db.select().from(circuitStops).where(eq(circuitStops.circuitId, publicadoId));
    expect(quedan.length).toBe(2);
  });

  /* Lo que SÍ se hace para dejar de darlo: despublicar. No borra nada. */
  it("despublicar sí se puede, y no borra ninguna parada", async () => {
    await repos.circuits.setCircuitPublished(publicadoId, false);
    try {
      expect(await repos.circuits.paradaPublicaPorQrSlug(SLUG_VIGENTE)).toBeNull();
      const quedan = await db
        .select()
        .from(circuitStops)
        .where(eq(circuitStops.circuitId, publicadoId));
      expect(quedan.length).toBe(2);
    } finally {
      await repos.circuits.setCircuitPublished(publicadoId, true);
    }
  });
});
