import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  sembrarEscenarioDosCarriers,
  ESCENARIO_B,
  type EscenarioDosCarriers,
} from "@jtel/db";

/**
 * La guardia del transportista, contra la base de verdad.
 *
 * Las de `guardia-recurso.test.ts` prueban la DECISIÓN con membresías
 * inventadas. Éstas prueban la otra mitad: que la **procedencia** —de quién es
 * esta fila— salga bien de la base para las tres formas de recurso del carrier,
 * y que la guardia entera niegue con datos reales.
 *
 * ## Por qué la audiencia se prueba aquí y no solo con mocks
 *
 * Una guardia de carrier que preguntara por la tabla de clientes devolvería un
 * veredicto y se vería perfecta. En el escenario de hoy pasaría desapercibida
 * casi siempre: `frontera_admin` alcanza su cuenta por `scopeType: "account"`,
 * y **las dos funciones de alcance coinciden ahí**.
 *
 * El único testigo que nota la diferencia es `frontera_flota`, que alcanza por
 * `scopeType: "fleet"` — algo que `canAccessClientAccount` no reconoce. Si
 * alguien cambia la audiencia de estas páginas, esa persona deja de entrar a
 * lo suyo y estas pruebas caen. Sin ella, la mutación sobreviviría verde.
 */

let e: EscenarioDosCarriers;

const getIdentidad = vi.fn();
vi.mock("@/lib/auth", () => ({ getIdentidad: () => getIdentidad() }));

type Membresia = {
  accountId: string;
  clerkUserId: string;
  role: string;
  scopeType: string;
};

function conSesion(memberships: Membresia[]) {
  return {
    userId: "user_x",
    origen: "clerk",
    memberships,
    clerkConfigurado: true,
    sesionActiva: true,
    encabezadoRechazado: false,
  };
}

/** Como entra el admin de B: por cuenta. Las dos audiencias lo aceptan. */
const porCuenta = (accountId: string): Membresia[] => [
  { accountId, clerkUserId: ESCENARIO_B.usuario, role: "admin", scopeType: "account" },
];

/** Como entra el de flota de B. Solo la audiencia de CARRIER lo acepta. */
const porFlota = (accountId: string): Membresia[] => [
  { accountId, clerkUserId: ESCENARIO_B.usuarioFlota, role: "admin", scopeType: "fleet" },
];

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no llegó al proceso (la config debió ponerla)");
  e = await sembrarEscenarioDosCarriers(url);
});

describe("la procedencia del lado carrier sale de la fila", () => {
  it("de la unidad, del contrato y del servicio — cada una a su dueño", async () => {
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;

    expect(await p.deUnidad(e.deB.unidadId)).toBe(e.carrierB.id);
    expect(await p.deUnidad(e.deA.unidadId)).toBe(e.carrierA.id);

    expect(await p.carrierDeContrato(e.deB.contratoId)).toBe(e.carrierB.id);
    expect(await p.carrierDeContrato(e.deA.contratoId)).toBe(e.carrierA.id);

    expect(await p.carrierDeServicio(e.deB.ocurrenciaId)).toBe(e.carrierB.id);
    expect(await p.carrierDeServicio(e.deA.ocurrenciaId)).toBe(e.carrierA.id);
  });

  it("un id que no existe no tiene dueño — y no revienta", async () => {
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    const fantasma = "00000000-0000-4000-8000-0000000000ff";

    expect(await p.deUnidad(fantasma)).toBeNull();
    expect(await p.carrierDeContrato(fantasma)).toBeNull();
    expect(await p.carrierDeServicio(fantasma)).toBeNull();
  });

  it("la procedencia de carrier NO devuelve la del cliente — son consultas distintas", async () => {
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;

    const carrier = await p.carrierDeContrato(e.deA.contratoId);
    const cliente = await p.deContrato(e.deA.contratoId);

    // Si alguien copiara la consulta de cliente en la de carrier, esto sería
    // igual y toda la guardia mediría contra la pared equivocada.
    expect(carrier).not.toBe(cliente);
    expect(carrier).toBe(e.carrierA.id);
  });
});

