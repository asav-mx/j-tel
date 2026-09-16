import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  FojaFueraDeCatalogo,
  accounts,
  documents,
  documentTypeRules,
  documentVersions,
  units,
} from "../src/index.js";

/*
 * Que los candados de la 0038 MUERDAN, y que el repositorio del expediente haga
 * el viaje completo contra una base de verdad.
 *
 * El runbook de producción sólo LEE (docs/Procedimiento-Migraciones.md, la
 * regla del 27 de agosto): que un CHECK o un trigger rechace lo que debe se
 * ejerce aquí, contra la rama desechable, donde una sentencia puede fallar a
 * propósito sin tumbar nada.
 *
 * ⚠ Requiere la 0038 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) throw new Error("[expediente-documentos] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[expediente-documentos] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `x${Date.now().toString(36)}`;
const ACTOR = { kind: "prueba", id: `integracion-${marca}` };
let cuentaA = "";
let cuentaB = "";
let cliente = "";
let unidadA = "";
let unidadB = "";
let chihuahua = "";
let poliza = "";
let verificacion = "";
let licencia = "";

beforeAll(async () => {
  const mercado = await repos.expedientes.mercadoPorLugar("MX", "CHH", null);
  if (!mercado) throw new Error("La rama de prueba no tiene el mercado de Chihuahua: falta aplicar la 0038.");
  chihuahua = mercado.id;

  cuentaA = (await repos.accounts.create({ type: "carrier", name: `Carrier A ${marca}`, slug: `carrier-a-${marca}`, isDemo: true })).id;
  cuentaB = (await repos.accounts.create({ type: "carrier", name: `Carrier B ${marca}`, slug: `carrier-b-${marca}`, isDemo: true })).id;
  cliente = (await repos.accounts.create({ type: "client", name: `Cliente ${marca}`, slug: `cliente-${marca}`, isDemo: true })).id;
  unidadA = (await repos.fleet.createUnit(cuentaA, `A-${marca}`)).id;
  unidadB = (await repos.fleet.createUnit(cuentaB, `B-${marca}`)).id;
  await repos.expedientes.asignarMercado(cuentaA, chihuahua);

  const deUnidad = await repos.expedientes.catalogo(chihuahua, "unidad");
  const deChofer = await repos.expedientes.catalogo(chihuahua, "chofer");
  poliza = deUnidad.find((c) => c.tipo.clave === "poliza_de_seguro")!.tipo.id;
  verificacion = deUnidad.find((c) => c.tipo.clave === "verificacion_vehicular")!.tipo.id;
  licencia = deChofer.find((c) => c.tipo.clave === "licencia")!.tipo.id;
});

afterAll(async () => {
  const ids = [cuentaA, cuentaB, cliente].filter(Boolean);
  // Las reglas de prueba no cuelgan de ninguna cuenta: se borran por su autor.
  await db.delete(documentTypeRules).where(eq(documentTypeRules.actorId, ACTOR.id));
  await db.delete(accounts).where(inArray(accounts.id, ids));
});

/** El código de Postgres con que se rechazó la escritura, o `null` si pasó. */
async function rechazo(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const causa = (e as { cause?: { code?: string; constraint_name?: string } })?.cause;
    return causa?.constraint_name ?? causa?.code ?? "otro";
  }
}

describe("Chihuahua nace con su catálogo, sin reglas", () => {
  it("siete nombres: cuatro de unidad y tres de chofer", async () => {
    const deUnidad = await repos.expedientes.catalogo(chihuahua, "unidad");
    const deChofer = await repos.expedientes.catalogo(chihuahua, "chofer");
    expect(deUnidad.map((c) => c.tipo.clave).sort()).toEqual([
      "permiso_transporte_personal",
      "poliza_de_seguro",
      "tarjeta_de_circulacion",
      "verificacion_vehicular",
    ]);
    expect(deChofer.map((c) => c.tipo.clave).sort()).toEqual(["antidoping", "examen_medico", "licencia"]);
  });
});

describe("el mercado es de las cuentas de carrier", () => {
  it("la cuenta sabe su mercado, con su zona horaria", async () => {
    expect(await repos.expedientes.mercadoDeCuenta(cuentaA)).toMatchObject({ id: chihuahua, timeZone: "America/Ciudad_Juarez" });
    expect(await repos.expedientes.mercadoDeCuenta(cuentaB)).toBeNull();
  });

  it("accounts_mercado_solo_carrier: un cliente no puede tener mercado", async () => {
    expect(await rechazo(() => repos.expedientes.asignarMercado(cliente, chihuahua))).toBe("accounts_mercado_solo_carrier");
  });
});

