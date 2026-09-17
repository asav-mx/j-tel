import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `casa/dispositivos` — la puerta de las acciones de C4. Lo que se mide aquí:
 * la guardia va antes que todo, quién actuó sale de la sesión, y cada salida
 * vuelve a la pantalla con su aviso o su hecho. Las reglas de cada acción tienen
 * sus pruebas en `@jtel/services` (`acciones-dispositivo.test.ts`).
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const darDeAltaDispositivo = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));
const asignarDispositivo = vi.fn();
const soltarDispositivo = vi.fn();
const darDeBajaDispositivo = vi.fn();

vi.mock("@jtel/services", () => ({
  darDeAltaDispositivo: (...a: unknown[]) => darDeAltaDispositivo(...a),
  asignarDispositivo: (...a: unknown[]) => asignarDispositivo(...a),
  soltarDispositivo: (...a: unknown[]) => soltarDispositivo(...a),
  darDeBajaDispositivo: (...a: unknown[]) => darDeBajaDispositivo(...a),
}));

const { POST } = await import("./route");

function mandar(campos: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  return POST(new Request("https://j-telemetry.com/api/casa/dispositivos", { method: "POST", body: form }));
}
const destino = (r: Response) => new URL(r.headers.get("location")!);

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  darDeAltaDispositivo.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_coordinador" } });
  findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });
});

describe("la guardia va primero", () => {
  it("pregunta si maneja la flota de esa cuenta, y si no, no escribe", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 303 }) });
    const r = await mandar({ account: "juarez-bus", accion: "alta", imei: "860693082402380", prefijo: "TK-FTC927" });
    expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "carrier-maneja-flota", slug: "juarez-bus" });
    expect(r.status).toBe(303);
    expect(darDeAltaDispositivo).not.toHaveBeenCalled();
  });
});

describe("dar de alta", () => {
  it("con éxito, vuelve al cuarto nombrando qué dispositivo se dio de alta", async () => {
    darDeAltaDispositivo.mockResolvedValue({ ok: true, deviceId: "d9", nombre: "TK-FTC927-009" });
    const r = await mandar({ account: "juarez-bus", accion: "alta", imei: "8606 9308 2402 380", prefijo: "TK-FTC927" });
    expect(darDeAltaDispositivo.mock.calls[0]![1]).toEqual({
      carrierId: "cuenta-jb",
      imeiCapturado: "8606 9308 2402 380",
      prefijo: "TK-FTC927",
    });
    const d = destino(r);
    expect(d.pathname).toBe("/casa/transportista/dispositivos");
    expect(d.searchParams.get("hecho")).toBe("alta");
    expect(d.searchParams.get("dispositivo")).toBe("d9");
    expect(d.searchParams.get("account")).toBe("juarez-bus");
  });

  it("con error, vuelve al panel abierto con el aviso y lo tecleado", async () => {
    darDeAltaDispositivo.mockResolvedValue({
      ok: false,
      error: "imei_en_otra_cuenta",
      mensaje: "Ese IMEI ya está dado de alta en otra cuenta. No se da de alta dos veces: pide a J-Tel que lo mueva.",
    });
    const d = destino(await mandar({ account: "juarez-bus", accion: "alta", imei: "860693089187232", prefijo: "TK-FTC927" }));
    expect(d.searchParams.get("accion")).toBe("alta");
    expect(d.searchParams.get("error")).toContain("otra cuenta");
    expect(d.searchParams.get("imei")).toBe("860693089187232");
  });
});

describe("las tres de Ver ‹dispositivo› (C4-c)", () => {
  const FICHA = "/casa/transportista/expedientes/dispositivo/d1";

  beforeEach(() => {
    asignarDispositivo.mockReset();
    soltarDispositivo.mockReset();
    darDeBajaDispositivo.mockReset();
  });

  it("asignar: quién sale de la sesión, y vuelve a la ficha por la misma puerta nombrando al desplazado", async () => {
    asignarDispositivo.mockResolvedValue({ ok: true, unidadAnteriorId: null, dispositivoDesplazadoId: "d5" });
    const d = destino(
      await mandar({ account: "juarez-bus", accion: "asignar", deviceId: "d1", unitId: "u1", desde: "dispositivos", por: "user_falso" }),
    );
    expect(asignarDispositivo.mock.calls[0]![1]).toMatchObject({ carrierId: "cuenta-jb", deviceId: "d1", unitId: "u1", por: "user_coordinador" });
    expect(d.pathname).toBe(FICHA);
    expect(Object.fromEntries(d.searchParams)).toEqual({ desde: "dispositivos", hecho: "asignado", desplazado: "d5", account: "juarez-bus" });
  });

  it("soltar sin motivo: vuelve al panel con el aviso", async () => {
    soltarDispositivo.mockResolvedValue({ ok: false, error: "motivo_vacio", mensaje: "Escribe el motivo." });
    const d = destino(await mandar({ account: "juarez-bus", accion: "soltar", deviceId: "d1", motivo: " " }));
    expect(d.pathname).toBe(FICHA);
    expect(d.searchParams.get("accion")).toBe("soltar");
    expect(d.searchParams.get("error")).toBe("Escribe el motivo.");
  });

  it("dar de baja con éxito: el hecho, sin texto que la pantalla vaya a repetir", async () => {
    darDeBajaDispositivo.mockResolvedValue({ ok: true, unidadSoltadaId: "u1" });
    const d = destino(await mandar({ account: "juarez-bus", accion: "baja", deviceId: "d1", motivo: "Se quemó" }));
    expect(darDeBajaDispositivo.mock.calls[0]![1]).toMatchObject({ motivo: "Se quemó", por: "user_coordinador" });
    expect(d.searchParams.get("hecho")).toBe("baja");
  });

  it("un dispositivo de otra cuenta vuelve al cuarto: su ficha sería un 404 y el aviso no se vería", async () => {
    soltarDispositivo.mockResolvedValue({ ok: false, error: "dispositivo_no_encontrado", mensaje: "Ese dispositivo no es de esta cuenta." });
    const d = destino(await mandar({ account: "juarez-bus", accion: "soltar", deviceId: "ajeno", motivo: "x" }));
    expect(d.pathname).toBe("/casa/transportista/dispositivos");
    expect(d.searchParams.get("error")).toBe("Ese dispositivo no es de esta cuenta.");
  });
});

it("una acción que no existe no escribe nada", async () => {
  const d = destino(await mandar({ account: "juarez-bus", accion: "borrar" }));
  expect(d.searchParams.get("error")).toBe("Esa acción no existe.");
  expect(darDeAltaDispositivo).not.toHaveBeenCalled();
});
