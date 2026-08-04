import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La guardia de las rutas de API.
 *
 * La prueba que más importa es la del fallo cerrado. El resguardo del
 * distintivo de identidad falla ABIERTO —un adorno no puede tumbar la pantalla
 * que lo hospeda— y es fácil copiar ese reflejo al lugar equivocado. Aquí la
 * regla se invierte: una guardia que se cae y deja pasar no es una guardia.
 *
 * Comprobado que estas pruebas sirven: cambiando cualquiera de los dos
 * `catch` de `guardia-api.ts` por un `return { ok: true, identidad }`, las
 * pruebas de fallo cerrado fallan y las demás siguen verdes.
 */

const getIdentidad = vi.fn();
const findBySlug = vi.fn();

vi.mock("@/lib/auth", () => ({
  getIdentidad: () => getIdentidad(),
}));

vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));

const { exigir } = await import("./guardia-api");

/** Una petición cualquiera: la guardia la usa de origen para los redirects. */
const PETICION = new Request("https://j-telemetry.com/api/jstaff/purge-profile", { method: "POST" });

/** Membresías tal como salen del seed. */
const JSTAFF = [
  { accountId: "cuenta-jstaff", clerkUserId: "jstaff_admin", role: "admin_plataforma", scopeType: "global" as const },
];
const CLIENTE_TECMA = [
  { accountId: "cuenta-tecma", clerkUserId: "tecma_admin", role: "admin_corporativo", scopeType: "account" as const, scopeId: "cuenta-tecma" },
];
const CARRIER_JB = [
  { accountId: "cuenta-jb", clerkUserId: "jb_admin", role: "admin", scopeType: "account" as const, scopeId: "cuenta-jb" },
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
});

describe("falla CERRADO — lo contrario del distintivo del layout", () => {
  it("si no se puede resolver la identidad, no se pasa", async () => {
    getIdentidad.mockRejectedValue(new Error("DATABASE_URL no configurada"));

    const g = await exigir(PETICION, { tipo: "jstaff" }, "json");

    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.respuesta.status).toBe(403);
  });

  it("si falla la consulta de la cuenta, tampoco se pasa", async () => {
    getIdentidad.mockResolvedValue(identidad("jb_admin", CARRIER_JB));
    findBySlug.mockRejectedValue(new Error("conexión perdida"));

    const g = await exigir(PETICION, { tipo: "carrier", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(false);
  });
});

describe("J-Staff", () => {
  it("deja pasar a admin_plataforma", async () => {
    getIdentidad.mockResolvedValue(identidad("jstaff_admin", JSTAFF));

    const g = await exigir(PETICION, { tipo: "jstaff" }, "json");

    expect(g.ok).toBe(true);
  });

  it("NIEGA a tecma_admin — que es la identidad por defecto de hoy", async () => {
    getIdentidad.mockResolvedValue(identidad("tecma_admin", CLIENTE_TECMA));

    const g = await exigir(PETICION, { tipo: "jstaff" }, "json");

    expect(g.ok).toBe(false);
  });

  it("niega a quien no tiene ninguna membresía — el caso de una sesión de Clerk hoy", async () => {
    getIdentidad.mockResolvedValue(identidad("user_2abc", []));

    const g = await exigir(PETICION, { tipo: "jstaff" }, "json");

    expect(g.ok).toBe(false);
  });
});

describe("la cuenta del cuerpo ya no basta: hay que pertenecer a ella", () => {
  it("el carrier dueño pasa", async () => {
    getIdentidad.mockResolvedValue(identidad("jb_admin", CARRIER_JB));
    findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });

    const g = await exigir(PETICION, { tipo: "carrier", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(true);
  });

  it("otro carrier NO pasa, aunque mande el slug correcto en el cuerpo", async () => {
    getIdentidad.mockResolvedValue(identidad("jb_admin", CARRIER_JB));
    // El slug existe y es un carrier de verdad — solo que no es el suyo.
    findBySlug.mockResolvedValue({ id: "cuenta-otro-carrier", type: "carrier", slug: "otro-bus" });

    const g = await exigir(PETICION, { tipo: "carrier", slug: "otro-bus" }, "json");

    expect(g.ok).toBe(false);
  });

  it("un cliente no entra por la puerta del carrier ni con su propio slug", async () => {
    getIdentidad.mockResolvedValue(identidad("tecma_admin", CLIENTE_TECMA));
    findBySlug.mockResolvedValue({ id: "cuenta-tecma", type: "client", slug: "tecma" });

    const g = await exigir(PETICION, { tipo: "carrier", slug: "tecma" }, "json");

    expect(g.ok).toBe(false);
  });

  it("un slug vacío nunca pasa, y ni siquiera consulta la base", async () => {
    getIdentidad.mockResolvedValue(identidad("jb_admin", CARRIER_JB));

    const g = await exigir(PETICION, { tipo: "carrier", slug: "" }, "json");

    expect(g.ok).toBe(false);
    expect(findBySlug).not.toHaveBeenCalled();
  });
});

describe("carrier-o-jstaff — la puerta de las credenciales GPS", () => {
  it("J-Staff entra sin ser del carrier", async () => {
    getIdentidad.mockResolvedValue(identidad("jstaff_admin", JSTAFF));

    const g = await exigir(PETICION, { tipo: "carrier-o-jstaff", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(true);
    // Ni siquiera necesitó mirar la cuenta.
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("el carrier dueño entra", async () => {
    getIdentidad.mockResolvedValue(identidad("jb_admin", CARRIER_JB));
    findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });

    const g = await exigir(PETICION, { tipo: "carrier-o-jstaff", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(true);
  });

  it("un tercero no entra", async () => {
    getIdentidad.mockResolvedValue(identidad("tecma_admin", CLIENTE_TECMA));
    findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });

    const g = await exigir(PETICION, { tipo: "carrier-o-jstaff", slug: "juarez-bus" }, "json");

    expect(g.ok).toBe(false);
  });
});

describe("contesta en el estilo de cada ruta", () => {
  beforeEach(() => {
    getIdentidad.mockResolvedValue(identidad("tecma_admin", CLIENTE_TECMA));
  });

  it("las de JSON reciben un 403 con el porqué", async () => {
    const g = await exigir(PETICION, { tipo: "jstaff" }, "json");

    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.respuesta.status).toBe(403);
    const cuerpo = await g.respuesta.json();
    expect(cuerpo.error).toContain("No autorizado");
    // Dice con quién entraste, que es lo que hace falta para desatorarse.
    expect(cuerpo.detalle).toContain("tecma_admin");
  });

  it("las de formulario reciben un 303 de vuelta, con el error en el URL", async () => {
    const g = await exigir(PETICION, { tipo: "jstaff" }, { redirigirA: "/jstaff/soporte" });

    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.respuesta.status).toBe(303);

    // Se lee con el parser de URL y no a mano: `URLSearchParams` escribe los
    // espacios como `+`, que `decodeURIComponent` no deshace.
    const destino = new URL(g.respuesta.headers.get("location") ?? "");
    expect(destino.pathname).toBe("/jstaff/soporte");
    expect(destino.searchParams.get("error")).toContain("No autorizado");
    expect(destino.searchParams.get("error")).toContain("tecma_admin");
  });
});
