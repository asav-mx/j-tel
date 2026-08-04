import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * El fallback que agarraba la primera cuenta del tipo.
 *
 * `resolveAccountByType` terminaba en `listByType(type)[0]`: **sin `?account=`
 * tomaba la primera cuenta de la tabla, fuera de quien fuera**. Con un solo
 * cliente real era invisible; con dos, una fuga — y bastaba con no pasar el
 * parámetro para que te enseñara la cuenta de otro.
 *
 * Lo que se mide aquí es que el default salga **del alcance de quien pregunta**
 * y no del orden de la tabla.
 */

const getIdentidad = vi.fn();
const findBySlug = vi.fn();
const listByType = vi.fn();

vi.mock("./auth", () => ({ getIdentidad: () => getIdentidad() }));
vi.mock("./db", () => ({
  getRepos: () => ({
    accounts: {
      findBySlug: (s: string) => findBySlug(s),
      listByType: (t: string) => listByType(t),
    },
  }),
}));

const { resolveAccountByType } = await import("./account-context");

const TECMA = { id: "acc-tecma", slug: "tecma", type: "client" as const };
const HONEYWELL = { id: "acc-honeywell", slug: "honeywell", type: "client" as const };

function identidad(memberships: unknown[]) {
  return { userId: "u", origen: "clerk", memberships, clerkConfigurado: true, sesionActiva: true, encabezadoRechazado: false };
}

const soloTecma = [
  { accountId: "acc-tecma", clerkUserId: "u", role: "admin_corporativo", scopeType: "account" },
];
const global = [
  { accountId: "acc-jstaff", clerkUserId: "u", role: "admin_plataforma", scopeType: "global" },
];

beforeEach(() => {
  getIdentidad.mockReset();
  findBySlug.mockReset();
  listByType.mockReset();
  getIdentidad.mockResolvedValue(identidad(soloTecma));
  listByType.mockResolvedValue([TECMA, HONEYWELL]);
});

describe("con ?account=", () => {
  it("devuelve la cuenta si está dentro de tu alcance", async () => {
    findBySlug.mockResolvedValue(TECMA);
    expect(await resolveAccountByType("client", { account: "tecma" })).toEqual(TECMA);
  });

  /*
   * El agujero original: el parámetro elegía y nadie comprobaba. Un usuario de
   * Tecma escribía ?account=honeywell y la pantalla le contestaba.
   */
  it("NO devuelve una cuenta fuera de tu alcance, aunque exista", async () => {
    findBySlug.mockResolvedValue(HONEYWELL);
    expect(await resolveAccountByType("client", { account: "honeywell" })).toBeNull();
  });

  it("no devuelve una cuenta de otro tipo", async () => {
    findBySlug.mockResolvedValue({ ...TECMA, type: "carrier" });
    expect(await resolveAccountByType("client", { account: "tecma" })).toBeNull();
  });
});

describe("sin ?account=, el default sale del alcance y no de la tabla", () => {
  it("con una sola cuenta alcanzable, la elige", async () => {
    expect(await resolveAccountByType("client", undefined)).toEqual(TECMA);
  });

  /*
   * La prueba que impide que el fallback vuelva. `listByType` devuelve
   * [TECMA, HONEYWELL] en ese orden: si alguien reintrodujera `[0]`, esto
   * pasaría por accidente. Por eso el caso que importa es el de varias.
   */
  it("con varias alcanzables NO adivina: devuelve null", async () => {
    getIdentidad.mockResolvedValue(identidad(global));
    expect(await resolveAccountByType("client", undefined)).toBeNull();
  });

  it("sin ninguna alcanzable, null", async () => {
    getIdentidad.mockResolvedValue(identidad([]));
    expect(await resolveAccountByType("client", undefined)).toBeNull();
  });

  it("el alcance global sí puede elegir cuando solo hay una del tipo", async () => {
    getIdentidad.mockResolvedValue(identidad(global));
    listByType.mockResolvedValue([TECMA]);
    expect(await resolveAccountByType("client", undefined)).toEqual(TECMA);
  });
});
