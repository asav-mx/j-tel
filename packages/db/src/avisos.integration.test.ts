import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuitNotices } from "../src/index.js";

/*
 * Los avisos de la concesión (0052), contra la rama desechable: lo que la base
 * cuida (sus CHECK) y lo que el repositorio promete (firmar, retirar con motivo,
 * y que Ontoy sólo vea lo vigente).
 *
 * ⚠ Requiere la 0052 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) throw new Error("[avisos] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) throw new Error("[avisos] DATABASE_URL_TEST es producción. Estas pruebas escriben.");

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `a${Date.now().toString(36)}`;
let concesionId = "";
let circuitoId = "";
let otroCircuitoId = "";
const AHORA = new Date();
const en = (min: number) => new Date(AHORA.getTime() + min * 60_000);

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({ name: `Concesión ${marca}`, slug: `concesion-${marca}`, legalName: `Concesión ${marca} SA` });
  concesionId = cuenta.id;
  circuitoId = (await repos.circuits.createCircuit({ concessionAccountId: concesionId, name: `Circuito ${marca}`, publicSlug: `circuito-${marca}` })).id;
  otroCircuitoId = (await repos.circuits.createCircuit({ concessionAccountId: concesionId, name: `Otro ${marca}`, publicSlug: `otro-${marca}` })).id;
});

afterAll(async () => {
  await db.delete(accounts).where(inArray(accounts.id, [concesionId].filter(Boolean)));
});

async function violacion(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const causa = (e as { cause?: { code?: string; constraint_name?: string } })?.cause;
    return causa?.code === "23514" ? (causa.constraint_name ?? "sin nombre") : `otro: ${causa?.code}`;
  }
}

const aviso = (o: Partial<{ titulo: string; detalle: string | null; vigenteDesde: Date; vigenteHasta: Date | null }> = {}) => ({
  titulo: "La ruta va por Av. de la Raza",
  detalle: "Mientras dure la obra en Tecnológico.",
  vigenteDesde: en(-10),
  vigenteHasta: null,
  ...o,
});

describe("crear un aviso", () => {
  it("queda firmado con quién lo capturó", async () => {
    const r = await repos.circuits.crearAviso(circuitoId, aviso(), "user_jstaff");
    expect(r.ok && r.aviso.capturadoPor).toBe("user_jstaff");
  });

  it("sin quién no se escribe nada", async () => {
    expect(await repos.circuits.crearAviso(circuitoId, aviso(), null)).toEqual({ ok: false, error: "falta_quien" });
  });
});

describe("los CHECK de la 0052", () => {
  const directo = (v: Record<string, unknown>) =>
    violacion(() => db.insert(circuitNotices).values({ circuitId, ...aviso(), capturadoPor: "prueba", ...v } as never));
  let circuitId = "";
  beforeAll(() => {
    circuitId = circuitoId;
  });

  it("título vacío o de más de 80", async () => {
    expect(await directo({ titulo: "   " })).toBe("circuit_notices_titulo");
    expect(await directo({ titulo: "x".repeat(81) })).toBe("circuit_notices_titulo");
  });
  it("detalle de más de 280", async () => {
    expect(await directo({ detalle: "x".repeat(281) })).toBe("circuit_notices_detalle");
  });
  it("«hasta» antes de «desde»", async () => {
    expect(await directo({ vigenteDesde: en(10), vigenteHasta: en(5) })).toBe("circuit_notices_vigencia");
  });
  it("un retiro a medias: sin motivo o sin quién", async () => {
    expect(await directo({ retiradoEn: AHORA, retiradoPor: "prueba" })).toBe("circuit_notices_retiro");
    expect(await directo({ retiradoEn: AHORA, motivoRetiro: "ya no aplica" })).toBe("circuit_notices_retiro");
  });
});

describe("retirar un aviso", () => {
  it("con motivo y firmado; retirar otra vez no mueve nada", async () => {
    const r = await repos.circuits.crearAviso(circuitoId, aviso({ titulo: "Para retirar" }), "user_jstaff");
    const id = r.ok ? r.aviso.id : "";
    expect(await repos.circuits.retirarAviso(circuitoId, id, { motivo: "", por: "user_jstaff" })).toEqual({ ok: false, error: "falta_motivo" });
    expect(await repos.circuits.retirarAviso(circuitoId, id, { motivo: "Terminó la obra", por: "user_jstaff" })).toEqual({ ok: true, retirado: true });
    const [fila] = await db.select().from(circuitNotices).where(eq(circuitNotices.id, id));
    expect(fila?.motivoRetiro).toBe("Terminó la obra");
    expect(fila?.retiradoPor).toBe("user_jstaff");
    expect(await repos.circuits.retirarAviso(circuitoId, id, { motivo: "otra vez", por: "otro" })).toEqual({ ok: true, retirado: false });
  });

  it("el aviso de OTRO circuito no existe desde aquí", async () => {
    const r = await repos.circuits.crearAviso(otroCircuitoId, aviso({ titulo: "De otro circuito" }), "user_jstaff");
    const id = r.ok ? r.aviso.id : "";
    expect(await repos.circuits.retirarAviso(circuitoId, id, { motivo: "no", por: "user_jstaff" })).toEqual({ ok: false, error: "no_existe" });
  });
});

describe("lo que Ontoy ve: sólo lo vigente, y sin la firma", () => {
  it("ni lo retirado, ni lo programado, ni lo que terminó", async () => {
    const c = (await repos.circuits.createCircuit({ concessionAccountId: concesionId, name: `Vigentes ${marca}`, publicSlug: `vigentes-${marca}` })).id;
    const crear = async (titulo: string, o: Parameters<typeof aviso>[0]) => {
      const r = await repos.circuits.crearAviso(c, aviso({ titulo, ...o }), "user_jstaff");
      return r.ok ? r.aviso.id : "";
    };
    await crear("Vigente", {});
    await crear("Programado", { vigenteDesde: en(60) });
    await crear("Terminó", { vigenteDesde: en(-120), vigenteHasta: en(-60) });
    const retirado = await crear("Retirado", {});
    await repos.circuits.retirarAviso(c, retirado, { motivo: "ya no", por: "user_jstaff" });

    const vigentes = await repos.circuits.listAvisosVigentes(c, AHORA);
    expect(vigentes.map((v) => v.titulo)).toEqual(["Vigente"]);
    expect(Object.keys(vigentes[0]!).sort()).toEqual(["detalle", "id", "titulo", "vigenteDesde", "vigenteHasta"]);
    expect((await repos.circuits.listAvisos(c)).length).toBe(4);
  });
});