describe("las reglas se versionan, no se editan", () => {
  it("la vigente es la más reciente, y la anterior se queda con su autor", async () => {
    await repos.expedientes.agregarVersionDeRegla(
      verificacion,
      { obligatorio: true, vence: true, diasDeAviso: 15, periodicidadMeses: 6 },
      ACTOR,
    );
    await repos.expedientes.agregarVersionDeRegla(
      verificacion,
      { obligatorio: true, vence: true, diasDeAviso: 1, periodicidadMeses: 6 },
      { ...ACTOR, nota: "la verificación se renueva en un día" },
    );
    expect(await repos.expedientes.reglaVigente(verificacion)).toEqual({
      obligatorio: true,
      vence: true,
      diasDeAviso: 1,
      periodicidadMeses: 6,
    });
    const historial = await repos.expedientes.historialDeRegla(verificacion);
    expect(historial.filter((h) => h.actorId === ACTOR.id).map((h) => h.warningDays)).toEqual([1, 15]);
  });

  it("document_type_rules_sin_edicion: el UPDATE se rechaza", async () => {
    expect(
      await rechazo(() => db.update(documentTypeRules).set({ warningDays: 99 }).where(eq(documentTypeRules.actorId, ACTOR.id))),
    ).toBe("23514");
  });

  it("document_type_rules_aviso: días de aviso para un papel que no se sabe si vence", async () => {
    expect(
      await rechazo(() =>
        repos.expedientes.agregarVersionDeRegla(poliza, { obligatorio: true, vence: null, diasDeAviso: 30, periodicidadMeses: null }, ACTOR),
      ),
    ).toBe("document_type_rules_aviso");
  });

  it("document_type_rules_periodicidad: periodicidad para un papel que no vence", async () => {
    expect(
      await rechazo(() =>
        repos.expedientes.agregarVersionDeRegla(poliza, { obligatorio: true, vence: false, diasDeAviso: null, periodicidadMeses: 12 }, ACTOR),
      ),
    ).toBe("document_type_rules_periodicidad");
  });
});

describe("capturar, corregir y renovar una foja", () => {
  it("sin fecha impresa y con periodicidad, el vencimiento se calcula y queda marcado", async () => {
    const { documento, version } = await repos.expedientes.capturarFoja({
      carrierAccountId: cuentaA,
      documentTypeId: verificacion,
      sujeto: { unidadId: unidadA },
      datos: { folio: "V-1", emitidoEl: "2026-08-31", venceElImpreso: null },
      actor: ACTOR,
    });
    expect(documento.unitId).toBe(unidadA);
    expect(version).toMatchObject({ expiresOn: "2027-02-28", expiryCalculated: true });
  });

  it("corregir agrega una versión; la foja no cambia de id", async () => {
    const [{ foja }] = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    const corregida = await repos.expedientes.corregirFoja({
      carrierAccountId: cuentaA,
      documentId: foja.id,
      datos: { folio: "V-1", emitidoEl: "2026-08-31", venceElImpreso: "2027-02-15" },
      actor: { ...ACTOR, nota: "la fecha venía impresa" },
    });
    expect(corregida).toMatchObject({ documentId: foja.id, expiresOn: "2027-02-15", expiryCalculated: false });
    const [leida] = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    expect(leida!.versiones.map((v) => v.expiresOn)).toEqual(["2027-02-15", "2027-02-28"]);
  });

  it("renovar es capturar otra foja: la anterior se queda", async () => {
    await repos.expedientes.capturarFoja({
      carrierAccountId: cuentaA,
      documentTypeId: verificacion,
      sujeto: { unidadId: unidadA },
      datos: { folio: "V-2", emitidoEl: null, venceElImpreso: "2027-08-15" },
      actor: ACTOR,
    });
    const fojas = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    expect(fojas.map((f) => f.versiones[0]!.folio)).toEqual(["V-2", "V-1"]);
  });

  it("documents_sin_edicion y document_versions_sin_edicion: el UPDATE se rechaza", async () => {
    expect(await rechazo(() => db.update(documents).set({ actorId: "otro" }).where(eq(documents.carrierAccountId, cuentaA)))).toBe("23514");
    const [{ foja }] = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    expect(await rechazo(() => db.update(documentVersions).set({ folio: "X" }).where(eq(documentVersions.documentId, foja.id)))).toBe(
      "23514",
    );
  });

  it("document_versions_calculada_con_fechas y fechas_en_orden", async () => {
    const [{ foja }] = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    const base = { documentId: foja.id, actorKind: "prueba", actorId: ACTOR.id };
    expect(await rechazo(() => db.insert(documentVersions).values({ ...base, expiryCalculated: true }))).toBe(
      "document_versions_calculada_con_fechas",
    );
    expect(
      await rechazo(() => db.insert(documentVersions).values({ ...base, issuedOn: "2026-09-01", expiresOn: "2026-08-01" })),
    ).toBe("document_versions_fechas_en_orden");
  });
});