describe("la guardia niega lo ajeno con datos reales", () => {
  it("B no pasa por la unidad, el contrato ni el servicio de A", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porCuenta(e.carrierB.id)));

    const unidad = await decidirRecurso("carrier", () => p.deUnidad(e.deA.unidadId), {
      enProduccion: true,
    });
    const contrato = await decidirRecurso(
      "carrier",
      () => p.carrierDeContrato(e.deA.contratoId),
      { enProduccion: true },
    );
    const servicio = await decidirRecurso(
      "carrier",
      () => p.carrierDeServicio(e.deA.ocurrenciaId),
      { enProduccion: true },
    );

    expect(unidad).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
    expect(contrato).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
    expect(servicio).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
  });

  it("y sí pasa por lo suyo — el control, o la prueba de arriba pasa por vacía", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porCuenta(e.carrierB.id)));

    const unidad = await decidirRecurso("carrier", () => p.deUnidad(e.deB.unidadId), {
      enProduccion: true,
    });
    const contrato = await decidirRecurso(
      "carrier",
      () => p.carrierDeContrato(e.deB.contratoId),
      { enProduccion: true },
    );
    const servicio = await decidirRecurso(
      "carrier",
      () => p.carrierDeServicio(e.deB.ocurrenciaId),
      { enProduccion: true },
    );

    expect(unidad).toMatchObject({ ok: true, cuenta: e.carrierB.id });
    expect(contrato).toMatchObject({ ok: true, cuenta: e.carrierB.id });
    expect(servicio).toMatchObject({ ok: true, cuenta: e.carrierB.id });
  });

  it("«no existe» y «no es tuyo» siguen siendo el mismo caso, también aquí", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porCuenta(e.carrierB.id)));

    const fantasma = await decidirRecurso(
      "carrier",
      () => p.deUnidad("00000000-0000-4000-8000-0000000000ff"),
      { enProduccion: true },
    );
    const ajena = await decidirRecurso("carrier", () => p.deUnidad(e.deA.unidadId), {
      enProduccion: true,
    });

    expect(ajena).toEqual(fantasma);
  });
});

/**
 * El testigo de la audiencia.
 *
 * Si alguien cambia `"carrier"` por `"cliente"` en las páginas del
 * transportista, ESTA prueba es la que cae. Las demás no se enteran, porque
 * una membresía de cuenta la aceptan las dos funciones de alcance.
 */
describe("la audiencia — el fallo que se ve igual que el correcto", () => {
  it("el usuario de FLOTA de B entra a lo suyo con audiencia de carrier", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porFlota(e.carrierB.id)));

    const v = await decidirRecurso("carrier", () => p.deUnidad(e.deB.unidadId), {
      enProduccion: true,
    });

    expect(v).toMatchObject({ ok: true, cuenta: e.carrierB.id });
  });

  it("el MISMO usuario y la MISMA unidad, medidos contra la pared del cliente, quedan fuera", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porFlota(e.carrierB.id)));

    const v = await decidirRecurso("cliente", () => p.deUnidad(e.deB.unidadId), {
      enProduccion: true,
    });

    // Ésta es la firma del error: no deja entrar a lo ajeno —eso lo hace bien—
    // pero tampoco deja entrar al dueño. Y como el dueño más común sí entra,
    // el síntoma no aparece hasta que existe alguien con alcance de flota.
    expect(v).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
  });

  it("con audiencia de carrier, B sigue sin alcanzar a A — la audiencia no afloja la pared", async () => {
    const { decidirRecurso } = await import("./guardia-pagina");
    const { getRepos } = await import("./db");
    const p = getRepos().procedencia;
    getIdentidad.mockResolvedValue(conSesion(porFlota(e.carrierB.id)));

    const v = await decidirRecurso("carrier", () => p.deUnidad(e.deA.unidadId), {
      enProduccion: true,
    });

    expect(v).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
  });
});
