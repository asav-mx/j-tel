import { beforeEach, expect, it, vi } from "vitest";

/**
 * Editar un circuito desde J-Staff, con las reglas firmadas (0051, A4b). Qué
 * cambió y el «antes» los decide el repositorio leyendo la base
 * (`cambiarCircuito`, con su prueba de integración); aquí: la guardia va
 * primero, el motivo y el autor llegan al repositorio —el autor de la sesión,
 * nunca del formulario—, y cada rechazo vuelve con su frase.
 */
const exigir = vi.fn();
const cambiarCircuito = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ circuits: { cambiarCircuito: (...a: unknown[]) => cambiarCircuito(...a) } }),
}));

const { POST } = await import("./route");
const mandar = (campos: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  return POST(new Request("https://j-telemetry.com/api/jstaff/circuitos/c1", { method: "POST", body: form }), {
    params: Promise.resolve({ id: "c1" }),
  });
};
const destino = (r: Response) => new URL(r.headers.get("location")!);

beforeEach(() => {
  exigir.mockReset();
  cambiarCircuito.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_asav" } });
  cambiarCircuito.mockResolvedValue({ ok: true, circuito: {}, registrados: 1 });
});

it("la guardia va primero: sólo J-Staff, y si niega no se escribe nada", async () => {
  exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
  expect((await mandar({ corredorEnRutaM: "120", motivo: "x" })).status).toBe(403);
  expect(cambiarCircuito).not.toHaveBeenCalled();
});

it("el motivo del formulario y el autor de la SESIÓN llegan al repositorio", async () => {
  await mandar({ corredorEnRutaM: "120", toleranciaLlegadaPct: "35", minutosFueraCorredor: "4", motivo: "  calibración  ", cambiadoPor: "inventado" });
  expect(cambiarCircuito).toHaveBeenCalledWith(
    "c1",
    { corridorToleranceMeters: 120, arrivalTolerancePct: 35, corridorExitMinutes: 4 },
    { motivo: "calibración", por: "user_asav" },
  );
});

it("sin motivo, el repositorio no guarda y la pantalla dice por qué", async () => {
  cambiarCircuito.mockResolvedValue({ ok: false, error: "falta_motivo" });
  const r = await mandar({ frescuraSeg: "200" });
  expect(destino(r).searchParams.get("error")).toMatch(/regla de la medición/);
});

it("la tolerancia de llegada no pasa de 100 %, y ni llega al repositorio", async () => {
  const r = await mandar({ toleranciaLlegadaPct: "150", motivo: "x" });
  expect(destino(r).searchParams.get("error")).toMatch(/100 %/);
  expect(cambiarCircuito).not.toHaveBeenCalled();
});

it("el aviso de guardado dice cuántas reglas cambiaron", async () => {
  cambiarCircuito.mockResolvedValue({ ok: true, circuito: {}, registrados: 2 });
  const r = await mandar({ horaInicio: "06:00", horaFin: "22:00", motivo: "nuevo horario" });
  expect(destino(r).searchParams.get("ok")).toBe("Guardado · 2 reglas cambiadas, con su motivo");
});
