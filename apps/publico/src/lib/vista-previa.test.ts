import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repos = { circuits: { getPublishedCircuitBySlug: vi.fn(), getCircuitByPublicSlug: vi.fn() } };
vi.mock("@/lib/db", () => ({ getRepos: () => repos }));

const { vistaPreviaPermitida, circuitoParaLaApp } = await import("./vista-previa");

const PUBLICADO = { id: "p", publicSlug: "ruta-viva", publishedAt: new Date() };
const SIN_PUBLICAR = { id: "s", publicSlug: "corredor-prueba", publishedAt: null };

const entorno = process.env.NODE_ENV;
const previa = process.env.JTEL_VISTA_PREVIA;
beforeEach(() => {
  vi.clearAllMocks();
  repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(null);
  repos.circuits.getCircuitByPublicSlug.mockResolvedValue(null);
});
afterEach(() => {
  vi.stubEnv("NODE_ENV", entorno ?? "test");
  vi.stubEnv("JTEL_VISTA_PREVIA", previa ?? "");
});

describe("la puerta de la vista previa", () => {
  it("en producción NO abre, aunque la variable nombre el slug", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JTEL_VISTA_PREVIA", "corredor-prueba");
    expect(vistaPreviaPermitida("corredor-prueba")).toBe(false);
  });

  it("no hay valor que abra todo", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const comodin of ["1", "true", "*", "todos", "si"]) {
      vi.stubEnv("JTEL_VISTA_PREVIA", comodin);
      expect(vistaPreviaPermitida("corredor-prueba")).toBe(false);
    }
  });

  it("abre solo el slug nombrado, no sus vecinos", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JTEL_VISTA_PREVIA", "corredor-prueba");
    expect(vistaPreviaPermitida("corredor-prueba")).toBe(true);
    expect(vistaPreviaPermitida("oasis-centro")).toBe(false);
    expect(vistaPreviaPermitida("corredor-prueba-2")).toBe(false);
  });

  it("sin la variable no abre nada", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JTEL_VISTA_PREVIA", "");
    expect(vistaPreviaPermitida("corredor-prueba")).toBe(false);
  });
});

describe("circuitoParaLaApp", () => {
  it("el publicado sale siempre, y NO marcado como vista previa", async () => {
    vi.stubEnv("NODE_ENV", "production");
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(PUBLICADO);
    const r = await circuitoParaLaApp("ruta-viva");
    expect(r).toEqual({ circuito: PUBLICADO, esVistaPrevia: false });
  });

  it("en producción, el sin publicar es null — y nunca se le pregunta a la base por él", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JTEL_VISTA_PREVIA", "corredor-prueba");
    repos.circuits.getCircuitByPublicSlug.mockResolvedValue(SIN_PUBLICAR);
    expect(await circuitoParaLaApp("corredor-prueba")).toBeNull();
    expect(repos.circuits.getCircuitByPublicSlug).not.toHaveBeenCalled();
  });

  it("fuera de producción y nombrado, sale marcado como vista previa", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JTEL_VISTA_PREVIA", "corredor-prueba");
    repos.circuits.getCircuitByPublicSlug.mockResolvedValue(SIN_PUBLICAR);
    const r = await circuitoParaLaApp("corredor-prueba");
    expect(r).toEqual({ circuito: SIN_PUBLICAR, esVistaPrevia: true });
  });

  it("un slug inventado sigue siendo null aunque la vista previa esté abierta", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JTEL_VISTA_PREVIA", "corredor-prueba");
    expect(await circuitoParaLaApp("no-existe")).toBeNull();
  });
});
