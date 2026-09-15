import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `/api/jstaff/reverify-day` re-sella: re-emite el juicio sobre jornadas que un
 * cliente ya recibió. Desde el 15 sep 2026 no basta con ser J-Staff: sin la
 * lista autorizada y la cifra tecleada, no se toca el motor.
 */

const exigir = vi.fn();
const findById = vi.fn();
const reverifyContract = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({ getRepos: () => ({ contracts: { findById: (id: string) => findById(id) } }) }));
vi.mock("@jtel/services", () => ({
  VerificationService: class {
    reverifyContract = (...a: unknown[]) => reverifyContract(...a);
  },
}));

const { POST } = await import("./route");

function peticion(cuerpo: Record<string, unknown>) {
  return new Request("https://j-telemetry.com/api/jstaff/reverify-day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

const valido = {
  contractId: "contrato-tecma-47",
  serviceDate: "2026-09-11",
  esperadas: ["occ-a", "occ-b"],
  confirmacion: "RESELLAR 21",
  autorizados: 21,
};

beforeEach(() => {
  exigir.mockReset().mockResolvedValue({ ok: true, identidad: { userId: "user_3HQu" } });
  findById.mockReset().mockResolvedValue({ id: "contrato-tecma-47" });
  reverifyContract.mockReset().mockResolvedValue([{ occurrenceId: "occ-a", status: "cumplido" }]);
});

describe("sin lista y sin cifra, el motor no se toca", () => {
  it("sin `esperadas` se niega: la pantalla vieja mandaba sólo contrato y fecha", async () => {
    const { esperadas: _, ...sinLista } = valido;
    const r = await POST(peticion(sinLista));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("Pide la lista primero");
    expect(reverifyContract).not.toHaveBeenCalled();
  });

  it("con `esperadas` vacía también", async () => {
    const r = await POST(peticion({ ...valido, esperadas: [] }));
    expect(r.status).toBe(400);
    expect(reverifyContract).not.toHaveBeenCalled();
  });

  it("sin confirmación, o con una que no lleva la cifra autorizada, se niega", async () => {
    for (const confirmacion of [undefined, "", "si", "RESELLAR", "RESELLAR 20", "resellar 21"]) {
      const r = await POST(peticion({ ...valido, confirmacion }));
      expect(r.status, String(confirmacion)).toBe(400);
    }
    expect(reverifyContract).not.toHaveBeenCalled();
  });
});

describe("con lista y cifra, re-sella exactamente lo autorizado y dice quién", () => {
  it("pasa los ids al motor como `esperadas` y registra al usuario de la sesión", async () => {
    const r = await POST(peticion(valido));
    expect(r.status).toBe(200);
    expect(reverifyContract).toHaveBeenCalledWith(
      "contrato-tecma-47",
      expect.objectContaining({
        serviceDate: "2026-09-11",
        esperadas: ["occ-a", "occ-b"],
        actorKind: "human:jstaff",
        actorId: "user_3HQu",
      }),
    );
  });

  it("si el día cambió desde la lista, el motor se niega y la ruta lo dice con 409", async () => {
    reverifyContract.mockRejectedValue(
      new Error("Lo que se iba a re-sellar cambió entre la lista y la confirmación: … No se re-selló nada"),
    );
    const r = await POST(peticion(valido));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("No se re-selló nada");
  });
});

describe("la guardia sigue siendo la primera puerta", () => {
  it("si niega, no se lee el cuerpo contra la base ni se toca el motor", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 401 }) });
    const r = await POST(peticion(valido));
    expect(r.status).toBe(401);
    expect(findById).not.toHaveBeenCalled();
    expect(reverifyContract).not.toHaveBeenCalled();
  });
});
