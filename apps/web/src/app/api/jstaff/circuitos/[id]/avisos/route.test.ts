import { beforeEach, expect, it, vi } from "vitest";

/**
 * Capturar y retirar un aviso de la concesión (0052; Marco 8.13b): la guardia
 * va primero, quién firma sale de la sesión — nunca del formulario —, la
 * validación es la del dominio y las fechas se leen en la zona del circuito.
 */
const exigir = vi.fn();
const getCircuit = vi.fn();
const crearAviso = vi.fn();
const retirarAviso = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    circuits: {
      getCircuit: (id: string) => getCircuit(id),
      crearAviso: (...a: unknown[]) => crearAviso(...a),
      retirarAviso: (...a: unknown[]) => retirarAviso(...a),
    },
  }),
}));

const { POST } = await import("./route");
const { POST: RETIRAR } = await import("./[avisoId]/retirar/route");

const formulario = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};
const capturar = (campos: Record<string, string>) =>
  POST(new Request("https://j-telemetry.com/api/jstaff/circuitos/c1/avisos", { method: "POST", body: formulario(campos) }), {
    params: Promise.resolve({ id: "c1" }),
  });
const retirar = (campos: Record<string, string>) =>
  RETIRAR(new Request("https://j-telemetry.com/api/jstaff/circuitos/c1/avisos/a1/retirar", { method: "POST", body: formulario(campos) }), {
    params: Promise.resolve({ id: "c1", avisoId: "a1" }),
  });
const destino = (r: Response) => new URL(r.headers.get("location")!);

beforeEach(() => {
  for (const m of [exigir, getCircuit, crearAviso, retirarAviso]) m.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_asav" } });
  getCircuit.mockResolvedValue({ id: "c1", timeZone: "America/Ciudad_Juarez" });
  crearAviso.mockResolvedValue({ ok: true, aviso: { id: "a1" } });
  retirarAviso.mockResolvedValue({ ok: true, retirado: true });
});

it("la guardia va primero: sólo J-Staff", async () => {
  exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
  expect((await capturar({ titulo: "Obra" })).status).toBe(403);
  expect((await retirar({ motivo: "x" })).status).toBe(403);
  expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "jstaff" });
  expect(crearAviso).not.toHaveBeenCalled();
  expect(retirarAviso).not.toHaveBeenCalled();
});

it("quién captura sale de la sesión, nunca del formulario", async () => {
  await capturar({ titulo: "La ruta va por Av. de la Raza", capturadoPor: "alguien_inventado" });
  expect(crearAviso.mock.calls[0]![2]).toBe("user_asav");
});

it("la hora del formulario se lee en la zona del circuito", async () => {
  await capturar({ titulo: "Obra en Tecnológico", desde: "2030-01-10T08:00", hasta: "2030-01-10T18:00" });
  const aviso = crearAviso.mock.calls[0]![1] as { vigenteDesde: Date; vigenteHasta: Date };
  expect(aviso.vigenteDesde.toISOString()).toBe("2030-01-10T15:00:00.000Z"); // Juárez en enero, UTC−7
  expect(aviso.vigenteHasta.toISOString()).toBe("2030-01-11T01:00:00.000Z");
});

it("un grito no entra: regresa con la razón y no escribe", async () => {
  const r = await capturar({ titulo: "SE SUSPENDE EL SERVICIO" });
  expect(destino(r).searchParams.get("error")).toMatch(/mayúsculas/);
  expect(destino(r).hash).toBe("#avisos");
  expect(crearAviso).not.toHaveBeenCalled();
});

it("sin sesión no se captura ni se retira", async () => {
  exigir.mockResolvedValue({ ok: true, identidad: { userId: null } });
  expect(destino(await capturar({ titulo: "Obra" })).searchParams.get("error")).toMatch(/firmado/);
  expect(crearAviso).not.toHaveBeenCalled();
});

it("retirar pide motivo, y lo firma quien tiene la sesión", async () => {
  await retirar({ motivo: "Terminó la obra", retiradoPor: "otro" });
  expect(retirarAviso).toHaveBeenCalledWith("c1", "a1", { motivo: "Terminó la obra", por: "user_asav" });
  retirarAviso.mockResolvedValue({ ok: false, error: "falta_motivo" });
  expect(destino(await retirar({ motivo: "" })).searchParams.get("error")).toMatch(/por qué/);
});