describe("el muro entre cuentas", () => {
  it("una cuenta sin mercado no captura papeles de ningún catálogo", async () => {
    await expect(
      repos.expedientes.capturarFoja({
        carrierAccountId: cuentaB,
        documentTypeId: poliza,
        sujeto: { unidadId: unidadB },
        datos: { folio: null, emitidoEl: null, venceElImpreso: null },
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(FojaFueraDeCatalogo);
  });

  it("un papel de chofer no se captura sobre una unidad", async () => {
    await expect(
      repos.expedientes.capturarFoja({
        carrierAccountId: cuentaA,
        documentTypeId: licencia,
        sujeto: { unidadId: unidadA },
        datos: { folio: null, emitidoEl: null, venceElImpreso: null },
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(FojaFueraDeCatalogo);
  });

  it("documents_unidad_de_su_cuenta: ni un guion puede poner el papel de A sobre la unidad de B", async () => {
    expect(
      await rechazo(() =>
        db.insert(documents).values({ carrierAccountId: cuentaA, documentTypeId: poliza, unitId: unidadB, actorKind: "prueba", actorId: ACTOR.id }),
      ),
    ).toBe("documents_unidad_de_su_cuenta");
  });

  it("documents_un_sujeto: una foja sin sujeto no se escribe", async () => {
    expect(
      await rechazo(() => db.insert(documents).values({ carrierAccountId: cuentaA, documentTypeId: poliza, actorKind: "prueba", actorId: ACTOR.id })),
    ).toBe("documents_un_sujeto");
  });

  it("corregir la foja de otra cuenta devuelve nada y no escribe", async () => {
    const [{ foja }] = await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA });
    const antes = (await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA }))[0]!.versiones.length;
    expect(
      await repos.expedientes.corregirFoja({
        carrierAccountId: cuentaB,
        documentId: foja.id,
        datos: { folio: "robo", emitidoEl: null, venceElImpreso: null },
        actor: ACTOR,
      }),
    ).toBeNull();
    expect((await repos.expedientes.fojasDeSujeto(cuentaA, { unidadId: unidadA }))[0]!.versiones.length).toBe(antes);
    expect(await repos.expedientes.fojasDeSujeto(cuentaB, { unidadId: unidadA })).toEqual([]);
  });
});

describe("las lecturas del catálogo (D2)", () => {
  it("cada mercado cuenta sus cuentas de verdad", async () => {
    const mercado = (await repos.expedientes.mercados()).find((m) => m.id === chihuahua)!;
    const [{ n }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM accounts WHERE market_id = ${chihuahua}`)) as unknown as [{ n: number }];
    expect(Number(mercado.cuentas)).toBe(Number(n));
    expect(Number(mercado.cuentas)).toBeGreaterThanOrEqual(1); // la cuenta A de esta prueba
  });

  it("los sujetos de un tipo: las unidades activas del mercado, cada una con su foja vigente", async () => {
    const datos = await repos.expedientes.sujetosDelTipo(verificacion);
    const deA = datos!.sujetos.filter((s) => s.carrierAccountId === cuentaA);
    expect(deA.map((s) => s.id)).toEqual([unidadA]);
    // La vigente es la renovación («V-2»), no la foja corregida de antes.
    expect(deA[0]!.version?.folio).toBe("V-2");
    // La cuenta B no tiene mercado: sus unidades no las juzga este catálogo.
    expect(datos!.sujetos.some((s) => s.carrierAccountId === cuentaB)).toBe(false);
  });
});

describe("lo que tuvo papeles no se borra solo", () => {
  it("borrar una unidad con fojas falla (6.15)", async () => {
    expect(await rechazo(() => db.delete(units).where(eq(units.id, unidadA)))).toBe("documents_unidad_de_su_cuenta");
  });

  it("borrar la CUENTA entera sí arrastra fojas, versiones y unidades", async () => {
    const tmp = (await repos.accounts.create({ type: "carrier", name: `Tmp ${marca}`, slug: `tmp-${marca}`, isDemo: true })).id;
    const u = (await repos.fleet.createUnit(tmp, `T-${marca}`)).id;
    await repos.expedientes.asignarMercado(tmp, chihuahua);
    await repos.expedientes.capturarFoja({
      carrierAccountId: tmp,
      documentTypeId: poliza,
      sujeto: { unidadId: u },
      datos: { folio: "P-1", emitidoEl: null, venceElImpreso: "2027-01-01" },
      actor: ACTOR,
    });
    await db.delete(accounts).where(eq(accounts.id, tmp));
    const [quedan] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM documents WHERE carrier_account_id = ${tmp}`);
    expect(Number(quedan!.n)).toBe(0);
  });
});
