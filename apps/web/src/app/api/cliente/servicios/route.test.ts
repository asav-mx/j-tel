import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `cliente/servicios`, acción `generar` — donde la guardia de cuenta NO alcanza.
 *
 * Es la misma lección que dejó `carrier/assign`, del otro lado del producto:
 * pertenecer a la cuenta y ser dueño del recurso son preguntas distintas. La
 * guardia demuestra que perteneces a este cliente; no dice nada del
 * `profileId` que mandas, y `generateForProfile` recibe el id crudo sin
 * filtrar por cuenta. Sin la comprobación, un cliente autenticado podía crear
 * servicios esperados sobre el perfil de otro.
 *
 * La guardia se monta SIEMPRE en verde: aquí se mide únicamente la capa de
 * pertenencia del recurso.
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const profileFindById = vi.fn();
const generateForProfile = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/config-api-back", () => ({
  configApiBack: (_r: unknown, _s: unknown, _p: unknown, _e: unknown, params: Record<string, string>) =>
    new Response(JSON.stringify(params), { status: 303 }),
}));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    accounts: { findBySlug: (s: string) => findBySlug(s) },
    profiles: { findById: (id: string) => profileFindById(id) },
    occurrences: { generateForProfile: (...a: unknown[]) => generateForProfile(...a) },
    clients: { getPlantsForAccount: async () => [], resolveOperationalScope: async () => null },
  }),
}));

const { POST } = await import("./route");

const MIA = "cuenta-tecma";

function peticion(campos: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(campos)) body.set(k, v);
  return new Request("https://j-tel.io/api/cliente/servicios", { method: "POST", body });
}

const GENERAR = {
  clientSlug: "tecma",
  action: "generar",
  profileId: "perfil-x",
  fromDate: "2026-07-01",
  toDate: "2026-07-07",
};

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  profileFindById.mockReset();
  generateForProfile.mockReset();

  exigir.mockResolvedValue({ ok: true, identidad: { userId: "tecma_admin" } });
  findBySlug.mockResolvedValue({ id: MIA, type: "client", slug: "tecma" });
  generateForProfile.mockResolvedValue({ createdIds: ["o1"], skippedExisting: 0, clamped: false });
});

describe("generar ocurrencias solo sobre perfiles propios", () => {
  it("un perfil de OTRO cliente se rechaza y no se genera nada", async () => {
    profileFindById.mockResolvedValue({
      id: "perfil-x",
      contract: { clientAccountId: "cuenta-de-otro-cliente" },
    });

    await POST(peticion(GENERAR));

    expect(generateForProfile).not.toHaveBeenCalled();
  });

  it("un perfil inexistente tampoco genera nada", async () => {
    profileFindById.mockResolvedValue(null);

    await POST(peticion(GENERAR));

    expect(generateForProfile).not.toHaveBeenCalled();
  });

  it("un perfil sin contrato tampoco — no se asume dueño", async () => {
    profileFindById.mockResolvedValue({ id: "perfil-x", contract: null });

    await POST(peticion(GENERAR));

    expect(generateForProfile).not.toHaveBeenCalled();
  });

  it("con el perfil propio, sí genera", async () => {
    profileFindById.mockResolvedValue({
      id: "perfil-x",
      contract: { clientAccountId: MIA, plantId: "planta-1", plantGroupId: null },
    });

    await POST(peticion(GENERAR));

    expect(generateForProfile).toHaveBeenCalled();
  });
});

describe("la guardia sigue siendo la primera puerta", () => {
  it("si niega, no se consulta el perfil ni se genera", async () => {
    const negada = new Response(null, { status: 303 });
    exigir.mockResolvedValue({ ok: false, respuesta: negada });

    const r = await POST(peticion(GENERAR));

    expect(r).toBe(negada);
    expect(profileFindById).not.toHaveBeenCalled();
    expect(generateForProfile).not.toHaveBeenCalled();
  });
});
