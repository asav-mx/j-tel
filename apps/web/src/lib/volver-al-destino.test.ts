import { describe, it, expect, vi, beforeEach } from "vitest";
import { ENCABEZADO_RUTA_COMPLETA, PARAM_VOLVER } from "./destino-de-vuelta";

/**
 * La plomería de la pieza 1.j: que la guardia apunte a dónde ibas.
 *
 * La parte peligrosa —validar el destino— vive en `destino-de-vuelta.test.ts`,
 * con su batería de ataque y sus mutaciones. Aquí se mide lo otro: que el
 * destino se adjunte cuando sirve, que **no** se adjunte cuando sería un ciclo,
 * y que un encabezado envenenado no llegue a la URL.
 */

const headers = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headers() }));
vi.mock("@/lib/auth", () => ({ getIdentidad: vi.fn() }));
vi.mock("@/lib/db", () => ({ getRepos: () => ({ accounts: { findBySlug: vi.fn() } }) }));

const { destinoDeLaNegativa } = await import("./guardia-pagina");

function encabezadosCon(ruta: string | null) {
  return Promise.resolve({
    get: (k: string) => (k === ENCABEZADO_RUTA_COMPLETA ? ruta : null),
  });
}

beforeEach(() => {
  headers.mockReset();
  headers.mockImplementation(() => encabezadosCon("/cliente/servicio/abc?fecha=2026-08-04"));
});

describe("cuando volver sirve, se apunta", () => {
  it.each(["sin-sesion", "identidad-irresoluble", "membresia-irresoluble"] as const)(
    "%s lleva el destino",
    async (motivo) => {
      const url = new URL(await destinoDeLaNegativa(motivo), "https://j-telemetry.com");

      expect(url.pathname).toBe("/entrar");
      expect(url.searchParams.get("motivo")).toBe(motivo);
      expect(url.searchParams.get(PARAM_VOLVER)).toBe("/cliente/servicio/abc?fecha=2026-08-04");
    },
  );

  it("la búsqueda del destino no se come la de la puerta", async () => {
    // Si el destino se pegara sin codificar, su `?fecha=` se leería como un
    // parámetro de /entrar y el motivo o el volver se perderían.
    const url = new URL(
      await destinoDeLaNegativa("sin-sesion"),
      "https://j-telemetry.com",
    );
    expect(url.searchParams.get("fecha")).toBeNull();
    expect([...url.searchParams.keys()].sort()).toEqual(["motivo", PARAM_VOLVER].sort());
  });
});

/**
 * `sin-alcance` es «entraste bien y esto no es tuyo». Devolver a esa persona al
 * mismo sitio la mete en un ciclo: entra, vuelve, la niegan otra vez.
 */
describe("cuando volver sería un ciclo, no se apunta", () => {
  it("sin-alcance nunca lleva destino", async () => {
    const url = new URL(await destinoDeLaNegativa("sin-alcance"), "https://j-telemetry.com");

    expect(url.searchParams.get("motivo")).toBe("sin-alcance");
    expect(url.searchParams.get(PARAM_VOLVER)).toBeNull();
  });
});

describe("falla cerrado: sin destino utilizable, la negativa sigue siendo negativa", () => {
  it.each([
    ["sin encabezado", null],
    ["con una ruta que no es una cara nuestra", "/landing"],
    ["con la puerta misma, que sería un bucle", "/entrar?motivo=sin-sesion"],
  ])("%s → niega igual, sin volver", async (_caso, ruta) => {
    headers.mockImplementation(() => encabezadosCon(ruta));

    const url = new URL(await destinoDeLaNegativa("sin-sesion"), "https://j-telemetry.com");

    expect(url.pathname).toBe("/entrar");
    expect(url.searchParams.get("motivo")).toBe("sin-sesion");
    expect(url.searchParams.get(PARAM_VOLVER)).toBeNull();
  });

  it("si leer los encabezados truena, la negativa se emite igual", async () => {
    headers.mockImplementation(() => {
      throw new Error("headers() fuera de contexto de petición");
    });

    await expect(destinoDeLaNegativa("sin-sesion")).resolves.toBe("/entrar?motivo=sin-sesion");
  });
});

/**
 * El encabezado lo pone nuestro middleware y nunca trae origen. Aun así se
 * valida: si algún día alguien lo escribe desde otro lado, o un proxy lo
 * reenvía desde el cliente, esto es lo que impide que un destino externo llegue
 * a la URL de la puerta.
 */
describe("un encabezado envenenado no llega a la URL", () => {
  it.each([
    "https://evil.com",
    "//evil.com",
    "/..//evil.com",
    "javascript:alert(1)",
  ])("%s se descarta", async (ruta) => {
    headers.mockImplementation(() => encabezadosCon(ruta));

    const url = new URL(await destinoDeLaNegativa("sin-sesion"), "https://j-telemetry.com");

    expect(url.searchParams.get(PARAM_VOLVER)).toBeNull();
    expect(url.origin).toBe("https://j-telemetry.com");
  });
});
