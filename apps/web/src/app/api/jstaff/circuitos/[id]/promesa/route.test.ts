import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La captura de la promesa por franja. Las reglas de fondo —todo o nada, contra
 * el horario, sin encimarse— son de `savePromiseTable` y `validarFranjas`, con
 * sus pruebas contra base de verdad (`promesa-por-franja.integration.test.ts`).
 * Aquí: la guardia va primero, lo que no es franja no llega al repositorio, el
 * reemplazo pide motivo, y un rechazo vuelve con el renglón y su razón.
 */

const exigir = vi.fn();
const getCircuit = vi.fn();
const getPromiseTableVigente = vi.fn();
const savePromiseTable = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    circuits: {
      getCircuit: (id: string) => getCircuit(id),
      getPromiseTableVigente: (id: string) => getPromiseTableVigente(id),
      savePromiseTable: (...a: unknown[]) => savePromiseTable(...a),
    },
  }),
}));

const { POST } = await import("./route");

const mandar = (cuerpo: unknown) =>
  POST(
    new Request("https://j-telemetry.com/api/jstaff/circuitos/c1/promesa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
    { params: Promise.resolve({ id: "c1" }) },
  );

const f = (x: Record<string, unknown> = {}) => ({
  diaTipo: "entre_semana",
  sentido: null,
  desdeLocal: "06:00",
  hastaLocal: "09:00",
  frequencyMinutes: 10,
  ...x,
});

beforeEach(() => {
  for (const m of [exigir, getCircuit, getPromiseTableVigente, savePromiseTable]) m.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "jstaff_admin" } });
  getCircuit.mockResolvedValue({ id: "c1", name: "Oasis-Centro" });
  getPromiseTableVigente.mockResolvedValue(null);
  savePromiseTable.mockResolvedValue({ ok: true, tableId: "t1" });
});

it("la guardia va primero: sólo J-Staff, y si niega no se guarda nada", async () => {
  exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
  const r = await mandar({ franjas: [f()] });
  expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "jstaff" });
  expect(r.status).toBe(403);
  expect(savePromiseTable).not.toHaveBeenCalled();
});

it("la primera promesa se guarda sin motivo, completa", async () => {
  const r = await mandar({ franjas: [f(), f({ desdeLocal: "09:00", hastaLocal: "20:00", frequencyMinutes: 20 })] });
  expect(r.status).toBe(200);
  expect(savePromiseTable.mock.calls[0]![0]).toBe("c1");
  expect(savePromiseTable.mock.calls[0]![1]).toHaveLength(2);
});

it("lo que no es franja no llega al repositorio", async () => {
  const r = await mandar({ franjas: [f({ desdeLocal: "09:00", hastaLocal: "06:00" })] });
  expect(r.status).toBe(400);
  expect((await r.json()).error).toContain("termina antes de empezar");
  expect(savePromiseTable).not.toHaveBeenCalled();
});

it("reemplazar una promesa vigente pide motivo, y con él se guarda", async () => {
  getPromiseTableVigente.mockResolvedValue({ tabla: { id: "t0" }, bandas: [] });
  const sin = await mandar({ franjas: [f()] });
  expect(sin.status).toBe(400);
  expect(savePromiseTable).not.toHaveBeenCalled();

  const con = await mandar({ franjas: [f()], motivo: "  El concesionario subió la frecuencia en hora pico  " });
  expect(con.status).toBe(200);
  expect(savePromiseTable.mock.calls[0]![2]).toEqual({ motivo: "El concesionario subió la frecuencia en hora pico" });
});

it("un rechazo vuelve con el renglón y la razón en palabras — y no se guardó nada", async () => {
  const franjas = [f(), f({ desdeLocal: "05:00", hastaLocal: "07:00" })];
  savePromiseTable.mockImplementation(async (_id: string, leidas: Array<Record<string, unknown>>) => ({
    ok: false,
    rechazadas: [{ franja: leidas[1], motivo: "fuera_de_horario_de_servicio" }],
  }));
  const r = await mandar({ franjas });
  expect(r.status).toBe(422);
  const cuerpo = await r.json();
  expect(cuerpo.rechazadas).toEqual([
    { indice: 1, razon: "La franja 05:00–07:00 cae fuera del horario de servicio del circuito." },
  ]);
});
