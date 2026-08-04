import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `carrier/assign` — la ruta donde la guardia de cuenta NO alcanza.
 *
 * Pertenecer al carrier y ser dueño de los recursos son dos preguntas
 * distintas. `assignDevice` cierra la asignación abierta de ese GPS **o de esa
 * unidad**, sin filtrar por carrier: con solo la guardia, un carrier
 * autenticado podía mandar el `unitId` de otro y cerrarle su emparejamiento
 * vigente, dejando a esa unidad sin GPS acreditado y sin verificación.
 *
 * Por eso estas pruebas montan la guardia SIEMPRE en verde y miden únicamente
 * la capa de pertenencia. Si midieran las dos juntas, un fallo en la guardia
 * las pintaría de verde por la razón equivocada.
 */

const exigir = vi.fn();
const getUnitsForCarrier = vi.fn();
const getDevicesForCarrier = vi.fn();
const assignDevice = vi.fn();
const findBySlug = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));

vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    accounts: { findBySlug: (s: string) => findBySlug(s) },
    fleet: {
      getUnitsForCarrier: (id: string) => getUnitsForCarrier(id),
      getDevicesForCarrier: (id: string) => getDevicesForCarrier(id),
      assignDevice: (...a: unknown[]) => assignDevice(...a),
    },
  }),
}));

const { POST } = await import("./route");

const PROPIO = { id: "cuenta-jb", type: "carrier", slug: "juarez-bus" };

function peticion(campos: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(campos)) body.set(k, v);
  return new Request("https://j-telemetry.com/api/carrier/assign", { method: "POST", body });
}

beforeEach(() => {
  exigir.mockReset();
  getUnitsForCarrier.mockReset();
  getDevicesForCarrier.mockReset();
  assignDevice.mockReset();
  findBySlug.mockReset();

  // La guardia en verde: aquí se mide la capa de pertenencia, no la guardia.
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "jb_admin" } });
  findBySlug.mockResolvedValue(PROPIO);
  getUnitsForCarrier.mockResolvedValue([{ id: "unidad-propia" }]);
  getDevicesForCarrier.mockResolvedValue([{ id: "gps-propio" }]);
});

describe("los recursos de otro carrier no se tocan, aunque la cuenta sea la tuya", () => {
  it("una unidad ajena se rechaza y NO se escribe", async () => {
    const r = await POST(
      peticion({ carrierSlug: "juarez-bus", unitId: "unidad-de-otro", deviceId: "gps-propio" }),
    );

    expect(r.status).toBe(403);
    expect(assignDevice).not.toHaveBeenCalled();
  });

  it("un GPS ajeno se rechaza y NO se escribe", async () => {
    const r = await POST(
      peticion({ carrierSlug: "juarez-bus", unitId: "unidad-propia", deviceId: "gps-de-otro" }),
    );

    expect(r.status).toBe(403);
    expect(assignDevice).not.toHaveBeenCalled();
  });

  it("con los dos recursos propios, sí empareja", async () => {
    const r = await POST(
      peticion({ carrierSlug: "juarez-bus", unitId: "unidad-propia", deviceId: "gps-propio" }),
    );

    expect(assignDevice).toHaveBeenCalledWith("unidad-propia", "gps-propio", expect.any(Date));
    expect(r.status).toBe(307);
  });
});

describe("la guardia sigue siendo la primera puerta", () => {
  it("si niega, no se consulta la flota ni se escribe", async () => {
    const negada = new Response(null, { status: 303 });
    exigir.mockResolvedValue({ ok: false, respuesta: negada });

    const r = await POST(
      peticion({ carrierSlug: "otro-bus", unitId: "unidad-propia", deviceId: "gps-propio" }),
    );

    expect(r).toBe(negada);
    expect(getUnitsForCarrier).not.toHaveBeenCalled();
    expect(assignDevice).not.toHaveBeenCalled();
  });

  it("se le pregunta por el carrier del cuerpo, no por otra cosa", async () => {
    await POST(
      peticion({ carrierSlug: "juarez-bus", unitId: "unidad-propia", deviceId: "gps-propio" }),
    );

    expect(exigir).toHaveBeenCalledWith(
      expect.anything(),
      { tipo: "carrier", slug: "juarez-bus" },
      expect.anything(),
    );
  });
});
