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
/** La tabla de cuentas. `listByType` filtra por tipo como la base de verdad. */
const tabla = vi.fn();

vi.mock("./auth", () => ({ getIdentidad: () => getIdentidad() }));
vi.mock("./db", () => ({
  getRepos: () => ({
    accounts: {
      listByType: async (t: string) => ((await tabla()) as { type: string }[]).filter((c) => c.type === t),
    },
  }),
}));

const { resolveAccountByType, resolverCuentaYElegibles } = await import("./account-context");

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
  tabla.mockReset();
  getIdentidad.mockResolvedValue(identidad(soloTecma));
  tabla.mockResolvedValue([TECMA, HONEYWELL]);
});

describe("con ?account=", () => {
  it("devuelve la cuenta si está dentro de tu alcance", async () => {
    expect(await resolveAccountByType("client", { account: "tecma" })).toEqual(TECMA);
  });

  /*
   * El agujero original: el parámetro elegía y nadie comprobaba. Un usuario de
   * Tecma escribía ?account=honeywell y la pantalla le contestaba.
   */
  it("NO devuelve una cuenta fuera de tu alcance, aunque exista", async () => {
    expect(await resolveAccountByType("client", { account: "honeywell" })).toBeNull();
  });

  it("no devuelve una cuenta que no existe", async () => {
    expect(await resolveAccountByType("client", { account: "no-existe" })).toBeNull();
  });

  it("no devuelve una cuenta de otro tipo", async () => {
    tabla.mockResolvedValue([{ ...TECMA, type: "carrier" }, HONEYWELL]);
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
    tabla.mockResolvedValue([TECMA]);
    expect(await resolveAccountByType("client", undefined)).toEqual(TECMA);
  });
});

/*
 * El selector de cuenta del cascarón ofrece `elegibles`. Tienen que ser
 * exactamente las que la guardia acepta: un selector que ofrece una cuenta que
 * luego se rechaza es un botón que miente.
 */
describe("las elegibles, para el selector de cuenta", () => {
  it("son sólo las de tu alcance, y con ellas no se adivina la cuenta", async () => {
    getIdentidad.mockResolvedValue(identidad(global));
    const { cuenta, elegibles } = await resolverCuentaYElegibles("client", undefined);
    expect(cuenta).toBeNull();
    expect(elegibles).toEqual([TECMA, HONEYWELL]);
  });

  it("no incluyen una cuenta fuera de tu alcance", async () => {
    const { elegibles } = await resolverCuentaYElegibles("client", { account: "honeywell" });
    expect(elegibles).toEqual([TECMA]);
  });

  it("la cuenta elegida por ?account= siempre es una de las elegibles", async () => {
    getIdentidad.mockResolvedValue(identidad(global));
    const { cuenta, elegibles } = await resolverCuentaYElegibles("client", { account: "honeywell" });
    expect(cuenta).toEqual(HONEYWELL);
    expect(elegibles).toContain(cuenta);
  });
});
