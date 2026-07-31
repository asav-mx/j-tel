import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `profiles` POST — la ruta que no recibe cuenta.
 *
 * El cuerpo trae un `contractId` y nada más, así que la cuenta se DERIVA del
 * contrato. Eso es lo que se mide aquí: que la guardia se pregunte por el
 * dueño del contrato y no por algo que la petición pueda elegir.
 *
 * El orden también importa y se comprueba: si el contrato no existe o la
 * guardia niega, no se crea nada.
 */

const exigir = vi.fn();
const findById = vi.fn();
const create = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    contracts: { findById: (id: string) => findById(id) },
    profiles: { create: (d: unknown) => create(d) },
  }),
}));

const { POST } = await import("./route");

/**
 * Un id que no se parece a nada que la ruta pudiera fijar por su cuenta: si la
 * aserción lo encuentra, es porque salió del contrato.
 */
const DUENIO_DEL_CONTRATO = "cuenta-solo-obtenible-del-contrato";

const CUERPO = {
  contractId: "11111111-1111-4111-8111-111111111111",
  routeShiftId: "22222222-2222-4222-8222-222222222222",
  geofenceId: "33333333-3333-4333-8333-333333333333",
  name: "Ruta de prueba",
  activeDays: [1, 2, 3],
};

function peticion(body: unknown = CUERPO) {
  return new Request("https://j-tel.io/api/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  exigir.mockReset();
  findById.mockReset();
  create.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "tecma_admin" } });
  findById.mockResolvedValue({ id: CUERPO.contractId, clientAccountId: DUENIO_DEL_CONTRATO });
  create.mockResolvedValue({ id: "perfil-nuevo" });
});

describe("la cuenta se deriva del contrato, no del cuerpo", () => {
  it("se le pregunta a la guardia por el dueño del contrato", async () => {
    await POST(peticion());

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "cliente-por-id", accountId: DUENIO_DEL_CONTRATO },
      "json",
    );
  });

  it("y sigue al contrato cuando el dueño es otro", async () => {
    // La primera versión de esta prueba fijaba el mismo id que la ruta acabó
    // usando, así que un valor hardcodeado la habría pasado igual. Con dos
    // dueños distintos, el valor tiene que venir del contrato o no cuadra.
    findById.mockResolvedValue({ id: CUERPO.contractId, clientAccountId: "cuenta-de-otro-cliente" });

    await POST(peticion());

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "cliente-por-id", accountId: "cuenta-de-otro-cliente" },
      "json",
    );
  });

  it("si la guardia niega, no se crea el perfil", async () => {
    const negada = new Response(null, { status: 403 });
    exigir.mockResolvedValue({ ok: false, respuesta: negada });

    const r = await POST(peticion());

    expect(r).toBe(negada);
    expect(create).not.toHaveBeenCalled();
  });

  it("un contrato inexistente corta antes de preguntar y antes de escribir", async () => {
    findById.mockResolvedValue(null);

    const r = await POST(peticion());

    expect(r.status).toBe(404);
    expect(exigir).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("un cuerpo malformado ni siquiera toca la base", async () => {
    const r = await POST(peticion({ name: "sin ids" }));

    expect(r.status).toBe(400);
    expect(findById).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("con todo en regla, crea", async () => {
    const r = await POST(peticion());

    expect(r.status).toBe(201);
    expect(create).toHaveBeenCalled();
  });
});
