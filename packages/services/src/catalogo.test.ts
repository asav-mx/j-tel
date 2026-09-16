import { describe, expect, it } from "vitest";
import { cargarCatalogo, cargarReglaDeUnTipo, revisarEfectoDeRegla } from "./catalogo.js";

const AHORA = new Date("2026-09-16T18:00:00Z");
const CHH = { id: "m1", name: "Chihuahua", countryCode: "MX", stateCode: "CHH", municipality: null, timeZone: "America/Ciudad_Juarez", cuentas: 1 };
const OTRO = { ...CHH, id: "m2", name: "Sonora", stateCode: "SON", cuentas: 0 };
const tipo = (id: string, clave: string, subject: "unidad" | "chofer" = "unidad") => ({ id, marketId: "m1", subject, clave, name: clave, createdAt: AHORA });
const fila = (warningDays: number | null, creada: string, note = "Ley estatal") => ({
  id: `r-${creada}`, documentTypeId: "t1", required: true, expires: true, warningDays, periodicityMonths: null,
  actorKind: "human", actorId: "user_1", note, createdAt: new Date(creada),
});
const version = (expiresOn: string | null) => ({ folio: "F", issuedOn: null, expiresOn, expiryCalculated: false });

function repos(o: { mercados?: unknown[] } = {}) {
  return {
    expedientes: {
      mercados: async () => o.mercados ?? [CHH],
      catalogo: async (_m: string, s: string) =>
        [
          { tipo: tipo("t1", "poliza_de_seguro"), regla: null },
          { tipo: tipo("t2", "verificacion_vehicular"), regla: { obligatorio: true, vence: true, diasDeAviso: null, periodicidadMeses: 6 } },
          { tipo: tipo("l1", "licencia", "chofer"), regla: { obligatorio: true, vence: false, diasDeAviso: null, periodicidadMeses: null } },
        ].filter((c) => c.tipo.subject === s),
      sujetosDelTipo: async () => ({
        tipo: tipo("t1", "poliza_de_seguro"),
        mercado: CHH,
        sujetos: [
          { id: "u1", cuenta: "Juárez Bus", carrierAccountId: "c1", version: version("2026-09-10") },
          { id: "u2", cuenta: "Juárez Bus", carrierAccountId: "c1", version: version("2026-09-28") },
          { id: "u3", cuenta: "Juárez Bus", carrierAccountId: "c1", version: null },
        ],
      }),
      historialDeRegla: async () => [fila(30, "2026-09-16T10:00:00Z"), fila(15, "2026-09-01T10:00:00Z")],
      reglaVigente: async () => null,
    },
  } as never;
}

describe("el catálogo de un mercado", () => {
  it("con un solo mercado lo abre; cada tipo dice qué le falta a su regla", async () => {
    const c = await cargarCatalogo(repos(), { marketId: null });
    expect(c.mercado).toMatchObject({ nombre: "Chihuahua", clave: "MX-CHH" });
    expect(c.unidad.map((t) => [t.clave, t.faltan])).toEqual([
      ["poliza_de_seguro", ["obligatorio", "vence"]],
      ["verificacion_vehicular", ["dias_de_aviso"]],
    ]);
    expect(c.chofer[0]!.faltan).toEqual([]);
  });

  it("con varios mercados y ninguno elegido, no escoge por su cuenta", async () => {
    const c = await cargarCatalogo(repos({ mercados: [CHH, OTRO] }), { marketId: null });
    expect(c.mercado).toBeNull();
    expect((await cargarCatalogo(repos({ mercados: [CHH, OTRO] }), { marketId: "m2" })).mercado?.nombre).toBe("Sonora");
  });
});

describe("la regla de un tipo", () => {
  it("la vigente es la más reciente, con su historia, y dice a quién juzga", async () => {
    const r = await cargarReglaDeUnTipo(repos(), { documentTypeId: "t1" });
    expect(r?.regla).toMatchObject({ diasDeAviso: 30 });
    expect(r?.historial.map((h) => h.regla.diasDeAviso)).toEqual([30, 15]);
    expect(r?.juzga).toEqual({ sujetos: 3, cuentas: ["Juárez Bus"] });
  });
});

describe("revisar el efecto de una regla, sin escribir nada", () => {
  it("antes sin regla; con la propuesta, cuántos pasan a pedir algo", async () => {
    const e = await revisarEfectoDeRegla(repos(), {
      documentTypeId: "t1",
      propuesta: { obligatorio: true, vence: true, diasDeAviso: 30, periodicidadMeses: null },
      ahora: AHORA,
    });
    expect(e?.hoy).toBe("2026-09-16");
    expect(e?.antes).toMatchObject({ vencido: 1, falta_la_regla: 2 });
    expect(e?.despues).toMatchObject({ vencido: 1, por_vencer: 1, falta: 1 });
    expect(e?.pasanAPedirAlgo).toBe(2);
    expect(e?.sujetos).toBe(3);
  });
});
