import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La audiencia de cliente en la guardia — las dos formas.
 *
 * `cliente` compara contra un slug que viene en la petición; `cliente-por-id`
 * compara contra una cuenta que el servidor DERIVÓ de un recurso. La segunda
 * existe para las rutas que no reciben cuenta: pedirles un slug sería volver a
 * dejar que la petición eligiera contra quién se compara.
 *
 * El fallo cerrado genérico vive en `guardia-api.test.ts`; aquí se mide solo
 * lo que agrega la tanda de cliente.
 */

const getIdentidad = vi.fn();
const findBySlug = vi.fn();

vi.mock("@/lib/auth", () => ({ getIdentidad: () => getIdentidad() }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));

const { exigir } = await import("./guardia-api");

const PETICION = new Request("https://j-tel.io/api/cliente/turnos", { method: "POST" });

const TECMA = [
  {
    accountId: "cuenta-tecma",
    clerkUserId: "tecma_admin",
    role: "admin_corporativo",
    scopeType: "account" as const,
    scopeId: "cuenta-tecma",
  },
];

function identidad(userId: string, memberships: unknown[]) {
  return {
    userId,
    origen: "variable-dev",
    memberships,
    clerkConfigurado: false,
    sesionActiva: false,
    encabezadoRechazado: false,
  };
}

beforeEach(() => {
  getIdentidad.mockReset();
  findBySlug.mockReset();
  getIdentidad.mockResolvedValue(identidad("tecma_admin", TECMA));
});

describe("por slug — la cuenta que dice la petición ya no basta", () => {
  it("el cliente dueño pasa", async () => {
    findBySlug.mockResolvedValue({ id: "cuenta-tecma", type: "client", slug: "tecma" });

    const g = await exigir(PETICION, { tipo: "cliente", slug: "tecma" }, "json");

    expect(g.ok).toBe(true);
  });

  it("otro cliente NO pasa, aunque el slug exista y sea de un cliente real", async () => {
    findBySlug.mockResolvedValue({ id: "cuenta-otra-planta", type: "client", slug: "otra" });

    const g = await exigir(PETICION, { tipo: "cliente", slug: "otra" }, "json");

    expect(g.ok).toBe(false);
  });

  it("una cuenta de carrier no entra por la puerta de cliente", async () => {
    findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });

    const g = await exigir(PETICION, { tipo: "cliente", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(false);
  });
});

describe("por id derivado — para las rutas que no reciben cuenta", () => {
  it("pasa cuando la cuenta derivada es la suya, sin consultar por slug", async () => {
    const g = await exigir(
      PETICION,
      { tipo: "cliente-por-id", accountId: "cuenta-tecma" },
      "json",
    );

    expect(g.ok).toBe(true);
    // No hay slug de por medio: nada que la petición pueda elegir.
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("no pasa cuando el recurso resultó ser de otro cliente", async () => {
    const g = await exigir(
      PETICION,
      { tipo: "cliente-por-id", accountId: "cuenta-otra-planta" },
      "json",
    );

    expect(g.ok).toBe(false);
  });

  it("un accountId vacío nunca pasa", async () => {
    const g = await exigir(PETICION, { tipo: "cliente-por-id", accountId: "" }, "json");

    expect(g.ok).toBe(false);
  });

  it("sin membresías no pasa — el caso de una sesión de Clerk hoy", async () => {
    getIdentidad.mockResolvedValue(identidad("user_2abc", []));

    const g = await exigir(
      PETICION,
      { tipo: "cliente-por-id", accountId: "cuenta-tecma" },
      "json",
    );

    expect(g.ok).toBe(false);
  });

  it("falla CERRADO si no se puede resolver la identidad", async () => {
    getIdentidad.mockRejectedValue(new Error("DATABASE_URL no configurada"));

    const g = await exigir(
      PETICION,
      { tipo: "cliente-por-id", accountId: "cuenta-tecma" },
      "json",
    );

    expect(g.ok).toBe(false);
  });
});
