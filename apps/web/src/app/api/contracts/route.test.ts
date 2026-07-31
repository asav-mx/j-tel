import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `contracts` (GET+POST) — la 26 de 26 rutas de cliente, la que se quedó
 * fuera del PR #134.
 *
 * GET leía el slug de un query param opcional y, si faltaba, caía al primer
 * cliente que hubiera en todo el sistema: fuga entre cuentas confirmada. Aquí
 * se mide que ahora exige contra el slug ANTES de tocar el repo, y que sin
 * slug ni siquiera se llega a preguntar.
 *
 * POST no comprobaba nada: el `clientAccountId` viajaba crudo en el body y se
 * usaba tal cual. Aquí se mide que la guardia se pregunta por el
 * `clientAccountId` que salió del body YA VALIDADO por zod, no por un slug
 * aparte — igual que `profiles/route.test.ts` mide que la cuenta sale del
 * contrato y no de un hardcode.
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const findForClient = vi.fn();
const create = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    accounts: { findBySlug: (slug: string) => findBySlug(slug) },
    contracts: {
      findForClient: (id: string) => findForClient(id),
      create: (d: unknown) => create(d),
    },
  }),
}));

const { GET, POST } = await import("./route");

const CLIENTE_A = "11111111-1111-4111-8111-111111111111";
const CLIENTE_B = "22222222-2222-4222-8222-222222222222";

function peticionGet(account = "tecma") {
  const url = new URL("https://j-tel.io/api/contracts");
  if (account) url.searchParams.set("account", account);
  return new Request(url);
}

const CUERPO = {
  carrierAccountId: "33333333-3333-4333-8333-333333333333",
  clientAccountId: CLIENTE_A,
  plantId: "44444444-4444-4444-8444-444444444444",
  name: "Contrato de prueba",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  policy: { toleranceMinutes: 0, routeStrictness: "destino_only" },
};

function peticionPost(body: unknown = CUERPO) {
  return new Request("https://j-tel.io/api/contracts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  findForClient.mockReset();
  create.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "tecma_admin" } });
  findBySlug.mockResolvedValue({ id: CLIENTE_A, type: "client" });
  findForClient.mockResolvedValue([{ id: "contrato-1" }]);
  create.mockResolvedValue({ id: "contrato-nuevo" });
});

describe("GET — exige contra el slug, ya no cae al primer cliente del sistema", () => {
  it("sin account, ni siquiera pregunta", async () => {
    const r = await GET(peticionGet(""));

    expect(r.status).toBe(400);
    expect(exigir).not.toHaveBeenCalled();
    expect(findBySlug).not.toHaveBeenCalled();
    expect(findForClient).not.toHaveBeenCalled();
  });

  it("con account, exige antes de tocar el repo", async () => {
    await GET(peticionGet("tecma"));

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "cliente", slug: "tecma" },
      "json",
    );
  });

  it("si la guardia niega, no lista nada", async () => {
    const negada = new Response(null, { status: 403 });
    exigir.mockResolvedValue({ ok: false, respuesta: negada });

    const r = await GET(peticionGet("tecma"));

    expect(r).toBe(negada);
    expect(findForClient).not.toHaveBeenCalled();
  });

  it("con todo en regla, filtra por la cuenta resuelta del slug", async () => {
    // Dos cuentas distintas: si la ruta filtrara por algo fijo, esta prueba
    // no cuadraría salvo que el id realmente venga de resolver el slug.
    findBySlug.mockResolvedValue({ id: CLIENTE_B, type: "client" });

    await GET(peticionGet("otra-planta"));

    expect(findForClient).toHaveBeenCalledWith(CLIENTE_B);
  });
});

describe("POST — la cuenta sale del body ya validado, no de un slug aparte", () => {
  it("un cuerpo malformado ni siquiera toca la base", async () => {
    const r = await POST(peticionPost({ name: "sin ids" }));

    expect(r.status).toBe(400);
    expect(exigir).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("se le pregunta a la guardia por el clientAccountId del body", async () => {
    await POST(peticionPost());

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "cliente-por-id", accountId: CLIENTE_A },
      "json",
    );
  });

  it("y sigue al body cuando el dueño es otro", async () => {
    await POST(peticionPost({ ...CUERPO, clientAccountId: CLIENTE_B }));

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "cliente-por-id", accountId: CLIENTE_B },
      "json",
    );
  });

  it("si la guardia niega, no se crea el contrato", async () => {
    const negada = new Response(null, { status: 403 });
    exigir.mockResolvedValue({ ok: false, respuesta: negada });

    const r = await POST(peticionPost());

    expect(r).toBe(negada);
    expect(create).not.toHaveBeenCalled();
  });

  it("con todo en regla, crea", async () => {
    const r = await POST(peticionPost());

    expect(r.status).toBe(201);
    expect(create).toHaveBeenCalled();
  });
});
